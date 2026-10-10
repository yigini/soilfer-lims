const crypto = require('crypto');
const prisma = require('../prisma');
const rules = require('./workflowStateRules');
const { transitionWorkItem } = require('./workItemStateService');

/**
 * Draft Service
 * Manages dedicated, isolated draft persistence for laboratory determinations and operational tasks.
 * Guarantees that draft entries never create Result rows, supersede valid determinations,
 * advance operational gates, or reach downstream report readers.
 */

/**
 * Save or update a draft determination
 */
function assertNoReceiptFields(value, seen = new WeakSet()) {
    if (value === null || typeof value !== 'object' || seen.has(value)) return;
    seen.add(value);
    for (const [key, child] of Object.entries(value)) {
        if (/receipt/i.test(key)) throw new rules.TransitionError('Import receipts are attached by the import owner.', 400, 'DRAFT_FIELDS_INVALID');
        assertNoReceiptFields(child, seen);
    }
}

async function readDraftContext(db, user, { workItemId, instrumentId = null }, options = {}) {
    if (!workItemId) throw new Error('workItemId is required to save a draft');
    const workItem = await db.workItem.findUnique({ where: { id: workItemId }, include: { sample: true } });
    if (!workItem) throw new Error(`WorkItem ${workItemId} not found`);
    const isAssigned = workItem.assignedTo === user.username;
    const isPrivileged = ['LAB_MANAGER', 'SUPER_ADMIN', 'COUNTRY_ADMIN'].includes(user.role);
    if (!isAssigned && !isPrivileged) throw new Error('Access denied: You are not assigned to this work item');
    const scopeGuard = require('../utils/scopeGuard');
    if (!scopeGuard.canAccessEntity(user, workItem, { entityType: 'WorkItem', labField: 'assignedLab', altLabField: 'labId' }) ||
        workItem.sample && !scopeGuard.canAccessEntity(user, workItem.sample, { labField: 'assignedLab', altLabField: 'labId' }))
        throw new Error('Access denied: Work item is outside your laboratory scope');
    if (!scopeGuard.hasGlobalAccess(user) && user.labId) {
        const itemLab = workItem.assignedLab || workItem.sample?.assignedLab || workItem.labId;
        const sampleLab = workItem.sample?.assignedLab || workItem.sample?.labId;
        if (itemLab && itemLab !== user.labId || sampleLab && sampleLab !== user.labId)
            throw new Error('Access denied: Work item is in another laboratory');
    }
    if (options.importReceiptId) {
        const receipt = await db.instrumentImportReceipt.findUnique({ where: { id: options.importReceiptId } });
        const lab = await require('./policyService').resolveLab(workItem.sample?.assignedLab || workItem.sample?.labId || workItem.labId, db);
        let snapshot;
        try { snapshot = JSON.parse(receipt?.mappingSnapshot); } catch { /* Refuse unavailable receipt evidence. */ }
        if (!receipt || receipt.labId !== lab?.id || receipt.instrumentId !== instrumentId ||
            receipt.importedBy !== user.username || snapshot?.batchId !== workItem.batchId ||
            !Array.isArray(snapshot.rows) || !snapshot.rows.some(row => row.match?.workItemIdsByAnalysis?.[workItem.analysis] === workItem.id))
            throw new rules.TransitionError('The import receipt does not bind this draft line.', 400, 'DRAFT_FIELDS_INVALID');
    }
    if (options.importReceiptId || options.importing) {
        if (await db.workItemDraft.findUnique({ where: { workItemId } }))
            throw new rules.TransitionError('Save or clear the existing draft before importing.', 409, 'IMPORT_DRAFT_EXISTS');
        if (await db.result.findFirst({ where: { sampleId: workItem.sampleId, param: workItem.analysis, isCurrent: true, supersededBy: null } }))
            throw new rules.TransitionError('Recorded or sealed work requires its correction workflow.', 409, 'RESULT_WORKITEM_SEALED');
    }
    const readiness = await require('./workbenchReadinessService').evaluateExecutionReadiness(db, workItem, user,
        { selectedEquipmentId: instrumentId || workItem.equipmentId });
    if (!readiness.isReady) throw new rules.TransitionError(readiness.reasons.join(' '), 409,
        readiness.blockers.includes('GATE_STATE_MISMATCH') ? 'GATE_STATE_MISMATCH' : 'EXECUTION_BLOCKED');
    return workItem;
}

async function saveDraft(user, input, db = null, options = {}) {
    assertNoReceiptFields(input);
    if (!options || typeof options !== 'object' || Array.isArray(options) ||
        Object.keys(options).some(key => key !== 'importReceiptId') ||
        Object.hasOwn(options, 'importReceiptId') && (typeof options.importReceiptId !== 'string' || !options.importReceiptId))
        throw new rules.TransitionError('Supply a server-owned import receipt.', 400, 'DRAFT_FIELDS_INVALID');
    if (!db) return rules.inTransaction(prisma, tx => saveDraft(user, input, tx, options));
    const {
    workItemId,
    sampleId,
    analysis,
    value = null,
    values = null,
    checks = null,
    basis = 'AIR_DRY',
    replicateNo = 1,
    instrumentId = null,
    methodologyId = null,
    notes = null,
    baseVersion = 0
    } = input;
    const workItem = await readDraftContext(db, user, input, options);

    const sId = sampleId || workItem.sampleId;
    const labId = workItem.sample?.assignedLab || workItem.sample?.labId || workItem.labId || user.labId;
    const analysisCode = analysis || workItem.analysis;

    // 2. Concurrency check: detect if workItem was modified on server
    let conflictValue = null;
    if (baseVersion !== undefined && baseVersion !== null && Number(baseVersion) < workItem.version) {
        // Version mismatch: check if server has an existing result or newer value
        conflictValue = workItem.result || null;
    }

    // Stringify JSON fields safely (supports array or named object for texture)
    const valuesStr = (typeof values === 'object' && values !== null)
        ? JSON.stringify(values)
        : (typeof values === 'string' ? values : null);
    const checksStr = Array.isArray(checks)
        ? JSON.stringify(checks)
        : (typeof checks === 'string' ? checks : null);
    const rawValue = value !== null && value !== undefined ? String(value) : null;

    // 3. Upsert WorkItemDraft
    const existingDraft = await db.workItemDraft.findUnique({
        where: { workItemId }
    });

    let draft;
    if (existingDraft) {
        draft = await db.workItemDraft.update({
            where: { workItemId },
            data: {
                value: rawValue,
                values: valuesStr,
                checks: checksStr,
                basis: basis || existingDraft.basis,
                replicateNo: Number(replicateNo) || existingDraft.replicateNo,
                instrumentId: instrumentId !== undefined ? instrumentId : existingDraft.instrumentId,
                methodologyId: methodologyId !== undefined ? methodologyId : existingDraft.methodologyId,
                notes: notes !== undefined ? notes : existingDraft.notes,
                baseVersion: Number(baseVersion) || existingDraft.baseVersion,
                draftVersion: { increment: 1 },
                conflictValue: conflictValue || existingDraft.conflictValue,
                updatedAt: new Date()
            }
        });
    } else {
        draft = await db.workItemDraft.create({
            data: {
                workItemId,
                sampleId: sId,
                userId: user.username,
                labId: labId || null,
                analysis: analysisCode,
                value: rawValue,
                values: valuesStr,
                checks: checksStr,
                basis: basis || 'AIR_DRY',
                replicateNo: Number(replicateNo) || 1,
                instrumentId: instrumentId || null,
                methodologyId: methodologyId || null,
                notes: notes || null,
                baseVersion: Number(baseVersion) || workItem.version || 0,
                draftVersion: 1,
                conflictValue: conflictValue,
                ...(options.importReceiptId && { importReceiptId: options.importReceiptId })
            }
        });
    }

    // 4. Update WorkItem status to IN_PROGRESS if currently ASSIGNED (without touching Result table)
    if (workItem.status === 'ASSIGNED') {
        const history = rules.requireHistory(workItem.history);

        history.push({
            status: 'IN_PROGRESS',
            changedBy: user.username,
            timestamp: new Date().toISOString(),
            action: 'DRAFT_STARTED'
        });

        const updated = await transitionWorkItem(workItemId, 'IN_PROGRESS', user, 'Draft started',
            { history: JSON.stringify(history), version: workItem.version }, db, { expected: { status: workItem.status, version: workItem.version },
                audit: { action: 'DRAFT_STARTED' } });
        return { ...draft, workItemVersion: updated.version };
    }

    return { ...draft, workItemVersion: workItem.version };
}

/**
 * Authoritative Draft Access Validator
 * Ensures that draft reads and mutations (save, get, discard, clear, resolveConflict)
 * strictly enforce related work item AND sample scope.
 * 1. Global access (SUPER_ADMIN) is allowed.
 * 2. Inactive users are denied.
 * 3. Draft ownership alone is NEVER sufficient after staff transfers.
 * 4. Checks draft.labId, related workItem (labId, assignedLab), and related sample (assignedLab, labId).
 *    If any of these belong to a different laboratory, access is DENIED.
 */
function canAccessDraft(user, draft, workItem = null, sample = null) {
    if (!user || user.isActive === false || user.status === 'INACTIVE') return false;
    const scopeGuard = require('../utils/scopeGuard');
    if (scopeGuard.hasGlobalAccess(user)) return true;

    if (!user.labId) return false;

    // Check draft's own labId if set
    if (draft.labId && draft.labId !== user.labId) {
        return false;
    }

    const wi = workItem || draft.workItem;
    if (wi) {
        if (!scopeGuard.canAccessEntity(user, wi, { entityType: 'WorkItem', labField: 'assignedLab', altLabField: 'labId' })) {
            return false;
        }
        const itemLab = wi.assignedLab || (wi.sample?.assignedLab || wi.labId);
        if (itemLab && itemLab !== user.labId) {
            return false;
        }

        const s = sample || wi.sample;
        if (s) {
            if (!scopeGuard.canAccessEntity(user, s, { entityType: 'Sample', labField: 'assignedLab', altLabField: 'labId' })) {
                return false;
            }
            const sampleLab = s.assignedLab || s.labId;
            if (sampleLab && sampleLab !== user.labId) {
                return false;
            }
        }
    } else {
        // If related work item cannot be found, draft has no valid scope context
        // and cannot be authorized unless draft.labId explicitly matches user.labId
        if (!draft.labId || draft.labId !== user.labId) {
            return false;
        }
    }

    return true;
}

/**
 * Retrieve all active drafts for a technician within authorized lab scope
 */
async function getDrafts(user) {
    if (!user || user.isActive === false || user.status === 'INACTIVE') {
        return [];
    }

    const scopeGuard = require('../utils/scopeGuard');
    const isGlobal = scopeGuard.hasGlobalAccess(user);

    if (!isGlobal && !user.labId) {
        return [];
    }

    const drafts = await prisma.workItemDraft.findMany({
        where: { userId: user.username },
        include: {
            workItem: {
                include: { sample: true }
            }
        },
        orderBy: { updatedAt: 'desc' }
    });

    const authorizedDrafts = drafts.filter(d => canAccessDraft(user, d));

    // Parse JSON fields
    return authorizedDrafts.map(d => ({
        ...d,
        values: d.values ? (typeof d.values === 'string' ? JSON.parse(d.values) : d.values) : null,
        checks: d.checks ? (typeof d.checks === 'string' ? JSON.parse(d.checks) : d.checks) : null
    }));
}

/**
 * Discard a draft determination with receipt and audit logging
 */
async function discardDraft(user, workItemId, db = null) {
    if (!db) return rules.inTransaction(prisma, tx => discardDraft(user, workItemId, tx));
    const draft = await db.workItemDraft.findUnique({
        where: { workItemId },
        include: {
            workItem: {
                include: { sample: true }
            }
        }
    });

    if (!draft) {
        return { success: true, message: 'No active draft found' };
    }

    // Verify ownership
    if (draft.userId !== user.username && !['LAB_MANAGER', 'SUPER_ADMIN'].includes(user.role)) {
        throw new Error('Access denied: You cannot discard another user’s draft');
    }

    if (!canAccessDraft(user, draft)) {
        const err = new Error('Access denied: Draft is outside your laboratory scope');
        err.status = 403;
        err.statusCode = 403;
        throw err;
    }

    // 1. Delete draft record
    await db.workItemDraft.delete({
        where: { workItemId }
    });

    // 2. Record discard event and revert status to ASSIGNED if currently IN_PROGRESS
    if (draft.workItem && !draft.workItem.completedAt) {
        const history = rules.requireHistory(draft.workItem.history);

        history.push({
            status: draft.workItem.status === 'IN_PROGRESS' ? 'ASSIGNED' : draft.workItem.status,
            changedBy: user.username,
            timestamp: new Date().toISOString(),
            action: 'DRAFT_DISCARDED'
        });

        await transitionWorkItem(workItemId, draft.workItem.status === 'IN_PROGRESS' ? 'ASSIGNED' : draft.workItem.status,
            user, 'Draft discarded', { history: JSON.stringify(history), version: draft.workItem.version }, db,
            { expected: { status: draft.workItem.status, version: draft.workItem.version } });
    }

    // 3. Log audit event
    await db.auditLog.create({
        data: {
            id: crypto.randomUUID(),
            entity: 'WorkItemDraft',
            entityId: workItemId,
            sampleId: draft.sampleId,
            action: 'DRAFT_DISCARDED',
            performedBy: user.username,

            details: `Discarded draft for ${draft.analysis} on sample ${draft.sampleId}`,
            before: JSON.stringify({ value: draft.value, draftVersion: draft.draftVersion }),
            timestamp: new Date()
        }
    });

    return {
        success: true,
        receipt: {
            workItemId,
            sampleId: draft.sampleId,
            analysis: draft.analysis,
            discardedAt: new Date().toISOString(),
            discardedBy: user.username
        }
    };
}

/**
 * Resolve a concurrency conflict on a draft
 */
async function resolveConflict(user, workItemId, { resolution, reason }) {
    const draft = await prisma.workItemDraft.findUnique({
        where: { workItemId },
        include: {
            workItem: {
                include: { sample: true }
            }
        }
    });

    if (!draft) throw new Error(`Draft ${workItemId} not found`);

    if (!canAccessDraft(user, draft)) {
        const err = new Error('Access denied: Draft is outside your laboratory scope');
        err.status = 403;
        err.statusCode = 403;
        throw err;
    }

    if (resolution === 'USE_SERVER') {
        const adoptedValue = draft.conflictValue || draft.workItem?.result || '';
        const updated = await prisma.workItemDraft.update({
            where: { workItemId },
            data: {
                value: adoptedValue,
                conflictValue: null,
                baseVersion: draft.workItem?.version || draft.baseVersion,
                updatedAt: new Date()
            }
        });

        await prisma.auditLog.create({
            data: {
                id: crypto.randomUUID(),
                entity: 'WorkItemDraft',
                entityId: workItemId,
                sampleId: draft.sampleId,
                action: 'DRAFT_CONFLICT_RESOLVED',
                performedBy: user.username,
    
                details: `Adopted server value "${adoptedValue}" for ${draft.analysis}`,
                timestamp: new Date()
            }
        }).catch(err => console.error('[draftService] Audit log failed:', err));

        return { success: true, draft: updated, resolution: 'USE_SERVER' };
    } else if (resolution === 'KEEP_LOCAL') {
        if (!reason || !reason.trim()) {
            throw new Error('A mandatory reason is required to retain local draft over server value');
        }

        const updated = await prisma.workItemDraft.update({
            where: { workItemId },
            data: {
                conflictValue: null,
                notes: `Retained local draft: ${reason.trim()}`,
                baseVersion: draft.workItem?.version || draft.baseVersion,
                updatedAt: new Date()
            }
        });

        await prisma.auditLog.create({
            data: {
                id: crypto.randomUUID(),
                entity: 'WorkItemDraft',
                entityId: workItemId,
                sampleId: draft.sampleId,
                action: 'DRAFT_CONFLICT_RESOLVED',
                performedBy: user.username,
    
                details: `Retained local draft "${draft.value}" for ${draft.analysis}. Reason: ${reason.trim()}`,
                timestamp: new Date()
            }
        }).catch(err => console.error('[draftService] Audit log failed:', err));

        return { success: true, draft: updated, resolution: 'KEEP_LOCAL' };
    } else {
        throw new Error(`Invalid resolution action: ${resolution}. Must be USE_SERVER or KEEP_LOCAL.`);
    }
}

module.exports = {
    assertNoReceiptFields,
    readDraftContext,
    saveDraft,
    getDrafts,
    discardDraft,
    resolveConflict
};
