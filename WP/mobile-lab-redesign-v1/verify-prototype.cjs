// Tests only the isolated mockup, not the deployed LIMS or real offline storage.
const fs=require('fs');
const path=require('path');
const assert=require('assert/strict');
const {pathToFileURL}=require('url');
const {chromium}=require('C:/Users/yigin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 const page=await browser.newPage({viewport:{width:390,height:1000},deviceScaleFactor:1});
 const errors=[],requests=[],checks=[],layouts=[],screenshots=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('request',r=>{if(!r.url().startsWith('file:'))requests.push(r.url())});
 const check=(name,condition)=>{assert.ok(condition,name);checks.push({name,passed:true})};
 const root=page.locator('#soilfer-mobile-study');
 const click=async s=>root.locator(s).first().click();
 const shot=async name=>{await root.locator('.ml-device').screenshot({path:path.join(__dirname,name+'.png')});screenshots.push(name+'.png')};
 try{
 await page.goto(pathToFileURL(path.join(__dirname,'review-preview.html')).href);
 await page.getByRole('heading',{name:'Your bench, ready.'}).waitFor();
 await shot('mockup-phone-home');
 await click('[data-act="run"]');
 await click('[data-act="save-next"]');
 check('Empty result is rejected',(await root.textContent()).includes('Enter a pH value'));
 await root.locator('#ml-ph').fill('6.42');await click('[data-act="save-next"]');
 check('Save advances to S002 and labels local draft',(await root.textContent()).includes('2 of 40')&&(await root.textContent()).includes('S001 · Draft saved on device'));
 await click('[data-act="prev"]');check('Previous sample preserves draft',await root.locator('#ml-ph').inputValue()==='6.42');
 await click('[data-go="run-sample"]');check('Sample detail matches current run item',await root.locator('h1').textContent()==='S001');
 await click('[data-go="run"]');await shot('mockup-phone-entry');
 await page.locator('[data-prop="format"]').selectOption('tablet');await page.setViewportSize({width:820,height:1100});
 await shot('mockup-tablet-run');check('Tablet exposes run list',await root.locator('.ml-tablet-list').isVisible());
 await page.locator('[data-prop="format"]').selectOption('phone');await page.setViewportSize({width:390,height:1000});
 await click('[data-go="work"]');await click('[data-go="texture"]');
 for(const [i,v] of ['49','30','20'].entries())await root.locator('[data-texture="'+i+'"]').fill(v);
 await click('[data-act="save-texture"]');check('Invalid texture sum is blocked',(await root.textContent()).includes('total must be 100%'));
 await root.locator('[data-texture="0"]').fill('50');await click('[data-act="save-texture"]');
 check('Texture is saved as one panel',(await root.textContent()).includes('Panel saved on device'));
 await click('[data-go="work"]');await click('[data-go="prep"]');await click('[data-act="confirm-prep"]');
 check('Preparation requires all checklist items',(await root.textContent()).includes('Confirm all three checks'));
 for(let i=0;i<3;i++)await root.locator('[data-check="'+i+'"]').check();
 await click('[data-act="confirm-prep"]');await click('[data-go="sample"]');
 check('Preparation does not bypass independent verification',(await root.textContent()).includes('Blocked by preparation verification'));
 await click('[data-act="open-prep"]');check('Preparation confirmation survives navigation',await root.locator('[data-act="confirm-prep"]').isDisabled());
 await click('[data-go="work"]');await click('[data-go="drying"]');
 for(let i=0;i<3;i++)await root.locator('[data-dry-check="'+i+'"]').check();
 await click('[data-act="confirm-drying"]');check('Drying has checklist confirmation',await root.locator('[data-act="confirm-drying"]').isDisabled());
 await click('[data-go="scan"]');await root.locator('#ml-scan').fill('https://untrusted.example/');await click('[data-act="scan-open"]');
 check('Scan cannot navigate to arbitrary URL',(await root.textContent()).includes('No external link is opened'));
 await click('[data-act="scan-demo"]');await click('[data-act="scan-open"]');check('Manual sample lookup opens the expected record',await root.locator('h1').textContent()==='S045');
 await click('[data-go="sync"]');await shot('mockup-phone-sync');
 await page.locator('[data-prop="online"]').check();await click('[data-act="sync-now"]');
 check('Simulated sync preserves conflict',(await root.textContent()).includes('Needs attention'));
 await click('[data-go="conflict"]');await click('[data-act="conflict-review"]');
 check('Conflict review needs a reason',(await root.textContent()).includes('Add a reason'));
 await root.locator('#ml-conflict-note').fill('Please compare the instrument notebook.');
 await page.locator('[data-prop="theme"]').selectOption('graphite');
 check('Review note survives appearance change',await root.locator('#ml-conflict-note').inputValue()==='Please compare the instrument notebook.');
 await shot('mockup-phone-conflict-graphite');await click('[data-act="conflict-review"]');
 check('Review request retains previous conflict without claiming accepted result',(await root.textContent()).includes('Retained for review')&&(await root.textContent()).includes('Conflict review request'));
 await page.locator('[data-prop="theme"]').selectOption('light');await page.locator('[data-prop="online"]').uncheck();
 await page.locator('[data-prop="role"]').selectOption('reception');
 check('Role preview does not show another account queue',(await root.locator('#ml-sync-label').textContent()).includes('0 waiting'));
 await shot('mockup-phone-reception');await click('[data-act="intake-start"]');await click('[data-act="intake-next"]');await click('[data-act="intake-next"]');
 check('Reception condition checks cannot be skipped',(await root.textContent()).includes('Confirm identity and condition'));
 for(let i=0;i<2;i++)await root.locator('[data-intake-check="'+i+'"]').check();
 await click('[data-act="intake-next"]');await click('[data-act="intake-next"]');await click('[data-act="intake-next"]');
 check('Offline receipt has provisional identity',(await root.textContent()).includes('DEVICE-017')&&(await root.textContent()).includes('Official accession'));
 await page.locator('[data-prop="role"]').selectOption('manager');await click('[data-act="manager-review"]');
 check('Manager approval is disabled offline',await root.locator('[data-act="approve-review"]').isDisabled());
 await root.locator('#ml-review-note').fill('QC and preparation evidence reviewed.');await click('[data-act="review-note"]');
 await page.locator('[data-prop="online"]').check();check('Manager review note survives reconnect',await root.locator('#ml-review-note').inputValue()==='QC and preparation evidence reviewed.');await shot('mockup-phone-manager');
 await click('[data-act="approve-review"]');check('Online simulated review is explicit',(await root.textContent()).includes('No real result was approved'));
 await page.locator('[data-prop="role"]').selectOption('technician');await click('[data-go="samples"]');await click('[data-go="review"]');
 check('Technician result view exposes no manager decision controls',await root.locator('[data-act="approve-review"]').count()===0);
 // Reflow sweep of real local mockup screens, including the most demanding forms.
 for(const width of [320,390,768]){
  await page.setViewportSize({width,height:1100});
  for(const theme of ['light','graphite']){
   await page.locator('[data-prop="theme"]').selectOption(theme);
   for(const screen of ['home','work','samples','more','sync','run','texture','prep','drying','conflict']){
    if(['run','texture','prep','drying'].includes(screen)){await click('[data-go="work"]');await click('[data-go="'+screen+'"]');}
    else if(screen==='conflict'){await click('[data-go="sync"]');if(await root.locator('[data-go="conflict"]').count())await click('[data-go="conflict"]');else continue;}
    else await click('[data-go="'+screen+'"]');
    const size=await root.evaluate(el=>({w:el.clientWidth,scroll:el.scrollWidth,device:el.querySelector('.ml-device').getBoundingClientRect().width,unrenderedIcons:el.querySelectorAll('i[data-lucide]').length}));
    assert.ok(size.scroll<=size.w+1,'Horizontal overflow at '+width+' '+theme+' '+screen);
    assert.equal(size.unrenderedIcons,0,'Missing icon at '+screen);
    layouts.push({width,theme,screen,...size});
   }
  }
 }
 check('No script runtime errors',errors.length===0);check('No network requests',requests.length===0);
 fs.writeFileSync(path.join(__dirname,'prototype-qa.json'),JSON.stringify({testedAt:new Date().toISOString(),scope:'Isolated HTML design study only; no real device/offline/backend certification',checks,layouts,errors,networkRequests:requests,screenshots},null,2));
 console.log(JSON.stringify({passed:checks.length,layoutCases:layouts.length,errors,screenshots:screenshots.length}));
 }catch(e){fs.writeFileSync(path.join(__dirname,'prototype-qa-failure.json'),JSON.stringify({error:e.stack,errors,checks},null,2));throw e;}finally{await browser.close()}
})();
