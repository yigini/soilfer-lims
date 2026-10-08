const { cleanupWorkflowFixtures } = require("../helpers/workflowFixtures");
const { createSampleFixture, createWorkItemFixture } = require('../helpers/workflowFixtures');
const { createExecutionResultFixture } = require('../helpers/workAttemptFixtures');
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

    // Pin6060110991: retain the recorded execution and its parents until owned database teardown.
    async function rejectionSnapshot() {
        return {
            sample: await prisma.sample.findUnique({ where: { id: sampleId } }),
            work: await prisma.workItem.findMany({ where: { sampleId }, orderBy: { id: 'asc' } }),
            results: await prisma.result.findMany({ where: { sampleId }, orderBy: { id: 'asc' } }),
            attempts: await prisma.workAttempt.findMany({ where: { workItemId: wiId }, orderBy: { id: 'asc' } }),
            decisions: await prisma.reviewDecision.findMany({ where: { sampleId }, orderBy: { id: 'asc' } }),
            events: await prisma.resultEvidenceEvent.findMany({ where: { sampleId }, orderBy: { id: 'asc' } }),
            audits: await prisma.auditLog.findMany({ where: { sampleId }, orderBy: { id: 'asc' } }),
            submissions: await prisma.submission.findMany({ where: { sampleId }, orderBy: { id: 'asc' } }),
            drafts: await prisma.workItemDraft.findMany({ where: { workItemId: wiId }, orderBy: { id: 'asc' } }),
            receipts: await prisma.commandReceipt.findMany({ where: { targetResource: wiId }, orderBy: { id: 'asc' } })
        };
    }

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

    test('2a. REJECT with a note and no analytical attempt refuses with zero writes', async () => {
        const before = await rejectionSnapshot();
        const res = await request(app)
            .post(`/api/work/${wiId}/review`)
            .set('Authorization', `Bearer ${mgrGtmToken}`)
            .send({ decision: 'REJECT', note: 'Duplicate electrode drift exceeded ±0.2 pH tolerance' });
        expect(res.status).toBe(409);
        expect(res.body.code).toBe('REVIEW_ATTEMPT_REQUIRED');
        expect(await rejectionSnapshot()).toEqual(before);
    });

    test('2b. Calling reviewWorkItem with REJECT and note records note in reanalysisReason (HTTP 200)', async () => {
        // Pin6060110991: 6.5 is a synthetic fixture value for the rejection-note contract.
        await createExecutionResultFixture(prisma, { attemptStatus: 'SUBMITTED', data: {
            id: 'RES-SD10-PH-01', sampleId, param: 'PH_H2O', value: '6.5', unit: 'pH',
            provenance: 'MEASURED', isCurrent: true } });
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
