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
 const report={checkedAt:new Date().toISOString(),baseline:'7096730b253156e3e9c9bb695f641be1e85f7b93',sourceUnchanged:before===hash(),results};fs.writeFileSync(path.join(__dirname,'monitor-intake-7096730-results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{if(server)await new Promise(r=>server.close(r));await prisma.$disconnect()});
