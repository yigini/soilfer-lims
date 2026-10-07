const { runAnalyteCode } = require('./analysisCodesService');
const { QC_RUN_INCLUDE } = require('./qcRunViewService');

// The current pointer may move after repeat/reject disposition. The old join,
// observations and verdicts remain the old run's immutable membership history.
async function repeatSource(db, item, targetBatchId) {
    if (!item.batchId || item.batchId === targetBatchId) return null;
    const old = await db.batch.findUnique({ where: { id: item.batchId }, include: QC_RUN_INCLUDE });
    const member = old?.positions.some(position => position.workItems.some(link => link.workItemId === item.id));
    const analyte = old?.analytes.find(row => row.analysisCode === runAnalyteCode(old, item.analysis));
    const disposition = old?.dispositions.filter(row => row.analysisCode === analyte?.analysisCode)
        .sort((a, b) => new Date(b.decidedAt).getTime() - new Date(a.decidedAt).getTime() ||
            (b.id > a.id ? 1 : b.id < a.id ? -1 : 0))[0];
    let scope;
    try { scope = typeof disposition?.scope === 'string' ? JSON.parse(disposition.scope) : disposition?.scope; } catch (_) { /* Refuse malformed scope. */ }
    const bracketRepeat = analyte?.provenance === 'NATIVE' && analyte.status === 'ACCEPTED_WITH_DEVIATION' &&
        item.status === 'REPEAT_REQUIRED' && disposition?.decision === 'REPEAT_BRACKET' &&
        Array.isArray(scope?.affectedWorkItemIds) && scope.affectedWorkItemIds.includes(item.id) &&
        Array.isArray(scope.sealedAffectedWorkItemIds) && !scope.sealedAffectedWorkItemIds.includes(item.id);
    const target = targetBatchId ? await db.batch.findUnique({ where: { id: targetBatchId }, include: QC_RUN_INCLUDE }) : null;
    const targetAllowed = !targetBatchId || target?.status === 'OPEN' && !target.startedAt &&
        !target.analytes.some(row => row.legacyMembershipFrozen) && !target.measurements.length;
    if (!member || !(['REPEAT_ORDERED', 'REJECTED'].includes(analyte?.status) || bracketRepeat) || !targetAllowed ||
        ['SUBMITTED', 'ACCEPTED', 'WAIVED', 'CANCELLED'].includes(item.status)) {
        throw Object.assign(new Error('A work item already belongs to another run.'),
            { statusCode: 409, code: 'QC_WORK_ITEM_ALREADY_BATCHED', details: { workItemId: item.id } });
    }
    return item.batchId;
}

module.exports = { repeatSource };
