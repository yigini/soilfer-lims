const request = require('supertest');
const app = require('../../app');
const prisma = require('../../prisma');
const { getAuthToken } = require('../setup');

describe('WP-15: Blocking vs Advisory Scientific Matrix Diagnostics', () => {
    let token, testSampleId;

    beforeAll(async () => {
        token = await getAuthToken('LAB_MANAGER', 'GTM-LAB1', ['GTM'], ['SOILFER-US']);
    });

    beforeEach(async () => {
        testSampleId = `SMP-MX-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        await prisma.sample.create({
            data: {
                id: testSampleId,
                originalId: `ORIG-${testSampleId}`,
                status: 'PROCESSING',
                assignedLab: 'GTM-LAB1',
                labId: 'GTM-LAB1',
                country: 'GTM'
            }
        });
    });

    afterEach(async () => {
        if (testSampleId) {
            await prisma.result.deleteMany({ where: { sampleId: testSampleId } }).catch(() => {});
            await prisma.auditLog.deleteMany({ where: { sampleId: testSampleId } }).catch(() => {});
            await prisma.sample.delete({ where: { id: testSampleId } }).catch(() => {});
        }
    });

    test('1. Invalid texture closure (Sand+Silt+Clay = 87%) is strictly BLOCKED (HTTP 422)', async () => {
        // Seed invalid texture results
        await prisma.result.createMany({
            data: [
                { id: `r1-${Date.now()}`, sampleId: testSampleId, param: 'SAND', value: '40', numericValue: 40, isCurrent: true },
                { id: `r2-${Date.now()}`, sampleId: testSampleId, param: 'SILT', value: '30', numericValue: 30, isCurrent: true },
                { id: `r3-${Date.now()}`, sampleId: testSampleId, param: 'CLAY', value: '17', numericValue: 17, isCurrent: true } // sum = 87%
            ]
        });

        const res = await request(app)
            .post(`/api/results/${testSampleId}/submit`)
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(422);
        expect(res.body.error).toBe('BLOCKING_MATRIX_DIAGNOSTICS');
        expect(res.body.blockingErrors).toBeDefined();
        expect(res.body.blockingErrors.some(e => e.check === 'TEXTURE_CLOSURE')).toBe(true);

        // Verify sample status remains PROCESSING (not submitted)
        const s = await prisma.sample.findUnique({ where: { id: testSampleId } });
        expect(s.status).toBe('PROCESSING');
    });

    test('2. Valid texture with advisory C:N warning (C:N = 45) SUCCEEDS with warnings', async () => {
        // Seed valid texture (40 + 40 + 20 = 100%) and high C:N (SOC=90, TN=2 -> C:N=45)
        await prisma.result.createMany({
            data: [
                { id: `r1-${Date.now()}`, sampleId: testSampleId, param: 'SAND', value: '40', numericValue: 40, isCurrent: true },
                { id: `r2-${Date.now()}`, sampleId: testSampleId, param: 'SILT', value: '40', numericValue: 40, isCurrent: true },
                { id: `r3-${Date.now()}`, sampleId: testSampleId, param: 'CLAY', value: '20', numericValue: 20, isCurrent: true },
                { id: `r4-${Date.now()}`, sampleId: testSampleId, param: 'SOC', value: '90', numericValue: 90, unit: 'g/kg', isCurrent: true },
                { id: `r5-${Date.now()}`, sampleId: testSampleId, param: 'TN', value: '2', numericValue: 2, unit: 'g/kg', isCurrent: true }
            ]
        });

        const res = await request(app)
            .post(`/api/results/${testSampleId}/submit`)
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.status).toBe('SUBMITTED_FULL');
        expect(res.body.matrixDiagnostics.warnings.length).toBeGreaterThan(0);

        // Verify sample status moved to SUBMITTED_FULL
        const s = await prisma.sample.findUnique({ where: { id: testSampleId } });
        expect(s.status).toBe('SUBMITTED_FULL');
    });
});
