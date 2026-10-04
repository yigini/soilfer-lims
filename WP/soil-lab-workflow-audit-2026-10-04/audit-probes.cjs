/* Read-only source audit plus isolated synthetic API counterexamples.
 * Reads DDL only from the local database. Never copies laboratory records.
 * Run: node WP/soil-lab-workflow-audit-2026-10-04/audit-probes.cjs
 * Add --serve to keep an isolated UI fixture on 127.0.0.1:5194.
 * New runs write probe-results.latest.json; preserve the original baseline.
 * Optional --output=path writes a separate comparison file.
 */
const fs = require('fs');
const path = require('path');
const { createRequire } = require('module');
const { pathToFileURL } = require('url');
const { execFileSync } = require('child_process');
const root = path.resolve(__dirname, '../..');
const outputArg = process.argv.find(arg => arg.startsWith('--output='));
const evidencePath = outputArg ? path.resolve(outputArg.slice('--output='.length)) : path.join(__dirname, 'probe-results.latest.json');
const req = createRequire(path.join(root, 'server/package.json'));
const Database = req('better-sqlite3');
const fixtureDir = path.join(root, '.tmp', 'workflow-audit-20261004');
fs.mkdirSync(fixtureDir, { recursive: true });
const dbPath = path.join(fixtureDir, `synthetic-${Date.now()}.db`);
process.env.NODE_ENV = 'test';
process.env.DATABASE_PATH = dbPath;
process.env.DATABASE_URL = `file:${dbPath}`;
process.env.JWT_SECRET = 'isolated-workflow-audit-not-a-real-secret';
process.env.DEPLOYMENT_MODE = 'global';
const evidence = { date: new Date().toISOString(), commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8', windowsHide: true }).trim(), auditBaseline: '878e894472708076228f590e58bd35ba2a8ecbfa', scope: 'Synthetic local fixtures only. DDL read from local dev DB; no source data copied. Not production or full lab UAT.', checks: [] };
const log = console.log;
console.log = () => {};
async function main() {
  const source = new Database(path.join(root, 'server/prisma/dev.db'), { readonly: true });
  const ddl = source.prepare("SELECT sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' AND type IN ('table','index') ORDER BY CASE type WHEN 'table' THEN 0 ELSE 1 END").all();
  source.close();
  const blank = new Database(dbPath);
  for (const row of ddl) blank.exec(row.sql);
  blank.close();
  const prisma = req('./prisma');
  const app = req('./app');
  const request = req('supertest');
  const qc = req('./services/qcService');
  const { RUN_PROFILES } = req('./controllers/qcController');
  const hash = req('bcryptjs').hashSync('SyntheticAudit2026!', 10);
  for (const id of ['AUDIT-A', 'AUDIT-B']) await prisma.lab.create({ data: { id, code: id, name: `Synthetic lab ${id}`, country: 'ITA' } });
  for (const [username, role, labId] of [['audit-tech','LAB_TECHNICIAN','AUDIT-A'], ['audit-manager','LAB_MANAGER','AUDIT-A'], ['audit-foreign','LAB_MANAGER','AUDIT-B']]) {
    await prisma.user.create({ data: { id: username, username, password: hash, email: `${username}@example.invalid`, role, labId, isActive: true } });
  }
  await prisma.analysisCategory.create({ data: { id: 'audit-chem', name: 'Soil chemistry' } });
  await prisma.analysis.create({ data: { code: 'PH_H2O', name: 'Soil pH in water', units: 'pH_units', status: 'active', categoryId: 'audit-chem', validation: JSON.stringify({min:0,max:14}) } });
  await prisma.methodology.create({ data: { id: 'audit-ph', analysisCode: 'PH_H2O', name: 'Synthetic pH method', standard: 'Synthetic fixture', isDefault: true } });
  const tokens = Object.fromEntries(['audit-tech','audit-manager','audit-foreign'].map(id => [id, req('jsonwebtoken').sign({id,tokenVersion:0},process.env.JWT_SECRET,{expiresIn:'2h'})]));
  const call = async (method, url, body, actor='audit-tech') => {
    let op = request(app)[method](url).set('Authorization', `Bearer ${tokens[actor]}`);
    if (body !== undefined) op=op.send(body);
    return await op;
  };
  const save = (id, description, observed, assessment) => evidence.checks.push({id,description,observed,assessment});
  const payload = {blanks:[{value:0.02}],controls:[{expected:7,measured:7.03}],duplicates:[{value1:6.85,value2:6.87}]};
  save('P01','RACK_40 requires two duplicate positions; submit only one duplicate',qc.evaluateBatchQc(payload,{runProfile:RUN_PROFILES.RACK_40}),'Expect incomplete; current evaluator passes');
  save('P02','Duplicate values +1 and -1 have zero mean',qc.evaluateDuplicate({value1:1,value2:-1}),'Expect invalid/not evaluable; current evaluator passes with RPD zero');
  save('P03','QC screen uses parseFloat while bench supports decimal comma',{qc:parseFloat('6,85'),bench:req('./services/workbenchValidationService').parseDeterminationValue('6,85').normalizedValue},'Different scientific values for the same input');
  async function batch(id,status='OPEN',data={}) { return prisma.batch.create({data:{id,labId:'AUDIT-A',analysis:'PH_H2O',status,createdBy:'audit-tech',maxCapacity:40,profile:'RACK_40',workItemIds:'[]',...data}}); }
  async function sample(id,status='PROCESSING',lab='AUDIT-A') { return prisma.sample.create({data:{id,originalId:`ORIG-${id}`,labId:`LAB-${id}`,assignedLab:lab,status,receptionDate:new Date(),dryingStatus:'DONE',preparationStatus:'DONE',requiredAnalyses:'["PH_H2O"]'}}); }
  async function work(id,sampleId,status='ASSIGNED',batchId=null,lab='AUDIT-A') { return prisma.workItem.create({data:{id,sampleId,analysis:'PH_H2O',methodologyId:'audit-ph',category:'Soil chemistry',status,assignedTo:lab==='AUDIT-A'?'audit-tech':null,labId:lab,assignedLab:lab,batchId,result:status==='SUBMITTED'?'6.5':null}}); }
  await batch('defaults');
  let res = await call('put','/api/qc/batches/defaults',payload);
  save('P04','QC UI default values submitted unchanged',{http:res.status,status:res.body.status,qcRows:await prisma.batchQcResult.count({where:{batchId:'defaults'}})},'Expect no prefilled real measurements; synthetic defaults currently pass');
  await sample('foreign','PROCESSING','AUDIT-B'); await work('foreign-wi','foreign','ASSIGNED',null,'AUDIT-B');
  res=await call('post','/api/reviews/foreign-wi',{decision:'ACCEPT'},'audit-manager');
  save('P05','Manager A calls legacy review route for lab B assigned item',{http:res.status,body:res.body,persisted:(await prisma.workItem.findUnique({where:{id:'foreign-wi'}})).status},'Expect scope and submitted-evidence rejection');
  await sample('pending'); await batch('pending-batch'); await work('pending-wi','pending','SUBMITTED','pending-batch');
  res=await call('post','/api/work/pending-wi/review',{decision:'ACCEPT'},'audit-manager');
  save('P06','Canonical review accepts submitted item in unevaluated OPEN batch',{http:res.status,body:res.body,persisted:(await prisma.workItem.findUnique({where:{id:'pending-wi'}})).status},'Expect pending QC to block acceptance');
  await sample('publish-pending','SUBMITTED_FULL'); await work('publish-wi','publish-pending','SUBMITTED','pending-batch');
  await prisma.result.create({data:{id:'publish-result',sampleId:'publish-pending',param:'PH_H2O',value:'6.5',numericValue:6.5,unit:'pH_units',isValid:true,methodologyId:'audit-ph',batchId:'pending-batch'}});
  res=await call('post','/api/reports/generate/publish-pending',{},'audit-manager');
  save('P07','Publish submitted but unapproved sample with OPEN QC',{http:res.status,bodyStatus:res.body.status,error:res.body.error,published:await prisma.report.count({where:{sampleId:'publish-pending',status:'PUBLISHED'}})},'Expect report publication blocked');
  await sample('queue'); await work('queue-wi','queue');
  await prisma.result.create({data:{id:'queue-current',sampleId:'queue',param:'PH_H2O',value:'6.2',isCurrent:true,replicateNo:1}});
  await prisma.result.create({data:{id:'queue-stale',sampleId:'queue',param:'PH_H2O',value:'9.9',isCurrent:false,replicateNo:2}});
  res=await call('get','/api/workbench/queue?workItemId=queue-wi');
  save('P08','Queue result selection with current 6.2 and superseded replicate 9.9',{http:res.status,currentResult:res.body.groups?.flatMap(g=>g.items).find(i=>i.id==='queue-wi')?.currentResult,error:res.body.error},'Expect explicit current attempt/replicate, never stale 9.9');
  await prisma.result.create({data:{id:'queue-replicate2',sampleId:'queue',param:'PH_H2O',value:'6.8',isCurrent:true,replicateNo:2}});
  res=await call('get','/api/workbench/queue?workItemId=queue-wi');
  save('P08b','Two current replicates 6.2 and 6.8 collapse into a scalar queue value',{http:res.status,currentResult:res.body.groups?.flatMap(g=>g.items).find(i=>i.id==='queue-wi')?.currentResult},'Expect explicit replicate identity and reportable selection; one scalar hides the pair');
  await sample('record'); await work('record-wi','record');
  res=await call('post','/api/workbench/batch-save',{draft:false,entries:[{workItemId:'record-wi',value:'6.4',version:0,replicateNo:1}]});
  save('P09','Record ordinary numeric determination',{http:res.status,saved:res.body.saved,errors:res.body.errors,attempts:await prisma.workAttempt.count({where:{workItemId:'record-wi'}}),results:await prisma.result.count({where:{sampleId:'record'}})},'Expect attempt lineage for every recorded determination');
  await batch('old-batch'); await batch('new-batch'); await sample('move'); await work('move-wi','move');
  const a=await call('post','/api/qc/batches/old-batch/items',{workItemIds:['move-wi']});
  const b=await call('post','/api/qc/batches/new-batch/items',{workItemIds:['move-wi']});
  save('P10','Allocate same work item to another batch without explicit transfer',{firstHttp:a.status,secondHttp:b.status,itemBatch:(await prisma.workItem.findUnique({where:{id:'move-wi'}})).batchId,oldMembership:(await prisma.batch.findUnique({where:{id:'old-batch'}})).workItemIds},'Expect rejection or atomic audited transfer; memberships diverge');
  await batch('close-fail','QC_PASS',{qcResults:JSON.stringify(qc.evaluateBatchQc(payload,{runProfile:RUN_PROFILES.RACK_40}))});
  res=await call('put','/api/qc/batches/close-fail',{...payload,blanks:[{value:10}],status:'CLOSED'},'audit-manager');
  const closed=await prisma.batch.findUnique({where:{id:'close-fail'}});
  save('P11','Same request supplies failing QC and closes previously passed batch',{http:res.status,status:closed.status,evaluation:JSON.parse(closed.qcResults).overallStatus,disposition:closed.disposition},'Expect closure denied against newly evaluated failure');
  await batch('null-blank'); res=await call('put','/api/qc/batches/null-blank',{...payload,blanks:[{value:null}]});
  save('C01','Null blank regression control',{http:res.status,status:res.body.status},'Current safeguard: no QC_PASS');
  await batch('closed-control','CLOSED'); res=await call('post','/api/qc/batches/closed-control/evaluate',payload);
  save('C02','Closed batch direct evaluation regression control',{http:res.status,error:res.body.error},'Current safeguard: rejected');
  await batch('false-pass'); res=await call('put','/api/qc/batches/false-pass',{status:'QC_PASS'});
  save('C03','Direct PASS without evidence regression control',{http:res.status,error:res.body.error},'Current safeguard: rejected');
  for (let i=1;i<=100;i++) {const id=`BENCH-${String(i).padStart(3,'0')}`; await sample(id); await work(`wi-${id}`,id);}
  fs.writeFileSync(evidencePath,JSON.stringify(evidence,null,2)+'\n');
  log(JSON.stringify(evidence,null,2));
  if(process.argv.includes('--serve')) {
    process.chdir(path.join(root,'client'));
    app.listen(5193,'127.0.0.1');
    const {createServer}=await import(pathToFileURL(path.join(root,'client/node_modules/vite/dist/node/index.js')).href);
    const clientReq=createRequire(path.join(root,'client/package.json'));
    const vite=await createServer({root:path.join(root,'client'),configFile:false,plugins:[clientReq('@vitejs/plugin-react')()],define:{'import.meta.env.DEV':false,__APP_VERSION__:JSON.stringify('audit-source'),__BUILD_DATE__:JSON.stringify('2026-10-04')},server:{host:'127.0.0.1',port:5194,strictPort:true,proxy:{'/api':{target:'http://127.0.0.1:5193',changeOrigin:true}}}});
    await vite.listen(); log('Synthetic fixture ready at http://127.0.0.1:5194; audit-tech / SyntheticAudit2026!');
  } else {await prisma.$disconnect();process.exit(0);}
}
main().catch(error=>{evidence.error=error.stack;fs.writeFileSync(evidencePath,JSON.stringify(evidence,null,2)+'\n');log(error.stack);process.exit(1);});
