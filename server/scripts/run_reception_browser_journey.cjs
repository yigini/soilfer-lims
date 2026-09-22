'use strict';

/**
 * Browser Journey Evidence Runner: Real Reception Route & Lifecycle Contracts (#113, #114, #117)
 *
 * Executes the real Reception page in headless Chrome with strict database isolation:
 * 1. Initial page load (parent & child integration, no TDZ crash)
 * 2. Walk-in mode entry (WalkInForm + ComplianceChecklist child mounted together)
 * 3. CoC N/A selection in Walk-in mode
 * 4. Mode-switch cleanup: Walk-in to Project mode, verifying useEffect clears prohibited CoC N/A (with strict inProjectMode assertion)
 * 5. Fail selection, note entry, and correction back to OK (non-conformance cleared)
 * 6. Authentic 10-second autosave observation and reload/restore lifecycle (no injected JSON)
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
    const testRunnerDir = path.resolve(__dirname, '..', '.tmp_journey_runner_refusal_test');
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

// 2. NOW import Prisma, App, and Auth dependencies
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

async function waitForCondition(evalFn, description, timeoutMs = 15000, intervalMs = 250) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        try {
            const res = await evalFn();
            if (res) return res;
        } catch (_) {}
        await sleep(intervalMs);
    }
    throw new Error(`[TIMEOUT ${timeoutMs}ms] Condition not met: ${description}`);
}

async function runBrowserJourney() {
    console.log('===============================================================');
    console.log('  RECEPTION BROWSER JOURNEY ACCEPTANCE EXECUTION (#113, #114, #117)');
    console.log('===============================================================');
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
        // Generate Unique Fixture Identifiers to prevent cross-run or dev collisions
        const RUN_ID = Date.now() + '_' + Math.random().toString(36).slice(2, 7);
        const TEST_LAB_ID = `LAB-JRN-${RUN_ID}`;
        const TEST_USER_ID = `usr-jrn-${RUN_ID}`;
        const TEST_USERNAME = `tech.jrn.${RUN_ID}`;
        const TEST_PROJECT_ID = `PRJ-JRN-${RUN_ID}`;
        const TEST_PROJECT_CODE = `PRJ-${RUN_ID.slice(-4).toUpperCase()}`;

        console.log(`[Setup] Seeding unique fixtures (Lab: ${TEST_LAB_ID}, User: ${TEST_USER_ID}, Proj: ${TEST_PROJECT_CODE})...`);

        // 1. Seed unique laboratory
        await prisma.lab.create({
            data: {
                id: TEST_LAB_ID,
                code: `L${RUN_ID.slice(-3).toUpperCase()}`,
                name: 'Lusaka Central Laboratory',
                country: 'Zambia',
                city: 'Lusaka',
                location: '-15.4167, 28.2833',
                isActive: true
            }
        });

        // 2. Seed active project for Project-mode selection
        await prisma.project.create({
            data: {
                id: TEST_PROJECT_ID,
                code: TEST_PROJECT_CODE,
                name: 'National Soil Health Survey 2026',
                status: 'ACTIVE',
                projectType: 'OPEN_INTAKE',
                labId: TEST_LAB_ID,
                countries: 'Zambia'
            }
        });

        // 3. Seed technician user with SAMPLE_RECEPTION role
        const hashedPassword = await bcrypt.hash('Password123!', 10);
        await prisma.user.create({
            data: {
                id: TEST_USER_ID,
                username: TEST_USERNAME,
                email: `${TEST_USERNAME}@example.com`,
                password: hashedPassword,
                role: 'SAMPLE_RECEPTION',
                labId: TEST_LAB_ID,
                isActive: true,
                tokenVersion: 0
            }
        });

        const realJwtToken = jwt.sign(
            { id: TEST_USER_ID, username: TEST_USERNAME, role: 'SAMPLE_RECEPTION', tokenVersion: 0 },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        const safeReceptionUser = {
            id: TEST_USER_ID,
            username: TEST_USERNAME,
            name: 'Jane Receptionist',
            role: 'SAMPLE_RECEPTION',
            labId: TEST_LAB_ID,
            lab: {
                id: TEST_LAB_ID,
                code: `L${RUN_ID.slice(-3).toUpperCase()}`,
                name: 'Lusaka Central Laboratory',
                country: 'Zambia',
                city: 'Lusaka',
                location: '-15.4167, 28.2833',
                isActive: true
            },
            labLocation: '-15.4167, 28.2833',
            permissions: ['RECEIVE_SAMPLE', 'VIEW_SAMPLES', 'CREATE_SAMPLE', 'CHANGE_STATUS']
        };

        // Start Express production server serving client/dist
        const PORT = 49160;
        server = await new Promise((resolve) => {
            const s = app.listen(PORT, '127.0.0.1', () => {
                console.log(`[Server] Production server listening at http://127.0.0.1:${PORT}`);
                resolve(s);
            });
        });

        const DEBUG_PORT = 9230;
        // Temporary Chrome profile placed strictly within the disposable runner directory
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

        const browserExceptions = [];
        cdp.on('Runtime.exceptionThrown', (params) => {
            const desc = params.exceptionDetails?.exception?.description || params.exceptionDetails?.text;
            console.error('[Browser Exception]', desc);
            browserExceptions.push(desc);
        });

        await cdp.send('Page.enable', {}, sessionId);
        await cdp.send('Runtime.enable', {}, sessionId);
        await cdp.send('DOM.enable', {}, sessionId);

        // Pre-configure session in browser origin
        console.log('[Setup] Pre-configuring reception session in browser origin...');
        await cdp.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/login` }, sessionId);
        await sleep(1000);

        await cdp.send('Runtime.evaluate', {
            expression: `
                (() => {
                    localStorage.setItem('user', ${JSON.stringify(JSON.stringify(safeReceptionUser))});
                    localStorage.setItem('token', ${JSON.stringify(realJwtToken)});
                    localStorage.setItem('language', 'en');
                    localStorage.setItem('locale', 'en');
                    localStorage.removeItem('limsi_intake_autosave');
                })()
            `
        }, sessionId);

        // --- JOURNEY 1: Load Reception Route ---
        console.log('\n--- JOURNEY 1: Navigation to /reception & TDZ Check ---');
        await cdp.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/reception` }, sessionId);

        await waitForCondition(async () => {
            const res = await cdp.send('Runtime.evaluate', {
                expression: `Boolean(document.querySelector('[data-tour="reception-container"]'))`,
                returnByValue: true
            }, sessionId);
            return res.result?.value;
        }, 'Reception Console root element rendered');

        const consoleText = await cdp.send('Runtime.evaluate', {
            expression: `document.body.innerText`,
            returnByValue: true
        }, sessionId);

        const hasNoTDZCrash = !browserExceptions.some(e => e.includes('checklistData'));
        const rendersModes = consoleText.result.value.includes('Reception Console') &&
                             consoleText.result.value.includes('Project Sample') &&
                             consoleText.result.value.includes('Walk-in Sample');

        recordStep('Reception First Render & TDZ Prevention', hasNoTDZCrash && rendersModes,
            `Rendered without checklistData ReferenceError; Modes visible: ${rendersModes}`);

        // --- JOURNEY 2: Mount Walk-in Sample Mode & Child Checklist ---
        console.log('\n--- JOURNEY 2: Click Walk-in Sample & Mount Child Checklist ---');
        await cdp.send('Runtime.evaluate', {
            expression: `
                (() => {
                    const buttons = Array.from(document.querySelectorAll('button'));
                    const walkInBtn = buttons.find(b => b.innerText.includes('Walk-in Sample'));
                    if (walkInBtn) {
                        walkInBtn.click();
                        return true;
                    }
                    return false;
                })()
            `
        }, sessionId);

        await waitForCondition(async () => {
            const res = await cdp.send('Runtime.evaluate', {
                expression: `Boolean(document.querySelector('button[aria-label="Chain of Custody Present: N/A"]'))`,
                returnByValue: true
            }, sessionId);
            return res.result?.value;
        }, 'ComplianceChecklist child component mounted with CoC button');

        const childChecklistMounted = await cdp.send('Runtime.evaluate', {
            expression: `
                (() => {
                    const cocBtn = document.querySelector('button[aria-label="Chain of Custody Present: N/A"]');
                    const containerBtn = document.querySelector('button[aria-label="Container Intact / Sealed: OK"]');
                    const labelBtn = document.querySelector('button[aria-label="Label Legible & Matches ID: OK"]');
                    const walkInHeader = document.body.innerText.includes('Walk-in Reception');
                    return Boolean(cocBtn && containerBtn && labelBtn && walkInHeader);
                })()
            `,
            returnByValue: true
        }, sessionId);

        recordStep('Parent & Child Integration', childChecklistMounted.result.value,
            'WalkInForm and ComplianceChecklist child components mounted together in Reception parent');

        // --- JOURNEY 3: CoC N/A Selection in Walk-in Mode ---
        console.log('\n--- JOURNEY 3: CoC N/A Selection (Walk-in Mode) ---');
        const cocNAEnabled = await cdp.send('Runtime.evaluate', {
            expression: `
                (() => {
                    const cocNABtn = document.querySelector('button[aria-label="Chain of Custody Present: N/A"]');
                    return cocNABtn && !cocNABtn.disabled;
                })()
            `,
            returnByValue: true
        }, sessionId);

        await cdp.send('Runtime.evaluate', {
            expression: `
                (() => {
                    const cocNABtn = document.querySelector('button[aria-label="Chain of Custody Present: N/A"]');
                    cocNABtn.click();
                })()
            `
        }, sessionId);

        await sleep(400);

        const cocNAChecked = await cdp.send('Runtime.evaluate', {
            expression: `
                (() => {
                    const cocNABtn = document.querySelector('button[aria-label="Chain of Custody Present: N/A"]');
                    return cocNABtn && cocNABtn.getAttribute('aria-checked') === 'true';
                })()
            `,
            returnByValue: true
        }, sessionId);

        recordStep('Walk-in CoC N/A Permitted', cocNAEnabled.result.value && cocNAChecked.result.value,
            `CoC N/A enabled: ${cocNAEnabled.result.value}, aria-checked=true: ${cocNAChecked.result.value}`);

        // --- JOURNEY 4: Real Project Mode Confirmation & CoC N/A Cleanup Effect ---
        console.log('\n--- JOURNEY 4: Mode-switch Cleanup (Walk-in -> Project resets CoC N/A) ---');
        // Trigger Alt+1 keyboard shortcut to switch mode directly to PROJECT without wiping state
        await cdp.send('Runtime.evaluate', {
            expression: `
                (() => {
                    window.dispatchEvent(new KeyboardEvent('keydown', { key: '1', altKey: true, bubbles: true }));
                })()
            `
        }, sessionId);

        await sleep(600);

        // Verify mode switched to PROJECT: Reception renders "Select Project Session" or active Project header
        const projectModeConfirmed = await waitForCondition(async () => {
            const res = await cdp.send('Runtime.evaluate', {
                expression: `
                    (() => {
                        const hasSelectProject = document.body.innerText.includes('Select Project Session');
                        const hasProjectHeader = document.body.innerText.includes('Project:');
                        return hasSelectProject || hasProjectHeader;
                    })()
                `,
                returnByValue: true
            }, sessionId);
            return res.result?.value;
        }, 'Project mode interface displayed');

        // Click active project card to confirm project session
        await cdp.send('Runtime.evaluate', {
            expression: `
                (() => {
                    const buttons = Array.from(document.querySelectorAll('button'));
                    const projCard = buttons.find(b => b.innerText.includes(${JSON.stringify(TEST_PROJECT_CODE)}) || b.innerText.includes('National Soil Health Survey'));
                    if (projCard) projCard.click();
                })()
            `
        }, sessionId);

        await sleep(600);

        // Verify active Project header
        const inActiveProjectSession = await cdp.send('Runtime.evaluate', {
            expression: `
                (() => {
                    return document.body.innerText.includes('Project:') || document.body.innerText.includes('Scheduled project') || document.body.innerText.includes('Open intake');
                })()
            `,
            returnByValue: true
        }, sessionId);

        // Requirement: inProjectMode must be TRUE
        const inProjectMode = projectModeConfirmed && inActiveProjectSession.result?.value;

        // Trigger Alt+2 keyboard shortcut to return to WALK_IN mode
        await cdp.send('Runtime.evaluate', {
            expression: `
                (() => {
                    window.dispatchEvent(new KeyboardEvent('keydown', { key: '2', altKey: true, bubbles: true }));
                })()
            `
        }, sessionId);

        await sleep(600);

        // Inspect that CoC N/A was cleared by useEffect upon entering PROJECT mode
        const cocNACleared = await cdp.send('Runtime.evaluate', {
            expression: `
                (() => {
                    const cocNABtn = document.querySelector('button[aria-label="Chain of Custody Present: N/A"]');
                    return cocNABtn && cocNABtn.getAttribute('aria-checked') === 'false';
                })()
            `,
            returnByValue: true
        }, sessionId);

        const modeSwitchSuccess = inProjectMode && cocNACleared.result?.value;
        recordStep('Mode-Switch Cleanup Effect Execution', modeSwitchSuccess,
            `inProjectMode confirmed: ${inProjectMode}, useEffect executed and cleared prohibited CoC N/A (aria-checked=false): ${cocNACleared.result?.value}`);

        // --- JOURNEY 5: Select Fail, Record Note, Correct to OK ---
        console.log('\n--- JOURNEY 5: Select Fail, Note Entry, and Correction to OK ---');
        // Click Fail on Container Intact
        await cdp.send('Runtime.evaluate', {
            expression: `
                (() => {
                    const failBtn = document.querySelector('button[aria-label="Container Intact / Sealed: Fail"]');
                    if (failBtn) failBtn.click();
                })()
            `
        }, sessionId);

        await sleep(400);

        // Enter failure note into the failure input using controlled-input native setter
        const noteText = 'Bag torn at seam during transport';
        await cdp.send('Runtime.evaluate', {
            expression: `
                (() => {
                    const noteInput = document.querySelector('input[placeholder="e.g. Bag torn, lid loose, visible leakage..."]');
                    if (noteInput) {
                        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                        setter.call(noteInput, ${JSON.stringify(noteText)});
                        noteInput.dispatchEvent(new Event('input', { bubbles: true }));
                        noteInput.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                })()
            `
        }, sessionId);

        await sleep(300);

        // Assert note state in the DOM before correcting it
        const noteAsserted = await cdp.send('Runtime.evaluate', {
            expression: `
                (() => {
                    const failBtn = document.querySelector('button[aria-label="Container Intact / Sealed: Fail"]');
                    const noteInput = document.querySelector('input[placeholder="e.g. Bag torn, lid loose, visible leakage..."]');
                    const isFailChecked = failBtn && failBtn.getAttribute('aria-checked') === 'true';
                    const hasExactNote = noteInput && noteInput.value === ${JSON.stringify(noteText)};
                    return Boolean(isFailChecked && hasExactNote);
                })()
            `,
            returnByValue: true
        }, sessionId);

        // Correct item by clicking OK
        await cdp.send('Runtime.evaluate', {
            expression: `
                (() => {
                    const okBtn = document.querySelector('button[aria-label="Container Intact / Sealed: OK"]');
                    if (okBtn) okBtn.click();
                })()
            `
        }, sessionId);

        await sleep(400);

        const correctedToOK = await cdp.send('Runtime.evaluate', {
            expression: `
                (() => {
                    const okBtn = document.querySelector('button[aria-label="Container Intact / Sealed: OK"]');
                    const noteInput = document.querySelector('input[placeholder="e.g. Bag torn, lid loose, visible leakage..."]');
                    return Boolean(okBtn && okBtn.getAttribute('aria-checked') === 'true' && !noteInput);
                })()
            `,
            returnByValue: true
        }, sessionId);

        recordStep('Checklist Fail & Correction Lifecycle', noteAsserted.result.value && correctedToOK.result.value,
            `Fail and note asserted before correction: ${noteAsserted.result.value}, Correction back to OK cleared note: ${correctedToOK.result.value}`);

        // --- JOURNEY 6: Real 10-Second Autosave & Reopen/Restore ---
        console.log('\n--- JOURNEY 6: Real 10-Second Autosave & Reopen/Restore Lifecycle ---');
        // Clear any previous draft in localStorage before exercise
        await cdp.send('Runtime.evaluate', {
            expression: `localStorage.removeItem('limsi_intake_autosave')`
        }, sessionId);

        // 1. Enter Submitter details via real input events
        const submitterName = 'Farmer Chanda';
        const submitterPhone = '+260971234567';
        await cdp.send('Runtime.evaluate', {
            expression: `
                (() => {
                    const nameInput = document.querySelector('input[data-field-key="submitter.name"]');
                    const phoneInput = document.querySelector('input[data-field-key="submitter.phone"]');
                    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;

                    if (nameInput) {
                        setter.call(nameInput, ${JSON.stringify(submitterName)});
                        nameInput.dispatchEvent(new Event('input', { bubbles: true }));
                        nameInput.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                    if (phoneInput) {
                        setter.call(phoneInput, ${JSON.stringify(submitterPhone)});
                        phoneInput.dispatchEvent(new Event('input', { bubbles: true }));
                        phoneInput.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                })()
            `
        }, sessionId);

        // 2. Select Fail on Label Legible and enter failure note
        const labelNoteText = 'Handwritten label smudged by rain';
        await cdp.send('Runtime.evaluate', {
            expression: `
                (() => {
                    const labelFailBtn = document.querySelector('button[aria-label="Label Legible & Matches ID: Fail"]');
                    if (labelFailBtn) labelFailBtn.click();
                })()
            `
        }, sessionId);

        await sleep(400);

        await cdp.send('Runtime.evaluate', {
            expression: `
                (() => {
                    const labelNoteInput = document.querySelector('input[placeholder="e.g. Smudged ink, wrong ID on label..."]');
                    if (labelNoteInput) {
                        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                        setter.call(labelNoteInput, ${JSON.stringify(labelNoteText)});
                        labelNoteInput.dispatchEvent(new Event('input', { bubbles: true }));
                        labelNoteInput.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                })()
            `
        }, sessionId);

        // 3. Mark Container Intact as OK
        await cdp.send('Runtime.evaluate', {
            expression: `
                (() => {
                    const containerOkBtn = document.querySelector('button[aria-label="Container Intact / Sealed: OK"]');
                    if (containerOkBtn) containerOkBtn.click();
                })()
            `
        }, sessionId);

        console.log('  Waiting 11.5s for application 10-second autosave timer to persist edited state...');
        // Wait for the application's actual 10-second timer to fire and write limsi_intake_autosave
        const savedDraftJson = await waitForCondition(async () => {
            const res = await cdp.send('Runtime.evaluate', {
                expression: `localStorage.getItem('limsi_intake_autosave')`,
                returnByValue: true
            }, sessionId);
            const val = res.result?.value;
            if (!val) return null;
            try {
                const parsed = JSON.parse(val);
                // Ensure the draft was saved by the app containing our entered values
                if (parsed?.submitter?.name === submitterName && parsed?.checklistData?.items?.label?.status === 'FAIL') {
                    return parsed;
                }
            } catch (_) {}
            return null;
        }, 'Application 10-second autosave written to localStorage', 18000, 500);

        console.log(`  [Autosave] Product saved draft: Submitter="${savedDraftJson.submitter.name}", Label="${savedDraftJson.checklistData.items.label.note}"`);

        // Assert exact saved payload from application
        const autosavePayloadValid = Boolean(
            savedDraftJson.submitter?.name === submitterName &&
            savedDraftJson.submitter?.phone === submitterPhone &&
            savedDraftJson.checklistData?.items?.label?.status === 'FAIL' &&
            savedDraftJson.checklistData?.items?.label?.note === labelNoteText &&
            savedDraftJson.checklistData?.items?.container?.status === 'PASS' &&
            savedDraftJson.checklistData?.nonConformance === true
        );

        // 4. Reload page to simulate operator session resumption
        console.log('  Reloading page to test authentic draft restore modal...');
        await cdp.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/reception` }, sessionId);

        await waitForCondition(async () => {
            const res = await cdp.send('Runtime.evaluate', {
                expression: `Boolean(document.querySelector('[data-tour="reception-container"]'))`,
                returnByValue: true
            }, sessionId);
            return res.result?.value;
        }, 'Reception Console root reloaded');

        // Click Walk-in Sample card to enter Walk-in mode and trigger draft restore dialog
        await cdp.send('Runtime.evaluate', {
            expression: `
                (() => {
                    const buttons = Array.from(document.querySelectorAll('button'));
                    const walkInBtn = buttons.find(b => b.innerText.includes('Walk-in Sample'));
                    if (walkInBtn) walkInBtn.click();
                })()
            `
        }, sessionId);

        // Wait for application's "Restore Draft?" confirmation modal
        const restoreDialogDetected = await waitForCondition(async () => {
            const res = await cdp.send('Runtime.evaluate', {
                expression: `
                    (() => {
                        const buttons = Array.from(document.querySelectorAll('button'));
                        const restoreBtn = buttons.find(b => b.innerText.trim() === 'Restore');
                        return Boolean(restoreBtn && document.body.innerText.includes('Restore Draft?'));
                    })()
                `,
                returnByValue: true
            }, sessionId);
            return res.result?.value;
        }, 'Restore Draft confirmation modal displayed');

        // Click "Restore" in modal
        await cdp.send('Runtime.evaluate', {
            expression: `
                (() => {
                    const buttons = Array.from(document.querySelectorAll('button'));
                    const restoreBtn = buttons.find(b => b.innerText.trim() === 'Restore');
                    if (restoreBtn) restoreBtn.click();
                })()
            `
        }, sessionId);

        await sleep(600);

        // Assert that the restored form in the live browser displays the exact persisted values
        const draftRestoredInDOM = await cdp.send('Runtime.evaluate', {
            expression: `
                (() => {
                    const labelFailBtn = document.querySelector('button[aria-label="Label Legible & Matches ID: Fail"]');
                    const containerOkBtn = document.querySelector('button[aria-label="Container Intact / Sealed: OK"]');
                    const labelNoteInput = document.querySelector('input[placeholder="e.g. Smudged ink, wrong ID on label..."]');
                    const nameInput = document.querySelector('input[data-field-key="submitter.name"]');

                    const isLabelFailChecked = labelFailBtn && labelFailBtn.getAttribute('aria-checked') === 'true';
                    const isContainerOkChecked = containerOkBtn && containerOkBtn.getAttribute('aria-checked') === 'true';
                    const hasExactLabelNote = labelNoteInput && labelNoteInput.value === ${JSON.stringify(labelNoteText)};
                    const hasExactName = nameInput && nameInput.value === ${JSON.stringify(submitterName)};

                    return Boolean(isLabelFailChecked && isContainerOkChecked && hasExactLabelNote && hasExactName);
                })()
            `,
            returnByValue: true
        }, sessionId);

        const journey6Passed = autosavePayloadValid && restoreDialogDetected && draftRestoredInDOM.result.value;
        recordStep('Synthetic Draft Restore & Rehydration', journey6Passed,
            `10s autosave observed: ${autosavePayloadValid}, Restore modal accepted: ${restoreDialogDetected}, Persisted state restored in DOM: ${draftRestoredInDOM.result.value}`);

        // Capture screenshot of final rehydrated reception console
        const screenshot = await cdp.send('Page.captureScreenshot', { format: 'png' }, sessionId);
        const screenshotPath = path.join(EVIDENCE_DIR, 'reception_browser_journey_verified.png');
        fs.writeFileSync(screenshotPath, Buffer.from(screenshot.data, 'base64'));
        console.log(`[Evidence] Saved full browser journey screenshot to: ${screenshotPath}`);

        // Write evidence report JSON with private audit record
        const evidenceReport = {
            suite: 'Reception Isolated Browser Journey',
            executedAt: new Date().toISOString(),
            browser: 'Google Chrome Headless (CDP)',
            url: `http://127.0.0.1:${PORT}/reception`,
            summary: {
                totalSteps: journeyResults.length,
                passedSteps: journeyResults.filter(r => r.passed).length,
                allPassed: journeyResults.every(r => r.passed)
            },
            databaseIsolation: {
                priorRunAudit: {
                    priorRunDbResolved: 'C:\\Users\\yigin\\Documents\\soilfer-lims\\server\\prisma\\dev.db',
                    priorRunRiskIdentified: 'Unsafe default fallback to working dev.db when DATABASE_PATH was unset',
                    remediation: 'Enforced isolated disposable database copy in runner-owned directory with validateDisposableDbPath refusal guard before importing Prisma/app'
                },
                currentRun: {
                    runnerDir: runnerDir,
                    isolatedDbPath: dbPath,
                    isDisposable: true
                }
            },
            steps: journeyResults
        };

        const reportPath = path.join(EVIDENCE_DIR, 'reception_browser_journey.json');
        fs.writeFileSync(reportPath, JSON.stringify(evidenceReport, null, 2));
        console.log(`[Evidence] Saved evidence report to: ${reportPath}`);

    } finally {
        if (cdp) cdp.close();
        if (chrome) chrome.kill();
        if (server) server.close();
        if (app && typeof app.stopBackgroundSchedulers === 'function') {
            app.stopBackgroundSchedulers();
        }
        try {
            await prisma.$disconnect();
        } catch (_) {}
        // Clean up only runner-owned temporary directory (covers setup failures too)
        cleanupDisposableDatabase(runnerDir);
    }

    console.log('===============================================================');
    const passedCount = journeyResults.filter(r => r.passed).length;
    console.log(`  COMPLETED: ${passedCount}/${journeyResults.length} steps passed`);
    console.log('===============================================================');

    process.exit(passedCount === journeyResults.length ? 0 : 1);
}

runBrowserJourney().catch(err => {
    console.error('[Browser Journey Fatal Error]', err);
    try {
        cleanupDisposableDatabase(runnerDir);
    } catch (_) {}
    process.exit(1);
});
