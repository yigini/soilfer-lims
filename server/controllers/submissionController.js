const prisma = require('../prisma');
const workflow = require('../workflowContract');
const { getAnalysisName } = require('../services/analysisService');


// =============================================================================
// HELPER: Check if user has lab scope
// =============================================================================
const userHasLabScope = (user, labId) => {
    if (user.role === 'SUPER_ADMIN') return true;
    if (['LAB_MANAGER', 'LAB_TECHNICIAN', 'SAMPLE_RECEPTION'].includes(user.role)) {
        return user.labId === labId;
    }
    return false;
};

// =============================================================================
// HELPER: Get work items for a sample
// =============================================================================
const getWorkItemsForSample = async (sampleId) => {
    return await prisma.workItem.findMany({
        where: { sampleId: String(sampleId) }
    });
};

// =============================================================================
// HELPER: Check FULL submission eligibility (Using Workflow Engine)
// =============================================================================
const checkFullEligibility = async (sampleId, currentSubmissionItemIds = []) => {
    const workflowEngine = require('../utils/workflowEngine');
    const items = await getWorkItemsForSample(sampleId);
    const blocking = [];
    const eligible = [];

    items.forEach(item => {
        // Use Workflow Engine to get category configuration
        const config = workflowEngine.getAnalysisConfig(item.analysis);

        // Skip Post-Analytical items for full submission eligibility
        if (config.category === workflowEngine.WORK_ITEM_CATEGORIES.POST_ANALYTICAL) return;

        // An item is eligible for FULL closure if it's already accepted/waived OR included in this submission
        if (['ACCEPTED', 'WAIVED'].includes(item.status) || (currentSubmissionItemIds.includes(item.id) && item.status === 'COMPLETED')) {
            eligible.push(item);
        } else {
            blocking.push({
                id: item.id,
                analysis: item.analysis,
                displayName: config.displayName || item.analysis,
                status: item.status,
                reason: item.status === 'REANALYSIS_REQUIRED' ? item.reanalysisReason : null
            });
        }
    });

    const nonPostItems = items.filter(i =>
        workflowEngine.getAnalysisConfig(i.analysis).category !== workflowEngine.WORK_ITEM_CATEGORIES.POST_ANALYTICAL
    );

    return {
        isEligible: blocking.length === 0 && nonPostItems.length > 0,
        blocking,
        eligible,
        totalRequired: nonPostItems.length
    };
};

exports.createSubmission = async (req, res) => {
    const { sampleId, type, workItemIds, note } = req.body;
    const user = req.user;

    try {
        const allowedRoles = ['LAB_TECHNICIAN', 'LAB_MANAGER', 'SUPER_ADMIN'];
        if (!allowedRoles.includes(user.role)) {
            return res.status(403).json({ error: 'Only technicians and managers can create submissions' });
        }

        if (!sampleId) { return res.status(400).json({ error: 'sampleId is required' }); }
        if (!type || !['PARTIAL', 'FULL'].includes(type)) { return res.status(400).json({ error: 'type must be PARTIAL or FULL' }); }
        if (!workItemIds || !Array.isArray(workItemIds) || workItemIds.length === 0) { return res.status(400).json({ error: 'workItemIds array is required' }); }

        const sample = await prisma.sample.findUnique({ where: { id: String(sampleId) } });
        if (!sample) return res.status(404).json({ error: 'Sample not found' });

        const validItems = [];
        const errors = [];

        const dbItems = await prisma.workItem.findMany({
            where: { id: { in: workItemIds } }
        });

        workItemIds.forEach(wiId => {
            const item = dbItems.find(i => i.id === wiId);
            if (!item) {
                errors.push({ id: wiId, error: 'Work item not found' });
                return;
            }
            if (String(item.sampleId) !== String(sampleId)) {
                errors.push({ id: wiId, error: 'Work item does not belong to this sample' });
                return;
            }
            if (item.assignedTo !== user.username) {
                errors.push({ id: wiId, error: 'Work item is not assigned to you' });
                return;
            }
            if (item.status !== 'COMPLETED') {
                errors.push({ id: wiId, error: `Must be COMPLETED. Current: ${item.status}` });
                return;
            }
            validItems.push(item);
        });

        if (errors.length > 0) {
            return res.status(400).json({ error: 'Invalid work items', details: errors });
        }

        if (type === 'FULL') {
            const eligibility = await checkFullEligibility(sampleId, workItemIds);
            if (!eligibility.isEligible) {
                return res.status(409).json({
                    error: 'Not eligible for FULL submission',
                    blocking: eligibility.blocking
                });
            }
        }

        const now = new Date();
        const submissionId = `SUB-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        const auditLogId = `audit-sub-${Date.now()}`;

        // Prepare operations for transaction
        const operations = [
            prisma.submission.create({
                data: {
                    id: submissionId,
                    sampleId: String(sampleId),
                    labId: sample.labId,
                    assignedLab: sample.assignedLab,
                    submittedBy: user.username,
                    type,
                    status: 'PENDING_REVIEW',
                    submittedAt: now,
                    note: note || null,
                    workItemIds: JSON.stringify(validItems.map(wi => wi.id)),
                    workItemCount: validItems.length,
                    createdAt: now
                }
            }),
            prisma.auditLog.create({
                data: {
                    id: `audit-sub-main-${Date.now()}`,
                    entity: 'SUBMISSION',
                    entityId: submissionId,
                    action: 'SUBMISSION_CREATED',
                    details: `${user.username} submitted ${validItems.length} items for ${type} review`,
                    performedBy: user.username,
                    timestamp: now,
                    sampleId: String(sampleId)
                }
            })
        ];

        // Update work items
        for (const item of validItems) {
            const history = typeof item.history === 'string' ? JSON.parse(item.history) : (item.history || []);
            history.push({
                status: workflow.WORK_ITEM_STATES.SUBMITTED,
                submissionId: submissionId,
                timestamp: now,
                action: 'SUBMITTED'
            });

            operations.push(prisma.workItem.update({
                where: { id: item.id },
                data: {
                    status: workflow.WORK_ITEM_STATES.SUBMITTED,
                    submissionId: submissionId,
                    submittedAt: now,
                    history: JSON.stringify(history)
                }
            }));

            operations.push(prisma.auditLog.create({
                data: {
                    id: `audit-wi-sub-${item.id}-${Date.now()}`,
                    entity: 'WORKITEM',
                    entityId: item.id,
                    action: 'WORKITEM_SUBMITTED',
                    details: `${user.username} submitted ${await getAnalysisName(item.analysis)}`,
                    performedBy: user.username,
                    timestamp: now,
                    sampleId: String(sampleId)
                }
            }));
        }

        const [submission] = await prisma.$transaction(operations);

        const { transitionSample } = require('../services/sampleStateService');
        const targetStatus = type === 'FULL' ? 'SUBMITTED_FULL' : 'SUBMITTED_PARTIAL';
        await transitionSample(sampleId, targetStatus, user, `${user.username} submitted ${validItems.length} items for ${type} review`, {
            lastSubmissionId: submissionId,
            lastSubmissionType: type,
            lastSubmissionAt: now
        }).catch(err => {
            console.warn('[createSubmission] Warning: sample status transition failed:', err.message);
        });

        res.status(201).json({
            submission,
            message: `${type} submission created`
        });

    } catch (error) {
        console.error('[createSubmission] Error:', error);
        res.status(500).json({ error: 'Failed to create submission' });
    }
};

exports.listSubmissions = async (req, res) => {
    const user = req.user;
    const { status, type, sampleId } = req.query;

    try {
        const where = {};

        // RBAC scoping
        if (user.role === 'LAB_TECHNICIAN') {
            where.submittedBy = user.username;
        } else if (user.role === 'LAB_MANAGER') {
            where.assignedLab = user.labId;
        } else if (user.role !== 'SUPER_ADMIN') {
            return res.status(403).json({ error: 'Access denied' });
        }

        if (status) where.status = status;
        if (type) where.type = type;
        if (sampleId) where.sampleId = String(sampleId);

        const submissions = await prisma.submission.findMany({
            where,
            orderBy: { submittedAt: 'desc' }
        });

        res.json(submissions);
    } catch (error) {
        console.error('[listSubmissions] Error:', error);
        res.status(500).json({ error: 'Failed to list submissions' });
    }
};

exports.getSubmission = async (req, res) => {
    const { id } = req.params;
    const user = req.user;

    try {
        const submission = await prisma.submission.findUnique({ where: { id } });
        if (!submission) {
            return res.status(404).json({ error: 'Submission not found' });
        }

        // RBAC
        if (user.role === 'LAB_TECHNICIAN' && submission.submittedBy !== user.username) {
            return res.status(403).json({ error: 'Access denied' });
        }
        if (user.role === 'LAB_MANAGER' && submission.assignedLab !== user.labId) {
            return res.status(403).json({ error: 'Submission outside your lab' });
        }

        const workItemIds = typeof submission.workItemIds === 'string' ? JSON.parse(submission.workItemIds) : (submission.workItemIds || []);
        const workItems = await prisma.workItem.findMany({
            where: { id: { in: workItemIds } }
        });
        const sample = await prisma.sample.findUnique({ where: { id: String(submission.sampleId) } });

        res.json({ submission, workItems, sample });
    } catch (error) {
        console.error('[getSubmission] Error:', error);
        res.status(500).json({ error: 'Failed to get submission details' });
    }
};

exports.reviewSubmission = async (req, res) => {
    const { id } = req.params;
    const { decisions } = req.body;
    const user = req.user;

    try {
        if (!['LAB_MANAGER', 'SUPER_ADMIN'].includes(user.role)) {
            return res.status(403).json({ error: 'Only managers can review' });
        }

        const submission = await prisma.submission.findUnique({ where: { id } });
        if (!submission) return res.status(404).json({ error: 'Submission not found' });

        if (user.role === 'LAB_MANAGER' && submission.assignedLab !== user.labId) {
            return res.status(403).json({ error: 'Submission outside your lab' });
        }

        if (submission.status !== 'PENDING_REVIEW') {
            return res.status(400).json({ error: `Already ${submission.status}` });
        }

        if (!decisions || !Array.isArray(decisions) || decisions.length === 0) {
            return res.status(400).json({ error: 'decisions array required' });
        }

        const qcController = require('./qcController');
        const workItemIds = typeof submission.workItemIds === 'string' ? JSON.parse(submission.workItemIds) : (submission.workItemIds || []);

        // SECURITY: Trojan Horse Prevention
        // Verify that all decided items actually belong to this submission
        const validItemSet = new Set(workItemIds);
        const invalidDecisions = decisions.filter(d => !validItemSet.has(d.workItemId));
        if (invalidDecisions.length > 0) {
            console.warn(`[SUBMISSION] Blocked Trojan Horse attempt by ${user.username}. Invalid items: ${invalidDecisions.map(d => d.workItemId).join(', ')}`);
            return res.status(403).json({ error: 'Security Violation: Attempted to review items not belonging to this submission.' });
        }

        const batchFailures = [];
        for (const wiId of workItemIds) {
            const batchInfo = await qcController.checkItemBatchStatus(wiId);
            if (batchInfo.status === 'QC_FAIL') {
                batchFailures.push({ workItemId: wiId, batchId: batchInfo.batchId });
            }
        }

        for (const failure of batchFailures) {
            const decision = decisions.find(d => d.workItemId === failure.workItemId);
            if (decision && decision.decision === 'ACCEPT') {
                return res.status(409).json({
                    error: `Cannot ACCEPT work item ${failure.workItemId} because it belongs to a FAILED QC Batch (${failure.batchId}). You must WAIVE or REJECT it.`,
                    batchId: failure.batchId
                });
            }
        }

        const now = new Date();
        const results = [];
        const operations = [];

        const dbItems = await prisma.workItem.findMany({
            where: { id: { in: decisions.map(d => d.workItemId) } }
        });

        for (const decision of decisions) {
            const { workItemId, decision: verdict, reason } = decision;

            if (!['ACCEPT', 'REJECT_REANALYSIS', 'WAIVE'].includes(verdict)) {
                return res.status(400).json({ error: `Invalid decision: ${verdict}` });
            }

            if ((verdict === 'REJECT_REANALYSIS' || verdict === 'WAIVE') && !reason) {
                return res.status(400).json({ error: `${verdict} requires reason` });
            }

            const item = dbItems.find(i => i.id === workItemId);
            if (!item) continue;

            let newStatus;
            switch (verdict) {
                case 'ACCEPT': newStatus = workflow.WORK_ITEM_STATES.ACCEPTED; break;
                case 'REJECT_REANALYSIS': newStatus = workflow.WORK_ITEM_STATES.REANALYSIS_REQUIRED; break;
                case 'WAIVE': newStatus = workflow.WORK_ITEM_STATES.WAIVED; break;
            }

            const history = typeof item.history === 'string' ? JSON.parse(item.history) : (item.history || []);
            history.push({
                status: newStatus,
                decision: verdict,
                reason: reason || null,
                reviewedBy: user.username,
                timestamp: now,
                action: 'REVIEWED'
            });

            const updates = {
                status: newStatus,
                reviewedBy: user.username,
                reviewedAt: now,
                reviewDecision: verdict,
                history: JSON.stringify(history)
            };

            if (verdict === 'REJECT_REANALYSIS') {
                updates.reanalysisReason = reason;
                updates.reanalysisRequestedBy = user.username;
            }
            if (verdict === 'WAIVE') {
                updates.waiveReason = reason;
            }

            operations.push(prisma.workItem.update({
                where: { id: workItemId },
                data: updates
            }));

            operations.push(prisma.auditLog.create({
                data: {
                    id: `audit-wi-rev-${workItemId}-${Date.now()}`,
                    entity: 'WORKITEM',
                    entityId: workItemId,
                    action: verdict === 'REJECT_REANALYSIS' ? 'REANALYSIS_REQUESTED' : 'REVIEW_DECISION_MADE',
                    details: `${user.username} ${verdict.toLowerCase()}ed ${await getAnalysisName(item.analysis)}`,
                    performedBy: user.username,
                    timestamp: now,
                    sampleId: String(submission.sampleId)
                }
            }));

            results.push({ workItemId, status: newStatus, decision: verdict });
        }

        operations.push(prisma.submission.update({
            where: { id },
            data: {
                status: 'REVIEWED',
                reviewedBy: user.username,
                reviewedAt: now,
                reviewNote: decisions.map(d => `${d.workItemId}: ${d.decision}`).join(' | ')
            }
        }));

        operations.push(prisma.auditLog.create({
            data: {
                id: `audit-sub-rev-${id}-${Date.now()}`,
                entity: 'SUBMISSION',
                entityId: id,
                action: 'SUBMISSION_REVIEWED',
                details: `${user.username} reviewed ${results.length} items`,
                performedBy: user.username,
                timestamp: now,
                sampleId: String(submission.sampleId)
            }
        }));

        await prisma.$transaction(operations);
        res.json({ success: true, results });

    } catch (error) {
        console.error('[reviewSubmission] Error:', error);
        res.status(500).json({ error: 'Failed to review submission' });
    }
};

exports.getReanalysisRequests = async (req, res) => {
    const user = req.user;

    try {
        if (user.role !== 'LAB_TECHNICIAN') {
            return res.status(403).json({ error: 'Only technicians' });
        }

        const items = await prisma.workItem.findMany({
            where: {
                assignedTo: user.username,
                status: workflow.WORK_ITEM_STATES.REANALYSIS_REQUIRED
            }
        });

        const enriched = items.map(i => {
            const history = typeof i.history === 'string' ? JSON.parse(i.history) : (i.history || []);
            const lastReject = history.slice().reverse().find(h => h.status === 'REANALYSIS_REQUIRED');
            return {
                ...i,
                reanalysisReason: lastReject ? lastReject.reason || lastReject.note : i.reanalysisReason || 'QC Rejection'
            };
        });

        res.json(enriched);
    } catch (error) {
        console.error('[getReanalysisRequests] Error:', error);
        res.status(500).json({ error: 'Failed to get reanalysis requests' });
    }
};

module.exports = exports;
