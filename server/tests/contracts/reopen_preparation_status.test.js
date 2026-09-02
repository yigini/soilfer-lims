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
        await prisma.workItem.deleteMany({ where: { sampleId: { in: [sampleNullId, sampleDoneId] } } });
        await prisma.sample.deleteMany({ where: { id: { in: [sampleNullId, sampleDoneId] } } });

        // Sample with NULL drying and prep (bypassed / legacy import)
        await prisma.sample.create({
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
        await prisma.sample.create({
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
        await prisma.workItem.deleteMany({ where: { sampleId: { in: [sampleNullId, sampleDoneId] } } });
        await prisma.sample.deleteMany({ where: { id: { in: [sampleNullId, sampleDoneId] } } });
    });

    test('1. Reopening a sample with NULL preparation status leaves them NULL', async () => {
        const res = await request(app)
            .put(`/api/samples/${sampleNullId}/analyses`)
            .set('Authorization', `Bearer ${mgrGtmToken}`)
            .send({
                analyses: ['PH_H2O', 'EC']
            });

        expect(res.status).toBe(200);

        const sample = await prisma.sample.findUnique({ where: { id: sampleNullId } });
        expect(sample.status).toBe('PROCESSING');
        expect(sample.dryingStatus).toBeNull();
        expect(sample.preparationStatus).toBeNull();
    });

    test('2. Reopening a sample with DONE preparation status leaves them DONE', async () => {
        const res = await request(app)
            .put(`/api/samples/${sampleDoneId}/analyses`)
            .set('Authorization', `Bearer ${mgrGtmToken}`)
            .send({
                analyses: ['PH_H2O', 'EC']
            });

        expect(res.status).toBe(200);

        const sample = await prisma.sample.findUnique({ where: { id: sampleDoneId } });
        expect(sample.status).toBe('PROCESSING');
        expect(sample.dryingStatus).toBe('DONE');
        expect(sample.preparationStatus).toBe('DONE');
    });

    test('3. Undoing approval on sample with NULL preparation status preserves NULL', async () => {
        // Put sampleNullId back to APPROVED to test undoApproval path
        await prisma.sample.update({
            where: { id: sampleNullId },
            data: { status: 'APPROVED' }
        });

        const res = await request(app)
            .post(`/api/samples/${sampleNullId}/undo-approve`)
            .set('Authorization', `Bearer ${mgrGtmToken}`)
            .send({ reason: 'Audit verification test' });

        expect(res.status).toBe(200);

        const sample = await prisma.sample.findUnique({ where: { id: sampleNullId } });
        expect(sample.dryingStatus).toBeNull();
        expect(sample.preparationStatus).toBeNull();
    });
});
