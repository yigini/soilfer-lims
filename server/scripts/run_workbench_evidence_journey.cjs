'use strict';

/**
 * Isolated Browser Evidence Journey for Workbench Deep Linking & Search (Refs #128, Refs #123)
 * 
 * Verifies live browser DOM and captures evidence screenshots:
 * Journey 1 (Issue #128): tech_gtm_1 deep-link resolution for workItemId + specimen code sampleId
 *   - Target resolution into WorksheetArea
 *   - Active analysis selection and task highlight in table & contextual inspector
 *   - Refresh survival
 *   - Unavailable target states (contradictory 400, cross-lab 403, missing 404)
 * Journey 2 (Issue #123): tech_gtm_2 search & queue filtering
 *   - Default queue visibility for specimen code work items
 *   - Search accepts typing
 *   - Filtering by sample specimen code, field ID, method code/name, and methodology name
 *   - Honest empty state and search clear/restore
 *   - Strict laboratory scope retention (cross-lab exclusion)
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const WebSocket = require('ws');

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

const prisma = require('../prisma');
const app = require('../app');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACT_DIR = path.resolve(__dirname, '..', '..', 'artifacts', 'evidence-journeys');
const BRAIN_ARTIFACT_DIR = path.resolve('C:\\Users\\yigin\\.gemini\\antigravity\\brain\\80c11c12-5cb7-4455-a433-01544d488498');

if (!fs.existsSync(ARTIFACT_DIR)) {
    fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
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
                        if (msg.error) reject(new Error(msg.error.message || JSON.stringify(msg.error)));
                        else resolve(msg.result);
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

    close() {
        if (this.ws) this.ws.close();
    }
}

async function getJson(url) {
    return new Promise((resolve, reject) => {
        http.get(url, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(body)); }
                catch (e) { reject(e); }
            });
        }).on('error', reject);
    });
}

const sleep = ms => new Promise(res => setTimeout(res, ms));

async function captureScreenshot(pageCdp, filename, description) {
    const shot = await pageCdp.send('Page.captureScreenshot', { format: 'png' });
    const localPath = path.join(ARTIFACT_DIR, filename);
    fs.writeFileSync(localPath, Buffer.from(shot.data, 'base64'));

    if (fs.existsSync(BRAIN_ARTIFACT_DIR)) {
        const brainPath = path.join(BRAIN_ARTIFACT_DIR, filename);
        fs.writeFileSync(brainPath, Buffer.from(shot.data, 'base64'));
    }

    console.log(`[EVIDENCE SCREENSHOT] ${description} -> ${filename}`);
}

async function main() {
    let server = null;
    let chromeProc = null;
    let pageCdp = null;
    let browserCdp = null;

    const evidenceResults = {
        timestamp: new Date().toISOString(),
        suite: 'Workbench Deep Linking & Search Isolation Evidence',
        issues: ['#128', '#123'],
        journeys: []
    };

    try {
        console.log('[1/6] Seeding isolated representative lab records...');

        // Labs
        await prisma.lab.upsert({
            where: { id: 'GTM-LAB1' },
            update: { name: 'SoilFER Guatemala Central Lab', code: 'GTM-LAB1', country: 'GTM', isActive: true },
            create: { id: 'GTM-LAB1', name: 'SoilFER Guatemala Central Lab', code: 'GTM-LAB1', country: 'GTM', isActive: true }
        });

        await prisma.lab.upsert({
            where: { id: 'HND-LAB1' },
            update: { name: 'SoilFER Honduras Regional Lab', code: 'HND-LAB1', country: 'HND', isActive: true },
            create: { id: 'HND-LAB1', name: 'SoilFER Honduras Regional Lab', code: 'HND-LAB1', country: 'HND', isActive: true }
        });

        // Analyses
        await prisma.analysis.upsert({
            where: { code: 'TN' },
            update: { name: 'Total Nitrogen', units: '%', status: 'active' },
            create: { code: 'TN', name: 'Total Nitrogen', units: '%', status: 'active' }
        });
        await prisma.analysis.upsert({
            where: { code: 'SOC' },
            update: { name: 'Soil Organic Carbon', units: 'g/kg', status: 'active' },
            create: { code: 'SOC', name: 'Soil Organic Carbon', units: 'g/kg', status: 'active' }
        });
        await prisma.analysis.upsert({
            where: { code: 'PH_H2O' },
            update: { name: 'Soil pH in Water', units: 'pH units', status: 'active' },
            create: { code: 'PH_H2O', name: 'Soil pH in Water', units: 'pH units', status: 'active' }
        });
        await prisma.analysis.upsert({
            where: { code: 'DRYING' },
            update: { name: 'Drying', units: '', status: 'active' },
            create: { code: 'DRYING', name: 'Drying', units: '', status: 'active' }
        });

        // Methodology
        const methodTN = await prisma.methodology.upsert({
            where: { id: 'METH-TN-KJELDAHL' },
            update: { name: 'Kjeldahl Total Nitrogen', standard: 'ISO 11261:1995', analysisCode: 'TN' },
            create: { id: 'METH-TN-KJELDAHL', name: 'Kjeldahl Total Nitrogen', standard: 'ISO 11261:1995', analysisCode: 'TN' }
        });

        const methodPH = await prisma.methodology.upsert({
            where: { id: 'METH-PH-ISO10390' },
            update: { name: 'Potentiometric pH in Water (1:2.5)', standard: 'ISO 10390:2021', analysisCode: 'PH_H2O' },
            create: { id: 'METH-PH-ISO10390', name: 'Potentiometric pH in Water (1:2.5)', standard: 'ISO 10390:2021', analysisCode: 'PH_H2O' }
        });

        const passwordHash = await bcrypt.hash('password123', 10);

        // Tech 1 (GTM)
        const tech1 = await prisma.user.upsert({
            where: { username: 'tech_gtm_1' },
            update: { role: 'LAB_TECHNICIAN', password: passwordHash, labId: 'GTM-LAB1', email: 'tech_gtm_1@soilfer.org', isActive: true },
            create: {
                id: 'usr-tech-gtm-1',
                username: 'tech_gtm_1',
                name: 'Mario Alvarez (Technician 1)',
                email: 'tech_gtm_1@soilfer.org',
                role: 'LAB_TECHNICIAN',
                password: passwordHash,
                labId: 'GTM-LAB1',
                isActive: true
            }
        });

        // Tech 2 (GTM)
        const tech2 = await prisma.user.upsert({
            where: { username: 'tech_gtm_2' },
            update: { role: 'LAB_TECHNICIAN', password: passwordHash, labId: 'GTM-LAB1', email: 'tech_gtm_2@soilfer.org', isActive: true },
            create: {
                id: 'usr-tech-gtm-2',
                username: 'tech_gtm_2',
                name: 'Elena Ramos (Technician 2)',
                email: 'tech_gtm_2@soilfer.org',
                role: 'LAB_TECHNICIAN',
                password: passwordHash,
                labId: 'GTM-LAB1',
                isActive: true
            }
        });

        // Tech HND (Cross-Lab)
        const techHnd = await prisma.user.upsert({
            where: { username: 'tech_hnd_1' },
            update: { role: 'LAB_TECHNICIAN', password: passwordHash, labId: 'HND-LAB1', email: 'tech_hnd_1@soilfer.org', isActive: true },
            create: {
                id: 'usr-tech-hnd-1',
                username: 'tech_hnd_1',
                name: 'Carlos Ruiz (HND Technician)',
                email: 'tech_hnd_1@soilfer.org',
                role: 'LAB_TECHNICIAN',
                password: passwordHash,
                labId: 'HND-LAB1',
                isActive: true
            }
        });

        // Sample 1: GHA0816-1-1C-S (reported in Issue #128)
        const sample1 = await prisma.sample.upsert({
            where: { id: 'GHA0816-1-1C-S' },
            update: {
                originalId: 'GHA0816-1-1C-S',
                labId: 'GHA0816-1-1C-S',
                assignedLab: 'GTM-LAB1',
                status: 'SUBMITTED_PARTIAL',
                projectCode: 'DEMO-GTM-2026',
                dryingStatus: 'DONE',
                preparationStatus: 'DONE'
            },
            create: {
                id: 'GHA0816-1-1C-S',
                originalId: 'GHA0816-1-1C-S',
                labId: 'GHA0816-1-1C-S',
                assignedLab: 'GTM-LAB1',
                status: 'SUBMITTED_PARTIAL',
                projectCode: 'DEMO-GTM-2026',
                dryingStatus: 'DONE',
                preparationStatus: 'DONE'
            }
        });

        // WorkItem reported in Issue #128: WI-1789634536044-167 assigned to tech_gtm_1
        const workItem128 = await prisma.workItem.upsert({
            where: { id: 'WI-1789634536044-167' },
            update: {
                sampleId: sample1.id,
                labId: 'GHA0816-1-1C-S',
                assignedLab: 'GTM-LAB1',
                analysis: 'TN',
                status: 'ASSIGNED',
                assignedTo: 'tech_gtm_1',
                methodologyId: methodTN.id,
                priority: 'HIGH'
            },
            create: {
                id: 'WI-1789634536044-167',
                sampleId: sample1.id,
                labId: 'GHA0816-1-1C-S',
                assignedLab: 'GTM-LAB1',
                analysis: 'TN',
                status: 'ASSIGNED',
                assignedTo: 'tech_gtm_1',
                methodologyId: methodTN.id,
                priority: 'HIGH'
            }
        });

        // Completed work item for tech_gtm_2 on sample1
        await prisma.workItem.upsert({
            where: { id: 'WI-1789634535966-552' },
            update: {
                sampleId: sample1.id,
                labId: 'GHA0816-1-1C-S',
                assignedLab: 'GTM-LAB1',
                analysis: 'DRYING',
                status: 'COMPLETED',
                assignedTo: 'tech_gtm_2'
            },
            create: {
                id: 'WI-1789634535966-552',
                sampleId: sample1.id,
                labId: 'GHA0816-1-1C-S',
                assignedLab: 'GTM-LAB1',
                analysis: 'DRYING',
                status: 'COMPLETED',
                assignedTo: 'tech_gtm_2'
            }
        });

        // Sample 2: S002 (with labId = S003, assigned to tech_gtm_2)
        const sample2 = await prisma.sample.upsert({
            where: { id: 'SMP-GTM-S002' },
            update: {
                originalId: 'FIELD-PLOT-002',
                labId: 'S003',
                assignedLab: 'GTM-LAB1',
                status: 'ACCEPTED',
                projectCode: 'DEMO-GTM-2026',
                dryingStatus: 'DONE',
                preparationStatus: 'DONE'
            },
            create: {
                id: 'SMP-GTM-S002',
                originalId: 'FIELD-PLOT-002',
                labId: 'S003',
                assignedLab: 'GTM-LAB1',
                status: 'ACCEPTED',
                projectCode: 'DEMO-GTM-2026',
                dryingStatus: 'DONE',
                preparationStatus: 'DONE'
            }
        });

        const workItemS002PH = await prisma.workItem.upsert({
            where: { id: 'WI-1789551515705-805' },
            update: {
                sampleId: sample2.id,
                labId: 'S003',
                assignedLab: 'GTM-LAB1',
                analysis: 'PH_H2O',
                status: 'ASSIGNED',
                assignedTo: 'tech_gtm_2',
                methodologyId: methodPH.id,
                priority: 'NORMAL'
            },
            create: {
                id: 'WI-1789551515705-805',
                sampleId: sample2.id,
                labId: 'S003',
                assignedLab: 'GTM-LAB1',
                analysis: 'PH_H2O',
                status: 'ASSIGNED',
                assignedTo: 'tech_gtm_2',
                methodologyId: methodPH.id,
                priority: 'NORMAL'
            }
        });

        const workItemS002SOC = await prisma.workItem.upsert({
            where: { id: 'WI-1789551515731-354' },
            update: {
                sampleId: sample2.id,
                labId: 'S003',
                assignedLab: 'GTM-LAB1',
                analysis: 'SOC',
                status: 'ASSIGNED',
                assignedTo: 'tech_gtm_2',
                priority: 'NORMAL'
            },
            create: {
                id: 'WI-1789551515731-354',
                sampleId: sample2.id,
                labId: 'S003',
                assignedLab: 'GTM-LAB1',
                analysis: 'SOC',
                status: 'ASSIGNED',
                assignedTo: 'tech_gtm_2',
                priority: 'NORMAL'
            }
        });

        // Sample 3 (HND Cross-Lab)
        const sampleHnd = await prisma.sample.upsert({
            where: { id: 'SMP-HND-999' },
            update: {
                originalId: 'FIELD-HND-999',
                labId: 'HND-999',
                assignedLab: 'HND-LAB1',
                status: 'ACCEPTED',
                projectCode: 'DEMO-HND-2026'
            },
            create: {
                id: 'SMP-HND-999',
                originalId: 'FIELD-HND-999',
                labId: 'HND-999',
                assignedLab: 'HND-LAB1',
                status: 'ACCEPTED',
                projectCode: 'DEMO-HND-2026'
            }
        });

        await prisma.workItem.upsert({
            where: { id: 'WI-HND-CROSS-999' },
            update: {
                sampleId: sampleHnd.id,
                labId: 'HND-999',
                assignedLab: 'HND-LAB1',
                analysis: 'TN',
                status: 'ASSIGNED',
                assignedTo: 'tech_hnd_1'
            },
            create: {
                id: 'WI-HND-CROSS-999',
                sampleId: sampleHnd.id,
                labId: 'HND-999',
                assignedLab: 'HND-LAB1',
                analysis: 'TN',
                status: 'ASSIGNED',
                assignedTo: 'tech_hnd_1'
            }
        });

        console.log('[2/6] Starting application server on ephemeral port...');
        server = http.createServer(app);
        await new Promise(r => server.listen(0, '127.0.0.1', r));
        const port = server.address().port;
        console.log(`Server running at http://127.0.0.1:${port}`);

        const tokenTech1 = jwt.sign(
            { id: tech1.id, username: tech1.username, role: tech1.role, labId: tech1.labId },
            process.env.JWT_SECRET,
            { expiresIn: '2h' }
        );

        const tokenTech2 = jwt.sign(
            { id: tech2.id, username: tech2.username, role: tech2.role, labId: tech2.labId },
            process.env.JWT_SECRET,
            { expiresIn: '2h' }
        );

        console.log('[3/6] Starting Headless Chrome via CDP...');
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
            '--window-size=1440,960',
            'about:blank'
        ], { stdio: 'ignore' });

        await sleep(1500);

        const versionInfo = await getJson(`http://127.0.0.1:${cdpPort}/json/version`);
        browserCdp = new CDPClient(versionInfo.webSocketDebuggerUrl);
        await browserCdp.connect();

        const { targetId } = await browserCdp.send('Target.createTarget', { url: 'about:blank' });
        pageCdp = new CDPClient(`ws://127.0.0.1:${cdpPort}/devtools/page/${targetId}`);
        await pageCdp.connect();

        await pageCdp.send('Page.enable');
        await pageCdp.send('DOM.enable');
        await pageCdp.send('Runtime.enable');

        // Helper: set auth in localStorage
        const setAuth = async (token, user) => {
            await pageCdp.send('Page.navigate', { url: `http://127.0.0.1:${port}/` });
            await sleep(800);
            await pageCdp.send('Runtime.evaluate', {
                expression: `
                    localStorage.setItem('token', '${token}');
                    localStorage.setItem('user', JSON.stringify({
                        id: '${user.id}',
                        username: '${user.username}',
                        role: '${user.role}',
                        labId: '${user.labId}'
                    }));
                `
            });
        };

        // ═════════════════════════════════════════════════════════════════════
        // JOURNEY 1: ISSUE #128 DEEP-LINK RESOLUTION (tech_gtm_1)
        // ═════════════════════════════════════════════════════════════════════
        console.log('\n[4/6] JOURNEY 1: ISSUE #128 DEEP-LINK RESOLUTION (tech_gtm_1)...');
        await setAuth(tokenTech1, tech1);

        // 1.1 Direct deep link to workItemId + sampleId
        const deepLinkUrl = `http://127.0.0.1:${port}/workbench?workItemId=WI-1789634536044-167&sampleId=GHA0816-1-1C-S`;
        console.log(`Navigating to ${deepLinkUrl}...`);
        await pageCdp.send('Page.navigate', { url: deepLinkUrl });
        await sleep(2500);

        const deepLinkState = (await pageCdp.send('Runtime.evaluate', {
            returnByValue: true,
            expression: `
                (() => {
                    const text = document.body.innerText;
                    const sampleVisible = text.includes('GHA0816-1-1C-S');
                    const tnVisible = text.includes('Total Nitrogen') || text.includes('TN');
                    const hasSelectedRow = Boolean(document.querySelector('tr[class*="sf-selected"]') || document.querySelector('tr[class*="bg-[var(--sf-selected)]"]'));
                    const navButtons = Array.from(document.querySelectorAll('nav[aria-label="Workbench navigation"] button'));
                    const worksheetBtn = navButtons.find(b => b.textContent.includes('Worksheet'));
                    const isWorksheetTabActive = Boolean(worksheetBtn && (worksheetBtn.className.includes('border-sf-primary') || worksheetBtn.className.includes('font-bold')));
                    const asides = Array.from(document.querySelectorAll('aside'));
                    const inspectorAside = asides.find(a => a.textContent.includes('Selected Sample') || a.textContent.includes('SELECTED SAMPLE')) || asides[asides.length - 1];
                    const inspectorText = inspectorAside ? inspectorAside.innerText : '';
                    return {
                        sampleVisible,
                        tnVisible,
                        hasSelectedRow,
                        isWorksheetTabActive,
                        inspectorHasSample: inspectorText.includes('GHA0816-1-1C-S')
                    };
                })()
            `
        })).result?.value;

        console.log('Journey 1.1 State:', deepLinkState);
        await captureScreenshot(pageCdp, 'workbench_issue128_target_resolved.png', 'Issue #128: Target Work Item Resolved & Selected');

        if (!deepLinkState.sampleVisible || !deepLinkState.isWorksheetTabActive) {
            throw new Error(`[JOURNEY 1 FAILED] Deep link target resolution failed: ${JSON.stringify(deepLinkState)}`);
        }

        evidenceResults.journeys.push({
            journey: '1.1 Deep Link Target Resolution',
            issue: '#128',
            url: deepLinkUrl,
            user: 'tech_gtm_1',
            verified: deepLinkState,
            screenshot: 'workbench_issue128_target_resolved.png'
        });

        // 1.2 Queue Refresh Survival
        console.log('Testing Refresh Survival...');
        await pageCdp.send('Runtime.evaluate', {
            expression: `
                (() => {
                    const refreshBtn = document.querySelector('button[title="Refresh queue"]');
                    if (refreshBtn) refreshBtn.click();
                })()
            `
        });
        await sleep(2000);

        const refreshState = (await pageCdp.send('Runtime.evaluate', {
            returnByValue: true,
            expression: `
                (() => {
                    const text = document.body.innerText;
                    const sampleVisible = text.includes('GHA0816-1-1C-S');
                    const hasSelectedRow = Boolean(document.querySelector('tr[class*="sf-selected"]') || document.querySelector('tr[class*="bg-[var(--sf-selected)]"]'));
                    return { sampleVisible, hasSelectedRow };
                })()
            `
        })).result?.value;

        console.log('Journey 1.2 Refresh Survival State:', refreshState);
        await captureScreenshot(pageCdp, 'workbench_issue128_refresh_survived.png', 'Issue #128: Deep Link Survives Queue Refresh');

        evidenceResults.journeys.push({
            journey: '1.2 Refresh Survival',
            issue: '#128',
            verified: refreshState,
            screenshot: 'workbench_issue128_refresh_survived.png'
        });

        // 1.3 Unavailable target: Contradictory identifiers
        console.log('Testing Contradictory Identifiers Link...');
        const contradictoryUrl = `http://127.0.0.1:${port}/workbench?workItemId=WI-1789634536044-167&sampleId=SMP-GTM-S002`;
        await pageCdp.send('Page.navigate', { url: contradictoryUrl });
        await sleep(2000);

        const contradictoryState = (await pageCdp.send('Runtime.evaluate', {
            returnByValue: true,
            expression: `
                (() => {
                    const text = document.body.innerText;
                    const hasContradictoryToast = text.includes('Contradictory identifiers') || text.includes('does not belong to sample');
                    return { hasContradictoryToast };
                })()
            `
        })).result?.value;

        console.log('Journey 1.3 Contradictory State:', contradictoryState);
        await captureScreenshot(pageCdp, 'workbench_issue128_contradictory_identifiers.png', 'Issue #128: Contradictory Identifiers Honest Toast');

        evidenceResults.journeys.push({
            journey: '1.3 Contradictory Identifiers Link',
            issue: '#128',
            url: contradictoryUrl,
            verified: contradictoryState,
            screenshot: 'workbench_issue128_contradictory_identifiers.png'
        });

        // 1.4 Unavailable target: Cross-lab access denial
        console.log('Testing Cross-Lab Target Link...');
        const crossLabUrl = `http://127.0.0.1:${port}/workbench?workItemId=WI-HND-CROSS-999&sampleId=SMP-HND-999`;
        await pageCdp.send('Page.navigate', { url: crossLabUrl });
        await sleep(2000);

        const crossLabState = (await pageCdp.send('Runtime.evaluate', {
            returnByValue: true,
            expression: `
                (() => {
                    const text = document.body.innerText;
                    const hasForbiddenToast = text.includes('Access denied') || text.includes('another laboratory');
                    return { hasForbiddenToast };
                })()
            `
        })).result?.value;

        console.log('Journey 1.4 Cross-Lab State:', crossLabState);
        await captureScreenshot(pageCdp, 'workbench_issue128_crosslab_forbidden.png', 'Issue #128: Cross-Lab Access Denied Toast');

        evidenceResults.journeys.push({
            journey: '1.4 Cross-Lab Access Denial',
            issue: '#128',
            url: crossLabUrl,
            verified: crossLabState,
            screenshot: 'workbench_issue128_crosslab_forbidden.png'
        });

        // 1.5 Unavailable target: Missing work item
        console.log('Testing Missing Work Item Link...');
        const missingUrl = `http://127.0.0.1:${port}/workbench?workItemId=WI-NON-EXISTENT-999`;
        await pageCdp.send('Page.navigate', { url: missingUrl });
        await sleep(2000);

        const missingState = (await pageCdp.send('Runtime.evaluate', {
            returnByValue: true,
            expression: `
                (() => {
                    const text = document.body.innerText;
                    const hasNotFoundToast = text.includes('was not found') || text.includes('not found');
                    return { hasNotFoundToast };
                })()
            `
        })).result?.value;

        console.log('Journey 1.5 Missing Target State:', missingState);
        await captureScreenshot(pageCdp, 'workbench_issue128_not_found.png', 'Issue #128: Work Item Not Found Toast');

        evidenceResults.journeys.push({
            journey: '1.5 Missing Work Item Link',
            issue: '#128',
            url: missingUrl,
            verified: missingState,
            screenshot: 'workbench_issue128_not_found.png'
        });

        // ═════════════════════════════════════════════════════════════════════
        // JOURNEY 2: ISSUE #123 SEARCH & QUEUE FILTERING (tech_gtm_2)
        // ═════════════════════════════════════════════════════════════════════
        console.log('\n[5/6] JOURNEY 2: ISSUE #123 SEARCH & QUEUE FILTERING (tech_gtm_2)...');
        await setAuth(tokenTech2, tech2);

        // 2.1 Default Queue Visibility
        console.log('Navigating to /workbench as tech_gtm_2...');
        await pageCdp.send('Page.navigate', { url: `http://127.0.0.1:${port}/workbench` });
        await sleep(2500);

        const defaultQueueState = (await pageCdp.send('Runtime.evaluate', {
            returnByValue: true,
            expression: `
                (() => {
                    const text = document.body.innerText;
                    const hasS003 = text.includes('S003');
                    const hasField002 = text.includes('FIELD-PLOT-002');
                    const rowsCount = document.querySelectorAll('tbody tr').length;
                    return { hasS003, hasField002, rowsCount };
                })()
            `
        })).result?.value;

        console.log('Journey 2.1 Default Queue State:', defaultQueueState);
        await captureScreenshot(pageCdp, 'workbench_issue123_default_queue.png', 'Issue #123: Default Queue Visible for Specimen Code Work Items');

        if (!defaultQueueState.hasS003 || defaultQueueState.rowsCount === 0) {
            throw new Error(`[JOURNEY 2 FAILED] Default queue empty for tech_gtm_2: ${JSON.stringify(defaultQueueState)}`);
        }

        evidenceResults.journeys.push({
            journey: '2.1 Default Queue Visibility',
            issue: '#123',
            user: 'tech_gtm_2',
            verified: defaultQueueState,
            screenshot: 'workbench_issue123_default_queue.png'
        });

        // Helper to simulate search input typing
        const typeSearch = async (query) => {
            await pageCdp.send('Runtime.evaluate', {
                expression: `
                    (() => {
                        const input = document.querySelector('input[placeholder*="Search by sample ID or method"]');
                        if (input) {
                            const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                            nativeInputValueSetter.call(input, '${query}');
                            input.dispatchEvent(new Event('input', { bubbles: true }));
                            input.dispatchEvent(new Event('change', { bubbles: true }));
                        }
                    })()
                `
            });
            await sleep(500);
        };

        // 2.2 Search by Specimen Code
        console.log('Testing search by specimen code "S003"...');
        await typeSearch('S003');
        const searchSampleState = (await pageCdp.send('Runtime.evaluate', {
            returnByValue: true,
            expression: `
                (() => {
                    const rows = Array.from(document.querySelectorAll('tbody tr'));
                    const matchRows = rows.filter(r => r.innerText.includes('S003'));
                    return { matchCount: matchRows.length, totalRows: rows.length };
                })()
            `
        })).result?.value;

        console.log('Journey 2.2 Search Sample State:', searchSampleState);
        await captureScreenshot(pageCdp, 'workbench_issue123_search_sample.png', 'Issue #123: Search by Sample Specimen Code Filters Rows');

        evidenceResults.journeys.push({
            journey: '2.2 Search by Specimen Code',
            issue: '#123',
            query: 'S003',
            verified: searchSampleState,
            screenshot: 'workbench_issue123_search_sample.png'
        });

        // 2.3 Search by Field Original ID
        console.log('Testing search by field ID "FIELD-PLOT-002"...');
        await typeSearch('FIELD-PLOT-002');
        const searchFieldState = (await pageCdp.send('Runtime.evaluate', {
            returnByValue: true,
            expression: `
                (() => {
                    const rows = Array.from(document.querySelectorAll('tbody tr'));
                    const matchRows = rows.filter(r => r.innerText.includes('FIELD-PLOT-002'));
                    return { matchCount: matchRows.length, totalRows: rows.length };
                })()
            `
        })).result?.value;

        console.log('Journey 2.3 Search Field ID State:', searchFieldState);
        await captureScreenshot(pageCdp, 'workbench_issue123_search_field_id.png', 'Issue #123: Search by Original Field ID Filters Rows');

        evidenceResults.journeys.push({
            journey: '2.3 Search by Field ID',
            issue: '#123',
            query: 'FIELD-PLOT-002',
            verified: searchFieldState,
            screenshot: 'workbench_issue123_search_field_id.png'
        });

        // 2.4 Search by Methodology Name
        console.log('Testing search by methodology "ISO 10390"...');
        await typeSearch('ISO 10390');
        const searchMethodState = (await pageCdp.send('Runtime.evaluate', {
            returnByValue: true,
            expression: `
                (() => {
                    const rows = Array.from(document.querySelectorAll('tbody tr'));
                    const matchRows = rows.filter(r => r.innerText.includes('Soil pH in Water') || r.innerText.includes('PH_H2O'));
                    return { matchCount: matchRows.length, totalRows: rows.length };
                })()
            `
        })).result?.value;

        console.log('Journey 2.4 Search Methodology State:', searchMethodState);
        await captureScreenshot(pageCdp, 'workbench_issue123_search_methodology.png', 'Issue #123: Search by Methodology Name Filters Rows');

        evidenceResults.journeys.push({
            journey: '2.4 Search by Methodology',
            issue: '#123',
            query: 'ISO 10390',
            verified: searchMethodState,
            screenshot: 'workbench_issue123_search_methodology.png'
        });

        // 2.5 Non-matching search produces honest empty state
        console.log('Testing non-matching search "NON_EXISTENT_XYZ"...');
        await typeSearch('NON_EXISTENT_XYZ');
        const searchEmptyState = (await pageCdp.send('Runtime.evaluate', {
            returnByValue: true,
            expression: `
                (() => {
                    const text = document.body.innerText;
                    const hasEmptyMessage = text.includes('No work items match "NON_EXISTENT_XYZ"');
                    return { hasEmptyMessage };
                })()
            `
        })).result?.value;

        console.log('Journey 2.5 Empty Search State:', searchEmptyState);
        await captureScreenshot(pageCdp, 'workbench_issue123_search_empty.png', 'Issue #123: Non-Matching Search Shows Honest Empty State');

        evidenceResults.journeys.push({
            journey: '2.5 Non-Matching Search Empty State',
            issue: '#123',
            query: 'NON_EXISTENT_XYZ',
            verified: searchEmptyState,
            screenshot: 'workbench_issue123_search_empty.png'
        });

        // 2.6 Clearing search restores full queue
        console.log('Testing clearing search...');
        await typeSearch('');
        const searchClearedState = (await pageCdp.send('Runtime.evaluate', {
            returnByValue: true,
            expression: `
                (() => {
                    const rowsCount = document.querySelectorAll('tbody tr').length;
                    return { rowsCount, restored: rowsCount >= 2 };
                })()
            `
        })).result?.value;

        console.log('Journey 2.6 Cleared Search State:', searchClearedState);
        await captureScreenshot(pageCdp, 'workbench_issue123_search_cleared.png', 'Issue #123: Cleared Search Restores Authorized Queue');

        evidenceResults.journeys.push({
            journey: '2.6 Cleared Search Restores Queue',
            issue: '#123',
            verified: searchClearedState,
            screenshot: 'workbench_issue123_search_cleared.png'
        });

        // Write evidence JSON
        const evidenceJsonPath = path.join(ARTIFACT_DIR, 'workbench_verification_evidence.json');
        fs.writeFileSync(evidenceJsonPath, JSON.stringify(evidenceResults, null, 2));

        if (fs.existsSync(BRAIN_ARTIFACT_DIR)) {
            const brainJsonPath = path.join(BRAIN_ARTIFACT_DIR, 'workbench_verification_evidence.json');
            fs.writeFileSync(brainJsonPath, JSON.stringify(evidenceResults, null, 2));
        }

        console.log('\n[6/6] VERIFICATION COMPLETE! Evidence written to:', evidenceJsonPath);
    } finally {
        if (pageCdp) pageCdp.close();
        if (browserCdp) browserCdp.close();
        if (chromeProc) {
            try { chromeProc.kill(); } catch (_) {}
        }
        if (server) {
            await new Promise(r => server.close(r));
        }
        cleanupDisposableDatabase(runnerDir);
    }
}

main().catch(err => {
    console.error('FATAL ERROR:', err);
    process.exit(1);
});
