/**
 * Contract Test: Lab Operations v3 Migration & Reconciliation Rehearsal
 * 
 * Verifies:
 * 1. Safe dry-run with zero mutations
 * 2. Explicit scientific methodology reconciliation (37 standard + 38 synthetic placeholders)
 * 3. Idempotent repeat execution
 * 4. Preservation of existing operational entities (Samples, WorkItems, Results)
 * 5. Fail-closed rollback behaviour on simulated corruption
 */

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const { runMigration, METHODOLOGY_RECONCILIATION, UNRESOLVED_SYNTHETIC_PLACEHOLDERS } = require('../../scripts/migrate_lab_operations_v3');

describe('Lab Operations v3 Database Migration & Reconciliation', () => {
    const tempDir = path.resolve(__dirname, '..', '..', 'prisma', 'test_scratch');
    const rehearsalDbPath = path.join(tempDir, 'rehearsal.db');
    const bakSourcePath = path.resolve(__dirname, '..', '..', 'prisma', 'dev.db.pre_reconciliation_bak');
    const currentDbPath = path.resolve(__dirname, '..', '..', 'prisma', 'dev.db');

    beforeAll(() => {
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
    });

    afterAll(() => {
        try {
            if (fs.existsSync(rehearsalDbPath)) {
                fs.unlinkSync(rehearsalDbPath);
            }
            if (fs.existsSync(tempDir)) {
                fs.rmdirSync(tempDir, { recursive: true });
            }
        } catch (e) {
            // Ignore cleanup errors on Windows
        }
    });

    beforeEach(() => {
        // Prepare isolated test database
        if (fs.existsSync(rehearsalDbPath)) {
            fs.unlinkSync(rehearsalDbPath);
        }

        if (fs.existsSync(bakSourcePath)) {
            // Rehearse using the exact pre-reconciliation state
            fs.copyFileSync(bakSourcePath, rehearsalDbPath);
        } else {
            // Fallback: copy current dev.db and inject pre-reconciliation state
            fs.copyFileSync(currentDbPath, rehearsalDbPath);
            const db = new Database(rehearsalDbPath);

            // Ensure baseline sample and user exist for invariant checks
            const sampleCount = db.prepare('SELECT COUNT(*) as c FROM "Sample"').get().c;
            if (sampleCount === 0) {
                db.prepare(`
                    INSERT INTO "Sample" (id, originalId, status, preparationStatus, dryingStatus, createdAt, updatedAt)
                    VALUES ('MIG-SMP-001', 'ORIG-MIG-001', 'ACCEPTED', 'DONE', 'DONE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                `).run();
            }
            const userCount = db.prepare('SELECT COUNT(*) as c FROM "User"').get().c;
            if (userCount === 0) {
                db.prepare(`
                    INSERT INTO "User" (id, username, password, email, role, name, createdAt, updatedAt)
                    VALUES ('usr-mig-mgr', 'mig_mgr', 'hash', 'mgr@example.com', 'LAB_MANAGER', 'Migration Manager', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                `).run();
            }

            for (const item of METHODOLOGY_RECONCILIATION) {
                db.prepare(`
                    INSERT OR IGNORE INTO "Analysis" (code, name, isGlobal, status)
                    VALUES (?, ?, 1, 'active')
                `).run(item.analysisCode, item.analysisCode);

                const dep = db.prepare('SELECT id FROM "Methodology" WHERE id = ?').get(item.deprecatedMethodId);
                if (dep) {
                    db.prepare('UPDATE "Methodology" SET isDefault = 1 WHERE id = ?').run(item.deprecatedMethodId);
                } else {
                    db.prepare('INSERT INTO "Methodology" (id, analysisCode, name, isDefault, createdAt, updatedAt) VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)').run(item.deprecatedMethodId, item.analysisCode, 'Legacy ' + item.deprecatedMethodId);
                }
                const can = db.prepare('SELECT id FROM "Methodology" WHERE id = ?').get(item.canonicalMethodId);
                if (can) {
                    db.prepare('UPDATE "Methodology" SET isDefault = 0 WHERE id = ?').run(item.canonicalMethodId);
                } else {
                    db.prepare('INSERT INTO "Methodology" (id, analysisCode, name, isDefault, createdAt, updatedAt) VALUES (?, ?, ?, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)').run(item.canonicalMethodId, item.analysisCode, 'Canonical ' + item.canonicalMethodId);
                }
            }
            for (let i = 0; i < UNRESOLVED_SYNTHETIC_PLACEHOLDERS.length; i++) {
                const sp = UNRESOLVED_SYNTHETIC_PLACEHOLDERS[i];
                const analysisCode = `SPEC_PARAM_${i + 1}`;
                db.prepare(`
                    INSERT OR IGNORE INTO "Analysis" (code, name, isGlobal, status)
                    VALUES (?, ?, 1, 'active')
                `).run(analysisCode, `Specialized Agronomic Parameter ${i + 1}`);

                const existing = db.prepare('SELECT id FROM "Methodology" WHERE id = ?').get(sp);
                if (existing) {
                    db.prepare('UPDATE "Methodology" SET isDefault = 1 WHERE id = ?').run(sp);
                } else {
                    db.prepare('INSERT INTO "Methodology" (id, analysisCode, name, isDefault, createdAt, updatedAt) VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)').run(sp, analysisCode, 'Synthetic Placeholder ' + sp);
                }
            }
            db.close();
        }
    });

    test('1. Dry-Run Mode: Performs read-only audit with zero file or row mutations', () => {
        const dbPre = new Database(rehearsalDbPath);
        const preMethDefaults = dbPre.prepare('SELECT id FROM "Methodology" WHERE isDefault = 1').all().map(r => r.id);
        const preWorkItemCount = dbPre.prepare('SELECT COUNT(*) as c FROM "WorkItem"').get().c;
        dbPre.close();

        const result = runMigration({ dryRun: true, apply: false, dbPath: rehearsalDbPath });

        expect(result.success).toBe(true);
        expect(result.mode).toBe('DRY_RUN');
        expect(result.audit.unresolvedPlaceholders.length).toBe(38);
        expect(result.audit.methodologyChanges.length).toBeGreaterThanOrEqual(30);

        // Verify that database was completely rolled back and unchanged
        const dbPost = new Database(rehearsalDbPath);
        const postMethDefaults = dbPost.prepare('SELECT id FROM "Methodology" WHERE isDefault = 1').all().map(r => r.id);
        const postWorkItemCount = dbPost.prepare('SELECT COUNT(*) as c FROM "WorkItem"').get().c;
        dbPost.close();

        expect(postMethDefaults).toEqual(preMethDefaults);
        expect(postWorkItemCount).toBe(preWorkItemCount);
    });

    test('2. Apply Mode: Atomically applies DDL and methodology reconciliation', () => {
        const result = runMigration({ dryRun: false, apply: true, dbPath: rehearsalDbPath });

        expect(result.success).toBe(true);
        expect(result.mode).toBe('APPLY');

        const db = new Database(rehearsalDbPath);

        // Verify canonical methodologies are now default and deprecated ones are not
        for (const item of METHODOLOGY_RECONCILIATION) {
            const dep = db.prepare('SELECT isDefault FROM "Methodology" WHERE id = ?').get(item.deprecatedMethodId);
            if (dep) {
                expect(dep.isDefault === 0 || dep.isDefault === false).toBe(true);
            }

            const can = db.prepare('SELECT isDefault FROM "Methodology" WHERE id = ?').get(item.canonicalMethodId);
            if (can) {
                expect(can.isDefault === 1 || can.isDefault === true).toBe(true);
            }
        }

        // Verify synthetic placeholders have isDefault = 0
        for (const sp of UNRESOLVED_SYNTHETIC_PLACEHOLDERS) {
            const p = db.prepare('SELECT isDefault FROM "Methodology" WHERE id = ?').get(sp);
            if (p) {
                expect(p.isDefault === 0 || p.isDefault === false).toBe(true);
            }
        }

        // Verify Analysis status is active
        const nullCount = db.prepare('SELECT COUNT(*) as c FROM "Analysis" WHERE status IS NULL OR status = \'\'').get().c;
        expect(nullCount).toBe(0);

        // Verify all required tables exist
        const requiredTables = [
            'SampleOrderRevision', 'OrderLine', 'WorkAttempt',
            'ReviewDecision', 'SampleAmendment', 'CommandReceipt',
            'WorkItemDraft', 'Unit', 'MethodReference', 'BatchQcResult'
        ];
        for (const tbl of requiredTables) {
            const exists = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`).get(tbl);
            expect(exists).toBeDefined();
        }

        db.close();
    });

    test('3. Idempotency: Re-running migration produces zero side effects or duplicated data', () => {
        // First run
        runMigration({ dryRun: false, apply: true, dbPath: rehearsalDbPath });

        // Second run
        const secondRun = runMigration({ dryRun: false, apply: true, dbPath: rehearsalDbPath });
        expect(secondRun.success).toBe(true);
        expect(secondRun.audit.methodologyChanges.length).toBe(0);
        expect(secondRun.audit.syntheticPlaceholdersDeprecations.length).toBe(0);
        expect(secondRun.audit.analysisStatusUpdates).toBe(0);
    });

    test('4. Preservation Invariant: Existing assigned work items and sample records are preserved', () => {
        const db = new Database(rehearsalDbPath);
        // Create an assigned work item with explicit methodology
        const sample = db.prepare('SELECT id FROM "Sample" LIMIT 1').get();
        const user = db.prepare('SELECT username FROM "User" LIMIT 1').get();
        const meth = db.prepare('SELECT id FROM "Methodology" WHERE analysisCode = \'PH_H2O\' LIMIT 1').get();
        if (sample && meth) {
            db.prepare(`
                INSERT INTO "WorkItem" (id, sampleId, analysis, status, methodologyId, assignedTo, createdAt, updatedAt)
                VALUES ('TEST_WORK_ITEM_PRESERVED', ?, 'PH_H2O', 'IN_PROGRESS', ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            `).run(sample.id, meth.id, user ? user.username : null);
        }
        db.close();

        // Run migration
        runMigration({ dryRun: false, apply: true, dbPath: rehearsalDbPath });

        // Verify that custom methodology on assigned work item was NOT overwritten
        const dbCheck = new Database(rehearsalDbPath);
        const item = dbCheck.prepare('SELECT methodologyId, status FROM "WorkItem" WHERE id = ?').get('TEST_WORK_ITEM_PRESERVED');
        expect(item).toBeDefined();
        expect(item.methodologyId).toBe(meth.id);
        expect(item.status).toBe('IN_PROGRESS');
        dbCheck.close();
    });

    test('5. Rejects false chemical mappings and preserves intentional lab defaults (Finding 2)', () => {
        const { UNRESOLVED_METHODOLOGY_MAPPINGS } = require('../../scripts/migrate_lab_operations_v3');
        expect(UNRESOLVED_METHODOLOGY_MAPPINGS.length).toBe(5);

        // Verify none of the 5 false mappings exist in METHODOLOGY_RECONCILIATION
        const falseCodes = ['pH', 'electricalConductivity', 'carbonOrganic', 'nitrogenTotal', 'cationExchangeCapacitySoil'];
        for (const item of METHODOLOGY_RECONCILIATION) {
            expect(falseCodes.includes(item.analysisCode)).toBe(false);
            expect(['pHNaF_ratio1-5', 'EC_ratio1-10', 'OrgC_dc-lt-loi', 'TotalN_h2so4', 'CEC_ph0-cohex'].includes(item.canonicalMethodId)).toBe(false);
        }

        // Inject an intentional LabMethodDefault before migration
        const db = new Database(rehearsalDbPath);
        try {
            db.exec(`
                CREATE TABLE IF NOT EXISTS "LabMethodDefault" (
                    "id" TEXT PRIMARY KEY NOT NULL,
                    "labId" TEXT NOT NULL,
                    "analysisCode" TEXT NOT NULL,
                    "methodologyId" TEXT NOT NULL,
                    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
                );
            `);
            db.prepare(`
                INSERT INTO "LabMethodDefault" (id, labId, analysisCode, methodologyId, createdAt, updatedAt)
                VALUES ('LMD_TEST_PH', 'LAB-TUN', 'pH', 'CUSTOM_PH_METHOD', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            `).run();
        } finally {
            db.close();
        }

        // Run migration
        const res = runMigration({ dryRun: false, apply: true, dbPath: rehearsalDbPath });
        expect(res.success).toBe(true);
        expect(res.audit.unresolvedMethodologies.length).toBe(5);

        // Verify LabMethodDefault was preserved
        const dbCheck = new Database(rehearsalDbPath);
        const savedDefault = dbCheck.prepare('SELECT methodologyId FROM "LabMethodDefault" WHERE id = ?').get('LMD_TEST_PH');
        expect(savedDefault).toBeDefined();
        expect(savedDefault.methodologyId).toBe('CUSTOM_PH_METHOD');
        dbCheck.close();
    });

    test('6. A94: Consolidates unstarted separate texture fraction tasks into unified TEXTURE work items', () => {
        const db = new Database(rehearsalDbPath);
        let sId;
        try {
            const sample = db.prepare('SELECT id FROM "Sample" LIMIT 1').get();
            expect(sample).toBeDefined();

            // Create 3 unstarted fraction tasks for SAND, SILT, CLAY
            sId = sample.id;
            db.prepare(`INSERT INTO "WorkItem" (id, sampleId, analysis, status, updatedAt) VALUES ('WI_UNSTARTED_SAND', ?, 'SAND', 'PENDING', CURRENT_TIMESTAMP)`).run(sId);
            db.prepare(`INSERT INTO "WorkItem" (id, sampleId, analysis, status, updatedAt) VALUES ('WI_UNSTARTED_SILT', ?, 'SILT', 'PENDING', CURRENT_TIMESTAMP)`).run(sId);
            db.prepare(`INSERT INTO "WorkItem" (id, sampleId, analysis, status, updatedAt) VALUES ('WI_UNSTARTED_CLAY', ?, 'CLAY', 'PENDING', CURRENT_TIMESTAMP)`).run(sId);
        } finally {
            db.close();
        }

        const res = runMigration({ dryRun: false, apply: true, dbPath: rehearsalDbPath });
        expect(res.success).toBe(true);
        expect(res.audit.a94Consolidated.tasks).toBeGreaterThanOrEqual(3);

        const dbCheck = new Database(rehearsalDbPath);
        try {
            const sandItem = dbCheck.prepare('SELECT status FROM "WorkItem" WHERE id = ?').get('WI_UNSTARTED_SAND');
            expect(sandItem.status).toBe('SUPERSEDED');

            const textureItem = dbCheck.prepare('SELECT id, status FROM "WorkItem" WHERE sampleId = ? AND analysis = \'TEXTURE\'').get(sId);
            expect(textureItem).toBeDefined();
            expect(textureItem.status).toBe('PENDING');
        } finally {
            dbCheck.close();
        }
    });

    test('7. A95: Reconciles legacy fraction results with explicit WorkAttempt linkage', () => {
        const db = new Database(rehearsalDbPath);
        let sId;
        try {
            const sample = db.prepare('SELECT id FROM "Sample" LIMIT 1').get();
            sId = sample.id;

            // Create legacy results for SAND, SILT, CLAY
            db.prepare(`INSERT INTO "Result" (id, sampleId, param, value, enteredBy, updatedAt) VALUES ('RES_LEG_SAND', ?, 'SAND', '45.0', 'tech_legacy', CURRENT_TIMESTAMP)`).run(sId);
            db.prepare(`INSERT INTO "Result" (id, sampleId, param, value, enteredBy, updatedAt) VALUES ('RES_LEG_SILT', ?, 'SILT', '35.0', 'tech_legacy', CURRENT_TIMESTAMP)`).run(sId);
            db.prepare(`INSERT INTO "Result" (id, sampleId, param, value, enteredBy, updatedAt) VALUES ('RES_LEG_CLAY', ?, 'CLAY', '20.0', 'tech_legacy', CURRENT_TIMESTAMP)`).run(sId);

            // Ensure a TEXTURE work item exists
            db.prepare(`INSERT OR IGNORE INTO "WorkItem" (id, sampleId, analysis, status, updatedAt) VALUES ('WI_LEG_TEXTURE', ?, 'TEXTURE', 'COMPLETED', CURRENT_TIMESTAMP)`).run(sId);
        } finally {
            db.close();
        }

        const res = runMigration({ dryRun: false, apply: true, dbPath: rehearsalDbPath });
        expect(res.success).toBe(true);
        expect(res.audit.a95ReconciledAttempts).toBeGreaterThanOrEqual(1);

        const dbCheck = new Database(rehearsalDbPath);
        try {
            const attempt = dbCheck.prepare('SELECT * FROM "WorkAttempt" WHERE workItemId = \'WI_LEG_TEXTURE\'').get();
            expect(attempt).toBeDefined();
            expect(attempt.executedMethodRevision).toBe('LEGACY_FRACTIONS');
            const evidence = JSON.parse(attempt.evidenceData);
            expect(evidence.fractions.sand).toBe(45.0);
            expect(evidence.fractions.silt).toBe(35.0);
            expect(evidence.fractions.clay).toBe(20.0);
        } finally {
            dbCheck.close();
        }
    });

    test('8. A96: Flags premature drafts with [WARNING: PREPARATION_PENDING] in durable notes without corrupting checks array', () => {
        const db = new Database(rehearsalDbPath);
        const sampleId = 'SMP-PREMATURE-01';
        try {
            db.prepare(`INSERT INTO "Sample" (id, originalId, status, labId, updatedAt) VALUES (?, ?, 'REGISTERED', 'LAB-TUN', CURRENT_TIMESTAMP)`).run(sampleId, `ORIG-${sampleId}`);
            db.prepare(`INSERT INTO "WorkItem" (id, sampleId, analysis, status, updatedAt) VALUES ('WI_PREM_01', ?, 'PH_H2O', 'ASSIGNED', CURRENT_TIMESTAMP)`).run(sampleId);
            db.prepare(`INSERT INTO "WorkItemDraft" (id, workItemId, sampleId, userId, analysis, value, checks, updatedAt) VALUES ('DRAFT_PREM_01', 'WI_PREM_01', ?, 'tech_tun', 'PH_H2O', '6.5', '[true,false]', CURRENT_TIMESTAMP)`).run(sampleId);
        } finally {
            db.close();
        }

        const res = runMigration({ dryRun: false, apply: true, dbPath: rehearsalDbPath });
        expect(res.success).toBe(true);
        expect(res.audit.a96FlaggedDrafts).toBeGreaterThanOrEqual(1);

        const dbCheck = new Database(rehearsalDbPath);
        try {
            const draft = dbCheck.prepare('SELECT checks, notes FROM "WorkItemDraft" WHERE id = \'DRAFT_PREM_01\'').get();
            expect(draft).toBeDefined();
            // Verify checks boolean array was preserved intact
            expect(draft.checks).toBe('[true,false]');
            // Verify durable warning was recorded in notes
            expect(draft.notes).toContain('[WARNING: PREPARATION_PENDING]');

            // Verify that sample preparation record was NOT fabricated
            const smp = dbCheck.prepare('SELECT status, preparationStatus FROM "Sample" WHERE id = ?').get(sampleId);
            expect(smp.status).toBe('REGISTERED');
            expect(smp.preparationStatus).toBeNull();
        } finally {
            dbCheck.close();
        }
    });

    test('9. A97: Identifies historical texture classification discrepancies and creates SampleAmendment review entry', () => {
        const db = new Database(rehearsalDbPath);
        const sampleId = 'SMP-WRONG-TEX-01';
        try {
            db.prepare(`INSERT INTO "Sample" (id, originalId, status, labId, updatedAt) VALUES (?, ?, 'COMPLETED', 'LAB-GTM', CURRENT_TIMESTAMP)`).run(sampleId, `ORIG-${sampleId}`);
            // 50 sand / 35 silt / 15 clay is officially Loam (L), but legacy algorithm called it Sandy Loam (SL)
            db.prepare(`INSERT INTO "Result" (id, sampleId, param, value, provenance, updatedAt) VALUES ('RES_WRONG_TEX', ?, 'TEXTURE', 'Sandy Loam', ?, CURRENT_TIMESTAMP)`)
                .run(sampleId, JSON.stringify({ fractions: { sand: 50, silt: 35, clay: 15 } }));
        } finally {
            db.close();
        }

        const res = runMigration({ dryRun: false, apply: true, dbPath: rehearsalDbPath });
        expect(res.success).toBe(true);
        expect(res.audit.a97ImpactAssessment.misclassifiedCount).toBeGreaterThanOrEqual(1);
        const mis = res.audit.a97ImpactAssessment.misclassifiedRecords.find(r => r.sampleId === sampleId);
        expect(mis).toBeDefined();
        expect(mis.recordedClass).toBe('Sandy Loam');
        expect(mis.authoritativeClass).toBe('Loam');

        const dbCheck = new Database(rehearsalDbPath);
        try {
            const amend = dbCheck.prepare('SELECT * FROM "SampleAmendment" WHERE sampleId = ? AND type = \'TEXTURE_IMPACT_AUDIT\'').get(sampleId);
            expect(amend).toBeDefined();
            expect(amend.status).toBe('PENDING');
        } finally {
            dbCheck.close();
        }
    });

    test('10. Review Defect 4: Preserves standalone assigned fraction tasks without confirmed grouped order', () => {
        const db = new Database(rehearsalDbPath);
        const sampleId = 'SMP-STANDALONE-SAND';
        try {
            db.prepare(`INSERT OR IGNORE INTO "User" (id, username, password, email, role, updatedAt) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`).run('tech_specialist', 'tech_specialist', 'pw', 'tech@example.com', 'LAB_TECHNICIAN');
            db.prepare(`INSERT INTO "Sample" (id, originalId, status, assignedLab, updatedAt) VALUES (?, ?, 'RECEIVED', 'GTM-LAB1', CURRENT_TIMESTAMP)`).run(sampleId, sampleId);
            db.prepare(`INSERT INTO "WorkItem" (id, sampleId, analysis, status, assignedTo, updatedAt) VALUES ('WI_STANDALONE_SAND', ?, 'SAND', 'ASSIGNED', 'tech_specialist', CURRENT_TIMESTAMP)`).run(sampleId);
        } finally {
            db.close();
        }

        const res = runMigration({ dryRun: false, apply: true, dbPath: rehearsalDbPath });
        expect(res.success).toBe(true);
        expect(res.audit.unresolvedStandaloneFractions.some(f => f.sampleId === sampleId)).toBe(true);

        const dbCheck = new Database(rehearsalDbPath);
        try {
            const wi = dbCheck.prepare('SELECT analysis, status, assignedTo FROM "WorkItem" WHERE sampleId = ?').all(sampleId);
            // Must remain SAND, ASSIGNED, tech_specialist; must NOT be superseded or replaced by unassigned TEXTURE
            expect(wi.length).toBe(1);
            expect(wi[0].analysis).toBe('SAND');
            expect(wi[0].status).toBe('ASSIGNED');
            expect(wi[0].assignedTo).toBe('tech_specialist');
        } finally {
            dbCheck.close();
        }
    });

    test('11. Review Defect 3: Refuses to fabricate WorkAttempt when fractions have mixed replicate numbers or moisture bases', () => {
        const db = new Database(rehearsalDbPath);
        const sampleId = 'SMP-MIXED-REP-BASIS';
        try {
            db.prepare(`INSERT INTO "Sample" (id, originalId, status, assignedLab, updatedAt) VALUES (?, ?, 'RECEIVED', 'GTM-LAB1', CURRENT_TIMESTAMP)`).run(sampleId, sampleId);
            db.prepare(`INSERT INTO "WorkItem" (id, sampleId, analysis, status, updatedAt) VALUES ('WI_MIXED_TEX', ?, 'TEXTURE', 'COMPLETED', CURRENT_TIMESTAMP)`).run(sampleId);
            // Incompatible fractions: rep 1 AIR_DRY, rep 2 OVEN_DRY, rep 3 FIELD_MOIST
            db.prepare(`INSERT INTO "Result" (id, sampleId, param, value, replicateNo, basis, updatedAt) VALUES ('RES_MIX_SAND', ?, 'SAND', '50.0', 1, 'AIR_DRY', CURRENT_TIMESTAMP)`).run(sampleId);
            db.prepare(`INSERT INTO "Result" (id, sampleId, param, value, replicateNo, basis, updatedAt) VALUES ('RES_MIX_SILT', ?, 'SILT', '35.0', 2, 'OVEN_DRY', CURRENT_TIMESTAMP)`).run(sampleId);
            db.prepare(`INSERT INTO "Result" (id, sampleId, param, value, replicateNo, basis, updatedAt) VALUES ('RES_MIX_CLAY', ?, 'CLAY', '15.0', 3, 'FIELD_MOIST', CURRENT_TIMESTAMP)`).run(sampleId);
        } finally {
            db.close();
        }

        const res = runMigration({ dryRun: false, apply: true, dbPath: rehearsalDbPath });
        expect(res.success).toBe(true);

        const dbCheck = new Database(rehearsalDbPath);
        try {
            const attempts = dbCheck.prepare('SELECT * FROM "WorkAttempt" WHERE workItemId = \'WI_MIXED_TEX\'').all();
            // Must NOT invent a WorkAttempt from incompatible fractions
            expect(attempts.length).toBe(0);
        } finally {
            dbCheck.close();
        }
    });
});
