const Database=require('better-sqlite3');
const {randomUUID}=require('node:crypto');
const {qcGateFixture}=require('../helpers/qcGateFixture');
const {assertOwnedTestDatabase}=require('../helpers/testOwnedDatabase');
const {buildNativeRun,startNativeRun}=require('../../services/qcNativeRunService');
const {writeNativeMeasurements}=require('../../services/qcNativeMeasurementService');
const {dispositionBatch}=require('../../services/qcDispositionStateService');
const {raiseCrmFailures}=require('../../services/nonconformityQcService');
const {createStoredProfileRunFixture}=require('../helpers/storedProfileRunFixture');
const {writeCompatibilityMeasurements}=require('../../services/qcCompatibilityRunService');
const {correctCompatibilityMeasurements}=require('../../services/qcCompatibilityCorrectionService');
const owned=[];
async function fixture(options={}) {
    const f=await qcGateFixture(options);owned.push(f);
    f.ncrSnapshot=async()=>JSON.parse(JSON.stringify(await Promise.all([
        f.db.nonconformityReport.findMany({orderBy:{id:'asc'}}),f.db.auditLog.findMany({orderBy:{id:'asc'}}),
        f.db.qcEvaluation.findMany({orderBy:{id:'asc'}}),f.db.qcMeasurement.findMany({orderBy:{id:'asc'}}),
        f.db.batchDisposition.findMany({orderBy:{id:'asc'}}),f.db.batchEvent.findMany({orderBy:{id:'asc'}}),
        f.db.batch.findMany({orderBy:{id:'asc'}}),f.db.batchAnalyte.findMany({orderBy:{id:'asc'}}),
        f.db.workItem.findMany({orderBy:{id:'asc'}}),f.db.result.findMany({orderBy:{id:'asc'}})])));
    return f;
}
async function crm(f,kind='CRM') {
    const lot=await f.db.referenceMaterial.create({data:{id:randomUUID(),labId:f.labId,code:randomUUID(),name:'Owned NCR CRM',
        kind,matrix:'SOIL',lotNumber:'fixture',status:'ACTIVE',createdBy:f.actor.username}});
    const value=await f.db.referenceValue.create({data:{id:randomUUID(),referenceMaterialId:lot.id,analysisCode:f.analysisCode,
        assignedValue:10,unit:'fixture-unit',valueType:kind==='CRM'?'CERTIFIED':'LAB_ASSIGNED',createdBy:f.actor.username}});
    return {lot,value};
}
async function reviewers(f) {
    const people=[];
    for(let index=0;index<3;index++)people.push(await f.db.user.create({data:{id:randomUUID(),username:'ncr-person-'+randomUUID(),
        email:randomUUID()+'@example.test',password:'fixture',role:'LAB_MANAGER',labId:f.labId,isActive:true}}));
    f.author=people[0];f.reviewers=people.slice(1);
    await f.setPolicy([{key:'qc.reviewedTranscriptionCorrectionEnabled',value:true}]);
}
async function nativeCrm(f) {
    const {lot}=await crm(f),built=await buildNativeRun(f.db,f.actor,{...f.input,analyses:[{analysisCode:f.analysisCode,
        references:[{positionKind:'CRM',referenceMaterialLotId:lot.id}]}]});
    return startNativeRun(f.db,built.id,f.actor);
}
afterAll(async()=>{for(const f of owned)await f.close();});
test('multi-analyte REJECT raises one NCR per actual disposition and a retry preserves both original NCRs',async()=>{
    const f=await fixture({count:2,sharedSample:true,criteria:{blankPerBatch:1,lrmPerBatch:0,duplicateEvery:0,crmEveryNBatches:0}});
    const run=await startNativeRun(f.db,(await buildNativeRun(f.db,f.actor,f.input)).id,f.actor);
    const blank=run.positions.find(row=>row.kind==='BLANK');
    for(const item of f.items)await writeNativeMeasurements(f.db,run.id,f.actor,{analysisCode:item.analysis,measurements:[{positionId:blank.id,value:100}]});
    await dispositionBatch(run.id,'REJECT','Owned rejected measurements',f.actor,f.db);
    const dispositions=await f.db.batchDisposition.findMany({orderBy:{id:'asc'}}),reports=await f.db.nonconformityReport.findMany({where:{refType:'QcDisposition'},orderBy:{refId:'asc'}});
    expect(dispositions).toHaveLength(2);expect(reports).toHaveLength(2);
    expect(reports.map(row=>row.refId).sort()).toEqual(dispositions.map(row=>row.id).sort());
    expect(reports.every(row=>row.source==='QC'&&row.status==='OPEN'&&row.labId===f.labId)).toBe(true);
    for(const row of dispositions)expect(reports.find(report=>report.refId===row.id).description).toContain(row.analysisCode);
    const before=await f.ncrSnapshot();
    expect(await dispositionBatch(run.id,'REJECT','Owned rejected measurements',f.actor,f.db)).toMatchObject({idempotent:true});
    expect(await f.ncrSnapshot()).toEqual(before);
});
test.each(['REQUIRED_BLOCKING','REQUIRED_WARN'])('native CRM failure uses frozen %s and keeps its first evaluation across fail/fail/pass',async mode=>{
    const f=await fixture({criteria:{blankPerBatch:0,lrmPerBatch:0,duplicateEvery:0,crmEveryNBatches:1}});
    await reviewers(f);
    await f.setPolicy([{key:'qc.mode',value:mode}]);const run=await nativeCrm(f),position=run.positions.find(row=>row.kind==='CRM');
    await f.setPolicy([{key:'qc.mode',value:'OFF'}]);
    await writeNativeMeasurements(f.db,run.id,f.author,{measurements:[{positionId:position.id,value:25}]});
    const first=await f.db.qcEvaluation.findFirst({where:{batchId:run.id}}),report=await f.db.nonconformityReport.findFirst({where:{refId:position.id}});
    expect(JSON.parse(first.details).mode).toBe(mode);
    expect(report).toMatchObject({source:'QC',refType:'BatchPosition',refId:position.id,firstQcEvaluationId:first.id,status:'OPEN'});
    for(const [index,value] of [22,10].entries())await writeNativeMeasurements(f.db,run.id,f.reviewers[index],{
        mode:'REVIEWED_TRANSCRIPTION',sourceReference:'Owned original CRM worksheet',analysisCode:f.analysisCode,
        reason:'Owned reasoned CRM correction',corrections:[{positionId:position.id,value}]},{correction:true});
    expect(await f.db.qcEvaluation.count({where:{batchId:run.id}})).toBe(3);
    expect(await f.db.nonconformityReport.count({where:{refId:position.id}})).toBe(1);
    expect(await f.db.nonconformityReport.findUnique({where:{id:report.id}})).toEqual(report);
});
test.each(['ADVISORY','OFF'])('compatibility CRM FAIL recorded in %s raises no NCR',async mode=>{
    const f=await fixture({criteria:{blankPerBatch:0,lrmPerBatch:0,duplicateEvery:0,crmEveryNBatches:0}}),{lot}=await crm(f);
    await f.setPolicy([{key:'qc.mode',value:mode}]);
    const run=await createStoredProfileRunFixture(f.db,{actor:f.actor,input:{analysis:f.analysisCode}});
    await writeCompatibilityMeasurements(f.db,run.id,f.actor,{controls:[{referenceMaterialId:lot.id,referenceUse:'CRM',measured:25}]});
    const stored=await f.db.qcEvaluation.findFirst({where:{batchId:run.id}}),details=JSON.parse(stored.details);
    expect(JSON.parse(details.criteriaSnapshot).qcMode).toBe(mode);expect(details.evaluation.controls[0].status).toBe('FAIL');
    expect(await f.db.nonconformityReport.count()).toBe(0);
});
test('compatibility writes retain actual mode; repeated correction of the same failing CRM position reuses its NCR',async()=>{
    const f=await fixture({criteria:{blankPerBatch:0,lrmPerBatch:0,duplicateEvery:0,crmEveryNBatches:0}}),{lot}=await crm(f),lrm=await crm(f,'LRM');
    await reviewers(f);
    const run=await createStoredProfileRunFixture(f.db,{actor:f.author,input:{analysis:f.analysisCode}});
    await writeCompatibilityMeasurements(f.db,run.id,f.author,{blanks:[{value:0}],duplicates:[{value1:7,value2:7},{value1:7,value2:7}],
        controls:[{referenceMaterialId:lot.id,referenceUse:'CRM',measured:25},{referenceMaterialId:lrm.lot.id,referenceUse:'LRM',measured:10}]});
    const first=await f.db.qcEvaluation.findFirst({where:{batchId:run.id}}),position=await f.db.batchPosition.findFirst({where:{batchId:run.id,kind:'CRM'}});
    const report=await f.db.nonconformityReport.findFirst({where:{refId:position.id}});
    expect(JSON.parse(JSON.parse(first.details).criteriaSnapshot).qcMode).toBe('REQUIRED_BLOCKING');
    expect(report).toMatchObject({firstQcEvaluationId:first.id,status:'OPEN'});
    await correctCompatibilityMeasurements(f.db,run.id,f.reviewers[0],{mode:'REVIEWED_TRANSCRIPTION',sourceReference:'Owned original CRM worksheet',
        analysisCode:f.analysisCode,reason:'Owned persisted CRM correction',corrections:[{positionId:position.id,value:22}]});
    expect(await f.db.nonconformityReport.count({where:{refId:position.id}})).toBe(1);
    expect(await f.db.nonconformityReport.findUnique({where:{id:report.id}})).toEqual(report);
});
test('a persisted CRM failure with no stored mode does not infer NCR eligibility from live policy',async()=>{
    const f=await fixture({criteria:{blankPerBatch:0,lrmPerBatch:0,duplicateEvery:0,crmEveryNBatches:1}});
    await f.setPolicy([{key:'qc.mode',value:'ADVISORY'}]);const run=await nativeCrm(f),position=run.positions.find(row=>row.kind==='CRM');
    await writeNativeMeasurements(f.db,run.id,f.actor,{measurements:[{positionId:position.id,value:25}]});
    const original=await f.db.qcEvaluation.findFirst({where:{batchId:run.id}}),details=JSON.parse(original.details);
    delete details.mode;delete details.criteriaSnapshot;
    await f.setPolicy([{key:'qc.mode',value:'REQUIRED_BLOCKING'}]);
    await f.db.$transaction(async tx=>{
        const stored=await tx.qcEvaluation.create({data:{...original,id:randomUUID(),version:original.version+1,
            evaluatedAt:new Date(),supersedesId:original.id,details:JSON.stringify(details)}});
        expect(await raiseCrmFailures(tx,f.actor,stored)).toEqual([]);
    });
    expect(await f.db.nonconformityReport.count()).toBe(0);
});
test('forced NCR failure rolls back the persisted CRM measurement/evaluation and every related row',async()=>{
    const f=await fixture({criteria:{blankPerBatch:0,lrmPerBatch:0,duplicateEvery:0,crmEveryNBatches:1}}),run=await nativeCrm(f),position=run.positions.find(row=>row.kind==='CRM');
    const raw=new Database(assertOwnedTestDatabase(f.file,'system:fixture'));
    try {
        raw.exec("CREATE TRIGGER owned_qc_ncr_failure BEFORE INSERT ON NonconformityReport BEGIN SELECT RAISE(ABORT,'OWNED_QC_NCR_FAILURE'); END;");
        const before=await f.ncrSnapshot();
        await expect(writeNativeMeasurements(f.db,run.id,f.actor,{measurements:[{positionId:position.id,value:25}]})).rejects.toMatchObject({code:'P2003'});
        expect(await f.ncrSnapshot()).toEqual(before);
    }finally{raw.exec('DROP TRIGGER owned_qc_ncr_failure');raw.close();}
});
