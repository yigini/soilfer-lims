// Design-preview checks only. This never opens or authenticates to LIMS.
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
let chromium;
for (const p of ['playwright', path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')]) {
  try { chromium = require(p).chromium; break; } catch {}
}
if (!chromium) throw new Error('Playwright runtime not found');
const assert = (v, m) => { if (!v) throw new Error(m); };
(async () => {
  const chrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
  const browser = await chromium.launch({ headless: true, ...(fs.existsSync(chrome) ? { executablePath: chrome } : {}) });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [], external = [], outcomes = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route(/^https?:/, r => { external.push(r.request().url()); return r.abort(); });
  await page.goto(pathToFileURL(path.join(__dirname, 'review-preview.html')).href);
  const captureDir = path.join(__dirname, 'preview-checks');
  fs.mkdirSync(captureDir, { recursive: true });
  assert(await page.locator('.chapter').count() === 12, 'Expected 12 review chapters');
  await page.screenshot({ path: path.join(captureDir, '01-welcome-desktop.png'), fullPage: true });
  assert((await page.locator('#page').textContent()).includes('Laboratory Information Management System'), 'LIMS not defined');
  for (const heading of ['A shared record for the laboratory.', 'One sample. Connected work.', 'Where should I go next?']) {
    assert(await page.locator('#coachTitle').textContent() === heading, 'Foundation progression mismatch');
    await page.locator('[data-answer="wrong"]').click();
    assert((await page.locator('#basicAnswer').textContent()).startsWith('Not quite.'), 'Missing beginner feedback');
    await page.locator('[data-answer="correct"]').click();
    assert((await page.locator('#basicAnswer').textContent()).startsWith('Correct.'), 'Missing correct answer');
    await page.locator('#next').click();
  }
  outcomes.push('Beginner purpose, connected-record model, navigation and three comprehension checks');
  await page.locator('[data-path="quick"]').click();
  await page.locator('#next').click();
  assert(await page.locator('#coachTitle').textContent() === 'Start with the right role.', 'Quick path did not start');
  await page.locator('[data-step="3"]').click();
  await page.locator('#mass').fill('-4');
  await page.locator('#practiceIntake').click();
  assert((await page.locator('#intakeStatus').getAttribute('class')).includes('error'), 'Invalid mass not flagged');
  await page.locator('#mass').fill('485,2');
  await page.locator('#practiceIntake').click();
  assert(!(await page.locator('#intakeStatus').getAttribute('class')).includes('error'), 'Comma mass not parsed');
  outcomes.push('Local intake validation and comma decimal');
  await page.locator('[data-step="4"]').click();
  assert(await page.locator('#verifyChecks').isDisabled(), 'Preparation prematurely enabled');
  for (let i = 0; i < 3; i++) await page.locator('#check' + i).check();
  await page.locator('#verifyChecks').click();
  assert((await page.locator('#prepStatus').textContent()).includes('No actual preparation record'), 'Missing practice qualification');
  outcomes.push('Preparation prerequisite and practice-only confirmation');
  await page.locator('[data-step="6"]').click();
  await page.locator('#texture0').fill('50');
  assert((await page.locator('#textureStatus').getAttribute('class')).includes('error'), 'Texture mismatch not flagged');
  await page.locator('#texture0').fill('35');
  assert(await page.locator('#textureTotal').textContent() === '100.0%', 'Texture total wrong');
  outcomes.push('Texture bounds/closure interaction');
  await page.screenshot({ path: path.join(captureDir, '02-texture-desktop.png'), fullPage: true });
  await page.locator('[data-step="7"]').click();
  await page.locator('#loadSpectrum').click();
  assert(await page.locator('.spectrum').count() === 1, 'Missing synthetic spectrum');
  outcomes.push('Local illustrative spectrum display');
  await page.locator('[data-step="8"]').click();
  assert(await page.locator('#returnPractice').isDisabled(), 'Return without reason enabled');
  await page.locator('#reason').fill('Verify the replicate discrepancy.');
  await page.locator('#returnPractice').click();
  assert((await page.locator('#reviewStatus').textContent()).includes('Verify the replicate discrepancy.'), 'Return reason not shown');
  outcomes.push('Reason required and echoed in local review handover');
  await page.screenshot({ path: path.join(captureDir, '03-review-desktop.png'), fullPage: true });
  for (const width of [1440, 1280, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    for (const n of [0, 3, 4, 5, 6, 7, 8, 10, 11]) {
      await page.locator(`[data-step="${n}"]`).click();
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `Page overflow at ${width}px, scene ${n}`);
      assert(await page.locator('#next').isVisible(), 'Next missing');
    }
  }
  outcomes.push('No page overflow at 1440/1280/768/390/320 px across nine scenes');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('[data-step="4"]').click();
  await page.screenshot({ path: path.join(captureDir, '04-preparation-mobile.png'), fullPage: true });
  await page.keyboard.press('Escape');
  assert(await page.locator('#resume').isVisible(), 'Escape did not pause');
  await page.locator('#resume').click();
  assert(await page.locator('#coachTitle').textContent() === 'Preparation is evidence.', 'Resume lost place');
  await page.locator('#exit').click();
  assert(await page.locator('#layout').isHidden(), 'Exit did not close preview guide');
  await page.locator('#resume').click();
  assert(await page.locator('#coachTitle').textContent() === 'A shared record for the laboratory.', 'Restart failed');
  outcomes.push('Pause/Escape/resume/exit/restart');
  assert(errors.length === 0, 'Browser errors: ' + errors.join('; '));
  assert(external.length === 0, 'Unexpected external request: ' + external.join('; '));
  const report = { checkedAt: new Date().toISOString(), scope: 'Standalone mockup only; not LIMS production acceptance', outcomes, browserErrors: errors, externalRequests: external, deviceEvidence: 'Chromium emulation, not physical devices', status: 'PASS' };
  fs.writeFileSync(path.join(captureDir, 'verification.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
