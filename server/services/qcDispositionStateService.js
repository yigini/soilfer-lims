const { randomUUID } = require('node:crypto');
const { hasPermission } = require('../config/roles');
const workflow = require('../workflowContract');
const rules = require('./workflowStateRules');
const work = require('./workItemStateService');
const { flagBatchResults } = require('./qcService');
const { QC_RUN_INCLUDE, readQcRun, currentAnalyteEvidence } = require('./qcRunViewService');
const DECISION_MAP = Object.freeze({ PROCEED_WITH_WARNING: 'ACCEPT_WITH_DEVIATION', REANALYZE_BATCH: 'REPEAT_BATCH', REJECT_BATCH: 'REJECT',
    ACCEPT_WITH_DEVIATION: 'ACCEPT_WITH_DEVIATION', REPEAT_BATCH: 'REPEAT_BATCH', REPEAT_BRACKET: 'REPEAT_BRACKET', REJECT: 'REJECT' });
const LEGACY_DECISION = Object.freeze({ ACCEPT_WITH_DEVIATION: 'PROCEED_WITH_WARNING', REPEAT_BATCH: 'REANALYZE_BATCH', REPEAT_BRACKET: 'REANALYZE_BATCH', REJECT: 'REJECT_BATCH' });

function historyOf(value) {
    try {
        const history = typeof value === 'string' ? JSON.parse(value) : (value || []);
        if (Array.isArray(history)) return history;
    } catch (_) { /* Do not replace a history that cannot be read. */ }
    throw new rules.TransitionError('The stored QC/work history requires repair.', 409, 'INVALID_WORKFLOW_HISTORY');
}

async function dispositionBatch(batchId, decision, reason, actor, db = null, { analysisCode } = {}) {
    if (!Object.hasOwn(DECISION_MAP, decision)) throw new rules.TransitionError('Invalid QC disposition decision.', 400, 'INVALID_DISPOSITION_DECISION');
    const canonical = DECISION_MAP[decision], legacyDecision = LEGACY_DECISION[canonical];
    const trimmedReason = rules.requireReason(reason);
    if (trimmedReason.length < 5) throw new rules.TransitionError('A meaningful reason (minimum 5 characters) is required.', 400, 'DISPOSITION_REASON_REQUIRED');
    if (!hasPermission(actor, 'APPROVE_RESULTS')) throw new rules.TransitionError('Manager only.', 403, 'QC_DISPOSITION_FORBIDDEN');
    const performedBy = rules.actorName(actor);
    return rules.inTransaction(db, async tx => {
        await readQcRun(tx, String(batchId), actor);
        const batch = await tx.batch.findUnique({ where: { id: String(batchId) }, include: QC_RUN_INCLUDE });
        const selected = batch.analytes.filter(row => analysisCode ? row.analysisCode === analysisCode :
            row.status === 'QC_FAIL' || currentAnalyteEvidence(batch, row.analysisCode).disposition);
        if (analysisCode && !selected.length) throw new rules.TransitionError('The analysis is not a member of this run.', 400, 'QC_ANALYSIS_NOT_IN_RUN');
        if (!selected.length) throw new rules.TransitionError('Batch is not in QC_FAIL state.', 400, 'BATCH_NOT_QC_FAILED');
        const existing = selected.map(row => currentAnalyteEvidence(batch, row.analysisCode).disposition);
        if (existing.some(Boolean)) {
            if (existing.every(row => row && (row.canonicalDecision || DECISION_MAP[row.decision]) === canonical && row.reason === trimmedReason)) {
                return { success: true, disposition: existing[0], idempotent: true };
            }
            throw new rules.TransitionError(`Batch '${batch.id}' already has a conflicting disposition.`, 409, 'DISPOSITION_CONFLICT');
        }
        if (batch.status === 'CLOSED' || selected.some(row => row.status !== 'QC_FAIL')) throw new rules.TransitionError('The selected analysis is not in QC_FAIL state.', 400, 'BATCH_NOT_QC_FAILED');
        const codes = selected.map(row => row.analysisCode);
        const members = await tx.workItem.findMany({ where: { batchId: batch.id, analysis: { in: codes } }, include: { sample: true } });
        for (const item of members) rules.assertScope(actor, item.sample);
        for (const [status, code] of [['ON_HOLD', 'QC_DISPOSITION_ITEMS_ON_HOLD'], ['AWAITING_VERIFICATION', 'QC_DISPOSITION_ITEMS_UNVERIFIED']]) {
            const blocked = members.filter(item => item.status === status).map(item => ({ workItemId: item.id, analysis: item.analysis, status: item.status }));
            if (blocked.length) throw new rules.TransitionError('Resolve the blocked work items before recording a QC disposition.', 409, code, { items: blocked });
        }
        const now = new Date();
        const disposition = { decision: legacyDecision, canonicalDecision: canonical, reason: trimmedReason, by: performedBy, at: now, ...(analysisCode && { analysisCode }) };
        historyOf(batch.history);
        const mutable = members.filter(item => !['ACCEPTED', 'WAIVED', 'CANCELLED', 'RELEASED'].includes(item.status) &&
            !['APPROVED', 'ARCHIVED', 'DISPOSED', 'RELEASED'].includes(item.sample?.status));
        // Parse all histories before any write; corrupt evidence is never erased.
        const histories = new Map(legacyDecision === 'PROCEED_WITH_WARNING' ? [] : mutable.map(item => [item.id, historyOf(item.history)]));
        const analyteStatus = canonical === 'ACCEPT_WITH_DEVIATION' ? 'ACCEPTED_WITH_DEVIATION' : canonical === 'REJECT' ? 'REJECTED' : 'REPEAT_ORDERED';
        for (const row of selected) {
            await tx.batchDisposition.create({ data: { id: randomUUID(), batchId: batch.id, analysisCode: row.analysisCode,
                decision: canonical, reason: trimmedReason, decidedBy: performedBy, decidedAt: now } });
            await tx.batchAnalyte.update({ where: { id: row.id }, data: { status: analyteStatus } });
            row.status = analyteStatus;
        }
        const status = workflow.aggregateBatchStatus(batch.analytes, { startedAt: batch.startedAt });
        await tx.batch.update({ where: { id: batch.id }, data: { status } });
        await tx.batchEvent.create({ data: { id: randomUUID(), batchId: batch.id, type: 'QC_DISPOSITION', by: performedBy, at: now,
            payload: JSON.stringify({ analysisCodes: codes, disposition, historyEntry: { status, disposition: legacyDecision, reason: trimmedReason, changedBy: performedBy, timestamp: now } }) } });
        if (legacyDecision !== 'PROCEED_WITH_WARNING') for (const item of mutable) {
            const repeat = workflow.normalizeWorkItemState(item.status) === 'REPEAT_REQUIRED';
            const history = histories.get(item.id);
            history.push({ status: repeat ? item.status : 'REPEAT_REQUIRED', previousStatus: item.status, changedBy: performedBy,
                timestamp: now.toISOString(), action: legacyDecision, reason: trimmedReason,
                ...(legacyDecision === 'REANALYZE_BATCH' && { submissionId: item.submissionId }) });
            const data = { history: JSON.stringify(history),
                ...(!repeat && { reanalysisReason: trimmedReason, reanalysisRequestedBy: performedBy }),
                ...(!repeat && legacyDecision === 'REANALYZE_BATCH' && { submissionId: null }) };
            await work.transitionWorkItem(item.id, 'REPEAT_REQUIRED', actor, trimmedReason, data, tx,
                { action: legacyDecision, expected: item });
        }
        await tx.auditLog.create({ data: { id: randomUUID(), entity: 'QC_BATCH', entityId: batch.id, action: 'QC_DISPOSITION',
            details: `QC batch disposition recorded: ${legacyDecision}. Reason: ${trimmedReason}`, performedBy, timestamp: now } });
        for (const row of selected) await flagBatchResults(tx, batch.id, 'QC_FAIL', disposition,
            batch.analytes.length === 1 && row.provenance !== 'NATIVE' ? null : row.analysisCode);
        return { success: true, disposition };
    });
}

module.exports = { dispositionBatch };
