'use strict';

/**
 * Browser Evidence Runner: Result Reports Query/Filter Lifecycle & Truthful No-Match (#124 Residual)
 * 
 * Verifies in real Headless Chrome (CDP) against an isolated disposable database:
 * 1. Initial /result-reports route renders Published reports by default with empty search.
 * 2. Real DOM click on "All Versions" tab loads all report versions (5 reports).
 * 3. Search submission for 'GTM26-0002' in "All Versions" filters to exactly 1 report (v1).
 * 4. Exact #124 Transition: Clicking "Superseded" tab while 'GTM26-0002' remains in input:
 *    - Search input strictly retains 'GTM26-0002'.
 *    - Table renders truthful empty state ("No reports found", 0 reports found).
 *    - Unrelated GTM26-0003 superseded v1 report does NOT appear!
 * 5. Returning to "All Versions" tab retains 'GTM26-0002' and restores the 1 matching report.
 * 6. Clicking the Clear search button resets input and restores all reports (5 reports found).
 * 7. Captures high-resolution screenshot and structured JSON report.
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const WebSocket = require('ws');

// --- DATABASE ISOLATION SETUP (MUST RUN BEFORE PRISMA OR APP IMPORTS) ---
const {
    WORKING_DEV_DB,
    createDisposableDatabase,
    cleanupDisposableDatabase,
    validateDisposableDbPath
} = require('./journey_db_isolation.cjs');

// Quick CLI flag for fast isolated refusal check
if (process.argv.includes('--refusal-check')) {
    const testRunnerDir = path.resolve(__dirname, '..', '.tmp_journey_runner_refusal_test_reports');
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
const { JWT_SECRET } = require('../config/auth');
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

        // Setup Super Admin User
        const adminPasswordHash = await bcrypt.hash('password123', 10);
        await prisma.user.upsert({
            where: { username: 'super_admin' },
            update: {
                role: 'SUPER_ADMIN',
                password: adminPasswordHash,
                labId: 'LAB-GTM',
                countries: JSON.stringify(['GTM', 'HND']),
                projects: JSON.stringify(['SOILFER-US']),
                isActive: true
            },
            create: {
                id: 'usr-super-admin-journey-rpt',
                username: 'super_admin',
                name: 'Super Administrator',
                email: 'superadmin@soilfer.demo',
                role: 'SUPER_ADMIN',
                password: adminPasswordHash,
                labId: 'LAB-GTM',
                countries: JSON.stringify(['GTM', 'HND']),
                projects: JSON.stringify(['SOILFER-US']),
                isActive: true
            }
        });

        // Seed Projects
        await prisma.project.upsert({
            where: { code: 'GTM-SOIL-2026' },
            update: { name: 'National Soil Fertility Assessment', status: 'ACTIVE' },
            create: {
                id: 'PRJ-GTM-SOIL-2026',
                code: 'GTM-SOIL-2026',
                name: 'National Soil Fertility Assessment',
                status: 'ACTIVE'
            }
        });
        await prisma.project.upsert({
            where: { code: 'GTM-PILOT-2026' },
            update: { name: 'Guatemala Pilot Soil Programme', status: 'ACTIVE' },
            create: {
                id: 'PRJ-GTM-PILOT-2026',
                code: 'GTM-PILOT-2026',
                name: 'Guatemala Pilot Soil Programme',
                status: 'ACTIVE'
            }
        });

        // Clean up previous test sample & report records
        const sampleIds = ['SMP-GTM26-0001', 'SMP-GTM26-0002', 'SMP-GTM26-0003', 'SMP-GTM26-0004'];
        await prisma.report.deleteMany({ where: { sampleId: { in: sampleIds } } });
        await prisma.sample.deleteMany({ where: { id: { in: sampleIds } } });


        // 1. Sample GTM26-0001 (Julio Morales): 2 versions (v1 SUPERSEDED, v2 PUBLISHED)
        await prisma.sample.create({
            data: {
                id: 'SMP-GTM26-0001',
                labId: 'GTM26-0001',
                originalId: 'FIELD-GTM26-0001',
                assignedLab: 'LAB-GTM',
                projectCode: 'GTM-SOIL-2026',
                status: 'APPROVED'
            }
        });
        await prisma.report.create({
            data: {
                id: 'RPT-GTM26-0001-V1',
                sampleId: 'SMP-GTM26-0001',
                labId: 'LAB-GTM',
                version: 1,
                status: 'SUPERSEDED',
                firstName: 'Julio',
                surname: 'Morales',
                projectCode: 'GTM-SOIL-2026',
                projectName: 'National Soil Fertility Assessment',
                sampleLabId: 'GTM26-0001',
                generatedBy: 'test_manager'
            }
        });
        await prisma.report.create({
            data: {
                id: 'RPT-GTM26-0001-V2',
                sampleId: 'SMP-GTM26-0001',
                labId: 'LAB-GTM',
                version: 2,
                status: 'PUBLISHED',
                firstName: 'Julio',
                surname: 'Morales',
                projectCode: 'GTM-SOIL-2026',
                projectName: 'National Soil Fertility Assessment',
                sampleLabId: 'GTM26-0001',
                generatedBy: 'test_manager'
            }
        });

        // 2. Sample GTM26-0002: Exactly 1 report (v1 PUBLISHED)
        await prisma.sample.create({
            data: {
                id: 'SMP-GTM26-0002',
                labId: 'GTM26-0002',
                originalId: 'FIELD-GTM26-0002',
                assignedLab: 'LAB-GTM',
                projectCode: 'GTM-SOIL-2026',
                status: 'APPROVED'
            }
        });
        await prisma.report.create({
            data: {
                id: 'RPT-GTM26-0002-V1',
                sampleId: 'SMP-GTM26-0002',
                labId: 'LAB-GTM',
                version: 1,
                status: 'PUBLISHED',
                firstName: 'Carlos',
                surname: 'Mendez',
                projectCode: 'GTM-SOIL-2026',
                projectName: 'National Soil Fertility Assessment',
                sampleLabId: 'GTM26-0002',
                generatedBy: 'test_manager'
            }
        });

        // 3. Sample GTM26-0003: 2 reports (v1 SUPERSEDED, v2 PUBLISHED)
        await prisma.sample.create({
            data: {
                id: 'SMP-GTM26-0003',
                labId: 'GTM26-0003',
                originalId: 'FIELD-GTM26-0003',
                assignedLab: 'LAB-GTM',
                projectCode: 'GTM-SOIL-2026',
                status: 'APPROVED'
            }
        });
        await prisma.report.create({
            data: {
                id: 'RPT-GTM26-0003-V1',
                sampleId: 'SMP-GTM26-0003',
                labId: 'LAB-GTM',
                version: 1,
                status: 'SUPERSEDED',
                firstName: 'Elena',
                surname: 'Rios',
                projectCode: 'GTM-SOIL-2026',
                projectName: 'National Soil Fertility Assessment',
                sampleLabId: 'GTM26-0003',
                generatedBy: 'test_manager'
            }
        });
        await prisma.report.create({
            data: {
                id: 'RPT-GTM26-0003-V2',
                sampleId: 'SMP-GTM26-0003',
                labId: 'LAB-GTM',
                version: 2,
                status: 'PUBLISHED',
                firstName: 'Elena',
                surname: 'Rios',
                projectCode: 'GTM-SOIL-2026',
                projectName: 'National Soil Fertility Assessment',
                sampleLabId: 'GTM26-0003',
                generatedBy: 'test_manager'
            }
        });

        // 4. Sample GTM26-0004 (Marco Alvarez) in GTM-PILOT-2026: 1 report (v1 PUBLISHED)
        await prisma.sample.create({
            data: {
                id: 'SMP-GTM26-0004',
                labId: 'GTM26-0004',
                originalId: 'FIELD-GTM26-0004',
                assignedLab: 'LAB-GTM',
                projectId: 'PRJ-GTM-PILOT-2026',
                projectCode: 'GTM-PILOT-2026',
                status: 'APPROVED'
            }
        });
        await prisma.report.create({
            data: {
                id: 'RPT-GTM26-0004-V1',
                sampleId: 'SMP-GTM26-0004',
                labId: 'LAB-GTM',
                version: 1,
                status: 'PUBLISHED',
                firstName: 'Marco',
                surname: 'Alvarez',
                projectCode: 'GTM-PILOT-2026',
                projectName: 'Guatemala Pilot Soil Programme',
                sampleLabId: 'GTM26-0004',
                generatedBy: 'test_manager'
            }
        });

        // Generate Auth Token
        const token = jwt.sign(
            { id: 'usr-super-admin-journey-rpt', username: 'super_admin', role: 'SUPER_ADMIN' },
            JWT_SECRET,
            { expiresIn: '2h' }
        );

        console.log('[2/7] Starting test server on ephemeral port...');
        server = http.createServer(app);
        await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
        const port = server.address().port;
        console.log(`Server listening on http://127.0.0.1:${port}`);

        console.log('[3/7] Launching Headless Chrome with remote debugging...');
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

        // Connect to Chrome via CDP
        const versionInfo = await getJson(`http://127.0.0.1:${cdpPort}/json/version`);
        const browserWsUrl = versionInfo.webSocketDebuggerUrl;
        const browserCdp = new CDPClient(browserWsUrl);
        await browserCdp.connect();

        // Create target page
        const { targetId } = await browserCdp.send('Target.createTarget', { url: 'about:blank' });
        const pageWsUrl = `ws://127.0.0.1:${cdpPort}/devtools/page/${targetId}`;
        const pageCdp = new CDPClient(pageWsUrl);
        await pageCdp.connect();

        await pageCdp.send('Page.enable');
        await pageCdp.send('DOM.enable');
        await pageCdp.send('Runtime.enable');

        // Set auth credentials in localStorage before navigating
        await pageCdp.send('Page.navigate', { url: `http://127.0.0.1:${port}/` });
        await sleep(1000);

        await pageCdp.send('Runtime.evaluate', {
            expression: `
                localStorage.setItem('token', '${token}');
                localStorage.setItem('user', JSON.stringify({
                    id: 'usr-super-admin-journey-rpt',
                    username: 'super_admin',
                    role: 'SUPER_ADMIN'
                }));
            `
        });

        // ─── STEP 1: Navigate to /result-reports with Project Scope ───
        console.log('[4/8] Navigating to /result-reports?projectId=PRJ-GTM-SOIL-2026...');
        await pageCdp.send('Page.navigate', { url: `http://127.0.0.1:${port}/result-reports?projectId=PRJ-GTM-SOIL-2026` });
        await sleep(2500);


        const evalStep1 = await pageCdp.send('Runtime.evaluate', {
            expression: `
                (() => {
                    const buttons = Array.from(document.querySelectorAll('button'));
                    const rows = Array.from(document.querySelectorAll('table tbody tr'));
                    const rowTexts = rows.map(r => r.innerText);
                    const headerFound = document.body.innerText.includes('Result Reports');
                    const publishedBtn = buttons.find(b => b.innerText.includes('Published'));
                    const publishedActive = publishedBtn ? publishedBtn.className.includes('bg-sf-emerald') : false;
                    return {
                        headerFound,
                        publishedActive,
                        rowCount: rows.length,
                        hasGTM0001: rowTexts.some(t => t.includes('GTM26-0001')),
                        hasGTM0002: rowTexts.some(t => t.includes('GTM26-0002')),
                        hasGTM0003: rowTexts.some(t => t.includes('GTM26-0003'))
                    };
                })()
            `,
            returnByValue: true
        });

        const step1Data = evalStep1.result.value;
        console.log('Step 1 Published Route Result:', step1Data);
        if (!step1Data.headerFound || !step1Data.publishedActive) {
            throw new Error(`[STEP1_FAILED] Header or Published tab not active: ${JSON.stringify(step1Data)}`);
        }
        if (step1Data.rowCount !== 3) {
            throw new Error(`[STEP1_FAILED] Expected 3 published reports, found ${step1Data.rowCount}`);
        }
        console.log('[PASS] Step 1: /result-reports rendered with Published tab active (3 published reports)');

        // ─── STEP 2: Switch to "All Versions" Tab ───
        console.log('[5/7] Switching to "All Versions" tab via real DOM click...');
        await pageCdp.send('Runtime.evaluate', {
            expression: `
                (() => {
                    const buttons = Array.from(document.querySelectorAll('button'));
                    const allBtn = buttons.find(b => b.innerText.includes('All Versions'));
                    if (allBtn) {
                        allBtn.click();
                        return { clicked: true };
                    }
                    return { clicked: false };
                })()
            `
        });
        await sleep(1500);

        const evalStep2 = await pageCdp.send('Runtime.evaluate', {
            expression: `
                (() => {
                    const buttons = Array.from(document.querySelectorAll('button'));
                    const rows = Array.from(document.querySelectorAll('table tbody tr'));
                    const allBtn = buttons.find(b => b.innerText.includes('All Versions'));
                    const allActive = allBtn ? allBtn.className.includes('bg-sf-emerald') : false;
                    return {
                        allActive,
                        rowCount: rows.length
                    };
                })()
            `,
            returnByValue: true
        });
        const step2Data = evalStep2.result.value;
        console.log('Step 2 All Versions Result:', step2Data);
        if (!step2Data.allActive || step2Data.rowCount !== 5) {
            throw new Error(`[STEP2_FAILED] Expected All Versions tab active with 5 total reports, got: ${JSON.stringify(step2Data)}`);
        }
        console.log('[PASS] Step 2: "All Versions" tab active with all 5 reports displayed');

        // ─── STEP 3: Search for 'GTM26-0002' ───
        console.log('Submitting search for "GTM26-0002"...');
        await pageCdp.send('Runtime.evaluate', {
            expression: `
                (() => {
                    const input = document.querySelector('input[type="text"]');
                    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                    nativeInputValueSetter.call(input, 'GTM26-0002');
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                    input.dispatchEvent(new Event('change', { bubbles: true }));
                    
                    const form = document.querySelector('form');
                    const submitBtn = form.querySelector('button[type="submit"]');
                    if (submitBtn) {
                        submitBtn.click();
                    } else if (form.requestSubmit) {
                        form.requestSubmit();
                    } else {
                        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
                    }
                })()
            `
        });
        await sleep(1500);

        const evalStep3 = await pageCdp.send('Runtime.evaluate', {
            expression: `
                (() => {
                    const rows = Array.from(document.querySelectorAll('table tbody tr'));
                    const input = document.querySelector('input[type="text"]');
                    const rowTexts = rows.map(r => r.innerText);
                    return {
                        inputValue: input ? input.value : '',
                        rowCount: rows.length,
                        onlyHas0002: rowTexts.every(t => t.includes('GTM26-0002')),
                        has0003: rowTexts.some(t => t.includes('GTM26-0003'))
                    };
                })()
            `,
            returnByValue: true
        });
        const step3Data = evalStep3.result.value;
        console.log('Step 3 Search Result:', step3Data);
        if (step3Data.rowCount !== 1 || !step3Data.onlyHas0002) {
            throw new Error(`[STEP3_FAILED] Expected exactly 1 report for GTM26-0002, got: ${JSON.stringify(step3Data)}`);
        }
        console.log('[PASS] Step 3: Search for "GTM26-0002" filtered to exactly 1 report');

        // ─── STEP 4: Exact #124 Transition: Click "Superseded" Tab ───
        console.log('[6/7] Clicking "Superseded" tab while "GTM26-0002" remains in search input...');
        await pageCdp.send('Runtime.evaluate', {
            expression: `
                (() => {
                    const buttons = Array.from(document.querySelectorAll('button'));
                    const supersededBtn = buttons.find(b => b.innerText.includes('Superseded'));
                    if (supersededBtn) {
                        supersededBtn.click();
                        return { clicked: true };
                    }
                    return { clicked: false };
                })()
            `
        });
        await sleep(1500);

        const evalStep4 = await pageCdp.send('Runtime.evaluate', {
            expression: `
                (() => {
                    const input = document.querySelector('input[type="text"]');
                    const bodyText = document.body.innerText;
                    const buttons = Array.from(document.querySelectorAll('button'));
                    const rows = Array.from(document.querySelectorAll('table tbody tr'));
                    const noReportsFound = bodyText.includes('No reports found');
                    const zeroReportsFoundText = bodyText.includes('0 reports found');
                    const supersededBtn = buttons.find(b => b.innerText.includes('Superseded'));
                    const supersededActive = supersededBtn ? supersededBtn.className.includes('bg-sf-emerald') : false;
                    const gtm0003Visible = bodyText.includes('GTM26-0003');

                    return {
                        inputValue: input ? input.value : '',
                        supersededActive,
                        noReportsFound,
                        zeroReportsFoundText,
                        rowCount: rows.length,
                        gtm0003Visible
                    };
                })()
            `,
            returnByValue: true
        });

        const step4Data = evalStep4.result.value;
        console.log('Step 4 Superseded Transition Result:', step4Data);

        if (step4Data.inputValue !== 'GTM26-0002') {
            throw new Error(`[INPUT_WIPED] Expected search input to retain 'GTM26-0002', was '${step4Data.inputValue}'`);
        }
        if (step4Data.gtm0003Visible) {
            throw new Error('[REGRESSION_DETECTED] Unrelated GTM26-0003 superseded report appeared when filtering for GTM26-0002!');
        }
        if (!step4Data.noReportsFound || step4Data.rowCount !== 0) {
            throw new Error(`[NO_MATCH_FAILED] Expected 0 reports / "No reports found", got rowCount=${step4Data.rowCount}`);
        }

        console.log('[PASS] Step 4: Retained "GTM26-0002" input, strictly displayed 0 reports ("No reports found"), and GTM26-0003 did NOT appear');

        // Capture High-Resolution Screenshot of this critical state
        console.log('Capturing high-resolution viewport screenshot of truthful no-match state...');
        const screenshotResult = await pageCdp.send('Page.captureScreenshot', {
            format: 'png',
            captureBeyondViewport: false
        });
        const screenshotPath = path.resolve(EVIDENCE_DIR, 'result_reports_filter_lifecycle_transition.png');
        fs.writeFileSync(screenshotPath, Buffer.from(screenshotResult.data, 'base64'));
        console.log('Saved screenshot to:', screenshotPath);

        // ─── STEP 5: Return to "All Versions" Tab ───
        console.log('Returning to "All Versions" tab...');
        await pageCdp.send('Runtime.evaluate', {
            expression: `
                (() => {
                    const buttons = Array.from(document.querySelectorAll('button'));
                    const allBtn = buttons.find(b => b.innerText.includes('All Versions'));
                    if (allBtn) allBtn.click();
                })()
            `
        });
        await sleep(1500);

        const evalStep5 = await pageCdp.send('Runtime.evaluate', {
            expression: `
                (() => {
                    const input = document.querySelector('input[type="text"]');
                    const rows = Array.from(document.querySelectorAll('table tbody tr'));
                    return {
                        inputValue: input ? input.value : '',
                        rowCount: rows.length,
                        onlyHas0002: rows.every(r => r.innerText.includes('GTM26-0002'))
                    };
                })()
            `,
            returnByValue: true
        });
        const step5Data = evalStep5.result.value;
        console.log('Step 5 Return All Versions Result:', step5Data);
        if (step5Data.rowCount !== 1 || !step5Data.onlyHas0002 || step5Data.inputValue !== 'GTM26-0002') {
            throw new Error(`[STEP5_FAILED] Expected 1 report matching GTM26-0002 restored, got: ${JSON.stringify(step5Data)}`);
        }
        console.log('[PASS] Step 5: "All Versions" tab restored 1 report matching "GTM26-0002"');

        // ─── STEP 6: Clear Search via Clear Button ───
        console.log('Clearing search via Clear button...');
        await pageCdp.send('Runtime.evaluate', {
            expression: `
                (() => {
                    const clearBtn = document.querySelector('button[aria-label="Clear search"]');
                    if (clearBtn) {
                        clearBtn.click();
                        return { clicked: true };
                    }
                    return { clicked: false };
                })()
            `
        });
        await sleep(1500);

        const evalStep6 = await pageCdp.send('Runtime.evaluate', {
            expression: `
                (() => {
                    const input = document.querySelector('input[type="text"]');
                    const rows = Array.from(document.querySelectorAll('table tbody tr'));
                    return {
                        inputValue: input ? input.value : null,
                        rowCount: rows.length
                    };
                })()
            `,
            returnByValue: true
        });
        const step6Data = evalStep6.result.value;
        console.log('Step 6 Cleared Search Result:', step6Data);
        if (step6Data.inputValue !== '' || step6Data.rowCount !== 5) {
            throw new Error(`[STEP6_FAILED] Expected input empty and 5 total reports restored, got: ${JSON.stringify(step6Data)}`);
        }
        console.log('[PASS] Step 6: Search cleared, input reset to empty, and all 5 reports restored');

        // ─── STEP 7: Same-Instance Project Scope Synchronization in Live Browser ───
        console.log('[7/8] Testing same-instance project scope synchronization via route update...');
        // 1. Navigate dynamically to GTM-PILOT-2026 on the same mounted page instance
        await pageCdp.send('Runtime.evaluate', {
            expression: `
                (() => {
                    window.history.pushState(null, '', '/result-reports?projectId=PRJ-GTM-PILOT-2026');
                    window.dispatchEvent(new PopStateEvent('popstate'));
                })()
            `
        });
        await sleep(1500);

        const evalStep7a = await pageCdp.send('Runtime.evaluate', {
            expression: `
                (() => {
                    const rows = Array.from(document.querySelectorAll('table tbody tr'));
                    const rowTexts = rows.map(r => r.innerText);
                    return {
                        rowCount: rows.length,
                        has0004: rowTexts.some(t => t.includes('GTM26-0004')),
                        has0001: rowTexts.some(t => t.includes('GTM26-0001')),
                        has0002: rowTexts.some(t => t.includes('GTM26-0002'))
                    };
                })()
            `,
            returnByValue: true
        });
        const step7aData = evalStep7a.result.value;
        console.log('Step 7a Project Scope Change Result:', step7aData);
        if (step7aData.rowCount !== 1 || !step7aData.has0004 || step7aData.has0001 || step7aData.has0002) {
            throw new Error(`[STEP7A_FAILED] Expected exactly 1 report (GTM26-0004) for GTM-PILOT-2026, got: ${JSON.stringify(step7aData)}`);
        }
        console.log('[PASS] Step 7a: Dynamic route update to GTM-PILOT-2026 correctly updated reports to GTM26-0004');

        // 2. Apply a search for 'GTM26-0004'
        console.log('Applying search for "GTM26-0004"...');
        await pageCdp.send('Runtime.evaluate', {
            expression: `
                (() => {
                    const input = document.querySelector('input[type="text"]');
                    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                    nativeInputValueSetter.call(input, 'GTM26-0004');
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                    input.dispatchEvent(new Event('change', { bubbles: true }));
                    const form = document.querySelector('form');
                    const submitBtn = form.querySelector('button[type="submit"]');
                    if (submitBtn) submitBtn.click();
                    else if (form.requestSubmit) form.requestSubmit();
                    else form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
                })()
            `
        });
        await sleep(1500);

        // 3. Switch project scope back to PRJ-GTM-SOIL-2026 while 'GTM26-0004' remains applied
        console.log('Switching project scope back to GTM-SOIL-2026 while search "GTM26-0004" is applied...');
        await pageCdp.send('Runtime.evaluate', {
            expression: `
                (() => {
                    window.history.pushState(null, '', '/result-reports?projectId=PRJ-GTM-SOIL-2026');
                    window.dispatchEvent(new PopStateEvent('popstate'));
                })()
            `
        });
        await sleep(1500);

        const evalStep7b = await pageCdp.send('Runtime.evaluate', {
            expression: `
                (() => {
                    const input = document.querySelector('input[type="text"]');
                    const rows = Array.from(document.querySelectorAll('table tbody tr'));
                    const bodyText = document.body.innerText;
                    return {
                        inputValue: input ? input.value : '',
                        rowCount: rows.length,
                        noReportsFound: bodyText.includes('No reports found')
                    };
                })()
            `,
            returnByValue: true
        });
        const step7bData = evalStep7b.result.value;
        console.log('Step 7b Project Switch with Applied Query Result:', step7bData);
        if (step7bData.inputValue !== 'GTM26-0004') {
            throw new Error(`[STEP7B_FAILED] Expected search input to retain 'GTM26-0004', was '${step7bData.inputValue}'`);
        }
        if (step7bData.rowCount !== 0 || !step7bData.noReportsFound) {
            throw new Error(`[STEP7B_FAILED] Expected 0 reports / "No reports found" in GTM-SOIL-2026 for GTM26-0004, got: ${JSON.stringify(step7bData)}`);
        }
        console.log('[PASS] Step 7b: Project scope switch strictly preserved applied search "GTM26-0004" and rendered truthful empty state');

        // 4. Clear search to restore GTM-SOIL-2026 reports
        await pageCdp.send('Runtime.evaluate', {
            expression: `
                (() => {
                    const clearBtn = document.querySelector('button[aria-label="Clear search"]');
                    if (clearBtn) clearBtn.click();
                })()
            `
        });
        await sleep(1500);

        // ─── STEP 8: Save Evidence JSON ───
        console.log('[8/8] Generating structured evidence report...');
        const evidencePayload = {
            timestamp: new Date().toISOString(),
            status: 'PASS',
            issue: '#124 Residual Fix',
            environment: {
                node: process.version,
                database: 'disposable_journey_result_reports.db',
                isolationRefusalGuard: 'ACTIVE'
            },
            verifiedSteps: {
                step1_initialPublishedRender: {
                    tabActive: 'PUBLISHED',
                    publishedCount: step1Data.rowCount,
                    status: 'PASS'
                },
                step2_allVersionsRender: {
                    tabActive: 'ALL',
                    totalCount: step2Data.rowCount,
                    status: 'PASS'
                },
                step3_searchFilterSubmit: {
                    searchedQuery: 'GTM26-0002',
                    matchingCount: step3Data.rowCount,
                    status: 'PASS'
                },
                step4_exactTransitionSupersededTruthfulNoMatch: {
                    activeTab: 'SUPERSEDED',
                    retainedSearchInput: step4Data.inputValue,
                    noReportsFoundText: step4Data.noReportsFound,
                    reportedZeroCount: step4Data.zeroReportsFoundText,
                    unrelated0003Suppressed: !step4Data.gtm0003Visible,
                    screenshot: 'artifacts/evidence-journeys/result_reports_filter_lifecycle_transition.png',
                    status: 'PASS'
                },
                step5_returnToAllVersions: {
                    retainedSearchInput: step5Data.inputValue,
                    matchingCount: step5Data.rowCount,
                    status: 'PASS'
                },
                step6_clearSearchRestoration: {
                    inputResetEmpty: step6Data.inputValue === '',
                    totalCountRestored: step6Data.rowCount,
                    status: 'PASS'
                },
                step7_sameInstanceProjectScopeSynchronization: {
                    switchedToPilotProject: step7aData.has0004 && step7aData.rowCount === 1,
                    preservedSearchAcrossScopeSwitch: step7bData.inputValue === 'GTM26-0004',
                    renderedTruthfulNoMatchWithoutLeak: step7bData.rowCount === 0 && step7bData.noReportsFound,
                    status: 'PASS'
                }
            }
        };

        const jsonPath = path.resolve(EVIDENCE_DIR, 'result_reports_filter_lifecycle_evidence.json');
        fs.writeFileSync(jsonPath, JSON.stringify(evidencePayload, null, 2));
        console.log('Saved evidence JSON to:', jsonPath);

        exitCode = 0;
    } catch (err) {

        console.error('\n[BROWSER_JOURNEY_FAILED]', err);
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
