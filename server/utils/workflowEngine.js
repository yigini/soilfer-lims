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

const DYNAMIC_CONFIGS = {};

/**
 * Register or update an analysis configuration dynamically from the database catalogue.
 */
function registerAnalysisConfig(code, config) {
    if (!code) return;
    const previous = ANALYSIS_CONFIG[code] || { prerequisites: ['PREPARATION'], category: WORK_ITEM_CATEGORIES.WET_CHEMISTRY, order: 50 };
    let prereqs = config.prerequisites ?? previous.prerequisites;
    if (typeof prereqs === 'string') {
        try { prereqs = JSON.parse(prereqs); } catch (e) { prereqs = previous.prerequisites; }
    }
    DYNAMIC_CONFIGS[code] = {
        category: typeof config.category === 'string' ? config.category : previous.category,
        order: config.order ?? config.executionOrder ?? 50,
        prerequisites: Array.isArray(prereqs) ? prereqs : previous.prerequisites,
        displayName: config.displayName || config.name || code
    };
}

/**
 * Detects cycles in a dependency graph using DFS.
 * @param {Object} graph - { [node]: string[] }
 * @returns {{ hasCycle: boolean, cycle: string[] | null }}
 */
function detectCycle(graph) {
    const visited = new Set();
    const recursionStack = new Set();
    let cyclePath = null;

    function dfs(node, path) {
        visited.add(node);
        recursionStack.add(node);
        path.push(node);

        const neighbors = graph[node] || [];
        for (const neighbor of neighbors) {
            if (!visited.has(neighbor)) {
                if (dfs(neighbor, path)) return true;
            } else if (recursionStack.has(neighbor)) {
                const cycleStart = path.indexOf(neighbor);
                cyclePath = [...path.slice(cycleStart), neighbor];
                return true;
            }
        }

        recursionStack.delete(node);
        path.pop();
        return false;
    }

    for (const node of Object.keys(graph)) {
        if (!visited.has(node)) {
            if (dfs(node, [])) {
                return { hasCycle: true, cycle: cyclePath };
            }
        }
    }

    return { hasCycle: false, cycle: null };
}

/**
 * Validates whether adding/updating an analysis with given prerequisites would introduce a cycle.
 * @param {string} code - The analysis code
 * @param {string[]|string} newPrerequisites - Array or JSON string of prerequisite analysis codes
 * @param {Array<{code: string, prerequisites: any}>} existingAnalyses - All existing analyses
 * @returns {{ valid: boolean, error?: string, cycle?: string[] }}
 */
function validatePrerequisites(code, newPrerequisites, existingAnalyses = []) {
    let parsed = [];
    if (Array.isArray(newPrerequisites)) {
        parsed = newPrerequisites;
    } else if (typeof newPrerequisites === 'string') {
        try { parsed = JSON.parse(newPrerequisites); } catch (e) { parsed = []; }
    }

    // Direct self-dependency check
    if (parsed.includes(code)) {
        return {
            valid: false,
            error: `Self-referential prerequisite: ${code} cannot depend on itself.`,
            cycle: [code, code]
        };
    }

    // Build full graph from existing analyses + proposed change
    const graph = {};
    for (const a of existingAnalyses) {
        if (a.code === code) continue; // Will be overwritten by newPrerequisites
        let prereqs = [];
        if (Array.isArray(a.prerequisites)) {
            prereqs = a.prerequisites;
        } else if (typeof a.prerequisites === 'string') {
            try { prereqs = JSON.parse(a.prerequisites); } catch (e) { prereqs = []; }
        }
        graph[a.code] = prereqs;
    }

    graph[code] = parsed;

    const { hasCycle, cycle } = detectCycle(graph);
    if (hasCycle) {
        return {
            valid: false,
            error: `Cyclic prerequisite dependency detected: ${cycle.join(' -> ')}`,
            cycle
        };
    }

    return { valid: true };
}

/**
 * Get the configuration for an analysis code.
 * Checks dynamic catalogue cache first, then built-in defaults, then general fallback.
 */
function getAnalysisConfig(analysisCode) {
    if (DYNAMIC_CONFIGS[analysisCode]) {
        return DYNAMIC_CONFIGS[analysisCode];
    }
    return ANALYSIS_CONFIG[analysisCode] || {
        category: WORK_ITEM_CATEGORIES.WET_CHEMISTRY,
        order: 50,
        prerequisites: ['PREPARATION'],
          displayName: require('../data/analysisDisplayNames.json')[analysisCode] || 'Unconfigured parameter'
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

    // Categorize work items
    const nonPostItems = workItems.filter(wi =>
        getAnalysisConfig(wi.analysis).category !== WORK_ITEM_CATEGORIES.POST_ANALYTICAL
    );
    const analyticalItems = nonPostItems.filter(wi =>
        getAnalysisConfig(wi.analysis).category !== WORK_ITEM_CATEGORIES.OPERATIONAL_GATES
    );
    const gateItems = nonPostItems.filter(wi =>
        getAnalysisConfig(wi.analysis).category === WORK_ITEM_CATEGORIES.OPERATIONAL_GATES
    );

    // Check operational gates (Drying, Preparation)
    const gatesComplete = gateItems.length > 0 && gateItems.every(wi =>
        ['COMPLETED', 'SUBMITTED', 'ACCEPTED', 'WAIVED'].includes(wi.status)
    );

    // Check submission & approval eligibility
    const submittedCount = analyticalItems.filter(wi =>
        ['SUBMITTED', 'ACCEPTED', 'WAIVED'].includes(wi.status)
    ).length;
    const acceptedCount = analyticalItems.filter(wi =>
        ['ACCEPTED', 'WAIVED'].includes(wi.status)
    ).length;
    const completedExecutionCount = analyticalItems.filter(wi =>
        ['COMPLETED', 'SUBMITTED', 'ACCEPTED', 'WAIVED'].includes(wi.status)
    ).length;

    const isPartiallySubmitted = submittedCount > 0 && submittedCount < analyticalItems.length;
    const isFullySubmitted = submittedCount === analyticalItems.length && analyticalItems.length > 0;
    const isFullyApproved = acceptedCount === analyticalItems.length && analyticalItems.length > 0 && gatesComplete;

    // Determine status
    let status = sample.status;

    // Auto-advance status if not in locked or intake state
    if (!isLocked && !['EXPECTED', 'RECEIVED', 'RECEIVED_REJECTED'].includes(sample.status)) {
        if (isFullyApproved) {
            status = SAMPLE_STATES.APPROVED;
        } else if (isFullySubmitted) {
            status = SAMPLE_STATES.SUBMITTED_FULL;
        } else if (isPartiallySubmitted) {
            status = SAMPLE_STATES.SUBMITTED_PARTIAL;
        } else if (gatesComplete || sample.status === 'PROCESSING') {
            status = SAMPLE_STATES.PROCESSING;
        } else if (sample.status === 'ACCEPTED') {
            status = SAMPLE_STATES.ACCEPTED;
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
            completedExecutionCount,
            totalAnalyses: analyticalItems.length,
            totalGates: gateItems.length,
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
 * Derives actionable guidance strictly from executable work-item conditions.
 * 
 * @param {Object} sample - The sample object.
 * @param {Array} workItems - All work items for the sample.
 * @returns {Object} - { phase, progress, nextActions, nextEligibleAction, eligibility }
 */
function getWorkflowSummary(sample, workItems) {
    const { eligibility } = calculateSampleStatus(sample, workItems);

    const dryingItem = workItems.find(wi => wi.analysis === 'DRYING');
    const prepItem = workItems.find(wi => wi.analysis === 'PREPARATION');

    let phase = 'Unknown';
    let progress = 0;
    const nextActions = [];
    let nextEligibleAction = null;

    if (['EXPECTED', 'RECEIVED'].includes(sample.status)) {
        phase = 'Intake';
        progress = 10;
        nextActions.push('Receive sample at lab');
        nextEligibleAction = {
            title: 'Sample received at intake',
            action: 'Receive sample at desk',
            assignee: 'Reception Desk',
            role: 'SAMPLE_RECEPTION',
            reason: 'Sample must be inspected and accepted or rejected at reception',
            destination: '/reception'
        };
    } else if (sample.status === 'RECEIVED_REJECTED') {
        phase = 'Rejected';
        progress = 100;
        nextActions.push('Sample rejected at intake');
        nextEligibleAction = {
            title: 'Sample rejected at reception',
            action: 'View rejection voucher',
            assignee: sample.receivingOfficerName || 'Reception Officer',
            role: 'SAMPLE_RECEPTION',
            reason: 'Sample failed intake criteria and is quarantined for disposal or supervisor override',
            destination: '/reception'
        };
    } else {
        // Evaluate Operational Gates
        const dryingDone = !dryingItem || ['COMPLETED', 'ACCEPTED', 'SUBMITTED', 'WAIVED'].includes(dryingItem.status);
        const prepDone = !prepItem || ['COMPLETED', 'ACCEPTED', 'SUBMITTED', 'WAIVED'].includes(prepItem.status);

        if (!dryingDone) {
            phase = 'Preparation (Drying)';
            progress = 25;
            const isAssigned = dryingItem && dryingItem.status !== 'NOT_ASSIGNED';
            const actionText = isAssigned ? 'Complete Drying' : 'Assign Drying task';
            nextActions.push(actionText);
            nextEligibleAction = {
                title: isAssigned ? 'Drying in progress' : 'Drying awaiting assignment',
                action: actionText,
                assignee: dryingItem?.assignedTo || 'Unassigned',
                role: 'LAB_TECHNICIAN',
                reason: 'Drying must be completed before milling and sieving can proceed',
                destination: `/workbench?sampleId=${sample.id}&room=Preparation%20Room`
            };
        } else if (!prepDone) {
            phase = 'Preparation (Milling & Sieving)';
            progress = 40;
            const isAssigned = prepItem && prepItem.status !== 'NOT_ASSIGNED';
            const actionText = isAssigned ? 'Complete Preparation' : 'Assign Preparation task';
            nextActions.push(actionText);
            nextEligibleAction = {
                title: isAssigned ? 'Preparation in progress' : 'Preparation awaiting assignment',
                action: actionText,
                assignee: prepItem?.assignedTo || 'Unassigned',
                role: 'LAB_TECHNICIAN',
                reason: 'Milling & sieving must be completed before analytical testing can begin',
                destination: `/workbench?sampleId=${sample.id}&room=Preparation%20Room`
            };
        } else if (!eligibility.isFullySubmitted) {
            phase = 'Analysis';
            progress = 60;

            const nonPost = workItems.filter(wi =>
                getAnalysisConfig(wi.analysis).category !== WORK_ITEM_CATEGORIES.POST_ANALYTICAL &&
                getAnalysisConfig(wi.analysis).category !== WORK_ITEM_CATEGORIES.OPERATIONAL_GATES
            );
            const inProgressAnalysis = nonPost.find(wi => wi.status === 'IN_PROGRESS');
            const readyAnalysis = nonPost.find(wi => ['NOT_ASSIGNED', 'ASSIGNED'].includes(wi.status));

            if (inProgressAnalysis) {
                const config = getAnalysisConfig(inProgressAnalysis.analysis);
                const title = `${config.displayName || inProgressAnalysis.analysis} analysis in progress`;
                nextActions.push(title);
                nextEligibleAction = {
                    title,
                    action: `Complete ${config.displayName || inProgressAnalysis.analysis}`,
                    assignee: inProgressAnalysis.assignedTo || 'Unassigned',
                    role: 'LAB_TECHNICIAN',
                    reason: 'Analytical test in progress at station',
                    destination: `/workbench?sampleId=${sample.id}&room=${encodeURIComponent(resolveRoom(inProgressAnalysis.analysis))}`
                };
            } else if (readyAnalysis) {
                const config = getAnalysisConfig(readyAnalysis.analysis);
                const title = `Start ${config.displayName || readyAnalysis.analysis} analysis`;
                nextActions.push(title);
                nextEligibleAction = {
                    title,
                    action: title,
                    assignee: readyAnalysis.assignedTo || 'Unassigned',
                    role: 'LAB_TECHNICIAN',
                    reason: 'Preparation complete; analytical test is ready to execute',
                    destination: `/workbench?sampleId=${sample.id}&room=${encodeURIComponent(resolveRoom(readyAnalysis.analysis))}`
                };
            } else {
                const title = `Submit remaining analyses (${eligibility.submittedCount}/${eligibility.totalAnalyses})`;
                nextActions.push(title);
                nextEligibleAction = {
                    title,
                    action: 'Submit results for QA review',
                    assignee: 'Technician',
                    role: 'LAB_TECHNICIAN',
                    reason: 'Analytical determinations finished; submit batch for review',
                    destination: `/workbench?sampleId=${sample.id}`
                };
            }
        } else if (!eligibility.isFullyApproved) {
            phase = 'Quality Review';
            progress = 80;
            const title = `Approve analyses (${eligibility.acceptedCount}/${eligibility.totalAnalyses} cleared)`;
            nextActions.push(title);
            nextEligibleAction = {
                title: 'Review submitted results',
                action: 'Review results in Manager Queue',
                assignee: 'Authorized reviewer',
                role: 'LAB_MANAGER',
                reason: 'Submissions awaiting quality verification and final decision',
                destination: `/manager-queue?sampleId=${sample.id}`
            };
        } else {
            const isArchived = sample.status === 'ARCHIVED';
            const isDisposed = sample.status === 'DISPOSED';

            phase = (isArchived || isDisposed) ? 'Terminal' : 'Approved';
            progress = 100;
            if (!isArchived && !isDisposed) {
                nextActions.push('Ready for archiving or disposal');
                nextEligibleAction = {
                    title: 'Sample approved',
                    action: 'Archive or dispose sample',
                    assignee: 'Lab Manager',
                    role: 'LAB_MANAGER',
                    reason: 'All analyses approved; sample is eligible for archive storage or disposal',
                    destination: `/samples/${sample.id}`
                };
            } else {
                const title = isArchived ? 'Sample stored in archive' : 'Sample disposed of';
                nextActions.push(title);
                nextEligibleAction = {
                    title,
                    action: 'Sample lifecycle concluded',
                    assignee: 'Archive / Disposal',
                    role: 'SYSTEM',
                    reason: 'Terminal lifecycle reached',
                    destination: `/samples/${sample.id}`
                };
            }
        }
    }

    return { phase, progress, nextActions, nextEligibleAction, eligibility };
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
    // ── Blocker graph (computed FIRST so stage blockers are populated) ──
    const blockerGraph = [];
    const stageBlockerMap = {};
    for (const wi of workItems) {
        if (['ACCEPTED', 'WAIVED', 'COMPLETED', 'SUBMITTED'].includes(wi.status)) continue;
        const prereq = checkPrerequisites(wi, workItems);
        if (!prereq.canStart) {
            const room = resolveRoom(wi.analysis);
            blockerGraph.push({
                workItemId: wi.id,
                analysis: wi.analysis,
                displayName: getAnalysisConfig(wi.analysis).displayName,
                room,
                blockedBy: prereq.blockedBy,
                reason: prereq.reason,
            });
            if (!stageBlockerMap[room]) stageBlockerMap[room] = [];
            stageBlockerMap[room].push({ analysis: wi.analysis, reason: prereq.reason });
        }
    }

    // ── Per-stage summaries (grouped by room) ──
    const stageMap = {};
    for (const wi of workItems) {
        const room = resolveRoom(wi.analysis);
        if (!stageMap[room]) {
            stageMap[room] = {
                room,
                items: [],
                done: 0,
                total: 0,
                blockers: stageBlockerMap[room] || []
            };
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

    // ── Isolated Counters ──
    const prepItems = workItems.filter(wi =>
        getAnalysisConfig(wi.analysis).category === WORK_ITEM_CATEGORIES.OPERATIONAL_GATES
    );
    const analyticalItems = workItems.filter(wi =>
        getAnalysisConfig(wi.analysis).category !== WORK_ITEM_CATEGORIES.OPERATIONAL_GATES &&
        getAnalysisConfig(wi.analysis).category !== WORK_ITEM_CATEGORIES.POST_ANALYTICAL
    );

    const prepDone = prepItems.filter(wi => ['COMPLETED', 'ACCEPTED', 'SUBMITTED', 'WAIVED'].includes(wi.status)).length;
    const prepTotal = prepItems.length;

    const testsDone = analyticalItems.filter(wi => ['COMPLETED', 'ACCEPTED', 'SUBMITTED', 'WAIVED'].includes(wi.status)).length;
    const testsActive = analyticalItems.filter(wi => wi.status === 'IN_PROGRESS').length;
    const testsTotal = analyticalItems.length;

    const reviewsCleared = analyticalItems.filter(wi => ['ACCEPTED', 'WAIVED'].includes(wi.status)).length;
    const reviewsTotal = analyticalItems.length;

    const counters = {
        prep: { done: prepDone, total: prepTotal },
        tests: { done: testsDone, active: testsActive, total: testsTotal },
        reviews: { cleared: reviewsCleared, total: reviewsTotal },
        tasksCompleted: `${prepDone + testsDone} / ${prepTotal + testsTotal}`,
        resultsCleared: `${reviewsCleared} / ${reviewsTotal}`
    };

    // ── Dynamic High-level Stage Graph (Overview) ──
    const stageNodes = [];
    const stageEdges = [];

    // Stage: Reception
    const receptionDone = !['EXPECTED', 'RECEIVED'].includes(sample.status);
    const receptionTone = sample.status === 'RECEIVED_REJECTED' ? 'warn' : (receptionDone ? 'done' : 'active');
    stageNodes.push({
        id: 'reception',
        title: 'Reception',
        category: 'Intake',
        status: sample.status === 'RECEIVED_REJECTED' ? 'Rejected' : (receptionDone ? 'Accepted' : 'Pending intake'),
        tone: receptionTone,
        sub: `Sample ${sample.originalId || sample.id}`,
        desc: sample.status === 'RECEIVED_REJECTED'
            ? 'The sample was rejected at reception due to non-conformance.'
            : (receptionDone ? 'The sample has been accepted into the laboratory workflow.' : 'Awaiting physical reception at the desk.'),
        owner: sample.receivingOfficerName || 'Reception Officer',
        checks: receptionDone ? ['Sample accepted at desk'] : []
    });

    // Stage: Preparation (if prepItems exist)
    if (prepTotal > 0) {
        const prepAllDone = prepDone === prepTotal;
        const prepActive = prepItems.some(wi => ['IN_PROGRESS', 'ASSIGNED'].includes(wi.status));
        stageNodes.push({
            id: 'prep',
            title: 'Preparation',
            category: 'Prepare',
            status: `${prepDone} / ${prepTotal} done`,
            tone: prepAllDone ? 'done' : (prepActive ? 'active' : 'pending'),
            sub: prepItems.map(wi => getAnalysisConfig(wi.analysis).displayName).join(' · '),
            desc: prepAllDone ? 'Physical preparation tasks are completed.' : 'Drying, milling or sieving underway.',
            owner: prepItems.find(wi => wi.assignedTo)?.assignedTo || 'Preparation Desk',
            checks: prepAllDone ? ['Drying completed', 'Preparation completed'] : (prepDone > 0 ? ['Drying completed'] : [])
        });
        stageEdges.push({
            from: 'reception',
            to: 'prep',
            type: 'prerequisite',
            tone: receptionDone ? 'ready' : 'pending'
        });
    }

    // Analytical Stage Nodes (only for rooms that have items!)
    const analyticalRooms = [...new Set(analyticalItems.map(wi => resolveRoom(wi.analysis)))];
    analyticalRooms.forEach(room => {
        const items = analyticalItems.filter(wi => resolveRoom(wi.analysis) === room);
        const done = items.filter(wi => ['COMPLETED', 'ACCEPTED', 'SUBMITTED', 'WAIVED'].includes(wi.status)).length;
        const active = items.some(wi => wi.status === 'IN_PROGRESS');
        const hasWarn = items.some(wi => wi.status === 'COMPLETED' && (wi.metadata?.warning || wi.notes?.includes('WARN')));
        const roomId = room.toLowerCase().replace(/[^a-z0-9]/g, '_');
        const isAllDone = done === items.length;

        stageNodes.push({
            id: roomId,
            title: room,
            category: 'Analyze',
            status: isAllDone ? `${done} / ${items.length} done` : (active ? `${done} done · ${items.filter(i => i.status === 'IN_PROGRESS').length} active` : `0 / ${items.length} started`),
            tone: hasWarn ? 'warn' : (isAllDone ? 'done' : (active ? 'active' : 'pending')),
            sub: items.map(wi => getAnalysisConfig(wi.analysis).displayName).join(' · '),
            desc: `${room} analytical testing for assigned determinations.`,
            owner: items.find(wi => wi.assignedTo)?.assignedTo || 'Unassigned',
            checks: prepTotal > 0 && prepDone === prepTotal ? ['Preparation completed'] : []
        });

        // Edge from Prep (or Reception) to Analytical Room
        stageEdges.push({
            from: prepTotal > 0 ? 'prep' : 'reception',
            to: roomId,
            type: 'prerequisite',
            tone: (prepTotal === 0 || prepDone === prepTotal) ? 'ready' : 'pending'
        });

        // Edge from Analytical Room to QA Review
        stageEdges.push({
            from: roomId,
            to: 'review',
            type: 'handoff',
            tone: isAllDone ? 'ready' : 'pending'
        });
    });

    // Stage: QA Review
    const allAnalysesDone = testsTotal > 0 && testsDone === testsTotal;
    const isFullyApproved = eligibility.isFullyApproved;
    stageNodes.push({
        id: 'review',
        title: 'Quality Review',
        category: 'Review',
        status: `${reviewsCleared} / ${reviewsTotal} cleared`,
        tone: isFullyApproved ? 'done' : (allAnalysesDone ? 'active' : 'pending'),
        sub: 'Accepted or waived',
        desc: isFullyApproved ? 'All results approved by QA manager.' : 'Submissions evaluated against QA acceptance criteria.',
        owner: 'Authorized Reviewer',
        checks: isFullyApproved ? ['All analytical results approved'] : []
    });

    // Stage: Archive & Disposal
    const isClosed = ['ARCHIVED', 'DISPOSED'].includes(lifecycle);
    stageNodes.push({
        id: 'closure',
        title: 'Archive or Dispose',
        category: 'Close',
        status: isClosed ? lifecycle : (isFullyApproved ? 'Ready for closure' : 'Not reached'),
        tone: isClosed ? 'done' : (isFullyApproved ? 'active' : 'pending'),
        sub: isClosed ? (lifecycle === 'ARCHIVED' ? 'Archived' : 'Disposed') : 'One closure route',
        desc: 'Sample approval allows archiving to sample bank or controlled disposal.',
        owner: 'Authorized Operator',
        checks: isFullyApproved ? ['Quality review approved'] : []
    });
    stageEdges.push({
        from: 'review',
        to: 'closure',
        type: 'handoff',
        tone: isFullyApproved ? 'ready' : 'pending'
    });

    const stageGraph = { nodes: stageNodes, edges: stageEdges };

    // ── Item-Level Dependency Graph ──
    const depNodes = [];
    const depEdges = [];

    // Helper to get status pill tone
    const getItemTone = (wi) => {
        if (['COMPLETED', 'ACCEPTED', 'SUBMITTED', 'WAIVED'].includes(wi.status)) {
            if (wi.metadata?.warning || wi.notes?.includes('WARN')) return 'warn';
            return 'done';
        }
        if (wi.status === 'IN_PROGRESS') return 'active';
        const prereq = checkPrerequisites(wi, workItems);
        if (!prereq.canStart) return 'blocked';
        return 'pending';
    };

    workItems.forEach(wi => {
        const config = getAnalysisConfig(wi.analysis);
        const tone = getItemTone(wi);
        const nodeId = `wi_${wi.id}`;
        const prereq = checkPrerequisites(wi, workItems);

        depNodes.push({
            id: nodeId,
            workItemId: wi.id,
            analysis: wi.analysis,
            title: config.displayName || wi.analysis,
            category: config.category === WORK_ITEM_CATEGORIES.OPERATIONAL_GATES ? 'Prepare' : (config.category === WORK_ITEM_CATEGORIES.POST_ANALYTICAL ? 'Close' : 'Analyze'),
            status: wi.status === 'IN_PROGRESS' ? 'In progress' : (wi.status === 'COMPLETED' ? (tone === 'warn' ? 'Completed · warn' : 'Completed') : (wi.status === 'ACCEPTED' ? 'Accepted' : (prereq.canStart ? 'Ready' : 'Blocked'))),
            tone,
            sub: wi.assignedTo ? `${wi.assignedTo} · ${resolveRoom(wi.analysis)}` : resolveRoom(wi.analysis),
            desc: `${config.displayName || wi.analysis} determination for sample ${sample.originalId || sample.id}.`,
            owner: wi.assignedTo || 'Unassigned',
            checks: prereq.canStart ? ['Prerequisites satisfied'] : [prereq.reason],
            after: config.category === WORK_ITEM_CATEGORIES.OPERATIONAL_GATES ? 'Downstream analytical testing' : 'Submission and quality review',
            room: resolveRoom(wi.analysis)
        });

        // Prerequisite edges
        config.prerequisites.forEach(prereqCode => {
            const parent = workItems.find(w => w.analysis === prereqCode);
            if (parent) {
                const parentDone = ['COMPLETED', 'ACCEPTED', 'SUBMITTED', 'WAIVED'].includes(parent.status);
                depEdges.push({
                    from: `wi_${parent.id}`,
                    to: nodeId,
                    type: 'prerequisite',
                    tone: parentDone ? 'ready' : 'pending'
                });
            }
        });
    });

    const dependencyGraph = { nodes: depNodes, edges: depEdges };

    // ── SLA / Risk ──
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
        counters,
        stageGraph,
        dependencyGraph,
        owner,
        risk,
        sla,
        phase: summary.phase,
        progress: summary.progress,
        nextActions,
        nextEligibleAction: summary.nextEligibleAction,
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
    DYNAMIC_CONFIGS,
    getAnalysisConfig,
    registerAnalysisConfig,

    // Dependency Checks & DAG Cycle Validation
    detectCycle,
    validatePrerequisites,
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
