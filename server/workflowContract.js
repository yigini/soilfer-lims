/**
 * SoilFER LIMS Workflow Contract
 * Single source of truth for all status definitions
 * Used by both server and client
 */

// =============================================================================
// SAMPLE STATES
// =============================================================================
const SAMPLE_STATES = {
    EXPECTED: 'EXPECTED',           // Optional: registered in Kobo, not yet at lab
    RECEIVED: 'RECEIVED',           // Physically arrived at lab
    ACCEPTED: 'ACCEPTED',           // Intake validated, Lab ID assigned
    PROCESSING: 'PROCESSING',       // Drying+Prep done, analyses in progress
    SUBMITTED_PARTIAL: 'SUBMITTED_PARTIAL', // Some results submitted
    SUBMITTED_FULL: 'SUBMITTED_FULL',       // All results submitted
    APPROVED: 'APPROVED',           // Manager approved, ready for export
    ARCHIVED: 'ARCHIVED',           // Final: Long-term storage
    DISPOSED: 'DISPOSED'            // Final: Sample disposed
};

const SAMPLE_STATE_LIST = Object.values(SAMPLE_STATES);

const SAMPLE_TRANSITIONS = {
    [SAMPLE_STATES.EXPECTED]: [SAMPLE_STATES.RECEIVED, SAMPLE_STATES.ACCEPTED],
    [SAMPLE_STATES.RECEIVED]: [SAMPLE_STATES.ACCEPTED, SAMPLE_STATES.EXPECTED],
    [SAMPLE_STATES.ACCEPTED]: [SAMPLE_STATES.PROCESSING, SAMPLE_STATES.RECEIVED, SAMPLE_STATES.APPROVED],
    [SAMPLE_STATES.PROCESSING]: [SAMPLE_STATES.SUBMITTED_PARTIAL, SAMPLE_STATES.SUBMITTED_FULL, SAMPLE_STATES.APPROVED, SAMPLE_STATES.ACCEPTED],
    [SAMPLE_STATES.SUBMITTED_PARTIAL]: [SAMPLE_STATES.PROCESSING, SAMPLE_STATES.SUBMITTED_FULL, SAMPLE_STATES.APPROVED],
    [SAMPLE_STATES.SUBMITTED_FULL]: [SAMPLE_STATES.APPROVED, SAMPLE_STATES.PROCESSING],
    [SAMPLE_STATES.APPROVED]: [SAMPLE_STATES.ARCHIVED, SAMPLE_STATES.DISPOSED, SAMPLE_STATES.PROCESSING],
    [SAMPLE_STATES.ARCHIVED]: [],  // Final
    [SAMPLE_STATES.DISPOSED]: []   // Final
};

const FINAL_SAMPLE_STATES = [SAMPLE_STATES.ARCHIVED, SAMPLE_STATES.DISPOSED];

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
    REANALYSIS_REQUIRED: 'REANALYSIS_REQUIRED', // Manager rejected, redo
    WAIVED: 'WAIVED'                    // Analysis waived (not required)
};

const WORK_ITEM_STATE_LIST = Object.values(WORK_ITEM_STATES);

const WORK_ITEM_TRANSITIONS = {
    [WORK_ITEM_STATES.NOT_ASSIGNED]: [WORK_ITEM_STATES.ASSIGNED, WORK_ITEM_STATES.IN_PROGRESS, WORK_ITEM_STATES.WAIVED],
    [WORK_ITEM_STATES.ASSIGNED]: [WORK_ITEM_STATES.IN_PROGRESS, WORK_ITEM_STATES.COMPLETED, WORK_ITEM_STATES.NOT_ASSIGNED, WORK_ITEM_STATES.WAIVED],
    [WORK_ITEM_STATES.IN_PROGRESS]: [WORK_ITEM_STATES.COMPLETED, WORK_ITEM_STATES.ASSIGNED, WORK_ITEM_STATES.WAIVED],
    [WORK_ITEM_STATES.COMPLETED]: [WORK_ITEM_STATES.SUBMITTED, WORK_ITEM_STATES.IN_PROGRESS],
    [WORK_ITEM_STATES.SUBMITTED]: [WORK_ITEM_STATES.ACCEPTED, WORK_ITEM_STATES.REANALYSIS_REQUIRED],
    [WORK_ITEM_STATES.ACCEPTED]: [],  // Final for this work item
    [WORK_ITEM_STATES.REANALYSIS_REQUIRED]: [WORK_ITEM_STATES.ASSIGNED, WORK_ITEM_STATES.IN_PROGRESS, WORK_ITEM_STATES.COMPLETED, WORK_ITEM_STATES.WAIVED],
    [WORK_ITEM_STATES.WAIVED]: []     // Final
};

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
    const allowed = SAMPLE_TRANSITIONS[fromState];
    return allowed && allowed.includes(toState);
}

function isValidWorkItemState(state) {
    return WORK_ITEM_STATE_LIST.includes(state);
}

function isLegacyWorkItemState(state) {
    return LEGACY_WORK_ITEM_STATUSES.includes(state);
}

function isValidWorkItemTransition(fromState, toState) {
    const allowed = WORK_ITEM_TRANSITIONS[fromState];
    return allowed && allowed.includes(toState);
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
