const prisma = require('../prisma');
const policyService = require('../services/policyService');
const { buildNativeRun, rebuildNativeRun, startNativeRun } = require('../services/qcNativeRunService');
const { mutateQcRun } = require('../services/qcRunMutationService');
const { previewQcRun } = require('../services/qcRunPreviewService');
const { QC_RUN_INCLUDE, readQcRun, batchApiView, currentAnalyteEvidence } = require('../services/qcRunViewService');
const { apiRunView, scopedBatchWhere } = require('../services/qcRunApiViewService');
const { resolveRunProfile } = require('../services/qcRunProfileService');
const { changeRunMembers } = require('../services/qcRunMembershipService');
const { reorderNativeRun } = require('../services/qcRunOrderService');
const qcGate = require('../services/qcGateService');
const { linkReagentLot, withdrawReagentLot } = require('../services/batchReagentLotService');
const { runOptions, startWorkbenchRun } = require('../services/workbenchRunService');
const { normalizeBatchState } = require('../workflowContract');
function respondError(res, error, fallback) {
    if (!error.statusCode) console.error('[QC run]', error);
    return res.status(error.statusCode || 500).json(error.body || { code: error.code || 'QC_OPERATION_FAILED',
        error: error.statusCode ? error.message : fallback, ...(error.details && { ...error.details, details: error.details }) });
}
exports.createBatch = async (req, res) => {
    try {
        // #252: new runs always use membership and server-resolved native QC.
        // Stored PROFILE_ONLY runs retain their separate compatibility paths.
        const batch = await buildNativeRun(prisma, req.user, req.body);
        return res.status(201).json(await apiRunView(prisma, batch));
    } catch (error) { return respondError(res, error, 'Failed to create batch'); }
};
exports.linkReagentLot = async (req, res) => {
    try {
        const outcome = await linkReagentLot(prisma, req.params.id, req.user, req.body);
        return res.status(outcome.created ? 201 : 200).json(outcome);
    } catch (error) { return respondError(res, error, 'Failed to link reagent lot'); }
};
exports.runOptions = async (req, res) => {
    try { return res.json(await runOptions(prisma, req.user, req.query)); }
    catch (error) { return respondError(res, error, 'Failed to load run options'); }
};
exports.startWorkbenchRun = async (req, res) => {
    try { return res.status(201).json({ batch: await startWorkbenchRun(prisma, req.user, req.body) }); }
    catch (error) { return respondError(res, error, 'Failed to start run'); }
};
exports.withdrawReagentLot = async (req, res) => {
    try { return res.json(await withdrawReagentLot(prisma, req.params.id, req.user, { ...req.body, inventoryLotId: req.params.lotId })); }
    catch (error) { return respondError(res, error, 'Failed to withdraw reagent lot'); }
};
exports.getBatches = async (req, res) => {
    try {
        const filter = {};
        if (req.query.view !== undefined && !['my_runs', 'all_runs'].includes(req.query.view)) {
            return res.status(400).json({ code: 'QC_RUN_FILTER_INVALID', error: 'Select My runs or All runs.' });
        }
        if (req.query.view === 'my_runs') filter.OR = [
            { analystUsername: req.user.username },
            { status: 'OPEN', startedAt: null, createdBy: req.user.username }
        ];
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
exports.previewBatch = async (req, res) => {
    try { return res.json(await previewQcRun(prisma, req.params.id, req.user, req.body)); }
    catch (error) { return respondError(res, error, 'Failed to preview QC run'); }
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
        return await prisma.$transaction(async tx => {
            const item = await tx.workItem.findUnique({ where: { id: workItemId } });
            if (!item) return { batchId: null, status: 'ERROR', allowed: false };
            const rows = await qcGate.forWorkItem(item, tx), checks = rows.map(row => qcGate.decision(row.gate));
            const selected = checks.find(row => !row.allowed) || checks[0];
            return { batchId: item.batchId, status: selected?.gate.value || 'N/A', allowed: checks.every(row => row.allowed),
                code: selected?.code || null, acknowledgementRequired: checks.some(row => row.acknowledgementRequired),
                gates: rows.map(row => row.gate) };
        });
    } catch (error) {
        console.error('[checkItemBatchStatus] Error:', error);
        return { batchId: null, status: 'ERROR', allowed: false };
    }
};
exports.dispositionBatch = async (req, res) => {
    try {
        const { decision, reason, analysisCode, scope } = req.body;
        return res.json(await require('../services/qcDispositionStateService').dispositionBatch(req.params.id, decision, reason, req.user, prisma, { analysisCode, scope }));
    } catch (error) {
        if (!error.statusCode) console.error('[dispositionBatch] Error:', error);
        return res.status(error.statusCode || 500).json({ error: error.code || error.message, message: error.message,
            ...(error.code && { code: error.code }), ...(error.details || {}) });
    }
};
exports.RUN_PROFILES = policyService.getStrict('qc.runProfiles');
exports.resolveRunProfile = resolveRunProfile;
