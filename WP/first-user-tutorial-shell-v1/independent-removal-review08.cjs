// Independent T22: build and serve a distinct Git-exported copy with tutorial removed.
const fs = require('fs'), path = require('path'), os = require('os'), http = require('http');
const { spawnSync } = require('child_process');
const { createHash } = require('crypto');
const { chromium } = require('C:/Users/yigin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const repo = path.resolve(__dirname, '../..');
const candidate = '2a07e37bc48b10ff393af2a00a38e10b579d86ad';
const evidence = { time: new Date().toISOString(), candidate, scope: 'Only a new isolated Git-exported client copy was modified. All API reads mocked; writes and external network blocked. No application backend/database or production access.', checks: {}, apiReads: [], blockedWrites: [], blockedExternal: [], browserErrors: [] };
function command(exe, args, cwd) { const r=spawnSync(exe,args,{cwd,encoding:'utf8',maxBuffer:30*1024*1024,windowsHide:true}); if(r.status!==0)throw new Error(`${exe} exited ${r.status}: ${r.stderr || r.stdout}`); return r.stdout; }
function inside(dir,target){const rel=path.relative(fs.realpathSync(dir),path.resolve(target));if(!rel || rel.startsWith('..') || path.isAbsolute(rel))throw new Error('Unsafe temp target');}
const tmp = fs.mkdtempSync(path.join(os.tmpdir(),'soilfer-independent-removal08-'));
evidence.tempDirectory=tmp;
let server, browser;
(async()=>{
 const archive=path.join(tmp,'client.zip');
 command('git',['archive','--format=zip',`--output=${archive}`,candidate,'client','server/data/analysisDisplayNames.json','server/data/operationalChecklists.json'],repo);
 command('tar.exe',['-xf',archive,'-C',tmp],repo);
 const client=path.join(tmp,'client'), app=path.join(client,'src','App.jsx');
 let src=fs.readFileSync(app,'utf8');
 const imports=src.match(/^import TutorialGate from '\.\/tutorial\/TutorialGate';\r?\n/gm)||[];
 const mounts=src.match(/^\s*<TutorialGate \/>\r?\n/gm)||[];
 if(imports.length!==1 || mounts.length!==1)throw new Error('Unexpected tutorial integration shape');
 src=src.replace(/^import TutorialGate from '\.\/tutorial\/TutorialGate';\r?\n/m,'').replace(/^\s*<TutorialGate \/>\r?\n/m,'\n');
 fs.writeFileSync(app,src);
 const modulePath=path.join(client,'src','tutorial');inside(tmp,modulePath);fs.rmSync(modulePath,{recursive:true});
 fs.symlinkSync(path.join(repo,'client','node_modules'),path.join(client,'node_modules'),'junction');
 evidence.removal={importCountRemoved:imports.length,mountCountRemoved:mounts.length,moduleExists:fs.existsSync(modulePath),remainingTutorialReferencesInApp:src.includes('TutorialGate'),retainedInertPageAnchors:true};
 const buildLog=command(process.execPath,[path.join(client,'node_modules','vite','bin','vite.js'),'build'],client);
 fs.writeFileSync(path.join(tmp,'build.log'),buildLog);evidence.build={exitCode:0,log:path.join(tmp,'build.log')};
 const dist=path.join(client,'dist'), files=new Map();
 function collect(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())collect(p);else files.set('/'+path.relative(dist,p).replaceAll('\\','/'),fs.readFileSync(p));}}collect(dist);
 evidence.build.indexSHA256=createHash('sha256').update(files.get('/index.html')).digest('hex');
 evidence.build.tutorialAssets=[...files.keys()].filter(k=>/tutorial/i.test(k));
 const mime={'.js':'text/javascript','.css':'text/css','.html':'text/html','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml'};
 server=http.createServer((req,res)=>{const pathname=new URL(req.url,'http://127.0.0.1').pathname;const k=files.has(pathname)?pathname:'/index.html';res.writeHead(200,{'Content-Type':mime[path.extname(k)]||'application/octet-stream'});res.end(files.get(k));});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
 evidence.servedDist=dist;evidence.servedOrigin=base;
 const user={id:'t22-synthetic-technician',username:'removal-check',name:'Removal Test Technician',role:'LAB_TECHNICIAN',labId:'T22-LAB',language:'en',mustChangePassword:false};
 const payloads={
  '/api/auth/me':user,
  '/api/public/i18n/bootstrap':{languages:[],translations:{},brandingDefaultLanguage:'en'},
  '/api/admin/settings':{}, '/api/config/analyses':[], '/api/notifications':[],
  '/api/workbench/queue':{groups:[],stats:{}}, '/api/workbench/v2/receipts':{receipts:[]},
  '/api/help/topics':{success:true,topics:[{id:'bench',name:'Bench work',title:'Bench work',description:'Synthetic help fixture'}]},
  '/api/help/articles':{success:true,articles:[{id:'bench-batch',title:'Synthetic: record a bench batch',summary:'Synthetic help fixture used only in this isolated browser.',topicId:'bench',roles:['all'],status:'PUBLISHED'}]},
  '/api/help/faqs':{success:true,faqs:[]}, '/api/help/context':{success:true,articles:[],blockers:[],availability:'AVAILABLE'}
 };
 browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 async function context(auth){const c=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'block'});await c.route('**/*',async r=>{const req=r.request(),u=new URL(req.url());if(u.origin!==base){evidence.blockedExternal.push(u.origin+u.pathname);return r.abort();}if(!['GET','HEAD'].includes(req.method())){evidence.blockedWrites.push({method:req.method(),path:u.pathname});return r.abort();}if(u.pathname.startsWith('/api/')){evidence.apiReads.push(u.pathname);return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(payloads[u.pathname]??[])});}return r.continue();});if(c.routeWebSocket)await c.routeWebSocket('**/*',ws=>ws.close());if(auth)await c.addInitScript(u=>{localStorage.setItem('user',JSON.stringify(u));localStorage.setItem('token','synthetic-removal-test-not-a-real-token');localStorage.setItem('locale','en');},user);return c;}
 const anonymous=await context(false),login=await anonymous.newPage();login.on('pageerror',e=>evidence.browserErrors.push({page:'login',message:e.message}));
 await login.goto(base+'/login?tutorialmode=true&tour=first-visit');await login.locator('#password').waitFor({state:'visible'});
 evidence.checks.login={route:new URL(login.url()).pathname,usernameVisible:await login.locator('#username').isVisible(),passwordVisible:await login.locator('#password').isVisible(),heading:await login.getByRole('heading',{level:2}).allTextContents(),guideCount:await login.locator('[data-sf-tutorial]').count(),authPostAttempted:false};
 await login.screenshot({path:path.join(__dirname,'independent-removal-review08-login.png')});await anonymous.close();
 const authenticated=await context(true),p=await authenticated.newPage();p.on('pageerror',e=>evidence.browserErrors.push({page:new URL(p.url()).pathname,message:e.message}));
 await p.goto(base+'/help');await p.getByRole('heading',{name:'At the bench',exact:true}).waitFor({state:'visible'});
 await p.getByText('Synthetic: record a bench batch',{exact:true}).first().waitFor({state:'visible'});
 evidence.checks.help={route:new URL(p.url()).pathname,heading:await p.getByRole('heading',{level:1}).allTextContents(),syntheticArticleVisible:await p.getByText('Synthetic: record a bench batch',{exact:true}).first().isVisible(),guideCount:await p.locator('[data-sf-tutorial]').count()};
 await p.screenshot({path:path.join(__dirname,'independent-removal-review08-help.png')});
 await p.goto(base+'/workbench?tutorialmode=true');await p.getByRole('heading',{name:'Technician Workbench',exact:true}).waitFor({state:'visible'});
 await p.getByText('Role: LAB_TECHNICIAN · Lab: T22-LAB',{exact:true}).waitFor({state:'visible'});
 evidence.checks.workbench={route:new URL(p.url()).pathname,heading:await p.getByRole('heading',{name:'Technician Workbench',exact:true}).innerText(),identityVisible:await p.getByText('Removal Test Technician',{exact:true}).first().isVisible(),roleAndLabVisible:await p.getByText('Role: LAB_TECHNICIAN · Lab: T22-LAB',{exact:true}).isVisible(),navigationVisible:await p.getByRole('navigation',{name:'Workbench navigation',exact:true}).isVisible(),queueFetched:evidence.apiReads.includes('/api/workbench/queue'),guideCount:await p.locator('[data-sf-tutorial]').count()};
 await p.screenshot({path:path.join(__dirname,'independent-removal-review08-workbench.png')});await authenticated.close();
 evidence.pass=evidence.build.tutorialAssets.length===0 && evidence.browserErrors.length===0 && evidence.blockedWrites.length===0 && evidence.checks.login.usernameVisible && evidence.checks.login.passwordVisible && evidence.checks.help.syntheticArticleVisible && evidence.checks.workbench.identityVisible && evidence.checks.workbench.queueFetched && evidence.checks.workbench.roleAndLabVisible;
 evidence.limitations=['Synthetic authenticated session plus mocked /api/auth/me verifies client identity rendering; real credential acceptance was intentionally not tested.','This focused removal check does not certify backend operations, all permissions, human usability or a production deployment.','Temporary directory intentionally retained; no original directory was deleted or moved.'];
})().catch(e=>{evidence.pass=false;evidence.error=e.stack;process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();if(server)await new Promise(r=>server.close(r));evidence.apiReads=[...new Set(evidence.apiReads)];fs.writeFileSync(path.join(__dirname,'independent-removal-review08.json'),JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence,null,2));});
