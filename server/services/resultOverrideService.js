const {randomUUID}=require('node:crypto');
const workflow=require('./workflowStateRules');
const scopeGuard=require('../utils/scopeGuard');
const {hasPermission}=require('../config/roles');
const policyService=require('./policyService');
const CONTEXT_FIELDS=['labId','workItemId','sampleId','analysisCode','replicateNo','rawValue','unit','basis',
    'methodologyId','methodRevision','instrumentId','rulesSha256'];
const fail=(code,message,status=409)=>new workflow.TransitionError(message,status,code);
const meaningful=value=>typeof value==='string'&&value.trim().length>0;
async function identity(db,actor){
    const user=await db.user.findUnique({where:{username:workflow.actorName(actor)}});
    if(!user)throw fail('OVERRIDE_ACTOR_REQUIRED','An authenticated user is required.',403);
    return user.id;
}
async function assertScope(db,actor,row){
    const lab=actor.labId?await policyService.resolveLab(actor.labId,db):null;
    try{scopeGuard.ensureScope({...actor,labId:lab?.id||actor.labId},row,{labField:'labId',altLabField:null});}
    catch{throw fail('OVERRIDE_SCOPE_DENIED','The request belongs to another laboratory.',403);}
}
async function contextEvidence(db,resolved,measurement){
    const {ctx}=resolved,lab=await policyService.resolveLab(ctx.labId,db);
    if(!lab||!ctx.item)throw fail('OVERRIDE_CONTEXT_CHANGED','The recording context is unavailable.');
    return {labId:lab.id,workItemId:ctx.item.id,sampleId:ctx.sample.id,analysisCode:measurement.param,
        replicateNo:Number(measurement.replicateNo??1),rawValue:measurement.value,unit:resolved.unit,basis:ctx.basis,
        methodologyId:ctx.methodId,methodRevision:ctx.method?.version!=null?String(ctx.method.version):ctx.item.methodRevision??null,
        instrumentId:ctx.equipmentId,rulesSha256:resolved.rulesSha256};
}
async function audit(tx,actor,action,before,after){
    workflow.requireTransaction(tx);
    await tx.auditLog.create({data:{id:randomUUID(),entity:'RESULT_OVERRIDE_REQUEST',entityId:after.id,action,
        performedBy:workflow.actorName(actor),labId:after.labId,before:before?JSON.stringify(before):null,after:JSON.stringify(after),
        details:JSON.stringify({overrideRequestId:after.id,approverId:after.decidedBy,consumedResultId:after.consumedResultId})}});
}
function mapError(error){
    if(error instanceof workflow.TransitionError)return error;
    const message=String(error.message||'')+' '+JSON.stringify(error.meta||{});
    const code=message.match(/\bOVERRIDE_[A-Z_]+\b/)?.[0];
    if(code)return fail(code,'The database refused an invalid override request.');
    if(error.code==='P2002')return fail('OVERRIDE_REQUEST_ACTIVE','This cell already has an active request.');
    return workflow.mapStateError(error);
}
async function request(db,workItemId,actor,input){
    return workflow.inTransaction(db,async tx=>{
        if(!meaningful(input?.reason)||typeof input?.value!=='string')throw fail('OVERRIDE_REASON_REQUIRED','Enter the exact value and a reason.',400);
        const item=await tx.workItem.findUnique({where:{id:workItemId}});
        if(!item)throw fail('WORK_ITEM_NOT_FOUND','Work item not found.',404);
        const measurement=require('./resultWriteService').selectMeasurement({...input,param:item.analysis});
        delete measurement.overrideRequestId;delete measurement.overrideReason;
        const resolved=await require('./resultWriteService').resolveResultValidationContext(tx,{
            sampleId:item.sampleId,workItemId,actor,measurement});
        if(!resolved.validation.canOverride)throw fail('OVERRIDE_VALUE_INELIGIBLE','Only a hard range refusal can be requested.');
        const evidence=await contextEvidence(tx,resolved,measurement);
        if(await tx.resultOverrideRequest.findFirst({where:{workItemId,replicateNo:evidence.replicateNo,status:{in:['REQUESTED','APPROVED']}}}))
            throw fail('OVERRIDE_REQUEST_ACTIVE','This cell already has an active request.');
        const row=await tx.resultOverrideRequest.create({data:{id:randomUUID(),...evidence,flags:JSON.stringify(resolved.validation.flags),
            reason:input.reason.trim(),requestedBy:await identity(tx,actor),status:'REQUESTED'}});
        await audit(tx,actor,'OVERRIDE_REQUESTED',null,row);return row;
    }).catch(error=>{throw mapError(error);});
}
async function rowForActor(db,id,actor){
    const row=await db.resultOverrideRequest.findUnique({where:{id}});
    if(!row)throw fail('OVERRIDE_REQUEST_NOT_FOUND','Override request not found.',404);
    await assertScope(db,actor,row);return row;
}
async function decide(db,id,actor,input){
    if(!hasPermission(actor,'APPROVE_RESULTS'))throw fail('OVERRIDE_DECISION_FORBIDDEN','Review authority is required.',403);
    return workflow.inTransaction(db,async tx=>{
        const before=await rowForActor(tx,id,actor),actorId=await identity(tx,actor);
        if(before.requestedBy===actorId)throw fail('OVERRIDE_SELF_APPROVAL_FORBIDDEN','A different reviewer must decide this request.',403);
        if(before.status!=='REQUESTED')throw fail('OVERRIDE_REQUEST_CLOSED','The request cannot receive another decision.');
        if(!['APPROVED','REJECTED'].includes(input?.status)||!meaningful(input?.reason))throw fail('OVERRIDE_DECISION_REASON_REQUIRED','Choose a decision and enter its reason.',400);
        const updated=await tx.resultOverrideRequest.updateMany({where:{id,status:'REQUESTED'},data:{status:input.status,
            decidedBy:actorId,decidedAt:new Date(),decisionReason:input.reason.trim()}});
        if(updated.count!==1)throw fail('OVERRIDE_REQUEST_CHANGED','The request changed; reload it.');
        const after=await tx.resultOverrideRequest.findUnique({where:{id}});await audit(tx,actor,'OVERRIDE_'+after.status,before,after);return after;
    }).catch(error=>{throw mapError(error);});
}
async function cancel(db,id,actor,input){
    return workflow.inTransaction(db,async tx=>{
        const before=await rowForActor(tx,id,actor),actorId=await identity(tx,actor);
        if(before.requestedBy!==actorId&&!hasPermission(actor,'APPROVE_RESULTS'))throw fail('OVERRIDE_CANCEL_FORBIDDEN','Only the requester or a reviewer may cancel.',403);
        if(before.status==='CANCELLED')return before;
        if(!['REQUESTED','APPROVED'].includes(before.status))throw fail('OVERRIDE_REQUEST_CLOSED','A rejected or consumed request cannot be cancelled.');
        if(!meaningful(input?.reason))throw fail('OVERRIDE_CANCEL_REASON_REQUIRED','Enter a cancellation reason.',400);
        const updated=await tx.resultOverrideRequest.updateMany({where:{id,status:before.status},data:{status:'CANCELLED',
            cancelledBy:actorId,cancelledAt:new Date(),cancelReason:input.reason.trim()}});
        if(updated.count!==1)throw fail('OVERRIDE_REQUEST_CHANGED','The request changed; reload it.');
        const after=await tx.resultOverrideRequest.findUnique({where:{id}});await audit(tx,actor,'OVERRIDE_CANCELLED',before,after);return after;
    }).catch(error=>{throw mapError(error);});
}
async function available(db,id,actor){
    if(!meaningful(id))throw fail('OVERRIDE_REQUEST_NOT_FOUND','Choose an approved request.',404);
    const row=await rowForActor(db,id,actor);
    if(row.status!=='APPROVED')throw fail('OVERRIDE_REQUEST_CLOSED','This request is not an unused approval.');
    return row;
}
async function matchApproval(tx,ctx,measurement,resolved){
    workflow.requireTransaction(tx);
    const row=await available(tx,measurement.overrideRequestId,ctx.actor);
    const evidence=await contextEvidence(tx,{...resolved,ctx},measurement);
    if(CONTEXT_FIELDS.some(key=>row[key]!==evidence[key])||!resolved.validation.canOverride)
        throw fail('OVERRIDE_CONTEXT_CHANGED','The value or recording context changed; cancel and request again.');
    return row;
}
async function consume(tx,actor,before,result,now){
    workflow.requireTransaction(tx);
    const changed=await tx.resultOverrideRequest.updateMany({where:{id:before.id,status:'APPROVED'},data:{status:'CONSUMED',
        consumedResultId:result.id,consumedAt:now}});
    if(changed.count!==1)throw fail('OVERRIDE_REQUEST_CHANGED','The approval was already used or changed.');
    const after=await tx.resultOverrideRequest.findUnique({where:{id:before.id}});
    await audit(tx,actor,'OVERRIDE_CONSUMED',before,after);
    return {requestId:after.id,approverId:after.decidedBy,approvedAt:after.decidedAt,decisionReason:after.decisionReason};
}
async function list(db,actor,{workItemId}={}){
    if(!hasPermission(actor,'ENTER_RESULTS')&&!hasPermission(actor,'APPROVE_RESULTS'))throw fail('OVERRIDE_READ_FORBIDDEN','Result authority is required.',403);
    const lab=actor.labId?await policyService.resolveLab(actor.labId,db):null,scoped={...actor,labId:lab?.id||actor.labId};
    const where={...(workItemId&&{workItemId}),...(!hasPermission(actor,'APPROVE_RESULTS')&&{requestedBy:await identity(db,actor)})};
    try{scopeGuard.getLabScope(scoped);}catch{throw fail('OVERRIDE_SCOPE_DENIED','A laboratory scope is required.',403);}
    return db.resultOverrideRequest.findMany({where:scopeGuard.buildScopedWhere(scoped,where,{labField:'labId',altLabField:null,entityType:'ResultOverrideRequest'}),orderBy:[{requestedAt:'desc'},{id:'asc'}]});
}
async function resultApprovals(db,rows){
    const ids=rows.filter(row=>{try{return JSON.parse(row.flags||'[]').includes('OVERRIDE_APPROVED');}catch{return false;}}).map(row=>row.id);
    if(!ids.length)return new Map();
    const requests=await db.resultOverrideRequest.findMany({where:{status:'CONSUMED',consumedResultId:{in:ids}}});
    return new Map(requests.map(row=>[row.consumedResultId,{requestId:row.id,approverId:row.decidedBy,approvedAt:row.decidedAt,decisionReason:row.decisionReason}]));
}
async function preflightApprovedMeasurements(db,sampleId,actor,measurements){
    for(const measurement of measurements.filter(row=>row?.overrideRequestId)){
        await available(db,measurement.overrideRequestId,actor);
        try{
            const resolved=await require('./resultWriteService').resolveResultValidationContext(db,{sampleId,actor,measurement});
            await matchApproval(db,resolved.ctx,measurement,resolved);
        }catch(error){throw mapContextError(error);}
    }
}
const CHANGED_CODES=new Set(['RESULT_INSTRUMENT_MISMATCH','RESULT_METHOD_REVISION_CHANGED','RESULT_METHOD_MISMATCH','RESULT_UNIT_MISMATCH',
    'RESULT_PARAMETER_MISMATCH','RESULT_EXECUTION_CONTEXT_MISMATCH','ATTEMPT_CONTEXT_MISMATCH']);
function mapContextError(error){return CHANGED_CODES.has(error.code)?fail('OVERRIDE_CONTEXT_CHANGED','The recording context changed; cancel and request again.'):mapError(error);}
module.exports={CONTEXT_FIELDS,request,decide,cancel,list,available,matchApproval,consume,resultApprovals,preflightApprovedMeasurements,mapError,mapContextError};
