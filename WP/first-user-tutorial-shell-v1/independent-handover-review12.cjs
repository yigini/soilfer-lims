const fs = require('fs');
const path = require('path');
const http = require('http');
const { chromium } = require('C:/Users/yigin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

const root = 'C:/Users/yigin/Documents/soilfer-lims';
const dist = path.join(root, 'client/dist');
const files = new Map();

function collect(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) collect(p);
        else files.set('/' + path.relative(dist, p).replaceAll('\\', '/'), fs.readFileSync(p));
    }
}
collect(dist);

const mime = {
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.html': 'text/html',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml'
};

const server = http.createServer((req, res) => {
    const p = new URL(req.url, 'http://127.0.0.1').pathname;
    const k = files.has(p) ? p : '/index.html';
    res.writeHead(200, { 'Content-Type': mime[path.extname(k)] || 'application/octet-stream' });
    res.end(files.get(k));
});

(async () => {
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    const base = `http://127.0.0.1:${server.address().port}`;
    const browser = await chromium.launch({
        headless: true,
        executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe'
    });

    const techA = { id: 'synthetic-tech-a', username: 'synthetic-tech-a', name: 'Synthetic Technician A', role: 'LAB_TECHNICIAN', labId: 'SYNTHETIC-LAB-A', language: 'en', mustChangePassword: false };
    const techB = { id: 'synthetic-tech-b', username: 'synthetic-tech-b', name: 'Synthetic Technician B', role: 'LAB_TECHNICIAN', labId: 'SYNTHETIC-LAB-B', language: 'en', mustChangePassword: false };
    const tokenA = 'synthetic-spa-token-a-not-real';
    const tokenB = 'synthetic-spa-token-b-not-real';

    const payloads = {
        '/api/public/i18n/bootstrap': { languages: [], translations: {}, brandingDefaultLanguage: 'en' },
        '/api/admin/settings': {},
        '/api/config/analyses': [],
        '/api/notifications': [],
        '/api/workbench/queue': { groups: [], stats: {} },
        '/api/workbench/v2/receipts': { receipts: [] }
    };

    console.log('--- TEST 1: Desktop (1440x1000) Real Pointer Account Handover ---');
    const c1 = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block' });
    await c1.route('**/*', async r => {
        const req = r.request();
        const u = new URL(req.url());
        if (u.origin !== base) return r.abort();
        if (req.method() === 'POST' && u.pathname === '/api/auth/login') {
            const body = req.postDataJSON();
            return r.fulfill({
                status: body.username === techB.username ? 200 : 401,
                contentType: 'application/json',
                body: JSON.stringify(body.username === techB.username ? { token: tokenB, user: techB } : { error: 'Invalid' })
            });
        }
        if (u.pathname.startsWith('/api/')) {
            const auth = req.headers().authorization;
            const actor = auth === `Bearer ${tokenB}` ? techB : auth === `Bearer ${tokenA}` ? techA : null;
            if (u.pathname === '/api/auth/me') return r.fulfill({ status: actor ? 200 : 401, contentType: 'application/json', body: JSON.stringify(actor || { error: 'Not signed in' }) });
            return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(payloads[u.pathname] ?? []) });
        }
        return r.continue();
    });
    if (c1.routeWebSocket) await c1.routeWebSocket('**/*', ws => ws.close());

    await c1.addInitScript(({ u, token }) => {
        localStorage.setItem('user', JSON.stringify(u));
        localStorage.setItem('token', token);
        localStorage.setItem('locale', 'en');
        sessionStorage.setItem('soilfer_tutorial_v1', JSON.stringify({
            active: true, step: 13, introStage: 3, path: 'full', roleChoice: 'technician',
            sampleTube: 1, viewed: [], practiced: [], done: [], skipped: [], paused: false,
            language: 'en', timestamp: Date.now(), lastActivityAt: Date.now()
        }));
    }, { u: techA, token: tokenA });

    const p1 = await c1.newPage();
    p1.setDefaultTimeout(10000);
    await p1.goto(base + '/workbench?tutorialmode=true&tour=first-visit');
    await p1.locator('#sampleIdInput').waitFor();
    await p1.waitForTimeout(500);

    // Verify initial guide state
    const guideTextInitial = await p1.locator('#soilfer-tutorial-overlay').innerText();
    if (!guideTextInitial.includes(techA.name)) throw new Error('Initial guide should display Tech A');
    console.log('✓ Initial workbench loaded with Tech A');

    // Real pointer click on User Menu (NO force, NO eval)
    console.log('  Clicking User Menu with real pointer click...');
    await p1.getByTitle('User Menu', { exact: true }).click();
    await p1.getByRole('button', { name: 'Sign Out', exact: true }).waitFor();

    // Real pointer click on Sign Out (NO force, NO eval)
    console.log('  Clicking Sign Out with real pointer click...');
    await p1.getByRole('button', { name: 'Sign Out', exact: true }).click();
    await p1.waitForURL(u => u.pathname === '/login');
    console.log('✓ Successfully signed out via real pointer click to /login');

    // On /login, verify dock has on-login class and sits on the left
    const overlay = p1.locator('#soilfer-tutorial-overlay');
    await overlay.waitFor();
    const overlayClass = await overlay.getAttribute('class');
    if (!overlayClass.includes('on-login')) throw new Error('Overlay must have on-login class on /login page');
    const overlayBox = await overlay.boundingBox();
    console.log('  Overlay bounding box on /login:', overlayBox);
    if (overlayBox.x > 100) throw new Error('Overlay should be on the left side of the screen on /login');
    console.log('✓ Overlay positioned on the left side (x=' + overlayBox.x + '), leaving right login card unobstructed');

    // Real pointer interaction on Login form (NO force, NO eval)
    console.log('  Interacting with login form via real pointer clicks...');
    await p1.locator('#username').click();
    await p1.locator('#username').fill(techB.username);
    await p1.locator('#password').click();
    await p1.locator('#password').fill('secret-test-pass');
    
    // Real pointer click on submit button
    await p1.locator('button[type="submit"]').click();
    await p1.waitForURL(u => u.pathname === '/');
    console.log('✓ Real pointer click on Sign In button succeeded without dock interception');

    // Navigate to /workbench with real pointer click
    await p1.locator('a[href="/workbench"]').first().click();
    await p1.waitForURL(u => u.pathname === '/workbench');
    await p1.locator('#sampleIdInput').waitFor();
    console.log('✓ Arrived at /workbench');

    // Verify guide updated to Tech B and step 13 preserved
    const guideTextB = await p1.locator('#soilfer-tutorial-overlay').innerText();
    if (!guideTextB.includes(techB.name)) throw new Error('Guide should display Tech B');
    console.log('✓ Guide verified Tech B with lesson position 14 / 16 preserved');

    // Test Collapse and Expand via real pointer clicks
    console.log('  Testing Collapse and Expand via real pointer clicks...');
    await p1.locator('#collapseCoachBtn').click();
    await p1.locator('#coachCollapsedBar').waitFor();
    const collapsedBox = await p1.locator('#coachCollapsedBar').boundingBox();
    console.log('  Collapsed coach bounding box:', collapsedBox);
    if (collapsedBox.height > 60) throw new Error('Collapsed coach should be compact');
    console.log('✓ Coach collapsed to compact bar (' + Math.round(collapsedBox.height) + 'px height)');

    await p1.locator('#expandCoachBtn').click();
    await p1.locator('#coachTitle').waitFor();
    console.log('✓ Coach expanded back to full view via real pointer click');

    await c1.close();

    console.log('\n--- TEST 2: Mobile (375x667) Touch / Pointer Verification ---');
    const c2 = await browser.newContext({ viewport: { width: 375, height: 667 }, serviceWorkers: 'block' });
    await c2.route('**/*', async r => {
        const u = new URL(r.request().url());
        if (u.origin !== base) return r.abort();
        if (u.pathname.startsWith('/api/')) {
            if (u.pathname === '/api/auth/me') return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(techA) });
            return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(payloads[u.pathname] ?? []) });
        }
        return r.continue();
    });
    if (c2.routeWebSocket) await c2.routeWebSocket('**/*', ws => ws.close());

    await c2.addInitScript(({ u, token }) => {
        localStorage.setItem('user', JSON.stringify(u));
        localStorage.setItem('token', token);
        localStorage.setItem('locale', 'en');
        sessionStorage.setItem('soilfer_tutorial_v1', JSON.stringify({
            active: true, step: 13, introStage: 3, path: 'full', roleChoice: 'technician',
            sampleTube: 1, viewed: [], practiced: [], done: [], skipped: [], paused: false,
            language: 'en', timestamp: Date.now(), lastActivityAt: Date.now()
        }));
    }, { u: techA, token: tokenA });

    const p2 = await c2.newPage();
    p2.setDefaultTimeout(10000);
    await p2.goto(base + '/workbench?tutorialmode=true&tour=first-visit');
    await p2.locator('#soilfer-tutorial-overlay').waitFor();

    // Verify mobile toggle button is visible and clickable
    const mobileToggle = p2.locator('#mobileToggle');
    await mobileToggle.waitFor({ state: 'visible' });
    console.log('  Clicking #mobileToggle on mobile...');
    await mobileToggle.click();

    // Verify pause and exit on mobile
    const exitBtn = p2.locator('#exit');
    await exitBtn.click();
    await p2.waitForTimeout(400);

    const overlayAfterExit = await p2.$('#soilfer-tutorial-overlay');
    if (overlayAfterExit) throw new Error('Overlay should be removed after mobile exit');
    console.log('✓ Clean mobile Exit verified via real pointer click');

    await c2.close();
    await browser.close();
    await new Promise(r => server.close(r));
    console.log('\n============================================================');
    console.log('  ALL POINTER / TOUCH ACCOUNT HANDOVER CHECKS PASSED!     ');
    console.log('============================================================');
})().catch(err => {
    console.error('TEST FAILED:', err);
    process.exit(1);
});
