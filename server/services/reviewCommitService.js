const { randomUUID } = require('crypto');
const workflow = require('../workflowContract');

function itemStateError(item) {
    return Object.assign(new Error(`Work item ${item.id} is no longer eligible for this review.`), {
        statusCode: 409, code: 'ITEM_NOT_SUBMITTED', workItemId: item.id
    });
}

function assertReviewable(item, status) {
    const closure = workflow.CLOSURE_TASK_ANALYSES.includes(item.analysis);
    const allowed = closure
        ? (status === workflow.WORK_ITEM_STATES.ACCEPTED
            ? ['COMPLETED', 'SUBMITTED'].includes(item.status)
            : workflow.isValidWorkItemTransition(item.status, status))
        : item.status === workflow.WORK_ITEM_STATES.SUBMITTED && workflow.isValidWorkItemTransition(item.status, status);
    if (!allowed) throw itemStateError(item);
}

// The first transaction write is the CAS. A refused row creates no side effects.
async function commitReview(prisma, item, status, user, data, operations) {
    assertReviewable(item, status);
    try {
        return await prisma.$transaction(async tx => {
            const changed = await tx.workItem.updateMany({
                where: { id: item.id, status: item.status, version: item.version },
                data: { ...data, reviewedBy: user.username, reviewedAt: data.reviewedAt || new Date(),
                    version: item.version === null ? 1 : { increment: 1 } }
            });
            if (changed.count !== 1) throw itemStateError(item);
            await operations(tx);
            return tx.workItem.findUnique({ where: { id: item.id } });
        });
    } catch (error) {
        if (['P2025', 'P2034'].includes(error.code)) throw itemStateError(item);
        throw error;
    }
}

async function reconcileSubmission(prisma, submissionId, user, results, errors = []) {
    return prisma.$transaction(async tx => {
        const submission = await tx.submission.findUnique({ where: { id: submissionId } });
        if (!submission) return;
        const ids = typeof submission.workItemIds === 'string' ? JSON.parse(submission.workItemIds) : (submission.workItemIds || []);
        const committed = results.filter(row => ids.includes(row.workItemId));
        if (!committed.length) return;
        const refused = errors.filter(row => ids.includes(row.workItemId));
        const items = await tx.workItem.findMany({ where: { id: { in: ids } }, select: { status: true } });
        const reviewed = items.length === ids.length && items.every(item => ['ACCEPTED', 'REANALYSIS_REQUIRED', 'WAIVED'].includes(item.status));
        const now = new Date();
        await tx.submission.update({ where: { id: submissionId }, data: {
            status: reviewed ? 'REVIEWED' : 'PARTIALLY_REVIEWED', reviewedBy: user.username, reviewedAt: now,
            reviewNote: committed.map(row => `${row.workItemId}: ${row.decision}`).join(' | ')
        } });
        await tx.auditLog.create({ data: {
            id: `audit-sub-rev-${randomUUID()}`, entity: 'SUBMISSION', entityId: submissionId,
            action: 'SUBMISSION_REVIEWED', performedBy: user.username, timestamp: now, sampleId: String(submission.sampleId),
            details: JSON.stringify({ committedCount: committed.length, refusedCount: refused.length,
                results: committed, errors: refused })
        } });
    });
}

module.exports = { assertReviewable, commitReview, reconcileSubmission };
