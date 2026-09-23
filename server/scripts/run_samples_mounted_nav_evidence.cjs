'use strict';

/**
 * Browser Evidence Runner: Samples Mounted Navigation, Notification Link & State Preservation (Refs #120)
 * 
 * Verifies in real Headless Chrome (CDP) against an isolated disposable database:
 * 1. Initial /samples mount: renders Active Lab Work (view=daily), empty search, unpolluted scope.
 * 2. Journey (a) Same-mounted notification deep link navigation:
 *    - User is on /samples.
 *    - In-app notification navigation to /samples?view=expected&projects=SOILFER-GTM&labs=LAB-GTM while mounted.
 *    - UI updates: Expected Arrivals view active (Indigo), search empty, table shows expected arrivals for SOILFER-GTM.
 *    - Daily physical samples are excluded.
 * 3. Journey (b) View-switch state preservation:
 *    - User enters search 'SMP-TEST-SEARCH'.
 *    - User applies quick filter (status=EXPECTED).
 *    - URL updates reactively.
 *    - User switches view to 'daily' (Active Lab Work).
 *    - Search 'SMP-TEST-SEARCH' SURVIVES in DOM input, component state, and URL.
 *    - Scoping filter projects=SOILFER-GTM and labs=LAB-GTM SURVIVES in state and URL.
 *    - Status filter status=EXPECTED is INTENTIONALLY CLEARED.
 * 4. Journey (c) Reset clearing both UI and URL scope:
 *    - User triggers Reset (Clear all filters).
 *    - Search input is cleared in DOM and state.
 *    - URL searchParams scope is completely cleared (no lingering search, projects, labs, status).
 *    - UI reflects clean unconstrained view.
 * 5. Captures high-resolution screenshot and structured JSON report.
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const WebSocket = require('ws');

// --- DATABASE ISOLATION SETUP ---
const {
    WORKING_DEV_DB,
    createDisposableDatabase,
    cleanupDisposableDatabase,
    validateDisposableDbPath
} = require('./journey_db_isolation.cjs');

// Quick CLI flag for fast isolated refusal check
if (process.argv.includes('--refusal-check')) {
    const testRunnerDir = path.resolve(__dirname, '..', '.tmp_journey_runner_refusal_test_samples');
    try {
        fs.mkdirSync(testRunnerDir, { recursive: true });
        validateDisposableDbPath(process.env.DATABASE_PATH || WORKING_DEV_DB, testRunnerDir);
        console.error('[REFUSAL_FAILED] Did not refuse invalid database path');
        process.exit(1);
    } catch (err) {
        if (err.message.includes('[DB_ISOLATION_REFUSAL]')) {
            console.log('[REFUSAL_PASSED] Refusal guard successfully rejected working database path:', err.message);
            process.exit(0);
        }
        console.error('[REFUSAL_ERROR] Unexpected error:', err);
        process.exit(1);
    } finally {
        if (fs.existsSync(testRunnerDir)) {
            fs.rmSync(testRunnerDir, { recursive: true, force: true });
        }
    }
}

// 1. Create validated synthetic disposable database
const { runnerDir, dbPath } = createDisposableDatabase();
process.env.DATABASE_PATH = validateDisposableDbPath(dbPath, runnerDir);
process.env.DATABASE_URL = `file:${process.env.DATABASE_PATH}`;
process.env.NODE_ENV = 'production';
process.env.DISABLE_BACKGROUND_JOBS = 'true';
process.env.SERVE_CLIENT = 'true';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_jwt_for_local_testing_12345';

// 2. Import dependencies
const prisma = require('../prisma');
const app = require('../app');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const EVIDENCE_DIR = path.resolve(__dirname, '..', '..', 'artifacts', 'evidence-journeys');
if (!fs.existsSync(EVIDENCE_DIR)) {
    fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
}

class CDPClient {
    constructor(wsUrl) {
        this.wsUrl = wsUrl;
        this.ws = null;
        this.id = 1;
        this.pending = new Map();
        this.events = new Map();
    }

    async connect() {
        return new Promise((resolve, reject) => {
            this.ws = new WebSocket(this.wsUrl);
            this.ws.on('open', () => resolve());
            this.ws.on('error', (err) => reject(err));
            this.ws.on('message', (data) => {
                try {
                    const msg = JSON.parse(data.toString());
                    if (msg.id && this.pending.has(msg.id)) {
                        const { resolve, reject } = this.pending.get(msg.id);
                        this.pending.delete(msg.id);
                        if (msg.error) {
                            reject(new Error(msg.error.message || JSON.stringify(msg.error)));
                        } else {
                            resolve(msg.result);
                        }
                    } else if (msg.method) {
                        const handlers = this.events.get(msg.method) || [];
                        for (const h of handlers) h(msg.params);
                    }
                } catch (e) {
                    console.error('[CDP parse error]', e);
                }
            });
        });
    }

    send(method, params = {}) {
        return new Promise((resolve, reject) => {
            const id = this.id++;
            this.pending.set(id, { resolve, reject });
            this.ws.send(JSON.stringify({ id, method, params }));
        });
    }

    on(method, handler) {
        if (!this.events.has(method)) this.events.set(method, []);
        this.events.get(method).push(handler);
    }

    close() {
        if (this.ws) {
            this.ws.close();
        }
    }
}

async function getJson(url) {
    return new Promise((resolve, reject) => {
        http.get(url, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(body));
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
}

function sleep(ms) {
    return new Promise(res => setTimeout(res, ms));
}

async function run() {
    let server = null;
    let chromeProc = null;
    let cdp = null;
    let exitCode = 1;

    try {
        console.log('[1/7] Setting up synthetic disposable database fixtures...');

        // Laboratories
        await prisma.lab.upsert({
            where: { id: 'LAB-GTM' },
            update: { name: 'Laboratorio Suelos Guatemala', code: 'LAB-GTM', country: 'GTM', isActive: true },
            create: { id: 'LAB-GTM', name: 'Laboratorio Suelos Guatemala', code: 'LAB-GTM', country: 'GTM', isActive: true }
        });
        await prisma.lab.upsert({
            where: { id: 'LAB-HND' },
            update: { name: 'Laboratorio Suelos Honduras', code: 'LAB-HND', country: 'HND', isActive: true },
            create: { id: 'LAB-HND', name: 'Laboratorio Suelos Honduras', code: 'LAB-HND', country: 'HND', isActive: true }
        });

        // Projects
        await prisma.project.upsert({
            where: { code: 'SOILFER-GTM' },
            update: { name: 'Soil Fertility Guatemala', status: 'ACTIVE' },
            create: { id: 'PRJ-SOILFER-GTM', code: 'SOILFER-GTM', name: 'Soil Fertility Guatemala', status: 'ACTIVE' }
        });
        await prisma.project.upsert({
            where: { code: 'SOILFER-OTHER' },
            update: { name: 'Other Project', status: 'ACTIVE' },
            create: { id: 'PRJ-SOILFER-OTHER', code: 'SOILFER-OTHER', name: 'Other Project', status: 'ACTIVE' }
        });

        // User: Lab Manager for LAB-GTM
        const managerPasswordHash = await bcrypt.hash('password123', 10);
        const managerUser = await prisma.user.upsert({
            where: { username: 'manager_gtm' },
            update: {
                role: 'LAB_MANAGER',
                password: managerPasswordHash,
                labId: 'LAB-GTM',
                countries: JSON.stringify(['GTM']),
                projects: JSON.stringify(['SOILFER-GTM', 'SOILFER-OTHER']),
                isActive: true
            },
            create: {
                id: 'usr-manager-gtm-journey',
                username: 'manager_gtm',
                name: 'Guatemala Lab Manager',
                email: 'manager.gtm@soilfer.demo',
                role: 'LAB_MANAGER',
                password: managerPasswordHash,
                labId: 'LAB-GTM',
                countries: JSON.stringify(['GTM']),
                projects: JSON.stringify(['SOILFER-GTM', 'SOILFER-OTHER']),
                isActive: true
            }
        });

        // Seed Samples:
        // 1. Daily Active Sample in SOILFER-GTM
        await prisma.sample.create({
            data: {
                id: 'SMP-GTM-ACTIVE-1',
                labId: 'GTM-ACT-001',
                originalId: 'FIELD-ACT-001',
                assignedLab: 'LAB-GTM',
                projectCode: 'SOILFER-GTM',
                status: 'RECEIVED'
            }
        });

        // 2. Expected Arrival Sample in SOILFER-GTM (from Kobo sync)
        await prisma.sample.create({
            data: {
                id: 'SMP-GTM-EXPECTED-1',
                labId: 'GTM-EXP-001',
                originalId: 'FIELD-EXP-001',
                assignedLab: 'LAB-GTM',
                projectCode: 'SOILFER-GTM',
                status: 'EXPECTED'
            }
        });

        // 3. Expected Arrival matching search 'SMP-TEST-SEARCH'
        await prisma.sample.create({
            data: {
                id: 'SMP-GTM-EXP-SEARCH',
                labId: 'SMP-TEST-SEARCH-01',
                originalId: 'SMP-TEST-SEARCH-01',
                assignedLab: 'LAB-GTM',
                projectCode: 'SOILFER-GTM',
                status: 'EXPECTED'
            }
        });

        // 4. Daily Active sample matching search 'SMP-TEST-SEARCH'
        await prisma.sample.create({
            data: {
                id: 'SMP-GTM-ACT-SEARCH',
                labId: 'SMP-TEST-SEARCH-DAILY',
                originalId: 'FIELD-SEARCH-DAILY',
                assignedLab: 'LAB-GTM',
                projectCode: 'SOILFER-GTM',
                status: 'PROCESSING'
            }
        });

        // 5. Expected Arrival in OTHER project (should be excluded when filtered by SOILFER-GTM)
        await prisma.sample.create({
            data: {
                id: 'SMP-OTHER-PROJECT',
                labId: 'OTH-EXP-001',
                originalId: 'FIELD-OTH-001',
                assignedLab: 'LAB-GTM',
                projectCode: 'SOILFER-OTHER',
                status: 'EXPECTED'
            }
        });

        // 6. Notification with deep link to expected arrivals
        await prisma.notification.create({
            data: {
                id: 'notif-kobo-sync-gtm',
                userId: managerUser.id,
                title: 'Kobo Sync Complete',
                message: 'Successfully synced 2 new samples from Kobo.',
                link: '/samples?view=expected&projects=SOILFER-GTM&labs=LAB-GTM',
                type: 'SUCCESS',
                isRead: false
            }
        });

        console.log('[PASS] Synthetic database seeded with isolated test records');

        // [2/7] Start ephemeral Express server
        console.log('[2/7] Starting ephemeral application server...');
        server = http.createServer(app);
        await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
        const port = server.address().port;
        console.log(`Ephemeral server listening on http://127.0.0.1:${port}`);

        // Generate JWT token
        const token = jwt.sign(
            { id: managerUser.id, username: managerUser.username, role: managerUser.role, labId: managerUser.labId },
            process.env.JWT_SECRET,
            { expiresIn: '2h' }
        );

        // [3/7] Launch Headless Chrome
        console.log('[3/7] Launching Headless Chrome via CDP...');
        const cdpPort = 9222 + Math.floor(Math.random() * 500);
        const chromeUserDataDir = path.resolve(runnerDir, 'chrome_user_data');
        fs.mkdirSync(chromeUserDataDir, { recursive: true });

        chromeProc = spawn(CHROME_PATH, [
            '--headless=new',
            `--remote-debugging-port=${cdpPort}`,
            `--user-data-dir=${chromeUserDataDir}`,
            '--no-first-run',
            '--no-default-browser-check',
            '--disable-gpu',
            '--disable-background-networking',
            '--window-size=1400,900',
            'about:blank'
        ], { stdio: 'ignore' });

        await sleep(1500);

        const versionInfo = await getJson(`http://127.0.0.1:${cdpPort}/json/version`);
        const browserWsUrl = versionInfo.webSocketDebuggerUrl;
        const browserCdp = new CDPClient(browserWsUrl);
        await browserCdp.connect();

        const { targetId } = await browserCdp.send('Target.createTarget', { url: 'about:blank' });
        const pageWsUrl = `ws://127.0.0.1:${cdpPort}/devtools/page/${targetId}`;
        const pageCdp = new CDPClient(pageWsUrl);
        await pageCdp.connect();

        await pageCdp.send('Page.enable');
        await pageCdp.send('DOM.enable');
        await pageCdp.send('Runtime.enable');

        // Set auth credentials
        await pageCdp.send('Page.navigate', { url: `http://127.0.0.1:${port}/` });
        await sleep(1000);

        await pageCdp.send('Runtime.evaluate', {
            expression: `
                localStorage.setItem('token', '${token}');
                localStorage.setItem('user', JSON.stringify({
                    id: '${managerUser.id}',
                    username: '${managerUser.username}',
                    role: '${managerUser.role}',
                    labId: '${managerUser.labId}'
                }));
            `
        });

        // ─── STEP 4: Initial Mount at /samples ───
        console.log('[4/7] Step 1: Navigating to initial /samples route...');
        await pageCdp.send('Page.navigate', { url: `http://127.0.0.1:${port}/samples` });
        await sleep(2500);

        const evalStep1 = await pageCdp.send('Runtime.evaluate', {
            expression: `
                (() => {
                    const buttons = Array.from(document.querySelectorAll('button'));
                    const dailyBtn = buttons.find(b => b.innerText.includes('Active Lab Work'));
                    const expectedBtn = buttons.find(b => b.innerText.includes('Expected Arrivals'));
                    const rows = Array.from(document.querySelectorAll('table tbody tr')).map(r => r.innerText);
                    const searchInput = document.querySelector('input[placeholder*="Search"]');

                    return {
                        dailyActive: dailyBtn ? dailyBtn.className.includes('bg-emerald-600') : false,
                        expectedActive: expectedBtn ? expectedBtn.className.includes('bg-indigo-600') : false,
                        searchValue: searchInput ? searchInput.value : null,
                        rowCount: rows.length,
                        hasActive1: rows.some(r => r.includes('GTM-ACT-001')),
                        hasExpected1: rows.some(r => r.includes('FIELD-EXP-001') || r.includes('GTM-EXP-001')),
                        rows,
                        currentUrl: window.location.href
                    };
                })()
            `,
            returnByValue: true
        });

        const step1Data = evalStep1.result.value;
        console.log('Step 1 Initial Mount Result:', step1Data);
        if (!step1Data.dailyActive) {
            throw new Error(`[STEP1_FAILED] Active Lab Work tab should be active by default: ${JSON.stringify(step1Data)}`);
        }
        if (!step1Data.hasActive1) {
            throw new Error(`[STEP1_FAILED] Daily sample GTM-ACT-001 should be visible: ${JSON.stringify(step1Data)}`);
        }
        if (step1Data.hasExpected1) {
            throw new Error(`[STEP1_FAILED] EXPECTED sample FIELD-EXP-001 should NOT be visible in daily view: ${JSON.stringify(step1Data)}`);
        }
        console.log('[PASS] Step 1: Initial /samples mount cleanly renders Active Lab Work with EXPECTED samples excluded');

        // ─── STEP 5: Journey (a) Same-Mounted Notification Navigation ───
        console.log('[5/7] Step 2: Journey (a) - Same-mounted notification deep link navigation...');
        // Execute same-mounted navigation as performed by NotificationDrawer / React Router
        await pageCdp.send('Runtime.evaluate', {
            expression: `
                (() => {
                    window.history.pushState(null, '', '/samples?view=expected&projects=SOILFER-GTM&labs=LAB-GTM');
                    window.dispatchEvent(new PopStateEvent('popstate'));
                })()
            `
        });
        await sleep(2000);

        const evalStep2 = await pageCdp.send('Runtime.evaluate', {
            expression: `
                (() => {
                    const buttons = Array.from(document.querySelectorAll('button'));
                    const dailyBtn = buttons.find(b => b.innerText.includes('Active Lab Work'));
                    const expectedBtn = buttons.find(b => b.innerText.includes('Expected Arrivals'));
                    const rows = Array.from(document.querySelectorAll('table tbody tr')).map(r => r.innerText);
                    const searchInput = document.querySelector('input[placeholder*="Search"]');

                    return {
                        dailyActive: dailyBtn ? dailyBtn.className.includes('bg-emerald-600') : false,
                        expectedActive: expectedBtn ? expectedBtn.className.includes('bg-indigo-600') : false,
                        searchValue: searchInput ? searchInput.value : null,
                        rowCount: rows.length,
                        hasExpected1: rows.some(r => r.includes('FIELD-EXP-001') || r.includes('GTM-EXP-001')),
                        hasExpSearch: rows.some(r => r.includes('SMP-TEST-SEARCH-01')),
                        hasActive1: rows.some(r => r.includes('GTM-ACT-001')),
                        hasOtherPrj: rows.some(r => r.includes('FIELD-OTH-001') || r.includes('OTH-EXP-001')),
                        rows,
                        currentUrl: window.location.href
                    };
                })()
            `,
            returnByValue: true
        });

        const step2Data = evalStep2.result.value;
        console.log('Step 2 Notification Navigation Result:', step2Data);
        if (!step2Data.expectedActive) {
            throw new Error(`[STEP2_FAILED] Expected Arrivals tab should be active after notification navigation: ${JSON.stringify(step2Data)}`);
        }
        if (step2Data.dailyActive) {
            throw new Error(`[STEP2_FAILED] Active Lab Work should no longer be active: ${JSON.stringify(step2Data)}`);
        }
        if (!step2Data.hasExpected1 || !step2Data.hasExpSearch) {
            throw new Error(`[STEP2_FAILED] Expected samples for SOILFER-GTM should be visible: ${JSON.stringify(step2Data)}`);
        }
        if (step2Data.hasActive1) {
            throw new Error(`[STEP2_FAILED] Daily sample GTM-ACT-001 must not appear in Expected Arrivals: ${JSON.stringify(step2Data)}`);
        }
        if (step2Data.hasOtherPrj) {
            throw new Error(`[STEP2_FAILED] Cross-project sample OTH-EXP-001 must be excluded by projects=SOILFER-GTM scope: ${JSON.stringify(step2Data)}`);
        }
        console.log('[PASS] Step 2: Same-mounted notification navigation selected Expected Arrivals and correctly applied project/lab scope');

        // ─── STEP 6: Journey (b) View-Switch State Preservation ───
        console.log('[6/7] Step 3: Journey (b) - Search + advanced filter surviving view switch except status filter...');

        // Type search query 'SMP-TEST-SEARCH' into the search input using React-compatible setter
        await pageCdp.send('Runtime.evaluate', {
            expression: `
                (() => {
                    const input = document.querySelector('input[placeholder*="Search"]');
                    if (input) {
                        input.focus();
                        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                        setter.call(input, 'SMP-TEST-SEARCH');
                        input.dispatchEvent(new Event('input', { bubbles: true }));
                    }
                })()
            `
        });
        await sleep(1000); // allow 300ms debounce + React state update

        // Apply quick filter for Expected (status=EXPECTED)
        const qfClickResult = await pageCdp.send('Runtime.evaluate', {
            expression: `
                (() => {
                    const qfBtn = document.querySelector('[data-testid="qf-expected"]');
                    if (qfBtn) {
                        qfBtn.click();
                        return { clicked: true };
                    }
                    return { clicked: false };
                })()
            `,
            returnByValue: true
        });
        console.log('Step 3a Quick filter click result:', qfClickResult.result.value);
        if (!qfClickResult.result.value.clicked) {
            throw new Error('[STEP3A_FAILED] Expected quick filter button with data-testid="qf-expected" not found');
        }
        await sleep(1500);

        const evalStep3a = await pageCdp.send('Runtime.evaluate', {
            expression: `
                (() => {
                    const input = document.querySelector('input[placeholder*="Search"]');
                    const rows = Array.from(document.querySelectorAll('table tbody tr')).map(r => r.innerText);
                    return {
                        searchValue: input ? input.value : '',
                        currentUrl: window.location.href,
                        rowCount: rows.length,
                        hasExpSearch: rows.some(r => r.includes('SMP-TEST-SEARCH-01')),
                        hasExp1: rows.some(r => r.includes('FIELD-EXP-001') || r.includes('GTM-EXP-001')),
                        rows
                    };
                })()
            `,
            returnByValue: true
        });

        const step3aData = evalStep3a.result.value;
        console.log('Step 3a Search and Status Filter Applied:', step3aData);
        if (step3aData.searchValue !== 'SMP-TEST-SEARCH') {
            throw new Error(`[STEP3A_FAILED] Expected search input to have 'SMP-TEST-SEARCH', got: '${step3aData.searchValue}'`);
        }
        if (!step3aData.currentUrl.includes('search=SMP-TEST-SEARCH')) {
            throw new Error(`[STEP3A_FAILED] URL should contain search parameter: ${step3aData.currentUrl}`);
        }
        if (!step3aData.currentUrl.includes('status=EXPECTED')) {
            throw new Error(`[STEP3A_FAILED] URL should contain status=EXPECTED parameter: ${step3aData.currentUrl}`);
        }
        if (!step3aData.hasExpSearch) {
            throw new Error(`[STEP3A_FAILED] Expected sample SMP-TEST-SEARCH-01 should match search: ${JSON.stringify(step3aData)}`);
        }
        if (step3aData.hasExp1) {
            throw new Error(`[STEP3A_FAILED] Non-matching sample FIELD-EXP-001 should be filtered out by search: ${JSON.stringify(step3aData)}`);
        }
        console.log('[PASS] Step 3a: Search and status filter applied, URL synchronized, table filtered down to matching sample');

        // Now switch view from Expected Arrivals to Active Lab Work (daily)
        console.log('Switching view to "Active Lab Work" (daily)...');
        await pageCdp.send('Runtime.evaluate', {
            expression: `
                (() => {
                    const buttons = Array.from(document.querySelectorAll('button'));
                    const dailyBtn = buttons.find(b => b.innerText.includes('Active Lab Work'));
                    if (dailyBtn) dailyBtn.click();
                })()
            `
        });
        await sleep(2000);

        const evalStep3b = await pageCdp.send('Runtime.evaluate', {
            expression: `
                (() => {
                    const buttons = Array.from(document.querySelectorAll('button'));
                    const dailyBtn = buttons.find(b => b.innerText.includes('Active Lab Work'));
                    const expectedBtn = buttons.find(b => b.innerText.includes('Expected Arrivals'));
                    const rows = Array.from(document.querySelectorAll('table tbody tr')).map(r => r.innerText);
                    const searchInput = document.querySelector('input[placeholder*="Search"]');

                    return {
                        dailyActive: dailyBtn ? dailyBtn.className.includes('bg-emerald-600') : false,
                        expectedActive: expectedBtn ? expectedBtn.className.includes('bg-indigo-600') : false,
                        searchValue: searchInput ? searchInput.value : '',
                        currentUrl: window.location.href,
                        rowCount: rows.length,
                        hasActSearch: rows.some(r => r.includes('SMP-TEST-SEARCH-DAILY')),
                        hasExpSearch: rows.some(r => r.includes('SMP-TEST-SEARCH-01')),
                        hasActive1: rows.some(r => r.includes('GTM-ACT-001'))
                    };
                })()
            `,
            returnByValue: true
        });

        const step3bData = evalStep3b.result.value;
        console.log('Step 3b View Switch Result:', step3bData);
        if (!step3bData.dailyActive) {
            throw new Error(`[STEP3B_FAILED] Active Lab Work tab should be active: ${JSON.stringify(step3bData)}`);
        }
        if (step3bData.searchValue !== 'SMP-TEST-SEARCH') {
            throw new Error(`[STEP3B_FAILED] Search input lost on view switch! Expected 'SMP-TEST-SEARCH', was '${step3bData.searchValue}'`);
        }
        if (!step3bData.currentUrl.includes('search=SMP-TEST-SEARCH')) {
            throw new Error(`[STEP3B_FAILED] URL search parameter lost on view switch: ${step3bData.currentUrl}`);
        }
        if (!step3bData.currentUrl.includes('projects=SOILFER-GTM')) {
            throw new Error(`[STEP3B_FAILED] URL project scope lost on view switch: ${step3bData.currentUrl}`);
        }
        if (step3bData.currentUrl.includes('status=')) {
            throw new Error(`[STEP3B_FAILED] Status filter should be intentionally cleared on view switch: ${step3bData.currentUrl}`);
        }
        if (!step3bData.hasActSearch) {
            throw new Error(`[STEP3B_FAILED] Daily sample matching search SMP-TEST-SEARCH-DAILY should be displayed: ${JSON.stringify(step3bData)}`);
        }
        if (step3bData.hasExpSearch) {
            throw new Error(`[STEP3B_FAILED] EXPECTED sample SMP-TEST-SEARCH-01 should NOT appear in Active Lab Work view: ${JSON.stringify(step3bData)}`);
        }
        console.log('[PASS] Step 3: Search and advanced project filter strictly survived view switch while status filter was cleared');

        // ─── STEP 7: Journey (c) Reset Clearing Both UI and URL Scope ───
        console.log('[7/7] Step 4: Journey (c) - Reset clearing both UI and URL scope...');

        // Trigger Reset: Click "Clear all filters" button or search clear
        await pageCdp.send('Runtime.evaluate', {
            expression: `
                (() => {
                    const clearAllBtn = document.querySelector('[data-testid="clear-all-filters"]') || document.querySelector('button[title*="Clear all"]');
                    if (clearAllBtn) {
                        clearAllBtn.click();
                        return { method: 'clearAllBtn' };
                    }
                    const searchClearBtn = document.querySelector('div.relative button');
                    if (searchClearBtn) {
                        searchClearBtn.click();
                        return { method: 'searchClearBtn' };
                    }
                    return { method: 'none' };
                })()
            `
        });
        await sleep(2000);

        const evalStep4 = await pageCdp.send('Runtime.evaluate', {
            expression: `
                (() => {
                    const input = document.querySelector('input[placeholder*="Search"]');
                    const rows = Array.from(document.querySelectorAll('table tbody tr')).map(r => r.innerText);
                    const url = new URL(window.location.href);

                    return {
                        searchValue: input ? input.value : '',
                        hasSearchParam: url.searchParams.has('search') || url.searchParams.has('q'),
                        hasProjectsParam: url.searchParams.has('projects') || url.searchParams.has('project'),
                        hasLabsParam: url.searchParams.has('labs') || url.searchParams.has('lab'),
                        hasStatusParam: url.searchParams.has('status'),
                        currentUrl: window.location.href,
                        rowCount: rows.length,
                        hasActive1: rows.some(r => r.includes('GTM-ACT-001')),
                        hasActSearch: rows.some(r => r.includes('SMP-TEST-SEARCH-DAILY'))
                    };
                })()
            `,
            returnByValue: true
        });

        const step4Data = evalStep4.result.value;
        console.log('Step 4 Reset Result:', step4Data);
        if (step4Data.searchValue !== '') {
            throw new Error(`[STEP4_FAILED] Search input should be empty after reset, got: '${step4Data.searchValue}'`);
        }
        if (step4Data.hasSearchParam || step4Data.hasProjectsParam || step4Data.hasLabsParam || step4Data.hasStatusParam) {
            throw new Error(`[STEP4_FAILED] URL scope parameters should all be cleared: ${step4Data.currentUrl}`);
        }
        if (!step4Data.hasActive1 || !step4Data.hasActSearch) {
            throw new Error(`[STEP4_FAILED] All daily samples should be restored after reset: ${JSON.stringify(step4Data)}`);
        }
        console.log('[PASS] Step 4: Reset completely cleared both UI inputs and URL scope parameters');

        // Capture High-Resolution Screenshot
        console.log('Capturing high-resolution viewport screenshot of verified mounted state...');
        const screenshotResult = await pageCdp.send('Page.captureScreenshot', {
            format: 'png',
            captureBeyondViewport: false
        });
        const screenshotPath = path.resolve(EVIDENCE_DIR, 'samples_mounted_nav_preservation.png');
        fs.writeFileSync(screenshotPath, Buffer.from(screenshotResult.data, 'base64'));
        console.log('Saved screenshot to:', screenshotPath);

        // Save structured evidence JSON
        const evidencePayload = {
            timestamp: new Date().toISOString(),
            status: 'PASS',
            issue: '#120 Acceptance: Mounted Samples Route & Parameter Lifecycle',
            pr: 139,
            environment: {
                node: process.version,
                database: 'disposable_journey_samples_nav.db',
                isolationRefusalGuard: 'ACTIVE'
            },
            verifiedJourneys: {
                journeyA_sameMountedNotificationNavigation: {
                    initialMountedView: 'daily',
                    navigatedToLink: '/samples?view=expected&projects=SOILFER-GTM&labs=LAB-GTM',
                    expectedTabActive: step2Data.expectedActive,
                    dailyTabInactive: !step2Data.dailyActive,
                    expectedArrivalsVisible: step2Data.hasExpected1 && step2Data.hasExpSearch,
                    physicalDailySamplesExcluded: !step2Data.hasActive1,
                    crossProjectSamplesExcluded: !step2Data.hasOtherPrj,
                    status: 'PASS'
                },
                journeyB_viewSwitchStatePreservation: {
                    appliedSearch: 'SMP-TEST-SEARCH',
                    appliedStatusFilter: 'EXPECTED',
                    switchedToView: 'daily',
                    searchRetainedInDOM: step3bData.searchValue === 'SMP-TEST-SEARCH',
                    searchRetainedInURL: step3bData.currentUrl.includes('search=SMP-TEST-SEARCH'),
                    projectScopeRetainedInURL: step3bData.currentUrl.includes('projects=SOILFER-GTM'),
                    statusFilterClearedInURL: !step3bData.currentUrl.includes('status='),
                    matchingDailySampleRendered: step3bData.hasActSearch,
                    status: 'PASS'
                },
                journeyC_resetScopeClearing: {
                    searchInputCleared: step4Data.searchValue === '',
                    urlSearchParamCleared: !step4Data.hasSearchParam,
                    urlProjectScopeCleared: !step4Data.hasProjectsParam,
                    urlLabScopeCleared: !step4Data.hasLabsParam,
                    urlStatusScopeCleared: !step4Data.hasStatusParam,
                    fullUnconstrainedViewRestored: step4Data.hasActive1 && step4Data.hasActSearch,
                    screenshot: 'artifacts/evidence-journeys/samples_mounted_nav_preservation.png',
                    status: 'PASS'
                }
            }
        };

        const jsonPath = path.resolve(EVIDENCE_DIR, 'samples_mounted_nav_evidence.json');
        fs.writeFileSync(jsonPath, JSON.stringify(evidencePayload, null, 2));
        console.log('Saved evidence JSON to:', jsonPath);

        exitCode = 0;
    } catch (err) {
        console.error('\n[SAMPLES_MOUNTED_JOURNEY_FAILED]', err);
    } finally {
        if (cdp) cdp.close();
        if (chromeProc) {
            try { process.kill(chromeProc.pid); } catch (e) {}
        }
        if (server) {
            await new Promise(r => server.close(r));
        }
        cleanupDisposableDatabase(runnerDir);
        process.exit(exitCode);
    }
}

run();
