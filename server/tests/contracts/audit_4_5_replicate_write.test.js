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
    await f.db.workItem.update({where:{id:f.items[0].id},data:{assignedTo:f.actor.username,equipmentId:f.instrument.id}});
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

test('the actual queue keeps a completed first reading editable for replica2, then exposes the failing-pair third action without writes',async()=>{
    const f=await fixture();
    const complete=async(replicateNo,value)=>{
        const item=await f.db.workItem.findUnique({where:{id:f.items[0].id}});
        const entries=[{workItemId:item.id,value,replicateNo,equipmentId:f.instrument.id,version:item.version,basis:'AIR_DRY'}];
        await withQcRunHttp(f.db,f.actor,async(app,token)=>{
            const headers={'Authorization':'Bearer '+token};
            const preview=await request(app).post('/api/workbench/v2/completion/preview').set(headers).send({entries});
            expect({status:preview.status,body:preview.body}).toMatchObject({status:200});
            expect(preview.body.included).toHaveLength(1);
            const commit=await request(app).post('/api/workbench/v2/completion/commit').set(headers).send({entries});
            expect({status:commit.status,body:commit.body}).toMatchObject({status:200,body:{saved:1}});
            expect(commit.body.errors||[]).toHaveLength(0);
        },{workbench:true});
    };
    await complete(1,'10');
    const queue=async()=>{
        let response;
        await withQcRunHttp(f.db,f.actor,async(app,token)=>{
            response=await request(app).get('/api/workbench/queue').set('Authorization','Bearer '+token);
        },{workbench:true});
        expect({status:response.status,body:response.body}).toMatchObject({status:200});
        return response.body.groups.flatMap(group=>group.items);
    };
    let before=await f.all(),rows=await queue();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({status:'COMPLETED',sampleReplicates:{requiredCount:2,status:'PENDING',canAppend:true,canAddThird:false}});
    expect(rows[0].sampleReplicates.measurements.map(row=>row.replicateNo)).toEqual([1]);
    expect(await f.all()).toEqual(before);
    await complete(2,'12');
    before=await f.all();rows=await queue();
    expect(rows[0].sampleReplicates).toMatchObject({status:'FAIL',mean:11,rpd:18.18,canAddThird:true});
    expect(await f.all()).toEqual(before);
    await complete(3,'11');
    before=await f.all();expect(await queue()).toHaveLength(0);
    expect(await f.all()).toEqual(before);
});

test('started native sample pairing uses frozen count/limits and leaves native QC positions, measurements and evaluations byte-identical',async()=>{
    const f=await fixture();
    const {buildNativeRun,startNativeRun}=require('../../services/qcNativeRunService');
    const run=await buildNativeRun(f.db,f.actor,f.input);
    await startNativeRun(f.db,run.id,f.actor);
    await f.record([f.measurement(1,'10'),f.measurement(2,'12')]);
    await f.setPolicy([{key:'results.replicatesRequired',value:1},{key:'qc.duplicateMaxRpd',value:99}]);
    const qc=()=>Promise.all([f.db.batch.findUnique({where:{id:run.id},include:require('../../services/qcRunViewService').QC_RUN_INCLUDE}),
        f.db.qcEvaluation.findMany(),f.db.batchQcResult.findMany(),f.db.reportedValueSelection.findMany()]);
    const before=await qc();
    const rules=await resolveSampleReplicateRules(f.db,{labId:f.labId,analysisCode:f.analysisCode,methodologyId:f.method.id,batchId:run.id});
    expect(rules).toMatchObject({requiredCount:2,source:'FROZEN',policy:{maxRpd:10}});
    expect((await f.save([f.measurement(3,'11')])).status).toBe(200);
    expect(await qc()).toEqual(before);
});
