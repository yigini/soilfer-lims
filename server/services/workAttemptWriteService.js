const {randomUUID,createHash}=require('node:crypto');
const rules=require('./workflowStateRules');
const {assertRepeatReason,assertWorkAttemptStatus}=require('./workAttemptContract');

async function allocateExecution(tx,ctx,{attemptId,repeatReason}={}) {
    rules.requireTransaction(tx);
    const reason=assertRepeatReason(repeatReason);
    if (!ctx.item) return null; // Only the pinned orphan historical import.
    if (attemptId) {
        const existing=await tx.workAttempt.findUnique({where:{id:attemptId}});
        if (!existing || existing.workItemId!==ctx.item.id) throw new rules.TransitionError('Attempt belongs to different work.',409,'RESULT_ATTEMPT_SAMPLE_MISMATCH');
        return {id:attemptId,existing:true,status:existing.status};
    }
    const open=await tx.workAttempt.findMany({where:{workItemId:ctx.item.id,status:'OPEN'}});
    if(open.length>1)throw new rules.TransitionError('Resolve the ambiguous OPEN attempts before recording.',409,'WORK_REPEAT_ALREADY_OPEN');
    if(open.length===1)return {id:open[0].id,existing:true,status:'OPEN'};
    const maximum=await tx.workAttempt.aggregate({where:{workItemId:ctx.item.id},_max:{attemptNo:true}});
    const attemptNo=(maximum._max.attemptNo || 0)+1;
    if(attemptNo>1)throw new rules.TransitionError('Request the repeat with a canonical reason before recording.',409,'WORK_ATTEMPT_REASON_REQUIRED');
    return {id:'att-'+ctx.item.id+'-'+randomUUID(),attemptNo,
        reason,existing:false};
}

async function insertExecution(tx,ctx,allocation,evidence,now,metadata={}) {
    rules.requireTransaction(tx);
    if (!allocation) return null;
    const equipmentReadiness=ctx.equipmentReadiness || null;
    const evidenceData=JSON.stringify({...evidence,equipmentReadiness});
    if (JSON.stringify(JSON.parse(evidenceData).equipmentReadiness)!==(ctx.equipmentReadinessText || 'null')) {
        throw new rules.TransitionError('Attempt and Result readiness must match.',409,'WORK_ATTEMPT_EVIDENCE_MISMATCH');
    }
    if(allocation.existing) {
        const existing=await tx.workAttempt.findUnique({where:{id:allocation.id}});
        if(existing.status!=='OPEN') {
            // Existing derived texture evidence may append a calculated value,
            // but cannot refill or alter its already recorded execution.
            if(evidence.source!=='derived')throw new rules.TransitionError('Attempt evidence has already been recorded.',409,'WORK_ATTEMPT_FIRST_FILL_REFUSED');
            return allocation.id;
        }
        await require('./workRepeatBatchService').assertRepeatBatchAllowed(tx,ctx.item,ctx.batchId);
        if(existing.batchId==null && ctx.batchId!=null)await tx.workAttempt.update({where:{id:existing.id},data:{batchId:ctx.batchId,updatedAt:existing.updatedAt}});
        const facts={evidenceData,evidenceHash:createHash('sha256').update(evidenceData).digest('hex'),
            instrumentId:equipmentReadiness?.equipmentId || null,executedMethodRevision:ctx.method?.version == null ? null:String(ctx.method.version),
            author:ctx.performedBy,authorName:ctx.actor?.name || ctx.performedBy,qcBatchId:ctx.batchId,
            materialAliquot:metadata.materialAliquot ?? null};
        if(Object.entries(facts).some(([name,value])=>existing[name]!=null && existing[name]!==value)) {
            throw new rules.TransitionError('The first fill cannot replace recorded facts.',409,'WORK_ATTEMPT_FIRST_FILL_REFUSED');
        }
        const filled=await tx.workAttempt.updateMany({where:{id:existing.id,status:'OPEN',evidenceHash:null},
            data:{...facts,status:'RECORDED',updatedAt:existing.updatedAt}});
        if(filled.count!==1)throw new rules.TransitionError('Attempt changed; reload before recording.',409,'WORK_ATTEMPT_STATE_CHANGED');
        ctx.attemptId=existing.id;
        await require('./workAttemptEventService').appendAttemptEvent(tx,ctx.item,existing.id,ctx.actor || ctx.performedBy,
            {action:'FIRST_FILL',from:'OPEN',to:'RECORDED',reason:existing.reason,note:existing.note,newResultIds:evidence.sourceResultIds || []});
        return existing.id;
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
    await require('./workAttemptEventService').appendAttemptEvent(tx,ctx.item,allocation.id,ctx.actor || ctx.performedBy,
        {action:'CREATED',from:null,to:'RECORDED',reason:allocation.reason,newResultIds:evidence.sourceResultIds || []});
    return allocation.id;
}

module.exports={allocateExecution,insertExecution};
