// Bounded regression: a tutorial sample GET must not navigate to an old sample after input changes.
// Current dist is frozen in memory. All APIs mocked; no backend, DB, production or app edits.
const fs=require('fs'),path=require('path'),http=require('http'),crypto=require('crypto'),cp=require('child_process');
const {chromium}=require('C:/Users/yigin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'../..'),dist=path.join(root,'client/dist'),files=new Map();
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function collect(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())collect(p);else files.set('/'+path.relative(dist,p).replaceAll('\\','/'),fs.readFileSync(p));}}collect(dist);
const mime={'.js':'text/javascript','.css':'text/css','.html':'text/html','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml'};
const evidence={time:new Date().toISOString(),scope:'Frozen current local client/dist; all API requests mocked; no backend, database or production access. Synthetic technician authentication verifies client behavior only.',sourceHead:cp.execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),sourceShellSha256:sha(fs.readFileSync(path.join(root,'client/src/tutorial/TutorialShell.jsx'))),indexSha256:sha(files.get('/index.html')),assets:[...files.keys()].filter(k=>k.includes('Tutorial')).map(k=>({path:k,sha256:sha(files.get(k))})),errors:[],blockedWrites:[],blockedExternal:[],apiReads:[],checks:{}};
const server=http.createServer((req,res)=>{const p=new URL(req.url,'http://127.0.0.1').pathname,k=files.has(p)?p:'/index.html';res.writeHead(200,{'Content-Type':mime[path.extname(k)]||'application/octet-stream'});res.end(files.get(k));});
let browser;
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const c=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'block'});
const user={id:'map-exit-synthetic-tech',username:'map-race-check',name:'Map Race Technician',role:'LAB_TECHNICIAN',labId:'MAP-RACE-LAB',language:'en',mustChangePassword:false};
const payloads={'/api/auth/me':user,'/api/public/i18n/bootstrap':{languages:[],translations:{},brandingDefaultLanguage:'en'},'/api/admin/settings':{},'/api/config/analyses':[],'/api/notifications':[],'/api/workbench/queue':{groups:[],stats:{}},'/api/workbench/v2/receipts':{receipts:[]}};
let releaseDetail,announceDetail;const pendingDetail=new Promise(r=>releaseDetail=r),detailRequested=new Promise(r=>announceDetail=r);let heldOnce=false;
await c.route('**/*',async r=>{const req=r.request(),u=new URL(req.url());if(u.origin!==base){evidence.blockedExternal.push(u.origin+u.pathname);return r.abort();}if(!['GET','HEAD'].includes(req.method())){evidence.blockedWrites.push(req.method()+' '+u.pathname);return r.abort();}if(u.pathname.startsWith('/api/')){evidence.apiReads.push(u.pathname);if(u.pathname==='/api/samples/TEST-SAMPLE/detail'&&!heldOnce){heldOnce=true;announceDetail();await pendingDetail;return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({sample:{id:'TEST-SAMPLE',sampleId:'TEST-SAMPLE',labId:'MAP-RACE-LAB'}})});}return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(payloads[u.pathname]??[])});}return r.continue();});
if(c.routeWebSocket)await c.routeWebSocket('**/*',ws=>ws.close());
await c.addInitScript(u=>{localStorage.setItem('user',JSON.stringify(u));localStorage.setItem('token','synthetic-map-race-not-a-real-token');localStorage.setItem('locale','en');sessionStorage.setItem('soilfer_tutorial_v1',JSON.stringify({active:true,step:13,introStage:3,path:'full',roleChoice:'technician',sampleTube:1,viewed:[],practiced:[],done:[],skipped:[],paused:false,language:'en',timestamp:Date.now(),lastActivityAt:Date.now()}));},user);
const p=await c.newPage();p.setDefaultTimeout(8000);p.on('pageerror',e=>evidence.errors.push(e.message));
await p.goto(base+'/workbench?tutorialmode=true&tour=first-visit');await p.locator('#sampleIdInput').waitFor();await p.waitForTimeout(800);
evidence.checks.before={url:p.url().replace(base,''),title:await p.locator('#coachTitle').innerText(),authIdentity:await p.evaluate(()=>JSON.parse(localStorage.getItem('user')).id)};
await p.locator('#sampleIdInput').fill('TEST-SAMPLE');await p.locator('#viewSampleMapBtn').click();await Promise.race([detailRequested,new Promise((_,rej)=>setTimeout(()=>rej(new Error('Sample detail GET not observed')),7000))]);
evidence.checks.pending={url:p.url().replace(base,''),detailHeld:heldOnce};await p.locator('#sampleIdInput').fill('SECOND-SAMPLE');await p.waitForTimeout(150);
evidence.checks.afterInputChangeBeforeResponse={url:p.url().replace(base,''),guideCount:await p.locator('#soilfer-tutorial-overlay').count(),session:await p.evaluate(()=>sessionStorage.getItem('soilfer_tutorial_v1'))};
releaseDetail();await p.waitForTimeout(1100);
evidence.checks.afterLateResponse={url:p.url().replace(base,''),guideCount:await p.locator('#soilfer-tutorial-overlay').count(),session:await p.evaluate(()=>sessionStorage.getItem('soilfer_tutorial_v1')!==null)};
evidence.reproduced=new URL(p.url()).pathname!=='/workbench';
evidence.expected='After changing the sample input, the previous lookup is canceled or ignored; route stays /workbench until the new selection is requested.';
await c.close();
})().catch(e=>{evidence.harnessError=String(e.stack||e);process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();await new Promise(r=>server.close(r));fs.writeFileSync(path.join(__dirname,'independent-map-selection-review10.json'),JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence,null,2));});

