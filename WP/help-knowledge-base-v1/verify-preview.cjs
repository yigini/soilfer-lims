// Meaningful preview checks only. These are not application/API/security tests.
const fs=require('fs'),path=require('path'),assert=require('assert');
const {pathToFileURL}=require('url');
const {chromium}=require('C:/Users/yigin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const page=await browser.newPage({viewport:{width:1124,height:900}}),errors=[],requests=[],checks=[],layouts=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});
 const expect=async(name,fn)=>{await fn();checks.push(name);};
 const scene=async v=>page.selectOption('[data-prop=scene]',v);
 const role=async v=>page.selectOption('[data-prop=role]',v);
 const shot=async name=>{await page.locator('#soilfer-help-study').screenshot({path:path.join(__dirname,'screenshots',name+'.png')});};
 fs.mkdirSync(path.join(__dirname,'screenshots'),{recursive:true});
 await page.goto(pathToFileURL(path.join(__dirname,'review-preview.html')).href);
 await expect('Useful initial Help Centre and embedded logo',async()=>{assert.match(await page.locator('h1').innerText(),/help at the lab/);assert(await page.locator('.hc-logo').evaluate(e=>e.complete&&e.naturalWidth>0));});
 await shot('01-help-centre');
 await expect('Technician does not see content editor',async()=>assert(!(await page.locator('#hc-sideeditor').isVisible())));
 await expect('Search finds the spectra guide by MIR synonym',async()=>{await page.locator('#hc-query').fill('MIR');await page.locator('#hc-query').press('Enter');assert(await page.locator('[data-article=bench-spectra]').isVisible());});
 await expect('Search with HTML is treated as text and has empty-state guidance',async()=>{await page.locator('#hc-query').fill('<img src=x onerror=alert(1)>');await page.locator('#hc-query').press('Enter');assert(await page.locator('.hc-empty').isVisible());assert.equal(await page.locator('#hc-content img').count(),0);});
 await scene('faq');
 await expect('Native FAQ disclosure and full guide share one answer',async()=>{const d=page.locator('details').first();await d.locator('summary').press('Enter');assert(await d.getAttribute('open')!==null);const id=await d.locator('[data-article]').getAttribute('data-article');const expected=JSON.parse(fs.readFileSync(path.join(__dirname,'content.en.json'),'utf8')).articles.find(a=>a.id===id).summary;assert((await d.innerText()).includes(expected));await shot('02-faq-expanded');await d.locator('[data-article]').click();assert.equal(await page.locator('.hc-lead').innerText(),expected);});
 await shot('03-article');
 await expect('Article feedback never claims it was sent',async()=>{await page.locator('[data-act=feedback-yes]').click();assert.match(await page.locator('#hc-status').innerText(),/does not send/);});
 await expect('Stable article link shown without sample ID/token',async()=>{await page.locator('[data-act=article-link]').click();assert.match(await page.locator('input[aria-label="Article link"]').inputValue(),/^https:\/\/lims\.yigini\.net\/help\/articles\/[a-z-]+$/);});
 await scene('context');
 await expect('Help open, article drill-down, related article, back and close preserve typed result',async()=>{
  await page.locator('[data-act=close-panel]').click();await page.locator('#hc-bench-value').fill('7.12');await page.locator('[data-act=open-panel]').first().click();await page.locator('[data-article=bench-blocked]').click();await page.locator('.hc-article [data-article]').first().click();await page.locator('[data-act=article-back]').click();assert(await page.locator('.hc-context').isVisible());await page.locator('[data-act=close-panel]').click();assert.equal(await page.locator('#hc-bench-value').inputValue(),'7.12');assert.equal(await page.evaluate(()=>document.activeElement.id),'hc-help-button');
 });
 await page.locator('[data-act=open-panel]').first().click();await shot('04-workbench-help');
 await scene('editor');
 await expect('Direct editor scene has a permission explanation for technician',async()=>assert.match(await page.locator('#hc-content').innerText(),/reserved for authorized editors/));
 await role('manager');
 await expect('Manager has only laboratory-local scope',async()=>assert.equal(await page.locator('#hc-editor-scope option').count(),1));
 await role('admin');await page.selectOption('#hc-editor-scope','global');
 await expect('Administrator can save a draft and request review; publication stays unavailable',async()=>{await page.locator('#hc-edit-body').fill('Verify the preparation requirement shown for the assigned method.');await page.locator('[data-act=editor-save]').click();assert.match(await page.locator('#hc-status').innerText(),/No published article was changed/);await page.locator('[data-act=editor-review]').click();assert(await page.locator('[data-act=editor-publish]').isDisabled());assert(await page.locator('[data-act=editor-review]').isDisabled());});
 await expect('Editing reviewed draft permits a new review request',async()=>{await page.locator('#hc-edit-body').fill('Updated draft: verify the preparation requirement for this method.');assert(!(await page.locator('[data-act=editor-review]').isDisabled()));await page.locator('[data-act=editor-save]').click();});
 await shot('05-content-editor');
 await scene('article');await page.selectOption('[data-prop=locale]','fr');
 await expect('Unreviewed translated article has an explicit English fallback notice',async()=>assert.match(await page.locator('.hc-notice').first().innerText(),/anglais/));
 await page.selectOption('[data-prop=locale]','en');await scene('home');
 await page.locator('[data-view=support]').click();
 await expect('Support requires a description and never sends automatically',async()=>{await page.locator('[data-act=support-preview]').click();assert.match(await page.locator('#hc-status').innerText(),/description first/);await page.locator('#hc-support-text').fill('I need help understanding the submission state.');await page.locator('[data-act=support-preview]').click();assert.match(await page.locator('#hc-status').innerText(),/Nothing has been sent/);});
 for(const width of [320,390,736,1024])for(const theme of ['light','graphite'])for(const v of ['home','faq','article','context','editor']){
  await page.setViewportSize({width,height:900});await page.selectOption('[data-prop=theme]',theme);await scene(v);
  const size=await page.evaluate(()=>({w:innerWidth,scroll:document.documentElement.scrollWidth,placeholders:document.querySelectorAll('i[data-lucide]').length}));
  assert(size.scroll<=size.w,`Horizontal overflow: ${width} ${theme} ${v} ${JSON.stringify(size)}`);assert.equal(size.placeholders,0,'Unrendered icon');layouts.push({width,theme,scene:v,overflow:false});
 }
 await page.setViewportSize({width:390,height:900});await page.selectOption('[data-prop=theme]','light');await scene('home');await shot('06-mobile');
 await page.setViewportSize({width:1124,height:900});await page.selectOption('[data-prop=theme]','graphite');await scene('home');await shot('07-graphite');
 await expect('All five language controls render translated main headings',async()=>{for(const locale of ['en','es','es-419','fr','pt']){await page.selectOption('[data-prop=locale]',locale);const c=JSON.parse(fs.readFileSync(path.join(__dirname,'ui-copy.json'),'utf8'));assert.equal(await page.locator('h1').innerText(),c[locale].hero);}});
 assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
 fs.writeFileSync(path.join(__dirname,'preview-qa.json'),JSON.stringify({checkedAt:new Date().toISOString(),scope:'Isolated prototype only; not live LIMS, content approval, offline engine or production RBAC validation',checks,layouts,browserErrors:errors,networkRequests:requests,screenshots:7},null,2)+'\n');
 await browser.close();console.log(JSON.stringify({passed:checks.length,layouts:layouts.length,screenshots:7,errors:0,networkRequests:0}));
})().catch(e=>{console.error(e);process.exit(1);});
