const { hasPermission } = require('../config/roles');
const scopeGuard = require('../utils/scopeGuard');
const policyService = require('./policyService');
const { resolveDefaultSelections } = require('./methodResolution');
const { resolveSequenceCriteria } = require('./batchSequenceService');
const { eligibleEquipmentForItem, evaluateExecutionReadiness } = require('./workbenchReadinessService');
const { buildNativeRun, startNativeRun } = require('./qcNativeRunService');
const { withQcAudit } = require('./qcRunAuditService');
const failure = (statusCode, code, message, details) => Object.assign(new Error(message), { statusCode, code, details });
async function scopedLab(db, actor, labId) {
    const [lab, actorLab] = await Promise.all([policyService.resolveLab(labId || actor.labId, db), policyService.resolveLab(actor.labId, db)]);
    if (!lab) throw failure(400, 'QC_RUN_LAB_REQUIRED', 'Select a registered run laboratory.');
    scopeGuard.ensureScope({ ...actor, labId: actorLab?.id || actor.labId }, { labId: lab.id }, { labField: 'labId', altLabField: null });
    return lab;
}
async function runOptions(db, actor, input = {}) {
    const lab = await scopedLab(db, actor, input.labId);
    if (typeof input.analysisCode !== 'string' || !input.analysisCode) throw failure(400, 'QC_SEQUENCE_ANALYSES_INVALID', 'Select an analysis.');
    const methods = await db.methodology.findMany({ where: { analysisCode: input.analysisCode, OR: [{ labId: lab.id }, { labId: null }] }, orderBy: [{ name: 'asc' }, { id: 'asc' }] });
    const defaultSelection = (await resolveDefaultSelections([input.analysisCode], lab.id, db)).get(input.analysisCode);
    const methodId = input.methodologyId || defaultSelection?.method?.id;
    if (input.methodologyId && !methods.some(method => method.id === input.methodologyId)) throw failure(422, 'QC_BATCH_METHOD_AMBIGUOUS', 'Select a method in this analysis and laboratory.');
    const selected = methodId && methods.find(method => method.id === methodId);
    if (!selected) return { labId: lab.id, methods, defaultMethodologyId: null, defaultError: defaultSelection?.error || null,
        methodologyId: null, eligibleEquipment: [], equipmentRequired: false, maxBatchSize: null };
    const [equipment, criteria] = await Promise.all([
        eligibleEquipmentForItem(db, { analysis: input.analysisCode, methodologyId: selected.id }, lab.id),
        resolveSequenceCriteria(lab.id, input.analysisCode, selected.id, db)
    ]);
    return { labId: lab.id, methods, defaultMethodologyId: defaultSelection?.method?.id || null, defaultError: defaultSelection?.error || null,
        methodologyId: selected.id, equipmentRequired: equipment.requirement.isRequired,
        eligibleEquipment: equipment.eligibleEquipment.filter(asset => !['BLOCKED', 'NOT_CONFIGURED'].includes(asset.readiness) && !['OVERDUE', 'FAILED'].includes(asset.calibrationStatus)),
        maxBatchSize: criteria.qcRule.resolved.maxBatchSize.value };
}
async function startWorkbenchRun(db, actor, input = {}) {
    if (!hasPermission(actor, 'CHANGE_STATUS')) throw failure(403, 'QC_RUN_PERMISSION_REQUIRED', 'QC run permission is required.');
    if (Object.keys(input).some(key => !['analysisCode', 'methodologyId', 'instrumentId', 'workItemIds', 'labId'].includes(key))) {
        throw failure(400, 'QC_RUN_INPUT_INVALID', 'Select the analysis, method, instrument and samples.');
    }
    return withQcAudit(db, { actor, input, operation: 'WORKBENCH_START' }, async tx => {
        const options = await runOptions(tx, actor, input);
        if (!options.methodologyId) throw failure(422, 'QC_BATCH_METHOD_AMBIGUOUS', 'Select the laboratory method for this run.');
        const instrumentId = input.instrumentId || null;
        if (instrumentId && !options.eligibleEquipment.some(asset => asset.id === instrumentId)) {
            throw failure(422, 'INSTRUMENT_NOT_ELIGIBLE', 'Select an eligible, ready instrument for this method.');
        }
        const built = await buildNativeRun(tx, actor, { labId: options.labId, workItemIds: input.workItemIds,
            instrumentId, analysisCode: input.analysisCode, analyses: [{ analysisCode: input.analysisCode, methodologyId: options.methodologyId }] });
        const items = await tx.workItem.findMany({ where: { id: { in: input.workItemIds } }, include: { sample: true } });
        for (const item of items) {
            const readiness = await evaluateExecutionReadiness(tx, { ...item, methodologyId: item.methodologyId || options.methodologyId }, actor, { selectedEquipmentId: instrumentId });
            if (!readiness.isReady) throw failure(409, 'QC_RUN_NOT_READY', 'The selected sample is not ready for this run.', { workItemId: item.id, blockers: readiness.blockers, reasons: readiness.reasons });
        }
        return startNativeRun(tx, built.id, actor, { instrumentId });
    });
}
module.exports = { runOptions, startWorkbenchRun };
