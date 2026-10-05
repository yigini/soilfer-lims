const { cleanupWorkflowFixtures } = require("../helpers/workflowFixtures");
const { createSampleFixture } = require('../helpers/workflowFixtures');
const request = require('supertest');
const app = require('../../app');
const prisma = require('../../prisma');
const { getAuthToken } = require('../setup');

describe('SD-08: Stop Fabricating Preparation Records on Reopen Contract', () => {
    let mgrGtmToken;
    const sampleNullId = 'SMP-SD08-NULL-01';
    const sampleDoneId = 'SMP-SD08-DONE-01';

    beforeAll(async () => {
        mgrGtmToken = await getAuthToken('LAB_MANAGER', 'LAB-GTM', ['GTM'], ['SOILFER-US']);

        // Clean up
        await cleanupWorkflowFixtures(prisma, "workItem", (await prisma.workItem.findMany({ ...({ where: { sampleId: { in: [sampleNullId, sampleDoneId] } } }), select: { id: true } })).map(row => row.id), { single: false });
        await cleanupWorkflowFixtures(prisma, "sample", (await prisma.sample.findMany({ ...({ where: { id: { in: [sampleNullId, sampleDoneId] } } }), select: { id: true } })).map(row => row.id), { single: false });

        // Sample with NULL drying and prep (bypassed / legacy import)
        await createSampleFixture(prisma, {
            data: {
                id: sampleNullId,
                originalId: sampleNullId,
                assignedLab: 'LAB-GTM',
                labId: 'LAB-GTM',
                country: 'GTM',
                projectCode: 'SOILFER-US',
                status: 'APPROVED',
                matrix: 'SOIL',
                dryingStatus: null,
                preparationStatus: null,
                requiredAnalyses: JSON.stringify(['PH_H2O'])
            }
        });

        // Sample with DONE drying and prep
        await createSampleFixture(prisma, {
            data: {
                id: sampleDoneId,
                originalId: sampleDoneId,
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
    });

    afterAll(async () => {
        await cleanupWorkflowFixtures(prisma, "workItem", (await prisma.workItem.findMany({ ...({ where: { sampleId: { in: [sampleNullId, sampleDoneId] } } }), select: { id: true } })).map(row => row.id), { single: false });
        await cleanupWorkflowFixtures(prisma, "sample", (await prisma.sample.findMany({ ...({ where: { id: { in: [sampleNullId, sampleDoneId] } } }), select: { id: true } })).map(row => row.id), { single: false });
    });

    test('1. Adding orders to an approved sample refuses without fabricating NULL preparation evidence', async () => {
        const before = await prisma.sample.findUnique({ where: { id: sampleNullId } });
        const res = await request(app)
            .put(`/api/samples/${sampleNullId}/analyses`)
            .set('Authorization', `Bearer ${mgrGtmToken}`)
            .send({
                analyses: ['PH_H2O', 'EC']
            });

        expect(res.status).toBe(409);
        expect(res.body.code).toBe('AMENDMENT_WORKFLOW_REQUIRED');

        const sample = await prisma.sample.findUnique({ where: { id: sampleNullId } });
        expect(sample).toEqual(before);
        expect(sample.status).toBe('APPROVED');
        expect(sample.dryingStatus).toBeNull();
        expect(sample.preparationStatus).toBeNull();
    });

    test('2. Adding orders to an approved sample preserves DONE preparation evidence', async () => {
        const before = await prisma.sample.findUnique({ where: { id: sampleDoneId } });
        const res = await request(app)
            .put(`/api/samples/${sampleDoneId}/analyses`)
            .set('Authorization', `Bearer ${mgrGtmToken}`)
            .send({
                analyses: ['PH_H2O', 'EC']
            });

        expect(res.status).toBe(409);
        expect(res.body.code).toBe('AMENDMENT_WORKFLOW_REQUIRED');

        const sample = await prisma.sample.findUnique({ where: { id: sampleDoneId } });
        expect(sample).toEqual(before);
        expect(sample.status).toBe('APPROVED');
        expect(sample.dryingStatus).toBe('DONE');
        expect(sample.preparationStatus).toBe('DONE');
    });

    test('3. Refused undo preserves approval and NULL preparation evidence', async () => {
        const before = await prisma.sample.findUnique({ where: { id: sampleNullId } });
        const beforeAudits = await prisma.auditLog.findMany({ where: { sampleId: sampleNullId }, orderBy: { id: 'asc' } });

        const res = await request(app)
            .post(`/api/samples/${sampleNullId}/undo-approve`)
            .set('Authorization', `Bearer ${mgrGtmToken}`)
            .send({ reason: 'Audit verification test' });

        expect(res.status).toBe(409);
        expect(res.body.code).toBe('AMENDMENT_WORKFLOW_REQUIRED');

        const sample = await prisma.sample.findUnique({ where: { id: sampleNullId } });
        expect(sample).toEqual(before);
        expect(await prisma.auditLog.findMany({ where: { sampleId: sampleNullId }, orderBy: { id: 'asc' } })).toEqual(beforeAudits);
        expect(sample.dryingStatus).toBeNull();
        expect(sample.preparationStatus).toBeNull();
    });
});
