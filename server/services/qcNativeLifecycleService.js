const { randomUUID } = require('node:crypto');
const { hasPermission } = require('../config/roles');
const scopeGuard = require('../utils/scopeGuard');
const policyService = require('./policyService');
const { actorName, inTransaction } = require('./workflowStateRules');
const { QC_RUN_INCLUDE, batchApiView, currentAnalyteEvidence } = require('./qcRunViewService');
const { snapshotEvidence } = require('./qcRunAuditService');
const { flagBatchResults } = require('./qcService');
const { aggregateBatchStatus } = require('../workflowContract');
const failure = (statusCode, code, message) => Object.assign(new Error(message), { statusCode, code });

// Used by the existing manager PUT reopen path. Failed evidence remains locked
// for every role (#186 part 11); no new QC_FAIL reopen route is introduced.
async function reopenNativeRun(db, batchId, actor, reason, analysisCode = null) {
    return inTransaction(db, async tx => {
        const batch = await tx.batch.findUnique({ where: { id: batchId }, include: QC_RUN_INCLUDE });
        if (!batch) throw failure(404, 'BATCH_NOT_FOUND', 'Batch not found.');
        const [actorLab, targetLab] = await Promise.all([policyService.resolveLab(actor.labId, tx), policyService.resolveLab(batch.labId, tx)]);
        scopeGuard.ensureScope({ ...actor, labId: actorLab?.id || actor.labId }, { ...batch, labId: targetLab?.id || batch.labId }, { labField: 'labId', altLabField: null });
        const selected = analysisCode ? batch.analytes.filter(row => row.analysisCode === analysisCode) :
            batch.analytes.filter(row => ['QC_PASS', 'QC_WARN'].includes(row.status));
        if (analysisCode && !selected.length) throw failure(400, 'QC_ANALYSIS_NOT_IN_RUN', 'The analysis is not a member of this run.');
        if (selected.some(row => ['QC_FAIL', 'REJECTED', 'REPEAT_ORDERED', 'CLOSED'].includes(row.status) ||
            currentAnalyteEvidence(batch, row.analysisCode).disposition)) throw failure(409, 'QC_BATCH_LOCKED', 'Failed or dispositioned analyte evidence is locked; use batch disposition.');
        const accepted = selected.filter(row => ['QC_PASS', 'QC_WARN'].includes(row.status));
        if (!accepted.length) throw failure(409, 'QC_BATCH_LOCKED', 'There is no accepted QC to reopen.');
        if (batch.status === 'CLOSED') throw failure(400, 'QC_BATCH_LOCKED', 'Batch is CLOSED and cannot be modified.');
        if (!batch.startedAt || !batch.analytes.length || batch.analytes.some(row => row.provenance !== 'NATIVE')) {
            throw failure(409, 'QC_NATIVE_RUN_REQUIRED', 'Reopening requires a started native run.');
        }
        if (!hasPermission(actor, 'APPROVE_RESULTS')) throw failure(403, 'QC_REOPEN_PERMISSION_REQUIRED', 'Reopening accepted QC requires APPROVE_RESULTS.');
        if (typeof reason !== 'string' || !reason.trim()) throw failure(400, 'REASON_REQUIRED', 'A reason is required to reopen accepted QC.');
        const now = new Date(), performedBy = actorName(actor);
        await snapshotEvidence(tx, batch, actor, reason.trim(), now);
        for (const row of accepted) {
            await tx.batchAnalyte.update({ where: { id: row.id }, data: { status: 'QC_PENDING' } });
            row.status = 'QC_PENDING';
        }
        const status = aggregateBatchStatus(batch.analytes, { startedAt: batch.startedAt, reopened: true });
        await tx.batch.update({ where: { id: batchId }, data: { status } });
        await tx.batchEvent.create({ data: { id: randomUUID(), batchId, type: 'REOPENED', by: performedBy, at: now,
            payload: JSON.stringify({ analysisCodes: accepted.map(row => row.analysisCode), reason: reason.trim(),
                previousEvaluationIds: accepted.map(row => currentAnalyteEvidence(batch, row.analysisCode).evaluation?.id).filter(Boolean),
                historyEntry: { status, changedBy: performedBy, timestamp: now } }) } });
        for (const row of accepted) await flagBatchResults(tx, batchId, 'OPEN', null, row.analysisCode);
        return batchApiView(await tx.batch.findUnique({ where: { id: batchId }, include: QC_RUN_INCLUDE }));
    });
}
module.exports = { reopenNativeRun };
