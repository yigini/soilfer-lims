'use strict';
// Isolated local-file browser. No live LIMS or user browser profile.
const path=require('node:path'),fs=require('node:fs'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const puppeteer=require('../../scratch/node_modules/puppeteer-core');
(async()=>{
 const out=path.join(__dirname,'preview-checks');fs.mkdirSync(out,{recursive:true});
 const browser=await puppeteer.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--disable-gpu'],timeout:30000});
 const page=await browser.newPage(),errors=[],network=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))network.push(r.url());});
 try{
  await page.setViewport({width:1440,height:1000});await page.goto(pathToFileURL(path.join(__dirname,'prototype.html')).href);
  assert.equal(await page.$eval('#confirm',e=>e.disabled),true);
  for(let i=0;i<3;i++)await page.click(`[data-check="${i}"]`);
  await page.screenshot({path:path.join(out,'preparation-checklist.png'),fullPage:true});
  await page.click('#confirm');assert.equal(await page.evaluate(()=>workPrototype.getState().prep),'done');
  await page.click('[data-view="sample"]');assert.equal(await page.$$eval('main input',e=>e.length),0);
  assert.match(await page.$eval('main',e=>e.textContent),/3 of 3 checks confirmed/);
  await page.screenshot({path:path.join(out,'sample-evidence.png'),fullPage:true});
  await page.click('#evidence');assert.equal(await page.$eval('#details',e=>e.open),true);await page.keyboard.press('Escape');
  await page.click('#open-workbench');await page.click('#next-method');await page.click('#demo-readings');
  assert.equal(await page.$$eval('tbody tr',e=>e.length),40);
  await page.$eval('[data-value="39"]',e=>{e.value='-1';e.dispatchEvent(new Event('change',{bubbles:true}));});
  await page.screenshot({path:path.join(out,'forty-sample-worksheet.png'),fullPage:true});
  await page.click('#record');assert.equal(await page.evaluate(()=>workPrototype.getState().resultStates.filter(x=>x==='recorded').length),39);
  assert.equal(await page.evaluate(()=>workPrototype.getState().resultStates[39]),'draft');
  await page.click('[data-lane="work"]');await page.click('[data-lane="submit"]');assert.match(await page.$eval('#send',e=>e.textContent),/39/);
  await page.click('#send');assert.equal(await page.evaluate(()=>workPrototype.getState().resultStates.filter(x=>x==='submitted').length),39);
  await page.click('#reload-view');assert.match(await page.$eval('main',e=>e.textContent),/39 awaiting scientific review/);
  await page.click('[data-view="manager"]');await page.click('#accept');await page.click('[data-view="sample"]');
  assert.match(await page.$eval('main',e=>e.textContent),/Accepted/);assert.equal(await page.$$eval('main input',e=>e.length),0);
  const layouts=[];for(const width of [1440,1024,390,320]){await page.setViewport({width,height:1000});for(const view of ['bench','sample','manager']){await page.click(`[data-view="${view}"]`);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${view} overflow at ${width}`);layouts.push({width,view,overflow:false});}}
  await page.select('#scenario','gap');assert.equal(await page.$eval('#confirm',e=>e.disabled),true);await page.click('#recover');assert.equal(await page.$eval('#details',e=>e.open),true);await page.keyboard.press('Escape');
  await page.select('#method','ph');assert.equal(await page.$eval('#record',e=>e.disabled),true);
  assert.equal(await page.$$eval('tbody input[type="number"]:disabled',e=>e.length),40);
  await page.click('[data-view="sample"]');await page.screenshot({path:path.join(out,'sample-gap-mobile.png'),fullPage:true});
  await page.setViewport({width:1440,height:1000});await page.click('[data-view="manager"]');await page.screenshot({path:path.join(out,'manager-exception.png'),fullPage:true});
  assert.deepEqual(errors,[]);assert.deepEqual(network,[]);
  fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify({checkedAt:new Date().toISOString(),artifactOnly:true,checks:['three-step confirmation','same evidence on Sample','Sample contains no result inputs','40 worksheet rows','39 valid recorded, invalid row retained','recorded queue independently reachable in demo','exact 39 submission','manager accepts only submitted demo results','legacy gap blocks entry','dialogs and Escape'],layouts,browserErrors:errors,httpRequests:network,limitations:['Synthetic in-memory sketch only; browser reload resets demo.','No live application, persistence, auth, real instrument, transaction or database proof.','No claim of full accessibility certification.']},null,2));
  console.log('Prototype interactions, 40 rows, 12 viewport/view checks, gap handling and zero external requests verified.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
