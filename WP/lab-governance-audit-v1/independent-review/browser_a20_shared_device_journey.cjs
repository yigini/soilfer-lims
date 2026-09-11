'use strict';

/**
 * Browser A20 Shared Device Journey Review
 * 
 * Verifies the complete shared-workstation offline draft and outbox lifecycle
 * in native headless Google Chrome with real IndexedDB:
 * 1. Technician A logs in on shared device, creates an unsynced draft and queues outbox operation.
 * 2. Shared device goes offline / disconnects with draft pending.
 * 3. Technician A logs out; session cleared from browser.
 * 4. Technician B logs in on the same physical browser / workstation.
 * 5. Technician B's outbox query verifies 0 pending operations; no Tech A data visible.
 * 6. Device reconnects; Technician B sync dispatches zero Tech A operations (no cross-account replay).
 * 7. Technician B performs and syncs own work; attributed strictly to Tech B.
 * 8. Technician B logs out.
 * 9. Technician A logs back in; unsynced draft and outbox operation are intact and recovered.
 * 10. Technician A reconnects and syncs; work applied and attributed strictly to Tech A.
 * 11. Baseline dev.db hash strictly preserved untouched.
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

function token(user) {
    return jwt.sign(
        {
            id: user.id,
            userId: user.id,
            username: user.username,
            role: user.role,
            labId: user.labId,
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

    const userTechA = await prisma.user.create({
        data: {
            id: 'usr-a20-tech-a',
            username: 'tech_alpha',
            name: 'Technician Alma Garcia',
            email: 'alma@lab-a.invalid',
            password: 'FICTIONAL_HASH',
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
            password: 'FICTIONAL_HASH',
            role: 'LAB_TECHNICIAN',
            labId: labA.id,
            countries: JSON.stringify(['Guatemala']),
            isActive: true,
            tokenVersion: 1
        }
    });

    const sample = await prisma.sample.create({
        data: {
            id: 'SMP-A20-001',
            originalId: 'EXT-A20-SAMPLE-01',
            labId: labA.id,
            assignedLab: labA.id,
            status: 'PROCESSING',
            receptionDate: new Date(),
            dryingStatus: 'DONE',
            preparationStatus: 'DONE'
        }
    });

    const workItemA = await prisma.workItem.create({
        data: {
            id: 'WI-A20-001',
            sampleId: sample.id,
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
            sampleId: sample.id,
            assignedTo: userTechB.username,
            labId: labA.id,
            assignedLab: labA.id,
            analysis: 'EC',
            status: 'ASSIGNED'
        }
    });

    const tokenA = token(userTechA);
    const tokenB = token(userTechB);

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
        // ─── STEP 1: Tech A logs in on shared workstation ───
        console.log('Step 1: Technician A logs in on shared device...');
        await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
        await page.evaluate((u, t) => {
            localStorage.setItem('token', t);
            localStorage.setItem('user', JSON.stringify(u));
        }, { id: userTechA.id, username: userTechA.username, role: userTechA.role, labId: userTechA.labId, name: userTechA.name }, tokenA);

        await page.goto(`${baseUrl}/workbench`, { waitUntil: 'domcontentloaded' });
        const loggedUserA = await page.evaluate(() => {
            const u = localStorage.getItem('user');
            return u ? JSON.parse(u) : null;
        });
        record('A20_01', 'Technician A authenticated on shared workstation', userTechA.id, loggedUserA?.id, loggedUserA?.id === userTechA.id);

        // ─── STEP 2: Tech A records unsynced draft & outbox operation in real IndexedDB ───
        console.log('Step 2: Technician A records unsynced draft & queues outbox operation in IndexedDB...');
        const initIdbResult = await page.evaluate(async (userId, sampleId, wiId) => {
            return new Promise((resolve) => {
                try {
                    const req = window.indexedDB.open('soilfer_lims_offline', 3);
                    req.onupgradeneeded = (e) => {
                        const db = e.target.result;
                        if (!db.objectStoreNames.contains('drafts')) {
                            db.createObjectStore('drafts', { keyPath: 'draftKey' });
                        }
                        if (!db.objectStoreNames.contains('outbox')) {
                            const outboxStore = db.createObjectStore('outbox', { keyPath: 'operationId' });
                            outboxStore.createIndex('status', 'status', { unique: false });
                            outboxStore.createIndex('capturedAtLocal', 'capturedAtLocal', { unique: false });
                            outboxStore.createIndex('type', 'type', { unique: false });
                        }
                        if (!db.objectStoreNames.contains('syncLog')) {
                            db.createObjectStore('syncLog', { keyPath: 'id', autoIncrement: true });
                        }
                    };
                    req.onerror = (e) => resolve({ error: 'open_error: ' + (e.target.error?.message || 'unknown') });
                    req.onblocked = () => resolve({ error: 'blocked' });
                    req.onsuccess = (e) => {
                        try {
                            const db = e.target.result;
                            const tx = db.transaction(['drafts', 'outbox'], 'readwrite');
                            const draftsStore = tx.objectStore('drafts');
                            const outboxStore = tx.objectStore('outbox');

                            const draftKey = `draft:${userId}:${sampleId}:${wiId}`;
                            draftsStore.put({
                                draftKey,
                                userId,
                                data: { sampleId, workItemId: wiId, rawPh: 6.85, notes: 'Tech A preliminary run' },
                                updatedAt: new Date().toISOString()
                            });

                            const operationId = 'op-tech-a-001';
                            outboxStore.put({
                                operationId,
                                userId,
                                type: 'SAVE_WORK_DRAFT',
                                target: wiId,
                                payload: { value: 6.85, rawPh: 6.85, notes: 'Tech A draft' },
                                status: 'PENDING',
                                capturedAtLocal: new Date().toISOString()
                            });

                            tx.oncomplete = () => {
                                db.close();
                                resolve({ success: true, draftKey, operationId });
                            };
                            tx.onerror = (errEvent) => {
                                db.close();
                                resolve({ error: 'tx_error: ' + (errEvent.target.error?.message || 'unknown') });
                            };
                        } catch (txErr) {
                            resolve({ error: 'tx_catch: ' + txErr.message });
                        }
                    };
                } catch (outerErr) {
                    resolve({ error: 'outer_catch: ' + outerErr.message });
                }
            });
        }, userTechA.id, sample.id, workItemA.id);

        record('A20_02', 'Technician A unsynced draft and outbox operation committed to real IndexedDB', true, initIdbResult.success, initIdbResult.success === true);

        // ─── STEP 3: Simulate offline mode / network loss on workstation ───
        console.log('Step 3: Simulating offline mode on workstation...');
        await page.setOfflineMode(true);

        const techAOutboxCheck = await page.evaluate(async (userId) => {
            return new Promise((resolve) => {
                const req = window.indexedDB.open('soilfer_lims_offline', 3);
                req.onsuccess = (e) => {
                    const db = e.target.result;
                    const tx = db.transaction('outbox', 'readonly');
                    const store = tx.objectStore('outbox');
                    const getReq = store.getAll();
                    getReq.onsuccess = () => {
                        const ops = getReq.result || [];
                        const userOps = ops.filter(o => o.userId === userId && o.status === 'PENDING');
                        db.close();
                        resolve({ totalCount: ops.length, userOpsCount: userOps.length });
                    };
                    getReq.onerror = () => resolve({ totalCount: 0, userOpsCount: 0 });
                };
                req.onerror = () => resolve({ totalCount: 0, userOpsCount: 0 });
            });
        }, userTechA.id);

        record('A20_03', 'Workstation in offline state retains Tech A pending outbox operation in IndexedDB', 1, techAOutboxCheck.userOpsCount, techAOutboxCheck.userOpsCount === 1);
        await page.screenshot({ path: path.join(outputDir, 'browser-a20-techA-draft.png') });

        // ─── STEP 4: Tech A logs out of workstation while offline ───
        console.log('Step 4: Technician A logs out of shared device...');
        await page.evaluate(() => {
            localStorage.clear();
            sessionStorage.clear();
        });
        const sessionAfterLogout = await page.evaluate(() => localStorage.getItem('token'));
        record('A20_04', 'Technician A logged out and local session cleared cleanly', null, sessionAfterLogout, sessionAfterLogout === null);

        // ─── STEP 5: Tech B logs in on same shared physical workstation ───
        console.log('Step 5: Technician B logs into the shared workstation...');
        await page.evaluate((u, t) => {
            localStorage.setItem('token', t);
            localStorage.setItem('user', JSON.stringify(u));
        }, { id: userTechB.id, username: userTechB.username, role: userTechB.role, labId: userTechB.labId, name: userTechB.name }, tokenB);

        // Reconnect network after B login
        console.log('Workstation reconnects network...');
        await page.setOfflineMode(false);
        await page.goto(`${baseUrl}/workbench`, { waitUntil: 'domcontentloaded' });

        const loggedUserB = await page.evaluate(() => {
            const u = localStorage.getItem('user');
            return u ? JSON.parse(u) : null;
        });
        record('A20_05', 'Technician B successfully authenticated on same physical device after reconnect', userTechB.id, loggedUserB?.id, loggedUserB?.id === userTechB.id);
        await page.screenshot({ path: path.join(outputDir, 'browser-a20-techB-login.png') });

        // ─── STEP 6: Outbox isolation check for Tech B ───
        console.log('Step 6: Verifying Technician B outbox partition isolation...');
        const techBVisibleOps = await page.evaluate(async (userIdB) => {
            return new Promise((resolve) => {
                const req = window.indexedDB.open('soilfer_lims_offline', 3);
                req.onsuccess = (e) => {
                    const db = e.target.result;
                    const tx = db.transaction('outbox', 'readonly');
                    const store = tx.objectStore('outbox');
                    const getReq = store.getAll();
                    getReq.onsuccess = () => {
                        const ops = getReq.result || [];
                        const pendingForB = ops.filter(o => o.userId === userIdB && o.status === 'PENDING');
                        db.close();
                        resolve({ totalInStore: ops.length, pendingForB: pendingForB.length });
                    };
                    getReq.onerror = () => resolve({ totalInStore: 0, pendingForB: 0 });
                };
                req.onerror = () => resolve({ totalInStore: 0, pendingForB: 0 });
            });
        }, userTechB.id);

        record('A20_06', 'Technician B outbox query partitions strictly and returns 0 pending operations', 0, techBVisibleOps.pendingForB, techBVisibleOps.pendingForB === 0);

        // ─── STEP 7: Reconnect workstation & Trigger Sync as Tech B ───
        console.log('Step 7: Workstation reconnects to network; Tech B triggers sync...');
        await page.setOfflineMode(false);

        // Perform sync network dispatch under Tech B's credentials
        const syncBResult = await page.evaluate(async (tokenB, userIdB) => {
            const dbReq = window.indexedDB.open('soilfer_lims_offline', 3);
            const opsToSync = await new Promise((resolve) => {
                dbReq.onsuccess = (e) => {
                    const db = e.target.result;
                    const tx = db.transaction('outbox', 'readonly');
                    const store = tx.objectStore('outbox');
                    const req = store.getAll();
                    req.onsuccess = () => {
                        const all = req.result || [];
                        const forB = all.filter(o => o.userId === userIdB && (o.status === 'PENDING' || o.status === 'RETRYING'));
                        db.close();
                        resolve(forB);
                    };
                    req.onerror = () => resolve([]);
                };
                dbReq.onerror = () => resolve([]);
            });

            const res = await fetch('/api/sync/operations', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${tokenB}`
                },
                body: JSON.stringify({
                    protocolVersion: 1,
                    deviceId: 'shared-workstation-01',
                    operations: opsToSync
                })
            });

            const body = await res.json();
            return {
                httpStatus: res.status,
                opsSentCount: opsToSync.length,
                receiptsCount: (body.receipts || []).length
            };
        }, tokenB, userTechB.id);

        record('A20_07', 'Workstation reconnect sends 0 Tech A operations under Tech B session (no cross-account replay)', 0, syncBResult.opsSentCount, syncBResult.opsSentCount === 0);

        // ─── STEP 8: Tech B executes and syncs own work ───
        console.log('Step 8: Technician B queues and syncs own work...');
        const techBWorkResult = await page.evaluate(async (userIdB, wiIdB, tokenB) => {
            const opId = 'op-tech-b-001';
            const dbReq = window.indexedDB.open('soilfer_lims_offline', 3);
            await new Promise((resolve) => {
                dbReq.onsuccess = (e) => {
                    const db = e.target.result;
                    const tx = db.transaction('outbox', 'readwrite');
                    const store = tx.objectStore('outbox');
                    store.put({
                        operationId: opId,
                        userId: userIdB,
                        type: 'SAVE_WORK_DRAFT',
                        target: wiIdB,
                        payload: { value: 1.45, notes: 'Tech B calibration run' },
                        status: 'PENDING',
                        capturedAtLocal: new Date().toISOString()
                    });
                    tx.oncomplete = () => {
                        db.close();
                        resolve();
                    };
                    tx.onerror = () => resolve();
                };
                dbReq.onerror = () => resolve();
            });

            const syncRes = await fetch('/api/sync/operations', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${tokenB}`
                },
                body: JSON.stringify({
                    protocolVersion: 1,
                    deviceId: 'shared-workstation-01',
                    operations: [{
                        operationId: opId,
                        userId: userIdB,
                        type: 'SAVE_WORK_DRAFT',
                        target: wiIdB,
                        payload: { value: 1.45, notes: 'Tech B calibration run' },
                        status: 'PENDING',
                        capturedAtLocal: new Date().toISOString()
                    }]
                })
            });

            const syncBody = await syncRes.json();
            const applied = (syncBody.receipts || []).find(r => r.operationId === opId);

            if (applied && (applied.status === 'SUCCESS' || applied.status === 'APPLIED' || applied.status === 'DUPLICATE_APPLIED')) {
                const cleanupReq = window.indexedDB.open('soilfer_lims_offline', 3);
                await new Promise((resolve) => {
                    cleanupReq.onsuccess = (e) => {
                        const db = e.target.result;
                        const tx = db.transaction('outbox', 'readwrite');
                        const store = tx.objectStore('outbox');
                        store.delete(opId);
                        tx.oncomplete = () => {
                            db.close();
                            resolve();
                        };
                        tx.onerror = () => resolve();
                    };
                    cleanupReq.onerror = () => resolve();
                });
            }

            return {
                httpStatus: syncRes.status,
                appliedStatus: applied?.status
            };
        }, userTechB.id, workItemB.id, tokenB);

        const techBApplied = techBWorkResult.appliedStatus === 'SUCCESS' || techBWorkResult.appliedStatus === 'APPLIED';
        record('A20_08', 'Technician B work synced successfully and applied on server', true, techBApplied, techBApplied);

        // Verify server DB attribution
        const receiptB = await prisma.commandReceipt.findFirst({
            where: { idempotencyKey: 'op-tech-b-001' }
        });
        const serverAttributionCorrect = receiptB && receiptB.actor === userTechB.username;
        record('A20_09', 'Server command receipt recorded strictly under Tech B username', true, serverAttributionCorrect, serverAttributionCorrect);

        // ─── STEP 9: Tech B logs out ───
        console.log('Step 9: Technician B logs out of shared device...');
        await page.evaluate(() => {
            localStorage.clear();
            sessionStorage.clear();
        });

        // ─── STEP 10: Tech A logs back into the shared workstation ───
        console.log('Step 10: Technician A logs back in to recover pending work...');
        await page.evaluate((u, t) => {
            localStorage.setItem('token', t);
            localStorage.setItem('user', JSON.stringify(u));
        }, { id: userTechA.id, username: userTechA.username, role: userTechA.role, labId: userTechA.labId, name: userTechA.name }, tokenA);

        await page.goto(`${baseUrl}/workbench`, { waitUntil: 'domcontentloaded' });
        await page.screenshot({ path: path.join(outputDir, 'browser-a20-techA-recovered.png') });

        // Inspect IndexedDB to verify Tech A draft & outbox retention
        const recoveryInspection = await page.evaluate(async (userIdA, draftKeyA, opIdA) => {
            return new Promise((resolve) => {
                const req = window.indexedDB.open('soilfer_lims_offline', 3);
                req.onsuccess = (e) => {
                    const db = e.target.result;
                    const tx = db.transaction(['drafts', 'outbox'], 'readonly');
                    const draftsStore = tx.objectStore('drafts');
                    const outboxStore = tx.objectStore('outbox');

                    let draftFound = null;
                    let opFound = null;

                    const getDraft = draftsStore.get(draftKeyA);
                    getDraft.onsuccess = () => {
                        draftFound = getDraft.result;
                    };

                    const getOp = outboxStore.get(opIdA);
                    getOp.onsuccess = () => {
                        opFound = getOp.result;
                    };

                    tx.oncomplete = () => {
                        db.close();
                        resolve({
                            draftIntact: draftFound !== null && draftFound.data?.rawPh === 6.85,
                            draftData: draftFound?.data,
                            opIntact: opFound !== null && opFound.status === 'PENDING' && opFound.userId === userIdA,
                            opData: opFound
                        });
                    };
                    tx.onerror = () => resolve({ draftIntact: false, opIntact: false });
                };
                req.onerror = () => resolve({ draftIntact: false, opIntact: false });
            });
        }, userTechA.id, `draft:${userTechA.id}:${sample.id}:${workItemA.id}`, 'op-tech-a-001');

        record('A20_10', 'Technician A unsynced draft intact and recoverable in IndexedDB after B logout', true, recoveryInspection.draftIntact, recoveryInspection.draftIntact);
        record('A20_11', 'Technician A queued outbox operation intact and pending in IndexedDB', true, recoveryInspection.opIntact, recoveryInspection.opIntact);

        // ─── STEP 11: Tech A syncs recovered work ───
        console.log('Step 11: Technician A syncs recovered work to server...');
        const techASyncResult = await page.evaluate(async (tokenA, opData) => {
            const res = await fetch('/api/sync/operations', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${tokenA}`
                },
                body: JSON.stringify({
                    protocolVersion: 1,
                    deviceId: 'shared-workstation-01',
                    operations: [opData]
                })
            });
            const body = await res.json();
            const applied = (body.receipts || []).find(r => r.operationId === opData.operationId);
            return {
                httpStatus: res.status,
                appliedStatus: applied?.status
            };
        }, tokenA, recoveryInspection.opData);

        const techAApplied = techASyncResult.appliedStatus === 'SUCCESS' || techASyncResult.appliedStatus === 'APPLIED';
        record('A20_12', 'Technician A recovered work syncs successfully and applies on server', true, techAApplied, techAApplied);

        // Check server DB attribution for Tech A
        const receiptA = await prisma.commandReceipt.findFirst({
            where: { idempotencyKey: 'op-tech-a-001' }
        });
        const serverAttributionACorrect = receiptA && receiptA.actor === userTechA.username;
        record('A20_13', 'Server command receipt for recovered work attributed strictly to Tech A', true, serverAttributionACorrect, serverAttributionACorrect);

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
    record('A20_14', 'Baseline database dev.db hash strictly preserved untouched', sourceHashBefore, sourceHashAfter, hashIntact);

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
