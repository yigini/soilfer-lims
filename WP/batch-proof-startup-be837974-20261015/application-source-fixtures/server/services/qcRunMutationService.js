const { randomUUID } = require('node:crypto');
const { auditRunCommand } = require('./qcRunAuditService');
const { hasPermission } = require('../config/roles');
const { BATCH_STATE_LIST, normalizeBatchState, aggregateBatchStatus } = require('../workflowContract');
const { actorName, inTransaction } = require('./workflowStateRules');
const { QC_RUN_INCLUDE, readQcRun, batchApiView, currentAnalyteEvidence } = require('./qcRunViewService');
const { hasQcPayload, emptyQcPayload, nativeInput } = require('./qcRunApiInputService');
const { writeNativeMeasurements } = require('./qcNativeMeasurementService');
const { writeCompatibilityMeasurements, reopenCompatibilityRun } = require('./qcCompatibilityRunService');
const { reopenNativeRun } = require('./qcNativeLifecycleService');
const { startNativeRun, instrumentFor } = require('./qcNativeRunService');
const { correctCompatibilityMeasurements } = require('./qcCompatibilityCorrectionService');
const { flagBatchResults } = require('./qcService');
const { MODE, authorizeReviewedCorrection } = require('./qcReviewedCorrectionService');
const failure = (statusCode, code, message) => Object.assign(new Error(message), { statusCode, code });
const isNative = batch => batch.analytes.length > 0 && batch.analytes.every(row => row.provenance === 'NATIVE');

// Both retained entry routes use this transaction. Status/metadata refusals or a
// late database fault roll back the observations, evaluation, flags and events.
async function mutateQcRun(db, batchId, actor, input = {}, { explicit = false, correction = false } = {}) {
    if (!hasPermission(actor, 'CHANGE_STATUS')) throw failure(403, 'QC_RUN_PERMISSION_REQUIRED', 'QC entry permission is required.');
    const performedBy = actorName(actor), requested = input.status === undefined ? undefined : normalizeBatchState(input.status);
    if (requested !== undefined && !BATCH_STATE_LIST.includes(requested)) throw failure(400, 'QC_RULE_VIOLATION', 'Invalid batch status.');
    return inTransaction(db, async tx => {
        let batch = await readQcRun(tx, batchId, actor);
        if (batch.status === 'CLOSED') throw failure(400, 'QC_BATCH_LOCKED', 'Batch is CLOSED and cannot be modified.');
        if (!batch.analytes.length) throw failure(409, 'QC_RUN_STORAGE_REQUIRED', 'Install the reviewed QC run migration before modifying this batch.');
        if (input.mode === MODE && !correction) throw failure(400, 'QC_REVIEWED_ROUTE_REQUIRED', 'Use the explicit corrections route.');
        const reviewed = correction ? await authorizeReviewedCorrection(tx, batch, actor, input) : null;
        const native = isNative(batch), payload = hasQcPayload(input) || correction, clear = payload && !explicit && !correction && emptyQcPayload(input);
        const targetCode = reviewed?.analysisCode || input.analysisCode || (native && (payload || explicit) ? batch.analysis : null);
        const targetsOf = run => targetCode ? run.analytes.filter(row => row.analysisCode === targetCode) : run.analytes;
        let targets = targetsOf(batch);
        if (!targets.length) throw failure(400, 'QC_ANALYSIS_NOT_IN_RUN', 'The analysis is not a member of this run.');
        const locked = row => reviewed?.analysisCode !== row.analysisCode &&
            (['QC_FAIL', 'REJECTED', 'REPEAT_ORDERED'].includes(row.status) || Boolean(row.disposition));
        const accepted = targets.some(row => ['QC_PASS', 'QC_WARN'].includes(row.status));
        const reopen = accepted && (['OPEN', 'RUNNING'].includes(requested) || clear);
        const statusTargets = reopen ? targets.filter(row => ['QC_PASS', 'QC_WARN'].includes(row.status)) : targets;
        const canClose = targets.every(row => ['QC_PASS', 'QC_WARN', 'ACCEPTED_WITH_DEVIATION', 'CLOSED'].includes(row.status));
        if (payload && targets.some(row => locked(row) || row.status === 'CLOSED') || requested !== undefined && requested !== batch.status &&
            statusTargets.some(locked) && !(requested === 'CLOSED' && canClose)) {
            throw failure(409, 'QC_BATCH_LOCKED', 'Failed or dispositioned QC evidence is locked; use batch disposition.');
        }
        if (reopen && payload && !clear) throw failure(409, 'QC_REOPEN_SEPARATE_EVALUATION', 'Reopen the batch before submitting new QC measurements.');
        if (input.instrumentId !== undefined) {
            if (batch.startedAt && input.instrumentId !== batch.instrumentId) throw failure(409, 'QC_INSTRUMENT_FROZEN', 'Started instrument identity is frozen.');
            if (!batch.startedAt) {
                if (batch.status !== 'OPEN') throw failure(409, 'QC_BATCH_LOCKED', 'Select the instrument while the run is OPEN.');
                const instrument = await instrumentFor(tx, batch, input.instrumentId, actor);
                await tx.batch.update({ where: { id: batchId }, data: { instrumentId: instrument?.id || null } });
                batch.instrumentId = instrument?.id || null;
            }
        }
        if (native && !batch.startedAt && input.instrument !== undefined) {
            if (typeof input.instrument !== 'string') throw failure(422, 'QC_INSTRUMENT_INVALID', 'Instrument name must be text.');
            await tx.batch.update({ where: { id: batchId }, data: { instrument: input.instrument } });
            batch.instrument = input.instrument;
        }
        let evaluation = null;
        if (reopen) {
            batch = native ? await reopenNativeRun(tx, batchId, actor, input.reason, targetCode)
                : (await reopenCompatibilityRun(tx, batchId, actor, input.reason, targetCode)).batch;
        } else if (payload || explicit) {
            if (native) {
                batch = await writeNativeMeasurements(tx, batchId, actor, nativeInput(batch, input, { correction }), { correction, explicit });
                evaluation = currentAnalyteEvidence(batch, input.analysisCode || batch.analysis).qcResults;
            } else {
                let result;
                try { result = correction ? await correctCompatibilityMeasurements(tx, batchId, actor, input)
                    : await writeCompatibilityMeasurements(tx, batchId, actor, input, { clear }); }
                catch (error) {
                    if (requested === 'QC_PASS' && error.code === 'QC_VALUES_MISSING') error.message = `Submitted QC failed acceptance criteria: ${error.message}`;
                    throw error;
                }
                batch = result.batch; evaluation = result.evaluation;
            }
        }
        targets = targetsOf(batch);
        if (!reopen && requested !== undefined) {
            if (['QC_PASS', 'QC_FAIL'].includes(requested)) {
                const evidence = targets.map(row => currentAnalyteEvidence(batch, row.analysisCode));
                if (evidence.some(row => !row.evaluation || !['PASS', 'WARN', 'FAIL', 'NOT_REQUIRED'].includes(row.result))) {
                    throw failure(400, 'QC_RULE_VIOLATION', 'Cannot set this status without evaluated QC evidence.');
                }
                if (requested === 'QC_PASS' && targets.some(row => ['QC_FAIL', 'REJECTED', 'REPEAT_ORDERED'].includes(row.status))) throw failure(payload ? 400 : 409,
                    payload ? 'QC_RULE_VIOLATION' : 'QC_BATCH_LOCKED', 'Failed QC cannot become QC_PASS through a status update.');
                if (requested === 'QC_FAIL' && !targets.some(row => row.status === 'QC_FAIL')) throw failure(400, 'QC_RULE_VIOLATION', 'The requested failure status contradicts the evaluated QC evidence.');
                // The persisted aggregate follows the actual verdicts, never a
                // manually supplied acceptance or failure label.
            } else if (requested === 'CLOSED') {
                if (!hasPermission(actor, 'APPROVE_RESULTS')) throw failure(403, 'QC_CLOSE_PERMISSION_REQUIRED', 'Only lab managers can close batches.');
                const closable = targets.every(row => ['QC_PASS', 'QC_WARN', 'ACCEPTED_WITH_DEVIATION', 'CLOSED'].includes(row.status));
                if (!closable) throw failure(payload ? 409 : 400, payload ? 'QC_BATCH_FAILED' : 'QC_RULE_VIOLATION', 'QC must be passed or accepted before closing.');
                for (const row of targets) await require('./calibrationCurveService').assertRunCalibration(tx,batchId,actor,row.analysisCode);
                const now = new Date();
                for (const row of targets) {
                    if (row.status !== 'CLOSED') await tx.batchAnalyte.update({ where: { id: row.id }, data: { status: 'CLOSED' } });
                    row.status = 'CLOSED';
                }
                const status = aggregateBatchStatus(batch.analytes, { startedAt: batch.startedAt });
                await tx.batch.update({ where: { id: batchId }, data: { status, ...(status === 'CLOSED' && { completedAt: now }) } });
                await event(tx, batchId, 'CLOSED', performedBy, now, { status, analysisCodes: targets.map(row => row.analysisCode) });
            } else if (!payload && !explicit) {
                if (native && requested === 'RUNNING') batch = await startNativeRun(tx, batchId, actor, input);
                else if (native && batch.startedAt && requested === 'OPEN' && batch.status !== 'OPEN') {
                    throw failure(409, 'QC_BATCH_LOCKED', 'Use the authorized reopen path for a started run.');
                } else if (!native || !batch.startedAt) {
                    const status = requested === 'RUNNING' ? 'IN_RUN' : 'OPEN';
                    for (const row of statusTargets) {
                        await tx.batchAnalyte.update({ where: { id: row.id }, data: { status } });
                        row.status = status;
                    }
                    const startedAt = batch.startedAt || (requested === 'RUNNING' ? new Date() : null);
                    const aggregate = aggregateBatchStatus(batch.analytes, { startedAt, reopened: requested === 'OPEN' });
                    await tx.batch.update({ where: { id: batchId }, data: { status: aggregate,
                        ...(startedAt && !batch.startedAt && { startedAt }) } });
                    await event(tx, batchId, 'STATUS_CHANGED', performedBy, new Date(), {
                        status: aggregate, requestedStatus: requested, analysisCodes: statusTargets.map(row => row.analysisCode)
                    });
                    for (const row of statusTargets) await flagBatchResults(tx, batchId, requested, null, row.analysisCode);
                }
            }
        }
        const metadata = {};
        if (input.notes !== undefined) {
            if (typeof input.notes !== 'string') throw failure(400, 'QC_RULE_VIOLATION', 'Batch notes must be text.');
            metadata.notes = input.notes;
        }
        if (input.instrument !== undefined) {
            if (typeof input.instrument !== 'string') throw failure(400, 'QC_INSTRUMENT_REQUIRED', 'Instrument name must be text.');
            if (native && batch.startedAt && input.instrument !== batch.instrument) throw failure(409, 'QC_INSTRUMENT_FROZEN', 'Started instrument identity is frozen.');
            metadata.instrument = input.instrument;
        }
        if (Object.keys(metadata).length) await tx.batch.update({ where: { id: batchId }, data: metadata });
        const updated = batchApiView(await tx.batch.findUnique({ where: { id: batchId }, include: QC_RUN_INCLUDE }));
        return { success: true, id: batchId, status: updated.status, batch: updated, ...(explicit && { evaluation }) };
    });
}
async function event(tx, batchId, type, by, at, payload) {
    await tx.batchEvent.create({ data: { id: randomUUID(), batchId, type, by, at,
        payload: JSON.stringify({ ...payload, historyEntry: { ...payload, changedBy: by, timestamp: at } }) } });
}
module.exports = { mutateQcRun: auditRunCommand(mutateQcRun, (input, options = {}) =>
    options.correction ? 'MEASUREMENT_CORRECTION' : options.explicit ? 'EVALUATION' : 'RUN_UPDATE'), isNative };
