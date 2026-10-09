const {raise}=require('./nonconformityService');
const rules=require('./workflowStateRules');
// Read only the actual immutable evaluation append. No policy lookup or
// historical-mode inference is allowed at this trigger boundary.
async function raiseCrmFailures(tx,actor,evaluation) {
    rules.requireTransaction(tx);
    const stored=await tx.qcEvaluation.findUnique({where:{id:evaluation.id}});
    let details,criteria;
    try {details=JSON.parse(stored?.details);criteria=typeof details.criteriaSnapshot==='string'?JSON.parse(details.criteriaSnapshot):details.criteriaSnapshot;}catch{return [];}
    if(!['REQUIRED_BLOCKING','REQUIRED_WARN'].includes(criteria?.qcMode))return [];
    const batch=await tx.batch.findUnique({where:{id:stored.batchId}}),created=[];
    for(const control of (details.evaluation?.controls||[]).filter(row=>row.status==='FAIL')) {
        const id=control.positionId||control.id;
        if(!id)continue;
        const position=await tx.batchPosition.findUnique({where:{id},include:{references:true}});
        if(!position||position.batchId!==stored.batchId||position.kind!=='CRM'||
            !position.references.some(row=>row.analysisCode===stored.analysisCode&&row.referenceUse==='CRM'))continue;
        created.push(await raise(tx,actor,{labId:batch.labId,source:'QC',refType:'BatchPosition',refId:position.id,
            firstQcEvaluationId:stored.id,description:`CRM FAIL in batch ${batch.id}, analysis ${stored.analysisCode}, position ${position.position}; first evaluation ${stored.id}.`}));
    }
    return created;
}
module.exports={raiseCrmFailures};
