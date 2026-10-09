const {qcGateFixture}=require('../helpers/qcGateFixture');
const {withQcRunHttp}=require('../helpers/qcRunHttpHarness');
const request=require('supertest');
const owned=[];
afterEach(async()=>{for(const f of owned.splice(0))await f.close();});
test('actual acceptance uses a started run frozen r after a later method-specific QcRule revision',async()=>{
    const f=await qcGateFixture({criteria:{blankPerBatch:0,lrmPerBatch:0,duplicateEvery:0,crmEveryNBatches:0,ccvEvery:0,repeatabilityLimit:1}});
    owned.push(f);
    await f.setPolicy([{key:'results.replicatesRequired',value:2,analysisCode:f.items[0].analysis,methodologyId:f.method.id}]);
    const native=require('../../services/qcNativeRunService');
    const run=await native.startNativeRun(f.db,(await native.buildNativeRun(f.db,f.actor,f.input)).id,f.actor);
    const item=await f.db.workItem.findUnique({where:{id:f.items[0].id}});
    const results=await require('../../services/workflowStateRules').inTransaction(f.db,tx=>
        require('../../services/resultWriteService').writeResultsExecution(tx,{sampleId:item.sampleId,workItemId:item.id,
            actor:f.actor,measurements:[7,7.5].map((value,index)=>({param:item.analysis,value:String(value),
                equipmentId:f.instrument.id,replicateNo:index+1}))}));
    const frozen=await f.db.batchAnalyte.findFirst({where:{batchId:run.id,analysisCode:item.analysis}});
    await require('../../services/qcRuleService').change(f.actor,{labId:f.labId,analysisCode:item.analysis,methodologyId:f.method.id,
        expectedVersion:1,reason:'Later repeatability review',criteria:{repeatabilityLimit:0.1}},{db:f.db});
    await require('../../services/workItemStateService').transitionWorkItem(item.id,'COMPLETED',f.actor,'Complete owned duplicate measurements',{},f.db);
    await require('../../services/submissionStateService').createSubmissionForItems({db:f.db,actor:f.actor,sampleId:item.sampleId,type:'FULL',workItemIds:[item.id]});
    const retained=await f.db.result.findMany({orderBy:{id:'asc'}});
    await withQcRunHttp(f.db,f.actor,async(app,token)=>{
        const response=await request(app).post('/api/work/'+item.id+'/review').set('Authorization','Bearer '+token).send({decision:'ACCEPT'});
        expect({status:response.status,body:response.body}).toMatchObject({status:200});
    },{reviews:true});
    const selection=await f.db.reportedValueSelection.findFirst();
    expect(selection).toMatchObject({value:7.25,valueText:'7.25',rule:'AUTO_DUPLICATE_MEAN'});
    expect(JSON.parse(selection.qcRuleSnapshot)).toEqual([expect.objectContaining({r:1,qcRuleId:frozen.qcRuleId,qcRuleVersion:1,batchId:run.id})]);
    expect(JSON.parse(selection.resultIds)).toEqual(results.map(row=>row.id).sort());
    expect(await f.db.result.findMany({orderBy:{id:'asc'}})).toEqual(retained);
    expect(await f.db.batchAnalyte.findUnique({where:{id:frozen.id}})).toEqual(frozen);
});
