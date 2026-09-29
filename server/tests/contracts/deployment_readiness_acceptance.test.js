/**
 * Deployment Readiness Acceptance Contract (WP-Readiness)
 * File: server/tests/contracts/deployment_readiness_acceptance.test.js
 *
 * Verifies the single-lab (local) and multi-lab (global) deployment readiness requirements:
 * 1. Mode-specific initialization (LAB_MANAGER + default lab vs SUPER_ADMIN + zero initial labs).
 * 2. Mandatory password change enforcement upon initial login.
 * 3. Single-lab security boundaries (LAB_MANAGER cannot create extra labs, create SUPER_ADMIN, or manage API connections).
 * 4. Multi-lab scoping and data isolation (managers scoped to own facility; cross-facility edits/staffing blocked).
 * 5. Stopped-writer restore integrity and automatic data exchange epoch rotation.
 * 6. Bounded concurrent multi-lab request processing without SQLite transaction deadlocks.
 */

const request = require('supertest');
const app = require('../../app');
const prisma = require('../../prisma');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const os = require('os');
const cp = require('child_process');
const Database = require('better-sqlite3');
const { restoreBackup } = require('../../scripts/restore_db');
const { rotateEpoch, getCurrentEpoch, initTables, ensureTriggers } = require('../../services/exchangeStateService');

describe('Deployment Readiness Acceptance Contract', () => {
    const TS = Date.now();
    const localLabId = `lab-readiness-local-${TS}`;
    const globalLabAId = `lab-readiness-a-${TS}`;
    const globalLabBId = `lab-readiness-b-${TS}`;

    const localManagerUser = `local_mgr_${TS}`;
    const globalAdminUser = `global_admin_${TS}`;
    const managerAUser = `mgr_a_${TS}`;
    const managerBUser = `mgr_b_${TS}`;

    const tempPassword = 'Init-Readiness-Pass-2026!';
    const changedPassword = 'New-Permanent-Pass-2026!';

    let localManagerToken = null;
    let globalAdminToken = null;
    let managerAToken = null;
    let managerBToken = null;

    beforeAll(async () => {
        const hashedPassword = await bcrypt.hash(tempPassword, 10);
        const now = new Date();

        // Provision Single-Lab (Local) baseline
        await prisma.lab.create({
            data: {
                id: localLabId,
                name: 'Local Single Facility',
                code: `LCL${TS.toString().slice(-4)}`,
                country: 'LCL',
                isActive: true,
                createdAt: now,
                updatedAt: now
            }
        });

        await prisma.user.create({
            data: {
                id: `user-${localManagerUser}`,
                username: localManagerUser,
                password: hashedPassword,
                email: `${localManagerUser}@soilfer-lims.test`,
                role: 'LAB_MANAGER',
                name: 'Local Lab Manager',
                labId: localLabId,
                countries: '[]',
                projects: '[]',
                isActive: true,
                mustChangePassword: true,
                createdAt: now,
                updatedAt: now
            }
        });

        // Provision Multi-Lab (Global) baseline
        await prisma.user.create({
            data: {
                id: `user-${globalAdminUser}`,
                username: globalAdminUser,
                password: hashedPassword,
                email: `${globalAdminUser}@soilfer-lims.test`,
                role: 'SUPER_ADMIN',
                name: 'Central Super Admin',
                labId: null,
                countries: '[]',
                projects: '[]',
                isActive: true,
                mustChangePassword: true,
                createdAt: now,
                updatedAt: now
            }
        });

        await prisma.lab.create({
            data: {
                id: globalLabAId,
                name: 'Regional Facility A',
                code: `GLA${TS.toString().slice(-4)}`,
                country: 'AAA',
                isActive: true,
                createdAt: now,
                updatedAt: now
            }
        });

        await prisma.lab.create({
            data: {
                id: globalLabBId,
                name: 'Regional Facility B',
                code: `GLB${TS.toString().slice(-4)}`,
                country: 'BBB',
                isActive: true,
                createdAt: now,
                updatedAt: now
            }
        });

        await prisma.user.create({
            data: {
                id: `user-${managerAUser}`,
                username: managerAUser,
                password: hashedPassword,
                email: `${managerAUser}@soilfer-lims.test`,
                role: 'LAB_MANAGER',
                name: 'Manager A',
                labId: globalLabAId,
                countries: JSON.stringify(['AAA']),
                projects: '[]',
                isActive: true,
                mustChangePassword: false,
                createdAt: now,
                updatedAt: now
            }
        });

        await prisma.user.create({
            data: {
                id: `user-${managerBUser}`,
                username: managerBUser,
                password: hashedPassword,
                email: `${managerBUser}@soilfer-lims.test`,
                role: 'LAB_MANAGER',
                name: 'Manager B',
                labId: globalLabBId,
                countries: JSON.stringify(['BBB']),
                projects: '[]',
                isActive: true,
                mustChangePassword: false,
                createdAt: now,
                updatedAt: now
            }
        });
    });

    afterAll(async () => {
        try {
            await prisma.user.deleteMany({
                where: { username: { in: [localManagerUser, globalAdminUser, managerAUser, managerBUser, `tech_${TS}`] } }
            });
            await prisma.lab.deleteMany({
                where: { id: { in: [localLabId, globalLabAId, globalLabBId] } }
            });
            await prisma.project.deleteMany({
                where: { code: `PROJ-${TS.toString().slice(-4)}` }
            });
        } catch (_) {}
    });

    describe('1. Initial Login & Mandatory Password Change Enforcement', () => {
        test('Initial login succeeds and reports mustChangePassword: true', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({ username: localManagerUser, password: tempPassword });

            expect(res.status).toBe(200);
            expect(res.body.token).toBeDefined();
            expect(res.body.user.mustChangePassword).toBe(true);
            expect(res.body.user.role).toBe('LAB_MANAGER');
            localManagerToken = res.body.token;
        });

        test('Operational endpoints are blocked with 403 until password is changed', async () => {
            const res = await request(app)
                .get('/api/labs')
                .set('Authorization', `Bearer ${localManagerToken}`);

            expect(res.status).toBe(403);
            expect(res.body.error).toMatch(/PASSWORD_CHANGE_REQUIRED|password change required/i);
        });

        test('POST /api/auth/change-password updates credential and clears flag', async () => {
            const res = await request(app)
                .post('/api/auth/change-password')
                .set('Authorization', `Bearer ${localManagerToken}`)
                .send({
                    currentPassword: tempPassword,
                    newPassword: changedPassword
                });

            expect(res.status).toBe(200);
            expect(res.body.token).toBeDefined();
            localManagerToken = res.body.token;

            // Operational access is now permitted
            const labRes = await request(app)
                .get('/api/labs')
                .set('Authorization', `Bearer ${localManagerToken}`);

            expect(labRes.status).toBe(200);
            expect(Array.isArray(labRes.body)).toBe(true);
        });

        test('Global admin initial password change workflow', async () => {
            const loginRes = await request(app)
                .post('/api/auth/login')
                .send({ username: globalAdminUser, password: tempPassword });

            expect(loginRes.status).toBe(200);
            expect(loginRes.body.user.role).toBe('SUPER_ADMIN');
            expect(loginRes.body.user.mustChangePassword).toBe(true);

            const changeRes = await request(app)
                .post('/api/auth/change-password')
                .set('Authorization', `Bearer ${loginRes.body.token}`)
                .send({
                    currentPassword: tempPassword,
                    newPassword: changedPassword
                });

            expect(changeRes.status).toBe(200);
            globalAdminToken = changeRes.body.token;
        });
    });

    describe('2. Single-Lab (Local Mode) Security & Authority Boundaries', () => {
        test('LAB_MANAGER can view and edit own laboratory', async () => {
            const res = await request(app)
                .put(`/api/labs/${localLabId}`)
                .set('Authorization', `Bearer ${localManagerToken}`)
                .send({ name: 'Renamed Local Single Facility' });

            expect(res.status).toBe(200);
            expect(res.body.name).toBe('Renamed Local Single Facility');
        });

        test('LAB_MANAGER can onboard technician to own laboratory', async () => {
            const res = await request(app)
                .post('/api/users')
                .set('Authorization', `Bearer ${localManagerToken}`)
                .send({
                    username: `tech_${TS}`,
                    password: 'Secure-Tech-Pass-2026!',
                    role: 'LAB_TECHNICIAN',
                    labId: localLabId
                });

            expect(res.status).toBe(200);
            expect(res.body.username).toBe(`tech_${TS}`);
            expect(res.body.labId).toBe(localLabId);
        });

        test('LAB_MANAGER can create a laboratory project', async () => {
            const res = await request(app)
                .post('/api/projects')
                .set('Authorization', `Bearer ${localManagerToken}`)
                .send({
                    code: `PROJ-${TS.toString().slice(-4)}`,
                    name: 'Local Single Facility Project',
                    projectType: 'AD_HOC'
                });

            expect(res.status).toBe(200);
            expect(res.body.code).toBe(`PROJ-${TS.toString().slice(-4)}`);
        });

        test('LAB_MANAGER cannot create extra laboratories (403)', async () => {
            const res = await request(app)
                .post('/api/labs')
                .set('Authorization', `Bearer ${localManagerToken}`)
                .send({
                    id: `forbidden-lab-${TS}`,
                    code: 'FORBIDDEN',
                    name: 'Forbidden Second Lab'
                });

            expect(res.status).toBe(403);
        });

        test('LAB_MANAGER cannot create SUPER_ADMIN accounts (403)', async () => {
            const res = await request(app)
                .post('/api/users')
                .set('Authorization', `Bearer ${localManagerToken}`)
                .send({
                    username: `bad_admin_${TS}`,
                    password: 'Forbidden-Pass-2026!',
                    role: 'SUPER_ADMIN',
                    labId: localLabId
                });

            expect(res.status).toBe(403);
        });

        test('LAB_MANAGER cannot access external data exchange API connections (403)', async () => {
            const res = await request(app)
                .get('/api/v1/data-exchange/connections')
                .set('Authorization', `Bearer ${localManagerToken}`);

            expect(res.status).toBe(403);
        });
    });

    describe('3. Multi-Lab (Global Mode) Scoping & Cross-Lab Isolation', () => {
        beforeAll(async () => {
            const loginA = await request(app)
                .post('/api/auth/login')
                .send({ username: managerAUser, password: tempPassword });
            managerAToken = loginA.body.token;

            const loginB = await request(app)
                .post('/api/auth/login')
                .send({ username: managerBUser, password: tempPassword });
            managerBToken = loginB.body.token;
        });

        test('Manager A only sees Lab A in laboratory catalogue', async () => {
            const res = await request(app)
                .get('/api/labs')
                .set('Authorization', `Bearer ${managerAToken}`);

            expect(res.status).toBe(200);
            const labIds = res.body.map(l => l.id);
            expect(labIds).toContain(globalLabAId);
            expect(labIds).not.toContain(globalLabBId);
        });

        test('Manager B only sees Lab B in laboratory catalogue', async () => {
            const res = await request(app)
                .get('/api/labs')
                .set('Authorization', `Bearer ${managerBToken}`);

            expect(res.status).toBe(200);
            const labIds = res.body.map(l => l.id);
            expect(labIds).toContain(globalLabBId);
            expect(labIds).not.toContain(globalLabAId);
        });

        test('Manager A is denied mutating Lab B (403)', async () => {
            const res = await request(app)
                .put(`/api/labs/${globalLabBId}`)
                .set('Authorization', `Bearer ${managerAToken}`)
                .send({ name: 'Tampered Lab B Name' });

            expect(res.status).toBe(403);
        });

        test('Manager A is denied creating staff for Lab B (403)', async () => {
            const res = await request(app)
                .post('/api/users')
                .set('Authorization', `Bearer ${managerAToken}`)
                .send({
                    username: `cross_staff_${TS}`,
                    password: 'Secure-Pass-2026!',
                    role: 'LAB_TECHNICIAN',
                    labId: globalLabBId
                });

            expect(res.status).toBe(403);
        });

        test('SUPER_ADMIN can see and coordinate all laboratories', async () => {
            const res = await request(app)
                .get('/api/labs')
                .set('Authorization', `Bearer ${globalAdminToken}`);

            expect(res.status).toBe(200);
            const labIds = res.body.map(l => l.id);
            expect(labIds).toContain(globalLabAId);
            expect(labIds).toContain(globalLabBId);
        });
    });

    describe('4. Stopped-Writer Database Restore & Automatic Epoch Invalidation', () => {
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), `lims_restore_test_${TS}_`));
        const sourceDbPath = path.join(tmpDir, 'source.db');
        const targetDbPath = path.join(tmpDir, 'target.db');

        afterAll(() => {
            try {
                fs.rmSync(tmpDir, { recursive: true, force: true });
            } catch (_) {}
        });

        test('Restores database, verifies integrity & foreign keys, and rotates exchange epoch', async () => {
            // Create source SQLite database with exchange tables
            const sourceDb = new Database(sourceDbPath);
            sourceDb.pragma('journal_mode = WAL');
            sourceDb.exec(`
                CREATE TABLE User (id TEXT PRIMARY KEY, username TEXT);
                INSERT INTO User VALUES ('u1', 'admin');
                CREATE TABLE Sample (id TEXT PRIMARY KEY, labId TEXT);
                INSERT INTO Sample VALUES ('s1', 'LAB01');
            `);
            initTables(sourceDb);
            ensureTriggers(sourceDb);
            const initialEpoch = getCurrentEpoch(sourceDb);
            sourceDb.close();

            expect(initialEpoch).toBeDefined();

            // Perform restore into target location
            const result = await restoreBackup(sourceDbPath, targetDbPath);

            expect(result.success).toBe(true);
            expect(result.epochRotated).toBe(true);

            // Verify target database
            const restoredDb = new Database(targetDbPath, { readonly: true });
            const userCount = restoredDb.prepare('SELECT count(*) as c FROM User').get().c;
            const newEpoch = getCurrentEpoch(restoredDb);
            restoredDb.close();

            expect(userCount).toBe(1);
            expect(newEpoch).toBeDefined();
            expect(newEpoch).not.toBe(initialEpoch); // Epoch was successfully rotated!
        });

        test('Fails closed, exits non-zero, and preserves safety artifacts when SQL epoch rotation triggers fail', async () => {
            const failBackupPath = path.join(tmpDir, 'fail_backup.db');
            const failTargetPath = path.join(tmpDir, 'fail_target.db');

            // 1. Create a prior target database with a WAL sidecar to test preservation
            const priorDb = new Database(failTargetPath);
            priorDb.pragma('journal_mode = WAL');
            priorDb.exec(`
                CREATE TABLE User (id TEXT PRIMARY KEY, username TEXT);
                INSERT INTO User VALUES ('prior-admin', 'prior');
            `);
            // Write a record without checkpointing to leave pages in WAL
            priorDb.exec(`INSERT INTO User VALUES ('wal-page-test', 'in-wal');`);
            priorDb.close();

            // 2. Create source backup with a deliberate SQL trigger aborting epoch updates
            const failDb = new Database(failBackupPath);
            failDb.exec(`
                CREATE TABLE User (id TEXT PRIMARY KEY, username TEXT);
                INSERT INTO User VALUES ('u2', 'admin2');
                CREATE TABLE Sample (id TEXT PRIMARY KEY, labId TEXT);
                INSERT INTO Sample VALUES ('s2', 'LAB02');
            `);
            initTables(failDb);
            ensureTriggers(failDb);
            failDb.exec(`
                CREATE TRIGGER fail_epoch_update
                BEFORE UPDATE OF value ON _exchange_meta
                WHEN NEW.key = 'epoch'
                BEGIN
                    SELECT RAISE(ABORT, 'controlled epoch persistence failure');
                END;
            `);
            failDb.close();

            // 3. Test programmatic restore: MUST throw and fail closed
            await expect(restoreBackup(failBackupPath, failTargetPath)).rejects.toThrow(
                /Data exchange epoch rotation failed/
            );

            // 4. Test CLI restore: MUST exit with code 1 and NOT claim success
            const serverDir = path.resolve(__dirname, '..', '..');
            const cliRes = cp.spawnSync(process.execPath, [
                path.join(serverDir, 'scripts', 'restore_db.js'),
                failBackupPath,
                '--target',
                failTargetPath
            ], {
                cwd: serverDir,
                env: { ...process.env, DATABASE_PATH: failTargetPath },
                encoding: 'utf8'
            });

            expect(cliRes.status).toBe(1);
            expect(cliRes.stdout).not.toMatch(/\[RESTORE\] SUCCESS/);
            expect(cliRes.stderr).toMatch(/controlled epoch persistence failure/);

            // 5. Verify that pre-restore safety snapshots were preserved
            const dirFiles = fs.readdirSync(tmpDir);
            const bakFiles = dirFiles.filter(f => f.startsWith('fail_target.db.pre_restore_') && f.endsWith('.bak'));
            expect(bakFiles.length).toBeGreaterThanOrEqual(1);
        });
    });

    describe('5. Bounded Concurrent Multi-Lab Load Processing & Workload Isolation', () => {
        test('Handles concurrent sample intake, queries, and project reads across laboratories without deadlocks', async () => {
            const numConcurrentOperations = 12; // 6 operations for Lab A + 6 operations for Lab B
            const promises = [];

            for (let i = 0; i < numConcurrentOperations; i++) {
                if (i % 2 === 0) {
                    // Manager A operations (Lab A)
                    promises.push(
                        request(app)
                            .post('/api/samples/walkin')
                            .set('Authorization', `Bearer ${managerAToken}`)
                            .send({
                                submitter: `Submitter A ${i}`,
                                description: `Concurrent Batch A Sample ${i}`,
                                sampleType: 'ROUTINE'
                            })
                            .then(res => ({
                                lab: 'A',
                                type: 'intake',
                                status: res.status,
                                body: res.body
                            }))
                    );
                } else {
                    // Manager B operations (Lab B)
                    promises.push(
                        request(app)
                            .post('/api/samples/walkin')
                            .set('Authorization', `Bearer ${managerBToken}`)
                            .send({
                                submitter: `Submitter B ${i}`,
                                description: `Concurrent Batch B Sample ${i}`,
                                sampleType: 'ROUTINE'
                            })
                            .then(res => ({
                                lab: 'B',
                                type: 'intake',
                                status: res.status,
                                body: res.body
                            }))
                    );
                }
            }

            // Also interleave concurrent read operations simultaneously
            for (let i = 0; i < 8; i++) {
                const token = i % 2 === 0 ? managerAToken : managerBToken;
                promises.push(
                    request(app)
                        .get('/api/samples')
                        .set('Authorization', `Bearer ${token}`)
                        .then(res => ({
                            lab: i % 2 === 0 ? 'A' : 'B',
                            type: 'query',
                            status: res.status,
                            count: Array.isArray(res.body?.data) ? res.body.data.length : 0
                        }))
                );
            }

            const results = await Promise.all(promises);

            // All operations must complete cleanly without 500 error or SQLITE_BUSY / locked deadlocks
            for (const r of results) {
                if (r.type === 'intake') {
                    expect([200, 201]).toContain(r.status);
                    expect(r.body.sample?.id || r.body.data?.id).toBeDefined();
                } else if (r.type === 'query') {
                    expect(r.status).toBe(200);
                }
            }

            // Verify strict multi-lab isolation after concurrent writes:
            // Manager A should ONLY see Lab A samples; Manager B should ONLY see Lab B samples
            const resA = await request(app)
                .get('/api/samples')
                .set('Authorization', `Bearer ${managerAToken}`);
            const samplesA = resA.body.data || resA.body;
            expect(Array.isArray(samplesA)).toBe(true);
            for (const s of samplesA) {
                if (s.submitter && s.submitter.startsWith('Submitter A')) {
                    expect(s.assignedLab).toBe(globalLabAId);
                }
                if (s.submitter) {
                    expect(s.submitter).not.toMatch(/^Submitter B/);
                }
                if (s.assignedLab) expect(s.assignedLab).toBe(globalLabAId);
            }

            const resB = await request(app)
                .get('/api/samples')
                .set('Authorization', `Bearer ${managerBToken}`);
            const samplesB = resB.body.data || resB.body;
            expect(Array.isArray(samplesB)).toBe(true);
            for (const s of samplesB) {
                if (s.submitter && s.submitter.startsWith('Submitter B')) {
                    expect(s.assignedLab).toBe(globalLabBId);
                }
                if (s.submitter) {
                    expect(s.submitter).not.toMatch(/^Submitter A/);
                }
                if (s.assignedLab) expect(s.assignedLab).toBe(globalLabBId);
            }
        });
    });

    describe('6. Provision Super Admin CLI Identity Collision & State Preservation Invariants', () => {
        const provDir = fs.mkdtempSync(path.join(os.tmpdir(), `lims_prov_test_${TS}_`));
        const serverDir = path.resolve(__dirname, '..', '..');

        afterAll(() => {
            try {
                fs.rmSync(provDir, { recursive: true, force: true });
            } catch (_) {}
        });

        test('provision_super_admin CLI rejects conflicting email and does not mutate unrelated inactive user', () => {
            const testDbPath = path.join(provDir, 'conflict.db');
            const db = new Database(testDbPath);
            db.exec(`
                CREATE TABLE User (
                    id TEXT PRIMARY KEY,
                    username TEXT UNIQUE,
                    password TEXT,
                    email TEXT UNIQUE,
                    role TEXT,
                    name TEXT,
                    labId TEXT,
                    countries TEXT,
                    projects TEXT,
                    isActive INTEGER DEFAULT 1,
                    mustChangePassword INTEGER DEFAULT 0,
                    tokenVersion INTEGER DEFAULT 0,
                    language TEXT,
                    themePreference TEXT DEFAULT 'light',
                    createdAt TEXT,
                    updatedAt TEXT
                );
            `);
            const now = new Date().toISOString();
            db.prepare(`
                INSERT INTO User (id, username, password, email, role, updatedAt, isActive, tokenVersion)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `).run('existing-owner-id', 'existing-owner', 'hash-1234', 'sysadmin@soilfer-lims.local', 'LAB_MANAGER', now, 0, 0);
            db.close();

            const res = cp.spawnSync(process.execPath, [
                path.join(serverDir, 'scripts', 'provision_super_admin.js'),
                '--username', 'requested-owner',
                '--email', 'sysadmin@soilfer-lims.local',
                '--password', 'new-pass-5678'
            ], {
                cwd: serverDir,
                env: { ...process.env, DATABASE_PATH: testDbPath },
                encoding: 'utf8'
            });

            expect(res.status).toBe(1);
            expect(res.stderr).toMatch(/Conflicting identity/i);

            const verifyDb = new Database(testDbPath, { readonly: true });
            const existing = verifyDb.prepare('SELECT * FROM User WHERE id=?').get('existing-owner-id');
            const requested = verifyDb.prepare('SELECT * FROM User WHERE username=?').get('requested-owner');
            verifyDb.close();

            expect(requested).toBeUndefined();
            expect(existing.role).toBe('LAB_MANAGER');
            expect(existing.isActive).toBe(0);
            expect(existing.password).toBe('hash-1234');
            expect(existing.tokenVersion).toBe(0);
        });

        test('provision_super_admin CLI creates non-conflicting new admin cleanly without touching existing accounts', () => {
            const testDbPath = path.join(provDir, 'clean_create.db');
            const db = new Database(testDbPath);
            db.exec(`
                CREATE TABLE User (
                    id TEXT PRIMARY KEY,
                    username TEXT UNIQUE,
                    password TEXT,
                    email TEXT UNIQUE,
                    role TEXT,
                    name TEXT,
                    labId TEXT,
                    countries TEXT,
                    projects TEXT,
                    isActive INTEGER DEFAULT 1,
                    mustChangePassword INTEGER DEFAULT 0,
                    tokenVersion INTEGER DEFAULT 0,
                    language TEXT,
                    themePreference TEXT DEFAULT 'light',
                    createdAt TEXT,
                    updatedAt TEXT
                );
            `);
            const now = new Date().toISOString();
            db.prepare(`
                INSERT INTO User (id, username, password, email, role, updatedAt, isActive, tokenVersion)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `).run('manager-id', 'existing-manager', 'hash-1111', 'manager@soilfer-lims.local', 'LAB_MANAGER', now, 1, 0);
            db.close();

            const res = cp.spawnSync(process.execPath, [
                path.join(serverDir, 'scripts', 'provision_super_admin.js'),
                '--username', 'new-admin',
                '--password', 'valid-admin-pass'
            ], {
                cwd: serverDir,
                env: { ...process.env, DATABASE_PATH: testDbPath },
                encoding: 'utf8'
            });

            expect(res.status).toBe(0);
            expect(res.stdout).toMatch(/Created new SUPER_ADMIN user: new-admin/);

            const verifyDb = new Database(testDbPath, { readonly: true });
            const created = verifyDb.prepare('SELECT * FROM User WHERE username=?').get('new-admin');
            const original = verifyDb.prepare('SELECT * FROM User WHERE id=?').get('manager-id');
            verifyDb.close();

            expect(created).toBeDefined();
            expect(created.role).toBe('SUPER_ADMIN');
            expect(created.email).toBe('new-admin@soilfer-lims.local');
            expect(original.role).toBe('LAB_MANAGER');
            expect(original.password).toBe('hash-1111');
        });

        test('provision_super_admin CLI preserves inactive status unless --activate is explicitly specified', () => {
            const testDbPath = path.join(provDir, 'elevate_inactive.db');
            const db = new Database(testDbPath);
            db.exec(`
                CREATE TABLE User (
                    id TEXT PRIMARY KEY,
                    username TEXT UNIQUE,
                    password TEXT,
                    email TEXT UNIQUE,
                    role TEXT,
                    name TEXT,
                    labId TEXT,
                    countries TEXT,
                    projects TEXT,
                    isActive INTEGER DEFAULT 1,
                    mustChangePassword INTEGER DEFAULT 0,
                    tokenVersion INTEGER DEFAULT 0,
                    language TEXT,
                    themePreference TEXT DEFAULT 'light',
                    createdAt TEXT,
                    updatedAt TEXT
                );
            `);
            const now = new Date().toISOString();
            db.prepare(`
                INSERT INTO User (id, username, password, email, role, updatedAt, isActive, tokenVersion)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `).run('target-id', 'target-user', 'hash-2222', 'target@soilfer-lims.local', 'LAB_MANAGER', now, 0, 2);
            db.close();

            const res = cp.spawnSync(process.execPath, [
                path.join(serverDir, 'scripts', 'provision_super_admin.js'),
                '--username', 'target-user',
                '--elevate',
                '--password', 'elevated-pass'
            ], {
                cwd: serverDir,
                env: { ...process.env, DATABASE_PATH: testDbPath },
                encoding: 'utf8'
            });

            expect(res.status).toBe(0);

            const verifyDb = new Database(testDbPath, { readonly: true });
            const elevated = verifyDb.prepare('SELECT * FROM User WHERE id=?').get('target-id');
            verifyDb.close();

            expect(elevated.role).toBe('SUPER_ADMIN');
            expect(elevated.isActive).toBe(0);
            expect(elevated.tokenVersion).toBe(3);
        });
    });
});
