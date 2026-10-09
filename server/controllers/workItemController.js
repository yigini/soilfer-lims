const crypto = require('crypto');
const { assertReviewable, commitReview, reconcileSubmission } = require('../services/reviewCommitService');
const { createReviewDecision,inReviewTransaction } = require('../services/reviewAttemptService');
const { hasPermission } = require('../config/roles');
const { invalidateReturnedResults } = require('../services/reportResultGovernance');
const { normalizeAnalysisCodes } = require('../services/analysisCodesService');

const prisma = require('../prisma');
const analysisService = require('../services/analysisService');
const workflow = require('../workflowContract');
const { createNotification } = require('./notificationController');
const { getAnalysisName } = require('../services/analysisService');
const { getDisplayName } = require('./messageController');
const wsServer = require('../wsServer');
const stateRules = require('../services/workflowStateRules');
const { transitionWorkItem } = require('../services/workItemStateService');

// Helper to get effective analysis list for a sample
const getEffectiveAnalyses = (sample) => {
    return typeof sample.requiredAnalyses === 'string' ? JSON.parse(sample.requiredAnalyses) : (sample.requiredAnalyses || []);
};


/**
 * Generate Work Items for a Sample (Internal Hook)
 * Called when Sample -> LAB_ID_ASSIGNED or ACCEPTED
 */
exports.generateWorkItemsForSample = async (sample, tx, actor = 'system:intake-work-generation') => {
    const service = require('../services/intakeWorkItemService');
    return tx ? service.generate(tx, sample, undefined, actor) : prisma.$transaction(client => service.generate(client, sample, undefined, actor));
};

exports.reconcileWorkItemsForSample = require('../services/workItemReconciliationService').reconcileWorkItemsForSample;

// --- API ENDPOINTS ---

exports.getWorkItems = async (req, res) => {
    const user = req.user;
    const { status, assignedTo, analysis, labId, sampleId, page = 1, limit = 50 } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    try {
        // Use Scope Guard for Lab Isolation (Phase 1 Refactor)
        const scopeGuard = require('../utils/scopeGuard');

        // Start with lab-scoped query
        let where = scopeGuard.buildScopedWhere(user, {}, {
            entityType: 'WorkItem',
            labField: 'labId',
            altLabField: 'assignedLab'
        });

        // Role-specific additional filters
        if (user.role === 'LAB_TECHNICIAN') {
            // Technicians ONLY see their assigned work
            where.assignedTo = user.username;
        }
        // Managers see all work items in their lab (handled by Scope Guard above)

        // 2. Query Filters
        if (status) where.status = status;
        if (assignedTo) where.assignedTo = assignedTo;
        if (analysis) where.analysis = analysis;
        if (sampleId) where.sampleId = String(sampleId);
        if (labId) {
            if (!where.AND) where.AND = [];
            where.AND.push({
                OR: [
                    { labId: String(labId) },
                    { assignedLab: String(labId) }
                ]
            });
        }

        const [items, total] = await Promise.all([
            prisma.workItem.findMany({
                where: where,
                skip,
                take: limitNum,
                include: {
                    sample: {
                        select: {
                            id: true,
                            labId: true,
                            originalId: true,
                            projectCode: true
                        }
                    }
                },
                orderBy: { createdAt: 'desc' }
            }),
            prisma.workItem.count({ where: where })
        ]);

        // Parse history JSON and enrich with sample metadata
        const enrichedItems = items.map(i => ({
            ...i,
            sampleLabId: i.sample?.labId || null,
            originalId: i.sample?.originalId || null,
            projectCode: i.sample?.projectCode || null,
            history: typeof i.history === 'string' ? JSON.parse(i.history) : (i.history || [])
        }));

        const pagination = {
            total,
            page: pageNum,
            limit: limitNum,
            totalPages: Math.ceil(total / limitNum)
        };

        res.json({
            data: enrichedItems,
            meta: pagination,
            pagination
        });
    } catch (error) {
        console.error('[getWorkItems] Error:', error);
        res.status(500).json({ error: 'Failed to fetch work items' });
    }
};

exports.assignWork = async (req, res) => {
    const { workItemIds, assignee, priority, dueDate } = req.body;
    const user = req.user;

    try {
        if (!hasPermission(user, 'ASSIGN_WORK')) {
            return res.status(403).json({ error: 'Only Managers can assign work.' });
        }

        if (!workItemIds || !Array.isArray(workItemIds) || workItemIds.length === 0) {
            return res.status(400).json({ error: 'workItemIds array is required' });
        }
        if (!assignee) {
            return res.status(400).json({ error: 'assignee username is required' });
        }

        const assignmentEligibilityService = require('../services/assignmentEligibilityService');

        const dbItems = await prisma.workItem.findMany({
            where: { id: { in: workItemIds } }
        });

        if (dbItems.length === 0) {
            return res.status(404).json({ error: 'No work items found' });
        }

        // Fetch samples to validate status and laboratory ownership
        const sampleIds = [...new Set(dbItems.map(i => i.sampleId).filter(Boolean))];
        const samples = await prisma.sample.findMany({
            where: { id: { in: sampleIds } }
        });
        const sampleMap = {};
        samples.forEach(s => sampleMap[s.id] = s);

        let validatedTechUser = null;

        // SD-02: Isolation belongs to the sample, not the actor.
        // A super admin may act across laboratories; they must not be able to create a cross-laboratory assignment.
        for (const item of dbItems) {
            const sample = sampleMap[item.sampleId];
            const owningLab = sample ? (sample.assignedLab || sample.labId) : (item.assignedLab || item.labId);

            const validation = await assignmentEligibilityService.validateAssignmentTarget({
                actor: user,
                assigneeUsername: assignee,
                owningLab
            });

            if (!validation.valid) {
                const status = validation.statusCode || 400;
                const errorStr = validation.code === 'CROSS_LAB_ASSIGNMENT_DENIED' ? validation.error : (validation.code || validation.error);
                return res.status(status).json({
                    error: errorStr,
                    code: validation.code,
                    message: validation.error
                });
            }

            validatedTechUser = validation.assignee;

            if (user.role === 'LAB_MANAGER' && user.labId !== owningLab) {
                return res.status(403).json({
                    error: `Work item belongs to different lab scope (Req: ${user.labId}, Has: ${owningLab})`
                });
            }
        }

        const techUser = validatedTechUser;

        let assignedCount = 0;
        let errors = [];
        const now = new Date();

        // Fetch all work items for each sample to check prerequisites
        const workflowEngine = require('../utils/workflowEngine');
        const sampleWorkItemsCache = {};

        for (const item of dbItems) {
            const sample = sampleMap[item.sampleId];
            if (!sample) {
                errors.push({ id: item.id, error: 'Sample not found' });
                continue;
            }

            if (item.status === 'ACCEPTED') {
                errors.push({ id: item.id, error: `Item is already ACCEPTED. Reject/Re-open it first to reassign.` });
                continue;
            }

            // NOTE: Managers can ALWAYS assign/plan work. 
            // Blocking only happens when a technician tries to START the work (IN_PROGRESS).
            // This prevents workflow rigidity while allowing managers to triage.

            // MUTUAL EXCLUSION: Archiving vs Disposal
            if (['ARCHIVING', 'DISPOSAL'].includes(item.analysis)) {
                if (!sampleWorkItemsCache[item.sampleId]) {
                    sampleWorkItemsCache[item.sampleId] = await prisma.workItem.findMany({
                        where: { sampleId: item.sampleId }
                    });
                }
                const otherAnalysis = item.analysis === 'ARCHIVING' ? 'DISPOSAL' : 'ARCHIVING';
                const otherItem = sampleWorkItemsCache[item.sampleId].find(wi => wi.analysis === otherAnalysis);

                if (otherItem && otherItem.assignedTo) {
                    errors.push({ id: item.id, error: `Cannot assign ${item.analysis} while ${otherAnalysis} is already assigned.` });
                    continue;
                }
            }

            const history = typeof item.history === 'string' ? JSON.parse(item.history) : (item.history || []);
            history.push({
                status: workflow.WORK_ITEM_STATES.ASSIGNED,
                assignedTo: assignee,
                assignedBy: user.username,
                timestamp: now,
                action: 'ASSIGNED'
            });

            const analysis = await getAnalysisName(item.analysis);
            try {
                await transitionWorkItem(item.id, workflow.WORK_ITEM_STATES.ASSIGNED, user,
                    item.status === 'ON_HOLD' ? req.body.reason : `Assigned to ${assignee}`, {
                    assignedTo: assignee,
                    assignedBy: user.username,
                    assignedAt: now,
                    priority: priority || item.priority || 'NORMAL',
                    dueDate: dueDate ? new Date(dueDate) : (item.dueDate || null),
                    history: JSON.stringify(history)
                }, null, { expected: { status: item.status, version: item.version }, audit: {
                    action: 'WORKITEM_ASSIGNED', details: `${user.username} assigned ${analysis} to ${assignee}` } });
            } catch (error) {
                if (!error.statusCode) throw error;
                errors.push({ id: item.id, error: error.message, code: error.code, statusCode: error.statusCode });
                continue;
            }

            // Send notification (bell) to assignee
            await createNotification(
                techUser.id,
                'INFO',
                `New Assignment: ${analysis}`,
                `${getDisplayName(user)} assigned you "${analysis}" for sample ${item.labId || item.sampleId}.`,
                `/samples/${item.sampleId}`
            );

            // Send internal message to assignee
            await prisma.message.create({
                data: {
                    id: `msg-assign-${item.id}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                    senderId: user.id,
                    recipientId: techUser.id,
                    subject: `📋 New Work Assigned: ${analysis}`,
                    body: `You have been assigned a new analysis task.\n\n**Analysis:** ${analysis}\n**Sample:** ${item.labId || item.sampleId}\n**Priority:** ${priority || item.priority || 'NORMAL'}\n${dueDate ? `**Due:** ${new Date(dueDate).toLocaleDateString()}\n` : ''}\nPlease complete this task in a timely manner.\n\nAssigned by: ${getDisplayName(user)}`,
                    status: 'SENT',
                    folderSender: 'SENT',
                    folderRecipient: 'INBOX',
                    isRead: false,
                    createdAt: now,
                    updatedAt: now
                }
            });

            assignedCount++;
        }

        // Cleanup: If any items were in broken state but now assigned, it's fixed.
        // We also run a global cleanup for this specific sample just in case.
        // Cleanup: If any items were in broken state but now assigned, it's fixed.
        // We also run a global cleanup for this specific sample just in case.
        if (assignedCount > 0) {
            const orphaned = await prisma.workItem.findMany({
                where: {
                    sampleId: dbItems[0].sampleId,
                    status: 'ASSIGNED',
                    assignedTo: null
                }
            });
            for (const item of orphaned) await transitionWorkItem(item.id, 'NOT_ASSIGNED', user, 'Repair assignment without an assignee', {},
                null, { expected: { status: item.status, version: item.version }, audit: { action: 'WORKITEM_ASSIGNMENT_REPAIRED' } });
        }
        if (assignedCount === 0 && dbItems.length > 0) {
            return res.status(errors[0]?.statusCode || 400).json({
                success: false,
                error: errors[0]?.error || 'Failed to assign work items due to business rules.',
                ...(errors[0]?.code && { code: errors[0].code }),
                errors
            });
        }

        // Real-time push: broadcast WORKITEM_UPDATE to target receiving lab(s)
        if (assignedCount > 0) {
            const affectedSampleIds = [...new Set(dbItems.map(i => i.sampleId).filter(Boolean))];
            const targetLabIds = [...new Set(dbItems.map(i => {
                const s = sampleMap[i.sampleId];
                return (s ? (s.assignedLab || s.labId) : (i.assignedLab || i.labId)) || user.labId;
            }).filter(Boolean))];

            for (const targetLabId of targetLabIds) {
                try {
                    wsServer.broadcastToLab(targetLabId, 'WORKITEM_UPDATE', {
                        sampleIds: affectedSampleIds,
                        updatedBy: user.username,
                        action: 'ASSIGNED',
                        count: assignedCount
                    });
                } catch (wsErr) {
                    console.error('[WS] Failed to broadcast WORKITEM_UPDATE (assign):', wsErr);
                }
            }
        }

        res.json({ success: true, assigned: assignedCount, errors: errors.length > 0 ? errors : undefined });
    } catch (error) {
        console.error('[assignWork] Error:', error);
        res.status(error.statusCode || 500).json({ error: error.statusCode ? error.message : 'Failed to assign work',
            ...(error.code && { code: error.code }) });
    }
};

exports.assignSingle = async (req, res) => {
    const { id } = req.params;
    const { technicianUserId, priority, dueDate } = req.body;

    req.body = {
        workItemIds: [id],
        assignee: technicianUserId,
        priority,
        dueDate
    };
    return await exports.assignWork(req, res);
};

/**
 * REASSIGN WORK ITEM
 * POST /api/work/:id/reassign
 * Body: { technicianUserId, reason }
 */
exports.reassignWork = async (req, res) => {
    const { id } = req.params;
    const { technicianUserId, reason } = req.body;
    const user = req.user;

    try {
        if (!hasPermission(user, 'ASSIGN_WORK')) {
            return res.status(403).json({ error: 'Only Managers can reassign work.' });
        }

        if (!technicianUserId) return res.status(400).json({ error: 'technicianUserId is required' });
        stateRules.requireReason(reason);

        const item = await prisma.workItem.findUnique({ where: { id } });
        if (!item) return res.status(404).json({ error: 'Work item not found' });

        const sample = item.sampleId ? await prisma.sample.findUnique({ where: { id: item.sampleId } }) : null;
        const owningLab = sample ? (sample.assignedLab || sample.labId) : (item.assignedLab || item.labId);

        const assignmentEligibilityService = require('../services/assignmentEligibilityService');
        const validation = await assignmentEligibilityService.validateAssignmentTarget({
            actor: user,
            assigneeUsername: technicianUserId,
            owningLab
        });

        if (!validation.valid) {
            const status = validation.statusCode || 400;
            const errorStr = validation.code === 'CROSS_LAB_ASSIGNMENT_DENIED' ? validation.error : (validation.code || validation.error);
            return res.status(status).json({
                error: errorStr,
                code: validation.code,
                message: validation.error
            });
        }

        const techUser = validation.assignee;

        stateRules.assertScope(user, sample);

        const previousAssignee = item.assignedTo;
        const now = new Date();
        const history = stateRules.requireHistory(item.history);

        history.push({
            status: item.status,
            assignedTo: technicianUserId,
            assignedBy: user.username,
            previousAssignee: previousAssignee,
            reason: reason,
            timestamp: now,
            action: 'REASSIGNED'
        });

        const analysis = await getAnalysisName(item.analysis);
        const updated = await stateRules.inTransaction(prisma, async tx => {
            const current = await tx.workItem.findUnique({ where: { id } });
            if (!current || current.status !== item.status || current.version !== item.version) {
                throw new stateRules.TransitionError('Work item changed. Reload before retrying.', 409, 'WORKITEM_STATE_CHANGED');
            }
            const currentSample = await tx.sample.findUnique({ where: { id: current.sampleId } });
            const eligible = await assignmentEligibilityService.validateAssignmentTarget({ actor: user,
                assigneeUsername: technicianUserId, owningLab: currentSample?.assignedLab || currentSample?.labId }, tx);
            if (!eligible.valid) throw new stateRules.TransitionError(eligible.error, eligible.statusCode || 400, eligible.code);
            return transitionWorkItem(id, item.status, user, reason, {
                assignedTo: technicianUserId,
                assignedBy: user.username,
                assignedAt: now,
                history: JSON.stringify(history)
            }, tx, { expected: item, audit: {
                action: 'WORKITEM_REASSIGNED',
                details: `${user.username} reassigned ${analysis} from ${previousAssignee || 'Unassigned'} to ${technicianUserId}. Reason: ${reason}`
            } });
        });

        // Notify new assignee with bell and message
        await createNotification(
            techUser.id,
            'INFO',
            `📋 Reassigned: ${analysis}`,
            `${getDisplayName(user)} reassigned "${analysis}" for sample ${item.labId || item.sampleId} to you.`,
            `/samples/${item.sampleId}`
        );

        await prisma.message.create({
            data: {
                id: `msg-reassign-${id}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                senderId: user.id,
                recipientId: techUser.id,
                subject: `📋 Work Reassigned: ${analysis}`,
                body: `A work item has been reassigned to you.\n\n**Analysis:** ${analysis}\n**Sample:** ${item.labId || item.sampleId}\n**Reason:** ${reason}\n${previousAssignee ? `**Previously assigned to:** ${previousAssignee}\n` : ''}\nPlease complete this task in a timely manner.\n\nReassigned by: ${getDisplayName(user)}`,
                status: 'SENT',
                folderSender: 'SENT',
                folderRecipient: 'INBOX',
                isRead: false,
                createdAt: now,
                updatedAt: now
            }
        });

        // Real-time push: broadcast WORKITEM_UPDATE to receiving laboratory
        try {
            wsServer.broadcastToLab(owningLab, 'WORKITEM_UPDATE', {
                sampleIds: [item.sampleId],
                updatedBy: user.username,
                action: 'REASSIGNED',
                count: 1
            });
        } catch (wsErr) {
            console.error('[WS] Failed to broadcast WORKITEM_UPDATE (reassign):', wsErr);
        }

        res.json({ success: true, workItem: updated, previousAssignee, newAssignee: technicianUserId });
    } catch (error) {
        const mapped = stateRules.mapStateError(error);
        if (mapped.statusCode) return res.status(mapped.statusCode).json({ code: mapped.code, error: mapped.message });
        console.error('[reassignWork] Error:', error);
        res.status(500).json({ error: 'Failed to reassign work' });
    }
};

exports.updateWorkItemStatus = async (req, res) => {
    const { id } = req.params;
    const { status, result, version, equipmentId } = req.body;
    const user = req.user;

    try {
        const item = await prisma.workItem.findUnique({ where: { id } });
        if (!item) {
            return res.status(404).json({
                error: `Work item not found (ID: ${id}). This analysis task may have been deleted or the sample intake has not been accepted yet. Please refresh the page or contact your lab manager.`,
                code: 'WORK_ITEM_NOT_FOUND'
            });
        }

        if (user.role === 'LAB_TECHNICIAN' && item.assignedTo !== user.username) {
            return res.status(403).json({
                error: `You are not assigned to this task. It is currently assigned to ${item.assignedTo || 'no one'}. Ask your Lab Manager to reassign it to you if needed.`,
                code: 'NOT_ASSIGNED'
            });
        }

        const { NON_ANALYTICAL } = require('../services/workEligibility');
        const isOperationalStatusItem = NON_ANALYTICAL.includes((item.analysis || '').toUpperCase()) ||
            workflow.CLOSURE_TASK_ANALYSES.includes(item.analysis);
        if (Object.prototype.hasOwnProperty.call(req.body, 'result') &&
            !isOperationalStatusItem) {
            return res.status(410).json({
                error: 'Enter analytical results in the workbench.', code: 'USE_WORKBENCH',
                destination: `/workbench?workItemId=${encodeURIComponent(item.id)}`
            });
        }

        // SD-09: Validate work-item status writes against WORK_ITEM_TRANSITIONS (409 Conflict)
        if (status && status !== item.status) {
            if (!workflow.isValidWorkItemTransition(item.status, status)) {
                return res.status(409).json({
                    error: `Illegal status transition: ${item.status} → ${status}`,
                    code: 'ILLEGAL_TRANSITION'
                });
            }
        }

        if (item.status === 'CANCELLED') {
            return res.status(409).json({ code: 'WORKITEM_REACTIVATION_ACTION_REQUIRED', error: 'Cancelled work requires legal intake re-acceptance.' });
        }
        const sealedStates = ['SUBMITTED', 'ACCEPTED', 'WAIVED'];
        if (sealedStates.includes(item.status)) {
            return res.status(403).json({ error: `Item is SEALED (${item.status}). You cannot edit it.` });
        }

        const sample = await prisma.sample.findUnique({ where: { id: String(item.sampleId) } });
        if (!sample) return res.status(404).json({ error: 'Parent Sample not found' });
        stateRules.assertScope(user, sample);

        if (status === workflow.WORK_ITEM_STATES.IN_PROGRESS || status === workflow.WORK_ITEM_STATES.COMPLETED) {
            const readiness = await require('../services/workbenchReadinessService').evaluateExecutionReadiness(prisma, { ...item, sample }, user);
            if (!readiness.isReady) {
                const missingPreparation = !readiness.blockers.includes('GATE_STATE_MISMATCH') &&
                    readiness.blockers.includes('PREPARATION_PREREQUISITE_BLOCKED');
                return res.status(missingPreparation ? 412 : 409).json({ error: missingPreparation
                    ? 'Sample preparation has not been completed' : readiness.reasons.join(' '),
                code: readiness.blockers.includes('GATE_STATE_MISMATCH') ? 'GATE_STATE_MISMATCH'
                    : readiness.blockers.includes('ANALYSIS_PREREQUISITE_BLOCKED') ? 'ANALYSIS_PREREQUISITE_BLOCKED'
                        : readiness.blockers[0] || 'EXECUTION_BLOCKED' });
            }
        }

        if (sample.status === 'ON_HOLD') {
            return res.status(409).json({ error: 'Sample is ON_HOLD.' });
        }

        // Equipment Validation (Phase 5/7)
        const equipLabId = sample.assignedLab || sample.labId;
        if (equipmentId) {
            const asset = await prisma.equipmentAsset.findUnique({
                where: { id: equipmentId },
                include: { qualification: true }
            });
            if (!asset) return res.status(404).json({ error: 'Selected equipment not found' });
            if (asset.status !== 'IN_SERVICE') {
                return res.status(400).json({ error: `Selected equipment (${asset.name}) is ${asset.status.replace(/_/g, ' ')}.` });
            }
            // Compute readiness inline (matches getReadiness in equipmentController)
            const q = asset.qualification;
            if (asset.status === 'OUT_OF_SERVICE' || asset.status === 'DECOMMISSIONED' ||
                (q && (q.calibrationStatus === 'OVERDUE' || q.verificationStatus === 'OVERDUE'))) {
                return res.status(400).json({ error: `Selected equipment (${asset.name}) is BLOCKED (Calibration/Maintenance Overdue).` });
            }

            const mapping = await prisma.equipmentMethodEligibility.findFirst({
                where: { labId: equipLabId, analysisCode: item.analysis }
            });
            if (mapping && mapping.eligibleEquipmentIds) {
                const eligibleIds = JSON.parse(mapping.eligibleEquipmentIds);
                if (eligibleIds.length > 0 && !eligibleIds.includes(equipmentId)) {
                    return res.status(400).json({ error: `Equipment ${asset.name} is not validated for method ${item.analysis}.` });
                }
            }
        } else {
            const mapping = await prisma.equipmentMethodEligibility.findFirst({
                where: { labId: equipLabId, analysisCode: item.analysis }
            });
            if (mapping?.isRequired && !item.equipmentId && (status === workflow.WORK_ITEM_STATES.COMPLETED || status === workflow.WORK_ITEM_STATES.IN_PROGRESS)) {
                if (item.category !== 'Operational Gates' && item.category !== 'Post-Analytical') {
                    return res.status(400).json({ error: `A validated instrument is required for method ${item.analysis}.` });
                }
            }
        }

        const isOperationalGate = ['DRYING', 'PREPARATION'].includes((item.analysis || '').toUpperCase());
        if (isOperationalGate && status === workflow.WORK_ITEM_STATES.COMPLETED) {
            let checklist = req.body.checklist;
            if (!checklist && typeof result === 'string') {
                try {
                    const parsed = JSON.parse(result);
                    if (Array.isArray(parsed.checklist)) checklist = parsed.checklist;
                } catch (e) {}
            }

            if (!checklist || !Array.isArray(checklist) || checklist.length !== 3 || !checklist.every(Boolean)) {
                return res.status(422).json({
                    error: `Operational gate '${item.analysis}' requires checklist confirmation with all procedural steps verified. Complete this in Workbench.`,
                    code: 'CHECKLIST_REQUIRED',
                    destination: `/workbench?workItemId=${item.id}`
                });
            }

            const OperationalConfirmationService = require('../services/operationalConfirmationService');
            try {
                const outcome = await OperationalConfirmationService.confirmOperation({
                    actor: user,
                    workItemId: id,
                    checklist,
                    observations: req.body.observations,
                    idempotencyKey: req.body.idempotencyKey
                });
                return res.json({
                    success: true,
                    updates: outcome.workItem,
                    receipt: outcome.receipt
                });
            } catch (opErr) {
                return res.status(opErr.status || 400).json({ error: opErr.message, code: opErr.code });
            }
        }

        if (!isOperationalGate && status === workflow.WORK_ITEM_STATES.COMPLETED) {
            if (result === 'Done' || result === null || result === undefined || String(result).trim() === '') {
                return res.status(422).json({
                    error: `Cannot complete analytical work item '${item.analysis}' with bare 'Done' or missing evidence. Record scientific results in Workbench.`,
                    code: 'INVALID_RESULT_EVIDENCE',
                    destination: `/workbench?workItemId=${item.id}`
                });
            }
        }

        if ((status === workflow.WORK_ITEM_STATES.COMPLETED || result !== undefined) && result !== null && result !== '') {
            const methods = await analysisService.loadAnalyses();
            const method = methods.find(m => m.code === item.analysis);
            let rules = method?.validation || {};
            if (typeof rules === 'string') {
                try { rules = JSON.parse(rules); } catch (e) { rules = {}; }
            }
            if (['PH_H2O', 'PH_CACL2', 'PH_KCL', 'pH'].includes(item.analysis)) {
                const policy = require('../services/policyService');
                const context = { analysisCode: item.analysis, methodologyId: item.methodologyId || null };
                rules = { ...rules, type: 'numeric',
                    min: await policy.get(item.assignedLab || item.labId, 'results.phMin', context),
                    max: await policy.get(item.assignedLab || item.labId, 'results.phMax', context) };
            }

            const isNumeric = rules.type === 'numeric' || rules.type === 'number' || rules.min !== undefined || rules.max !== undefined;
            if (isNumeric) {
                const numVal = typeof result === 'number' ? result : Number(result);
                if (isNaN(numVal) || typeof result === 'boolean' || (typeof result === 'string' && (result.trim() === '' || isNaN(Number(result))))) {
                    return res.status(400).json({ error: `Result must be a number for ${item.analysis}.` });
                }
                if (rules.min !== undefined && numVal < rules.min) {
                    return res.status(400).json({ error: `Result ${numVal} is below minimum ${rules.min} for ${item.analysis}.` });
                }
                if (rules.max !== undefined && numVal > rules.max) {
                    return res.status(400).json({ error: `Result ${numVal} is above maximum ${rules.max} for ${item.analysis}.` });
                }
            }
        }

        const now = new Date();
        const history = typeof item.history === 'string' ? JSON.parse(item.history) : (item.history || []);
        history.push({
            status,
            result: result !== undefined ? 'Result Updated' : null,
            changedBy: user.username,
            timestamp: now
        });

        const updateData = {
            status,
            equipmentId: equipmentId || item.equipmentId,
            version: { increment: 1 },
            history: JSON.stringify(history),
            updatedAt: now
        };

        if (status === workflow.WORK_ITEM_STATES.COMPLETED) {
            updateData.completedAt = now;
        }

        const nextStatus = status || item.status;
        delete updateData.status;
        const reasonRequired = nextStatus === 'ON_HOLD' || item.status === 'ON_HOLD' ||
            item.status === 'COMPLETED' && nextStatus === 'IN_PROGRESS';
        const updatedItem = await stateRules.inTransaction(prisma, async tx => {
            let updated = await transitionWorkItem(id, nextStatus, user,
                reasonRequired ? req.body.reason : req.body.reason || 'Work item updated via API', updateData, tx,
                { expected: { status: item.status, version: version !== undefined ? version : item.version },
                    conflictCode: 'VERSION_CONFLICT', audit: {
                        action: item.status !== nextStatus ? 'STATUS_CHANGE' : 'WORKITEM_UPDATED',
                        details: `${user.username} updated ${item.analysis} to ${nextStatus}${equipmentId ? ` using equipment ${equipmentId}` : ''}`
                    } });
            if (result !== undefined) updated = await require('../services/resultWriteService').writeNonMeasurementSummary(tx, updated,
                { kind: 'operational-status', text: result === null ? null : String(result), actor: user });
            if (equipmentId) await tx.workItemEquipmentUse.create({
                data: {
                    id: `use-${id}-${Date.now()}`,
                    labId: item.assignedLab || sample.assignedLab || user.labId,
                    workItemId: id,
                    sampleId: item.sampleId,
                    equipmentId,
                    usedAt: now,
                    notes: `Used during ${item.analysis} result entry`
                }
            });
            return updated;
        });
        const analysisName = await getAnalysisName(item.analysis);

        // Real-time push: broadcast WORKITEM_UPDATE to all connected users
        try {
            const targetLab = item.assignedLab || item.labId || user.labId;
            wsServer.broadcastToLab(targetLab, 'WORKITEM_UPDATE', {
                sampleIds: [String(item.sampleId)],
                updatedBy: user.username,
                action: status === 'COMPLETED' ? 'COMPLETED' : 'STATUS_CHANGE',
                count: 1
            });
        } catch (wsErr) {
            console.error('[WS] Failed to broadcast WORKITEM_UPDATE (status):', wsErr);
        }

        const finalResult = typeof result === 'number' ? result : updatedItem.result;
        res.json({
            success: true,
            updates: {
                ...updatedItem,
                result: finalResult,
                history: typeof updatedItem.history === 'string' ? JSON.parse(updatedItem.history) : (updatedItem.history || [])
            }
        });
    } catch (error) {
        if (error.code === 'P2025') {
            return res.status(409).json({ error: 'Version conflict or item not found', code: 'VERSION_CONFLICT' });
        }
        console.error('[updateWorkItemStatus] Error:', error);
        const mapped = stateRules.mapStateError(error);
        res.status(mapped.statusCode || 500).json({ error: mapped.statusCode ? mapped.message : 'Failed to update status',
            ...(mapped.code && { code: mapped.code }) });
    }
};

/**
 * SD-05: Dedicated startWork endpoint
 * POST /api/work/:id/start
 */
exports.startWork = async (req, res) => {
    req.body = { ...req.body, status: workflow.WORK_ITEM_STATES.IN_PROGRESS };
    return await exports.updateWorkItemStatus(req, res);
};

exports.reviewWorkItem = async (req, res) => {
    const { id } = req.params;
    let { status, note, decision, reason } = req.body;
    if (!status && decision) {
        status = decision === 'ACCEPT' ? 'ACCEPTED' : (['REJECT', 'RETURN'].includes(decision) ? 'REPEAT_REQUIRED' : (['WAIVE', 'OMIT'].includes(decision) ? 'WAIVED' : decision));
    }
    status = workflow.normalizeWorkItemState(status);
    const user = req.user;

    try {
        if (!hasPermission(user, 'APPROVE_RESULTS')) {
            return res.status(403).json({ error: 'Insufficient permissions (Manager Only).' });
        }

        if ((note != null && typeof note !== 'string') || (reason != null && typeof reason !== 'string')) {
            return res.status(400).json({ error: 'Review note and reason must be text.', code: 'INVALID_REVIEW_REASON' });
        }
        const effectiveReason = (note || reason || '').trim();

        // SD-10: Require mandatory reason on rejection
        if ([workflow.WORK_ITEM_STATES.REPEAT_REQUIRED, workflow.WORK_ITEM_STATES.WAIVED].includes(status)) {
            if (!effectiveReason) {
                return res.status(400).json({ error: status === workflow.WORK_ITEM_STATES.WAIVED ? 'A reason is required when waiving work' : 'A reason is required when rejecting work for reanalysis', code: 'REVIEW_REASON_REQUIRED' });
            }
        }

        const item = await prisma.workItem.findUnique({
            where: { id },
            include: { sample: true }
        });
        if (!item) {
            return res.status(404).json({
                error: `Work item not found (ID: ${id}). The task may have been deleted or reassigned. Please refresh the sample details page.`,
                code: 'WORK_ITEM_NOT_FOUND'
            });
        }

        // Lab scope check (S01/S02)
        const scopeGuard = require('../utils/scopeGuard');
        if (!scopeGuard.canAccessEntity(user, item.sample || item, { labField: 'labId', altLabField: 'assignedLab' })) {
            return res.status(403).json({
                error: 'Access denied: Work item outside your lab scope.',
                code: 'ACCESS_DENIED_LAB'
            });
        }

        const allowedReviewStatuses = [
            workflow.WORK_ITEM_STATES.ACCEPTED,
            workflow.WORK_ITEM_STATES.REPEAT_REQUIRED,
            workflow.WORK_ITEM_STATES.WAIVED
        ];
        if (!allowedReviewStatuses.includes(status)) {
            return res.status(400).json({ error: `Invalid review status. Use: ${allowedReviewStatuses.join(', ')}` });
        }

        const isClosureTask = workflow.CLOSURE_TASK_ANALYSES.includes(item.analysis);
        assertReviewable(item, status);
        if (status === workflow.WORK_ITEM_STATES.ACCEPTED) {
            if (!isClosureTask) {
                // Evidence check: require valid result, linked scan, or Result row
                const hasWorkItemResult = item.result !== null && item.result !== undefined && String(item.result).trim() !== '';
                let hasEvidence = hasWorkItemResult;
                if (!hasEvidence) {
                    const linkedScan = await prisma.spectralData.findFirst({
                        where: {
                            OR: [
                                { workItemId: item.id },
                                { sampleId: String(item.sampleId), status: { in: ['SUBMITTED', 'VALIDATED', 'PENDING'] } }
                            ]
                        }
                    });
                    if (linkedScan) hasEvidence = true;
                }
                if (!hasEvidence) {
                    const resultRow = await prisma.result.findFirst({
                        where: { sampleId: String(item.sampleId), param: item.analysis, isCurrent: true }
                    });
                    if (resultRow) hasEvidence = true;
                }
                if (!hasEvidence) {
                    return res.status(422).json({
                        error: `Cannot approve work item '${item.id}' (${item.analysis}): No valid result or scan evidence recorded.`,
                        code: 'MISSING_EVIDENCE'
                    });
                }

                await require('../services/qcGateService').requireAcceptance([item], req.body.qcAcknowledgement, prisma);
            }
        }

        const now = new Date();
        const history = typeof item.history === 'string' ? JSON.parse(item.history) : (item.history || []);
        history.push({
            status,
            note: effectiveReason || note || 'Manager Review',
            ...(status === workflow.WORK_ITEM_STATES.REPEAT_REQUIRED ? { submissionId: item.submissionId, reason: effectiveReason } : {}),
            changedBy: user.username,
            timestamp: now
        });

        const updateData = {
            status,
            history: JSON.stringify(history)
        };
        if (status === workflow.WORK_ITEM_STATES.REPEAT_REQUIRED) {
            updateData.reanalysisReason = effectiveReason;
            updateData.submissionId = null;
        }

        const operations = [];
        const notifications = [];

        // Check if analysis is spectral-related
        const analysisUpper = (item.analysis || '').toUpperCase();
        const isSpectralAnalysis = ['NIR', 'MIR', 'SPECTRAL', 'VIS-NIR', 'VISNIR', 'SCAN'].some(k => analysisUpper.includes(k));

        if (status === workflow.WORK_ITEM_STATES.ACCEPTED) {
            if (workflow.CLOSURE_TASK_ANALYSES.includes(item.analysis)) {
                operations.push(async tx => {
                    const { transitionSample } = require('../services/sampleStateService');
                    await transitionSample(item.sampleId, workflow.CLOSURE_TASK_SAMPLE_STATES[item.analysis], user,
                        'Sample closed via work item review', {}, tx);
                });
            }

            // Sync spectralData status to APPROVED when spectral work item is accepted
            // S05: Only sync exact linked scan or exact attempt, never entire lab or sample
            if (isSpectralAnalysis) {
                operations.push(tx => tx.spectralData.updateMany({
                    where: {
                        OR: [
                            { workItemId: item.id },
                            { sampleId: String(item.sampleId), modality: item.analysis }
                        ],
                        status: { in: ['PENDING', 'VALIDATED', 'SUBMITTED'] }
                    },
                    data: {
                        status: 'APPROVED',
                        reviewedBy: user.username,
                        reviewedAt: now
                    }
                }));
            }
        } else if (status === workflow.WORK_ITEM_STATES.REPEAT_REQUIRED) {
            if (['DRYING', 'PREPARATION'].includes(item.analysis)) {
                operations.push(tx => require('../services/operationalGateStateService').resetReviewedGate(item, user, effectiveReason, tx));
            }

            // Sync spectralData status to REJECTED when spectral work is rejected
            // S05: Only sync exact linked scan or exact attempt
            if (isSpectralAnalysis) {
                operations.push(tx => tx.spectralData.updateMany({
                    where: {
                        OR: [
                            { workItemId: item.id },
                            { sampleId: String(item.sampleId), modality: item.analysis }
                        ],
                        status: { in: ['PENDING', 'VALIDATED', 'SUBMITTED'] }
                    },
                    data: {
                        status: 'REJECTED',
                        reviewedBy: user.username,
                        reviewedAt: now,
                        reviewNotes: effectiveReason || note || 'Reanalysis required'
                    }
                }));
            }
        }

        const decisionVerdict = status === workflow.WORK_ITEM_STATES.ACCEPTED
            ? 'ACCEPT'
            : (status === workflow.WORK_ITEM_STATES.REPEAT_REQUIRED ? 'RETURN' : 'OMIT');

        operations.push(tx => createReviewDecision(tx, {
                id: `rd-${id}-${Date.now()}`,
                sampleId: String(item.sampleId),
                workItemId: id,
                attemptId:req.body.attemptId,
                reasonCode:req.body.reasonCode ?? null,
                submissionItemId: item.submissionId || null,
                decision: decisionVerdict,
                reason: decisionVerdict==='ACCEPT' && req.body.reportedValueSelection?.reason?.trim() || effectiveReason || note || 'Manager Review',
                reviewerId: user.id || user.username,
                reviewerName: user.username,
                authorization: user.role,
                policyVersion: 'v1',
                createdAt: now
        },user));



        // Send message to technician if assigned
        if (item.assignedTo) {
            // Get sample labId for better context
            const sample = await prisma.sample.findUnique({
                where: { id: String(item.sampleId) },
                select: { labId: true }
            });
            const labId = sample?.labId || item.sampleId;

            // Lookup recipient user ID (assignedTo is username)
            const recipient = await prisma.user.findFirst({
                where: { username: item.assignedTo },
                select: { id: true }
            });

            const isApproved = status === workflow.WORK_ITEM_STATES.ACCEPTED;
            const isWaived = status === workflow.WORK_ITEM_STATES.WAIVED;
            const isRejected = status === workflow.WORK_ITEM_STATES.REPEAT_REQUIRED;

            let subject, body;
            if (isApproved) {
                subject = `✓ Work Approved: ${item.analysis} - ${labId}`;
                body = `Your work on "${item.analysis}" for sample ${labId} has been approved by ${user.username}.${note ? `\n\nNote: ${note}` : ''}\n\nGreat work!`;
            } else if (isWaived) {
                subject = `⊘ Work Waived: ${item.analysis} - ${labId}`;
                body = `The analysis "${item.analysis}" for sample ${labId} has been waived by ${user.username}.${note ? `\n\nReason: ${note}` : ''}\n\nNo further action required for this item.`;
            } else if (isRejected) {
                subject = `✗ Reanalysis Required: ${item.analysis} - ${labId}`;
                body = `Your work on "${item.analysis}" for sample ${labId} requires reanalysis.${note ? `\n\nManager's feedback: ${note}` : ''}\n\nPlease review and resubmit.`;
            }

            // Only create message if we have a valid recipient ID and sender ID
            const senderId = user.id || (await prisma.user.findFirst({ where: { username: user.username }, select: { id: true } }))?.id;
            if (subject && body && recipient?.id && senderId) {
                operations.push(tx => tx.message.create({
                    data: {
                        id: `msg-review-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                        senderId: senderId,
                        recipientId: recipient.id,
                        subject,
                        body,
                        status: 'SENT',
                        folderSender: 'SENT',
                        folderRecipient: 'INBOX',
                        isRead: false,
                        createdAt: now,
                        updatedAt: now
                    }
                }));

                // Also create bell notification
                const notifType = isApproved ? 'SUCCESS' : (isRejected ? 'WARNING' : 'INFO');
                const notifTitle = isApproved ? `✓ Work Approved` : (isRejected ? `✗ Reanalysis Required` : `⊘ Work Waived`);
                notifications.push(() => createNotification(
                    recipient.id,
                    notifType,
                    notifTitle,
                    `${item.analysis} for sample ${labId}`,
                    `/samples/${item.sampleId}`
                ));
            }
        }

        const updated = await commitReview(prisma, item, status, user, updateData, async tx => {
            const rows = [];
            for (const operation of operations) rows.push(await operation(tx));
            if (status === workflow.WORK_ITEM_STATES.REPEAT_REQUIRED) {
                await invalidateReturnedResults(tx, item, user, effectiveReason);
            }
            return rows;
        }, undefined, { qcAcknowledgement: req.body.qcAcknowledgement, reasonCode:req.body.reasonCode, note:effectiveReason, attemptId:req.body.attemptId,
            reportedValueSelection:req.body.reportedValueSelection });
        const result = { workItemId: id, status, decision: decisionVerdict };
        if (item.submissionId) await reconcileSubmission(prisma, item.submissionId, user, [result]);
        for (const notify of notifications) await notify();

        // Real-time push: broadcast WORKITEM_UPDATE to all connected users
        try {
            const targetLab = item.assignedLab || item.labId || user.labId;
            wsServer.broadcastToLab(targetLab, 'WORKITEM_UPDATE', {
                sampleIds: [String(item.sampleId)],
                updatedBy: user.username,
                action: 'REVIEWED',
                count: 1
            });
        } catch (wsErr) {
            console.error('[WS] Failed to broadcast WORKITEM_UPDATE (review):', wsErr);
        }

        res.json({
            success: true,
            item: {
                ...updated,
                history: typeof updated.history === 'string' ? JSON.parse(updated.history) : (updated.history || [])
            }
        });
    } catch (error) {
        console.error('[reviewWorkItem] Error:', error);
        res.status(error.statusCode || 500).json({ error: error.statusCode ? error.message : 'Failed to review work item', ...(error.code && { code: error.code }), ...(error.details || {}) });
    }
};

exports.reviewWorkItemsBulk = async (req, res) => {
    const { workItemIds, note, reason } = req.body;
    const status = workflow.normalizeWorkItemState(req.body.status);
    const user = req.user;

    try {
        if (!hasPermission(user, 'APPROVE_RESULTS')) {
            return res.status(403).json({ error: 'Insufficient permissions (Manager Only).' });
        }

        if ((note != null && typeof note !== 'string') || (reason != null && typeof reason !== 'string')) {
            return res.status(400).json({ error: 'Review note and reason must be text.', code: 'INVALID_REVIEW_REASON' });
        }
        const effectiveReason = (note || reason || '').trim();
        if ([workflow.WORK_ITEM_STATES.REPEAT_REQUIRED, workflow.WORK_ITEM_STATES.WAIVED].includes(status)) {
            if (!effectiveReason) {
                return res.status(400).json({ error: status === workflow.WORK_ITEM_STATES.WAIVED ? 'A reason is required when waiving work' : 'A reason is required when rejecting work for reanalysis', code: 'REVIEW_REASON_REQUIRED' });
            }
        }

        const allowedReviewStatuses = [
            workflow.WORK_ITEM_STATES.ACCEPTED,
            workflow.WORK_ITEM_STATES.REPEAT_REQUIRED,
            workflow.WORK_ITEM_STATES.WAIVED
        ];
        if (!allowedReviewStatuses.includes(status)) {
            return res.status(400).json({ error: `Invalid review status. Use: ${allowedReviewStatuses.join(', ')}` });
        }

        if (!workItemIds || !Array.isArray(workItemIds) || workItemIds.length === 0) {
            return res.status(400).json({ error: 'workItemIds array is required' });
        }

        const items = await prisma.workItem.findMany({
            where: { id: { in: workItemIds } },
            include: { sample: true }
        });

        if (items.length !== workItemIds.length) {
            const foundIds = new Set(items.map(i => i.id));
            const missingIds = workItemIds.filter(id => !foundIds.has(id));
            return res.status(404).json({
                error: `Some work items were not found: ${missingIds.join(', ')}`,
                code: 'WORK_ITEM_NOT_FOUND',
                missingIds
            });
        }

        // Lab scope check (S01/S02)
        const scopeGuard = require('../utils/scopeGuard');
        {
            const outOfScopeItems = items.filter(item => !scopeGuard.canAccessEntity(user, item.sample || item, { labField: 'labId', altLabField: 'assignedLab' }));
            if (outOfScopeItems.length > 0) {
                return res.status(403).json({
                    error: `Access denied: ${outOfScopeItems.length} work item(s) outside your lab scope.`,
                    code: 'ACCESS_DENIED_LAB',
                    outOfScopeIds: outOfScopeItems.map(i => i.id)
                });
            }
        }

        if (status === workflow.WORK_ITEM_STATES.ACCEPTED) {
            // Reject closure tasks from bulk analytical review
            const closureItems = items.filter(item => workflow.CLOSURE_TASK_ANALYSES.includes(item.analysis));
            if (closureItems.length > 0) {
                return res.status(400).json({
                    error: `Bulk approval cannot include custody closure tasks (${closureItems.map(i => i.id).join(', ')}). Execute closure via custody operations.`,
                    code: 'CLOSURE_TASK_NOT_REVIEWABLE',
                    closureItemIds: closureItems.map(i => i.id)
                });
            }

            // Check evidence for each item
            const missingEvidence = [];
            for (const item of items) {
                if (item.status !== workflow.WORK_ITEM_STATES.SUBMITTED) continue;
                const hasWorkItemResult = item.result !== null && item.result !== undefined && String(item.result).trim() !== '';
                let hasEvidence = hasWorkItemResult;
                if (!hasEvidence) {
                    const linkedScan = await prisma.spectralData.findFirst({
                        where: {
                            OR: [
                                { workItemId: item.id },
                                { sampleId: String(item.sampleId), status: { in: ['SUBMITTED', 'VALIDATED', 'PENDING'] } }
                            ]
                        }
                    });
                    if (linkedScan) hasEvidence = true;
                }
                if (!hasEvidence) {
                    const resultRow = await prisma.result.findFirst({
                        where: { sampleId: String(item.sampleId), param: item.analysis, isCurrent: true }
                    });
                    if (resultRow) hasEvidence = true;
                }
                if (!hasEvidence) {
                    missingEvidence.push(item.id);
                }
            }
            if (missingEvidence.length > 0) {
                return res.status(422).json({
                    error: `Cannot approve work items without valid result or scan evidence: ${missingEvidence.join(', ')}`,
                    code: 'MISSING_EVIDENCE',
                    missingEvidenceIds: missingEvidence
                });
            }

            await require('../services/qcGateService').requireAcceptance(items.filter(item => item.status === 'SUBMITTED'), req.body.qcAcknowledgement, prisma);
        }

        const now = new Date();
        const results = [];
        const errors = [];
        const pendingNotifications=[];
        const decisionForStatus=status==='ACCEPTED'?'ACCEPT':status==='REPEAT_REQUIRED'?'RETURN':'OMIT';
        await inReviewTransaction(prisma,items.filter(item=>item.status==='SUBMITTED').map(item=>({
            workItemId:item.id,decision:decisionForStatus,attemptId:req.body.attemptIds?.[item.id],
            reasonCode:req.body.reasonCodes?.[item.id] || req.body.reasonCode,note:effectiveReason
        })),user,async reviewDb=>{
        for (const item of items) {
            try { assertReviewable(item, status); }
            catch (error) {
                if (error.code !== 'ITEM_NOT_SUBMITTED') throw error;
                errors.push({ workItemId: item.id, code: error.code }); continue;
            }
            const operations = [];
            const notifications = [];
            const history = typeof item.history === 'string' ? JSON.parse(item.history) : (item.history || []);
            history.push({
                status,
                note: effectiveReason || note || 'Bulk Manager Review',
                ...(status === workflow.WORK_ITEM_STATES.REPEAT_REQUIRED ? { submissionId: item.submissionId, reason: effectiveReason } : {}),
                changedBy: user.username,
                timestamp: now
            });

            const updateData = {
                status,
                history: JSON.stringify(history)
            };
            if (status === workflow.WORK_ITEM_STATES.REPEAT_REQUIRED) {
                updateData.reanalysisReason = effectiveReason;
                updateData.submissionId = null;
            }

            if (status === workflow.WORK_ITEM_STATES.ACCEPTED) {
                // Sync spectralData status when spectral work item is approved
                // S05: Only sync exact linked scan or exact attempt
                const bulkAnalysisUpper = (item.analysis || '').toUpperCase();
                const bulkIsSpectral = ['NIR', 'MIR', 'SPECTRAL', 'VIS-NIR', 'VISNIR', 'SCAN'].some(k => bulkAnalysisUpper.includes(k));
                if (bulkIsSpectral) {
                    operations.push(tx => tx.spectralData.updateMany({
                        where: {
                            OR: [
                                { workItemId: item.id },
                                { sampleId: String(item.sampleId), modality: item.analysis }
                            ],
                            status: { in: ['PENDING', 'VALIDATED', 'SUBMITTED'] }
                        },
                        data: {
                            status: 'APPROVED',
                            reviewedBy: user.username,
                            reviewedAt: now
                        }
                    }));
                }
            }



            const decisionVerdict = status === workflow.WORK_ITEM_STATES.ACCEPTED
                ? 'ACCEPT'
                : (status === workflow.WORK_ITEM_STATES.REPEAT_REQUIRED ? 'RETURN' : 'OMIT');

            operations.push(tx => createReviewDecision(tx, {
                    id: `rd-bulk-${item.id}-${Date.now()}`,
                    sampleId: String(item.sampleId),
                    workItemId: item.id,
                    attemptId:req.body.attemptIds?.[item.id],
                    reasonCode:req.body.reasonCodes?.[item.id] || req.body.reasonCode || null,
                    submissionItemId: item.submissionId || null,
                    decision: decisionVerdict,
                    reason: decisionVerdict==='ACCEPT' && req.body.reportedValueSelections?.[item.id]?.reason?.trim() || effectiveReason || note || 'Bulk Manager Review',
                    reviewerId: user.id || user.username,
                    reviewerName: user.username,
                    authorization: user.role,
                    policyVersion: 'v1',
                    createdAt: now
            },user));

            // Send message to technician if assigned
            if (item.assignedTo) {
                // Lookup recipient user ID (assignedTo is username, not ID)
                const recipient = await reviewDb.user.findFirst({
                    where: { username: item.assignedTo },
                    select: { id: true }
                });

                const isApproved = status === workflow.WORK_ITEM_STATES.ACCEPTED;
                const isWaived = status === workflow.WORK_ITEM_STATES.WAIVED;
                const isRejected = status === workflow.WORK_ITEM_STATES.REPEAT_REQUIRED;

                let subject, body;
                if (isApproved) {
                    subject = `✓ Work Approved: ${item.analysis}`;
                    body = `Your work on "${item.analysis}" for sample ${item.labId || item.sampleId} has been approved.${note ? `\n\nNote: ${note}` : ''}`;
                } else if (isWaived) {
                    subject = `⊘ Work Waived: ${item.analysis}`;
                    body = `The analysis "${item.analysis}" for sample ${item.labId || item.sampleId} has been waived.${note ? `\n\nReason: ${note}` : ''}`;
                } else if (isRejected) {
                    subject = `✗ Reanalysis Required: ${item.analysis}`;
                    body = `Your work on "${item.analysis}" for sample ${item.labId || item.sampleId} requires reanalysis.${note ? `\n\nFeedback: ${note}` : ''}`;
                }

                // Only create message if we have a valid recipient ID and sender ID
                const senderId = user.id || (await reviewDb.user.findFirst({ where: { username: user.username }, select: { id: true } }))?.id;
                if (subject && body && recipient?.id && senderId) {
                    operations.push(tx => tx.message.create({
                        data: {
                            id: `msg-bulk-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                            senderId: senderId,
                            recipientId: recipient.id,
                            subject,
                            body,
                            status: 'SENT',
                            folderSender: 'SENT',
                            folderRecipient: 'INBOX',
                            isRead: false,
                            createdAt: now,
                            updatedAt: now
                        }
                    }));

                    // Also create bell notification
                    const notifType = isApproved ? 'SUCCESS' : (isRejected ? 'WARNING' : 'INFO');
                    const notifTitle = isApproved ? `✓ Work Approved` : (isRejected ? `✗ Reanalysis Required` : `⊘ Work Waived`);
                    notifications.push(() => createNotification(
                        recipient.id,
                        notifType,
                        notifTitle,
                        `${item.analysis} for sample ${item.labId || item.sampleId}`,
                        `/samples/${item.sampleId}`
                    ));
                }
            }
            try {
                await commitReview(reviewDb, item, status, user, updateData, async tx => {
                    const rows = [];
                    for (const operation of operations) rows.push(await operation(tx));
                    if (status === workflow.WORK_ITEM_STATES.REPEAT_REQUIRED) {
                        if (['DRYING', 'PREPARATION'].includes(item.analysis)) {
                            await require('../services/operationalGateStateService').resetReviewedGate(item, user, effectiveReason, tx);
                        }
                        await invalidateReturnedResults(tx, item, user, effectiveReason);
                    }
                    return rows;
                }, undefined, { qcAcknowledgement: req.body.qcAcknowledgement,
                    reasonCode:req.body.reasonCodes?.[item.id] || req.body.reasonCode,note:effectiveReason,attemptId:req.body.attemptIds?.[item.id],
                    reportedValueSelection:req.body.reportedValueSelections?.[item.id] });
                results.push({ workItemId: item.id, status, decision: decisionVerdict });
                pendingNotifications.push(...notifications);
            } catch (error) {
                if (error.code !== 'ITEM_NOT_SUBMITTED' && !error.code?.startsWith('REPORTED_VALUE_') && error.code !== 'RESULT_POLICY_UNRESOLVED') throw error;
                errors.push({ workItemId: item.id, code: error.code, ...(error.details || {}) });
            }
        }
        });
        if (!results.length) return res.status(409).json({ error: 'No work items were eligible for review.', code: 'ITEM_NOT_SUBMITTED', results, errors });
        const committedIds = new Set(results.map(row => row.workItemId));
        const committedItems = items.filter(item => committedIds.has(item.id));
        for (const subId of [...new Set(committedItems.map(item => item.submissionId).filter(Boolean))]) {
            await reconcileSubmission(prisma, subId, user, results, errors);
        }
        for(const notify of pendingNotifications)await notify();

        // Real-time push: broadcast WORKITEM_UPDATE to all connected users
        if (results.length > 0) {
            const affectedSampleIds = [...new Set(committedItems.map(i => i.sampleId).filter(Boolean))];
            try {
                wsServer.broadcastToLab(user.labId, 'WORKITEM_UPDATE', {
                    sampleIds: affectedSampleIds,
                    updatedBy: user.username,
                    action: 'BULK_REVIEWED',
                    reviewStatus: status,
                    count: results.length
                });
            } catch (wsErr) {
                console.error('[WS] Failed to broadcast WORKITEM_UPDATE (bulk review):', wsErr);
            }
        }

        res.json({ success: true, count: results.length, results, errors });
    } catch (error) {
        console.error('[reviewWorkItemsBulk] Error:', error);
        res.status(error.statusCode || 500).json({ error: error.statusCode ? error.message : 'Failed to review work items', ...(error.code && { code: error.code }), ...(error.details || {}) });
    }
};

exports.getEligibleAssignees = async (req, res) => {
    try {
        const { labId, analysis } = req.query;
        const assignmentService = require('../services/assignmentEligibilityService');
        const result = await assignmentService.getEligibleAssignees(req.user, { labId, analysis });
        res.json(result);
    } catch (err) {
        const status = err.statusCode || err.status || 500;
        res.status(status).json({ error: err.code || 'FETCH_ASSIGNEES_FAILED', message: err.message });
    }
};

exports.normalizeAnalysisCodes = normalizeAnalysisCodes;

module.exports = exports;
