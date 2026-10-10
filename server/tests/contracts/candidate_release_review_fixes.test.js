const { cleanupWorkflowFixtures } = require("../helpers/workflowFixtures");
const { createSampleFixture, createWorkItemFixture } = require('../helpers/workflowFixtures');
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
            sampleA = await createSampleFixture(prisma, {
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
            sampleB = await createSampleFixture(prisma, {
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

        test('Technician with stale cross-lab assignment: foreign report excluded from search and denied in detail (search/detail parity)', async () => {
            const jwt = require('jsonwebtoken');
            const decoded = jwt.decode(techTokenA);
            const techUsername = decoded?.username || 'test_lab_technician_labr1gtm';
            const ts = Date.now();

            const staleWorkItem = await createWorkItemFixture(prisma, {
                data: {
                    id: `WI-STALE-CROSS-${ts}`,
                    sampleId: sampleB.id,
                    analysis: 'PH',
                    status: 'ASSIGNED',
                    assignedTo: techUsername,
                    labId: labBId
                }
            });

            try {
                // Technician A in Lab A searches reports: MUST contain Report A, MUST NOT contain Report B
                const searchRes = await request(app)
                    .get('/api/reports/search')
                    .set('Authorization', `Bearer ${techTokenA}`);

                expect(searchRes.status).toBe(200);
                const reportIds = searchRes.body.reports.map(r => r.id);
                expect(reportIds).toContain(reportAPub.id);
                expect(reportIds).not.toContain(reportBPub.id);

                // Technician A accesses Report B detail: MUST return 403
                const detailRes = await request(app)
                    .get(`/api/reports/${reportBPub.id}`)
                    .set('Authorization', `Bearer ${techTokenA}`);

                expect(detailRes.status).toBe(403);
                expect(detailRes.body.error).toMatch(/scope/i);

                // Technician A accesses Report A detail: MUST return 200
                const ownDetailRes = await request(app)
                    .get(`/api/reports/${reportAPub.id}`)
                    .set('Authorization', `Bearer ${techTokenA}`);

                expect(ownDetailRes.status).toBe(200);
            } finally {
                await cleanupWorkflowFixtures(prisma, "workItem", (await prisma.workItem.findMany({ ...({ where: { id: staleWorkItem.id } }), select: { id: true } })).map(row => row.id), { single: true }).catch(() => {});
            }
        });

        afterAll(async () => {
            const reportIds = [reportASup?.id, reportAPub?.id, reportBPub?.id].filter(Boolean);
            if (reportIds.length > 0) {
                await prisma.report.deleteMany({ where: { id: { in: reportIds } } }).catch(() => {});
            }
            const sampleIds = [sampleA?.id, sampleB?.id].filter(Boolean);
            if (sampleIds.length > 0) {
                await cleanupWorkflowFixtures(prisma, "sample", (await prisma.sample.findMany({ ...({ where: { id: { in: sampleIds } } }), select: { id: true } })).map(row => row.id), { single: false }).catch(() => {});
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

            sampleA = await createSampleFixture(prisma, {
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

            sampleB = await createSampleFixture(prisma, {
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
            localItem = await createWorkItemFixture(prisma, {
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
            crossLabItem = await createWorkItemFixture(prisma, {
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
            const conflictSample = await createSampleFixture(prisma, {
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

            const conflictItem = await createWorkItemFixture(prisma, {
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
            await cleanupWorkflowFixtures(prisma, "workItem", (await prisma.workItem.findMany({ ...({ where: { id: conflictItem.id } }), select: { id: true } })).map(row => row.id), { single: false }).catch(() => {});
            await cleanupWorkflowFixtures(prisma, "sample", (await prisma.sample.findMany({ ...({ where: { id: conflictSample.id } }), select: { id: true } })).map(row => row.id), { single: false }).catch(() => {});
        });

        afterAll(async () => {
            const wiIds = [localItem?.id, crossLabItem?.id].filter(Boolean);
            if (wiIds.length > 0) {
                await cleanupWorkflowFixtures(prisma, "workItem", (await prisma.workItem.findMany({ ...({ where: { id: { in: wiIds } } }), select: { id: true } })).map(row => row.id), { single: false }).catch(() => {});
            }
            const sampleIds = [sampleA?.id, sampleB?.id].filter(Boolean);
            if (sampleIds.length > 0) {
                await cleanupWorkflowFixtures(prisma, "sample", (await prisma.sample.findMany({ ...({ where: { id: { in: sampleIds } } }), select: { id: true } })).map(row => row.id), { single: false }).catch(() => {});
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

            const normalSample = await createSampleFixture(prisma, {
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

            const releasedSample = await createSampleFixture(prisma, {
                data: {
                    id: `SMP-R3-REL-${ts}`,
                    originalId: `FIELD-R3-REL-${ts}`,
                    assignedLab: labId,
                    status: 'APPROVED',
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
            wiCompleted = await createWorkItemFixture(prisma, {
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
            wiAccepted = await createWorkItemFixture(prisma, {
                data: {
                    id: `WI-R3-ACC-${ts}`,
                    duplicateOf: wiCompleted.id,
                    sampleId: normalSample.id,
                    analysis: 'R3_PH',
                    status: 'ACCEPTED',
                    batchId: batchId,
                    labId: labId
                }
            });

            // Work item on an approved sample: QC must retain its immutable state.
            wiReleasedSample = await createWorkItemFixture(prisma, {
                data: {
                    id: `WI-R3-RELSMP-${ts}`,
                    sampleId: releasedSample.id,
                    analysis: 'R3_PH',
                    status: 'COMPLETED',
                    batchId: batchId,
                    labId: labId
                }
            });
            await require('../helpers/normalizedQcFixture').normalizeLegacyQcFixture(prisma, batchId);
        });

        test('REANALYZE_BATCH transitions completed-unsubmitted work to REPEAT_REQUIRED while preserving immutable history', async () => {
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
            expect(updatedComp.status).toBe('REPEAT_REQUIRED');
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
                await cleanupWorkflowFixtures(prisma, "workItem", (await prisma.workItem.findMany({ ...({ where: { batchId: batchId } }), select: { id: true } })).map(row => row.id), { single: false }).catch(() => {});
                await prisma.batch.deleteMany({ where: { id: batchId } }).catch(() => {});
            }
            const sampleIds = [wiCompleted?.sampleId, wiReleasedSample?.sampleId].filter(Boolean);
            if (sampleIds.length > 0) {
                await cleanupWorkflowFixtures(prisma, "sample", (await prisma.sample.findMany({ ...({ where: { id: { in: sampleIds } } }), select: { id: true } })).map(row => row.id), { single: false }).catch(() => {});
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

        test('Dry run detects 5 missing additive columns without modifying database or sqlite_master', () => {
            const crypto = require('crypto');
            const getMasterHash = (file) => {
                const d = new Database(file);
                const rows = d.prepare("SELECT type, name, tbl_name, sql FROM sqlite_master ORDER BY type, name").all();
                d.close();
                return crypto.createHash('sha256').update(JSON.stringify(rows)).digest('hex');
            };

            const hashBefore = getMasterHash(tempDbPath);
            const dryResult = migrateProjectTemplatesAndPolicy(tempDbPath, { dryRun: true });
            const hashAfter = getMasterHash(tempDbPath);

            expect(dryResult.success).toBe(true);
            expect(dryResult.dryRun).toBe(true);
            expect(dryResult.applied).toBe(false);
            expect(dryResult.needsMigration).toBe(true);
            expect(dryResult.missingColumns).toEqual(
                expect.arrayContaining(['templateId', 'templateVersion', 'policyConfig', 'programmeCode', 'parentProjectId'])
            );
            expect(hashBefore).toBe(hashAfter);

            // Verify database table still has only 7 columns
            const db = new Database(tempDbPath);
            const cols = db.prepare("PRAGMA table_info('Project')").all();
            db.close();
            expect(cols.length).toBe(7);
        });

        test('Dry run on DB with columns present but missing index never creates index or mutates sqlite_master, and apply mode creates it atomically', () => {
            const crypto = require('crypto');
            const missingIndexDbPath = path.join(os.tmpdir(), `test_missing_idx_${Date.now()}.db`);
            const d1 = new Database(missingIndexDbPath);
            d1.exec(`
                CREATE TABLE "Project" (
                    "id" TEXT PRIMARY KEY,
                    "code" TEXT UNIQUE NOT NULL,
                    "name" TEXT NOT NULL,
                    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
                    "projectType" TEXT DEFAULT 'OPEN_INTAKE',
                    "templateId" TEXT DEFAULT 'GENERIC_OPEN_INTAKE',
                    "templateVersion" TEXT DEFAULT '1.0.0',
                    "policyConfig" TEXT,
                    "programmeCode" TEXT,
                    "parentProjectId" TEXT REFERENCES "Project"("id"),
                    "createdAt" DATETIME DEFAULT CURRENT_TIMESTAMP,
                    "updatedAt" DATETIME DEFAULT CURRENT_TIMESTAMP
                );
            `);
            const getMasterHash = (d) => {
                const rows = d.prepare("SELECT type, name, tbl_name, sql FROM sqlite_master ORDER BY type, name").all();
                return crypto.createHash('sha256').update(JSON.stringify(rows)).digest('hex');
            };
            const hashBefore = getMasterHash(d1);
            const idxCountBefore = d1.prepare("SELECT count(*) n FROM sqlite_master WHERE type='index' AND name='Project_parentProjectId_idx'").get().n;
            d1.close();

            expect(idxCountBefore).toBe(0);

            try {
                // Execute dry-run: MUST NOT mutate sqlite_master, MUST report applied: false
                const dryResult = migrateProjectTemplatesAndPolicy(missingIndexDbPath, { dryRun: true });
                expect(dryResult.success).toBe(true);
                expect(dryResult.dryRun).toBe(true);
                expect(dryResult.applied).toBe(false);
                expect(dryResult.needsMigration).toBe(true);
                expect(dryResult.missingColumns).toEqual([]);
                expect(dryResult.missingIndex).toBe(true);

                const d2 = new Database(missingIndexDbPath);
                const hashAfter = getMasterHash(d2);
                const idxCountAfter = d2.prepare("SELECT count(*) n FROM sqlite_master WHERE type='index' AND name='Project_parentProjectId_idx'").get().n;
                d2.close();

                expect(idxCountAfter).toBe(0);
                expect(hashBefore).toBe(hashAfter);

                // Now execute apply mode: should atomically create index and report applied: true
                const applyResult = migrateProjectTemplatesAndPolicy(missingIndexDbPath);
                expect(applyResult.success).toBe(true);
                expect(applyResult.applied).toBe(true);
                expect(applyResult.addedColumns).toEqual([]);
                expect(applyResult.createdIndex).toBe(true);

                const d3 = new Database(missingIndexDbPath);
                const idxCountFinal = d3.prepare("SELECT count(*) n FROM sqlite_master WHERE type='index' AND name='Project_parentProjectId_idx'").get().n;
                d3.close();
                expect(idxCountFinal).toBe(1);

                // Rerun in apply mode: idempotent no-op
                const rerunResult = migrateProjectTemplatesAndPolicy(missingIndexDbPath);
                expect(rerunResult.success).toBe(true);
                expect(rerunResult.applied).toBe(false);
                expect(rerunResult.missingIndex).toBe(false);
            } finally {
                try { fs.unlinkSync(missingIndexDbPath); } catch {}
            }
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
            const rollbackDbPath = require('../helpers/legacyWorkflowDatabase').beforeGuards({
                actor: 'system:fixture', schemaVariant: 'PROJECT_FK_CORRUPT_SYNTHETIC'
            });

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

        test('Populated upgrade rehearsal on full legacy schema preserves 100% rows, verifies result/report/history/share checksums, exercises migrated HTTP auth and supported-channel policy', async () => {
            const { beforeGuards } = require('../helpers/legacyWorkflowDatabase');
            const now = new Date();
            const stamp = { createdAt: now, updatedAt: now };
            const rehearsal = beforeGuards({ actor: 'system:fixture', schemaVariant: 'PROJECT_PRE_TEMPLATE_POLICY',
                samples: [
                    { id:'SMP-001', originalId:'FIELD-001', projectId:'PRJ-GTM', projectCode:'PRJ-GTM-ALPHA', country:'GTM', assignedLab:'LAB-GTM', status:'ACCEPTED', depthTop:0, depthBottom:20, ...stamp },
                    { id:'SMP-002', originalId:'FIELD-002', projectId:'PRJ-KEN', projectCode:'PRJ-KEN-BETA', country:'KEN', assignedLab:'LAB-KEN', status:'ACCEPTED', depthTop:20, depthBottom:50, ...stamp }
                ],
                batches: [
                    { id:'BATCH-001', analysis:'PH', labId:'LAB-GTM', status:'COMPLETED', createdBy:'gtm_mgr', createdAt:now },
                    { id:'BATCH-002', analysis:'PH', labId:'LAB-KEN', status:'COMPLETED', createdBy:'ken_pm', createdAt:now }
                ],
                workItems: [
                    { id:'WI-001', sampleId:'SMP-001', analysis:'PH', status:'COMPLETED', assignedTo:'gtm_tech', labId:'LAB-GTM', assignedLab:'LAB-GTM', batchId:'BATCH-001', ...stamp },
                    { id:'WI-002', sampleId:'SMP-002', analysis:'PH', status:'ASSIGNED', assignedTo:null, labId:'LAB-KEN', assignedLab:'LAB-KEN', batchId:'BATCH-002', ...stamp }
                ],
                relatedRows: {
                    Lab: [
                        { id:'LAB-GTM', code:'GTM1', name:'Guatemala Central Lab', country:'GTM', address:'Guatemala City', email:'gtm@example.com', isActive:1, ...stamp },
                        { id:'LAB-KEN', code:'KEN1', name:'Nairobi Soil Lab', country:'KEN', address:'Nairobi', email:'ken@example.com', isActive:1, ...stamp }
                    ],
                    Project: [
                        { id:'PRJ-GTM', code:'PRJ-GTM-ALPHA', name:'Guatemala Soil Project', status:'ACTIVE', projectType:'OPEN_INTAKE', ...stamp },
                        { id:'PRJ-KEN', code:'PRJ-KEN-BETA', name:'Kenya Agronomy Project', status:'ACTIVE', projectType:'OPEN_INTAKE', ...stamp }
                    ],
                    User: [
                        { id:'USR-TECH', username:'gtm_tech', password:'hash', email:'tech@example.com', role:'LAB_TECHNICIAN', labId:'LAB-GTM', countries:'["GTM"]', projects:'[]', isActive:1, tokenVersion:0, ...stamp },
                        { id:'USR-MGR', username:'gtm_mgr', password:'hash', email:'mgr@example.com', role:'LAB_MANAGER', labId:'LAB-GTM', countries:'["GTM"]', projects:'[]', isActive:1, tokenVersion:0, ...stamp },
                        { id:'USR-NAT', username:'gtm_nat', password:'hash', email:'nat@example.com', role:'MASTER_USER', labId:null, countries:'["GTM"]', projects:'[]', isActive:1, tokenVersion:0, ...stamp },
                        { id:'USR-PM', username:'ken_pm', password:'hash', email:'pm@example.com', role:'PROJECT_MANAGER', labId:null, countries:'[]', projects:'["PRJ-KEN-BETA"]', isActive:1, tokenVersion:0, ...stamp }
                    ],
                    Result: [
                        { id:'RES-001', sampleId:'SMP-001', param:'pH', value:'6.85', numericValue:6.85, unit:'pH', isValid:1, isCurrent:1, provenance:'MEASURED', ...stamp },
                        { id:'RES-002', sampleId:'SMP-002', param:'pH', value:'7.12', numericValue:7.12, unit:'pH', isValid:1, isCurrent:1, provenance:'MEASURED', ...stamp }
                    ],
                    Report: [
                        { id:'REP-PUB', sampleId:'SMP-001', labId:'LAB-GTM', status:'PUBLISHED', projectCode:'PRJ-GTM-ALPHA', generatedBy:'gtm_tech', content:'{"status":"ok","ph":6.85}', version:1, ...stamp },
                        { id:'REP-SUP', sampleId:'SMP-001', labId:'LAB-GTM', status:'SUPERSEDED', projectCode:'PRJ-GTM-ALPHA', generatedBy:'gtm_tech', content:'{"status":"old","ph":6.80}', version:0, ...stamp },
                        { id:'REP-KEN', sampleId:'SMP-002', labId:'LAB-KEN', status:'PUBLISHED', projectCode:'PRJ-KEN-BETA', generatedBy:'ken_pm', content:'{"status":"ok","ph":7.12}', version:1, ...stamp }
                    ],
                    ReportShareLink: [{ id:'RSL-001', reportId:'REP-PUB', tokenHash:'synthetic-token-hash-pub1', expiresAt:new Date('2030-01-01T00:00:00Z'), isRevoked:0, createdBy:'gtm_mgr', createdAt:now }],
                    AuditLog: [
                        { id:'AUD-001', entity:'REPORT', entityId:'REP-PUB', action:'REPORT_GENERATED', performedBy:'USR-MGR', performedByName:'gtm_mgr', details:'Report published', timestamp:now },
                        { id:'AUD-002', entity:'SAMPLE', entityId:'SMP-001', action:'SAMPLE_ACCEPTED', performedBy:'USR-TECH', performedByName:'gtm_tech', details:'Sample accepted', timestamp:now }
                    ]
                }
            });
            const rehearsalDbPath = rehearsal.file;
            const verifyScriptPath = path.join(path.dirname(rehearsalDbPath), `verify_http_${require('crypto').randomUUID()}.cjs`);
            const db = new Database(rehearsalDbPath);
            db.pragma('foreign_keys = ON');
            expect(db.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
            // Compute exact SHA256 checksums of raw table contents BEFORE migration
            const crypto = require('crypto');
            const getTableSnapshot = (table, orderCol = 'id') => {
                const rows = db.prepare(`SELECT * FROM "${table}" ORDER BY "${orderCol}" ASC`).all();
                const hash = crypto.createHash('sha256').update(JSON.stringify(rows)).digest('hex');
                return { rows, hash, count: rows.length };
            };

            const preSnapshots = {
                results: getTableSnapshot('Result'),
                reports: getTableSnapshot('Report'),
                shareLinks: getTableSnapshot('ReportShareLink'),
                auditLogs: getTableSnapshot('AuditLog'),
                workItems: getTableSnapshot('WorkItem'),
                samples: getTableSnapshot('Sample'),
                batches: getTableSnapshot('Batch'),
                labs: getTableSnapshot('Lab'),
                users: getTableSnapshot('User'),
                projects: getTableSnapshot('Project')
            };
            db.close();

            expect(preSnapshots.results.count).toBe(2);
            expect(preSnapshots.reports.count).toBe(3);
            expect(preSnapshots.shareLinks.count).toBe(1);
            expect(preSnapshots.auditLogs.count).toBe(2);
            expect(preSnapshots.projects.count).toBe(2);

            // Execute additive migration runner on populated legacy DB
            const migResult = rehearsal.applyPendingMigration();
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

            // Open migrated DB and verify 100% BYTE / CHECKSUM CONSERVATION
            const postDb = new Database(rehearsalDbPath);
            const getPostSnapshot = (table, orderCol = 'id') => {
                const rows = postDb.prepare(`SELECT * FROM "${table}" ORDER BY "${orderCol}" ASC`).all();
                const hash = crypto.createHash('sha256').update(JSON.stringify(rows)).digest('hex');
                return { rows, hash, count: rows.length };
            };

            const postSnapshots = {
                results: getPostSnapshot('Result'),
                reports: getPostSnapshot('Report'),
                shareLinks: getPostSnapshot('ReportShareLink'),
                auditLogs: getPostSnapshot('AuditLog'),
                workItems: getPostSnapshot('WorkItem'),
                samples: getPostSnapshot('Sample'),
                batches: getPostSnapshot('Batch'),
                labs: getPostSnapshot('Lab'),
                users: getPostSnapshot('User')
            };

            // Assert exact checksum match across all tables (0 byte mutation on historical records)
            expect(postSnapshots.results.hash).toBe(preSnapshots.results.hash);
            expect(postSnapshots.reports.hash).toBe(preSnapshots.reports.hash);
            expect(postSnapshots.shareLinks.hash).toBe(preSnapshots.shareLinks.hash);
            expect(postSnapshots.auditLogs.hash).toBe(preSnapshots.auditLogs.hash);
            expect(postSnapshots.workItems.hash).toBe(preSnapshots.workItems.hash);
            expect(postSnapshots.samples.hash).toBe(preSnapshots.samples.hash);
            expect(postSnapshots.batches.hash).toBe(preSnapshots.batches.hash);
            expect(postSnapshots.labs.hash).toBe(preSnapshots.labs.hash);
            expect(postSnapshots.users.hash).toBe(preSnapshots.users.hash);

            // Forward/Backward Compatibility: Old legacy code queries selecting existing columns still execute identically
            const legacyQueryRows = postDb.prepare('SELECT id, code, name, status, projectType FROM "Project" ORDER BY id ASC').all();
            expect(legacyQueryRows.length).toBe(2);
            expect(legacyQueryRows[0].code).toBe('PRJ-GTM-ALPHA');
            expect(legacyQueryRows[1].code).toBe('PRJ-KEN-BETA');

            postDb.close();

            // The legacy Project upgrade proof above stays byte-for-byte. Apply
            // the separate additive #182 upgrade before loading the current client.
            const markerDb = new Database(rehearsalDbPath);
            markerDb.exec(`CREATE TABLE "_schema_migrations" ("id" TEXT PRIMARY KEY NOT NULL,
                "appliedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "details" TEXT)`);
            markerDb.close();
            const attemptUpgrade = require('../../scripts/install_result_attempt_links').installResultAttemptLinks({ dbPath: rehearsalDbPath, apply: true });
            expect(attemptUpgrade).toMatchObject({ classification: 'COMPLETE', backfillCount: 0,
                counts: { results: 2, linked: 0 } });
            const equipmentUpgrade = require('../../scripts/install_result_equipment_evidence').installResultEquipmentEvidence({ dbPath: rehearsalDbPath, apply: true });
            expect(equipmentUpgrade).toMatchObject({ classification: 'COMPLETE', backfillCount: 0 });
            // Keep the original Project upgrade checks above unchanged. The
            // current report reader also requires its real additive #210
            // withdrawal schema, with no adoption of historical evidence.
            const amendmentUpgrade=require('../../scripts/install_sample_amendment_authorisation').installSampleAmendmentAuthorisation({dbPath:rehearsalDbPath,apply:true});
            expect(amendmentUpgrade).toMatchObject({classification:'COMPLETE_210',newAmendmentCount:0,newAttemptLinkCount:0,newWithdrawalCount:0,backfilledCount:0});
            // #211 adds six nullable Report columns with no backfill.
            expect(require('../../scripts/install_report_revisions').installReportRevisions({dbPath:rehearsalDbPath,apply:true}))
                .toMatchObject({classification:'COMPLETE_211',previousClassification:'PRE_211',backfilledCount:0});
            const verified = new Database(rehearsalDbPath, { readonly: true });
            const originalResultFields = Object.keys(preSnapshots.results.rows[0]).map(field => `"${field}"`).join(',');
            expect(verified.prepare(`SELECT ${originalResultFields} FROM "Result" ORDER BY id`).all()).toEqual(preSnapshots.results.rows);
            for(const [table,rows]of [['Report',preSnapshots.reports.rows],['ReportShareLink',preSnapshots.shareLinks.rows],['AuditLog',preSnapshots.auditLogs.rows]])
                expect(verified.prepare(`SELECT ${rows.length?Object.keys(rows[0]).map(field=>`"${field}"`).join(','):'*'} FROM "${table}" ORDER BY id`).all()).toEqual(rows);
            verified.close();

            // Query via Prisma Client using Better-Sqlite3 adapter — guarantees NO P2022 column missing errors
            const adapter = new PrismaBetterSqlite3({ url: 'file:' + rehearsalDbPath, timeout: 5000 });
            const rehearsalPrisma = new PrismaClient({ adapter });

            try {
                const projects = await rehearsalPrisma.project.findMany();
                expect(projects.length).toBe(2);
                expect(projects[0].templateId).toBe('GENERIC_OPEN_INTAKE');
                expect(projects[0].templateVersion).toBe('1.0.0');
                expect(projects[0].policyConfig).toBeNull();
                expect(projects[0].programmeCode).toBeNull();
                expect(projects[0].parentProjectId).toBeNull();

                const results = await rehearsalPrisma.result.findMany();
                expect(results.length).toBe(2);
                expect(results[0].value).toBe('6.85');
                expect(results[0].numericValue).toBe(6.85);
                expect(results[1].value).toBe('7.12');
                expect(results[1].numericValue).toBe(7.12);

                const shareLinks = await rehearsalPrisma.reportShareLink.findMany();
                expect(shareLinks.length).toBe(1);
                expect(shareLinks[0].tokenHash).toBe('synthetic-token-hash-pub1');

                const auditLogs = await rehearsalPrisma.auditLog.findMany();
                expect(auditLogs.length).toBe(2);

                // Supported Channel Policy Behavior on migrated projects
                // 1. Unconfigured migrated project defaults to open intake (DESK allowed directly)
                const openIntakeDesk = projectPolicyService.canAdmitSample({
                    project: projects[0],
                    channel: 'DESK',
                    actor: { role: 'SAMPLE_RECEPTION', labId: 'LAB-GTM', isActive: true },
                    labId: 'LAB-GTM'
                });
                expect(openIntakeDesk.allowed).toBe(true);

                // 2. Project configured with requiresExceptionForDesk: true requires exception record for DESK
                const deskConfiguredProject = {
                    ...projects[0],
                    policyConfig: JSON.stringify({
                        allowedChannels: ['DESK'],
                        requiresExceptionForDesk: true,
                        allowDirectRegistration: false
                    })
                };
                const deskNoException = projectPolicyService.canAdmitSample({
                    project: deskConfiguredProject,
                    channel: 'DESK',
                    actor: { role: 'SAMPLE_RECEPTION', labId: 'LAB-GTM', isActive: true },
                    labId: 'LAB-GTM',
                    hasException: false
                });
                expect(deskNoException.allowed).toBe(false);
                expect(deskNoException.exceptionRequired).toBe(true);
                expect(deskNoException.code).toBe('EXCEPTION_REQUIRED');

                // 3. Channel DESK with authorized manager exception -> allowed
                const deskWithManagerException = projectPolicyService.canAdmitSample({
                    project: deskConfiguredProject,
                    channel: 'DESK',
                    actor: { role: 'LAB_MANAGER', labId: 'LAB-GTM', isActive: true, username: 'gtm_mgr' },
                    labId: 'LAB-GTM',
                    hasException: true,
                    exceptionRecord: { reason: 'Authorized special intake by manager' }
                });
                expect(deskWithManagerException.allowed).toBe(true);

                // 4. Channel MANIFEST on project allowing MANIFEST
                const manifestAllowed = projectPolicyService.canAdmitSample({
                    project: { ...projects[0], policyConfig: JSON.stringify({ allowedChannels: ['MANIFEST'] }) },
                    channel: 'MANIFEST',
                    actor: { role: 'SAMPLE_RECEPTION', labId: 'LAB-GTM', isActive: true },
                    labId: 'LAB-GTM'
                });
                expect(manifestAllowed.allowed).toBe(true);

                // 5. Channel KOBO when project only allows DESK
                const koboDenied = projectPolicyService.canAdmitSample({
                    project: deskConfiguredProject,
                    channel: 'KOBO',
                    actor: { role: 'SAMPLE_RECEPTION', labId: 'LAB-GTM', isActive: true },
                    labId: 'LAB-GTM'
                });
                expect(koboDenied.allowed).toBe(false);
                expect(koboDenied.exceptionRequired).toBe(true);

                // Real Migrated HTTP Authorization Requests:
                // Verify via child process running against the migrated database
                const serverDir = path.resolve(__dirname, '..', '..');
                const serverPkgPath = path.join(serverDir, 'package.json');
                const childScript = `
                    const { createRequire } = require('module');
                    const req = createRequire(${JSON.stringify(serverPkgPath)});
                    process.env.DATABASE_PATH = ${JSON.stringify(rehearsalDbPath)};
                    process.env.DATABASE_URL = 'file:' + ${JSON.stringify(rehearsalDbPath)};
                    process.env.NODE_ENV = 'test';
                    process.env.DISABLE_BACKGROUND_JOBS = 'true';
                    process.env.JWT_SECRET = 'test-secret-key-12345';
                    const prisma = req('./prisma');
                    const app = req('./app');
                    const request = req('supertest');
                    const jwt = req('jsonwebtoken');

                    (async () => {
                        const tokenTech = jwt.sign({ id: 'USR-TECH', username: 'gtm_tech', role: 'LAB_TECHNICIAN', labId: 'LAB-GTM', countries: ['GTM'], projects: [], tokenVersion: 0 }, process.env.JWT_SECRET);
                        const tokenNat = jwt.sign({ id: 'USR-NAT', username: 'gtm_nat', role: 'MASTER_USER', labId: null, countries: ['GTM'], projects: [], tokenVersion: 0 }, process.env.JWT_SECRET);
                        const tokenPM = jwt.sign({ id: 'USR-PM', username: 'ken_pm', role: 'PROJECT_MANAGER', labId: null, countries: [], projects: ['PRJ-KEN-BETA'], tokenVersion: 0 }, process.env.JWT_SECRET);

                        // 1. Tech search reports: sees only GTM report, not Kenyan report
                        const r1 = await request(app).get('/api/reports/search').set('Authorization', 'Bearer ' + tokenTech);
                        // 2. Tech detail on Kenyan report: 403
                        const r2 = await request(app).get('/api/reports/REP-KEN').set('Authorization', 'Bearer ' + tokenTech);
                        // 3. National user search: sees only GTM report
                        const r3 = await request(app).get('/api/reports/search').set('Authorization', 'Bearer ' + tokenNat);
                        // 4. PM search: sees only Kenyan report
                        const r4 = await request(app).get('/api/reports/search').set('Authorization', 'Bearer ' + tokenPM);

                        const out = {
                            techSearch: { status: r1.status, reports: r1.body.reports?.map(x => x.id) },
                            techKenDetail: { status: r2.status, error: r2.body.error },
                            natSearch: { status: r3.status, reports: r3.body.reports?.map(x => x.id) },
                            pmSearch: { status: r4.status, reports: r4.body.reports?.map(x => x.id) }
                        };
                        console.log('HTTP_MIGRATED_RESULTS:' + JSON.stringify(out));
                        app.stopBackgroundSchedulers();
                        await prisma.$disconnect();
                    })().catch(e => { console.error(e); process.exit(1); });
                `;

                const cp = require('child_process');
                fs.writeFileSync(verifyScriptPath, childScript, { encoding: 'utf8', flag: 'wx' });
                const outBuffer = cp.execFileSync(process.execPath, [verifyScriptPath], { cwd: path.resolve(__dirname, '..', '..') });
                const outLine = outBuffer.toString().split('\n').find(l => l.includes('HTTP_MIGRATED_RESULTS:'));
                expect(outLine).toBeDefined();
                const httpResults = JSON.parse(outLine.replace('HTTP_MIGRATED_RESULTS:', '').trim());

                expect(httpResults.techSearch.status).toBe(200);
                expect(httpResults.techSearch.reports).toContain('REP-PUB');
                expect(httpResults.techSearch.reports).not.toContain('REP-KEN');

                expect(httpResults.techKenDetail.status).toBe(403);

                expect(httpResults.natSearch.status).toBe(200);
                expect(httpResults.natSearch.reports).toContain('REP-PUB');
                expect(httpResults.natSearch.reports).not.toContain('REP-KEN');

                expect(httpResults.pmSearch.status).toBe(200);
                expect(httpResults.pmSearch.reports).toContain('REP-KEN');
                expect(httpResults.pmSearch.reports).not.toContain('REP-PUB');

                // Idempotent rerun check
                const rerun = migrateProjectTemplatesAndPolicy(rehearsalDbPath);
                expect(rerun.success).toBe(true);
                expect(rerun.applied).toBe(false);
                expect(rerun.missingColumns).toEqual([]);
                expect(rerun.totalProjects).toBe(2);
            } finally {
                await rehearsalPrisma.$disconnect();
                fs.rmSync(verifyScriptPath, { force: true }); rehearsal.close();
            }
        });
    });
});
