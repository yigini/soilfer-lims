const {randomUUID}=require('node:crypto');

// #211: a revised report needs an approved #210 amendment. Fixtures follow the
// shipped request (v1 PENDING) then authorise (v2 APPROVED) guard sequence.
async function approvedReportAmendment(prisma,sampleId,{type='REPORT',reason='Client requested a corrected report.',createdBy='fixture-requester',authorizedBy='fixture-authoriser'}={}){
 const id='AMD-'+randomUUID(),now=new Date();
 await prisma.sampleAmendment.create({data:{id,sampleId,type,status:'PENDING',reason,requestPayload:JSON.stringify({contract:'210-v1'}),
  selectedWorkItemIds:'[]',version:1,createdBy,createdAt:now,updatedAt:now}});
 return prisma.sampleAmendment.update({where:{id},data:{status:'APPROVED',version:2,authorizedBy,authorizedAt:new Date(now.getTime()+1)}});
}
module.exports={approvedReportAmendment};
