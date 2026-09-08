// Tests the offline visual concept only. No real LIMS requests or actions.
const fs=require('fs');
const path=require('path');
const {pathToFileURL}=require('url');
const {chromium}=require('C:/Users/yigin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:1040}});
 const errors=[],requests=[],checks=[],layouts=[],contrast=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url())});
 // Test double for the design helper, supplied by the conversation host in use.
 await page.addInitScript(()=>{window.previewTweaks=[];window.Tweak=class{constructor(o){this.opts=o;window.previewTweaks.push(this)}addSelect(object,key,opts){this[key]={object,key,opts}}}});
 await page.goto(pathToFileURL(path.join(__dirname,'review-preview.html')).href);
 const root=page.locator('#soilfer-identity');
 const setDesign=async(treatment,appearance)=>page.evaluate(({treatment,appearance})=>{const t=window.previewTweaks[0];Object.assign(t.treatment.object,{treatment,appearance});t.opts.onChange()},{treatment,appearance});
 const scene=async(name)=>page.locator('.si-nav [data-page="'+name+'"]').click();
 const check=async(name,fn)=>{let pass=false,detail='';try{pass=await fn()}catch(e){detail=e.message}checks.push({name,pass,detail});if(!pass)throw Error(name+': '+detail)};
 await check('Light signature is the initial scene',async()=>await root.getAttribute('data-treatment')==='signature'&&await root.getAttribute('data-appearance')==='light');
 await page.locator('.si-metric[data-queue="ready"]').click();
 await check('Ready queue shows three method groups',async()=>await page.locator('[data-filter-row]').count()===3);
 await page.locator('[data-queue-search]').fill('conductivity');
 await check('Queue filter updates locally',async()=>await page.locator('[data-filter-row]:visible').count()===1);
 await page.locator('[data-queue-search]').fill('');
 await page.locator('.si-metric[data-queue="waiting"]').click();
 await check('Queue selection updates content',async()=>(await page.locator('.si-dashboard-table').innerText()).includes('Waiting for preparation'));
 await page.locator('.si-metric[data-queue="ready"]').click();
 await scene('workbench');
 await page.locator('[data-value="0"]').fill('6.55');
 await page.locator('[data-theme-toggle]').click();
 await setDesign('quiet','dark');
 await check('Visual changes preserve entered value',async()=>await page.locator('[data-value="0"]').inputValue()==='6.55');
 await check('Blocked demonstration row stays disabled',async()=>await page.locator('[data-value="4"]').isDisabled());
 await page.locator('[data-select-all]').check();
 await check('Selection excludes blocked row',async()=>await page.locator('[data-selection-count]').innerText()==='4');
 await page.locator('[data-value="0"]').press('Enter');
 await check('Enter advances to next editable result',async()=>await page.locator('[data-value="1"]').evaluate(e=>document.activeElement===e));
 await page.locator('button.si-sample-id[data-inspect="S005"]').click();
 await check('Inspector follows selected sample',async()=>(await page.locator('[data-inspector]').innerText()).includes('S005'));
 await page.locator('[data-inspector] [data-page="sample"]').click();
 await check('Sample identity follows inspector',async()=>(await page.locator('.si-record-identity h1').innerText())==='S005');
 await scene('workbench');
 await page.locator('button.si-sample-id[data-inspect="S004"]').click();
 await page.locator('[data-value="0"]').fill('6.42');
 await page.locator('[data-select-all]').uncheck();
 await page.locator('[data-preview="Batch & QC Runs"]').click();
 await check('Production action clearly remains preview-only',async()=>(await page.locator('.si-toast').innerText()).includes('No platform action'));
 await scene('dashboard');
 for(const treatment of ['signature','quiet'])for(const appearance of ['light','dark']){
  await setDesign(treatment,appearance);
  for(const screen of ['dashboard','workbench','sample']){
   await scene(screen);
   await root.screenshot({path:path.join(__dirname,`mockup-${treatment}-${appearance}-${screen}.png`)});
  }
  contrast.push(...await root.evaluate(el=>{
   const s=getComputedStyle(el),v=n=>s.getPropertyValue('--si-'+n).trim();
   const lum=c=>{const x=c.match(/[\da-f]{2}/gi).map(x=>parseInt(x,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);return .2126*x[0]+.7152*x[1]+.0722*x[2]};
   const pairs=[];
   for(const bg of ['canvas','surface','inset','select'])for(const fg of ['text','muted'])pairs.push([fg,bg]);
   pairs.push(['on-primary','primary'],['side-text','sidebar'],['side-muted','sidebar'],['side-text','side-active'],['earth','earth-bg'],['ochre','ochre-bg'],['blue','blue-bg'],['success','success-bg'],['warning','warning-bg']);
   return pairs.map(([fg,bg])=>{const x=lum(v(fg)),y=lum(v(bg));return {treatment:el.dataset.treatment,appearance:el.dataset.appearance,foreground:fg,background:bg,ratio:+((Math.max(x,y)+.05)/(Math.min(x,y)+.05)).toFixed(2)}})
  }));
 }
 for(const width of [1440,1024,768,390,320]){
  await page.setViewportSize({width,height:1000});
  for(const treatment of ['signature','quiet'])for(const appearance of ['light','dark']){
   await setDesign(treatment,appearance);
   for(const screen of ['dashboard','workbench','sample']){
    await scene(screen);
    const dimensions=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth}));
    layouts.push({width,treatment,appearance,screen,...dimensions,pass:dimensions.scroll<=dimensions.client});
   }
  }
 }
 await page.setViewportSize({width:390,height:1000});await setDesign('signature','light');await scene('workbench');
 await root.screenshot({path:path.join(__dirname,'mockup-signature-light-mobile.png')});
 const result={scope:'Offline mockup only; not application verification',checks,layouts,contrast,errors,networkRequests:requests,failures:[...checks.filter(x=>!x.pass),...layouts.filter(x=>!x.pass),...contrast.filter(x=>x.ratio<4.5)]};
 fs.writeFileSync(path.join(__dirname,'preview-qa.json'),JSON.stringify(result,null,2));
 console.log(JSON.stringify({checks:checks.length,layouts:layouts.length,contrastPairs:contrast.length,failures:result.failures,errors,networkRequests:requests}));
 await browser.close();if(errors.length||requests.length||result.failures.length)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});
