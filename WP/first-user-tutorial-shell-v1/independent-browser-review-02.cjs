// Focused browser audit of built 7ddf79b; all APIs mocked, no database/server writes.
const fs = require('fs'), path = require('path'), http = require('http');
const { chromium } = require('C:/Users/yigin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const dist = path.resolve(__dirname, '../../client/dist'), files = new Map();
function collect(dir) { for (const e of fs.readdirSync(dir, {withFileTypes:true})) { const p=path.join(dir,e.name); if(e.isDirectory()) collect(p); else files.set('/'+path.relative(dist,p).replaceAll('\\','/'),fs.readFileSync(p)); } }
collect(dist);
const mime={'.js':'text/javascript','.css':'text/css','.html':'text/html','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml'};
const server=http.createServer((req,res)=>{const p=new URL(req.url,'http://127.0.0.1').pathname;const k=files.has(p)?p:'/index.html';res.writeHead(200,{'Content-Type':mime[path.extname(k)]||'application/octet-stream'});res.end(files.get(k));});
const result={time:new Date().toISOString(),candidate:'7ddf79b',assets:[...files.keys()].filter(x=>x.includes('Tutorial')),scope:'Built client snapshot, mocked API, blocked external network; no database or production writes'};
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 try{
  async function context(){const c=await browser.newContext({viewport:{width:1440,height:1000}});await c.route('**/*',r=>{const u=new URL(r.request().url());if(u.origin!==base)return r.abort();if(u.pathname.startsWith('/api/'))return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({translations:{},languages:[],enabledLocales:['en','es','es-419','fr','pt']})});return r.continue();});return c;}
  const c=await context(),p=await c.newPage();p.setDefaultTimeout(7000);
  const documents=[];p.on('request',r=>{if(r.isNavigationRequest()&&r.frame()===p.mainFrame())documents.push(new URL(r.url()).pathname+new URL(r.url()).search)});
  await p.goto(base+'/login?tutorialmode=true&lang=en');await p.locator('#next').waitFor();
  for(let i=0;i<3;i++)await p.locator('#next').click();await p.locator('[data-path="full"]').click();await p.locator('#next').click();
  result.identity={url:p.url().replace(base,''),guideRole:await p.locator('#soilfer-tutorial-overlay').getAttribute('role'),title:await p.locator('#coachTitle').innerText()};
  await p.locator('#next').click();
  result.field={route:await p.locator('#route').innerText(),highlightCount:await p.locator('.sf-tutorial-target-highlight').count(),fallback:(await p.locator('#soilfer-tutorial-overlay').innerText()).includes('Target element not present')};
  const before=documents.length;
  await p.getByRole('button',{name:'Go to page →',exact:true}).click();await p.waitForTimeout(500);
  result.field.documentsAfterGo=documents.slice(before);result.field.guideCountAfterGo=await p.locator('#coachTitle').count();result.field.resumeAfterGo=await p.locator('#resume').count();
  if (await p.locator('#resume').count()) await p.locator('#resume').click();
  while (await p.locator('#check0').count() === 0) await p.locator('#next').click();
  await p.locator('#check0').check();await p.locator('#check1').check();await p.locator('#check2').check();await p.locator('#verifyChecks').click();
  const beforeTube=await p.locator('#prepStatus').innerText();await p.locator('[data-sample="2"]').click();
  result.prepTubeSwitch={before:beforeTube,after:await p.locator('#prepStatus').innerText(),checked:await p.locator('input[type="checkbox"]:checked').count(),verifyDisabled:await p.locator('#verifyChecks').isDisabled()};
  await p.setViewportSize({width:390,height:844});await p.waitForTimeout(150);
  result.mobile={pause:await p.locator('#pause').isVisible(),exit:await p.locator('#exit').isVisible(),language:await p.getByRole('combobox',{name:'Language',exact:true}).isVisible(),toggle:await p.locator('#mobileToggle').isVisible()};
  await p.locator('#mobileToggle').click();result.mobile.expandedExit=await p.locator('#exit').isVisible();result.mobile.expandedPause=await p.locator('#pause').isVisible();
  await p.setViewportSize({width:1440,height:1000});await p.getByRole('combobox',{name:'Language',exact:true}).selectOption('fr');
  // Keep progression within the guide; no real page navigation or live input.
  while ((await p.locator('#position').innerText()).split('/')[0].trim() !== '16') await p.locator('#next').click();
  result.frenchFinish={title:await p.locator('#coachTitle').innerText(),englishFinish:(await p.locator('#soilfer-tutorial-overlay').innerText()).includes('Before you begin testing')};
  await c.close();
  const l=await context();await l.addInitScript(()=>{localStorage.setItem('locale','fr');sessionStorage.setItem('soilfer_locale_override','fr');});const lp=await l.newPage();await lp.goto(base+'/login?tutorialmode=true');await lp.locator('#coachTitle').waitFor();result.appLocale={stored:'fr',tutorialTitle:await lp.locator('#coachTitle').innerText(),guideLanguage:await lp.locator('[data-sf-tutorial] select[aria-label]').first().inputValue()};await l.close();
  const a=await context();let release;const waitMe=new Promise(r=>release=r);
  await a.route('**/api/auth/me',async r=>{await waitMe;await r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({id:'test-new',name:'Fresh Staff',username:'fresh',role:'LAB_TECHNICIAN',labId:'LAB-B',language:'en'})});});
  await a.addInitScript(()=>{localStorage.setItem('token','isolated-test-token-not-valid');localStorage.setItem('user',JSON.stringify({id:'test-old',name:'Old Cached Staff',role:'LAB_MANAGER',labId:'LAB-A'}));});
  const ap=await a.newPage();await ap.goto(base+'/login?tutorialmode=true&lang=en');await ap.locator('#next').waitFor();for(let i=0;i<4;i++)await ap.locator('#next').click();release();await ap.waitForFunction(()=>JSON.parse(localStorage.getItem('user')).name==='Fresh Staff');
  result.authRevalidation={appCachedName:await ap.evaluate(()=>JSON.parse(localStorage.getItem('user')).name),tutorialStillOld:(await ap.locator('#soilfer-tutorial-overlay').innerText()).includes('Old Cached Staff')};await a.close();
  const f=await context();let blocks=0;await f.route('**/TutorialShell-*.js',r=>{blocks++;return r.abort();});const fp=await f.newPage();await fp.goto(base+'/login?tutorialmode=true');await fp.waitForTimeout(600);result.actualChunkFailure={blocked:blocks,passwordInputs:await fp.locator('input[type="password"]').count(),tutorial:await fp.locator('#soilfer-tutorial-overlay').count()};await f.close();
 }finally{await browser.close();await new Promise(r=>server.close(r));fs.writeFileSync(path.join(__dirname,'independent-browser-review-02.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));}
})().catch(e=>{console.error(e);process.exitCode=1;server.close();});
