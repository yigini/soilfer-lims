const prisma = require('../prisma');
const scopeGuard = require('../utils/scopeGuard');
const policyService = require('../services/policyService');
const { BATCH_STATES: CONTRACT_BATCH_STATES } = require('../workflowContract');
const { buildNativeRun, rebuildNativeRun, startNativeRun } = require('../services/qcNativeRunService');
const { createProfileRun } = require('../services/qcCompatibilityRunService');
const { mutateQcRun } = require('../services/qcRunMutationService');
const { QC_RUN_INCLUDE, readQcRun, batchApiView, currentAnalyteEvidence } = require('../services/qcRunViewService');
const { apiRunView, scopedBatchWhere } = require('../services/qcRunApiViewService');
const { resolveRunProfile, resolveBatchRunProfile } = require('../services/qcRunProfileService');
const { checkBatchDisposition } = require('../services/qcService');
const { normalizeBatchState } = require('../workflowContract');
const BATCH_STATES = CONTRACT_BATCH_STATES || Object.fromEntries(require('../workflowContract').BATCH_STATE_LIST.map(status => [status, status]));
function batchError(statusCode, body) {
    return Object.assign(new Error(body.error), { statusCode, body: { code: 'QC_RULE_VIOLATION', ...body } });
}
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
exports.addItemsToBatch = async (req, res) => {
    const { id } = req.params;
    const { workItemIds, rackPositions } = req.body;
    const user = req.user;

    try {
        if (!workItemIds || !Array.isArray(workItemIds) || workItemIds.length === 0) {
            return res.status(400).json({ error: 'workItemIds must be a non-empty array' });
        }

        const batch = await prisma.batch.findUnique({ where: { id } });
        if (!batch) return res.status(404).json({ error: 'Batch not found' });

        if (!scopeGuard.canAccessEntity(user, batch, { labField: 'labId' })) {
            return res.status(403).json({ error: 'Access denied: Batch outside your laboratory scope' });
        }

        if (batch.status !== 'OPEN') {
            return res.status(409).json({ code: 'QC_BATCH_MEMBERSHIP_LOCKED', error: 'Batch is not OPEN' });
        }

        const currentIdsArray = typeof batch.workItemIds === 'string' ? JSON.parse(batch.workItemIds) : (batch.workItemIds || []);
        const currentIds = new Set(currentIdsArray);

        // Resolve method/instrument profile capacity and reserved QC slots
        const runProfile = await resolveBatchRunProfile(batch);
        const capacity = batch.maxCapacity || runProfile.capacity;

        const qcSlotMap = new Map();
        (runProfile.qcSlots || []).forEach(slot => {
            qcSlotMap.set(slot.position, slot);
        });

        // Enforce total capacity
        const newIdsToAdd = workItemIds.filter(wid => !currentIds.has(wid));
        if (currentIds.size + newIdsToAdd.length > capacity) {
            return res.status(400).json({
                error: `Adding ${newIdsToAdd.length} items exceeds maximum batch capacity of ${capacity} (current: ${currentIds.size})`,
                capacity,
                currentSize: currentIds.size,
                profile: runProfile.profileKey
            });
        }

        // Validate work items exist and match batch scope & analysis
        const items = await prisma.workItem.findMany({
            where: { id: { in: workItemIds } },
            include: { sample: true }
        });

        if (items.length !== workItemIds.length) {
            return res.status(404).json({ error: 'One or more work items not found' });
        }

        const TEXTURE_ALIASES = ['TEXTURE', 'SOIL_PSD_TEXTURE', 'SOIL_TEXTURE', 'PSA', 'pSA', 'Particle Size Analysis'];
        const isTextureBatch = TEXTURE_ALIASES.includes(batch.analysis);

        for (const item of items) {
            if (item.sample && user && !scopeGuard.canAccessEntity(user, item.sample, { labField: 'assignedLab', altLabField: 'labId' })) {
                return res.status(403).json({ error: `Item ${item.id} is outside your laboratory scope.` });
            }
            const isMatch = isTextureBatch
                ? TEXTURE_ALIASES.includes(item.analysis)
                : item.analysis === batch.analysis;
            if (!isMatch) {
                return res.status(400).json({ error: `Item ${item.id} analysis (${item.analysis}) does not match batch analysis (${batch.analysis})` });
            }
            if (['SUBMITTED', 'ACCEPTED', 'WAIVED'].includes(item.status)) {
                return res.status(400).json({ error: `Item ${item.id} is already sealed (${item.status})` });
            }
        }

        // Query existing batch item positions
        const existingBatchItems = await prisma.workItem.findMany({
            where: { batchId: id },
            select: { id: true, rackPosition: true }
        });
        const occupiedPositions = new Map();
        for (const ex of existingBatchItems) {
            if (ex.rackPosition != null) {
                occupiedPositions.set(ex.rackPosition, ex.id);
            }
        }

        const explicitPositions = (rackPositions && typeof rackPositions === 'object') ? rackPositions : {};
        const seenInPayload = new Map();

        // 1. Strict validation of all explicit rack positions
        for (const wid of workItemIds) {
            if (explicitPositions[wid] !== undefined) {
                const rawPos = explicitPositions[wid];
                const pos = Number(rawPos);
                if (!Number.isInteger(pos) || isNaN(pos)) {
                    return res.status(400).json({ error: `Rack position for ${wid} must be an integer (got: ${rawPos})` });
                }
                if (pos < 1 || pos > capacity) {
                    return res.status(400).json({ error: `Rack position ${pos} for ${wid} is out of bounds (1..${capacity})` });
                }
                if (qcSlotMap.has(pos)) {
                    const qcSlot = qcSlotMap.get(pos);
                    return res.status(400).json({
                        error: `Rack position ${pos} is reserved for QC slot (${qcSlot.type}: ${qcSlot.label || qcSlot.type})`,
                        reservedSlot: qcSlot
                    });
                }
                if (seenInPayload.has(pos)) {
                    return res.status(400).json({
                        error: `Duplicate rack position ${pos} requested for ${wid} and ${seenInPayload.get(pos)}`
                    });
                }
                if (occupiedPositions.has(pos) && occupiedPositions.get(pos) !== wid) {
                    return res.status(400).json({
                        error: `Rack position ${pos} is already occupied in this batch by item ${occupiedPositions.get(pos)}`
                    });
                }
                seenInPayload.set(pos, wid);
            }
        }

        // 2. Assign positions: honor explicit or auto-assign lowest available non-QC position
        const finalPositions = {};
        let candidatePos = 1;
        for (const wid of workItemIds) {
            if (explicitPositions[wid] !== undefined) {
                finalPositions[wid] = Number(explicitPositions[wid]);
            } else {
                while (candidatePos <= capacity && (qcSlotMap.has(candidatePos) || occupiedPositions.has(candidatePos) || seenInPayload.has(candidatePos))) {
                    candidatePos++;
                }
                if (candidatePos > capacity) {
                    return res.status(400).json({
                        error: `Cannot add item ${wid}: No available non-QC rack positions remaining in profile ${runProfile.profileKey} (capacity: ${capacity})`
                    });
                }
                finalPositions[wid] = candidatePos;
                seenInPayload.set(candidatePos, wid);
                candidatePos++;
            }
        }

        // Recheck the status in the same transaction as membership changes.
        await prisma.$transaction(async tx => {
            const currentBatch = await tx.batch.findUnique({ where: { id } });
            if (!currentBatch || currentBatch.status !== BATCH_STATES.OPEN || currentBatch.workItemIds !== batch.workItemIds) {
                throw batchError(409, { code: 'QC_BATCH_MEMBERSHIP_LOCKED', error: 'Batch changed while adding items; reload the OPEN batch.' });
            }
            for (const wid of workItemIds) {
                currentIds.add(wid);
                await tx.workItem.update({
                    where: { id: wid },
                    data: { batchId: id, rackPosition: finalPositions[wid] }
                });
            }
            await tx.batch.update({
                where: { id }, data: { workItemIds: JSON.stringify(Array.from(currentIds)) }
            });
        });

        res.json({
            success: true,
            count: workItemIds.length,
            capacity,
            runProfile: runProfile.profileKey,
            positions: finalPositions
        });
    } catch (error) {
        if (error.statusCode) return res.status(error.statusCode).json(error.body);
        console.error('[addItemsToBatch] Error:', error);
        res.status(500).json({ error: 'Failed to add items to batch' });
    }
};

exports.removeItemsFromBatch = async (req, res) => {
    const { id } = req.params;
    const { workItemIds } = req.body;
    const user = req.user;

    try {
        if (!workItemIds || !Array.isArray(workItemIds) || workItemIds.length === 0) {
            return res.status(400).json({ error: 'workItemIds must be a non-empty array' });
        }

        const batch = await prisma.batch.findUnique({ where: { id } });
        if (!batch) return res.status(404).json({ error: 'Batch not found' });

        if (!scopeGuard.canAccessEntity(user, batch, { labField: 'labId' })) {
            return res.status(403).json({ error: 'Access denied: Batch outside your laboratory scope' });
        }

        if (batch.status !== 'OPEN') {
            return res.status(409).json({ code: 'QC_BATCH_MEMBERSHIP_LOCKED', error: 'Batch is not OPEN' });
        }

        const currentIdsArray = typeof batch.workItemIds === 'string' ? JSON.parse(batch.workItemIds) : (batch.workItemIds || []);
        const toRemove = new Set(workItemIds);
        const remainingIds = currentIdsArray.filter(wid => !toRemove.has(wid));

        await prisma.$transaction(async tx => {
            const currentBatch = await tx.batch.findUnique({ where: { id } });
            if (!currentBatch || currentBatch.status !== BATCH_STATES.OPEN || currentBatch.workItemIds !== batch.workItemIds) {
                throw batchError(409, { code: 'QC_BATCH_MEMBERSHIP_LOCKED', error: 'Batch changed while removing items; reload the OPEN batch.' });
            }
            await tx.batch.update({
                where: { id },
                data: { workItemIds: JSON.stringify(remainingIds) }
            });
            await tx.workItem.updateMany({
                where: { id: { in: workItemIds }, batchId: id },
                data: { batchId: null, rackPosition: null }
            });
        });

        res.json({ success: true, removed: workItemIds.length, remaining: remainingIds.length });
    } catch (error) {
        if (error.statusCode) return res.status(error.statusCode).json(error.body);
        console.error('[removeItemsFromBatch] Error:', error);
        res.status(500).json({ error: 'Failed to remove items from batch' });
    }
};

exports.checkItemBatchStatus = async (workItemId) => {
    try {
        const item = await prisma.workItem.findUnique({ where: { id: workItemId }, include: { batch: { include: QC_RUN_INCLUDE } } });
        if (!item || !item.batchId) return { batchId: null, status: 'N/A', allowed: true };
        if (!item.batch) return { batchId: item.batchId, status: 'ERROR', allowed: false };
        const analyte = item.batch.analytes.find(row => row.analysisCode === item.analysis);
        if (!analyte) return { batchId: item.batchId, status: 'ERROR', allowed: false };
        const evidence = currentAnalyteEvidence(item.batch, item.analysis);
        const status = ['QC_PASS', 'QC_WARN', 'ACCEPTED_WITH_DEVIATION'].includes(analyte.status) ? 'QC_PASS'
            : analyte.status === 'CLOSED' ? 'CLOSED' : ['QC_FAIL', 'REJECTED', 'REPEAT_ORDERED'].includes(analyte.status) ? 'QC_FAIL' : item.batch.status;
        const gate = checkBatchDisposition({ ...item.batch, status, disposition: evidence.disposition });
        return { ...gate, batchId: item.batchId, disposition: evidence.disposition, result: evidence.result };
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
