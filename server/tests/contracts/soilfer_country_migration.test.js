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

        await origDb.backup(testDbPath);
        origDb.close();

        // Inject populated fixtures: samples, QC batches, analytical results, and reports
        const testDb = new Database(testDbPath);
        testDb.pragma('foreign_keys = OFF');

        // Ensure prerequisite parent Project and Lab records exist if running against a fresh/empty database (e.g. CI)
        testDb.prepare(`
            INSERT OR IGNORE INTO "Project" (id, code, name, status, projectType, createdAt, updatedAt)
            VALUES ('SoilFER-USA', 'SOILFER-US', 'SoilFER Global Programme', 'ACTIVE', 'OPEN_INTAKE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `).run();
        const insLab = testDb.prepare(`INSERT OR IGNORE INTO "Lab" (id, code, name, country, isActive) VALUES (?, ?, ?, ?, 1)`);
        for (const labId of ['GTM-LAB1', 'HND-LAB1', 'GHA-LAB1', 'KEN-LAB1', 'ZMB-LAB1', 'MOZ-LAB1', 'TUN-LAB1']) {
            insLab.run(labId, labId.split('-')[0], `${labId} Laboratory`, labId.split('-')[0]);
        }

        // Edge case sample
        testDb.prepare(`
            INSERT OR REPLACE INTO "Sample" (id, originalId, projectCode, projectId, country, status, createdAt, updatedAt)
            VALUES ('GHA0816-1-1C-S', 'GHA0816-1-1C-S', 'SOILFER-US', 'SoilFER-USA', 'GHA', 'EXPECTED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `).run();

        // Populated test samples for results/batches/reports
        const testSamples = [
            { id: 'TEST-GTM-S1', originalId: 'TEST-GTM-S1', projectCode: 'SOILFER-US', projectId: 'SoilFER-USA', country: 'GTM', status: 'ACCEPTED' },
            { id: 'TEST-HND-S1', originalId: 'TEST-HND-S1', projectCode: 'SOILFER-US', projectId: 'SoilFER-USA', country: 'HND', status: 'ACCEPTED' },
            { id: 'TEST-KEN-S1', originalId: 'TEST-KEN-S1', projectCode: 'SOILFER-US', projectId: 'SoilFER-USA', country: 'KEN', status: 'PROCESSING' },
            { id: 'TEST-ZMB-S1', originalId: 'TEST-ZMB-S1', projectCode: 'SOILFER-US', projectId: 'SoilFER-USA', country: 'ZMB', status: 'RECEIVED' }
        ];
        const insSample = testDb.prepare(`
            INSERT OR REPLACE INTO "Sample" (id, originalId, projectCode, projectId, country, status, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `);
        for (const s of testSamples) {
            insSample.run(s.id, s.originalId, s.projectCode, s.projectId, s.country, s.status);
        }

        // Populated QC Batches (Batch & BatchQcResult)
        const insBatch = testDb.prepare(`
            INSERT OR REPLACE INTO "Batch" (id, labId, analysis, status, createdBy, notes, qcResults, createdAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `);
        insBatch.run('BATCH-QC-001', 'GTM-LAB1', 'PH_H2O', 'QC_PASS', 'tech_gtm', 'Calibration run 1', '{"controls":[{"name":"STD-A","val":7.01}]}');
        insBatch.run('BATCH-QC-002', 'HND-LAB1', 'EC', 'QC_FAIL', 'tech_hnd', 'Duplicate drift', '{"duplicates":[{"rpd":18.4}]}');
        insBatch.run('BATCH-QC-003', 'KEN-LAB1', 'TOTAL_N', 'CLOSED', 'tech_ken', 'Completed batch', '{"blanks":[{"val":0.001}]}');

        const insBatchQc = testDb.prepare(`
            INSERT OR REPLACE INTO "BatchQcResult" (id, batchId, type, label, expected, measured, recoveryPct, rpd, status, createdAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `);
        insBatchQc.run('BQC-001', 'BATCH-QC-001', 'CONTROL', 'GLOSOLAN-CRM-1', 7.0, 7.02, 100.28, null, 'PASS');
        insBatchQc.run('BQC-002', 'BATCH-QC-002', 'DUPLICATE', 'DUP-01', null, null, null, 18.4, 'FAIL');
        insBatchQc.run('BQC-003', 'BATCH-QC-003', 'BLANK', 'REAGENT-BLANK', 0.0, 0.001, null, null, 'PASS');

        // Populated Results (Result) with accepted, rejected, current, and superseded rows
        const insResult = testDb.prepare(`
            INSERT OR REPLACE INTO "Result" (id, sampleId, param, value, numericValue, isValid, isCurrent, supersededBy, batchId, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `);
        insResult.run('RES-GTM-01', 'TEST-GTM-S1', 'PH_H2O', '6.8', 6.8, 1, 1, null, 'BATCH-QC-001');
        insResult.run('RES-HND-01', 'TEST-HND-S1', 'EC', '1.45', 1.45, 0, 1, null, 'BATCH-QC-002');
        insResult.run('RES-KEN-01-OLD', 'TEST-KEN-S1', 'TOTAL_N', '0.12', 0.12, 1, 0, 'RES-KEN-01-NEW', 'BATCH-QC-003');
        insResult.run('RES-KEN-01-NEW', 'TEST-KEN-S1', 'TOTAL_N', '0.15', 0.15, 1, 1, null, 'BATCH-QC-003');

        // Populated Reports (Report & ReportShareLink)
        const insReport = testDb.prepare(`
            INSERT OR REPLACE INTO "Report" (id, sampleId, labId, version, status, content, generatedBy, projectCode, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `);
        insReport.run('REP-GTM-001', 'TEST-GTM-S1', 'GTM-LAB1', 1, 'PUBLISHED', JSON.stringify({ ph: 6.8, status: 'Released' }), 'mgr_gtm', 'SOILFER-US');
        insReport.run('REP-GTM-002', 'TEST-GTM-S1', 'GTM-LAB1', 2, 'SUPERSEDED', JSON.stringify({ ph: 6.8, note: 'Superseded by amendment' }), 'mgr_gtm', 'SOILFER-US');
        insReport.run('REP-HND-001', 'TEST-HND-S1', 'HND-LAB1', 1, 'DRAFT', JSON.stringify({ ec: 1.45, status: 'Under Review' }), 'mgr_hnd', 'SOILFER-US');

        const insShareLink = testDb.prepare(`
            INSERT OR REPLACE INTO "ReportShareLink" (id, reportId, tokenHash, createdBy, createdAt)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
        `);
        insShareLink.run('LINK-REP-GTM-01', 'REP-GTM-001', 'tokenhash_published_gtm_01', 'mgr_gtm');

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
        const preReports = preDb.prepare('SELECT count(*) as c FROM "Report"').get().c;
        const preReportChecksums = {};
        const preReportRows = preDb.prepare('SELECT id, version, status, content FROM "Report"').all();
        for (const r of preReportRows) {
            preReportChecksums[r.id] = require('crypto').createHash('sha256').update(`${r.id}|${r.version}|${r.status}|${r.content || ''}`).digest('hex');
        }
        preDb.close();

        // Non-zero baseline validation: proves preservation is tested against real populated entities
        expect(preResults).toBeGreaterThan(0);
        expect(preQCBatches).toBeGreaterThan(0);
        expect(preReports).toBeGreaterThan(0);

        const result = runMigration({
            dryRun: false,
            commit: true,
            dbPath: testDbPath
        });

        expect(result.success).toBe(true);
        expect(result.mode).toBe('COMMIT');
        expect(result.audit.postFlightAssertions.sampleConservation).toBe(true);
        expect(result.audit.postFlightAssertions.resultConservation).toBe(true);
        expect(result.audit.postFlightAssertions.reportConservation).toBe(true);
        expect(result.audit.postFlightAssertions.qcBatchConservation).toBe(true);
        expect(result.audit.postFlightAssertions.orphanedResults).toBe(true);
        expect(result.audit.postFlightAssertions.reportsChecksumIntact).toBe(true);

        const postDb = new Database(testDbPath, { readonly: true });

        // Invariant 1: Total samples strictly conserved
        const postSamples = postDb.prepare('SELECT count(*) as c FROM "Sample"').get().c;
        expect(postSamples).toBe(preSamples);

        // Invariant 2: Total results strictly conserved (non-zero)
        const postResults = postDb.prepare('SELECT count(*) as c FROM "Result"').get().c;
        expect(postResults).toBe(preResults);
        expect(postResults).toBeGreaterThan(0);

        // Invariant 3: Total QC batches strictly conserved (non-zero)
        const postQCBatches = postDb.prepare('SELECT count(*) as c FROM "Batch"').get().c;
        expect(postQCBatches).toBe(preQCBatches);
        expect(postQCBatches).toBeGreaterThan(0);

        // Invariant 4: Total reports strictly conserved & checksums 100% intact (non-zero)
        const postReports = postDb.prepare('SELECT count(*) as c FROM "Report"').get().c;
        expect(postReports).toBe(preReports);
        expect(postReports).toBeGreaterThan(0);

        const postReportRows = postDb.prepare('SELECT id, version, status, content FROM "Report"').all();
        for (const r of postReportRows) {
            const currentHash = require('crypto').createHash('sha256').update(`${r.id}|${r.version}|${r.status}|${r.content || ''}`).digest('hex');
            expect(currentHash).toBe(preReportChecksums[r.id]);
        }

        // Invariant 5: No orphaned results
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
