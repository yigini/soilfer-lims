const {TransitionError}=require('./workflowStateRules');

async function readReportWithdrawal(db,report){
 if(report.status!=='WITHDRAWN')return null;
 const binding=await db.reportAmendmentWithdrawal.findUnique({where:{reportId:report.id},include:{amendment:true}});
 if(!binding||binding.amendment.sampleId!==report.sampleId||binding.amendment.type!=='SCIENTIFIC'||
  binding.amendment.status!=='APPROVED'||!Number.isSafeInteger(binding.amendment.version)||binding.amendment.version<2)
  throw new TransitionError('The retained withdrawal evidence is unavailable.',409,'REPORT_WITHDRAWAL_EVIDENCE_REQUIRED');
 return{amendmentId:binding.amendmentId,createdAt:binding.createdAt};
}
module.exports={readReportWithdrawal};
