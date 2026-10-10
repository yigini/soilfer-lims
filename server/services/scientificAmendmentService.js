const {randomUUID}=require('node:crypto');
const rules=require('./workflowStateRules');
const {hasPermission}=require('../config/roles');
const {isNonMeasurement}=require('./workItemKinds');
const fields=new Set(['type','reason','reasonCode','selectedWorkItemIds','affectedResults','affectedReports','impactAssessment']);
const fail=(code,message,status=409)=>new rules.TransitionError(message,status,code);
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
module.exports={requestScientificAmendment};
