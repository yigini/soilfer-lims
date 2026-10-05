const { cleanupWorkflowFixtures } = require("../helpers/workflowFixtures");
const { createSampleFixture, createWorkItemFixture } = require('../helpers/workflowFixtures');
const request = require('supertest');
const app = require('../../app');
const prisma = require('../../prisma');
const { getAuthToken } = require('../setup');

describe('SD-10: Mandatory Reason on Rejection and Reopening Contract', () => {
    let mgrGtmToken;
    const sampleId = 'SMP-SD10-TEST-01';
    const wiId = 'WI-SD10-PH-01';
    const approvedSampleId = `${sampleId}-approved`;

    beforeAll(async () => {
        mgrGtmToken = await getAuthToken('LAB_MANAGER', 'LAB-GTM', ['GTM'], ['SOILFER-US']);

        // Clean up
        await prisma.auditLog.deleteMany({ where: { sampleId } });
        await cleanupWorkflowFixtures(prisma, "workItem", (await prisma.workItem.findMany({ ...({ where: { sampleId } }), select: { id: true } })).map(row => row.id), { single: false });
        await cleanupWorkflowFixtures(prisma, "sample", (await prisma.sample.findMany({ ...({ where: { id: sampleId } }), select: { id: true } })).map(row => row.id), { single: false });

        // Manager return operates on submitted work before final approval.
        await createSampleFixture(prisma, {
            data: {
                id: sampleId,
                originalId: sampleId,
                assignedLab: 'LAB-GTM',
                labId: 'LAB-GTM',
                country: 'GTM',
                projectCode: 'SOILFER-US',
                status: 'SUBMITTED_FULL',
                matrix: 'SOIL',
                dryingStatus: 'DONE',
                preparationStatus: 'DONE',
                requiredAnalyses: JSON.stringify(['PH_H2O'])
            }
        });
        await createSampleFixture(prisma, { data: { id: approvedSampleId, originalId: approvedSampleId,
            assignedLab: 'LAB-GTM', status: 'APPROVED', dryingStatus: 'DONE', preparationStatus: 'DONE' } });

        // Create work item in SUBMITTED state
        await createWorkItemFixture(prisma, {
            data: {
                id: wiId,
                sampleId,
                labId: 'LAB-GTM',
                assignedLab: 'LAB-GTM',
                analysis: 'PH_H2O',
                category: 'Wet Chemistry',
                status: 'SUBMITTED'
            }
        });
    });

    afterAll(async () => {
        await prisma.auditLog.deleteMany({ where: { sampleId: approvedSampleId } });
        await cleanupWorkflowFixtures(prisma, "sample", (await prisma.sample.findMany({ ...({ where: { id: approvedSampleId } }), select: { id: true } })).map(row => row.id), { single: false });
        await prisma.auditLog.deleteMany({ where: { sampleId } });
        await cleanupWorkflowFixtures(prisma, "workItem", (await prisma.workItem.findMany({ ...({ where: { sampleId } }), select: { id: true } })).map(row => row.id), { single: false });
        await cleanupWorkflowFixtures(prisma, "sample", (await prisma.sample.findMany({ ...({ where: { id: sampleId } }), select: { id: true } })).map(row => row.id), { single: false });
    });

    test('1. Calling reviewWorkItem with REJECT and no note/reason returns HTTP 400', async () => {
        const res = await request(app)
            .post(`/api/work/${wiId}/review`)
            .set('Authorization', `Bearer ${mgrGtmToken}`)
            .send({
                decision: 'REJECT'
            });

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/A reason is required when rejecting work for reanalysis/i);

        // Verify status has NOT changed
        const wi = await prisma.workItem.findUnique({ where: { id: wiId } });
        expect(wi.status).toBe('SUBMITTED');
    });

    test('2. Calling reviewWorkItem with REJECT and note records note in reanalysisReason (HTTP 200)', async () => {
        const rejectionNote = 'Duplicate electrode drift exceeded ±0.2 pH tolerance';
        const res = await request(app)
            .post(`/api/work/${wiId}/review`)
            .set('Authorization', `Bearer ${mgrGtmToken}`)
            .send({
                decision: 'REJECT',
                note: rejectionNote
            });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);

        const wi = await prisma.workItem.findUnique({ where: { id: wiId } });
        expect(wi.status).toBe('REPEAT_REQUIRED');
        expect(wi.reanalysisReason).toBe(rejectionNote);
    });

    test('3. Calling undoApproval without a reason requires an amendment', async () => {
        const res = await request(app)
            .post(`/api/samples/${approvedSampleId}/undo-approve`)
            .set('Authorization', `Bearer ${mgrGtmToken}`)
            .send({});

        expect(res.status).toBe(409);
        expect(res.body.code).toBe('AMENDMENT_WORKFLOW_REQUIRED');

        // Sample status remains APPROVED
        const sample = await prisma.sample.findUnique({ where: { id: approvedSampleId } });
        expect(sample.status).toBe('APPROVED');
    });

    test('4. Calling undoApproval with a reason preserves approval and audit evidence', async () => {
        const before = await prisma.sample.findUnique({ where: { id: approvedSampleId } });
        const beforeAudits = await prisma.auditLog.findMany({ where: { sampleId: approvedSampleId }, orderBy: { id: 'asc' } });
        const reopenReason = 'Customer requested additional organic carbon verification';
        const res = await request(app)
            .post(`/api/samples/${approvedSampleId}/undo-approve`)
            .set('Authorization', `Bearer ${mgrGtmToken}`)
            .send({
                reason: reopenReason
            });

        expect(res.status).toBe(409);
        expect(res.body.code).toBe('AMENDMENT_WORKFLOW_REQUIRED');

        const sample = await prisma.sample.findUnique({ where: { id: approvedSampleId } });
        expect(sample).toEqual(before);
        expect(await prisma.auditLog.findMany({ where: { sampleId: approvedSampleId }, orderBy: { id: 'asc' } })).toEqual(beforeAudits);
    });
});
