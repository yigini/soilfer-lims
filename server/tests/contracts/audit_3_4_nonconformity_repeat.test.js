const {randomUUID}=require('node:crypto');
const Database=require('better-sqlite3');
const request=require('supertest');
const {qcGateFixture}=require('../helpers/qcGateFixture');
const {withQcRunHttp}=require('../helpers/qcRunHttpHarness');
const {assertOwnedTestDatabase}=require('../helpers/testOwnedDatabase');
const {inTransaction}=require('../../services/workflowStateRules');
const {writeResultsExecution}=require('../../services/resultWriteService');
const owned=[],input={reason:'INSTRUMENT_FAULT',note:'Recorded instrument alarm',description:'Repeat beyond the reviewed limit',impactAssessment:'No accepted report; fresh execution required'};
async function fixture() {
    const f=await qcGateFixture({criteria:{blankPerBatch:0,lrmPerBatch:0,duplicateEvery:0,crmEveryNBatches:0}});owned.push(f);
    const user=await f.db.user.create({data:{id:randomUUID(),username:'ncr-repeat-'+randomUUID(),email:randomUUID()+'@example.test',password:'fixture',role:'LAB_MANAGER',labId:f.labId}});
    f.actor=user;
    await f.db.workItem.update({where:{id:f.items[0].id},data:{assignedTo:user.username,equipmentId:f.instrument.id}});
    f.record=()=>inTransaction(f.db,tx=>writeResultsExecution(tx,{sampleId:f.items[0].sampleId,workItemId:f.items[0].id,actor:f.actor,
        measurements:[{param:f.analysisCode,value:'7',equipmentId:f.instrument.id,replicateNo:1}]}));
    await f.record();await f.setPolicy([{key:'repeats.maxAttemptsBeforeNcr',value:1}]);
    f.all=async()=>JSON.parse(JSON.stringify([await f.snapshot(),await f.db.workAttempt.findMany({orderBy:{id:'asc'}}),await f.db.nonconformityReport.findMany({orderBy:{id:'asc'}})]));
    f.command=async(payload=input,actor=f.actor,override=true,connection=f.db)=>{
        let response;await withQcRunHttp(connection,actor,async(app,token)=>{
            response=await request(app).post('/api/work-items/'+f.items[0].id+'/repeats'+(override?'/limit-override':''))
                .set('Authorization','Bearer '+token).send(payload);
        },{repeatCommands:true});return response;
    };
    return f;
}
afterEach(async()=>{for(const f of owned.splice(0))await f.close();});
test('the actual manager command creates one child, its unique NCR and immutable CREATED link atomically; the next child needs another NCR',async()=>{
    const f=await fixture(),first=await f.command();expect(first.status).toBe(201);
    const child=first.body.attempt,report=await f.db.nonconformityReport.findFirst();
    expect(report).toMatchObject({source:'REPEAT_LIMIT',refType:'WorkAttempt',refId:child.id,labId:f.labId,status:'OPEN',description:input.description,impactAssessment:input.impactAssessment,raisedBy:f.actor.username});
    const event=await f.db.auditLog.findFirst({where:{entity:'WORK_ATTEMPT',entityId:child.id,action:'CREATED'}});
    expect(JSON.parse(event.details)).toMatchObject({nonconformityId:report.id,reason:input.reason,to:'OPEN'});
    expect(await f.db.workAttempt.count()).toBe(2);
    const before=await f.all(),retry=await f.command();expect(retry.status).toBe(409);expect(retry.body.code).toBe('WORK_REPEAT_ALREADY_OPEN');expect(await f.all()).toEqual(before);
    await f.record();
    const atNextLimit=await f.all(),ordinary=await f.command({reason:input.reason},f.actor,false);
    expect(ordinary.status).toBe(409);expect(ordinary.body.code).toBe('ATTEMPT_LIMIT');expect(await f.all()).toEqual(atNextLimit);
    const reused=await f.command({...input,ncrId:report.id});expect(reused.status).toBe(400);expect(reused.body.code).toBe('REPEAT_FIELDS_INVALID');expect(await f.all()).toEqual(atNextLimit);
    const next=await f.command();expect(next.status).toBe(201);expect(next.body.attempt.id).not.toBe(child.id);
    const reports=await f.db.nonconformityReport.findMany();expect(reports).toHaveLength(2);
    expect(reports.find(row=>row.id===report.id)).toEqual(report);
    expect(reports.find(row=>row.refId===next.body.attempt.id).id).not.toBe(report.id);
});
test.each(['SUPER_ADMIN','MASTER_USER','LAB_MANAGER','LAB_TECHNICIAN'])('ordinary over-limit repeat by %s refuses with no NCR or other writes',async role=>{
    const f=await fixture();await f.db.user.update({where:{id:f.actor.id},data:{role}});const before=await f.all();
    const response=await f.command({reason:input.reason},{...f.actor,role},false);
    expect(response.status).toBe(409);expect(response.body.code).toBe('ATTEMPT_LIMIT');expect(await f.all()).toEqual(before);
});
test.each([0,2])('the explicit override refuses below the configured limit %s, including unlimited policy',async limit=>{
    const f=await fixture();await f.setPolicy([{key:'repeats.maxAttemptsBeforeNcr',value:limit}]);const before=await f.all(),response=await f.command();
    expect(response.status).toBe(409);expect(response.body.code).toBe('ATTEMPT_LIMIT_OVERRIDE_NOT_NEEDED');expect(await f.all()).toEqual(before);
});
test.each([
    [{...input,description:''},409,'NCR_ASSESSMENT_REQUIRED'],[{...input,impactAssessment:'  '},409,'NCR_ASSESSMENT_REQUIRED'],
    [{...input,reason:'OTHER',note:''},400,'REPEAT_NOTE_REQUIRED'],[{...input,reason:'TRANSCRIPTION_ERROR'},409,'ATTEMPT_CORRECTION_REQUIRED'],
    [{...input,reason:'CLIENT_RETEST'},409,'AMENDMENT_WORKFLOW_REQUIRED'],[{...input,ncrId:'unchecked'},400,'REPEAT_FIELDS_INVALID']
])('override input %j retains every existing reason/assessment guard with zero writes',async(payload,status,code)=>{
    const f=await fixture(),before=await f.all(),response=await f.command(payload);expect(response.status).toBe(status);expect(response.body.code).toBe(code);expect(await f.all()).toEqual(before);
});
test('the actual API refuses a technician and a foreign-lab manager with zero writes',async()=>{
    const f=await fixture();await f.db.user.update({where:{id:f.actor.id},data:{role:'LAB_TECHNICIAN'}});const before=await f.all();
    expect((await f.command(input,{...f.actor,role:'LAB_TECHNICIAN'})).status).toBe(403);expect(await f.all()).toEqual(before);
    const lab=await f.db.lab.create({data:{id:randomUUID(),code:randomUUID(),name:'Owned foreign repeat lab',country:'TEST'}});
    const other=await f.db.user.create({data:{id:randomUUID(),username:'foreign-repeat-'+randomUUID(),email:randomUUID()+'@example.test',password:'fixture',role:'LAB_MANAGER',labId:lab.id}});
    const foreignBefore=await f.all();expect((await f.command(input,other)).status).toBe(403);expect(await f.all()).toEqual(foreignBefore);
});
test('forced NCR or CREATED-event audit failure rolls the parent, child, NCR, result, history and every audit row back',async()=>{
    for(const target of ['ncr','event']) {
        const f=await fixture(),raw=new Database(assertOwnedTestDatabase(f.file,'system:fixture'));
        try {
            raw.exec(target==='ncr'?"CREATE TRIGGER owned_repeat_failure BEFORE INSERT ON NonconformityReport BEGIN SELECT RAISE(ABORT,'OWNED_REPEAT_FAILURE'); END;":
                "CREATE TRIGGER owned_repeat_failure BEFORE INSERT ON AuditLog WHEN NEW.entity='WORK_ATTEMPT' AND NEW.action='CREATED' BEGIN SELECT RAISE(ABORT,'OWNED_REPEAT_FAILURE'); END;");
            const before=await f.all(),response=await f.command();expect(response.status).toBe(500);expect(response.body.code).toBe('P2003');expect(await f.all()).toEqual(before);
        }finally{raw.exec('DROP TRIGGER owned_repeat_failure');raw.close();}
    }
});
