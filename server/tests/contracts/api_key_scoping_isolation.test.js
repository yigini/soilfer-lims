const request = require('supertest');
const app = require('../../app');
const prisma = require('../../prisma');
const crypto = require('crypto');

describe('API Key Scoping Isolation Contract (SL-22 Security Fix)', () => {
    const keyGtmToken = 'slims_live_test_gtm_isolation';
    const keyMozToken = 'slims_live_test_moz_isolation';
    const keyUnscopedToken = 'slims_live_test_unscoped_isolation';

    const sampleGtmId = 'TEST-ISO-SMP-GTM';
    const sampleMozId = 'TEST-ISO-SMP-MOZ';

    beforeAll(async () => {
        // Cleanup
        await prisma.result.deleteMany({
            where: { sampleId: { in: [sampleGtmId, sampleMozId] } }
        });
        await prisma.spectralData.deleteMany({
            where: { sampleId: { in: [sampleGtmId, sampleMozId] } }
        });
        await prisma.sample.deleteMany({
            where: { id: { in: [sampleGtmId, sampleMozId] } }
        });
        await prisma.apiKey.deleteMany({
            where: { id: { in: ['test-iso-key-gtm', 'test-iso-key-moz', 'test-iso-key-unscoped'] } }
        });

        // Create API keys
        const hashGtm = crypto.createHash('sha256').update(keyGtmToken).digest('hex');
        await prisma.apiKey.create({
            data: {
                id: 'test-iso-key-gtm',
                name: 'Key GTM',
                keyHash: hashGtm,
                keyPrefix: 'slims_live_iso_gtm',
                labs: JSON.stringify(['LAB-GTM']),
                isActive: true
            }
        });

        const hashMoz = crypto.createHash('sha256').update(keyMozToken).digest('hex');
        await prisma.apiKey.create({
            data: {
                id: 'test-iso-key-moz',
                name: 'Key MOZ',
                keyHash: hashMoz,
                keyPrefix: 'slims_live_iso_moz',
                labs: JSON.stringify(['LAB-MOZ']),
                isActive: true
            }
        });

        const hashUnscoped = crypto.createHash('sha256').update(keyUnscopedToken).digest('hex');
        await prisma.apiKey.create({
            data: {
                id: 'test-iso-key-unscoped',
                name: 'Key Unscoped',
                keyHash: hashUnscoped,
                keyPrefix: 'slims_live_iso_unscoped',
                labs: null, // Absent scope
                isActive: true
            }
        });

        // Create sample in GTM
        await prisma.sample.create({
            data: {
                id: sampleGtmId,
                originalId: sampleGtmId,
                labId: 'LAB-GTM',
                assignedLab: 'LAB-GTM',
                status: 'APPROVED',
                matrix: 'SOIL',
                metadata: JSON.stringify({ latitude: 14.6, longitude: -90.5 })
            }
        });

        // Create sample in MOZ
        await prisma.sample.create({
            data: {
                id: sampleMozId,
                originalId: sampleMozId,
                labId: 'LAB-MOZ',
                assignedLab: 'LAB-MOZ',
                status: 'APPROVED',
                matrix: 'SOIL',
                metadata: JSON.stringify({ latitude: -18.6, longitude: 35.5 })
            }
        });

        // Create results
        await prisma.result.createMany({
            data: [
                {
                    id: 'res-iso-gtm-1',
                    sampleId: sampleGtmId,
                    param: 'pH',
                    value: '6.5',
                    numericValue: 6.5,
                    isCurrent: true,
                    provenance: 'MEASURED'
                },
                {
                    id: 'res-iso-moz-1',
                    sampleId: sampleMozId,
                    param: 'pH',
                    value: '5.2',
                    numericValue: 5.2,
                    isCurrent: true,
                    provenance: 'MEASURED'
                }
            ]
        });
    });

    afterAll(async () => {
        await prisma.result.deleteMany({
            where: { sampleId: { in: [sampleGtmId, sampleMozId] } }
        });
        await prisma.spectralData.deleteMany({
            where: { sampleId: { in: [sampleGtmId, sampleMozId] } }
        });
        await prisma.sample.deleteMany({
            where: { id: { in: [sampleGtmId, sampleMozId] } }
        });
        await prisma.apiKey.deleteMany({
            where: { id: { in: ['test-iso-key-gtm', 'test-iso-key-moz', 'test-iso-key-unscoped'] } }
        });
    });

    test('1. Unscoped API key (absent labs) is strictly DENIED across all shared endpoints', async () => {
        // /samples
        const resSamples = await request(app)
            .get('/api/v1/data-exchange/samples')
            .set('X-API-KEY', keyUnscopedToken);
        expect(resSamples.status).toBe(200);
        expect(resSamples.body.data.length).toBe(0);

        // /results
        const resResults = await request(app)
            .get('/api/v1/data-exchange/results')
            .set('X-API-KEY', keyUnscopedToken);
        expect(resResults.status).toBe(200);
        expect(resResults.body.data.length).toBe(0);

        // /geojson
        const resGeo = await request(app)
            .get('/api/v1/data-exchange/geojson')
            .set('X-API-KEY', keyUnscopedToken);
        expect(resGeo.status).toBe(200);
        expect(resGeo.body.features.length).toBe(0);

        // /sync
        const resSync = await request(app)
            .get('/api/v1/data-exchange/sync?updatedSince=2020-01-01T00:00:00Z')
            .set('X-API-KEY', keyUnscopedToken);
        expect(resSync.status).toBe(200);
        expect(resSync.body.samples.length).toBe(0);
        expect(resSync.body.spectra.length).toBe(0);

        // /stats
        const resStats = await request(app)
            .get('/api/v1/data-exchange/stats')
            .set('X-API-KEY', keyUnscopedToken);
        expect(resStats.status).toBe(200);
        expect(resStats.body.metrics.totalSamples).toBe(0);

        // /samples/:id
        const resDetail = await request(app)
            .get(`/api/v1/data-exchange/samples/${sampleGtmId}`)
            .set('X-API-KEY', keyUnscopedToken);
        expect(resDetail.status).toBe(404);
    });

    test('2. Key scoped to LAB-GTM can read GTM data but CANNOT read LAB-MOZ data', async () => {
        // /samples
        const resSamples = await request(app)
            .get('/api/v1/data-exchange/samples')
            .set('X-API-KEY', keyGtmToken);
        expect(resSamples.status).toBe(200);
        expect(resSamples.body.data.some(s => s.id === sampleGtmId)).toBe(true);
        expect(resSamples.body.data.some(s => s.id === sampleMozId)).toBe(false);

        // /results
        const resResults = await request(app)
            .get('/api/v1/data-exchange/results')
            .set('X-API-KEY', keyGtmToken);
        expect(resResults.status).toBe(200);
        expect(resResults.body.data.some(r => r.sample_id === sampleGtmId)).toBe(true);
        expect(resResults.body.data.some(r => r.sample_id === sampleMozId)).toBe(false);

        // /samples/:id on MOZ sample -> 404
        const resMozDetail = await request(app)
            .get(`/api/v1/data-exchange/samples/${sampleMozId}`)
            .set('X-API-KEY', keyGtmToken);
        expect(resMozDetail.status).toBe(404);

        // /samples/:id on GTM sample -> 200
        const resGtmDetail = await request(app)
            .get(`/api/v1/data-exchange/samples/${sampleGtmId}`)
            .set('X-API-KEY', keyGtmToken);
        expect(resGtmDetail.status).toBe(200);
        expect(resGtmDetail.body.data.id).toBe(sampleGtmId);
    });
});
