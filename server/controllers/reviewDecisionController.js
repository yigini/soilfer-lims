/**
 * Review Decision Controller
 * Manager QA/QC decisions per work item
 */
const prisma = require('../prisma');

/**
 * Create review decision for a work item
 * POST /api/reviews/:workItemId
 */
exports.createReview = async (req, res) => {
    const user = req.user;
    const { workItemId } = req.params;
    const { decision, reason } = req.body;

    if (!['LAB_MANAGER', 'SUPER_ADMIN'].includes(user.role)) {
        return res.status(403).json({ error: 'Managers only' });
    }

    if (!['ACCEPT', 'REJECT', 'WAIVE'].includes(decision)) {
        return res.status(400).json({ error: 'decision must be ACCEPT, REJECT, or WAIVE' });
    }

    // REJECT and WAIVE require reason
    if (['REJECT', 'WAIVE'].includes(decision) && !reason) {
        return res.status(400).json({ error: 'reason required for REJECT/WAIVE' });
    }

    try {
        const item = await prisma.workItem.findUnique({ where: { id: workItemId } });
        if (!item) {
            return res.status(404).json({ error: 'Work item not found' });
        }

        // Determine new status
        let newStatus;
        switch (decision) {
            case 'ACCEPT':
                newStatus = 'ACCEPTED';
                break;
            case 'REJECT':
                newStatus = 'REANALYSIS_REQUIRED';
                break;
            case 'WAIVE':
                newStatus = 'WAIVED';
                break;
        }

        const now = new Date();
        const historyEntry = {
            status: newStatus,
            decision,
            reason,
            changedBy: user.username,
            timestamp: now.toISOString()
        };

        // Parse existing history
        let currentHistory = [];
        try {
            currentHistory = item.history ? JSON.parse(item.history) : [];
        } catch (e) { }

        const updatedHistory = [...currentHistory, historyEntry];

        await prisma.$transaction([
            prisma.workItem.update({
                where: { id: workItemId },
                data: {
                    status: newStatus,
                    history: JSON.stringify(updatedHistory),
                    updatedAt: now
                }
            }),
            prisma.auditLog.create({
                data: {
                    id: `audit-decision-${Date.now()}`,
                    entity: 'WORK_ITEM',
                    entityId: workItemId,
                    action: `REVIEW_${decision}`,
                    details: reason || `Work item ${decision.toLowerCase()}`,
                    performedBy: user.username,
                    timestamp: now
                }
            })
        ]);

        res.status(201).json({ success: true, decision, status: newStatus });
    } catch (error) {
        console.error('Review creation error:', error);
        res.status(500).json({ error: 'Failed to create review' });
    }
};

/**
 * Get review decisions
 * GET /api/reviews
 * Reconstructs from AuditLogs for compatibility
 */
exports.getReviews = async (req, res) => {
    const { workItemId, sampleId } = req.query;

    try {
        const where = {
            action: { in: ['REVIEW_ACCEPT', 'REVIEW_REJECT', 'REVIEW_WAIVE'] }
        };

        if (workItemId) {
            where.entityId = workItemId;
        }

        // Note: sampleId filtering on AuditLog needs optimization, typically AuditLog.entityId is workItemId here.
        // We'd need to join or assume context. For now, if sampleId provided, we first find workItems.
        if (sampleId) {
            const items = await prisma.workItem.findMany({
                where: { sampleId },
                select: { id: true }
            });
            const itemIds = items.map(i => i.id);
            where.entityId = { in: itemIds };
        }

        const logs = await prisma.auditLog.findMany({
            where,
            orderBy: { timestamp: 'desc' }
        });

        // Map to legacy format
        const reviews = logs.map(l => ({
            id: l.id,
            workItemId: l.entityId,
            decision: l.action.replace('REVIEW_', ''),
            reason: l.details,
            reviewedBy: l.performedBy,
            reviewedAt: l.timestamp
        }));

        res.json(reviews);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch reviews' });
    }
};
