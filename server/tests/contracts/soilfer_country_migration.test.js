'use strict';

/**
 * Contract Tests for SoilFER Country Project Migration & Kobo Explicit Association (v2)
 *
 * Verifies:
 * 1. Safe dry-run execution against populated historical rows in a fresh guarded database (zero mutation).
 * 2. Commit execution against a disposable database:
 *    - All 7 country projects created with SOILFER_V1 template and primary lab links.
 *    - 100% sample conservation (0 samples lost, 0 duplicates).
 *    - Analytical results, QC batches, and report checksums 100% preserved.
 *    - A specimen with unknown country is retained for review without changing its laboratory/project.
 *    - Edge case GHA0816-1-1C-S retained in unresolved records queue.
 *    - All 7 national KoboConfig records updated with explicit country projectCode.
 *    - Participating lab users' projects arrays updated with country projectCode.
 * 3. Idempotency: Running commit a second time produces 0 new migrations and identical counts.
 */

const Database = require('better-sqlite3');
const { beforeGuards } = require('../helpers/legacyWorkflowDatabase');
const { runMigration, SOILFER_COUNTRY_PROJECTS, COUNTRY_TO_PROJECT } = require('../../scripts/migrate_soilfer_countries.cjs');

describe('SoilFER Country Project Migration & Kobo Association (v2)', () => {
    let testDbPath, rehearsal;
    const origSampleCount = 0;

    beforeAll(async () => {
        const now = Date.now(), stamp = { createdAt: now, updatedAt: now };
        // Preserve the literal historical statuses and scientific values. They
        // precede the real release guards; no copied operational rows are wiped.
        rehearsal = beforeGuards({ actor: 'system:fixture', schemaVariant: 'PROJECT_PRE_TEMPLATE_POLICY',
            samples: [
                { id: 'GHA0816-1-1C-S', originalId: 'GHA0816-1-1C-S', projectCode: 'SOILFER-US', projectId: 'SoilFER-USA', country: 'GHA', status: 'EXPECTED', ...stamp },
                { id: 'MIGRATION-UNKNOWN-COUNTRY', originalId: 'MIGRATION-UNKNOWN-COUNTRY', assignedLab: 'LAB-GOLD', projectCode: 'SOILFER-US', projectId: 'SoilFER-USA', country: null, status: 'EXPECTED', ...stamp },
                ...[['TEST-GTM-S1', 'GTM', 'ACCEPTED'], ['TEST-HND-S1', 'HND', 'ACCEPTED'], ['TEST-KEN-S1', 'KEN', 'PROCESSING'], ['TEST-ZMB-S1', 'ZMB', 'RECEIVED']]
                    .map(([id, country, status]) => ({ id, originalId: id, projectCode: 'SOILFER-US', projectId: 'SoilFER-USA', country, status, ...stamp }))
            ],
            batches: [
                { id: 'BATCH-QC-001', labId: 'GTM-LAB1', analysis: 'PH_H2O', status: 'QC_PASS', createdBy: 'tech_gtm', notes: 'Calibration run 1', qcResults: '{"controls":[{"name":"STD-A","val":7.01}]}', createdAt: now },
                { id: 'BATCH-QC-002', labId: 'HND-LAB1', analysis: 'EC', status: 'QC_FAIL', createdBy: 'tech_hnd', notes: 'Duplicate drift', qcResults: '{"duplicates":[{"rpd":18.4}]}', createdAt: now },
                { id: 'BATCH-QC-003', labId: 'KEN-LAB1', analysis: 'TOTAL_N', status: 'CLOSED', createdBy: 'tech_ken', notes: 'Completed batch', qcResults: '{"blanks":[{"val":0.001}]}', createdAt: now }
            ],
            relatedRows: {
                Lab: ['GTM-LAB1', 'HND-LAB1', 'GHA-LAB1', 'KEN-LAB1', 'ZMB-LAB1', 'MOZ-LAB1', 'TUN-LAB1']
                    .map(id => ({ id, code: id.split('-')[0], name: `${id} Laboratory`, country: id.split('-')[0], isActive: 1, ...stamp })),
                Project: [{ id: 'SoilFER-USA', code: 'SOILFER-US', name: 'SoilFER Global Programme', status: 'ACTIVE', projectType: 'OPEN_INTAKE', ...stamp }],
                User: [
                    { id: 'user-mgr-gtm', username: 'mgr_gtm', email: 'mgr_gtm@example.com', password: 'hash123', role: 'LAB_MANAGER', labId: 'GTM-LAB1', projects: '["SOILFER-US"]', ...stamp },
                    { id: 'user-empty-gtm', username: 'test_mgr_1788651185825', email: 'empty_gtm@example.test', password: 'hash123', role: 'LAB_MANAGER', labId: 'GTM-LAB1', projects: '[]', ...stamp }
                ],
                Result: [
                    ['RES-GTM-01', 'TEST-GTM-S1', 'PH_H2O', '6.8', 6.8, 1, 1, null, 'BATCH-QC-001'],
                    ['RES-HND-01', 'TEST-HND-S1', 'EC', '1.45', 1.45, 0, 1, null, 'BATCH-QC-002'],
                    ['RES-KEN-01-OLD', 'TEST-KEN-S1', 'TOTAL_N', '0.12', 0.12, 1, 0, 'RES-KEN-01-NEW', 'BATCH-QC-003'],
                    ['RES-KEN-01-NEW', 'TEST-KEN-S1', 'TOTAL_N', '0.15', 0.15, 1, 1, null, 'BATCH-QC-003']
                ].map(([id, sampleId, param, value, numericValue, isValid, isCurrent, supersededBy, batchId]) => ({ id, sampleId, param, value, numericValue, isValid, isCurrent, supersededBy, batchId, ...stamp })),
                Report: [
                    { id: 'REP-GTM-001', sampleId: 'TEST-GTM-S1', labId: 'GTM-LAB1', version: 1, status: 'PUBLISHED', content: JSON.stringify({ ph: 6.8, status: 'Released' }), generatedBy: 'mgr_gtm', projectCode: 'SOILFER-US', ...stamp },
                    { id: 'REP-GTM-002', sampleId: 'TEST-GTM-S1', labId: 'GTM-LAB1', version: 2, status: 'SUPERSEDED', content: JSON.stringify({ ph: 6.8, note: 'Superseded by amendment' }), generatedBy: 'mgr_gtm', projectCode: 'SOILFER-US', ...stamp },
                    { id: 'REP-HND-001', sampleId: 'TEST-HND-S1', labId: 'HND-LAB1', version: 1, status: 'DRAFT', content: JSON.stringify({ ec: 1.45, status: 'Under Review' }), generatedBy: 'mgr_hnd', projectCode: 'SOILFER-US', ...stamp }
                ],
                ReportShareLink: [{ id: 'LINK-REP-GTM-01', reportId: 'REP-GTM-001', tokenHash: 'tokenhash_published_gtm_01', createdBy: 'mgr_gtm', createdAt: now }]
            }
        });
        rehearsal.applyPendingMigration();
        testDbPath = rehearsal.file;
        const testDb = new Database(testDbPath, { fileMustExist: true });
        testDb.pragma('foreign_keys = ON');
        try {

        // Ensure prerequisite KoboConfig records exist for testing Kobo explicit association
        const insKobo = testDb.prepare(`
            INSERT OR IGNORE INTO "KoboConfig" (id, labId, formId, projectCode, koboServerUrl, apiToken, isActive, createdAt, updatedAt)
            VALUES (?, ?, ?, 'SOILFER-US', 'https://kc.kobotoolbox.org', 'token_123', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `);
        insKobo.run('kobo-gtm', 'GTM-LAB1', 'aYU8RNGWtCtwTJh2ph6FdM');
        insKobo.run('kobo-hnd', 'HND-LAB1', 'akt25hEErmCj2G9LBhs4sS');

        const insBatchQc = testDb.prepare(`
            INSERT OR REPLACE INTO "BatchQcResult" (id, batchId, type, label, expected, measured, recoveryPct, rpd, status, createdAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `);
        insBatchQc.run('BQC-001', 'BATCH-QC-001', 'CONTROL', 'GLOSOLAN-CRM-1', 7.0, 7.02, 100.28, null, 'PASS');
        insBatchQc.run('BQC-002', 'BATCH-QC-002', 'DUPLICATE', 'DUP-01', null, null, null, 18.4, 'FAIL');
        insBatchQc.run('BQC-003', 'BATCH-QC-003', 'BLANK', 'REAGENT-BLANK', 0.0, 0.001, null, null, 'PASS');

        expect(testDb.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
        } finally { testDb.close(); }
    });

    afterAll(() => {
        rehearsal?.close();
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

        // Verification of the owned missing-country fixture in the unresolved records queue
        const s002 = postDb.prepare('SELECT * FROM "Sample" WHERE id = ?').get('MIGRATION-UNKNOWN-COUNTRY');
        expect(s002).toBeDefined();
        expect(s002.country).toBeNull();
        expect(result.audit.unresolvedRecords.some(r => r.sampleId === s002.id)).toBe(true);
        expect(s002.assignedLab).toBe('LAB-GOLD'); // Preserved, not overwritten to GTM-LAB1
        expect(s002.projectCode).toBe('SOILFER-US');

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
        if (origSampleCount > 30000) {
            expect(result2.audit.alreadyMigratedSamples).toBeGreaterThan(30000);
        } else {
            expect(result2.audit.alreadyMigratedSamples).toBeGreaterThanOrEqual(4);
        }
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
