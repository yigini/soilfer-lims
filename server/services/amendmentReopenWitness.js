const {TransitionError}=require('./workflowStateRules');
const policy=require('./policyService');
const invalid=()=>new TransitionError('The scientific amendment attempt link is invalid.',409,'AMENDMENT_ATTEMPT_LINK_INVALID');

// Pin6094281140: a read-only exception to the existing #191 parent witness.
// Neither an action string nor an audit event grants accepted-parent reuse.
async function readAmendmentReopenWitness(db,{item,parent,child,replicateNo}){
 const link=await db.sampleAmendmentAttempt.findUnique({where:{childAttemptId:child.id}});
 if(!link)return null; // The caller retains its ordinary repeat refusal.
 const amendment=await db.sampleAmendment.findUnique({where:{id:link.amendmentId}});
 const sample=await db.sample.findUnique({where:{id:item.sampleId}});
 let payload,selected;
 try{payload=JSON.parse(amendment?.requestPayload);selected=JSON.parse(amendment?.selectedWorkItemIds);}catch{/* Never adopt legacy evidence. */}
 // 210-v1 has exactly one PENDING-v1 -> APPROVED-v2 authorisation. A later
 // version cannot borrow that authorisation's immutable child binding.
 if(!amendment||amendment.type!=='SCIENTIFIC'||amendment.status!=='APPROVED'||amendment.version!==2||
  !amendment.authorizedBy||!amendment.authorizedAt||amendment.sampleId!==item.sampleId||!sample||
  !payload||payload.contract!=='210-v1'||Object.keys(payload).sort().join(',')!=='contract,reasonCode'||
  !['CLIENT_RETEST','CONFIRMATION'].includes(payload.reasonCode)||!Array.isArray(selected)||!selected.length||
  selected.some(id=>typeof id!=='string'||!id.trim()||id!==id.trim())||new Set(selected).size!==selected.length||
  !selected.includes(item.id)||amendment.affectedOrderLines!==JSON.stringify(selected)||item.duplicateOf!=null||
  link.workItemId!==item.id||link.parentAttemptId!==parent.id||link.childAttemptId!==child.id||
  parent.status!=='ACCEPTED'||parent.workItemId!==item.id||child.workItemId!==item.id||child.parentAttemptId!==parent.id||
  child.attemptNo<=parent.attemptNo||link.reason!==child.reason||child.reason!==payload.reasonCode)
  throw invalid();
 const lab=sample.assignedLab?await policy.resolveLab(sample.assignedLab,db):null;
 if(!lab)throw invalid();
 const references=[item.assignedLab,item.labId].filter(value=>value!=null);
 if(!references.length)throw invalid();
 for(const reference of references)if((await policy.resolveLab(reference,db))?.id!==lab.id)throw invalid();
 let original=null;
 if(replicateNo!==undefined){
  if(!Number.isSafeInteger(replicateNo)||replicateNo<1)throw invalid();
  const originals=await db.result.findMany({where:{sampleId:sample.id,param:item.analysis,attemptId:parent.id,
   replicateNo,isCurrent:true,supersededBy:null}});
  if(originals.length!==1)throw invalid();
  original=originals[0];
 }
 return{link,amendment,labId:lab.id,original};
}
module.exports={readAmendmentReopenWitness};
