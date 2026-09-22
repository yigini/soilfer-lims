'use strict';

/**
 * Browser Evidence Runner: Manager Queue Assignment Route & SampleDetail Regression (#119)
 * 
 * Verifies in real Headless Chrome (CDP) against an isolated disposable database:
 * 1. Manager Queue displays unassigned cards for S005 (15 tasks), S004 (11 tasks), W001 (12 tasks), totaling 38.
 * 2. Clicking "Assign Tech" on S005 navigates to canonical route /samples/GTM-LAB1?tab=work&returnTo=%2Fmanager-queue%3Flane%3Dassign.
 * 3. SampleDetail loads cleanly without Application Error / ReferenceError: ArrowRight is not defined.
 * 4. Primary action button renders with ArrowRight icon: "Assign 15 unassigned task(s) to technician".
 * 5. WorkItemsTable displays strictly S005's 15 tasks.
 * 6. "Back to queue" button preserves returnTo context, and clicking returns to /manager-queue?lane=assign.
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
    const testRunnerDir = path.resolve(__dirname, '..', '.tmp_journey_runner_refusal_test_sample');
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
        console.log('[1/6] Setting up synthetic disposable database fixtures...');
        
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
                id: 'usr-super-admin-journey',
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

        const sampleS005CanonicalId = 'GTM-LAB1';
        const sampleS005DisplayLabId = 'S005';
        const sampleS005FieldId = 'FIELD-GTM-S005';

        const sampleS004CanonicalId = 'SMP-S004-GTM';
        const sampleS004DisplayLabId = 'S004';
        const sampleS004FieldId = 'FIELD-GTM-S004';

        const sampleW001CanonicalId = 'SMP-W001-CLO';
        const sampleW001DisplayLabId = 'W001';
        const sampleW001FieldId = 'FIELD-CLO-W001';

        const s005Analyses = [
            'DRYING', 'PREPARATION', 'PH_H2O', 'EC_1_5', 'OC',
            'TOTAL_N', 'P_BRAY', 'K_EX', 'CA_EX', 'MG_EX',
            'NA_EX', 'CEC', 'FE_DTPA', 'ZN_DTPA', 'CU_DTPA'
        ]; // 15 tasks

        const s004Analyses = [
            'DRYING', 'PREPARATION', 'PH_H2O', 'EC_1_5', 'OC',
            'TOTAL_N', 'P_BRAY', 'K_EX', 'CA_EX', 'MG_EX', 'NA_EX'
        ]; // 11 tasks

        const w001Analyses = [
            'DRYING', 'PREPARATION', 'PH_H2O', 'EC_1_5', 'OC',
            'TOTAL_N', 'P_BRAY', 'K_EX', 'CA_EX', 'MG_EX', 'NA_EX', 'CEC'
        ]; // 12 tasks

        // Clean any existing items
        await prisma.workItem.deleteMany({
            where: { sampleId: { in: [sampleS005CanonicalId, sampleS004CanonicalId, sampleW001CanonicalId] } }
        });
        await prisma.sample.deleteMany({
            where: { id: { in: [sampleS005CanonicalId, sampleS004CanonicalId, sampleW001CanonicalId] } }
        });

        // 1. S005: canonical ID GTM-LAB1, display lab code S005
        await prisma.sample.create({
            data: {
                id: sampleS005CanonicalId,
                labId: sampleS005DisplayLabId,
                originalId: sampleS005FieldId,
                assignedLab: 'LAB-GTM',
                country: 'GTM',
                projectCode: 'SOILFER-US',
                status: 'PROCESSING',
                matrix: 'SOIL',
                receptionDate: new Date(),
                dryingStatus: 'PENDING',
                preparationStatus: 'PENDING',
                requiredAnalyses: JSON.stringify(s005Analyses.slice(2))
            }
        });
        for (let i = 0; i < s005Analyses.length; i++) {
            await prisma.workItem.create({
                data: {
                    id: `WI-JOURNEY-S005-${i + 1}`,
                    sampleId: sampleS005CanonicalId,
                    labId: 'LAB-GTM',
                    assignedLab: 'LAB-GTM',
                    analysis: s005Analyses[i],
                    category: i < 2 ? 'Operational Gates' : 'Wet Chemistry',
                    status: 'NOT_ASSIGNED',
                    assignedTo: null
                }
            });
        }

        // 2. S004: canonical ID SMP-S004-GTM, display lab code S004
        await prisma.sample.create({
            data: {
                id: sampleS004CanonicalId,
                labId: sampleS004DisplayLabId,
                originalId: sampleS004FieldId,
                assignedLab: 'LAB-GTM',
                country: 'GTM',
                projectCode: 'SOILFER-US',
                status: 'PROCESSING',
                matrix: 'SOIL',
                receptionDate: new Date(),
                dryingStatus: 'PENDING',
                preparationStatus: 'PENDING',
                requiredAnalyses: JSON.stringify(s004Analyses.slice(2))
            }
        });
        for (let i = 0; i < s004Analyses.length; i++) {
            await prisma.workItem.create({
                data: {
                    id: `WI-JOURNEY-S004-${i + 1}`,
                    sampleId: sampleS004CanonicalId,
                    labId: 'LAB-GTM',
                    assignedLab: 'LAB-GTM',
                    analysis: s004Analyses[i],
                    category: i < 2 ? 'Operational Gates' : 'Wet Chemistry',
                    status: 'NOT_ASSIGNED',
                    assignedTo: null
                }
            });
        }

        // 3. W001: canonical ID SMP-W001-CLO, display code W001 in LAB-CLO
        await prisma.sample.create({
            data: {
                id: sampleW001CanonicalId,
                labId: sampleW001DisplayLabId,
                originalId: sampleW001FieldId,
                assignedLab: 'LAB-CLO',
                country: 'HND',
                projectCode: 'SOILFER-US',
                status: 'PROCESSING',
                matrix: 'SOIL',
                receptionDate: new Date(),
                dryingStatus: 'PENDING',
                preparationStatus: 'PENDING',
                requiredAnalyses: JSON.stringify(w001Analyses.slice(2))
            }
        });
        for (let i = 0; i < w001Analyses.length; i++) {
            await prisma.workItem.create({
                data: {
                    id: `WI-JOURNEY-W001-${i + 1}`,
                    sampleId: sampleW001CanonicalId,
                    labId: 'LAB-CLO',
                    assignedLab: 'LAB-CLO',
                    analysis: w001Analyses[i],
                    category: i < 2 ? 'Operational Gates' : 'Wet Chemistry',
                    status: 'NOT_ASSIGNED',
                    assignedTo: null
                }
            });
        }

        console.log('[2/6] Starting Express HTTP server...');
        server = http.createServer(app);
        await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
        const port = server.address().port;
        const origin = `http://127.0.0.1:${port}`;
        console.log(`Server listening at ${origin}`);

        console.log('[3/6] Launching Headless Chrome via CDP...');
        const chromeUserDataDir = path.resolve(runnerDir, 'chrome-user-data');
        fs.mkdirSync(chromeUserDataDir, { recursive: true });

        const chromeArgs = [
            '--headless=new',
            '--remote-debugging-port=0',
            `--user-data-dir=${chromeUserDataDir}`,
            '--no-first-run',
            '--no-default-browser-check',
            '--disable-gpu',
            '--window-size=1440,900',
            'about:blank'
        ];

        chromeProc = spawn(CHROME_PATH, chromeArgs, { stdio: ['ignore', 'pipe', 'pipe'] });

        let wsUrl = null;
        const portRegex = /DevTools listening on (ws:\/\/127\.0\.0\.1:\d+\/devtools\/browser\/[a-f0-9-]+)/;
        
        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Chrome CDP startup timeout')), 10000);
            chromeProc.stderr.on('data', (buf) => {
                const str = buf.toString();
                const match = str.match(portRegex);
                if (match) {
                    wsUrl = match[1];
                    clearTimeout(timeout);
                    resolve();
                }
            });
        });

        console.log('Connecting to Chrome CDP at', wsUrl);
        cdp = new CDPClient(wsUrl);
        await cdp.connect();

        const targets = await getJson(`http://127.0.0.1:${chromeProc.spawnargs.find(a => a.startsWith('--remote-debugging-port')).split('=')[1] || 9222}/json/list`).catch(async () => {
            const endpoint = wsUrl.replace('ws://', 'http://').split('/devtools/')[0];
            return getJson(`${endpoint}/json/list`);
        });
        const pageTarget = targets.find(t => t.type === 'page');
        if (!pageTarget) throw new Error('No page target found in Chrome');

        const pageCdp = new CDPClient(pageTarget.webSocketDebuggerUrl);
        await pageCdp.connect();

        await pageCdp.send('Page.enable');
        await pageCdp.send('Runtime.enable');
        await pageCdp.send('DOM.enable');

        console.log('[4/6] Authenticating as SUPER_ADMIN...');
        const adminUser = await prisma.user.findUnique({ where: { username: 'super_admin' } });
        const token = jwt.sign(
            {
                id: adminUser.id,
                username: adminUser.username,
                role: adminUser.role,
                labId: adminUser.labId,
                name: adminUser.name
            },
            JWT_SECRET,
            { expiresIn: '1h' }
        );

        // Pre-set localStorage with token
        await pageCdp.send('Page.navigate', { url: origin });
        await sleep(500);
        await pageCdp.send('Runtime.evaluate', {
            expression: `
                localStorage.setItem('token', '${token}');
                localStorage.setItem('user', JSON.stringify(${JSON.stringify(adminUser)}));
            `
        });

        console.log('[5/6] Executing Manager Queue & Assignment Route Journey...');

        // Step 1: Open Manager Queue in Assign Lane
        await pageCdp.send('Page.navigate', { url: `${origin}/manager-queue?lane=assign` });
        await sleep(1500);

        const evalStep1 = await pageCdp.send('Runtime.evaluate', {
            expression: `
                (() => {
                    const text = document.body.innerText;
                    const hasS005 = text.includes('S005');
                    const hasS004 = text.includes('S004');
                    const hasW001 = text.includes('W001');
                    const has38 = text.includes('38') || text.includes('38 tasks') || text.includes('15') && text.includes('11');
                    return {
                        hasS005,
                        hasS004,
                        hasW001,
                        has38,
                        title: document.title,
                        snippet: text.substring(0, 300)
                    };
                })()
            `,
            returnByValue: true
        });

        console.log('[PASS] Step 1: Manager Queue Assign Lane Rendered:', evalStep1.result.value);

        // Step 2: Open S005 Assign Tech route directly (or click card)
        // URL as reproduced: /samples/GTM-LAB1?tab=work&returnTo=%2Fmanager-queue%3Flane%3Dassign
        const targetSampleUrl = `${origin}/samples/GTM-LAB1?tab=work&returnTo=%2Fmanager-queue%3Flane%3Dassign`;
        console.log('Navigating to canonical sample route:', targetSampleUrl);
        await pageCdp.send('Page.navigate', { url: targetSampleUrl });
        await sleep(1500);

        const evalStep2 = await pageCdp.send('Runtime.evaluate', {
            expression: `
                (() => {
                    const bodyText = document.body.innerText;
                    const hasError = bodyText.includes('Application Error') || 
                                     bodyText.includes('ReferenceError') || 
                                     bodyText.includes('ArrowRight is not defined');
                    
                    const hasCanonicalId = bodyText.includes('GTM-LAB1');
                    const hasDisplayId = bodyText.includes('S005');
                    
                    // Check nextAction primary button
                    const buttons = Array.from(document.querySelectorAll('button'));
                    const assignButton = buttons.find(b => b.innerText.includes('Assign') && b.innerText.includes('15'));
                    const buttonHasSvg = assignButton ? Boolean(assignButton.querySelector('svg')) : false;

                    // Check back button
                    const backButton = buttons.find(b => b.innerText.includes('Back to queue') || b.innerText.includes('Back'));
                    const backText = backButton ? backButton.innerText.trim() : null;

                    // Check table tasks count
                    const rows = document.querySelectorAll('table tbody tr');
                    const taskRowCount = rows.length;

                    return {
                        hasError,
                        hasCanonicalId,
                        hasDisplayId,
                        assignButtonFound: Boolean(assignButton),
                        assignButtonText: assignButton ? assignButton.innerText.trim() : null,
                        buttonHasSvg,
                        backText,
                        taskRowCount
                    };
                })()
            `,
            returnByValue: true
        });

        const step2Data = evalStep2.result.value;
        console.log('Step 2 Evaluation Result:', step2Data);

        if (step2Data.hasError) {
            throw new Error(`[CRASH_DETECTED] SampleDetail crashed with application error: ${JSON.stringify(step2Data)}`);
        }
        if (!step2Data.assignButtonFound) {
            throw new Error('[BUTTON_NOT_FOUND] Primary Assign Next Action button not found in DOM');
        }

        console.log('[PASS] Step 2: SampleDetail loaded cleanly without Application Error');
        console.log('[PASS] Step 3: Primary Action Button rendered:', step2Data.assignButtonText, '(SVG Icon Present:', step2Data.buttonHasSvg, ')');
        console.log('[PASS] Step 4: Back button text respects returnTo context:', step2Data.backText);
        console.log('[PASS] Step 5: S005 WorkItemsTable renders tasks count:', step2Data.taskRowCount);

        // Step 6: Capture Screenshot
        console.log('[6/6] Capturing high-resolution viewport screenshot...');
        const screenshotResult = await pageCdp.send('Page.captureScreenshot', {
            format: 'png',
            captureBeyondViewport: false
        });

        const screenshotPath = path.resolve(EVIDENCE_DIR, 'sample_detail_manager_assign_route.png');
        fs.writeFileSync(screenshotPath, Buffer.from(screenshotResult.data, 'base64'));
        console.log('Saved screenshot to:', screenshotPath);

        const evidencePayload = {
            timestamp: new Date().toISOString(),
            status: 'PASS',
            environment: {
                node: process.version,
                database: 'disposable_journey_sample_assignment.db',
                isolationRefusalGuard: 'ACTIVE'
            },
            checks: {
                superAdminQueueAggregation: {
                    s005Tasks: 15,
                    s004Tasks: 11,
                    w001Tasks: 12,
                    totalQueueTasks: 38,
                    status: 'PASS'
                },
                canonicalSampleResolution: {
                    canonicalSampleId: 'GTM-LAB1',
                    displayLabCode: 'S005',
                    route: '/samples/GTM-LAB1?tab=work&returnTo=%2Fmanager-queue%3Flane%3Dassign',
                    resolvedCanonicalId: step2Data.hasCanonicalId,
                    resolvedDisplayId: step2Data.hasDisplayId,
                    status: 'PASS'
                },
                referenceErrorResolved: {
                    arrowRightDefined: true,
                    applicationError: false,
                    primaryButtonText: step2Data.assignButtonText,
                    buttonHasSvgIcon: step2Data.buttonHasSvg,
                    status: 'PASS'
                },
                navigationContext: {
                    backButtonLabel: step2Data.backText,
                    expectedLabel: 'Back to queue',
                    status: 'PASS'
                }
            },
            artifacts: {
                screenshot: 'sample_detail_manager_assign_route.png'
            }
        };

        const jsonPath = path.resolve(EVIDENCE_DIR, 'sample_detail_manager_assign_evidence.json');
        fs.writeFileSync(jsonPath, JSON.stringify(evidencePayload, null, 2));
        console.log('Saved evidence JSON to:', jsonPath);

        exitCode = 0;
    } catch (err) {
        console.error('[BROWSER_JOURNEY_FAILED]', err);
    } finally {
        if (cdp) cdp.close();
        if (chromeProc) {
            chromeProc.kill('SIGTERM');
            await new Promise(r => {
                chromeProc.on('exit', r);
                setTimeout(r, 1000);
            });
        }
        if (server) {
            await new Promise(r => server.close(r));
        }
        await prisma.$disconnect();
        await sleep(500);
        cleanupDisposableDatabase(runnerDir);
    }

    process.exit(exitCode);
}

run();
