const { randomUUID } = require('node:crypto');
const request = require('supertest');
const { qcGateFixture } = require('../helpers/qcGateFixture');
const { withQcRunHttp } = require('../helpers/qcRunHttpHarness');
const { inTransaction } = require('../../services/workflowStateRules');
const { writeResultsExecution } = require('../../services/resultWriteService');
const owned = [];
afterEach(async () => { for (const f of owned.splice(0)) await f.close(); });

async function fixture({ replicates = 1, role = 'LAB_TECHNICIAN' } = {}) {
    const f = await qcGateFixture(); owned.push(f);
    const username = 'repeat-actor-' + randomUUID();
    const user = await f.db.user.create({ data: { id: randomUUID(), username, email: randomUUID() + '@example.test',
        password: 'owned-http-fixture', role, labId: f.labId } });
    f.actor = { id: user.id, username, role, labId: f.labId };
    await f.db.workItem.update({ where: { id: f.items[0].id }, data: { assignedTo: username, equipmentId: f.instrument.id } });
    f.record = async (count = 1, extra = {}) => inTransaction(f.db, tx => writeResultsExecution(tx, {
        sampleId: f.items[0].sampleId, workItemId: f.items[0].id, actor: f.actor,
        measurements: Array.from({ length: count }, (_, index) => ({ param: f.analysisCode, value: String(7 + index / 10),
            equipmentId: f.instrument.id, replicateNo: index + 1 })), ...extra
    }));
    f.results = await f.record(replicates);
    f.attempt = await f.db.workAttempt.findUnique({ where: { id: f.results[0].attemptId } });
    f.all = async () => ({ evidence: await f.snapshot(), attempts: await f.db.workAttempt.findMany({ orderBy: { id:'asc' } }) });
    f.http = (actor, exercise) => withQcRunHttp(f.db, actor, exercise, { repeatCommands: true, reviews: true });
    f.command = async (input, actor = f.actor) => {
        let response;
        await f.http(actor, async (app,token) => { response = await request(app).post('/api/work-items/' + f.items[0].id + '/repeats')
            .set('Authorization','Bearer ' + token).send(input); });
        return response;
    };
    f.correction = async (input, actor = f.actor) => {
        let response;
        await f.http(actor, async (app,token) => { response = await request(app).post('/api/attempts/' + f.attempt.id + '/corrections')
            .set('Authorization','Bearer ' + token).send(input); });
        return response;
    };
    return f;
}
async function reviewer(f) {
    const user = await f.db.user.create({ data: { id:randomUUID(),username:'repeat-reviewer-' + randomUUID(),
        email:randomUUID() + '@example.test',password:'owned-http-fixture',role:'LAB_MANAGER',labId:f.labId } });
    return { id:user.id,username:user.username,role:user.role,labId:f.labId };
}

test('a scoped technician requests INSTRUMENT_FAULT before submission, reserving exactly one immutable OPEN attempt', async () => {
    const f=await fixture(), previous=f.attempt;
    const response=await f.command({reason:'INSTRUMENT_FAULT',note:'Instrument alarm confirmed',sameBatchAllowed:false});
    expect(response.status).toBe(201);
    const attempts=await f.db.workAttempt.findMany({where:{workItemId:f.items[0].id},orderBy:{attemptNo:'asc'}});
    expect(attempts).toHaveLength(2);
    expect(attempts[0]).toEqual({...previous,status:'INVALIDATED'});
    expect(attempts[1]).toMatchObject({attemptNo:2,status:'OPEN',parentAttemptId:previous.id,reason:'INSTRUMENT_FAULT',
        note:'Instrument alarm confirmed',requestedBy:f.actor.username,author:null,authorName:null,evidenceData:null,evidenceHash:null,version:1,batchId:null,qcBatchId:null});
    expect(response.body.workItem).toMatchObject({status:'REPEAT_REQUIRED',submissionId:null,batchId:null});
    const events=await f.db.auditLog.findMany({where:{entity:'WORK_ATTEMPT'}});
    expect(events.filter(row=>row.entityId===attempts[1].id)).toHaveLength(1);
    const before=await f.all();
    const repeated=await f.command({reason:'INSTRUMENT_FAULT'});
    expect(repeated.status).toBe(409);expect(repeated.body.code).toBe('WORK_REPEAT_ALREADY_OPEN');
    expect(await f.all()).toEqual(before);
});

test.each([
    [{},409,'WORK_ATTEMPT_REASON_REQUIRED'],[{reason:'guess'},409,'WORK_ATTEMPT_REASON_INVALID'],
    [{reason:'TRANSCRIPTION_ERROR'},409,'ATTEMPT_CORRECTION_REQUIRED'],[{reason:'CLIENT_RETEST'},409,'AMENDMENT_WORKFLOW_REQUIRED'],
    [{reason:'OTHER'},400,'REPEAT_NOTE_REQUIRED'],[{reason:'INSTRUMENT_FAULT',sameBatchAllowed:true},400,'REPEAT_FIELDS_INVALID'],
    [{reason:'INSTRUMENT_FAULT',author:'caller'},400,'REPEAT_FIELDS_INVALID'],
    [{reason:'INSTRUMENT_FAULT',ncrId:'unverified'},409,'ATTEMPT_LIMIT_NCR_UNAVAILABLE'],
    [{reason:'INSTRUMENT_FAULT',override:false},409,'ATTEMPT_LIMIT_NCR_UNAVAILABLE']
])('the actual repeat API refuses %j with zero evidence/state writes',async(input,status,code)=>{
    const f=await fixture(),before=await f.all(),response=await f.command(input);
    expect(response.status).toBe(status);expect(response.body.code).toBe(code);expect(await f.all()).toEqual(before);
});

test('the configured self-repeat disablement refuses a technician with zero writes',async()=>{
    const f=await fixture();await f.setPolicy([{key:'repeats.technicianSelfRepeatBeforeSubmit',value:false}]);
    const before=await f.all(),response=await f.command({reason:'INSTRUMENT_FAULT'});
    expect(response.status).toBe(403);expect(response.body.code).toBe('WORK_REPEAT_FORBIDDEN');expect(await f.all()).toEqual(before);
});

test('an OPEN repeat fills once in the real Result transaction and keeps every request/version/time field frozen',async()=>{
    const f=await fixture(),response=await f.command({reason:'PREP_ERROR',note:'Fresh preparation required'});
    expect(response.status).toBe(201);
    const reserved=await f.db.workAttempt.findUnique({where:{id:response.body.attempt.id}});
    const results=await f.record(),filled=await f.db.workAttempt.findUnique({where:{id:reserved.id}});
    expect(results[0].attemptId).toBe(reserved.id);
    const mutable=['status','evidenceData','evidenceHash','instrumentId','executedMethodRevision','author','authorName','qcBatchId','materialAliquot'];
    for(const name of Object.keys(reserved).filter(name=>!mutable.includes(name)))expect(filled[name]).toEqual(reserved[name]);
    expect(filled).toMatchObject({status:'RECORDED',author:f.actor.username,authorName:f.actor.username,instrumentId:f.instrument.id});
    const event=await f.db.auditLog.findFirst({where:{entity:'WORK_ATTEMPT',entityId:filled.id,action:'FIRST_FILL'}});
    expect(JSON.parse(event.details)).toMatchObject({from:'OPEN',to:'RECORDED',reason:'PREP_ERROR',newResultIds:[results[0].id]});
    const before=await f.all();
    await expect(f.record(1,{attemptId:filled.id})).rejects.toMatchObject({code:'WORK_ATTEMPT_FIRST_FILL_REFUSED'});
    expect(await f.all()).toEqual(before);
});

test('the fourth attempt refuses at the lab limit, while zero policy means unlimited',async()=>{
    const f=await fixture();await f.setPolicy([{key:'repeats.maxAttemptsBeforeNcr',value:3}]);
    for(let index=0;index<2;index++) { expect((await f.command({reason:'INSTRUMENT_FAULT'})).status).toBe(201);await f.record(); }
    expect(await f.db.workAttempt.count({where:{workItemId:f.items[0].id}})).toBe(3);
    const before=await f.all(),refused=await f.command({reason:'INSTRUMENT_FAULT'});
    expect(refused.status).toBe(409);expect(refused.body.code).toBe('ATTEMPT_LIMIT');expect(await f.all()).toEqual(before);
    await f.setPolicy([{key:'repeats.maxAttemptsBeforeNcr',value:0}]);
    expect((await f.command({reason:'INSTRUMENT_FAULT'})).status).toBe(201);
    expect(await f.db.workAttempt.count({where:{workItemId:f.items[0].id}})).toBe(4);
});

test('a single-result transcription correction appends within the same attempt and preserves its evidence exactly',async()=>{
    const f=await fixture(),before=f.attempt,old=f.results[0];
    const response=await f.correction({value:'7.25',reason:'TRANSCRIPTION_ERROR',note:'Compared with instrument printout'});
    expect(response.status).toBe(201);expect(response.body.oldResultId).toBe(old.id);
    expect(response.body.result).toMatchObject({attemptId:before.id,replicateNo:old.replicateNo,enteredBy:f.actor.username,numericValue:7.25});
    expect(await f.db.workAttempt.findUnique({where:{id:before.id}})).toEqual(before);
    const retained=await f.db.result.findUnique({where:{id:old.id}});
    expect(retained).toEqual({...old,isCurrent:false,supersededBy:response.body.result.id});
    const event=await f.db.auditLog.findFirst({where:{entity:'WORK_ATTEMPT',entityId:before.id,action:'CORRECTED'}});
    expect(JSON.parse(event.details)).toMatchObject({reason:'TRANSCRIPTION_ERROR',resultId:old.id,oldResultIds:[old.id],newResultIds:[response.body.result.id]});
});

test('a multi-replicate correction requires an explicit valid current selector and leaves every other replicate byte for byte',async()=>{
    const f=await fixture({replicates:2}),other=await fixture(),before=await f.all();
    const payload={value:'7.55',reason:'TRANSCRIPTION_ERROR',note:'Replicate two typing error'};
    for(const [resultId,code] of [[undefined,'ATTEMPT_CORRECTION_TARGET_REQUIRED'],['absent','ATTEMPT_CORRECTION_TARGET_INVALID'],
        [other.results[0].id,'ATTEMPT_CORRECTION_TARGET_INVALID']]) {
        const response=await f.correction({...payload,...(resultId!==undefined && {resultId})});
        expect(response.status).toBe(409);expect(response.body.code).toBe(code);expect(await f.all()).toEqual(before);
    }
    const response=await f.correction({...payload,resultId:f.results[1].id});expect(response.status).toBe(201);
    expect(response.body.result.replicateNo).toBe(2);
    expect(await f.db.result.findUnique({where:{id:f.results[0].id}})).toEqual(f.results[0]);
    expect(await f.db.workAttempt.findUnique({where:{id:f.attempt.id}})).toEqual(f.attempt);
    const after=await f.all(),superseded=await f.correction({...payload,resultId:f.results[1].id});
    expect(superseded.status).toBe(409);expect(superseded.body.code).toBe('ATTEMPT_CORRECTION_TARGET_INVALID');expect(await f.all()).toEqual(after);
});

test('a reviewer may request REVIEW_OUTLIER and a technician cannot request it',async()=>{
    const f=await fixture(),before=await f.all(),refused=await f.command({reason:'REVIEW_OUTLIER'});
    expect(refused.status).toBe(403);expect(await f.all()).toEqual(before);
    const manager=await reviewer(f),accepted=await f.command({reason:'REVIEW_OUTLIER',note:'Review residual is inconsistent'},manager);
    expect(accepted.status).toBe(201);
    const previous=await f.db.workAttempt.findUnique({where:{id:f.attempt.id}});expect(previous.status).toBe('QUESTIONED');
    expect({...previous,status:f.attempt.status}).toEqual(f.attempt);
});
