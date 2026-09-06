/* Read-only source audit: actual controller functions, entirely in-memory dependencies.
 * No Prisma client, database connection, network, app login or production write.
 * Asserts the observed OLD defects; these are not passing acceptance tests for a fix.
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..');
const workflow = require(path.join(root, 'server/workflowContract'));
const clone = x => JSON.parse(JSON.stringify(x));
function loadController(name, prisma) {
  const module = { exports: {} };
  const mocks = {
    '../prisma': prisma,
    '../services/analysisService': { loadAnalyses: async () => [], getAnalysisName: c => c },
    '../workflowContract': workflow,
    './notificationController': { createNotification: async () => {} },
    '../wsServer': { broadcastToLab() {}, broadcastToUser() {} },
    '../utils/scopeGuard': { canAccessEntity: () => true },
    '../data/operationalChecklists.json': require(path.join(root, 'server/data/operationalChecklists.json')),
    './validationController': {}, '../services/draftService': {},
    '../services/workbenchValidationService': {}, '../services/workbenchReadinessService': {},
    '../utils/soilCalculations': {}
  };
  const file = path.join(root, 'server/controllers', name);
  vm.runInNewContext(fs.readFileSync(file, 'utf8'), {
    module, exports: module.exports, console, Date, Set, Map,
    require: id => { if (!(id in mocks)) throw Error('Unmocked dependency: '+id); return mocks[id]; }
  }, { filename: file });
  return module.exports;
}
function response() { return { statusCode:200, status(code){this.statusCode=code;return this;}, json(data){this.body=clone(data);return this;} }; }
(async()=>{
  const sample={id:'SYNTHETIC-S1',labId:'SYNTHETIC-S1',assignedLab:'LAB-A',status:'ACCEPTED',dryingStatus:'DONE',preparationStatus:'PENDING'};
  let stored={id:'SYNTHETIC-PREP',sampleId:sample.id,analysis:'PREPARATION',category:'Operational Gates',status:'ASSIGNED',assignedTo:'test-tech',version:0,result:null,history:'[]'};
  const prisma={
    workItem:{findUnique:async()=>({...clone(stored),sample:clone(sample)}),update:async({data})=>{stored={...stored,...clone(data),version:stored.version+1};return clone(stored);}},
    sample:{findUnique:async()=>clone(sample),update:async({data})=>{Object.assign(sample,clone(data));return clone(sample);}},
    equipmentMethodEligibility:{findFirst:async()=>null},
    auditLog:{create:async()=>({id:'AUDIT-SYNTHETIC'})},$transaction:async ops=>Promise.all(ops)
  };
  const work=loadController('workItemController.js',prisma);
  const report={checkedAt:new Date().toISOString(),mode:'actual-controller-functions-with-in-memory-mocks',productionWrites:false,findings:[]};
  let res=response();
  await work.updateWorkItemStatus({params:{id:stored.id},body:{status:'COMPLETED',result:'Done'},user:{role:'LAB_TECHNICIAN',username:'test-tech',labId:'LAB-A'}},res);
  assert.equal(res.statusCode,200);assert.equal(stored.status,'COMPLETED');assert.equal(stored.result,'Done');assert.equal(sample.preparationStatus,'DONE');
  report.findings.push({id:'P1',confirmed:true,description:'Legacy status writer completes preparation without checklist; later auto-accept mutation is not persisted.',storedStatus:stored.status,storedResult:stored.result,gateFlag:sample.preparationStatus});
  res=response();
  await work.reviewWorkItem({params:{id:stored.id},body:{status:'ACCEPTED',note:'Synthetic review'},user:{role:'LAB_MANAGER',username:'test-manager',labId:'LAB-A'}},res);
  assert.equal(res.statusCode,400);assert.equal(res.body.code,'INVALID_TRANSITION');
  report.findings.push({id:'P2',confirmed:true,description:'Manager cannot approve this completed gate; review requires SUBMITTED.',httpStatus:res.statusCode,error:res.body.code});
  const benchPrisma={
    workItem:{findMany:async q=>q.include ? [{...clone(stored),submissionId:null,sample:clone(sample)}] : [{...clone(stored)}]},
    equipmentMethodEligibility:{findMany:async()=>[]}
  };
  let bench=loadController('workbenchController.js',benchPrisma);res=response();
  await bench.previewSubmissions({body:{},user:{role:'LAB_TECHNICIAN',username:'test-tech'}},res);
  assert.equal(res.body.totalCompletedItems,1);assert.equal(res.body.eligibleSamples[0].items[0].result,'Done');
  report.findings.push({id:'P3',confirmed:true,description:'Submission preview considers bare legacy Done eligible; merely restoring the submit button would submit missing evidence.'});
  benchPrisma.workItem.findMany=async()=>[{...clone(stored),status:'ACCEPTED',sample:clone(sample)}];
  bench=loadController('workbenchController.js',benchPrisma);res=response();
  await bench.batchSave({body:{draft:true,entries:[{workItemId:stored.id,checks:[true,true,true],version:1}]},user:{role:'LAB_TECHNICIAN',username:'test-tech',labId:'LAB-A'}},res);
  assert.equal(res.statusCode,200);assert.equal(res.body.success,true);assert.equal(res.body.saved,0);assert.equal(res.body.errors.length,1);
  report.findings.push({id:'P4',confirmed:true,description:'Rejected sealed draft returns HTTP 200 and success:true with saved:0 plus an error; client currently treats HTTP success as saved.',response:res.body});
  report.limitations=['Mocked persistence does not prove database isolation, actual race timing, full RBAC or browser behaviour.','These probes intentionally confirm defects in the audited source. Replace with desired-behaviour integration tests in implementation.'];
  fs.writeFileSync(path.join(__dirname,'defect-probe-results.json'),JSON.stringify(report,null,2)+'\n');
  console.log('Four current defects confirmed using isolated controller calls. No production writes.');
})().catch(e=>{console.error(e);process.exitCode=1;});
