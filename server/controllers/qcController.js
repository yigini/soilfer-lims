const prisma = require('../prisma');
const { evaluateBatchQc, checkBatchDisposition, flagBatchResults } = require('../services/qcService');

const BATCH_STATES = {
    OPEN: 'OPEN',
    RUNNING: 'RUNNING',
    QC_PASS: 'QC_PASS',
    QC_FAIL: 'QC_FAIL',
    CLOSED: 'CLOSED'
};

/**
 * Persists evaluated QC results into typed BatchQcResult rows
 */
async function syncTypedQcItems(batchId, evaluated) {
    if (!evaluated) return;
    try {
        await prisma.batchQcResult.deleteMany({ where: { batchId } });

        const items = [];
        (evaluated.blanks || []).forEach((b, idx) => {
            items.push({
                id: b.id || `BLK-${batchId}-${idx}-${Date.now()}`,
                batchId,
                type: 'BLANK',
                label: b.label || 'Method Blank',
                expected: 0,
                measured: b.value !== null && b.value !== undefined ? Number(b.value) : null,
                value1: null,
                value2: null,
                recoveryPct: null,
                rpd: null,
                status: b.status || 'PASS',
                details: b.details || null
            });
        });

        (evaluated.duplicates || []).forEach((d, idx) => {
            items.push({
                id: d.id || `DUP-${batchId}-${idx}-${Date.now()}`,
                batchId,
                type: 'DUPLICATE',
                label: d.label || 'Analytical Duplicate',
                expected: null,
                measured: null,
                value1: d.value1 !== null && d.value1 !== undefined ? Number(d.value1) : null,
                value2: d.value2 !== null && d.value2 !== undefined ? Number(d.value2) : null,
                recoveryPct: null,
                rpd: d.rpd !== null && d.rpd !== undefined ? Number(d.rpd) : null,
                status: d.status || 'PASS',
                details: d.details || null
            });
        });

        (evaluated.controls || []).forEach((c, idx) => {
            items.push({
                id: c.id || `CRM-${batchId}-${idx}-${Date.now()}`,
                batchId,
                type: 'CONTROL',
                label: c.label || 'Certified Reference Material',
                expected: c.expected !== null && c.expected !== undefined ? Number(c.expected) : null,
                measured: c.measured !== null && c.measured !== undefined ? Number(c.measured) : null,
                value1: null,
                value2: null,
                recoveryPct: c.recoveryPct !== null && c.recoveryPct !== undefined ? Number(c.recoveryPct) : null,
                rpd: null,
                status: c.status || 'PASS',
                details: c.details || null
            });
        });

        if (items.length > 0) {
            await prisma.batchQcResult.createMany({ data: items });
        }
    } catch (e) {
        console.error('[syncTypedQcItems] Error syncing typed QC rows:', e);
    }
}

exports.createBatch = async (req, res) => {
    const { analysis, instrument, notes } = req.body;
    const user = req.user;

    try {
        if (!analysis) return res.status(400).json({ error: 'Analysis type required' });

        const batchId = `BATCH-${Date.now()}`;
        const now = new Date();

        const newBatch = await prisma.batch.create({
            data: {
                id: batchId,
                labId: user.labId,
                analysis,
                instrument: instrument || 'Manual',
                status: BATCH_STATES.OPEN,
                createdBy: user.username,
                createdAt: now,
                notes: notes || '',
                qcResults: JSON.stringify({ blanks: [], controls: [], duplicates: [] }),
                workItemIds: JSON.stringify([]),
                history: JSON.stringify([{
                    status: BATCH_STATES.OPEN,
                    changedBy: user.username,
                    timestamp: now
                }])
            }
        });

        await prisma.auditLog.create({
            data: {
                id: `audit-batch-cr-${Date.now()}`,
                entity: 'QC_BATCH',
                entityId: batchId,
                action: 'CREATE',
                details: `Batch created for ${analysis}`,
                performedBy: user.username,
                timestamp: now
            }
        });

        res.status(201).json(newBatch);
    } catch (error) {
        console.error('[createBatch] Error:', error);
        res.status(500).json({ error: 'Failed to create batch' });
    }
};

exports.getBatches = async (req, res) => {
    const { status, analysis } = req.query;
    try {
        // Use Scope Guard for Lab Isolation (Phase 1 Refactor)
        const scopeGuard = require('../utils/scopeGuard');
        let where = scopeGuard.buildScopedWhere(req.user, {}, { labField: 'labId' });

        if (status) where.status = status;
        if (analysis) where.analysis = analysis;

        const batches = await prisma.batch.findMany({
            where,
            include: { qcItems: true },
            orderBy: { createdAt: 'desc' }
        });

        res.json({ data: batches });
    } catch (error) {
        console.error('[getBatches] Error:', error);
        res.status(500).json({ error: 'Failed to get batches' });
    }
};

exports.updateBatch = async (req, res) => {
    const { id } = req.params;
    const updates = req.body;
    const user = req.user;

    try {
        const batch = await prisma.batch.findUnique({ where: { id } });
        if (!batch) return res.status(404).json({ error: 'Batch not found' });

        const data = { ...updates };
        let evaluated = null;

        // Auto-evaluate QC data if provided
        if (updates.qcResults || updates.blanks || updates.duplicates || updates.controls) {
            const qcPayload = updates.qcResults || {
                blanks: updates.blanks,
                duplicates: updates.duplicates,
                controls: updates.controls
            };
            evaluated = evaluateBatchQc(qcPayload);
            data.qcResults = JSON.stringify(evaluated);
            if (!updates.status && evaluated.overallStatus !== 'OPEN') {
                data.status = evaluated.overallStatus;
            }
        } else if (updates.qcResults && typeof updates.qcResults === 'object') {
            data.qcResults = JSON.stringify(updates.qcResults);
        }

        if (data.status && data.status !== batch.status) {
            const history = typeof batch.history === 'string' ? JSON.parse(batch.history) : (batch.history || []);
            history.push({
                status: data.status,
                changedBy: user.username,
                timestamp: new Date()
            });
            data.history = JSON.stringify(history);
        }

        if (updates.workItemIds) data.workItemIds = typeof updates.workItemIds === 'string' ? updates.workItemIds : JSON.stringify(updates.workItemIds);
        if (updates.disposition) data.disposition = typeof updates.disposition === 'string' ? updates.disposition : JSON.stringify(updates.disposition);

        const updatedBatch = await prisma.batch.update({
            where: { id },
            data,
            include: { qcItems: true }
        });

        // WP-29: Sync typed BatchQcResult rows and flag results carrying batchId
        if (evaluated) {
            await syncTypedQcItems(id, evaluated);
        }
        await flagBatchResults(prisma, id, updatedBatch.status, updatedBatch.disposition);

        res.json({
            success: true,
            id: updatedBatch.id,
            status: updatedBatch.status,
            batch: updatedBatch
        });
    } catch (error) {
        console.error('[updateBatch] Error:', error);
        res.status(500).json({ error: 'Failed to update batch' });
    }
};

exports.evaluateBatch = async (req, res) => {
    const { id } = req.params;
    const { blanks, duplicates, controls } = req.body;
    const user = req.user;

    try {
        const batch = await prisma.batch.findUnique({ where: { id } });
        if (!batch) return res.status(404).json({ error: 'Batch not found' });

        const evaluated = evaluateBatchQc({ blanks, duplicates, controls });
        const newStatus = evaluated.overallStatus !== 'OPEN' ? evaluated.overallStatus : batch.status;

        const history = typeof batch.history === 'string' ? JSON.parse(batch.history) : (batch.history || []);
        if (newStatus !== batch.status) {
            history.push({
                status: newStatus,
                changedBy: user.username,
                timestamp: new Date()
            });
        }

        const updatedBatch = await prisma.batch.update({
            where: { id },
            data: {
                qcResults: JSON.stringify(evaluated),
                status: newStatus,
                history: JSON.stringify(history)
            },
            include: { qcItems: true }
        });

        // WP-29: Sync typed rows and flag results
        await syncTypedQcItems(id, evaluated);
        await flagBatchResults(prisma, id, newStatus, updatedBatch.disposition);

        res.json({
            success: true,
            status: newStatus,
            evaluation: evaluated,
            batch: updatedBatch
        });
    } catch (error) {
        console.error('[evaluateBatch] Error:', error);
        res.status(500).json({ error: 'Failed to evaluate batch' });
    }
};

exports.addItemsToBatch = async (req, res) => {
    const { id } = req.params;
    const { workItemIds } = req.body;
    const user = req.user;

    try {
        if (!workItemIds || !Array.isArray(workItemIds) || workItemIds.length === 0) {
            return res.status(400).json({ error: 'workItemIds must be a non-empty array' });
        }

        const batch = await prisma.batch.findUnique({ where: { id } });
        if (!batch) return res.status(404).json({ error: 'Batch not found' });

        if (batch.status !== 'OPEN') {
            return res.status(400).json({ error: 'Batch is not OPEN' });
        }

        const scopeGuard = require('../utils/scopeGuard');
        if (user && batch.labId && user.labId && batch.labId !== user.labId && user.role !== 'SUPER_ADMIN') {
            return res.status(403).json({ error: 'Access denied: Batch outside your laboratory scope' });
        }

        const currentIdsArray = typeof batch.workItemIds === 'string' ? JSON.parse(batch.workItemIds) : (batch.workItemIds || []);
        const currentIds = new Set(currentIdsArray);

        // Enforce max batch size 40
        const newIdsToAdd = workItemIds.filter(wid => !currentIds.has(wid));
        if (currentIds.size + newIdsToAdd.length > 40) {
            return res.status(400).json({ error: `Adding ${newIdsToAdd.length} items exceeds maximum batch capacity of 40 (current: ${currentIds.size})` });
        }

        // Validate work items
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

        workItemIds.forEach(wid => currentIds.add(wid));

        await prisma.$transaction([
            prisma.batch.update({
                where: { id },
                data: { workItemIds: JSON.stringify(Array.from(currentIds)) }
            }),
            prisma.workItem.updateMany({
                where: { id: { in: workItemIds } },
                data: { batchId: id }
            })
        ]);

        res.json({ success: true, count: workItemIds.length });
    } catch (error) {
        console.error('[addItemsToBatch] Error:', error);
        res.status(500).json({ error: 'Failed to add items to batch' });
    }
};

exports.checkItemBatchStatus = async (workItemId) => {
    try {
        const item = await prisma.workItem.findUnique({
            where: { id: workItemId },
            include: { batch: true }
        });

        if (!item || !item.batchId || !item.batch) {
            return { batchId: null, status: 'N/A' };
        }

        const batch = item.batch;
        let disposition = null;
        if (batch.disposition) {
            try {
                disposition = typeof batch.disposition === 'string' ? JSON.parse(batch.disposition) : batch.disposition;
            } catch (e) { }
        }

        // If batch failed but has PROCEED_WITH_WARNING disposition from manager, allow downstream acceptance!
        if (batch.status === 'QC_FAIL' && disposition && disposition.decision === 'PROCEED_WITH_WARNING') {
            return { batchId: item.batchId, status: 'QC_PASS_WITH_WARNING', disposition };
        }

        return { batchId: item.batchId, status: item.batch.status, disposition };
    } catch (error) {
        console.error('[checkItemBatchStatus] Error:', error);
        return { batchId: null, status: 'ERROR' };
    }
};

exports.dispositionBatch = async (req, res) => {
    const { id } = req.params;
    const { decision, reason } = req.body;
    const user = req.user;

    try {
        if (!['LAB_MANAGER', 'SUPER_ADMIN'].includes(user.role)) {
            return res.status(403).json({ error: 'Manager only' });
        }

        const batch = await prisma.batch.findUnique({ where: { id } });
        if (!batch) return res.status(404).json({ error: 'Batch not found' });

        if (batch.status !== 'QC_FAIL') {
            return res.status(400).json({ error: 'Batch is not in QC_FAIL state' });
        }

        const disposition = {
            decision,
            reason,
            by: user.username,
            at: new Date()
        };

        const updatedBatch = await prisma.batch.update({
            where: { id },
            data: { disposition: JSON.stringify(disposition) }
        });

        // WP-29: Re-evaluate Result flags based on manager disposition override
        await flagBatchResults(prisma, id, 'QC_FAIL', disposition);

        res.json({ success: true, disposition: disposition });
    } catch (error) {
        console.error('[dispositionBatch] Error:', error);
        res.status(500).json({ error: 'Failed to disposition batch' });
    }
};
