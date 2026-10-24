/**
 * Review Decision Controller
 * Manager QA/QC decisions per work item
 */
const prisma = require('../prisma');
const { reviewWorkItem } = require('./workItemController');
const { WORK_ITEM_STATES } = require('../workflowContract');
const scopeGuard = require('../utils/scopeGuard');

/**
 * Create review decision for a work item
 * POST /api/reviews/:workItemId
 */
exports.createReview = async (req, res) => {
    const { workItemId } = req.params;
    const { decision, reason } = req.body;
    const statuses = { ACCEPT: WORK_ITEM_STATES.ACCEPTED, REJECT: WORK_ITEM_STATES.REANALYSIS_REQUIRED, WAIVE: WORK_ITEM_STATES.WAIVED };
    if (!Object.hasOwn(statuses, decision)) {
        return res.status(400).json({ error: 'decision must be ACCEPT, REJECT, or WAIVE', code: 'INVALID_REVIEW_DECISION' });
    }
    if (['reason', 'note'].some(key => req.body[key] != null && typeof req.body[key] !== 'string')) {
        return res.status(400).json({ error: 'Review reason must be text', code: 'INVALID_REVIEW_REASON' });
    }
    if (['REJECT', 'WAIVE'].includes(decision) && !reason?.trim()) {
        return res.status(400).json({ error: 'reason required for REJECT/WAIVE', code: 'REVIEW_REASON_REQUIRED' });
    }
    // Keep the compatibility URL and payload, with a single review authority.
    req.params = { ...req.params, id: workItemId };
    req.body = { ...req.body, status: statuses[decision] };
    return reviewWorkItem(req, res);
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
        // AuditLog is a denormalized read model. Resolve permitted owners from
        // the authoritative sample scope even for an unfiltered history read.
        const items = await prisma.workItem.findMany({
            where: { ...(workItemId && { id: workItemId }), ...(sampleId && { sampleId }),
                sample: { is: scopeGuard.buildScopedWhere(req.user) } },
            select: { id: true }
        });
        where.entityId = { in: items.map(item => item.id) };

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
