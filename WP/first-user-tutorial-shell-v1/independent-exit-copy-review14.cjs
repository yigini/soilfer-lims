// Frozen real client build; only changed guide controls. Synthetic reads, no app/backend/data edits.
const fs=require('fs'),path=require('path'),http=require('http'),crypto=require('crypto'),cp=require('child_process');
const {chromium}=require('C:/Users/yigin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'../..'),dist=path.join(root,'client/dist'),files=new Map();
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function collect(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())collect(p);else files.set('/'+path.relative(dist,p).replaceAll('\\','/'),fs.readFileSync(p));}}collect(dist);
const mime={'.js':'text/javascript','.css':'text/css','.html':'text/html','.json':'application/json','.png':'image/png','.svg':'image/svg+xml'};
const evidence={time:new Date().toISOString(),scope:'Frozen local client/dist, mocked reads only. Only320px Login collapsed Exit label and row fit; no full responsive/auth/draft matrix repeated. Mouse clicks use initially visible centers without force, DOM click or scrolling.',sourceHead:cp.execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),sourceShellSha256:sha(fs.readFileSync(path.join(root,'client/src/tutorial/TutorialShell.jsx'))),indexSha256:sha(files.get('/index.html')),assets:[...files.keys()].filter(k=>k.includes('Tutorial')).map(k=>({path:k,sha256:sha(files.get(k))})),errors:[],blockedWrites:[],cases:[]};
const server=http.createServer((req,res)=>{const p=new URL(req.url,'http://127.0.0.1').pathname,k=files.has(p)?p:'/index.html';res.writeHead(200,{'Content-Type':mime[path.extname(k)]||'application/octet-stream'});res.end(files.get(k));});
let browser,base;
async function runCase(viewport,route,locale){
 const record={viewport,route,locale,states:[],actions:[]};evidence.cases.push(record);
 const context=await browser.newContext({viewport,serviceWorkers:'block'});
 const user={id:'synthetic-control-tech',name:'Synthetic Technician',username:'synthetic-control-tech',role:'LAB_TECHNICIAN',labId:'SYNTHETIC-LAB',language:locale,mustChangePassword:false};
 const payloads={'/api/public/i18n/bootstrap':{languages:[],translations:{},brandingDefaultLanguage:locale},'/api/admin/settings':{},'/api/config/analyses':[],'/api/notifications':[],'/api/workbench/queue':{groups:[],stats:{}},'/api/workbench/v2/receipts':{receipts:[]}};
 await context.route('**/*',async r=>{const req=r.request(),u=new URL(req.url());if(u.origin!==base)return r.abort();
  if(!['GET','HEAD'].includes(req.method())){evidence.blockedWrites.push(req.method()+' '+u.pathname);return r.abort();}
  if(u.pathname.startsWith('/api/'))return r.fulfill({status:u.pathname==='/api/auth/me'&&route==='/login'?401:200,contentType:'application/json',body:JSON.stringify(u.pathname==='/api/auth/me'?(route==='/workbench'?user:{error:'Not signed in'}):payloads[u.pathname]??[])});
  return r.continue();
 });
 if(context.routeWebSocket)await context.routeWebSocket('**/*',ws=>ws.close());
 await context.addInitScript(({locale,route,user})=>{localStorage.setItem('locale',locale);if(route==='/workbench'){localStorage.setItem('user',JSON.stringify(user));localStorage.setItem('token','synthetic-control-token-not-real');}sessionStorage.setItem('soilfer_tutorial_v1',JSON.stringify({active:true,step:13,introStage:3,path:'full',roleChoice:'technician',sampleTube:1,viewed:[],practiced:[],done:[],skipped:[],paused:false,language:locale,timestamp:Date.now(),lastActivityAt:Date.now()}));},{locale,route,user});
 const page=await context.newPage();page.setDefaultTimeout(6000);page.on('pageerror',e=>{record.pageError=e.message;evidence.errors.push(e.message);});
 const expected=JSON.parse(fs.readFileSync(path.join(root,'client/src/tutorial/locales',locale+'.json'),'utf8'));
 const selectedShot=(viewport.width===320&&['en','fr','pt'].includes(locale))||(viewport.width===700&&locale==='fr')||(viewport.width===1440&&locale==='en');
 const shot=async label=>{const name=`independent-exit-copy-review14-${viewport.width}-${route.slice(1)}-${locale}-${label}.png`;await page.screenshot({path:path.join(__dirname,name)});(record.screenshots??=[]).push(name);};
 async function geometry(label,ids){
  const g=await page.evaluate(({label,ids})=>{
   const box=e=>{if(!e)return null;const b=e.getBoundingClientRect();return {x:b.x,y:b.y,width:b.width,height:b.height,right:b.right,bottom:b.bottom};};
   const root=document.querySelector('#soilfer-tutorial-overlay'),coach=root?.querySelector('.coach');
   return {label,guide:box(root),coach:box(coach),coachScrollLeft:coach?.scrollLeft,controls:ids.map(id=>{const e=document.getElementById(id),b=e?.getBoundingClientRect(),hit=b&&document.elementFromPoint(b.x+b.width/2,b.y+b.height/2);let clipped=false;for(let a=e?.parentElement;a;a=a.parentElement){const s=getComputedStyle(a),r=a.getBoundingClientRect();if(/hidden|auto|scroll|clip/.test(s.overflowX)&&b&&(b.left<r.left-1||b.right>r.right+1))clipped=true;if(/hidden|auto|scroll|clip/.test(s.overflowY)&&b&&(b.top<r.top-1||b.bottom>r.bottom+1))clipped=true;}return {id,text:e?.innerText,box:box(e),inViewport:!!b&&b.x>=0&&b.right<=innerWidth&&b.y>=0&&b.bottom<=innerHeight,hitTarget:!!hit&&(e===hit||e.contains(hit)),clipped};})};
  },{label,ids});record.states.push(g);return g;
 }
 async function clickCenter(id){
  const control=(await geometry('before-click-'+id,[id])).controls[0];
  if(!control.inViewport||!control.hitTarget||control.clipped)throw new Error('Initially inaccessible pointer control: '+id+' '+JSON.stringify(control));
  await page.mouse.click(control.box.x+control.box.width/2,control.box.y+control.box.height/2);record.actions.push(id);await page.waitForTimeout(60);
 }
 try{

  const url=base+route+'?tutorialmode=true&tour=first-visit&lang='+locale;
  await page.goto(url);await page.locator('#collapseCoachBtn').waitFor();
  record.actualLocale=await page.locator('#soilfer-tutorial-overlay .coach-top select').inputValue();
  await clickCenter('collapseCoachBtn');
  const row=await geometry('collapsed',['expandCoachBtn','pauseCollapsedBtn','exitCollapsedBtn']);
  record.renderedExit=await page.locator('#exitCollapsedBtn').innerText();
  record.expectedShortExit={en:'Exit',es:'Salir','es-419':'Salir',fr:'Quitter',pt:'Sair'}[locale];
  record.localePass=record.actualLocale===locale&&record.renderedExit===record.expectedShortExit+' '+String.fromCharCode(0x2715);
  await clickCenter('exitCollapsedBtn');await page.waitForTimeout(80);
  record.exitRemoved=await page.locator('#soilfer-tutorial-overlay').count()===0;
  record.pass=record.localePass&&record.exitRemoved&&!record.pageError&&record.states.every(s=>(!s.guide||(s.guide.x>=0&&s.guide.right<=viewport.width))&&(!s.coachScrollLeft)&&s.controls.every(c=>c.inViewport&&c.hitTarget&&!c.clipped));
 }catch(e){record.error=String(e.stack||e);record.pass=false;await shot('failure');}
 await context.close();console.log(JSON.stringify({viewport,route,locale,pass:record.pass,error:record.error?.slice(0,250)}));
}
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${server.address().port}`;
 browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 const jobs=[];for(const viewport of [{width:320,height:700}])for(const route of ['/login'])for(const locale of ['en','es','es-419','fr','pt'])jobs.push(()=>runCase(viewport,route,locale));
 for(let i=0;i<jobs.length;i+=4)await Promise.all(jobs.slice(i,i+4).map(f=>f()));
 evidence.pass=evidence.cases.every(c=>c.pass)&&evidence.errors.length===0&&evidence.blockedWrites.length===0;
})().catch(e=>{evidence.harnessError=String(e.stack||e);process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();await new Promise(r=>server.close(r));fs.writeFileSync(path.join(__dirname,'independent-exit-copy-review14.json'),JSON.stringify(evidence,null,2));console.log(JSON.stringify({pass:evidence.pass,total:evidence.cases.length,failures:evidence.cases.filter(c=>!c.pass).map(c=>({viewport:c.viewport,route:c.route,locale:c.locale,error:c.error})),errors:evidence.errors,blockedWrites:evidence.blockedWrites}));});
