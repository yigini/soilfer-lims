const { randomUUID } = require('node:crypto');
const { hasPermission } = require('../config/roles');
const scopeGuard = require('../utils/scopeGuard');
const workflow = require('../workflowContract');
const rules = require('./workflowStateRules');
const work = require('./workItemStateService');
const { flagBatchResults } = require('./qcService');
const DECISIONS = Object.freeze(['PROCEED_WITH_WARNING', 'REANALYZE_BATCH', 'REJECT_BATCH']);

function historyOf(value) {
    try {
        const history = typeof value === 'string' ? JSON.parse(value) : (value || []);
        if (Array.isArray(history)) return history;
    } catch (_) { /* Do not replace a history that cannot be read. */ }
    throw new rules.TransitionError('The stored QC/work history requires repair.', 409, 'INVALID_WORKFLOW_HISTORY');
}

async function dispositionBatch(batchId, decision, reason, actor, db = null) {
    if (!DECISIONS.includes(decision)) throw new rules.TransitionError('Invalid QC disposition decision.', 400, 'INVALID_DISPOSITION_DECISION');
    const trimmedReason = rules.requireReason(reason);
    if (trimmedReason.length < 5) throw new rules.TransitionError('A meaningful reason (minimum 5 characters) is required.', 400, 'DISPOSITION_REASON_REQUIRED');
    if (!hasPermission(actor, 'BATCH_APPROVAL')) throw new rules.TransitionError('Manager only.', 403, 'QC_DISPOSITION_FORBIDDEN');
    const performedBy = rules.actorName(actor);
    return rules.inTransaction(db, async tx => {
        const batch = await tx.batch.findUnique({ where: { id: String(batchId) } });
        if (!batch) throw new rules.TransitionError('Batch not found.', 404, 'BATCH_NOT_FOUND');
        scopeGuard.ensureScope(actor, batch, { labField: 'labId' });
        if (batch.status !== 'QC_FAIL') throw new rules.TransitionError('Batch is not in QC_FAIL state.', 400, 'BATCH_NOT_QC_FAILED');
        const members = await tx.workItem.findMany({ where: { batchId: batch.id }, include: { sample: true } });
        for (const item of members) rules.assertScope(actor, item.sample);
        for (const [status, code] of [['ON_HOLD', 'QC_DISPOSITION_ITEMS_ON_HOLD'], ['AWAITING_VERIFICATION', 'QC_DISPOSITION_ITEMS_UNVERIFIED']]) {
            const blocked = members.filter(item => item.status === status).map(item => ({ workItemId: item.id, analysis: item.analysis, status: item.status }));
            if (blocked.length) throw new rules.TransitionError('Resolve the blocked work items before recording a QC disposition.', 409, code, { items: blocked });
        }
        let existing = null;
        if (batch.disposition) {
            try { existing = typeof batch.disposition === 'string' ? JSON.parse(batch.disposition) : batch.disposition; }
            catch (_) { throw new rules.TransitionError('The stored QC disposition requires repair.', 409, 'INVALID_QC_DISPOSITION'); }
        }
        if (existing?.decision) {
            if (existing.decision === decision && existing.reason === trimmedReason) return { success: true, disposition: existing, idempotent: true };
            throw new rules.TransitionError(`Batch '${batch.id}' already has a conflicting disposition.`, 409, 'DISPOSITION_CONFLICT');
        }
        const now = new Date();
        const disposition = { decision, reason: trimmedReason, by: performedBy, at: now };
        const batchHistory = historyOf(batch.history);
        batchHistory.push({ status: batch.status, disposition: decision, reason: trimmedReason, changedBy: performedBy, timestamp: now });
        const mutable = members.filter(item => !['ACCEPTED', 'WAIVED', 'CANCELLED', 'RELEASED'].includes(item.status) &&
            !['APPROVED', 'ARCHIVED', 'DISPOSED', 'RELEASED'].includes(item.sample?.status));
        // Parse all histories before any write; corrupt evidence is never erased.
        const histories = new Map(decision === 'PROCEED_WITH_WARNING' ? [] : mutable.map(item => [item.id, historyOf(item.history)]));
        await tx.batch.update({ where: { id: batch.id }, data: { disposition: JSON.stringify(disposition), history: JSON.stringify(batchHistory) } });
        if (decision !== 'PROCEED_WITH_WARNING') for (const item of mutable) {
            const repeat = workflow.normalizeWorkItemState(item.status) === 'REPEAT_REQUIRED';
            const history = histories.get(item.id);
            history.push({ status: repeat ? item.status : 'REPEAT_REQUIRED', previousStatus: item.status, changedBy: performedBy,
                timestamp: now.toISOString(), action: decision, reason: trimmedReason,
                ...(decision === 'REANALYZE_BATCH' && { submissionId: item.submissionId }) });
            const data = { history: JSON.stringify(history),
                ...(!repeat && { reanalysisReason: trimmedReason, reanalysisRequestedBy: performedBy }),
                ...(!repeat && decision === 'REANALYZE_BATCH' && { submissionId: null }) };
            await work.transitionWorkItem(item.id, 'REPEAT_REQUIRED', actor, trimmedReason, data, tx,
                { action: decision, expected: item });
        }
        await tx.auditLog.create({ data: { id: randomUUID(), entity: 'QC_BATCH', entityId: batch.id, action: 'QC_DISPOSITION',
            details: `QC batch disposition recorded: ${decision}. Reason: ${trimmedReason}`, performedBy, timestamp: now } });
        await flagBatchResults(tx, batch.id, 'QC_FAIL', disposition);
        return { success: true, disposition };
    });
}

module.exports = { dispositionBatch };
