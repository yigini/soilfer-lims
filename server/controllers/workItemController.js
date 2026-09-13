const COMPOUND_ANALYSIS_EXPANSION = {
    'exchangeableBases': ['EXCH_CA', 'EXCH_MG', 'EXCH_K', 'EXCH_NA']
};

const TEXTURE_ALIASES = new Set([
    'TEXTURE',
    'SOIL_PSD_TEXTURE',
    'SOIL_TEXTURE',
    'PSA',
    'pSA',
    'Particle Size Analysis'
]);

function normalizeAnalysisCodes(codes) {
    if (!Array.isArray(codes)) return [];
    const normalized = [];
    let hasTexture = false;
    for (const raw of codes) {
        if (!raw || typeof raw !== 'string') continue;
        const trimmed = raw.trim();
        if (TEXTURE_ALIASES.has(trimmed)) {
            if (!hasTexture) {
                normalized.push('TEXTURE');
                hasTexture = true;
            }
        } else if (COMPOUND_ANALYSIS_EXPANSION[trimmed]) {
            normalized.push(...COMPOUND_ANALYSIS_EXPANSION[trimmed]);
        } else {
            normalized.push(trimmed);
        }
    }
    const unique = [...new Set(normalized)];
    if (hasTexture) {
        return unique.filter(c => !['SAND', 'SILT', 'CLAY'].includes(c) || c === 'TEXTURE');
    }
    return unique;
}

const prisma = require('../prisma');
const analysisService = require('../services/analysisService');
const workflow = require('../workflowContract');
const { createNotification } = require('./notificationController');
const { getAnalysisName, getAnalysisCategory } = require('../services/analysisService');
const wsServer = require('../wsServer');

// Helper to get effective analysis list for a sample
const getEffectiveAnalyses = (sample) => {
    return typeof sample.requiredAnalyses === 'string' ? JSON.parse(sample.requiredAnalyses) : (sample.requiredAnalyses || []);
};


async function preflightDefaults(codes, sample, existingCodes = []) {
    const resolved = new Map();
    const selections = await require('../services/methodResolution').resolveDefaultSelections(codes.filter(c => !existingCodes.includes(c)), sample.assignedLab || sample.labId);
    for (const [analysisCode, selection] of selections) {
        if (selection.error) throw new Error(selection.error);
        resolved.set(analysisCode, selection.method?.id || null);
    }
    return resolved;
}

/**
 * Generate Work Items for a Sample (Internal Hook)
 * Called when Sample -> LAB_ID_ASSIGNED or ACCEPTED
 */
exports.generateWorkItemsForSample = async (sample) => {
    const { id, labId } = sample;
    const requiredAnalyses = getEffectiveAnalyses(sample);
    const workItems = [];
    const expandedCodes = normalizeAnalysisCodes(requiredAnalyses);
    const alreadyCreated = await prisma.workItem.findMany({ where: { sampleId: String(id) }, select: { analysis: true } });
    const defaultMethods = await preflightDefaults(expandedCodes, sample, alreadyCreated.map(i => i.analysis));

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


    if (requiredAnalyses && Array.isArray(requiredAnalyses)) {
        const uniqueAnalyses = normalizeAnalysisCodes(requiredAnalyses);

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
            const defaultMethodId = defaultMethods.get(analysisCode) || null;

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

    // Ensure initial SampleOrderRevision exists
    try {
        const existingRev = await prisma.sampleOrderRevision.findFirst({
            where: { sampleId: String(id) }
        });
        if (!existingRev && requiredAnalyses && requiredAnalyses.length > 0) {
            const rev = await prisma.sampleOrderRevision.create({
                data: {
                    sampleId: String(id),
                    version: 1,
                    status: 'ACTIVE',
                    reason: 'Initial order generated at intake',
                    requestedBy: sample.receivedBy || 'RECEPTION',
                    authorizedBy: 'SYSTEM',
                    authorizedAt: new Date()
                }
            });
            for (const code of requiredAnalyses) {
                await prisma.orderLine.create({
                    data: {
                        revisionId: rev.id,
                        analysis: code,
                        isRequired: true,
                        status: 'ACTIVE'
                    }
                });
            }
        }
    } catch (e) {
        console.warn('[generateWorkItemsForSample] Notice: Order revision creation skipped:', e.message);
    }

    return workItems;
};

/**
 * SD-03: Reconcile Work Items when sample analysis list changes
 * Three-way reconcile:
 * 1. NOT_ASSIGNED, no result -> Delete row, audit deletion
 * 2. Assigned or in progress, no result -> Require reason; set WAIVED with reason and actor; audit
 * 3. Any result recorded (current or superseded) -> Refuse with 409 naming analysis and result
 */
exports.reconcileWorkItemsForSample = async (sample, targetAnalyses, user, reason) => {
    const { id, labId } = sample;
    const targetList = Array.isArray(targetAnalyses) ? targetAnalyses : [];



    const uniqueTarget = normalizeAnalysisCodes(targetList);
    const targetSet = new Set(uniqueTarget);

    const operationalGates = ['DRYING', 'PREPARATION', 'ARCHIVING', 'DISPOSAL'];
    const existingItems = await prisma.workItem.findMany({
        where: {
            sampleId: String(id),
            analysis: { notIn: operationalGates }
        }
    });

    const itemsToRemove = existingItems.filter(item => !targetSet.has(item.analysis) && item.status !== 'WAIVED');

    // 1. Check for recorded results on any items to be removed
    const conflicts = [];
    for (const item of itemsToRemove) {
        let recordedResult = null;
        if (item.result && String(item.result).trim() !== '') {
            recordedResult = item.result;
        } else {
            const dbResult = await prisma.result.findFirst({
                where: {
                    sampleId: String(id),
                    param: item.analysis
                }
            });
            if (dbResult) {
                recordedResult = dbResult.value || (dbResult.numericValue != null ? String(dbResult.numericValue) : 'Recorded');
            }
        }

        if (recordedResult) {
            conflicts.push({
                analysis: item.analysis,
                workItemId: item.id,
                result: recordedResult
            });
        }
    }

    if (conflicts.length > 0) {
        return {
            conflict: true,
            status: 409,
            error: `Cannot remove analysis '${conflicts[0].analysis}': a result is already recorded (${conflicts[0].result})`,
            conflicts,
            refused: conflicts
        };
    }

    // 2. Check for reason if any assigned / in-progress item is being removed
    const assignedOrInProgress = itemsToRemove.filter(i => i.status !== workflow.WORK_ITEM_STATES.NOT_ASSIGNED);
    if (assignedOrInProgress.length > 0 && (!reason || String(reason).trim() === '')) {
        return {
            conflict: true,
            status: 400,
            error: `A reason is required to remove or waive in-progress analysis '${assignedOrInProgress[0].analysis}'.`
        };
    }

    const existingCodeSet = new Set(existingItems.map(i => i.analysis));
    const codesToAdd = uniqueTarget.filter(code => !existingCodeSet.has(code));
    const defaultMethods = await preflightDefaults(codesToAdd, sample);

    const deletedItems = [];
    const waivedItems = [];
    const addedItems = [];

    // 3. Process Removals and Waivers
    for (const item of itemsToRemove) {
        if (item.status === workflow.WORK_ITEM_STATES.NOT_ASSIGNED) {
            await prisma.workItem.delete({ where: { id: item.id } });
            await prisma.auditLog.create({
                data: {
                    id: `audit-wi-del-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                    entity: 'WORKITEM',
                    entityId: item.id,
                    action: 'WORKITEM_DELETED',
                    details: `${user?.username || 'User'} removed unstarted analysis ${item.analysis}`,
                    performedBy: user?.username || 'SYSTEM',
                    timestamp: new Date(),
                    sampleId: String(id),
                    analysisCode: item.analysis,
                    labId: sample.assignedLab || sample.labId
                }
            });
            deletedItems.push(item.analysis);
        } else {
            const history = typeof item.history === 'string' ? JSON.parse(item.history) : (item.history || []);
            history.push({
                status: workflow.WORK_ITEM_STATES.WAIVED,
                reason: String(reason).trim(),
                waivedBy: user?.username || 'SYSTEM',
                timestamp: new Date().toISOString()
            });

            await prisma.workItem.update({
                where: { id: item.id },
                data: {
                    status: workflow.WORK_ITEM_STATES.WAIVED,
                    reanalysisReason: String(reason).trim(),
                    history: JSON.stringify(history)
                }
            });

            await prisma.auditLog.create({
                data: {
                    id: `audit-wi-waive-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                    entity: 'WORKITEM',
                    entityId: item.id,
                    action: 'WORKITEM_WAIVED',
                    details: `${user?.username || 'User'} waived ${item.analysis}. Reason: ${String(reason).trim()}`,
                    performedBy: user?.username || 'SYSTEM',
                    timestamp: new Date(),
                    sampleId: String(id),
                    analysisCode: item.analysis,
                    labId: sample.assignedLab || sample.labId,
                    after: JSON.stringify({ status: 'WAIVED', reason: String(reason).trim() })
                }
            });
            waivedItems.push({ analysis: item.analysis, reason: String(reason).trim() });
        }
    }

    // 4. Process Additions

    if (codesToAdd.length > 0) {
        const catalogueRecords = await prisma.analysis.findMany({
            where: { code: { in: codesToAdd } },
            select: { code: true, executionOrder: true }
        });
        const orderMap = {};
        catalogueRecords.forEach(a => { orderMap[a.code] = a.executionOrder ?? 100; });
        codesToAdd.sort((a, b) => (orderMap[a] ?? 100) - (orderMap[b] ?? 100));

        for (const analysisCode of codesToAdd) {
            const name = await getAnalysisName(analysisCode);
            const category = await getAnalysisCategory(analysisCode);
            const wiId = `WI-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
            const history = [{
                status: workflow.WORK_ITEM_STATES.NOT_ASSIGNED,
                timestamp: new Date().toISOString(),
                note: 'Work Item Generated'
            }];

            const defaultMethodId = defaultMethods.get(analysisCode) || null;

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

            await prisma.auditLog.create({
                data: {
                    id: `audit-wi-gen-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                    entity: 'SAMPLE',
                    entityId: String(id),
                    action: 'WORKITEM_GENERATED',
                    details: `System generated analysis: ${name}`,
                    performedBy: user?.username || 'SYSTEM',
                    timestamp: new Date(),
                    analysisCode: analysisCode,
                    labId: sample.assignedLab || labId
                }
            });

            addedItems.push(analysisCode);
        }
    }

    return {
        conflict: false,
        added: addedItems,
        waived: waivedItems,
        removed: deletedItems,
        summary: `${addedItems.length} added, ${waivedItems.length} waived, ${deletedItems.length} removed`
    };
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

        // SD-09: Validate work-item status writes against WORK_ITEM_TRANSITIONS (409 Conflict)
        if (status && status !== item.status) {
            if (!workflow.isValidWorkItemTransition(item.status, status)) {
                return res.status(409).json({
                    error: `Illegal status transition: ${item.status} → ${status}`,
                    code: 'ILLEGAL_TRANSITION'
                });
            }
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
                    // SD-05: Enforce prerequisite gate on execution (HTTP 412 Precondition Failed)
                    if (sample.preparationStatus !== 'DONE') {
                        return res.status(412).json({ error: 'Sample preparation has not been completed' });
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

        if (operations.length > 0) {
            await prisma.$transaction(operations);
        }

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
        res.status(500).json({ error: 'Failed to update status' });
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
        status = decision === 'ACCEPT' ? 'ACCEPTED' : (decision === 'REJECT' ? 'REANALYSIS_REQUIRED' : decision);
    }
    const user = req.user;

    try {
        if (!['LAB_MANAGER', 'SUPER_ADMIN', 'MASTER_USER'].includes(user.role)) {
            return res.status(403).json({ error: 'Insufficient permissions (Manager Only).' });
        }

        const effectiveReason = (note || reason || '').trim();

        // SD-10: Require mandatory reason on rejection
        if (status === workflow.WORK_ITEM_STATES.REANALYSIS_REQUIRED) {
            if (!effectiveReason) {
                return res.status(400).json({ error: 'A reason is required when rejecting work for reanalysis' });
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
        if (user.role !== 'SUPER_ADMIN' && user.role !== 'MASTER_USER' && !scopeGuard.canAccessEntity(user, item.sample || item, { labField: 'labId', altLabField: 'assignedLab' })) {
            return res.status(403).json({
                error: 'Access denied: Work item outside your lab scope.',
                code: 'ACCESS_DENIED_LAB'
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

        const isClosureTask = ['ARCHIVING', 'ARCH', 'Archive', 'DISPOSAL', 'DISP', 'Dispose'].includes(item.analysis);
        if (status === workflow.WORK_ITEM_STATES.ACCEPTED) {
            if (!isClosureTask) {
                // Canonical guard: must be in SUBMITTED state (COMPLETED is not SUBMITTED)
                if (item.status !== workflow.WORK_ITEM_STATES.SUBMITTED) {
                    return res.status(400).json({
                        error: `Cannot approve work item in '${item.status}' state. Analyses must be completed and submitted by a technician before manager approval. Only submitted work items can be reviewed.`,
                        code: 'INVALID_TRANSITION'
                    });
                }

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

                // Batch QC check
                const qcController = require('./qcController');
                const batchInfo = await qcController.checkItemBatchStatus(item.id);
                if (batchInfo && batchInfo.status === 'QC_FAIL') {
                    return res.status(409).json({
                        error: `Cannot ACCEPT work item ${item.id} because it belongs to a FAILED QC Batch (${batchInfo.batchId}). You must WAIVE or REJECT it.`,
                        code: 'QC_FAIL_BLOCKER',
                        batchId: batchInfo.batchId
                    });
                }
            }
        }

        const now = new Date();
        const history = typeof item.history === 'string' ? JSON.parse(item.history) : (item.history || []);
        history.push({
            status,
            note: effectiveReason || note || 'Manager Review',
            changedBy: user.username,
            timestamp: now
        });

        const updateData = {
            status,
            history: JSON.stringify(history)
        };
        if (status === workflow.WORK_ITEM_STATES.REANALYSIS_REQUIRED) {
            updateData.reanalysisReason = effectiveReason;
        }

        const updated = await prisma.workItem.update({
            where: { id },
            data: updateData
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
            // S05: Only sync exact linked scan or exact attempt, never entire lab or sample
            if (isSpectralAnalysis) {
                operations.push(prisma.spectralData.updateMany({
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
            // S05: Only sync exact linked scan or exact attempt
            if (isSpectralAnalysis) {
                operations.push(prisma.spectralData.updateMany({
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
            : (status === workflow.WORK_ITEM_STATES.REANALYSIS_REQUIRED ? 'RETURN' : 'WAIVE');

        operations.push(prisma.reviewDecision.create({
            data: {
                id: `rd-${id}-${Date.now()}`,
                sampleId: String(item.sampleId),
                workItemId: id,
                submissionItemId: item.submissionId || null,
                decision: decisionVerdict,
                reason: effectiveReason || note || 'Manager Review',
                reviewerId: user.id || user.username,
                reviewerName: user.username,
                authorization: user.role,
                policyVersion: 'v1',
                createdAt: now
            }
        }));

        if (item.submissionId) {
            const allSubItems = await prisma.workItem.findMany({
                where: { submissionId: item.submissionId },
                select: { id: true, status: true }
            });
            const unreviewed = allSubItems.filter(si => si.id !== id && !['ACCEPTED', 'REANALYSIS_REQUIRED', 'WAIVED'].includes(si.status));
            const subStatus = unreviewed.length === 0 ? 'REVIEWED' : 'PARTIALLY_REVIEWED';
            operations.push(prisma.submission.update({
                where: { id: item.submissionId },
                data: {
                    status: subStatus,
                    reviewedBy: user.username,
                    reviewedAt: now,
                    reviewNote: `${user.username} reviewed item ${id} (${decisionVerdict})`
                }
            }));
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

            // Only create message if we have a valid recipient ID and sender ID
            const senderId = user.id || (await prisma.user.findFirst({ where: { username: user.username }, select: { id: true } }))?.id;
            if (subject && body && recipient?.id && senderId) {
                operations.push(prisma.message.create({
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
        res.status(500).json({ error: 'Failed to review work item' });
    }
};

exports.reviewWorkItemsBulk = async (req, res) => {
    const { workItemIds, status, note, reason } = req.body;
    const user = req.user;

    try {
        if (!['LAB_MANAGER', 'SUPER_ADMIN', 'MASTER_USER'].includes(user.role)) {
            return res.status(403).json({ error: 'Insufficient permissions (Manager Only).' });
        }

        const effectiveReason = (note || reason || '').trim();
        if (status === workflow.WORK_ITEM_STATES.REANALYSIS_REQUIRED) {
            if (!effectiveReason) {
                return res.status(400).json({ error: 'A reason is required when rejecting work for reanalysis' });
            }
        }

        const allowedReviewStatuses = [
            workflow.WORK_ITEM_STATES.ACCEPTED,
            workflow.WORK_ITEM_STATES.REANALYSIS_REQUIRED,
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
        if (user.role !== 'SUPER_ADMIN' && user.role !== 'MASTER_USER') {
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
            const closureItems = items.filter(item => ['ARCHIVING', 'ARCH', 'Archive', 'DISPOSAL', 'DISP', 'Dispose'].includes(item.analysis));
            if (closureItems.length > 0) {
                return res.status(400).json({
                    error: `Bulk approval cannot include custody closure tasks (${closureItems.map(i => i.id).join(', ')}). Execute closure via custody operations.`,
                    code: 'CLOSURE_TASK_NOT_REVIEWABLE',
                    closureItemIds: closureItems.map(i => i.id)
                });
            }

            // Reject unsubmitted items (strictly requires SUBMITTED)
            const unsubmitted = items.filter(item => item.status !== workflow.WORK_ITEM_STATES.SUBMITTED);
            if (unsubmitted.length > 0) {
                return res.status(400).json({
                    error: `Cannot approve ${unsubmitted.length} item(s) because they are not in SUBMITTED state. Analyses must be completed and submitted by a technician before manager approval.`,
                    code: 'INVALID_TRANSITION',
                    invalidItemIds: unsubmitted.map(i => i.id)
                });
            }

            // Check evidence for each item
            const missingEvidence = [];
            for (const item of items) {
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

            // Check QC status for each item
            const qcController = require('./qcController');
            const qcFailures = [];
            for (const item of items) {
                const batchInfo = await qcController.checkItemBatchStatus(item.id);
                if (batchInfo && batchInfo.status === 'QC_FAIL') {
                    qcFailures.push({ workItemId: item.id, batchId: batchInfo.batchId });
                }
            }
            if (qcFailures.length > 0) {
                return res.status(409).json({
                    error: `Cannot approve work items belonging to failed QC batches: ${qcFailures.map(q => `${q.workItemId} (Batch: ${q.batchId})`).join(', ')}`,
                    code: 'QC_FAIL_BLOCKER',
                    qcFailures
                });
            }
        }

        const now = new Date();
        const results = [];
        const operations = [];

        for (const item of items) {
            const history = typeof item.history === 'string' ? JSON.parse(item.history) : (item.history || []);
            history.push({
                status,
                note: effectiveReason || note || 'Bulk Manager Review',
                changedBy: user.username,
                timestamp: now
            });

            const updateData = {
                status,
                history: JSON.stringify(history)
            };
            if (status === workflow.WORK_ITEM_STATES.REANALYSIS_REQUIRED) {
                updateData.reanalysisReason = effectiveReason;
            }

            operations.push(prisma.workItem.update({
                where: { id: item.id },
                data: updateData
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
                // S05: Only sync exact linked scan or exact attempt
                const bulkAnalysisUpper = (item.analysis || '').toUpperCase();
                const bulkIsSpectral = ['NIR', 'MIR', 'SPECTRAL', 'VIS-NIR', 'VISNIR', 'SCAN'].some(k => bulkAnalysisUpper.includes(k));
                if (bulkIsSpectral) {
                    operations.push(prisma.spectralData.updateMany({
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

            const decisionVerdict = status === workflow.WORK_ITEM_STATES.ACCEPTED
                ? 'ACCEPT'
                : (status === workflow.WORK_ITEM_STATES.REANALYSIS_REQUIRED ? 'RETURN' : 'WAIVE');

            operations.push(prisma.reviewDecision.create({
                data: {
                    id: `rd-bulk-${item.id}-${Date.now()}`,
                    sampleId: String(item.sampleId),
                    workItemId: item.id,
                    submissionItemId: item.submissionId || null,
                    decision: decisionVerdict,
                    reason: effectiveReason || note || 'Bulk Manager Review',
                    reviewerId: user.id || user.username,
                    reviewerName: user.username,
                    authorization: user.role,
                    policyVersion: 'v1',
                    createdAt: now
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

                // Only create message if we have a valid recipient ID and sender ID
                const senderId = user.id || (await prisma.user.findFirst({ where: { username: user.username }, select: { id: true } }))?.id;
                if (subject && body && recipient?.id && senderId) {
                    operations.push(prisma.message.create({
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

        // Reconcile parent Submissions for all affected items
        const affectedSubIds = [...new Set(items.map(i => i.submissionId).filter(Boolean))];
        for (const subId of affectedSubIds) {
            const allSubItems = await prisma.workItem.findMany({
                where: { submissionId: subId },
                select: { id: true, status: true }
            });
            const itemIdsBeingReviewed = new Set(items.map(i => i.id));
            const unreviewed = allSubItems.filter(si => !itemIdsBeingReviewed.has(si.id) && !['ACCEPTED', 'REANALYSIS_REQUIRED', 'WAIVED'].includes(si.status));
            const subStatus = unreviewed.length === 0 ? 'REVIEWED' : 'PARTIALLY_REVIEWED';
            operations.push(prisma.submission.update({
                where: { id: subId },
                data: {
                    status: subStatus,
                    reviewedBy: user.username,
                    reviewedAt: now,
                    reviewNote: `${user.username} bulk reviewed items`
                }
            }));
        }

        if (operations.length > 0) {
            // Using transaction to ensure atomic updates
            await prisma.$transaction(operations);
        }

        // Real-time push: broadcast WORKITEM_UPDATE to all connected users
        if (items.length > 0) {
            const affectedSampleIds = [...new Set(items.map(i => i.sampleId).filter(Boolean))];
            try {
                wsServer.broadcastToLab(user.labId, 'WORKITEM_UPDATE', {
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
