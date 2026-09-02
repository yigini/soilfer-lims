const request = require('supertest');
const app = require('../../app');
const prisma = require('../../prisma');
const { getAuthToken } = require('../setup');

describe('SD-05: Server-Side Prerequisite Gate Contract', () => {
    let mgrGtmToken, techGtmToken;
    const sampleId = 'SMP-SD05-TEST-01';
    const wiId = 'WI-SD05-PH-01';
    const techUsername = 'test_lab_technician_labgtm';

    beforeAll(async () => {
        mgrGtmToken = await getAuthToken('LAB_MANAGER', 'LAB-GTM', ['GTM'], ['SOILFER-US']);
        techGtmToken = await getAuthToken('LAB_TECHNICIAN', 'LAB-GTM', ['GTM'], ['SOILFER-US']);

        // Clean up
        await prisma.result.deleteMany({ where: { sampleId } });
        await prisma.workItem.deleteMany({ where: { sampleId } });
        await prisma.sample.deleteMany({ where: { id: sampleId } });

        // Create sample in PROCESSING, with preparation NOT completed
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
                dryingStatus: 'PENDING',
                preparationStatus: 'PENDING',
                requiredAnalyses: JSON.stringify(['PH_H2O'])
            }
        });

        // Create unassigned work item
        await prisma.workItem.create({
            data: {
                id: wiId,
                sampleId,
                labId: 'LAB-GTM',
                assignedLab: 'LAB-GTM',
                analysis: 'PH_H2O',
                category: 'Wet Chemistry',
                status: 'NOT_ASSIGNED'
            }
        });
    });

    afterAll(async () => {
        await prisma.result.deleteMany({ where: { sampleId } });
        await prisma.workItem.deleteMany({ where: { sampleId } });
        await prisma.sample.deleteMany({ where: { id: sampleId } });
    });

    test('1. Assigning a work item on an un-prepared sample succeeds (HTTP 200)', async () => {
        const res = await request(app)
            .post('/api/work/assign')
            .set('Authorization', `Bearer ${mgrGtmToken}`)
            .send({
                workItemIds: [wiId],
                assignee: techUsername
            });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);

        const updated = await prisma.workItem.findUnique({ where: { id: wiId } });
        expect(updated.status).toBe('ASSIGNED');
        expect(updated.assignedTo).toBe(techUsername);
    });

    test('2. Starting work on an un-prepared sample is refused with HTTP 412 Precondition Failed', async () => {
        // Direct call to startWork
        const res = await request(app)
            .post(`/api/work/${wiId}/start`)
            .set('Authorization', `Bearer ${techGtmToken}`)
            .send();

        expect(res.status).toBe(412);
        expect(res.body.error).toMatch(/Sample preparation has not been completed/i);

        // Verify status remains ASSIGNED
        const wi = await prisma.workItem.findUnique({ where: { id: wiId } });
        expect(wi.status).toBe('ASSIGNED');
    });

    test('3. Direct call to saveResults without preparation returns HTTP 412 Precondition Failed', async () => {
        const res = await request(app)
            .post(`/api/results/${sampleId}`)
            .set('Authorization', `Bearer ${techGtmToken}`)
            .send({
                measurements: [
                    { param: 'PH_H2O', value: '6.8', unit: 'pH_units' }
                ]
            });

        expect(res.status).toBe(412);
        expect(res.body.error).toMatch(/Sample preparation has not been completed/i);
    });

    test('4. Completing preparation allows startWork to succeed (HTTP 200)', async () => {
        // Complete drying and prep on sample
        await prisma.sample.update({
            where: { id: sampleId },
            data: {
                dryingStatus: 'DONE',
                preparationStatus: 'DONE'
            }
        });

        const res = await request(app)
            .post(`/api/work/${wiId}/start`)
            .set('Authorization', `Bearer ${techGtmToken}`)
            .send();

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);

        const wi = await prisma.workItem.findUnique({ where: { id: wiId } });
        expect(wi.status).toBe('IN_PROGRESS');
    });

    test('5. Saving results now succeeds with preparation completed (HTTP 200)', async () => {
        const res = await request(app)
            .post(`/api/results/${sampleId}`)
            .set('Authorization', `Bearer ${techGtmToken}`)
            .send({
                measurements: [
                    { param: 'PH_H2O', value: '6.8', unit: 'pH_units' }
                ]
            });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });
});
