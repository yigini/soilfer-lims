const {randomUUID,createHash}=require('node:crypto');
const rules=require('./workflowStateRules');
const {assertRepeatReason,assertWorkAttemptStatus}=require('./workAttemptContract');

async function allocateExecution(tx,ctx,{attemptId,repeatReason}={}) {
    rules.requireTransaction(tx);
    if (!ctx.item) return null; // Only the pinned orphan historical import.
    if (attemptId) return {id:attemptId,existing:true};
    const maximum=await tx.workAttempt.aggregate({where:{workItemId:ctx.item.id},_max:{attemptNo:true}});
    return {id:'att-'+ctx.item.id+'-'+randomUUID(),attemptNo:(maximum._max.attemptNo || 0)+1,
        reason:assertRepeatReason(repeatReason),existing:false};
}

async function insertExecution(tx,ctx,allocation,evidence,now,metadata={}) {
    rules.requireTransaction(tx);
    if (!allocation) return null;
    if (allocation.existing) return allocation.id;
    const equipmentReadiness=ctx.equipmentReadiness || null;
    const evidenceData=JSON.stringify({...evidence,equipmentReadiness});
    if (JSON.stringify(JSON.parse(evidenceData).equipmentReadiness)!==(ctx.equipmentReadinessText || 'null')) {
        throw new rules.TransitionError('Attempt and Result readiness must match.',409,'WORK_ATTEMPT_EVIDENCE_MISMATCH');
    }
    await tx.workAttempt.create({data:{id:allocation.id,workItemId:ctx.item.id,attemptNo:allocation.attemptNo,
        status:assertWorkAttemptStatus('RECORDED'),reason:allocation.reason,author:ctx.performedBy,
        authorName:ctx.actor?.name || ctx.performedBy,batchId:ctx.batchId,qcBatchId:ctx.batchId,
        instrumentId:equipmentReadiness?.equipmentId || null,
        executedMethodRevision:ctx.method?.version == null ? null:String(ctx.method.version),
        ...(metadata.materialAliquot != null && {materialAliquot:metadata.materialAliquot}),
        version:metadata.version ?? ((ctx.item.version || 0)+1),evidenceData,
        evidenceHash:createHash('sha256').update(evidenceData).digest('hex'),createdAt:now,updatedAt:now}});
    ctx.attemptId=allocation.id;
    return allocation.id;
}

module.exports={allocateExecution,insertExecution};
