'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
// Override for another workstation; no new package installation required here.
const modulePath=process.env.LAB_AUDIT_PLAYWRIGHT || 'C:/Users/yigin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright';
const {chromium}=require(modulePath);
const executablePath=process.env.LAB_AUDIT_BROWSER || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
async function main(){
 const browser=await chromium.launch({headless:true,executablePath});
 const page=await browser.newPage({viewport:{width:1440,height:1050}});const errors=[],network=[],checks=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))network.push(r.url());});
 await page.goto(pathToFileURL(path.join(__dirname,'review-preview.html')).href);
 const clickTab=async name=>page.locator('.tabs').getByRole('button',{name,exact:false}).click();
 const inspect=async(label)=>{const overflow=await page.evaluate(()=>({body:document.documentElement.scrollWidth,viewport:innerWidth}));assert.ok(overflow.body<=overflow.viewport+1,JSON.stringify({label,...overflow}));checks.push(label);};
 await page.screenshot({path:path.join(__dirname,'preview-desktop.png'),fullPage:true});
 for(const width of [1440,768,390,320]){
  await page.setViewportSize({width,height:1000});
  for(const name of ['Overview','People','Projects','Methods & resources','Settings','History']){await clickTab(name);await inspect(width+'px '+name);}
 }
 await page.setViewportSize({width:1440,height:1050});await clickTab('People');
 await page.getByRole('textbox',{name:'Search people'}).fill('Luis');
 assert.equal(await page.locator('tr[data-search]:visible').count(),1);checks.push('Search filters fictional people');
 await page.getByRole('textbox',{name:'Search people'}).fill('');
 await page.locator('button[data-person="luis"]').click();
 assert.equal(await page.getByRole('button',{name:'Apply access change',exact:true}).isEnabled(),false);
 await page.getByLabel('Reason for this change',{exact:true}).fill('Planned quality placement');
 await page.getByLabel('I have reviewed the scope').check();
 await page.getByRole('button',{name:'Preview stale change'}).click();
 assert.equal(await page.getByRole('button',{name:'Apply access change',exact:true}).isEnabled(),false);
 await page.getByRole('button',{name:'Reload current revision'}).click();
 await page.getByLabel('I have reviewed the scope').check();
 await page.locator('#modal-body').evaluate(el=>{el.scrollTop=0;});
 await page.screenshot({path:path.join(__dirname,'preview-access-review.png'),fullPage:false});
 await page.getByRole('button',{name:'Apply access change',exact:true}).click();
 assert.equal(await page.getByRole('dialog').count(),0);assert.ok(await page.getByText('Handover needed:',{exact:false}).isVisible());checks.push('Role change review, required fields, stale revision and handover');
 await page.getByRole('button',{name:'Preview connection error'}).click();assert.ok(await page.getByText('We could not load the team').isVisible());await page.getByRole('button',{name:'Try again'}).click();checks.push('Connection failure does not show empty roster');
 await page.getByRole('button',{name:'Invite a person',exact:false}).click();
 await page.getByLabel('Full name',{exact:true}).fill('Fixture Person');await page.getByLabel('Verified work email',{exact:true}).fill('fixture@example.org');
 await page.getByRole('button',{name:'Review invitation',exact:true}).click();await page.getByRole('button',{name:'Confirm preview invitation'}).click();assert.ok(await page.getByText('Invitation prepared for the fictional').isVisible());checks.push('Named invitation review without network writes');
 await page.getByRole('combobox',{name:'Preview role'}).selectOption('national');assert.equal(await page.getByRole('button',{name:'Invite a person',exact:false}).isEnabled(),false);checks.push('National view requires explicit staff delegation');
 await page.getByRole('combobox',{name:'Preview role'}).selectOption('admin');await clickTab('Settings');await page.getByRole('button',{name:'Review pause',exact:true}).click();
 assert.equal(await page.getByRole('button',{name:'Pause laboratory',exact:true}).isEnabled(),false);
 await page.getByLabel('Reason',{exact:true}).fill('Planned laboratory maintenance');await page.getByLabel('I have reviewed the work impact').check();
 await page.getByRole('button',{name:'Pause laboratory',exact:true}).click();assert.ok(await page.getByText('This laboratory is paused.',{exact:true}).isVisible());
 await page.getByRole('button',{name:'Review resume',exact:true}).click();assert.ok(await page.getByText('Jon’s disabled account will remain disabled.',{exact:false}).isVisible());
 await page.getByLabel('Reason',{exact:true}).fill('Maintenance finished');await page.getByLabel('I have reviewed the work impact').check();await page.getByRole('button',{name:'Resume laboratory',exact:true}).click();checks.push('Pause/resume impact review keeps account status separate');
 await clickTab('People');await page.getByRole('button',{name:'Switch preview theme'}).click();await page.waitForFunction(()=>document.querySelector('#toast').textContent==='');await page.screenshot({path:path.join(__dirname,'preview-dark.png'),fullPage:true});
 await page.setViewportSize({width:390,height:1000});await inspect('390px dark people');await page.screenshot({path:path.join(__dirname,'preview-mobile.png'),fullPage:true});
 await page.locator('button[data-person="luis"]').click();await inspect('390px access dialog');await page.keyboard.press('Escape');assert.equal(await page.getByRole('dialog').count(),0);checks.push('Native dialog keyboard Escape');
 assert.deepEqual(errors,[]);assert.deepEqual(network,[]);
 await browser.close();
 fs.writeFileSync(path.join(__dirname,'preview-qa.json'),JSON.stringify({executedAt:new Date().toISOString(),checks,errors,networkRequests:network,scope:'Local prototype behavior and page overflow only; not production UI, full WCAG, locale or real server tests.'},null,2)+'\n');
 console.log(JSON.stringify({checks:checks.length,errors,networkRequests:network.length}));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
