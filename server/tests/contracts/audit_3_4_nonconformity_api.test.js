const {randomUUID}=require('node:crypto');
const request=require('supertest');
const {qcGateFixture}=require('../helpers/qcGateFixture');
const {withQcRunHttp}=require('../helpers/qcRunHttpHarness');
const rules=require('../../services/workflowStateRules');
const {raise}=require('../../services/nonconformityService');
const owned=[];
async function fixture() {
    const f=await qcGateFixture();owned.push(f);
    f.actor=await f.db.user.create({data:{id:randomUUID(),username:'ncr-api-'+randomUUID(),email:randomUUID()+'@example.test',password:'fixture',role:'LAB_MANAGER',labId:f.labId}});
    f.create=(source='QC',refId=randomUUID())=>rules.inTransaction(f.db,tx=>raise(tx,f.actor,{labId:f.labId,source,refType:source==='PT'?'ProficiencyRound':'QcDisposition',refId,description:'Owned API source'}));
    f.call=async(path='',payload,actor=f.actor,method='get')=>{
        let response;await withQcRunHttp(f.db,actor,async(app,token)=>{
            const command=request(app)[method]('/api/nonconformities'+path).set('Authorization','Bearer '+token);
            response=await(payload===undefined?command:command.send(payload));
        },{nonconformities:true});return response;
    };
    f.all=async()=>JSON.parse(JSON.stringify([await f.snapshot(),await f.db.nonconformityReport.findMany({orderBy:{id:'asc'}})]));
    return f;
}
afterEach(async()=>{for(const f of owned.splice(0))await f.close();});
test('actual QA read uses VIEW_AUDIT, lab scope and intersected status/source filters without writes',async()=>{
    const f=await fixture(),first=(await f.create()).report,second=(await f.create('PT')).report;
    const foreignLab=await f.db.lab.create({data:{id:randomUUID(),code:randomUUID(),name:'Owned foreign NCR lab',country:'TEST'}});
    const global=await f.db.user.create({data:{id:randomUUID(),username:'ncr-global-'+randomUUID(),email:randomUUID()+'@example.test',password:'fixture',role:'SUPER_ADMIN'}});
    const foreign=await rules.inTransaction(f.db,tx=>raise(tx,global,{labId:foreignLab.id,source:'OTHER',refType:'OwnedApiTest',refId:randomUUID(),description:'Foreign owned source'}));
    const moved=await f.call('/'+first.id+'/transitions',{status:'ACTION',impactAssessment:'Reviewed impact'},f.actor,'post');expect(moved.status).toBe(200);
    const reader=await f.db.user.create({data:{id:randomUUID(),username:'ncr-reader-'+randomUUID(),email:randomUUID()+'@example.test',password:'fixture',role:'AUDIT_USER',labId:f.labId}});
    const before=await f.all();
    const all=await f.call('',undefined,reader);expect(all.status).toBe(200);expect(all.body.rows.map(row=>row.id).sort()).toEqual([first.id,second.id].sort());
    const filtered=await f.call('?status=ACTION&source=QC',undefined,reader);expect(filtered.status).toBe(200);expect(filtered.body.rows.map(row=>row.id)).toEqual([first.id]);
    expect((await f.call('?status=OPEN&source=QC',undefined,reader)).body.rows).toEqual([]);
    expect((await f.call('',undefined,global)).body.rows.map(row=>row.id)).toEqual(expect.arrayContaining([foreign.report.id,first.id,second.id]));
    for(const query of ['?status=BOGUS','?source=UNREVIEWED','?labId='+foreignLab.id]) {
        const refused=await f.call(query,undefined,reader);expect(refused.status).toBe(400);expect(refused.body.code).toBe('NCR_FILTER_INVALID');
    }
    expect(await f.all()).toEqual(before);
});
test('HTTP lifecycle records forward steps and old/new actor audit facts; every refused command is zero-write',async()=>{
    const f=await fixture(),report=(await f.create()).report;
    let before=await f.all();
    for(const payload of [{status:'CLOSED',correctiveAction:'Skip'},{status:'ACTION',impactAssessment:' '},{status:'ACTION',impactAssessment:'reviewed',description:'overwrite'}]) {
        const refused=await f.call('/'+report.id+'/transitions',payload,f.actor,'post');expect(refused.status).toBe(409);expect(await f.all()).toEqual(before);
    }
    const action=await f.call('/'+report.id+'/transitions',{status:'ACTION',impactAssessment:'Actual reviewed impact'},f.actor,'post');expect(action.status).toBe(200);
    before=await f.all();const blank=await f.call('/'+report.id+'/transitions',{status:'CLOSED',correctiveAction:''},f.actor,'post');expect(blank.status).toBe(409);expect(await f.all()).toEqual(before);
    const closed=await f.call('/'+report.id+'/transitions',{status:'CLOSED',correctiveAction:'Actual corrective action'},f.actor,'post');expect(closed.status).toBe(200);expect(closed.body.closedBy).toBe(f.actor.username);expect(closed.body.closedAt).toBeTruthy();
    const audits=await f.db.auditLog.findMany({where:{entity:'NONCONFORMITY_REPORT',entityId:report.id},orderBy:{timestamp:'asc'}});
    expect(audits.map(row=>row.action)).toEqual(['NCR_RAISED','NCR_ACTION','NCR_CLOSED']);
    expect(audits.every(row=>row.performedBy===f.actor.username)).toBe(true);
    expect(JSON.parse(audits[1].before).status).toBe('OPEN');expect(JSON.parse(audits[1].after).status).toBe('ACTION');
    before=await f.all();
    const reopen=await f.call('/'+report.id+'/transitions',{status:'OPEN'},f.actor,'post');expect(reopen.status).toBe(409);expect(reopen.body.code).toBe('NCR_TRANSITION_REFUSED');expect(await f.all()).toEqual(before);
    expect((await f.call('/'+report.id,undefined,f.actor,'delete')).status).toBe(404);expect(await f.all()).toEqual(before);
});
test('QA reader cannot mutate; an unrelated manager cannot change another lab; technician cannot read',async()=>{
    const f=await fixture(),report=(await f.create()).report,before=await f.all();
    const lab=await f.db.lab.create({data:{id:randomUUID(),code:randomUUID(),name:'Owned foreign API lab',country:'TEST'}});
    const other=await f.db.user.create({data:{id:randomUUID(),username:'foreign-api-'+randomUUID(),email:randomUUID()+'@example.test',password:'fixture',role:'LAB_MANAGER',labId:lab.id}});
    const reader=await f.db.user.create({data:{id:randomUUID(),username:'ncr-reader-'+randomUUID(),email:randomUUID()+'@example.test',password:'fixture',role:'AUDIT_USER',labId:f.labId}});
    const payload={status:'ACTION',impactAssessment:'Recorded impact'};
    expect((await f.call('/'+report.id+'/transitions',payload,reader,'post')).status).toBe(403);
    const foreign=await f.call('/'+report.id+'/transitions',payload,other,'post');expect(foreign.status).toBe(403);expect(foreign.body.code).toBe('NCR_SCOPE_DENIED');
    await f.db.user.update({where:{id:reader.id},data:{role:'LAB_TECHNICIAN'}});
    expect((await f.call('',undefined,{...reader,role:'LAB_TECHNICIAN'})).status).toBe(403);expect(await f.all()).toEqual(before);
});
