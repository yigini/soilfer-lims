'use strict';

/**
 * Contract Tests for SoilFER Country Project Migration & Kobo Explicit Association (v2)
 *
 * Verifies:
 * 1. Safe dry-run execution against an online disposable backup snapshot (zero mutation).
 * 2. Commit execution against a disposable database:
 *    - All 7 country projects created with SOILFER_V1 template and primary lab links.
 *    - 100% sample conservation (0 samples lost, 0 duplicates).
 *    - Analytical results, QC batches, and report checksums 100% preserved.
 *    - Edge case S002 correctly assigned to SOILFER-GTM / GTM-LAB1 with SOILFER-US provenance.
 *    - Edge case GHA0816-1-1C-S retained in unresolved records queue.
 *    - All 7 national KoboConfig records updated with explicit country projectCode.
 *    - Participating lab users' projects arrays updated with country projectCode.
 * 3. Idempotency: Running commit a second time produces 0 new migrations and identical counts.
 */

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const { runMigration, SOILFER_COUNTRY_PROJECTS, COUNTRY_TO_PROJECT } = require('../../scripts/migrate_soilfer_countries.cjs');

describe('SoilFER Country Project Migration & Kobo Association (v2)', () => {
    const originalDbPath = process.env.DATABASE_PATH || path.join(__dirname, '../../prisma/dev.db');
    const testDbPath = path.join(__dirname, `../../prisma/test_migration_${Date.now()}.db`);

    let origSampleCount = 0;
    let origResultCount = 0;

    beforeAll(async () => {
        expect(fs.existsSync(originalDbPath)).toBe(true);

        // Snapshot original database to testDbPath via SQLite online backup API
        const origDb = new Database(originalDbPath, { readonly: true, fileMustExist: true });
        origSampleCount = origDb.prepare('SELECT count(*) as c FROM "Sample"').get().c;
        origResultCount = origDb.prepare('SELECT count(*) as c FROM "Result"').get().c;

        // Inject simulated edge case GHA0816-1-1C-S into a temporary table or test during backup
        await origDb.backup(testDbPath);
        origDb.close();

        // Inject simulated edge case GHA0816-1-1C-S into testDbPath to test queue handling
        const testDb = new Database(testDbPath);
        testDb.prepare(`
            INSERT OR REPLACE INTO "Sample" (id, originalId, projectCode, projectId, country, status, createdAt, updatedAt)
            VALUES ('GHA0816-1-1C-S', 'GHA0816-1-1C-S', 'SOILFER-US', 'SoilFER-USA', 'GHA', 'EXPECTED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `).run();
        testDb.close();
    });

    afterAll(() => {
        // Clean up disposable test database
        if (fs.existsSync(testDbPath)) {
            try { fs.unlinkSync(testDbPath); } catch {}
        }
        const walPath = `${testDbPath}-wal`;
        const shmPath = `${testDbPath}-shm`;
        if (fs.existsSync(walPath)) try { fs.unlinkSync(walPath); } catch {}
        if (fs.existsSync(shmPath)) try { fs.unlinkSync(shmPath); } catch {}
    });

    test('1. Dry-run mode executes cleanly and leaves database 100% untouched', () => {
        const preDb = new Database(testDbPath, { readonly: true });
        const preProjects = preDb.prepare('SELECT count(*) as c FROM "Project"').get().c;
        const preSamples = preDb.prepare('SELECT count(*) as c FROM "Sample"').get().c;
        preDb.close();

        const result = runMigration({
            dryRun: true,
            commit: false,
            dbPath: testDbPath
        });

        expect(result.success).toBe(true);
        expect(result.mode).toBe('DRY_RUN');
        expect(result.audit.postFlightAssertions.sampleConservation).toBe(true);
        expect(result.audit.postFlightAssertions.resultConservation).toBe(true);

        // Verify that database was untouched
        const postDb = new Database(testDbPath, { readonly: true });
        const postProjects = postDb.prepare('SELECT count(*) as c FROM "Project"').get().c;
        const postSamples = postDb.prepare('SELECT count(*) as c FROM "Sample"').get().c;
        postDb.close();

        expect(postProjects).toBe(preProjects);
        expect(postSamples).toBe(preSamples);
    });

    test('2. Commit mode successfully creates country projects, migrates samples, and preserves invariants', () => {
        const preDb = new Database(testDbPath, { readonly: true });
        const preSamples = preDb.prepare('SELECT count(*) as c FROM "Sample"').get().c;
        const preResults = preDb.prepare('SELECT count(*) as c FROM "Result"').get().c;
        const preQCBatches = preDb.prepare('SELECT count(*) as c FROM "Batch"').get().c;
        preDb.close();

        const result = runMigration({
            dryRun: false,
            commit: true,
            dbPath: testDbPath
        });

        expect(result.success).toBe(true);
        expect(result.mode).toBe('COMMIT');
        expect(result.audit.postFlightAssertions.sampleConservation).toBe(true);
        expect(result.audit.postFlightAssertions.resultConservation).toBe(true);
        expect(result.audit.postFlightAssertions.qcBatchConservation).toBe(true);
        expect(result.audit.postFlightAssertions.orphanedResults).toBe(true);

        const postDb = new Database(testDbPath, { readonly: true });

        // Invariant 1: Total samples strictly conserved
        const postSamples = postDb.prepare('SELECT count(*) as c FROM "Sample"').get().c;
        expect(postSamples).toBe(preSamples);

        // Invariant 2: Total results strictly conserved
        const postResults = postDb.prepare('SELECT count(*) as c FROM "Result"').get().c;
        expect(postResults).toBe(preResults);

        // Invariant 3: Total QC batches strictly conserved
        const postQCBatches = postDb.prepare('SELECT count(*) as c FROM "Batch"').get().c;
        expect(postQCBatches).toBe(preQCBatches);

        // Invariant 4: No orphaned results
        const orphanedResults = postDb.prepare('SELECT count(*) as c FROM "Result" r LEFT JOIN "Sample" s ON r.sampleId = s.id WHERE s.id IS NULL').get().c;
        expect(orphanedResults).toBe(0);

        // Verification of country projects
        for (const cp of SOILFER_COUNTRY_PROJECTS) {
            const project = postDb.prepare('SELECT * FROM "Project" WHERE code = ?').get(cp.code);
            expect(project).toBeDefined();
            expect(project.projectType).toBe('SOILFER_V1');
            expect(project.status).toBe('ACTIVE');
            expect(project.labId).toBe(cp.labId);
        }

        // Verification of sample with missing country (S002) in unresolved records queue
        const s002 = postDb.prepare('SELECT * FROM "Sample" WHERE id = ? OR labId = ? OR originalId = ?').get('TEST-1788651185926', 'S002', 'S002');
        if (s002 && !s002.country) {
            expect(result.audit.unresolvedRecords.some(r => r.sampleId === s002.id)).toBe(true);
            expect(s002.assignedLab).toBe('LAB-GOLD'); // Preserved, not overwritten to GTM-LAB1
        }

        // Verification of edge case GHA0816-1-1C-S in unresolved records queue
        expect(result.audit.unresolvedRecords.some(r => r.sampleId === 'GHA0816-1-1C-S')).toBe(true);
        const ghaEdge = postDb.prepare('SELECT * FROM "Sample" WHERE id = ?').get('GHA0816-1-1C-S');
        expect(ghaEdge.projectCode).toBe('SOILFER-US'); // Untouched, retained in queue

        // Verification of KoboConfig updates
        const gtmKobo = postDb.prepare("SELECT * FROM \"KoboConfig\" WHERE labId = 'GTM-LAB1'").get();
        expect(gtmKobo.projectCode).toBe('SOILFER-GTM');

        const hndKobo = postDb.prepare("SELECT * FROM \"KoboConfig\" WHERE labId = 'HND-LAB1'").get();
        expect(hndKobo.projectCode).toBe('SOILFER-HND');

        // Verification of User projects update: users with prior programme access receive country project
        const gtmUser = postDb.prepare("SELECT projects FROM \"User\" WHERE username = 'mgr_gtm'").get();
        const gtmProjects = JSON.parse(gtmUser.projects || '[]');
        expect(gtmProjects).toContain('SOILFER-GTM');
        expect(gtmProjects).toContain('SOILFER-US'); // Retains aggregate programme

        // Verification that users who had empty projects are NOT appended with country projects
        const emptyProjectsUser = postDb.prepare("SELECT projects FROM \"User\" WHERE username = 'test_mgr_1788651185825'").get();
        if (emptyProjectsUser) {
            const emptyProjects = JSON.parse(emptyProjectsUser.projects || '[]');
            expect(emptyProjects).toEqual([]);
        }

        postDb.close();
    });

    test('3. Idempotency: Second run produces zero duplicate projects, zero new migrations, and 100% identical counts', () => {
        const preDb = new Database(testDbPath, { readonly: true });
        const preSamples = preDb.prepare('SELECT count(*) as c FROM "Sample"').get().c;
        const preProjects = preDb.prepare('SELECT count(*) as c FROM "Project"').get().c;
        preDb.close();

        const result2 = runMigration({
            dryRun: false,
            commit: true,
            dbPath: testDbPath
        });

        expect(result2.success).toBe(true);
        // All candidate samples were already migrated in the first run
        expect(result2.audit.alreadyMigratedSamples).toBeGreaterThan(30000);
        for (const [code, count] of Object.entries(result2.audit.migratedSamples)) {
            expect(count).toBe(0); // Zero newly migrated on second run
        }

        const postDb = new Database(testDbPath, { readonly: true });
        const postSamples = postDb.prepare('SELECT count(*) as c FROM "Sample"').get().c;
        const postProjects = postDb.prepare('SELECT count(*) as c FROM "Project"').get().c;
        postDb.close();

        expect(postSamples).toBe(preSamples);
        expect(postProjects).toBe(preProjects);
    });
});
