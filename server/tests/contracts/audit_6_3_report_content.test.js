const fs=require('node:fs'),path=require('node:path');
const {randomUUID}=require('node:crypto');
const request=require('supertest');
const PDFDocument=require('pdfkit');
const evidence=require('../../services/reportContentEvidence');
const display=require('../../services/reportContentDisplay');
const policies=require('../../services/policyService');
const {qcGateFixture}=require('../helpers/qcGateFixture');
const {withQcRunHttp}=require('../helpers/qcRunHttpHarness');
const {appendReportedSelection}=require('../../services/reportedValueSelectionService');
const rules=require('../../services/workflowStateRules');
const {assembleReport}=require('../../services/reportAssembly');
const {generateReportPdfBuffer}=require('../../services/pdfGenerator');
const owned=[];
afterEach(async()=>{jest.restoreAllMocks();for(const f of owned.splice(0))await f.close();});
async function fixture({approved=false,approval={}}={}){
 const f=await qcGateFixture({status:'ACCEPTED',criteria:{blankPerBatch:0,lrmPerBatch:0,duplicateEvery:0,crmEveryNBatches:0,ccvEvery:0}});
 owned.push(f);
 if(approved){
  const {createSampleFixture,createWorkItemFixture}=require('../helpers/workflowFixtures');
  const sample=await createSampleFixture(f.db,{data:{id:randomUUID(),originalId:randomUUID(),assignedLab:f.labId,
   status:'APPROVED',dryingStatus:'DONE',preparationStatus:'DONE',receptionDate:new Date(),...approval}});
  const item=await createWorkItemFixture(f.db,{data:{id:randomUUID(),sampleId:sample.id,labId:f.labId,analysis:f.analysisCode,
   methodologyId:f.method.id,status:'ACCEPTED',result:'7',history:'[]'}});f.items=[item];
 }
 f.row=await f.result(f.items[0]);
 await rules.inTransaction(f.db,tx=>appendReportedSelection(tx,f.items[0],f.actor));
 return f;
}
test.each(['ISO17025_STRICT','BASIC','ADVISORY'])('uncertainty requires explicit lab policy in %s',preset=>{
 const registry=require('../../config/policyRegistry');
 expect(registry.definition('report.uncertaintyMode')).toMatchObject({scope:'LAB+METHOD',type:'enum',presets:{[preset]:'NOT_REPORTED'}});
 expect(registry.definition('report.uncertaintyCoverageFactor')).toMatchObject({scope:'LAB+METHOD',min:1,nullable:true,presets:{[preset]:null}});
 expect(registry.valid('report.uncertaintyCoverageFactor',0.99)).toBe(false);
 expect(registry.valid('report.uncertaintyCoverageFactor',null)).toBe(true);
});
test.each([
 ['NOT_REPORTED',0.25,2,7,false,{state:'NOT_STATED'}],
 ['EXPANDED_ABSOLUTE',0.25,2,7,false,{state:'EXPANDED',value:0.25}],
 ['EXPANDED_RELATIVE_PCT',5,3,-7,false,{state:'EXPANDED',value:0.35,relativePct:5}],
 ['EXPANDED_ABSOLUTE',0.25,null,7,false,{state:'NOT_STATED'}],
 ['EXPANDED_ABSOLUTE',null,2,7,false,{state:'NOT_STATED'}],
 ['EXPANDED_ABSOLUTE',0,2,7,false,{state:'NOT_STATED'}],
 ['EXPANDED_RELATIVE_PCT',5,2,null,false,{state:'NOT_STATED'}],
 ['EXPANDED_RELATIVE_PCT',5,2,0,false,{state:'EXPANDED',value:0}],
 ['EXPANDED_ABSOLUTE',0.25,2,7,true,{state:'CENSORED'}]
])('declared uncertainty %s/%s/%s/%s/censored=%s follows its exact meaning',(mode,amount,k,value,censored,expected)=>{
 expect(evidence.expandedUncertainty(value,{uncertainty:amount},{mode,coverageFactor:k},{censored})).toMatchObject(expected);
});
test('uncertainty scopes resolve per laboratory and method without changing scientific rows',async()=>{
 const f=await fixture(),other=await f.db.lab.create({data:{id:randomUUID(),code:randomUUID(),name:'Other report lab',country:'ZZ'}});
 await f.setPolicy([{key:'report.uncertaintyMode',value:'EXPANDED_ABSOLUTE',analysisCode:f.analysisCode,methodologyId:f.method.id},
  {key:'report.uncertaintyCoverageFactor',value:2,analysisCode:f.analysisCode,methodologyId:f.method.id}]);
 const before=await f.snapshot(),scope={db:f.db,analysisCode:f.analysisCode,methodologyId:f.method.id};
 expect(await policies.get(f.labId,'report.uncertaintyMode',scope)).toBe('EXPANDED_ABSOLUTE');
 expect(await policies.get(f.labId,'report.uncertaintyCoverageFactor',scope)).toBe(2);
 expect(await policies.get(other.id,'report.uncertaintyMode',scope)).toBe('NOT_REPORTED');
 expect(await policies.get(f.labId,'report.uncertaintyMode',{db:f.db,analysisCode:f.analysisCode,methodologyId:null})).toBe('NOT_REPORTED');
 expect(await f.snapshot()).toEqual(before);
});
test('assembly discloses missing frozen method and approval instead of selecting current directory defaults',async()=>{
 const f=await fixture();await f.db.methodology.update({where:{id:f.method.id},data:{name:'CURRENT METHOD MUST NOT PRINT',uncertainty:99,decimalPlaces:2}});
 await f.db.user.create({data:{id:randomUUID(),username:'unrelated-manager',email:'other@example.invalid',password:'unusable',role:'LAB_MANAGER',labId:f.labId,name:'UNRELATED MANAGER'}});
 const before=await f.snapshot(),{content}=await assembleReport(f.items[0].sampleId,{...f.actor,language:'en'},{db:f.db});
 const item=content.resultGroups[0].items[0];
 expect(item).toMatchObject({method:null,methodVersion:null,uncertainty:{state:'NOT_STATED'},basis:f.row.basis,
  sourceResultIds:[f.row.id],decimalPlaces:2});
 expect(content.signedBy).toEqual({name:null,username:null,title:null,date:null});
 expect(JSON.stringify(content)).not.toMatch(/CURRENT METHOD MUST NOT PRINT|UNRELATED MANAGER/);
 expect(content.sample.reportEvidence).toMatchObject({sampling:null});
 expect(await f.snapshot()).toEqual(before);
});
test('methods and revisions follow selected source attempts and list distinct frozen methods',()=>{
 const sources=[{param:'SOC',methodologyId:'m1',attemptId:'a1'},{param:'SOC',methodologyId:'m2',attemptId:'a2'}];
 const attempts=[{id:'a1',executedMethodRevision:JSON.stringify({methodologyId:'m1',version:3,name:'Executed WB',standard:'SOP WB'})},
  {id:'a2',executedMethodRevision:JSON.stringify({methodologyId:'m2',version:4,name:'Executed combustion',reference:{citation:'Retained reference'}})}];
 expect(evidence.executedMethods(sources,attempts,[])).toEqual([
  {param:'SOC',methodologyId:'m1',methodVersion:3,method:'Executed WB',standard:'SOP WB',reference:null},
  {param:'SOC',methodologyId:'m2',methodVersion:4,method:'Executed combustion',standard:null,reference:{citation:'Retained reference'}}]);
 expect(evidence.executedMethods(sources,[],[]).every(row=>row.method===null&&row.methodVersion===null)).toBe(true);
});
test('approval role is matched to retained actor and approval timestamp, never a current role',()=>{
 const sample={approvedBy:'actual-approver',approvedAt:'2026-10-09T10:00:00.000Z'};
 const approval={username:sample.approvedBy,name:'Actual approver',role:'LAB_MANAGER',approvedAt:sample.approvedAt};
 const row={action:'SAMPLE_APPROVED',performedBy:sample.approvedBy,timestamp:sample.approvedAt,after:JSON.stringify({approval})};
 expect(evidence.approvalEvidence(sample,[row])).toMatchObject({name:'Actual approver',title:'LAB_MANAGER',date:sample.approvedAt});
 expect(evidence.approvalEvidence(sample,[{...row,performedBy:'other'}])).toMatchObject({name:sample.approvedBy,title:null});
 expect(evidence.approvalEvidence(sample,[{...row,timestamp:'2026-10-08T10:00:00Z'}])).toMatchObject({title:null});
});
test.each(['EXPANDED_ABSOLUTE','EXPANDED_RELATIVE_PCT'])('actual execution, acceptance and publication freeze %s uncertainty and approval',async mode=>{
 const f=await qcGateFixture({criteria:{blankPerBatch:0,lrmPerBatch:0,duplicateEvery:0,crmEveryNBatches:0,ccvEvery:0}});owned.push(f);
 await f.db.methodology.update({where:{id:f.method.id},data:{uncertainty:mode==='EXPANDED_ABSOLUTE'?0.25:5,decimalPlaces:2}});
 await f.setPolicy([{key:'qc.mode',value:'OFF'},{key:'qc.requireBatchQc',value:'NOT_REQUIRED'},
  {key:'report.uncertaintyMode',value:mode,analysisCode:f.analysisCode,methodologyId:f.method.id},
  {key:'report.uncertaintyCoverageFactor',value:3,analysisCode:f.analysisCode,methodologyId:f.method.id}]);
 const [result]=await rules.inTransaction(f.db,tx=>require('../../services/resultWriteService').writeResultsExecution(tx,
  {sampleId:f.items[0].sampleId,workItemId:f.items[0].id,actor:f.actor,
   measurements:[{param:f.analysisCode,value:'7.123456789',equipmentId:f.instrument.id}]}));
 await require('../../services/workItemStateService').transitionWorkItem(f.items[0].id,'COMPLETED',f.actor,'Recorded report evidence',{},f.db);
 await require('../../services/submissionStateService').createSubmissionForItems({db:f.db,actor:f.actor,
  sampleId:f.items[0].sampleId,type:'FULL',workItemIds:[f.items[0].id]});
 await withQcRunHttp(f.db,f.actor,async(app,token)=>{
  const post=(url)=>request(app).post(url).set('Authorization','Bearer '+token);
  const review=await post('/api/work/'+f.items[0].id+'/review').send({decision:'ACCEPT'});
  expect({status:review.status,body:review.body}).toMatchObject({status:200});
  const approval=await post('/api/samples/'+f.items[0].sampleId+'/approve');
  expect({status:approval.status,body:approval.body}).toMatchObject({status:200});
  const before=await f.db.result.findMany(),attempts=await f.db.workAttempt.findMany();
  const issued=await post('/api/reports/generate/'+f.items[0].sampleId);
  expect({status:issued.status,body:issued.body}).toMatchObject({status:200});
  const report=await f.db.report.findUnique({where:{id:issued.body.id}}),content=JSON.parse(report.content),item=content.resultGroups[0].items[0];
  expect(item).toMatchObject({value:result.value,sourceResultIds:[result.id],methodVersion:String(f.method.version),
   uncertainty:{state:'EXPANDED',mode,coverageFactor:3,value:mode==='EXPANDED_ABSOLUTE'?0.25:Math.abs(result.numericValue)*0.05}});
  expect(display.displayResult(item,require('../../locales/en.json').resultReports)).toBe('7.12');
  expect(display.displayUncertainty(item,require('../../locales/en.json').resultReports)).toContain(mode==='EXPANDED_ABSOLUTE'?'± 0.25':'± 0.36');
  const sample=await f.db.sample.findUnique({where:{id:f.items[0].sampleId}});
  expect(content.signedBy).toMatchObject({username:f.actor.username,title:f.actor.role,date:sample.approvedAt.toISOString()});
  expect(content.publication).toMatchObject({publishedAt:report.publishedAt.toISOString(),issuer:{username:f.actor.username,role:f.actor.role}});
  expect(await f.db.result.findMany()).toEqual(before);expect(await f.db.workAttempt.findMany()).toEqual(attempts);
 },{reviews:true,samples:true,reports:true});
});
test('receipt and analysis dates use recorded intake and selected attempts only',()=>{
 const sample={receptionDate:'2026-10-01T09:00:00Z',moistureOnArrival:'WET',metadata:JSON.stringify({nonConformance:{reason:'Broken seal'}}),
  receptionData:JSON.stringify({checklist:{items:{condition:{status:'FAIL',note:'Torn bag'}}}})};
 const sources=[{attemptId:'selected-a'},{attemptId:'selected-b'},{attemptId:null,analysedAt:'2026-10-04T11:00:00Z'}];
 const attempts=[{id:'selected-a',evidenceData:JSON.stringify({recordedAt:'2026-10-03T10:00:00Z'})},
  {id:'selected-b',evidenceData:JSON.stringify({recordedAt:'2026-10-05T12:00:00Z'})},
  {id:'unselected',evidenceData:JSON.stringify({recordedAt:'2020-01-01T00:00:00Z'})}];
 expect(evidence.sampleContentEvidence(sample,sources,attempts)).toEqual({receiptDate:'2026-10-01T09:00:00.000Z',
  conditionOnReceipt:{moisture:'WET',status:'FAIL',note:'Torn bag'},intakeNonconformities:['Broken seal'],
  analysisStart:'2026-10-03T10:00:00.000Z',analysisEnd:'2026-10-05T12:00:00.000Z',sampling:null});
 expect(evidence.sampleContentEvidence({},[],[])).toMatchObject({receiptDate:null,analysisStart:null,analysisEnd:null,sampling:null});
});
test.each(['issue','revision'].flatMap(kind=>[{}, {approvedBy:'system:fixture'}, {approvedAt:new Date('2026-10-09T10:00:00Z')}].map(approval=>[kind,approval])))(
 'missing approval evidence refuses new %s with stable conflict: %j',async(kind,approval)=>{
 const f=await fixture({approved:true,approval});
 if(kind==='revision')await f.db.report.create({data:{id:randomUUID(),sampleId:f.items[0].sampleId,labId:f.labId,
  status:'PUBLISHED',version:1,publishedAt:new Date('2020-01-02T00:00:00Z'),generatedBy:'historical-issuer',
  content:JSON.stringify({reportNumber:'HISTORICAL-212',sample:{id:f.items[0].sampleId},resultGroups:[]})}});
 const snapshot=async()=>({rows:await f.snapshot(),sequences:await f.db.reportSequence.findMany(),
  attempts:await f.db.workAttempt.findMany(),selections:await f.db.reportedValueSelection.findMany()});
 const before=await snapshot();let response;
 await jest.isolateModulesAsync(async()=>{
  jest.doMock('../../prisma',()=>f.db);
  const res={status(code){this.code=code;return this;},json(body){response={status:this.code||200,body};return this;}};
  await require('../../controllers/reportController').generateReport({params:{sampleId:f.items[0].sampleId},user:f.actor},res);
 });jest.dontMock('../../prisma');
 expect(response).toMatchObject({status:409,body:{code:'REPORT_APPROVAL_EVIDENCE_REQUIRED'}});
 expect(()=>evidence.assertApprovalEvidence(approval)).toThrow(expect.objectContaining({code:'REPORT_APPROVAL_EVIDENCE_REQUIRED',statusCode:409}));
 expect(await snapshot()).toEqual(before);
 if(kind==='revision')await withQcRunHttp(f.db,f.actor,async(app,token)=>{
  const report=await f.db.report.findFirst({where:{sampleId:f.items[0].sampleId}});
  const pdf=await request(app).get('/api/reports/'+report.id+'/pdf').set('Authorization','Bearer '+token);
  expect(pdf.status).toBe(200);expect(pdf.headers['content-type']).toMatch(/application\/pdf/);
 },{reports:true});
 expect(await snapshot()).toEqual(before);
});
test('unreadable approval time cannot authorize new issue',()=>{
 expect(()=>evidence.assertApprovalEvidence({approvedBy:'actor',approvedAt:'invalid'}))
  .toThrow(expect.objectContaining({code:'REPORT_APPROVAL_EVIDENCE_REQUIRED'}));
});
const golden=require('../helpers/fixtures/report_content_6_3_golden.json');
test.each(golden)('golden PDF %s preserves censoring, uncertainty, QC and publication evidence',async row=>{
 const calls=[],original=PDFDocument.prototype.text;
 jest.spyOn(PDFDocument.prototype,'text').mockImplementation(function(value,x,y,options){calls.push(String(value));return original.call(this,value,x,y,options);});
 const content={meta:{locale:'en'},sample:{id:'OWNED-212',labId:'OWNED-212',reportEvidence:{conditionOnReceipt:{moisture:'DRY'},
  intakeNonconformities:[],analysisStart:'2026-10-08T10:00:00.000Z',analysisEnd:'2026-10-08T11:00:00.000Z',sampling:null}},
  lab:{name:'Owned report laboratory',code:'OWNED'},signedBy:{name:'Actual approver',username:'approver',title:'LAB_MANAGER',date:'2026-10-09T10:00:00.000Z'},
  publication:{status:'PUBLISHED',publishedAt:'2026-10-09T12:00:00.000Z',issuer:{username:'issuer',name:'Actual issuer',role:'LAB_MANAGER'},
   ...(row.amended?{replacesReportNumber:'OWNED-2026-00001',amendmentReason:'Corrected client spelling'}:{})},
  reportNumber:row.amended?'OWNED-2026-00001-R1':'OWNED-2026-00001',
  qcStatement:row.warning?'QC: PROCEED_WITH_WARNING · Reviewed blank warning':'QC: recorded decisions',
  resultGroups:[{categoryName:'Retained values',items:[{param:'SOC',name:'Soil organic carbon',value:row.value,unit:'g/kg',basis:'OVEN_DRY',
   reportedValueSelectionId:'saved-selection',decimalPlaces:2,censoring:row.censoring,method:'Executed WB',
   uncertainty:row.uncertainty,flags:row.warning?['QC_WARN']:[],qcNotes:row.warning?['PROCEED_WITH_WARNING · Reviewed blank warning']:[]}]}],
  methodologies:[{param:'SOC',method:'Executed WB',methodVersion:3,standard:'Retained laboratory SOP',reference:{citation:'Retained method reference'}}]};
 const pdf=await generateReportPdfBuffer(content);
 expect(pdf.subarray(0,5).toString()).toBe('%PDF-');
 for(const text of row.expectedText)expect(calls.some(value=>value.includes(text))).toBe(true);
 expect(calls.some(value=>/40.?C|QC.*met limits|GLOSOLAN Registered Laboratory/.test(value))).toBe(false);
 if(process.env.AUDIT_212_PDF_OUTPUT){const directory=path.resolve(process.env.AUDIT_212_PDF_OUTPUT);fs.mkdirSync(directory,{recursive:true});
  fs.writeFileSync(path.join(directory,row.name+'.pdf'),pdf);}
});
test.each(['en','es','es-419','fr','pt'])('all report and uncertainty policy labels exist in %s',locale=>{
 const labels=require('../../locales/'+locale+'.json').resultReports;
 for(const key of ['notStated','expandedUncertainty','conditionOnReceipt','intakeNonconformities','analysisDates','sampling','issuedAt','approvalNotRecorded'])expect(labels[key]).toEqual(expect.any(String));
 const item={value:'<0.5',reportedValueSelectionId:'saved',censoring:'BELOW_LOQ',decimalPlaces:6};
 expect(display.displayResult(item,labels)).toBe('<0.5 (LOQ)');expect(display.displayUncertainty(item,labels)).toBe('—');
 for(const file of ['../../locales/','../../../client/src/translations/'])for(const key of ['report_uncertaintyMode','report_uncertaintyCoverageFactor'])
  expect(require(file+locale+'.json').policies.keys[key]).toEqual(expect.any(String));
});
