// Bounded independent audit. Built assets are snapshotted once into memory.
// Isolated headless browser, mocked APIs, blocked external network. No DB or production access.
const fs = require('fs'), path = require('path'), http = require('http'), crypto = require('crypto');
const { chromium } = require('C:/Users/yigin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const dist = path.resolve(__dirname, '../../client/dist'), files = new Map();
function collect(dir) { for (const e of fs.readdirSync(dir,{withFileTypes:true})) { const p=path.join(dir,e.name); if(e.isDirectory())collect(p); else files.set('/'+path.relative(dist,p).replaceAll('\\','/'),fs.readFileSync(p)); } }
collect(dist);
const mime={'.js':'text/javascript','.css':'text/css','.html':'text/html','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml'};
const server=http.createServer((req,res)=>{const p=new URL(req.url,'http://127.0.0.1').pathname,k=files.has(p)?p:'/index.html';res.writeHead(200,{'Content-Type':mime[path.extname(k)]||'application/octet-stream'});res.end(files.get(k));});
const result={time:new Date().toISOString(),scope:'Existing built client snapshot; isolated browser; mocked APIs; blocked external network; no database or production writes',assets:[...files.keys()].filter(x=>x.includes('Tutorial')),indexSha256:crypto.createHash('sha256').update(files.get('/index.html')).digest('hex'),checks:{}};
const actor={id:'mock-auth-review-03',name:'Cached Review Staff',username:'mock-review',role:'LAB_MANAGER',labId:'MOCK-LAB',language:'en',permissions:['VIEW_PROJECTS','VIEW_SAMPLES','APPROVE_RESULTS'],mustChangePassword:false};
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 try{
  async function context(user){const c=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'block'});await c.route('**/*',r=>{const u=new URL(r.request().url());if(u.origin!==base)return r.abort();if(u.pathname.startsWith('/api/'))return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({translations:{},languages:[],enabledLocales:['en','es','es-419','fr','pt']})});return r.continue();});if(user)await c.addInitScript(u=>{localStorage.setItem('token','mock-token-not-valid-on-any-server');localStorage.setItem('user',JSON.stringify(u));},user);return c;}
  async function run(name,fn){try{result.checks[name]=await fn();}catch(e){result.checks[name]={testError:e.message};}}
  await run('server500CachedVerification',async()=>{
   const c=await context(actor);let release;const gate=new Promise(r=>release=r);let meCount=0;
   await c.route('**/api/auth/me',async r=>{meCount++;await gate;await r.fulfill({status:500,contentType:'application/json',body:JSON.stringify({error:'Synthetic unavailable response'})});});
   const p=await c.newPage();p.setDefaultTimeout(7000);await p.goto(base+'/login?tutorialmode=true&lang=en');await p.locator('#next').waitFor();for(let i=0;i<4;i++)await p.locator('#next').click();
   const beforeRelease={title:await p.locator('#coachTitle').innerText(),cachedNameVisible:(await p.locator('#soilfer-tutorial-overlay').innerText()).includes(actor.name)};
   release();await p.waitForTimeout(350);const beforeGo=p.url().replace(base,'');await p.locator('#goToPage').click();await p.waitForTimeout(450);
   const data={meRequests:meCount,beforeRelease,beforeGo,afterGo:p.url().replace(base,''),cachedNameVisible:(await p.locator('body').innerText()).includes(actor.name),interpretation:'Identity chapter resolves / only when hook isAuthenticated is true; /login when false. A 500 response must stay unavailable.'};await c.close();return data;
  });
  await run('runtimeMustChangePassword',async()=>{
   const c=await context(actor);let release;const gate=new Promise(r=>release=r);let meCount=0;
   await c.route('**/api/auth/me',async r=>{meCount++;await gate;await r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({...actor,mustChangePassword:true})});});
   const p=await c.newPage();p.setDefaultTimeout(7000);const errors=[];p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error'&&(m.text().includes('Tutorial Error Boundary')||m.text().includes('Minified React error')))errors.push(m.text());});
   await p.goto(base+'/login?tutorialmode=true&lang=en');await p.locator('#coachTitle').waitFor();const overlayBefore=await p.locator('#soilfer-tutorial-overlay').count();release();await p.waitForTimeout(650);
   const data={meRequests:meCount,overlayBefore,overlayAfter:await p.locator('#soilfer-tutorial-overlay').count(),ordinaryPasswordInputs:await p.locator('input[type=password]').count(),serverValidatedFlag:await p.evaluate(()=>JSON.parse(localStorage.getItem('user')).mustChangePassword),errors};await c.close();return data;
  });
  await run('exitThenRefresh',async()=>{
   const c=await context();const p=await c.newPage();p.setDefaultTimeout(7000);await p.goto(base+'/login?tutorialmode=true&tour=first-visit&lang=en&keep=example#section');await p.locator('#exit').click();await p.waitForTimeout(100);
   const afterExit={url:p.url().replace(base,''),overlays:await p.locator('#soilfer-tutorial-overlay').count(),storedGuide:await p.evaluate(()=>sessionStorage.getItem('soilfer_tutorial_v1'))};
   await p.reload();await p.waitForTimeout(350);const afterRefresh={url:p.url().replace(base,''),overlays:await p.locator('#soilfer-tutorial-overlay').count()};await c.close();return {afterExit,afterRefresh};
  });
 }finally{await browser.close();await new Promise(r=>server.close(r));fs.writeFileSync(path.join(__dirname,'independent-auth-review-03.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));}
})().catch(e=>{console.error(e);process.exitCode=1;server.close();});
