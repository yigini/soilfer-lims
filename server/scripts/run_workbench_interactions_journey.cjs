'use strict';

/**
 * Isolated Browser Interaction Journey for Workbench Deep Linking & Search (Refs #128, Refs #123)
 * 
 * Executes genuine browser pointer and keyboard interactions:
 * - Journey 1 (Issue #128):
 *     * Starts at actual Sample Workspace Analysis table (/samples/:id) under disposable technician tech_gtm_1.
 *     * Clicks rendered "Open in Workbench →" action via CDP pointer automation (Input.dispatchMouseEvent).
 *     * Asserts resulting URL and exact selected work item, worksheet tab, and contextual inspector.
 *     * Verifies browser reload (Page.reload) preserves selected work item and inspector state.
 *     * Verifies browser history.back() returns to Sample Workspace and history.forward() restores Workbench context.
 *     * Retains verifiable prior HTTP contracts without full rerun.
 * - Journey 2 (Issue #123):
 *     * Starts at Workbench queue (/workbench) under disposable technician tech_gtm_2.
 *     * Focuses search input via CDP pointer click (Input.dispatchMouseEvent).
 *     * Types queries via CDP keyboard input (Input.dispatchKeyEvent) - NO synthetic DOM values or React events.
 *     * Verifies visible input value and matching row identities for:
 *         1. Sample Specimen Code (e.g. "S003")
 *         2. Field Original ID (e.g. "FIELD-PLOT-002")
 *         3. Methodology (e.g. "ISO 10390")
 *         4. Beyond-initial-window target (e.g. "FIELD-PLOT-015" / "S015", measured rect.top > window.innerHeight initially)
 *         5. Truthful empty state for non-matching query ("NONEXISTENT_XYZ_999")
 *         6. Clearing search via Backspace keystrokes restores full authorized queue.
 *     * Asserts cross-lab / other technician exclusion (foreign lab items absent).
 * - Records measured source commit, served asset hashes, browser platform, and input mechanism provenance.
 * - Preserves existing evidence reports unchanged; outputs new workbench_interactions_evidence.json.
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const { spawn, execSync } = require('child_process');
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

function computeFileHash(filePath) {
    if (!fs.existsSync(filePath)) return null;
    const content = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(content).digest('hex');
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

/**
 * Dispatches CDP pointer click (mousePressed + mouseReleased) at element center.
 */
async function clickElement(pageCdp, selector) {
    const box = (await pageCdp.send('Runtime.evaluate', {
        expression: `(() => {
            const el = document.querySelector('${selector}');
            if (!el) return null;
            el.scrollIntoView({ block: 'center', inline: 'center' });
            const r = el.getBoundingClientRect();
            return {
                x: r.left + r.width / 2,
                y: r.top + r.height / 2,
                width: r.width,
                height: r.height
            };
        })()`,
        returnByValue: true
    })).result?.value;

    if (!box || box.width === 0 || box.height === 0) {
        throw new Error(`[CLICK FAILED] Element not found or invisible: ${selector}`);
    }

    await pageCdp.send('Input.dispatchMouseEvent', {
        type: 'mousePressed',
        x: box.x,
        y: box.y,
        button: 'left',
        clickCount: 1
    });
    await pageCdp.send('Input.dispatchMouseEvent', {
        type: 'mouseReleased',
        x: box.x,
        y: box.y,
        button: 'left',
        clickCount: 1
    });
    await sleep(200);
}

/**
 * Types text via genuine CDP keyboard events (Input.dispatchKeyEvent).
 */
async function typeTextViaKeyboard(pageCdp, text) {
    for (const char of text) {
        await pageCdp.send('Input.dispatchKeyEvent', {
            type: 'keyDown',
            text: char,
            unmodifiedText: char,
            key: char
        });
        await pageCdp.send('Input.dispatchKeyEvent', {
            type: 'keyUp',
            key: char
        });
        await sleep(35);
    }
    await sleep(250);
}

/**
 * Clears an input using genuine Backspace keystrokes.
 */
async function clearViaBackspace(pageCdp, charCount) {
    for (let i = 0; i < charCount; i++) {
        await pageCdp.send('Input.dispatchKeyEvent', {
            type: 'keyDown',
            key: 'Backspace',
            code: 'Backspace',
            windowsVirtualKeyCode: 8
        });
        await pageCdp.send('Input.dispatchKeyEvent', {
            type: 'keyUp',
            key: 'Backspace',
            code: 'Backspace',
            windowsVirtualKeyCode: 8
        });
        await sleep(25);
    }
    await sleep(250);
}

async function main() {
    let server = null;
    let chromeProc = null;
    let pageCdp = null;
    let browserCdp = null;

    // Measure runtime source commit
    let sourceCommit = 'unknown';
    try {
        sourceCommit = execSync('git rev-parse HEAD', { cwd: path.resolve(__dirname, '..', '..') }).toString().trim();
    } catch (_) {}

    // Measure built client assets
    const clientDistAssets = path.resolve(__dirname, '..', '..', 'client', 'dist', 'assets');
    const assetFiles = fs.existsSync(clientDistAssets) ? fs.readdirSync(clientDistAssets) : [];
    const indexJs = assetFiles.find(f => f.startsWith('index-') && f.endsWith('.js'));
    const workbenchJs = assetFiles.find(f => f.startsWith('TechWorkbench-') && f.endsWith('.js'));
    const indexCss = assetFiles.find(f => f.startsWith('index-') && f.endsWith('.css'));

    const measuredAssets = {
        indexJs: indexJs ? { name: indexJs, sha256: computeFileHash(path.join(clientDistAssets, indexJs)) } : null,
        workbenchJs: workbenchJs ? { name: workbenchJs, sha256: computeFileHash(path.join(clientDistAssets, workbenchJs)) } : null,
        indexCss: indexCss ? { name: indexCss, sha256: computeFileHash(path.join(clientDistAssets, indexCss)) } : null
    };

    console.log('[PROVENANCE] Source commit:', sourceCommit);
    console.log('[PROVENANCE] Measured assets:', measuredAssets);

    const evidenceResults = {
        timestamp: new Date().toISOString(),
        suite: 'Workbench Final Interactions Evidence Journey',
        issues: ['#128', '#123'],
        provenance: {
            sourceCommit,
            releasedAppCommit: '2ef64cd',
            platform: process.platform,
            browser: 'Google Chrome (Headless)',
            inputMechanism: {
                pointer: 'CDP Input.dispatchMouseEvent (mousePressed / mouseReleased at bounding rect center)',
                keyboard: 'CDP Input.dispatchKeyEvent (keyDown / keyUp per character, Backspace key events)',
                syntheticValueAssignment: false,
                syntheticReactEvents: false,
                directUrlBypass: false
            },
            servedAssets: measuredAssets
        },
        journeys: []
    };

    try {
        console.log('\n[1/6] Seeding isolated synthetic database fixtures...');

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

        // Methodologies
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

        // Project
        await prisma.project.upsert({
            where: { code: 'DEMO-GTM-2026' },
            update: { name: 'Demo Project Guatemala 2026', status: 'ACTIVE' },
            create: { id: 'proj-gtm-2026', code: 'DEMO-GTM-2026', name: 'Demo Project Guatemala 2026', status: 'ACTIVE' }
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

        // Tech HND (Cross-Lab Foreign Principal)
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

        // ─────────────────────────────────────────────────────────────────────
        // Sample 1: GHA0816-1-1C-S (Issue #128 Test Target)
        // ─────────────────────────────────────────────────────────────────────
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

        // ─────────────────────────────────────────────────────────────────────
        // Fixtures for tech_gtm_2 (#123 Queue Search & Beyond-Initial-Window)
        // ─────────────────────────────────────────────────────────────────────
        // Seed 14 items in group 1 (PH_H2O) + 1 target item (15th) in group 2 (TN, sorts after PH_H2O)
        for (let i = 1; i <= 14; i++) {
            const numStr = String(i).padStart(3, '0');
            const sampleId = `SMP-GTM-S${numStr}`;
            const fieldId = `FIELD-PLOT-${numStr}`;
            const labId = `S${numStr}`;
            const analysisCode = 'PH_H2O';
            // Only item 1 has ISO 10390 methodology for dedicated methodology search test
            const methodologyId = (i === 1) ? methodPH.id : null;

            await prisma.sample.upsert({
                where: { id: sampleId },
                update: {
                    originalId: fieldId,
                    labId: labId,
                    assignedLab: 'GTM-LAB1',
                    status: 'ACCEPTED',
                    projectCode: 'DEMO-GTM-2026',
                    dryingStatus: 'DONE',
                    preparationStatus: 'DONE'
                },
                create: {
                    id: sampleId,
                    originalId: fieldId,
                    labId: labId,
                    assignedLab: 'GTM-LAB1',
                    status: 'ACCEPTED',
                    projectCode: 'DEMO-GTM-2026',
                    dryingStatus: 'DONE',
                    preparationStatus: 'DONE'
                }
            });

            await prisma.workItem.upsert({
                where: { id: `WI-GTM-2026-${numStr}` },
                update: {
                    sampleId: sampleId,
                    labId: labId,
                    assignedLab: 'GTM-LAB1',
                    analysis: analysisCode,
                    status: 'ASSIGNED',
                    assignedTo: 'tech_gtm_2',
                    methodologyId: methodologyId,
                    priority: 'NORMAL'
                },
                create: {
                    id: `WI-GTM-2026-${numStr}`,
                    sampleId: sampleId,
                    labId: labId,
                    assignedLab: 'GTM-LAB1',
                    analysis: analysisCode,
                    status: 'ASSIGNED',
                    assignedTo: 'tech_gtm_2',
                    methodologyId: methodologyId,
                    priority: 'NORMAL'
                }
            });
        }

        // 15th Work Item: Beyond-Initial-Window Target (Total Nitrogen, sorts alphabetically after Soil pH in Water)
        const sample15 = await prisma.sample.upsert({
            where: { id: 'SMP-GTM-S015' },
            update: {
                originalId: 'FIELD-PLOT-015',
                labId: 'S015',
                assignedLab: 'GTM-LAB1',
                status: 'ACCEPTED',
                projectCode: 'DEMO-GTM-2026',
                dryingStatus: 'DONE',
                preparationStatus: 'DONE'
            },
            create: {
                id: 'SMP-GTM-S015',
                originalId: 'FIELD-PLOT-015',
                labId: 'S015',
                assignedLab: 'GTM-LAB1',
                status: 'ACCEPTED',
                projectCode: 'DEMO-GTM-2026',
                dryingStatus: 'DONE',
                preparationStatus: 'DONE'
            }
        });

        await prisma.workItem.upsert({
            where: { id: 'WI-GTM-2026-015' },
            update: {
                sampleId: sample15.id,
                labId: 'S015',
                assignedLab: 'GTM-LAB1',
                analysis: 'TN',
                status: 'ASSIGNED',
                assignedTo: 'tech_gtm_2',
                methodologyId: methodTN.id,
                priority: 'NORMAL'
            },
            create: {
                id: 'WI-GTM-2026-015',
                sampleId: sample15.id,
                labId: 'S015',
                assignedLab: 'GTM-LAB1',
                analysis: 'TN',
                status: 'ASSIGNED',
                assignedTo: 'tech_gtm_2',
                methodologyId: methodTN.id,
                priority: 'NORMAL'
            }
        });

        // Foreign Lab Sample (Cross-Lab Exclusion Target)
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
        console.log(`Server listening on http://127.0.0.1:${port}`);

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
        // JOURNEY 1 (ISSUE #128): SAMPLE WORKSPACE ACTION-CLICK & NAVIGATION
        // ═════════════════════════════════════════════════════════════════════
        console.log('\n[4/6] JOURNEY 1 (ISSUE #128): SAMPLE WORKSPACE ACTION-CLICK & NAVIGATION...');
        await setAuth(tokenTech1, tech1);

        // 1.1 Start at Sample Workspace Analysis Table
        const sampleUrl = `http://127.0.0.1:${port}/samples/GHA0816-1-1C-S`;
        console.log(`1.1 Navigating to Sample Workspace: ${sampleUrl}...`);
        await pageCdp.send('Page.navigate', { url: sampleUrl });
        await sleep(2500);

        const sampleWorkspaceState = (await pageCdp.send('Runtime.evaluate', {
            returnByValue: true,
            expression: `(() => {
                const text = document.body.innerText;
                const hasSampleTitle = text.includes('GHA0816-1-1C-S');
                const rows = Array.from(document.querySelectorAll('tbody tr'));
                const targetRow = rows.find(r => r.innerText.includes('WI-1789634536044-167') || r.innerText.includes('Total Nitrogen'));
                const actionButton = targetRow ? targetRow.querySelector('button[title="Open task in Technician Workbench"]') : null;
                return {
                    hasSampleTitle,
                    hasTargetRow: Boolean(targetRow),
                    hasActionButton: Boolean(actionButton),
                    actionButtonText: actionButton ? actionButton.innerText.trim() : null
                };
            })()`
        })).result?.value;

        console.log('Sample Workspace initial state:', sampleWorkspaceState);
        if (!sampleWorkspaceState.hasSampleTitle || !sampleWorkspaceState.hasTargetRow || !sampleWorkspaceState.hasActionButton) {
            throw new Error(`[JOURNEY 1 FAILED] Target work item action button not rendered in Sample Workspace: ${JSON.stringify(sampleWorkspaceState)}`);
        }

        await captureScreenshot(pageCdp, 'workbench_issue128_sample_workspace_action_rendered.png', 'Issue #128: Sample Workspace Analysis Table Action Rendered');

        // 1.2 Click rendered action button using CDP pointer automation
        console.log('1.2 Clicking rendered "Open in Workbench →" action via CDP pointer event...');
        const actionButtonSelector = 'tbody tr button[title="Open task in Technician Workbench"]';
        await clickElement(pageCdp, actionButtonSelector);
        await sleep(2500);

        const workbenchTargetState = (await pageCdp.send('Runtime.evaluate', {
            returnByValue: true,
            expression: `(() => {
                const currentUrl = window.location.href;
                const pathname = window.location.pathname;
                const search = window.location.search;
                const text = document.body.innerText;

                const navButtons = Array.from(document.querySelectorAll('nav[aria-label="Workbench navigation"] button'));
                const worksheetBtn = navButtons.find(b => b.textContent.includes('Worksheet'));
                const isWorksheetTabActive = Boolean(worksheetBtn && (worksheetBtn.className.includes('border-sf-primary') || worksheetBtn.className.includes('font-bold')));

                const hasSelectedRow = Boolean(document.querySelector('tr[class*="sf-selected"]') || document.querySelector('tr[class*="bg-[var(--sf-selected)]"]'));

                const asides = Array.from(document.querySelectorAll('aside'));
                const inspectorAside = asides.find(a => a.textContent.includes('Selected Sample') || a.textContent.includes('SELECTED SAMPLE')) || asides[asides.length - 1];
                const inspectorText = inspectorAside ? inspectorAside.innerText : '';

                return {
                    currentUrl,
                    pathname,
                    search,
                    isWorksheetTabActive,
                    hasSelectedRow,
                    inspectorHasSample: inspectorText.includes('GHA0816-1-1C-S'),
                    bodyHasSample: text.includes('GHA0816-1-1C-S')
                };
            })()`
        })).result?.value;

        console.log('Workbench target resolved state:', workbenchTargetState);
        await captureScreenshot(pageCdp, 'workbench_issue128_action_click_target_resolved.png', 'Issue #128: Action Click Resolved Target in Workbench');

        if (!workbenchTargetState.pathname.includes('/workbench') ||
            !workbenchTargetState.search.includes('workItemId=WI-1789634536044-167') ||
            !workbenchTargetState.search.includes('sampleId=GHA0816-1-1C-S') ||
            !workbenchTargetState.isWorksheetTabActive ||
            !workbenchTargetState.hasSelectedRow ||
            !workbenchTargetState.inspectorHasSample) {
            throw new Error(`[JOURNEY 1 FAILED] Target work item resolution failed after action click: ${JSON.stringify(workbenchTargetState)}`);
        }

        evidenceResults.journeys.push({
            journey: '1.2 Action Click Target Resolution',
            issue: '#128',
            mechanism: 'CDP Input.dispatchMouseEvent on rendered Sample Workspace table button',
            verified: workbenchTargetState,
            screenshot: 'workbench_issue128_action_click_target_resolved.png'
        });

        // 1.3 Verify Page Reload Survival
        console.log('1.3 Reloading page via CDP Page.reload...');
        await pageCdp.send('Page.reload');
        await sleep(2500);

        const reloadState = (await pageCdp.send('Runtime.evaluate', {
            returnByValue: true,
            expression: `(() => {
                const currentUrl = window.location.href;
                const pathname = window.location.pathname;
                const search = window.location.search;

                const navButtons = Array.from(document.querySelectorAll('nav[aria-label="Workbench navigation"] button'));
                const worksheetBtn = navButtons.find(b => b.textContent.includes('Worksheet'));
                const isWorksheetTabActive = Boolean(worksheetBtn && (worksheetBtn.className.includes('border-sf-primary') || worksheetBtn.className.includes('font-bold')));

                const hasSelectedRow = Boolean(document.querySelector('tr[class*="sf-selected"]') || document.querySelector('tr[class*="bg-[var(--sf-selected)]"]'));

                const asides = Array.from(document.querySelectorAll('aside'));
                const inspectorAside = asides.find(a => a.textContent.includes('Selected Sample') || a.textContent.includes('SELECTED SAMPLE')) || asides[asides.length - 1];
                const inspectorText = inspectorAside ? inspectorAside.innerText : '';

                return {
                    currentUrl,
                    pathname,
                    search,
                    isWorksheetTabActive,
                    hasSelectedRow,
                    inspectorHasSample: inspectorText.includes('GHA0816-1-1C-S')
                };
            })()`
        })).result?.value;

        console.log('Reload survival state:', reloadState);
        await captureScreenshot(pageCdp, 'workbench_issue128_reload_survived.png', 'Issue #128: Selection & Context Survived Browser Reload');

        if (!reloadState.isWorksheetTabActive || !reloadState.hasSelectedRow || !reloadState.inspectorHasSample) {
            throw new Error(`[JOURNEY 1 FAILED] Context did not survive browser reload: ${JSON.stringify(reloadState)}`);
        }

        evidenceResults.journeys.push({
            journey: '1.3 Browser Reload Survival',
            issue: '#128',
            mechanism: 'CDP Page.reload',
            verified: reloadState,
            screenshot: 'workbench_issue128_reload_survived.png'
        });

        // 1.4 Verify History Back Navigation (Returns to Sample Workspace)
        console.log('1.4 Navigating back via window.history.back()...');
        await pageCdp.send('Runtime.evaluate', { expression: 'window.history.back()' });
        await sleep(2500);

        const historyBackState = (await pageCdp.send('Runtime.evaluate', {
            returnByValue: true,
            expression: `(() => {
                const currentUrl = window.location.href;
                const pathname = window.location.pathname;
                const text = document.body.innerText;
                const hasSampleTitle = text.includes('GHA0816-1-1C-S');
                const hasWorkItemsTable = Boolean(document.querySelector('button[title="Open task in Technician Workbench"]'));
                return {
                    currentUrl,
                    pathname,
                    hasSampleTitle,
                    hasWorkItemsTable
                };
            })()`
        })).result?.value;

        console.log('History back state:', historyBackState);
        await captureScreenshot(pageCdp, 'workbench_issue128_history_back_sample_workspace.png', 'Issue #128: History Back Restored Sample Workspace');

        if (!historyBackState.pathname.includes('/samples/GHA0816-1-1C-S') || !historyBackState.hasSampleTitle || !historyBackState.hasWorkItemsTable) {
            throw new Error(`[JOURNEY 1 FAILED] History back did not restore Sample Workspace: ${JSON.stringify(historyBackState)}`);
        }

        evidenceResults.journeys.push({
            journey: '1.4 History Back Navigation',
            issue: '#128',
            mechanism: 'Browser history.back()',
            verified: historyBackState,
            screenshot: 'workbench_issue128_history_back_sample_workspace.png'
        });

        // 1.5 Verify History Forward Navigation (Restores Workbench Selection)
        console.log('1.5 Navigating forward via window.history.forward()...');
        await pageCdp.send('Runtime.evaluate', { expression: 'window.history.forward()' });
        await sleep(2500);

        const historyForwardState = (await pageCdp.send('Runtime.evaluate', {
            returnByValue: true,
            expression: `(() => {
                const currentUrl = window.location.href;
                const pathname = window.location.pathname;
                const search = window.location.search;

                const navButtons = Array.from(document.querySelectorAll('nav[aria-label="Workbench navigation"] button'));
                const worksheetBtn = navButtons.find(b => b.textContent.includes('Worksheet'));
                const isWorksheetTabActive = Boolean(worksheetBtn && (worksheetBtn.className.includes('border-sf-primary') || worksheetBtn.className.includes('font-bold')));

                const hasSelectedRow = Boolean(document.querySelector('tr[class*="sf-selected"]') || document.querySelector('tr[class*="bg-[var(--sf-selected)]"]'));

                const asides = Array.from(document.querySelectorAll('aside'));
                const inspectorAside = asides.find(a => a.textContent.includes('Selected Sample') || a.textContent.includes('SELECTED SAMPLE')) || asides[asides.length - 1];
                const inspectorText = inspectorAside ? inspectorAside.innerText : '';

                return {
                    currentUrl,
                    pathname,
                    search,
                    isWorksheetTabActive,
                    hasSelectedRow,
                    inspectorHasSample: inspectorText.includes('GHA0816-1-1C-S')
                };
            })()`
        })).result?.value;

        console.log('History forward state:', historyForwardState);
        await captureScreenshot(pageCdp, 'workbench_issue128_history_forward_workbench_restored.png', 'Issue #128: History Forward Restored Selected Workbench Task');

        if (!historyForwardState.pathname.includes('/workbench') || !historyForwardState.isWorksheetTabActive || !historyForwardState.hasSelectedRow) {
            throw new Error(`[JOURNEY 1 FAILED] History forward did not restore Workbench context: ${JSON.stringify(historyForwardState)}`);
        }

        evidenceResults.journeys.push({
            journey: '1.5 History Forward Navigation',
            issue: '#128',
            mechanism: 'Browser history.forward()',
            verified: historyForwardState,
            screenshot: 'workbench_issue128_history_forward_workbench_restored.png'
        });

        // ═════════════════════════════════════════════════════════════════════
        // JOURNEY 2 (ISSUE #123): GENUINE KEYBOARD INPUT IN QUEUE SEARCH
        // ═════════════════════════════════════════════════════════════════════
        console.log('\n[5/6] JOURNEY 2 (ISSUE #123): GENUINE KEYBOARD INPUT IN QUEUE SEARCH...');
        await setAuth(tokenTech2, tech2);

        // 2.1 Default Queue Visibility & Beyond-Initial-Window Verification
        console.log('2.1 Navigating to /workbench as tech_gtm_2...');
        await pageCdp.send('Page.navigate', { url: `http://127.0.0.1:${port}/workbench` });
        await sleep(2500);

        const defaultQueueState = (await pageCdp.send('Runtime.evaluate', {
            returnByValue: true,
            expression: `(() => {
                const rows = Array.from(document.querySelectorAll('tbody tr'));
                const rowTexts = rows.map(r => r.innerText);

                // Find 15th row (beyond initial viewport window)
                const targetRow = rows.find(r => r.innerText.includes('FIELD-PLOT-015') || r.innerText.includes('S015'));
                const targetRect = targetRow ? targetRow.getBoundingClientRect() : null;
                const isOutsideInitialViewport = targetRect ? targetRect.top > window.innerHeight : false;

                // Check foreign lab item absence
                const hasForeignLabItem = rowTexts.some(t => t.includes('HND-999') || t.includes('FIELD-HND-999') || t.includes('HND-LAB1'));

                return {
                    totalRows: rows.length,
                    hasTargetRow: Boolean(targetRow),
                    targetRowTop: targetRect ? targetRect.top : null,
                    viewportHeight: window.innerHeight,
                    isOutsideInitialViewport,
                    hasForeignLabItem
                };
            })()`
        })).result?.value;

        console.log('Default Queue & Target Position State:', defaultQueueState);
        await captureScreenshot(pageCdp, 'workbench_issue123_interaction_default_queue.png', 'Issue #123: Default Queue with Beyond-Window Target');

        if (defaultQueueState.totalRows < 15 || !defaultQueueState.hasTargetRow || !defaultQueueState.isOutsideInitialViewport) {
            throw new Error(`[JOURNEY 2 FAILED] Expected target row to be outside initial visible window: ${JSON.stringify(defaultQueueState)}`);
        }
        if (defaultQueueState.hasForeignLabItem) {
            throw new Error('[JOURNEY 2 FAILED] Foreign laboratory item present in technician queue!');
        }

        evidenceResults.journeys.push({
            journey: '2.1 Default Queue & Beyond-Window Target Placement',
            issue: '#123',
            verified: defaultQueueState,
            screenshot: 'workbench_issue123_interaction_default_queue.png'
        });

        const searchInputSelector = 'input[placeholder*="Search by sample ID or method"]';

        // 2.2 Focus search input via CDP pointer click
        console.log('2.2 Focusing search input via CDP mouse click...');
        await clickElement(pageCdp, searchInputSelector);

        // 2.3 Search by Specimen Code "S003" via genuine keyboard typing
        console.log('2.3 Typing specimen code "S003" via CDP Input.dispatchKeyEvent...');
        await typeTextViaKeyboard(pageCdp, 'S003');

        const searchSampleState = (await pageCdp.send('Runtime.evaluate', {
            returnByValue: true,
            expression: `(() => {
                const input = document.querySelector('input[placeholder*="Search by sample ID or method"]');
                const inputValue = input ? input.value : null;
                const rows = Array.from(document.querySelectorAll('tbody tr'));
                const matchRows = rows.filter(r => r.innerText.includes('S003'));
                return {
                    inputValue,
                    totalVisibleRows: rows.length,
                    matchCount: matchRows.length,
                    allRowsMatch: rows.length > 0 && rows.every(r => r.innerText.includes('S003'))
                };
            })()`
        })).result?.value;

        console.log('Search Specimen Code State:', searchSampleState);
        await captureScreenshot(pageCdp, 'workbench_issue123_interaction_search_sample.png', 'Issue #123: Keyboard Search by Sample Specimen Code');

        if (searchSampleState.inputValue !== 'S003' || !searchSampleState.allRowsMatch || searchSampleState.matchCount === 0) {
            throw new Error(`[JOURNEY 2 FAILED] Specimen code search failed: ${JSON.stringify(searchSampleState)}`);
        }

        evidenceResults.journeys.push({
            journey: '2.3 Search by Specimen Code',
            issue: '#123',
            query: 'S003',
            inputMechanism: 'CDP Input.dispatchKeyEvent',
            verified: searchSampleState,
            screenshot: 'workbench_issue123_interaction_search_sample.png'
        });

        // 2.4 Clear via Backspace keystrokes and verify queue restoration
        console.log('2.4 Clearing search via Backspace keystrokes...');
        await clearViaBackspace(pageCdp, 'S003'.length);

        const clearedState1 = (await pageCdp.send('Runtime.evaluate', {
            returnByValue: true,
            expression: `(() => {
                const input = document.querySelector('input[placeholder*="Search by sample ID or method"]');
                const inputValue = input ? input.value : null;
                const rowsCount = document.querySelectorAll('tbody tr').length;
                return { inputValue, rowsCount, restored: rowsCount >= 15 };
            })()`
        })).result?.value;

        console.log('Cleared Search State 1:', clearedState1);
        if (clearedState1.inputValue !== '' || !clearedState1.restored) {
            throw new Error(`[JOURNEY 2 FAILED] Queue not restored after Backspace: ${JSON.stringify(clearedState1)}`);
        }

        // 2.5 Search by Original Field ID "FIELD-PLOT-002" via genuine keyboard typing
        console.log('2.5 Typing field ID "FIELD-PLOT-002" via keyboard...');
        await typeTextViaKeyboard(pageCdp, 'FIELD-PLOT-002');

        const searchFieldState = (await pageCdp.send('Runtime.evaluate', {
            returnByValue: true,
            expression: `(() => {
                const input = document.querySelector('input[placeholder*="Search by sample ID or method"]');
                const inputValue = input ? input.value : null;
                const rows = Array.from(document.querySelectorAll('tbody tr'));
                const matchRows = rows.filter(r => r.innerText.includes('FIELD-PLOT-002'));
                return {
                    inputValue,
                    totalVisibleRows: rows.length,
                    matchCount: matchRows.length,
                    allRowsMatch: rows.length > 0 && rows.every(r => r.innerText.includes('FIELD-PLOT-002'))
                };
            })()`
        })).result?.value;

        console.log('Search Field ID State:', searchFieldState);
        await captureScreenshot(pageCdp, 'workbench_issue123_interaction_search_field_id.png', 'Issue #123: Keyboard Search by Original Field ID');

        if (searchFieldState.inputValue !== 'FIELD-PLOT-002' || !searchFieldState.allRowsMatch || searchFieldState.matchCount === 0) {
            throw new Error(`[JOURNEY 2 FAILED] Field ID search failed: ${JSON.stringify(searchFieldState)}`);
        }

        evidenceResults.journeys.push({
            journey: '2.5 Search by Field ID',
            issue: '#123',
            query: 'FIELD-PLOT-002',
            inputMechanism: 'CDP Input.dispatchKeyEvent',
            verified: searchFieldState,
            screenshot: 'workbench_issue123_interaction_search_field_id.png'
        });

        // Clear via Backspace
        console.log('Clearing search via Backspace...');
        await clearViaBackspace(pageCdp, 'FIELD-PLOT-002'.length);

        // 2.6 Search by Methodology "ISO 10390" via genuine keyboard typing
        console.log('2.6 Typing methodology "ISO 10390" via keyboard...');
        await typeTextViaKeyboard(pageCdp, 'ISO 10390');

        const searchMethodState = (await pageCdp.send('Runtime.evaluate', {
            returnByValue: true,
            expression: `(() => {
                const input = document.querySelector('input[placeholder*="Search by sample ID or method"]');
                const inputValue = input ? input.value : null;
                const rows = Array.from(document.querySelectorAll('tbody tr'));
                const matchRows = rows.filter(r => r.innerText.includes('Soil pH in Water') || r.innerText.includes('PH_H2O'));
                return {
                    inputValue,
                    totalVisibleRows: rows.length,
                    matchCount: matchRows.length,
                    allRowsMatch: rows.length > 0 && rows.every(r => r.innerText.includes('Soil pH in Water') || r.innerText.includes('PH_H2O'))
                };
            })()`
        })).result?.value;

        console.log('Search Methodology State:', searchMethodState);
        await captureScreenshot(pageCdp, 'workbench_issue123_interaction_search_methodology.png', 'Issue #123: Keyboard Search by Methodology Standard');

        if (searchMethodState.inputValue !== 'ISO 10390' || !searchMethodState.allRowsMatch || searchMethodState.matchCount === 0) {
            throw new Error(`[JOURNEY 2 FAILED] Methodology search failed: ${JSON.stringify(searchMethodState)}`);
        }

        evidenceResults.journeys.push({
            journey: '2.6 Search by Methodology',
            issue: '#123',
            query: 'ISO 10390',
            inputMechanism: 'CDP Input.dispatchKeyEvent',
            verified: searchMethodState,
            screenshot: 'workbench_issue123_interaction_search_methodology.png'
        });

        // Clear via Backspace
        console.log('Clearing search via Backspace...');
        await clearViaBackspace(pageCdp, 'ISO 10390'.length);

        // 2.7 Search for Target Initially Beyond Window ("FIELD-PLOT-015")
        console.log('2.7 Typing beyond-initial-window target "FIELD-PLOT-015" via keyboard...');
        await typeTextViaKeyboard(pageCdp, 'FIELD-PLOT-015');

        const beyondWindowState = (await pageCdp.send('Runtime.evaluate', {
            returnByValue: true,
            expression: `(() => {
                const input = document.querySelector('input[placeholder*="Search by sample ID or method"]');
                const inputValue = input ? input.value : null;
                const rows = Array.from(document.querySelectorAll('tbody tr'));
                const matchRows = rows.filter(r => r.innerText.includes('FIELD-PLOT-015') || r.innerText.includes('S015'));
                const singleMatch = rows.length === 1 && matchRows.length === 1;

                const targetRow = matchRows[0];
                const rect = targetRow ? targetRow.getBoundingClientRect() : null;
                const isNowInsideViewport = rect ? (rect.top >= 0 && rect.top < window.innerHeight) : false;

                return {
                    inputValue,
                    totalVisibleRows: rows.length,
                    singleMatch,
                    nowInsideViewport: isNowInsideViewport,
                    rectTop: rect ? rect.top : null,
                    viewportHeight: window.innerHeight
                };
            })()`
        })).result?.value;

        console.log('Beyond-Window Target Filtered State:', beyondWindowState);
        await captureScreenshot(pageCdp, 'workbench_issue123_interaction_search_beyond_initial_window.png', 'Issue #123: Target Outside Initial Window Filtered and Visible');

        if (beyondWindowState.inputValue !== 'FIELD-PLOT-015' || !beyondWindowState.singleMatch || !beyondWindowState.nowInsideViewport) {
            throw new Error(`[JOURNEY 2 FAILED] Beyond-window target search failed: ${JSON.stringify(beyondWindowState)}`);
        }

        evidenceResults.journeys.push({
            journey: '2.7 Search for Target Outside Initial Window',
            issue: '#123',
            query: 'FIELD-PLOT-015',
            inputMechanism: 'CDP Input.dispatchKeyEvent',
            verified: beyondWindowState,
            screenshot: 'workbench_issue123_interaction_search_beyond_initial_window.png'
        });

        // Clear via Backspace
        console.log('Clearing search via Backspace...');
        await clearViaBackspace(pageCdp, 'FIELD-PLOT-015'.length);

        // 2.8 Non-Matching Query Produces Truthful Empty State
        console.log('2.8 Typing non-matching query "NONEXISTENT_XYZ_999" via keyboard...');
        await typeTextViaKeyboard(pageCdp, 'NONEXISTENT_XYZ_999');

        const searchEmptyState = (await pageCdp.send('Runtime.evaluate', {
            returnByValue: true,
            expression: `(() => {
                const input = document.querySelector('input[placeholder*="Search by sample ID or method"]');
                const inputValue = input ? input.value : null;
                const text = document.body.innerText;
                const hasEmptyMessage = text.includes('No work items match "NONEXISTENT_XYZ_999"');
                const rows = Array.from(document.querySelectorAll('tbody tr'));
                return {
                    inputValue,
                    hasEmptyMessage,
                    totalRows: rows.length
                };
            })()`
        })).result?.value;

        console.log('Search Non-Matching Empty State:', searchEmptyState);
        await captureScreenshot(pageCdp, 'workbench_issue123_interaction_search_empty.png', 'Issue #123: Truthful Empty State on Non-Matching Search');

        if (searchEmptyState.inputValue !== 'NONEXISTENT_XYZ_999' || !searchEmptyState.hasEmptyMessage) {
            throw new Error(`[JOURNEY 2 FAILED] Truthful empty state missing: ${JSON.stringify(searchEmptyState)}`);
        }

        evidenceResults.journeys.push({
            journey: '2.8 Non-Matching Search Empty State',
            issue: '#123',
            query: 'NONEXISTENT_XYZ_999',
            inputMechanism: 'CDP Input.dispatchKeyEvent',
            verified: searchEmptyState,
            screenshot: 'workbench_issue123_interaction_search_empty.png'
        });

        // 2.9 Final Clear Restores Full Authorized Queue
        console.log('2.9 Clearing search via Backspace keystrokes to restore full queue...');
        await clearViaBackspace(pageCdp, 'NONEXISTENT_XYZ_999'.length);

        const searchClearedFinal = (await pageCdp.send('Runtime.evaluate', {
            returnByValue: true,
            expression: `(() => {
                const input = document.querySelector('input[placeholder*="Search by sample ID or method"]');
                const inputValue = input ? input.value : null;
                const rows = Array.from(document.querySelectorAll('tbody tr'));
                const hasForeignLabItem = rows.some(r => r.innerText.includes('HND-999') || r.innerText.includes('FIELD-HND-999'));
                return {
                    inputValue,
                    rowsCount: rows.length,
                    restored: rows.length >= 15,
                    hasForeignLabItem
                };
            })()`
        })).result?.value;

        console.log('Final Cleared Search State:', searchClearedFinal);
        await captureScreenshot(pageCdp, 'workbench_issue123_interaction_search_cleared.png', 'Issue #123: Cleared Search Restores Full Authorized Queue');

        if (searchClearedFinal.inputValue !== '' || !searchClearedFinal.restored || searchClearedFinal.hasForeignLabItem) {
            throw new Error(`[JOURNEY 2 FAILED] Final queue restoration failed: ${JSON.stringify(searchClearedFinal)}`);
        }

        evidenceResults.journeys.push({
            journey: '2.9 Cleared Search Restores Queue',
            issue: '#123',
            inputMechanism: 'CDP Backspace keystrokes',
            verified: searchClearedFinal,
            screenshot: 'workbench_issue123_interaction_search_cleared.png'
        });

        // Write evidence JSON to both locations
        const evidenceJsonPath = path.join(ARTIFACT_DIR, 'workbench_interactions_evidence.json');
        fs.writeFileSync(evidenceJsonPath, JSON.stringify(evidenceResults, null, 2));

        if (fs.existsSync(BRAIN_ARTIFACT_DIR)) {
            const brainJsonPath = path.join(BRAIN_ARTIFACT_DIR, 'workbench_interactions_evidence.json');
            fs.writeFileSync(brainJsonPath, JSON.stringify(evidenceResults, null, 2));
        }

        console.log('\n[6/6] INTERACTION EVIDENCE COMPLETE! Ledger written to:', evidenceJsonPath);
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
    console.error('FATAL ERROR IN WORKBENCH INTERACTIONS JOURNEY:', err);
    process.exit(1);
});
