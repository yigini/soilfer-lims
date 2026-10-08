const { QC_RUN_INCLUDE } = require('./qcRunViewService');
const { runAnalyteCode } = require('./analysisCodesService');
const { TransitionError } = require('./workflowStateRules');
async function assertRepeatBatchAllowed(db, item, batchId) {
    if (!batchId) return;
    const repeated = await db.workAttempt.findFirst({ where: { workItemId: item.id, attemptNo: { gt: 1 } }, select: { id: true } });
    if (!repeated) return;
    const batch = await db.batch.findUnique({ where: { id: batchId }, include: QC_RUN_INCLUDE });
    if (!batch) throw new TransitionError('The repeat batch is unavailable.', 409, 'REPEAT_BATCH_UNAVAILABLE');
    const code = runAnalyteCode(batch, item.analysis);
    const forbidden = batch.analytes.some(row => row.analysisCode === code && ['QC_FAIL', 'REPEAT_ORDERED', 'REJECTED'].includes(row.status)) ||
        batch.evaluations.some(row => row.analysisCode === code && row.verdict === 'FAIL') ||
        batch.dispositions.some(row => (!row.analysisCode || row.analysisCode === code) &&
            ['REPEAT_BATCH', 'REPEAT_BRACKET', 'REANALYZE_BATCH', 'REJECT', 'REJECT_BATCH'].includes(row.canonicalDecision || row.decision));
    if (forbidden) throw new TransitionError('Choose a new batch for this repeat; the previous QC failure or repeat/reject decision is retained.',
        409, 'REPEAT_FAILED_BATCH', { workItemId: item.id, batchId, analysisCode: code });
}
module.exports = { assertRepeatBatchAllowed };
