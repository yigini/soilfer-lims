'use strict';

const request = require('supertest');
const app = require('../../app');
const prisma = require('../../prisma');
const { getAuthToken } = require('../setup');
const { canFinalApprove } = require('../../services/workEligibility');
const sampleWorkspaceService = require('../../services/sampleWorkspaceService');
const dashboardService = require('../../services/dashboardService');

describe('Contract: Sample and Assignment Identity, Pagination, and Server-Side Readiness (Issue #119)', () => {
    let superAdminToken, mgrGtmToken, mgrHndToken, techGtmToken, techHndToken;
    const sample26Id = 'SMP-TEST-26-GTM-01';
    const sample26LabCode = 'LAB-SMP-26-GTM';
    const sample26OriginalId = 'FIELD-SAMP-26-ORIG';

    const sampleApprId = 'SMP-TEST-APPR-GTM-01';

    const techGtmUsername = 'test_lab_technician_labgtm';
    const techHndUsername = 'test_lab_technician_labhnd';

    const analyses26 = [
        // 2 Operational Gates
        { analysis: 'DRYING', category: 'Operational Gates' },
        { analysis: 'PREPARATION', category: 'Operational Gates' },
        // 3 Texture fractions (derived from TEXTURE)
        { analysis: 'SAND', category: 'Physical' },
        { analysis: 'SILT', category: 'Physical' },
        { analysis: 'CLAY', category: 'Physical' },
        // 21 Routine chemical / physical analyses
        { analysis: 'PH_H2O', category: 'Wet Chemistry' },
        { analysis: 'EC_1_5', category: 'Wet Chemistry' },
        { analysis: 'OC', category: 'Wet Chemistry' },
        { analysis: 'TOTAL_N', category: 'Wet Chemistry' },
        { analysis: 'P_BRAY', category: 'Wet Chemistry' },
        { analysis: 'K_EX', category: 'Wet Chemistry' },
        { analysis: 'CA_EX', category: 'Wet Chemistry' },
        { analysis: 'MG_EX', category: 'Wet Chemistry' },
        { analysis: 'NA_EX', category: 'Wet Chemistry' },
        { analysis: 'CEC', category: 'Wet Chemistry' },
        { analysis: 'FE_DTPA', category: 'Wet Chemistry' },
        { analysis: 'ZN_DTPA', category: 'Wet Chemistry' },
        { analysis: 'CU_DTPA', category: 'Wet Chemistry' },
        { analysis: 'MN_DTPA', category: 'Wet Chemistry' },
        { analysis: 'B_HOT_WATER', category: 'Wet Chemistry' },
        { analysis: 'S_SO4', category: 'Wet Chemistry' },
        { analysis: 'AL_KCL', category: 'Wet Chemistry' },
        { analysis: 'MO_TOTAL', category: 'Wet Chemistry' },
        { analysis: 'CD_TOTAL', category: 'Wet Chemistry' },
        { analysis: 'PB_TOTAL', category: 'Wet Chemistry' },
        { analysis: 'AS_TOTAL', category: 'Wet Chemistry' }
    ];

    beforeAll(async () => {
        superAdminToken = await getAuthToken('SUPER_ADMIN', 'LAB-GTM', ['GTM', 'HND'], ['SOILFER-US']);
        mgrGtmToken = await getAuthToken('LAB_MANAGER', 'LAB-GTM', ['GTM'], ['SOILFER-US']);
        mgrHndToken = await getAuthToken('LAB_MANAGER', 'LAB-HND', ['HND'], ['SOILFER-US']);
        techGtmToken = await getAuthToken('LAB_TECHNICIAN', 'LAB-GTM', ['GTM'], ['SOILFER-US']);
        techHndToken = await getAuthToken('LAB_TECHNICIAN', 'LAB-HND', ['HND'], ['SOILFER-US']);

        // Clean up any pre-existing test data
        await prisma.submission.deleteMany({ where: { sampleId: { in: [sample26Id, sampleApprId] } } });
        await prisma.result.deleteMany({ where: { sampleId: { in: [sample26Id, sampleApprId] } } });
        await prisma.auditLog.deleteMany({ where: { sampleId: { in: [sample26Id, sampleApprId] } } });
        await prisma.orderLine.deleteMany({ where: { revision: { sampleId: { in: [sample26Id, sampleApprId] } } } });
        await prisma.sampleOrderRevision.deleteMany({ where: { sampleId: { in: [sample26Id, sampleApprId] } } });
        await prisma.workItem.deleteMany({ where: { sampleId: { in: [sample26Id, sampleApprId] } } });
        await prisma.sample.deleteMany({ where: { id: { in: [sample26Id, sampleApprId] } } });

        // Ensure operational gates exist
        await prisma.operationalGate.upsert({
            where: { code_labId: { code: 'DRYING', labId: 'LAB-GTM' } },
            update: { isActive: true },
            create: { code: 'DRYING', name: 'Air Drying', labId: 'LAB-GTM', isActive: true }
        });
        await prisma.operationalGate.upsert({
            where: { code_labId: { code: 'PREPARATION', labId: 'LAB-GTM' } },
            update: { isActive: true },
            create: { code: 'PREPARATION', name: 'Sample Preparation', labId: 'LAB-GTM', isActive: true }
        });

        // 1. Seed 26-task Sample
        await prisma.sample.create({
            data: {
                id: sample26Id,
                labId: sample26LabCode,
                originalId: sample26OriginalId,
                assignedLab: 'LAB-GTM',
                country: 'GTM',
                projectCode: 'SOILFER-US',
                status: 'PROCESSING',
                matrix: 'SOIL',
                receptionDate: new Date(),
                dryingStatus: 'PENDING',
                preparationStatus: 'PENDING',
                requiredAnalyses: JSON.stringify(['TEXTURE', ...analyses26.slice(5).map(a => a.analysis)])
            }
        });

        // Seed 26 work items
        await prisma.workItem.createMany({
            data: analyses26.map((a, idx) => ({
                id: `WI-26-${String(idx + 1).padStart(2, '0')}`,
                sampleId: sample26Id,
                labId: 'LAB-GTM',
                assignedLab: 'LAB-GTM',
                analysis: a.analysis,
                category: a.category,
                status: 'NOT_ASSIGNED',
                priority: 'NORMAL'
            }))
        });
    });

    afterAll(async () => {
        await prisma.submission.deleteMany({ where: { sampleId: { in: [sample26Id, sampleApprId] } } });
        await prisma.result.deleteMany({ where: { sampleId: { in: [sample26Id, sampleApprId] } } });
        await prisma.auditLog.deleteMany({ where: { sampleId: { in: [sample26Id, sampleApprId] } } });
        await prisma.orderLine.deleteMany({ where: { revision: { sampleId: { in: [sample26Id, sampleApprId] } } } });
        await prisma.sampleOrderRevision.deleteMany({ where: { sampleId: { in: [sample26Id, sampleApprId] } } });
        await prisma.workItem.deleteMany({ where: { sampleId: { in: [sample26Id, sampleApprId] } } });
        await prisma.sample.deleteMany({ where: { id: { in: [sample26Id, sampleApprId] } } });
    });

    test('1. 26-task fixture exposes all 26 tasks with honest totals and pagination (no silent 20-item truncation)', async () => {
        // Query /api/work with sampleId
        const resAll = await request(app)
            .get('/api/work')
            .set('Authorization', `Bearer ${mgrGtmToken}`)
            .query({ sampleId: sample26Id, limit: 100 });

        expect(resAll.status).toBe(200);
        expect(resAll.body.data.length).toBe(26);
        expect(resAll.body.pagination.total).toBe(26);

        // Verify each item contains enriched sample identity
        const firstItem = resAll.body.data[0];
        expect(firstItem.sampleLabId).toBe(sample26LabCode);
        expect(firstItem.originalId).toBe(sample26OriginalId);
        expect(firstItem.projectCode).toBe('SOILFER-US');
        expect(firstItem.sample).toBeDefined();
        expect(firstItem.sample.labId).toBe(sample26LabCode);
        expect(firstItem.sample.originalId).toBe(sample26OriginalId);

        // Test honest pagination: page 1 of 10
        const resPage1 = await request(app)
            .get('/api/work')
            .set('Authorization', `Bearer ${mgrGtmToken}`)
            .query({ sampleId: sample26Id, page: 1, limit: 10 });

        expect(resPage1.status).toBe(200);
        expect(resPage1.body.data.length).toBe(10);
        expect(resPage1.body.pagination.total).toBe(26);
        expect(resPage1.body.pagination.totalPages).toBe(3);
        expect(resPage1.body.pagination.page).toBe(1);

        // Test workspace projection counters
        const workspace = await sampleWorkspaceService.getSampleWorkspace(sample26Id, { role: 'LAB_MANAGER', labId: 'LAB-GTM' });
        expect(workspace.counters.totalTasks).toBe(26);
        expect(workspace.counters.gates).toBe(2);
        expect(workspace.counters.derived).toBe(3);
        expect(workspace.counters.ordered).toBe(22);
        expect(workspace.counters.unassigned).toBe(24);
    });

    test('2. Disambiguates canonical ID, lab ID, and field original ID across dashboard queues and submissions', async () => {
        // Create a submission for sample26
        const sub = await prisma.submission.create({
            data: {
                id: `SUB-TEST-26-${Date.now()}`,
                sampleId: sample26Id,
                labId: 'LAB-GTM',
                assignedLab: 'LAB-GTM',
                submittedBy: techGtmUsername,
                submittedAt: new Date(),
                type: 'WET_CHEMISTRY',
                status: 'PENDING_REVIEW',
                note: 'Batch test'
            }
        });

        // Query manager.review queue
        const reviewQueue = await dashboardService.getQueueData(
            { role: 'LAB_MANAGER', labId: 'LAB-GTM', username: 'mgr_gtm' },
            'manager.review'
        );

        const sampleRow = reviewQueue.rows.find(r => r.sampleId === sample26Id);
        expect(sampleRow).toBeDefined();
        expect(sampleRow.sampleId).toBe(sample26Id); // Canonical UUID
        expect(sampleRow.labId).toBe(sample26LabCode); // Lab ID, NOT processing facility LAB-GTM
        expect(sampleRow.originalId).toBe(sample26OriginalId); // Field ID
        expect(sampleRow.sampleDisplayId).toBe(sample26LabCode);
        expect(sampleRow.title).toBe(sample26LabCode);
        expect(sampleRow.projectCode).toBe('SOILFER-US');
        expect(sampleRow.route).toContain(`returnTo=${encodeURIComponent('/manager-queue?lane=review')}`);

        // Query submissions API
        const subRes = await request(app)
            .get('/api/submissions')
            .set('Authorization', `Bearer ${mgrGtmToken}`)
            .query({ sampleId: sample26Id });

        expect(subRes.status).toBe(200);
        const subList = Array.isArray(subRes.body) ? subRes.body : (subRes.body.data || []);
        const returnedSub = subList.find(s => s.id === sub.id);
        expect(returnedSub).toBeDefined();
        expect(returnedSub.sampleLabId).toBe(sample26LabCode);
        expect(returnedSub.originalId).toBe(sample26OriginalId);
        expect(returnedSub.projectCode).toBe('SOILFER-US');
    });

    test('3. Texture equivalence: TEXTURE requirement satisfied by 3 accepted fractions (SAND, SILT, CLAY) without false ORDER_TASK_MISMATCH', async () => {
        const workspace = await sampleWorkspaceService.getSampleWorkspace(sample26Id, { role: 'LAB_MANAGER', labId: 'LAB-GTM' });

        // Ensure derived fractions are tagged
        const sandItem = workspace.workItems.find(w => w.analysis === 'SAND');
        const siltItem = workspace.workItems.find(w => w.analysis === 'SILT');
        const clayItem = workspace.workItems.find(w => w.analysis === 'CLAY');

        expect(sandItem.isDerived).toBe(true);
        expect(sandItem.derivedFrom).toBe('TEXTURE');
        expect(siltItem.isDerived).toBe(true);
        expect(siltItem.derivedFrom).toBe('TEXTURE');
        expect(clayItem.isDerived).toBe(true);
        expect(clayItem.derivedFrom).toBe('TEXTURE');

        // Integrity should NOT flag ORDER_TASK_MISMATCH for TEXTURE
        const mismatchIssue = workspace.integrity.issues.find(i => i.code === 'ORDER_TASK_MISMATCH');
        expect(mismatchIssue).toBeUndefined();

        // Direct canFinalApprove test:
        // When only SAND and SILT are ACCEPTED, TEXTURE equivalence is not met
        const partialWorkItems = [
            { analysis: 'DRYING', status: 'COMPLETED' },
            { analysis: 'PREPARATION', status: 'COMPLETED' },
            { analysis: 'SAND', status: 'ACCEPTED' },
            { analysis: 'SILT', status: 'ACCEPTED' },
            { analysis: 'CLAY', status: 'SUBMITTED' } // not accepted
        ];
        const partialEval = canFinalApprove(
            { id: 'TEST-TEX', status: 'PROCESSING', receptionDate: new Date(), dryingStatus: 'DONE', preparationStatus: 'DONE', requiredAnalyses: JSON.stringify(['TEXTURE']) },
            partialWorkItems,
            [],
            { role: 'LAB_MANAGER', labId: 'LAB-GTM' }
        );
        expect(partialEval.allowed).toBe(false);
        expect(partialEval.blockers.some(b => b.includes('CLAY'))).toBe(true);

        // When all 3 are ACCEPTED:
        const completeWorkItems = [
            { analysis: 'DRYING', status: 'COMPLETED' },
            { analysis: 'PREPARATION', status: 'COMPLETED' },
            { analysis: 'SAND', status: 'ACCEPTED' },
            { analysis: 'SILT', status: 'ACCEPTED' },
            { analysis: 'CLAY', status: 'ACCEPTED' }
        ];
        const completeEval = canFinalApprove(
            { id: 'TEST-TEX', status: 'PROCESSING', receptionDate: new Date(), dryingStatus: 'DONE', preparationStatus: 'DONE', requiredAnalyses: JSON.stringify(['TEXTURE']) },
            completeWorkItems,
            [],
            { role: 'LAB_MANAGER', labId: 'LAB-GTM' }
        );
        expect(completeEval.allowed).toBe(true);
    });

    test('4. Final approval readiness independently enforced on server: rejects premature approval with 409 and blockers', async () => {
        // Create a new sample with unapproved items and pending gates
        await prisma.sample.create({
            data: {
                id: sampleApprId,
                labId: 'LAB-APPR-01',
                originalId: 'ORIG-APPR-01',
                assignedLab: 'LAB-GTM',
                country: 'GTM',
                projectCode: 'SOILFER-US',
                status: 'PROCESSING',
                matrix: 'SOIL',
                receptionDate: new Date(),
                dryingStatus: 'PENDING',
                preparationStatus: 'PENDING',
                requiredAnalyses: JSON.stringify(['PH_H2O'])
            }
        });

        await prisma.workItem.createMany({
            data: [
                {
                    id: 'WI-APPR-DRY',
                    sampleId: sampleApprId,
                    labId: 'LAB-GTM',
                    assignedLab: 'LAB-GTM',
                    analysis: 'DRYING',
                    category: 'Operational Gates',
                    status: 'PENDING'
                },
                {
                    id: 'WI-APPR-PREP',
                    sampleId: sampleApprId,
                    labId: 'LAB-GTM',
                    assignedLab: 'LAB-GTM',
                    analysis: 'PREPARATION',
                    category: 'Operational Gates',
                    status: 'PENDING'
                },
                {
                    id: 'WI-APPR-PH',
                    sampleId: sampleApprId,
                    labId: 'LAB-GTM',
                    assignedLab: 'LAB-GTM',
                    analysis: 'PH_H2O',
                    category: 'Wet Chemistry',
                    status: 'NOT_ASSIGNED'
                }
            ]
        });

        // Attempt premature final approval
        const prematureRes = await request(app)
            .post(`/api/samples/${sampleApprId}/approve`)
            .set('Authorization', `Bearer ${mgrGtmToken}`)
            .send({});

        expect(prematureRes.status).toBe(409);
        expect(prematureRes.body.code).toBe('UNAPPROVED_WORK_ITEMS');
        expect(prematureRes.body.blockers).toBeDefined();
        expect(prematureRes.body.blockers.length).toBeGreaterThan(0);

        // Now satisfy all gates and analyses
        await prisma.sample.update({
            where: { id: sampleApprId },
            data: { dryingStatus: 'DONE', preparationStatus: 'DONE' }
        });
        await prisma.workItem.update({
            where: { id: 'WI-APPR-DRY' },
            data: { status: 'COMPLETED' }
        });
        await prisma.workItem.update({
            where: { id: 'WI-APPR-PREP' },
            data: { status: 'COMPLETED' }
        });
        await prisma.workItem.update({
            where: { id: 'WI-APPR-PH' },
            data: { status: 'ACCEPTED' }
        });

        // Re-attempt final approval
        const approvedRes = await request(app)
            .post(`/api/samples/${sampleApprId}/approve`)
            .set('Authorization', `Bearer ${mgrGtmToken}`)
            .send({});

        expect(approvedRes.status).toBe(200);
        expect(approvedRes.body.success).toBe(true);
        expect(approvedRes.body.status).toBe('APPROVED');

        // Verify in DB
        const approvedSample = await prisma.sample.findUnique({ where: { id: sampleApprId } });
        expect(approvedSample.status).toBe('APPROVED');
    });

    test('5. Cross-lab assignment is strictly rejected with 403 CROSS_LAB_ASSIGNMENT_DENIED', async () => {
        // Attempt bulk assign of GTM work item to HND technician
        const bulkRes = await request(app)
            .post('/api/work/assign')
            .set('Authorization', `Bearer ${mgrGtmToken}`)
            .send({
                workItemIds: ['WI-26-06'], // PH_H2O in LAB-GTM
                assignee: techHndUsername
            });

        expect(bulkRes.status).toBe(403);
        expect(bulkRes.body.code).toBe('CROSS_LAB_ASSIGNMENT_DENIED');
        expect(bulkRes.body.error).toMatch(/Cannot assign to technician in different lab/i);

        // Attempt single assign via POST /api/work/:id/assign
        const singleRes = await request(app)
            .post('/api/work/WI-26-06/assign')
            .set('Authorization', `Bearer ${mgrGtmToken}`)
            .send({
                technicianUserId: techHndUsername
            });

        expect(singleRes.status).toBe(403);
        expect(singleRes.body.code).toBe('CROSS_LAB_ASSIGNMENT_DENIED');
        expect(singleRes.body.error).toMatch(/Cannot assign to technician in different lab/i);
    });

    test('6. Workspace projection exposes accurate capabilities and nextAction reflecting readiness state', async () => {
        // For sampleApprId (now APPROVED)
        const wsApproved = await sampleWorkspaceService.getSampleWorkspace(sampleApprId, { role: 'LAB_MANAGER', labId: 'LAB-GTM' });
        expect(wsApproved.capabilities.canFinalApprove.allowed).toBe(false); // Already approved
        expect(wsApproved.capabilities.canArchive.allowed).toBe(true);
        expect(wsApproved.capabilities.canDispose.allowed).toBe(true);

        // For sample26Id (has unassigned tasks)
        const ws26 = await sampleWorkspaceService.getSampleWorkspace(sample26Id, { role: 'LAB_MANAGER', labId: 'LAB-GTM' });
        expect(ws26.capabilities.canFinalApprove.allowed).toBe(false);
        expect(ws26.nextAction.action).toBe('ASSIGN');
    });
});
