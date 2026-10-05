const { randomUUID } = require('node:crypto');
const workflow = require('../workflowContract');
const rules = require('./workflowStateRules');
const gates = require('./gateEvidenceService');
const { transitionWorkItem } = require('./workItemStateService');
const { evaluateExecutionReadiness } = require('./workbenchReadinessService');

async function assertParent(tx, sampleId, actor) {
    if (!sampleId) return null; // Unlinked/control scans retain their existing contract.
    const sample = await tx.sample.findUnique({ where: { id: String(sampleId) } });
    if (!sample) throw new rules.TransitionError('Sample not found.', 404, 'SAMPLE_NOT_FOUND');
    rules.assertScope(actor, sample);
    const status = workflow.normalizeSampleState(sample.status);
    if (status === 'APPROVED') throw new rules.TransitionError('An amendment is required for approved spectral evidence.', 409, 'AMENDMENT_WORKFLOW_REQUIRED');
    if (['ARCHIVED', 'DISPOSED', 'CANCELLED'].includes(status)) throw new rules.TransitionError('Sample material is closed.', 409, 'SAMPLE_CLOSED');
    if (status === 'RECEIVED_REJECTED') throw new rules.TransitionError('Sample intake was rejected.', 409, 'SAMPLE_REJECTED');
    await gates.assertGateEvidence(tx, sample, ['DRYING', 'PREPARATION']);
    return sample;
}

async function freshScan(tx, expected, actor) {
    const scan = await tx.spectralData.findUnique({ where: { id: expected.id } });
    if (!scan || ['status', 'isCurrent', 'workItemId', 'sampleId', 'metadata', 'qcStatus', 'modality'].some(key => scan[key] !== expected[key])) {
        throw new rules.TransitionError('Spectrum changed. Refresh before retrying.', 409, 'SPECTRAL_STATE_CHANGED');
    }
    // A scan's lab scope is checked even when it has no parent sample.
    rules.assertScope(actor, { assignedLab: scan.labId });
    await assertParent(tx, scan.sampleId, actor);
    return scan;
}

async function updateScan(tx, expected, data) {
    const updated = await tx.spectralData.updateMany({ where: { id: expected.id, status: expected.status,
        isCurrent: expected.isCurrent, workItemId: expected.workItemId, sampleId: expected.sampleId,
        metadata: expected.metadata, qcStatus: expected.qcStatus, modality: expected.modality }, data });
    if (updated.count !== 1) throw new rules.TransitionError('Spectrum changed. Refresh before retrying.', 409, 'SPECTRAL_STATE_CHANGED');
    return tx.spectralData.findUnique({ where: { id: expected.id } });
}

async function prepareItem(tx, expected, sampleId, actor, { mode = 'acquire', reopenReason } = {}) {
    const sample = await assertParent(tx, sampleId, actor);
    if (!expected) return null;
    let item = await tx.workItem.findUnique({ where: { id: expected.id }, include: { sample: true } });
    if (!item || item.status !== expected.status || item.version !== expected.version) {
        throw new rules.TransitionError('Work item changed. Refresh before retrying.', 409, 'WORKITEM_STATE_CHANGED');
    }
    if (!sample || item.sampleId !== sample.id) throw new rules.TransitionError('Spectrum and work item must belong to the same sample.', 409, 'SPECTRAL_PARENT_MISMATCH');
    rules.assertScope(actor, item.sample);
    const status = workflow.normalizeWorkItemState(item.status);
    const allowed = mode === 'trash' ? ['IN_PROGRESS', 'COMPLETED'] : ['ASSIGNED', 'IN_PROGRESS', 'REPEAT_REQUIRED', 'COMPLETED'];
    if (!allowed.includes(status)) throw new rules.TransitionError(`Work in ${item.status} cannot change spectral evidence.`, 409, 'WORKITEM_STATE_CONFLICT');
    const readiness = await evaluateExecutionReadiness(tx, item, actor);
    if (!readiness.isReady) throw new rules.TransitionError(readiness.reasons.join('; '), 409, readiness.blockers[0] || 'EXECUTION_BLOCKED');
    if (status === 'COMPLETED' && mode !== 'review') {
        if (typeof reopenReason !== 'string' || !reopenReason.trim()) {
            throw new rules.TransitionError('A supplied reason is required to reopen completed spectral work.', 409, 'WORKITEM_REOPEN_REQUIRED');
        }
        const entry = { status: 'IN_PROGRESS', action: 'SPECTRAL_WORK_REOPENED', reason: reopenReason.trim(),
            priorResult: item.result, priorCompletedAt: item.completedAt, changedBy: rules.actorName(actor), timestamp: new Date().toISOString() };
        item = await transitionWorkItem(item.id, 'IN_PROGRESS', actor, reopenReason, {
            completedAt: null, history: JSON.stringify([...rules.requireHistory(item.history), entry])
        }, tx, { expected: item, action: entry.action, audit: { details: JSON.stringify(entry) } });
    }
    return item;
}

// Keep the existing scientific completeness predicate; no Result rows are made.
async function completeItem(tx, item, actor, { result, equipmentId, note }) {
    if (!item || item.status === 'COMPLETED') return item;
    const count = await tx.spectralData.count({ where: { workItemId: item.id, isCurrent: true,
        status: { notIn: ['REJECTED', 'DELETED'] }, qcStatus: { not: 'FAIL' } } });
    if (count < 1) return item;
    const entry = { status: 'COMPLETED', action: 'SPECTRAL_WORK_COMPLETED', note,
        changedBy: rules.actorName(actor), timestamp: new Date().toISOString() };
    return transitionWorkItem(item.id, 'COMPLETED', actor, null, {
        result, completedAt: new Date(), ...(equipmentId !== undefined && { equipmentId }),
        history: JSON.stringify([...rules.requireHistory(item.history), entry])
    }, tx, { expected: item, action: entry.action });
}

async function relatedItem(tx, scan, { trash = false } = {}) {
    if (scan.workItemId) {
        const item = await tx.workItem.findUnique({ where: { id: scan.workItemId } });
        if (!item) throw new rules.TransitionError('Linked work item not found.', 409, 'WORK_ITEM_NOT_FOUND');
        return item;
    }
    if (!scan.sampleId) return null;
    const items = await tx.workItem.findMany({ where: { sampleId: scan.sampleId,
        ...(trash ? { status: 'COMPLETED' } : { status: { notIn: ['COMPLETED', 'ACCEPTED', 'SUBMITTED'] } }) } });
    const modality = (scan.modality || 'NIR').toUpperCase();
    return items.find(item => (item.analysis || '').toUpperCase().includes(modality)) || null;
}

async function preparePriorItem(tx, scan, actor, targetWorkItemId, reopenReason) {
    if (!scan.workItemId || scan.workItemId === targetWorkItemId) return null;
    const expected = await tx.workItem.findUnique({ where: { id: scan.workItemId } });
    if (!expected) throw new rules.TransitionError('Linked work item not found.', 409, 'WORK_ITEM_NOT_FOUND');
    const item = await prepareItem(tx, expected, scan.sampleId, actor, { reopenReason });
    return { item, reopened: expected.status === 'COMPLETED' };
}

async function recomputePriorItem(tx, prior, actor) {
    if (!prior?.reopened) return;
    await completeItem(tx, prior.item, actor, { result: prior.item.result,
        note: 'Remaining linked spectral evidence checked after reasoned reassociation or supersession.' });
}

async function trashScan(tx, expected, actor, reason, action = 'SPECTRA_TRASH') {
    if (typeof reason !== 'string' || !reason.trim()) throw new rules.TransitionError('A reason is required to move spectral evidence to trash.', 422, 'SPECTRAL_TRASH_REASON_REQUIRED');
    const scan = await freshScan(tx, expected, actor);
    if (scan.status === 'DELETED') throw new rules.TransitionError('Spectrum is already in trash.', 400, 'SPECTRAL_ALREADY_TRASHED');
    const expectedItem = await relatedItem(tx, scan, { trash: true });
    const item = await prepareItem(tx, expectedItem, scan.sampleId, actor, { mode: 'trash', reopenReason: reason });
    let metadata;
    try { metadata = scan.metadata == null ? {} : JSON.parse(scan.metadata); }
    catch (_) { throw new rules.TransitionError('Spectral metadata is invalid.', 409, 'SPECTRAL_METADATA_INVALID'); }
    if (!metadata || Array.isArray(metadata) || typeof metadata !== 'object') throw new rules.TransitionError('Spectral metadata is invalid.', 409, 'SPECTRAL_METADATA_INVALID');
    const updatedScan = await updateScan(tx, scan, { status: 'DELETED', metadata: JSON.stringify({ ...metadata,
        _deletedPreviousStatus: scan.status, _deletedBy: rules.actorName(actor), _deletedAt: new Date().toISOString(), _deletedReason: reason.trim() }) });
    await auditScan(tx, scan, actor, action, { reason: reason.trim(), previousStatus: scan.status, workItemId: item?.id || null });
    return { scan: updatedScan, item };
}

async function auditScan(tx, scan, actor, action, details) {
    const sample = scan.sampleId ? await tx.sample.findUnique({ where: { id: scan.sampleId } }) : null;
    const evidence = sample ? gates.auditEvidence(await gates.loadGateEvidence(tx, sample)) : {};
    return tx.auditLog.create({ data: { id: randomUUID(), entity: 'SPECTRA', entityId: scan.id, action,
        performedBy: rules.actorName(actor), timestamp: new Date(), labId: scan.labId, sampleId: scan.sampleId,
        details: JSON.stringify({ ...(typeof details === 'string' ? { message: details } : details), ...evidence }) } });
}

function countsTowardCompletion(scan) {
    return Boolean(scan.workItemId && scan.isCurrent && !['REJECTED', 'DELETED'].includes(scan.status)
        && scan.qcStatus != null && scan.qcStatus !== 'FAIL');
}

async function reviewScan(tx, expected, actor, { action, notes, reopenReason, batch = false }) {
    const scan = await freshScan(tx, expected, actor);
    if (!['APPROVE', 'REJECT', 'UNDO'].includes(action)) throw new rules.TransitionError('Action must be APPROVE, REJECT or UNDO.', 400, 'INVALID_SPECTRAL_REVIEW');
    if (action === 'UNDO' ? scan.status !== 'REJECTED' : !['PENDING', 'VALIDATED'].includes(scan.status)) {
        throw new rules.TransitionError(`Cannot review spectrum in ${scan.status} status.`, 400, 'SPECTRAL_NOT_REVIEWABLE');
    }
    if (action === 'APPROVE' && !batch && (!scan.quantity || scan.quantity === 'UNVERIFIED')) {
        throw new rules.TransitionError('Cannot approve spectrum: physical quantity must be confirmed (cannot be empty or UNVERIFIED).', 400, 'SPECTRAL_QUANTITY_REQUIRED');
    }
    const status = action === 'UNDO' ? 'VALIDATED' : action === 'APPROVE' ? 'APPROVED' : 'REJECTED';
    // Review never infers a WorkItem association from sample/modality matching.
    const expectedItem = scan.workItemId ? await tx.workItem.findUnique({ where: { id: scan.workItemId } }) : null;
    if (scan.workItemId && !expectedItem) throw new rules.TransitionError('Linked work item not found.', 409, 'WORK_ITEM_NOT_FOUND');
    const changesCount = countsTowardCompletion(scan) !== countsTowardCompletion({ ...scan, status });
    const item = await prepareItem(tx, expectedItem, scan.sampleId, actor,
        { mode: changesCount ? 'acquire' : 'review', reopenReason });
    const updatedScan = await updateScan(tx, scan, { status, reviewedBy: action === 'UNDO' ? null : rules.actorName(actor),
        reviewedAt: action === 'UNDO' ? null : new Date(), reviewNotes: action === 'UNDO' ? null : notes || null });
    const updatedItem = action === 'APPROVE' || changesCount ? await completeItem(tx, item, actor, {
        result: `Spectrum ${action === 'APPROVE' ? 'Approved' : action === 'UNDO' ? 'Restored' : 'Reviewed'} (${scan.qcStatus})`,
        note: `Spectrum ${batch ? 'batch ' : ''}review ${action} by ${rules.actorName(actor)}. QC: ${scan.qcStatus}`
    }) : item;
    await auditScan(tx, scan, actor, batch ? `SPECTRA_BATCH_${action}`
        : action === 'UNDO' ? 'SPECTRA_UNDO_REJECT' : `SPECTRA_${status}`,
    { action, notes: notes || null, workItemId: item?.id || null, changesCount, reopenReason: reopenReason || null });
    return { scan: updatedScan, item: updatedItem };
}

module.exports = { assertParent, freshScan, updateScan, prepareItem, completeItem, relatedItem,
    preparePriorItem, recomputePriorItem, trashScan, auditScan, reviewScan };
