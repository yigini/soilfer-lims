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

const app=express();app.use(express.json());app.use('/api/projects',req('./routes/projectRoutes'));
let server;const results=[];
async function main(){
 await prisma.lab.create({data:{id:'A',code:'A',name:'Fixture A',country:'GTM',isActive:true}});
 await prisma.user.create({data:{id:'admin',username:'admin',email:'admin@fixture.invalid',password:'unused',role:'SUPER_ADMIN',labId:'A',tokenVersion:1}});
 for(const id of ['ARCH','IMPORT'])await prisma.project.create({data:{id,code:id,name:id,labId:'A',status:'ACTIVE'}});
 server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s))});
 async function call(url,body,headers={}){
 const r=await fetch('http://127.0.0.1:'+server.address().port+'/api/projects/'+url,{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+jwt.sign({id:'admin',tokenVersion:1},process.env.JWT_SECRET),...headers},body:JSON.stringify(body)});
 return{status:r.status,body:await r.json()};}
 const initial=await call('ARCH/archive',{reason:'Season finished',idempotencyKey:'archive-one'});
 const same=await call('ARCH/archive',{reason:'Season finished',idempotencyKey:'archive-one'});
 const changed=await call('ARCH/archive',{reason:'Different reason',idempotencyKey:'archive-one'});
 results.push({id:'C01-ARCHIVE-PAYLOAD',passed:initial.status===200&&same.status===200&&changed.status===409,initialStatus:initial.status,sameStatus:same.status,changedStatus:changed.status,receipt:await prisma.commandReceipt.findUnique({where:{idempotencyKey:'archive-one'}})});
 await prisma.sample.create({data:{id:'EXISTING',originalId:'EXISTING',projectId:'IMPORT',projectCode:'IMPORT',labId:'A',assignedLab:'A',status:'EXPECTED'}});
 const preview=await call('IMPORT/imports/preview',{sampleIds:['EXISTING','NEW-001'],targetLabId:'A'});
 const commit=await call('IMPORT/manifest',{sampleIds:preview.body.validSampleIds,previewToken:preview.body.previewToken,targetLabId:'A',idempotencyKey:'mixed'});
 results.push({id:'C02-MIXED',passed:preview.status===200&&commit.status===200&&commit.body.data?.count===1,preview,commit});
 const stale=await call('IMPORT/imports/preview',{sampleIds:['NEW-002'],targetLabId:'A'});
 const updated=await prisma.project.update({where:{id:'IMPORT'},data:{name:'Changed',updatedAt:new Date(Date.now()+2000)}});
 const staleCommit=await call('IMPORT/manifest',{sampleIds:stale.body.validSampleIds,previewToken:stale.body.previewToken,targetLabId:'A',idempotencyKey:'stale'},{'if-match':String(updated.updatedAt.getTime())});
 results.push({id:'C02-STALE-FRESH-HEADER',passed:staleCommit.status===409&&staleCommit.body.code==='PREVIEW_STALE_REVISION',staleCommit});
 const report={checkedAt:new Date().toISOString(),baseline:'a40e04983544bb68e53e6b46846fd8f7bc8d39a9',sourceUnchanged:before===hash(),results};
 fs.writeFileSync(path.join(__dirname,'independent-retry-a40e049-results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{if(server)await new Promise(r=>server.close(r));await prisma.$disconnect()});
