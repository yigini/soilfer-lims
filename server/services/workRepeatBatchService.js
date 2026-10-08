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
async function assertRepeatSourceReleased(db,item) {
    if(!item.batchId)return;
    const batch=await db.batch.findUnique({where:{id:item.batchId},include:QC_RUN_INCLUDE});
    const code=batch && runAnalyteCode(batch,item.analysis);
    const member=batch?.positions.some(position=>position.workItems.some(link=>link.workItemId===item.id && runAnalyteCode(batch,link.analysisCode)===code));
    const analyte=batch?.analytes.find(row=>row.analysisCode===code);
    if(member && ['QC_PASS','QC_WARN'].includes(analyte?.status))return;
    if(member) {
        // The existing #187 disposition authority remains the only way out
        // of failed, pending or otherwise unaccepted run evidence.
        try { if(await require('./qcRunRepeatService').repeatSource(db,item,null))return; }
        catch(error){if(error.code!=='QC_WORK_ITEM_ALREADY_BATCHED')throw error;}
    }
    throw new TransitionError('Disposition the current run before requesting this repeat.',409,'ATTEMPT_REPEAT_RUN_DISPOSITION_REQUIRED',
        {workItemId:item.id,batchId:item.batchId,analysisCode:code || item.analysis});
}
function mapRepeatRunError(error) {
    const text=`${error.message || ''} ${JSON.stringify(error.meta || {})}`;
    if(text.includes('BATCH_MEMBERSHIP_FROZEN'))return new TransitionError('Disposition the current run before requesting this repeat.',409,
        'ATTEMPT_REPEAT_RUN_DISPOSITION_REQUIRED');
    return error;
}
module.exports = { assertRepeatBatchAllowed, assertRepeatSourceReleased, mapRepeatRunError };
