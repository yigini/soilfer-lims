'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const puppeteer=require('../../scratch/node_modules/puppeteer-core');
(async()=>{
const dir=__dirname,out=path.join(dir,'preview-checks');fs.mkdirSync(out,{recursive:true});
const story=JSON.parse(fs.readFileSync(path.join(dir,'storyboard.json'),'utf8'));
assert.equal(story.steps.length,12);assert.equal(story.steps.reduce((a,s)=>a+s.seconds,0),180);
const browser=await puppeteer.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--disable-gpu'],timeout:30000});const page=await browser.newPage(),errors=[],network=[],layouts=[];
page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))network.push(r.url());});
try{
 await page.goto(pathToFileURL(path.join(dir,'preview.html')).href);
 for(const theme of ['light','dark']){
  await page.emulateMediaFeatures([{name:'prefers-color-scheme',value:theme}]);
  for(const width of [1440,1024,736,390,320]){
   await page.setViewport({width,height:1100});
   for(let i=0;i<12;i++){
    await page.select('#sd-scene',String(i));await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
    const measure=await page.evaluate(()=>{const r=document.getElementById('soilfer-director-tour'),f=r.querySelector('.sd-highlight').getBoundingClientRect(),c=r.querySelector('#sd-coach').getBoundingClientRect();return {overflow:document.documentElement.scrollWidth>innerWidth,overlap:Math.min(f.right,c.right)>Math.max(f.left,c.left)&&Math.min(f.bottom,c.bottom)>Math.max(f.top,c.top),title:r.querySelector('#sd-title').textContent,target:r.querySelector('[data-tour-target]').dataset.tourTarget};});
    assert.equal(measure.overflow,false,`${theme}/${width}/${i} page overflow`);assert.equal(measure.overlap,false,`${theme}/${width}/${i} coach covers target`);assert.equal(measure.title,story.steps[i].title);assert.equal(measure.target,story.steps[i].anchor);layouts.push({theme,width,scene:story.steps[i].id,overflow:false,targetCovered:false});
   }
  }
 }
 await page.setViewport({width:1024,height:1000});await page.emulateMediaFeatures([{name:'prefers-color-scheme',value:'light'}]);await page.select('#sd-scene','0');
 for(const [scene,file] of [[0,'login-overlay'],[3,'five-intakes'],[4,'assignment-equipment-inventory'],[6,'analysis-bench'],[9,'workflow-map-report'],[10,'sis-preview']]){await page.select('#sd-scene',String(scene));await page.evaluate(()=>new Promise(r=>requestAnimationFrame(r)));await page.screenshot({path:path.join(out,file+'.png'),fullPage:true});}
 await page.select('#sd-scene','0');await page.click('#sd-play');await page.evaluate(()=>document.getElementById('soilfer-director-tour').tourPreview.advanceSeconds(180));
 let state=await page.evaluate(()=>document.getElementById('soilfer-director-tour').tourPreview.getState());assert.equal(state.ended,true);assert.equal(state.at,11);assert.equal(await page.$eval('#sd-clock',e=>e.textContent),'0:00');
 await page.click('#sd-play');await page.click('#sd-note-toggle');state=await page.evaluate(()=>document.getElementById('soilfer-director-tour').tourPreview.getState());assert.equal(state.playing,false);assert.equal(state.noteOpen,true);assert.match(await page.$eval('#sd-notes',e=>e.textContent),/multilingual/);
 await page.click('#sd-more-toggle');assert.equal(await page.$eval('#sd-more',e=>e.hidden),false);assert.match(await page.$eval('#sd-more',e=>e.textContent),/Inventory|inventory/);assert.match(await page.$eval('#sd-more',e=>e.textContent),/Português/);await page.click('#sd-close-more');
 await page.click('#sd-next');await page.click('#sd-prev');assert.equal(await page.$eval('#sd-scene',e=>e.value),'0');
 await page.select('#sd-scene','6');assert.equal(await page.$$eval('tbody tr',rows=>rows.length),5);
 await page.evaluate(()=>document.getElementById('soilfer-director-tour').tourPreview.setLayout('docked'));await page.evaluate(()=>new Promise(r=>requestAnimationFrame(r)));assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:path.join(out,'docked-guide.png'),fullPage:true});
 await page.evaluate(()=>document.getElementById('soilfer-director-tour').tourPreview.setLayout('spotlight'));await page.setViewport({width:390,height:1000});await page.select('#sd-scene','9');await page.screenshot({path:path.join(out,'workflow-mobile.png'),fullPage:true});
 await page.click('#sd-exit');assert.equal(await page.$eval('#sd-coach',e=>e.hidden),true);assert.equal(await page.$eval('#sd-veil',e=>e.hidden),true);
 assert.deepEqual(errors,[]);assert.deepEqual(network,[]);
 const words=story.steps.map(s=>s.say).join(' ').split(/\s+/).length;
 fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify({checkedAt:new Date().toISOString(),artifactOnly:true,durationSeconds:180,scenes:12,narrationWords:words,fiveSamples:true,checks:['all titles and scene anchors','120 theme/width/scene layouts','guide does not cover target','timed playback reaches 0:00','play/pause/restart','back/next/chapter navigation','notes pause timer','optional feature details','multilingual feature explanation','dock variant','exit clears overlay'],layouts,browserErrors:errors,httpRequests:network,limitations:['Mockup only; no actual laboratory processing or authentication.','No measured proof of live app readiness, actual external SIS delivery or translated tour strings.','Spectral curve and displayed results are synthetic.','Timed playback was checked by advancing the same local timer function; live-route latency still requires rehearsal.']},null,2));
 console.log(`Verified 12 scenes / 180 seconds, ${words} narration words, 120 responsive theme/scene checks, controls, five sample rows, no external requests.`);
}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
