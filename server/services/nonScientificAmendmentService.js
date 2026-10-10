const {randomUUID}=require('node:crypto');
const rules=require('./workflowStateRules');
const {hasPermission}=require('../config/roles');
const profile=require('./profileIdentityService');
const policy=require('./policyService');
const TYPES=Object.freeze(['CLERICAL','ORDER','REPORT']);
const fields=new Set(['type','reason','affectedOrderLines','affectedResults','affectedReports','impactAssessment','profileCorrection','expectedProfileRevision']);
const fail=(code,message,status=409)=>new rules.TransitionError(message,status,code);

async function scopedSample(tx,id,actor){
 rules.requireTransaction(tx);
 if(!hasPermission(actor,'APPROVE_RESULTS'))throw fail('AMENDMENT_FORBIDDEN','Amendments require approval permission.',403);
 rules.actorName(actor);
 const sample=await tx.sample.findUnique({where:{id:String(id)}});
 if(!sample)throw fail('SAMPLE_NOT_FOUND','Sample not found.',404);
 rules.assertScope(actor,sample);return sample;
}
function ids(value){
 if(value===undefined)return[];
 if(!Array.isArray(value)||value.some(id=>typeof id!=='string'||!id.trim()||id!==id.trim())||new Set(value).size!==value.length)
  throw fail('AMENDMENT_INPUT_INVALID','Affected evidence must contain distinct exact identifiers.',400);
 return value;
}
async function affectedEvidence(tx,sample,input){
 const result={};
 for(const [field,model]of [['affectedOrderLines','workItem'],['affectedResults','result'],['affectedReports','report']]){
  const selected=ids(input[field]);
  if(selected.length&&await tx[model].count({where:{id:{in:selected},sampleId:sample.id}})!==selected.length)
   throw fail('AMENDMENT_EVIDENCE_INVALID','Affected evidence must belong to this sample.');
  result[field]=selected.length?JSON.stringify(selected):null;
 }
 return result;
}
function profilePlan(sample,correction,expectedRevision,actor,now,conflictCode){
 let field;try{field=typeof sample.fieldMetadata==='string'?JSON.parse(sample.fieldMetadata):sample.fieldMetadata||{};}
 catch{throw new profile.ProfileReferenceConflictError('INVALID_REFERENCE');}
 const revision=Number.isSafeInteger(field.profileReference?.revision)?field.profileReference.revision:0;
 if(!Number.isSafeInteger(expectedRevision)||expectedRevision!==revision)
  throw fail(conflictCode,'The soil profile reference changed. Review it before authorising this correction.');
 let namespace=profile.namespaceFor(sample);
 if(field.profileReference){try{namespace=profile.validateReference(field.profileReference).namespace||namespace;}catch{/* A reasoned correction can repair invalid retained provenance. */}}
 else if(field.profileCompatibility)namespace=require('./sisAdapterService').extractProfileReference(sample,field,{}).profileNamespace||namespace;
 const old=Object.fromEntries(Object.entries(field).filter(([key])=>profile.IDENTITY_KEYS.has(key)));
 const next=profile.captureReference({profileReference:correction},{sample,actor:rules.actorName(actor),source:'CLERICAL_AMENDMENT',
  recordedAt:now.toISOString(),revision:revision+1,authorizedNamespace:namespace});
 return{old,next,field:{...field,profileReference:next}};
}
async function requestNonScientificAmendment(db,sampleId,actor,input){
 return rules.inTransaction(db,async tx=>{
  const sample=await scopedSample(tx,sampleId,actor);
  if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(key=>!fields.has(key)))
   throw fail('AMENDMENT_INPUT_INVALID','The amendment request contains unsupported fields.',400);
  const type=input.type||'CLERICAL';
  if(!TYPES.includes(type))throw fail('AMENDMENT_TYPE_INVALID','Use the authorised workflow for this amendment type.',400);
  const reason=rules.requireReason(input.reason),now=new Date();
  if(input.impactAssessment!==undefined&&typeof input.impactAssessment!=='string')
   throw fail('AMENDMENT_INPUT_INVALID','The impact assessment must be text.',400);
  if(input.profileCorrection!==undefined&&type!=='CLERICAL')throw fail('AMENDMENT_INPUT_INVALID','Profile corrections require a clerical amendment.',400);
  if(input.expectedProfileRevision!==undefined&&input.profileCorrection===undefined)throw fail('AMENDMENT_INPUT_INVALID','A profile revision requires its correction.',400);
  const proposed=input.profileCorrection===undefined?null:profilePlan(sample,input.profileCorrection,input.expectedProfileRevision,actor,now,'PROFILE_REVISION_CONFLICT');
  const evidence=await affectedEvidence(tx,sample,input);
  const payload={contract:'210-v1',...(proposed&&{profileCorrection:input.profileCorrection,expectedProfileRevision:input.expectedProfileRevision})};
  const amendment=await tx.sampleAmendment.create({data:{id:randomUUID(),sampleId:sample.id,type,status:'PENDING',reason,...evidence,
   impactAssessment:input.impactAssessment??null,requestPayload:JSON.stringify(payload),selectedWorkItemIds:'[]',version:1,
   createdBy:rules.actorName(actor),createdAt:now,updatedAt:now}});
  await tx.auditLog.create({data:{id:randomUUID(),entity:'SAMPLE',entityId:sample.id,sampleId:sample.id,labId:sample.assignedLab||null,
   action:'SAMPLE_AMENDMENT_CREATED',performedBy:rules.actorName(actor),performedByName:actor.name||rules.actorName(actor),timestamp:now,
   details:JSON.stringify({amendmentId:amendment.id,type,reason,status:'PENDING',applied:false,...(proposed&&{old:proposed.old,new:proposed.next})}),
   after:JSON.stringify({amendmentId:amendment.id,status:'PENDING',version:1})}});
  return{success:true,amendment};
 });
}
async function authoriseNonScientificAmendment(db,sampleId,amendmentId,actor,input){
 return rules.inTransaction(db,async tx=>{
  const sample=await scopedSample(tx,sampleId,actor);
  if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(key=>key!=='expectedVersion')||
   !Number.isSafeInteger(input.expectedVersion)||input.expectedVersion<1)
   throw fail('AMENDMENT_INPUT_INVALID','Authorisation requires the exact request version.',400);
  const amendment=await tx.sampleAmendment.findUnique({where:{id:String(amendmentId)}});
  if(!amendment||amendment.sampleId!==sample.id)throw fail('AMENDMENT_NOT_FOUND','Amendment not found.',404);
  if(!TYPES.includes(amendment.type))throw fail('AMENDMENT_TYPE_INVALID','Scientific authorisation requires its private workflow capability.');
  if(amendment.status!=='PENDING'||amendment.version===null||amendment.version!==input.expectedVersion)
   throw fail('AMENDMENT_STATE_CHANGED','The amendment request changed. Reload before authorising it.');
  let payload;try{payload=JSON.parse(amendment.requestPayload);}catch{/* Historical or foreign evidence is never adopted. */}
  if(!payload||payload.contract!=='210-v1'||Object.keys(payload).some(key=>!['contract','profileCorrection','expectedProfileRevision'].includes(key))||
   amendment.selectedWorkItemIds!=='[]'||payload.profileCorrection!==undefined&&amendment.type!=='CLERICAL')
   throw fail('AMENDMENT_REQUEST_INVALID','The amendment request evidence is unavailable.');
  const requiresSecondPerson=await policy.get(sample.assignedLab,'report.amendmentRequiresSecondPerson',{db:tx});
  const selfAuthorised=amendment.createdBy===rules.actorName(actor);
  if(requiresSecondPerson&&selfAuthorised)throw fail('AMENDMENT_SECOND_PERSON_REQUIRED','Another authorised user must authorise this amendment.');
  const now=new Date(),correction=payload.profileCorrection===undefined?null:
   profilePlan(sample,payload.profileCorrection,payload.expectedProfileRevision,actor,now,'AMENDMENT_PROFILE_CHANGED');
  const changed=await tx.sampleAmendment.updateMany({where:{id:amendment.id,sampleId:sample.id,status:'PENDING',version:input.expectedVersion},
   data:{status:'APPROVED',version:{increment:1},authorizedBy:rules.actorName(actor),authorizedAt:now,
    priorApprovedBy:sample.approvedBy,priorApprovedAt:sample.approvedAt,updatedAt:now}});
  if(changed.count!==1)throw fail('AMENDMENT_STATE_CHANGED','The amendment request changed. Reload before authorising it.');
  if(correction){
   const updated=await tx.sample.updateMany({where:{id:sample.id,fieldMetadata:sample.fieldMetadata},data:{fieldMetadata:JSON.stringify(correction.field)}});
   if(updated.count!==1)throw fail('AMENDMENT_PROFILE_CHANGED','The soil profile reference changed. Review it before authorising this correction.');
  }
  const approved=await tx.sampleAmendment.findUnique({where:{id:amendment.id}});
  await tx.auditLog.create({data:{id:randomUUID(),entity:'SAMPLE',entityId:sample.id,sampleId:sample.id,labId:sample.assignedLab||null,
   action:'SAMPLE_AMENDMENT_AUTHORISED',performedBy:rules.actorName(actor),performedByName:actor.name||rules.actorName(actor),timestamp:now,
   before:JSON.stringify({amendmentId:amendment.id,status:'PENDING',version:amendment.version}),
   after:JSON.stringify({amendmentId:amendment.id,status:'APPROVED',version:approved.version,priorApprovedBy:approved.priorApprovedBy,
    priorApprovedAt:approved.priorApprovedAt,selfAuthorised,requiresSecondPerson}),
   details:JSON.stringify({amendmentId:amendment.id,type:amendment.type,reason:amendment.reason,selfAuthorised,requiresSecondPerson,
    ...(correction&&{old:correction.old,new:correction.next})})}});
  return{success:true,amendment:approved,...(correction&&{profileReference:correction.next})};
 });
}
module.exports={requestNonScientificAmendment,authoriseNonScientificAmendment};
