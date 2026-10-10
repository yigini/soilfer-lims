const rules=require('./workflowStateRules');
const {hasPermission}=require('../config/roles');
const receipts=require('./commandReceiptService');
const fail=(code,message,status=409)=>new rules.TransitionError(message,status,code);

async function scopedSample(tx,sampleId,actor){
 rules.requireTransaction(tx);
 if(!hasPermission(actor,'APPROVE_RESULTS'))throw fail('AMENDMENT_FORBIDDEN','Amendments require approval permission.',403);
 rules.actorName(actor);
 const sample=await tx.sample.findUnique({where:{id:String(sampleId)}});
 if(!sample)throw fail('SAMPLE_NOT_FOUND','Sample not found.',404);
 rules.assertScope(actor,sample);return sample;
}
function transport(input,headerKey){
 if(!input||typeof input!=='object'||Array.isArray(input))throw fail('AMENDMENT_INPUT_INVALID','Provide an amendment command.',400);
 const {idempotencyKey,...payload}=input,key=idempotencyKey||headerKey;
 if(key!==undefined&&(typeof key!=='string'||!key.trim()||key!==key.trim())||
  idempotencyKey&&headerKey&&idempotencyKey!==headerKey)
  throw fail('AMENDMENT_INPUT_INVALID','Use one exact operation key.',400);
 return{payload,key};
}
async function command(db,{sampleId,amendmentId,actor,input,headerKey,authorise=false}){
 const {payload,key}=transport(input,headerKey),actorName=rules.actorName(actor);
 const commandType=authorise?'AUTHORISE_AMENDMENT':'CREATE_AMENDMENT';
 const targetResource=authorise?`Sample:${sampleId}/Amendment:${amendmentId}`:`Sample:${sampleId}`;
 const payloadHash=receipts.computePayloadHash(payload);
 return rules.inTransaction(db,async tx=>{
  const sample=await scopedSample(tx,sampleId,actor);
  if(key){
   const previous=await receipts.checkReceipt(key,commandType,actorName,targetResource,payloadHash,tx);
   if(previous.conflict||previous.isExisting&&(!previous.receipt.parsedOutcome?.payloadHash||
    previous.receipt.parsedOutcome?.amendment?.version==null))
    throw fail('IDEMPOTENCY_CONFLICT','This operation key belongs to another amendment command. Your input is preserved.');
   if(previous.isExisting)return previous.receipt.parsedOutcome;
  }
  let outcome;
  if(authorise){
   const amendment=await tx.sampleAmendment.findUnique({where:{id:String(amendmentId)}});
   if(!amendment||amendment.sampleId!==sample.id)throw fail('AMENDMENT_NOT_FOUND','Amendment not found.',404);
   const service=amendment.type==='SCIENTIFIC'?require('./scientificAmendmentService').authoriseScientificAmendment:
    require('./nonScientificAmendmentService').authoriseNonScientificAmendment;
   outcome=await service(tx,sample.id,amendment.id,actor,payload);
  }else{
   // Retain the existing disposed-material refusal for non-scientific types.
   // Scientific lifecycle checks belong to their closed authorisation owner.
   if(sample.status==='DISPOSED'&&payload.type&&payload.type!=='CLERICAL'&&payload.type!=='SCIENTIFIC')
    throw fail('DISPOSED_MATERIAL_IMMUTABLE','Disposed material only permits clerical amendments.',400);
   const service=payload.type==='SCIENTIFIC'?require('./scientificAmendmentService').requestScientificAmendment:
    require('./nonScientificAmendmentService').requestNonScientificAmendment;
   outcome=await service(tx,sample.id,actor,payload);
  }
  if(key)await receipts.recordReceipt(tx,{idempotencyKey:key,commandType,targetResource,actor:actorName,outcome,payloadHash});
  return outcome;
 });
}
async function listAmendments(db,sampleId,actor){
 return rules.inTransaction(db,async tx=>{
  const sample=await scopedSample(tx,sampleId,actor);
  const amendments=await tx.sampleAmendment.findMany({where:{sampleId:sample.id},orderBy:[{createdAt:'desc'},{id:'asc'}]});
  const requiresSecondPerson=await require('./policyService').get(sample.assignedLab,'report.amendmentRequiresSecondPerson',{db:tx});
  return{amendments,requiresSecondPerson};
 });
}
module.exports={command,listAmendments};
