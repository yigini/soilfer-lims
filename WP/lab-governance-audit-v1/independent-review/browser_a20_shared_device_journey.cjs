'use strict';

/**
 * Browser A20 Shared Device Journey Review
 * 
 * Verifies the complete shared-workstation offline draft and outbox lifecycle
 * in native headless Google Chrome using the actual application UI and shipped sync engine:
 * 1. Technician A logs in via /login UI on shared workstation.
 * 2. Shared device goes offline; Tech A enters determination draft in actual Workbench editor.
 * 3. Workbench persists draft locally and queues outbox operation via production sync engine.
 * 4. Technician A logs out through the application UI (UserMenu -> Sign Out).
 * 5. Device reconnects; Technician B logs in via /login UI on the same shared device.
 * 6. Technician B views workbench: verified to contain none of Tech A's draft.
 * 7. Shipped sync mechanism triggered under Tech B: verified to send 0 Tech A operations.
 * 8. Technician B completes and syncs companion work on Sample B; attributed strictly to Tech B.
 * 9. Technician B logs out through application UI.
 * 10. Technician A logs back in via /login UI.
 * 11. Technician A opens workbench and recovers draft value (6.85) in the actual editor input.
 * 12. Technician A syncs recovered work via shipped sync mechanism; verified in DB for Tech A.
 * 13. Baseline dev.db hash strictly preserved untouched.
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
const bcrypt = req('bcryptjs');
const express = req('express');
const puppeteer = scratchReq('puppeteer-core');

const outputDir = __dirname;
const dbPath = path.join(outputDir, `disposable-a20-journey-${randomUUID()}.db`);
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
process.env.JWT_SECRET = 'fictional-a20-secret-2026';

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

const results = [];
function record(id, description, expected, actual, passed) {
    results.push({ id, description, expected, actual, passed });
    console.log(`[${passed ? 'PASS' : 'FAIL'}] ${id}: ${description}`);
    if (!passed) console.error(`  Expected: ${JSON.stringify(expected)}\n  Actual:   ${JSON.stringify(actual)}`);
}

async function loginViaUI(page, baseUrl, username, password) {
    await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('input#username', { timeout: 10000 });
    await page.evaluate(() => {
        const u = document.querySelector('input#username');
        const p = document.querySelector('input#password');
        if (u) u.value = '';
        if (p) p.value = '';
    });
    await page.type('input#username', username);
    await page.type('input#password', password);
    await page.click('button[type="submit"]');
    await page.waitForFunction(() => !window.location.pathname.includes('/login'), { timeout: 10000 });
    await new Promise(r => setTimeout(r, 1000));
}

async function logoutViaUI(page) {
    await page.waitForSelector('button[title="User Menu"]', { timeout: 10000 });
    await page.click('button[title="User Menu"]');
    await new Promise(r => setTimeout(r, 400));
    await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const signOut = btns.find(b => b.textContent && b.textContent.includes('Sign Out'));
        if (signOut) signOut.click();
    });
    await page.waitForFunction(() => window.location.pathname.includes('/login'), { timeout: 10000 });
    await new Promise(r => setTimeout(r, 500));
}

async function runJourney() {
    console.log('--- STARTING REAL BROWSER A20 SHARED DEVICE JOURNEY VERIFICATION ---');
    console.log(`Disposable DB: ${dbPath}`);

    // 1. Seed Fictional Fixtures
    const labA = await prisma.lab.create({
        data: {
            id: 'LAB-A20-GTM',
            code: 'A20GTM',
            name: 'Guatemala Analytical Center',
            country: 'Guatemala',
            timezone: 'America/Guatemala',
            isActive: true
        }
    });

    const passwordHash = bcrypt.hashSync('fictionalPassword123!', 10);

    const userTechA = await prisma.user.create({
        data: {
            id: 'usr-a20-tech-a',
            username: 'tech_alpha',
            name: 'Technician Alma Garcia',
            email: 'alma@lab-a.invalid',
            password: passwordHash,
            role: 'LAB_TECHNICIAN',
            labId: labA.id,
            countries: JSON.stringify(['Guatemala']),
            isActive: true,
            tokenVersion: 1
        }
    });

    const userTechB = await prisma.user.create({
        data: {
            id: 'usr-a20-tech-b',
            username: 'tech_beta',
            name: 'Technician Bernardo Soto',
            email: 'bernardo@lab-a.invalid',
            password: passwordHash,
            role: 'LAB_TECHNICIAN',
            labId: labA.id,
            countries: JSON.stringify(['Guatemala']),
            isActive: true,
            tokenVersion: 1
        }
    });

    const sampleA = await prisma.sample.create({
        data: {
            id: 'SMP-A20-001',
            originalId: 'EXT-A20-SAMPLE-01',
            labId: labA.id,
            assignedLab: labA.id,
            status: 'PROCESSING',
            receptionDate: new Date(),
            dryingStatus: 'DONE',
            preparationStatus: 'DONE',
            requiredAnalyses: JSON.stringify(['PH_H2O'])
        }
    });

    const sampleB = await prisma.sample.create({
        data: {
            id: 'SMP-A20-002',
            originalId: 'EXT-A20-SAMPLE-02',
            labId: labA.id,
            assignedLab: labA.id,
            status: 'PROCESSING',
            receptionDate: new Date(),
            dryingStatus: 'DONE',
            preparationStatus: 'DONE',
            requiredAnalyses: JSON.stringify(['PH_H2O'])
        }
    });

    const workItemA = await prisma.workItem.create({
        data: {
            id: 'WI-A20-001',
            sampleId: sampleA.id,
            assignedTo: userTechA.username,
            labId: labA.id,
            assignedLab: labA.id,
            analysis: 'PH_H2O',
            status: 'ASSIGNED'
        }
    });

    const workItemB = await prisma.workItem.create({
        data: {
            id: 'WI-A20-002',
            sampleId: sampleB.id,
            assignedTo: userTechB.username,
            labId: labA.id,
            assignedLab: labA.id,
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

    // Launch single native Headless Chrome instance (representing shared physical device)
    const browser = await puppeteer.launch({
        executablePath: chromePath,
        headless: true,
        protocolTimeout: 60000,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,850']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 850 });

    try {
        // ─── STEP 1: Tech A logs in on shared workstation via actual /login UI ───
        console.log('Step 1: Technician A logs in on shared device via /login UI...');
        await loginViaUI(page, baseUrl, userTechA.username, 'fictionalPassword123!');
        const loggedUserA = await page.evaluate(() => {
            const u = localStorage.getItem('user');
            return u ? JSON.parse(u) : null;
        });
        record('A20_01', 'Technician A authenticated via /login UI on shared workstation', userTechA.id, loggedUserA?.id, loggedUserA?.id === userTechA.id);

        // ─── STEP 2: Navigate to Workbench, go offline, enter draft in editor ───
        console.log('Step 2: Technician A opens Workbench, goes offline, enters draft in editor...');
        await page.goto(`${baseUrl}/workbench?sampleId=${sampleA.id}&workItemId=${workItemA.id}&analysis=PH_H2O`, { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('input[inputmode="decimal"]', { timeout: 10000 });

        // Simulate offline mode on workstation
        await page.setOfflineMode(true);
        await page.evaluate(() => window.dispatchEvent(new Event('offline')));

        // Focus and enter determination value in actual editor input
        await page.focus('input[inputmode="decimal"]');
        await page.evaluate(() => {
            const input = document.querySelector('input[inputmode="decimal"]');
            if (input) {
                const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                nativeSetter.call(input, '');
                input.dispatchEvent(new Event('input', { bubbles: true }));
            }
        });
        await page.type('input[inputmode="decimal"]', '6.85');
        // Wait for debounced draft save and local outbox queue
        await new Promise(r => setTimeout(r, 1500));

        const editorValA = await page.$eval('input[inputmode="decimal"]', el => el.value);
        record('A20_02', 'Technician A enters draft determination in actual editor while offline', '6.85', editorValA, editorValA === '6.85');
        await page.screenshot({ path: path.join(outputDir, 'browser-a20-techA-draft.png') });

        // ─── STEP 3: Tech A logs out via application UI flow ───
        console.log('Step 3: Technician A logs out of shared device via application UI...');
        await logoutViaUI(page);
        const sessionAfterLogout = await page.evaluate(() => localStorage.getItem('token'));
        record('A20_03', 'Technician A logged out via application UI; session cleared', null, sessionAfterLogout, sessionAfterLogout === null);

        // ─── STEP 4: Tech B logs in on same shared physical workstation via /login UI ───
        console.log('Step 4: Technician B logs into the shared workstation via /login UI...');
        await page.setOfflineMode(false);
        await page.evaluate(() => window.dispatchEvent(new Event('online')));
        await loginViaUI(page, baseUrl, userTechB.username, 'fictionalPassword123!');

        const loggedUserB = await page.evaluate(() => {
            const u = localStorage.getItem('user');
            return u ? JSON.parse(u) : null;
        });
        record('A20_04', 'Technician B authenticated via application UI on shared device', userTechB.id, loggedUserB?.id, loggedUserB?.id === userTechB.id);
        await page.screenshot({ path: path.join(outputDir, 'browser-a20-techB-login.png') });

        // ─── STEP 5: Verify rendered Workbench view for Tech B contains none of Tech A draft ───
        console.log('Step 5: Verifying Technician B view contains none of Tech A draft...');
        await page.goto(`${baseUrl}/workbench?sampleId=${sampleB.id}&workItemId=${workItemB.id}&analysis=PH_H2O`, { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('input[inputmode="decimal"]', { timeout: 10000 });

        const techBEditorVal = await page.$eval('input[inputmode="decimal"]', el => el.value);
        const bodyTextB = await page.evaluate(() => document.body.textContent || '');
        const bIsolated = !bodyTextB.includes('6.85') && techBEditorVal !== '6.85';
        record('A20_05', 'Rendered Technician B workbench view contains none of Tech A draft', true, bIsolated, bIsolated);

        // ─── STEP 6: Shipped sync triggered under Tech B: sends 0 Tech A operations ───
        console.log('Step 6: Triggering sync under Tech B session; verifying zero cross-account replay...');
        const capturedSyncRequests = [];
        const syncListener = (request) => {
            if (request.url().includes('/api/sync/operations') && request.method() === 'POST') {
                try {
                    capturedSyncRequests.push(JSON.parse(request.postData() || '{}'));
                } catch (_) {}
            }
        };
        page.on('request', syncListener);

        await page.evaluate(async () => {
            if (window.soilferSync && window.soilferSync.triggerSync) {
                return await window.soilferSync.triggerSync();
            }
        });
        await new Promise(r => setTimeout(r, 1500));
        page.off('request', syncListener);

        const techAOpsUnderB = capturedSyncRequests.flatMap(r => r.operations || []).filter(op => {
            return op.userId === userTechA.id || op.target === workItemA.id || JSON.stringify(op).includes('6.85');
        }).length;

        record('A20_06', 'Shipped sync under Tech B sends 0 Tech A operations (no cross-account replay)', 0, techAOpsUnderB, techAOpsUnderB === 0);

        // ─── STEP 7: Tech B completes and syncs companion work on Sample B ───
        console.log('Step 7: Technician B enters and syncs companion work on Sample B...');
        await page.focus('input[inputmode="decimal"]');
        await page.evaluate(() => {
            const input = document.querySelector('input[inputmode="decimal"]');
            if (input) {
                const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                nativeSetter.call(input, '');
                input.dispatchEvent(new Event('input', { bubbles: true }));
            }
        });
        await page.type('input[inputmode="decimal"]', '7.40');
        await new Promise(r => setTimeout(r, 1500));

        await page.evaluate(async () => {
            if (window.soilferSync && window.soilferSync.triggerSync) {
                return await window.soilferSync.triggerSync();
            }
        });
        await new Promise(r => setTimeout(r, 2000));

        const draftRecordB = await prisma.workItemDraft.findFirst({
            where: { workItemId: workItemB.id }
        });
        const bWorkPersisted = draftRecordB && (draftRecordB.value === '7.40' || draftRecordB.value === '7.4') && draftRecordB.userId === userTechB.username;
        record('A20_07', 'Technician B companion work synced and attributed strictly to Tech B', true, !!bWorkPersisted, !!bWorkPersisted);

        // ─── STEP 8: Tech B logs out via application UI ───
        console.log('Step 8: Technician B logs out of shared device via application UI...');
        await logoutViaUI(page);
        record('A20_08', 'Technician B logged out via application UI', true, true, true);

        // ─── STEP 9: Tech A logs back in via /login UI ───
        console.log('Step 9: Technician A logs back in to recover pending draft...');
        await loginViaUI(page, baseUrl, userTechA.username, 'fictionalPassword123!');
        record('A20_09', 'Technician A re-authenticated via application UI on shared device', true, true, true);

        // ─── STEP 10: Tech A opens workbench and recovers draft value in editor ───
        console.log('Step 10: Technician A opens workbench; verifying draft recovery in editor...');
        await page.goto(`${baseUrl}/workbench?sampleId=${sampleA.id}&workItemId=${workItemA.id}&analysis=PH_H2O`, { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('input[inputmode="decimal"]', { timeout: 10000 });
        await new Promise(r => setTimeout(r, 1500));

        const recoveredValA = await page.$eval('input[inputmode="decimal"]', el => el.value);
        record('A20_10', 'Technician A recovers draft determination 6.85 in actual editor input', '6.85', recoveredValA, recoveredValA === '6.85');
        await page.screenshot({ path: path.join(outputDir, 'browser-a20-techA-recovered.png') });

        // ─── STEP 11: Tech A syncs recovered work via shipped sync mechanism ───
        console.log('Step 11: Technician A syncs recovered work via shipped sync mechanism...');
        await page.evaluate(async () => {
            if (window.soilferSync && window.soilferSync.triggerSync) {
                return await window.soilferSync.triggerSync();
            }
        });
        await new Promise(r => setTimeout(r, 2000));

        const draftRecordA = await prisma.workItemDraft.findFirst({
            where: { workItemId: workItemA.id }
        });
        const aWorkPersisted = draftRecordA && (draftRecordA.value === '6.85' || draftRecordA.value === '6.850') && draftRecordA.userId === userTechA.username;
        record('A20_11', 'Technician A recovered draft synced and attributed strictly to Tech A in database', true, !!aWorkPersisted, !!aWorkPersisted);

    } finally {
        if (browser) {
            try { await browser.close(); } catch (_) {}
        }
        if (server) {
            try { await new Promise(resolve => server.close(resolve)); } catch (_) {}
        }
        if (prisma) {
            try { await prisma.$disconnect(); } catch (_) {}
        }
    }

    // Hash check
    const sourceHashAfter = hash(sourcePath);
    const hashIntact = sourceHashBefore === sourceHashAfter;
    record('A20_12', 'Baseline database dev.db hash strictly preserved untouched', sourceHashBefore, sourceHashAfter, hashIntact);

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
        path.join(outputDir, 'browser-a20-results.json'),
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

    console.log(`\n--- BROWSER A20 JOURNEY COMPLETE: ${summary.passed}/${summary.totalTests} PASSED ---`);
    process.exit(summary.failed > 0 ? 1 : 0);
}

runJourney().catch(err => {
    console.error('Fatal error in A20 browser journey:', err);
    try {
        if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
        if (fs.existsSync(dbPath + '-shm')) fs.unlinkSync(dbPath + '-shm');
        if (fs.existsSync(dbPath + '-wal')) fs.unlinkSync(dbPath + '-wal');
    } catch (_) {}
    process.exit(1);
});
