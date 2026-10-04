const { randomUUID } = require('node:crypto');
const { hasPermission } = require('../config/roles');
const workflow = require('../workflowContract');
const rules = require('./workflowStateRules');
const evidence = require('./resultEvidenceService');
const samples = require('./sampleStateService');
const cataloguePolicy = require('./cataloguePolicy');
const receipts = require('./commandReceiptService');
const { reconcileWorkItemsForSample } = require('./workItemReconciliationService');

function currentAnalyses(sample) {
    try {
        const list = typeof sample.requiredAnalyses === 'string'
            ? JSON.parse(sample.requiredAnalyses) : (sample.requiredAnalyses || []);
        if (Array.isArray(list)) return list;
    } catch (_) { /* Refuse corrupt order data rather than replacing it. */ }
    throw new rules.TransitionError('The stored analysis list requires repair before editing.', 409, 'INVALID_STORED_ANALYSES');
}

/** Reconciliation, order snapshot, sample state, receipt and audits commit together. */
async function reviseAnalyses(sampleId, changes, actor, options = {}) {
    if (!hasPermission(actor, 'EDIT_ANALYSES')) {
        throw new rules.TransitionError('Insufficient permissions to edit analyses.', 403, 'EDIT_ANALYSES_FORBIDDEN');
    }
    const performedBy = rules.actorName(actor);
    const isOrder = options.mode === 'order';
    const key = isOrder ? options.idempotencyKey : null;
    const resource = `Sample:${sampleId}`;
    try {
        return await rules.inTransaction(options.tx, async tx => {
            const sample = await tx.sample.findUnique({ where: { id: String(sampleId) } });
            if (!sample) throw new rules.TransitionError('Sample not found.', 404, 'SAMPLE_NOT_FOUND');
            rules.assertScope(actor, sample);
            // Check the current state before no-op/replay handling or any write.
            evidence.assertAmendable(sample);
            if (key) {
                const check = await receipts.checkReceipt(key, 'APPLY_ORDER_REVISION', performedBy, resource, null, tx);
                if (check.isExisting) {
                    if (check.conflict) throw new rules.TransitionError('Idempotency key collision with differing command parameters.', 409, 'IDEMPOTENCY_KEY_CONFLICT');
                    return check.receipt.parsedOutcome;
                }
            }
            const currentList = currentAnalyses(sample);
            if (changes.analyses !== undefined && !Array.isArray(changes.analyses)) {
                throw new rules.TransitionError('Analyses must be an array of catalogue selections.', 400, 'INVALID_ANALYSIS_SELECTION');
            }
            const targetList = changes.analyses ?? currentList;
            const selection = await cataloguePolicy.validateSelection(targetList, {
                labId: sample.assignedLab || actor.labId, existing: currentList, db: tx
            });
            if (!selection.valid) throw new rules.TransitionError(selection.error, 400, 'INVALID_ANALYSIS_SELECTION', { issues: selection.issues });
            if (targetList.length === currentList.length && targetList.every(code => currentList.includes(code))) {
                const outcome = { message: 'No changes detected in analyses list.', noOp: true, sample,
                    ...(!isOrder && { added: [], waived: [], removed: [], summary: 'No changes' }) };
                if (key) await receipts.recordReceipt(tx, { idempotencyKey: key, commandType: 'APPLY_ORDER_REVISION',
                    targetResource: resource, actor: performedBy, outcome });
                return outcome;
            }

            const reconcile = await reconcileWorkItemsForSample(sample, targetList, actor, changes.reason, tx);
            if (reconcile.conflict) throw new rules.TransitionError(reconcile.error, reconcile.status || 409,
                reconcile.code || 'ANALYSIS_RECONCILIATION_REFUSED', { conflicts: reconcile.conflicts, refused: reconcile.refused });
            const latest = await tx.sampleOrderRevision.findFirst({ where: { sampleId: sample.id }, orderBy: { version: 'desc' } });
            const version = (latest?.version || 0) + 1;
            // Keep each existing route's order-snapshot behavior.
            if (!isOrder) await tx.sampleOrderRevision.updateMany({ where: { sampleId: sample.id, status: 'ACTIVE' }, data: { status: 'SUPERSEDED' } });
            const revision = await tx.sampleOrderRevision.create({ data: {
                sampleId: sample.id, version, status: 'ACTIVE',
                reason: changes.reason || (isOrder ? 'Order revision applied' : 'Updated required analyses'),
                ...(isOrder && { requestedBy: performedBy }), authorizedBy: performedBy, authorizedAt: new Date(),
                lines: { create: targetList.map(analysis => ({ analysis, isRequired: true, status: 'ACTIVE' })) }
            } });
            const updates = { requiredAnalyses: JSON.stringify(targetList),
                ...(!isOrder && changes.analysisGroupIds && { analysisGroupIds: JSON.stringify(changes.analysisGroupIds) }) };
            const nextStatus = workflow.normalizeSampleState(sample.status) === 'SUBMITTED_FULL' && reconcile.added.length
                ? 'PROCESSING' : sample.status;
            const updated = await samples.transitionSample(sample.id, nextStatus, actor, changes.reason, updates, tx);
            await tx.auditLog.create({ data: {
                id: randomUUID(), entity: 'SAMPLE', entityId: sample.id, sampleId: sample.id, performedBy,
                action: isOrder ? 'ORDER_REVISION_APPLIED' : 'ANALYSES_UPDATE', timestamp: new Date(),
                details: `Updated required analyses (Order Revision v${version}). Reconciled: ${reconcile.summary}`,
                before: JSON.stringify({ analyses: sample.requiredAnalyses, groups: sample.analysisGroupIds, status: sample.status }),
                after: JSON.stringify({ ...updates, status: updated.status, reconcile })
            } });
            const outcome = { success: true, sample: updated, added: reconcile.added, waived: reconcile.waived, removed: reconcile.removed,
                ...(isOrder ? { revision } : { message: 'Analyses updated successfully', reconcile, summary: reconcile.summary }) };
            if (key) await receipts.recordReceipt(tx, { idempotencyKey: key, commandType: 'APPLY_ORDER_REVISION',
                targetResource: resource, actor: performedBy, outcome });
            return outcome;
        });
    } catch (error) {
        if (['P2003', 'SQLITE_CONSTRAINT_FOREIGNKEY'].includes(error.code)) {
            throw new rules.TransitionError('A referenced work item cannot be removed; no reconciliation changes were saved.', 409, 'WORKITEM_REFERENCE_CONFLICT');
        }
        if (error.code === 'P2002') throw new rules.TransitionError('The order changed. Reload before retrying.', 409, 'ORDER_REVISION_CHANGED');
        throw error;
    }
}

module.exports = { reviseAnalyses };
