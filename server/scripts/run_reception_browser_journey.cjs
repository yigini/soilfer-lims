'use strict';

/**
 * Browser Journey Evidence Runner: Real Reception Route & Lifecycle Contracts (#113, #114, #117)
 *
 * Executes the real Reception page in headless Chrome:
 * 1. Initial page load (parent & child integration, no TDZ crash)
 * 2. Walk-in mode entry (WalkInForm + ComplianceChecklist child mounted together)
 * 3. CoC N/A selection in Walk-in mode
 * 4. Mode-switch cleanup: Walk-in to Project mode, verifying useEffect clears prohibited CoC N/A
 * 5. Fail selection, note entry, and correction back to OK (non-conformance cleared)
 * 6. Save and rehydrate synthetic draft
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_jwt_for_local_testing_12345';
const { JWT_SECRET } = require('../config/auth');
const prisma = require('../prisma');

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

    send(method, params = {}, sessionId = null, timeoutMs = 10000) {
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

async function waitForCondition(evalFn, description, timeoutMs = 10000, intervalMs = 250) {
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

    // Step 1: Start Express production server serving client/dist
    process.env.NODE_ENV = 'production';
    const app = require('../app');
    const PORT = 49160;

    // Seed test lab and user in database for real JWT authentication
    console.log('[Setup] Seeding test laboratory and user in SQLite database...');
    const TEST_LAB_ID = 'LAB-ZMB-01';
    const TEST_USER_ID = 'usr-tech-reception';

    await prisma.lab.upsert({
        where: { id: TEST_LAB_ID },
        update: {
            code: 'LUS1',
            name: 'Lusaka Central Laboratory',
            country: 'Zambia',
            city: 'Lusaka',
            location: '-15.4167, 28.2833',
            isActive: true
        },
        create: {
            id: TEST_LAB_ID,
            code: 'LUS1',
            name: 'Lusaka Central Laboratory',
            country: 'Zambia',
            city: 'Lusaka',
            location: '-15.4167, 28.2833',
            isActive: true
        }
    });

    const hashedPassword = await bcrypt.hash('Password123!', 10);
    await prisma.user.upsert({
        where: { id: TEST_USER_ID },
        update: {
            username: 'tech.reception',
            email: 'tech.reception@example.com',
            role: 'SAMPLE_RECEPTION',
            labId: TEST_LAB_ID,
            isActive: true,
            tokenVersion: 0
        },
        create: {
            id: TEST_USER_ID,
            username: 'tech.reception',
            email: 'tech.reception@example.com',
            password: hashedPassword,
            role: 'SAMPLE_RECEPTION',
            labId: TEST_LAB_ID,
            isActive: true,
            tokenVersion: 0
        }
    });

    const realJwtToken = jwt.sign(
        { id: TEST_USER_ID, username: 'tech.reception', role: 'SAMPLE_RECEPTION', tokenVersion: 0 },
        JWT_SECRET,
        { expiresIn: '24h' }
    );

    const safeReceptionUser = {
        id: TEST_USER_ID,
        username: 'tech.reception',
        name: 'Jane Receptionist',
        role: 'SAMPLE_RECEPTION',
        labId: TEST_LAB_ID,
        lab: {
            id: TEST_LAB_ID,
            code: 'LUS1',
            name: 'Lusaka Central Laboratory',
            country: 'Zambia',
            city: 'Lusaka',
            location: '-15.4167, 28.2833',
            isActive: true
        },
        labLocation: '-15.4167, 28.2833',
        permissions: ['RECEIVE_SAMPLE', 'VIEW_SAMPLES', 'CREATE_SAMPLE', 'CHANGE_STATUS']
    };

    const server = await new Promise((resolve) => {
        const s = app.listen(PORT, '127.0.0.1', () => {
            console.log(`[Server] Production server listening at http://127.0.0.1:${PORT}`);
            resolve(s);
        });
    });

    const DEBUG_PORT = 9230;
    const tempUserDataDir = path.resolve(__dirname, '..', '.tmp_chrome_reception_' + Date.now());

    console.log(`[Chrome] Launching Headless Chrome on debug port ${DEBUG_PORT}...`);
    const chrome = spawn(CHROME_PATH, [
        '--headless=new',
        `--remote-debugging-port=${DEBUG_PORT}`,
        '--disable-gpu',
        '--no-first-run',
        '--no-default-browser-check',
        '--window-size=1440,960',
        '--user-data-dir=' + tempUserDataDir
    ]);

    await sleep(2000);

    let cdp;
    let sessionId;
    const journeyResults = [];

    const recordStep = (stepName, passed, details) => {
        journeyResults.push({ stepName, passed, details, timestamp: new Date().toISOString() });
        console.log(`  [${passed ? 'PASS' : 'FAIL'}] ${stepName}: ${details}`);
    };

    try {
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

        // Pre-configure localStorage before navigation
        console.log('[Setup] Pre-configuring reception authenticated session in browser...');
        await cdp.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/login` }, sessionId);
        await sleep(1000);

        await cdp.send('Runtime.evaluate', {
            expression: `
                (() => {
                    localStorage.setItem('user', ${JSON.stringify(JSON.stringify(safeReceptionUser))});
                    localStorage.setItem('token', ${JSON.stringify(realJwtToken)});
                    localStorage.setItem('language', 'en');
                    localStorage.setItem('locale', 'en');
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
                    return Boolean(cocBtn && containerBtn && labelBtn);
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

        // --- JOURNEY 4: Mode Switch Cleanup (Walk-in to Project resets CoC N/A) ---
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

        // Verify mode switched to PROJECT (lookup header or project session active)
        const inProjectMode = await cdp.send('Runtime.evaluate', {
            expression: `
                (() => {
                    return document.body.innerText.includes('Project:') || 
                           document.body.innerText.includes('Scheduled project') ||
                           document.body.innerText.includes('Open intake');
                })()
            `,
            returnByValue: true
        }, sessionId);

        // Trigger Alt+2 keyboard shortcut to return to WALK_IN mode
        await cdp.send('Runtime.evaluate', {
            expression: `
                (() => {
                    window.dispatchEvent(new KeyboardEvent('keydown', { key: '2', altKey: true, bubbles: true }));
                })()
            `
        }, sessionId);

        await sleep(600);

        // Inspect that CoC N/A was cleared by useEffect (status is undefined, aria-checked is false)
        const cocNACleared = await cdp.send('Runtime.evaluate', {
            expression: `
                (() => {
                    const cocNABtn = document.querySelector('button[aria-label="Chain of Custody Present: N/A"]');
                    return cocNABtn && cocNABtn.getAttribute('aria-checked') === 'false';
                })()
            `,
            returnByValue: true
        }, sessionId);

        recordStep('Mode-Switch Cleanup Effect Execution', cocNACleared.result.value,
            `useEffect executed upon mode switch, resetting prohibited coc N/A to undefined (inProjectMode: ${inProjectMode.result?.value}, cocNACleared: ${cocNACleared.result?.value})`);

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

        const failActive = await cdp.send('Runtime.evaluate', {
            expression: `
                (() => {
                    const failBtn = document.querySelector('button[aria-label="Container Intact / Sealed: Fail"]');
                    const noteInput = document.querySelector('input[placeholder="e.g. Bag torn, lid loose, visible leakage..."]');
                    return Boolean(failBtn && failBtn.getAttribute('aria-checked') === 'true' && noteInput);
                })()
            `,
            returnByValue: true
        }, sessionId);

        // Enter failure note into the failure input
        await cdp.send('Runtime.evaluate', {
            expression: `
                (() => {
                    const noteInput = document.querySelector('input[placeholder="e.g. Bag torn, lid loose, visible leakage..."]');
                    if (noteInput) {
                        noteInput.value = 'Bag torn at seam during transport';
                        noteInput.dispatchEvent(new Event('input', { bubbles: true }));
                        noteInput.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                })()
            `
        }, sessionId);

        await sleep(300);

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

        recordStep('Checklist Fail & Correction Lifecycle', failActive.result.value && correctedToOK.result.value,
            `Fail triggered note input: ${failActive.result.value}, Correction back to OK cleared note input: ${correctedToOK.result.value}`);

        // --- JOURNEY 6: Save and Reopen Synthetic Draft ---
        console.log('\n--- JOURNEY 6: Save and Reopen Synthetic Draft ---');
        // First, return to mode selector by clicking ArrowLeft (End Session button) and confirming dialog
        await cdp.send('Runtime.evaluate', {
            expression: `
                (() => {
                    const backBtn = document.querySelector('button svg.lucide-arrow-left')?.closest('button');
                    if (backBtn) backBtn.click();
                })()
            `
        }, sessionId);

        await sleep(500);

        // Click End Session in confirm dialog
        await cdp.send('Runtime.evaluate', {
            expression: `
                (() => {
                    const buttons = Array.from(document.querySelectorAll('button'));
                    const confirmBtn = buttons.find(b => b.innerText.trim() === 'End Session');
                    if (confirmBtn) confirmBtn.click();
                })()
            `
        }, sessionId);

        await sleep(600);

        // Now on mode selector, set synthetic draft in localStorage
        await cdp.send('Runtime.evaluate', {
            expression: `
                (() => {
                    const draftData = {
                        submitter: { name: 'Farmer Chanda', phone: '+260971234567', organization: 'Chongwe Farmers Co-op' },
                        sampling: { location: 'Chongwe Valley Plot 4B', crop: 'Maize' },
                        checklistData: {
                            items: {
                                container: { status: 'PASS' },
                                label: { status: 'FAIL', note: 'Handwritten label smudged' }
                            },
                            nonConformance: true,
                            reason: 'Smudged field label requires verification'
                        },
                        intakeNotes: 'Priority testing requested by extension officer',
                        receivedMass: '650',
                        moistureOnArrival: 'MOIST'
                    };
                    localStorage.setItem('limsi_intake_autosave', JSON.stringify(draftData));
                })()
            `
        }, sessionId);

        await sleep(300);

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

        await sleep(600);

        // Check if Restore Draft dialog opened, and click Restore
        const dialogDetected = await cdp.send('Runtime.evaluate', {
            expression: `
                (() => {
                    const buttons = Array.from(document.querySelectorAll('button'));
                    const restoreBtn = buttons.find(b => b.innerText.trim() === 'Restore');
                    if (restoreBtn) {
                        restoreBtn.click();
                        return true;
                    }
                    return false;
                })()
            `,
            returnByValue: true
        }, sessionId);

        await sleep(600);

        const draftRehydrated = await cdp.send('Runtime.evaluate', {
            expression: `
                (() => {
                    const labelFailBtn = document.querySelector('button[aria-label="Label Legible & Matches ID: Fail"]');
                    const containerOkBtn = document.querySelector('button[aria-label="Container Intact / Sealed: OK"]');
                    const noteInput = document.querySelector('input[placeholder="e.g. Smudged ink, wrong ID on label..."]');
                    const isLabelFailChecked = labelFailBtn && labelFailBtn.getAttribute('aria-checked') === 'true';
                    const isContainerOkChecked = containerOkBtn && containerOkBtn.getAttribute('aria-checked') === 'true';
                    const hasNote = noteInput && noteInput.value.includes('smudged');
                    return Boolean(isLabelFailChecked && isContainerOkChecked && hasNote);
                })()
            `,
            returnByValue: true
        }, sessionId);

        recordStep('Synthetic Draft Restore & Rehydration', dialogDetected.result.value && draftRehydrated.result.value,
            `Restore dialog triggered: ${dialogDetected.result.value}, Checklist items rehydrated: ${draftRehydrated.result.value}`);

        // Capture evidence screenshot
        const screenshot = await cdp.send('Page.captureScreenshot', { format: 'png' }, sessionId);
        const screenshotPath = path.join(EVIDENCE_DIR, 'reception_browser_journey_verified.png');
        fs.writeFileSync(screenshotPath, Buffer.from(screenshot.data, 'base64'));
        console.log(`[Evidence] Saved full browser journey screenshot to: ${screenshotPath}`);

        // Write evidence report JSON
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
            steps: journeyResults
        };

        const reportPath = path.join(EVIDENCE_DIR, 'reception_browser_journey.json');
        fs.writeFileSync(reportPath, JSON.stringify(evidenceReport, null, 2));
        console.log(`[Evidence] Saved evidence report to: ${reportPath}`);

    } finally {
        if (cdp) cdp.close();
        chrome.kill();
        server.close();
        try {
            await prisma.user.deleteMany({ where: { id: TEST_USER_ID } });
            await prisma.lab.deleteMany({ where: { id: TEST_LAB_ID } });
            await prisma.$disconnect();
        } catch (_) {}
        try {
            if (fs.existsSync(tempUserDataDir)) {
                fs.rmSync(tempUserDataDir, { recursive: true, force: true });
            }
        } catch (_) {}
    }

    console.log('===============================================================');
    const passedCount = journeyResults.filter(r => r.passed).length;
    console.log(`  COMPLETED: ${passedCount}/${journeyResults.length} steps passed`);
    console.log('===============================================================');

    process.exit(passedCount === journeyResults.length ? 0 : 1);
}

runBrowserJourney().catch(err => {
    console.error('[Browser Journey Fatal Error]', err);
    process.exit(1);
});
