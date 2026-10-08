const { randomUUID } = require('node:crypto');
const rules = require('./workflowStateRules');
const { hasPermission } = require('../config/roles');
const { isNonMeasurement } = require('./workItemKinds');
const policy = require('./policyService');
const { repeatRequest, SELF_REPEAT_REASONS } = require('./workRepeatContract');
const { appendAttemptEvent, transitionAttempt } = require('./workAttemptEventService');

async function assertRepeatCapacity(tx, item, sample) {
    const limit = await policy.get(sample.assignedLab || item.labId, 'repeats.maxAttemptsBeforeNcr',
        { analysisCode: item.analysis, methodologyId: item.methodologyId, db: tx });
    const count = await tx.workAttempt.count({ where: { workItemId: item.id } });
    if (limit !== 0 && count >= limit) throw new rules.TransitionError('The configured attempt limit requires the NCR workflow.', 409, 'ATTEMPT_LIMIT', { limit, count });
    return count;
}
async function preflightRepeat(tx, item, sample, actor, request, attemptId) {
    rules.requireTransaction(tx);
    rules.assertScope(actor, sample);
    require('./resultEvidenceService').assertAmendable(sample);
    await require('./sampleHoldService').assertNotHeld(tx, sample);
    if (isNonMeasurement(item) || item.duplicateOf || ['ACCEPTED', 'WAIVED', 'CANCELLED', 'ON_HOLD'].includes(item.status)) {
        throw new rules.TransitionError('This work cannot request a measurement repeat.', 409, 'WORK_REPEAT_STATE_REFUSED');
    }
    const reviewer = hasPermission(actor, 'APPROVE_RESULTS');
    if (!reviewer) {
        if (!hasPermission(actor, 'ENTER_RESULTS') || item.assignedTo !== rules.actorName(actor) ||
            ['SUBMITTED', 'QA_PENDING'].includes(item.status) || !SELF_REPEAT_REASONS.includes(request.reason) ||
            !await policy.get(sample.assignedLab || item.labId, 'repeats.technicianSelfRepeatBeforeSubmit',
                { analysisCode: item.analysis, methodologyId: item.methodologyId, db: tx })) {
            throw new rules.TransitionError('This repeat requires a reviewer.', 403, 'WORK_REPEAT_FORBIDDEN');
        }
    }
    const attempts = await tx.workAttempt.findMany({ where: { workItemId: item.id }, orderBy: { attemptNo: 'asc' } });
    if (attempts.some(row => row.status === 'OPEN')) throw new rules.TransitionError('An OPEN repeat already exists for this work.', 409, 'WORK_REPEAT_ALREADY_OPEN');
    // Selecting the parent never guesses between multiple execution owners.
    const parentId = attemptId || await require('./reviewAttemptService').resolveReviewAttempt(tx, item, 'RETURN');
    const parent = attempts.find(row => row.id === parentId);
    if (!parent || !['RECORDED', 'SUBMITTED'].includes(parent.status) || parent.status === 'SUBMITTED' && !reviewer) {
        throw new rules.TransitionError('The recorded attempt is not eligible for this repeat.', 409, 'WORK_REPEAT_STATE_REFUSED');
    }
    await assertRepeatCapacity(tx, item, sample);
    return { parent, attemptNo: Math.max(0, ...attempts.map(row => row.attemptNo)) + 1 };
}
async function reserveRepeat(tx, item, sample, actor, request, preflight) {
    rules.requireTransaction(tx);
    const plan = preflight || await preflightRepeat(tx, item, sample, actor, request);
    await transitionAttempt(tx, item, plan.parent.id, request.previousStatus, actor, { reason: request.reason, note: request.note });
    const now = new Date(), id = 'att-' + item.id + '-' + randomUUID();
    const attempt = await tx.workAttempt.create({ data: { id, workItemId: item.id, attemptNo: plan.attemptNo, status: 'OPEN',
        parentAttemptId: plan.parent.id, reason: request.reason, note: request.note, requestedBy: rules.actorName(actor), requestedAt: now,
        createdAt: now, updatedAt: now } });
    await appendAttemptEvent(tx, { ...item, sample }, id, actor, { action: 'CREATED', from: null, to: 'OPEN', reason: request.reason, note: request.note });
    return attempt;
}
async function requestRepeat(db, workItemId, actor, input) {
    const request = repeatRequest(input);
    return rules.inTransaction(db, async tx => {
        const item = await tx.workItem.findUnique({ where: { id: workItemId } });
        if (!item) throw new rules.TransitionError('Work item not found.', 404, 'WORK_ITEM_NOT_FOUND');
        const sample = await tx.sample.findUnique({ where: { id: item.sampleId } });
        if (!sample) throw new rules.TransitionError('Sample not found.', 404, 'SAMPLE_NOT_FOUND');
        const plan = await preflightRepeat(tx, item, sample, actor, request);
        const attempt = await reserveRepeat(tx, item, sample, actor, request, plan);
        const now = new Date(), history = rules.requireHistory(item.history);
        history.push({ status: 'REPEAT_REQUIRED', action: 'REPEAT_REQUESTED', reasonCode: request.reason, note: request.note,
            attemptId: attempt.id, parentAttemptId: plan.parent.id, changedBy: rules.actorName(actor), timestamp: now.toISOString() });
        const updated = await require('./workItemStateService').transitionWorkItem(item.id, 'REPEAT_REQUIRED', actor, request.reason, {
            submissionId: null, submittedAt: null, batchId: null, rackPosition: null, completedAt: null,
            reviewedBy: null, reviewedAt: null, reviewDecision: null, reanalysisReason: request.note || request.reason,
            history: JSON.stringify(history)
        }, tx, { expected: item, action: 'REPEAT_REQUESTED' });
        if (sample.status === 'SUBMITTED_FULL') {
            await require('./sampleStateService').transitionSample(sample.id, 'PROCESSING', actor, request.reason, {}, tx,
                { expectedStatus: sample.status, action: 'REVIEW_RETURNED', details: JSON.stringify({ attemptId: attempt.id, reasonCode: request.reason }) });
        }
        return { workItem: updated, attempt };
    });
}
module.exports = { assertRepeatCapacity, preflightRepeat, reserveRepeat, requestRepeat };
