const { randomUUID } = require('node:crypto');
const { hasPermission } = require('../config/roles');
const workflow = require('../workflowContract');
const rules = require('./workflowStateRules');
const work = require('./workItemStateService');
const { flagBatchResults } = require('./qcService');
const { QC_RUN_INCLUDE, readQcRun, currentAnalyteEvidence } = require('./qcRunViewService');
const { repeatBracketScope } = require('./qcCalibrationBracketService');
const { withQcAudit, recordBatchAudit } = require('./qcRunAuditService');
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

function assertClientScope(supplied, computed) {
    if (supplied === undefined) return;
    const same = (a, b) => Array.isArray(a) && a.every(value => typeof value === 'string') &&
        a.length === new Set(a).size && JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
    if (!supplied || typeof supplied !== 'object' || Array.isArray(supplied) ||
        !Object.keys(supplied).length || Object.keys(supplied).some(key => !['affectedPositionIds', 'affectedWorkItemIds'].includes(key)) ||
        Object.entries(supplied).some(([key, value]) => !same(value, computed?.[key] || []))) {
        throw new rules.TransitionError('The supplied bracket scope differs from the current evaluation.', 422, 'QC_BRACKET_SCOPE_MISMATCH');
    }
}

async function dispositionBatch(batchId, decision, reason, actor, db = null, { analysisCode, scope: clientScope } = {}) {
    if (!Object.hasOwn(DECISION_MAP, decision)) throw new rules.TransitionError('Invalid QC disposition decision.', 400, 'INVALID_DISPOSITION_DECISION');
    const canonical = DECISION_MAP[decision], legacyDecision = LEGACY_DECISION[canonical];
    const trimmedReason = rules.requireReason(reason);
    if (trimmedReason.length < 5) throw new rules.TransitionError('A meaningful reason (minimum 5 characters) is required.', 400, 'DISPOSITION_REASON_REQUIRED');
    if (!hasPermission(actor, 'BATCH_APPROVAL')) throw new rules.TransitionError('Manager only.', 403, 'QC_DISPOSITION_FORBIDDEN');
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
                if (clientScope !== undefined && existing.length !== 1) throw new rules.TransitionError('Select one analyte for a supplied bracket scope.', 422, 'QC_BRACKET_SCOPE_MISMATCH');
                assertClientScope(clientScope, existing[0].scope);
                return { success: true, disposition: existing[0], idempotent: true,
                    ...(canonical === 'REPEAT_BRACKET' && { amendmentRequired: existing.flatMap(row =>
                        (row.scope?.sealedAffectedWorkItemIds || []).map((workItemId, index) => ({ workItemId,
                            sampleId: row.scope.sealedAffectedSampleIds[index] }))) }) };
            }
            throw new rules.TransitionError(`Batch '${batch.id}' already has a conflicting disposition.`, 409, 'DISPOSITION_CONFLICT');
        }
        if (batch.status === 'CLOSED' || selected.some(row => row.status !== 'QC_FAIL')) throw new rules.TransitionError('The selected analysis is not in QC_FAIL state.', 400, 'BATCH_NOT_QC_FAILED');
        const codes = selected.map(row => row.analysisCode);
        const scopes = new Map(canonical === 'REPEAT_BRACKET' ? selected.map(row => [row.analysisCode,
            repeatBracketScope(row, currentAnalyteEvidence(batch, row.analysisCode))]) : []);
        if (clientScope !== undefined && (canonical !== 'REPEAT_BRACKET' || scopes.size !== 1)) {
            throw new rules.TransitionError('A bracket scope requires one selected calibration analyte.', 422, 'QC_BRACKET_SCOPE_MISMATCH');
        }
        assertClientScope(clientScope, scopes.values().next().value);
        const affectedIds = [...new Set([...scopes.values()].flatMap(scope => scope.affectedWorkItemIds))];
        const members = await tx.workItem.findMany({ where: canonical === 'REPEAT_BRACKET' ? { id: { in: affectedIds } }
            : { batchId: batch.id, analysis: { in: codes } }, include: { sample: true } });
        if (canonical === 'REPEAT_BRACKET' && members.length !== affectedIds.length) {
            throw new rules.TransitionError('Bracket membership evidence is incomplete.', 409, 'QC_BRACKET_REPEAT_NOT_ALLOWED');
        }
        for (const item of members) rules.assertScope(actor, item.sample);
        const published = canonical === 'REPEAT_BRACKET' ? await tx.report.findMany({ where: {
            sampleId: { in: members.map(item => item.sampleId) }, status: { in: ['PUBLISHED', 'SUPERSEDED', 'WITHDRAWN'] } }, select: { sampleId: true } }) : [];
        const publishedIds = new Set(published.map(row => row.sampleId));
        const sealed = item => ['ACCEPTED', 'WAIVED', 'CANCELLED', 'RELEASED'].includes(item.status) ||
            ['APPROVED', 'PUBLISHED', 'ARCHIVED', 'DISPOSED', 'RELEASED'].includes(item.sample?.status) || publishedIds.has(item.sampleId);
        const mutable = members.filter(item => !sealed(item));
        const amendmentRequired = canonical === 'REPEAT_BRACKET' ? members.filter(sealed).map(item => ({ workItemId: item.id, sampleId: item.sampleId })) : [];
        for (const scope of scopes.values()) {
            const affectedSealed = members.filter(item => scope.affectedWorkItemIds.includes(item.id) && sealed(item));
            scope.sealedAffectedWorkItemIds = affectedSealed.map(item => item.id);
            scope.sealedAffectedSampleIds = affectedSealed.map(item => item.sampleId);
        }
        for (const [status, code] of [['ON_HOLD', 'QC_DISPOSITION_ITEMS_ON_HOLD'], ['AWAITING_VERIFICATION', 'QC_DISPOSITION_ITEMS_UNVERIFIED']]) {
            const blocked = (canonical === 'REPEAT_BRACKET' ? mutable : members).filter(item => item.status === status).map(item => ({ workItemId: item.id, analysis: item.analysis, status: item.status }));
            if (blocked.length) throw new rules.TransitionError('Resolve the blocked work items before recording a QC disposition.', 409, code, { items: blocked });
        }
        const now = new Date();
        const disposition = { decision: legacyDecision, canonicalDecision: canonical, reason: trimmedReason, by: performedBy, at: now, ...(analysisCode && { analysisCode }) };
        historyOf(batch.history);
        // Parse all histories before any write; corrupt evidence is never erased.
        const histories = new Map(legacyDecision === 'PROCEED_WITH_WARNING' ? [] : mutable.map(item => [item.id, historyOf(item.history)]));
        const analyteStatus = ['ACCEPT_WITH_DEVIATION', 'REPEAT_BRACKET'].includes(canonical) ? 'ACCEPTED_WITH_DEVIATION' : canonical === 'REJECT' ? 'REJECTED' : 'REPEAT_ORDERED';
        for (const row of selected) {
            const retainedDisposition = await tx.batchDisposition.create({ data: { id: randomUUID(), batchId: batch.id, analysisCode: row.analysisCode,
                decision: canonical, reason: trimmedReason, decidedBy: performedBy, decidedAt: now,
                ...(scopes.has(row.analysisCode) && { scope: JSON.stringify(scopes.get(row.analysisCode)) }) } });
            if (canonical === 'REJECT') await require('./nonconformityService').raise(tx, actor, {labId:batch.labId,
                source:'QC',refType:'QcDisposition',refId:retainedDisposition.id,
                description:`Batch ${batch.id}, analysis ${row.analysisCode}: REJECT. ${trimmedReason}`});
            await tx.batchAnalyte.update({ where: { id: row.id }, data: { status: analyteStatus } });
            row.status = analyteStatus;
        }
        const status = workflow.aggregateBatchStatus(batch.analytes, { startedAt: batch.startedAt });
        await tx.batch.update({ where: { id: batch.id }, data: { status } });
        await tx.batchEvent.create({ data: { id: randomUUID(), batchId: batch.id, type: 'QC_DISPOSITION', by: performedBy, at: now,
            payload: JSON.stringify({ analysisCodes: codes, disposition,
                ...(canonical === 'REPEAT_BRACKET' && { scopes: Object.fromEntries(scopes), amendmentRequired }),
                historyEntry: { status, disposition: canonical === 'REPEAT_BRACKET' ? canonical : legacyDecision, reason: trimmedReason, changedBy: performedBy, timestamp: now } }) } });
        if (legacyDecision !== 'PROCEED_WITH_WARNING') for (const item of mutable) {
            const repeat = workflow.normalizeWorkItemState(item.status) === 'REPEAT_REQUIRED';
            const history = histories.get(item.id);
            history.push({ status: repeat ? item.status : 'REPEAT_REQUIRED', previousStatus: item.status, changedBy: performedBy,
                timestamp: now.toISOString(), action: canonical === 'REPEAT_BRACKET' ? canonical : legacyDecision, reason: trimmedReason,
                ...(legacyDecision === 'REANALYZE_BATCH' && { submissionId: item.submissionId }) });
            const data = { history: JSON.stringify(history),
                ...(!repeat && { reanalysisReason: trimmedReason, reanalysisRequestedBy: performedBy }),
                ...(!repeat && legacyDecision === 'REANALYZE_BATCH' && { submissionId: null }) };
            await work.transitionWorkItem(item.id, 'REPEAT_REQUIRED', actor, trimmedReason, data, tx,
                { action: legacyDecision, expected: item });
        }
        await recordBatchAudit(tx, batch.id, { entity: 'QC_BATCH', action: 'QC_DISPOSITION', reason: trimmedReason, now,
            details: { decision: legacyDecision, canonicalDecision: canonical,
                ...(canonical === 'REPEAT_BRACKET' && { scopes: Object.fromEntries(scopes), amendmentRequired }),
                message: `QC batch disposition recorded: ${legacyDecision}. Reason: ${trimmedReason}` } });
        for (const row of selected) await flagBatchResults(tx, batch.id, 'QC_FAIL',
            { ...disposition, ...(scopes.has(row.analysisCode) && { scope: scopes.get(row.analysisCode) }) },
            batch.analytes.length === 1 && row.provenance !== 'NATIVE' ? null : row.analysisCode);
        return { success: true, disposition, ...(canonical === 'REPEAT_BRACKET' && { scopes: Object.fromEntries(scopes), amendmentRequired }) };
    });
}

module.exports = { dispositionBatch: (batchId, decision, reason, actor, db = null, options = {}) =>
    withQcAudit(db, { batchId: String(batchId), actor, reason, operation: 'QC_DISPOSITION' },
        tx => dispositionBatch(batchId, decision, reason, actor, tx, options)) };
