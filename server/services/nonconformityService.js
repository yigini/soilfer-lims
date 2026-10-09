const {randomUUID}=require('node:crypto');
const rules=require('./workflowStateRules');
const scopeGuard=require('../utils/scopeGuard');
const {hasPermission}=require('../config/roles');
const {SOURCES,STATUSES}=require('../../shared/nonconformityContract');
const fail=(code,message,status=409)=>new rules.TransitionError(message,status,code);
const meaningful=value=>typeof value==='string' && value.trim().length>0;
function assertScope(actor,row) {
    try {scopeGuard.ensureScope(actor,row,{labField:'labId',altLabField:null});}
    catch {throw fail('NCR_SCOPE_DENIED','The nonconformity is outside your laboratory scope.',403);}
}
async function audit(tx,actor,action,before,after) {
    rules.requireTransaction(tx);
    return tx.auditLog.create({data:{id:randomUUID(),entity:'NONCONFORMITY_REPORT',entityId:after.id,
        action,performedBy:rules.actorName(actor),labId:after.labId,
        before:before?JSON.stringify(before):null,after:JSON.stringify(after),
        details:JSON.stringify({source:after.source,refType:after.refType,refId:after.refId})}});
}
// Called only by the already-authorized source transaction. The source key,
// not a caller-supplied NCR id, supplies deduplication and the retained link.
async function raise(tx,actor,input) {
    rules.requireTransaction(tx);assertScope(actor,input);
    if(!SOURCES.includes(input.source) || !['labId','refType','refId','description'].every(key=>meaningful(input[key])) ||
        input.impactAssessment!=null && !meaningful(input.impactAssessment))throw fail('NCR_INPUT_INVALID','A nonconformity requires its actual source and description.');
    const key={source:input.source,refType:input.refType,refId:input.refId};
    const retained=await tx.nonconformityReport.findUnique({where:{source_refType_refId:key}});
    if(retained) {
        if(retained.labId!==input.labId)throw fail('NCR_SOURCE_SCOPE_MISMATCH','The retained source belongs to another laboratory.');
        return {report:retained,created:false};
    }
    const report=await tx.nonconformityReport.create({data:{id:randomUUID(),labId:input.labId,...key,
        description:input.description.trim(),impactAssessment:input.impactAssessment?.trim() || null,
        firstQcEvaluationId:input.firstQcEvaluationId || null,raisedBy:rules.actorName(actor),status:'OPEN'}});
    await audit(tx,actor,'NCR_RAISED',null,report);
    return {report,created:true};
}
async function transition(db,id,actor,input) {
    if(!hasPermission(actor,'APPROVE_RESULTS'))throw fail('NCR_MANAGEMENT_FORBIDDEN','Nonconformity changes require review authority.',403);
    if(!input || typeof input!=='object' || Array.isArray(input) || Object.keys(input).some(key=>!['status','impactAssessment','correctiveAction'].includes(key)))
        throw fail('NCR_INPUT_INVALID','Choose a supported nonconformity command.');
    return rules.inTransaction(db,async tx=>{
        const before=await tx.nonconformityReport.findUnique({where:{id}});
        if(!before)throw fail('NCR_NOT_FOUND','Nonconformity not found.',404);
        assertScope(actor,before);
        let data;
        if(before.status==='OPEN' && input.status==='ACTION') {
            if(!meaningful(input.impactAssessment) || input.correctiveAction!==undefined)throw fail('NCR_ASSESSMENT_REQUIRED','Record the impact assessment before corrective action.');
            data={status:'ACTION',impactAssessment:input.impactAssessment.trim()};
        } else if(before.status==='ACTION' && input.status==='CLOSED') {
            if(!meaningful(input.correctiveAction) || input.impactAssessment!==undefined)throw fail('NCR_ACTION_REQUIRED','Record the corrective action before closing.');
            data={status:'CLOSED',correctiveAction:input.correctiveAction.trim(),closedBy:rules.actorName(actor),closedAt:new Date()};
        } else throw fail('NCR_TRANSITION_REFUSED','Nonconformities move from open to action to closed.');
        const changed=await tx.nonconformityReport.updateMany({where:{id:before.id,status:before.status,updatedAt:before.updatedAt},data});
        if(changed.count!==1)throw fail('NCR_STATE_CHANGED','The nonconformity changed. Reload before retrying.');
        const after=await tx.nonconformityReport.findUnique({where:{id:before.id}});
        await audit(tx,actor,'NCR_'+after.status,before,after);
        return after;
    });
}
async function list(db,actor,filters={}) {
    if(!hasPermission(actor,'VIEW_AUDIT'))throw fail('NCR_READ_FORBIDDEN','Nonconformity records require QA read authority.',403);
    if(!filters || typeof filters!=='object' || Array.isArray(filters) ||
        Object.keys(filters).some(key=>!['status','source'].includes(key)) ||
        filters.status && !STATUSES.includes(filters.status) || filters.source && !SOURCES.includes(filters.source))
        throw fail('NCR_FILTER_INVALID','Choose a supported status or source filter.',400);
    const where={...(filters.status && {status:filters.status}),...(filters.source && {source:filters.source})};
    try {scopeGuard.getLabScope(actor);}catch{throw fail('NCR_SCOPE_DENIED','A laboratory scope is required.',403);}
    return db.nonconformityReport.findMany({where:scopeGuard.buildScopedWhere(actor,where,
        {labField:'labId',altLabField:null,entityType:'NonconformityReport'}),orderBy:[{createdAt:'desc'},{id:'asc'}]});
}
module.exports={SOURCES,STATUSES,raise,transition,list};
