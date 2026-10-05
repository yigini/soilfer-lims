const { cleanupWorkflowFixtures } = require("../helpers/workflowFixtures");
const { createSampleFixture, createWorkItemFixture } = require('../helpers/workflowFixtures');
const request = require('supertest');
const app = require('../../app');
const prisma = require('../../prisma');
const { transitionWorkItem } = require('../../services/workItemStateService');
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
        await cleanupWorkflowFixtures(prisma, "workItem", (await prisma.workItem.findMany({ ...({ where: { sampleId } }), select: { id: true } })).map(row => row.id), { single: false });
        await cleanupWorkflowFixtures(prisma, "sample", (await prisma.sample.findMany({ ...({ where: { id: sampleId } }), select: { id: true } })).map(row => row.id), { single: false });

        // Sample in PROCESSING with preparation complete
        await createSampleFixture(prisma, {
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
        await createWorkItemFixture(prisma, {
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
        await cleanupWorkflowFixtures(prisma, "workItem", (await prisma.workItem.findMany({ ...({ where: { sampleId } }), select: { id: true } })).map(row => row.id), { single: false });
        await cleanupWorkflowFixtures(prisma, "sample", (await prisma.sample.findMany({ ...({ where: { id: sampleId } }), select: { id: true } })).map(row => row.id), { single: false });
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
        for (const status of ['COMPLETED', 'SUBMITTED', 'ACCEPTED']) {
            await transitionWorkItem(wiId, status, require('jsonwebtoken').decode(mgrGtmToken), 'Reviewed fixture determination');
        }

        const res = await request(app)
            .put(`/api/work/${wiId}/status`)
            .set('Authorization', `Bearer ${mgrGtmToken}`)
            .send({ status: 'IN_PROGRESS' });

        expect(res.status).toBe(409);
        expect(res.body.error).toMatch(/Illegal status transition: ACCEPTED → IN_PROGRESS/i);
    });
});
