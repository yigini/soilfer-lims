jest.mock('dotenv', () => ({ config: () => ({ parsed: {} }) }));

const request = require('supertest');
const prisma = require('../../prisma');
const app = require('../../app');
const { createSampleFixture, createAuthTokenFixture } = require('../helpers/workflowFixtures');

describe('R2 route-wide laboratory isolation', () => {
    const ids = {
        labA: 'R2-LAB-A', labB: 'R2-LAB-B',
        projectA: 'R2-PROJECT-A', projectB: 'R2-PROJECT-B',
        sampleA: 'R2-SAMPLE-A', sampleB: 'R2-SAMPLE-B',
    };
    let managerB, technicianB, globalAdmin, nationalUser;

    beforeAll(async () => {
        for (const suffix of ['A', 'B']) {
            const labId = ids[`lab${suffix}`];
            const projectId = ids[`project${suffix}`];
            await prisma.lab.create({ data: { id: labId, code: labId, name: `Synthetic laboratory ${suffix}`, country: 'GTM' } });
            await prisma.project.create({ data: { id: projectId, code: projectId, name: `Synthetic project ${suffix}`, status: 'ACTIVE', labId } });
            await prisma.projectLab.create({ data: { projectCode: projectId, labId } });
            await createSampleFixture(prisma, { data: {
                id: ids[`sample${suffix}`], originalId: `R2-ORIGINAL-${suffix}`,
                projectId, projectCode: projectId, labId, assignedLab: labId,
                country: 'GTM', countryName: 'Guatemala', status: 'PROCESSING',
            } });
        }
        // A laboratory principal remains valid without optional country/project
        // claims. Its labId must still constrain every route, including totals.
        managerB = await createAuthTokenFixture(prisma, 'LAB_MANAGER', ids.labB, [], []);
        technicianB = await createAuthTokenFixture(prisma, 'LAB_TECHNICIAN', ids.labB, [], []);
        globalAdmin = await createAuthTokenFixture(prisma, 'SUPER_ADMIN', null, [], []);
        nationalUser = await createAuthTokenFixture(prisma, 'MASTER_USER', ids.labB, ['GTM'], []);
    });

    afterAll(async () => { await prisma.$disconnect(); });

    for (const role of ['manager', 'technician']) {
        test(`${role} dashboard totals include only its laboratory`, async () => {
            const token = role === 'manager' ? managerB : technicianB;
            const response = await request(app).get('/api/dashboard/stats')
                .set('Authorization', `Bearer ${token}`);
            expect(response.status).toBe(200);
            expect(response.body.totalSamples).toBe(1);
            expect(response.body.inProgress).toBe(1);
        });

        test(`${role} cannot select another laboratory through the project filter`, async () => {
            const token = role === 'manager' ? managerB : technicianB;
            const response = await request(app).get('/api/dashboard/stats')
                .query({ projectId: ids.projectA }).set('Authorization', `Bearer ${token}`);
            expect(response.status).toBe(200);
            expect(response.body.totalSamples).toBe(0);
            expect(response.body.inProgress).toBe(0);
        });
    }

    test('SUPER_ADMIN retains cross-laboratory dashboard visibility', async () => {
        const response = await request(app).get('/api/dashboard/stats')
            .query({ projectId: ids.projectA }).set('Authorization', `Bearer ${globalAdmin}`);
        expect(response.status).toBe(200);
        expect(response.body.totalSamples).toBe(1);
    });

    test('MASTER_USER retains cross-laboratory visibility within its country', async () => {
        const response = await request(app).get('/api/dashboard/stats')
            .query({ projectId: ids.projectA }).set('Authorization', `Bearer ${nationalUser}`);
        expect(response.status).toBe(200);
        expect(response.body.totalSamples).toBe(1);
    });
});
