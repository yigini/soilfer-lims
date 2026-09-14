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

app.use('/api/reception', req('./routes/receptionRoutes'));
async function main(){
 await prisma.lab.create({data:{id:'A',code:'A',name:'Fixture lab',country:'GTM',isActive:true}});
 await prisma.user.create({data:{id:'reception',username:'reception',email:'reception@fixture.invalid',password:'unused',role:'SAMPLE_RECEPTION',labId:'A',countries:'["GTM"]',projects:'[]',tokenVersion:1}});
 for(const [id,status] of [['ACTIVE-P','ACTIVE'],['PAUSED-P','PAUSED']])await prisma.project.create({data:{id,code:id,name:id,status,projectType:'OPEN_INTAKE',labId:'A'}});
 for(const [id,project] of [['PRE-PAUSED','PAUSED-P'],['PRE-ACTIVE','ACTIVE-P']])await prisma.sample.create({data:{id,originalId:id,projectId:project,projectCode:project,status:'EXPECTED',assignedLab:'A',receptionDate:null}});
 server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s))});
 async function call(route,body){const res=await fetch('http://127.0.0.1:'+server.address().port+'/api/reception'+route,{method:'POST',headers:{authorization:'Bearer '+jwt.sign({id:'reception',tokenVersion:1},process.env.JWT_SECRET,{expiresIn:'1h'}),'content-type':'application/json'},body:JSON.stringify(body)});return{status:res.status,body:await res.json()};}
 let r=await call('/intake',{originalId:'PRE-PAUSED',projectId:'ACTIVE-P',decision:'DRAFT',isDraft:true}); let s=await prisma.sample.findUnique({where:{id:'PRE-PAUSED'}});results.push({id:'I01',case:'Request project override must not bypass paused existing sample project',passed:r.status>=400&&s.status==='EXPECTED',response:r,persisted:{status:s.status,projectId:s.projectId,projectCode:s.projectCode}});
 r=await call('/intake',{originalId:'PRE-ACTIVE',projectId:'ACTIVE-P',decision:'DRAFT',isDraft:true,isWalkIn:true});const draft=r;
 r=await call('/discard',{id:'PRE-ACTIVE'});s=await prisma.sample.findUnique({where:{id:'PRE-ACTIVE'}});results.push({id:'I02',case:'Mutable walk-in flag must not cause hard deletion of an existing pre-registered sample',passed:!!s,response:r,draftStatus:draft.status,persisted:s?{status:s.status,projectId:s.projectId}:null});
 let first=await call('/intake',{originalId:'WALKIN-NEW',isWalkIn:true,isDraft:true,decision:'DRAFT'});let walkId=first.body.id;let walk=walkId?await prisma.sample.findUnique({where:{id:walkId}}):null;let second=walk?await call('/intake',{originalId:walk.originalId,isWalkIn:true,isDraft:true,decision:'DRAFT'}):null;let discard=walk?await call('/discard',{id:walk.id}):null;let after=walk?await prisma.sample.findUnique({where:{id:walk.id}}):null;results.push({id:'I03',case:'Legitimate new desk draft remains discardable after reopening and saving twice',passed:first.status===200&&second?.status===200&&discard?.status===200&&!after,first,second,discard,persisted:after?{status:after.status,receptionData:after.receptionData}:null});
 app.use('/api/samples',req('./middleware/authMiddleware').verifyToken,req('./routes/sampleRoutes'));
 await prisma.user.create({data:{id:'admin',username:'admin',email:'admin@fixture.invalid',password:'unused',role:'SUPER_ADMIN',labId:'A',countries:'["GTM"]',projects:'[]',tokenVersion:1}});
 await prisma.sample.create({data:{id:'RELEASED-PROTECTED',originalId:'RELEASED-PROTECTED',projectId:'ACTIVE-P',projectCode:'ACTIVE-P',status:'RELEASED',assignedLab:'A',approvedAt:new Date(),approvedBy:'admin'}});
 const deleteRes=await fetch('http://127.0.0.1:'+server.address().port+'/api/samples/RELEASED-PROTECTED',{method:'DELETE',headers:{authorization:'Bearer '+jwt.sign({id:'admin',tokenVersion:1},process.env.JWT_SECRET,{expiresIn:'1h'})}});const deleteBody=await deleteRes.json();const released=await prisma.sample.findUnique({where:{id:'RELEASED-PROTECTED'}});results.push({id:'I04',case:'Generic delete must not silently revert released project sample into expected',passed:[400,403,409,422].includes(deleteRes.status)&&released?.status==='RELEASED',status:deleteRes.status,body:deleteBody,persisted:released?{status:released.status,approvedAt:released.approvedAt}:null});
 const report={checkedAt:new Date().toISOString(),baseline:'18836f1b58b126f4dc0183478fe81dcc1c984fcd',sourceUnchanged:before===hash(),results};fs.writeFileSync(path.join(__dirname,'monitor-intake-18836f1-results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{if(server)await new Promise(r=>server.close(r));await prisma.$disconnect()});


