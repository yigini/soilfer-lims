// Read-only application audit: serves a snapshot of the existing built assets,
// mocks all API requests, never starts a backend or touches a database.
const fs = require('fs');
const path = require('path');
const http = require('http');
const { chromium } = require('C:/Users/yigin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const dist = path.resolve(__dirname, '../../client/dist');
const files = new Map();
function collect(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) collect(p);
    else files.set('/' + path.relative(dist, p).replaceAll('\\', '/'), fs.readFileSync(p));
  }
}
collect(dist);
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg' };
const results = { time: new Date().toISOString(), assets: [...files.keys()].filter(p => p.includes('Tutorial')), mode: 'Isolated local built client with mocked APIs; no live server or database' };
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  const key = files.has(url.pathname) ? url.pathname : '/index.html';
  res.writeHead(200, { 'Content-Type': types[path.extname(key)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  res.end(files.get(key));
});
(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  try {
    async function context() {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
      await ctx.route('**/*', route => {
        const u = new URL(route.request().url());
        if (u.origin !== base) return route.abort();
        if (u.pathname.startsWith('/api/')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ translations: {}, languages: [], enabledLocales: ['en','es','es-419','fr','pt'] }) });
        return route.continue();
      });
      return ctx;
    }
    const ctx = await context();
    const page = await ctx.newPage();
    const requested = [];
    page.on('request', r => { if (r.url().includes('Tutorial')) requested.push(r.url().replace(base, '')); });
    await page.goto(base + '/login');
    await page.locator('input[type="password"]').waitFor();
    await page.waitForTimeout(350);
    results.ordinaryVisit = { tutorialAssets: [...new Set(requested)], guideCount: await page.locator('[data-sf-tutorial]').count() };
    await page.goto(base + '/login?tutorialmode=true&lang=fr');
    await page.locator('#soilfer-tutorial-overlay').waitFor();
    results.french = { mixedEnglish: await page.locator('#soilfer-tutorial-overlay').innerText().then(s => s.match(/(Start here|One sample|What LIMS|Laboratory|Sample|result|project)/gi)?.slice(0,20)), rootRole: await page.locator('#soilfer-tutorial-overlay').getAttribute('role'), modal: await page.locator('#soilfer-tutorial-overlay').getAttribute('aria-modal') };
    const escapes = [];
    for (let i = 0; i < 65; i++) {
      await page.keyboard.press('Tab');
      const focused = await page.evaluate(() => {
        const el = document.activeElement;
        return { outside: !el.closest('[data-sf-tutorial]'), tag: el.tagName, type: el.getAttribute('type'), id: el.id, name: el.getAttribute('name'), text: (el.textContent || '').trim().slice(0,80), inert: !!el.closest('[inert]') };
      });
      if (focused.outside && focused.tag !== 'BODY') escapes.push({ tab: i + 1, ...focused });
    }
    results.keyboardEscapes = escapes;
    await page.goto(base + '/login');
    await page.waitForTimeout(650);
    results.unflaggedNewDocument = { guideCount: await page.locator('#soilfer-tutorial-overlay').count(), resumeCount: await page.locator('#resume').count() };
    await ctx.close();
    const failing = await context();
    await failing.route('**/TutorialEntry-*.js', route => route.abort('failed'));
    const failedPage = await failing.newPage();
    const errors = [];
    failedPage.on('pageerror', e => errors.push(e.message));
    await failedPage.goto(base + '/login');
    await failedPage.waitForTimeout(1600);
    results.blockedTutorialEntryOnOrdinaryLogin = { loginInputs: await failedPage.locator('input[type="password"]').count(), text: (await failedPage.locator('body').innerText()).slice(0,750), errors };
    await failing.close();
  } finally {
    await browser.close();
    await new Promise(r => server.close(r));
    fs.writeFileSync(path.join(__dirname, 'independent-browser-review.json'), JSON.stringify(results, null, 2));
    console.log(JSON.stringify(results, null, 2));
  }
})().catch(e => { console.error(e); process.exitCode = 1; server.close(); });
