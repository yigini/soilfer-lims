const fs=require('node:fs'),path=require('node:path'),{randomUUID}=require('node:crypto');
const Database=require('better-sqlite3');
const {PrismaClient}=require('../../prisma_client');
const {PrismaBetterSqlite3}=require('@prisma/adapter-better-sqlite3');
const {beforeGuards}=require('../helpers/legacyWorkflowDatabase');
const {assertOwnedTestDatabase}=require('../helpers/testOwnedDatabase');
const {createSampleFixture,createWorkItemFixture}=require('../helpers/workflowFixtures');
const {installWorkflowStateGuards}=require('../../scripts/install_workflow_state_guards');
const {installSampleAmendmentAuthorisation}=require('../../scripts/install_sample_amendment_authorisation');
const {requestNonScientificAmendment:request,authoriseNonScientificAmendment:authorise}=require('../../services/nonScientificAmendmentService');
const policy=require('../../services/policyService');
const owned=[];
async function fixture(status='APPROVED'){
 const directory=path.resolve(__dirname,'../.tmp');fs.mkdirSync(directory,{recursive:true});
 const file=assertOwnedTestDatabase(path.join(directory,'audit_legacy_amendment_auth_'+randomUUID()+'.db'),'system:fixture'),f={file};owned.push(f);
 beforeGuards({actor:'system:fixture',file,qcBootstrap:'CREATE_PRISMA'});
 f.db=new PrismaClient({adapter:new PrismaBetterSqlite3({url:'file:'+file})});
 f.labId='owned-lab-'+randomUUID();await f.db.lab.create({data:{id:f.labId,code:f.labId,name:'Owned amendment laboratory',country:'GTM'}});
 f.actor={username:'requester',name:'Request manager',role:'LAB_MANAGER',labId:f.labId};
 f.other={...f.actor,username:'authoriser',name:'Authorisation manager'};
 f.sample=await createSampleFixture(f.db,{data:{id:randomUUID(),originalId:'OWNED-'+randomUUID(),assignedLab:f.labId,country:'GTM',projectCode:'OWNED-PROJECT',
  status,approvedBy:'retained-approver',approvedAt:new Date('2026-09-20T10:00:00.123Z'),fieldMetadata:'{"site_id":"RETAINED-SITE","pit_id":"RETAINED-PIT","independent":"retained"}'}});
 f.item=await createWorkItemFixture(f.db,{data:{id:randomUUID(),sampleId:f.sample.id,assignedLab:f.labId,analysis:'PH_H2O',status:'ACCEPTED',result:'retained display cache'}});
 installWorkflowStateGuards({dbPath:file,apply:true});installSampleAmendmentAuthorisation({dbPath:file,apply:true});
 f.input={type:'CLERICAL',reason:'Verified original field record',profileCorrection:{code:'CORRECTED-PIT',relation:'CONFIRMED_PROFILE'},expectedProfileRevision:0};
 f.snapshot=()=>{const db=new Database(file,{readonly:true,fileMustExist:true});try{return{
  rows:Object.fromEntries(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all()
   .map(({name})=>[name,db.prepare('SELECT * FROM "'+name+'" ORDER BY rowid').all()])),
  objects:db.prepare("SELECT type,name,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name").all(),
  integrity:db.pragma('integrity_check',{simple:true}),foreignKeys:db.pragma('foreign_key_check')};}finally{db.close();}};
 return f;
}
afterEach(async()=>{for(const f of owned.splice(0)){await f.db?.$disconnect();fs.rmSync(assertOwnedTestDatabase(f.file,'system:fixture'),{force:true});}});
const pending=(f,input=f.input)=>request(f.db,f.sample.id,f.actor,input);
const approve=(f,id,actor=f.other,version=1)=>authorise(f.db,f.sample.id,id,actor,{expectedVersion:version});

test('a profile request is PENDING and cannot change sample identity, approval or existing work',async()=>{
 const f=await fixture(),before=f.snapshot(),response=await pending(f);
 expect(response).toMatchObject({success:true,amendment:{status:'PENDING',version:1,createdBy:'requester',authorizedBy:null,authorizedAt:null,
  priorApprovedBy:null,priorApprovedAt:null,selectedWorkItemIds:'[]'}});
 expect(JSON.parse(response.amendment.requestPayload)).toEqual({contract:'210-v1',profileCorrection:f.input.profileCorrection,expectedProfileRevision:0});
 const after=f.snapshot();expect(after.rows.Sample).toEqual(before.rows.Sample);expect(after.rows.WorkItem).toEqual(before.rows.WorkItem);
 for(const [table,rows]of Object.entries(before.rows))if(!['SampleAmendment','AuditLog'].includes(table))expect(after.rows[table]).toEqual(rows);
 const audit=after.rows.AuditLog.find(row=>row.action==='SAMPLE_AMENDMENT_CREATED');expect(JSON.parse(audit.details)).toMatchObject({status:'PENDING',applied:false});
 expect(response.profileReference).toBeUndefined();
});

test('a distinct approver applies a clerical correction once and retains prior approval and immutable request evidence',async()=>{
 const f=await fixture(),created=await pending(f),before=f.snapshot(),response=await approve(f,created.amendment.id);
 expect(response.amendment).toMatchObject({status:'APPROVED',version:2,authorizedBy:'authoriser',priorApprovedBy:f.sample.approvedBy,priorApprovedAt:f.sample.approvedAt,
  requestPayload:created.amendment.requestPayload,selectedWorkItemIds:created.amendment.selectedWorkItemIds});
 expect(response.profileReference).toMatchObject({code:'CORRECTED-PIT',revision:1,recordedBy:'authoriser',source:'CLERICAL_AMENDMENT'});
 const sample=await f.db.sample.findUnique({where:{id:f.sample.id}});expect(sample).toMatchObject({status:'APPROVED',approvedBy:f.sample.approvedBy,approvedAt:f.sample.approvedAt});
 expect(JSON.parse(sample.fieldMetadata)).toMatchObject({site_id:'RETAINED-SITE',pit_id:'RETAINED-PIT',independent:'retained',profileReference:response.profileReference});
 const after=f.snapshot();for(const [table,rows]of Object.entries(before.rows))if(!['Sample','SampleAmendment','AuditLog'].includes(table))expect(after.rows[table]).toEqual(rows);
 expect(after.integrity).toBe('ok');expect(after.foreignKeys).toEqual([]);
 const audit=after.rows.AuditLog.find(row=>row.action==='SAMPLE_AMENDMENT_AUTHORISED');expect(JSON.parse(audit.after)).toMatchObject({selfAuthorised:false,requiresSecondPerson:true,priorApprovedBy:'retained-approver'});
 const complete=f.snapshot();await expect(approve(f,created.amendment.id)).rejects.toMatchObject({code:'AMENDMENT_STATE_CHANGED'});expect(f.snapshot()).toEqual(complete);
});

test('Strict refuses self-authorisation and stale versions without any persisted changes',async()=>{
 const f=await fixture(),created=await pending(f),before=f.snapshot();
 await expect(approve(f,created.amendment.id,f.actor)).rejects.toMatchObject({statusCode:409,code:'AMENDMENT_SECOND_PERSON_REQUIRED'});expect(f.snapshot()).toEqual(before);
 await expect(approve(f,created.amendment.id,f.other,2)).rejects.toMatchObject({statusCode:409,code:'AMENDMENT_STATE_CHANGED'});expect(f.snapshot()).toEqual(before);
});

test('authorisation re-reads actual lab policy; ADVISORY self-authorisation is explicit in the audit',async()=>{
 const f=await fixture();await policy.change(f.actor,f.labId,{presetCode:'ADVISORY',reason:'Owned single-manager policy'},{db:f.db});
 const created=await pending(f);await policy.change(f.actor,f.labId,{presetCode:'ISO17025_STRICT',reason:'Require second reviewer now'},{db:f.db});
 const strict=f.snapshot();await expect(approve(f,created.amendment.id,f.actor)).rejects.toMatchObject({code:'AMENDMENT_SECOND_PERSON_REQUIRED'});expect(f.snapshot()).toEqual(strict);
 await policy.change(f.actor,f.labId,{presetCode:'ADVISORY',reason:'Explicit single-manager policy restored'},{db:f.db});
 const response=await approve(f,created.amendment.id,f.actor);expect(response.amendment.authorizedBy).toBe('requester');
 const audit=await f.db.auditLog.findFirst({where:{action:'SAMPLE_AMENDMENT_AUTHORISED',sampleId:f.sample.id}});
 expect(JSON.parse(audit.details)).toMatchObject({selfAuthorised:true,requiresSecondPerson:false});
});

test('a different pending correction changing the profile makes this authorisation a zero-write conflict',async()=>{
 const f=await fixture(),first=await pending(f),second=await pending(f,{...f.input,reason:'Independent second request',profileCorrection:{code:'SECOND-PIT'}});
 await approve(f,first.amendment.id);const before=f.snapshot();
 await expect(approve(f,second.amendment.id)).rejects.toMatchObject({statusCode:409,code:'AMENDMENT_PROFILE_CHANGED'});
 expect(f.snapshot()).toEqual(before);expect((await f.db.sampleAmendment.findUnique({where:{id:second.amendment.id}})).status).toBe('PENDING');
});

test('both request and authorisation enforce approval permission and current sample scope',async()=>{
 const f=await fixture(),created=await pending(f),before=f.snapshot();
 for(const actor of [{...f.other,role:'LAB_TECHNICIAN'},{...f.other,labId:'foreign-laboratory'}]){
  await expect(request(f.db,f.sample.id,actor,f.input)).rejects.toMatchObject({statusCode:403});expect(f.snapshot()).toEqual(before);
  await expect(approve(f,created.amendment.id,actor)).rejects.toMatchObject({statusCode:403});expect(f.snapshot()).toEqual(before);
 }
});

test.each(['ARCHIVED','DISPOSED'])('CLERICAL correction on %s leaves physical status and prior approval unchanged',async status=>{
 const f=await fixture(status),created=await pending(f);await approve(f,created.amendment.id);
 expect(await f.db.sample.findUnique({where:{id:f.sample.id}})).toMatchObject({status,approvedBy:f.sample.approvedBy,approvedAt:f.sample.approvedAt});
 expect(await f.db.workItem.findUnique({where:{id:f.item.id}})).toEqual(f.item);expect(await f.db.workAttempt.count()).toBe(0);
});

test.each(['ORDER','REPORT'])('%s authorisation records affected evidence and reason without changing orders, work, reports or sample',async type=>{
 const f=await fixture(),created=await pending(f,{type,reason:'Reasoned metadata-only authorisation',affectedOrderLines:[f.item.id]}),before=f.snapshot();
 const response=await approve(f,created.amendment.id);expect(response.amendment).toMatchObject({status:'APPROVED',type,affectedOrderLines:JSON.stringify([f.item.id])});
 const after=f.snapshot();for(const [table,rows]of Object.entries(before.rows))if(!['SampleAmendment','AuditLog'].includes(table))expect(after.rows[table]).toEqual(rows);
});

test('foreign evidence, injected authorisation fields and invalid versions refuse without writes',async()=>{
 const f=await fixture(),before=f.snapshot();
 for(const input of [{type:'REPORT',reason:'Foreign report',affectedReports:['foreign-report']},
  {type:'ORDER',reason:'Unknown line',affectedOrderLines:['foreign-line']},{...f.input,authorizedBy:'forged'},
  {...f.input,affectedOrderLines:[f.item.id,f.item.id]},{...f.input,profileCorrection:undefined,expectedProfileRevision:0}]){
  await expect(pending(f,input)).rejects.toMatchObject({statusCode:expect.any(Number)});expect(f.snapshot()).toEqual(before);
 }
 const created=await pending(f),requested=f.snapshot();
 await expect(authorise(f.db,f.sample.id,created.amendment.id,f.other,{expectedVersion:1,authorizedBy:'forged'})).rejects.toMatchObject({code:'AMENDMENT_INPUT_INVALID'});
 expect(f.snapshot()).toEqual(requested);
});

test('legacy NULL-version rows cannot enter the new authorisation workflow',async()=>{
 const f=await fixture();for(const status of ['PENDING','APPROVED']){
  const legacy=await f.db.sampleAmendment.create({data:{sampleId:f.sample.id,type:'CLERICAL',status,reason:'Historical retained amendment',createdBy:'legacy-requester',
   ...(status==='APPROVED'&&{authorizedBy:'legacy-requester',authorizedAt:new Date('2026-09-01T00:00:00Z')})}}),before=f.snapshot();
  await expect(approve(f,legacy.id)).rejects.toMatchObject({code:'AMENDMENT_STATE_CHANGED'});expect(f.snapshot()).toEqual(before);
 }
});

test('a late audit failure rolls back both authorisation and clerical profile changes',async()=>{
 const f=await fixture(),created=await pending(f),db=new Database(f.file);
 try{
  db.exec("CREATE TRIGGER owned_late_authorisation_failure BEFORE INSERT ON AuditLog WHEN NEW.action='SAMPLE_AMENDMENT_AUTHORISED' BEGIN SELECT RAISE(ABORT,'OWNED_AUTHORISATION_FAILURE'); END;");
  expect(()=>db.prepare('INSERT INTO AuditLog(id,entity,entityId,action,details,performedBy,timestamp) VALUES(?,?,?,?,?,?,?)')
   .run('owned-fault-probe','SAMPLE',f.sample.id,'SAMPLE_AMENDMENT_AUTHORISED','owned negative probe','authoriser',Date.now())).toThrow('OWNED_AUTHORISATION_FAILURE');
 }finally{db.close();}
 // Prisma's SQLite adapter classifies this actual RAISE(ABORT) as P2003.
 // The independently verified trigger is the only injected failure.
 const before=f.snapshot();await expect(approve(f,created.amendment.id)).rejects.toMatchObject({code:'P2003'});expect(f.snapshot()).toEqual(before);
});
