const {renderReportAmendedStatement}=require('./reportAmendedStatement');
const {storedNumber,displayNumber}=require('./reportNumberService');
const {compareReportAmendment}=require('./reportAmendmentComparison');

// #211 pin6097077343: a revision needs exactly one approved, complete #210
// amendment; every refusal happens before any publication write.
const conflict=(code,message,details)=>Object.assign(new Error(message),{statusCode:409,code,...(details&&{details})});
const ISSUED=['PUBLISHED','SUPERSEDED','WITHDRAWN'];

async function issuedLineage(tx,sampleId){
 return tx.report.findMany({where:{sampleId,status:{in:ISSUED},publishedAt:{not:null}},orderBy:{version:'desc'}});
}

async function resolveRevisionAmendment(tx,{sample,amendmentId}){
 const lineage=await issuedLineage(tx,sample.id),previous=lineage[0]||null;
 if(amendmentId!==undefined&&amendmentId!==null&&(typeof amendmentId!=='string'||!amendmentId.trim()))
  throw Object.assign(new Error('The amendment must be an exact identifier.'),{statusCode:400,code:'REPORT_AMENDMENT_INPUT_INVALID'});
 if(!previous){
  if(amendmentId)throw conflict('REPORT_AMENDMENT_NOT_APPLICABLE','A first report is not an amendment.');
  return null;
 }
 if(!amendmentId)throw conflict('REPORT_AMENDMENT_REQUIRED','A revised report requires an approved amendment.');
 const amendment=await tx.sampleAmendment.findUnique({where:{id:amendmentId},include:{attemptLinks:{include:{child:true}}}});
 if(!amendment||amendment.sampleId!==sample.id||amendment.status!=='APPROVED'||amendment.requestPayload===null||
  !Number.isSafeInteger(amendment.version)||amendment.version<2||!amendment.authorizedBy)
  throw conflict('REPORT_AMENDMENT_INVALID','Choose an approved amendment request for this sample.');
 if(await tx.report.findFirst({where:{amendmentId},select:{id:true}}))
  throw conflict('AMENDMENT_ALREADY_CONSUMED','This amendment has already issued a revision.');
 let predecessor;
 if(amendment.type==='SCIENTIFIC'){
  const binding=await tx.reportAmendmentWithdrawal.findFirst({where:{amendmentId},include:{report:true}});
  const children=amendment.attemptLinks.map(link=>link.child);
  if(!children.length||children.some(child=>child.status!=='ACCEPTED')||sample.status!=='APPROVED'||
   !sample.approvedAt||!amendment.authorizedAt||new Date(sample.approvedAt)<=new Date(amendment.authorizedAt))
   throw conflict('AMENDMENT_NOT_COMPLETE','Review and approve the amended work before issuing the revision.');
  predecessor=binding?.report;
  if(!predecessor||predecessor.status!=='WITHDRAWN')throw conflict('REPORT_AMENDMENT_INVALID','The withdrawn report for this amendment is unavailable.');
 }else{
  predecessor=lineage.find(row=>row.status==='PUBLISHED');
  if(!predecessor)throw conflict('REPORT_AMENDMENT_INVALID','A non-scientific revision replaces the current issued report.');
 }
 if(predecessor.id!==previous.id)throw conflict('REPORT_AMENDMENT_INVALID','The amendment does not replace the latest issued report.');
 return{amendment,predecessor};
}

function contentOf(report){
 try{return typeof report.content==='string'?JSON.parse(report.content):report.content;}
 catch{throw conflict('REPORT_AMENDMENT_EVIDENCE_INVALID','The replaced report content is unavailable.');}
}

// Pins6097307274/6097341122 live in reportAmendmentComparison; this freezes its
// outcome into the new content so the PDF never recomputes it.
function applyRevision(content,{amendment,predecessor,statementPolicy,locale}){
 const {contract,changes}=compareReportAmendment(contentOf(predecessor),content,{predecessorReportId:predecessor.id,newReportId:'proposed'});
 const current=new Map(content.resultGroups.flatMap(group=>group.items).map(item=>
  [JSON.stringify([typeof item.analysisId==='string'&&item.analysisId?item.analysisId:item.param,item.basis??null]),item]));
 for(const change of changes){
  if(change.kind==='CHANGED'||change.kind==='ADDED')current.get(JSON.stringify([change.analysisId,change.new.basis]))
   .amendmentChange=change.kind;
 }
 const replacedNumber=predecessor.reportNumberBase||storedNumber(predecessor),replacedRevision=predecessor.revision??0;
 const removed=changes.filter(change=>change.kind==='REMOVED');
 const names=new Map(contentOf(predecessor).resultGroups.flatMap(group=>group.items||[]).map(item=>
  [JSON.stringify([typeof item.analysisId==='string'&&item.analysisId?item.analysisId:item.param,item.basis??null]),item.name]));
 content.amendment={amendmentId:amendment.id,type:amendment.type,reason:amendment.reason,authorizedBy:amendment.authorizedBy,
  authorizedAt:amendment.authorizedAt,replacesReportId:predecessor.id,replacesReportNumber:displayNumber(replacedNumber,replacedRevision),
  statement:renderReportAmendedStatement({policyValue:statementPolicy,locale,replacedNumber,replacedRevision,reason:amendment.reason}),
  comparison:{contract,changes},
  removed:removed.map(change=>({analysisId:change.analysisId,basis:change.old.basis,
   name:names.get(JSON.stringify([change.analysisId,change.old.basis]))||change.analysisId,value:change.old.displayText,unit:change.old.unit}))};
 return content.amendment;
}

module.exports={resolveRevisionAmendment,applyRevision};
