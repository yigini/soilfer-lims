const { randomUUID } = require('node:crypto');
const { hasPermission } = require('../config/roles');
const workflow = require('../workflowContract');
const rules = require('./workflowStateRules');
const evidence = require('./resultEvidenceService');
const samples = require('./sampleStateService');
const cataloguePolicy = require('./cataloguePolicy');
const receipts = require('./commandReceiptService');
const { normalizedSelection, orderRevisionRequest } = require('./orderRevisionContract');
const { normalizeAnalysisCodes } = require('./analysisCodesService');
const { reconcileWorkItemsForSample } = require('./workItemReconciliationService');

function currentAnalyses(sample) {
    let value;
    try { value = typeof sample.requiredAnalyses === 'string' ? JSON.parse(sample.requiredAnalyses) : sample.requiredAnalyses || []; }
    catch { throw new rules.TransitionError('The stored analysis list requires repair before editing.', 409, 'INVALID_STORED_ANALYSES'); }
    return normalizedSelection(value, true);
}

async function orderLines(tx, sample, codes, active) {
    const items = await tx.workItem.findMany({ where: { sampleId: sample.id, duplicateOf: null } });
    const lines = [];
    for (const analysis of codes) {
        const candidates = items.filter(item => {
            const normalized = normalizeAnalysisCodes([item.analysis]);
            return normalized.length === 1 && normalized[0] === analysis;
        });
        if (candidates.length !== 1) throw new rules.TransitionError('Resolve the work-item identity before revising this order.',
            409, 'ORDER_WORKITEM_REQUIRED', { analysis, workItemIds: candidates.map(item => item.id) });
        const item = candidates[0];
        const method = item.methodologyId ? await tx.methodology.findUnique({ where: { id: item.methodologyId } }) : null;
        if (item.methodologyId && !method) throw new rules.TransitionError('The assigned methodology is unavailable.', 409, 'ORDER_METHOD_REQUIRED');
        const predecessors = active.length === 1 ? active[0].lines.filter(line => normalizeAnalysisCodes([line.analysis]).includes(analysis)) : [];
        lines.push({ id: randomUUID(), analysis, workItemId: item.id, methodologyId: item.methodologyId,
            methodRevision: method?.version == null ? null : String(method.version), isRequired: true, status: 'ACTIVE',
            predecessorLineId: predecessors.length === 1 ? predecessors[0].id : null });
    }
    return lines;
}

async function createRevision(tx, sample, codes, actor, reason, active) {
    rules.requireTransaction(tx);
    const lines = await orderLines(tx, sample, codes, active);
    const maximum = await tx.sampleOrderRevision.aggregate({ where: { sampleId: sample.id }, _max: { version: true } });
    const supersededRevisionIds = active.map(row => row.id);
    if (supersededRevisionIds.length) {
        const updated = await tx.sampleOrderRevision.updateMany({ where: { sampleId: sample.id, id: { in: supersededRevisionIds }, status: 'ACTIVE' },
            data: { status: 'SUPERSEDED' } });
        if (updated.count !== supersededRevisionIds.length) throw new rules.TransitionError('The order changed. Reload before retrying.', 409, 'ORDER_REVISION_CHANGED');
    }
    const performedBy = rules.actorName(actor);
    const revision = await tx.sampleOrderRevision.create({ data: { id: randomUUID(), sampleId: sample.id,
        version: (maximum._max.version || 0) + 1, status: 'ACTIVE', reason: rules.requireReason(reason),
        requestedBy: performedBy, authorizedBy: performedBy, authorizedAt: new Date(), lines: { create: lines } } });
    return { revision, supersededRevisionIds, priorActiveCount: active.length };
}

async function createInitialOrder(tx, sample, codes, actor) {
    rules.requireTransaction(tx);
    sample = await tx.sample.findUnique({ where: { id: String(sample.id) } });
    if (!sample) throw new rules.TransitionError('Sample not found.', 404, 'SAMPLE_NOT_FOUND');
    rules.assertScope(actor, sample);
    evidence.assertAmendable(sample);
    // Intake never repairs or adopts a retained order implicitly.
    if (await tx.sampleOrderRevision.count({ where: { sampleId: sample.id } })) return { noOp: true };
    const outcome = await createRevision(tx, sample, normalizedSelection(codes), actor, 'Initial order generated at intake', []);
    await tx.auditLog.create({ data: { id: randomUUID(), entity: 'SAMPLE', entityId: sample.id, sampleId: sample.id,
        action: 'ORDER_INITIAL_GENERATED', performedBy: rules.actorName(actor), timestamp: new Date(),
        details: JSON.stringify({ revisionId: outcome.revision.id, supersededRevisionIds: [], priorActiveCount: 0 }) } });
    return outcome;
}

/** All reconciliation, order identity, sample state, receipt and audit writes share one transaction. */
async function reviseAnalyses(sampleId, changes, actor, options = {}) {
    if (!hasPermission(actor, 'EDIT_ANALYSES')) throw new rules.TransitionError('Insufficient permissions to edit analyses.', 403, 'EDIT_ANALYSES_FORBIDDEN');
    const performedBy = rules.actorName(actor), isOrder = options.mode === 'order';
    const key = options.idempotencyKey || null, resource = `Sample:${sampleId}`;
    try {
        return await rules.inTransaction(options.tx, async tx => {
            const sample = await tx.sample.findUnique({ where: { id: String(sampleId) } });
            if (!sample) throw new rules.TransitionError('Sample not found.', 404, 'SAMPLE_NOT_FOUND');
            rules.assertScope(actor, sample);
            evidence.assertAmendable(sample);
            const active = await tx.sampleOrderRevision.findMany({ where: { sampleId: sample.id, status: 'ACTIVE' }, include: { lines: true }, orderBy: { id: 'asc' } });
            const current = currentAnalyses(sample);
            const request = orderRevisionRequest(changes, { currentAnalyses: current, priorActiveCount: active.length,
                requiresLineRevision: active.length === 1 && current.some(code => active[0].lines.filter(line => line.status === 'ACTIVE'
                    && normalizeAnalysisCodes([line.analysis]).includes(code)).length !== 1) });
            const payloadHash = receipts.computePayloadHash({ analyses: [...request.analyses].sort(), reason: request.reason,
                ...(!isOrder && changes.analysisGroupIds && { analysisGroupIds: changes.analysisGroupIds }) });
            if (key) {
                const checked = await receipts.checkReceipt(key, 'APPLY_ORDER_REVISION', performedBy, resource, payloadHash, tx);
                if (checked.isExisting) {
                    if (checked.conflict || checked.receipt.parsedOutcome?.payloadHash !== payloadHash) {
                        throw new rules.TransitionError('Idempotency key collision with differing command parameters.', 409, 'IDEMPOTENCY_KEY_CONFLICT');
                    }
                    return checked.receipt.parsedOutcome;
                }
            }
            const selection = await cataloguePolicy.validateSelection(request.analyses, { labId: sample.assignedLab || actor.labId, existing: current, db: tx });
            if (!selection.valid) throw new rules.TransitionError(selection.error, 400, 'INVALID_ANALYSIS_SELECTION', { issues: selection.issues });
            if (!request.changed) {
                const outcome = { message: 'No changes detected in analyses list.', noOp: true, sample,
                    ...(!isOrder && { added: [], waived: [], removed: [], summary: 'No changes' }) };
                if (key) await receipts.recordReceipt(tx, { idempotencyKey: key, commandType: 'APPLY_ORDER_REVISION', targetResource: resource,
                    actor: performedBy, outcome, payloadHash });
                return outcome;
            }
            const reconcile = await reconcileWorkItemsForSample(sample, request.analyses, actor, request.reason, tx);
            if (reconcile.conflict) throw new rules.TransitionError(reconcile.error, reconcile.status || 409,
                reconcile.code || 'ANALYSIS_RECONCILIATION_REFUSED', { conflicts: reconcile.conflicts, refused: reconcile.refused });
            const order = await createRevision(tx, sample, request.analyses, actor, request.reason, active);
            const updates = { requiredAnalyses: JSON.stringify(request.analyses),
                ...(!isOrder && changes.analysisGroupIds && { analysisGroupIds: JSON.stringify(changes.analysisGroupIds) }) };
            const nextStatus = workflow.normalizeSampleState(sample.status) === 'SUBMITTED_FULL' && reconcile.added.length ? 'PROCESSING' : sample.status;
            const updated = await samples.transitionSample(sample.id, nextStatus, actor, request.reason, updates, tx);
            await tx.auditLog.create({ data: { id: randomUUID(), entity: 'SAMPLE', entityId: sample.id, sampleId: sample.id, performedBy,
                action: isOrder ? 'ORDER_REVISION_APPLIED' : 'ANALYSES_UPDATE', timestamp: new Date(),
                details: JSON.stringify({ revisionId: order.revision.id, supersededRevisionIds: order.supersededRevisionIds,
                    priorActiveCount: order.priorActiveCount, reconcileSummary: reconcile.summary, reason: request.reason }),
                before: JSON.stringify({ analyses: sample.requiredAnalyses, groups: sample.analysisGroupIds, status: sample.status }),
                after: JSON.stringify({ ...updates, status: updated.status, reconcile }) } });
            const outcome = { success: true, sample: updated, added: reconcile.added, waived: reconcile.waived, removed: reconcile.removed,
                ...(isOrder ? { revision: order.revision } : { message: 'Analyses updated successfully', reconcile, summary: reconcile.summary }) };
            if (key) await receipts.recordReceipt(tx, { idempotencyKey: key, commandType: 'APPLY_ORDER_REVISION', targetResource: resource,
                actor: performedBy, outcome, payloadHash });
            return outcome;
        });
    } catch (error) {
        if (['P2003', 'SQLITE_CONSTRAINT_FOREIGNKEY'].includes(error.code)) throw new rules.TransitionError('A referenced work item cannot be removed; no reconciliation changes were saved.', 409, 'WORKITEM_REFERENCE_CONFLICT');
        if (['P2002', 'P2034', 'P2028', 'SQLITE_BUSY'].includes(error.code) || /ORDER_REVISION_ACTIVE_UNIQUE/.test(error.message)) {
            throw new rules.TransitionError('The order changed. Reload before retrying.', 409, 'ORDER_REVISION_CHANGED');
        }
        throw error;
    }
}

module.exports = { reviseAnalyses, createInitialOrder };
