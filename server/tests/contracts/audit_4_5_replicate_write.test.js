const request = require('supertest');
const { qcGateFixture } = require('../helpers/qcGateFixture');
const { withQcRunHttp } = require('../helpers/qcRunHttpHarness');
const { inTransaction } = require('../../services/workflowStateRules');
const { writeResultsExecution } = require('../../services/resultWriteService');
const { resolveSampleReplicateRules } = require('../../services/sampleReplicatePolicyService');
const { sampleReplicatePairView } = require('../../services/sampleReplicateView');
const owned = [];
afterEach(async () => { for (const f of owned.splice(0)) await f.close(); });
async function fixture(requiredCount=2) {
    const f=await qcGateFixture({criteria:{blankPerBatch:0,lrmPerBatch:0,duplicateEvery:0,crmEveryNBatches:0}});
    owned.push(f);
    await f.setPolicy([{key:'results.replicatesRequired',value:requiredCount},{key:'qc.duplicateMaxRpd',value:10}]);
    f.measurement=(replicateNo,value)=>({param:f.analysisCode,methodologyId:f.method.id,equipmentId:f.instrument.id,replicateNo,value});
    f.record=measurements=>inTransaction(f.db,tx=>writeResultsExecution(tx,{
        sampleId:f.items[0].sampleId,workItemId:f.items[0].id,actor:f.actor,measurements
    }));
    f.save=async measurements=>{
        let response;
        await withQcRunHttp(f.db,f.actor,async(app,token)=>{
            response=await request(app).post('/api/results/'+f.items[0].sampleId)
                .set('Authorization','Bearer '+token).send({measurements});
        },{repeatCommands:true});
        return response;
    };
    f.all=async()=>({evidence:await f.snapshot(),attempts:await f.db.workAttempt.findMany({orderBy:{id:'asc'}}),
        selections:await f.db.reportedValueSelection.findMany({orderBy:{id:'asc'}})});
    f.view=async()=>{
        const rows=await f.db.result.findMany({where:{sampleId:f.items[0].sampleId,isCurrent:true}});
        const rules=await resolveSampleReplicateRules(f.db,{labId:f.labId,analysisCode:f.analysisCode,methodologyId:f.method.id});
        return sampleReplicatePairView(rows,rules);
    };
    return f;
}
test.each([[1,2,'REPLICATE_NOT_REQUIRED'],[2,3,'REPLICATE_NOT_REQUIRED'],[2,4,'REPLICATE_LIMIT']])(
    'count %i refuses a new first-fill replica %i with %s and zero writes',async(count,replicateNo,code)=>{
        const f=await fixture(count),before=await f.all();
        const response=await f.save([f.measurement(replicateNo,'11')]);
        expect({status:response.status,code:response.body.code}).toEqual({status:409,code});
        expect(await f.all()).toEqual(before);
    });
test.each([['10','10.5','PASS'],['10',null,'PENDING'],['<0.1','12','NOT_EVALUABLE']])(
    'a %s / %s pair (%s) refuses a third reading without any writes',async(one,two,status)=>{
        const f=await fixture();
        await f.record([f.measurement(1,one),...(two===null?[]:[f.measurement(2,two)])]);
        expect((await f.view()).status).toBe(status);
        const before=await f.all(),response=await f.save([f.measurement(3,'11')]);
        expect({status:response.status,code:response.body.code}).toEqual({status:409,code:'REPLICATE_NOT_REQUIRED'});
        expect(await f.all()).toEqual(before);
    });
test('10 and 12 at ten percent permit one third reading in the same recorded attempt, without selecting a mean or changing QC',async()=>{
    const f=await fixture(),pair=await f.record([f.measurement(1,'10.0'),f.measurement(2,'12.0')]);
    expect(await f.view()).toMatchObject({status:'FAIL',mean:11});
    const attempt=await f.db.workAttempt.findUnique({where:{id:pair[0].attemptId}});
    const qcEvidence=()=>Promise.all([f.db.qcMeasurement.findMany(),f.db.qcEvaluation.findMany(),f.db.batchQcResult.findMany(),
        f.db.batch.findMany(),f.db.batchDisposition.findMany()]);
    const qcBefore=await qcEvidence();
    const response=await f.save([f.measurement(3,'11.0')]);
    expect(response.status).toBe(200);
    const rows=await f.db.result.findMany({where:{attemptId:attempt.id},orderBy:{replicateNo:'asc'}});
    expect(rows).toHaveLength(3);
    expect(rows.slice(0,2)).toEqual(pair);
    expect(await f.db.workAttempt.findUnique({where:{id:attempt.id}})).toEqual(attempt);
    expect(await f.view()).toMatchObject({status:'REVIEW_REQUIRED',mean:null,rpd:null,range:2});
    expect(await f.db.reportedValueSelection.count()).toBe(0);
    expect(await qcEvidence()).toEqual(qcBefore);
    for(const [replica,code] of [[3,'ATTEMPT_CORRECTION_REQUIRED'],[4,'REPLICATE_LIMIT']]){
        const before=await f.all(),refused=await f.save([f.measurement(replica,'11.1')]);
        expect({status:refused.status,code:refused.body.code}).toEqual({status:409,code});
        expect(await f.all()).toEqual(before);
    }
});
test('three simultaneous first readings cannot manufacture a recorded failing pair',async()=>{
    const f=await fixture(),before=await f.all();
    const response=await f.save([f.measurement(1,'10'),f.measurement(2,'12'),f.measurement(3,'11')]);
    expect({status:response.status,code:response.body.code}).toEqual({status:409,code:'REPLICATE_NOT_REQUIRED'});
    expect(await f.all()).toEqual(before);
});
