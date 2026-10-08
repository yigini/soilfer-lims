// #190 pins 6053016928 and 6053214095. Stored historical statuses are never
// normalized or rewritten. These values describe executions, not lab policy.
const WORK_ATTEMPT_STATUS_LIST = Object.freeze([
    'OPEN', 'RECORDED', 'SUBMITTED', 'ACCEPTED', 'QUESTIONED', 'INVALIDATED', 'SUPERSEDED'
]);
const LEGACY_WORK_ATTEMPT_STATUS_LIST = Object.freeze(['RETURNED', 'REJECTED']);
const HISTORICAL_ATTEMPT_STATUS = Object.freeze({
    COMPLETED: 'RECORDED', AWAITING_VERIFICATION: 'RECORDED',
    SUBMITTED: 'SUBMITTED', QA_PENDING: 'SUBMITTED',
    ACCEPTED: 'ACCEPTED', APPROVED: 'ACCEPTED'
});

function assertWorkAttemptStatus(status) {
    if (!WORK_ATTEMPT_STATUS_LIST.includes(status)) {
        throw Object.assign(new Error('Choose a canonical attempt status.'), {
            statusCode: 409, code: 'WORK_ATTEMPT_STATUS_INVALID'
        });
    }
    return status;
}

module.exports = { WORK_ATTEMPT_STATUS_LIST, LEGACY_WORK_ATTEMPT_STATUS_LIST,
    HISTORICAL_ATTEMPT_STATUS, assertWorkAttemptStatus };
