const prisma = require('../prisma');

const BATCH_STATES = {
    OPEN: 'OPEN',
    RUNNING: 'RUNNING',
    QC_PASS: 'QC_PASS',
    QC_FAIL: 'QC_FAIL',
    CLOSED: 'CLOSED'
};

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
        if (updates.status && updates.status !== batch.status) {
            const history = typeof batch.history === 'string' ? JSON.parse(batch.history) : (batch.history || []);
            history.push({
                status: updates.status,
                changedBy: user.username,
                timestamp: new Date()
            });
            data.history = JSON.stringify(history);
        }

        // Handle JSON fields if they are in updates
        if (updates.qcResults) data.qcResults = JSON.stringify(updates.qcResults);
        if (updates.workItemIds) data.workItemIds = JSON.stringify(updates.workItemIds);
        if (updates.disposition) data.disposition = JSON.stringify(updates.disposition);

        const updatedBatch = await prisma.batch.update({
            where: { id },
            data
        });

        res.json({ success: true, batch: updatedBatch });
    } catch (error) {
        console.error('[updateBatch] Error:', error);
        res.status(500).json({ error: 'Failed to update batch' });
    }
};

exports.addItemsToBatch = async (req, res) => {
    const { id } = req.params;
    const { workItemIds } = req.body;

    try {
        const batch = await prisma.batch.findUnique({ where: { id } });
        if (!batch) return res.status(404).json({ error: 'Batch not found' });

        if (batch.status !== 'OPEN') {
            return res.status(400).json({ error: 'Batch is not OPEN' });
        }

        const currentIdsArray = typeof batch.workItemIds === 'string' ? JSON.parse(batch.workItemIds) : (batch.workItemIds || []);
        const currentIds = new Set(currentIdsArray);
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

        if (!item || !item.batchId) {
            return { batchId: null, status: 'N/A' };
        }

        return { batchId: item.batchId, status: item.batch.status };
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

        res.json({ success: true, disposition: disposition });
    } catch (error) {
        console.error('[dispositionBatch] Error:', error);
        res.status(500).json({ error: 'Failed to disposition batch' });
    }
};
