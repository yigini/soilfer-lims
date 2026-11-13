'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const Database = require('better-sqlite3');
const prisma = require('../../prisma');
const {
    seedDemoLab,
    DEMO_LAB_ID,
    DEMO_LAB_NAME,
    DEMO_PROJECT_CODE,
    DEMO_ADMIN_ID,
    DEMO_ADMIN_USERNAME,
    DEMO_ADMIN_EMAIL
} = require('../../scripts/seed_demo_lab.cjs');

const SERVER_DIR = path.resolve(__dirname, '../..');
const SEED_SCRIPT_PATH = path.resolve(SERVER_DIR, 'scripts/seed_demo_lab.cjs');

let templateTempDir = null;
let cleanTemplateDb = null;

async function cloneTemplateDatabase(targetPath, configureFn, journalMode = 'DELETE') {
    const source = new Database(cleanTemplateDb || process.env.DATABASE_PATH, { readonly: true, fileMustExist: true });
    try {
        await source.backup(targetPath);
    } finally {
        source.close();
    }

    const db = new Database(targetPath, { fileMustExist: true });
    try {
        db.pragma('foreign_keys = ON');
        if (typeof configureFn === 'function') {
            configureFn(db);
        }
        if (journalMode === 'WAL') {
            db.pragma('journal_mode = WAL');
        }
    } finally {
        db.close();
    }
}

function runSeedCliWithoutNodeEnv(candidateDbPath, extraEnv = {}) {
    const childEnv = { ...process.env, DEMO_SEED: '1', DATABASE_PATH: candidateDbPath, ...extraEnv };
    delete childEnv.NODE_ENV;
    delete childEnv.DATABASE_URL;
    delete childEnv.JEST_WORKER_ID;
    return spawnSync(process.execPath, [SEED_SCRIPT_PATH], {
        cwd: SERVER_DIR,
        env: childEnv,
        encoding: 'utf8'
    });
}

describe('Practice-Lab Seed Script (Demo Soil Lab)', () => {
    jest.setTimeout(120000);

    beforeAll(async () => {
        templateTempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'demo-seed-clean-tpl-'));
        cleanTemplateDb = path.join(templateTempDir, 'template.db');
        const source = new Database(process.env.DATABASE_PATH, { readonly: true, fileMustExist: true });
        try {
            await source.backup(cleanTemplateDb);
        } finally {
            source.close();
        }
    });

    afterAll(() => {
        if (templateTempDir) {
            fs.rmSync(templateTempDir, { recursive: true, force: true });
        }
    });

    test('refuses to run unless DEMO_SEED=1 is set', async () => {
        await expect(
            seedDemoLab({
                env: { ...process.env, DEMO_SEED: undefined, NODE_ENV: 'test' },
                silent: true
            })
        ).rejects.toMatchObject({ code: 'DEMO_SEED_REQUIRED' });
    });

    test('refuses to run when NODE_ENV=production', async () => {
        await expect(
            seedDemoLab({
                env: { ...process.env, DEMO_SEED: '1', NODE_ENV: 'production' },
                silent: true
            })
        ).rejects.toMatchObject({ code: 'DEMO_SEED_PRODUCTION_REFUSED' });
    });

    test('refuses unsupported DEMO_SEED_PROFILE values', async () => {
        await expect(
            seedDemoLab({
                env: { ...process.env, DEMO_SEED: '1', DEMO_SEED_PROFILE: 'unknown-mode', NODE_ENV: 'test' },
                silent: true
            })
        ).rejects.toMatchObject({ code: 'DEMO_SEED_INVALID_PROFILE' });
    });

    test.each(['DELETE', 'WAL'])(
        'CLI exits 1 with DEMO_SEED_DATABASE_NOT_EMPTY and leaves a %s-mode database byte-identical when a lab already exists',
        async journalMode => {
            const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'demo-seed-lab-guard-'));
            const candidateDb = path.join(tempDir, 'existing-lab.db');
            try {
                await cloneTemplateDatabase(
                    candidateDb,
                    db => {
                        db.prepare('DELETE FROM "Lab"').run();
                        db.prepare(
                            'INSERT INTO "Lab" ("id", "code", "name", "country", "isActive") VALUES (?, ?, ?, ?, 1)'
                        ).run('REAL-LAB', 'REAL', 'Regional Soil Reference Lab', 'KEN');
                        db.prepare('UPDATE "Analysis" SET "status" = ? WHERE "code" = ?').run('inactive', 'PH_H2O');
                    },
                    journalMode
                );

                const beforeBytes = fs.readFileSync(candidateDb);
                const beforeFiles = fs.readdirSync(tempDir).sort();

                const res = runSeedCliWithoutNodeEnv(candidateDb);

                expect(res.status).toBe(1);
                expect(res.stderr).toContain('DEMO_SEED_DATABASE_NOT_EMPTY');
                const afterBytes = fs.readFileSync(candidateDb);
                const afterFiles = fs.readdirSync(tempDir).sort();
                expect(Buffer.compare(afterBytes, beforeBytes)).toBe(0);
                expect(afterFiles).toEqual(beforeFiles);
            } finally {
                fs.rmSync(tempDir, { recursive: true, force: true });
            }
        }
    );

    test.each(['DELETE', 'WAL'])(
        'CLI exits 1 with DEMO_SEED_DATABASE_NOT_EMPTY and leaves a %s-mode database byte-identical when superadmin already exists',
        async journalMode => {
            const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'demo-seed-admin-guard-'));
            const candidateDb = path.join(tempDir, 'existing-superadmin.db');
            try {
                await cloneTemplateDatabase(
                    candidateDb,
                    db => {
                        db.prepare('DELETE FROM "Lab"').run();
                        db.prepare(
                            'INSERT INTO "User" ("id", "username", "password", "role", "name", "email", "isActive", "mustChangePassword", "updatedAt") VALUES (?, ?, ?, ?, ?, ?, 1, 1, CURRENT_TIMESTAMP)'
                        ).run(
                            'real-install-admin',
                            'superadmin',
                            '$2b$10$realInstallHashedPasswordMustStayUntouched00000000000',
                            'SUPER_ADMIN',
                            'Installation Administrator',
                            'admin@reallab.example'
                        );
                    },
                    journalMode
                );

                const beforeBytes = fs.readFileSync(candidateDb);
                const beforeFiles = fs.readdirSync(tempDir).sort();

                const res = runSeedCliWithoutNodeEnv(candidateDb);

                expect(res.status).toBe(1);
                expect(res.stderr).toContain('DEMO_SEED_DATABASE_NOT_EMPTY');
                const afterBytes = fs.readFileSync(candidateDb);
                const afterFiles = fs.readdirSync(tempDir).sort();
                expect(Buffer.compare(afterBytes, beforeBytes)).toBe(0);
                expect(afterFiles).toEqual(beforeFiles);
            } finally {
                fs.rmSync(tempDir, { recursive: true, force: true });
            }
        }
    );

    test('CLI exits 1 with DEMO_ADMIN_ALREADY_EXISTS and leaves the database byte-identical when demo-superadmin already exists', async () => {
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'demo-seed-demoadmin-guard-'));
        const candidateDb = path.join(tempDir, 'existing-demo-superadmin.db');
        try {
            await cloneTemplateDatabase(
                candidateDb,
                db => {
                    db.prepare('DELETE FROM "Lab"').run();
                    db.prepare(
                        'INSERT INTO "User" ("id", "username", "password", "role", "name", "email", "isActive", "mustChangePassword", "updatedAt") VALUES (?, ?, ?, ?, ?, ?, 1, 0, CURRENT_TIMESTAMP)'
                    ).run(
                        DEMO_ADMIN_ID,
                        DEMO_ADMIN_USERNAME,
                        '$2b$10$existingDemoAdminHashMustNotBeOverwritten00000000000',
                        'SUPER_ADMIN',
                        'Alex Morgan',
                        DEMO_ADMIN_EMAIL
                    );
                },
                'WAL'
            );

            const beforeBytes = fs.readFileSync(candidateDb);
            const beforeFiles = fs.readdirSync(tempDir).sort();

            const res = runSeedCliWithoutNodeEnv(candidateDb);

            expect(res.status).toBe(1);
            expect(res.stderr).toContain('DEMO_ADMIN_ALREADY_EXISTS');
            const afterBytes = fs.readFileSync(candidateDb);
            const afterFiles = fs.readdirSync(tempDir).sort();
            expect(Buffer.compare(afterBytes, beforeBytes)).toBe(0);
            expect(afterFiles).toEqual(beforeFiles);
        } finally {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    test('seeds Demo Soil Lab through real workflow transitions on an empty database and refuses a second run', async () => {
        // The Jest suite template contains fixture labs; verify the pre-write guard refuses before clearing them.
        await expect(
            seedDemoLab({
                env: { ...process.env, DEMO_SEED: '1', NODE_ENV: 'test' },
                silent: true
            })
        ).rejects.toMatchObject({ code: 'DEMO_SEED_DATABASE_NOT_EMPTY' });

        // Prepare an empty database (0 labs, 0 samples, 0 users) and verify deactivated analyses stay inactive.
        await prisma.lab.deleteMany({});
        await prisma.analysis.update({
            where: { code: 'PH_CACL2' },
            data: { status: 'inactive' }
        });

        const summary = await seedDemoLab({
            env: { ...process.env, DEMO_SEED: '1', NODE_ENV: 'test' },
            silent: true
        });

        expect(summary.labId).toBe(DEMO_LAB_ID);
        expect(summary.labName).toBe(DEMO_LAB_NAME);
        expect(summary.projectCode).toBe(DEMO_PROJECT_CODE);

        const untouchedInactiveAnalysis = await prisma.analysis.findUnique({ where: { code: 'PH_CACL2' } });
        expect(untouchedInactiveAnalysis?.status).toBe('inactive');

        // 1. Facility & policies
        const lab = await prisma.lab.findUnique({ where: { id: DEMO_LAB_ID } });
        expect(lab).toBeTruthy();
        expect(lab.name).toBe(DEMO_LAB_NAME);
        expect(lab.isActive).toBe(true);

        const labPolicy = await prisma.labPolicy.findUnique({ where: { labId: DEMO_LAB_ID } });
        expect(labPolicy?.presetCode).toBe('ISO17025_STRICT');
        const activeOverrides = await prisma.labPolicyOverride.count({
            where: { labId: DEMO_LAB_ID, revokedAt: null }
        });
        expect(activeOverrides).toBeGreaterThanOrEqual(4);

        // 2. Accounts, @example.test emails, dedicated demo-superadmin (no superadmin), bench PINs, and pending invite
        const demoUsers = await prisma.user.findMany({
            where: { labId: DEMO_LAB_ID, isActive: true }
        });
        expect(demoUsers).toHaveLength(7);

        const realSuperadmin = await prisma.user.findUnique({ where: { username: 'superadmin' } });
        expect(realSuperadmin).toBeNull();

        const demoSuperUser = await prisma.user.findUnique({ where: { username: DEMO_ADMIN_USERNAME } });
        expect(demoSuperUser?.isActive).toBe(true);
        expect(demoSuperUser?.email).toBe(DEMO_ADMIN_EMAIL);

        for (const u of [...demoUsers, demoSuperUser]) {
            expect(u.email).toMatch(/@example\.test$/);
        }

        const benchPins = await prisma.userBenchCredential.count({
            where: { userId: { in: demoUsers.filter(u => u.role === 'LAB_TECHNICIAN').map(u => u.id) } }
        });
        expect(benchPins).toBe(2);

        const pendingInvites = await prisma.staffInvitation.findMany({
            where: { labId: DEMO_LAB_ID, isConsumed: false, isRevoked: false }
        });
        expect(pendingInvites).toHaveLength(1);
        expect(pendingInvites[0].email).toBe('tech3@example.test');

        // 3. Packages, instruments, inventory, reference materials, control charts & blank history
        const groups = await prisma.analysisGroup.findMany({
            where: { id: { in: ['DEMO_ROUTINE_FERTILITY', 'DEMO_FULL_SOIL_HEALTH'] } }
        });
        expect(groups).toHaveLength(2);

        const instruments = await prisma.equipmentAsset.findMany({
            where: { labId: DEMO_LAB_ID }
        });
        expect(instruments).toHaveLength(3);

        const importTemplates = await prisma.importTemplate.findMany({
            where: { labId: DEMO_LAB_ID }
        });
        expect(importTemplates).toHaveLength(1);

        const inventoryItems = await prisma.inventoryItem.findMany({
            where: { labId: DEMO_LAB_ID }
        });
        expect(inventoryItems).toHaveLength(3);

        const refMaterials = await prisma.referenceMaterial.findMany({
            where: { labId: DEMO_LAB_ID, status: 'ACTIVE' }
        });
        expect(refMaterials).toHaveLength(2);
        expect(refMaterials.map(r => r.code).sort()).toEqual(['CRM-SOIL-01', 'LRM-DEMO-01']);

        const approvedLimitSets = await prisma.controlLimitSet.findMany({
            where: { labId: DEMO_LAB_ID, analysisCode: 'P_OLSEN', status: 'APPROVED' }
        });
        expect(approvedLimitSets).toHaveLength(1);
        expect(approvedLimitSets[0].n).toBe(12);

        // Verify >= 15 LRM measurements and >= 10 BLANK measurements on Olsen P batches
        const olsenBatches = await prisma.batch.findMany({
            where: { labId: DEMO_LAB_ID, analysis: 'P_OLSEN' },
            include: { positions: true, measurements: true }
        });
        const lrmPositionIds = new Set(
            olsenBatches.flatMap(b => b.positions.filter(p => p.kind === 'LRM').map(p => p.id))
        );
        const blankPositionIds = new Set(
            olsenBatches.flatMap(b => b.positions.filter(p => p.kind === 'BLANK').map(p => p.id))
        );
        const olsenMeasurements = olsenBatches.flatMap(b => b.measurements.filter(m => !m.supersededById));
        expect(olsenMeasurements.filter(m => lrmPositionIds.has(m.positionId)).length).toBeGreaterThanOrEqual(15);
        expect(olsenMeasurements.filter(m => blankPositionIds.has(m.positionId)).length).toBeGreaterThanOrEqual(10);

        // 4. Samples across every workflow stage (3 expected + 1 draft + 15 demo samples = 19 total)
        const project = await prisma.project.findFirst({ where: { code: DEMO_PROJECT_CODE } });
        expect(project).toBeTruthy();

        const projectSamples = await prisma.sample.findMany({
            where: { projectId: project.id },
            orderBy: { originalId: 'asc' }
        });
        expect(projectSamples).toHaveLength(19);

        const expectedRows = projectSamples.filter(s => s.status === 'EXPECTED');
        const draftRows = projectSamples.filter(s => s.status === 'DRAFT');
        const rejectedRows = projectSamples.filter(s => s.status === 'RECEIVED_REJECTED');
        expect(expectedRows).toHaveLength(3);
        expect(draftRows).toHaveLength(1);
        expect(rejectedRows).toHaveLength(1);

        const demo1to14 = projectSamples.filter(s =>
            /^FIELD-2026-0(0[1-9]|1[0-4])$/.test(s.originalId)
        );
        expect(demo1to14).toHaveLength(14);
        expect(demo1to14.map(s => s.labSampleCode)).toEqual(
            Array.from({ length: 14 }, (_, i) => `DEMO-26-${String(i + 1).padStart(4, '0')}`)
        );

        const byCode = Object.fromEntries(demo1to14.map(s => [s.labSampleCode, s]));

        // Sample 1: Accepted, waiting for drying, label printed once
        expect(byCode['DEMO-26-0001'].status).toBe('ACCEPTED');
        expect(byCode['DEMO-26-0001'].dryingStatus).toBe('PENDING');
        const s1Prints = await prisma.labelPrintEvent.count({
            where: { sampleId: byCode['DEMO-26-0001'].id }
        });
        expect(s1Prints).toBe(1);

        // Sample 3 & 4: Drying DONE, Preparation PENDING
        expect(byCode['DEMO-26-0003'].dryingStatus).toBe('DONE');
        expect(byCode['DEMO-26-0003'].preparationStatus).toBe('PENDING');
        expect(byCode['DEMO-26-0004'].dryingStatus).toBe('DONE');
        expect(byCode['DEMO-26-0004'].preparationStatus).toBe('PENDING');

        // Sample 5: Prepared + sub-sample containers + unassigned analytical items
        expect(byCode['DEMO-26-0005'].status).toBe('PROCESSING');
        const s5Containers = await prisma.sampleContainer.count({
            where: { sampleId: byCode['DEMO-26-0005'].id }
        });
        expect(s5Containers).toBeGreaterThanOrEqual(2);
        const s5Unassigned = await prisma.workItem.count({
            where: {
                sampleId: byCode['DEMO-26-0005'].id,
                assignedTo: null,
                analysis: { notIn: ['DRYING', 'PREPARATION'] }
            }
        });
        expect(s5Unassigned).toBe(5);

        // Sample 9: Returned Soil pH Try #1 + reassigned open Try #2 in tech1 Workbench
        const s9Ph = await prisma.workItem.findFirst({
            where: { sampleId: byCode['DEMO-26-0009'].id, analysis: 'PH_H2O' }
        });
        expect(s9Ph.status).toBe('ASSIGNED');
        const s9Attempts = await prisma.workAttempt.findMany({
            where: { workItemId: s9Ph.id },
            orderBy: { attemptNo: 'asc' }
        });
        expect(s9Attempts).toHaveLength(2);
        expect(s9Attempts[1].status).toBe('OPEN');

        // Sample 10: Submitted in Review Submissions with 2 Soil pH tries
        expect(byCode['DEMO-26-0010'].status).toBe('SUBMITTED_FULL');
        const s10Ph = await prisma.workItem.findFirst({
            where: { sampleId: byCode['DEMO-26-0010'].id, analysis: 'PH_H2O' }
        });
        const s10Attempts = await prisma.workAttempt.count({
            where: { workItemId: s10Ph.id }
        });
        expect(s10Attempts).toBe(2);

        // Sample 11: Failed Olsen P batch awaiting manager decision
        const failedAnalytes = await prisma.batchAnalyte.findMany({
            where: { labId: DEMO_LAB_ID, analysisCode: 'P_OLSEN', status: 'QC_FAIL' }
        });
        expect(failedAnalytes).toHaveLength(1);

        // Sample 12: All analytical tests ACCEPTED (ready in Final Approvals)
        const s12Analytical = await prisma.workItem.findMany({
            where: {
                sampleId: byCode['DEMO-26-0012'].id,
                analysis: { notIn: ['DRYING', 'PREPARATION'] }
            }
        });
        expect(s12Analytical.length).toBe(10);
        expect(s12Analytical.every(w => w.status === 'ACCEPTED')).toBe(true);

        // Sample 13 & 14: Reports (1 SUPERSEDED, 1 PUBLISHED, 1 WITHDRAWN), 1 share link, 1 PENDING amendment
        const s13Reports = await prisma.report.findMany({
            where: { sampleId: byCode['DEMO-26-0013'].id },
            orderBy: { version: 'asc' }
        });
        expect(s13Reports.map(r => r.status)).toEqual(['SUPERSEDED', 'PUBLISHED']);
        const shareLinks = await prisma.reportShareLink.count({
            where: { reportId: s13Reports[1].id, isRevoked: false }
        });
        expect(shareLinks).toBe(1);
        const pendingAmendments = await prisma.sampleAmendment.count({
            where: { sampleId: byCode['DEMO-26-0013'].id, status: 'PENDING' }
        });
        expect(pendingAmendments).toBe(1);

        const s14Reports = await prisma.report.findMany({
            where: { sampleId: byCode['DEMO-26-0014'].id }
        });
        expect(s14Reports.map(r => r.status)).toEqual(['WITHDRAWN']);

        // 5. Problem records (1 OPEN + 1 CLOSED) & Proficiency Testing rounds (1 SATISFACTORY + 1 QUESTIONABLE)
        const ncrs = await prisma.nonconformityReport.findMany({
            where: { labId: DEMO_LAB_ID }
        });
        expect(ncrs.map(r => r.status).sort()).toEqual(['CLOSED', 'OPEN']);

        const ptRounds = await prisma.proficiencyRound.findMany({
            where: { labId: DEMO_LAB_ID, deletedAt: null }
        });
        expect(ptRounds.map(r => r.outcome).sort()).toEqual(['QUESTIONABLE', 'SATISFACTORY']);

        // 6. Audit trail populated by real workflow transitions
        const auditCount = await prisma.auditLog.count();
        expect(auditCount).toBeGreaterThan(50);

        // 7. Second run on the same database refuses cleanly with DEMO_LAB_ALREADY_EXISTS
        await expect(
            seedDemoLab({
                env: { ...process.env, DEMO_SEED: '1', NODE_ENV: 'test' },
                silent: true
            })
        ).rejects.toMatchObject({ code: 'DEMO_LAB_ALREADY_EXISTS' });
    });

    test('DEMO_SEED_PROFILE=user-test creates only the 1-hour user-test kit setup with no Sample 1 and exactly Samples 2 and 3', async () => {
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'demo-seed-user-test-'));
        const userTestDb = path.join(tempDir, 'user-test.db');
        try {
            const firstRun = runSeedCliWithoutNodeEnv(userTestDb, { DEMO_SEED_PROFILE: 'user-test' });
            expect(firstRun.status).toBe(0);
            expect(firstRun.stdout).toContain('Profile  : user-test');

            const reader = new Database(userTestDb, { readonly: true, fileMustExist: true });
            try {
                // 1. One active Demo Soil Lab
                const labs = reader.prepare('SELECT "id", "name", "isActive" FROM "Lab"').all();
                expect(labs).toEqual([{ id: DEMO_LAB_ID, name: DEMO_LAB_NAME, isActive: 1 }]);

                // 2. Only demo-superadmin + 1 Sample Reception Officer + 1 Laboratory Technician (no superadmin)
                const users = reader
                    .prepare('SELECT "username", "role", "email", "labId", "isActive" FROM "User" ORDER BY "username" ASC')
                    .all();
                expect(users.map(u => ({ username: u.username, role: u.role, labId: u.labId }))).toEqual([
                    { username: DEMO_ADMIN_USERNAME, role: 'SUPER_ADMIN', labId: null },
                    { username: 'reception1', role: 'SAMPLE_RECEPTION', labId: DEMO_LAB_ID },
                    { username: 'tech1', role: 'LAB_TECHNICIAN', labId: DEMO_LAB_ID }
                ]);
                expect(users.every(u => u.isActive === 1 && /@example\.test$/.test(u.email))).toBe(true);

                const invites = reader.prepare('SELECT COUNT(*) AS n FROM "StaffInvitation"').get();
                expect(invites.n).toBe(0);

                // 3. Soil pH method switched on, 1 calibrated pH meter, and 1 active check soil bottle
                const methodDefaults = reader
                    .prepare('SELECT "analysisCode", "methodologyId" FROM "LabMethodDefault" WHERE "labId" = ?')
                    .all(DEMO_LAB_ID);
                expect(methodDefaults).toEqual([
                    { analysisCode: 'PH_H2O', methodologyId: 'ISO_10390_H2O' }
                ]);

                const equipment = reader
                    .prepare(
                        'SELECT a."name", a."assetType", a."status", q."calibrationStatus" FROM "EquipmentAsset" a JOIN "EquipmentQualification" q ON q."equipmentId" = a."id" WHERE a."labId" = ?'
                    )
                    .all(DEMO_LAB_ID);
                expect(equipment).toEqual([
                    {
                        name: 'Bench pH Meter 01',
                        assetType: 'PH_METER',
                        status: 'IN_SERVICE',
                        calibrationStatus: 'OK'
                    }
                ]);

                const checkSoils = reader
                    .prepare('SELECT "id", "code", "status" FROM "ReferenceMaterial" WHERE "labId" = ?')
                    .all(DEMO_LAB_ID);
                expect(checkSoils).toHaveLength(1);
                expect(checkSoils[0]).toMatchObject({ code: 'LRM-DEMO-01', status: 'ACTIVE' });

                const checkValues = reader
                    .prepare('SELECT "analysisCode", "assignedValue" FROM "ReferenceValue" WHERE "referenceMaterialId" = ?')
                    .all(checkSoils[0].id);
                expect(checkValues).toEqual([{ analysisCode: 'PH_H2O', assignedValue: 6.45 }]);

                // 4. NO Sample 1 anywhere, and EXACTLY two samples (Sample 2 and Sample 3)
                const samples = reader
                    .prepare(
                        'SELECT "id", "originalId", "status", "dryingStatus", "preparationStatus" FROM "Sample" ORDER BY "originalId" ASC'
                    )
                    .all();
                expect(samples).toHaveLength(2);
                expect(samples.find(s => s.originalId === 'FIELD-2026-001')).toBeUndefined();
                expect(samples.map(s => s.originalId)).toEqual(['FIELD-2026-002', 'FIELD-2026-003']);

                // Sample 2: checked in as Accepted, waiting for Air Drying
                const s2 = samples[0];
                expect(s2.status).toBe('ACCEPTED');
                expect(s2.dryingStatus).toBe('PENDING');
                expect(s2.preparationStatus).toBe('PENDING');
                const s2Items = reader
                    .prepare('SELECT "analysis", "status", "assignedTo" FROM "WorkItem" WHERE "sampleId" = ?')
                    .all(s2.id);
                const s2ByCode = Object.fromEntries(s2Items.map(w => [w.analysis, w]));
                expect(s2ByCode.DRYING).toMatchObject({ status: 'ASSIGNED', assignedTo: 'tech1' });
                expect(s2ByCode.PH_H2O).toBeTruthy();

                // Sample 3: checked in as Accepted, Air Drying & Sample Preparation finished, Soil pH ordered and assigned to tech1
                const s3 = samples[1];
                expect(s3.dryingStatus).toBe('DONE');
                expect(s3.preparationStatus).toBe('DONE');
                const s3Items = reader
                    .prepare('SELECT "analysis", "status", "assignedTo" FROM "WorkItem" WHERE "sampleId" = ?')
                    .all(s3.id);
                const s3ByCode = Object.fromEntries(s3Items.map(w => [w.analysis, w]));
                expect(Object.keys(s3ByCode).sort()).toEqual(['DRYING', 'PH_H2O', 'PREPARATION']);
                expect(s3ByCode.DRYING.status).toBe('COMPLETED');
                expect(s3ByCode.PREPARATION.status).toBe('COMPLETED');
                expect(s3ByCode.PH_H2O).toEqual({
                    analysis: 'PH_H2O',
                    status: 'ASSIGNED',
                    assignedTo: 'tech1'
                });
            } finally {
                reader.close();
            }

            // 5. Second run refuses with DEMO_LAB_ALREADY_EXISTS and leaves database byte-identical
            const seededBytes = fs.readFileSync(userTestDb);
            const secondRun = runSeedCliWithoutNodeEnv(userTestDb, { DEMO_SEED_PROFILE: 'user-test' });
            expect(secondRun.status).toBe(1);
            expect(secondRun.stderr).toContain('DEMO_LAB_ALREADY_EXISTS');
            expect(Buffer.compare(fs.readFileSync(userTestDb), seededBytes)).toBe(0);
        } finally {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });
});
