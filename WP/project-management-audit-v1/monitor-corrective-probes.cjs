/* Read-only source audit; all mutations use a NEW temporary schema-only SQLite DB.
 * Run: node WP/project-management-audit-v1/audit-probes.cjs
 * Does not load server/app.js, start integration schedulers or contact production.
 */
const fs = require('fs'), path = require('path'), os = require('os');
const { createRequire } = require('module');
const { createHash } = require('crypto');
const root = path.resolve(__dirname, '../..');
const req = createRequire(path.join(root, 'server/package.json'));
const Database = req('better-sqlite3');
const sourcePath = path.join(root, 'server/prisma/dev.db');
const hash = () => createHash('sha256').update(fs.readFileSync(sourcePath)).digest('hex');
const before = hash();
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-project-audit-'));
const fixture = path.join(dir, 'fixture.db');
const source = new Database(sourcePath, { readonly: true, fileMustExist: true });
const ddl = source.prepare("SELECT sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' AND type IN ('table','index') ORDER BY CASE type WHEN 'table' THEN 0 ELSE 1 END").all();
source.close();
const db = new Database(fixture);
db.pragma('foreign_keys=OFF');
for (const row of ddl) db.exec(row.sql);
db.close();
process.env.DATABASE_PATH = fixture;
process.env.DATABASE_URL = 'file:' + fixture;
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'disposable-project-audit-only-not-a-real-secret';
const prisma = req('./prisma');
const express = req('express'), jwt = req('jsonwebtoken');
const app = express(); app.use(express.json());
app.use('/api/projects', req('./routes/projectRoutes'));
const membership = req('./services/projectMembershipService');
const results = [];
let server;

async function main(){
 for(const id of ['A','B','C','D'])await prisma.lab.create({data:{id,code:id,name:'Fixture '+id,country:id==='C'?'ZZZ':'GTM',isActive:id!=='D'}});
 for(const [id,role,labId,projects] of [['admin','SUPER_ADMIN',null,[]],['owner','LAB_MANAGER','A',[]],['service','LAB_MANAGER','B',[]],['pm','PROJECT_MANAGER',null,['P']],['national','MASTER_USER',null,[]]])await prisma.user.create({data:{id,username:id,email:id+'@fixture.invalid',password:'unused-fixture',role,labId,projects:JSON.stringify(projects),countries:'["GTM"]',tokenVersion:1}});
 async function proj(id,extra={}){return prisma.project.create({data:{id,code:id,name:'Fixture '+id,status:'ACTIVE',labId:'A',assignedLabIds:'["B","C"]',...extra}})}
 async function sample(id,p,lab,status){return prisma.sample.create({data:{id,originalId:id,projectId:p,projectCode:p,assignedLab:lab,labId:'ACC-'+id,status,receptionDate:null}})}
 await proj('P');await sample('A-EXPECTED','P','A','EXPECTED');await sample('C-SECRET','P','C','PROCESSING');
 server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s))});
 async function call(actor,route,method='GET',body){const response=await fetch('http://127.0.0.1:'+server.address().port+'/api/projects'+route,{method,headers:{authorization:'Bearer '+jwt.sign({id:actor,tokenVersion:1},process.env.JWT_SECRET,{expiresIn:'1h'}),'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});return{status:response.status,body:await response.json()}}
 let r=await call('national','/P/samples');results.push({id:'R01',case:'National GTM actor must not read ZZZ lab sample',passed:r.status!==200||!r.body.some(s=>s.id==='C-SECRET'),response:r});
 r=await call('owner','/P','PUT',{status:'COMPLETED'});results.push({id:'R02',case:'Generic PUT must not bypass archive readiness with expected sample',passed:r.status>=400,response:r,persisted:(await prisma.project.findUnique({where:{id:'P'}})).status});
 await prisma.project.update({where:{id:'P'},data:{status:'ACTIVE'}});
 r=await call('owner','/P/archive','POST',{force:true});results.push({id:'R03',case:'Force flag must not bypass expected-sample archival blocker',passed:r.status>=400,response:r});
 await proj('OPENWORK');await sample('WIP','OPENWORK','A','PROCESSING');r=await call('owner','/OPENWORK/archive','POST',{reason:'fixture'});results.push({id:'R04',case:'Archive must reject unresolved analytical work',passed:r.status>=400,response:r});
 await proj('PAUSED',{status:'PAUSED'});r=await call('service','/PAUSED/manifest','POST',{sampleIds:['IMPORT-PAUSED']});const created=await prisma.sample.findUnique({where:{id:'IMPORT-PAUSED'},select:{assignedLab:true,labId:true,status:true}});results.push({id:'R05',case:'Paused admissions must block manifest and not route servicing lab import to owner',passed:r.status>=400&&!created,response:r,created});
 await proj('SECRET',{labId:'C',assignedLabIds:'[]'});await sample('KNOWN-FOREIGN','SECRET','C','EXPECTED');r=await call('owner','/P/imports/preview','POST',{sampleIds:['KNOWN-FOREIGN']});results.push({id:'R06',case:'Import conflict must not disclose unauthorized foreign project code',passed:!JSON.stringify(r.body).includes('SECRET'),response:r});
 r=await call('pm','/P/lab-access','PATCH',{servicingLabIds:['C','D'],reason:'fixture'});results.push({id:'R07',case:'Coordinator must not grant project lab access including inactive lab without governance authority',passed:r.status>=400,response:r});
 await proj('COUNTS');for(const st of ['DRAFT','CANCELLED','UNRECOGNIZED'])await sample('COUNT-'+st,'COUNTS','A',st);r=await call('admin','/COUNTS/stats');results.push({id:'R08',case:'Unreceived draft/cancelled/unknown records must not count as physical receipts',passed:r.body.counts?.everPhysicallyReceived===0,response:r});
 r=await call('admin','/P/samples?limit=1');results.push({id:'R09',case:'Sample endpoint must honor bounded pagination',passed:!Array.isArray(r.body)||r.body.length<=1,status:r.status,returnedRows:Array.isArray(r.body)?r.body.length:null});
 r=await call('owner','/P/imports/preview','POST',{sampleIds:['bad id!']});results.push({id:'R10',case:'Invalid field identifiers must not be approved by import preview',passed:!(r.body.validSampleIds||[]).includes('bad id!'),response:r});
 r=await call('admin','/','POST',{code:'DRAFT-REQUEST',name:'New incomplete project',projectType:'OPEN_INTAKE',status:'DRAFT'});results.push({id:'R11',case:'Incomplete project explicitly requested as draft must not activate',passed:r.body.status==='DRAFT',response:r});
 await proj('MORE');await sample('MORE-PREP','MORE','B','PREPARED');
 r=await call('owner','/MORE/archive','POST',{});results.push({id:'H01',case:'Prepared sample still needs analysis and must block closure',passed:r.status>=400,response:r});
 r=await call('owner','/P/manifest','POST',{sampleIds:['bad id!']});results.push({id:'H02',case:'Commit must validate IDs even without preview',passed:r.status>=400,response:r});
 r=await call('owner','/P/manifest','POST',{sampleIds:['KNOWN-FOREIGN']});results.push({id:'H03',case:'Commit conflict must not disclose foreign project',passed:!JSON.stringify(r.body).includes('SECRET'),response:r});
 r=await call('owner','/MORE/lab-access','PATCH',{servicingLabIds:[],reason:'fixture removal with unfinished work'});results.push({id:'H04',case:'Lab removal must block outstanding prepared sample',passed:r.status>=400,response:r});
 await prisma.auditLog.create({data:{id:'foreign-audit-fixture',entity:'PROJECT',entityId:'SECRET',action:'UPDATED',details:'Unrelated confidential project references P',performedBy:'fixture',timestamp:new Date()}});
 r=await call('owner','/P/activity');results.push({id:'H05',case:'Project activity must exclude foreign event whose details mention current code',passed:!(r.body.logs||[]).some(x=>x.id==='foreign-audit-fixture'),response:r});
 await proj('BIG');await prisma.sample.createMany({data:Array.from({length:501},(_,i)=>({id:'BIG-'+i,originalId:'BIG-'+i,projectId:'BIG',projectCode:'BIG',assignedLab:'A',status:'EXPECTED',receptionDate:null}))});
 r=await call('owner','/BIG/samples');results.push({id:'H06',case:'Default sample request must be bounded to at most 500 rows',passed:Array.isArray(r.body)&&r.body.length<=500,status:r.status,rows:r.body.length});
 const report={checkedAt:new Date().toISOString(),baseline:'c8723f6698c63193d4330cc92cd57ab79b408649',fixtureDatabase:fixture,sourceHashBefore:before,sourceHashAfter:hash(),sourceUnchanged:before===hash(),cases:results.length,passed:results.filter(r=>r.passed).length,results};
 fs.writeFileSync(path.join(__dirname,'monitor-corrective-results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({cases:report.cases,passed:report.passed,sourceUnchanged:report.sourceUnchanged,results:results.map(({id,case:c,passed})=>({id,case:c,passed}))},null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{if(server)await new Promise(r=>server.close(r));await prisma.$disconnect()});


