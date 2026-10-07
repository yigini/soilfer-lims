const prisma = require('../prisma');
const policyService = require('../services/policyService');
const { buildNativeRun, rebuildNativeRun, startNativeRun } = require('../services/qcNativeRunService');
const { createProfileRun } = require('../services/qcCompatibilityRunService');
const { mutateQcRun } = require('../services/qcRunMutationService');
const { QC_RUN_INCLUDE, readQcRun, batchApiView, currentAnalyteEvidence } = require('../services/qcRunViewService');
const { apiRunView, scopedBatchWhere } = require('../services/qcRunApiViewService');
const { resolveRunProfile } = require('../services/qcRunProfileService');
const { changeRunMembers } = require('../services/qcRunMembershipService');
const { reorderNativeRun } = require('../services/qcRunOrderService');
const { checkBatchDisposition } = require('../services/qcService');
const { normalizeBatchState } = require('../workflowContract');
const { analyteGateView } = require('../services/qcRunGateService');
function respondError(res, error, fallback) {
    if (!error.statusCode) console.error('[QC run]', error);
    return res.status(error.statusCode || 500).json(error.body || { code: error.code || 'QC_OPERATION_FAILED',
        error: error.statusCode ? error.message : fallback, ...(error.details && { ...error.details, details: error.details }) });
}
exports.createBatch = async (req, res) => {
    try {
        const batch = Object.hasOwn(req.body, 'workItemIds') ? await buildNativeRun(prisma, req.user, req.body)
            : await createProfileRun(prisma, req.user, req.body);
        return res.status(201).json(await apiRunView(prisma, batch));
    } catch (error) { return respondError(res, error, 'Failed to create batch'); }
};
exports.getBatches = async (req, res) => {
    try {
        const filter = {};
        if (req.query.status) filter.status = normalizeBatchState(req.query.status);
        if (req.query.analysis) filter.analysis = req.query.analysis;
        const where = await scopedBatchWhere(prisma, req.user, filter);
        const batches = await prisma.batch.findMany({ where, include: QC_RUN_INCLUDE, orderBy: { createdAt: 'desc' } });
        const data = await Promise.all(batches.map(batch => prisma.$transaction(tx => apiRunView(tx, batch))));
        return res.json({ data });
    } catch (error) { return respondError(res, error, 'Failed to get batches'); }
};
exports.getBatchById = async (req, res) => {
    try {
        const data = await prisma.$transaction(async tx => apiRunView(tx, await readQcRun(tx, req.params.id, req.user), { detail: true }));
        return res.json({ data, runProfile: data.runProfile });
    } catch (error) { return respondError(res, error, 'Failed to get batch'); }
};
exports.updateBatch = async (req, res) => {
    try {
        const outcome = await mutateQcRun(prisma, req.params.id, req.user, req.body);
        return res.json({ ...outcome, batch: batchApiView(outcome.batch, { serialized: true }) });
    } catch (error) { return respondError(res, error, 'Failed to update batch'); }
};
exports.evaluateBatch = async (req, res) => {
    try {
        const outcome = await mutateQcRun(prisma, req.params.id, req.user, req.body, { explicit: true });
        return res.json({ ...outcome, batch: batchApiView(outcome.batch, { serialized: true }) });
    } catch (error) { return respondError(res, error, 'Failed to evaluate batch'); }
};
exports.correctMeasurements = async (req, res) => {
    try { return res.json(await mutateQcRun(prisma, req.params.id, req.user, req.body, { correction: true })); }
    catch (error) { return respondError(res, error, 'Failed to correct QC measurements'); }
};
exports.startRun = async (req, res) => {
    try { return res.json({ success: true, batch: await startNativeRun(prisma, req.params.id, req.user, req.body) }); }
    catch (error) { return respondError(res, error, 'Failed to start QC run'); }
};
exports.rebuildRun = async (req, res) => {
    try { return res.json({ success: true, batch: await rebuildNativeRun(prisma, req.params.id, req.user, req.body) }); }
    catch (error) { return respondError(res, error, 'Failed to rebuild QC run'); }
};
exports.reorderRun = async (req, res) => {
    try { return res.json({ success: true, batch: await reorderNativeRun(prisma, req.params.id, req.user, req.body) }); }
    catch (error) { return respondError(res, error, 'Failed to reorder QC run'); }
};
exports.addItemsToBatch = async (req, res) => {
    try { return res.json(await changeRunMembers(prisma, req.params.id, req.user, req.body)); }
    catch (error) { return respondError(res, error, 'Failed to add items to batch'); }
};
exports.removeItemsFromBatch = async (req, res) => {
    try { return res.json(await changeRunMembers(prisma, req.params.id, req.user, req.body, { remove: true })); }
    catch (error) { return respondError(res, error, 'Failed to remove items from batch'); }
};
exports.checkItemBatchStatus = async (workItemId) => {
    try {
        const item = await prisma.workItem.findUnique({ where: { id: workItemId }, include: { batch: { include: QC_RUN_INCLUDE } } });
        if (!item || !item.batchId) return { batchId: null, status: 'N/A', allowed: true };
        if (!item.batch) return { batchId: item.batchId, status: 'ERROR', allowed: false };
        const view = analyteGateView(item.batch, item.analysis), gate = checkBatchDisposition(view);
        return { ...gate, batchId: item.batchId, disposition: view.disposition, result: view.result };
    } catch (error) {
        console.error('[checkItemBatchStatus] Error:', error);
        return { batchId: null, status: 'ERROR', allowed: false };
    }
};
exports.dispositionBatch = async (req, res) => {
    try {
        const { decision, reason, analysisCode } = req.body;
        return res.json(await require('../services/qcDispositionStateService').dispositionBatch(req.params.id, decision, reason, req.user, prisma, { analysisCode }));
    } catch (error) {
        if (!error.statusCode) console.error('[dispositionBatch] Error:', error);
        return res.status(error.statusCode || 500).json({ error: error.code || error.message, message: error.message,
            ...(error.code && { code: error.code }), ...(error.details || {}) });
    }
};
exports.RUN_PROFILES = policyService.getStrict('qc.runProfiles');
exports.resolveRunProfile = resolveRunProfile;
