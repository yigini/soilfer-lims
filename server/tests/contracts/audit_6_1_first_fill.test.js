const {randomUUID,createHash}=require('node:crypto');
const Database=require('better-sqlite3');
const request=require('supertest');
const {qcGateFixture}=require('../helpers/qcGateFixture');
const {createSampleFixture,createWorkItemFixture}=require('../helpers/workflowFixtures');
const {createExecutionResultsFixture}=require('../helpers/workAttemptFixtures');
const {withQcRunHttp}=require('../helpers/qcRunHttpHarness');
const {inTransaction}=require('../../services/workflowStateRules');
const commands=require('../../services/sampleAmendmentCommandService');
const {writeResultsExecution}=require('../../services/resultWriteService');
const owned=[];
afterEach(async()=>{for(const f of owned.splice(0))await f.close();});
async function fixture(reasonCode='CLIENT_RETEST',originalReplicates=2,analysisCode,unlinked=false){
 const f=await qcGateFixture(analysisCode?{analysisCode}:undefined);owned.push(f);
 require('../../scripts/install_sample_amendment_authorisation').installSampleAmendmentAuthorisation({dbPath:f.file,apply:true});
 await f.setPolicy([{key:'results.replicatesRequired',value:2}]);
 f.sample=await createSampleFixture(f.db,{data:{id:randomUUID(),originalId:randomUUID(),assignedLab:f.labId,
  status:unlinked?'PROCESSING':'APPROVED',dryingStatus:'DONE',preparationStatus:'DONE',approvedBy:'retained-approver',approvedAt:new Date('2026-09-25T10:00:00Z')}});
 f.item=await createWorkItemFixture(f.db,{data:{id:randomUUID(),sampleId:f.sample.id,assignedLab:f.labId,labId:f.labId,
  analysis:f.analysisCode,methodologyId:f.method.id,status:unlinked?'REPEAT_REQUIRED':'ACCEPTED',assignedTo:f.actor.username,equipmentId:f.instrument.id}});
 f.originals=await createExecutionResultsFixture(f.db,{attemptStatus:unlinked?'RECORDED':'ACCEPTED',data:Array.from({length:originalReplicates},(_,index)=>index+1).map(replicateNo=>({id:randomUUID(),sampleId:f.sample.id,
  param:f.analysisCode,replicateNo,value:String(7+replicateNo/10),numericValue:7+replicateNo/10,unit:'fixture-unit',
  methodologyId:f.method.id,equipmentId:f.instrument.id,isCurrent:true}))});
 if(unlinked)await inTransaction(f.db,async tx=>{
  const events=require('../../services/workAttemptEventService');
  await events.transitionAttempt(tx,f.item,f.originals[0].attemptId,'SUBMITTED',f.actor);
  await events.transitionAttempt(tx,f.item,f.originals[0].attemptId,'ACCEPTED',f.actor);
 });
 f.parent=await f.db.workAttempt.findUnique({where:{id:f.originals[0].attemptId}});
 const authoriser=await f.db.user.create({data:{id:randomUUID(),username:'amendment-authoriser-'+randomUUID(),email:randomUUID()+'@example.test',
  password:'owned-http-fixture',role:'LAB_MANAGER',labId:f.labId}});
 f.other={id:authoriser.id,username:authoriser.username,role:authoriser.role,labId:f.labId};
 f.input={type:'SCIENTIFIC',reason:'Verify the issued analytical finding',reasonCode,selectedWorkItemIds:[f.item.id],idempotencyKey:randomUUID()};
 f.request=()=>commands.command(f.db,{sampleId:f.sample.id,actor:f.actor,input:f.input});
 f.authorise=amendment=>commands.command(f.db,{sampleId:f.sample.id,amendmentId:amendment.id,actor:f.other,authorise:true,
  input:{expectedVersion:1,idempotencyKey:'authorise-'+f.input.idempotencyKey}});
 f.record=replicateNo=>inTransaction(f.db,tx=>writeResultsExecution(tx,{sampleId:f.sample.id,workItemId:f.item.id,actor:f.actor,
  measurements:[{param:f.analysisCode,value:String(7.3+replicateNo/100),replicateNo,equipmentId:f.instrument.id}]}));
 f.all=()=>{const db=new Database(f.file,{readonly:true});try{return Object.fromEntries(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all()
  .map(({name})=>[name,db.prepare('SELECT * FROM "'+name+'" ORDER BY rowid').all()]));}finally{db.close();}};
 return f;
}
test.each(['CLIENT_RETEST','CONFIRMATION'])('linked %s child first-fills, completes its replica set and submits with the accepted parent sealed',async reasonCode=>{
 const f=await fixture(reasonCode),{amendment}=await f.request(),outcome=await f.authorise(amendment);
 const child=outcome.attempts[0],before=f.all(),first=await f.record(1);
 expect(first[0].attemptId).toBe(child.id);expect(await f.db.workAttempt.findUnique({where:{id:f.parent.id}})).toEqual(f.parent);
 const item=await f.db.workItem.findUnique({where:{id:f.item.id}});
 const partial=f.all();await expect(inTransaction(f.db,tx=>require('../../services/workAttemptEventService').submitRecordedAttempt(tx,item,f.actor)))
  .rejects.toMatchObject({statusCode:409,code:'ATTEMPT_REPLICATE_SET_INCOMPLETE'});expect(f.all()).toEqual(partial);
 const second=await f.record(2);expect(second[0].attemptId).toBe(child.id);
 for(const original of f.originals)expect(await f.db.result.findUnique({where:{id:original.id}}))
  .toEqual({...original,isCurrent:false,supersededBy:[...first,...second].find(row=>row.replicateNo===original.replicateNo).id});
 await require('../../services/workItemStateService').transitionWorkItem(f.item.id,'COMPLETED',f.actor,'Replacement readings complete',{},f.db);
 await require('../../services/submissionStateService').createSubmissionForItems({db:f.db,actor:f.actor,sampleId:f.sample.id,type:'FULL',workItemIds:[f.item.id]});
 expect(await f.db.workAttempt.findUnique({where:{id:child.id}})).toMatchObject({status:'SUBMITTED',parentAttemptId:f.parent.id,reason:reasonCode});
 expect(await f.db.workAttempt.findUnique({where:{id:f.parent.id}})).toEqual(f.parent);
 const after=f.all();for(const table of ['QcMeasurement','QcEvaluation','BatchDisposition','ResultCalculation','ReportedValueSelection','SampleAmendmentAttempt'])expect(after[table]).toEqual(before[table]);
});
test('ordinary accepted-parent repeat requests retain their exact refusal and zero writes',async()=>{
 const f=await fixture(),before=f.all();
 await expect(require('../../services/workRepeatService').requestRepeat(f.db,f.item.id,f.other,{reason:'CONFIRMATION',note:'Ordinary repeat'}))
  .rejects.toMatchObject({statusCode:409,code:'AMENDMENT_WORKFLOW_REQUIRED'});expect(f.all()).toEqual(before);
});
test('an absent original replicate refuses and rolls back first fill, result and audit together',async()=>{
 const f=await fixture('CLIENT_RETEST',1),{amendment}=await f.request();await f.authorise(amendment);const before=f.all();
 await expect(f.record(2)).rejects.toMatchObject({statusCode:409,code:'AMENDMENT_ATTEMPT_LINK_INVALID'});expect(f.all()).toEqual(before);
});
test.each(['version','lab','parent','replicate'])('a persisted %s field fault refuses the actual result write and rolls back every row',async field=>{
 const f=await fixture(),{amendment}=await f.request(),outcome=await f.authorise(amendment),child=outcome.attempts[0];
 // Construct only states the actual SQL permits in this owned negative fixture.
 // No model reads, contract guards or writer options are substituted.
 if(field==='version')await f.db.sampleAmendment.update({where:{id:amendment.id},data:{version:3}});
 if(field==='lab'){
  const lab=await f.db.lab.create({data:{id:randomUUID(),code:'foreign-'+randomUUID(),name:'Owned other laboratory',country:'GTM'}});
  await f.db.workItem.update({where:{id:f.item.id},data:{labId:lab.id}});
 }
 if(field==='parent'){
  const other=await f.db.workAttempt.create({data:{id:randomUUID(),workItemId:f.item.id,attemptNo:3,status:'ACCEPTED'}});
  await f.db.workAttempt.update({where:{id:child.id},data:{parentAttemptId:other.id,updatedAt:child.updatedAt}});
 }
 const before=f.all();
 await expect(f.record(field==='replicate'?3:1)).rejects.toMatchObject({statusCode:409,code:'AMENDMENT_ATTEMPT_LINK_INVALID'});
 expect(f.all()).toEqual(before);
});
test.each(['sample','line','reason'])('the SQL guard prevents a persisted %s link fault with zero writes',async field=>{
 const f=await fixture(),{amendment}=await f.request(),outcome=await f.authorise(amendment),child=outcome.attempts[0],before=f.all(),db=new Database(f.file);
 try{
  if(field==='sample')expect(()=>db.prepare('UPDATE SampleAmendment SET sampleId=? WHERE id=?').run(f.items[0].sampleId,amendment.id)).toThrow('AMENDMENT_VERSION_CONFLICT');
  else if(field==='line')expect(()=>db.prepare('UPDATE SampleAmendment SET selectedWorkItemIds=?,version=version+1 WHERE id=?').run('[]',amendment.id)).toThrow('AMENDMENT_REQUEST_IMMUTABLE');
  else expect(()=>db.prepare('UPDATE WorkAttempt SET reason=? WHERE id=?').run('OTHER',child.id)).toThrow('WORK_ATTEMPT_IDENTITY_IMMUTABLE');
 }finally{db.close();}
 expect(f.all()).toEqual(before);
});
async function unlinkedFixture(analysisCode){
 const f=await fixture('CONFIRMATION',2,analysisCode,true);
 // Historical/invalid OPEN rows are possible without a new amendment link.
 // Retain every guard and the accepted parent; the runtime must refuse reuse.
 f.child=await f.db.workAttempt.create({data:{id:randomUUID(),workItemId:f.item.id,attemptNo:2,status:'OPEN',parentAttemptId:f.parent.id,
  reason:'CONFIRMATION',requestedBy:f.other.username,requestedAt:new Date()}});
 expect(await f.db.sampleAmendmentAttempt.count()).toBe(0);return f;
}
test('recordedExecution refuses a real unlinked OPEN child of an accepted parent without writes',async()=>{
 const f=await unlinkedFixture(),before=f.all();
 await expect(inTransaction(f.db,tx=>require('../../services/resultWriteService').recordedExecution(tx,f.item,f.analysisCode)))
  .rejects.toMatchObject({statusCode:409,code:'ATTEMPT_CORRECTION_REQUIRED'});expect(f.all()).toEqual(before);
});
test('the texture writer reaches appendResult and rolls back first fill for a real unlinked accepted-parent child',async()=>{
 const f=await unlinkedFixture('TEXTURE'),before=f.all();
 // This public writer does not call recordedExecution. Its first-fill and
 // fraction supersession go through insertExecution then appendResult.
 await expect(inTransaction(f.db,tx=>require('../../services/resultWriteService').writeTextureDetermination(tx,{sampleId:f.sample.id,workItemId:f.item.id,
  actor:f.actor,measurement:{param:'TEXTURE',replicateNo:1,equipmentId:f.instrument.id},fractions:{sand:'40',silt:'40',clay:'20'}})))
  .rejects.toMatchObject({statusCode:409,code:'ATTEMPT_CORRECTION_REQUIRED'});expect(f.all()).toEqual(before);
});
test('submitRecordedAttempt refuses a real unlinked accepted-parent child without writes',async()=>{
 const f=await unlinkedFixture(),before=f.all();
 await expect(inTransaction(f.db,tx=>require('../../services/workAttemptEventService').submitRecordedAttempt(tx,f.item,f.actor)))
  .rejects.toMatchObject({statusCode:409,code:'ATTEMPT_CORRECTION_REQUIRED'});expect(f.all()).toEqual(before);
});
test('mounted request/authorise routes keep requests pending, enforce a second person and preserve command replay',async()=>{
 const f=await fixture();let created;
 await withQcRunHttp(f.db,f.actor,async(app,token)=>{
  const response=await request(app).post('/api/samples/'+f.sample.id+'/amendments').set('Authorization','Bearer '+token).send(f.input);
  expect(response.status).toBe(200);created=response.body.amendment;expect(created).toMatchObject({status:'PENDING',version:1,authorizedBy:null});
  const before=f.all(),refused=await request(app).post('/api/samples/'+f.sample.id+'/amendments/'+created.id+'/authorise')
   .set('Authorization','Bearer '+token).send({expectedVersion:1});
  expect(refused.status).toBe(409);expect(refused.body.code).toBe('AMENDMENT_SECOND_PERSON_REQUIRED');expect(f.all()).toEqual(before);
 },{samples:true});
 await withQcRunHttp(f.db,f.other,async(app,token)=>{
  const url='/api/samples/'+f.sample.id+'/amendments/'+created.id+'/authorise',input={expectedVersion:1,idempotencyKey:randomUUID()};
  const approved=await request(app).post(url).set('Authorization','Bearer '+token).send(input);expect(approved.status).toBe(200);
  expect(approved.body.amendment).toMatchObject({status:'APPROVED',version:2});
  const before=f.all(),replay=await request(app).post(url).set('Authorization','Bearer '+token).send(input);
  expect(replay.status).toBe(200);expect(replay.body.amendment).toEqual(approved.body.amendment);expect(f.all()).toEqual(before);
  const listing=await request(app).get('/api/samples/'+f.sample.id+'/amendments').set('Authorization','Bearer '+token);
  expect(listing.status).toBe(200);expect(listing.body.amendments).toHaveLength(1);expect(listing.body.requiresSecondPerson).toBe(true);
 },{samples:true});
});

test('normal scientific retest review, reapproval and report generation preserve the withdrawn original and issue the next revision',async()=>{
 const f=await qcGateFixture({criteria:{blankPerBatch:0,lrmPerBatch:0,duplicateEvery:0,crmEveryNBatches:0,ccvEvery:0}});owned.push(f);
 require('../../scripts/install_sample_amendment_authorisation').installSampleAmendmentAuthorisation({dbPath:f.file,apply:true});
 await f.setPolicy([{key:'results.replicatesRequired',value:1},{key:'qc.mode',value:'OFF'},{key:'qc.requireBatchQc',value:'NOT_REQUIRED'}]);
 const item=f.items[0],record=value=>inTransaction(f.db,tx=>writeResultsExecution(tx,{sampleId:item.sampleId,workItemId:item.id,
  actor:f.actor,measurements:[{param:f.analysisCode,value,replicateNo:1,equipmentId:f.instrument.id}]}));
 const submit=async()=>{
  await require('../../services/workItemStateService').transitionWorkItem(item.id,'COMPLETED',f.actor,'Recorded complete reading',{},f.db);
  return require('../../services/submissionStateService').createSubmissionForItems({db:f.db,actor:f.actor,sampleId:item.sampleId,
   type:'FULL',workItemIds:[item.id]});
 };
 const authoriser=await f.db.user.create({data:{id:randomUUID(),username:'normal-amendment-authoriser-'+randomUUID(),
  email:randomUUID()+'@example.test',password:'owned-http-fixture',role:'LAB_MANAGER',labId:f.labId}});
 const other={id:authoriser.id,username:authoriser.username,role:authoriser.role,labId:f.labId};
 const [original]=await record('7.1');await submit();
 let initialReport;
 await withQcRunHttp(f.db,f.actor,async(app,token)=>{
  const post=url=>request(app).post(url).set('Authorization','Bearer '+token);
  const review=await post('/api/work/'+item.id+'/review').send({decision:'ACCEPT'});
  expect({status:review.status,body:review.body}).toMatchObject({status:200});
  const approval=await post('/api/samples/'+item.sampleId+'/approve');
  expect({status:approval.status,body:approval.body}).toMatchObject({status:200});
  const issued=await post('/api/reports/generate/'+item.sampleId);
  expect({status:issued.status,body:issued.body}).toMatchObject({status:200});initialReport=issued.body;
 },{reviews:true,samples:true,reports:true});
 const parent=await f.db.workAttempt.findUnique({where:{id:original.attemptId}}),priorSample=await f.db.sample.findUnique({where:{id:item.sampleId}});
 const priorSelections=await f.db.reportedValueSelection.findMany({where:{workItemId:item.id},orderBy:{id:'asc'}});
 const frozen=await f.db.report.findUnique({where:{id:initialReport.id}}),publicToken='owned-public-'+randomUUID();
 const link=await f.db.reportShareLink.create({data:{id:randomUUID(),reportId:frozen.id,createdBy:f.actor.username,
  tokenHash:createHash('sha256').update(publicToken).digest('hex')}});
 const {amendment}=await commands.command(f.db,{sampleId:item.sampleId,actor:f.actor,input:{type:'SCIENTIFIC',reason:'Client requested an analytical retest',
  reasonCode:'CLIENT_RETEST',selectedWorkItemIds:[item.id],idempotencyKey:randomUUID()}});
 const reopened=await commands.command(f.db,{sampleId:item.sampleId,amendmentId:amendment.id,actor:other,authorise:true,
  input:{expectedVersion:1,idempotencyKey:randomUUID()}}),child=reopened.attempts[0];
 expect(await f.db.sample.findUnique({where:{id:item.sampleId}})).toMatchObject({status:'PROCESSING',approvedBy:priorSample.approvedBy,approvedAt:priorSample.approvedAt});
 const withdrawn=await f.db.report.findUnique({where:{id:frozen.id}});
 expect(withdrawn).toEqual({...frozen,status:'WITHDRAWN',updatedAt:withdrawn.updatedAt});
 const retained=async()=>({report:await f.db.report.findUnique({where:{id:frozen.id}}),
  link:await f.db.reportShareLink.findUnique({where:{id:link.id}}),parent:await f.db.workAttempt.findUnique({where:{id:parent.id}}),
  selections:await f.db.reportedValueSelection.findMany({where:{id:{in:priorSelections.map(row=>row.id)}},orderBy:{id:'asc'}}),
  binding:await f.db.reportAmendmentWithdrawal.findUnique({where:{reportId:frozen.id}})});
 const retainedBefore=await retained();
 await withQcRunHttp(f.db,f.actor,async(app,token)=>{
  const premature=await request(app).post('/api/reports/generate/'+item.sampleId).set('Authorization','Bearer '+token);
  expect(premature.status).toBe(409);expect(await retained()).toEqual(retainedBefore);
  const historical=await request(app).get('/api/reports/'+frozen.id).set('Authorization','Bearer '+token);
  expect(historical.status).toBe(200);expect(historical.body.content).toEqual(JSON.parse(frozen.content));
  expect(historical.body.withdrawal.amendmentId).toBe(amendment.id);
  for(const suffix of ['','/pdf']){
   const publicResponse=await request(app).get('/api/reports/public/'+publicToken+suffix);
   expect(publicResponse.status).toBe(409);expect(publicResponse.body.code).toBe('REPORT_WITHDRAWN');
   expect(publicResponse.body).not.toHaveProperty('content');
  }
 },{reports:true});
 const [replacement]=await record('7.3');expect(replacement.attemptId).toBe(child.id);await submit();
 await withQcRunHttp(f.db,other,async(app,token)=>{
  const post=url=>request(app).post(url).set('Authorization','Bearer '+token);
  const review=await post('/api/work/'+item.id+'/review').send({decision:'ACCEPT',attemptId:child.id,
   reportedValueSelection:{mode:'ATTEMPT',attemptIds:[child.id],reason:'Report the completed client retest'}});
  expect({status:review.status,body:review.body}).toMatchObject({status:200});
  const approval=await post('/api/samples/'+item.sampleId+'/approve');
  expect({status:approval.status,body:approval.body}).toMatchObject({status:200});
  const issued=await post('/api/reports/generate/'+item.sampleId);
  expect({status:issued.status,body:issued.body}).toMatchObject({status:200});
  const revised=await f.db.report.findUnique({where:{id:issued.body.id}});
  expect(revised).toMatchObject({status:'PUBLISHED',version:frozen.version+1,reportNumberBase:frozen.reportNumberBase,revision:frozen.revision+1});
  const content=JSON.parse(revised.content);
  expect(content.publication).toMatchObject({replacesReportId:frozen.id,issuer:{username:other.username}});
  expect(content.signedBy.username).toBe(other.username);
  expect(content.resultGroups[0].items[0]).toMatchObject({value:'7.3',sourceResultIds:[replacement.id]});
 },{reviews:true,samples:true,reports:true});
 expect(await retained()).toEqual(retainedBefore);
 expect(await f.db.sampleAmendment.findUnique({where:{id:amendment.id}})).toMatchObject({status:'APPROVED',version:2,
  priorApprovedBy:priorSample.approvedBy,priorApprovedAt:priorSample.approvedAt});
 expect(await f.db.workAttempt.findUnique({where:{id:child.id}})).toMatchObject({status:'ACCEPTED',parentAttemptId:parent.id});
 expect(await f.db.result.findUnique({where:{id:original.id}})).toEqual({...original,isCurrent:false,supersededBy:replacement.id});
});
