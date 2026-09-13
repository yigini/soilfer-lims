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
async function main() {
  for (const id of ['A','B','C']) await prisma.lab.create({ data: { id, code:id, name:'Fixture lab '+id, country:id==='C'?'ZZZ':'GTM' } });
  const actors = [ ['admin','SUPER_ADMIN',null,[]], ['owner','LAB_MANAGER','A',[]], ['service','LAB_MANAGER','B',[]], ['foreign','LAB_MANAGER','C',[]], ['pm','PROJECT_MANAGER',null,['P']], ['national','MASTER_USER',null,[]] ];
  for (const [id,role,labId,projects] of actors) await prisma.user.create({ data:{id,username:id,email:id+'@fixture.invalid',password:'NOT_A_REAL_LOGIN',role,labId,projects:JSON.stringify(projects),countries:'["GTM"]',tokenVersion:1} });
  async function project(id,extra={}) { return prisma.project.create({data:{id,code:id,name:'Fixture '+id,status:'ACTIVE',labId:'A',assignedLabIds:'["B"]',...extra}}); }
  await project('P',{expectedSampleCount:120}); await project('SECRET',{labId:'C',assignedLabIds:'[]',expectedSampleCount:999});
  for (const [id,assignedLab,status] of [['SA','A','EXPECTED'],['SB','B','RELEASED']]) await prisma.sample.create({data:{id,originalId:id,projectId:'P',projectCode:'P',assignedLab,labId:'ACCESSION-'+id,status}});
  server = await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
  async function call(actor,route,method='GET',body) {
    const token=jwt.sign({id:actor,tokenVersion:1},process.env.JWT_SECRET,{expiresIn:'1h'});
    const response=await fetch('http://127.0.0.1:'+server.address().port+'/api/projects'+route,{method,headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
    return {status:response.status,body:await response.json()};
  }
  let r=await call('foreign','/P/lab-access');
  results.push({id:'P01',case:'Unrelated manager reads foreign project lab-access',...r});
  r=await call('service','/P/samples');
  results.push({id:'P02',case:'Servicing manager reads samples from both labs',...r});
  results.push({id:'P03',case:'Same servicing manager stats only count their own lab',...await call('service','/P/stats')});
  results.push({id:'P04',case:'Administrator statistics omit RELEASED from buckets',...await call('admin','/P/stats')});
  results.push({id:'P05',case:'Unrelated manager reads foreign project target',...await call('foreign','/P/stats')});
  r=await call('service','/P/archive','POST',{});
  results.push({id:'P06',case:'Servicing manager archive returns 500 after persisting COMPLETED despite expected sample',response:r,persistedStatus:(await prisma.project.findUnique({where:{id:'P'}})).status});
  results.push({id:'P07',case:'Project manager create then cannot update own new project',create:await call('pm','/','POST',{code:'PM-NEW',name:'PM new',projectType:'OPEN_INTAKE'}),update:await call('pm','/PM-NEW','PUT',{name:'changed'})});
  results.push({id:'P08',case:'National role creates project owned by foreign-country lab',...await call('national','/','POST',{code:'CROSS',name:'Cross',projectType:'OPEN_INTAKE',labId:'C'})});
  results.push({id:'P09',case:'Duplicate existing sample during creation swallowed',...await call('admin','/','POST',{code:'DUP',name:'Duplicate',projectType:'TEMPLATE_PREDEFINED_IDS',sampleIds:['SA']}),actualNewSamples:await prisma.sample.count({where:{projectId:'DUP'}})});
  await project('FALLBACK',{labId:null,assignedLabIds:'["B"]',countries:'["GTM"]'});
  await prisma.projectLab.create({data:{projectCode:'FALLBACK',labId:'B'}});
  r=await call('admin','/FALLBACK/lab-access','PATCH',{servicingLabIds:[],reason:'Fixture remove all'});
  results.push({id:'P10',case:'Removing every lab revives same-country labs via fallback',write:r,resolved:await membership.resolveProjectLabs(await prisma.project.findUnique({where:{id:'FALLBACK'}}))});
  await project('PARTIAL');
  const originalAudit=prisma.auditLog.create;
  prisma.auditLog.create=async()=>{throw new Error('Fixture injected audit failure');};
  r=await call('admin','/PARTIAL','PUT',{name:'Persisted despite 500'});
  prisma.auditLog.create=originalAudit;
  results.push({id:'P11',case:'Failed audit leaves changed project despite 500',response:r,persistedName:(await prisma.project.findUnique({where:{id:'PARTIAL'}})).name});
  await call('admin','/P','DELETE');
  results.push({id:'P12',case:'Trash detaches even released sample from project',sample:await prisma.sample.findUnique({where:{id:'SB'},select:{id:true,status:true,projectId:true,projectCode:true}})});
  results.push({id:'P13',case:'Manifest API response puts counts in message instead of data',...await call('admin','/PARTIAL/manifest','POST',{sampleIds:['NEW-MANIFEST']})});
  await project('BYPASS');
  r=await call('owner','/BYPASS','PUT',{assignedLabIds:'["C"]',status:'MADE_UP_STATUS'});
  results.push({id:'P14',case:'Generic update accepts unknown lifecycle state and foreign lab assignment without junction sync',response:r,junctions:await prisma.projectLab.findMany({where:{projectCode:'BYPASS'}})});
  const report={auditedAt:new Date().toISOString(),baseline:'aeb62f7fac91412ea23a7c6871f0f7370d656a23',fixtureDatabase:fixture,sourceDatabaseHashBefore:before,sourceDatabaseHashAfter:hash(),results};
  fs.writeFileSync(path.join(__dirname,'probe-results.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({cases:results.length,sourceUnchanged:before===hash(),report:'WP/project-management-audit-v1/probe-results.json',summary:results.map(x=>({id:x.id,case:x.case,status:x.status||x.response?.status||x.write?.status}))},null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{if(server) await new Promise(r=>server.close(r));await prisma.$disconnect();});
