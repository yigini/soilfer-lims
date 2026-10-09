const {randomUUID}=require('node:crypto'),request=require('supertest');
const {qcGateFixture}=require('../helpers/qcGateFixture');
const {withQcRunHttp}=require('../helpers/qcRunHttpHarness');
const service=require('../../services/resultOverrideService');
const owned=[];
afterEach(async()=>{for(const f of owned.splice(0))await f.close();});
async function user(f,role,labId=f.labId){
    const row=await f.db.user.create({data:{id:randomUUID(),username:'override-'+randomUUID(),email:randomUUID()+'@example.test',password:'owned-fixture',role,labId}});
    return {id:row.id,username:row.username,role,labId};
}
async function fixture(){
    const f=await qcGateFixture();owned.push(f);
    require('../../scripts/install_result_override_requests').installResultOverrideRequests({dbPath:f.file,apply:true});
    await f.db.analysis.update({where:{code:f.analysisCode},data:{validation:'{"min":2,"max":14}'}});
    await f.db.methodology.update({where:{id:f.method.id},data:{loq:0.5,lod:0.1}});
    await f.setPolicy([{key:'results.typicalMin',value:4,analysisCode:f.analysisCode},{key:'results.typicalMax',value:9,analysisCode:f.analysisCode}]);
    f.tech=await user(f,'LAB_TECHNICIAN');f.manager=await user(f,'LAB_MANAGER');
    await f.db.workItem.update({where:{id:f.items[0].id},data:{assignedTo:f.tech.username,equipmentId:f.instrument.id}});
    f.input={value:'65',unit:'fixture-unit',equipmentId:f.instrument.id,reason:'Original worksheet confirms an extreme reading'};
    f.http=async(actor,method,url,body)=>{let response;await withQcRunHttp(f.db,actor,async(app,token)=>{
        response=await request(app)[method](url).set('Authorization','Bearer '+token).send(body);
    },{overrides:true,repeatCommands:true,workbench:true});return response;};
    f.ask=async(actor=f.tech,input={})=>f.http(actor,'post','/api/result-overrides/work-items/'+f.items[0].id,{...f.input,...input});
    f.approve=async(id,actor=f.manager)=>f.http(actor,'post','/api/result-overrides/'+id+'/decision',{status:'APPROVED',reason:'Checked the retained worksheet and instrument record'});
    f.record=(id,extra={})=>f.http(f.tech,'post','/api/results/'+f.items[0].sampleId,{measurements:[{
        param:f.analysisCode,value:'65',unit:'fixture-unit',equipmentId:f.instrument.id,methodologyId:f.method.id,overrideRequestId:id,...extra}]});
    f.state=async()=>({core:await f.snapshot(),requests:await f.db.resultOverrideRequest.findMany({orderBy:{id:'asc'}}),attempts:await f.db.workAttempt.findMany({orderBy:{id:'asc'}})});
    return f;
}
async function approval(f){const asked=await f.ask();expect({status:asked.status,body:asked.body}).toMatchObject({status:201,body:{status:'REQUESTED'}});
    const approved=await f.approve(asked.body.id);expect({status:approved.status,body:approved.body}).toMatchObject({status:200,body:{status:'APPROVED',decidedBy:f.manager.id}});return approved.body;}
test('actual HTTP override round trip records exact raw value with approval flag and read-view approver id',async()=>{
    const f=await fixture(),approved=await approval(f),recorded=await f.record(approved.id);
    expect({status:recorded.status,body:recorded.body}).toMatchObject({status:200});
    const result=await f.db.result.findFirst();expect(result).toMatchObject({rawInput:'65',numericValue:65,isValid:true});
    expect(JSON.parse(result.flags)).toContain('OVERRIDE_APPROVED');expect(JSON.parse(result.flags)).not.toContain('MANAGER_OVERRIDE');
    const consumed=await f.db.resultOverrideRequest.findUnique({where:{id:approved.id}});
    expect(consumed).toMatchObject({status:'CONSUMED',decidedBy:f.manager.id,decisionReason:approved.decisionReason,consumedResultId:result.id,cancelledBy:null});
    const view=await f.http(f.tech,'get','/api/results/'+f.items[0].sampleId);
    expect(view.status).toBe(200);expect(view.body[0].overrideApproval).toMatchObject({requestId:approved.id,approverId:f.manager.id});
    const audits=await f.db.auditLog.findMany({where:{entity:'RESULT_OVERRIDE_REQUEST',action:'OVERRIDE_CONSUMED'}});
    expect(audits).toHaveLength(1);expect(JSON.parse(audits[0].details)).toMatchObject({overrideRequestId:approved.id,approverId:f.manager.id,consumedResultId:result.id});
    const before=await f.state(),again=await f.record(approved.id);
    expect({status:again.status,code:again.body.code}).toEqual({status:409,code:'OVERRIDE_REQUEST_CLOSED'});
    expect(await f.state()).toEqual(before);
});
test.each(['value','unit','replicate','instrument','methodVersion','policy'])('approved %s changes refuse409 with zero writes and leave approval unused',async field=>{
    const f=await fixture(),approved=await approval(f);let extra={};
    if(field==='value')extra={value:'65.0'};
    if(field==='unit')extra={unit:'different-unit'};
    if(field==='replicate')extra={replicateNo:2};
    if(field==='instrument'){const instrument=await f.db.equipmentAsset.create({data:{id:randomUUID(),labId:f.labId,name:'Different instrument',assetType:'OTHER',status:'IN_SERVICE',criticality:'NON_CRITICAL'}});extra={equipmentId:instrument.id};}
    if(field==='methodVersion')await f.db.methodology.update({where:{id:f.method.id},data:{version:2}});
    if(field==='policy')await f.setPolicy([{key:'results.typicalMax',value:8,analysisCode:f.analysisCode}]);
    const before=await f.state(),response=await f.record(approved.id,extra);
    expect({status:response.status,code:response.body.code,body:response.body}).toMatchObject({status:409,code:'OVERRIDE_CONTEXT_CHANGED'});
    expect(await f.state()).toEqual(before);expect((await f.db.resultOverrideRequest.findUnique({where:{id:approved.id}})).status).toBe('APPROVED');
});
test.each(['bad number','<0.001','6','3'])('ineligible %s cannot create a request, with zero writes',async value=>{
    const f=await fixture(),before=await f.state(),response=await f.ask(f.tech,{value});
    expect({status:response.status,code:response.body.code}).toEqual({status:409,code:'OVERRIDE_VALUE_INELIGIBLE'});expect(await f.state()).toEqual(before);
});
test('self approval and foreign-lab approval/cancellation refuse403 with zero writes',async()=>{
    const f=await fixture(),self=await f.ask(f.manager);expect(self.status).toBe(201);
    const before=await f.state(),selfDecision=await f.approve(self.body.id,f.manager);
    expect({status:selfDecision.status,code:selfDecision.body.code}).toEqual({status:403,code:'OVERRIDE_SELF_APPROVAL_FORBIDDEN'});expect(await f.state()).toEqual(before);
    const otherLab=await f.db.lab.create({data:{id:randomUUID(),code:randomUUID(),name:'Foreign lab',country:'TEST'}}),foreign=await user(f,'LAB_MANAGER',otherLab.id);
    for(const suffix of ['decision','cancel']){
        const snapshot=await f.state(),response=await f.http(foreign,'post','/api/result-overrides/'+self.body.id+'/'+suffix,{status:'APPROVED',reason:'Foreign decision'});
        expect({status:response.status,code:response.body.code}).toEqual({status:403,code:'OVERRIDE_SCOPE_DENIED'});expect(await f.state()).toEqual(snapshot);
    }
});
test.each([false,true])('cancellation keeps exact pinned field history, approved=%s, and retry is a zero-write no-op',async approved=>{
    const f=await fixture(),response=await f.ask();expect(response.status).toBe(201);const id=response.body.id;
    if(approved)expect((await f.approve(id)).status).toBe(200);
    const original=await f.db.resultOverrideRequest.findUnique({where:{id}});
    const cancelled=await f.http(f.tech,'post','/api/result-overrides/'+id+'/cancel',{reason:'The recording context changed'});
    expect(cancelled.status).toBe(200);const after=await f.db.resultOverrideRequest.findUnique({where:{id}});
    expect(after).toEqual({...original,status:'CANCELLED',cancelledBy:f.tech.id,cancelledAt:expect.any(Date),cancelReason:'The recording context changed'});
    const before=await f.state(),retry=await f.http(f.tech,'post','/api/result-overrides/'+id+'/cancel',{});
    expect(retry.status).toBe(200);expect(await f.state()).toEqual(before);
});
test('an unrelated technician cannot cancel; a second active request refuses without writes',async()=>{
    const f=await fixture(),asked=await f.ask();expect(asked.status).toBe(201);const other=await user(f,'LAB_TECHNICIAN');
    const before=await f.state(),cancelled=await f.http(other,'post','/api/result-overrides/'+asked.body.id+'/cancel',{reason:'Not my request'});
    expect(cancelled.status).toBe(403);expect(await f.state()).toEqual(before);
    const repeated=await f.ask();expect(repeated.status).toBe(409);expect(repeated.body.code).toBe('OVERRIDE_REQUEST_ACTIVE');expect(await f.state()).toEqual(before);
});
test('consumed and rejected requests cannot be cancelled',async()=>{
    const f=await fixture(),approved=await approval(f);expect((await f.record(approved.id)).status).toBe(200);
    const before=await f.state(),cancelled=await f.http(f.tech,'post','/api/result-overrides/'+approved.id+'/cancel',{reason:'Late cancel'});
    expect({status:cancelled.status,code:cancelled.body.code}).toEqual({status:409,code:'OVERRIDE_REQUEST_CLOSED'});expect(await f.state()).toEqual(before);
    const rejectedFixture=await fixture(),asked=await rejectedFixture.ask();expect(asked.status).toBe(201);
    const rejected=await rejectedFixture.http(rejectedFixture.manager,'post','/api/result-overrides/'+asked.body.id+'/decision',{status:'REJECTED',reason:'Original worksheet does not support the extreme value'});
    expect(rejected.status).toBe(200);const retained=await rejectedFixture.state();
    const cancelRejected=await rejectedFixture.http(rejectedFixture.tech,'post','/api/result-overrides/'+asked.body.id+'/cancel',{reason:'Late cancel'});
    expect({status:cancelRejected.status,code:cancelRejected.body.code}).toEqual({status:409,code:'OVERRIDE_REQUEST_CLOSED'});
    expect(await rejectedFixture.state()).toEqual(retained);
});
test('scoped list exposes the requester own history and manager queue without foreign requests',async()=>{
    const f=await fixture(),asked=await f.ask();expect(asked.status).toBe(201);
    const rows=await service.list(f.db,f.tech);expect(rows.map(row=>row.id)).toEqual([asked.body.id]);
    expect((await service.list(f.db,f.manager)).map(row=>row.id)).toEqual([asked.body.id]);
});

test('actual workbench preview and commit keep the approved id, consume it once and expose history approval',async()=>{
    const f=await fixture(),approved=await approval(f),item=await f.db.workItem.findUnique({where:{id:f.items[0].id}});
    const entry={workItemId:item.id,value:'65',replicateNo:1,basis:'AIR_DRY',equipmentId:f.instrument.id,
        unit:'fixture-unit',version:item.version,overrideRequestId:approved.id};
    const before=await f.state(),preview=await f.http(f.tech,'post','/api/workbench/v2/completion/preview',{entries:[entry]});
    expect({status:preview.status,body:preview.body}).toMatchObject({status:200,body:{included:[{overrideRequestId:approved.id,unit:'fixture-unit'}],excluded:[]}});
    expect(await f.state()).toEqual(before);
    const committed=await f.http(f.tech,'post','/api/workbench/v2/completion/commit',{entries:preview.body.included});
    expect({status:committed.status,body:committed.body}).toMatchObject({status:200,body:{saved:1}});
    expect(committed.body.errors || []).toEqual([]);
    const result=await f.db.result.findFirst();expect(JSON.parse(result.flags)).toContain('OVERRIDE_APPROVED');
    expect(await f.db.resultOverrideRequest.findUnique({where:{id:approved.id}})).toMatchObject({status:'CONSUMED',consumedResultId:result.id});
    const history=await f.http(f.tech,'get','/api/results/'+item.sampleId+'/history');
    expect(history.status).toBe(200);expect(history.body.history[0].overrideApproval.approverId).toBe(f.manager.id);
});

test('workbench preview uses method LOQ and cannot approve a below-LOQ censor limit',async()=>{
    const f=await fixture(),item=await f.db.workItem.findUnique({where:{id:f.items[0].id}}),before=await f.state();
    const preview=await f.http(f.manager,'post','/api/workbench/v2/completion/preview',{entries:[{workItemId:item.id,
        value:'<0.001',equipmentId:f.instrument.id,overrideReason:'Cannot authorize a physically misleading qualifier'}]});
    expect(preview.status).toBe(200);expect(preview.body.included).toEqual([]);
    expect(preview.body.excluded[0].blockers).toContain('CENSOR_LIMIT_BELOW_LOQ');expect(await f.state()).toEqual(before);
});

test('dilution opportunity reads the recorded source and unchanged repeat authority without writing',async()=>{
    const f=await fixture(),service=require('../../services/workbenchValueValidationService');
    await f.setPolicy([{key:'results.calibrationMax',value:10,analysisCode:f.analysisCode},
        {key:'repeats.technicianSelfRepeatBeforeSubmit',value:true,analysisCode:f.analysisCode}]);
    let item=await f.db.workItem.findUnique({where:{id:f.items[0].id},include:{sample:true}}),before=await f.state();
    expect(await service.dilutionOpportunity(f.db,item,f.tech)).toEqual({eligible:false});expect(await f.state()).toEqual(before);
    expect((await f.record(undefined,{value:'12'})).status).toBe(200);
    const result=await f.db.result.findFirst();expect(JSON.parse(result.flags)).toContain('ABOVE_RANGE');
    item=await f.db.workItem.findUnique({where:{id:item.id},include:{sample:true}});before=await f.state();
    const opportunity=await service.dilutionOpportunity(f.db,item,f.tech);
    expect(opportunity).toEqual({eligible:true,attemptId:result.attemptId});expect(await f.state()).toEqual(before);
    await f.setPolicy([{key:'repeats.technicianSelfRepeatBeforeSubmit',value:false,analysisCode:f.analysisCode}]);
    before=await f.state();expect(await service.dilutionOpportunity(f.db,item,f.tech)).toEqual({eligible:false,code:'WORK_REPEAT_FORBIDDEN'});
    expect(await f.state()).toEqual(before);
    await f.setPolicy([{key:'repeats.technicianSelfRepeatBeforeSubmit',value:true,analysisCode:f.analysisCode}]);
    const repeat=await f.http(f.tech,'post','/api/work-items/'+item.id+'/repeats',{reason:'ABOVE_RANGE_DILUTION',note:'Dilute the retained aliquot'});
    expect(repeat.status).toBe(201);expect(repeat.body.attempt).toMatchObject({parentAttemptId:result.attemptId,reason:'ABOVE_RANGE_DILUTION',status:'OPEN'});
    expect(await f.db.result.count()).toBe(1);
});
