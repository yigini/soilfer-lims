// Independent real SPA sign-out / sign-in with synthetic, fully intercepted authentication.
// Frozen local client/dist; no app hooks, app edits, backend, database, or production calls.
const fs=require('fs'),path=require('path'),http=require('http'),crypto=require('crypto'),cp=require('child_process');
const {chromium}=require('C:/Users/yigin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'../..'),dist=path.join(root,'client/dist'),files=new Map();
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function collect(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())collect(p);else files.set('/'+path.relative(dist,p).replaceAll('\\','/'),fs.readFileSync(p));}}collect(dist);
const mime={'.js':'text/javascript','.css':'text/css','.html':'text/html','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml'};
const evidence={time:new Date().toISOString(),scope:'Frozen current local client/dist, all APIs intercepted; synthetic authentication tests UI state only. No database or production. Only initial navigation uses page.goto; later account changes use real UI.',sourceHead:cp.execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),sourceShellSha256:sha(fs.readFileSync(path.join(root,'client/src/tutorial/TutorialShell.jsx'))),indexSha256:sha(files.get('/index.html')),assets:[...files.keys()].filter(k=>k.includes('Tutorial')).map(k=>({path:k,sha256:sha(files.get(k))})),errors:[],blockedWrites:[],mockedAuthPosts:[],blockedExternal:[],apiReads:[],documentRequests:[],checks:{}};
const server=http.createServer((req,res)=>{const p=new URL(req.url,'http://127.0.0.1').pathname,k=files.has(p)?p:'/index.html';res.writeHead(200,{'Content-Type':mime[path.extname(k)]||'application/octet-stream'});res.end(files.get(k));});
let browser,p,base;
async function checkLayouts(){
 evidence.layouts=[];
 for(const viewport of [{width:1440,height:1000},{width:390,height:844},{width:320,height:700}]){
  const context=await browser.newContext({viewport,serviceWorkers:'block'});
  await context.route('**/*',async r=>{const req=r.request(),u=new URL(req.url());
   if(u.origin!==base)return r.abort();
   if(!['GET','HEAD'].includes(req.method())){evidence.blockedWrites.push(req.method()+' '+u.pathname);return r.abort();}
   if(u.pathname.startsWith('/api/'))return r.fulfill({status:u.pathname==='/api/auth/me'?401:200,contentType:'application/json',body:JSON.stringify(u.pathname==='/api/public/i18n/bootstrap'?{languages:[],translations:{},brandingDefaultLanguage:'en'}:u.pathname==='/api/auth/me'?{error:'Not signed in'}:[])});
   return r.continue();
  });
  if(context.routeWebSocket)await context.routeWebSocket('**/*',ws=>ws.close());
  await context.addInitScript(()=>{localStorage.setItem('locale','en');sessionStorage.setItem('soilfer_tutorial_v1',JSON.stringify({active:true,step:13,introStage:3,path:'full',roleChoice:'technician',sampleTube:1,viewed:[],practiced:[],done:[],skipped:[],paused:false,language:'en',timestamp:Date.now(),lastActivityAt:Date.now()}));});
  const page=await context.newPage();page.setDefaultTimeout(5000);page.on('pageerror',e=>evidence.errors.push(e.message));
  const record={viewport,states:[]};evidence.layouts.push(record);
  try{
   await page.goto(base+'/login?tutorialmode=true&tour=first-visit');await page.locator('#collapseCoachBtn').waitFor();await page.waitForTimeout(300);
   async function geometry(label,ids){
    const item=await page.evaluate(({label,ids})=>{
     const box=e=>{if(!e)return null;const b=e.getBoundingClientRect();return {x:b.x,y:b.y,width:b.width,height:b.height,right:b.right,bottom:b.bottom,scrollWidth:e.scrollWidth,clientWidth:e.clientWidth};};
     const guide=document.querySelector('#soilfer-tutorial-overlay'),coach=guide.querySelector('.coach');
     return {label,guide:box(guide),coach:box(coach),pageWidth:document.documentElement.scrollWidth,controls:ids.map(id=>{const e=document.getElementById(id),b=e?.getBoundingClientRect(),x=b?.x+b?.width/2,y=b?.y+b?.height/2,hit=b&&document.elementFromPoint(x,y);return {id,box:box(e),inViewport:!!b&&b.x>=0&&b.right<=innerWidth&&b.y>=0&&b.bottom<=innerHeight,hitTarget:!!hit&&(hit===e||e.contains(hit)),hit:hit?.id||hit?.tagName||null};})};
    },{label,ids});
    record.states.push(item);
    await page.screenshot({path:path.join(__dirname,`independent-pointer-review13-${viewport.width}-${label}.png`),fullPage:false});
   }
   await geometry('expanded',['collapseCoachBtn','pause','exit']);
   await page.locator('#collapseCoachBtn').click();
   await geometry('collapsed',['expandCoachBtn','pauseCollapsedBtn','exitCollapsedBtn']);
   await page.locator('#expandCoachBtn').click();
   try{await page.locator('#exit').click();record.expandedExitClicked=true;}catch(e){record.expandedExitError=String(e.message).slice(0,1800);}
   if(!record.expandedExitClicked){await page.locator('#collapseCoachBtn').click();await page.locator('#exitCollapsedBtn').click();record.collapsedExitClicked=true;}
   record.guideExited=await page.locator('#soilfer-tutorial-overlay').count()===0;
   record.pass=record.states.every(s=>s.guide.x>=0&&s.guide.right<=viewport.width&&s.controls.every(x=>x.inViewport&&x.hitTarget))&&record.expandedExitClicked&&record.guideExited;
  }catch(e){record.error=String(e.stack||e);await page.screenshot({path:path.join(__dirname,`independent-pointer-review13-${viewport.width}-error.png`)});}
  await context.close();
 }
 evidence.authPass=evidence.pass;
 evidence.pass=evidence.authPass&&evidence.layouts.every(x=>x.pass);
}
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${server.address().port}`;
 browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 const c=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'block'});
 const techA={id:'synthetic-tech-a',username:'synthetic-tech-a',name:'Synthetic Technician A',role:'LAB_TECHNICIAN',labId:'SYNTHETIC-LAB-A',language:'en',mustChangePassword:false};
 const techB={id:'synthetic-tech-b',username:'synthetic-tech-b',name:'Synthetic Technician B',role:'LAB_TECHNICIAN',labId:'SYNTHETIC-LAB-B',language:'en',mustChangePassword:false};
 const tokenA='synthetic-spa-token-a-not-real',tokenB='synthetic-spa-token-b-not-real';
 const payloads={'/api/public/i18n/bootstrap':{languages:[],translations:{},brandingDefaultLanguage:'en'},'/api/admin/settings':{},'/api/config/analyses':[],'/api/notifications':[],'/api/workbench/queue':{groups:[],stats:{}},'/api/workbench/v2/receipts':{receipts:[]}};
 await c.route('**/*',async r=>{const req=r.request(),u=new URL(req.url());
  if(u.origin!==base){evidence.blockedExternal.push(u.origin+u.pathname);return r.abort();}
  if(req.resourceType()==='document')evidence.documentRequests.push(u.pathname+u.search);
  if(req.method()==='POST'&&u.pathname==='/api/auth/login'){
   const body=req.postDataJSON();evidence.mockedAuthPosts.push({path:u.pathname,username:body.username});
   return r.fulfill({status:body.username===techB.username?200:401,contentType:'application/json',body:JSON.stringify(body.username===techB.username?{token:tokenB,user:techB}:{error:'Synthetic credentials not recognized'})});
  }
  if(!['GET','HEAD'].includes(req.method())){evidence.blockedWrites.push(req.method()+' '+u.pathname);return r.abort();}
  if(u.pathname.startsWith('/api/')){
   const auth=req.headers().authorization,actor=auth===`Bearer ${tokenB}`?techB:auth===`Bearer ${tokenA}`?techA:null;
   evidence.apiReads.push({path:u.pathname,actor:actor?.id||null});
   if(u.pathname==='/api/auth/me')return r.fulfill({status:actor?200:401,contentType:'application/json',body:JSON.stringify(actor||{error:'Not signed in'})});
   if(u.pathname==='/api/samples/OLD-LAB-SAMPLE/detail')return r.fulfill({status:actor?.id===techA.id?200:403,contentType:'application/json',body:JSON.stringify(actor?.id===techA.id?{sample:{id:'OLD-LAB-SAMPLE',sampleId:'OLD-LAB-SAMPLE',labId:techA.labId}}:{error:'This sample belongs to another lab'})});
   return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(payloads[u.pathname]??[])});
  }
  return r.continue();
 });
 if(c.routeWebSocket)await c.routeWebSocket('**/*',ws=>ws.close());
 await c.addInitScript(({u,token})=>{localStorage.setItem('user',JSON.stringify(u));localStorage.setItem('token',token);localStorage.setItem('locale','en');sessionStorage.setItem('soilfer_tutorial_v1',JSON.stringify({active:true,step:13,introStage:3,path:'full',roleChoice:'technician',sampleTube:1,viewed:[],practiced:[],done:[],skipped:[],paused:false,language:'en',timestamp:Date.now(),lastActivityAt:Date.now()}));},{u:techA,token:tokenA});
 p=await c.newPage();p.setDefaultTimeout(10000);p.on('pageerror',e=>evidence.errors.push(e.message));
 await p.goto(base+'/workbench?tutorialmode=true&tour=first-visit');
 await p.locator('#sampleIdInput').waitFor();await p.waitForTimeout(650);
 await p.evaluate(()=>window.__independentDocumentMarker='pointer-review13');
 const guide=p.locator('#soilfer-tutorial-overlay');
 evidence.checks.initial={url:p.url().replace(base,''),guideHasA:(await guide.innerText()).includes(techA.name),sampleInput:await p.locator('#sampleIdInput').inputValue()};
 await p.locator('#sampleIdInput').fill('OLD-LAB-SAMPLE');
 await p.locator('#collapseCoachBtn').click();
 await p.getByTitle('User Menu',{exact:true}).click();
 await p.getByRole('button',{name:'Sign Out',exact:true}).click();
 await p.locator('#expandCoachBtn').click();
 await p.locator('#username').waitFor();await p.waitForTimeout(250);
 evidence.checks.signedOut={url:p.url().replace(base,''),guideHasA:(await guide.innerText()).includes(techA.name),sampleInput:await p.locator('#sampleIdInput').inputValue(),marker:await p.evaluate(()=>window.__independentDocumentMarker)};
 await p.locator('#collapseCoachBtn').click();
 await p.locator('#username').fill(techB.username);await p.locator('#password').fill('synthetic-only-not-a-real-password');await p.locator('form button[type=submit]').click();
 await p.locator('#expandCoachBtn').click();
 await p.getByTitle('User Menu',{exact:true}).waitFor();await p.waitForTimeout(700);
 evidence.checks.signedInB={url:p.url().replace(base,''),guideHasB:(await guide.innerText()).includes(techB.name),guideHasA:(await guide.innerText()).includes(techA.name),sampleInput:await p.locator('#sampleIdInput').inputValue(),marker:await p.evaluate(()=>window.__independentDocumentMarker),authMeB:evidence.apiReads.some(x=>x.path==='/api/auth/me'&&x.actor===techB.id)};
 const benchLink=p.locator('a[href="/workbench"]').filter({visible:true}).first();await benchLink.click();await p.waitForURL(u=>u.pathname==='/workbench');
 await p.locator('#sampleIdInput').fill('OLD-LAB-SAMPLE');await p.locator('#viewSampleMapBtn').click();await p.waitForTimeout(750);
 const guideText=await guide.innerText();
 evidence.checks.forbiddenOldLab={url:p.url().replace(base,''),guideHasB:guideText.includes(techB.name),guideHasA:guideText.includes(techA.name),guideText:guideText.slice(-4000),requestedAsB:evidence.apiReads.some(x=>x.path==='/api/samples/OLD-LAB-SAMPLE/detail'&&x.actor===techB.id),marker:await p.evaluate(()=>window.__independentDocumentMarker),documentRequests:evidence.documentRequests.length};
 evidence.pass=evidence.checks.initial.guideHasA&&!evidence.checks.signedOut.guideHasA&&evidence.checks.signedOut.sampleInput===''&&evidence.checks.signedInB.guideHasB&&!evidence.checks.signedInB.guideHasA&&evidence.checks.signedInB.sampleInput===''&&evidence.checks.signedInB.authMeB&&evidence.checks.forbiddenOldLab.requestedAsB&&new URL(p.url()).pathname==='/workbench'&&evidence.checks.forbiddenOldLab.marker==='pointer-review13'&&evidence.documentRequests.length===1&&evidence.errors.length===0&&evidence.blockedWrites.length===0;
 await c.close();
 await checkLayouts();
})().catch(async e=>{evidence.harnessError=String(e.stack||e);if(p)try{evidence.failureState={url:p.url().replace(base,''),body:(await p.locator('body').innerText()).slice(-7000),marker:await p.evaluate(()=>window.__independentDocumentMarker)};}catch{}process.exitCode=1;try{await checkLayouts();}catch(layoutError){evidence.layoutHarnessError=String(layoutError.stack||layoutError);}}).finally(async()=>{if(browser)await browser.close();await new Promise(r=>server.close(r));fs.writeFileSync(path.join(__dirname,'independent-pointer-review13.json'),JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence,null,2));});
