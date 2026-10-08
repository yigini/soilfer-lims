const { randomUUID } = require('node:crypto');
const rules = require('./workflowStateRules');
const ACTIONS = Object.freeze(['CREATED', 'FIRST_FILL', 'SUBMITTED', 'ACCEPTED', 'QUESTIONED', 'INVALIDATED', 'CORRECTED', 'REPLICATE_ADDED', 'DERIVED_RECALCULATED']);
const EDGES = Object.freeze({ RECORDED: ['SUBMITTED', 'QUESTIONED', 'INVALIDATED'], SUBMITTED: ['ACCEPTED', 'QUESTIONED', 'INVALIDATED'] });
// Only events actually appended through this transaction can cause a derived
// recalculation. A historical event id or a caller-supplied id grants no proof.
const transactionEvents = new WeakMap();
async function appendAttemptEvent(tx, item, attemptId, actor, { action, from, to, reason = null, note = null,
    oldResultIds = [], newResultIds = [], oldSourceResultIds, newSourceResultIds, sourceEventIds, reviewDecisionId }) {
    rules.requireTransaction(tx);
    if (!ACTIONS.includes(action)) throw new rules.TransitionError('Unknown attempt event.', 409, 'WORK_ATTEMPT_EVENT_INVALID');
    const performedBy = rules.actorName(actor), now = new Date();
    const derived=action==='DERIVED_RECALCULATED' ? {oldSourceResultIds,newSourceResultIds,sourceEventIds} : {};
    if(action==='DERIVED_RECALCULATED' && (!Array.isArray(sourceEventIds) || !sourceEventIds.length ||
        !Array.isArray(oldSourceResultIds) || oldSourceResultIds.length!==3 ||
        !Array.isArray(newSourceResultIds) || newSourceResultIds.length!==3)) {
        throw new rules.TransitionError('Derived recalculation requires complete source events.',409,'WORK_ATTEMPT_EVENT_INVALID');
    }
    const event=await tx.auditLog.create({ data: { id: randomUUID(), entity: 'WORK_ATTEMPT', entityId: attemptId, action,
        performedBy, performedByName: actor?.name || performedBy, timestamp: now,
        sampleId: item.sampleId, labId: item.labId || item.sample?.assignedLab || null, analysisCode: item.analysis,
        details: JSON.stringify({ from, to, reason, note, resultId: oldResultIds.length === 1 ? oldResultIds[0] : null, oldResultIds, newResultIds,
            ...derived,...(reviewDecisionId && {reviewDecisionId}) }),
        before: JSON.stringify({ status: from, resultIds: oldResultIds }), after: JSON.stringify({ status: to, resultIds: newResultIds }) } });
    const events=transactionEvents.get(tx) || [];events.push(event);transactionEvents.set(tx,events);
    return event;
}
function attemptEventsInTransaction(tx) { rules.requireTransaction(tx);return [...(transactionEvents.get(tx) || [])]; }
async function transitionAttempt(tx, item, attemptId, nextStatus, actor, { reason = null, note = null, reviewDecisionId } = {}) {
    rules.requireTransaction(tx);
    const attempt = await tx.workAttempt.findUnique({ where: { id: attemptId } });
    if (!attempt || attempt.workItemId !== item.id) throw new rules.TransitionError('Choose an attempt belonging to the work item.', 409, 'REVIEW_ATTEMPT_INVALID');
    if(attempt.status==='ACCEPTED' && nextStatus==='ACCEPTED') {
        const ids=await require('./derivedResultReviewService').assertDerivedReReview(tx,item,attempt,reviewDecisionId);
        await appendAttemptEvent(tx,item,attempt.id,actor,{action:'ACCEPTED',from:'ACCEPTED',to:'ACCEPTED',reason,note,
            newResultIds:ids,reviewDecisionId});
        return attempt;
    }
    if (!EDGES[attempt.status]?.includes(nextStatus)) throw new rules.TransitionError('The attempt is not eligible for this transition.', 409, 'WORK_ATTEMPT_TRANSITION_REFUSED');
    const changed = await tx.workAttempt.updateMany({ where: { id: attempt.id, workItemId: item.id, status: attempt.status,
        evidenceHash: attempt.evidenceHash }, data: { status: nextStatus, updatedAt: attempt.updatedAt } });
    if (changed.count !== 1) throw new rules.TransitionError('Attempt changed; reload before retrying.', 409, 'WORK_ATTEMPT_STATE_CHANGED');
    await appendAttemptEvent(tx, item, attempt.id, actor, { action: nextStatus, from: attempt.status, to: nextStatus, reason, note,
        ...(nextStatus==='ACCEPTED' && reviewDecisionId && {reviewDecisionId}) });
    return { ...attempt, status: nextStatus };
}
async function submitRecordedAttempt(tx,item,actor) {
    rules.requireTransaction(tx);
    if(require('./workItemKinds').isNonMeasurement(item))return null;
    const attemptId=await require('./reviewAttemptService').resolveReviewAttempt(tx,item,'ACCEPT');
    return transitionAttempt(tx,item,attemptId,'SUBMITTED',actor);
}
module.exports = { ACTIONS, appendAttemptEvent, transitionAttempt, submitRecordedAttempt, attemptEventsInTransaction };
