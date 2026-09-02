const request = require('supertest');
const app = require('../../app');
const prisma = require('../../prisma');
const { getAuthToken } = require('../setup');

describe('SD-09: Work Item Status Transition Validation Contract', () => {
    let mgrGtmToken, techGtmToken;
    const sampleId = 'SMP-SD09-TEST-01';
    const wiId = 'WI-SD09-PH-01';
    const techUsername = 'test_lab_technician_labgtm';

    beforeAll(async () => {
        mgrGtmToken = await getAuthToken('LAB_MANAGER', 'LAB-GTM', ['GTM'], ['SOILFER-US']);
        techGtmToken = await getAuthToken('LAB_TECHNICIAN', 'LAB-GTM', ['GTM'], ['SOILFER-US']);

        // Clean up
        await prisma.workItem.deleteMany({ where: { sampleId } });
        await prisma.sample.deleteMany({ where: { id: sampleId } });

        // Sample in PROCESSING with preparation complete
        await prisma.sample.create({
            data: {
                id: sampleId,
                originalId: sampleId,
                assignedLab: 'LAB-GTM',
                labId: 'LAB-GTM',
                country: 'GTM',
                projectCode: 'SOILFER-US',
                status: 'PROCESSING',
                matrix: 'SOIL',
                dryingStatus: 'DONE',
                preparationStatus: 'DONE',
                requiredAnalyses: JSON.stringify(['PH_H2O'])
            }
        });

        // WorkItem in ASSIGNED state assigned to techUsername
        await prisma.workItem.create({
            data: {
                id: wiId,
                sampleId,
                labId: 'LAB-GTM',
                assignedLab: 'LAB-GTM',
                analysis: 'PH_H2O',
                category: 'Wet Chemistry',
                status: 'ASSIGNED',
                assignedTo: techUsername
            }
        });
    });

    afterAll(async () => {
        await prisma.workItem.deleteMany({ where: { sampleId } });
        await prisma.sample.deleteMany({ where: { id: sampleId } });
    });

    test('1. Legal move (ASSIGNED → IN_PROGRESS) succeeds (HTTP 200)', async () => {
        const res = await request(app)
            .put(`/api/work/${wiId}/status`)
            .set('Authorization', `Bearer ${techGtmToken}`)
            .send({ status: 'IN_PROGRESS' });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);

        const wi = await prisma.workItem.findUnique({ where: { id: wiId } });
        expect(wi.status).toBe('IN_PROGRESS');
    });

    test('2. Illegal backward jump (IN_PROGRESS → NOT_ASSIGNED) returns HTTP 409 Conflict', async () => {
        const res = await request(app)
            .put(`/api/work/${wiId}/status`)
            .set('Authorization', `Bearer ${mgrGtmToken}`)
            .send({ status: 'NOT_ASSIGNED' });

        expect(res.status).toBe(409);
        expect(res.body.error).toMatch(/Illegal status transition: IN_PROGRESS → NOT_ASSIGNED/i);
    });

    test('3. Illegal jump from final ACCEPTED state (ACCEPTED → IN_PROGRESS) returns HTTP 409 Conflict', async () => {
        // Force work item to ACCEPTED
        await prisma.workItem.update({
            where: { id: wiId },
            data: { status: 'ACCEPTED' }
        });

        const res = await request(app)
            .put(`/api/work/${wiId}/status`)
            .set('Authorization', `Bearer ${mgrGtmToken}`)
            .send({ status: 'IN_PROGRESS' });

        expect(res.status).toBe(409);
        expect(res.body.error).toMatch(/Illegal status transition: ACCEPTED → IN_PROGRESS/i);
    });
});
