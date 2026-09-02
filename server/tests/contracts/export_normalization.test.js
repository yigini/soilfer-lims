const request = require('supertest');
const app = require('../../app');
const { getAuthToken } = require('../setup');
const { samplesDb } = require('../../db');
const prisma = require('../../prisma');

describe('WP-22: Dual Export Paths (As-Measured & Normalized Controlled Units)', () => {
    let superAdminToken, sampleId, testSample;

    beforeAll(async () => {
        superAdminToken = await getAuthToken('SUPER_ADMIN', null, ['*'], ['*']);

        testSample = samplesDb.create({
            id: `SMP-EXP-${Date.now()}`,
            labId: 'LAB-EXP-001',
            originalId: `ORIG-EXP-${Date.now()}`,
            assignedLab: 'LAB-DEFAULT',
            status: 'APPROVED',
            projectCode: 'EXP-PROJ',
            country: 'GTM',
            countryName: 'Guatemala',
            requiredAnalyses: ['SOC']
        });
        sampleId = testSample.id;

        const now = new Date();
        await prisma.result.create({
            data: {
                id: `RES-EXP-${Date.now()}`,
                sampleId: testSample.id,
                param: 'SOC',
                value: '1.8',
                unit: '%',
                isValid: true,
                createdAt: now,
                updatedAt: now
            }
        });
    });

    test('1. Export controller emits dual columns (soc_as_measured, soc_unit, soc_normalized, soc_controlled_unit)', async () => {
        const res = await request(app)
            .post('/api/exports/data')
            .set('Authorization', `Bearer ${superAdminToken}`)
            .send({
                type: 'WET_CHEM',
                includeUnapproved: true
            });

        expect(res.status).toBe(200);
        expect(res.body.data).toBeDefined();

        const exportedSample = res.body.data.find(r => r['Sample ID'] === testSample.originalId || r['Sample ID'] === testSample.id);
        expect(exportedSample).toBeDefined();

        expect(exportedSample['soc_as_measured']).toBe(1.8);
        expect(exportedSample['soc_unit']).toBe('%');
        expect(exportedSample['soc_normalized']).toBe(18.0);
        expect(exportedSample['soc_controlled_unit']).toBe('g/kg');
        // Legacy column alias points to normalized value
        expect(exportedSample['SOC']).toBe(18.0);
    });

    test('2. SIS GeoJSON export emits dual columns in flat properties', async () => {
        await prisma.sample.update({
            where: { id: sampleId },
            data: {
                metadata: JSON.stringify({
                    latitude: 14.6349,
                    longitude: -90.5069,
                    depth: '0-20 cm'
                })
            }
        });

        const res = await request(app)
            .get('/api/v1/sis/geojson')
            .set('Authorization', `Bearer ${superAdminToken}`);

        expect(res.status).toBe(200);
        expect(res.body.type).toBe('FeatureCollection');

        const feat = res.body.features.find(f => f.properties.id === testSample.originalId || f.properties.id === testSample.id);
        expect(feat).toBeDefined();
        expect(feat.properties.soc_as_measured).toBe(1.8);
        expect(feat.properties.soc_unit).toBe('%');
        expect(feat.properties.soc_normalized).toBe(18.0);
        expect(feat.properties.soc_controlled_unit).toBe('g/kg');
    });
});
