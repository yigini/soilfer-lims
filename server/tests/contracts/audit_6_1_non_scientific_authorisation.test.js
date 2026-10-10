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
const {createExecutionResultFixture}=require('../helpers/workAttemptFixtures');
const {requestScientificAmendment,authoriseScientificAmendment}=require('../../services/scientificAmendmentService');
const owned=[];
async function fixture(status='APPROVED',itemStatus='ACCEPTED'){
 const directory=path.resolve(__dirname,'../.tmp');fs.mkdirSync(directory,{recursive:true});
 const file=assertOwnedTestDatabase(path.join(directory,'audit_legacy_amendment_auth_'+randomUUID()+'.db'),'system:fixture'),f={file};owned.push(f);
 beforeGuards({actor:'system:fixture',file,qcBootstrap:'CREATE_PRISMA'});
 f.db=new PrismaClient({adapter:new PrismaBetterSqlite3({url:'file:'+file})});
 f.labId='owned-lab-'+randomUUID();await f.db.lab.create({data:{id:f.labId,code:f.labId,name:'Owned amendment laboratory',country:'GTM'}});
 f.actor={username:'requester',name:'Request manager',role:'LAB_MANAGER',labId:f.labId};
 f.other={...f.actor,username:'authoriser',name:'Authorisation manager'};
 f.sample=await createSampleFixture(f.db,{data:{id:randomUUID(),originalId:'OWNED-'+randomUUID(),assignedLab:f.labId,country:'GTM',projectCode:'OWNED-PROJECT',
  status,approvedBy:'retained-approver',approvedAt:new Date('2026-09-20T10:00:00.123Z'),fieldMetadata:'{"site_id":"RETAINED-SITE","pit_id":"RETAINED-PIT","independent":"retained"}'}});
 f.item=await createWorkItemFixture(f.db,{data:{id:randomUUID(),sampleId:f.sample.id,assignedLab:f.labId,analysis:'PH_H2O',status:itemStatus,result:'retained display cache'}});
 installWorkflowStateGuards({dbPath:file,apply:true});installSampleAmendmentAuthorisation({dbPath:file,apply:true});
 require('../../scripts/install_report_revisions').installReportRevisions({dbPath:file,apply:true});
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

// These owned fixtures exercise the new SQL link contract independently of
// the scientific authorise workflow, which is not wired yet. They do not
// grant a runtime capability or claim an end-to-end scientific authorisation.
async function linkFixture(kind='valid'){
 const f=await fixture(),result=await createExecutionResultFixture(f.db,{attemptStatus:kind==='recorded-parent'?'RECORDED':'ACCEPTED',data:{
  id:randomUUID(),sampleId:f.sample.id,param:'PH_H2O',value:'6.3',unit:'pH_units',replicateNo:1,isCurrent:true}});
 const selected=kind==='unselected'?'[]':JSON.stringify([f.item.id]);
 const amendment=await f.db.sampleAmendment.create({data:{id:randomUUID(),sampleId:f.sample.id,
  type:kind==='clerical'?'CLERICAL':'SCIENTIFIC',reason:'Owned SQL link contract',createdBy:'requester',
  ...(kind==='legacy'?{status:'APPROVED',authorizedBy:'legacy-requester',authorizedAt:new Date('2026-09-01T00:00:00Z')}:
   {status:'PENDING',requestPayload:JSON.stringify({contract:'210-v1',reasonCode:'CLIENT_RETEST'}),selectedWorkItemIds:selected,version:1})}});
 if(!['pending','legacy'].includes(kind))await f.db.sampleAmendment.update({where:{id:amendment.id},data:{status:'APPROVED',version:2,
  authorizedBy:'authoriser',authorizedAt:new Date(),priorApprovedBy:f.sample.approvedBy,priorApprovedAt:f.sample.approvedAt}});
 const child=await f.db.workAttempt.create({data:{id:randomUUID(),workItemId:f.item.id,attemptNo:2,
  status:kind==='recorded-child'?'RECORDED':'OPEN',parentAttemptId:result.attemptId,
  reason:kind==='reason-mismatch'?'CONFIRMATION':'CLIENT_RETEST',requestedBy:'authoriser',requestedAt:new Date()}});
 return {...f,parentId:result.attemptId,link:{id:randomUUID(),amendmentId:amendment.id,workItemId:f.item.id,
  parentAttemptId:result.attemptId,childAttemptId:child.id,reason:'CLIENT_RETEST'}};
}
function insertLinkProbe(f,data=f.link){
 const db=new Database(f.file);try{
  db.pragma('foreign_keys=ON');
  return db.prepare('INSERT INTO SampleAmendmentAttempt(id,amendmentId,workItemId,parentAttemptId,childAttemptId,reason) VALUES(?,?,?,?,?,?)')
   .run(data.id,data.amendmentId,data.workItemId,data.parentAttemptId,data.childAttemptId,data.reason);
 }finally{db.close();}
}
test('the link guard accepts its exact authorised scientific context without changing any retained evidence',async()=>{
 const f=await linkFixture(),before=f.snapshot();
 const link=await f.db.sampleAmendmentAttempt.create({data:f.link});expect(link).toMatchObject(f.link);
 const after=f.snapshot();for(const [table,rows]of Object.entries(before.rows))if(table!=='SampleAmendmentAttempt')expect(after.rows[table]).toEqual(rows);
 expect(after.rows.SampleAmendmentAttempt).toHaveLength(1);expect(after.integrity).toBe('ok');expect(after.foreignKeys).toEqual([]);
});
test.each(['pending','legacy','clerical','unselected','recorded-parent','recorded-child','reason-mismatch'])('the link guard refuses %s with zero writes',async kind=>{
 const f=await linkFixture(kind),before=f.snapshot();
 expect(()=>insertLinkProbe(f)).toThrow('AMENDMENT_ATTEMPT_CONTEXT_MISMATCH');expect(f.snapshot()).toEqual(before);
});
test.each(['parentAttemptId','childAttemptId','workItemId','amendmentId','reason'])('an unrelated %s cannot produce a link',async field=>{
 const f=await linkFixture(),before=f.snapshot();
 expect(()=>insertLinkProbe(f,{...f.link,[field]:field==='reason'?'OTHER':randomUUID()})).toThrow('AMENDMENT_ATTEMPT_CONTEXT_MISMATCH');
 expect(f.snapshot()).toEqual(before);
});
test('all seven link columns are immutable and links and referenced attempts cannot be deleted',async()=>{
 const f=await linkFixture();await f.db.sampleAmendmentAttempt.create({data:f.link});const before=f.snapshot(),db=new Database(f.file);
 try{
  db.pragma('foreign_keys=ON');
  for(const field of ['id','amendmentId','workItemId','parentAttemptId','childAttemptId','reason','createdAt']){
   expect(()=>db.prepare('UPDATE SampleAmendmentAttempt SET "'+field+'"=? WHERE id=?').run(field==='createdAt'?0:randomUUID(),f.link.id))
    .toThrow('AMENDMENT_ATTEMPT_IMMUTABLE');expect(f.snapshot()).toEqual(before);
  }
  expect(()=>db.prepare('DELETE FROM SampleAmendmentAttempt WHERE id=?').run(f.link.id)).toThrow('AMENDMENT_ATTEMPT_IMMUTABLE');
  for(const id of [f.link.parentAttemptId,f.link.childAttemptId])expect(()=>db.prepare('DELETE FROM WorkAttempt WHERE id=?').run(id)).toThrow('FOREIGN KEY constraint failed');
 }finally{db.close();}
 expect(f.snapshot()).toEqual(before);
 expect(()=>insertLinkProbe(f,{...f.link,id:randomUUID()})).toThrow('UNIQUE constraint failed: SampleAmendmentAttempt.childAttemptId');expect(f.snapshot()).toEqual(before);
});

test.each(['CLIENT_RETEST','CONFIRMATION'])('a scientific %s request remains pending and preserves every existing row',async reasonCode=>{
 const f=await fixture(),before=f.snapshot();
 const response=await requestScientificAmendment(f.db,f.sample.id,f.actor,{reason:'Review the retained analytical finding',reasonCode,selectedWorkItemIds:[f.item.id]});
 expect(response.amendment).toMatchObject({type:'SCIENTIFIC',status:'PENDING',version:1,authorizedBy:null,authorizedAt:null,
  priorApprovedBy:null,priorApprovedAt:null,selectedWorkItemIds:JSON.stringify([f.item.id]),affectedOrderLines:JSON.stringify([f.item.id])});
 expect(JSON.parse(response.amendment.requestPayload)).toEqual({contract:'210-v1',reasonCode});
 const after=f.snapshot();for(const [table,rows]of Object.entries(before.rows))if(!['SampleAmendment','AuditLog'].includes(table))expect(after.rows[table]).toEqual(rows);
 expect(JSON.parse(after.rows.AuditLog.find(row=>row.action==='SAMPLE_AMENDMENT_CREATED').details)).toMatchObject({type:'SCIENTIFIC',status:'PENDING',applied:false});
 expect(response).not.toHaveProperty('capability');
});
test.each(['ARCHIVED','DISPOSED','PROCESSING'])('scientific requests on %s refuse without writes',async status=>{
 const f=await fixture(status),before=f.snapshot();
 await expect(requestScientificAmendment(f.db,f.sample.id,f.actor,{reason:'Owned request',reasonCode:'CLIENT_RETEST',selectedWorkItemIds:[f.item.id]}))
  .rejects.toMatchObject({statusCode:409,code:'AMENDMENT_SAMPLE_UNAVAILABLE'});expect(f.snapshot()).toEqual(before);
});
test.each(['permission','tenant','empty-lines','duplicate-lines','foreign-line','reason','forged-capability'])('scientific requests reject %s before any writes',async kind=>{
 const f=await fixture(),before=f.snapshot(),input={reason:'Owned request',reasonCode:'CONFIRMATION',selectedWorkItemIds:[f.item.id]};
 const actor={...f.actor};let code='AMENDMENT_INPUT_INVALID';
 if(kind==='permission'){actor.role='TECHNICIAN';code='AMENDMENT_FORBIDDEN';}
 if(kind==='tenant'){actor.labId='foreign-lab';code='ACCESS_DENIED_LAB';}
 if(kind==='empty-lines')input.selectedWorkItemIds=[];
 if(kind==='duplicate-lines')input.selectedWorkItemIds=[f.item.id,f.item.id];
 if(kind==='foreign-line'){input.selectedWorkItemIds=[randomUUID()];code='AMENDMENT_LINE_INVALID';}
 if(kind==='reason'){input.reasonCode='OTHER';code='AMENDMENT_REASON_INVALID';}
 if(kind==='forged-capability')input.capability={amendmentId:'caller-forged'};
 await expect(requestScientificAmendment(f.db,f.sample.id,actor,input)).rejects.toMatchObject({code});expect(f.snapshot()).toEqual(before);
});
test.each(['nonaccepted','nonmeasurement','duplicate-marker'])('scientific requests refuse %s work without writes',async kind=>{
 const f=await fixture('APPROVED',kind==='nonaccepted'?'COMPLETED':'ACCEPTED');let selected=f.item;
 if(kind!=='nonaccepted')selected=await createWorkItemFixture(f.db,{data:{id:randomUUID(),sampleId:f.sample.id,assignedLab:f.labId,
  analysis:kind==='nonmeasurement'?'DRYING':'PH_H2O',status:'ACCEPTED',...(kind==='duplicate-marker'&&{duplicateOf:f.item.id})}});
 const before=f.snapshot();
 await expect(requestScientificAmendment(f.db,f.sample.id,f.actor,{reason:'Owned request',reasonCode:'CLIENT_RETEST',selectedWorkItemIds:[selected.id]}))
  .rejects.toMatchObject({statusCode:409,code:'AMENDMENT_LINE_INVALID'});expect(f.snapshot()).toEqual(before);
});
test.each(['affectedResults','affectedReports'])('scientific requests retain scope for %s',async field=>{
 const f=await fixture(),before=f.snapshot();
 await expect(requestScientificAmendment(f.db,f.sample.id,f.actor,{reason:'Owned request',reasonCode:'CONFIRMATION',selectedWorkItemIds:[f.item.id],[field]:[randomUUID()]}))
  .rejects.toMatchObject({statusCode:409,code:'AMENDMENT_EVIDENCE_INVALID'});expect(f.snapshot()).toEqual(before);
});
test('a late scientific request audit failure rolls back the request without changing retained evidence',async()=>{
 const f=await fixture(),db=new Database(f.file);
 try{
  db.exec("CREATE TRIGGER owned_late_scientific_request_failure BEFORE INSERT ON AuditLog WHEN NEW.action='SAMPLE_AMENDMENT_CREATED' BEGIN SELECT RAISE(ABORT,'OWNED_REQUEST_AUDIT_FAILURE'); END;");
  expect(()=>db.prepare('INSERT INTO AuditLog(id,entity,entityId,action,details,performedBy,timestamp) VALUES(?,?,?,?,?,?,?)')
   .run('owned-request-fault','SAMPLE',f.sample.id,'SAMPLE_AMENDMENT_CREATED','owned negative probe','requester',Date.now())).toThrow('OWNED_REQUEST_AUDIT_FAILURE');
 }finally{db.close();}
 const before=f.snapshot();
 await expect(requestScientificAmendment(f.db,f.sample.id,f.actor,{reason:'Owned request',reasonCode:'CONFIRMATION',selectedWorkItemIds:[f.item.id]}))
  .rejects.toMatchObject({code:'P2003'});expect(f.snapshot()).toEqual(before);
});

async function scientificFixture(){
 const f=await fixture();
 f.original=await createExecutionResultFixture(f.db,{attemptStatus:'ACCEPTED',data:{id:randomUUID(),sampleId:f.sample.id,
  param:'PH_H2O',value:'6.3',unit:'pH_units',replicateNo:1,isCurrent:true}});
 f.report=await f.db.report.create({data:{id:randomUUID(),sampleId:f.sample.id,labId:f.labId,status:'PUBLISHED',version:1,
  publishedAt:new Date('2026-09-20T10:01:00.123Z'),generatedBy:'retained-issuer',reportNumberBase:'OWNED-REPORT',revision:0,
  content:'{"retained":"é精确","sample":{"id":"retained"},"results":[]}'}});
 f.link=await f.db.reportShareLink.create({data:{id:randomUUID(),reportId:f.report.id,tokenHash:randomUUID(),createdBy:'retained-issuer'}});
 f.scientificInput={reason:'Review the retained analytical finding',reasonCode:'CLIENT_RETEST',selectedWorkItemIds:[f.item.id]};
 return f;
}
const scientificRequest=f=>requestScientificAmendment(f.db,f.sample.id,f.actor,f.scientificInput);
const scientificApprove=(f,id,actor=f.other,expectedVersion=1)=>authoriseScientificAmendment(f.db,f.sample.id,id,actor,{expectedVersion});

test.each(['CLIENT_RETEST','CONFIRMATION'])('scientific %s authorisation reopens only selected work, seals the accepted parent and withdraws the exact report',async reasonCode=>{
 const f=await scientificFixture();f.scientificInput.reasonCode=reasonCode;
 const untouched=await createWorkItemFixture(f.db,{data:{id:randomUUID(),sampleId:f.sample.id,assignedLab:f.labId,analysis:'SOC',status:'ACCEPTED'}});
 const {amendment}=await scientificRequest(f),before=f.snapshot(),outcome=await scientificApprove(f,amendment.id),after=f.snapshot();
 expect(outcome.amendment).toMatchObject({status:'APPROVED',version:2,authorizedBy:'authoriser',priorApprovedBy:f.sample.approvedBy,priorApprovedAt:f.sample.approvedAt});
 expect(outcome).not.toHaveProperty('capability');expect(outcome.attempts).toHaveLength(1);
 expect(outcome.attempts[0]).toMatchObject({workItemId:f.item.id,status:'OPEN',parentAttemptId:f.original.attemptId,reason:reasonCode,attemptNo:2});
 expect(after.rows.WorkItem.find(row=>row.id===untouched.id)).toEqual(before.rows.WorkItem.find(row=>row.id===untouched.id));
 expect(after.rows.WorkItem.find(row=>row.id===f.item.id)).toMatchObject({status:'REPEAT_REQUIRED',reviewedBy:null,reviewedAt:null,reviewDecision:null});
 const priorSample=before.rows.Sample.find(row=>row.id===f.sample.id),newSample=after.rows.Sample.find(row=>row.id===f.sample.id);
 expect({...newSample,status:priorSample.status,updatedAt:priorSample.updatedAt}).toEqual(priorSample);
 expect(newSample.status).toBe('PROCESSING');
 for(const parent of before.rows.WorkAttempt)expect(after.rows.WorkAttempt.find(row=>row.id===parent.id)).toEqual(parent);
 const priorReport=before.rows.Report.find(row=>row.id===f.report.id),newReport=after.rows.Report.find(row=>row.id===f.report.id);
 expect({...newReport,status:priorReport.status,updatedAt:priorReport.updatedAt}).toEqual(priorReport);expect(newReport.status).toBe('WITHDRAWN');
 expect(after.rows.ReportShareLink).toEqual(before.rows.ReportShareLink);
 expect(after.rows.SampleAmendmentAttempt).toEqual([expect.objectContaining({amendmentId:amendment.id,workItemId:f.item.id,
  parentAttemptId:f.original.attemptId,childAttemptId:outcome.attempts[0].id,reason:reasonCode})]);
 expect(after.rows.ReportAmendmentWithdrawal).toEqual([expect.objectContaining({reportId:f.report.id,amendmentId:amendment.id})]);
 for(const [table,rows]of Object.entries(before.rows))if(!['Sample','WorkItem','WorkAttempt','SampleAmendment','SampleAmendmentAttempt','Report','ReportAmendmentWithdrawal','AuditLog'].includes(table))expect(after.rows[table]).toEqual(rows);
 expect(after.integrity).toBe('ok');expect(after.foreignKeys).toEqual([]);
 await expect(scientificApprove(f,amendment.id)).rejects.toMatchObject({statusCode:409,code:'AMENDMENT_SAMPLE_UNAVAILABLE'});expect(f.snapshot()).toEqual(after);
});

test('scientific authorisation re-reads second-person policy and explicitly records ADVISORY self-authorisation',async()=>{
 const f=await scientificFixture(),{amendment}=await scientificRequest(f),before=f.snapshot();
 await expect(scientificApprove(f,amendment.id,f.actor)).rejects.toMatchObject({statusCode:409,code:'AMENDMENT_SECOND_PERSON_REQUIRED'});expect(f.snapshot()).toEqual(before);
 await policy.change(f.actor,f.labId,{presetCode:'ADVISORY',reason:'Owned single-manager policy'},{db:f.db});
 const outcome=await scientificApprove(f,amendment.id,f.actor);
 expect(outcome.amendment.authorizedBy).toBe('requester');
 const audit=f.snapshot().rows.AuditLog.find(row=>row.action==='SAMPLE_AMENDMENT_AUTHORISED');
 expect(JSON.parse(audit.details)).toMatchObject({selfAuthorised:true,requiresSecondPerson:false});
});

test.each(['permission','tenant','stale-version','forged-capability'])('scientific authorisation rejects %s with zero writes',async kind=>{
 const f=await scientificFixture(),{amendment}=await scientificRequest(f),before=f.snapshot(),actor={...f.other},input={expectedVersion:1};let code='AMENDMENT_INPUT_INVALID';
 if(kind==='permission'){actor.role='TECHNICIAN';code='AMENDMENT_FORBIDDEN';}
 if(kind==='tenant'){actor.labId='foreign-lab';code='ACCESS_DENIED_LAB';}
 if(kind==='stale-version'){input.expectedVersion=2;code='AMENDMENT_STATE_CHANGED';}
 if(kind==='forged-capability')input.capability={amendmentId:amendment.id};
 await expect(authoriseScientificAmendment(f.db,f.sample.id,amendment.id,actor,input)).rejects.toMatchObject({code});expect(f.snapshot()).toEqual(before);
});

test.each(['Sample','WorkItem'])('an action string or forged capability cannot reopen a released %s',async entity=>{
 const f=await scientificFixture(),before=f.snapshot();
 await expect(f.db.$transaction(tx=>entity==='Sample'?
  require('../../services/sampleStateService').transitionSample(f.sample.id,'PROCESSING',f.other,'Owned forged action',{},tx,
   {action:'SCIENTIFIC_AMENDMENT_AUTHORISED',amendmentCapability:{amendmentId:'forged'}}):
  require('../../services/workItemStateService').transitionWorkItem(f.item.id,'REPEAT_REQUIRED',f.other,'Owned forged action',{},tx,
   {action:'SCIENTIFIC_AMENDMENT_AUTHORISED',amendmentCapability:{amendmentId:'forged'}})))
  .rejects.toMatchObject({statusCode:409,code:'AMENDMENT_CAPABILITY_REQUIRED'});expect(f.snapshot()).toEqual(before);
 expect(require('../../workflowContract')[entity==='Sample'?'isValidSampleTransition':'isValidWorkItemTransition']
  (entity==='Sample'?'APPROVED':'ACCEPTED',entity==='Sample'?'PROCESSING':'REPEAT_REQUIRED')).toBe(false);
});

test('a late scientific authorisation audit failure rolls back every reopen, child, binding and report change',async()=>{
 const f=await scientificFixture(),{amendment}=await scientificRequest(f),db=new Database(f.file);
 try{db.exec("CREATE TRIGGER owned_late_scientific_auth_failure BEFORE INSERT ON AuditLog WHEN NEW.action='SAMPLE_AMENDMENT_AUTHORISED' BEGIN SELECT RAISE(ABORT,'OWNED_SCIENTIFIC_AUTH_FAILURE'); END;");}finally{db.close();}
 const before=f.snapshot();await expect(scientificApprove(f,amendment.id)).rejects.toMatchObject({code:'P2003'});expect(f.snapshot()).toEqual(before);
});

test('withdrawal binding and every report content field stay sealed after authorisation',async()=>{
 const f=await scientificFixture(),{amendment}=await scientificRequest(f);await scientificApprove(f,amendment.id);const before=f.snapshot(),db=new Database(f.file);
 try{
  for(const field of ['id','reportId','amendmentId','createdAt'])expect(()=>db.prepare('UPDATE ReportAmendmentWithdrawal SET "'+field+'"=?').run(field==='createdAt'?0:randomUUID())).toThrow('REPORT_WITHDRAWAL_IMMUTABLE');
  expect(()=>db.prepare('DELETE FROM ReportAmendmentWithdrawal').run()).toThrow('REPORT_WITHDRAWAL_IMMUTABLE');
  expect(()=>db.prepare("UPDATE Report SET status='SUPERSEDED' WHERE id=?").run(f.report.id)).toThrow('REPORT_WITHDRAWAL_CONTEXT_MISMATCH');
  for(const field of db.prepare('PRAGMA table_xinfo(Report)').all().map(row=>row.name).filter(name=>!['status','updatedAt'].includes(name)))
   // #211's six revision fields are sealed by their own guard for every report.
   expect(()=>db.prepare('UPDATE Report SET "'+field+'"=? WHERE id=?').run(randomUUID(),f.report.id)).toThrow(
    ['supersedesReportId','amendmentId','amendmentReason','issuedBy','approvedBy','amendmentAuthorizedBy'].includes(field)?'REPORT_REVISION_IMMUTABLE':'REPORT_WITHDRAWAL_IMMUTABLE');
 }finally{db.close();}
 expect(f.snapshot()).toEqual(before);
});

test('scientific repeats preserve the existing configured attempt limit and NCR refusal',async()=>{
 const f=await scientificFixture(),{amendment}=await scientificRequest(f);
 await policy.change(f.actor,f.labId,{reason:'Owned attempt-limit boundary',changes:[{key:'repeats.maxAttemptsBeforeNcr',value:1}]},{db:f.db});
 const before=f.snapshot();await expect(scientificApprove(f,amendment.id)).rejects.toMatchObject({statusCode:409,code:'ATTEMPT_LIMIT'});expect(f.snapshot()).toEqual(before);
});

test.each(['parent-no-longer-accepted','new-open-child'])('authorisation revalidates %s after a valid request and refuses the whole transaction',async kind=>{
 const f=await scientificFixture(),{amendment}=await scientificRequest(f);
 if(kind==='parent-no-longer-accepted'){
  const parent=await f.db.workAttempt.findUnique({where:{id:f.original.attemptId}});
  await f.db.workAttempt.update({where:{id:parent.id},data:{status:'QUESTIONED',updatedAt:parent.updatedAt}});
 }else await f.db.workAttempt.create({data:{id:randomUUID(),workItemId:f.item.id,attemptNo:2,status:'OPEN',parentAttemptId:f.original.attemptId,
  reason:'CONFIRMATION',requestedBy:'owned-independent-requester',requestedAt:new Date()}});
 const before=f.snapshot();
 await expect(scientificApprove(f,amendment.id)).rejects.toMatchObject({statusCode:409,code:'AMENDMENT_LINE_INVALID'});
 expect(f.snapshot()).toEqual(before);
 expect(await f.db.sampleAmendment.findUnique({where:{id:amendment.id}})).toMatchObject({status:'PENDING',version:1,authorizedBy:null});
});

test.each(['CLIENT_RETEST','CONFIRMATION'])('an explicit selected-line %s limit override raises the existing REPEAT_LIMIT NCR and preserves the accepted parent',async reasonCode=>{
 const f=await scientificFixture();f.scientificInput.reasonCode=reasonCode;
 await policy.change(f.actor,f.labId,{reason:'Owned attempt-limit boundary',changes:[{key:'repeats.maxAttemptsBeforeNcr',value:1}]},{db:f.db});
 f.scientificInput.limitOverrides=[{workItemId:f.item.id,description:'Laboratory requested confirmation beyond the limit',impactAssessment:'Retain the issued result until the separate amendment review is complete'}];
 const {amendment}=await scientificRequest(f),parent=await f.db.workAttempt.findUnique({where:{id:f.original.attemptId}});
 expect(JSON.parse(amendment.requestPayload).limitOverrides).toEqual(f.scientificInput.limitOverrides);
 const outcome=await scientificApprove(f,amendment.id),child=outcome.attempts[0];
 const ncr=await f.db.nonconformityReport.findUnique({where:{source_refType_refId:{source:'REPEAT_LIMIT',refType:'WorkAttempt',refId:child.id}}});
 expect(ncr).toMatchObject({labId:f.labId,status:'OPEN',raisedBy:f.other.username,
  description:f.scientificInput.limitOverrides[0].description,impactAssessment:f.scientificInput.limitOverrides[0].impactAssessment});
 expect(await f.db.workAttempt.findUnique({where:{id:parent.id}})).toEqual(parent);
 expect(await f.db.result.findUnique({where:{id:f.original.id}})).toEqual(f.original);
 const event=await f.db.auditLog.findFirst({where:{entity:'WORK_ATTEMPT',entityId:child.id,action:'CREATED'}});
 expect(JSON.parse(event.details)).toMatchObject({nonconformityId:ncr.id});
});

test('a line override without the existing NCR assessment refuses the request atomically',async()=>{
 const f=await scientificFixture(),before=f.snapshot();
 f.scientificInput.limitOverrides=[{workItemId:f.item.id,description:'Limit exceeded',impactAssessment:' '}];
 await expect(scientificRequest(f)).rejects.toMatchObject({code:'NCR_ASSESSMENT_REQUIRED'});
 expect(f.snapshot()).toEqual(before);
});

test.each(['ARCHIVED','DISPOSED'])('a pending scientific amendment cannot reopen a subsequently %s sample',async status=>{
 const f=await scientificFixture(),{amendment}=await scientificRequest(f);
 await require('../../services/sampleStateService').transitionSample(f.sample.id,status,f.other,'Retained lifecycle decision',{},f.db);
 const before=f.snapshot();await expect(scientificApprove(f,amendment.id)).rejects.toMatchObject({statusCode:409,code:'AMENDMENT_SAMPLE_UNAVAILABLE'});expect(f.snapshot()).toEqual(before);
});

test('the actual report HTTP routes retain internal access and refuse both public formats before expiry or revocation',async()=>{
 const f=await scientificFixture(),token=randomUUID(),hash=require('node:crypto').createHash('sha256').update(token).digest('hex');
 await f.db.reportShareLink.update({where:{id:f.link.id},data:{tokenHash:hash,expiresAt:new Date('2020-01-01T00:00:00Z'),isRevoked:true}});
 await f.db.user.create({data:{id:f.other.username,username:f.other.username,email:randomUUID()+'@example.test',password:'owned-http-fixture',role:'LAB_MANAGER',labId:f.labId}});
 const {amendment}=await scientificRequest(f);await scientificApprove(f,amendment.id);
 const content=(await f.db.report.findUnique({where:{id:f.report.id}})).content;
 await require('../helpers/qcRunHttpHarness').withQcRunHttp(f.db,f.other,async(app,jwt)=>{
  const request=require('supertest');
  const internal=await request(app).get('/api/reports/'+f.report.id).set('Authorization','Bearer '+jwt);
  expect(internal.status).toBe(200);expect(internal.body.withdrawal.amendmentId).toBe(amendment.id);expect(JSON.stringify(internal.body.content)).toBe(content);
  for(const suffix of ['', '/pdf']){
   const response=await request(app).get('/api/reports/public/'+token+suffix);
   expect(response.status).toBe(409);expect(response.body).toEqual({error:'This report is withdrawn pending amendment.',code:'REPORT_WITHDRAWN',
    // #211: text-only tombstone; no link, values, replacement or amendment reason.
    tombstone:{status:'WITHDRAWN',reportNumber:expect.any(String)}});expect(JSON.stringify(response.body)).not.toContain(amendment.id);
   expect(response.body).not.toHaveProperty('content');expect(response.body).not.toHaveProperty('replacement');
  }
 },{reports:true});
});

test('withdrawn report numbering remains reserved and the next issuance preserves its row and takes the next revision',async()=>{
 const f=await scientificFixture(),{amendment}=await scientificRequest(f);await scientificApprove(f,amendment.id);
 const before=f.snapshot(),lab=await f.db.lab.findUnique({where:{id:f.labId}});
 const identity=await f.db.$transaction(async tx=>{
  const identity=await require('../../services/reportNumberService').allocateReportIdentity(tx,{sampleId:f.sample.id,lab,publishedAt:new Date(),
   resolveFormat:()=>{throw Error('Existing issued lineage must retain its number.');}});
  await tx.report.create({data:{id:randomUUID(),sampleId:f.sample.id,labId:f.labId,version:2,status:'PUBLISHED',publishedAt:new Date(),generatedBy:'new-issuer',
   reportNumberBase:identity.reportNumberBase,revision:identity.revision,content:'{"new":"retained reissue"}'}});
  return identity;
 });
 expect(identity).toMatchObject({reportNumberBase:'OWNED-REPORT',revision:1,replacesReportId:f.report.id});
 const after=f.snapshot();expect(after.rows.Report.find(row=>row.id===f.report.id)).toEqual(before.rows.Report.find(row=>row.id===f.report.id));
 expect(after.rows.ReportAmendmentWithdrawal).toEqual(before.rows.ReportAmendmentWithdrawal);
});

test.each(['request','authorise'])('scientific %s refuses unregistered laboratory authority without policy fallback or writes',async action=>{
 const f=await scientificFixture(),amendment=action==='authorise'?(await scientificRequest(f)).amendment:null;
 await f.db.sample.update({where:{id:f.sample.id},data:{assignedLab:'unregistered-owned-lab'}});
 const before=f.snapshot(),actor={...f.other,role:'SUPER_ADMIN'};
 await expect(action==='authorise'?scientificApprove(f,amendment.id,actor):requestScientificAmendment(f.db,f.sample.id,actor,f.scientificInput))
  .rejects.toMatchObject({statusCode:409,code:'AMENDMENT_SAMPLE_UNAVAILABLE'});expect(f.snapshot()).toEqual(before);
});

test('a pending request cannot grant withdrawal authority and a report cannot become withdrawn without its binding',async()=>{
 const f=await scientificFixture(),{amendment}=await scientificRequest(f),before=f.snapshot(),db=new Database(f.file);
 try{
  db.pragma('foreign_keys=ON');
  expect(()=>db.prepare('INSERT INTO ReportAmendmentWithdrawal(id,reportId,amendmentId) VALUES(?,?,?)').run(randomUUID(),f.report.id,amendment.id))
   .toThrow('REPORT_WITHDRAWAL_CONTEXT_MISMATCH');
  expect(()=>db.prepare("UPDATE Report SET status='WITHDRAWN' WHERE id=?").run(f.report.id)).toThrow('REPORT_WITHDRAWAL_CONTEXT_MISMATCH');
 }finally{db.close();}
 expect(f.snapshot()).toEqual(before);
});
