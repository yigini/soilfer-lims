// Isolated browser checks of the local demonstration only. No LIMS URLs or accounts.
const { chromium } = require('C:/Users/yigin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('node:fs');
const path = require('node:path');
let auditBrowser;
(async()=>{
 const browser=auditBrowser=await chromium.launch({headless:true,channel:'chrome'});
 const page=await browser.newPage({viewport:{width:1056,height:1700}});
 const errors=[]; page.on('pageerror',e=>errors.push(e.message));
 const results=[];
 function check(name,condition){results.push({name,passed:!!condition});if(!condition)throw new Error(name);}
 await page.goto('file:///'+path.join(__dirname,'lab-operations-concept.html').replaceAll('\\','/'));
 const frame=page.frameLocator('iframe'); const loc=id=>frame.locator('#'+id);
 await loc('lo-build').click();
 check('Batch renders ten of forty positions',await loc('lo-rows').locator('tr').count()===10);
 await loc('lo-load').click(); await loc('lo-record').click();
 check('Pending QC blocks submission',await loc('lo-submit').isDisabled());
 await loc('lo-qc').selectOption('fail');check('Failed QC blocks submission',await loc('lo-submit').isDisabled());
 await loc('lo-qc').selectOption('pass');check('Passing QC enables recorded batch',await loc('lo-submit').isEnabled());
 await loc('lo-next').click();check('Stable second page positions',(await loc('lo-page-label').textContent()).includes('11–20'));
 await loc('lab-ops-v3').evaluate(el=>el.ownerDocument.defaultView.scrollTo(0,0));
 await page.screenshot({path:path.join(__dirname,'concept-batch.png'),fullPage:true});
 await loc('lo-submit').click();check('Submission has demo receipt',(await loc('lo-run-status').textContent()).includes('DEMO-R001'));
 await loc('lo-tab-texture').click();check('50/35/15 preview is Loam',(await loc('lo-class').textContent())==='Loam');
 await loc('lo-sand').fill('-5');await loc('lo-silt').fill('55');await loc('lo-clay').fill('50');check('Negative fraction blocks record',await loc('lo-texture-record').isDisabled());
 await loc('lo-sand').fill('');check('Blank fraction remains incomplete',(await loc('lo-total').textContent())==='Incomplete');
 await loc('lo-sand').fill('50');await loc('lo-silt').fill('35');await loc('lo-clay').fill('15');await loc('lo-texture-record').click();
 check('Projection contains class and version',(await loc('lo-class-report').textContent()).includes('Loam · calculated · result set version 1'));
 await page.screenshot({path:path.join(__dirname,'concept-texture.png'),fullPage:true});
 await loc('lo-amend').click();check('Correction has new version',(await loc('lo-texture-state').textContent()).includes('version 2'));
 await loc('lo-tab-prep').click();check('Pre-preparation values remain disabled',await loc('lo-locked-result').isDisabled());
 for(let i=0;i<2;i++){await loc('lo-prep-start').click();check('Missing evidence blocks phase '+i,await loc('lo-prep-finish').isDisabled());for(let n=1;n<=3;n++)await loc('lo-check'+n).check();await loc('lo-prep-finish').click();}
 check('Preparation unlocks method membership count',(await loc('lo-ready').textContent())==='44');
 await loc('lo-tab-orders').click();await loc('lo-order-texture').check();check('Texture adds one task',(await loc('lo-task-count').textContent())==='2 analytical tasks');
 await loc('lo-tab-dashboard').click();check('Manager defaults to review',(await loc('lo-dash-focus').textContent())==='Review submitted work');
 for(const role of ['LAB_TECHNICIAN','SAMPLE_RECEPTION','MASTER_USER','PROJECT_MANAGER','AUDIT_USER','EXTERNAL_VIEWER','VIEWER','SURVEYOR','SUPER_ADMIN','LAB_MANAGER']){await loc('lo-role').selectOption(role);check('Role view '+role,(await loc('lo-dash-lanes').locator('button').count())>0);}
 await page.screenshot({path:path.join(__dirname,'concept-manager.png'),fullPage:true});
 for(const width of [1056,768,392]){await page.setViewportSize({width,height:1150});for(const colorScheme of ['light','dark']){await page.emulateMedia({colorScheme});for(const tab of ['bench','prep','texture','orders','dashboard']){await loc('lo-tab-'+tab).click();const overflow=await loc('lab-ops-v3').evaluate(el=>el.scrollWidth>el.clientWidth+1);check(`${tab} ${width-32}px ${colorScheme} outer overflow`,!overflow);}if(width===392&&colorScheme==='dark')await page.screenshot({path:path.join(__dirname,'concept-mobile-dark.png'),fullPage:true});}}
 check('No browser script errors',errors.length===0);
 fs.writeFileSync(path.join(__dirname,'concept-check-results.json'),JSON.stringify({scope:'Local demonstration only; not production acceptance',checks:results,errors},null,2));
 console.log(JSON.stringify({passed:results.length,errors}));await browser.close();
})().catch(async e=>{console.error(e);if(auditBrowser)await auditBrowser.close();process.exitCode=1;});
