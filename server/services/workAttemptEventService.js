const { randomUUID } = require('node:crypto');
const rules = require('./workflowStateRules');
const ACTIONS = Object.freeze(['CREATED', 'FIRST_FILL', 'SUBMITTED', 'ACCEPTED', 'QUESTIONED', 'INVALIDATED', 'CORRECTED']);
const EDGES = Object.freeze({ RECORDED: ['SUBMITTED', 'QUESTIONED', 'INVALIDATED'], SUBMITTED: ['ACCEPTED', 'QUESTIONED', 'INVALIDATED'] });
async function appendAttemptEvent(tx, item, attemptId, actor, { action, from, to, reason = null, note = null,
    oldResultIds = [], newResultIds = [] }) {
    rules.requireTransaction(tx);
    if (!ACTIONS.includes(action)) throw new rules.TransitionError('Unknown attempt event.', 409, 'WORK_ATTEMPT_EVENT_INVALID');
    const performedBy = rules.actorName(actor), now = new Date();
    return tx.auditLog.create({ data: { id: randomUUID(), entity: 'WORK_ATTEMPT', entityId: attemptId, action,
        performedBy, performedByName: actor?.name || performedBy, timestamp: now,
        sampleId: item.sampleId, labId: item.labId || item.sample?.assignedLab || null, analysisCode: item.analysis,
        details: JSON.stringify({ from, to, reason, note, resultId: oldResultIds.length === 1 ? oldResultIds[0] : null, oldResultIds, newResultIds }),
        before: JSON.stringify({ status: from, resultIds: oldResultIds }), after: JSON.stringify({ status: to, resultIds: newResultIds }) } });
}
async function transitionAttempt(tx, item, attemptId, nextStatus, actor, { reason = null, note = null } = {}) {
    rules.requireTransaction(tx);
    const attempt = await tx.workAttempt.findUnique({ where: { id: attemptId } });
    if (!attempt || attempt.workItemId !== item.id) throw new rules.TransitionError('Choose an attempt belonging to the work item.', 409, 'REVIEW_ATTEMPT_INVALID');
    if (!EDGES[attempt.status]?.includes(nextStatus)) throw new rules.TransitionError('The attempt is not eligible for this transition.', 409, 'WORK_ATTEMPT_TRANSITION_REFUSED');
    const changed = await tx.workAttempt.updateMany({ where: { id: attempt.id, workItemId: item.id, status: attempt.status,
        evidenceHash: attempt.evidenceHash }, data: { status: nextStatus, updatedAt: attempt.updatedAt } });
    if (changed.count !== 1) throw new rules.TransitionError('Attempt changed; reload before retrying.', 409, 'WORK_ATTEMPT_STATE_CHANGED');
    await appendAttemptEvent(tx, item, attempt.id, actor, { action: nextStatus, from: attempt.status, to: nextStatus, reason, note });
    return { ...attempt, status: nextStatus };
}
async function submitRecordedAttempt(tx,item,actor) {
    rules.requireTransaction(tx);
    if(require('./workItemKinds').isNonMeasurement(item))return null;
    const attemptId=await require('./reviewAttemptService').resolveReviewAttempt(tx,item,'ACCEPT');
    return transitionAttempt(tx,item,attemptId,'SUBMITTED',actor);
}
module.exports = { ACTIONS, appendAttemptEvent, transitionAttempt, submitRecordedAttempt };
