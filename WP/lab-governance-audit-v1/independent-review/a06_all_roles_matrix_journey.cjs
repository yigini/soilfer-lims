'use strict';

/**
 * A06 All Roles RBAC Matrix & Browser Verification Journey
 * 
 * Exhaustively exercises named positive and negative journeys for the 8 roles
 * (SUPER_ADMIN, PROJECT_MANAGER, SAMPLE_RECEPTION, LAB_TECHNICIAN, SURVEYOR,
 *  AUDIT_USER, EXTERNAL_VIEWER, VIEWER) without using manager stand-ins.
 * 
 * Divided into two clearly distinguished verification tiers:
 * PART 1: Browser UI Journeys (Headless Chrome) with deep DOM assertions:
 *   - Technician Workbench: verifies assigned sample/method and absence of foreign samples.
 *   - Reception Intake: verifies reception controls and absence of cross-lab samples.
 *   - QA & Audit Dashboard: verifies audit log table and absence of administrative mutations.
 *   - Project Manager View: verifies assigned project presence and foreign project absence.
 * 
 * PART 2: Scoped API Matrix Checks:
 *   - Asserts exact resource scope (authorized fixture presence AND foreign fixture absence).
 *   - Executes denied mutation commands (HTTP 403) and verifies zero DB and audit mutation.
 * 
 * Operates on a schema-only disposable SQLite database; verifies source dev.db is untouched.
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const { createRequire } = require('module');
const { randomUUID, createHash } = require('crypto');

const root = path.resolve(__dirname, '../../..');
const req = createRequire(path.join(root, 'server/package.json'));
const scratchReq = createRequire(path.join(root, 'scratch/package.json'));

const Database = req('better-sqlite3');
const jwt = req('jsonwebtoken');
const express = req('express');
const puppeteer = scratchReq('puppeteer-core');

const outputDir = __dirname;
const dbPath = path.join(outputDir, `disposable-a06-journey-${randomUUID()}.db`);
const sourcePath = path.join(root, 'server/prisma/dev.db');
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const hash = p => createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const sourceHashBefore = hash(sourcePath);

// Bootstrap schema-only disposable database from dev.db
const source = new Database(sourcePath, { readonly: true, fileMustExist: true });
const ddl = source.prepare("SELECT sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' AND type IN ('table','index') ORDER BY CASE type WHEN 'table' THEN 0 ELSE 1 END").all();
source.close();

const empty = new Database(dbPath);
empty.pragma('foreign_keys=OFF');
for (const { sql } of ddl) empty.exec(sql);
empty.pragma('foreign_keys=ON');
empty.close();

process.env.DATABASE_PATH = dbPath;
process.env.DATABASE_URL = `file:${dbPath}`;
process.env.NODE_ENV = 'production';
process.env.JWT_SECRET = 'fictional-a06-secret-2026';

const prisma = req('./prisma');
const app = req('./app');

// Serve client production build
const clientDist = path.join(root, 'client/dist');
if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.use((req, res, next) => {
        if (req.method === 'GET' && !req.path.startsWith('/api')) {
            return res.sendFile(path.join(clientDist, 'index.html'));
        }
        next();
    });
}

function createToken(user) {
    return jwt.sign(
        {
            id: user.id,
            userId: user.id,
            username: user.username,
            role: user.role,
            labId: user.labId || null,
            countries: user.countries ? (Array.isArray(user.countries) ? user.countries : JSON.parse(user.countries)) : [],
            projects: user.projects ? (Array.isArray(user.projects) ? user.projects : JSON.parse(user.projects)) : [],
            tokenVersion: user.tokenVersion || 1
        },
        process.env.JWT_SECRET,
        { expiresIn: '2h' }
    );
}

const results = [];
function record(id, description, expected, actual, passed) {
    results.push({ id, description, expected, actual, passed });
    console.log(`[${passed ? 'PASS' : 'FAIL'}] ${id}: ${description}`);
    if (!passed) console.error(`  Expected: ${JSON.stringify(expected)}\n  Actual:   ${JSON.stringify(actual)}`);
}

async function runMatrix() {
    console.log('--- STARTING REAL A06 ALL-ROLES MATRIX & BROWSER JOURNEY ---');
    console.log(`Disposable DB: ${dbPath}`);

    // 1. Seed Multi-Lab Fixtures
    const labGtm = await prisma.lab.create({
        data: {
            id: 'LAB-A06-GTM',
            code: 'A06GTM',
            name: 'Guatemala Analytical Lab',
            country: 'Guatemala',
            timezone: 'America/Guatemala',
            isActive: true
        }
    });

    const labKen = await prisma.lab.create({
        data: {
            id: 'LAB-A06-KEN',
            code: 'A06KEN',
            name: 'Kenya Regional Lab',
            country: 'Kenya',
            timezone: 'Africa/Nairobi',
            isActive: true
        }
    });

    const projectGtm = await prisma.project.create({
        data: {
            id: 'PRJ-A06-GTM-01',
            code: 'PRJ-GTM-01',
            name: 'Guatemala Highland Soil Assessment',
            labId: labGtm.id,
            assignedLabIds: '[]',
            status: 'ACTIVE'
        }
    });

    const projectKen = await prisma.project.create({
        data: {
            id: 'PRJ-A06-KEN-01',
            code: 'PRJ-KEN-01',
            name: 'Kenya Rift Valley Survey',
            labId: labKen.id,
            assignedLabIds: '[]',
            status: 'ACTIVE'
        }
    });

    const sampleGtm = await prisma.sample.create({
        data: {
            id: 'SMP-A06-GTM-001',
            originalId: 'EXT-A06-GTM-01',
            labId: labGtm.id,
            assignedLab: labGtm.id,
            projectId: projectGtm.id,
            projectCode: projectGtm.code,
            status: 'PROCESSING',
            receptionDate: new Date(),
            dryingStatus: 'DONE',
            preparationStatus: 'DONE',
            requiredAnalyses: JSON.stringify(['PH_H2O'])
        }
    });

    const sampleKen = await prisma.sample.create({
        data: {
            id: 'SMP-A06-KEN-001',
            originalId: 'EXT-A06-KEN-01',
            labId: labKen.id,
            assignedLab: labKen.id,
            projectId: projectKen.id,
            projectCode: projectKen.code,
            status: 'PROCESSING',
            receptionDate: new Date(),
            dryingStatus: 'DONE',
            preparationStatus: 'DONE',
            requiredAnalyses: JSON.stringify(['PH_H2O'])
        }
    });

    const equipGtm = await prisma.equipmentAsset.create({
        data: {
            id: 'EQ-A06-GTM-01',
            name: 'pH Benchtop Meter GTM',
            assetType: 'PH_METER',
            labId: labGtm.id,
            status: 'IN_SERVICE',
            criticality: 'CRITICAL'
        }
    });

    const equipKen = await prisma.equipmentAsset.create({
        data: {
            id: 'EQ-A06-KEN-01',
            name: 'Conductivity Meter KEN',
            assetType: 'EC_METER',
            labId: labKen.id,
            status: 'IN_SERVICE',
            criticality: 'CRITICAL'
        }
    });

    // Seed Initial Audit Record
    await prisma.auditLog.create({
        data: {
            id: 'AUD-A06-001',
            entity: 'USER',
            entityId: 'usr-a06-super',
            action: 'LOGIN',
            performedBy: 'a06_super',
            details: 'Initial system audit verification anchor',
            timestamp: new Date()
        }
    });

    // Seed 8 Distinct Non-Manager Roles
    const userDefs = [
        { id: 'usr-a06-super', username: 'a06_super', name: 'Super Admin User', role: 'SUPER_ADMIN', labId: null, countries: '[]', projects: '[]' },
        { id: 'usr-a06-pm', username: 'a06_pm', name: 'Project Manager User', role: 'PROJECT_MANAGER', labId: labGtm.id, countries: JSON.stringify(['Guatemala']), projects: JSON.stringify([projectGtm.code]) },
        { id: 'usr-a06-rec', username: 'a06_rec', name: 'Sample Reception User', role: 'SAMPLE_RECEPTION', labId: labGtm.id, countries: JSON.stringify(['Guatemala']), projects: '[]' },
        { id: 'usr-a06-tech', username: 'a06_tech', name: 'Lab Technician User', role: 'LAB_TECHNICIAN', labId: labGtm.id, countries: JSON.stringify(['Guatemala']), projects: '[]' },
        { id: 'usr-a06-surv', username: 'a06_surv', name: 'Field Surveyor User', role: 'SURVEYOR', labId: null, countries: JSON.stringify(['Guatemala']), projects: '[]' },
        { id: 'usr-a06-aud', username: 'a06_aud', name: 'Audit & QA User', role: 'AUDIT_USER', labId: labGtm.id, countries: JSON.stringify(['Guatemala']), projects: '[]' },
        { id: 'usr-a06-ext', username: 'a06_ext', name: 'External Viewer User', role: 'EXTERNAL_VIEWER', labId: null, countries: JSON.stringify(['Guatemala']), projects: '[]' },
        { id: 'usr-a06-view', username: 'a06_view', name: 'General Viewer User', role: 'VIEWER', labId: labGtm.id, countries: JSON.stringify(['Guatemala']), projects: '[]' }
    ];

    const users = {};
    const tokens = {};

    for (const u of userDefs) {
        const created = await prisma.user.create({
            data: {
                id: u.id,
                username: u.username,
                name: u.name,
                email: `${u.username}@soilfer.invalid`,
                password: 'FICTIONAL_HASH',
                role: u.role,
                labId: u.labId,
                countries: u.countries,
                projects: u.projects,
                isActive: true,
                tokenVersion: 1
            }
        });
        users[u.role] = created;
        tokens[u.role] = createToken(created);
    }

    const workItemGtm = await prisma.workItem.create({
        data: {
            id: 'WI-A06-GTM-001',
            sampleId: sampleGtm.id,
            assignedTo: users['LAB_TECHNICIAN'].username,
            labId: labGtm.id,
            assignedLab: labGtm.id,
            analysis: 'PH_H2O',
            status: 'ASSIGNED'
        }
    });

    // Start HTTP server
    const server = http.createServer(app);
    await new Promise(resolve => server.listen(0, resolve));
    const port = server.address().port;
    const baseUrl = `http://127.0.0.1:${port}`;
    console.log(`Server listening on ${baseUrl}`);

    // Helper for API queries
    async function apiGet(role, endpoint) {
        const res = await fetch(`${baseUrl}${endpoint}`, {
            headers: { 'Authorization': `Bearer ${tokens[role]}` }
        });
        const contentType = res.headers.get('content-type') || '';
        let body = null;
        if (contentType.includes('application/json')) {
            try { body = await res.json(); } catch (_) {}
        } else {
            body = await res.text();
        }
        return { status: res.status, body };
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // PART 1: BROWSER OPERATIONAL INTERFACE VISUAL EVIDENCE (HEADLESS CHROME)
    // ═══════════════════════════════════════════════════════════════════════════
    console.log('\n--- PART 1: Headless Chrome Browser UI Journeys with Content & Isolation Assertions ---');
    const browser = await puppeteer.launch({
        executablePath: chromePath,
        headless: true,
        protocolTimeout: 60000,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,850']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 850 });

    try {
        // UI 1. Technician Workbench UI
        console.log('Testing Technician Workbench UI (LAB_TECHNICIAN)...');
        await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
        await page.evaluate((tok, usr) => {
            localStorage.setItem('token', tok);
            localStorage.setItem('user', JSON.stringify(usr));
            localStorage.setItem('language', 'en');
        }, tokens['LAB_TECHNICIAN'], { ...users['LAB_TECHNICIAN'], permissions: ['ENTER_RESULTS', 'VIEW_SAMPLES', 'VIEW_EQUIPMENT'] });

        await page.goto(`${baseUrl}/workbench?sampleId=${sampleGtm.id}&workItemId=${workItemGtm.id}&analysis=PH_H2O`, { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('input[inputmode="decimal"]', { timeout: 10000 });
        await new Promise(r => setTimeout(r, 1000));

        const techUiValidation = await page.evaluate((authSampleId, foreignSampleId) => {
            const body = document.body.textContent || '';
            const editor = document.querySelector('input[inputmode="decimal"]');
            const hasHeader = body.includes('Technician Workbench');
            const hasMethod = body.includes('pH') || body.includes('PH_H2O');
            const hasAuthSample = body.includes(authSampleId) || body.includes('EXT-A06-GTM-01');
            const hasForeignSample = body.includes(foreignSampleId) || body.includes('EXT-A06-KEN-01');
            const notOnLogin = !window.location.pathname.includes('/login');
            return {
                valid: !!editor && hasHeader && hasMethod && hasAuthSample && !hasForeignSample && notOnLogin,
                hasEditor: !!editor,
                hasHeader,
                hasMethod,
                hasAuthSample,
                hasForeignSample,
                notOnLogin
            };
        }, sampleGtm.id, sampleKen.id);

        record('A06_UI_01', 'Technician Workbench renders assigned method, authorized sample, and excludes foreign samples', true, techUiValidation.valid, techUiValidation.valid);
        await page.screenshot({ path: path.join(outputDir, 'browser-a06-technician.png') });

        // UI 2. Reception Intake UI
        console.log('Testing Reception Intake UI (SAMPLE_RECEPTION)...');
        await page.evaluate((tok, usr) => {
            localStorage.setItem('token', tok);
            localStorage.setItem('user', JSON.stringify(usr));
            localStorage.setItem('language', 'en');
        }, tokens['SAMPLE_RECEPTION'], { ...users['SAMPLE_RECEPTION'], permissions: ['RECEIVE_SAMPLE', 'VIEW_SAMPLES', 'ASSIGN_LAB_ID'] });

        await page.goto(`${baseUrl}/reception`, { waitUntil: 'domcontentloaded' });
        await new Promise(r => setTimeout(r, 1500));

        const recUiValidation = await page.evaluate((foreignSampleId) => {
            const body = document.body.textContent || '';
            const hasReceptionHeader = body.includes('Reception') || body.includes('Sample Reception');
            const hasIntakeControls = document.querySelector('button') !== null;
            const hasForeignSample = body.includes(foreignSampleId) || body.includes('EXT-A06-KEN-01');
            const notOnLogin = !window.location.pathname.includes('/login');
            return {
                valid: hasReceptionHeader && hasIntakeControls && !hasForeignSample && notOnLogin,
                hasReceptionHeader,
                hasIntakeControls,
                hasForeignSample,
                notOnLogin
            };
        }, sampleKen.id);

        record('A06_UI_02', 'Reception Desk renders intake interface and strictly excludes foreign lab samples', true, recUiValidation.valid, recUiValidation.valid);
        await page.screenshot({ path: path.join(outputDir, 'browser-a06-reception.png') });

        // UI 3. QA & Audit Dashboard UI
        console.log('Testing QA & Audit Dashboard UI (AUDIT_USER)...');
        await page.evaluate((tok, usr) => {
            localStorage.setItem('token', tok);
            localStorage.setItem('user', JSON.stringify(usr));
            localStorage.setItem('language', 'en');
        }, tokens['AUDIT_USER'], { ...users['AUDIT_USER'], permissions: ['VIEW_AUDIT', 'VIEW_SAMPLES', 'VIEW_INVENTORY'] });

        await page.goto(`${baseUrl}/admin/audit`, { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('input[placeholder*="Search logs"], table', { timeout: 10000 });
        await new Promise(r => setTimeout(r, 1000));

        const audUiValidation = await page.evaluate(() => {
            const body = document.body.textContent || '';
            const hasSearch = document.querySelector('input[placeholder*="Search logs"]') !== null;
            const hasTable = document.querySelector('table') !== null;
            const hasHeader = body.includes('Audit') || body.includes('Event');
            const notOnLogin = !window.location.pathname.includes('/login');
            // Ensure no unauthorized administrative mutation buttons exist
            const hasCreateUser = body.includes('Create User') || body.includes('Add User');
            return {
                valid: (hasSearch || hasTable) && hasHeader && notOnLogin && !hasCreateUser,
                hasSearch,
                hasTable,
                hasHeader,
                notOnLogin,
                hasCreateUser
            };
        });

        record('A06_UI_03', 'Audit Logs Dashboard renders audit records table without admin mutation controls', true, audUiValidation.valid, audUiValidation.valid);
        await page.screenshot({ path: path.join(outputDir, 'browser-a06-auditor.png') });

        // UI 4. Project Manager View
        console.log('Testing Project Manager Projects View (PROJECT_MANAGER)...');
        await page.evaluate((tok, usr) => {
            localStorage.setItem('token', tok);
            localStorage.setItem('user', JSON.stringify(usr));
            localStorage.setItem('language', 'en');
        }, tokens['PROJECT_MANAGER'], { ...users['PROJECT_MANAGER'], permissions: ['MANAGE_PROJECTS', 'VIEW_SAMPLES', 'VIEW_INVENTORY'] });

        await page.goto(`${baseUrl}/projects`, { waitUntil: 'domcontentloaded' });
        await new Promise(r => setTimeout(r, 1500));

        const pmUiValidation = await page.evaluate((authProjCode, foreignProjCode) => {
            const body = document.body.textContent || '';
            const hasHeader = body.includes('Projects') || body.includes('Project');
            const hasAuthProj = body.includes(authProjCode) || body.includes('Guatemala Highland');
            const hasForeignProj = body.includes(foreignProjCode) || body.includes('Kenya Rift Valley');
            const notOnLogin = !window.location.pathname.includes('/login');
            return {
                valid: hasHeader && hasAuthProj && !hasForeignProj && notOnLogin,
                hasHeader,
                hasAuthProj,
                hasForeignProj,
                notOnLogin
            };
        }, projectGtm.code, projectKen.code);

        record('A06_UI_04', 'Project Manager UI renders assigned project and excludes foreign Kenya project', true, pmUiValidation.valid, pmUiValidation.valid);
        await page.screenshot({ path: path.join(outputDir, 'browser-a06-project-manager.png') });

    } finally {
        if (browser) {
            try { await browser.close(); } catch (_) {}
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // PART 2: SCOPED API MATRIX CHECKS & DENIED MUTATION INTEGRITY
    // ═══════════════════════════════════════════════════════════════════════════
    console.log('\n--- PART 2: Scoped API Matrix & Denied Mutation Verification ---');

    // ─── ROLE 1: SUPER_ADMIN ───
    console.log('\nEvaluating Role: SUPER_ADMIN (API)...');
    const saLabs = await apiGet('SUPER_ADMIN', '/api/labs');
    const saLabsScope = saLabs.status === 200 && Array.isArray(saLabs.body) &&
        saLabs.body.some(l => l.id === labGtm.id) && saLabs.body.some(l => l.id === labKen.id);
    record('A06_SA_01', 'SUPER_ADMIN lists all laboratories across countries', true, saLabsScope, saLabsScope);

    const saUsers = await apiGet('SUPER_ADMIN', '/api/users');
    const saUsersScope = saUsers.status === 200 && (Array.isArray(saUsers.body) || Array.isArray(saUsers.body?.data));
    record('A06_SA_02', 'SUPER_ADMIN lists global staff roster', true, saUsersScope, saUsersScope);

    const saEquipGtm = await apiGet('SUPER_ADMIN', `/api/equipment/${equipGtm.id}`);
    const saEquipKen = await apiGet('SUPER_ADMIN', `/api/equipment/${equipKen.id}`);
    const saEquipScope = saEquipGtm.status === 200 && saEquipKen.status === 200;
    record('A06_SA_03', 'SUPER_ADMIN inspects equipment details across any laboratory globally', true, saEquipScope, saEquipScope);

    // ─── ROLE 2: PROJECT_MANAGER ───
    console.log('\nEvaluating Role: PROJECT_MANAGER (API)...');
    const pmProjects = await apiGet('PROJECT_MANAGER', '/api/projects');
    const pmProjectsList = Array.isArray(pmProjects.body) ? pmProjects.body : (pmProjects.body?.data || []);
    const pmHasAuthProject = pmProjectsList.some(p => p.id === projectGtm.id || p.code === projectGtm.code);
    const pmHasForeignProject = pmProjectsList.some(p => p.id === projectKen.id || p.code === projectKen.code);
    const pmProjectsScoped = pmProjects.status === 200 && pmHasAuthProject && !pmHasForeignProject;
    record('A06_PM_01', 'PROJECT_MANAGER lists assigned projects and excludes foreign projects', true, pmProjectsScoped, pmProjectsScoped);

    const pmOwnProject = await apiGet('PROJECT_MANAGER', `/api/projects/${projectGtm.id}`);
    const pmForeignProject = await apiGet('PROJECT_MANAGER', `/api/projects/${projectKen.id}`);
    const pmDetailScoped = pmOwnProject.status === 200 && (pmForeignProject.status === 403 || pmForeignProject.status === 404);
    record('A06_PM_02', 'PROJECT_MANAGER accesses own project; denied foreign project (HTTP 403/404)', true, pmDetailScoped, pmDetailScoped);

    // Negative: PM cannot manage staff or suspend users (verify 0 DB mutation, 0 audit mutation)
    const targetTech = users['LAB_TECHNICIAN'];
    const pmSuspendRes = await fetch(`${baseUrl}/api/users/${targetTech.id}/suspend`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${tokens['PROJECT_MANAGER']}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Unauthorized PM attempt' })
    });
    const targetTechAfter = await prisma.user.findUnique({ where: { id: targetTech.id } });
    const auditSuspendCount = await prisma.auditLog.count({
        where: { action: 'USER_SUSPENDED', entityId: targetTech.id }
    });
    const pmSuspendBlocked = pmSuspendRes.status === 403 && targetTechAfter.isActive === true && auditSuspendCount === 0;
    record('A06_PM_03', 'PROJECT_MANAGER denied user suspension: HTTP 403, 0 DB mutations, 0 audit mutations', true, pmSuspendBlocked, pmSuspendBlocked);

    // ─── ROLE 3: SAMPLE_RECEPTION ───
    console.log('\nEvaluating Role: SAMPLE_RECEPTION (API)...');
    const recSamples = await apiGet('SAMPLE_RECEPTION', '/api/samples');
    const recSampleList = Array.isArray(recSamples.body) ? recSamples.body : (recSamples.body?.data || []);
    const recHasAuthSample = recSampleList.some(s => s.id === sampleGtm.id || s.originalId === sampleGtm.originalId);
    const recHasForeignSample = recSampleList.some(s => s.id === sampleKen.id || s.originalId === sampleKen.originalId);
    const recSamplesScoped = recSamples.status === 200 && recHasAuthSample && !recHasForeignSample;
    record('A06_REC_01', 'SAMPLE_RECEPTION lists own-lab samples and excludes foreign Kenya samples', true, recSamplesScoped, recSamplesScoped);

    const recSampleDetail = await apiGet('SAMPLE_RECEPTION', `/api/samples/${sampleGtm.id}/detail`);
    const recForeignDetail = await apiGet('SAMPLE_RECEPTION', `/api/samples/${sampleKen.id}/detail`);
    const recDetailScoped = recSampleDetail.status === 200 && (recForeignDetail.status === 403 || recForeignDetail.status === 404);
    record('A06_REC_02', 'SAMPLE_RECEPTION accesses own-lab sample; denied foreign sample detail', true, recDetailScoped, recDetailScoped);

    // Negative: Reception cannot reassign technician work items (verify 0 DB mutation, 0 audit mutation)
    const recReassignRes = await fetch(`${baseUrl}/api/work/${workItemGtm.id}/reassign`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${tokens['SAMPLE_RECEPTION']}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignedTo: 'unauthorized_reassign_target' })
    });
    const workItemAfterRec = await prisma.workItem.findUnique({ where: { id: workItemGtm.id } });
    const auditReassignCount = await prisma.auditLog.count({
        where: { action: 'WORKITEM_REASSIGNED', entityId: workItemGtm.id }
    });
    const recReassignBlocked = recReassignRes.status === 403 && workItemAfterRec.assignedTo === users['LAB_TECHNICIAN'].username && auditReassignCount === 0;
    record('A06_REC_03', 'SAMPLE_RECEPTION denied work reassignment: HTTP 403, 0 DB mutations, 0 audit mutations', true, recReassignBlocked, recReassignBlocked);

    // ─── ROLE 4: LAB_TECHNICIAN ───
    console.log('\nEvaluating Role: LAB_TECHNICIAN (API)...');
    const techSamples = await apiGet('LAB_TECHNICIAN', '/api/samples');
    const techSampleList = Array.isArray(techSamples.body) ? techSamples.body : (techSamples.body?.data || []);
    const techHasAuthSample = techSampleList.some(s => s.id === sampleGtm.id);
    const techHasForeignSample = techSampleList.some(s => s.id === sampleKen.id);
    const techSamplesScoped = techSamples.status === 200 && techHasAuthSample && !techHasForeignSample;
    record('A06_TECH_01', 'LAB_TECHNICIAN lists own-lab samples and excludes foreign Kenya samples', true, techSamplesScoped, techSamplesScoped);

    const techEquipGtm = await apiGet('LAB_TECHNICIAN', `/api/equipment/${equipGtm.id}`);
    const techEquipKen = await apiGet('LAB_TECHNICIAN', `/api/equipment/${equipKen.id}`);
    const techEquipScoped = techEquipGtm.status === 200 && (techEquipKen.status === 403 || techEquipKen.status === 404);
    record('A06_TECH_02', 'LAB_TECHNICIAN accesses own equipment; denied foreign lab equipment', true, techEquipScoped, techEquipScoped);

    // Negative: Technician cannot modify laboratory profile (verify 0 DB mutation, 0 audit mutation)
    const techLabPut = await fetch(`${baseUrl}/api/labs/${labGtm.id}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${tokens['LAB_TECHNICIAN']}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Tampered Lab Name' })
    });
    const labAfterTech = await prisma.lab.findUnique({ where: { id: labGtm.id } });
    const auditLabCount = await prisma.auditLog.count({
        where: { action: 'LAB_UPDATED', entityId: labGtm.id }
    });
    const techLabBlocked = techLabPut.status === 403 && labAfterTech.name === 'Guatemala Analytical Lab' && auditLabCount === 0;
    record('A06_TECH_03', 'LAB_TECHNICIAN denied lab profile mutation: HTTP 403, 0 DB mutations, 0 audit mutations', true, techLabBlocked, techLabBlocked);

    // ─── ROLE 5: SURVEYOR ───
    console.log('\nEvaluating Role: SURVEYOR (API)...');
    const survSelfProfile = await apiGet('SURVEYOR', '/api/auth/me');
    record('A06_SURV_01', 'SURVEYOR successfully retrieves own authorized profile context', 200, survSelfProfile.status, survSelfProfile.status === 200);

    // Negative: Surveyor cannot access laboratory internal equipment roster
    const survEquipDenied = await apiGet('SURVEYOR', `/api/equipment/${equipGtm.id}`);
    const survDeniedStatus = survEquipDenied.status === 403 || survEquipDenied.status === 404;
    record('A06_SURV_02', 'SURVEYOR denied internal laboratory equipment roster (HTTP 403/404)', true, survDeniedStatus, survDeniedStatus);

    // ─── ROLE 6: AUDIT_USER ───
    console.log('\nEvaluating Role: AUDIT_USER (API)...');
    const audLogs = await apiGet('AUDIT_USER', '/api/audit-final');
    const audLogsValid = audLogs.status === 200 && Array.isArray(audLogs.body?.data);
    record('A06_AUD_01', 'AUDIT_USER successfully reads system audit logs', true, audLogsValid, audLogsValid);

    const audSample = await apiGet('AUDIT_USER', `/api/samples/${sampleGtm.id}/detail`);
    record('A06_AUD_02', 'AUDIT_USER inspects sample analytical trail and results', 200, audSample.status, audSample.status === 200);

    // Negative: Audit user cannot mutate sample status (verify 0 DB mutation, 0 audit mutation)
    const audSamplePut = await fetch(`${baseUrl}/api/samples/${sampleGtm.id}/status`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${tokens['AUDIT_USER']}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'ACCEPTED' })
    });
    const sampleAfterAud = await prisma.sample.findUnique({ where: { id: sampleGtm.id } });
    const auditStatusCount = await prisma.auditLog.count({
        where: { action: 'STATUS_CHANGED', entityId: sampleGtm.id }
    });
    const audStatusBlocked = audSamplePut.status === 403 && sampleAfterAud.status === 'PROCESSING' && auditStatusCount === 0;
    record('A06_AUD_03', 'AUDIT_USER denied sample data mutations: HTTP 403, 0 DB mutations, 0 audit mutations', true, audStatusBlocked, audStatusBlocked);

    // ─── ROLE 7: EXTERNAL_VIEWER ───
    console.log('\nEvaluating Role: EXTERNAL_VIEWER (API)...');
    const extProfile = await apiGet('EXTERNAL_VIEWER', '/api/auth/me');
    record('A06_EXT_01', 'EXTERNAL_VIEWER retrieves authorized profile context', 200, extProfile.status, extProfile.status === 200);

    // Negative: Cannot access lab staff management roster
    const extStaffDenied = await apiGet('EXTERNAL_VIEWER', '/api/users');
    record('A06_EXT_02', 'EXTERNAL_VIEWER denied laboratory staff management roster (HTTP 403)', 403, extStaffDenied.status, extStaffDenied.status === 403);

    // ─── ROLE 8: VIEWER ───
    console.log('\nEvaluating Role: VIEWER (API)...');
    const viewSamples = await apiGet('VIEWER', '/api/samples');
    const viewList = Array.isArray(viewSamples.body) ? viewSamples.body : (viewSamples.body?.data || []);
    const viewHasAuthSample = viewList.some(s => s.id === sampleGtm.id);
    const viewHasForeignSample = viewList.some(s => s.id === sampleKen.id);
    const viewScoped = viewSamples.status === 200 && viewHasAuthSample && !viewHasForeignSample;
    record('A06_VIEW_01', 'VIEWER lists read-only sample status scoped to own lab, excluding foreign samples', true, viewScoped, viewScoped);

    // Negative: Viewer cannot create new sample records (verify 0 DB mutation, 0 audit mutation)
    const countBeforeViewer = await prisma.sample.count();
    const viewSamplePost = await fetch(`${baseUrl}/api/samples/walkin`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${tokens['VIEWER']}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ originalId: 'TAMPER-VIEWER-01', labId: labGtm.id, sampleType: 'SOIL' })
    });
    const countAfterViewer = await prisma.sample.count();
    const auditWalkinCount = await prisma.auditLog.count({
        where: { details: { contains: 'TAMPER-VIEWER-01' } }
    });
    const viewPostBlocked = viewSamplePost.status === 403 && countBeforeViewer === countAfterViewer && auditWalkinCount === 0;
    record('A06_VIEW_02', 'VIEWER denied sample creation: HTTP 403, 0 DB mutations, 0 audit mutations', true, viewPostBlocked, viewPostBlocked);

    // Hash check
    const sourceHashAfter = hash(sourcePath);
    const hashIntact = sourceHashBefore === sourceHashAfter;
    record('A06_HASH', 'Baseline database dev.db hash strictly preserved untouched', sourceHashBefore, sourceHashAfter, hashIntact);

    // Save report
    const summary = {
        timestamp: new Date().toISOString(),
        totalTests: results.length,
        passed: results.filter(r => r.passed).length,
        failed: results.filter(r => !r.passed).length,
        sourceHashBefore,
        sourceHashAfter,
        results
    };

    fs.writeFileSync(
        path.join(outputDir, 'a06-all-roles-results.json'),
        JSON.stringify(summary, null, 2),
        'utf8'
    );

    // Cleanup disposable database
    try {
        if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
        if (fs.existsSync(dbPath + '-shm')) fs.unlinkSync(dbPath + '-shm');
        if (fs.existsSync(dbPath + '-wal')) fs.unlinkSync(dbPath + '-wal');
    } catch (e) {
        console.warn('Warning during disposable db cleanup:', e.message);
    }

    if (server) {
        try { await new Promise(resolve => server.close(resolve)); } catch (_) {}
    }
    if (prisma) {
        try { await prisma.$disconnect(); } catch (_) {}
    }

    console.log(`\n--- A06 ALL ROLES MATRIX COMPLETE: ${summary.passed}/${summary.totalTests} PASSED ---`);
    process.exit(summary.failed > 0 ? 1 : 0);
}

runMatrix().catch(err => {
    console.error('Fatal error in A06 matrix journey:', err);
    try {
        if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
        if (fs.existsSync(dbPath + '-shm')) fs.unlinkSync(dbPath + '-shm');
        if (fs.existsSync(dbPath + '-wal')) fs.unlinkSync(dbPath + '-wal');
    } catch (_) {}
    process.exit(1);
});
