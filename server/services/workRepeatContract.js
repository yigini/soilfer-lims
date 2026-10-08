const { REPEAT_REASON_LIST } = require('./workAttemptContract');
const { TransitionError } = require('./workflowStateRules');

// #162 rule 3 and #191 pins 6067488471 / 6067875897. These are command
// meanings, not laboratory policy. Limits and self-repeat enablement belong
// to policyService in the transaction performing the command.
const SELF_REPEAT_REASONS = Object.freeze(['INSTRUMENT_FAULT', 'PREP_ERROR', 'ABOVE_RANGE_DILUTION']);
const RETURN_REASON_STATUS = Object.freeze({
    REVIEW_OUTLIER: 'QUESTIONED', DUPLICATE_DISAGREEMENT: 'QUESTIONED', CONFIRMATION: 'QUESTIONED',
    QC_BATCH_FAIL: 'INVALIDATED', ABOVE_RANGE_DILUTION: 'INVALIDATED', INSTRUMENT_FAULT: 'INVALIDATED',
    PREP_ERROR: 'INVALIDATED', OTHER: 'QUESTIONED'
});

function repeatRequest(input = {}) {
    if (Object.hasOwn(input, 'override') || Object.hasOwn(input, 'ncrId')) {
        throw new TransitionError('NCR overrides are not available until the reviewed NCR workflow is installed.',
            409, 'ATTEMPT_LIMIT_NCR_UNAVAILABLE');
    }
    if (Object.keys(input).some(key => !['reason', 'note', 'sameBatchAllowed'].includes(key)) ||
        input.sameBatchAllowed !== undefined && input.sameBatchAllowed !== false) {
        throw new TransitionError('A repeat cannot authorize reuse of failed QC or change execution facts.', 400, 'REPEAT_FIELDS_INVALID');
    }
    if (!input.reason) throw new TransitionError('A repeat reason code is required.', 409, 'WORK_ATTEMPT_REASON_REQUIRED');
    if (!REPEAT_REASON_LIST.includes(input.reason)) throw new TransitionError('Choose a canonical repeat reason.', 409, 'WORK_ATTEMPT_REASON_INVALID');
    if (input.reason === 'TRANSCRIPTION_ERROR') {
        throw new TransitionError('A transcription error requires a correction of the same attempt.', 409, 'ATTEMPT_CORRECTION_REQUIRED');
    }
    if (input.reason === 'CLIENT_RETEST') {
        throw new TransitionError('A client retest requires a sample amendment.', 409, 'AMENDMENT_WORKFLOW_REQUIRED');
    }
    if (input.note != null && typeof input.note !== 'string') throw new TransitionError('The repeat note must be text.', 400, 'REPEAT_NOTE_INVALID');
    const note = typeof input.note === 'string' ? input.note.trim() || null : null;
    if (input.reason === 'OTHER' && !note) throw new TransitionError('OTHER requires an explanatory note.', 400, 'REPEAT_NOTE_REQUIRED');
    return { reason: input.reason, note, sameBatchAllowed: false, previousStatus: RETURN_REASON_STATUS[input.reason] };
}

module.exports = { SELF_REPEAT_REASONS, RETURN_REASON_STATUS, repeatRequest };
