const crypto = require('crypto');
const prisma = require('../prisma');
const { writeResultsExecution, deriveTextureResult, selectMeasurement } = require('../services/resultWriteService');
const validationController = require('./validationController');
const { validateResultEntries } = require('../services/resultEntryPolicy');
const stateRules = require('../services/workflowStateRules');
const resultEvidence = require('../services/resultEvidenceService');
const gateEvidence = require('../services/gateEvidenceService');
const workflow = require('../workflowContract');
const { createSubmissionForItems } = require('../services/submissionStateService');
const { checkStoredCompletion } = require('../services/storedResultCompletenessService');
const { transitionWorkItem } = require('../services/workItemStateService');
const { governsResult } = require('../services/reportResultGovernance');

async function assertResultSaveReadiness(db, sample, user, measurements) {
    stateRules.assertScope(user, sample);
    // An approval is single-use even when the recorded attempt now refuses a second save.
    for (const measurement of (Array.isArray(measurements) ? measurements : []).filter(row => row?.overrideRequestId)) {
        await require('../services/resultOverrideService').available(db, measurement.overrideRequestId, user);
    }
    resultEvidence.assertAmendable(sample);
    if (!['PROCESSING', 'SUBMITTED_PARTIAL'].includes(sample.status)) {
        if(sample.status==='SUBMITTED_FULL')await require('../services/resultWriteService').assertRecordedResultSave(db,sample,measurements);
        throw new stateRules.TransitionError(`Sample is not in Processing phase (current: ${sample.status})`, 400, 'SAMPLE_NOT_PROCESSING');
    }
    const report = await gateEvidence.loadGateEvidence(db, sample);
    if (report.blocked.some(gate => gate.mismatch)) gateEvidence.assertEvidence(report);
    for (const [gate, message] of [['PREPARATION', 'Sample preparation has not been completed'], ['DRYING', 'Sample drying has not been completed']]) {
        if (report.blocked.some(blocked => blocked.analysis === gate)) throw Object.assign(new Error(message), { statusCode: 412 });
    }
    await require('../services/resultWriteService').assertRecordedResultSave(db,sample,measurements);
    return report;
}

exports.getResults = async (req, res) => {
    const { sampleId } = req.params;
    const user = req.user;

    try {
        // Fetch sample with lab fields for scope check
        const sample = await prisma.sample.findUnique({
            where: { id: sampleId },
            select: { id: true, labId: true, assignedLab: true, country: true, projectCode: true }
        });

        if (!sample) return res.status(404).json({ error: 'Sample not found' });

        // Lab Isolation Check (Phase 1 - Scope Guard)
        const scopeGuard = require('../utils/scopeGuard');
        if (!scopeGuard.canAccessEntity(user, sample, { labField: 'labId', altLabField: 'assignedLab' })) {
            return res.status(403).json({ error: 'Access denied: Sample not in your Lab scope' });
        }

        const EXCLUDED_GATE_CODES = ['DRYING', 'PREPARATION', 'PREP', 'SAMPLE_PREP', 'SIEVING', 'MILLING', 'HOMOGENIZATION', 'ARCHIVING', 'DISPOSAL'];

        const results = await prisma.result.findMany({
            where: {
                sampleId,
                isCurrent: true,
                param: { notIn: EXCLUDED_GATE_CODES }
            },
            orderBy: { createdAt: 'asc' }
        });

        // Enrich with parameter metadata (Name from Analysis)
        // Optimization: Fetch all needed analysis definitions in one go
        const paramCodes = [...new Set(results.map(r => r.param))];
        const analyses = await prisma.analysis.findMany({
            where: { code: { in: paramCodes } },
            select: { code: true, name: true, decimalPlaces: true, units: true }
        });

        const analysisMap = {};
        analyses.forEach(a => analysisMap[a.code] = a);

        const approvals = await require('../services/resultOverrideService').resultApprovals(prisma,results);
        const enriched = await Promise.all(results.map(async r => ({
            ...r,
            overrideApproval: approvals.get(r.id) || null,
            paramName: await require('../services/analysisService').getAnalysisName(r.param),
            decimalPlaces: analysisMap[r.param]?.decimalPlaces ?? 2,
            flags: typeof r.flags === 'string' ? JSON.parse(r.flags) : (r.flags || {})
        })));

        res.json(enriched);
    } catch (error) {
        console.error('[getResults] Error:', error);
        res.status(500).json({ error: 'Failed to fetch results' });
    }
};

exports.getResultHistory = async (req, res) => {
    const { sampleId, param } = req.params;
    const user = req.user;

    try {
        const sample = await prisma.sample.findUnique({
            where: { id: sampleId },
            select: { id: true, labId: true, assignedLab: true, country: true, projectCode: true }
        });

        if (!sample) return res.status(404).json({ error: 'Sample not found' });

        const scopeGuard = require('../utils/scopeGuard');
        if (!scopeGuard.canAccessEntity(user, sample, { labField: 'labId', altLabField: 'assignedLab' })) {
            return res.status(403).json({ error: 'Access denied: Sample not in your Lab scope' });
        }

        const where = { sampleId };
        if (param) where.param = param;

        const history = await prisma.result.findMany({
            where,
            orderBy: { createdAt: 'desc' }
        });

        const approvals = await require('../services/resultOverrideService').resultApprovals(prisma,history);
        res.json({ history: history.map(row => ({ ...row, overrideApproval: approvals.get(row.id) || null })) });
    } catch (error) {
        console.error('[getResultHistory] Error:', error);
        res.status(500).json({ error: 'Failed to fetch result history' });
    }
};

exports.saveResults = async (req, res) => {
    const { sampleId } = req.params;
    const { measurements } = req.body; // Array of { param, value, unit, methodologyId, equipmentId, batchId }
    const user = req.user;

    try {
        const sample = await prisma.sample.findUnique({ where: { id: sampleId } });
        if (!sample) return res.status(404).json({ error: 'Sample not found' });

        const performedBy = stateRules.actorName(user);
        await assertResultSaveReadiness(prisma, sample, user, measurements);
        const outcome = await stateRules.inTransaction(prisma, async tx => {
            const current = await tx.sample.findUnique({ where: { id: sampleId } });
            if (!current) throw new stateRules.TransitionError('Sample not found.', 404, 'SAMPLE_NOT_FOUND');
            await require('../services/resultOverrideService').preflightApprovedMeasurements(tx,sampleId,user,measurements);
            const gateReport = await assertResultSaveReadiness(tx, current, user, measurements);
            if (current.status !== sample.status) throw new stateRules.TransitionError('Sample readiness changed. Refresh before saving.', 409, 'SAMPLE_STATE_CHANGED');
            const entryError = await validateResultEntries(tx, current, measurements, user);
            if (entryError) throw Object.assign(new Error(entryError), { statusCode: 400, code: 'RESULT_ENTRY_INVALID' });

            const validatedMeasurements = [];
            const operations = [];
            const now = new Date();
            const groups=new Map(),recorded=new Map();
            for(const [index,measurement] of measurements.entries()) {
                const group=groups.get(measurement.param) || [];group.push({index,measurement});groups.set(measurement.param,group);
            }
            for(const group of groups.values()) {
                const rows=await writeResultsExecution(tx,{sampleId,measurements:group.map(row=>selectMeasurement(row.measurement)),actor:user,now});
                for(const [index,row] of rows.entries())recorded.set(group[index].index,row);
            }
            for(const [index,measurement] of measurements.entries()) {
                const row=recorded.get(index);validatedMeasurements.push({ ...measurement, validation: { valid: row.isValid, flags: JSON.parse(row.flags || '[]') } });
            }

            operations.push(db => db.auditLog.create({
                data: {
                    id: crypto.randomUUID(),
                    entity: 'RESULTS',
                    entityId: sampleId,
                    action: 'UPDATE_RESULTS',
                    performedBy,
                    timestamp: now,
                    after: JSON.stringify(gateEvidence.auditEvidence(gateReport)),
                    details: `Appended ${measurements.length} defensible results`
                }
            }));

            for (const operation of operations) await operation(tx);
            const replicates = new Set(validatedMeasurements.filter(m => ['SAND', 'SILT', 'CLAY'].includes(m.param)).map(m => Number(m.replicateNo ?? 1)));
            let derivation;
            for (const replicateNo of replicates) {
                try {await deriveTextureResult(tx, { sampleId, replicateNo, actor: user, now });}
                catch(error) {
                    if(error.code!=='RESULT_WORKITEM_REQUIRED')throw error;
                    derivation={skipped:error.code};
                }
            }

            // Compute cross-parameter sample matrix diagnostics
            const allActiveResults = await tx.result.findMany({
                where: { sampleId, isCurrent: true }
            });
            const matrixDiagnostics = validationController.validateSampleMatrix(allActiveResults);
            return { validatedMeasurements, matrixDiagnostics,derivation };
        });

        // Return validation feedback
        res.json({
            success: true,
            validation: outcome.validatedMeasurements.map(m => ({ param: m.param, flags: m.validation.flags })),
            matrixDiagnostics: outcome.matrixDiagnostics,
            ...(outcome.derivation && {derivation:outcome.derivation})
        });

    } catch (error) {
        console.error('[saveResults] Error:', error);
        if (error.statusCode) return res.status(error.statusCode).json({ error: error.message,
            ...(error.code && { code: error.code }), ...(error.details && { details: error.details }) });
        res.status(500).json({ error: 'Failed to save results' });
    }
};

exports.submitForApproval = async (req, res) => {
    const { sampleId } = req.params;
    const user = req.user;

    try {
        const outcome = await stateRules.inTransaction(prisma, async tx => {
            const sample = await tx.sample.findUnique({ where: { id: sampleId } });
            if (!sample) throw new stateRules.TransitionError('Sample not found.', 404, 'SAMPLE_NOT_FOUND');
            stateRules.assertScope(user, sample);
            const results = await tx.result.findMany({ where: { sampleId, isCurrent: true } });
            if (!results.length) throw Object.assign(new Error('No results entered'), { statusCode: 400 });
            const matrixDiagnostics = validationController.validateSampleMatrix(results);
            if (matrixDiagnostics.isBlocking) throw new stateRules.TransitionError('Scientific matrix validation failed: ' +
                matrixDiagnostics.blockingErrors.map(error => error.message).join('; '), 422, 'BLOCKING_MATRIX_DIAGNOSTICS', {
                blockingErrors: matrixDiagnostics.blockingErrors, matrixDiagnostics });
            // Retain the pinned pre-write diagnostic ordering, then enforce sealed/evidence gates.
            resultEvidence.assertAmendable(sample);
            await resultEvidence.assertNoPreparationRevert(tx, sample.id);
            await assertResultSaveReadiness(tx, sample, user);
            const items = await tx.workItem.findMany({ where: { sampleId, duplicateOf: null,
                analysis: { notIn: ['DRYING', 'PREPARATION', ...workflow.CLOSURE_TASK_ANALYSES] } }, orderBy: { id: 'asc' } });
            const selected = [], blocking = [], completion = new Map();
            for (const item of items) {
                const status = workflow.normalizeWorkItemState(item.status);
                if (['WAIVED', 'CANCELLED'].includes(status)) continue;
                if (status === 'ACCEPTED') {
                    if (!results.some(result => governsResult(item, result))) blocking.push({ workItemId: item.id, analysis: item.analysis, status, reasonCode: 'CURRENT_RESULT_REQUIRED' });
                    continue;
                }
                if (!['ASSIGNED', 'IN_PROGRESS', 'COMPLETED'].includes(status)) {
                    blocking.push({ workItemId: item.id, analysis: item.analysis, status });
                    continue;
                }
                const checked = await checkStoredCompletion(tx, sample, item, results, user);
                if (!checked.ready) blocking.push({ workItemId: item.id, analysis: item.analysis, status, reasonCode: checked.code });
                else { selected.push(item); completion.set(item.id, checked); }
            }
            if (blocking.length) throw new stateRules.TransitionError('Some canonical analytical work cannot be submitted for approval.',
                409, 'SUBMISSION_NOT_FULL', { blocking });
            const committed = await createSubmissionForItems({ db: tx, actor: user, sampleId, type: 'FULL',
                workItemIds: selected.map(item => item.id), expectedItems: selected,
                prepareItems: async (db, current, freshItems) => {
                    const completed = [];
                    for (const item of freshItems) {
                        if (item.status === 'COMPLETED') { completed.push(item); continue; }
                        const now = new Date(), checked = completion.get(item.id), history = stateRules.requireHistory(item.history);
                        history.push({ status: 'COMPLETED', action: 'STORED_RESULTS_COMPLETED', timestamp: now,
                            changedBy: user.username, resultIds: checked.resultIds, policyVersion: checked.policyVersion });
                        completed.push(await transitionWorkItem(item.id, 'COMPLETED', user, 'Existing current results complete for approval submission', {
                            completedAt: now, history: JSON.stringify(history)
                        }, db, { expected: { status: item.status, version: item.version }, audit: {
                            action: 'STORED_RESULTS_COMPLETED', details: JSON.stringify({ resultIds: checked.resultIds, policyVersion: checked.policyVersion }) } }));
                    }
                    return completed;
                } });
            return { ...committed, matrixDiagnostics };
        });
        res.json({ success: true, status: 'SUBMITTED_FULL', sample: outcome.sample, submission: outcome.submission,
            matrixDiagnostics: outcome.matrixDiagnostics });
    } catch (error) {
        console.error('[submitForApproval] Error:', error);
        if (error.code === 'BLOCKING_MATRIX_DIAGNOSTICS') return res.status(422).json({ error: error.code,
            message: error.message, blockingErrors: error.details.blockingErrors, matrixDiagnostics: error.details.matrixDiagnostics });
        res.status(error.statusCode || 500).json({ error: error.statusCode ? error.message : 'Failed to submit for approval',
            ...(error.code && { code: error.code }), ...(error.details && { details: error.details }) });
    }
};
