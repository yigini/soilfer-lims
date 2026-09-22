'use strict';

/**
 * Browser Evidence Runner: QC Batch Inspection Display & Legacy Limit Assertions (#118)
 * 
 * Verifies in real Headless Chrome (CDP) against an isolated disposable database:
 * 1. Modal correctly opens for batch with persisted legacy REJECT_REANALYSIS
 * 2. Prominent banner displays "REJECTED FOR RE-ANALYSIS (Legacy)" with recorded metadata & justification
 * 3. Blank measurement (expected: 0, measured: 0.03, missing limit) displays "Not recorded" for Upper Limit (never 0, never implicit 0.05) and PASS status
 * 4. Manager action form is suppressed (no editable "Proceed with Warning" form, no prefilled old reason)
 * 5. Dedicated read-only "Manager QC Disposition (Recorded — Read Only)" card is displayed with ISO 17025 compliance statement
 * 6. High-resolution screenshot captured to artifacts/evidence-journeys/qc_inspection_legacy_reject_modal.png
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
    const testRunnerDir = path.resolve(__dirname, '..', '.tmp_journey_runner_refusal_test_qc');
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
const { getPermissionsForRole } = require('../config/roles');
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
            const timer = setTimeout(() => reject(new Error('WebSocket connection timeout')), 6000);
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

async function runQCInspectionEvidence() {
    console.log('========================================================================');
    console.log('  QC BROWSER EVIDENCE: LEGACY REJECTION & BLANK LIMIT CORRECTION (#118) ');
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
        const TEST_USERNAME = `mgr_gtm_${RUN_ID}`;
        const TEST_PROJECT_ID = `PRJ-GTM-${RUN_ID}`;
        const TARGET_BATCH_ID = `BATCH-GTM-2026-P-01`;

        console.log(`[Setup] Seeding test scenario with persisted legacy REJECT_REANALYSIS...`);

        // 1. Seed Laboratory
        await prisma.lab.create({
            data: {
                id: TEST_LAB_ID,
                code: 'L-GTM',
                name: 'Guatemala Central Soils Laboratory',
                country: 'Guatemala',
                city: 'Guatemala City',
                location: '14.6349, -90.5069',
                isActive: true
            }
        });

        // 2. Seed Project
        await prisma.project.create({
            data: {
                id: TEST_PROJECT_ID,
                code: 'SOILFER-GTM',
                name: 'Guatemala Soil Fertility Pilot 2026',
                status: 'ACTIVE',
                projectType: 'STANDARD',
                labId: TEST_LAB_ID,
                countries: 'Guatemala'
            }
        });

        // 3. Seed Manager User (mgr_gtm)
        const hashedPassword = await bcrypt.hash('ManagerPassword123!', 10);
        await prisma.user.create({
            data: {
                id: TEST_USER_ID,
                username: TEST_USERNAME,
                email: `${TEST_USERNAME}@example.org`,
                password: hashedPassword,
                role: 'LAB_MANAGER',
                labId: TEST_LAB_ID,
                isActive: true,
                tokenVersion: 0
            }
        });

        // 4. Seed Sample & WorkItem
        const sampleId = `SMP-GTM-${RUN_ID}`;
        await prisma.sample.create({
            data: {
                id: sampleId,
                labId: TEST_LAB_ID,
                assignedLab: TEST_LAB_ID,
                originalId: 'FIELD-GTM-P01',
                status: 'PROCESSING',
                projectCode: 'SOILFER-GTM',
                country: 'Guatemala'
            }
        });

        const workItemId = `WI-GTM-${RUN_ID}`;
        await prisma.workItem.create({
            data: {
                id: workItemId,
                sampleId: sampleId,
                labId: TEST_LAB_ID,
                assignedLab: TEST_LAB_ID,
                analysis: 'SOC',
                status: 'REANALYSIS_REQUIRED',
                rackPosition: 4
            }
        });

        // 5. Seed QC Batch with Persisted Legacy REJECT_REANALYSIS & Missing Blank Limit
        const legacyJustification = 'CRM recovery 124% exceeds acceptable limit [85-115%] and replicate precision RPD 18.5% exceeds 10% tolerance; bench re-digestion required.';
        const legacyTimestamp = '2026-09-07T14:32:00.000Z';

        await prisma.batch.create({
            data: {
                id: TARGET_BATCH_ID,
                labId: TEST_LAB_ID,
                analysis: 'SOC',
                instrument: 'Elementar Vario MAX Cube',
                profile: 'standard_40',
                status: 'QC_FAIL',
                createdBy: 'tech_gtm',
                notes: 'Daily SOC analysis rack 1; calibration check passed; CRM recovery high on position 2.',
                workItemIds: JSON.stringify([workItemId]),
                disposition: JSON.stringify({
                    decision: 'REJECT_REANALYSIS',
                    reason: legacyJustification,
                    by: 'mgr_gtm',
                    at: legacyTimestamp
                }),
                history: JSON.stringify([
                    {
                        status: 'OPEN',
                        user: 'tech_gtm',
                        timestamp: '2026-09-07T08:00:00.000Z'
                    },
                    {
                        status: 'QC_FAIL',
                        user: 'tech_gtm',
                        timestamp: '2026-09-07T11:15:00.000Z',
                        details: 'Automated QC evaluation failed CRM recovery'
                    },
                    {
                        timestamp: legacyTimestamp,
                        user: 'mgr_gtm',
                        action: 'QC_DISPOSITION',
                        details: `Batch rejected for re-analysis: ${legacyJustification}`
                    }
                ]),
                qcResults: JSON.stringify({
                    blanks: [
                        {
                            position: 'Slot 01',
                            label: 'Reagent Blank',
                            expected: 0,
                            measured: 0.03,
                            status: 'PASS'
                            // Note: NO 'limit' or 'upperLimit' property recorded
                        }
                    ],
                    controls: [
                        {
                            standard: 'CRM-SOIL-A',
                            measured: 3.10,
                            expected: 2.50,
                            recovery: 124.0,
                            status: 'FAIL'
                        }
                    ],
                    duplicates: [
                        {
                            pair: 'Slot 10 / 11',
                            val1: 1.45,
                            val2: 1.74,
                            rpd: 18.5,
                            status: 'FAIL'
                        }
                    ]
                })
            }
        });

        await prisma.workItem.update({
            where: { id: workItemId },
            data: { batchId: TARGET_BATCH_ID }
        });

        // 6. Generate Session Token for Manager
        const realJwtToken = jwt.sign(
            { id: TEST_USER_ID, username: TEST_USERNAME, role: 'LAB_MANAGER', labId: TEST_LAB_ID, tokenVersion: 0 },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        const safeManagerUser = {
            id: TEST_USER_ID,
            username: TEST_USERNAME,
            name: 'Carlos Mendez (Lab Manager)',
            role: 'LAB_MANAGER',
            labId: TEST_LAB_ID,
            lab: {
                id: TEST_LAB_ID,
                code: 'L-GTM',
                name: 'Guatemala Central Soils Laboratory',
                country: 'Guatemala'
            },
            permissions: getPermissionsForRole('LAB_MANAGER')
        };

        // 7. Start Express Server
        const PORT = 49170;
        server = await new Promise((resolve) => {
            const s = app.listen(PORT, '127.0.0.1', () => {
                console.log(`[Server] Production server listening at http://127.0.0.1:${PORT}`);
                resolve(s);
            });
        });

        // 8. Launch Chrome
        const DEBUG_PORT = 9235;
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
        console.log('[Setup] Pre-configuring manager session in browser origin...');
        await cdp.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/login` }, sessionId);
        await sleep(1000);

        await cdp.send('Runtime.evaluate', {
            expression: `
                (() => {
                    localStorage.setItem('user', ${JSON.stringify(JSON.stringify(safeManagerUser))});
                    localStorage.setItem('token', ${JSON.stringify(realJwtToken)});
                    localStorage.setItem('language', 'en');
                    localStorage.setItem('locale', 'en');
                })()
            `
        }, sessionId);

        // Navigate directly to QA Dashboard with batch inspection modal open
        console.log(`[Navigation] Navigating to /qa?batchId=${TARGET_BATCH_ID}...`);
        await cdp.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/qa?batchId=${TARGET_BATCH_ID}` }, sessionId);

        // Wait for modal to render
        await waitForCondition(async () => {
            const res = await cdp.send('Runtime.evaluate', {
                expression: `
                    (() => {
                        const href = window.location.href;
                        const body = document.body ? document.body.innerText : '';
                        const hasTarget = body.includes('${TARGET_BATCH_ID}');
                        return { hasTarget, href, bodySnippet: body.slice(0, 200) };
                    })()
                `,
                returnByValue: true
            }, sessionId);
            const val = res.result?.value;
            if (val && val.hasTarget) return true;
            return false;
        }, `BatchInspectionModal rendered for ${TARGET_BATCH_ID}`);

        await sleep(800); // Allow complete sub-component paint

        // --- ASSERTION 1: Modal Render & Title ---
        const pageTextResult = await cdp.send('Runtime.evaluate', {
            expression: `document.body.innerText`,
            returnByValue: true
        }, sessionId);
        const pageText = pageTextResult.result?.value || '';

        const modalRendered = pageText.includes(TARGET_BATCH_ID) &&
            (pageText.includes('QC Batch Inspection') || pageText.includes('QC BATCH INSPECTION') || pageText.toUpperCase().includes('QC BATCH INSPECTION'));
        recordStep('Modal Root Render', modalRendered, `Modal loaded batch header: ${TARGET_BATCH_ID}`);

        // --- ASSERTION 2: Prominent Disposition Banner for Legacy REJECT_REANALYSIS ---
        const bannerCheck = await cdp.send('Runtime.evaluate', {
            expression: `
                (() => {
                    const text = document.body.innerText;
                    const hasBannerTitle = text.includes('QC FAILED — Manager Disposition Active: REJECTED FOR RE-ANALYSIS (Legacy)') ||
                                           text.includes('REJECTED FOR RE-ANALYSIS (Legacy)');
                    const hasBadge = text.includes('Legacy Rejection: REJECT_REANALYSIS') || text.includes('REJECTED_FOR_REANALYSIS') || text.includes('REJECT_REANALYSIS');
                    const hasAuthor = text.includes('mgr_gtm');
                    const hasJustification = text.includes('CRM recovery 124% exceeds acceptable limit [85-115%]');
                    const hasNote = text.includes('Persisted legacy manager disposition recorded as rejected for re-analysis');
                    return { hasBannerTitle, hasBadge, hasAuthor, hasJustification, hasNote };
                })()
            `,
            returnByValue: true
        }, sessionId);

        const bannerData = bannerCheck.result?.value || {};
        const bannerPassed = bannerData.hasBannerTitle && bannerData.hasAuthor && bannerData.hasJustification && bannerData.hasNote;
        recordStep('Prominent Legacy Rejection Banner', bannerPassed,
            `Banner Title: ${bannerData.hasBannerTitle}, Author (mgr_gtm): ${bannerData.hasAuthor}, Justification displayed: ${bannerData.hasJustification}, Reanalysis Note: ${bannerData.hasNote}`);

        // --- ASSERTION 3: Blank Limit & Status Evaluation (Missing Limit -> "Not recorded", NOT 0, NOT 0.05) ---
        const blankRowCheck = await cdp.send('Runtime.evaluate', {
            expression: `
                (() => {
                    try {
                        const trs = Array.from(document.querySelectorAll('tr'));
                        const blankRow = trs.find(tr => tr.innerText && (tr.innerText.includes('Slot 01') || tr.innerText.includes('Reagent Blank')));
                        if (!blankRow) {
                            return { found: false, count: trs.length };
                        }
                        const text = blankRow.innerText;
                        const hasSlot = text.includes('Slot 01');
                        const hasMeasured = text.includes('0.03');
                        const hasNotRecorded = text.includes('Not recorded');
                        const hasPass = text.includes('PASS');
                        const hasInventedZero = text.includes(' 0 ') || text.includes('\t0\t');
                        const hasInventedSop = text.includes('0.05');

                        return {
                            found: true,
                            hasSlot,
                            hasMeasured,
                            hasNotRecorded,
                            hasPass,
                            hasInventedZero,
                            hasInventedSop,
                            rowText: text
                        };
                    } catch (err) {
                        return { error: err.message };
                    }
                })()
            `,
            returnByValue: true
        }, sessionId);

        const blankData = blankRowCheck.result?.value || {};
        const blankPassed = Boolean(blankData.found && blankData.hasMeasured && blankData.hasNotRecorded && !blankData.hasInventedZero && !blankData.hasInventedSop && blankData.hasPass);
        recordStep('Blank Limit Display & Evaluation (#118)', blankPassed,
            `Found blank row: ${blankData.found}, Measured 0.03: ${blankData.hasMeasured}, Upper Limit renders "Not recorded": ${blankData.hasNotRecorded} (invented 0: ${blankData.hasInventedZero}, invented 0.05: ${blankData.hasInventedSop}), Status: ${blankData.hasPass}`);

        // --- ASSERTION 4: Form Guard (No Editable Form, No Default Proceed with Warning) ---
        const formCheck = await cdp.send('Runtime.evaluate', {
            expression: `
                (() => {
                    const forms = Array.from(document.querySelectorAll('form'));
                    const hasDispositionForm = forms.some(f => f.innerText.includes('Record Manager QC Disposition') || f.innerText.includes('Confirm Manager Disposition'));
                    const radioInputs = Array.from(document.querySelectorAll('input[name="decision"]'));
                    const textareaReason = document.querySelector('textarea#disposition-reason');
                    return {
                        hasDispositionForm,
                        radioCount: radioInputs.length,
                        hasEditableTextarea: Boolean(textareaReason)
                    };
                })()
            `,
            returnByValue: true
        }, sessionId);

        const formData = formCheck.result?.value || {};
        const formSuppressed = !formData.hasDispositionForm && formData.radioCount === 0 && !formData.hasEditableTextarea;
        recordStep('Action Form Suppression on Recorded Disposition', formSuppressed,
            `Form suppressed: ${formSuppressed} (form present: ${formData.hasDispositionForm}, radio count: ${formData.radioCount}, editable textarea: ${formData.hasEditableTextarea})`);

        // --- ASSERTION 5: Dedicated Read-Only Recorded Disposition Card ---
        const readOnlyCardCheck = await cdp.send('Runtime.evaluate', {
            expression: `
                (() => {
                    const text = document.body.innerText;
                    const hasCardHeader = text.includes('Manager QC Disposition (Recorded — Read Only)');
                    const hasAuditBadge = text.toUpperCase().includes('RECORDED AUDIT ENTRY');
                    const hasDecision = text.includes('REJECT_REANALYSIS');
                    const hasHistoryStatement = text.includes('Recorded manager QC dispositions are preserved in audit history and cannot be overwritten through this interface.');
                    return { hasCardHeader, hasAuditBadge, hasDecision, hasHistoryStatement };
                })()
            `,
            returnByValue: true
        }, sessionId);

        const cardData = readOnlyCardCheck.result?.value || {};
        const cardPassed = cardData.hasCardHeader && cardData.hasAuditBadge && cardData.hasDecision && cardData.hasHistoryStatement;
        recordStep('Read-Only Disposition Card & Factual History Notice', cardPassed,
            `Card header: ${cardData.hasCardHeader}, Audit badge: ${cardData.hasAuditBadge}, Decision REJECT_REANALYSIS: ${cardData.hasDecision}, History Statement: ${cardData.hasHistoryStatement}`);

        // --- CAPTURE HIGH-RESOLUTION EVIDENCE SCREENSHOTS ---
        console.log('[Evidence] Capturing high-resolution viewport screenshot (top: banner & blanks)...');
        const screenshot = await cdp.send('Page.captureScreenshot', { format: 'png' }, sessionId);
        const screenshotPath = path.join(EVIDENCE_DIR, 'qc_inspection_legacy_reject_modal.png');
        fs.writeFileSync(screenshotPath, Buffer.from(screenshot.data, 'base64'));
        console.log(`[Evidence] Saved top screenshot to: ${screenshotPath}`);

        // Scroll modal body to capture the bottom read-only disposition card
        console.log('[Evidence] Scrolling modal to capture read-only disposition card...');
        const scrollInfo = await cdp.send('Runtime.evaluate', {
            expression: `
                (() => {
                    const scrollContainer = document.querySelector('div.overflow-y-auto');
                    if (scrollContainer) {
                        scrollContainer.scrollTop = scrollContainer.scrollHeight;
                        return {
                            scrolled: true,
                            scrollTop: scrollContainer.scrollTop,
                            scrollHeight: scrollContainer.scrollHeight,
                            clientHeight: scrollContainer.clientHeight
                        };
                    }
                    return { scrolled: false };
                })()
            `,
            returnByValue: true
        }, sessionId);
        console.log('[Evidence] Scroll info:', scrollInfo.result?.value);
        await sleep(500);

        const cardScreenshot = await cdp.send('Page.captureScreenshot', { format: 'png' }, sessionId);
        const cardScreenshotPath = path.join(EVIDENCE_DIR, 'qc_inspection_legacy_reject_card.png');
        fs.writeFileSync(cardScreenshotPath, Buffer.from(cardScreenshot.data, 'base64'));
        console.log(`[Evidence] Saved card screenshot to: ${cardScreenshotPath}`);

        // Also copy to antigravity brain artifacts directory for direct user inspection
        const brainArtifactsDir = 'C:\\Users\\yigin\\.gemini\\antigravity\\brain\\80c11c12-5cb7-4455-a433-01544d488498';
        if (fs.existsSync(brainArtifactsDir)) {
            const brainPath1 = path.join(brainArtifactsDir, 'qc_inspection_legacy_reject_modal.png');
            fs.copyFileSync(screenshotPath, brainPath1);
            const brainPath2 = path.join(brainArtifactsDir, 'qc_inspection_legacy_reject_card.png');
            fs.copyFileSync(cardScreenshotPath, brainPath2);
            console.log(`[Evidence] Copied screenshots to brain artifact dir: ${brainPath1}, ${brainPath2}`);
        }

        // Save structured JSON evidence report
        const reportPath = path.join(EVIDENCE_DIR, 'qc_inspection_legacy_reject_evidence.json');
        const evidenceReport = {
            suite: 'QC Batch Inspection Display & Legacy Limits Browser Evidence (#118)',
            executedAt: new Date().toISOString(),
            browser: 'Google Chrome Headless (CDP)',
            targetBatch: TARGET_BATCH_ID,
            url: `http://127.0.0.1:${PORT}/qa?batchId=${TARGET_BATCH_ID}`,
            summary: {
                totalSteps: journeyResults.length,
                passedSteps: journeyResults.filter(r => r.passed).length,
                allPassed: journeyResults.every(r => r.passed)
            },
            databaseIsolation: {
                runnerDir,
                isolatedDbPath: dbPath,
                isDisposable: true
            },
            steps: journeyResults
        };

        fs.writeFileSync(reportPath, JSON.stringify(evidenceReport, null, 2));
        console.log(`[Evidence] Saved evidence report to: ${reportPath}`);

        const allPassed = journeyResults.every(r => r.passed);
        console.log('\n========================================================================');
        console.log(`  OVERALL RESULT: ${allPassed ? 'ALL STEPS PASSED (EXIT 0)' : 'FAILED'}`);
        console.log('========================================================================');

        if (!allPassed) {
            process.exit(1);
        }

    } finally {
        if (cdp) cdp.close();
        if (chrome) chrome.kill();
        if (server) server.close();
        if (app && typeof app.stopBackgroundSchedulers === 'function') {
            app.stopBackgroundSchedulers();
        }
        await sleep(500);
        cleanupDisposableDatabase(runnerDir);
    }
}

runQCInspectionEvidence().catch(err => {
    console.error('[FATAL ERROR]', err);
    process.exit(1);
});
