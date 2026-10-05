/**
 * SoilFER LIMS Workflow Contract
 * Single source of truth for all status definitions
 * Used by both server and client
 */

// =============================================================================
// SAMPLE STATES
// =============================================================================
const SAMPLE_STATES = {
    DRAFT: 'DRAFT',
    EXPECTED: 'EXPECTED',           // Optional: registered in Kobo, not yet at lab
    RECEIVED: 'RECEIVED',           // Physically arrived at lab
    ACCEPTED: 'ACCEPTED',           // Intake validated, Lab ID assigned
    PROCESSING: 'PROCESSING',       // Drying+Prep done, analyses in progress
    SUBMITTED_PARTIAL: 'SUBMITTED_PARTIAL', // Some results submitted
    SUBMITTED_FULL: 'SUBMITTED_FULL',       // All results submitted
    APPROVED: 'APPROVED',           // Manager approved, ready for export
    ARCHIVED: 'ARCHIVED',           // Final: Long-term storage
    DISPOSED: 'DISPOSED',           // Final: Sample disposed
    RECEIVED_REJECTED: 'RECEIVED_REJECTED', // Physically arrived but rejected at intake
    ON_HOLD: 'ON_HOLD',
    CANCELLED: 'CANCELLED'
};

const SAMPLE_STATE_LIST = Object.values(SAMPLE_STATES);

const SAMPLE_TRANSITIONS = {
    [SAMPLE_STATES.EXPECTED]: [SAMPLE_STATES.DRAFT, SAMPLE_STATES.RECEIVED, SAMPLE_STATES.ACCEPTED, SAMPLE_STATES.RECEIVED_REJECTED, SAMPLE_STATES.CANCELLED],
    [SAMPLE_STATES.DRAFT]: [SAMPLE_STATES.EXPECTED, SAMPLE_STATES.RECEIVED, SAMPLE_STATES.ACCEPTED, SAMPLE_STATES.RECEIVED_REJECTED, SAMPLE_STATES.CANCELLED],
    COLLECTED: [SAMPLE_STATES.EXPECTED, SAMPLE_STATES.RECEIVED, SAMPLE_STATES.ACCEPTED],
    [SAMPLE_STATES.RECEIVED]: [SAMPLE_STATES.ACCEPTED, SAMPLE_STATES.EXPECTED, SAMPLE_STATES.RECEIVED_REJECTED, SAMPLE_STATES.CANCELLED],
    [SAMPLE_STATES.ACCEPTED]: [SAMPLE_STATES.PROCESSING, SAMPLE_STATES.RECEIVED, SAMPLE_STATES.APPROVED, SAMPLE_STATES.RECEIVED_REJECTED, SAMPLE_STATES.ON_HOLD],
    [SAMPLE_STATES.PROCESSING]: [SAMPLE_STATES.SUBMITTED_PARTIAL, SAMPLE_STATES.SUBMITTED_FULL, SAMPLE_STATES.APPROVED, SAMPLE_STATES.ACCEPTED, SAMPLE_STATES.ON_HOLD],
    [SAMPLE_STATES.SUBMITTED_PARTIAL]: [SAMPLE_STATES.PROCESSING, SAMPLE_STATES.SUBMITTED_FULL, SAMPLE_STATES.APPROVED, SAMPLE_STATES.ON_HOLD],
    [SAMPLE_STATES.SUBMITTED_FULL]: [SAMPLE_STATES.APPROVED, SAMPLE_STATES.PROCESSING, SAMPLE_STATES.ON_HOLD],
    [SAMPLE_STATES.APPROVED]: [SAMPLE_STATES.ARCHIVED, SAMPLE_STATES.DISPOSED],
    [SAMPLE_STATES.RECEIVED_REJECTED]: [SAMPLE_STATES.DISPOSED, SAMPLE_STATES.ACCEPTED], // Quarantined/disposed or supervisor re-intake override
    [SAMPLE_STATES.ARCHIVED]: [],  // Final
    [SAMPLE_STATES.DISPOSED]: [],  // Final
    [SAMPLE_STATES.CANCELLED]: [],
    // The transition service additionally restricts this edge to holdPriorStatus.
    [SAMPLE_STATES.ON_HOLD]: [SAMPLE_STATES.ACCEPTED, SAMPLE_STATES.PROCESSING, SAMPLE_STATES.SUBMITTED_PARTIAL, SAMPLE_STATES.SUBMITTED_FULL]
};

const FINAL_SAMPLE_STATES = [SAMPLE_STATES.ARCHIVED, SAMPLE_STATES.DISPOSED, SAMPLE_STATES.CANCELLED];

// =============================================================================
// OPERATIONAL GATES (Step Statuses)
// =============================================================================
const DRYING_STATUS = {
    PENDING: 'PENDING',
    DONE: 'DONE',
    FAILED: 'FAILED'  // Requires explanation
};

const DRYING_STATUS_LIST = Object.values(DRYING_STATUS);

const PREPARATION_STATUS = {
    PENDING: 'PENDING',
    DONE: 'DONE'
    // NO FAILED - explicitly not allowed
};

const PREPARATION_STATUS_LIST = Object.values(PREPARATION_STATUS);

// =============================================================================
// WORK ITEM STATES
// =============================================================================
const WORK_ITEM_STATES = {
    NOT_ASSIGNED: 'NOT_ASSIGNED',       // Created, no technician assigned
    ASSIGNED: 'ASSIGNED',               // Assigned to technician
    IN_PROGRESS: 'IN_PROGRESS',         // Technician working
    COMPLETED: 'COMPLETED',             // Work done, pending submission
    SUBMITTED: 'SUBMITTED',             // Submitted for review
    ACCEPTED: 'ACCEPTED',               // Manager approved result
    REPEAT_REQUIRED: 'REPEAT_REQUIRED',
    REANALYSIS_REQUIRED: 'REANALYSIS_REQUIRED', // Read compatibility; new writes use REPEAT_REQUIRED.
    WAIVED: 'WAIVED',
    ON_HOLD: 'ON_HOLD',
    AWAITING_VERIFICATION: 'AWAITING_VERIFICATION',
    CANCELLED: 'CANCELLED'              // Legacy terminal value; no new writes in audit 1.2.
};

const WORK_ITEM_STATE_LIST = Object.values(WORK_ITEM_STATES);

const WORK_ITEM_TRANSITIONS = {
    [WORK_ITEM_STATES.NOT_ASSIGNED]: [WORK_ITEM_STATES.ASSIGNED, WORK_ITEM_STATES.IN_PROGRESS, WORK_ITEM_STATES.WAIVED, WORK_ITEM_STATES.ON_HOLD, WORK_ITEM_STATES.AWAITING_VERIFICATION],
    [WORK_ITEM_STATES.ASSIGNED]: [WORK_ITEM_STATES.IN_PROGRESS, WORK_ITEM_STATES.COMPLETED, WORK_ITEM_STATES.NOT_ASSIGNED, WORK_ITEM_STATES.WAIVED, WORK_ITEM_STATES.ON_HOLD, WORK_ITEM_STATES.AWAITING_VERIFICATION],
    [WORK_ITEM_STATES.IN_PROGRESS]: [WORK_ITEM_STATES.COMPLETED, WORK_ITEM_STATES.ASSIGNED, WORK_ITEM_STATES.WAIVED, WORK_ITEM_STATES.ON_HOLD, WORK_ITEM_STATES.AWAITING_VERIFICATION],
    [WORK_ITEM_STATES.COMPLETED]: [WORK_ITEM_STATES.SUBMITTED, WORK_ITEM_STATES.IN_PROGRESS],
    [WORK_ITEM_STATES.SUBMITTED]: [WORK_ITEM_STATES.ACCEPTED, WORK_ITEM_STATES.REPEAT_REQUIRED, WORK_ITEM_STATES.WAIVED],
    [WORK_ITEM_STATES.ACCEPTED]: [],  // Final for this work item
    [WORK_ITEM_STATES.REPEAT_REQUIRED]: [WORK_ITEM_STATES.ASSIGNED, WORK_ITEM_STATES.IN_PROGRESS, WORK_ITEM_STATES.COMPLETED, WORK_ITEM_STATES.WAIVED, WORK_ITEM_STATES.AWAITING_VERIFICATION],
    [WORK_ITEM_STATES.REANALYSIS_REQUIRED]: [WORK_ITEM_STATES.ASSIGNED, WORK_ITEM_STATES.IN_PROGRESS, WORK_ITEM_STATES.COMPLETED, WORK_ITEM_STATES.WAIVED, WORK_ITEM_STATES.AWAITING_VERIFICATION],
    [WORK_ITEM_STATES.WAIVED]: [],
    [WORK_ITEM_STATES.CANCELLED]: [],
    [WORK_ITEM_STATES.ON_HOLD]: [WORK_ITEM_STATES.NOT_ASSIGNED, WORK_ITEM_STATES.ASSIGNED, WORK_ITEM_STATES.IN_PROGRESS],
    // Only SOP confirmation/manager verification may traverse these edges.
    [WORK_ITEM_STATES.AWAITING_VERIFICATION]: [WORK_ITEM_STATES.COMPLETED, WORK_ITEM_STATES.REPEAT_REQUIRED]
};

const LEGACY_SAMPLE_STATE_MAP = Object.freeze({
    COLLECTED: SAMPLE_STATES.EXPECTED,
    REJECTED: SAMPLE_STATES.RECEIVED_REJECTED,
    RELEASED: SAMPLE_STATES.APPROVED
});
const LEGACY_WORK_ITEM_STATE_MAP = Object.freeze({
    PENDING: WORK_ITEM_STATES.NOT_ASSIGNED,
    APPROVED: WORK_ITEM_STATES.ACCEPTED,
    QA_PENDING: WORK_ITEM_STATES.SUBMITTED,
    REJECTED: WORK_ITEM_STATES.REPEAT_REQUIRED,
    REANALYSIS_REQUIRED: WORK_ITEM_STATES.REPEAT_REQUIRED
});
const BATCH_STATE_LIST = Object.freeze(['OPEN', 'RUNNING', 'QC_PASS', 'QC_FAIL', 'CLOSED']);
const REVIEW_DECISION_LIST = Object.freeze(['ACCEPT', 'RETURN', 'REJECT', 'OMIT']);
function normalizeSampleState(state) { return LEGACY_SAMPLE_STATE_MAP[state] || state; }
function normalizeWorkItemState(state) { return LEGACY_WORK_ITEM_STATE_MAP[state] || state; }

const CLOSURE_TASK_SAMPLE_STATES = Object.freeze({
    ARCHIVING: SAMPLE_STATES.ARCHIVED, ARCH: SAMPLE_STATES.ARCHIVED, Archive: SAMPLE_STATES.ARCHIVED,
    DISPOSAL: SAMPLE_STATES.DISPOSED, DISP: SAMPLE_STATES.DISPOSED, Dispose: SAMPLE_STATES.DISPOSED
});
const CLOSURE_TASK_ANALYSES = Object.freeze(Object.keys(CLOSURE_TASK_SAMPLE_STATES));

// =============================================================================
// LEGACY STATUS BLACKLIST (reject with 400)
// =============================================================================
const LEGACY_SAMPLE_STATUSES = [
    'LAB_ID_ASSIGNED',
    'DRYING',
    'PREPARED',
    'WET_CHEM_IN_PROGRESS',
    'SPECTRAL_IN_PROGRESS',
    'ANALYSIS_IN_PROGRESS',
    'ANALYSIS_COMPLETED',
    'QA_QC_IN_PROGRESS',
    'QA_PENDING',
    'NON_CONFORMING',
    'COLLECTED',
    'REJECTED',   // Use transition back to EXPECTED instead
    'REVERT_TO_EXPECTED',
    'ANALYSIS',
    'PARTIALLY_COMPLETE',
    'COMPLETED'
];

const LEGACY_WORK_ITEM_STATUSES = [
    'PENDING',
    'QA_PENDING',
    'APPROVED',   // Use ACCEPTED instead
    'REJECTED'
];

// =============================================================================
// VALIDATION HELPERS
// =============================================================================
function isValidSampleState(state) {
    return SAMPLE_STATE_LIST.includes(state);
}

function isLegacySampleState(state) {
    return LEGACY_SAMPLE_STATUSES.includes(state);
}

function isValidSampleTransition(fromState, toState) {
    const allowed = SAMPLE_TRANSITIONS[normalizeSampleState(fromState)];
    return !!allowed && allowed.includes(normalizeSampleState(toState));
}

function isValidWorkItemState(state) {
    return WORK_ITEM_STATE_LIST.includes(state);
}

function isLegacyWorkItemState(state) {
    return LEGACY_WORK_ITEM_STATUSES.includes(state);
}

function isValidWorkItemTransition(fromState, toState) {
    const allowed = WORK_ITEM_TRANSITIONS[normalizeWorkItemState(fromState)];
    return !!allowed && allowed.includes(normalizeWorkItemState(toState));
}

function isValidDryingStatus(status) {
    return DRYING_STATUS_LIST.includes(status);
}

function isValidPreparationStatus(status) {
    return PREPARATION_STATUS_LIST.includes(status);
}

// =============================================================================
// EXPORTS
// =============================================================================
module.exports = {
    LEGACY_SAMPLE_STATE_MAP,
    LEGACY_WORK_ITEM_STATE_MAP,
    BATCH_STATE_LIST,
    REVIEW_DECISION_LIST,
    normalizeSampleState,
    normalizeWorkItemState,
    // Sample States
    SAMPLE_STATES,
    SAMPLE_STATE_LIST,
    SAMPLE_TRANSITIONS,
    FINAL_SAMPLE_STATES,

    // Operational Gates
    DRYING_STATUS,
    DRYING_STATUS_LIST,
    PREPARATION_STATUS,
    PREPARATION_STATUS_LIST,

    // Work Item States
    WORK_ITEM_STATES,
    WORK_ITEM_STATE_LIST,
    WORK_ITEM_TRANSITIONS,
    CLOSURE_TASK_ANALYSES,
    CLOSURE_TASK_SAMPLE_STATES,

    // Legacy Blacklists
    LEGACY_SAMPLE_STATUSES,
    LEGACY_WORK_ITEM_STATUSES,

    // Validators
    isValidSampleState,
    isLegacySampleState,
    isValidSampleTransition,
    isValidWorkItemState,
    isLegacyWorkItemState,
    isValidWorkItemTransition,
    isValidDryingStatus,
    isValidPreparationStatus
};
