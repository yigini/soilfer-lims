const { randomUUID } = require('node:crypto');
const request = require('supertest');
const { qcGateFixture } = require('../helpers/qcGateFixture');
const { withQcRunHttp } = require('../helpers/qcRunHttpHarness');
const { inTransaction } = require('../../services/workflowStateRules');
const { writeResultsExecution } = require('../../services/resultWriteService');
const owned = [];
afterEach(async () => { for (const f of owned.splice(0)) await f.close(); });

async function fixture({ replicates = 1, role = 'LAB_TECHNICIAN', criteria = {}, recorded = true } = {}) {
    const f = await qcGateFixture({criteria}); owned.push(f);
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
    f.submit=async()=> {
        await require('../../services/workItemStateService').transitionWorkItem(f.items[0].id,'COMPLETED',f.actor,'Recorded execution ready for submission',{},f.db);
        return require('../../services/submissionStateService').createSubmissionForItems({db:f.db,actor:f.actor,sampleId:f.items[0].sampleId,
            type:'FULL',workItemIds:[f.items[0].id]});
    };
    f.results = recorded ? await f.record(replicates) : [];
    f.attempt = recorded ? await f.db.workAttempt.findUnique({ where: { id: f.results[0].attemptId } }) : null;
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
    f.save = async (measurements,connection=f.db) => {
        let response;
        await withQcRunHttp(connection,f.actor,async(app,token)=>{response=await request(app)
            .post('/api/results/'+f.items[0].sampleId).set('Authorization','Bearer '+token)
            .send({measurements:measurements.map(row=>({methodologyId:f.methods[0].id,...row}))});},{repeatCommands:true});
        return response;
    };
    return f;
}
async function reviewer(f,role='LAB_MANAGER') {
    const user = await f.db.user.create({ data: { id:randomUUID(),username:'repeat-reviewer-' + randomUUID(),
        email:randomUUID() + '@example.test',password:'owned-http-fixture',role,labId:f.labId } });
    return { id:user.id,username:user.username,role:user.role,labId:f.labId };
}
async function nativeFixture({blankValue=0,started=true,criteria={}}={}) {
    const f=await fixture({recorded:false,criteria:{blankPerBatch:1,lrmPerBatch:0,duplicateEvery:0,crmEveryNBatches:0,...criteria}});
    f.manager=await reviewer(f);
    const {buildNativeRun,startNativeRun}=require('../../services/qcNativeRunService');
    let run=await buildNativeRun(f.db,f.manager,f.input);
    if(started)run=await startNativeRun(f.db,run.id,f.manager);
    f.results=await f.record();f.attempt=await f.db.workAttempt.findUnique({where:{id:f.results[0].attemptId}});
    if(started && blankValue!==null)run=await require('../../services/qcNativeMeasurementService').writeNativeMeasurements(f.db,run.id,f.actor,
        {measurements:[{positionId:run.positions.find(row=>row.kind==='BLANK').id,value:blankValue}]});
    f.run=run;
    f.runEvidence=()=>f.db.batch.findUnique({where:{id:run.id},include:require('../../services/qcRunViewService').QC_RUN_INCLUDE});
    return f;
}

test('the narrow owned fixture records explicit replicas together, retains literal evidence and refuses reuse',async()=>{
    const f=await fixture({recorded:false});
    const data=[{id:randomUUID(),sampleId:f.items[0].sampleId,param:f.analysisCode,value:'7.0',numericValue:7,unit:'explicit-unit',replicateNo:1,isValid:false},
        {id:randomUUID(),sampleId:f.items[0].sampleId,param:f.analysisCode,value:'7.2',numericValue:7.2,unit:'explicit-unit',replicateNo:2,isValid:true}];
    const helper=require('../helpers/workAttemptFixtures').createExecutionResultsFixture;
    const rows=await helper(f.db,{data});expect(rows).toHaveLength(2);expect(rows[1].attemptId).toBe(rows[0].attemptId);
    for(const [index,row] of rows.entries())expect(row).toMatchObject(data[index]);
    const attempt=await f.db.workAttempt.findUnique({where:{id:rows[0].attemptId}});
    expect(attempt).toMatchObject({workItemId:f.items[0].id,status:'RECORDED',attemptNo:1});
    expect(JSON.parse(attempt.evidenceData).sourceResultIds).toEqual(data.map(row=>row.id));
    const before=await f.all();
    await expect(helper(f.db,{data:data.map(row=>({...row,id:randomUUID()}))})).rejects.toThrow('reuse');
    expect(await f.all()).toEqual(before);
});

test('the owned result-set fixture refuses duplicate current replicas before any execution or Result writes',async()=>{
    const f=await fixture({recorded:false}),before=await f.all();
    await expect(require('../helpers/workAttemptFixtures').createExecutionResultsFixture(f.db,{data:[1,2].map(value=>({
        id:randomUUID(),sampleId:f.items[0].sampleId,param:f.analysisCode,value:String(value),replicateNo:1}))})).rejects.toThrow('two current');
    expect(await f.all()).toEqual(before);
});

test.each(['status', 'equipmentId', 'timestamp', 'sourceEventIds'])('an unknown correction key %s refuses with zero writes', async key => {
    const f = await fixture(), before = await f.all();
    const response = await f.correction({ value: '7.25', reason: 'TRANSCRIPTION_ERROR', note: 'Controlled correction',
        [key]: 'untrusted-extra' });
    expect(response.status).toBe(400);
    expect(response.body.code).toBe('ATTEMPT_CORRECTION_FIELDS_INVALID');
    expect(await f.all()).toEqual(before);
});

test('the four named compatibility keys cannot affect a correction Result, event or response', async () => {
    const f = await fixture(), before = await f.all(), marker = 'discarded-input-' + randomUUID();
    const response = await f.correction({ value: '7.25', reason: 'TRANSCRIPTION_ERROR', note: 'Controlled correction',
        id: marker + '-id', rawInput: marker + '-raw', flags: [marker + '-flags'], provenance: marker + '-provenance' });
    expect(response.status).toBe(201);
    const current = await f.db.result.findUnique({ where: { id: response.body.result.id } });
    const event = await f.db.auditLog.findFirst({ where: { entity: 'WORK_ATTEMPT', entityId: f.attempt.id, action: 'CORRECTED' } });
    expect(JSON.stringify([current, event, response.body])).not.toContain(marker);
    expect(current).toMatchObject({ value: '7.25', numericValue: 7.25, attemptId: f.attempt.id });
    expect(await f.db.workAttempt.findUnique({ where: { id: f.attempt.id } })).toEqual(before.attempts[0]);
});

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
    // Pin6069938801: a second write of this recorded cell is a correction;
    // absent replicas may append, but no path refills the execution evidence.
    await expect(f.record(1,{attemptId:filled.id})).rejects.toMatchObject({code:'ATTEMPT_CORRECTION_REQUIRED'});
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

test('the route permission admits a scoped MASTER_USER reviewer and refuses read-only roles before any writes',async()=>{
    const f=await fixture(),before=await f.all();
    for(const role of ['AUDIT_USER','VIEWER','SAMPLE_RECEPTION']) {
        const actor=await reviewer(f,role),actorSnapshot=await f.all();
        const response=await f.command({reason:'REVIEW_OUTLIER'},actor);
        expect({status:response.status,code:response.body.code}).toEqual({status:403,code:'WORK_ATTEMPT_FORBIDDEN'});
        expect(await f.all()).toEqual(actorSnapshot);
        const corrected=await f.correction({value:'7.2',reason:'TRANSCRIPTION_ERROR',note:'Forbidden mutation'},actor);
        expect({status:corrected.status,code:corrected.body.code}).toEqual({status:403,code:'WORK_ATTEMPT_FORBIDDEN'});
        expect(await f.all()).toEqual(actorSnapshot);
    }
    // User rows are outside this snapshot; all scientific/audit rows stayed.
    expect(await f.all()).toEqual(before);
    const master=await reviewer(f,'MASTER_USER');
    expect((await f.correction({value:'7.3',reason:'TRANSCRIPTION_ERROR',note:'Scoped reviewer correction'},master)).status).toBe(201);
    expect((await f.command({reason:'REVIEW_OUTLIER',note:'Scoped reviewer repeat'},master)).status).toBe(201);
});

test('a failed attempt event rolls back the parent transition, OPEN request and WorkItem together',async()=>{
    const f=await fixture(),before=await f.all();
    const fault=f.db.$extends({query:{auditLog:{create({args,query}){
        if(args.data.entity==='WORK_ATTEMPT' && args.data.action==='CREATED')throw Error('Owned attempt-event storage failure');
        return query(args);
    }}}});
    await expect(require('../../services/workRepeatService').requestRepeat(fault,f.items[0].id,f.actor,
        {reason:'INSTRUMENT_FAULT',note:'Check event atomicity'})).rejects.toThrow('Owned attempt-event storage failure');
    expect(await f.all()).toEqual(before);
});

test('a failed first Result rolls back its first fill and immutable event, allowing the same OPEN request to be retried',async()=>{
    const f=await fixture();expect((await f.command({reason:'PREP_ERROR'})).status).toBe(201);
    const before=await f.all();
    const fault=f.db.$extends({query:{result:{create(){throw Error('Owned Result storage failure');}}}});
    await expect(inTransaction(fault,tx=>writeResultsExecution(tx,{sampleId:f.items[0].sampleId,workItemId:f.items[0].id,actor:f.actor,
        measurements:[{param:f.analysisCode,value:'7.3',equipmentId:f.instrument.id,replicateNo:1}]}))).rejects.toThrow('Owned Result storage failure');
    expect(await f.all()).toEqual(before);
    const recorded=await f.record();expect(recorded[0].attemptId).toBe(before.attempts.find(row=>row.status==='OPEN').id);
});

test('a failed correction event rolls back the new Result, old supersession and review metadata without deleting audit rows',async()=>{
    const f=await fixture(),before=await f.all();
    const fault=f.db.$extends({query:{auditLog:{create({args,query}){
        if(args.data.entity==='WORK_ATTEMPT' && args.data.action==='CORRECTED')throw Error('Owned correction-event storage failure');
        return query(args);
    }}}});
    await expect(require('../../services/workAttemptCorrectionService').correctAttempt(fault,f.attempt.id,f.actor,
        {value:'7.7',reason:'TRANSCRIPTION_ERROR',note:'Check correction atomicity'})).rejects.toThrow('Owned correction-event storage failure');
    expect(await f.all()).toEqual(before);
});

test.each([[2,1,[2],null],[3,2,[3],null],[2,1,[2],3]])('a repeat with %i parent replicas and %i filled refuses missing %j even with extra replica %s',async(replicates,filled,missing,extra)=>{
    const f=await fixture({replicates,role:'LAB_MANAGER'}),original=f.results,parent=f.attempt;
    const repeat=await f.command({reason:'CONFIRMATION',note:'Remeasure the complete parent execution'});
    expect(repeat.status).toBe(201);
    const child=repeat.body.attempt;
    await f.record(filled);
    if(extra)expect((await f.save([{param:f.analysisCode,value:'7.3',replicateNo:extra,equipmentId:f.instrument.id}])).status).toBe(200);
    for(const old of original.filter(row=>missing.includes(row.replicateNo))) {
        expect(await f.db.result.findUnique({where:{id:old.id}})).toEqual(old);
    }
    await require('../../services/workItemStateService').transitionWorkItem(f.items[0].id,'COMPLETED',f.actor,
        'Recorded replacement ready for review',{},f.db);
    const before=await f.all();
    const submit=()=>require('../../services/submissionStateService').createSubmissionForItems({db:f.db,actor:f.actor,
        sampleId:f.items[0].sampleId,type:'FULL',workItemIds:[f.items[0].id]});
    await expect(submit()).rejects.toMatchObject({statusCode:409,code:'ATTEMPT_REPLICATE_SET_INCOMPLETE',
        details:{workItemId:f.items[0].id,missingReplicateNumbers:missing}});
    expect(await f.all()).toEqual(before);
    const appended=await f.save(missing.map(replicateNo=>({param:f.analysisCode,value:String(7+replicateNo/10),
        replicateNo,equipmentId:f.instrument.id})));
    expect({status:appended.status,body:appended.body}).toMatchObject({status:200});
    const current=await f.db.result.findMany({where:{sampleId:f.items[0].sampleId,isCurrent:true},orderBy:{replicateNo:'asc'}});
    const count=replicates+(extra?1:0);
    expect(current).toHaveLength(count);
    expect(current.map(row=>row.replicateNo)).toEqual(Array.from({length:count},(_,index)=>index+1));
    expect(current.every(row=>row.attemptId===child.id)).toBe(true);
    for(const old of original)expect(await f.db.result.findUnique({where:{id:old.id}}))
        .toEqual({...old,isCurrent:false,supersededBy:current.find(row=>row.replicateNo===old.replicateNo).id});
    expect(await f.db.workAttempt.findUnique({where:{id:parent.id}})).toEqual({...parent,status:'QUESTIONED'});
    await submit();
    expect(await f.db.workAttempt.findUnique({where:{id:child.id}})).toMatchObject({status:'SUBMITTED'});
    expect(await f.db.result.count({where:{sampleId:f.items[0].sampleId}})).toBe(replicates*2+(extra?1:0));
});

test('the ordinary save appends an absent replicate to the same frozen RECORDED attempt, then refuses cell changes and post-submit additions',async()=>{
    const f=await fixture(),attempt=f.attempt,original=f.results[0];
    const response=await f.save([{param:f.analysisCode,value:'7.12456789',replicateNo:2,equipmentId:f.instrument.id}]);
    expect(response.status).toBe(200);
    const results=await f.db.result.findMany({where:{attemptId:attempt.id},orderBy:{replicateNo:'asc'}});
    expect(results).toHaveLength(2);expect(results[0]).toEqual(original);
    expect(results[1]).toMatchObject({attemptId:attempt.id,replicateNo:2,numericValue:7.12456789,methodologyId:original.methodologyId,
        equipmentId:original.equipmentId,equipmentReadiness:original.equipmentReadiness});
    expect(await f.db.workAttempt.findUnique({where:{id:attempt.id}})).toEqual(attempt);
    const event=await f.db.auditLog.findFirst({where:{entity:'WORK_ATTEMPT',entityId:attempt.id,action:'REPLICATE_ADDED'}});
    expect(JSON.parse(event.details)).toMatchObject({from:'RECORDED',to:'RECORDED',oldResultIds:[],newResultIds:[results[1].id]});
    let before=await f.all();
    const correction=await f.save([{param:f.analysisCode,value:'8',replicateNo:1,equipmentId:f.instrument.id}]);
    expect({status:correction.status,code:correction.body.code}).toEqual({status:409,code:'ATTEMPT_CORRECTION_REQUIRED'});
    expect(await f.all()).toEqual(before);
    await f.submit();before=await f.all();
    const submitted=await f.save([{param:f.analysisCode,value:'8',replicateNo:3,equipmentId:f.instrument.id}]);
    expect({status:submitted.status,code:submitted.body.code}).toEqual({status:409,code:'ATTEMPT_CORRECTION_REQUIRED'});
    expect(await f.all()).toEqual(before);
});

test.each(['instrument','method'])('an incremental replicate refuses a changed frozen %s with zero writes',async kind=>{
    const f=await fixture(),measurement={param:f.analysisCode,value:'7.1',replicateNo:2,equipmentId:f.instrument.id};
    if(kind==='instrument')measurement.equipmentId=(await f.db.equipmentAsset.create({data:{id:randomUUID(),labId:f.labId,
        name:'Different instrument',assetType:'OTHER',status:'IN_SERVICE',criticality:'NON_CRITICAL'}})).id;
    else measurement.methodologyId=(await f.db.methodology.create({data:{analysisCode:f.analysisCode,name:'Different method',loq:0.1}})).id;
    const before=await f.all(),response=await f.save([measurement]);
    expect({status:response.status,code:response.body.code}).toEqual({status:409,code:'ATTEMPT_CONTEXT_MISMATCH'});
    expect(await f.all()).toEqual(before);
});

test('failure to append the replicate event rolls back its Result, cache and every audit row',async()=>{
    const f=await fixture(),before=await f.all();
    const fault=f.db.$extends({query:{auditLog:{create({args,query}){
        if(args.data.entity==='WORK_ATTEMPT' && args.data.action==='REPLICATE_ADDED')throw Error('Owned replicate-event storage failure');
        return query(args);
    }}}});
    expect((await f.save([{param:f.analysisCode,value:'7.1',replicateNo:2,equipmentId:f.instrument.id}],fault)).status).toBe(500);
    expect(await f.all()).toEqual(before);
});

test('actual submission changes only the attempt status; a technician cannot repeat or correct afterwards',async()=>{
    const f=await fixture(),before=f.attempt;
    await f.submit();
    expect(await f.db.workAttempt.findUnique({where:{id:before.id}})).toEqual({...before,status:'SUBMITTED'});
    const evidence=await f.all();
    for(const response of [await f.command({reason:'INSTRUMENT_FAULT'}),
        await f.correction({value:'7.5',reason:'TRANSCRIPTION_ERROR',note:'Submitted typo'})]) {
        expect(response.status).toBe(403);expect(await f.all()).toEqual(evidence);
    }
});

test('a submitted reviewer correction preserves submitted execution evidence and needs a new explicit acceptance',async()=>{
    const f=await fixture(),manager=await reviewer(f);await f.submit();
    const before=await f.db.workAttempt.findUnique({where:{id:f.attempt.id}});
    const response=await f.correction({value:'7.5',reason:'TRANSCRIPTION_ERROR',note:'Corrected against the original worksheet'},manager);
    expect(response.status).toBe(201);expect(response.body.requiresReview).toBe(true);
    expect(response.body.workItem).toMatchObject({status:'SUBMITTED',reviewDecision:null,reviewedBy:null,reviewedAt:null});
    expect(await f.db.workAttempt.findUnique({where:{id:before.id}})).toEqual(before);
    expect(await f.db.reviewDecision.count({where:{workItemId:f.items[0].id}})).toBe(0);
    await require('../helpers/qcPolicyFixture').setFixtureQcRequirement(f.db,manager,f.labId);
    await f.http(manager,async(app,token)=>{
        const accepted=await request(app).post('/api/work/'+f.items[0].id+'/review').set('Authorization','Bearer '+token)
            .send({decision:'ACCEPT',attemptId:before.id,note:'Reviewed corrected Result'});
        expect({status:accepted.status,code:accepted.body.code}).toMatchObject({status:200});
    });
    expect(await f.db.workAttempt.findUnique({where:{id:before.id}})).toEqual({...before,status:'ACCEPTED'});
});

test.each(Object.entries(require('../../services/workRepeatContract').RETURN_REASON_STATUS))(
    'actual reviewer RETURN with %s records %s and a new OPEN request atomically',async(reasonCode,status)=>{
        const f=await fixture(),manager=await reviewer(f);await f.submit();
        const before=await f.db.workAttempt.findUnique({where:{id:f.attempt.id}});
        await f.http(manager,async(app,token)=>{
            const returned=await request(app).post('/api/work/'+f.items[0].id+'/review').set('Authorization','Bearer '+token)
                .send({decision:'RETURN',attemptId:before.id,reasonCode,note:'Explicit reviewed return reason'});
            expect({status:returned.status,code:returned.body.code}).toMatchObject({status:200});
        });
        const attempts=await f.db.workAttempt.findMany({where:{workItemId:f.items[0].id},orderBy:{attemptNo:'asc'}});
        expect(attempts[0]).toEqual({...before,status});
        expect(attempts[1]).toMatchObject({status:'OPEN',attemptNo:2,reason:reasonCode,parentAttemptId:before.id,requestedBy:manager.username,evidenceData:null,evidenceHash:null});
        const decision=await f.db.reviewDecision.findFirst({where:{workItemId:f.items[0].id}});
        expect(decision).toMatchObject({attemptId:before.id,decision:'RETURN',reasonCode});
        expect(await f.db.workItem.findUnique({where:{id:f.items[0].id}})).toMatchObject({status:'REPEAT_REQUIRED',submissionId:null,batchId:null});
        expect((await f.db.sample.findUnique({where:{id:f.items[0].sampleId}})).status).toBe('PROCESSING');
    });

test('missing RETURN reason and a cross-lab repeat/correction preserve the complete owned evidence',async()=>{
    const f=await fixture(),manager=await reviewer(f);await f.submit();
    const foreign=await reviewer(f);
    const otherLab=await f.db.lab.create({data:{id:randomUUID(),code:randomUUID(),name:'Other owned test laboratory',country:'TEST'}});
    await f.db.user.update({where:{id:foreign.id},data:{labId:otherLab.id}});
    const before=await f.all();
    await f.http(manager,async(app,token)=>{
        const returned=await request(app).post('/api/work/'+f.items[0].id+'/review').set('Authorization','Bearer '+token)
            .send({decision:'RETURN',note:'A free-text note is not a reason code'});
        expect(returned.status).toBe(409);expect(returned.body.code).toBe('WORK_ATTEMPT_REASON_REQUIRED');
    });
    expect(await f.all()).toEqual(before);
    for(const response of [await f.command({reason:'REVIEW_OUTLIER'},foreign),
        await f.correction({value:'7.9',reason:'TRANSCRIPTION_ERROR',note:'Outside scope'},foreign)]) {
        expect(response.status).toBe(403);expect(await f.all()).toEqual(before);
    }
});

test('a failed undispositioned native run refuses atomically; after REPEAT_BATCH a request records only in a new run',async()=>{
    const f=await nativeFixture({blankValue:9.123456789}),manager=f.manager,batch=f.run;
    expect(batch.analytes[0].status).toBe('QC_FAIL');
    const unreviewed=await f.all(),failedEvidence=await f.runEvidence();
    const refused=await f.command({reason:'INSTRUMENT_FAULT'});
    expect({status:refused.status,code:refused.body.code}).toEqual({status:409,code:'ATTEMPT_REPEAT_RUN_DISPOSITION_REQUIRED'});
    expect(await f.all()).toEqual(unreviewed);expect(await f.runEvidence()).toEqual(failedEvidence);
    await require('../../services/qcDispositionStateService').dispositionBatch(batch.id,'REPEAT_BATCH','Reviewed failed QC requires a new run',manager,f.db);
    expect((await f.command({reason:'INSTRUMENT_FAULT'})).status).toBe(201);
    const before=await f.all(),qc=await f.db.qcEvaluation.findMany({where:{batchId:batch.id}});
    await expect(inTransaction(f.db,tx=>require('../../services/workRepeatBatchService').assertRepeatBatchAllowed(tx,
        {id:f.items[0].id,analysis:f.analysisCode},batch.id))).rejects.toMatchObject({code:'REPEAT_FAILED_BATCH',statusCode:409});
    await f.http(manager,async(app,token)=>{
        const response=await request(app).post('/api/qc/batches/'+batch.id+'/items').set('Authorization','Bearer '+token)
            .send({workItemIds:[f.items[0].id]});
        // Native membership has an earlier, independently enforced freeze.
        expect({status:response.status,code:response.body.code}).toEqual({status:409,code:'BATCH_MEMBERSHIP_FROZEN'});
    });
    expect(await f.all()).toEqual(before);expect(await f.db.qcEvaluation.findMany({where:{batchId:batch.id}})).toEqual(qc);
    const next=await require('../../services/qcNativeRunService').buildNativeRun(f.db,manager,f.input);expect(next.id).not.toBe(batch.id);
    const recorded=await f.record();expect(recorded[0]).toMatchObject({batchId:next.id});
    expect(await f.db.qcEvaluation.findMany({where:{batchId:batch.id}})).toEqual(qc);
});

test.each([{started:false,blankValue:null},{started:true,blankValue:null}])('an open or pending native run refuses %j without any request or evidence writes',async options=>{
    const f=await nativeFixture(options),before=await f.all(),run=await f.runEvidence();
    const response=await f.command({reason:'INSTRUMENT_FAULT'});
    expect({status:response.status,code:response.body.code}).toEqual({status:409,code:'ATTEMPT_REPEAT_RUN_DISPOSITION_REQUIRED'});
    expect(await f.all()).toEqual(before);expect(await f.runEvidence()).toEqual(run);
});

test.each([
    {status:'QC_PASS',blankValue:0},
    {status:'QC_WARN',blankValue:9.123456789,criteria:{failAction:{BLANK:'WARN',DUPLICATE:'WARN',LRM:'FAIL_BATCH',CRM:'WARN'}}}
])('RETURN from an accepted native run (%s) hands off one WorkItem and preserves all original membership and QC evidence byte for byte',async options=>{
    const f=await nativeFixture(options);expect(f.run.analytes[0].status).toBe(options.status);
    await f.submit();const run=await f.runEvidence(),parent=await f.db.workAttempt.findUnique({where:{id:f.attempt.id}});
    await f.http(f.manager,async(app,token)=>{
        const response=await request(app).post('/api/work/'+f.items[0].id+'/review').set('Authorization','Bearer '+token)
            .send({decision:'RETURN',attemptId:parent.id,reasonCode:'REVIEW_OUTLIER',note:'Outlier checked against the worksheet'});
        expect({status:response.status,code:response.body.code}).toMatchObject({status:200});
    });
    const after=await f.runEvidence();
    for(const key of ['analytes','measurements','evaluations','dispositions','events'])expect(after[key]).toEqual(run[key]);
    // Compare every stored position/join field; the nested WorkItem in this
    // reader is deliberately changing state and its current batch pointer.
    const retainedPositions=value=>value.positions.map(position=>({...position,
        workItems:position.workItems.map(({workItem,...membership})=>membership)}));
    expect(retainedPositions(after)).toEqual(retainedPositions(run));
    expect(await f.db.workAttempt.findUnique({where:{id:parent.id}})).toEqual({...parent,status:'QUESTIONED'});
    expect(await f.db.workItem.findUnique({where:{id:f.items[0].id}})).toMatchObject({status:'REPEAT_REQUIRED',batchId:null,rackPosition:null,submissionId:null});
    expect(await f.db.workAttempt.findFirst({where:{workItemId:f.items[0].id,status:'OPEN'}})).toMatchObject({parentAttemptId:parent.id,reason:'REVIEW_OUTLIER'});
});
