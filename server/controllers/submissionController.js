const crypto = require('crypto');
const { assertReviewable, commitReview, reconcileSubmission } = require('../services/reviewCommitService');
const { hasPermission } = require('../config/roles');
const scopeGuard = require('../utils/scopeGuard');
const { invalidateReturnedResults } = require('../services/reportResultGovernance');
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
        const code = (item.analysis || '').toUpperCase();

        // Skip Post-Analytical and Operational Gate items for full submission eligibility
        if (config.category === workflowEngine.WORK_ITEM_CATEGORIES.POST_ANALYTICAL ||
            config.category === workflowEngine.WORK_ITEM_CATEGORIES.OPERATIONAL_GATES ||
            ['DRYING', 'PREPARATION', 'ARCHIVING', 'DISPOSAL'].includes(code)) return;

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

    const analyticalItems = items.filter(i => {
        const cfg = workflowEngine.getAnalysisConfig(i.analysis);
        const code = (i.analysis || '').toUpperCase();
        return cfg.category !== workflowEngine.WORK_ITEM_CATEGORIES.POST_ANALYTICAL &&
               cfg.category !== workflowEngine.WORK_ITEM_CATEGORIES.OPERATIONAL_GATES &&
               !['DRYING', 'PREPARATION', 'ARCHIVING', 'DISPOSAL'].includes(code);
    });

    return {
        isEligible: blocking.length === 0 && analyticalItems.length > 0,
        blocking,
        eligible,
        totalRequired: analyticalItems.length
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
                    id: crypto.randomUUID(),
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
                    id: crypto.randomUUID(),
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
    const { status, type, sampleId, labId } = req.query;

    try {
        const where = {};

        // RBAC scoping
        if (user.role === 'LAB_TECHNICIAN') {
            where.submittedBy = user.username;
        } else if (user.role === 'LAB_MANAGER') {
            where.assignedLab = user.labId;
        } else if (user.role === 'SUPER_ADMIN') {
            if (labId) where.assignedLab = String(labId);
        } else {
            return res.status(403).json({ error: 'Access denied' });
        }

        if (status) where.status = status;
        if (type) where.type = type;
        if (sampleId) where.sampleId = String(sampleId);

        const submissions = await prisma.submission.findMany({
            where,
            orderBy: { submittedAt: 'desc' }
        });

        const sampleIds = [...new Set(submissions.map(s => s.sampleId).filter(Boolean))];
        const samples = await prisma.sample.findMany({
            where: { id: { in: sampleIds } },
            select: { id: true, labId: true, originalId: true, projectCode: true }
        });
        const sampleMap = new Map(samples.map(s => [s.id, s]));

        const enriched = submissions.map(sub => {
            const s = sampleMap.get(sub.sampleId);
            return {
                ...sub,
                sampleLabId: s?.labId || null,
                originalId: s?.originalId || null,
                projectCode: s?.projectCode || null
            };
        });

        res.json(enriched);
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
        if (!hasPermission(user, 'APPROVE_RESULTS')) {
            return res.status(403).json({ error: 'Only managers can review' });
        }

        const submission = await prisma.submission.findUnique({ where: { id } });
        if (!submission) return res.status(404).json({ error: 'Submission not found' });

        if (!scopeGuard.canAccessEntity(user, submission, { labField: 'assignedLab', altLabField: 'labId' })) {
            return res.status(403).json({ error: 'Submission outside your lab' });
        }

        // S20: Allow review on PENDING_REVIEW and PARTIALLY_REVIEWED submissions
        if (!['PENDING_REVIEW', 'PARTIALLY_REVIEWED'].includes(submission.status)) {
            return res.status(409).json({ error: `Cannot review submission in '${submission.status}' status`, code: 'SUBMISSION_NOT_REVIEWABLE', status: submission.status });
        }

        const workItemIds = typeof submission.workItemIds === 'string' ? JSON.parse(submission.workItemIds) : (submission.workItemIds || []);
        const isShorthand = (!Array.isArray(decisions) || !decisions.length) && Boolean(req.body.status || req.body.decision);
        let normalizedDecisions = isShorthand
            ? workItemIds.map(workItemId => ({ workItemId, decision: req.body.decision || req.body.status, reason: req.body.reason || req.body.note }))
            : decisions;
        if (!Array.isArray(normalizedDecisions) || !normalizedDecisions.length) {
            return res.status(400).json({ error: 'decisions array required', code: 'INVALID_REVIEW_DECISION' });
        }
        const aliases = { ACCEPTED: 'ACCEPT', REJECT: 'REJECT_REANALYSIS', RETURN: 'REJECT_REANALYSIS', REANALYSIS_REQUIRED: 'REJECT_REANALYSIS', WAIVED: 'WAIVE' };
        const validated = [];
        for (const decision of normalizedDecisions) {
            if (!decision || typeof decision !== 'object' || Array.isArray(decision) || typeof decision.workItemId !== 'string') {
                return res.status(400).json({ error: 'Invalid review decision.', code: 'INVALID_REVIEW_DECISION' });
            }
            const raw = decision.decision || decision.verdict || decision.status;
            const verdict = aliases[raw] || raw;
            if (!['ACCEPT', 'REJECT_REANALYSIS', 'WAIVE'].includes(verdict)) {
                return res.status(400).json({ error: 'Invalid review decision.', code: 'INVALID_REVIEW_DECISION' });
            }
            if ((decision.reason != null && typeof decision.reason !== 'string') || (decision.note != null && typeof decision.note !== 'string')) {
                return res.status(400).json({ error: 'Review reason must be text.', code: 'INVALID_REVIEW_REASON' });
            }
            const reason = (decision.reason || decision.note || '').trim();
            if (verdict !== 'ACCEPT' && !reason) return res.status(400).json({ error: 'RETURN and WAIVE require a reason.', code: 'REVIEW_REASON_REQUIRED' });
            validated.push({ workItemId: decision.workItemId, decision: verdict, reason: reason || 'Item accepted' });
        }
        normalizedDecisions = validated;

        const qcController = require('./qcController');

        // SECURITY: Trojan Horse Prevention
        // Verify that all decided items actually belong to this submission
        const validItemSet = new Set(workItemIds);
        const invalidDecisions = normalizedDecisions.filter(d => !validItemSet.has(d.workItemId));
        if (invalidDecisions.length > 0) {
            console.warn(`[SUBMISSION] Blocked Trojan Horse attempt by ${user.username}. Invalid items: ${invalidDecisions.map(d => d.workItemId).join(', ')}`);
            return res.status(403).json({ error: 'Security Violation: Attempted to review items not belonging to this submission.' });
        }

        const dbItems = await prisma.workItem.findMany({ where: { id: { in: workItemIds } }, include: { sample: true } });
        if (dbItems.some(item => !scopeGuard.canAccessEntity(user, item.sample || item, { labField: 'labId', altLabField: 'assignedLab' }))) {
            return res.status(403).json({ error: 'Work item outside your lab scope.', code: 'ACCESS_DENIED_LAB' });
        }
        const currentMemberIds = new Set(dbItems.filter(item => item.submissionId === id).map(item => item.id));
        if (isShorthand) normalizedDecisions = normalizedDecisions.filter(decision => currentMemberIds.has(decision.workItemId));
        if (isShorthand && !normalizedDecisions.length) {
            await prisma.$transaction(async tx => {
                const currentItems = await tx.workItem.findMany({ where: { id: { in: workItemIds } } });
                if (currentItems.some(item => item.submissionId === id)) throw Object.assign(new Error('Submission membership changed. Please refresh.'), { statusCode: 409, code: 'ITEM_NOT_IN_SUBMISSION' });
                const currentSubmission = await tx.submission.findUnique({ where: { id } });
                if (currentSubmission.status !== 'REVIEWED') {
                    const now = new Date();
                    await tx.submission.update({ where: { id }, data: { status: 'REVIEWED', reviewedBy: user.username, reviewedAt: now } });
                    const movedCount = currentItems.filter(item => item.submissionId && item.submissionId !== id).length;
                    await tx.auditLog.create({ data: { id: crypto.randomUUID(), entity: 'SUBMISSION', entityId: id,
                        action: 'SUBMISSION_REVIEWED', performedBy: user.username, timestamp: now, sampleId: String(submission.sampleId),
                        details: '0 items reviewed; ' + movedCount + ' moved to later submissions' } });
                }
            });
            return res.json({ success: true, results: [], errors: [] });
        }

        const batchFailures = [];
        for (const wiId of normalizedDecisions.filter(decision => decision.decision === 'ACCEPT' && currentMemberIds.has(decision.workItemId)).map(decision => decision.workItemId)) {
            const batchInfo = await qcController.checkItemBatchStatus(wiId);
            if (batchInfo.allowed === false) {
                batchFailures.push({ workItemId: wiId, batchId: batchInfo.batchId });
            }
        }

        for (const failure of batchFailures) {
            const decision = normalizedDecisions.find(d => d.workItemId === failure.workItemId);
            if (decision && decision.decision === 'ACCEPT') {
                return res.status(409).json({
                    error: `Cannot ACCEPT work item ${failure.workItemId} because it belongs to a FAILED QC Batch (${failure.batchId}). You must WAIVE or REJECT it.`,
                    code: 'QC_FAIL_BLOCKER',
                    batchId: failure.batchId
                });
            }
        }

        const now = new Date();
        const results = [];
        const errors = [];

        for (const decision of normalizedDecisions) {
            const { workItemId, decision: verdict, reason } = decision;

            if (!['ACCEPT', 'REJECT_REANALYSIS', 'WAIVE'].includes(verdict)) {
                return res.status(400).json({ error: `Invalid decision: ${verdict}` });
            }

            if ((verdict === 'REJECT_REANALYSIS' || verdict === 'WAIVE') && !reason) {
                return res.status(400).json({ error: `${verdict} requires reason` });
            }

            const item = dbItems.find(i => i.id === workItemId);
            if (!item || item.submissionId !== id) {
                errors.push({ workItemId, code: 'ITEM_NOT_IN_SUBMISSION' });
                continue;
            }
            const operations = [];

            let newStatus;
            switch (verdict) {
                case 'ACCEPT': newStatus = workflow.WORK_ITEM_STATES.ACCEPTED; break;
                case 'REJECT_REANALYSIS': newStatus = workflow.WORK_ITEM_STATES.REANALYSIS_REQUIRED; break;
                case 'WAIVE': newStatus = workflow.WORK_ITEM_STATES.WAIVED; break;
            }

            try { assertReviewable(item, newStatus); }
            catch (error) { errors.push({ workItemId, code: error.code }); continue; }

            const history = typeof item.history === 'string' ? JSON.parse(item.history) : (item.history || []);
            history.push({
                status: newStatus,
                decision: verdict,
                reason: reason || null,
                reviewedBy: user.username,
                timestamp: now,
                action: 'REVIEWED',
                ...(verdict === 'REJECT_REANALYSIS' ? { submissionId: item.submissionId } : {})
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
                updates.submissionId = null;
            }
            if (verdict === 'WAIVE') {
                updates.waiveReason = reason;
            }


            const analysisName = await getAnalysisName(item.analysis);
            operations.push(tx => tx.auditLog.create({
                data: {
                    id: crypto.randomUUID(),
                    entity: 'WORKITEM',
                    entityId: workItemId,
                    action: verdict === 'REJECT_REANALYSIS' ? 'REANALYSIS_REQUESTED' : 'REVIEW_DECISION_MADE',
                    details: `${user.username} ${verdict.toLowerCase()}ed ${analysisName}`,
                    performedBy: user.username,
                    timestamp: now,
                    sampleId: String(submission.sampleId)
                }
            }));

            operations.push(tx => tx.reviewDecision.create({
                data: {
                    id: `rd-sub-${workItemId}-${Date.now()}`,
                    sampleId: String(submission.sampleId),
                    workItemId,
                    submissionItemId: submission.id,
                    decision: verdict === 'ACCEPT' ? 'ACCEPT' : (verdict === 'REJECT_REANALYSIS' ? 'RETURN' : 'WAIVE'),
                    reason: reason || null,
                    reviewerId: user.id || user.username,
                    reviewerName: user.username,
                    authorization: user.role,
                    policyVersion: 'v1',
                    createdAt: now
                }
            }));

            try {
                await commitReview(prisma, item, newStatus, user, updates, async tx => {
                    for (const operation of operations) await operation(tx);
                    if (newStatus === workflow.WORK_ITEM_STATES.ACCEPTED && workflow.CLOSURE_TASK_ANALYSES.includes(item.analysis)) {
                        const { transitionSample } = require('../services/sampleStateService');
                        await transitionSample(item.sampleId, workflow.CLOSURE_TASK_SAMPLE_STATES[item.analysis], user,
                            'Sample closed via submission review', {}, tx).catch(error => {
                            console.warn('[reviewSubmission] Warning: sample closure transition failed:', error.message);
                        });
                    }
                    if (verdict === 'REJECT_REANALYSIS') await invalidateReturnedResults(tx, item, user, reason);
                }, id);
                results.push({ workItemId, status: newStatus, decision: verdict });
            } catch (error) {
                if (!['ITEM_NOT_SUBMITTED', 'ITEM_NOT_IN_SUBMISSION'].includes(error.code)) throw error;
                errors.push({ workItemId, code: error.code });
            }
        }

        if (!results.length) return res.status(409).json({ error: 'No work items were eligible for review.', code: 'ITEM_NOT_SUBMITTED', results, errors });
        await reconcileSubmission(prisma, id, user, results, errors);
        res.json({ success: true, results, errors });

    } catch (error) {
        console.error('[reviewSubmission] Error:', error);
        res.status(error.statusCode || 500).json({ error: error.statusCode ? error.message : 'Failed to review submission', ...(error.code && { code: error.code }) });
    }
};

exports.getReanalysisRequests = async (req, res) => {
    const user = req.user;

    try {
        const where = {
            status: workflow.WORK_ITEM_STATES.REANALYSIS_REQUIRED
        };

        if (user.role === 'LAB_TECHNICIAN') {
            where.assignedTo = user.username;
        } else if (user.role === 'LAB_MANAGER' && user.labId) {
            where.sample = { labId: user.labId };
        } else if (user.role === 'SUPER_ADMIN') {
            // Super Admin can view all reanalysis items
        } else {
            return res.status(403).json({ error: 'Access restricted to technicians, managers, and administrators' });
        }

        const items = await prisma.workItem.findMany({
            where
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
