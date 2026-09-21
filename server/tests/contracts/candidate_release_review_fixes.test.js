const request = require('supertest');
const app = require('../../app');
const { getAuthToken } = require('../setup');
const prisma = require('../../prisma');
const projectPolicyService = require('../../services/projectPolicyService');
const { migrateProjectTemplatesAndPolicy } = require('../../scripts/migrate_project_templates_and_policy');
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { PrismaClient } = require('../../prisma_client');
const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');

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

        test('Metadata conflict: report with own-labId but foreign sample is excluded from search and denied in detail', async () => {
            // Tamper synthetic report B to have labId = labAId (Guatemala lab), while its sample remains Kenya (KEN)
            await prisma.report.update({
                where: { id: reportBPub.id },
                data: { labId: labAId }
            });

            // GTM national user searches reports: MUST NOT contain reportBPub
            const searchRes = await request(app)
                .get('/api/reports/search')
                .set('Authorization', `Bearer ${nationalTokenGtm}`);

            expect(searchRes.status).toBe(200);
            const reportIds = searchRes.body.reports.map(r => r.id);
            expect(reportIds).toContain(reportAPub.id);
            expect(reportIds).not.toContain(reportBPub.id);

            // GTM national user accesses report B detail: MUST return 403
            const detailRes = await request(app)
                .get(`/api/reports/${reportBPub.id}`)
                .set('Authorization', `Bearer ${nationalTokenGtm}`);

            expect(detailRes.status).toBe(403);
            expect(detailRes.body.error).toMatch(/scope/i);

            // Revert report B labId
            await prisma.report.update({
                where: { id: reportBPub.id },
                data: { labId: labBId }
            });
        });

        test('Project snapshot conflict: report claiming Project Alpha on Beta sample is excluded from Alpha search and detail', async () => {
            // Tamper report B to have projectCode = prjACode, but linked sample remains sampleB (Project Beta)
            await prisma.report.update({
                where: { id: reportBPub.id },
                data: { projectCode: prjACode }
            });

            const searchRes = await request(app)
                .get('/api/reports/search')
                .set('Authorization', `Bearer ${projectTokenA}`);

            expect(searchRes.status).toBe(200);
            const reportIds = searchRes.body.reports.map(r => r.id);
            expect(reportIds).toContain(reportAPub.id);
            expect(reportIds).not.toContain(reportBPub.id);

            const detailRes = await request(app)
                .get(`/api/reports/${reportBPub.id}`)
                .set('Authorization', `Bearer ${projectTokenA}`);

            expect(detailRes.status).toBe(403);

            // Revert
            await prisma.report.update({
                where: { id: reportBPub.id },
                data: { projectCode: prjBCode }
            });
        });

        afterAll(async () => {
            const reportIds = [reportASup?.id, reportAPub?.id, reportBPub?.id].filter(Boolean);
            if (reportIds.length > 0) {
                await prisma.report.deleteMany({ where: { id: { in: reportIds } } }).catch(() => {});
            }
            const sampleIds = [sampleA?.id, sampleB?.id].filter(Boolean);
            if (sampleIds.length > 0) {
                await prisma.sample.deleteMany({ where: { id: { in: sampleIds } } }).catch(() => {});
            }
            await prisma.project.deleteMany({ where: { code: { in: [prjACode, prjBCode] } } }).catch(() => {});
        });
    });

    // ═════════════════════════════════════════════════════════════════════════
    // R2: Ordinary Workbench Queue Bypasses Deep-Link Scope
    // ═════════════════════════════════════════════════════════════════════════
    describe('R2: Workbench Queue & Stale Assignment Isolation Contract', () => {
        let techTokenA, techTokenB;
        const labAId = 'LAB-R2-A';
        const labBId = 'LAB-R2-B';
        let sampleA, sampleB, crossLabItem, localItem, usernameA;

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
            usernameA = decodedA.username;

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

        test('Draft scope isolation: cross-lab draft with null labId is excluded from drafts and queue counts', async () => {
            // Create a draft for tech A on crossLabItem (which is in Lab B) with labId = null
            const draft = await prisma.workItemDraft.create({
                data: {
                    id: `DRAFT-CROSS-${Date.now()}`,
                    workItemId: crossLabItem.id,
                    sampleId: sampleB.id,
                    userId: usernameA,
                    labId: null,
                    analysis: 'R2_PH',
                    value: '7.23'
                }
            });

            // 1. GET /api/workbench/drafts for tech A must NOT include cross-lab draft
            const draftsRes = await request(app)
                .get('/api/workbench/drafts')
                .set('Authorization', `Bearer ${techTokenA}`);

            expect(draftsRes.status).toBe(200);
            const draftItemIds = (draftsRes.body.items || []).map(d => d.workItemId);
            expect(draftItemIds).not.toContain(crossLabItem.id);

            // 2. GET /api/workbench/queue stats.totalDrafts must be 0
            const queueRes = await request(app)
                .get('/api/workbench/queue')
                .set('Authorization', `Bearer ${techTokenA}`);

            expect(queueRes.status).toBe(200);
            expect(queueRes.body.stats.totalDrafts).toBe(0);

            // 3. DELETE /api/workbench/drafts/item/:workItemId for cross-lab draft must fail
            const discardRes = await request(app)
                .delete(`/api/workbench/drafts/item/${crossLabItem.id}`)
                .set('Authorization', `Bearer ${techTokenA}`);

            expect([403, 500]).toContain(discardRes.status);

            // 4. DELETE /api/workbench/drafts/R2_PH must not clear cross-lab draft
            const clearRes = await request(app)
                .delete('/api/workbench/drafts/R2_PH')
                .set('Authorization', `Bearer ${techTokenA}`);

            expect(clearRes.status).toBe(200);
            expect(clearRes.body.count).toBe(0);

            // Cleanup draft
            await prisma.workItemDraft.deleteMany({ where: { id: draft.id } }).catch(() => {});
        });

        test('Conflicting lab IDs: work item labId=B, assignedLab=A and sample assignedLab=B, labId=A excluded from SQL count and list', async () => {
            // Create conflicting work item and sample
            const ts = Date.now();
            const conflictSample = await prisma.sample.create({
                data: {
                    id: `SMP-R2-CONF-${ts}`,
                    originalId: `FIELD-R2-CONF-${ts}`,
                    labId: labAId,
                    assignedLab: labBId, // Conflicting!
                    status: 'ACCEPTED',
                    dryingStatus: 'DONE',
                    preparationStatus: 'DONE',
                    projectCode: 'PRJ-R2'
                }
            });

            const conflictItem = await prisma.workItem.create({
                data: {
                    id: `WI-R2-CONF-${ts}`,
                    sampleId: conflictSample.id,
                    analysis: 'R2_PH',
                    status: 'ASSIGNED',
                    assignedTo: usernameA,
                    labId: labBId, // Conflicting!
                    assignedLab: labAId
                }
            });

            const res = await request(app)
                .get('/api/workbench/queue')
                .set('Authorization', `Bearer ${techTokenA}`);

            expect(res.status).toBe(200);
            const allItems = (res.body.groups || []).flatMap(g => g.items || []).map(i => i.id);
            expect(allItems).not.toContain(conflictItem.id);
            expect(allItems).toContain(localItem.id);

            // SQL myWorkCount must match visible items (exactly 1, not 2)
            expect(res.body.stats.myWorkCount).toBe(1);
            expect(res.body.stats.totalItems).toBe(1);

            // Cleanup
            await prisma.workItem.deleteMany({ where: { id: conflictItem.id } }).catch(() => {});
            await prisma.sample.deleteMany({ where: { id: conflictSample.id } }).catch(() => {});
        });

        afterAll(async () => {
            const wiIds = [localItem?.id, crossLabItem?.id].filter(Boolean);
            if (wiIds.length > 0) {
                await prisma.workItem.deleteMany({ where: { id: { in: wiIds } } }).catch(() => {});
            }
            const sampleIds = [sampleA?.id, sampleB?.id].filter(Boolean);
            if (sampleIds.length > 0) {
                await prisma.sample.deleteMany({ where: { id: { in: sampleIds } } }).catch(() => {});
            }
            await prisma.analysis.deleteMany({ where: { code: 'R2_PH' } }).catch(() => {});
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

        afterAll(async () => {
            if (batchId) {
                await prisma.workItem.deleteMany({ where: { batchId: batchId } }).catch(() => {});
                await prisma.batch.deleteMany({ where: { id: batchId } }).catch(() => {});
            }
            const sampleIds = [wiCompleted?.sampleId, wiReleasedSample?.sampleId].filter(Boolean);
            if (sampleIds.length > 0) {
                await prisma.sample.deleteMany({ where: { id: { in: sampleIds } } }).catch(() => {});
            }
            await prisma.analysis.deleteMany({ where: { code: 'R3_PH' } }).catch(() => {});
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

        afterAll(async () => {
            await prisma.project.deleteMany({ where: { code: prjCode } }).catch(() => {});
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

        test('Fail-closed on non-existent database file path', () => {
            const nonExistentDb = path.join(os.tmpdir(), `non_existent_db_${Date.now()}_missing.db`);
            expect(() => migrateProjectTemplatesAndPolicy(nonExistentDb)).toThrow(
                /Target database file not found/
            );
        });

        test('Fail-closed on target database missing Project table', () => {
            const missingTableDbPath = path.join(os.tmpdir(), `test_missing_table_${Date.now()}.db`);
            const db = new Database(missingTableDbPath);
            db.exec('CREATE TABLE "User" ("id" TEXT PRIMARY KEY);');
            db.close();

            try {
                expect(() => migrateProjectTemplatesAndPolicy(missingTableDbPath)).toThrow(
                    /Table "Project" does not exist/
                );
            } finally {
                try { fs.unlinkSync(missingTableDbPath); } catch {}
            }
        });

        test('Atomic rollback guarantees database remains unmodified if foreign key check fails during migration', () => {
            const rollbackDbPath = path.join(os.tmpdir(), `test_rollback_${Date.now()}.db`);
            const db = new Database(rollbackDbPath);
            db.pragma('foreign_keys = OFF');
            db.exec(`
                CREATE TABLE "Parent" ("id" TEXT PRIMARY KEY);
                CREATE TABLE "Project" (
                    "id" TEXT PRIMARY KEY,
                    "code" TEXT UNIQUE NOT NULL,
                    "name" TEXT NOT NULL,
                    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
                    "parentRef" TEXT REFERENCES "Parent"("id")
                );
                INSERT INTO "Parent" ("id") VALUES ('valid-parent');
                INSERT INTO "Project" ("id", "code", "name", "status", "parentRef")
                VALUES ('p-1', 'PRJ-1', 'Project 1', 'ACTIVE', 'invalid-parent-fk');
            `);
            db.close();

            try {
                expect(() => migrateProjectTemplatesAndPolicy(rollbackDbPath)).toThrow(
                    /Foreign key check failed/
                );

                // Verify atomic rollback: columns were NOT added, table schema remains original
                const verifyDb = new Database(rollbackDbPath);
                const cols = verifyDb.prepare("PRAGMA table_info('Project')").all();
                verifyDb.close();

                const colNames = cols.map(c => c.name);
                expect(colNames).toEqual(['id', 'code', 'name', 'status', 'parentRef']);
                expect(colNames).not.toContain('templateId');
                expect(colNames).not.toContain('parentProjectId');
            } finally {
                try { fs.unlinkSync(rollbackDbPath); } catch {}
            }
        });

        test('Populated upgrade rehearsal on full legacy schema preserves 100% rows and enables zero-error Prisma querying and conservative policy checks', async () => {
            const devDbPath = path.resolve(__dirname, '..', '..', 'prisma', 'dev.db');
            const rehearsalDir = path.resolve(__dirname, '..', `tmp_rehearsal_full_${Date.now()}`);
            fs.mkdirSync(rehearsalDir, { recursive: true });
            const rehearsalDbPath = path.join(rehearsalDir, 'rehearsal_full.db');
            fs.copyFileSync(devDbPath, rehearsalDbPath);

            const db = new Database(rehearsalDbPath);
            db.pragma('foreign_keys = OFF');
            // Wipe all rows to guarantee clean synthetic test state
            const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma_%'").all();
            for (const { name } of tables) {
                db.prepare(`DELETE FROM "${name}"`).run();
            }

            // Downgrade Project table to legacy schema without the 5 additive columns
            db.exec(`
                CREATE TABLE "Project_legacy" (
                    "id" TEXT PRIMARY KEY,
                    "code" TEXT UNIQUE NOT NULL,
                    "name" TEXT NOT NULL,
                    "description" TEXT,
                    "notes" TEXT,
                    "client" TEXT,
                    "startDate" DATETIME,
                    "deliveryDeadline" DATETIME,
                    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
                    "projectType" TEXT NOT NULL DEFAULT 'OPEN_INTAKE',
                    "expectedSampleCount" INTEGER DEFAULT 0,
                    "priority" TEXT DEFAULT 'NORMAL',
                    "defaultAnalysisBundle" TEXT,
                    "labId" TEXT,
                    "countries" TEXT,
                    "assignedLabIds" TEXT,
                    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
                );
                DROP TABLE "Project";
                ALTER TABLE "Project_legacy" RENAME TO "Project";
                DROP INDEX IF EXISTS "Project_parentProjectId_idx";
            `);

            // Populate full legacy schema across all operational domains
            db.exec(`
                INSERT INTO "Lab" ("id", "code", "name", "country", "address", "email", "isActive", "createdAt", "updatedAt")
                VALUES ('LAB-GTM', 'GTM1', 'Guatemala Central Lab', 'GTM', 'Guatemala City', 'gtm@example.com', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
                       ('LAB-KEN', 'KEN1', 'Nairobi Soil Lab', 'KEN', 'Nairobi', 'ken@example.com', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

                INSERT INTO "Project" ("id", "code", "name", "status", "projectType", "createdAt", "updatedAt")
                VALUES ('PRJ-GTM', 'PRJ-GTM-ALPHA', 'Guatemala Soil Project', 'ACTIVE', 'OPEN_INTAKE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
                       ('PRJ-KEN', 'PRJ-KEN-BETA', 'Kenya Agronomy Project', 'ACTIVE', 'OPEN_INTAKE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

                INSERT INTO "User" ("id", "username", "password", "email", "role", "labId", "countries", "projects", "isActive", "createdAt", "updatedAt")
                VALUES ('USR-TECH', 'gtm_tech', 'hash', 'tech@example.com', 'LAB_TECHNICIAN', 'LAB-GTM', '["GTM"]', '[]', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
                       ('USR-MGR', 'gtm_mgr', 'hash', 'mgr@example.com', 'LAB_MANAGER', 'LAB-GTM', '["GTM"]', '[]', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
                       ('USR-NAT', 'gtm_nat', 'hash', 'nat@example.com', 'MASTER_USER', NULL, '["GTM"]', '[]', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
                       ('USR-PM', 'ken_pm', 'hash', 'pm@example.com', 'PROJECT_MANAGER', NULL, '[]', '["PRJ-KEN-BETA"]', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

                INSERT INTO "Sample" ("id", "originalId", "projectId", "projectCode", "country", "assignedLab", "status", "depthTop", "depthBottom", "createdAt", "updatedAt")
                VALUES ('SMP-001', 'FIELD-001', 'PRJ-GTM', 'PRJ-GTM-ALPHA', 'GTM', 'LAB-GTM', 'ACCEPTED', 0, 20, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
                       ('SMP-002', 'FIELD-002', 'PRJ-KEN', 'PRJ-KEN-BETA', 'KEN', 'LAB-KEN', 'ACCEPTED', 20, 50, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

                INSERT INTO "Batch" ("id", "analysis", "labId", "status", "createdBy", "createdAt")
                VALUES ('BATCH-001', 'PH', 'LAB-GTM', 'COMPLETED', 'gtm_mgr', CURRENT_TIMESTAMP);

                INSERT INTO "WorkItem" ("id", "sampleId", "analysis", "status", "assignedTo", "labId", "assignedLab", "batchId", "createdAt", "updatedAt")
                VALUES ('WI-001', 'SMP-001', 'PH', 'COMPLETED', 'gtm_tech', 'LAB-GTM', 'LAB-GTM', 'BATCH-001', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
                       ('WI-002', 'SMP-002', 'PH', 'ASSIGNED', NULL, 'LAB-KEN', 'LAB-KEN', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

                INSERT INTO "Report" ("id", "sampleId", "labId", "status", "projectCode", "generatedBy", "content", "version", "createdAt", "updatedAt")
                VALUES ('REP-PUB', 'SMP-001', 'LAB-GTM', 'PUBLISHED', 'PRJ-GTM-ALPHA', 'gtm_tech', '{"status":"ok"}', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
                       ('REP-SUP', 'SMP-001', 'LAB-GTM', 'SUPERSEDED', 'PRJ-GTM-ALPHA', 'gtm_tech', '{"status":"old"}', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
            `);
            db.pragma('foreign_keys = ON');

            // Count rows prior to migration
            const preCounts = {
                projects: db.prepare('SELECT count(*) as c FROM "Project"').get().c,
                labs: db.prepare('SELECT count(*) as c FROM "Lab"').get().c,
                users: db.prepare('SELECT count(*) as c FROM "User"').get().c,
                samples: db.prepare('SELECT count(*) as c FROM "Sample"').get().c,
                batches: db.prepare('SELECT count(*) as c FROM "Batch"').get().c,
                workItems: db.prepare('SELECT count(*) as c FROM "WorkItem"').get().c,
                reports: db.prepare('SELECT count(*) as c FROM "Report"').get().c
            };
            db.close();

            expect(preCounts.projects).toBe(2);
            expect(preCounts.reports).toBe(2);

            // Execute additive migration runner on populated legacy DB
            const migResult = migrateProjectTemplatesAndPolicy(rehearsalDbPath);
            expect(migResult.success).toBe(true);
            expect(migResult.applied).toBe(true);
            expect(migResult.totalProjects).toBe(2);
            expect(migResult.addedColumns).toEqual([
                'templateId',
                'templateVersion',
                'policyConfig',
                'programmeCode',
                'parentProjectId'
            ]);

            // Query via Prisma Client using Better-Sqlite3 adapter — guarantees NO P2022 column missing errors
            const adapter = new PrismaBetterSqlite3({ url: 'file:' + rehearsalDbPath, timeout: 5000 });
            const rehearsalPrisma = new PrismaClient({ adapter });

            try {
                const projects = await rehearsalPrisma.project.findMany();
                expect(projects.length).toBe(preCounts.projects);
                expect(projects[0].templateId).toBe('GENERIC_OPEN_INTAKE');
                expect(projects[0].templateVersion).toBe('1.0.0');
                expect(projects[0].policyConfig).toBeNull();
                expect(projects[0].programmeCode).toBeNull();
                expect(projects[0].parentProjectId).toBeNull();

                const samples = await rehearsalPrisma.sample.findMany({ include: { project: true } });
                expect(samples.length).toBe(preCounts.samples);
                expect(samples[0].project.code).toBe('PRJ-GTM-ALPHA');

                const reports = await rehearsalPrisma.report.findMany();
                expect(reports.length).toBe(preCounts.reports);
                const statuses = reports.map(r => r.status);
                expect(statuses).toContain('PUBLISHED');
                expect(statuses).toContain('SUPERSEDED');

                const users = await rehearsalPrisma.user.findMany();
                expect(users.length).toBe(preCounts.users);

                const workItems = await rehearsalPrisma.workItem.findMany();
                expect(workItems.length).toBe(preCounts.workItems);

                const batches = await rehearsalPrisma.batch.findMany();
                expect(batches.length).toBe(preCounts.batches);

                // Conservative Policy Behavior: Migrated projects default to open intake channels
                const defaultAdmission = projectPolicyService.canAdmitSample({
                    project: projects[0],
                    channel: 'DIRECT',
                    actor: { role: 'SAMPLE_RECEPTION', labId: 'LAB-GTM', isActive: true },
                    labId: 'LAB-GTM'
                });
                expect(defaultAdmission.exceptionRequired).toBe(true);
                expect(defaultAdmission.code).toBe('EXCEPTION_REQUIRED');

                // Idempotent rerun check
                const rerun = migrateProjectTemplatesAndPolicy(rehearsalDbPath);
                expect(rerun.success).toBe(true);
                expect(rerun.applied).toBe(false);
                expect(rerun.missingColumns).toEqual([]);
                expect(rerun.totalProjects).toBe(2);
            } finally {
                await rehearsalPrisma.$disconnect();
                try { fs.rmSync(rehearsalDir, { recursive: true, force: true }); } catch {}
            }
        });
    });
});
