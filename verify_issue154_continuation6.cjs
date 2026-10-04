const fs=require('fs'),path=require('path'),os=require('os'),cp=require('child_process'),vm=require('vm'),assert=require('assert/strict');
const {createRequire}=require('module');
const repo='C:/Users/yigin/Documents/soilfer-lims';
function source(p){return fs.readFileSync(path.join(repo,p),'utf8').replace(/\r/g,'');}
function slice(s,start,end){const a=s.indexOf(start),b=s.indexOf(end,a);assert(a>=0&&b>a,'Missing anchor '+start);return s.slice(a,b);}
const guide=source('docs/UPGRADING.md'),blocks=[...guide.matchAll(/```bash\n([\s\S]*?)\n```/g)].map(m=>m[1]);
const post=blocks.find(b=>b.includes('LIVE_CONTAINER_ID=')),launch=blocks.find(b=>b.includes('# Ingress Hold:'));
assert(post&&launch, 'Missing post or launch block');
const hold=post.slice(post.indexOf('# 7. Verify NGINX'));
assert(hold, 'Missing hold slice');
const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'issue154-continuation6-'));
const results={scratch,cases:[]};

function shell(name,code,env,expected){
 const pre=String.raw`COMPOSE_FILES='-f docker-compose.yml -f docker-compose.nginx.yml'
if [ "$TOPOLOGY" = direct ]; then COMPOSE_FILES='-f docker-compose.yml'; fi
touch docker-compose.nginx.yml
proxy_state=true
if [ "$INITIAL_PROXY_STATE" = false ]; then proxy_state=false; fi
BASELINE_NGINX_CONTAINER=fixture-nginx
LIVE_CONTAINER_ID=fixture-lims
PORT=
docker(){
 printf 'docker %s; PORT=%s\n' "$*" "$PORT" >> "$TRACE_PATH"
 case "$*" in
  *'stop nginx'*) proxy_state=false; return 0;;
  *'up -d lims'*) printf 'LAUNCHED LIMS; proxy_state=%s; PORT=%s\n' "$proxy_state" "$PORT"; return 0;;
  *'ps -q nginx'*) [ "$PS_FAIL" = 1 ] && return 49; if [ "$proxy_state" = true ]; then printf 'fixture-nginx\n'; fi; return 0;;
  *'.State.Running'*) [ "$PROXY_INSPECT_FAIL" = 1 ] && return 49; printf '%s\n' "$proxy_state"; return 0;;
  *'.NetworkSettings.Ports'*) [ "$BIND_INSPECT_FAIL" = 1 ] && return 49; printf '%s\n' "$BIND_OUTPUT"; return 0;;
 esac
 return 1
}
`;
 const file=path.join(scratch,name+'.sh'),trace=path.join(scratch,name+'.trace');
 fs.writeFileSync(file,'#!/bin/bash\nset -e\n'+pre+'\n'+code+'\n');
 const r=cp.spawnSync('C:/Program Files/Git/bin/bash.exe',[file],{
   cwd:scratch,
   env:{...process.env,TOPOLOGY:'proxy',PS_FAIL:'0',PROXY_INSPECT_FAIL:'0',BIND_INSPECT_FAIL:'0',BIND_OUTPUT:'127.0.0.1',TRACE_PATH:trace,...env},
   encoding:'utf8',
   timeout:10000
 });
 assert.ifError(r.error);
 assert.equal(r.status,expected,`${name}: expected ${expected}, got ${r.status}. Output:\n${r.stdout}\n${r.stderr}`);
 const row={name,exit:r.status,output:r.stdout+r.stderr,trace:fs.readFileSync(trace,'utf8')};
 results.cases.push(row);
 console.log(`  ✓ Shell test: ${name} (exit ${r.status})`);
 return row;
}

console.log('--- Running Shell Ingress & Port Hold Tests ---');
const proxy=shell('proxy-launch-and-hold-binds-loopback-and-inspects-ports',launch+'\n'+hold,{},0);
assert.match(proxy.output,/LAUNCHED LIMS; proxy_state=false; PORT=127.0.0.1:3000\n/);
assert(proxy.trace.includes('.NetworkSettings.Ports'), 'Proxy hold must inspect .NetworkSettings.Ports');

shell('failed-proxy-inspection-now-rejects',hold,{PROXY_INSPECT_FAIL:'1'},1);
shell('failed-proxy-list-now-rejects',hold,{PS_FAIL:'1'},1);
const direct=shell('direct-launch-binds-loopback-and-hold-passes',launch+'\n'+hold,{TOPOLOGY:'direct'},0);
assert.match(direct.output,/PORT=127.0.0.1:3000/);

shell('direct-ipv4-wildcard-now-rejects',hold,{TOPOLOGY:'direct',BIND_OUTPUT:'0.0.0.0'},1);
shell('direct-binding-inspection-failure-rejects',hold,{TOPOLOGY:'direct',BIND_INSPECT_FAIL:'1'},1);

// Dual-stack wildcard, routable, and empty checks must all REJECT with exit 1
for(const [name,binding] of [['ipv6-wildcard','::'],['concatenated-dual-stack-wildcards','0.0.0.0::'],['routable-ipv4','192.0.2.10'],['empty-port-inspection','']]){
  shell('direct-'+name+'-now-rejects',hold,{TOPOLOGY:'direct',BIND_OUTPUT:binding},1);
}

// Allowed dual-stack loopback should pass
shell('dual-stack-loopback-passes',hold,{TOPOLOGY:'direct',BIND_OUTPUT:'127.0.0.1 ::1'},0);

// Source-only assertions:
assert.match(source('docker-compose.yml'),/"\$\{PORT:-3000\}:3000"/);
const pinned=slice(post,'# 5b. Execute Pinned','# 6. Verify Database Records');
assert(pinned.includes('lims node scripts/postflight_issue140.cjs'));
assert(pinned.includes('POSTFLIGHT_ADMIN_ID')&&pinned.includes('POSTFLIGHT_MANAGER_ID'));
results.cases.push({name:'reviewed-catalogue-postflight-invocation-now-wired',evidence:pinned});
console.log('  ✓ Source wiring: pinned catalogue postflight suite confirmed');

console.log('\n--- Running Route Records & Policy Tests ---');
async function main(){
 const jwt=createRequire(repo+'/server/package.json')('jsonwebtoken'),session=source('server/services/sessionValidationService.js');
 const js=slice(post,'  const jwt =','\n"\n\n# 7. Verify NGINX').replace(/\\`/g,'`').replace(/\\\$/g,'$');
 const admin={id:'reviewed-admin',username:'fixture-admin',role:'SUPER_ADMIN',tokenVersion:1,isActive:1,mustChangePassword:0};
 const mgr={id:'reviewed-manager',username:'fixture-manager',role:'LAB_MANAGER',labId:'lab-own',tokenVersion:2,isActive:1,mustChangePassword:0,countries:'[]',projects:'[]'};
 const tech={id:'reviewed-tech',username:'fixture-tech',role:'LAB_TECHNICIAN',labId:'lab-own',tokenVersion:3,isActive:1,mustChangePassword:0,countries:'[]',projects:'[]'};
 const explicit={POSTFLIGHT_ADMIN_ID:admin.id,POSTFLIGHT_MANAGER_ID:mgr.id,POSTFLIGHT_TECH_ID:tech.id};
 const emptyResponses={'/api/users':{data:[],users:[],pagination:{total:0},meta:{total:0}},'/api/labs':[],'/api/submissions':[],'/api/work':{data:[],meta:{total:0},pagination:{total:0}},'/api/dashboard/live':{role:'LAB_MANAGER',kpis:{},intakeQueue:[],reviewQueue:[],oversight:[],techWorkload:[],recentActivity:[],warnings:[],timestamp:'2030-01-01T00:00:00Z'}};

 async function roleCase(name,users,expected,opt={}){
  const sm={exports:{}},calls=[],logs=[];let exit=0;const secret='synthetic-f2fe4e7-review-only';
  vm.runInNewContext(session,{module:sm,exports:sm.exports,require:p=>{assert.equal(p,'../prisma');return {user:{findUnique:async({where})=>users.find(u=>u.id===where.id)||null}};}},{timeout:1000});
  class Database {prepare(sql){return {get:arg=>users.find(u=>u.id===arg)};}close(){}}
  const sandbox={
    require:p=>p==='jsonwebtoken'?jwt:p==='fs'?{existsSync:()=>false}:p==='better-sqlite3'?Database:(()=>{throw Error('Unexpected '+p)})(),
    process:{env:{JWT_SECRET:secret,...explicit},exit:n=>{const e=new Error('fixture exit');e.code=n;throw e;}},
    console:{log:(...v)=>logs.push(v.join(' ')),error:(...v)=>logs.push(v.join(' '))},
    fetch:async(url,init)=>{
      const decoded=jwt.verify(init.headers.Authorization.split(' ')[1],secret);
      const decision=await sm.exports.validateUserPrincipal(decoded,{currentPath:new URL(url).pathname});
      calls.push({url,id:decoded.id,status:decision.valid?200:decision.statusCode});
      return {
        status:decision.valid?200:decision.statusCode,
        json:async()=>{
          const route=new URL(url).pathname;
          return Object.hasOwn(opt.bodies||{},route)?opt.bodies[route]:emptyResponses[route];
        }
      };
    }
  };
  try{await vm.runInNewContext(js,sandbox,{timeout:1000});}catch(e){exit=e.code||99;}
  assert.equal(exit,expected,`${name}: expected exit ${expected}, got ${exit}`);
  results.cases.push({name,exit,calls,logs});
  console.log(`  ✓ Role case: ${name} (exit ${exit})`);
 }

 await roleCase('valid-empty-response-positive',[admin,mgr,tech],0);
 await roleCase('unknown-work-envelope-now-rejects',[admin,mgr,tech],1,{bodies:{'/api/work':{unexpected:[]}}});
 await roleCase('wrong-work-data-type-now-rejects',[admin,mgr,tech],1,{bodies:{'/api/work':{data:{id:'ordinary-id'}}}});
 await roleCase('null-and-scalar-records-now-reject',[admin,mgr,tech],1,{bodies:{'/api/work':{data:[null,'ordinary-id']}}});
 await roleCase('malformed-principal-metadata-now-rejects',[admin,{...mgr,projects:'bad-json'},tech],1);
 await roleCase('ordinary-foreign-facility-work-rejects',[admin,mgr,tech],1,{bodies:{'/api/work':{data:[{id:'ordinary-id',assignedLab:'lab-other'}]}}});
 
 // Fixed cases:
 await roleCase('empty-dashboard-object-now-rejects',[admin,mgr,tech],1,{bodies:{'/api/dashboard/live':{}}});
 await roleCase('empty-work-record-now-rejects',[admin,mgr,tech],1,{bodies:{'/api/work':{data:[{}],meta:{total:1},pagination:{total:1}}}});
 await roleCase('other-technician-assignee-now-rejects',[admin,mgr,tech],1,{bodies:{'/api/work':{data:[{id:'ordinary-id',sampleId:'sample-own',labId:'SPECIMEN-ACCESSION',assignedLab:'lab-own',assignedTo:'ordinary-other-tech',analysis:'PH',status:'ASSIGNED'}],meta:{total:1},pagination:{total:1}}}});

 // Real submission controller:
 const submissionSource=source('server/controllers/submissionController.js'),exportsObj={},controllerQueries=[];let actualBody;
 vm.runInNewContext(slice(submissionSource,'exports.listSubmissions = async','exports.getSubmission = async'),{
   exports:exportsObj,
   console,
   prisma:{
     submission:{findMany:async({where})=>{controllerQueries.push(where);assert.equal(where.assignedLab,'lab-own');assert.equal(where.projectCode,undefined);return [{id:'ordinary-own-submission',sampleId:'sample-own',assignedLab:'lab-own',submittedBy:'fixture-tech'}];}},
     sample:{findMany:async()=>[{id:'sample-own',labId:'SPECIMEN-ACCESSION',originalId:'SPECIMEN-ORIGINAL',projectCode:'OTHER-PROJECT'}]}
   }
 },{timeout:1000});
 await exportsObj.listSubmissions({user:{...mgr,projects:'["OWN-PROJECT"]'},query:{}},{json:b=>{actualBody=b;},status:()=>{throw Error('Unexpected controller failure');}});
 results.cases.push({name:'actual-submission-controller-own-facility-other-project',queries:controllerQueries,body:actualBody});
 await roleCase('route-allowed-own-facility-submission-now-passes',[admin,{...mgr,projects:'["OWN-PROJECT"]'},tech],0,{bodies:{'/api/submissions':actualBody}});

 // Real work item controller:
 const scopeModule={exports:{}},workExports={},workQueries=[];let workBody;
 vm.runInNewContext(source('server/utils/scopeGuard.js'),{module:scopeModule,exports:scopeModule.exports,console},{timeout:1000});
 const workRows=[{id:'ordinary-own-work',sampleId:'sample-own',assignedLab:'lab-own',labId:'SPECIMEN-ACCESSION',assignedTo:tech.username,analysis:'PH',status:'ASSIGNED',history:'[]',sample:{id:'sample-own',labId:'SPECIMEN-ACCESSION',originalId:'SPECIMEN-ORIGINAL',projectCode:'OTHER-PROJECT'}}];
 vm.runInNewContext(slice(source('server/controllers/workItemController.js'),'exports.getWorkItems = async','exports.assignWork = async'),{
   exports:workExports,
   console,
   require:p=>{assert.equal(p,'../utils/scopeGuard');return scopeModule.exports;},
   prisma:{workItem:{findMany:async({where})=>{workQueries.push(where);assert.equal(where.assignedTo,tech.username);assert.equal(where.projectCode,undefined);return workRows;},count:async()=>1}}
 },{timeout:1000});
 await workExports.getWorkItems({user:{...tech,projects:'["OWN-PROJECT"]'},query:{}},{json:b=>{workBody=b;},status:()=>{throw Error('Unexpected controller failure');}});
 results.cases.push({name:'actual-work-controller-assigns-current-technician-without-project-filter',queries:workQueries,body:workBody});

 // Now this MUST pass (exit 0) because own-facility technician work item is not falsely rejected!
 await roleCase('actual-route-allowed-own-technician-other-project-now-passes',[admin,mgr,{...tech,projects:'["OWN-PROJECT"]'}],0,{bodies:{'/api/work':workBody}});

 console.log('\n--- ALL TEST CASES COMPLETED SUCCESSFULLY! ---');
 console.log(JSON.stringify({completed:results.cases.length,cases:results.cases.map(c=>({name:c.name,exit:c.exit}))},null,2));
}

main().catch(e=>{console.error(e.stack);process.exit(1);});
