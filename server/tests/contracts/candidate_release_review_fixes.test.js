const request = require('supertest');
const app = require('../../app');
const { getAuthToken } = require('../setup');
const prisma = require('../../prisma');
const projectPolicyService = require('../../services/projectPolicyService');
const { migrateProjectTemplatesAndPolicy } = require('../../scripts/migrate_project_templates_and_policy');
const Database = require('better-sqlite3');

describe('Candidate Release Review Remediation (R1 - R5)', () => {
    // ═════════════════════════════════════════════════════════════════════════
    // R1: Report Search Ignores Country/Project Scope
    // ═════════════════════════════════════════════════════════════════════════
    describe('R1: Report Search & Detail Scoping Contract', () => {
        let nationalTokenGtm, projectTokenA, techTokenA, noScopeToken, superAdminToken;
        const labAId = 'LAB-R1-GTM';
        const labBId = 'LAB-R1-KEN';
        const prjACode = 'PRJ-R1-ALPHA';
        const prjBCode = 'PRJ-R1-BETA';

        let sampleA, sampleB;
        let reportAPub, reportASup, reportBPub;

        beforeAll(async () => {
            const ts = Date.now();
            await prisma.lab.upsert({
                where: { id: labAId },
                update: { country: 'GTM' },
                create: { id: labAId, code: 'R1GTM', name: 'R1 Guatemala Lab', country: 'GTM' }
            });
            await prisma.lab.upsert({
                where: { id: labBId },
                update: { country: 'KEN' },
                create: { id: labBId, code: 'R1KEN', name: 'R1 Kenya Lab', country: 'KEN' }
            });

            await prisma.project.upsert({
                where: { code: prjACode },
                update: { name: 'R1 Alpha Project', status: 'ACTIVE' },
                create: { id: `PRJ-R1-A-${ts}`, code: prjACode, name: 'R1 Alpha Project', status: 'ACTIVE' }
            });
            await prisma.project.upsert({
                where: { code: prjBCode },
                update: { name: 'R1 Beta Project', status: 'ACTIVE' },
                create: { id: `PRJ-R1-B-${ts}`, code: prjBCode, name: 'R1 Beta Project', status: 'ACTIVE' }
            });

            // Sample A: Guatemala, Lab A, Project Alpha
            sampleA = await prisma.sample.create({
                data: {
                    id: `SMP-R1-A-${ts}`,
                    labId: `LAB-R1-A-${ts}`,
                    originalId: `FIELD-R1-A-${ts}`,
                    assignedLab: labAId,
                    country: 'GTM',
                    countryName: 'Guatemala',
                    status: 'APPROVED',
                    projectCode: prjACode
                }
            });

            // Sample B: Kenya, Lab B, Project Beta
            sampleB = await prisma.sample.create({
                data: {
                    id: `SMP-R1-B-${ts}`,
                    labId: `LAB-R1-B-${ts}`,
                    originalId: `FIELD-R1-B-${ts}`,
                    assignedLab: labBId,
                    country: 'KEN',
                    countryName: 'Kenya',
                    status: 'APPROVED',
                    projectCode: prjBCode
                }
            });

            // Reports for Sample A (Guatemala)
            reportASup = await prisma.report.create({
                data: {
                    id: `RPT-R1-A-V1-${ts}`,
                    sampleId: sampleA.id,
                    labId: labAId,
                    version: 1,
                    status: 'SUPERSEDED',
                    projectCode: prjACode,
                    sampleLabId: sampleA.labId,
                    generatedBy: 'r1_test'
                }
            });
            reportAPub = await prisma.report.create({
                data: {
                    id: `RPT-R1-A-V2-${ts}`,
                    sampleId: sampleA.id,
                    labId: labAId,
                    version: 2,
                    status: 'PUBLISHED',
                    projectCode: prjACode,
                    sampleLabId: sampleA.labId,
                    generatedBy: 'r1_test'
                }
            });

            // Report for Sample B (Kenya)
            reportBPub = await prisma.report.create({
                data: {
                    id: `RPT-R1-B-V1-${ts}`,
                    sampleId: sampleB.id,
                    labId: labBId,
                    version: 1,
                    status: 'PUBLISHED',
                    projectCode: prjBCode,
                    sampleLabId: sampleB.labId,
                    generatedBy: 'r1_test'
                }
            });

            // Tokens
            superAdminToken = await getAuthToken('SUPER_ADMIN', null, ['*'], ['*']);
            nationalTokenGtm = await getAuthToken('MASTER_USER', null, ['GTM'], []);
            projectTokenA = await getAuthToken('PROJECT_MANAGER', null, [], [prjACode]);
            techTokenA = await getAuthToken('LAB_TECHNICIAN', labAId, ['GTM'], []);
            noScopeToken = await getAuthToken('LAB_TECHNICIAN', null, [], []);
        });

        test('National user (GTM) receives only GTM reports in search; out-of-scope Kenyan report excluded', async () => {
            const res = await request(app)
                .get('/api/reports/search')
                .set('Authorization', `Bearer ${nationalTokenGtm}`);

            expect(res.status).toBe(200);
            const reportIds = res.body.reports.map(r => r.id);
            expect(reportIds).toContain(reportAPub.id);
            expect(reportIds).not.toContain(reportBPub.id);
        });

        test('National user (GTM) receives 403 on single report detail for out-of-scope Kenyan report', async () => {
            const res = await request(app)
                .get(`/api/reports/${reportBPub.id}`)
                .set('Authorization', `Bearer ${nationalTokenGtm}`);

            expect(res.status).toBe(403);
            expect(res.body.error).toMatch(/scope/i);
        });

        test('Project manager (Alpha) receives only Project Alpha reports; Beta report excluded', async () => {
            const res = await request(app)
                .get('/api/reports/search')
                .set('Authorization', `Bearer ${projectTokenA}`);

            expect(res.status).toBe(200);
            const reportIds = res.body.reports.map(r => r.id);
            expect(reportIds).toContain(reportAPub.id);
            expect(reportIds).not.toContain(reportBPub.id);
        });

        test('User with no authorized scope receives 0 reports (fail-closed)', async () => {
            const res = await request(app)
                .get('/api/reports/search')
                .set('Authorization', `Bearer ${noScopeToken}`);

            expect(res.status).toBe(200);
            expect(res.body.reports).toEqual([]);
            expect(res.body.pagination.total).toBe(0);
        });

        test('Searching with status=ALL preserves superseded reports within authorized scope without leaking other scopes', async () => {
            const res = await request(app)
                .get('/api/reports/search')
                .query({ status: 'ALL' })
                .set('Authorization', `Bearer ${nationalTokenGtm}`);

            expect(res.status).toBe(200);
            const reportIds = res.body.reports.map(r => r.id);
            expect(reportIds).toContain(reportASup.id);
            expect(reportIds).toContain(reportAPub.id);
            expect(reportIds).not.toContain(reportBPub.id); // Kenyan report still excluded
        });
    });

    // ═════════════════════════════════════════════════════════════════════════
    // R2: Ordinary Workbench Queue Bypasses Deep-Link Scope
    // ═════════════════════════════════════════════════════════════════════════
    describe('R2: Workbench Queue & Stale Assignment Isolation Contract', () => {
        let techTokenA, techTokenB;
        const labAId = 'LAB-R2-A';
        const labBId = 'LAB-R2-B';
        let sampleA, sampleB, crossLabItem, localItem;

        beforeAll(async () => {
            const ts = Date.now();
            await prisma.lab.upsert({
                where: { id: labAId },
                update: { country: 'GTM' },
                create: { id: labAId, code: 'R2A', name: 'R2 Lab A', country: 'GTM' }
            });
            await prisma.lab.upsert({
                where: { id: labBId },
                update: { country: 'GTM' },
                create: { id: labBId, code: 'R2B', name: 'R2 Lab B', country: 'GTM' }
            });

            await prisma.analysis.upsert({
                where: { code: 'R2_PH' },
                update: { name: 'R2 pH Analysis', units: 'pH', status: 'active' },
                create: { code: 'R2_PH', name: 'R2 pH Analysis', units: 'pH', status: 'active' }
            });

            techTokenA = await getAuthToken('LAB_TECHNICIAN', labAId, ['GTM'], []);
            techTokenB = await getAuthToken('LAB_TECHNICIAN', labBId, ['GTM'], []);

            // Decode username for tech A
            const jwt = require('jsonwebtoken');
            const decodedA = jwt.decode(techTokenA);
            const usernameA = decodedA.username;

            sampleA = await prisma.sample.create({
                data: {
                    id: `SMP-R2-A-${ts}`,
                    labId: `LAB-R2-A-${ts}`,
                    originalId: `FIELD-R2-A-${ts}`,
                    assignedLab: labAId,
                    status: 'ACCEPTED',
                    dryingStatus: 'DONE',
                    preparationStatus: 'DONE',
                    projectCode: 'PRJ-R2'
                }
            });

            sampleB = await prisma.sample.create({
                data: {
                    id: `SMP-R2-B-${ts}`,
                    labId: `LAB-R2-B-${ts}`,
                    originalId: `FIELD-R2-B-${ts}`,
                    assignedLab: labBId,
                    status: 'ACCEPTED',
                    dryingStatus: 'DONE',
                    preparationStatus: 'DONE',
                    projectCode: 'PRJ-R2'
                }
            });

            // Local work item for tech A in Lab A
            localItem = await prisma.workItem.create({
                data: {
                    id: `WI-R2-LOCAL-${ts}`,
                    sampleId: sampleA.id,
                    analysis: 'R2_PH',
                    status: 'ASSIGNED',
                    assignedTo: usernameA,
                    labId: labAId
                }
            });

            // Stale cross-lab assignment: assignedTo is tech A, but work item and sample are in Lab B
            crossLabItem = await prisma.workItem.create({
                data: {
                    id: `WI-R2-CROSS-${ts}`,
                    sampleId: sampleB.id,
                    analysis: 'R2_PH',
                    status: 'ASSIGNED',
                    assignedTo: usernameA,
                    labId: labBId
                }
            });
        });

        test('Ordinary GET /api/workbench/queue excludes stale cross-lab work item', async () => {
            const res = await request(app)
                .get('/api/workbench/queue')
                .set('Authorization', `Bearer ${techTokenA}`);

            expect(res.status).toBe(200);
            const allItems = (res.body.groups || []).flatMap(g => g.items || []).map(i => i.id);
            expect(allItems).toContain(localItem.id);
            expect(allItems).not.toContain(crossLabItem.id);
        });

        test('Deep link GET /api/workbench/queue?workItemId=... denies cross-lab item with 403', async () => {
            const res = await request(app)
                .get(`/api/workbench/queue?workItemId=${crossLabItem.id}`)
                .set('Authorization', `Bearer ${techTokenA}`);

            expect(res.status).toBe(403);
            expect(res.body.error).toBe('FORBIDDEN');
        });

        test('Queue tab counts do not include stale cross-lab items', async () => {
            const res = await request(app)
                .get('/api/workbench/queue')
                .set('Authorization', `Bearer ${techTokenA}`);

            expect(res.status).toBe(200);
            // myWorkCount must count only localItem, not crossLabItem
            expect(res.body.stats.myWorkCount).toBe(1);
        });
    });

    // ═════════════════════════════════════════════════════════════════════════
    // R3: QC Reanalysis Transitions Completed-Unsubmitted Work
    // ═════════════════════════════════════════════════════════════════════════
    describe('R3: QC Reanalysis Workflow for Completed Work Contract', () => {
        let mgrToken;
        const labId = 'LAB-R3';
        let batchId;
        let wiCompleted, wiAccepted, wiReleasedSample;

        beforeAll(async () => {
            const ts = Date.now();
            await prisma.lab.upsert({
                where: { id: labId },
                update: { country: 'GTM' },
                create: { id: labId, code: 'R3LAB', name: 'R3 Lab', country: 'GTM' }
            });

            mgrToken = await getAuthToken('LAB_MANAGER', labId, ['GTM'], []);

            await prisma.analysis.upsert({
                where: { code: 'R3_PH' },
                update: { name: 'R3 pH', units: 'pH', status: 'active' },
                create: { code: 'R3_PH', name: 'R3 pH', units: 'pH', status: 'active' }
            });

            const normalSample = await prisma.sample.create({
                data: {
                    id: `SMP-R3-NORM-${ts}`,
                    originalId: `FIELD-R3-NORM-${ts}`,
                    assignedLab: labId,
                    status: 'ACCEPTED',
                    dryingStatus: 'DONE',
                    preparationStatus: 'DONE',
                    projectCode: 'PRJ-R3'
                }
            });

            const releasedSample = await prisma.sample.create({
                data: {
                    id: `SMP-R3-REL-${ts}`,
                    originalId: `FIELD-R3-REL-${ts}`,
                    assignedLab: labId,
                    status: 'RELEASED',
                    dryingStatus: 'DONE',
                    preparationStatus: 'DONE',
                    projectCode: 'PRJ-R3'
                }
            });

            batchId = `BATCH-R3-${ts}`;
            await prisma.batch.create({
                data: {
                    id: batchId,
                    labId: labId,
                    analysis: 'R3_PH',
                    status: 'QC_FAIL',
                    createdBy: 'r3_tester'
                }
            });

            // Completed but unsubmitted work item
            wiCompleted = await prisma.workItem.create({
                data: {
                    id: `WI-R3-COMP-${ts}`,
                    sampleId: normalSample.id,
                    analysis: 'R3_PH',
                    status: 'COMPLETED',
                    batchId: batchId,
                    labId: labId
                }
            });

            // Already ACCEPTED work item
            wiAccepted = await prisma.workItem.create({
                data: {
                    id: `WI-R3-ACC-${ts}`,
                    sampleId: normalSample.id,
                    analysis: 'R3_PH',
                    status: 'ACCEPTED',
                    batchId: batchId,
                    labId: labId
                }
            });

            // Work item on a RELEASED sample
            wiReleasedSample = await prisma.workItem.create({
                data: {
                    id: `WI-R3-RELSMP-${ts}`,
                    sampleId: releasedSample.id,
                    analysis: 'R3_PH',
                    status: 'COMPLETED',
                    batchId: batchId,
                    labId: labId
                }
            });
        });

        test('REANALYZE_BATCH transitions completed-unsubmitted work to REANALYSIS_REQUIRED while preserving immutable history', async () => {
            const res = await request(app)
                .post(`/api/qc/batches/${batchId}/disposition`)
                .set('Authorization', `Bearer ${mgrToken}`)
                .send({
                    decision: 'REANALYZE_BATCH',
                    reason: 'Control standard outside tolerance'
                });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);

            // Completed unsubmitted item MUST have transitioned
            const updatedComp = await prisma.workItem.findUnique({ where: { id: wiCompleted.id } });
            expect(updatedComp.status).toBe('REANALYSIS_REQUIRED');
            expect(updatedComp.reanalysisReason).toBe('Control standard outside tolerance');

            // Accepted item must NOT have changed
            const updatedAcc = await prisma.workItem.findUnique({ where: { id: wiAccepted.id } });
            expect(updatedAcc.status).toBe('ACCEPTED');

            // Item on released sample must NOT have changed
            const updatedRelSmp = await prisma.workItem.findUnique({ where: { id: wiReleasedSample.id } });
            expect(updatedRelSmp.status).toBe('COMPLETED');
        });

        test('Repeated REANALYZE_BATCH request with same decision and reason is strictly idempotent', async () => {
            const res = await request(app)
                .post(`/api/qc/batches/${batchId}/disposition`)
                .set('Authorization', `Bearer ${mgrToken}`)
                .send({
                    decision: 'REANALYZE_BATCH',
                    reason: 'Control standard outside tolerance'
                });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.idempotent).toBe(true);

            // Conflicting disposition on already-dispositioned batch fails closed with 409
            const conflictRes = await request(app)
                .post(`/api/qc/batches/${batchId}/disposition`)
                .set('Authorization', `Bearer ${mgrToken}`)
                .send({
                    decision: 'REJECT_BATCH',
                    reason: 'Conflicting disposition attempt'
                });

            expect(conflictRes.status).toBe(409);
            expect(conflictRes.body.error).toBe('DISPOSITION_CONFLICT');
        });
    });

    // ═════════════════════════════════════════════════════════════════════════
    // R4: Precedence of Exception Requirements over Channel Whitelist
    // ═════════════════════════════════════════════════════════════════════════
    describe('R4: Exception Precedence & Channel Policy Contract', () => {
        let receptionToken;
        const labId = 'LAB-R4';
        const prjCode = 'PRJ-R4-EX';

        beforeAll(async () => {
            const ts = Date.now();
            await prisma.lab.upsert({
                where: { id: labId },
                update: { country: 'GTM' },
                create: { id: labId, code: 'R4LAB', name: 'R4 Lab', country: 'GTM' }
            });

            await prisma.project.upsert({
                where: { code: prjCode },
                update: {
                    name: 'R4 Policy Project',
                    status: 'ACTIVE',
                    templateId: 'GENERIC_OPEN_INTAKE',
                    policyConfig: JSON.stringify({
                        allowedChannels: ['DESK'],
                        requiresExceptionForDesk: true,
                        allowDirectRegistration: false
                    })
                },
                create: {
                    id: `PRJ-R4-${ts}`,
                    code: prjCode,
                    name: 'R4 Policy Project',
                    status: 'ACTIVE',
                    templateId: 'GENERIC_OPEN_INTAKE',
                    policyConfig: JSON.stringify({
                        allowedChannels: ['DESK'],
                        requiresExceptionForDesk: true,
                        allowDirectRegistration: false
                    })
                }
            });

            receptionToken = await getAuthToken('SAMPLE_RECEPTION', labId, ['GTM'], ['RECEIVE_SAMPLE']);
        });

        test('Service check: canAdmitSample enforces requiresExceptionForDesk=true even when channel in allowedChannels', () => {
            const result = projectPolicyService.canAdmitSample({
                project: {
                    id: 'TEST-P',
                    code: 'TEST-P',
                    status: 'ACTIVE',
                    templateId: 'GENERIC_OPEN_INTAKE',
                    policyConfig: JSON.stringify({
                        allowedChannels: ['DESK'],
                        requiresExceptionForDesk: true,
                        allowDirectRegistration: false
                    })
                },
                channel: 'DESK',
                actor: { role: 'SAMPLE_RECEPTION', labId: 'LAB-R4', isActive: true },
                labId: 'LAB-R4'
            });

            expect(result.allowed).toBe(false);
            expect(result.exceptionRequired).toBe(true);
            expect(result.code).toBe('EXCEPTION_REQUIRED');
        });

        test('HTTP check: POST /api/reception/intake without exception returns 422 EXCEPTION_REQUIRED', async () => {
            const ts = Date.now();
            const res = await request(app)
                .post('/api/reception/intake')
                .set('Authorization', `Bearer ${receptionToken}`)
                .send({
                    originalId: `FIELD-R4-${ts}`,
                    projectId: prjCode,
                    sampleType: 'SOIL',
                    receivedDate: new Date().toISOString()
                });

            expect(res.status).toBe(422);
            expect(res.body.error).toBe('EXCEPTION_REQUIRED');
        });

        test('HTTP check: Client boolean flag isStoredApprovalVerified is stripped and rejected', async () => {
            const ts = Date.now();
            const res = await request(app)
                .post('/api/reception/intake')
                .set('Authorization', `Bearer ${receptionToken}`)
                .send({
                    originalId: `FIELD-R4-FAKE-${ts}`,
                    projectId: prjCode,
                    sampleType: 'SOIL',
                    receivedDate: new Date().toISOString(),
                    exceptionRecord: {
                        reason: 'I claim I am verified',
                        isStoredApprovalVerified: true,
                        verifiedAuthorizer: 'admin'
                    }
                });

            expect(res.status).toBe(422);
            expect(res.body.error).toBe('EXCEPTION_NOT_AUTHORIZED');
        });
    });

    // ═════════════════════════════════════════════════════════════════════════
    // R5: Additive Schema Migration & Legacy Compatibility
    // ═════════════════════════════════════════════════════════════════════════
    describe('R5: Additive Schema Migration Script Contract', () => {
        let tempDbPath;

        beforeAll(() => {
            const os = require('os');
            const path = require('path');
            tempDbPath = path.join(os.tmpdir(), `test_migration_${Date.now()}.db`);

            // Create disposable legacy SQLite database simulating old pre-upgrade schema
            const db = new Database(tempDbPath);
            db.exec(`
                CREATE TABLE "Project" (
                    "id" TEXT PRIMARY KEY,
                    "code" TEXT UNIQUE NOT NULL,
                    "name" TEXT NOT NULL,
                    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
                    "projectType" TEXT DEFAULT 'OPEN_INTAKE',
                    "createdAt" DATETIME DEFAULT CURRENT_TIMESTAMP,
                    "updatedAt" DATETIME DEFAULT CURRENT_TIMESTAMP
                );

                INSERT INTO "Project" ("id", "code", "name", "status")
                VALUES ('LEGACY-1', 'PRJ-LEGACY', 'Legacy Test Project', 'ACTIVE');
            `);
            db.close();
        });

        afterAll(() => {
            const fs = require('fs');
            try { fs.unlinkSync(tempDbPath); } catch {}
        });

        test('Dry run detects 5 missing additive columns without modifying database', () => {
            const dryResult = migrateProjectTemplatesAndPolicy(tempDbPath, { dryRun: true });
            expect(dryResult.success).toBe(true);
            expect(dryResult.dryRun).toBe(true);
            expect(dryResult.missingColumns).toEqual(
                expect.arrayContaining(['templateId', 'templateVersion', 'policyConfig', 'programmeCode', 'parentProjectId'])
            );

            // Verify database table still has only 7 columns
            const db = new Database(tempDbPath);
            const cols = db.prepare("PRAGMA table_info('Project')").all();
            db.close();
            expect(cols.length).toBe(7);
        });

        test('Migration successfully adds all columns, index, and default values while preserving data', () => {
            const result = migrateProjectTemplatesAndPolicy(tempDbPath);
            expect(result.success).toBe(true);
            expect(result.applied).toBe(true);
            expect(result.totalProjects).toBe(1);

            const db = new Database(tempDbPath);
            const row = db.prepare("SELECT * FROM \"Project\" WHERE id = 'LEGACY-1'").get();
            expect(row.code).toBe('PRJ-LEGACY');
            expect(row.templateId).toBe('GENERIC_OPEN_INTAKE');
            expect(row.templateVersion).toBe('1.0.0');
            expect(row.policyConfig).toBeNull();
            expect(row.programmeCode).toBeNull();
            expect(row.parentProjectId).toBeNull();

            // Foreign key check
            const fkIssues = db.prepare('PRAGMA foreign_key_check("Project")').all();
            expect(fkIssues).toEqual([]);
            db.close();
        });

        test('Second migration run is strictly idempotent (no-op)', () => {
            const rerun = migrateProjectTemplatesAndPolicy(tempDbPath);
            expect(rerun.success).toBe(true);
            expect(rerun.applied).toBe(false);
            expect(rerun.missingColumns).toEqual([]);
        });
    });
});
