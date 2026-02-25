/**
 * SoilFER LIMS Workflow Engine
 * 
 * Centralized dependency graph and state machine for sample processing workflow.
 * This replaces scattered hardcoded logic with a single source of truth.
 * 
 * Philosophy:
 * - "Flow, Don't Stop": Warn rather than block unless data integrity is at risk.
 * - "Timeless": No SoilFER-specific hardcoding; configurable for future projects.
 * - "Clear Visibility": Every check returns actionable feedback.
 */

const {
    SAMPLE_STATES,
    WORK_ITEM_STATES,
    FINAL_SAMPLE_STATES,
    isValidSampleTransition,
    isValidWorkItemTransition
} = require('../workflowContract');

// =============================================================================
// WORK ITEM CATEGORIES & DEPENDENCY GRAPH
// =============================================================================

/**
 * Work Item Categories
 * Each category has specific rules for when it can be started/completed.
 */
const WORK_ITEM_CATEGORIES = {
    OPERATIONAL_GATES: 'Operational Gates',  // Drying, Preparation
    WET_CHEMISTRY: 'Wet Chemistry',          // pH, EC, Nutrients, etc.
    SPECTRAL: 'Spectral',                    // MIR, Vis-NIR
    POST_ANALYTICAL: 'Post-Analytical'       // Archiving, Disposal
};

/**
 * Analysis Codes and their categories.
 * This is the configuration layer - add new analyses here without code changes.
 */
const ANALYSIS_CONFIG = {
    // Operational Gates (must complete before analyses)
    'DRYING': {
        category: WORK_ITEM_CATEGORIES.OPERATIONAL_GATES,
        order: 1,
        prerequisites: [],
        displayName: 'Drying'
    },
    'PREPARATION': {
        category: WORK_ITEM_CATEGORIES.OPERATIONAL_GATES,
        order: 2,
        prerequisites: ['DRYING'],
        displayName: 'Preparation/Grinding'
    },

    // Wet Chemistry (requires Prep to be done)
    'PH': { category: WORK_ITEM_CATEGORIES.WET_CHEMISTRY, order: 10, prerequisites: ['PREPARATION'], displayName: 'pH' },
    'EC': { category: WORK_ITEM_CATEGORIES.WET_CHEMISTRY, order: 11, prerequisites: ['PREPARATION'], displayName: 'Electrical Conductivity' },
    'SOC': { category: WORK_ITEM_CATEGORIES.WET_CHEMISTRY, order: 12, prerequisites: ['PREPARATION'], displayName: 'Soil Organic Carbon' },
    'TN': { category: WORK_ITEM_CATEGORIES.WET_CHEMISTRY, order: 13, prerequisites: ['PREPARATION'], displayName: 'Total Nitrogen' },
    'MEHLICH': { category: WORK_ITEM_CATEGORIES.WET_CHEMISTRY, order: 14, prerequisites: ['PREPARATION'], displayName: 'Mehlich-3' },
    'TEXTURE': { category: WORK_ITEM_CATEGORIES.WET_CHEMISTRY, order: 15, prerequisites: ['PREPARATION'], displayName: 'Texture Analysis' },

    // Spectral (requires Prep to be done)
    'MIR': { category: WORK_ITEM_CATEGORIES.SPECTRAL, order: 20, prerequisites: ['PREPARATION'], displayName: 'Mid-Infrared Spectroscopy' },
    'VISNIR': { category: WORK_ITEM_CATEGORIES.SPECTRAL, order: 21, prerequisites: ['PREPARATION'], displayName: 'Vis-NIR Spectroscopy' },

    // Post-Analytical (requires ALL other analyses to be ACCEPTED/WAIVED)
    'ARCHIVING': {
        category: WORK_ITEM_CATEGORIES.POST_ANALYTICAL,
        order: 100,
        prerequisites: ['ALL_ANALYSES_APPROVED'],
        displayName: 'Archiving'
    },
    'DISPOSAL': {
        category: WORK_ITEM_CATEGORIES.POST_ANALYTICAL,
        order: 101,
        prerequisites: ['ALL_ANALYSES_APPROVED'],
        displayName: 'Disposal'
    }
};

/**
 * Get the configuration for an analysis code.
 * Returns a default config if unknown (for extensibility).
 */
function getAnalysisConfig(analysisCode) {
    return ANALYSIS_CONFIG[analysisCode] || {
        category: WORK_ITEM_CATEGORIES.WET_CHEMISTRY,
        order: 50,
        prerequisites: ['PREPARATION'],
        displayName: analysisCode
    };
}

// =============================================================================
// DEPENDENCY CHECKS
// =============================================================================

/**
 * Check if a work item's prerequisites are met.
 * 
 * @param {Object} workItem - The work item to check.
 * @param {Array} allWorkItems - All work items for the sample.
 * @returns {Object} - { canStart: boolean, blockedBy: string | null, reason: string }
 */
function checkPrerequisites(workItem, allWorkItems) {
    const config = getAnalysisConfig(workItem.analysis);

    // No prerequisites? Always can start.
    if (!config.prerequisites || config.prerequisites.length === 0) {
        return { canStart: true, blockedBy: null, reason: null };
    }

    for (const prereq of config.prerequisites) {
        // Special case: ALL_ANALYSES_APPROVED
        if (prereq === 'ALL_ANALYSES_APPROVED') {
            const nonPostItems = allWorkItems.filter(wi =>
                getAnalysisConfig(wi.analysis).category !== WORK_ITEM_CATEGORIES.POST_ANALYTICAL
            );

            const allApproved = nonPostItems.length > 0 && nonPostItems.every(wi =>
                ['ACCEPTED', 'WAIVED'].includes(wi.status) ||
                // Gates can be COMPLETED/SUBMITTED (don't require manager approval)
                (getAnalysisConfig(wi.analysis).category === WORK_ITEM_CATEGORIES.OPERATIONAL_GATES &&
                    ['COMPLETED', 'SUBMITTED', 'ACCEPTED'].includes(wi.status))
            );

            if (!allApproved) {
                const pending = nonPostItems.filter(wi => !['ACCEPTED', 'WAIVED', 'COMPLETED', 'SUBMITTED'].includes(wi.status));
                return {
                    canStart: false,
                    blockedBy: 'ALL_ANALYSES_APPROVED',
                    reason: `${pending.length} analyses still pending approval`
                };
            }
            continue;
        }

        // Standard prerequisite: check if that analysis is done
        const prereqItem = allWorkItems.find(wi => wi.analysis === prereq);
        if (!prereqItem) {
            // Prerequisite doesn't exist - might be waived or not applicable
            continue;
        }

        // Check if prerequisite is in a "complete enough" state
        const isComplete = ['COMPLETED', 'SUBMITTED', 'ACCEPTED', 'WAIVED'].includes(prereqItem.status);
        if (!isComplete) {
            return {
                canStart: false,
                blockedBy: prereq,
                reason: `Waiting for ${getAnalysisConfig(prereq).displayName} to complete (current: ${prereqItem.status})`
            };
        }
    }

    return { canStart: true, blockedBy: null, reason: null };
}

/**
 * Check if a work item can transition to a new status.
 * Combines workflow contract rules with business logic.
 * 
 * @param {Object} workItem - The work item.
 * @param {string} newStatus - The proposed new status.
 * @param {Array} allWorkItems - All work items for the sample.
 * @returns {Object} - { allowed: boolean, reason: string | null }
 */
function canTransitionWorkItem(workItem, newStatus, allWorkItems) {
    // 1. Check basic transition validity
    if (!isValidWorkItemTransition(workItem.status, newStatus)) {
        return {
            allowed: false,
            reason: `Invalid transition: ${workItem.status} → ${newStatus}`
        };
    }

    // 2. If starting work (ASSIGNED → IN_PROGRESS), check prerequisites
    if (newStatus === WORK_ITEM_STATES.IN_PROGRESS) {
        const prereqCheck = checkPrerequisites(workItem, allWorkItems);
        if (!prereqCheck.canStart) {
            return {
                allowed: false,
                reason: prereqCheck.reason
            };
        }
    }

    return { allowed: true, reason: null };
}

// =============================================================================
// SAMPLE STATUS CALCULATIONS
// =============================================================================

/**
 * Calculate what the sample status SHOULD be based on work item states.
 * This is the "ground truth" calculation - UI and backend should use this.
 * 
 * @param {Object} sample - The sample object.
 * @param {Array} workItems - All work items for the sample.
 * @returns {Object} - { status: string, eligibility: Object }
 */
function calculateSampleStatus(sample, workItems) {
    // Flag to lock editing if in a final state
    const isLocked = FINAL_SAMPLE_STATES.includes(sample.status);

    // Not yet processing? Keep current.
    if (['EXPECTED', 'RECEIVED', 'ACCEPTED'].includes(sample.status)) {
        return { status: sample.status, eligibility: { isLocked: false } };
    }

    // Categorize work items
    const nonPostItems = workItems.filter(wi =>
        getAnalysisConfig(wi.analysis).category !== WORK_ITEM_CATEGORIES.POST_ANALYTICAL
    );
    const analyticalItems = nonPostItems.filter(wi =>
        getAnalysisConfig(wi.analysis).category !== WORK_ITEM_CATEGORIES.OPERATIONAL_GATES
    );

    // Check submission eligibility
    const submittedCount = analyticalItems.filter(wi =>
        ['SUBMITTED', 'ACCEPTED', 'WAIVED'].includes(wi.status)
    ).length;
    const acceptedCount = analyticalItems.filter(wi =>
        ['ACCEPTED', 'WAIVED'].includes(wi.status)
    ).length;

    const gatesComplete = nonPostItems
        .filter(wi => getAnalysisConfig(wi.analysis).category === WORK_ITEM_CATEGORIES.OPERATIONAL_GATES)
        .every(wi => ['COMPLETED', 'SUBMITTED', 'ACCEPTED'].includes(wi.status));

    const isPartiallySubmitted = submittedCount > 0 && submittedCount < analyticalItems.length;
    const isFullySubmitted = submittedCount === analyticalItems.length && analyticalItems.length > 0;
    const isFullyApproved = acceptedCount === analyticalItems.length && analyticalItems.length > 0 && gatesComplete;

    // Determine status
    let status = sample.status;

    // Only auto-update status if NOT in a final state
    if (!isLocked) {
        if (isFullyApproved) {
            status = SAMPLE_STATES.APPROVED;
        } else if (isFullySubmitted) {
            status = SAMPLE_STATES.SUBMITTED_FULL;
        } else if (isPartiallySubmitted) {
            status = SAMPLE_STATES.SUBMITTED_PARTIAL;
        } else if (gatesComplete) {
            status = SAMPLE_STATES.PROCESSING;
        }

        // Post-Analytical Overrides
        if (status === SAMPLE_STATES.APPROVED) {
            const archiving = workItems.find(wi => wi.analysis === 'ARCHIVING');
            const disposal = workItems.find(wi => wi.analysis === 'DISPOSAL');

            if (archiving && ['COMPLETED', 'ACCEPTED'].includes(archiving.status)) status = SAMPLE_STATES.ARCHIVED;
            if (disposal && ['COMPLETED', 'ACCEPTED'].includes(disposal.status)) status = SAMPLE_STATES.DISPOSED;
        }
    }

    return {
        status,
        eligibility: {
            isLocked,
            gatesComplete,
            submittedCount,
            acceptedCount,
            totalAnalyses: analyticalItems.length,
            isPartiallySubmitted,
            isFullySubmitted,
            isFullyApproved,
            canArchive: isFullyApproved || status === SAMPLE_STATES.ARCHIVED,
            canDispose: isFullyApproved || status === SAMPLE_STATES.DISPOSED
        }
    };
}

/**
 * Get a summary of the sample's workflow state for UI display.
 * 
 * @param {Object} sample - The sample object.
 * @param {Array} workItems - All work items for the sample.
 * @returns {Object} - { phase, progress, nextActions }
 */
function getWorkflowSummary(sample, workItems) {
    const { eligibility } = calculateSampleStatus(sample, workItems);

    const dryingItem = workItems.find(wi => wi.analysis === 'DRYING');
    const prepItem = workItems.find(wi => wi.analysis === 'PREPARATION');

    let phase = 'Unknown';
    let progress = 0;
    const nextActions = [];

    if (['EXPECTED', 'RECEIVED'].includes(sample.status)) {
        phase = 'Intake';
        progress = 10;
        nextActions.push('Receive sample at lab');
    } else if (sample.status === 'ACCEPTED') {
        phase = 'Ready for Processing';
        progress = 20;
        if (!dryingItem || dryingItem.status === 'NOT_ASSIGNED') {
            nextActions.push('Assign Drying task');
        } else {
            nextActions.push('Complete Drying');
        }
    } else if (!eligibility.gatesComplete) {
        phase = 'Preparation';
        progress = 40;
        if (dryingItem && !['COMPLETED', 'ACCEPTED', 'SUBMITTED'].includes(dryingItem.status)) {
            nextActions.push('Complete Drying');
        }
        if (prepItem && !['COMPLETED', 'ACCEPTED', 'SUBMITTED'].includes(prepItem.status)) {
            nextActions.push('Complete Preparation');
        }
    } else if (!eligibility.isFullySubmitted) {
        phase = 'Analysis';
        progress = 60;
        nextActions.push(`Submit remaining analyses (${eligibility.submittedCount}/${eligibility.totalAnalyses})`);
    } else if (!eligibility.isFullyApproved) {
        phase = 'Review';
        progress = 80;
        nextActions.push(`Approve analyses (${eligibility.acceptedCount}/${eligibility.totalAnalyses})`);
    } else {
        const isArchived = sample.status === 'ARCHIVED';
        const isDisposed = sample.status === 'DISPOSED';

        phase = (isArchived || isDisposed) ? 'Arrived' : 'Complete';
        progress = 100;
        if (!isArchived && !isDisposed) {
            nextActions.push('Ready for archiving or disposal');
        } else {
            nextActions.push(isArchived ? 'Sample stored in archive' : 'Sample disposed of');
        }
    }

    return { phase, progress, nextActions, eligibility };
}

// =============================================================================
// MAP-STATE: Room Resolution & Unified Map Payload
// =============================================================================

/**
 * Maps analysis codes to logical "rooms" for the workflow map.
 * This is the server-side equivalent of the client's ANALYSIS_ROOM mapping,
 * eliminating drift between frontend and backend.
 */
const ROOM_MAP = {
    DRYING: 'Preparation Room',
    PREPARATION: 'Preparation Room',

    // Physical / Wet Chemistry → varies by sub-type
    PH: 'Chemical Analysis', PH_H2O: 'Chemical Analysis', PH_KCL: 'Chemical Analysis',
    EC: 'Chemical Analysis', SOC: 'Chemical Analysis', OC: 'Chemical Analysis',
    TN: 'Chemical Analysis', TC: 'Chemical Analysis',
    CEC: 'Chemical Analysis', BS: 'Chemical Analysis', MEHLICH: 'Chemical Analysis',
    P: 'Chemical Analysis', K: 'Chemical Analysis',
    K_EXCH: 'Chemical Analysis', CA_EXCH: 'Chemical Analysis', MG_EXCH: 'Chemical Analysis',
    NA_EXCH: 'Chemical Analysis', AL_EXCH: 'Chemical Analysis', H_EXCH: 'Chemical Analysis',
    FE: 'Chemical Analysis', MN: 'Chemical Analysis', ZN: 'Chemical Analysis',
    CU: 'Chemical Analysis', B: 'Chemical Analysis',
    CACO3: 'Chemical Analysis', S_RESP: 'Chemical Analysis', MISC: 'Chemical Analysis',

    TEXTURE: 'Physical Testing', SAND: 'Physical Testing', SILT: 'Physical Testing',
    CLAY: 'Physical Testing', GRAVEL: 'Physical Testing',
    BULK_DENSITY: 'Physical Testing', BD: 'Physical Testing',

    MIR: 'Spectral Lab', VISNIR: 'Spectral Lab', XRF: 'Spectral Lab',
    SPEC_MIR: 'Spectral Lab', SPEC_VIS_NIR: 'Spectral Lab',
    SPEC_VISNIR: 'Spectral Lab', SPEC_XRF: 'Spectral Lab',

    ARCHIVING: 'Archive & Disposal', ARCH: 'Archive & Disposal',
    DISPOSAL: 'Archive & Disposal', DISP: 'Archive & Disposal',
};

function resolveRoom(analysisCode) {
    return ROOM_MAP[analysisCode] || ROOM_MAP[analysisCode?.toUpperCase()] || 'Chemical Analysis';
}

/**
 * Build the unified map-state contract payload.
 * This is the SINGLE SOURCE OF TRUTH for the workflow map UI.
 * 
 * @param {Object} sample - The sample object.
 * @param {Array} workItems - All work items for the sample.
 * @param {Array} [auditLog] - Optional audit log for SLA computation.
 * @returns {Object} - Complete map-state contract.
 */
function buildMapState(sample, workItems, auditLog = []) {
    const { status: lifecycle, eligibility } = calculateSampleStatus(sample, workItems);
    const summary = getWorkflowSummary(sample, workItems);
    const isTerminal = FINAL_SAMPLE_STATES.includes(lifecycle);

    // ── Active rooms (supports parallel activity) ──
    const activeItems = workItems.filter(wi =>
        ['IN_PROGRESS', 'ASSIGNED', 'NOT_ASSIGNED'].includes(wi.status)
    );
    const activeRooms = [...new Set(activeItems.map(wi => resolveRoom(wi.analysis)))];

    // Determine current room(s) — what the plan calls "Where is this sample right now?"
    let currentRooms;
    if (isTerminal) {
        currentRooms = ['Archive & Disposal'];
    } else if (activeRooms.length > 0) {
        currentRooms = activeRooms;
    } else if (['EXPECTED', 'RECEIVED'].includes(sample.status)) {
        currentRooms = ['Reception'];
    } else if (sample.status === 'ACCEPTED') {
        currentRooms = ['Preparation Room'];
    } else if (eligibility.isFullyApproved || lifecycle === 'APPROVED') {
        currentRooms = ['Archive & Disposal'];
    } else if (eligibility.isFullySubmitted || lifecycle === 'SUBMITTED_FULL') {
        currentRooms = ['QA Review'];
    } else {
        currentRooms = ['QA Review'];
    }

    // ── Per-stage summaries (grouped by room) ──
    const stageMap = {};
    for (const wi of workItems) {
        const room = resolveRoom(wi.analysis);
        if (!stageMap[room]) {
            stageMap[room] = { room, items: [], done: 0, total: 0, blockers: [] };
        }
        stageMap[room].items.push({
            id: wi.id,
            analysis: wi.analysis,
            displayName: getAnalysisConfig(wi.analysis).displayName,
            status: wi.status,
            assignedTo: wi.assignedTo || null,
            assignedLab: wi.assignedLab || null,
            updatedAt: wi.updatedAt || null,
        });
        stageMap[room].total++;
        if (['COMPLETED', 'SUBMITTED', 'ACCEPTED', 'WAIVED'].includes(wi.status)) {
            stageMap[room].done++;
        }
    }

    // Compute stage status
    const activeStages = Object.values(stageMap).map(stage => {
        const allDone = stage.done === stage.total;
        const hasActive = stage.items.some(i => ['IN_PROGRESS', 'ASSIGNED'].includes(i.status));
        const hasBlocked = stage.blockers.length > 0;
        return {
            ...stage,
            status: allDone ? 'completed' : hasActive ? 'active' : hasBlocked ? 'blocked' : 'future',
            progress: { done: stage.done, total: stage.total }
        };
    });

    // ── Blocker graph ──
    const blockerGraph = [];
    for (const wi of workItems) {
        if (['ACCEPTED', 'WAIVED', 'COMPLETED', 'SUBMITTED'].includes(wi.status)) continue;
        const prereq = checkPrerequisites(wi, workItems);
        if (!prereq.canStart) {
            blockerGraph.push({
                workItemId: wi.id,
                analysis: wi.analysis,
                displayName: getAnalysisConfig(wi.analysis).displayName,
                room: resolveRoom(wi.analysis),
                blockedBy: prereq.blockedBy,
                reason: prereq.reason,
            });
            // Also add to stage blockers
            const room = resolveRoom(wi.analysis);
            const stage = stageMap[room];
            if (stage) stage.blockers.push({ analysis: wi.analysis, reason: prereq.reason });
        }
    }

    // ── SLA / Risk ──
    // Terminal samples have no risk — they're done
    let sla = { totalHours: 0, severity: 'OK' };
    let risk = 'OK';
    if (!isTerminal) {
        const createdEvent = auditLog.find(e => e.action === 'SAMPLE_CREATED' || e.action === 'STATUS_CHANGE');
        const createdAt = createdEvent?.timestamp || sample.createdAt;
        if (createdAt) {
            const hours = Math.floor((Date.now() - new Date(createdAt).getTime()) / 3600000);
            sla = {
                totalHours: hours,
                severity: hours > 72 ? 'CRITICAL' : hours > 24 ? 'WARNING' : 'OK',
                createdAt,
            };
        }
        risk = sla.severity;
    }

    // ── Owner resolution ──
    const inProgressItems = workItems.filter(wi => wi.status === 'IN_PROGRESS');
    const owner = inProgressItems.length > 0
        ? inProgressItems[0].assignedTo || 'Unassigned'
        : (activeItems.length > 0 ? activeItems[0].assignedTo || 'Unassigned' : 'System');

    // ── Next actions ──
    const nextActions = summary.nextActions.map(action => ({
        action,
        assignee: null,
        role: null,
    }));

    // ── Closure type ──
    let closureType = null;
    if (lifecycle === 'ARCHIVED') closureType = 'ARCHIVED';
    if (lifecycle === 'DISPOSED') closureType = 'DISPOSED';

    return {
        lifecycle,
        currentRooms,
        activeStages,
        blockerGraph,
        owner,
        risk,
        sla,
        phase: summary.phase,
        progress: summary.progress,
        nextActions,
        isTerminal,
        closureType,
        eligibility,
    };
}

// =============================================================================
// UNDO LOGIC
// =============================================================================

/**
 * Calculate the impact of undoing a work item status change.
 * 
 * @param {Object} workItem - The work item being undone.
 * @param {Array} allWorkItems - All work items for the sample.
 * @returns {Object} - { affectedItems: Array, sampleStatusChange: string | null }
 */
function calculateUndoImpact(workItem, allWorkItems) {
    const config = getAnalysisConfig(workItem.analysis);
    const affectedItems = [];

    // If undoing a gate (Drying/Prep), downstream items may need to be blocked
    if (config.category === WORK_ITEM_CATEGORIES.OPERATIONAL_GATES) {
        for (const wi of allWorkItems) {
            const wiConfig = getAnalysisConfig(wi.analysis);
            if (wiConfig.prerequisites.includes(workItem.analysis)) {
                if (['IN_PROGRESS', 'COMPLETED', 'SUBMITTED'].includes(wi.status)) {
                    affectedItems.push({
                        id: wi.id,
                        analysis: wi.analysis,
                        currentStatus: wi.status,
                        warning: `May need to pause - ${config.displayName} is being undone`
                    });
                }
            }
        }
    }

    return { affectedItems };
}

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
    // Configuration
    WORK_ITEM_CATEGORIES,
    ANALYSIS_CONFIG,
    getAnalysisConfig,

    // Dependency Checks
    checkPrerequisites,
    canTransitionWorkItem,

    // Status Calculations
    calculateSampleStatus,
    getWorkflowSummary,

    // Map State
    buildMapState,
    ROOM_MAP,
    resolveRoom,

    // Undo Logic
    calculateUndoImpact
};
