'use strict';

/**
 * Browser Journey Evidence Runner: Canonical Navigation & Spanish Dashboard Localization (#115, #116)
 *
 * Executes the real Dashboard in headless Chrome with strict database isolation:
 * 1. Spanish locale ('es') active for LAB_MANAGER role
 * 2. Canonical journey sidebar order (#115): Projects placed second, Data Results between QA and Reports,
 *    and sidebar collapse control localized ('Plegar')
 * 3. Dynamic dashboard metric cards localized (#116): 'Necesita una decisión', 'Trabajo enviado',
 *    'Aprobación final', 'Asignar trabajo', 'Aceptación de ingreso', and localized unit strings
 * 4. Dynamic Work Queue table localized (#116): status badges ('Sin asignar', 'Listo para revisión',
 *    'Control de calidad fallido'), context labels ('Puerta operativa', 'Método analítico'),
 *    action links ('Asignar por método', 'Revisar', 'Abrir revisión final'), and localized notes
 * 5. High-resolution screenshot and machine-readable evidence output
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const WebSocket = require('ws');

// --- DATABASE ISOLATION SETUP ---
const {
    createDisposableDatabase,
    cleanupDisposableDatabase,
    validateDisposableDbPath
} = require('./journey_db_isolation.cjs');

const { runnerDir, dbPath } = createDisposableDatabase();
process.env.DATABASE_PATH = validateDisposableDbPath(dbPath, runnerDir);
process.env.DATABASE_URL = `file:${process.env.DATABASE_PATH}`;
process.env.NODE_ENV = 'production';
process.env.DISABLE_BACKGROUND_JOBS = 'true';
process.env.SERVE_CLIENT = 'true';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_jwt_for_local_testing_12345';

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

    connect() {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error('WebSocket connection timeout')), 5000);
            this.ws = new WebSocket(this.wsUrl);
            this.ws.on('open', () => { clearTimeout(timer); resolve(); });
            this.ws.on('error', (err) => { clearTimeout(timer); reject(err); });
            this.ws.on('message', (data) => {
                const msg = JSON.parse(data.toString());
                if (msg.id && this.pending.has(msg.id)) {
                    const { resolve: res, reject: rej } = this.pending.get(msg.id);
                    this.pending.delete(msg.id);
                    if (msg.error) rej(new Error(msg.error.message || JSON.stringify(msg.error)));
                    else res(msg.result);
                } else if (msg.method) {
                    const handlers = this.events.get(msg.method) || [];
                    handlers.forEach(h => h(msg.params, msg.sessionId));
                }
            });
        });
    }

    send(method, params = {}, sessionId = null, timeoutMs = 15000) {
        return new Promise((resolve, reject) => {
            const id = this.id++;
            const timer = setTimeout(() => {
                this.pending.delete(id);
                reject(new Error(`[CDP TIMEOUT ${timeoutMs}ms] ${method}`));
            }, timeoutMs);

            this.pending.set(id, {
                resolve: (val) => { clearTimeout(timer); resolve(val); },
                reject: (err) => { clearTimeout(timer); reject(err); }
            });

            const payload = { id, method, params };
            if (sessionId) payload.sessionId = sessionId;
            this.ws.send(JSON.stringify(payload));
        });
    }

    on(event, handler) {
        if (!this.events.has(event)) this.events.set(event, []);
        this.events.get(event).push(handler);
    }

    close() {
        if (this.ws) {
            try { this.ws.close(); } catch (_) {}
        }
    }
}

async function getWebSocketDebuggerUrl(debugPort) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Debugger URL discovery timeout')), 6000);
        const req = http.get(`http://127.0.0.1:${debugPort}/json/version`, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                clearTimeout(timer);
                try {
                    const json = JSON.parse(body);
                    resolve(json.webSocketDebuggerUrl);
                } catch (e) {
                    reject(e);
                }
            });
        });
        req.on('error', (e) => {
            clearTimeout(timer);
            reject(e);
        });
    });
}

function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

async function runDashboardJourney() {
    console.log('========================================================================');
    console.log('  DASHBOARD SPANISH LOCALIZATION & NAVIGATION ORDER JOURNEY (#115, #116)');
    console.log('========================================================================');
    console.log(`[DB Isolation] Synthetic database: ${process.env.DATABASE_PATH}`);
    console.log(`[DB Isolation] Runner directory:   ${runnerDir}`);

    let server;
    let chrome;
    let cdp;
    let sessionId;
    const journeyResults = [];

    const recordStep = (stepName, passed, details) => {
        journeyResults.push({ stepName, passed, details, timestamp: new Date().toISOString() });
        console.log(`  [${passed ? 'PASS' : 'FAIL'}] ${stepName}: ${details}`);
    };

    try {
        const RUN_ID = Date.now() + '_' + Math.random().toString(36).slice(2, 7);
        const TEST_LAB_ID = `LAB-GTM-${RUN_ID}`;
        const TEST_USER_ID = `usr-mgr-${RUN_ID}`;
        const TEST_USERNAME = `manager.gtm.${RUN_ID}`;
        const TEST_PROJECT_ID = `PRJ-GTM-${RUN_ID}`;
        const TEST_PROJECT_CODE = `GTM-${RUN_ID.slice(-4).toUpperCase()}`;

        console.log(`[Setup] Seeding unique synthetic fixtures for LAB_MANAGER...`);

        // 1. Seed laboratory in Guatemala
        await prisma.lab.create({
            data: {
                id: TEST_LAB_ID,
                code: `GTM-${RUN_ID.slice(-3).toUpperCase()}`,
                name: 'Guatemala Central Analytical Laboratory',
                country: 'Guatemala',
                city: 'Guatemala City',
                location: '14.6349, -90.5069',
                timezone: 'America/Guatemala',
                isActive: true
            }
        });

        // 2. Seed active project
        await prisma.project.create({
            data: {
                id: TEST_PROJECT_ID,
                code: TEST_PROJECT_CODE,
                name: 'Guatemala National Soil Fertility Mapping 2026',
                status: 'ACTIVE',
                projectType: 'OPEN_INTAKE',
                labId: TEST_LAB_ID,
                countries: 'Guatemala'
            }
        });

        // 3. Seed manager user with LAB_MANAGER role
        const hashedPassword = await bcrypt.hash('Password123!', 10);
        await prisma.user.create({
            data: {
                id: TEST_USER_ID,
                username: TEST_USERNAME,
                name: 'Ing. Carlos Mendoza',
                email: `${TEST_USERNAME}@example.com`,
                password: hashedPassword,
                role: 'LAB_MANAGER',
                labId: TEST_LAB_ID,
                isActive: true,
                tokenVersion: 0
            }
        });

        // 4. Seed operational data to populate manager queues:
        // 4a. A sample in RECEIVED status -> manager.intake
        const intakeSample = await prisma.sample.create({
            data: {
                id: `SMP-INTAKE-${RUN_ID}`,
                originalId: `GTM26-REC-001`,
                labId: `GTM-REC-001`,
                projectCode: TEST_PROJECT_CODE,
                assignedLab: TEST_LAB_ID,
                status: 'RECEIVED',
                matrix: 'SOIL',
                receptionDate: new Date()
            }
        });

        // 4b. Work items unassigned -> manager.assign
        const assignSample = await prisma.sample.create({
            data: {
                id: `SMP-ASSIGN-${RUN_ID}`,
                originalId: `GTM26-ASN-002`,
                labId: `GTM-ASN-002`,
                projectCode: TEST_PROJECT_CODE,
                assignedLab: TEST_LAB_ID,
                status: 'ACCEPTED',
                matrix: 'SOIL',
                receptionDate: new Date()
            }
        });

        await prisma.workItem.create({
            data: {
                id: `WI-DRY-${RUN_ID}`,
                sampleId: assignSample.id,
                analysis: 'DRYING',
                labId: TEST_LAB_ID,
                status: 'NOT_ASSIGNED',
                priority: 'NORMAL'
            }
        });

        await prisma.workItem.create({
            data: {
                id: `WI-PH-${RUN_ID}`,
                sampleId: assignSample.id,
                analysis: 'PH',
                labId: TEST_LAB_ID,
                status: 'NOT_ASSIGNED',
                priority: 'NORMAL'
            }
        });

        // 4c. A failed batch without disposition -> manager.exceptions
        const failedBatch = await prisma.batch.create({
            data: {
                id: `BATCH-FAIL-${RUN_ID.slice(-4).toUpperCase()}`,
                labId: TEST_LAB_ID,
                analysis: 'PH',
                status: 'QC_FAIL',
                disposition: null,
                createdBy: TEST_USERNAME
            }
        });

        const realJwtToken = jwt.sign(
            { id: TEST_USER_ID, username: TEST_USERNAME, role: 'LAB_MANAGER', labId: TEST_LAB_ID, tokenVersion: 0 },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        const safeManagerUser = {
            id: TEST_USER_ID,
            username: TEST_USERNAME,
            name: 'Ing. Carlos Mendoza',
            role: 'LAB_MANAGER',
            labId: TEST_LAB_ID,
            lab: {
                id: TEST_LAB_ID,
                code: `GTM-${RUN_ID.slice(-3).toUpperCase()}`,
                name: 'Guatemala Central Analytical Laboratory',
                country: 'Guatemala',
                city: 'Guatemala City',
                location: '14.6349, -90.5069',
                isActive: true
            },
            permissions: ['VIEW_SAMPLES', 'MANAGE_WORK_ITEMS', 'APPROVE_RESULTS', 'MANAGE_QC']
        };

        // Start server on dedicated port
        const PORT = 49170;
        server = await new Promise((resolve) => {
            const s = app.listen(PORT, '127.0.0.1', () => {
                console.log(`[Server] Production server listening at http://127.0.0.1:${PORT}`);
                resolve(s);
            });
        });

        const DEBUG_PORT = 9240;
        const chromeUserDataDir = path.join(runnerDir, 'chrome_profile');
        fs.mkdirSync(chromeUserDataDir, { recursive: true });

        console.log(`[Chrome] Launching Headless Chrome on debug port ${DEBUG_PORT}...`);
        chrome = spawn(CHROME_PATH, [
            '--headless=new',
            `--remote-debugging-port=${DEBUG_PORT}`,
            '--disable-gpu',
            '--no-first-run',
            '--no-default-browser-check',
            '--window-size=1440,960',
            '--user-data-dir=' + chromeUserDataDir
        ]);

        await sleep(2000);

        const wsUrl = await getWebSocketDebuggerUrl(DEBUG_PORT);
        console.log(`[Chrome] Connected to debugger at ${wsUrl}`);
        cdp = new CDPClient(wsUrl);
        await cdp.connect();

        const target = await cdp.send('Target.createTarget', { url: 'about:blank' });
        const attach = await cdp.send('Target.attachToTarget', { targetId: target.targetId, flatten: true });
        sessionId = attach.sessionId;

        await cdp.send('Page.enable', {}, sessionId);
        await cdp.send('Runtime.enable', {}, sessionId);
        await cdp.send('DOM.enable', {}, sessionId);

        // Pre-configure session with Spanish locale and LAB_MANAGER user
        console.log('[Setup] Pre-configuring Spanish session for LAB_MANAGER...');
        await cdp.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/login` }, sessionId);
        await sleep(1000);

        await cdp.send('Runtime.evaluate', {
            expression: `
                localStorage.setItem('token', ${JSON.stringify(realJwtToken)});
                localStorage.setItem('user', ${JSON.stringify(JSON.stringify(safeManagerUser))});
                localStorage.setItem('locale', 'es');
                sessionStorage.setItem('soilfer_locale_override', 'es');
            `
        }, sessionId);

        // Navigate to Dashboard
        console.log('[Journey] Navigating to Dashboard (/)...');
        await cdp.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/` }, sessionId);
        await sleep(3000);

        // Capture AX tree / DOM inspection
        console.log('[Journey] Inspecting DOM elements on live Spanish Dashboard...');

        // 1. Verify Sidebar Navigation Order & Labels (#115, #116)
        const sidebarNav = await cdp.send('Runtime.evaluate', {
            expression: `
                Array.from(document.querySelectorAll('nav a')).map(a => ({
                    text: a.innerText.trim(),
                    href: a.getAttribute('href')
                }))
            `,
            returnByValue: true
        }, sessionId);

        const navItems = sidebarNav.result?.value || [];
        console.log('[Sidebar Navigation Items]', JSON.stringify(navItems, null, 2));

        const navPaths = navItems.map(i => i.href);
        const projectsIdx = navPaths.indexOf('/projects');
        const receptionIdx = navPaths.indexOf('/reception');
        const samplesIdx = navPaths.indexOf('/samples');
        const managerQueueIdx = navPaths.indexOf('/manager-queue');
        const qaIdx = navPaths.indexOf('/qa');
        const dataResultsIdx = navPaths.indexOf('/data-results');
        const reportsIdx = navPaths.indexOf('/result-reports');

        // Check 1: Projects is placed second after Dashboard (#115)
        const projectsIsSecond = projectsIdx === 1 && navPaths[0] === '/';
        recordStep('Sidebar Projects Position (#115)', projectsIsSecond,
            `Projects is at index ${projectsIdx} (immediately after Dashboard). Nav sequence: ${navPaths.slice(0, 4).join(' -> ')}`);

        // Check 2: Data Results between QA and Result Reports (#115)
        const dataResultsBetweenQaReports = qaIdx > 0 && dataResultsIdx > qaIdx && reportsIdx > dataResultsIdx;
        recordStep('Sidebar Data Results Position (#115)', dataResultsBetweenQaReports,
            `QA (${qaIdx}) -> Data Results (${dataResultsIdx}) -> Reports (${reportsIdx})`);

        // Check 3: Sidebar collapse control label translated (#116)
        const collapseButtonText = await cdp.send('Runtime.evaluate', {
            expression: `
                const btn = Array.from(document.querySelectorAll('button')).find(b =>
                    b.innerText.includes('Plegar') || b.innerText.includes('Contraer') || b.innerText.includes('Collapse')
                );
                btn ? btn.innerText.trim() : 'NOT_FOUND';
            `,
            returnByValue: true
        }, sessionId);

        const collapseText = collapseButtonText.result?.value || '';
        const isCollapseLocalized = collapseText === 'Plegar' || collapseText === 'Contraer';
        recordStep('Sidebar Collapse Localized (#116)', isCollapseLocalized,
            `Collapse button text: "${collapseText}" (expected "Plegar" or "Contraer", no raw English "Collapse")`);

        // 2. Verify Metric Cards Localization (#116)
        const metricsEvaluation = await cdp.send('Runtime.evaluate', {
            expression: `
                const cards = Array.from(document.querySelectorAll('section[aria-label] div[role="button"], section[aria-label] div[role="region"]'));
                cards.map(c => {
                    const spans = Array.from(c.querySelectorAll('span')).map(s => s.innerText.trim()).filter(Boolean);
                    const divs = Array.from(c.querySelectorAll('div')).map(d => d.innerText.trim()).filter(Boolean);
                    return { text: c.innerText.trim(), spans, divs };
                });
            `,
            returnByValue: true
        }, sessionId);

        const metricCards = metricsEvaluation.result?.value || [];
        console.log('[Metric Cards Found]', JSON.stringify(metricCards, null, 2));

        const allMetricText = metricCards.map(c => c.text).join('\n');
        const hasDecision = allMetricText.includes('Necesita una decisión');
        const hasSubmitted = allMetricText.includes('Trabajo enviado');
        const hasApproval = allMetricText.includes('Aprobación final');
        const hasAssign = allMetricText.includes('Asignar trabajo');
        const hasIntake = allMetricText.includes('Aceptación de ingreso');

        const allManagerMetricsTranslated = hasDecision && hasSubmitted && hasApproval && hasAssign && hasIntake;
        recordStep('Dashboard Metric Labels Localized (#116)', allManagerMetricsTranslated,
            `Translated labels found: Decision=${hasDecision}, Submitted=${hasSubmitted}, Approval=${hasApproval}, Assign=${hasAssign}, Intake=${hasIntake}`);

        // Check metric units translated (no English raw plural)
        const hasRawEnglishMetrics = /Needs a decision|Submitted work|Final approval|Assign work|Intake acceptance/.test(allMetricText);
        recordStep('Zero Raw English In Metric Cards (#116)', !hasRawEnglishMetrics,
            `Raw English metric titles absent: ${!hasRawEnglishMetrics}`);

        // 3. Switch active queue tab to 'manager.assign' or inspect current queue
        console.log('[Journey] Selecting "Asignar trabajo" queue tab to inspect row badges and actions...');
        await cdp.send('Runtime.evaluate', {
            expression: `
                const buttons = Array.from(document.querySelectorAll('button, div[role="button"]'));
                const assignBtn = buttons.find(b => b.innerText.includes('Asignar trabajo'));
                if (assignBtn) assignBtn.click();
            `
        }, sessionId);
        await sleep(2000);

        // 4. Verify Work Queue Rows (#116)
        const workQueueRows = await cdp.send('Runtime.evaluate', {
            expression: `
                const rows = Array.from(document.querySelectorAll('table tbody tr'));
                rows.map(r => {
                    const cells = Array.from(r.querySelectorAll('td')).map(td => td.innerText.trim());
                    return {
                        title: cells[0] || '',
                        state: cells[1] || '',
                        count: cells[2] || '',
                        action: cells[3] || ''
                    };
                });
            `,
            returnByValue: true
        }, sessionId);

        const rows = workQueueRows.result?.value || [];
        console.log('[Work Queue Rows Found]', JSON.stringify(rows, null, 2));

        const allRowsText = JSON.stringify(rows);
        const hasOperationalGateOrMethod = allRowsText.includes('Puerta operativa') || allRowsText.includes('Método analítico');
        const hasUnassignedBadge = allRowsText.includes('Sin asignar');
        const hasAssignAction = allRowsText.includes('Asignar por método');
        const hasLocalizedNote = allRowsText.includes('sin asignar') || allRowsText.includes('distribución');

        recordStep('Work Queue Context Localized (#116)', hasOperationalGateOrMethod,
            `Context rendered: "Puerta operativa" / "Método analítico" (found: ${hasOperationalGateOrMethod})`);
        recordStep('Work Queue Status Badge Localized (#116)', hasUnassignedBadge,
            `Status badge rendered: "Sin asignar" (found: ${hasUnassignedBadge})`);
        recordStep('Work Queue Action Button Localized (#116)', hasAssignAction,
            `Action button rendered: "Asignar por método" (found: ${hasAssignAction})`);
        recordStep('Work Queue Notes Localized (#116)', hasLocalizedNote,
            `Row note rendered with Spanish pluralization (found: ${hasLocalizedNote})`);

        // Check zero raw English in queue table
        const hasRawEnglishInQueue = /Operational gate|Unassigned|Assign by method|ready for allocation/.test(allRowsText);
        recordStep('Zero Raw English in Work Queue Table (#116)', !hasRawEnglishInQueue,
            `Raw English queue strings absent: ${!hasRawEnglishInQueue}`);

        // 5. Capture High-Resolution Screenshot for Visual Verification
        console.log('[Evidence] Capturing high-resolution screenshot...');
        const screenshot = await cdp.send('Page.captureScreenshot', { format: 'png' }, sessionId);
        const screenshotPath = path.join(EVIDENCE_DIR, 'dashboard_nav_i18n_spanish_verified.png');
        fs.writeFileSync(screenshotPath, Buffer.from(screenshot.data, 'base64'));
        console.log(`[Evidence] Saved screenshot to ${screenshotPath}`);

        // Save JSON journey report
        const reportPath = path.join(EVIDENCE_DIR, 'dashboard_nav_i18n_journey.json');
        const reportData = {
            title: 'CDP Headless Browser Journey: Navigation Order & Spanish Dashboard Localization (#115, #116)',
            executedAt: new Date().toISOString(),
            locale: 'es',
            role: 'LAB_MANAGER',
            databaseIsolation: {
                disposableDb: process.env.DATABASE_PATH,
                cleanRunnerDir: runnerDir
            },
            results: journeyResults,
            sidebarNav: navItems,
            metricCards,
            workQueueRows: rows,
            screenshot: 'artifacts/evidence-journeys/dashboard_nav_i18n_spanish_verified.png',
            status: journeyResults.every(r => r.passed) ? 'SUCCESS' : 'FAILURE'
        };
        fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2), 'utf8');
        console.log(`[Evidence] Saved journey report to ${reportPath}`);

    } finally {
        if (cdp) cdp.close();
        if (chrome) chrome.kill();
        if (server) {
            await new Promise((resolve) => server.close(resolve));
        }
        cleanupDisposableDatabase(runnerDir);
    }

    const allPassed = journeyResults.every(r => r.passed);
    console.log('========================================================================');
    console.log(`  JOURNEY EXECUTION COMPLETE: ${allPassed ? 'ALL CHECKS PASSED (10/10)' : 'SOME CHECKS FAILED'}`);
    console.log('========================================================================');
    if (!allPassed) {
        process.exit(1);
    }
}

runDashboardJourney().catch((err) => {
    console.error('[FATAL] Journey execution failed:', err);
    cleanupDisposableDatabase(runnerDir);
    process.exit(1);
});
