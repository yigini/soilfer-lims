const {randomUUID}=require('node:crypto');
const rules=require('./workflowStateRules');
const {hasPermission}=require('../config/roles');
const {isNonMeasurement}=require('./workItemKinds');
const policy=require('./policyService');
const fields=new Set(['type','reason','reasonCode','selectedWorkItemIds','affectedResults','affectedReports','impactAssessment']);
const fail=(code,message,status=409)=>new rules.TransitionError(message,status,code);
const capabilities=new WeakMap();

// Only authoriseScientificAmendment creates a token, after the persisted
// PENDING request wins its CAS in this transaction. No caller can mint one.
function assertScientificReopenCapability(tx,capability,sample,actor,item=null){
 rules.requireTransaction(tx);
 const grant=capability&&typeof capability==='object'?capabilities.get(capability):null;
 if(!grant||grant.tx!==tx||grant.sampleId!==sample.id||grant.labReference!==sample.assignedLab||
  grant.actor!==rules.actorName(actor)||!hasPermission(actor,'APPROVE_RESULTS')||
  item&&(item.sampleId!==sample.id||!grant.selected.has(item.id)))
  throw fail('AMENDMENT_CAPABILITY_REQUIRED','Scientific reopening requires the current authorisation transaction.');
}
function exactIds(value,required=false){
 if(value===undefined&&!required)return[];
 if(!Array.isArray(value)||required&&!value.length||value.some(id=>typeof id!=='string'||!id.trim()||id!==id.trim())||
  new Set(value).size!==value.length)throw fail('AMENDMENT_INPUT_INVALID','Choose distinct exact evidence identifiers.',400);
 return value;
}

// A request records the proposal only. It cannot reopen work, withdraw a
// report, change approval metadata or grant the authorise capability.
async function requestScientificAmendment(db,sampleId,actor,input){
 return rules.inTransaction(db,async tx=>{
  rules.requireTransaction(tx);
  if(!hasPermission(actor,'APPROVE_RESULTS'))throw fail('AMENDMENT_FORBIDDEN','Amendments require approval permission.',403);
  const performedBy=rules.actorName(actor),sample=await tx.sample.findUnique({where:{id:String(sampleId)}});
  if(!sample)throw fail('SAMPLE_NOT_FOUND','Sample not found.',404);
  rules.assertScope(actor,sample);
  if(sample.status!=='APPROVED'||!sample.assignedLab)throw fail('AMENDMENT_SAMPLE_UNAVAILABLE','Scientific amendments require an approved, available laboratory sample.');
  if(!await policy.resolveLab(sample.assignedLab,tx))throw fail('AMENDMENT_SAMPLE_UNAVAILABLE','A registered laboratory is required for scientific amendments.');
  if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(key=>!fields.has(key)))
   throw fail('AMENDMENT_INPUT_INVALID','The amendment request contains unsupported fields.',400);
  if(input.type!==undefined&&input.type!=='SCIENTIFIC')throw fail('AMENDMENT_TYPE_INVALID','Use the workflow for this amendment type.',400);
  if(!['CLIENT_RETEST','CONFIRMATION'].includes(input.reasonCode))throw fail('AMENDMENT_REASON_INVALID','Choose client retest or confirmation.',400);
  const reason=rules.requireReason(input.reason),selected=exactIds(input.selectedWorkItemIds,true);
  if(input.impactAssessment!==undefined&&typeof input.impactAssessment!=='string')throw fail('AMENDMENT_INPUT_INVALID','The impact assessment must be text.',400);
  const items=await tx.workItem.findMany({where:{id:{in:selected},sampleId:sample.id,status:'ACCEPTED',duplicateOf:null}});
  if(items.length!==selected.length||items.some(isNonMeasurement))throw fail('AMENDMENT_LINE_INVALID','Choose current accepted measurement work from this sample.');
  const affected={};
  for(const [field,model]of [['affectedResults','result'],['affectedReports','report']]){
   const ids=exactIds(input[field]);
   if(ids.length&&await tx[model].count({where:{id:{in:ids},sampleId:sample.id}})!==ids.length)
    throw fail('AMENDMENT_EVIDENCE_INVALID','Affected evidence must belong to this sample.');
   affected[field]=ids.length?JSON.stringify(ids):null;
  }
  const now=new Date(),amendment=await tx.sampleAmendment.create({data:{id:randomUUID(),sampleId:sample.id,type:'SCIENTIFIC',status:'PENDING',
   reason,affectedOrderLines:JSON.stringify(selected),...affected,impactAssessment:input.impactAssessment??null,
   requestPayload:JSON.stringify({contract:'210-v1',reasonCode:input.reasonCode}),selectedWorkItemIds:JSON.stringify(selected),
   version:1,createdBy:performedBy,createdAt:now,updatedAt:now}});
  await tx.auditLog.create({data:{id:randomUUID(),entity:'SAMPLE',entityId:sample.id,sampleId:sample.id,labId:sample.assignedLab,
   action:'SAMPLE_AMENDMENT_CREATED',performedBy,performedByName:actor.name||performedBy,timestamp:now,
   details:JSON.stringify({amendmentId:amendment.id,type:'SCIENTIFIC',reason,reasonCode:input.reasonCode,selectedWorkItemIds:selected,status:'PENDING',applied:false}),
   after:JSON.stringify({amendmentId:amendment.id,status:'PENDING',version:1})}});
  return{success:true,amendment};
 });
}
async function authoriseScientificAmendment(db,sampleId,amendmentId,actor,input){
 return rules.inTransaction(db,async tx=>{
  rules.requireTransaction(tx);
  if(!hasPermission(actor,'APPROVE_RESULTS'))throw fail('AMENDMENT_FORBIDDEN','Amendments require approval permission.',403);
  const performedBy=rules.actorName(actor),sample=await tx.sample.findUnique({where:{id:String(sampleId)}});
  if(!sample)throw fail('SAMPLE_NOT_FOUND','Sample not found.',404);
  rules.assertScope(actor,sample);
  if(sample.status!=='APPROVED'||!sample.assignedLab)throw fail('AMENDMENT_SAMPLE_UNAVAILABLE','Scientific amendments require an approved, available laboratory sample.');
  const lab=await policy.resolveLab(sample.assignedLab,tx);
  if(!lab)throw fail('AMENDMENT_SAMPLE_UNAVAILABLE','A registered laboratory is required for scientific amendments.');
  if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(key=>key!=='expectedVersion')||
   !Number.isSafeInteger(input.expectedVersion)||input.expectedVersion<1)
   throw fail('AMENDMENT_INPUT_INVALID','Authorisation requires the exact request version.',400);
  const amendment=await tx.sampleAmendment.findUnique({where:{id:String(amendmentId)}});
  if(!amendment||amendment.sampleId!==sample.id)throw fail('AMENDMENT_NOT_FOUND','Amendment not found.',404);
  if(amendment.type!=='SCIENTIFIC')throw fail('AMENDMENT_TYPE_INVALID','Use the workflow for this amendment type.');
  if(amendment.status!=='PENDING'||amendment.version===null||amendment.version!==input.expectedVersion)
   throw fail('AMENDMENT_STATE_CHANGED','The amendment request changed. Reload before authorising it.');
  let payload,selected;
  try{payload=JSON.parse(amendment.requestPayload);selected=JSON.parse(amendment.selectedWorkItemIds);}catch{/* Never adopt historical evidence. */}
  if(!payload||payload.contract!=='210-v1'||Object.keys(payload).sort().join(',')!=='contract,reasonCode'||
   !['CLIENT_RETEST','CONFIRMATION'].includes(payload.reasonCode)||!Array.isArray(selected)||!selected.length||
   selected.some(id=>typeof id!=='string'||!id.trim()||id!==id.trim())||new Set(selected).size!==selected.length||
   amendment.affectedOrderLines!==JSON.stringify(selected))
   throw fail('AMENDMENT_REQUEST_INVALID','The amendment request evidence is unavailable.');
  const requiresSecondPerson=await policy.get(lab.id,'report.amendmentRequiresSecondPerson',{db:tx});
  const selfAuthorised=amendment.createdBy===performedBy;
  if(requiresSecondPerson&&selfAuthorised)throw fail('AMENDMENT_SECOND_PERSON_REQUIRED','Another authorised user must authorise this amendment.');
  await require('./sampleHoldService').assertNotHeld(tx,sample);
  const items=await tx.workItem.findMany({where:{id:{in:selected},sampleId:sample.id,status:'ACCEPTED',duplicateOf:null}});
  if(items.length!==selected.length||items.some(isNonMeasurement))throw fail('AMENDMENT_LINE_INVALID','Choose current accepted measurement work from this sample.');
  const plans=[];
  for(const item of items){
   let parentId;
   try{parentId=await require('./reviewAttemptService').resolveReviewAttempt(tx,item,'ACCEPT');}
   catch(error){if(!['REVIEW_ATTEMPT_REQUIRED','REVIEW_ATTEMPT_INVALID'].includes(error.code))throw error;throw fail('AMENDMENT_LINE_INVALID','Choose an unambiguous current accepted attempt.');}
   const attempts=await tx.workAttempt.findMany({where:{workItemId:item.id},orderBy:{attemptNo:'asc'}});
   const parent=attempts.find(row=>row.id===parentId);
   if(!parent||parent.status!=='ACCEPTED')throw fail('AMENDMENT_LINE_INVALID','The selected current attempt is not accepted.');
   if(attempts.some(row=>row.status==='OPEN'))throw fail('WORK_REPEAT_ALREADY_OPEN','An OPEN repeat already exists for this work.');
   await require('./workRepeatBatchService').assertRepeatSourceReleased(tx,item);
   await require('./workRepeatService').assertRepeatCapacity(tx,item,sample);
   plans.push({item,parent,attemptNo:Math.max(0,...attempts.map(row=>row.attemptNo))+1});
  }
  const reports=await tx.report.findMany({where:{sampleId:sample.id,status:'PUBLISHED'}});
  if(reports.length>1||reports.some(row=>!row.publishedAt))throw fail('REPORT_WITHDRAWAL_SCOPE_INVALID','The current issued report is unavailable.');
  const now=new Date(),changed=await tx.sampleAmendment.updateMany({where:{id:amendment.id,sampleId:sample.id,status:'PENDING',version:input.expectedVersion},
   data:{status:'APPROVED',version:{increment:1},authorizedBy:performedBy,authorizedAt:now,
    priorApprovedBy:sample.approvedBy,priorApprovedAt:sample.approvedAt,updatedAt:now}});
  if(changed.count!==1)throw fail('AMENDMENT_STATE_CHANGED','The amendment request changed. Reload before authorising it.');
  const capability=Object.freeze({});
 capabilities.set(capability,{tx,amendmentId:amendment.id,version:input.expectedVersion+1,
  sampleId:sample.id,labId:lab.id,labReference:sample.assignedLab,actor:performedBy,selected:new Set(selected)});
  try{
   await require('./sampleStateService').transitionSample(sample.id,'PROCESSING',actor,amendment.reason,{},tx,
    {expectedStatus:'APPROVED',action:'SCIENTIFIC_AMENDMENT_AUTHORISED',amendmentCapability:capability,
     details:JSON.stringify({amendmentId:amendment.id,selectedWorkItemIds:selected,priorApprovedBy:sample.approvedBy,priorApprovedAt:sample.approvedAt})});
   const children=[];
   for(const {item,parent,attemptNo}of plans){
    const child=await tx.workAttempt.create({data:{id:'att-'+item.id+'-'+randomUUID(),workItemId:item.id,attemptNo,status:'OPEN',
     parentAttemptId:parent.id,reason:payload.reasonCode,note:amendment.reason,requestedBy:performedBy,requestedAt:now,createdAt:now,updatedAt:now}});
    await tx.sampleAmendmentAttempt.create({data:{id:randomUUID(),amendmentId:amendment.id,workItemId:item.id,
     parentAttemptId:parent.id,childAttemptId:child.id,reason:payload.reasonCode,createdAt:now}});
    await require('./workAttemptEventService').appendAttemptEvent(tx,{...item,sample},child.id,actor,
     {action:'CREATED',from:null,to:'OPEN',reason:payload.reasonCode,note:amendment.reason});
    const history=rules.requireHistory(item.history);
    history.push({status:'REPEAT_REQUIRED',action:'SCIENTIFIC_AMENDMENT_AUTHORISED',amendmentId:amendment.id,
     attemptId:child.id,parentAttemptId:parent.id,reasonCode:payload.reasonCode,changedBy:performedBy,timestamp:now.toISOString()});
    await require('./workItemStateService').transitionWorkItem(item.id,'REPEAT_REQUIRED',actor,amendment.reason,
     {submissionId:null,submittedAt:null,batchId:null,rackPosition:null,completedAt:null,reviewedBy:null,reviewedAt:null,reviewDecision:null,
      reanalysisReason:amendment.reason,history:JSON.stringify(history)},tx,
     {expected:item,action:'SCIENTIFIC_AMENDMENT_AUTHORISED',amendmentCapability:capability,
      audit:{details:JSON.stringify({amendmentId:amendment.id,attemptId:child.id,parentAttemptId:parent.id,reasonCode:payload.reasonCode})}});
    children.push(child);
   }
   for(const report of reports){
    await tx.reportAmendmentWithdrawal.create({data:{id:randomUUID(),reportId:report.id,amendmentId:amendment.id,createdAt:now}});
    const withdrawn=await tx.report.updateMany({where:{id:report.id,status:'PUBLISHED'},data:{status:'WITHDRAWN',updatedAt:now}});
    if(withdrawn.count!==1)throw fail('REPORT_WITHDRAWAL_STATE_CHANGED','The issued report changed. Reload before authorising.');
   }
   const approved=await tx.sampleAmendment.findUnique({where:{id:amendment.id}});
   await tx.auditLog.create({data:{id:randomUUID(),entity:'SAMPLE',entityId:sample.id,sampleId:sample.id,labId:sample.assignedLab,
    action:'SAMPLE_AMENDMENT_AUTHORISED',performedBy,performedByName:actor.name||performedBy,timestamp:now,
    before:JSON.stringify({amendmentId:amendment.id,status:'PENDING',version:amendment.version}),
    after:JSON.stringify({amendmentId:amendment.id,status:'APPROVED',version:approved.version,priorApprovedBy:approved.priorApprovedBy,
     priorApprovedAt:approved.priorApprovedAt,selfAuthorised,requiresSecondPerson}),
    details:JSON.stringify({amendmentId:amendment.id,type:'SCIENTIFIC',reason:amendment.reason,reasonCode:payload.reasonCode,
     selectedWorkItemIds:selected,attemptIds:children.map(row=>row.id),withdrawnReportIds:reports.map(row=>row.id),selfAuthorised,requiresSecondPerson})}});
   return{success:true,amendment:approved,attempts:children,withdrawnReportIds:reports.map(row=>row.id)};
  }finally{capabilities.delete(capability);}
 });
}
module.exports={requestScientificAmendment,authoriseScientificAmendment,assertScientificReopenCapability};
