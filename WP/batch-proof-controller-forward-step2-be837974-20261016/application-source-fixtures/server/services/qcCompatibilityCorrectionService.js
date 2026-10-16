const { randomUUID } = require('node:crypto');
const { hasPermission } = require('../config/roles');
const { aggregateBatchStatus } = require('../workflowContract');
const { actorName, inTransaction } = require('./workflowStateRules');
const { editableRun } = require('./qcCompatibilityRunService');
const { QC_RUN_INCLUDE, currentAnalyteEvidence, activeReopenEvent, batchApiView } = require('./qcRunViewService');
const { getNumberFormat } = require('./numberFormatService');
const { resolveBatchRunProfile } = require('./qcRunProfileService');
const { resolveQcPolicy } = require('./qcPolicyService');
const { normalizeQcNumbers, retainQcRawInput } = require('./qcNumberInputService');
const { retainReferences } = require('./referencePlacementService');
const { evaluateBatchQc, getMissingQcValueTypes, flagBatchResults } = require('./qcService');
const { parseNumber, parseDuplicateObservation } = require('../../shared/numberParse');
const { snapshotEvidence, auditRunCommand } = require('./qcRunAuditService');
const { MODE, EVENT, authorizeReviewedCorrection, reviewedCorrectionPayload, compatibilityCriteria,
    compatibilityArithmetic, missingCriteria } = require('./qcReviewedCorrectionService');
const failure = (statusCode, code, message) => Object.assign(new Error(message), { statusCode, code });

async function correctCompatibilityMeasurements(db, batchId, actor, input) {
    if (!hasPermission(actor, 'CHANGE_STATUS')) throw failure(403, 'QC_RUN_PERMISSION_REQUIRED', 'QC entry permission is required.');
    const performedBy = actorName(actor), reason = typeof input.reason === 'string' && input.reason.trim();
    if (!reason) throw failure(400, 'QC_CORRECTION_REASON_REQUIRED', 'A correction reason is required.');
    return inTransaction(db, async tx => {
        const batch = await editableRun(tx, batchId, actor, input.analysisCode, { reviewedInput: input.mode === MODE ? input : null }), analysisCode = input.analysisCode || batch.analysis;
        const analyte = batch.analytes.find(row => row.analysisCode === analysisCode);
        if (!analyte) throw failure(400, 'QC_ANALYSIS_NOT_IN_RUN', 'The analysis is not a member of this run.');
        const previous = currentAnalyteEvidence(batch, analysisCode).evaluation;
        if (!previous) throw failure(404, 'QC_MEASUREMENT_NOT_FOUND', 'There is no evaluated compatibility observation to correct.');
        const base = currentAnalyteEvidence({ ...batch, events: batch.events.filter(row => row.type !== 'REOPENED') }, analysisCode);
        const reviewed = await authorizeReviewedCorrection(tx, batch, actor, input);
        const entries = input.corrections;
        if (!Array.isArray(entries) || !entries.length || new Set(entries.map(row => `${row?.positionId}/${row?.replicateNo ?? 1}`)).size !== entries.length) {
            throw failure(400, 'QC_VALUES_MISSING', 'Submit distinct observation corrections.');
        }
        if (input.references !== undefined && (!Array.isArray(input.references) || input.references.length)) {
            throw failure(400, 'REFERENCE_VALUE_MISMATCH', 'Use a full compatibility submission to select a different reference lot.');
        }
        const context = { ...batchApiView(batch), analysis: analysisCode }, numberFormat = await getNumberFormat(batch.labId, { db: tx });
        const recorded = reviewed ? compatibilityCriteria(reviewed, base, numberFormat) : null;
        const runProfile = reviewed ? null : await resolveBatchRunProfile(context, tx);
        const policy = reviewed ? recorded.policy : await resolveQcPolicy(context, tx, numberFormat), now = new Date();
        const replacements = [];
        for (const entry of entries) {
            const replicateNo = entry?.replicateNo ?? 1, position = base.positions.find(row => row.id === entry?.positionId);
            const old = base.measurements.find(row => row.positionId === position?.id && row.replicateNo === replicateNo);
            if (!position || !old || position.historicalSnapshotSeq != null) throw failure(404, 'QC_MEASUREMENT_NOT_FOUND', 'Select an observation from the latest compatibility round.');
            const duplicate = ['SAMPLE', 'DUPLICATE'].includes(position.kind), source = Object.hasOwn(entry, 'rawInput') ? entry.rawInput : entry.value;
            const parsed = duplicate ? parseDuplicateObservation(source, numberFormat) : parseNumber(source, numberFormat);
            if (!parsed.valid || !duplicate && parsed.qualifier) throw failure(400, parsed.code === 'AMBIGUOUS_NUMBER' ? parsed.code : 'QC_VALUES_MISSING', 'A valid QC observation is required.');
            const loq = reviewed ? recorded.recordedObservationPolicies[position.id]?.loq : policy.duplicate.loq;
            if (parsed.literalLoq && !Number.isFinite(loq)) throw reviewed ? missingCriteria()
                : failure(400, 'QC_VALUES_MISSING', 'A recorded LOQ is required for this observation.');
            replacements.push({ old, next: { id: randomUUID(), batchId, analysisCode, positionId: position.id, replicateNo,
                value: parsed.censored ? null : parsed.value, rawInput: parsed.rawInput,
                censoring: parsed.censored ? parsed.qualifier : null, censoringLimit: parsed.censored ? parsed.literalLoq ? loq : parsed.value : null,
                enteredBy: performedBy, enteredAt: now, correctionReason: reason } });
        }
        const id = randomUUID(), positionIds = base.positions.filter(row => row.kind !== 'SAMPLE').map(row => row.id);
        const measurementIds = base.measurements.map(row => replacements.find(change => change.old.id === row.id)?.next.id || row.id);
        const details = { entryMode: 'CORRECTION', compatibility: true, correctionReason: reason, actor: { id: actor.id || null, username: actor.username },
            reopenEventId: activeReopenEvent(batch, analysisCode)?.id || null, positionIds, measurementIds,
            ...(reviewed && { correctionMode: MODE, sourceReference: reviewed.sourceReference, criteriaSource: recorded.criteriaSource }) };
        const candidate = { ...batch, measurements: [...batch.measurements.filter(row => !replacements.some(change => change.old.id === row.id)), ...replacements.map(change => change.next)],
            evaluations: [...batch.evaluations, { ...previous, id, version: previous.version + 1, details: JSON.stringify({ ...details, evaluation: JSON.parse(previous.details).evaluation || JSON.parse(previous.details).qcResults }) }] };
        const projected = currentAnalyteEvidence(candidate, analysisCode).qcResults;
        const arithmetic = reviewed ? compatibilityArithmetic(projected, candidate.measurements.filter(row => measurementIds.includes(row.id)), numberFormat) : structuredClone(projected);
        for (const [collection, fields] of [['blanks', ['value']], ['controls', ['expected', 'measured']], ['duplicates', ['value1', 'value2']]]) {
            for (const row of arithmetic[collection] || []) for (const field of fields) if (row.rawInput?.[field] == null && row[field] != null && row.rawInput) delete row.rawInput[field];
        }
        const payload = reviewed ? arithmetic : normalizeQcNumbers(arithmetic, numberFormat);
        const missing = getMissingQcValueTypes(payload, { qcSlots: ['BLANK', 'DUPLICATE', 'CONTROL'].filter((type, index) => payload[['blanks', 'duplicates', 'controls'][index]]?.length).map(type => ({ type })) }, numberFormat);
        if (missing.length) throw failure(400, 'QC_VALUES_MISSING', 'Correct the unresolved observations before re-evaluating this round.');
        const evaluated = retainReferences(retainQcRawInput(evaluateBatchQc(payload, { runProfile, policy,
            ...(reviewed && { recordedObservationPolicies: recorded.recordedObservationPolicies, recordedRequirements: recorded.recordedRequirements }) }), projected), projected);
        if (reviewed) evaluated.duplicates.forEach((row, index) => { row.censoringLimits = projected.duplicates[index].censoringLimits; });
        evaluated.policyVersion = policy.policyVersion; evaluated.policyValues = policy.policyValues;
        const verdict = evaluated.overallStatus === 'QC_FAIL' ? 'FAIL' : evaluated.overallStatus === 'OPEN' ? 'INCOMPLETE' : evaluated.summary.warnings?.length ? 'WARN' : 'PASS';
        await snapshotEvidence(tx, batch, actor, reason, now);
        for (const { old, next } of replacements) {
            const changed = await tx.qcMeasurement.updateMany({ where: { id: old.id, supersededById: null }, data: { supersededById: next.id } });
            if (changed.count !== 1) throw failure(409, 'QC_MEASUREMENT_CHANGED', 'The observation changed. Reload before retrying.');
            await tx.qcMeasurement.create({ data: next });
        }
        const storedEvaluation = await tx.qcEvaluation.create({ data: { id, batchId, analysisCode, version: previous.version + 1, supersedesId: previous.id,
            ruleId: policy.qcRule.id, ruleVersion: policy.qcRule.version, policyVersion: policy.policyVersion, verdict,
            evaluatedBy: performedBy, evaluatedAt: now, details: JSON.stringify({ ...details, evaluation: evaluated,
                mode:policy.qcMode,criteriaSnapshot:JSON.stringify(policy) }) } });
        await require('./nonconformityQcService').raiseCrmFailures(tx, actor, storedEvaluation);
        analyte.status = verdict === 'FAIL' ? 'QC_FAIL' : verdict === 'INCOMPLETE' ? 'QC_PENDING' : verdict === 'WARN' ? 'QC_WARN' : 'QC_PASS';
        await tx.batchAnalyte.update({ where: { id: analyte.id }, data: { status: analyte.status } });
        await tx.batch.update({ where: { id: batchId }, data: { status: aggregateBatchStatus(batch.analytes, { startedAt: batch.startedAt }) } });
        await tx.batchEvent.create({ data: { id: randomUUID(), batchId, type: reviewed ? EVENT : 'QC_CORRECTED', by: performedBy, at: now,
            payload: JSON.stringify(reviewed ? reviewedCorrectionPayload(reviewed, replacements, id, recorded.criteriaSource)
                : { analysisCode, evaluationId: id, measurementIds: replacements.map(change => change.next.id), reason }) } });
        await flagBatchResults(tx, batchId, evaluated.overallStatus, null, batch.analytes.length === 1 ? null : analysisCode);
        return { batch: batchApiView(await tx.batch.findUnique({ where: { id: batchId }, include: QC_RUN_INCLUDE })), evaluation: evaluated };
    });
}
module.exports = { correctCompatibilityMeasurements: auditRunCommand(correctCompatibilityMeasurements, 'MEASUREMENT_CORRECTION') };
