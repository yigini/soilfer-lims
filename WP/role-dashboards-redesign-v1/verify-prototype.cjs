// Runs only the standalone synthetic prototype in an isolated temporary browser profile.
// Usage from repository root: node WP/role-dashboards-redesign-v1/verify-prototype.cjs
const fs=require('node:fs');const path=require('node:path');const {pathToFileURL}=require('node:url');const assert=require('node:assert/strict');
const puppeteer=require('../../scratch/node_modules/puppeteer-core');
(async()=>{
 const dir=__dirname;fs.mkdirSync(path.join(dir,'preview-checks'),{recursive:true});
 console.log('Opening an isolated preview browser');
 const browser=await puppeteer.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--disable-gpu'],timeout:30000});
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
 console.log('Loading prototype');
 await page.setViewport({width:1440,height:1000});await page.goto(pathToFileURL(path.join(dir,'prototype.html')).href,{waitUntil:'domcontentloaded'});await page.waitForSelector('[data-row]');
 const keys=await page.evaluate(()=>Object.keys(window.dashboardPrototype.roles));assert.equal(keys.length,10);let interactions=0;
 for(const role of keys){console.log('Checking '+role);await page.select('#role',role);assert.ok(await page.$eval('h1',e=>e.textContent.trim()));
   const lanes=await page.$$eval('#lanes [data-lane]',els=>els.map(e=>e.dataset.lane));
   for(const lane of lanes){await page.click(`#lanes [data-lane="${lane}"]`);if(await page.$('[data-row]')){await page.click('[data-row]');assert.equal(await page.$eval('#detail',e=>e.open),true);await page.keyboard.press('Escape');assert.equal(await page.$eval('#detail',e=>e.open),false);}interactions++;}
   await page.click('#primary');assert.equal(await page.$eval('#detail',e=>e.open),true);await page.click('#done');
   await page.select('#scenario','empty');assert.equal(await page.$eval('#row-count',e=>e.textContent.startsWith('0')),true);
   await page.select('#scenario','error');assert.match(await page.$eval('#row-count',e=>e.textContent),/unavailable/);await page.click('#retry');
   await page.select('#scenario','stale');assert.match(await page.$eval('#notice',e=>e.textContent),/could not refresh/i);await page.select('#scenario','normal');
 }
 await page.select('#role','LAB_TECHNICIAN');await page.click('#lanes [data-lane="ready"]');await page.click('[data-row="0"]');assert.equal(await page.$$eval('.mini-table tbody tr',els=>els.length),40);await page.click('#done');
 await page.type('#search','spectroscopy');assert.equal(await page.$$eval('.queue-panel tbody tr',els=>els.length),1);await page.$eval('#search',e=>{e.value='';e.dispatchEvent(new Event('input'));});
 await page.select('#scenario','blocked');assert.equal(await page.evaluate(()=>window.dashboardPrototype.getState().currentLane),'waiting');await page.select('#scenario','normal');await page.click('#lanes [data-lane="ready"]');
 await page.screenshot({path:path.join(dir,'preview-checks','technician-desktop.png'),fullPage:true});
 await page.select('#role','LAB_MANAGER');await page.click('#lanes [data-lane="review"]');await page.screenshot({path:path.join(dir,'preview-checks','manager-desktop.png'),fullPage:true});
 await page.select('#role','SAMPLE_RECEPTION');await page.click('#lanes [data-lane="expected"]');await page.click('#next');assert.equal(await page.evaluate(()=>window.dashboardPrototype.getState().page),2);await page.click('#prev');
 await page.screenshot({path:path.join(dir,'preview-checks','reception-desktop.png'),fullPage:true});
 const layouts=[];for(const width of [1440,1024,390,320]){await page.setViewport({width,height:1000});for(const role of keys){await page.select('#role',role);const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth);assert.equal(overflow,false,`${role} at ${width} has page overflow`);layouts.push({role,width,pageOverflow:false});}}
 await page.setViewport({width:390,height:900});await page.select('#role','LAB_TECHNICIAN');await page.click('#lanes [data-lane="ready"]');await page.screenshot({path:path.join(dir,'preview-checks','technician-mobile.png'),fullPage:true});
 await page.setViewport({width:1440,height:1000});await page.click('#theme');await page.screenshot({path:path.join(dir,'preview-checks','technician-dark.png'),fullPage:true});
 assert.deepEqual(errors,[]);
 fs.writeFileSync(path.join(dir,'preview-checks','verification.json'),JSON.stringify({artifactOnly:true,checkedAt:new Date().toISOString(),roles:keys.length,queueInteractions:interactions,fortySampleDetail:true,search:true,pagination:true,errorEmptyStale:true,layouts,browserErrors:errors,limitations:['No production/application integration verified','No screen-reader or full accessibility certification','Prototype route previews are not implemented destination pages']},null,2));
 console.log(`Prototype checked: ${keys.length} roles, ${interactions} queue interactions, forty-sample detail, 40 role/viewport combinations, no browser errors.`);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
