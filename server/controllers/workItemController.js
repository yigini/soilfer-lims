const prisma = require('../prisma');
const analysisService = require('../services/analysisService');
const workflow = require('../workflowContract');
const { createNotification } = require('./notificationController');
const { getAnalysisName, getAnalysisCategory } = require('../services/analysisService');
const { broadcastToLab, broadcastToUser } = require('../wsServer');

// Helper to get effective analysis list for a sample
const getEffectiveAnalyses = (sample) => {
    return typeof sample.requiredAnalyses === 'string' ? JSON.parse(sample.requiredAnalyses) : (sample.requiredAnalyses || []);
};


/**
 * Generate Work Items for a Sample (Internal Hook)
 * Called when Sample -> LAB_ID_ASSIGNED or ACCEPTED
 */
exports.generateWorkItemsForSample = async (sample) => {
    const { id, labId } = sample;
    const requiredAnalyses = getEffectiveAnalyses(sample);
    const workItems = [];

    // 1. Create OPERATIONAL GATE Work Items (Drying, Prep)
    const opsGates = [
        { code: 'DRYING', name: 'Drying' },
        { code: 'PREPARATION', name: 'Preparation (Milling/Grinding)' }
    ];

    for (const gate of opsGates) {
        const existing = await prisma.workItem.findFirst({
            where: { sampleId: String(id), analysis: gate.code }
        });
        if (existing) continue;

        const wiId = `WI-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        const history = [{
            status: workflow.WORK_ITEM_STATES.NOT_ASSIGNED,
            timestamp: new Date().toISOString(),
            note: 'Work Item Generated'
        }];

        const wi = await prisma.workItem.create({
            data: {
                id: wiId,
                sampleId: String(id),
                labId: labId,
                assignedLab: sample.assignedLab,
                analysis: gate.code,
                category: 'Operational Gates',
                status: workflow.WORK_ITEM_STATES.NOT_ASSIGNED,
                assignedTo: null,
                priority: 'NORMAL',
                history: JSON.stringify(history)
            }
        });
        workItems.push(wi);

        await prisma.auditLog.create({
            data: {
                id: `audit-wi-gen-${Date.now()}-${Math.random()}`,
                entity: 'SAMPLE',
                entityId: String(id),
                action: 'WORKITEM_GENERATED',
                details: `System generated gate: ${gate.name}`,
                performedBy: 'SYSTEM',
                performedByName: 'System',
                timestamp: new Date(),
                analysisCode: gate.code
            }
        });
    }

    // 2. Create ANALYTICAL Work Items (with compound parameter expansion)
    const COMPOUND_ANALYSIS_EXPANSION = {
        'pSA': ['SAND', 'CLAY', 'SILT'],
        'PSA': ['SAND', 'CLAY', 'SILT'],
        'TEXTURE': ['SAND', 'CLAY', 'SILT'],
        'Particle Size Analysis': ['SAND', 'CLAY', 'SILT'],
        'exchangeableBases': ['EXCH_CA', 'EXCH_MG', 'EXCH_K', 'EXCH_NA']
    };

    if (requiredAnalyses && Array.isArray(requiredAnalyses)) {
        // Flatten any compound analyses into discrete physical/chemical determinations
        const expandedAnalyses = [];
        for (const code of requiredAnalyses) {
            if (COMPOUND_ANALYSIS_EXPANSION[code]) {
                expandedAnalyses.push(...COMPOUND_ANALYSIS_EXPANSION[code]);
            } else {
                expandedAnalyses.push(code);
            }
        }

        const uniqueAnalyses = [...new Set(expandedAnalyses)];

        // WP-25: Drive workflow work item ordering from catalogue executionOrder
        const catalogueRecords = await prisma.analysis.findMany({
            where: { code: { in: uniqueAnalyses } },
            select: { code: true, executionOrder: true }
        });
        const orderMap = {};
        catalogueRecords.forEach(a => { orderMap[a.code] = a.executionOrder ?? 100; });
        uniqueAnalyses.sort((a, b) => (orderMap[a] ?? 100) - (orderMap[b] ?? 100));

        for (const analysisCode of uniqueAnalyses) {
            const existing = await prisma.workItem.findFirst({
                where: { sampleId: String(id), analysis: analysisCode }
            });
            if (existing) continue;

            const name = await getAnalysisName(analysisCode);
            const category = await getAnalysisCategory(analysisCode);
            const wiId = `WI-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
            const history = [{
                status: workflow.WORK_ITEM_STATES.NOT_ASSIGNED,
                timestamp: new Date().toISOString(),
                note: 'Work Item Generated'
            }];

            // WP-20: Resolve methodology for this lab and analysis
            let defaultMethodId = null;
            const targetLab = sample.assignedLab || sample.labId;
            if (targetLab) {
                const labDefault = await prisma.labMethodDefault.findFirst({
                    where: { labId: targetLab, analysisCode }
                });
                if (labDefault) {
                    defaultMethodId = labDefault.methodologyId;
                }
            }
            if (!defaultMethodId) {
                const globalDefault = await prisma.methodology.findFirst({
                    where: { analysisCode, isDefault: true }
                });
                if (globalDefault) {
                    defaultMethodId = globalDefault.id;
                }
            }

            const wi = await prisma.workItem.create({
                data: {
                    id: wiId,
                    sampleId: String(id),
                    labId: labId,
                    assignedLab: sample.assignedLab,
                    analysis: analysisCode,
                    category: category,
                    status: workflow.WORK_ITEM_STATES.NOT_ASSIGNED,
                    assignedTo: null,
                    priority: 'NORMAL',
                    methodologyId: defaultMethodId,
                    history: JSON.stringify(history)
                }
            });
            workItems.push(wi);

            await prisma.auditLog.create({
                data: {
                    id: `audit-wi-gen-${Date.now()}-${Math.random()}`,
                    entity: 'SAMPLE',
                    entityId: String(id),
                    action: 'WORKITEM_GENERATED',
                    details: `System generated analysis: ${name}`,
                    performedBy: 'SYSTEM',
                    performedByName: 'System',
                    timestamp: new Date(),
                    analysisCode: analysisCode
                }
            });
        }
    }
    return workItems;
};

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
        if (labId) where.labId = labId;

        const [items, total] = await Promise.all([
            prisma.workItem.findMany({
                where,
                skip,
                take: limitNum,
                orderBy: { createdAt: 'desc' }
            }),
            prisma.workItem.count({ where })
        ]);

        // Parse history JSON
        const enrichedItems = items.map(i => ({
            ...i,
            history: typeof i.history === 'string' ? JSON.parse(i.history) : (i.history || [])
        }));

        res.json({
            data: enrichedItems,
            meta: {
                total,
                page: pageNum,
                limit: limitNum,
                totalPages: Math.ceil(total / limitNum)
            }
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
        if (!['LAB_MANAGER', 'SUPER_ADMIN', 'MASTER_USER'].includes(user.role)) {
            return res.status(403).json({ error: 'Only Managers can assign work.' });
        }

        if (!workItemIds || !Array.isArray(workItemIds) || workItemIds.length === 0) {
            return res.status(400).json({ error: 'workItemIds array is required' });
        }
        if (!assignee) {
            return res.status(400).json({ error: 'assignee username is required' });
        }

        const techUser = await prisma.user.findUnique({
            where: { username: assignee }
        });

        if (!techUser) {
            return res.status(404).json({ error: `Technician '${assignee}' not found` });
        }
        if (techUser.role !== 'LAB_TECHNICIAN') {
            return res.status(400).json({ error: `User '${assignee}' is not a LAB_TECHNICIAN` });
        }

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

        // SD-02: Isolation belongs to the sample, not the actor.
        // One unconditional rule for every role:
        // A super admin may act across laboratories; they must not be able to create a cross-laboratory assignment.
        for (const item of dbItems) {
            const sample = sampleMap[item.sampleId];
            const owningLab = sample ? (sample.assignedLab || sample.labId) : (item.assignedLab || item.labId);
            if (!owningLab || techUser.labId !== owningLab) {
                return res.status(403).json({
                    error: `Cannot assign to technician in different lab. Technician ${techUser.username} (${techUser.labId}) is not in ${owningLab}`
                });
            }
            if (user.role === 'LAB_MANAGER' && user.labId !== owningLab) {
                return res.status(403).json({
                    error: `Work item belongs to different lab scope (Req: ${user.labId}, Has: ${owningLab})`
                });
            }
        }

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

            // CHECK: Block Assignment for Draft/Info-Only states
            if (sample.status === 'Draft Intake' || sample.status === 'DRAFT' || sample.status === 'EXPECTED') {
                errors.push({
                    id: item.id,
                    error: `Cannot assign work. Sample is in '${sample.status}'. Please ACCEPT the sample first.`
                });
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

            await prisma.workItem.update({
                where: { id: item.id },
                data: {
                    status: workflow.WORK_ITEM_STATES.ASSIGNED,
                    assignedTo: assignee,
                    assignedBy: user.username,
                    assignedAt: now,
                    priority: priority || item.priority || 'NORMAL',
                    dueDate: dueDate ? new Date(dueDate) : (item.dueDate || null),
                    history: JSON.stringify(history)
                }
            });

            const analysis = await getAnalysisName(item.analysis);
            await prisma.auditLog.create({
                data: {
                    id: `audit-assign-${item.id}-${Date.now()}`,
                    entity: 'WORKITEM',
                    entityId: item.id,
                    action: 'WORKITEM_ASSIGNED',
                    details: `${user.username} assigned ${analysis} to ${assignee}`,
                    performedBy: user.username,
                    timestamp: now,
                    sampleId: item.sampleId,
                    analysisCode: item.analysis
                }
            });

            // Send notification (bell) to assignee
            await createNotification(
                techUser.id,
                'INFO',
                `New Assignment: ${analysis}`,
                `${user.username} assigned you "${analysis}" for sample ${item.labId || item.sampleId}.`,
                `/samples/${item.sampleId}`
            );

            // Send internal message to assignee
            await prisma.message.create({
                data: {
                    id: `msg-assign-${item.id}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                    senderId: user.id,
                    recipientId: techUser.id,
                    subject: `📋 New Work Assigned: ${analysis}`,
                    body: `You have been assigned a new analysis task.\n\n**Analysis:** ${analysis}\n**Sample:** ${item.labId || item.sampleId}\n**Priority:** ${priority || item.priority || 'NORMAL'}\n${dueDate ? `**Due:** ${new Date(dueDate).toLocaleDateString()}\n` : ''}\nPlease complete this task in a timely manner.\n\nAssigned by: ${user.username}`,
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
        if (dbItems.length > 0) {
            await prisma.workItem.updateMany({
                where: {
                    sampleId: dbItems[0].sampleId,
                    status: 'ASSIGNED',
                    assignedTo: null
                },
                data: { status: 'NOT_ASSIGNED' }
            });
        }
        if (assignedCount === 0 && dbItems.length > 0) {
            return res.status(400).json({
                success: false,
                error: errors[0]?.error || 'Failed to assign work items due to business rules.',
                errors
            });
        }

        // Real-time push: broadcast WORKITEM_UPDATE to all connected users
        if (assignedCount > 0) {
            const affectedSampleIds = [...new Set(dbItems.map(i => i.sampleId).filter(Boolean))];
            try {
                broadcastToLab(user.labId,'WORKITEM_UPDATE', {
                    sampleIds: affectedSampleIds,
                    updatedBy: user.username,
                    action: 'ASSIGNED',
                    count: assignedCount
                });
            } catch (wsErr) {
                console.error('[WS] Failed to broadcast WORKITEM_UPDATE (assign):', wsErr);
            }
        }

        res.json({ success: true, assigned: assignedCount, errors: errors.length > 0 ? errors : undefined });
    } catch (error) {
        console.error('[assignWork] Error:', error);
        res.status(500).json({ error: 'Failed to assign work' });
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
        if (!['LAB_MANAGER', 'SUPER_ADMIN', 'MASTER_USER'].includes(user.role)) {
            return res.status(403).json({ error: 'Only Managers can reassign work.' });
        }

        if (!technicianUserId) return res.status(400).json({ error: 'technicianUserId is required' });
        if (!reason) return res.status(400).json({ error: 'reason is required for reassignment' });

        const item = await prisma.workItem.findUnique({ where: { id } });
        if (!item) return res.status(404).json({ error: 'Work item not found' });

        const techUser = await prisma.user.findUnique({ where: { username: technicianUserId } });
        if (!techUser) return res.status(404).json({ error: `Technician '${technicianUserId}' not found` });
        if (techUser.role !== 'LAB_TECHNICIAN') return res.status(400).json({ error: `User '${technicianUserId}' is not a LAB_TECHNICIAN` });

        // SD-02: Isolation belongs to the sample, not the actor.
        const sample = item.sampleId ? await prisma.sample.findUnique({ where: { id: item.sampleId } }) : null;
        const owningLab = sample ? (sample.assignedLab || sample.labId) : (item.assignedLab || item.labId);
        if (!owningLab || techUser.labId !== owningLab) {
            return res.status(403).json({
                error: `Cannot reassign to technician in different lab. Technician ${techUser.username} (${techUser.labId}) is not in ${owningLab}`
            });
        }

        if (user.role === 'LAB_MANAGER' && user.labId !== owningLab) {
            return res.status(403).json({ error: 'Work item outside your lab scope' });
        }

        const previousAssignee = item.assignedTo;
        const now = new Date();
        const history = typeof item.history === 'string' ? JSON.parse(item.history) : (item.history || []);

        history.push({
            status: item.status,
            assignedTo: technicianUserId,
            assignedBy: user.username,
            previousAssignee: previousAssignee,
            reason: reason,
            timestamp: now,
            action: 'REASSIGNED'
        });

        const updated = await prisma.workItem.update({
            where: { id },
            data: {
                assignedTo: technicianUserId,
                assignedBy: user.username,
                assignedAt: now,
                history: JSON.stringify(history)
            }
        });

        const analysis = await getAnalysisName(item.analysis);
        await prisma.auditLog.create({
            data: {
                id: `audit-reassign-${id}-${Date.now()}`,
                entity: 'WORKITEM',
                entityId: id,
                action: 'WORKITEM_REASSIGNED',
                details: `${user.username} reassigned ${analysis} from ${previousAssignee || 'Unassigned'} to ${technicianUserId}. Reason: ${reason}`,
                performedBy: user.username,
                timestamp: now,
                sampleId: item.sampleId,
                analysisCode: item.analysis,
                labId: owningLab,
                after: JSON.stringify({ assignedTo: technicianUserId, reason })
            }
        });

        // Notify new assignee with bell and message
        await createNotification(
            techUser.id,
            'INFO',
            `📋 Reassigned: ${analysis}`,
            `${user.username} reassigned "${analysis}" for sample ${item.labId || item.sampleId} to you.`,
            `/samples/${item.sampleId}`
        );

        await prisma.message.create({
            data: {
                id: `msg-reassign-${id}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                senderId: user.id,
                recipientId: techUser.id,
                subject: `📋 Work Reassigned: ${analysis}`,
                body: `A work item has been reassigned to you.\n\n**Analysis:** ${analysis}\n**Sample:** ${item.labId || item.sampleId}\n**Reason:** ${reason}\n${previousAssignee ? `**Previously assigned to:** ${previousAssignee}\n` : ''}\nPlease complete this task in a timely manner.\n\nReassigned by: ${user.username}`,
                status: 'SENT',
                folderSender: 'SENT',
                folderRecipient: 'INBOX',
                isRead: false,
                createdAt: now,
                updatedAt: now
            }
        });

        // Real-time push: broadcast WORKITEM_UPDATE
        try {
            broadcastToLab(user.labId,'WORKITEM_UPDATE', {
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

        const sealedStates = ['SUBMITTED', 'ACCEPTED', 'WAIVED'];
        if (sealedStates.includes(item.status)) {
            return res.status(403).json({ error: `Item is SEALED (${item.status}). You cannot edit it.` });
        }

        const sample = await prisma.sample.findUnique({ where: { id: String(item.sampleId) } });
        if (!sample) return res.status(404).json({ error: 'Parent Sample not found' });

        if (status === workflow.WORK_ITEM_STATES.IN_PROGRESS || status === workflow.WORK_ITEM_STATES.COMPLETED) {
            if (item.category !== 'Post-Analytical') {
                if (sample.dryingStatus === 'FAILED') {
                    return res.status(400).json({ error: 'Analysis locked: Drying FAILED.' });
                }

                if (item.analysis === 'DRYING') {
                    const allowedStates = ['ACCEPTED', 'PROCESSING', 'SUBMITTED_PARTIAL'];
                    if (!allowedStates.includes(sample.status)) {
                        return res.status(400).json({ error: `Cannot start DRYING. Sample status: ${sample.status}` });
                    }
                } else if (item.analysis === 'PREPARATION') {
                    if (sample.dryingStatus !== 'DONE') {
                        return res.status(400).json({ error: 'Analysis locked: Drying not completed.' });
                    }
                } else if (item.category !== 'Operational Gates') {
                    if (sample.dryingStatus !== 'DONE' || sample.preparationStatus !== 'DONE') {
                        return res.status(400).json({ error: 'Analysis locked: Drying/Preparation not completed.' });
                    }
                }
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

        if ((status === workflow.WORK_ITEM_STATES.COMPLETED || result !== undefined) && result !== null && result !== '') {
            const methods = await analysisService.loadAnalyses();
            const method = methods.find(m => m.code === item.analysis);
            let rules = method?.validation || {};
            if (typeof rules === 'string') {
                try { rules = JSON.parse(rules); } catch (e) { rules = {}; }
            }
            if (['PH_H2O', 'PH_CACL2', 'PH_KCL', 'pH'].includes(item.analysis)) {
                rules = { ...rules, type: 'numeric', min: 2, max: 14 };
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
            result: result !== undefined ? String(result) : item.result,
            equipmentId: equipmentId || item.equipmentId,
            version: { increment: 1 },
            history: JSON.stringify(history),
            updatedAt: now
        };

        if (status === workflow.WORK_ITEM_STATES.COMPLETED) {
            updateData.completedAt = now;
        }

        // Concurrency check using version
        const updatedItem = await prisma.workItem.update({
            where: { id, version: version !== undefined ? version : item.version },
            data: updateData
        });

        const analysisName = getAnalysisName(item.analysis);
        const operations = [];

        if (item.status !== status) {
            operations.push(prisma.auditLog.create({
                data: {
                    id: `audit-wi-stat-${id}-${Date.now()}`,
                    entity: 'WORKITEM',
                    entityId: id,
                    action: 'STATUS_CHANGE',
                    details: `${user.username} changed status to ${status}${equipmentId ? ` using equipment ${equipmentId}` : ''}`,
                    performedBy: user.username,
                    timestamp: now,
                    sampleId: String(item.sampleId),
                    analysisCode: item.analysis
                }
            }));
        }

        // Handle Equipment Usage Logging
        if (equipmentId) {
            operations.push(prisma.workItemEquipmentUse.create({
                data: {
                    id: `use-${id}-${Date.now()}`,
                    labId: item.labId || item.assignedLab,
                    workItemId: id,
                    sampleId: item.sampleId,
                    equipmentId,
                    usedAt: now,
                    notes: `Used during ${item.analysis} result entry`
                }
            }));
        }

        if (status === workflow.WORK_ITEM_STATES.COMPLETED) {
            if (item.analysis === 'DRYING') {
                operations.push(prisma.sample.update({
                    where: { id: String(item.sampleId) },
                    data: { dryingStatus: 'DONE' }
                }));
                // Auto-accept gates
                updateData.status = workflow.WORK_ITEM_STATES.ACCEPTED;
                updateData.history = JSON.stringify([...JSON.parse(updateData.history), {
                    status: workflow.WORK_ITEM_STATES.ACCEPTED,
                    note: 'Auto-accepted by System (Operational Gate)',
                    timestamp: now
                }]);
            } else if (item.analysis === 'PREPARATION') {
                operations.push(prisma.sample.update({
                    where: { id: String(item.sampleId) },
                    data: { preparationStatus: 'DONE' }
                }));
                // Auto-accept gates
                updateData.status = workflow.WORK_ITEM_STATES.ACCEPTED;
                updateData.history = JSON.stringify([...JSON.parse(updateData.history), {
                    status: workflow.WORK_ITEM_STATES.ACCEPTED,
                    note: 'Auto-accepted by System (Operational Gate)',
                    timestamp: now
                }]);
            }
        }

        if (operations.length > 0) {
            await prisma.$transaction(operations);
        }

        // Real-time push: broadcast WORKITEM_UPDATE to all connected users
        try {
            broadcastToLab(user.labId,'WORKITEM_UPDATE', {
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
        res.status(500).json({ error: 'Failed to update status' });
    }
};

exports.reviewWorkItem = async (req, res) => {
    const { id } = req.params;
    let { status, note, decision } = req.body;
    if (!status && decision) {
        status = decision === 'ACCEPT' ? 'ACCEPTED' : (decision === 'REJECT' ? 'REANALYSIS_REQUIRED' : decision);
    }
    const user = req.user;

    try {
        if (!['LAB_MANAGER', 'SUPER_ADMIN', 'MASTER_USER'].includes(user.role)) {
            return res.status(403).json({ error: 'Insufficient permissions (Manager Only).' });
        }

        const item = await prisma.workItem.findUnique({ where: { id } });
        if (!item) {
            return res.status(404).json({
                error: `Work item not found (ID: ${id}). The task may have been deleted or reassigned. Please refresh the sample details page.`,
                code: 'WORK_ITEM_NOT_FOUND'
            });
        }

        const allowedReviewStatuses = [
            workflow.WORK_ITEM_STATES.ACCEPTED,
            workflow.WORK_ITEM_STATES.REANALYSIS_REQUIRED,
            workflow.WORK_ITEM_STATES.WAIVED
        ];
        if (!allowedReviewStatuses.includes(status)) {
            return res.status(400).json({ error: `Invalid review status. Use: ${allowedReviewStatuses.join(', ')}` });
        }

        const now = new Date();
        const history = typeof item.history === 'string' ? JSON.parse(item.history) : (item.history || []);
        history.push({
            status,
            note: note || 'Manager Review',
            changedBy: user.username,
            timestamp: now
        });

        const updated = await prisma.workItem.update({
            where: { id },
            data: {
                status,
                history: JSON.stringify(history)
            }
        });

        const operations = [];

        // Check if analysis is spectral-related
        const analysisUpper = (item.analysis || '').toUpperCase();
        const isSpectralAnalysis = ['NIR', 'MIR', 'SPECTRAL', 'VIS-NIR', 'VISNIR', 'SCAN'].some(k => analysisUpper.includes(k));

        if (status === workflow.WORK_ITEM_STATES.ACCEPTED) {
            if (item.analysis === 'ARCHIVING' || item.analysis === 'ARCH' || item.analysis === 'Archive') {
                const { transitionSample } = require('../services/sampleStateService');
                await transitionSample(item.sampleId, 'ARCHIVED', user, 'Sample archived via work item review').catch(err => {
                    console.warn('[reviewItem] Warning: sample transition to ARCHIVED failed:', err.message);
                });
            } else if (item.analysis === 'DISPOSAL' || item.analysis === 'DISP' || item.analysis === 'Dispose') {
                const { transitionSample } = require('../services/sampleStateService');
                await transitionSample(item.sampleId, 'DISPOSED', user, 'Sample disposed via work item review').catch(err => {
                    console.warn('[reviewItem] Warning: sample transition to DISPOSED failed:', err.message);
                });
            }

            // Sync spectralData status to APPROVED when spectral work item is accepted
            if (isSpectralAnalysis) {
                const sample = await prisma.sample.findUnique({
                    where: { id: String(item.sampleId) },
                    select: { labId: true }
                });
                if (sample?.labId) {
                    operations.push(prisma.spectralData.updateMany({
                        where: {
                            labId: sample.labId,
                            status: { in: ['PENDING', 'VALIDATED'] }
                        },
                        data: {
                            status: 'APPROVED',
                            reviewedBy: user.username,
                            reviewedAt: now
                        }
                    }));
                }
            }
        } else if (status === workflow.WORK_ITEM_STATES.REANALYSIS_REQUIRED) {
            if (item.analysis === 'DRYING') {
                operations.push(prisma.sample.update({
                    where: { id: String(item.sampleId) },
                    data: { dryingStatus: 'PENDING' }
                }));
            } else if (item.analysis === 'PREPARATION') {
                operations.push(prisma.sample.update({
                    where: { id: String(item.sampleId) },
                    data: { preparationStatus: 'PENDING' }
                }));
            }

            // Sync spectralData status to REJECTED when spectral work is rejected
            if (isSpectralAnalysis) {
                const sample = await prisma.sample.findUnique({
                    where: { id: String(item.sampleId) },
                    select: { labId: true }
                });
                if (sample?.labId) {
                    operations.push(prisma.spectralData.updateMany({
                        where: {
                            labId: sample.labId,
                            status: { in: ['PENDING', 'VALIDATED'] }
                        },
                        data: {
                            status: 'REJECTED',
                            reviewedBy: user.username,
                            reviewedAt: now,
                            reviewNotes: note || 'Reanalysis required'
                        }
                    }));
                }
            }
        }

        operations.push(prisma.auditLog.create({
            data: {
                id: `audit-wi-rev-${id}-${Date.now()}`,
                entity: 'WORKITEM',
                entityId: id,
                action: 'REVIEW',
                details: `Work Item ${status} by ${user.username}`,
                performedBy: user.username,
                timestamp: now,
                sampleId: String(item.sampleId)
            }
        }));

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
            const isRejected = status === workflow.WORK_ITEM_STATES.REANALYSIS_REQUIRED;

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

            // Only create message if we have a valid recipient ID
            if (subject && body && recipient?.id) {
                operations.push(prisma.message.create({
                    data: {
                        id: `msg-review-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                        senderId: user.id,
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
                await createNotification(
                    recipient.id,
                    notifType,
                    notifTitle,
                    `${item.analysis} for sample ${labId}`,
                    `/samples/${item.sampleId}`
                );
            }
        }

        if (operations.length > 0) {
            await prisma.$transaction(operations);
        }

        // Real-time push: broadcast WORKITEM_UPDATE to all connected users
        try {
            broadcastToLab(user.labId,'WORKITEM_UPDATE', {
                sampleIds: [String(item.sampleId)],
                updatedBy: user.username,
                action: 'REVIEWED',
                reviewStatus: status,
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
        res.status(500).json({ error: 'Failed to review work item' });
    }
};

exports.reviewWorkItemsBulk = async (req, res) => {
    const { workItemIds, status, note } = req.body;
    const user = req.user;

    try {
        if (!['LAB_MANAGER', 'SUPER_ADMIN'].includes(user.role)) {
            return res.status(403).json({ error: 'Insufficient permissions (Manager Only).' });
        }

        if (!workItemIds || !Array.isArray(workItemIds) || workItemIds.length === 0) {
            return res.status(400).json({ error: 'workItemIds array is required' });
        }

        const items = await prisma.workItem.findMany({
            where: { id: { in: workItemIds } }
        });

        const now = new Date();
        const results = [];
        const operations = [];

        for (const item of items) {
            const history = typeof item.history === 'string' ? JSON.parse(item.history) : (item.history || []);
            history.push({
                status,
                note: note || 'Bulk Manager Review',
                changedBy: user.username,
                timestamp: now
            });

            operations.push(prisma.workItem.update({
                where: { id: item.id },
                data: {
                    status,
                    history: JSON.stringify(history)
                }
            }));

            if (status === workflow.WORK_ITEM_STATES.ACCEPTED) {
                if (item.analysis === 'ARCHIVING' || item.analysis === 'ARCH' || item.analysis === 'Archive') {
                    const { transitionSample } = require('../services/sampleStateService');
                    await transitionSample(item.sampleId, 'ARCHIVED', user, 'Sample archived via batch work item review').catch(err => {
                        console.warn('[reviewBatch] Warning: sample transition to ARCHIVED failed:', err.message);
                    });
                } else if (item.analysis === 'DISPOSAL' || item.analysis === 'DISP' || item.analysis === 'Dispose') {
                    const { transitionSample } = require('../services/sampleStateService');
                    await transitionSample(item.sampleId, 'DISPOSED', user, 'Sample disposed via batch work item review').catch(err => {
                        console.warn('[reviewBatch] Warning: sample transition to DISPOSED failed:', err.message);
                    });
                }

                // Sync spectralData status when spectral work item is approved
                const bulkAnalysisUpper = (item.analysis || '').toUpperCase();
                const bulkIsSpectral = ['NIR', 'MIR', 'SPECTRAL', 'VIS-NIR', 'VISNIR', 'SCAN'].some(k => bulkAnalysisUpper.includes(k));
                if (bulkIsSpectral) {
                    const sample = await prisma.sample.findUnique({
                        where: { id: String(item.sampleId) },
                        select: { labId: true }
                    });
                    if (sample?.labId) {
                        operations.push(prisma.spectralData.updateMany({
                            where: {
                                labId: sample.labId,
                                status: { in: ['PENDING', 'VALIDATED'] }
                            },
                            data: {
                                status: 'APPROVED',
                                reviewedBy: user.username,
                                reviewedAt: now
                            }
                        }));
                    }
                }
            }

            operations.push(prisma.auditLog.create({
                data: {
                    id: `audit-wi-bulk-rev-${item.id}-${Date.now()}`,
                    entity: 'WORKITEM',
                    entityId: item.id,
                    action: 'REVIEW',
                    details: `Work Item ${status} by ${user.username} (Bulk)`,
                    performedBy: user.username,
                    timestamp: now,
                    sampleId: String(item.sampleId)
                }
            }));

            // Send message to technician if assigned
            if (item.assignedTo) {
                // Lookup recipient user ID (assignedTo is username, not ID)
                const recipient = await prisma.user.findFirst({
                    where: { username: item.assignedTo },
                    select: { id: true }
                });

                const isApproved = status === workflow.WORK_ITEM_STATES.ACCEPTED;
                const isWaived = status === workflow.WORK_ITEM_STATES.WAIVED;
                const isRejected = status === workflow.WORK_ITEM_STATES.REANALYSIS_REQUIRED;

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

                // Only create message if we have a valid recipient ID
                if (subject && body && recipient?.id) {
                    operations.push(prisma.message.create({
                        data: {
                            id: `msg-bulk-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                            senderId: user.id,
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
                    await createNotification(
                        recipient.id,
                        notifType,
                        notifTitle,
                        `${item.analysis} for sample ${item.labId || item.sampleId}`,
                        `/samples/${item.sampleId}`
                    );
                }
            }
        }

        if (operations.length > 0) {
            // Using transaction to ensure atomic updates
            await prisma.$transaction(operations);
        }

        // Real-time push: broadcast WORKITEM_UPDATE to all connected users
        if (items.length > 0) {
            const affectedSampleIds = [...new Set(items.map(i => i.sampleId).filter(Boolean))];
            try {
                broadcastToLab(user.labId,'WORKITEM_UPDATE', {
                    sampleIds: affectedSampleIds,
                    updatedBy: user.username,
                    action: 'BULK_REVIEWED',
                    reviewStatus: status,
                    count: items.length
                });
            } catch (wsErr) {
                console.error('[WS] Failed to broadcast WORKITEM_UPDATE (bulk review):', wsErr);
            }
        }

        res.json({ success: true, count: items.length });
    } catch (error) {
        console.error('[reviewWorkItemsBulk] Error:', error);
        res.status(500).json({ error: 'Failed to review work items' });
    }
};

module.exports = exports;
