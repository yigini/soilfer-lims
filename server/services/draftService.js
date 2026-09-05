const prisma = require('../prisma');

/**
 * Draft Service
 * Manages dedicated, isolated draft persistence for laboratory determinations and operational tasks.
 * Guarantees that draft entries never create Result rows, supersede valid determinations,
 * advance operational gates, or reach downstream report readers.
 */

/**
 * Save or update a draft determination
 */
async function saveDraft(user, {
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
}) {
    if (!workItemId) throw new Error('workItemId is required to save a draft');

    // 1. Verify work item existence and ownership/scope
    const workItem = await prisma.workItem.findUnique({
        where: { id: workItemId },
        include: { sample: true }
    });

    if (!workItem) {
        throw new Error(`WorkItem ${workItemId} not found`);
    }

    // Role check: assigned technician or manager/admin
    const isAssigned = workItem.assignedTo === user.username;
    const isPrivileged = ['LAB_MANAGER', 'SUPER_ADMIN', 'COUNTRY_ADMIN'].includes(user.role);
    if (!isAssigned && !isPrivileged) {
        throw new Error('Access denied: You are not assigned to this work item');
    }

    const sId = sampleId || workItem.sampleId;
    const labId = workItem.sample?.assignedLab || workItem.sample?.labId || workItem.labId || user.labId;
    const analysisCode = analysis || workItem.analysis;

    // 2. Concurrency check: detect if workItem was modified on server
    let conflictValue = null;
    if (baseVersion !== undefined && baseVersion !== null && Number(baseVersion) < workItem.version) {
        // Version mismatch: check if server has an existing result or newer value
        conflictValue = workItem.result || null;
    }

    // Stringify JSON fields safely
    const valuesStr = Array.isArray(values) ? JSON.stringify(values) : (typeof values === 'string' ? values : null);
    const checksStr = Array.isArray(checks) ? JSON.stringify(checks) : (typeof checks === 'string' ? checks : null);
    const rawValue = value !== null && value !== undefined ? String(value) : null;

    // 3. Upsert WorkItemDraft
    const existingDraft = await prisma.workItemDraft.findUnique({
        where: { workItemId }
    });

    let draft;
    if (existingDraft) {
        draft = await prisma.workItemDraft.update({
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
        draft = await prisma.workItemDraft.create({
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
                conflictValue: conflictValue
            }
        });
    }

    // 4. Update WorkItem status to IN_PROGRESS if currently ASSIGNED (without touching Result table)
    if (workItem.status === 'ASSIGNED') {
        const history = typeof workItem.history === 'string'
            ? JSON.parse(workItem.history)
            : (workItem.history || []);

        history.push({
            status: 'IN_PROGRESS',
            changedBy: user.username,
            timestamp: new Date().toISOString(),
            action: 'DRAFT_STARTED'
        });

        await prisma.workItem.update({
            where: { id: workItemId },
            data: {
                status: 'IN_PROGRESS',
                history: JSON.stringify(history),
                updatedAt: new Date()
            }
        }).catch(err => console.error('[draftService] Failed to advance WorkItem status to IN_PROGRESS:', err));
    }

    return draft;
}

/**
 * Retrieve all active drafts for a technician
 */
async function getDrafts(user) {
    const drafts = await prisma.workItemDraft.findMany({
        where: { userId: user.username },
        orderBy: { updatedAt: 'desc' }
    });

    // Parse JSON fields
    return drafts.map(d => ({
        ...d,
        values: d.values ? JSON.parse(d.values) : null,
        checks: d.checks ? JSON.parse(d.checks) : null
    }));
}

/**
 * Discard a draft determination with receipt and audit logging
 */
async function discardDraft(user, workItemId) {
    const draft = await prisma.workItemDraft.findUnique({
        where: { workItemId },
        include: { workItem: true }
    });

    if (!draft) {
        return { success: true, message: 'No active draft found' };
    }

    // Verify ownership
    if (draft.userId !== user.username && !['LAB_MANAGER', 'SUPER_ADMIN'].includes(user.role)) {
        throw new Error('Access denied: You cannot discard another user’s draft');
    }

    // 1. Delete draft record
    await prisma.workItemDraft.delete({
        where: { workItemId }
    });

    // 2. Revert WorkItem status to ASSIGNED if currently IN_PROGRESS and no final result exists
    if (draft.workItem && draft.workItem.status === 'IN_PROGRESS' && !draft.workItem.completedAt) {
        const history = typeof draft.workItem.history === 'string'
            ? JSON.parse(draft.workItem.history)
            : (draft.workItem.history || []);

        history.push({
            status: 'ASSIGNED',
            changedBy: user.username,
            timestamp: new Date().toISOString(),
            action: 'DRAFT_DISCARDED'
        });

        await prisma.workItem.update({
            where: { id: workItemId },
            data: {
                status: 'ASSIGNED',
                history: JSON.stringify(history),
                updatedAt: new Date()
            }
        }).catch(err => console.error('[draftService] Failed to revert WorkItem to ASSIGNED:', err));
    }

    // 3. Log audit event
    await prisma.auditLog.create({
        data: {
            id: `audit-draft-discard-${workItemId}-${Date.now()}`,
            entity: 'WorkItemDraft',
            entityId: workItemId,
            sampleId: draft.sampleId,
            action: 'DRAFT_DISCARDED',
            performedBy: user.username,

            details: `Discarded draft for ${draft.analysis} on sample ${draft.sampleId}`,
            before: JSON.stringify({ value: draft.value, draftVersion: draft.draftVersion }),
            timestamp: new Date()
        }
    }).catch(err => console.error('[draftService] Failed to log audit event for discard:', err));

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
        include: { workItem: true }
    });

    if (!draft) throw new Error(`Draft ${workItemId} not found`);

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
                id: `audit-draft-resolve-${workItemId}-${Date.now()}-server`,
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
                id: `audit-draft-resolve-${workItemId}-${Date.now()}-local`,
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
    saveDraft,
    getDrafts,
    discardDraft,
    resolveConflict
};
