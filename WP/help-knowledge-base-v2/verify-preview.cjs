/* Tests only the file-based prototype. No LIMS requests or production operations. */
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {pathToFileURL}=require('url');
const {chromium}=require('C:/Users/yigin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const dir=__dirname,shots=path.join(dir,'screenshots');fs.mkdirSync(shots,{recursive:true});
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:1080}}),errors=[],network=[],checks=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))network.push(r.url())});
 const ok=(name)=>checks.push({name,status:'PASS'});
 const scene=async(name)=>page.selectOption('#scene',name);
 const screenshot=async(name,fullPage=false)=>{await page.evaluate(()=>document.querySelector('#toast').hidden=true);return page.screenshot({path:path.join(shots,name+'.png'),fullPage});};
 await page.goto(pathToFileURL(path.join(dir,'review-preview.html')).href);
 await page.getByRole('heading',{name:'At the bench',exact:true}).waitFor();
 await screenshot('01-role-home');ok('Technician home renders the batch task first.');
 const data=require('./04_CONTENT_INVENTORY.json');
 for(const r of data.roles){await page.selectOption('#role',r.id);const title=data.articles.find(g=>g.id===r.tasks[0]).title;assert(await page.locator('.feature h2').innerText()===title)}
 ok('All ten role homes have the specified first task; persona changes are local only.');
 await page.selectOption('#role','LAB_TECHNICIAN');
 for(const g of require('./guide-examples.json').guides){await page.evaluate(id=>openGuide(id),g.id);assert.equal(await page.locator('.article-head h1').innerText(),g.title);assert.equal(await page.locator('.step').count(),g.sections.reduce((n,s)=>n+s.steps.length,0));assert(await page.locator('#success').innerText());}
 ok('All eight full examples render every step, expected outcome and success section.');
 await page.evaluate(()=>openGuide('bench-batch'));await screenshot('02-batch-guide');
 await page.locator('#search').fill('MIR');await page.locator('#searchform').evaluate(form=>form.requestSubmit());
 assert(await page.locator('.result').count()>0);assert((await page.locator('.resultlist').innerText()).includes('spectra'));
 await page.locator('#search').fill('<script>nonexistent</script>');await page.locator('#searchform').evaluate(form=>form.requestSubmit());
 assert(await page.getByRole('heading',{name:'No exact match'}).count());ok('Search finds spectra synonyms; no-match input is safely rendered.');
 await page.getByRole('button',{name:'Browse all topics',exact:true}).click();assert.equal(await page.locator('.result').count(),data.count);ok('All commissioned briefs are browseable and distinguished from complete examples.');
 await scene('problem');await page.getByRole('button',{name:'My manager cannot see my results',exact:false}).click();await page.getByRole('button',{name:'Recorded determinations',exact:false}).click();assert(await page.getByRole('heading',{name:'The reviewer handoff is still needed'}).count());await screenshot('03-problem-solver');
 await page.getByRole('button',{name:'Start again',exact:true}).click();await page.getByRole('button',{name:'Preparation still looks incomplete',exact:false}).click();await page.getByRole('button',{name:'Yes, for this task and attempt',exact:false}).click();assert(await page.getByRole('heading',{name:'Keep the receipt; do not repeat completion'}).count());ok('Result and preparation recovery paths identify safe next actions.');
 await scene('context');await page.getByRole('textbox',{name:'DEMO-002 pH value'}).fill('5.91');await screenshot('04-context-help');
 await page.getByRole('button',{name:'See the exact controls'}).click();await page.getByRole('button',{name:'Back to page help'}).click();await page.getByRole('button',{name:'Close page help',exact:true}).click();assert.equal(await page.getByRole('textbox',{name:'DEMO-002 pH value'}).inputValue(),'5.91');await page.getByRole('button',{name:'Help on this page',exact:true}).click();assert.equal(await page.getByRole('textbox',{name:'DEMO-002 pH value'}).inputValue(),'5.91');ok('Opening, expanding and closing the help companion preserves worksheet input.');
 await scene('studio');await page.getByRole('tab',{name:'Translations',exact:true}).click();await page.locator('#translation').fill('Brouillon de vérification.');await page.getByRole('button',{name:'Check translation draft'}).click();assert((await page.locator('#toast').innerText()).includes('no publication'));await screenshot('05-translation-editor');await page.getByRole('tab',{name:'Coverage',exact:true}).click();await page.getByRole('tab',{name:'Translations',exact:true}).click();assert.equal(await page.locator('#translation').inputValue(),'Brouillon de vérification.');ok('Translation editing is local, persists during tab navigation and never claims publication.');
 for(const locale of ['en','es','es-419','fr','pt']){await page.selectOption('#language',locale);assert.equal(await page.locator('html').getAttribute('lang'),locale);if(locale!=='en')assert(await page.locator('.localization').count());}
 ok('All five navigation locales are selectable with an explicit full-body prototype limitation.');await page.selectOption('#language','en');
 const overflow=[];
 for(const width of [320,390,768,1024,1440])for(const theme of ['light','dark'])for(const name of ['home','guide','problem','context','library','learn','studio']){
  await page.setViewportSize({width,height:1000});await page.selectOption('#theme',theme);await scene(name);
  const dims=await page.evaluate(()=>({sw:document.documentElement.scrollWidth,w:innerWidth}));if(dims.sw>dims.w+1)overflow.push({width,theme,scene:name,...dims});
 }
 assert.deepEqual(overflow,[]);ok('All seven scenes fit 320/390/768/1024/1440 px in light and graphite themes.');
 await page.setViewportSize({width:390,height:844});await page.selectOption('#theme','light');await scene('home');await screenshot('06-mobile-home',true);
 await page.setViewportSize({width:1440,height:1080});await page.selectOption('#theme','dark');await scene('guide');await screenshot('07-graphite-guide');
 assert.deepEqual(errors,[]);assert.deepEqual(network,[]);ok('No JavaScript page errors and no HTTP(S) requests from the prototype.');
 const trace=require('./traceability.json');assert.equal(trace.routes.filter(r=>r.unresolved).length,0);assert(trace.contexts.every(c=>c.guideIds.every(id=>data.articles.some(a=>a.id===id))));ok('Every route has a proposed mapping or explicit institutional classification; context IDs resolve.');
 fs.writeFileSync(path.join(dir,'preview-qa.json'),JSON.stringify({runAt:new Date().toISOString(),scope:'Standalone design preview only. Does not validate or modify the actual LIMS.',result:'PASS',checks,screenshots:fs.readdirSync(shots),errors,network},null,2));
 await browser.close();console.log(JSON.stringify({result:'PASS',checks:checks.length,screenshots:shots}));
})().catch(e=>{console.error(e);process.exit(1)});
