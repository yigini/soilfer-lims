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
const REPEAT_REASON_LIST = Object.freeze([
    'QC_BATCH_FAIL', 'REVIEW_OUTLIER', 'DUPLICATE_DISAGREEMENT', 'ABOVE_RANGE_DILUTION',
    'INSTRUMENT_FAULT', 'PREP_ERROR', 'TRANSCRIPTION_ERROR', 'CLIENT_RETEST', 'CONFIRMATION', 'OTHER'
]);
// Pin6055726964: this is the sole historical-import exemption. The SQL source
// loader verifies this fragment, and runtime lookup/planning use these fields.
const CANONICAL_WORK_ITEM_SQL = 'w."sampleId" = NEW."sampleId" AND w."analysis" = NEW."param" AND w."duplicateOf" IS NULL';
const LEGACY_IMPORT_EXEMPT_SQL = `NEW."provenance" = 'IMPORTED' AND NOT EXISTS (SELECT 1 FROM "WorkItem" w WHERE ${CANONICAL_WORK_ITEM_SQL})`;
function canonicalWorkItemWhere(sampleId, param) { return { sampleId, analysis: param, duplicateOf: null }; }
function isLegacyImportExempt(result, canonicalItems) { return result.provenance === 'IMPORTED' && canonicalItems.length === 0; }

function assertRepeatReason(reason) {
    if (reason != null && !REPEAT_REASON_LIST.includes(reason)) {
        throw Object.assign(new Error('Choose a canonical repeat reason.'), { statusCode:409, code:'WORK_ATTEMPT_REASON_INVALID' });
    }
    return reason ?? null;
}

function assertWorkAttemptStatus(status) {
    if (!WORK_ATTEMPT_STATUS_LIST.includes(status)) {
        throw Object.assign(new Error('Choose a canonical attempt status.'), {
            statusCode: 409, code: 'WORK_ATTEMPT_STATUS_INVALID'
        });
    }
    return status;
}

module.exports = { WORK_ATTEMPT_STATUS_LIST, LEGACY_WORK_ATTEMPT_STATUS_LIST,
    HISTORICAL_ATTEMPT_STATUS, assertWorkAttemptStatus, REPEAT_REASON_LIST, assertRepeatReason,
    CANONICAL_WORK_ITEM_SQL, LEGACY_IMPORT_EXEMPT_SQL, canonicalWorkItemWhere, isLegacyImportExempt };
