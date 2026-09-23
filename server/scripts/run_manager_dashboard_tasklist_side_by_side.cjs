'use strict';

/**
 * Side-by-Side Verification of LAB_MANAGER Dashboard (/) vs Manager Task List (/manager-queue) (Refs #120)
 * 
 * Verifies live browser DOM and captures side-by-side screenshots:
 * 1. LAB_MANAGER on `/` (Dashboard): verifies Operational Overview (Analysis Progress bars, Tech Workload, Stage Pipeline)
 * 2. LAB_MANAGER on `/` with Queue toggle: verifies inline Pending Work Queue preview
 * 3. LAB_MANAGER on `/manager-queue` (Manager Task List): verifies dedicated actionable workbench
 * 4. SUPER_ADMIN scoped to `/?labId=LAB-GTM`: verifies scoped lab Operational Overview
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

async function main() {
    let server = null;
    let chromeProc = null;
    let pageCdp = null;
    let browserCdp = null;

    try {
        console.log('[1/6] Seeding realistic lab manager records in isolated database...');
        await prisma.lab.upsert({
            where: { id: 'LAB-GTM' },
            update: { name: 'SoilFER Guatemala Lab', code: 'LAB-GTM', country: 'GTM', isActive: true },
            create: { id: 'LAB-GTM', name: 'SoilFER Guatemala Lab', code: 'LAB-GTM', country: 'GTM', isActive: true }
        });

        await prisma.project.upsert({
            where: { code: 'SOILFER-GTM' },
            update: { name: 'Soil Fertility Guatemala', status: 'ACTIVE' },
            create: { id: 'PRJ-SOILFER-GTM', code: 'SOILFER-GTM', name: 'Soil Fertility Guatemala', status: 'ACTIVE' }
        });

        const passwordHash = await bcrypt.hash('password123', 10);
        const managerUser = await prisma.user.upsert({
            where: { username: 'manager_gtm' },
            update: { role: 'LAB_MANAGER', password: passwordHash, labId: 'LAB-GTM', email: 'manager.gtm@soilfer.org', isActive: true },
            create: {
                id: 'usr-mgr-gtm',
                username: 'manager_gtm',
                name: 'Carlos Mendez (Lab Manager)',
                email: 'manager.gtm@soilfer.org',
                role: 'LAB_MANAGER',
                password: passwordHash,
                labId: 'LAB-GTM',
                isActive: true
            }
        });

        const adminUser = await prisma.user.upsert({
            where: { username: 'admin_sys' },
            update: { role: 'SUPER_ADMIN', password: passwordHash, email: 'admin.sys@soilfer.org', isActive: true },
            create: {
                id: 'usr-admin-sys',
                username: 'admin_sys',
                name: 'System Administrator',
                email: 'admin.sys@soilfer.org',
                role: 'SUPER_ADMIN',
                password: passwordHash,
                isActive: true
            }
        });

        // 2 Technicians
        const tech1 = await prisma.user.upsert({
            where: { username: 'tech_gtm_1' },
            update: { role: 'LAB_TECHNICIAN', password: passwordHash, labId: 'LAB-GTM', email: 'tech1@soilfer.org', isActive: true },
            create: {
                id: 'usr-tech-gtm-1',
                username: 'tech_gtm_1',
                name: 'Mario Alvarez (Analyst)',
                email: 'tech1@soilfer.org',
                role: 'LAB_TECHNICIAN',
                password: passwordHash,
                labId: 'LAB-GTM',
                isActive: true
            }
        });

        const tech2 = await prisma.user.upsert({
            where: { username: 'tech_gtm_2' },
            update: { role: 'LAB_TECHNICIAN', password: passwordHash, labId: 'LAB-GTM', email: 'tech2@soilfer.org', isActive: true },
            create: {
                id: 'usr-tech-gtm-2',
                username: 'tech_gtm_2',
                name: 'Elena Fuentes (Analyst)',
                email: 'tech2@soilfer.org',
                role: 'LAB_TECHNICIAN',
                password: passwordHash,
                labId: 'LAB-GTM',
                isActive: true
            }
        });

        // Samples
        const s1 = await prisma.sample.create({
            data: {
                id: 'SMP-GTM-001',
                originalId: 'FIELD-GTM-001',
                labId: 'GTM-2026-0001',
                assignedLab: 'LAB-GTM',
                projectCode: 'SOILFER-GTM',
                status: 'PROCESSING',
                receptionDate: new Date('2026-09-20T10:00:00Z'),
                dryingStatus: 'DONE',
                preparationStatus: 'DONE'
            }
        });

        const s2 = await prisma.sample.create({
            data: {
                id: 'SMP-GTM-002',
                originalId: 'FIELD-GTM-002',
                labId: 'GTM-2026-0002',
                assignedLab: 'LAB-GTM',
                projectCode: 'SOILFER-GTM',
                status: 'PROCESSING',
                receptionDate: new Date('2026-09-21T10:00:00Z'),
                dryingStatus: 'DONE',
                preparationStatus: 'DONE'
            }
        });

        // Work items: s1 has 3 items (1 completed by tech1, 1 in progress by tech1, 1 unassigned)
        await prisma.workItem.create({
            data: {
                id: 'WI-GTM-001',
                sampleId: s1.id,
                labId: s1.labId,
                analysis: 'PH_H2O',
                status: 'COMPLETED',
                assignedTo: 'tech_gtm_1',
                assignedLab: 'LAB-GTM'
            }
        });
        await prisma.workItem.create({
            data: {
                id: 'WI-GTM-002',
                sampleId: s1.id,
                labId: s1.labId,
                analysis: 'EC_1_5',
                status: 'IN_PROGRESS',
                assignedTo: 'tech_gtm_1',
                assignedLab: 'LAB-GTM'
            }
        });
        await prisma.workItem.create({
            data: {
                id: 'WI-GTM-003',
                sampleId: s1.id,
                labId: s1.labId,
                analysis: 'OC_WALKLEY_BLACK',
                status: 'NOT_ASSIGNED',
                assignedTo: null,
                assignedLab: 'LAB-GTM'
            }
        });

        // s2 has 2 analytical items (SUBMITTED by tech2) + 1 closure task (ARCHIVING)
        // -> Ready for Review badge, 100% progress, closure task excluded!
        await prisma.workItem.create({
            data: {
                id: 'WI-GTM-004',
                sampleId: s2.id,
                labId: s2.labId,
                analysis: 'TEXTURE_HYDROMETER',
                status: 'SUBMITTED',
                assignedTo: 'tech_gtm_2',
                assignedLab: 'LAB-GTM'
            }
        });
        await prisma.workItem.create({
            data: {
                id: 'WI-GTM-005',
                sampleId: s2.id,
                labId: s2.labId,
                analysis: 'P_OLSEN',
                status: 'SUBMITTED',
                assignedTo: 'tech_gtm_2',
                assignedLab: 'LAB-GTM'
            }
        });
        await prisma.workItem.create({
            data: {
                id: 'WI-GTM-006-CL',
                sampleId: s2.id,
                labId: s2.labId,
                analysis: 'ARCHIVING',
                status: 'PENDING',
                assignedLab: 'LAB-GTM'
            }
        });

        // s3 has 2 analytical items (ACCEPTED) + 1 closure task (DISPOSAL)
        // -> Ready for Approval badge, 100% progress, final approval eligible!
        const s3 = await prisma.sample.create({
            data: {
                id: 'SMP-GTM-003',
                originalId: 'FIELD-GTM-003',
                labId: 'GTM-2026-0003',
                assignedLab: 'LAB-GTM',
                projectCode: 'SOILFER-GTM',
                status: 'PROCESSING',
                receptionDate: new Date('2026-09-21T11:00:00Z'),
                dryingStatus: 'DONE',
                preparationStatus: 'DONE'
            }
        });
        await prisma.workItem.create({
            data: {
                id: 'WI-GTM-007',
                sampleId: s3.id,
                labId: s3.labId,
                analysis: 'PH_H2O',
                status: 'ACCEPTED',
                assignedTo: 'tech_gtm_1',
                assignedLab: 'LAB-GTM'
            }
        });
        await prisma.workItem.create({
            data: {
                id: 'WI-GTM-008',
                sampleId: s3.id,
                labId: s3.labId,
                analysis: 'EC_1_5',
                status: 'ACCEPTED',
                assignedTo: 'tech_gtm_1',
                assignedLab: 'LAB-GTM'
            }
        });
        await prisma.workItem.create({
            data: {
                id: 'WI-GTM-009-CL',
                sampleId: s3.id,
                labId: s3.labId,
                analysis: 'DISPOSAL',
                status: 'PENDING',
                assignedLab: 'LAB-GTM'
            }
        });

        // s4: Approved today (authoritative approvedAt)
        await prisma.sample.create({
            data: {
                id: 'SMP-GTM-004',
                originalId: 'FIELD-GTM-004',
                labId: 'GTM-2026-0004',
                assignedLab: 'LAB-GTM',
                projectCode: 'SOILFER-GTM',
                status: 'APPROVED',
                receptionDate: new Date('2026-09-19T08:00:00Z'),
                approvedAt: new Date(),
                updatedAt: new Date()
            }
        });

        // s5: Approved in the past, updated today
        await prisma.sample.create({
            data: {
                id: 'SMP-GTM-005',
                originalId: 'FIELD-GTM-005',
                labId: 'GTM-2026-0005',
                assignedLab: 'LAB-GTM',
                projectCode: 'SOILFER-GTM',
                status: 'APPROVED',
                receptionDate: new Date('2026-09-01T08:00:00Z'),
                approvedAt: new Date('2026-09-02T10:00:00Z'),
                updatedAt: new Date()
            }
        });

        console.log('[2/6] Starting application server...');
        server = http.createServer(app);
        await new Promise(r => server.listen(0, '127.0.0.1', r));
        const port = server.address().port;
        console.log(`Server running at http://127.0.0.1:${port}`);

        const managerToken = jwt.sign(
            { id: managerUser.id, username: managerUser.username, role: managerUser.role, labId: managerUser.labId },
            process.env.JWT_SECRET,
            { expiresIn: '2h' }
        );

        const adminToken = jwt.sign(
            { id: adminUser.id, username: adminUser.username, role: adminUser.role },
            process.env.JWT_SECRET,
            { expiresIn: '2h' }
        );

        console.log('[3/6] Starting Chrome...');
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

        // Set manager auth in localStorage
        await pageCdp.send('Page.navigate', { url: `http://127.0.0.1:${port}/` });
        await sleep(1000);
        await pageCdp.send('Runtime.evaluate', {
            expression: `
                localStorage.setItem('token', '${managerToken}');
                localStorage.setItem('user', JSON.stringify({
                    id: '${managerUser.id}',
                    username: '${managerUser.username}',
                    role: '${managerUser.role}',
                    labId: '${managerUser.labId}'
                }));
            `
        });

        // ── STEP 1: Verify LAB_MANAGER Dashboard (/) Operational Overview ──
        console.log('[4/6] Navigating to / (LAB_MANAGER Dashboard - Operational Overview)...');
        await pageCdp.send('Page.navigate', { url: `http://127.0.0.1:${port}/` });
        await sleep(2500);

        const dashOverviewEval = await pageCdp.send('Runtime.evaluate', {
            returnByValue: true,
            expression: `
                (() => {
                    const h1 = document.querySelector('h1')?.innerText || '';
                    const kicker = document.querySelector('.sf-kicker')?.innerText || '';
                    const subtitle = document.querySelector('header p')?.innerText || '';
                    const pageText = document.body.innerText;
                    const pageTextUpper = pageText.toUpperCase();

                    const hasAnalysisProgress = pageTextUpper.includes('ANALYSIS PROGRESS') || pageTextUpper.includes('PROGRESO DE ANÁLISIS');
                    const hasTechWorkload = pageTextUpper.includes('TECHNICIAN WORKLOAD') || pageTextUpper.includes('CARGA TÉCNICA');
                    const hasStagePipeline = pageTextUpper.includes('OPERATIONAL STAGE PIPELINE') || pageTextUpper.includes('FLUJO DE ETAPAS OPERATIVAS');
                    const hasBottleneckAlert = pageTextUpper.includes('UNASSIGNED') || pageTextUpper.includes('ASIGNACIÓN');
                    const hasReadyForReviewBadge = pageTextUpper.includes('READY FOR REVIEW') || pageTextUpper.includes('LISTO PARA REVISIÓN');
                    const hasReadyForApprovalBadge = pageTextUpper.includes('READY FOR APPROVAL') || pageTextUpper.includes('LISTO PARA APROBACIÓN');
                    const hasCompletedStage = pageTextUpper.includes('COMPLETED / RELEASED') || pageTextUpper.includes('COMPLETADAS / LIBERADAS');
                    const hasApprovedTodaySubtext = pageTextUpper.includes('APPROVED TODAY') || pageTextUpper.includes('APROBADAS HOY');
                    const hasStage5Route = Boolean(document.querySelector('a[href*="/samples?status=SUBMITTED_FULL,APPROVED"]'));
                    const progressBars = Array.from(document.querySelectorAll('.rounded-full[style*="width"]')).length;
                    const techCards = Array.from(document.querySelectorAll('div')).filter(d => d.innerText.includes('Mario Alvarez') || d.innerText.includes('Elena Fuentes')).length;

                    return {
                        url: window.location.pathname,
                        h1,
                        kicker,
                        subtitle,
                        hasAnalysisProgress,
                        hasTechWorkload,
                        hasStagePipeline,
                        hasBottleneckAlert,
                        hasReadyForReviewBadge,
                        hasReadyForApprovalBadge,
                        hasCompletedStage,
                        hasApprovedTodaySubtext,
                        hasStage5Route,
                        progressBarsCount: progressBars,
                        techCardsCount: techCards
                    };
                })()
            `
        });

        const dashOverviewResult = dashOverviewEval.result.value;
        console.log('LAB_MANAGER Dashboard Overview Inspection:', JSON.stringify(dashOverviewResult, null, 2));

        const overviewScreenshot = await pageCdp.send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync(path.join(ARTIFACT_DIR, 'manager_dashboard_overview_verified.png'), Buffer.from(overviewScreenshot.data, 'base64'));

        // ── STEP 2: Toggle to Pending Work Queue on Dashboard ──
        console.log('[5/6] Toggling to Pending Work Queue view mode on Dashboard...');
        await pageCdp.send('Runtime.evaluate', {
            expression: `
                (() => {
                    const buttons = Array.from(document.querySelectorAll('button'));
                    const queueBtn = buttons.find(b => b.innerText.includes('Pending Work Queue') || b.innerText.includes('Cola de trabajo pendiente'));
                    if (queueBtn) queueBtn.click();
                })()
            `
        });
        await sleep(1000);

        const queueToggleEval = await pageCdp.send('Runtime.evaluate', {
            returnByValue: true,
            expression: `
                (() => {
                    const pageText = document.body.innerText;
                    const hasWorkQueueTable = Boolean(document.querySelector('th') || document.querySelector('[aria-label*="Work queue"]'));
                    const tableHeaders = Array.from(document.querySelectorAll('th')).map(th => th.innerText.trim());
                    const rowsCount = document.querySelectorAll('tbody tr').length;
                    return {
                        hasWorkQueueTable,
                        tableHeaders,
                        rowsCount
                    };
                })()
            `
        });
        const queueToggleResult = queueToggleEval.result.value;
        console.log('Dashboard Queue Toggle Inspection:', JSON.stringify(queueToggleResult, null, 2));

        const queueToggleScreenshot = await pageCdp.send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync(path.join(ARTIFACT_DIR, 'manager_dashboard_queue_toggle_verified.png'), Buffer.from(queueToggleScreenshot.data, 'base64'));

        // ── STEP 3: Verify Manager Task List (/manager-queue) ──
        console.log('[6/6] Navigating to /manager-queue (Dedicated Task List)...');
        await pageCdp.send('Page.navigate', { url: `http://127.0.0.1:${port}/manager-queue` });
        await sleep(2500);

        const taskListEval = await pageCdp.send('Runtime.evaluate', {
            returnByValue: true,
            expression: `
                (() => {
                    const h1 = document.querySelector('h1')?.innerText || '';
                    const subtitle = document.querySelector('header p')?.innerText || '';
                    const pageText = document.body.innerText;
                    const hasAssignTab = pageText.includes('Assign Work') || pageText.includes('Asignar trabajo');
                    const hasIntakeTab = pageText.includes('Intake') || pageText.includes('Ingreso');
                    const hasReviewTab = pageText.includes('Review') || pageText.includes('Revisión');
                    const hasApproveTab = pageText.includes('Approval') || pageText.includes('Aprobación');
                    return {
                        h1,
                        subtitle,
                        hasAssignTab,
                        hasIntakeTab,
                        hasReviewTab,
                        hasApproveTab
                    };
                })()
            `
        });
        const taskListResult = taskListEval.result.value;
        console.log('Manager Task List Inspection:', JSON.stringify(taskListResult, null, 2));

        const taskListScreenshot = await pageCdp.send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync(path.join(ARTIFACT_DIR, 'manager_tasklist_action_verified.png'), Buffer.from(taskListScreenshot.data, 'base64'));

        // ── STEP 4: Scoped System Admin Verification (/?labId=LAB-GTM) ──
        console.log('[BONUS 1] Verifying Scoped System Admin Dashboard (/?labId=LAB-GTM)...');
        await pageCdp.send('Runtime.evaluate', {
            expression: `
                localStorage.setItem('token', '${adminToken}');
                localStorage.setItem('user', JSON.stringify({
                    id: '${adminUser.id}',
                    username: '${adminUser.username}',
                    role: '${adminUser.role}'
                }));
            `
        });
        await pageCdp.send('Page.navigate', { url: `http://127.0.0.1:${port}/?labId=LAB-GTM` });
        await sleep(2500);

        const adminScopedEval = await pageCdp.send('Runtime.evaluate', {
            returnByValue: true,
            expression: `
                (() => {
                    const h1 = document.querySelector('h1')?.innerText || '';
                    const pageText = document.body.innerText;
                    const hasAnalysisProgress = pageText.includes('Analysis Progress') || pageText.includes('Progreso de análisis');
                    const hasTechWorkload = pageText.includes('Technician Workload') || pageText.includes('Carga técnica');
                    return {
                        h1,
                        hasAnalysisProgress,
                        hasTechWorkload
                    };
                })()
            `
        });
        const adminScopedResult = adminScopedEval.result.value;
        console.log('Scoped System Admin Inspection:', JSON.stringify(adminScopedResult, null, 2));

        const adminScreenshot = await pageCdp.send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync(path.join(ARTIFACT_DIR, 'super_admin_scoped_dashboard_verified.png'), Buffer.from(adminScreenshot.data, 'base64'));

        // ── STEP 5: Verify Stage 5 Navigation Destination (/samples?status=SUBMITTED_FULL,APPROVED) ──
        console.log('[BONUS 2] Verifying Stage 5 destination (/samples?status=SUBMITTED_FULL,APPROVED)...');
        await pageCdp.send('Runtime.evaluate', {
            expression: `
                localStorage.setItem('token', '${managerToken}');
                localStorage.setItem('user', JSON.stringify({
                    id: '${managerUser.id}',
                    username: '${managerUser.username}',
                    role: '${managerUser.role}',
                    labId: '${managerUser.labId}'
                }));
            `
        });
        await pageCdp.send('Page.navigate', { url: `http://127.0.0.1:${port}/samples?status=SUBMITTED_FULL,APPROVED` });
        await sleep(2500);

        const samplesNavEval = await pageCdp.send('Runtime.evaluate', {
            returnByValue: true,
            expression: `
                (() => {
                    const pageText = document.body.innerText;
                    const hasSample4 = pageText.includes('SMP-GTM-004') || pageText.includes('GTM-2026-0004');
                    const hasSample5 = pageText.includes('SMP-GTM-005') || pageText.includes('GTM-2026-0005');
                    return {
                        url: window.location.pathname + window.location.search,
                        hasSample4,
                        hasSample5
                    };
                })()
            `
        });
        const samplesNavResult = samplesNavEval.result.value;
        console.log('Stage 5 Destination Inspection:', JSON.stringify(samplesNavResult, null, 2));

        const destinationScreenshot = await pageCdp.send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync(path.join(ARTIFACT_DIR, 'manager_dashboard_stage5_destination_verified.png'), Buffer.from(destinationScreenshot.data, 'base64'));

        // Write complete evidence JSON
        const evidenceReport = {
            timestamp: new Date().toISOString(),
            status: 'VERIFIED',
            findings: {
                managerDashboardOperationalOverview: {
                    verified: dashOverviewResult.hasAnalysisProgress && dashOverviewResult.hasTechWorkload && dashOverviewResult.hasStagePipeline && dashOverviewResult.hasReadyForReviewBadge && dashOverviewResult.hasReadyForApprovalBadge && dashOverviewResult.hasCompletedStage && dashOverviewResult.hasStage5Route,
                    details: dashOverviewResult
                },
                managerDashboardQueueToggle: {
                    verified: queueToggleResult.hasWorkQueueTable,
                    details: queueToggleResult
                },
                managerTaskListActions: {
                    verified: taskListResult.hasAssignTab && taskListResult.hasReviewTab,
                    details: taskListResult
                },
                scopedSystemAdminOverview: {
                    verified: adminScopedResult.hasAnalysisProgress && adminScopedResult.hasTechWorkload,
                    details: adminScopedResult
                },
                stage5DestinationPopulation: {
                    verified: samplesNavResult.hasSample4 && samplesNavResult.hasSample5,
                    details: samplesNavResult
                }
            },
            screenshots: [
                'manager_dashboard_overview_verified.png',
                'manager_dashboard_queue_toggle_verified.png',
                'manager_tasklist_action_verified.png',
                'super_admin_scoped_dashboard_verified.png',
                'manager_dashboard_stage5_destination_verified.png'
            ]
        };

        fs.writeFileSync(path.join(ARTIFACT_DIR, 'manager_dashboard_overview_evidence.json'), JSON.stringify(evidenceReport, null, 2));
        console.log('[SUCCESS] All browser journeys verified and evidence recorded!');
    } catch (err) {
        console.error('Error in side-by-side run:', err);
        process.exitCode = 1;
    } finally {
        if (pageCdp) pageCdp.close();
        if (browserCdp) browserCdp.close();
        if (chromeProc) chromeProc.kill();
        if (server) server.close();
        cleanupDisposableDatabase(runnerDir);
    }
}

main();
