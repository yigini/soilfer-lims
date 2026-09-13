/* Read-only source audit. No server startup, Prisma import, network or database.
 * Executes actual handlers in VM contexts against explicit synthetic adapters.
 * REPRODUCED means the finding exists, not that the application passed QA.
 * This is not a substitute for strict-schema database/API acceptance tests.
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../..');
const sourceHashes = {};
const results = [];
const quiet = { log() {}, warn() {}, error() {} };
function load(rel, deps = {}) {
  const filename = path.join(root, rel);
  const code = fs.readFileSync(filename, 'utf8');
  sourceHashes[rel] = crypto.createHash('sha256').update(code).digest('hex');
  const module = { exports: {} };
  const restrictedRequire = name => {
    if (Object.hasOwn(deps, name)) return deps[name];
    if (name === 'crypto') return crypto;
    throw Error('Audit blocked unexpected import: ' + name);
  };
  vm.runInNewContext('(function(require,module,exports){' + code + '\n})', {console: quiet}, {filename})(restrictedRequire, module, module.exports);
  return module.exports;
}
const roles = load('server/config/roles.js');
const scope = load('server/utils/scopeGuard.js');
const fixtures = {
  manager: {id:'actor-A',username:'manager_A',role:'LAB_MANAGER',labId:'LAB-A',countries:['GTM'],projects:[],isActive:true,tokenVersion:0},
  admin: {id:'admin',username:'admin_fixture',role:'SUPER_ADMIN',countries:[],projects:[],isActive:true,tokenVersion:0},
  national: {id:'national',username:'national_fixture',role:'MASTER_USER',countries:['GTM'],projects:[],isActive:true,tokenVersion:0},
  techB: {id:'tech-B',username:'tech_B',role:'LAB_TECHNICIAN',labId:'LAB-B',countries:[],projects:[],isActive:true,tokenVersion:0}
};
function res() { return {statusCode:200, body:null, status(n){this.statusCode=n;return this;},json(x){this.body=x;return this;}}; }
const respond = {
  error: (r, status, code) => r.status(status).json({error:code}),
  success: (r, code, data) => r.json({code,data})
};
function env() {
  const calls = [];
  const users = new Map(Object.values(fixtures).map(u=>[u.id,structuredClone(u)]));
  const labs = new Map(['LAB-A','LAB-B'].map(id=>[id,{id,code:id,name:id,country:'GTM',isActive:true,notes:'SYNTHETIC_PRIVATE_NOTE'}]));
  let claims = {id:'actor-A',tokenVersion:0};
  const db = {
    user: {
      findUnique: async ({where})=> [...users.values()].find(u=> Object.entries(where).every(([k,v])=>u[k]===v)) || null,
      findMany: async q=>{calls.push(['user.findMany',q]);return [...users.values()];},
      groupBy: async()=>[],
      update: async ({where,data})=>{calls.push(['user.update',{where,data}]);const u=users.get(where.id);Object.assign(u,data);return u;},
      updateMany: async ({where,data})=>{calls.push(['user.updateMany',{where,data}]);for(const u of users.values())if(u.labId===where.labId)Object.assign(u,data);return {count:1};},
      create: async ({data})=>{calls.push(['user.create',{...data,password:'[REDACTED]'}]);users.set(data.id,data);return data;},
      delete: async ({where})=>{calls.push(['user.delete',where]);users.delete(where.id);return {};}
    },
    lab: {
      findMany: async()=>[...labs.values()],
      findUnique: async ({where})=> [...labs.values()].find(l=>Object.entries(where).every(([k,v])=>l[k]===v))||null,
      update: async ({where,data})=>{calls.push(['lab.update',{where,data}]);Object.assign(labs.get(where.id),data);return labs.get(where.id);},
      create: async ({data})=>{calls.push(['lab.create',data]);labs.set(data.id,data);return data;}
    },
    auditLog:{create:async x=>{calls.push(['audit',x]);return x;}},
    project:{findMany:async()=>[],findUnique:async()=>null,create:async x=>x.data},
    sample:{groupBy:async()=>[],count:async()=>0},
    $queryRaw:async()=>[],
  };
  const jwt = {verify:()=>claims,sign:p=>{claims=p;return 'SYNTHETIC_TOKEN';}};
  const auth = load('server/middleware/authMiddleware.js',{'jsonwebtoken':jwt,'../prisma':db,'../config/auth':{JWT_SECRET:'synthetic'},'../config/roles':roles});
  const common = {'../prisma':db,'bcryptjs':{hash:async()=> 'SYNTHETIC_HASH',compare:async()=>true},'../config/roles':roles,'../utils/scopeGuard':scope,'../i18n/response':respond,'../config/auth':{JWT_SECRET:'synthetic'},'jsonwebtoken':jwt};
  const routes = [];
  const router = {use(){},...Object.fromEntries(['get','post','put','patch','delete'].map(method=>[method,(url,...handlers)=>routes.push({method,url,handlers})]))};
  load('server/routes/labRoutes.js',{...common,'express':{Router:()=>router},'../middleware/authMiddleware':auth});
  const user = load('server/controllers/userController.js',common);
  const project = load('server/controllers/projectController.js',common);
  const equipment = load('server/controllers/equipmentController.js',common);
  const authController = load('server/controllers/authController.js',common);
  async function run(fn,actor,body={},params={},query={}) {const r=res();await fn({user:actor,body,params,query},r);return r;}
  async function route(method,url,actor,body={},params={}) {
    const req={user:actor,body,params,query:{}}; const r=res();
    // Actor is preauthenticated synthetic fixture. Execute actual permission middleware.
    for(const fn of routes.find(x=>x.method===method&&x.url===url).handlers){let next=false;await fn(req,r,()=>{next=true;});if(!next)break;}
    return r;
  }
  async function verify(target,extra={}) {claims={id:target.id,tokenVersion:target.tokenVersion||0,...extra};const r=res();let passed=false;await auth.verifyToken({headers:{authorization:'Bearer SYNTHETIC'},baseUrl:'/api/auth',path:'/me'},r,()=>{passed=true;});return {passed,status:r.statusCode,body:r.body};}
  return {db,calls,users,labs,auth,common,user,project,equipment,authController,run,route,verify,getClaims:()=>claims};
}
async function probe(id,description,fn){try{const outcome=await fn(env());results.push({id,description, ...outcome, reproduced:!!outcome.reproduced});}catch(e){results.push({id,description,reproduced:false,harnessError:e.message});}}
async function main(){
 await probe('P01','Manager A can disable lab B',async e=>{const r=await e.route('patch','/:id/toggle-active',fixtures.manager,{}, {id:'LAB-B'});return {reproduced:r.statusCode===200&&!e.labs.get('LAB-B').isActive,observedStatus:r.statusCode};});
 await probe('P02','Lab reset route accepts another lab and privileged target',async e=>{e.users.get('tech-B').role='SUPER_ADMIN';const r=await e.route('patch','/:id/staff/:userId/reset-password',fixtures.manager,{}, {id:'LAB-B',userId:'tech-B'});return {reproduced:r.statusCode===200,observedStatus:r.statusCode,resetInvalidatesTokenVersion:e.calls.some(([n,q])=>n==='user.update'&&q.data.tokenVersion!==undefined)};});
 await probe('P03','Main Users API denies same cross-lab edit (positive control)',async e=>{const r=await e.run(e.user.updateUser,fixtures.manager,{name:'Fixture'}, {id:'tech-B'});return {reproduced:r.statusCode===403,observedStatus:r.statusCode};});
 await probe('P04','Lab reactivation leaves staff disabled',async e=>{for(let i=0;i<2;i++)await e.route('patch','/:id/toggle-active',fixtures.admin,{}, {id:'LAB-B'});return {reproduced:e.labs.get('LAB-B').isActive&&!e.users.get('tech-B').isActive};});
 await probe('P05','Lab PUT forwards immutable and lifecycle fields',async e=>{const r=await e.route('put','/:id',fixtures.manager,{id:'RENAMED',isActive:false},{id:'LAB-B'});return {reproduced:r.statusCode===200&&e.calls.some(([n,q])=>n==='lab.update'&&q.data.id==='RENAMED'),auditRecorded:e.calls.some(([n])=>n==='audit'),staffCascade:e.calls.some(([n])=>n==='user.updateMany')};});
 await probe('P06','Lab manager can create an unrelated laboratory',async e=>{const r=await e.route('post','/',fixtures.manager,{id:'LAB-C',code:'LAB-C',name:'Fixture',country:'FRA'});return {reproduced:r.statusCode===200&&e.labs.has('LAB-C'),automaticAccounts:e.calls.filter(([n])=>n==='user.create').length};});
 await probe('P07','Authenticated viewer receives management notes for all labs',async e=>{const r=await e.route('get','/',{...fixtures.techB,role:'VIEWER'});return {reproduced:r.statusCode===200&&r.body.some(l=>l.id==='LAB-A'&&l.notes==='SYNTHETIC_PRIVATE_NOTE')};});
 await probe('P08','Audit failure occurs after lab and staff changes',async e=>{e.db.auditLog.create=async()=>{throw Error('synthetic audit failure');};const r=await e.route('patch','/:id/toggle-active',fixtures.admin,{}, {id:'LAB-B'});return {reproduced:r.statusCode===500&&!e.labs.get('LAB-B').isActive&&!e.users.get('tech-B').isActive};});
 await probe('P09','Self-deletion has no last-administrator guard at handler boundary',async e=>{const r=await e.run(e.user.deleteUser,fixtures.admin,{}, {id:'admin'});return {reproduced:r.statusCode===200&&!e.users.has('admin'),limit:'Synthetic adapter has no foreign-key constraints; database may reject users with references.'};});
 await probe('P10','Empty role value is forwarded to update',async e=>{await e.run(e.user.updateUser,fixtures.admin,{role:''},{id:'tech-B'});return {reproduced:e.users.get('tech-B').role===''};});
 await probe('P11','New user accepts a nonexistent laboratory',async e=>{const r=await e.run(e.user.createUser,fixtures.admin,{username:'fixture_new',password:'fixture',role:'LAB_TECHNICIAN',labId:'DOES-NOT-EXIST'});return {reproduced:r.statusCode===200&&r.body.labId==='DOES-NOT-EXIST'};});
 await probe('P12','National Users query refers to nonexistent User.country',async e=>{await e.run(e.user.getUsers,fixtures.national);const q=e.calls.find(([n])=>n==='user.findMany')[1];const model=fs.readFileSync(path.join(root,'server/prisma/schema.prisma'),'utf8').split('model User {')[1].split('\n}')[0];return {reproduced:q.where.AND[0].country!==undefined&&!/^\s*country\s/m.test(model),limit:'Query construction and schema checked; Prisma validation failure not executed against a database.'};});
 await probe('P13','Empty national country scope produces an unfiltered Users query',async e=>{await e.run(e.user.getUsers,{...fixtures.national,countries:[]});return {reproduced:JSON.stringify(e.calls.find(([n])=>n==='user.findMany')[1].where)==='{}'};});
 await probe('P14','Manager own profile save rejects unchanged scope arrays',async e=>{const r=await e.run(e.user.updateUser,fixtures.manager,{name:'New fixture name',countries:['GTM'],projects:[]},{id:'actor-A'});return {reproduced:r.statusCode===403};});
 await probe('P15','Ordinary lab manager can manage a same-lab project manager',async e=>{e.users.get('tech-B').labId='LAB-A';e.users.get('tech-B').role='PROJECT_MANAGER';const r=await e.run(e.user.updateUser,fixtures.manager,{isActive:false},{id:'tech-B'});return {reproduced:r.statusCode===200&&!e.users.get('tech-B').isActive};});
 await probe('P16','Country metadata grants manager A access to another lab sample',async()=>({reproduced:scope.canAccessEntity(fixtures.manager,{id:'sample-B',assignedLab:'LAB-B',country:'GTM'})}));
 await probe('P17','National role falls through Projects list to empty',async e=>{const r=await e.run(e.project.getProjects,fixtures.national);return {reproduced:r.statusCode===200&&r.body.length===0};});
 await probe('P18','Junction-only project membership rejected before junction lookup',async e=>{e.db.project.findUnique=async()=>({id:'PRJ',code:'PRJ',labId:null,assignedLabIds:null});let lookedUp=false;e.db.$queryRaw=async()=>{lookedUp=true;return [{labId:'LAB-A'}];};const r=await e.run(e.project.getProject,fixtures.manager,{}, {id:'PRJ'});return {reproduced:r.statusCode===403&&!lookedUp};});
 await probe('P19','Project Manager project membership ignored by detail scope guard',async()=>({reproduced:!scope.canAccessEntity({...fixtures.national,role:'PROJECT_MANAGER',projects:['PRJ']},{id:'PRJ',code:'PRJ',labId:null})}));
 await probe('P20','Impersonation JWT misses current target token version',async e=>{e.users.get('tech-B').tokenVersion=3;await e.run(e.authController.impersonate,fixtures.admin,{userId:'tech-B'});const claims=e.getClaims();const v=await e.verify(e.users.get('tech-B'),{...claims,tokenVersion:claims.tokenVersion});return {reproduced:claims.tokenVersion===undefined&&!v.passed,observedStatus:v.status};});
 await probe('P21','Active user of inactive lab passes HTTP authentication',async e=>{e.labs.get('LAB-B').isActive=false;const v=await e.verify(e.users.get('tech-B'));return {reproduced:v.passed};});
 await probe('P22','Disabled user is denied by HTTP authentication (positive control)',async e=>{e.users.get('tech-B').isActive=false;const v=await e.verify(e.users.get('tech-B'));return {reproduced:!v.passed&&v.status===401};});
 await probe('P23','Cached offline pack returned to a different user/lab',async e=>{const c=load('server/controllers/offlineController.js',{'../services/workPackService':{preparePack:async()=>({packId:'synthetic-pack',userId:'tech-B',labId:'LAB-B',samples:[{id:'fixture-private'}]})}});await e.run(c.preparePack,fixtures.techB);const r=await e.run(c.getPack,fixtures.manager,{}, {id:'synthetic-pack'});return {reproduced:r.statusCode===200&&r.body.userId==='tech-B'};});
 await probe('P24','Offline pack with no lab scope builds a global sample query',async e=>{let query;e.db.sample.findMany=async q=>{query=q;return [];};e.db.workItem={findMany:async()=>[]};const s=load('server/services/workPackService.js',e.common);await s.preparePack({...fixtures.techB,labId:null},{});return {reproduced:!query.where.OR&&!query.where.labId&&!query.where.assignedLab};});
 await probe('P25','Offline result command reaches write path as a viewer on another lab approved item',async e=>{
  let written=false;e.db.workItem={findUnique:async()=>({id:'work-B',status:'ACCEPTED',assignedTo:'tech_B',version:1,sample:{assignedLab:'LAB-B',status:'APPROVED'}}),update:async()=>{written=true;return {};}};e.db.workAttempt={create:async()=>({})};e.db.$transaction=async fn=>fn(e.db);
  const s=load('server/services/syncService.js',{'../prisma':e.db,'./commandReceiptService':{checkReceipt:async()=>({isExisting:false}),recordReceipt:async()=>({})},'./operationalConfirmationService':{},'./workbenchValidationService':{parseDeterminationValue:()=>({isValid:true,normalizedValue:6.5,censoring:'NONE'})}});
  const r=await s.processSyncBatch({...fixtures.manager,role:'VIEWER'},{deviceId:'fixture-device',operations:[{operationId:'fixture-op',type:'COMPLETE_WORK',target:{workItemId:'work-B'},payload:{value:6.5}}]});return {reproduced:written&&r.receipts[0].status==='APPLIED',limit:'Persistence, receipts and scientific parser are synthetic; demonstrates absent authorization/state gates in actual sync handler.'};
 });
 await probe('P26','Offline draft reports applied without persisting a draft',async e=>{const s=load('server/services/syncService.js',{'../prisma':e.db,'./commandReceiptService':{checkReceipt:async()=>({isExisting:false})},'./operationalConfirmationService':{},'./workbenchValidationService':{}});const r=await s.processSyncBatch(fixtures.techB,{deviceId:'fixture-device',operations:[{operationId:'op',type:'SAVE_WORK_DRAFT',target:{workItemId:'W'}}]});return {reproduced:r.receipts[0].status==='APPLIED'&&e.calls.length===0};});
 await probe('P27','Manager can change equipment status in another laboratory',async e=>{let changed=false;e.db.equipmentAsset={findUnique:async()=>({id:'equip-B',labId:'LAB-B',status:'IN_SERVICE'}),update:async()=>{changed=true;return {};}};const r=await e.run(e.equipment.updateStatus,fixtures.manager,{status:'OUT_OF_SERVICE'},{id:'equip-B'});return {reproduced:r.statusCode===200&&changed};});
 await probe('P28','National user can retrieve raw Kobo credential from unrelated project',async e=>{e.db.project.findUnique=async()=>({code:'OTHER',projectType:'KOBO_LINKED'});e.db.koboConfig={findMany:async()=>[{apiToken:'SYNTHETIC_SECRET',formId:'fixture'}]};const r=await e.run(e.project.getProjectKoboConfig,fixtures.national,{}, {id:'OTHER'});return {reproduced:r.statusCode===200&&r.body.koboApiToken==='SYNTHETIC_SECRET'};});
 await probe('P29','SIS JWT path accepts a token version revoked by HTTP auth',async e=>{Object.assign(e.users.get('tech-B'),{tokenVersion:7,countries:'[]',projects:'[]'});const auth=load('server/middleware/apiKeyAuth.js',{'../prisma':e.db,'jsonwebtoken':{verify:()=>({id:'tech-B',tokenVersion:0})},'../config/auth':{JWT_SECRET:'synthetic'}});const r=res();let accepted=false;await auth({headers:{authorization:'Bearer SYNTHETIC'}},r,()=>{accepted=true;});return {reproduced:accepted};});
 await probe('P30','National dashboard selection can switch to an out-of-country lab',async e=>{e.labs.get('LAB-B').country='FRA';const ds=load('server/services/dashboardScope.js',{'../prisma':e.db});const s=await ds.resolveActorScope(fixtures.national,{selectedLabId:'LAB-B'});const q=ds.buildSampleScopeWhere(s);return {reproduced:s.activeLabId==='LAB-B'&&JSON.stringify(q).includes('LAB-B')};});
 await probe('P31','Dashboard local-day interval is always 24 hours across DST transition',async e=>{const ds=load('server/services/dashboardScope.js',{'../prisma':e.db});const d=ds.getLocalDayInterval('Europe/London',new Date('2026-03-29T12:00:00Z'));return {reproduced:d.dayEnd.toISOString()!=='2026-03-29T23:00:00.000Z',actualEnd:d.dayEnd.toISOString(),expectedEnd:'2026-03-29T23:00:00.000Z'};});
 const report={executedAt:new Date().toISOString(),environment:'VM + synthetic adapters; no HTTP, production writes or DB access',semantics:'reproduced=true confirms described behavior, including explicitly labelled positive controls',results,sourceHashes};
 fs.writeFileSync(path.join(__dirname,'probe-results.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({checks:results.length,reproduced:results.filter(x=>x.reproduced).length,notReproduced:results.filter(x=>!x.reproduced)},null,2));
 process.exitCode=results.some(x=>x.harnessError)?1:0;
}
main().catch(e=>{console.error(e);process.exitCode=1;});
