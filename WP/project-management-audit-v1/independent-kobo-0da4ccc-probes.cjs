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
const prisma=req('./prisma'), express=req('express'), jwt=req('jsonwebtoken');
let externalCalls=0;
const koboPath=req.resolve('./services/koboService');
req.cache[koboPath]={id:koboPath,filename:koboPath,loaded:true,exports:{
 fetchSubmissions:async()=>{externalCalls++;return[{_id:1,_uuid:'fixture-1'}]},
 transformSubmission:()=>[{original_id:'INACTIVE-LAB-IMPORT',site_id:'fixture-site'}],findValue:()=>null
}};
const app=express();app.use(express.json());app.use('/api/projects',req('./routes/projectRoutes'));app.use('/api/kobo',req('./routes/koboRoutes'));
let server;const results=[];
async function main(){
 for(const id of ['A','B'])await prisma.lab.create({data:{id,code:id,name:'Fixture '+id,country:'GTM',isActive:true}});
 await prisma.project.create({data:{id:'P-ID',code:'P-CODE',name:'Shared fixture',labId:'A',projectType:'KOBO_LINKED',status:'ACTIVE'}});
 await prisma.projectLab.create({data:{id:'P-B',projectCode:'P-CODE',labId:'B'}});
 for(const [id,role,labId] of [['mgrB','LAB_MANAGER','B'],['admin','SUPER_ADMIN','A']])await prisma.user.create({data:{id,username:id,email:id+'@fixture.invalid',password:'unused',role,labId,tokenVersion:1}});
 for(const id of ['A','B'])await prisma.koboConfig.create({data:{id:'CFG-'+id,labId:id,projectCode:'P-CODE',koboServerUrl:'https://fixture.invalid',formId:'ASSET-'+id,apiToken:'fixture-only',isActive:true}});
 server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s))});
 async function call(url,user,method='GET'){const r=await fetch('http://127.0.0.1:'+server.address().port+url,{method,headers:{authorization:'Bearer '+jwt.sign({id:user,tokenVersion:1},process.env.JWT_SECRET)}});return{status:r.status,body:await r.json()};}
 const own=await call('/api/projects/P-ID/kobo-config','mgrB');
 const foreign=await call('/api/projects/P-ID/kobo-config?configId=CFG-A','mgrB');
 results.push({id:'K02',case:'Service manager explicit config ID must not widen own-lab configuration visibility',passed:own.body.koboFormId==='ASSET-B'&&([403,404].includes(foreign.status)||foreign.body.configured===false),own,foreign});
 await prisma.lab.update({where:{id:'B'},data:{isActive:false}});
 const sync=await call('/api/kobo/sync/B?configId=CFG-B','admin','POST');
 const count=await prisma.sample.count({where:{assignedLab:'B'}});
 results.push({id:'K03',case:'No Kobo intake into inactive servicing lab even when sync actor is admin',passed:count===0,sync,createdSampleCount:count});
 const report={checkedAt:new Date().toISOString(),baseline:'0da4cccae9c840b4845f26ef79f89581479db6c9',sourceUnchanged:before===hash(),externalCallsMocked:externalCalls,results};
 fs.writeFileSync(path.join(__dirname,'independent-kobo-0da4ccc-results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{if(server)await new Promise(r=>server.close(r));await prisma.$disconnect()});


