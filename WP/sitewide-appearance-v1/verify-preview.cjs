// Validates this standalone design preview only; never connects to LIMS.
const fs=require('fs');
const path=require('path');
const {pathToFileURL}=require('url');
const {chromium}=require('C:/Users/yigin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const base=__dirname;
const palettes=JSON.parse(fs.readFileSync(path.join(base,'tokens.json'),'utf8'));
const luminance=hex=>{const c=hex.match(/[0-9a-f]{2}/gi).map(x=>parseInt(x,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);return .2126*c[0]+.7152*c[1]+.0722*c[2]};
const contrast=(a,b)=>{let x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)};
const pairs=[];
for(const name of ['light','dark']){
 const p=palettes[name];
 for(const bg of ['canvas','surface','raised','inset','hover','selected'])for(const fg of ['text','muted'])pairs.push({theme:name,foreground:fg,background:bg,ratio:+contrast(p[fg],p[bg]).toFixed(2),minimum:4.5});
 for(const [fg,bg] of [['onPrimary','primary'],['onPrimary','primaryHover'],['success','successBg'],['warning','warningBg'],['danger','dangerBg'],['info','infoBg'],['disabledText','disabledBg'],['link','surface'],['link','raised']])pairs.push({theme:name,foreground:fg,background:bg,ratio:+contrast(p[fg],p[bg]).toFixed(2),minimum:4.5});
 for(const bg of ['canvas','surface','raised','inset'])for(const fg of ['control','focus','chart1','chart2','chart3'])pairs.push({theme:name,foreground:fg,background:bg,ratio:+contrast(p[fg],p[bg]).toFixed(2),minimum:3});
}
fs.writeFileSync(path.join(base,'contrast-check.json'),JSON.stringify({note:'Opaque token pairs only. Future application requires composed-state contrast and accessibility testing.',pairs,failures:pairs.filter(p=>p.ratio<p.minimum)},null,2));
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const page=await browser.newPage({viewport:{width:1280,height:1000}});
 const errors=[];const requests=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url())});
 await page.goto(pathToFileURL(path.join(base,'appearance-preview.html')).href);
 const root=page.locator('#soilfer-appearance-preview');
 const checks=[];
 const assert=async(name,fn)=>{let pass=false,detail='';try{pass=await fn();}catch(e){detail=e.message}checks.push({name,pass,detail});if(!pass)throw new Error(name+' failed: '+detail)};
 const setTheme=async t=>{await page.locator('#sf-appearance').click();await page.locator('[data-set-theme="'+t+'"]').click()};
 await assert('Starts light',async()=>await root.getAttribute('data-appearance')==='light');
 await root.screenshot({path:path.join(base,'mockup-light-workbench.png')});
 const result=page.locator('[data-result="0"]');await result.fill('6.83');await setTheme('dark');
 await assert('Changing theme preserves draft input',async()=>await result.inputValue()==='6.83');
 await root.screenshot({path:path.join(base,'mockup-dark-workbench.png')});
 await page.locator('#sf-new-session').click();
 await assert('Temporary dark resets in a new demo session',async()=>await root.getAttribute('data-appearance')==='light');
 await page.locator('[data-page="profile"]').click();await page.locator('input[name="sf-default"][value="dark"]').check();
 await assert('Selecting profile radio does not retheme or save',async()=>await root.getAttribute('data-appearance')==='light');
 await page.locator('#sf-save-appearance').click();
 await assert('Explicit profile save changes appearance',async()=>await root.getAttribute('data-appearance')==='dark');
 await root.screenshot({path:path.join(base,'mockup-dark-profile.png')});
 await page.locator('#sf-new-session').click();
 await assert('Saved dark survives a new demo session',async()=>await root.getAttribute('data-appearance')==='dark');
 await setTheme('light');await page.locator('#sf-new-session').click();
 await assert('Temporary light does not replace saved dark',async()=>await root.getAttribute('data-appearance')==='dark');
 await page.locator('#sf-signout').click();
 await assert('Sign out clears appearance to anonymous light',async()=>await root.getAttribute('data-appearance')==='light');
 await page.locator('#sf-demo-login').click();
 await assert('Demo login applies saved preference',async()=>await root.getAttribute('data-appearance')==='dark');
 await page.locator('[data-page="components"]').click();await page.locator('[data-open-review]').click();
 await assert('Native review dialog opens',async()=>await page.locator('#sf-review-dialog').evaluate(el=>el.open));
 await page.screenshot({path:path.join(base,'mockup-dark-dialog.png'),fullPage:true});
 await page.keyboard.press('Escape');
 await assert('Escape closes review dialog',async()=>!(await page.locator('#sf-review-dialog').evaluate(el=>el.open)));
 const layouts=[];
 for(const width of [1280,1024,768,390,320]){
  await page.setViewportSize({width,height:1000});
  for(const appearance of ['light','dark']){
   await setTheme(appearance);
   for(const screen of ['workbench','sample','workflow','equipment','components','profile']){
    await page.locator('[data-page="'+screen+'"]').click();
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth);
    layouts.push({width,appearance,screen,horizontalPageOverflow:overflow});
   }
  }
 }
 await page.setViewportSize({width:390,height:1000});await setTheme('dark');await page.locator('[data-page="profile"]').click();await root.screenshot({path:path.join(base,'mockup-dark-mobile.png')});
 await page.setViewportSize({width:1024,height:1000});await page.locator('[data-page="workflow"]').click();await root.screenshot({path:path.join(base,'mockup-dark-workflow.png')});
 const report={scope:'Standalone mockup only; no application or backend tests performed',checks,layouts,consoleErrors:errors,networkRequests:requests,contrastFailures:pairs.filter(p=>p.ratio<p.minimum),pass:checks.every(x=>x.pass)&&layouts.every(x=>!x.horizontalPageOverflow)&&!errors.length&&!requests.length&&pairs.every(x=>x.ratio>=x.minimum)};
 fs.writeFileSync(path.join(base,'preview-qa.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify({pass:report.pass,interactionChecks:checks.length,layoutChecks:layouts.length,consoleErrors:errors,networkRequests:requests,contrastPairs:pairs.length,contrastFailures:report.contrastFailures,layoutFailures:layouts.filter(x=>x.horizontalPageOverflow)}));
 await browser.close();if(!report.pass)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});
