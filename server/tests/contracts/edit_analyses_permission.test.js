const request = require('supertest');
const app = require('../../app');
const prisma = require('../../prisma');
const { getAuthToken } = require('../setup');
const { PERMISSIONS } = require('../../config/roles');

describe('SD-06: EDIT_ANALYSES Permission Gate Contract', () => {
    let receptionToken, techToken;
    const sampleId = 'SMP-SD06-TEST-01';

    beforeAll(async () => {
        // SAMPLE_RECEPTION has EDIT_ANALYSES and RECEIVE_SAMPLE, but NOT APPROVE_RESULTS
        receptionToken = await getAuthToken('SAMPLE_RECEPTION', 'LAB-GTM', ['GTM'], ['SOILFER-US']);
        // LAB_TECHNICIAN has CHANGE_STATUS and ENTER_RESULTS, but NOT EDIT_ANALYSES
        techToken = await getAuthToken('LAB_TECHNICIAN', 'LAB-GTM', ['GTM'], ['SOILFER-US']);

        // Clean up
        await prisma.workItem.deleteMany({ where: { sampleId } });
        await prisma.sample.deleteMany({ where: { id: sampleId } });

        // Create sample in GTM
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
                requiredAnalyses: JSON.stringify(['PH_H2O'])
            }
        });
    });

    afterAll(async () => {
        await prisma.workItem.deleteMany({ where: { sampleId } });
        await prisma.sample.deleteMany({ where: { id: sampleId } });
    });

    test('1. EDIT_ANALYSES is registered in roles.js and includes SAMPLE_RECEPTION and LAB_MANAGER', () => {
        expect(PERMISSIONS.EDIT_ANALYSES).toBeDefined();
        expect(PERMISSIONS.EDIT_ANALYSES).toContain('SAMPLE_RECEPTION');
        expect(PERMISSIONS.EDIT_ANALYSES).toContain('LAB_MANAGER');
        expect(PERMISSIONS.EDIT_ANALYSES).toContain('SUPER_ADMIN');
        expect(PERMISSIONS.EDIT_ANALYSES).toContain('MASTER_USER');
        expect(PERMISSIONS.EDIT_ANALYSES).not.toContain('LAB_TECHNICIAN');
    });

    test('2. User with EDIT_ANALYSES (SAMPLE_RECEPTION) can update sample analyses (HTTP 200)', async () => {
        const res = await request(app)
            .put(`/api/samples/${sampleId}/analyses`)
            .set('Authorization', `Bearer ${receptionToken}`)
            .send({
                analyses: ['PH_H2O', 'SOC']
            });

        expect(res.status).toBe(200);
        expect(res.body.added).toContain('SOC');

        const updated = await prisma.sample.findUnique({ where: { id: sampleId } });
        expect(updated.requiredAnalyses).toContain('SOC');
    });

    test('3. User without EDIT_ANALYSES (LAB_TECHNICIAN) is refused with HTTP 403 Forbidden', async () => {
        const res = await request(app)
            .put(`/api/samples/${sampleId}/analyses`)
            .set('Authorization', `Bearer ${techToken}`)
            .send({
                analyses: ['PH_H2O']
            });

        expect(res.status).toBe(403);
        expect(res.body.error).toMatch(/Access denied|Forbidden|Insufficient permissions/i);
    });
});
