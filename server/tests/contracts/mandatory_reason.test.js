const request = require('supertest');
const app = require('../../app');
const prisma = require('../../prisma');
const { getAuthToken } = require('../setup');

describe('SD-10: Mandatory Reason on Rejection and Reopening Contract', () => {
    let mgrGtmToken;
    const sampleId = 'SMP-SD10-TEST-01';
    const wiId = 'WI-SD10-PH-01';

    beforeAll(async () => {
        mgrGtmToken = await getAuthToken('LAB_MANAGER', 'LAB-GTM', ['GTM'], ['SOILFER-US']);

        // Clean up
        await prisma.auditLog.deleteMany({ where: { sampleId } });
        await prisma.workItem.deleteMany({ where: { sampleId } });
        await prisma.sample.deleteMany({ where: { id: sampleId } });

        // Create sample in APPROVED state
        await prisma.sample.create({
            data: {
                id: sampleId,
                originalId: sampleId,
                assignedLab: 'LAB-GTM',
                labId: 'LAB-GTM',
                country: 'GTM',
                projectCode: 'SOILFER-US',
                status: 'APPROVED',
                matrix: 'SOIL',
                dryingStatus: 'DONE',
                preparationStatus: 'DONE',
                requiredAnalyses: JSON.stringify(['PH_H2O'])
            }
        });

        // Create work item in SUBMITTED state
        await prisma.workItem.create({
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
        await prisma.auditLog.deleteMany({ where: { sampleId } });
        await prisma.workItem.deleteMany({ where: { sampleId } });
        await prisma.sample.deleteMany({ where: { id: sampleId } });
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
        expect(wi.status).toBe('REANALYSIS_REQUIRED');
        expect(wi.reanalysisReason).toBe(rejectionNote);
    });

    test('3. Calling undoApproval with no reason returns HTTP 400', async () => {
        const res = await request(app)
            .post(`/api/samples/${sampleId}/undo-approve`)
            .set('Authorization', `Bearer ${mgrGtmToken}`)
            .send({});

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/A reason is required when reopening a finished sample/i);

        // Sample status remains APPROVED
        const sample = await prisma.sample.findUnique({ where: { id: sampleId } });
        expect(sample.status).toBe('APPROVED');
    });

    test('4. Calling undoApproval with reason records reason in audit log (HTTP 200)', async () => {
        const reopenReason = 'Customer requested additional organic carbon verification';
        const res = await request(app)
            .post(`/api/samples/${sampleId}/undo-approve`)
            .set('Authorization', `Bearer ${mgrGtmToken}`)
            .send({
                reason: reopenReason
            });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);

        const sample = await prisma.sample.findUnique({ where: { id: sampleId } });
        expect(sample.status).toBe('PROCESSING');

        // Verify audit log contains the reason
        const audit = await prisma.auditLog.findFirst({
            where: {
                sampleId,
                action: 'UNDO_APPROVAL'
            },
            orderBy: { timestamp: 'desc' }
        });

        expect(audit).not.toBeNull();
        expect(audit.details).toContain(reopenReason);
    });
});
