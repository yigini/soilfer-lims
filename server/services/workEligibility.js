/**
 * Work and Approval Eligibility Service
 * 
 * Central pure evaluation functions called across dashboard selectors,
 * technician workbench, sample workspace, and command controllers.
 * Complies with Section 1 of implementation-plan.md, contracts.md, and Review R4.
 */
'use strict';

const GATE_ANALYSES = ['DRYING', 'PREPARATION'];
const NON_ANALYTICAL = ['DRYING', 'PREPARATION', 'ARCHIVING', 'ARCH', 'DISPOSAL', 'DISP'];

/**
 * Evaluates whether a work item is ready for result/checklist entry by the technician.
 */
function canRecord(workItem, sample, user, options = {}) {
    const blockers = [];

    if (!sample) {
        return { allowed: false, blockers: ['SAMPLE_NOT_FOUND'], reason: 'Sample not found' };
    }

    // 1. Material arrival and status checks
    if (['EXPECTED', 'DRAFT'].includes(sample.status) || !sample.receptionDate) {
        blockers.push('NOT_RECEIVED: Sample has not been physically received at the laboratory');
    }
    if (['RECEIVED_REJECTED', 'REJECTED'].includes(sample.status)) {
        blockers.push('SAMPLE_REJECTED: Sample intake was rejected');
    }
    if (['DISPOSED', 'ARCHIVED'].includes(sample.status)) {
        blockers.push('SAMPLE_CLOSED: Sample material is archived or disposed');
    }

    const isGateItem = GATE_ANALYSES.includes(workItem?.analysis);

    // 2. Operational gate prerequisites (for analytical work items)
    if (!isGateItem) {
        const isDryingApplicable = options.isDryingApplicable !== false;
        const isPrepApplicable = options.isPrepApplicable !== false;

        if (isDryingApplicable && sample.dryingStatus !== 'DONE') {
            blockers.push('DRYING_PENDING: Air drying must be completed before result entry');
        }
        if (isPrepApplicable && sample.preparationStatus !== 'DONE') {
            blockers.push('PREPARATION_PENDING: Sample preparation (sieving/milling) must be completed');
        }
    } else if (workItem.analysis === 'PREPARATION') {
        const isDryingApplicable = options.isDryingApplicable !== false;
        if (isDryingApplicable && sample.dryingStatus !== 'DONE') {
            blockers.push('DRYING_PENDING: Air drying must be completed before preparation');
        }
    }

    // 3. Assignment check
    if (user && user.role === 'LAB_TECHNICIAN') {
        if (workItem?.assignedTo && workItem.assignedTo !== user.username && workItem.assignedTo !== user.id) {
            blockers.push(`NOT_ASSIGNED_TO_ACTOR: Item assigned to ${workItem.assignedTo}`);
        }
    }

    // 4. Lifecycle state check
    if (workItem) {
        if (['COMPLETED', 'RECORDED'].includes(workItem.status)) {
            blockers.push('ALREADY_RECORDED: Result recorded and awaiting review/submission');
        } else if (workItem.status === 'SUBMITTED') {
            blockers.push('SUBMITTED: Work is currently under manager review');
        } else if (workItem.status === 'ACCEPTED') {
            blockers.push('ACCEPTED: Analysis already approved by laboratory manager');
        } else if (['WAIVED', 'CANCELLED'].includes(workItem.status)) {
            blockers.push(`OMITTED: Analysis was ${workItem.status.toLowerCase()}`);
        }
    }

    const allowed = blockers.length === 0;
    return {
        allowed,
        blockers,
        reason: allowed ? null : blockers[0]
    };
}

/**
 * Evaluates whether a work item can be submitted by the technician for manager review.
 */
function canSubmit(workItem, sample, user) {
    const blockers = [];

    if (!workItem) {
        return { allowed: false, blockers: ['NO_WORK_ITEM'], reason: 'No work item' };
    }

    if (!['RECORDED', 'COMPLETED'].includes(workItem.status)) {
        blockers.push(`INVALID_STATUS: Work item is in status ${workItem.status}, not RECORDED/COMPLETED`);
    }

    if (sample && ['DISPOSED', 'ARCHIVED', 'RECEIVED_REJECTED'].includes(sample.status)) {
        blockers.push('SAMPLE_CLOSED: Sample is closed, archived or rejected');
    }

    if (user && user.role === 'LAB_TECHNICIAN') {
        if (workItem.assignedTo && workItem.assignedTo !== user.username && workItem.assignedTo !== user.id) {
            blockers.push('NOT_ASSIGNED_TO_ACTOR: Only the assigned technician can submit this work');
        }
    }

    const allowed = blockers.length === 0;
    return {
        allowed,
        blockers,
        reason: allowed ? null : blockers[0]
    };
}

/**
 * Evaluates review readiness and approval eligibility for manager review of submissions.
 */
function canReview(submission, sample, user, options = {}) {
    const blockers = [];
    let canAccept = true;

    if (!user || !['LAB_MANAGER', 'MASTER_USER', 'SUPER_ADMIN'].includes(user.role)) {
        return { allowed: false, canAccept: false, blockers: ['UNAUTHORIZED_ROLE'], reason: 'Requires manager review authority' };
    }

    if (!submission || submission.status !== 'PENDING_REVIEW') {
        return { allowed: false, canAccept: false, blockers: ['NOT_PENDING_REVIEW'], reason: 'Submission is not pending review' };
    }

    // Inspect linked QC batches
    const qcBatches = options.qcBatches || [];
    const failedQc = qcBatches.find(b => b.status === 'FAILED');
    const pendingQc = qcBatches.find(b => b.status === 'PENDING');

    if (failedQc) {
        canAccept = false;
        blockers.push(`QC_FAILED: Batch ${failedQc.batchNumber || failedQc.id} failed quality control tolerance`);
    }
    if (pendingQc) {
        canAccept = false;
        blockers.push(`QC_PENDING: Batch ${pendingQc.batchNumber || pendingQc.id} quality control is pending evaluation`);
    }

    // Submission can be opened/inspected even if QC is blocked
    return {
        allowed: true, // can inspect
        canAccept,     // can manager accept
        blockers,
        reason: canAccept ? null : blockers[0]
    };
}

/**
 * Evaluates whether a sample is fully eligible for final managerial approval.
 * Fulfills Acceptance criteria A17, A18, A19 and Audit finding D09, D24.
 */
function canFinalApprove(sample, workItems = [], orderLines = [], user = null, options = {}) {
    const blockers = [];

    // 1. Authorization check
    if (user && !['LAB_MANAGER', 'MASTER_USER', 'SUPER_ADMIN'].includes(user.role)) {
        return { allowed: false, blockers: ['UNAUTHORIZED_ROLE'], reason: 'Final approval requires laboratory manager authority' };
    }

    if (!sample) {
        return { allowed: false, blockers: ['SAMPLE_NOT_FOUND'], reason: 'Sample record not found' };
    }

    // 2. Physical arrival and intake disposition
    if (['EXPECTED', 'DRAFT'].includes(sample.status) || !sample.receptionDate) {
        blockers.push('NOT_RECEIVED: Sample has not been physically received');
    }
    if (['RECEIVED_REJECTED', 'REJECTED'].includes(sample.status)) {
        blockers.push('SAMPLE_REJECTED: Sample intake was rejected');
    }
    if (['DISPOSED', 'ARCHIVED'].includes(sample.status)) {
        blockers.push('SAMPLE_CLOSED: Sample is archived or disposed');
    }
    if (sample.status === 'APPROVED') {
        blockers.push('ALREADY_APPROVED: Sample is already approved');
    }

    // 3. Analytical items check (must have ordered analytical work; gate-only work does NOT qualify)
    const analyticalItems = workItems.filter(w => !NON_ANALYTICAL.includes(w.analysis));
    if (analyticalItems.length === 0) {
        blockers.push('NO_ANALYTICAL_WORK: No analytical determinations were ordered for this sample');
    }

    // 4. Work item completion & review status
    const pendingItems = analyticalItems.filter(w => !['ACCEPTED', 'WAIVED', 'CANCELLED'].includes(w.status));
    if (pendingItems.length > 0) {
        const itemSummaries = pendingItems.map(w => `${w.analysis} (${w.status})`).join(', ');
        blockers.push(`UNACCEPTED_WORK: Work items pending approval or completion: ${itemSummaries}`);
    }

    // 5. All-omitted guard: if all analytical items are waived/cancelled/omitted, normal result approval is rejected
    const nonOmitted = analyticalItems.filter(w => !['WAIVED', 'CANCELLED', 'OMITTED'].includes(w.status));
    if (analyticalItems.length > 0 && nonOmitted.length === 0) {
        blockers.push('ALL_WORK_OMITTED: All ordered analyses were omitted/cancelled; requires formal administrative closure, not analytical approval');
    }

    // 6. Active order lines parity
    if (Array.isArray(orderLines) && orderLines.length > 0) {
        const activeLines = orderLines.filter(l => l.status === 'ACTIVE' && l.isRequired !== false);
        for (const line of activeLines) {
            const linked = analyticalItems.find(w => w.analysis === line.analysis);
            if (!linked || linked.status !== 'ACCEPTED') {
                blockers.push(`ORDER_LINE_INCOMPLETE: Required ordered analysis ${line.analysis} is not accepted`);
            }
        }
    }

    // 7. QC Batch resolution
    const qcBatches = options.qcBatches || [];
    const failedQc = qcBatches.find(b => b.status === 'FAILED');
    const pendingQc = qcBatches.find(b => b.status === 'PENDING');
    if (failedQc) {
        blockers.push(`QC_BATCH_FAILED: Linked QC batch ${failedQc.batchNumber || failedQc.id} failed`);
    }
    if (pendingQc) {
        blockers.push(`QC_BATCH_PENDING: Linked QC batch ${pendingQc.batchNumber || pendingQc.id} has not been evaluated`);
    }

    // 8. Holds and historical evidence gaps
    if (sample.holdReason || options.hasActiveHold) {
        blockers.push('SAMPLE_ON_HOLD: Sample is on administrative or quality hold');
    }
    if (options.hasHistoricalGap) {
        blockers.push('HISTORICAL_EVIDENCE_GAP: Sample results lack recorded analytical or spectral evidence');
    }

    const allowed = blockers.length === 0;
    return {
        allowed,
        blockers,
        reason: allowed ? null : blockers[0]
    };
}

/**
 * Evaluates whether an official report can be released / published.
 */
function canPublish(sample, report, user) {
    if (!user || !['LAB_MANAGER', 'MASTER_USER', 'SUPER_ADMIN'].includes(user.role)) {
        return { allowed: false, reason: 'Report publication requires laboratory manager authority (AUDIT_USER is strictly read-only)' };
    }

    if (!sample) {
        return { allowed: false, reason: 'Sample record not found' };
    }

    if (!['APPROVED', 'PUBLISHED', 'COMPLETED', 'SUBMITTED_FULL'].includes(sample.status)) {
        return { allowed: false, reason: `Sample must be in approved or completed status before publishing (current: ${sample.status})` };
    }

    if (['DISPOSED', 'ARCHIVED', 'RECEIVED_REJECTED'].includes(sample.status)) {
        return { allowed: false, reason: 'Sample is closed, archived or rejected' };
    }

    return { allowed: true, reason: null };
}

module.exports = {
    GATE_ANALYSES,
    NON_ANALYTICAL,
    canRecord,
    canSubmit,
    canReview,
    canFinalApprove,
    canPublish
};
