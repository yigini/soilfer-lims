const rules = require('./workflowStateRules');
const { hasPermission } = require('../config/roles');
const { appendAttemptEvent } = require('./workAttemptEventService');
// Pin6070309684: input compatibility only; never copy these keys to evidence.
const DISCARDED_CORRECTION_KEYS = Object.freeze(['id', 'rawInput', 'flags', 'provenance']);
function correctionRequest(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input) ||
        Object.keys(input).some(key => !['value', 'reason', 'note', 'resultId', 'calculation', ...DISCARDED_CORRECTION_KEYS].includes(key)) ||
        input.reason !== 'TRANSCRIPTION_ERROR' || !Object.hasOwn(input, 'value') ||
        !['string', 'number'].includes(typeof input.value)) {
        throw new rules.TransitionError('Choose a value and TRANSCRIPTION_ERROR for the correction.', 400, 'ATTEMPT_CORRECTION_FIELDS_INVALID');
    }
    if (typeof input.note !== 'string' || !input.note.trim()) throw new rules.TransitionError('An explanatory correction note is required.', 400, 'ATTEMPT_CORRECTION_NOTE_REQUIRED');
    if (input.resultId != null && (typeof input.resultId !== 'string' || !input.resultId.trim())) {
        throw new rules.TransitionError('Choose a current Result on this attempt.', 409, 'ATTEMPT_CORRECTION_TARGET_INVALID');
    }
    if (Object.hasOwn(input, 'calculation') && (!input.calculation || typeof input.calculation !== 'object' ||
        Array.isArray(input.calculation) || Object.keys(input.calculation).some(key => key !== 'inputs') ||
        !Object.hasOwn(input.calculation, 'inputs'))) {
        throw new rules.TransitionError('Supply only the complete correction raw inputs.', 400, 'ATTEMPT_CORRECTION_FIELDS_INVALID');
    }
    return { value: input.value, reason: input.reason, resultId: input.resultId, note: input.note.trim(),
        ...(Object.hasOwn(input, 'calculation') && { calculation: input.calculation }) };
}
async function correctAttempt(db, attemptId, actor, input) {
    const request = correctionRequest(input);
    return rules.inTransaction(db, async tx => {
        const attempt = await tx.workAttempt.findUnique({ where: { id: attemptId }, include: { workItem: { include: { sample: true } } } });
        if (!attempt) throw new rules.TransitionError('Attempt not found.', 404, 'WORK_ATTEMPT_NOT_FOUND');
        const item = attempt.workItem, sample = item.sample;
        rules.assertScope(actor, sample);
        require('./resultEvidenceService').assertAmendable(sample);
        await require('./sampleHoldService').assertNotHeld(tx, sample);
        const reviewer = hasPermission(actor, 'APPROVE_RESULTS');
        if (!reviewer && (!hasPermission(actor, 'ENTER_RESULTS') || item.assignedTo !== rules.actorName(actor) || attempt.status !== 'RECORDED')) {
            throw new rules.TransitionError('This correction requires a reviewer.', 403, 'ATTEMPT_CORRECTION_FORBIDDEN');
        }
        if (!['RECORDED', 'SUBMITTED'].includes(attempt.status) || !['IN_PROGRESS', 'COMPLETED', 'SUBMITTED'].includes(item.status) ||
            item.status === 'SUBMITTED' && !reviewer || attempt.status === 'SUBMITTED' && item.status !== 'SUBMITTED') {
            throw new rules.TransitionError('This attempt is no longer eligible for a transcription correction.', 409, 'ATTEMPT_CORRECTION_STATE_REFUSED');
        }
        const results = await tx.result.findMany({ where: { attemptId: attempt.id, isCurrent: true, supersededBy: null } });
        let target;
        if (request.resultId != null) {
            target = results.find(row => row.id === request.resultId);
            if (!target) throw new rules.TransitionError('Choose a current Result on this attempt.', 409, 'ATTEMPT_CORRECTION_TARGET_INVALID');
        } else {
            if (results.length !== 1) throw new rules.TransitionError('Select the Result to correct on this attempt.', 409, 'ATTEMPT_CORRECTION_TARGET_REQUIRED');
            target = results[0];
        }
        const corrected = await require('./resultWriteService').appendAttemptCorrection(tx, { item, sample, attempt, target, actor,
            value: request.value, calculation: request.calculation });
        const history = rules.requireHistory(item.history);
        history.push({ action: 'ATTEMPT_CORRECTED', attemptId: attempt.id, resultId: target.id, newResultId: corrected.id,
            reasonCode: request.reason, note: request.note, changedBy: rules.actorName(actor), timestamp: new Date().toISOString() });
        const updated = await require('./workItemStateService').transitionWorkItem(item.id, item.status, actor, request.note, {
            history: JSON.stringify(history), reviewedBy: null, reviewedAt: null, reviewDecision: null
        }, tx, { expected: item, action: 'ATTEMPT_CORRECTED' });
        await appendAttemptEvent(tx, item, attempt.id, actor, { action: 'CORRECTED', from: attempt.status, to: attempt.status,
            reason: request.reason, note: request.note, oldResultIds: [target.id], newResultIds: [corrected.id] });
        if(['SAND','SILT','CLAY'].includes(target.param)) {
            try {await require('./resultWriteService').deriveTextureResult(tx,{sampleId:sample.id,replicateNo:target.replicateNo,actor});}
            catch(error) {if(error.code!=='RESULT_WORKITEM_REQUIRED')throw error;}
        }
        return { workItem: updated, attemptId: attempt.id, oldResultId: target.id, result: corrected, requiresReview: attempt.status === 'SUBMITTED' };
    });
}
module.exports = { correctionRequest, correctAttempt, DISCARDED_CORRECTION_KEYS };
