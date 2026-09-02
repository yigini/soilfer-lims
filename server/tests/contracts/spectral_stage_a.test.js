const request = require('supertest');
const app = require('../../app');
const prisma = require('../../prisma');
const { getAuthToken } = require('../setup');

describe('Spectral Library Stage A (SL-01 to SL-05)', () => {
    let mgrGtmToken;
    let mgrMozToken;
    let sampleGtmId;
    let sampleMozId;

    beforeAll(async () => {
        // Ensure test users and samples exist
        await prisma.spectralData.deleteMany({
            where: { id: { startsWith: 'test-spec-' } }
        });
        await prisma.sample.deleteMany({
            where: { id: { startsWith: 'TEST-SPEC-SMP-' } }
        });

        mgrGtmToken = await getAuthToken('LAB_MANAGER', 'LAB-GTM', ['GTM'], ['SOILFER-US']);
        mgrMozToken = await getAuthToken('LAB_MANAGER', 'LAB-MOZ', ['MOZ'], ['SOILFER-US']);

        // Create sample in GTM
        sampleGtmId = 'TEST-SPEC-SMP-GTM-01';
        await prisma.sample.create({
            data: {
                id: sampleGtmId,
                originalId: sampleGtmId,
                assignedLab: 'LAB-GTM',
                labId: 'LAB-GTM',
                status: 'APPROVED',
                matrix: 'SOIL'
            }
        });

        // Create sample in MOZ
        sampleMozId = 'TEST-SPEC-SMP-MOZ-01';
        await prisma.sample.create({
            data: {
                id: sampleMozId,
                originalId: sampleMozId,
                assignedLab: 'LAB-MOZ',
                labId: 'LAB-MOZ',
                status: 'APPROVED',
                matrix: 'SOIL'
            }
        });

        // Create test spectra in GTM
        await prisma.spectralData.create({
            data: {
                id: 'test-spec-gtm-nir',
                sampleId: sampleGtmId,
                labId: 'LAB-GTM',
                modality: 'NIR',
                filename: 'scan_gtm_nir.csv',
                wavelengths: JSON.stringify([1000, 1100, 1200, 1300, 1400, 1500, 1600, 1700, 1800, 1900, 2000]),
                values: JSON.stringify([0.1, 0.12, 0.15, 0.18, 0.22, 0.25, 0.28, 0.31, 0.35, 0.38, 0.4]),
                status: 'APPROVED',
                qcStatus: 'PASS',
                metadata: JSON.stringify({
                    axisDirection: 'ASCENDING',
                    axisUnit: 'WAVELENGTH_NM',
                    quantity: 'REFLECTANCE'
                })
            }
        });

        // Create test spectra in MOZ
        await prisma.spectralData.create({
            data: {
                id: 'test-spec-moz-mir',
                sampleId: sampleMozId,
                labId: 'LAB-MOZ',
                modality: 'MIR',
                filename: 'scan_moz_mir.csv',
                wavelengths: JSON.stringify([4000, 3500, 3000, 2500, 2000, 1500, 1000, 500, 400]),
                values: JSON.stringify([0.05, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8]),
                status: 'VALIDATED',
                qcStatus: 'PASS',
                metadata: JSON.stringify({
                    axisDirection: 'DESCENDING',
                    axisUnit: 'WAVENUMBER_CM1',
                    quantity: 'ABSORBANCE'
                })
            }
        });
    });

    afterAll(async () => {
        await prisma.spectralData.deleteMany({
            where: { id: { startsWith: 'test-spec-' } }
        });
        await prisma.sample.deleteMany({
            where: { id: { startsWith: 'TEST-SPEC-SMP-' } }
        });
    });

    test('SL-01: GET /api/spectral returns 200 without ReferenceError and applies lab scoping', async () => {
        const resGtm = await request(app)
            .get('/api/spectral')
            .set('Authorization', `Bearer ${mgrGtmToken}`);

        expect(resGtm.status).toBe(200);
        expect(resGtm.body.success).toBe(true);
        expect(Array.isArray(resGtm.body.data)).toBe(true);
        // All returned records must belong to LAB-GTM
        resGtm.body.data.forEach(scan => {
            expect(['LAB-GTM', 'GTM']).toContain(scan.labId);
        });

        const resMoz = await request(app)
            .get('/api/spectral')
            .set('Authorization', `Bearer ${mgrMozToken}`);

        expect(resMoz.status).toBe(200);
        expect(resMoz.body.success).toBe(true);
        resMoz.body.data.forEach(scan => {
            expect(['LAB-MOZ', 'MOZ']).toContain(scan.labId);
        });
    });

    test('SL-02: Native Axis Ingest preserves descending order for MIR', async () => {
        // Prepare descending wavenumbers (4000 -> 400 cm-1)
        const descendingWavenumbers = [4000, 3600, 3200, 2800, 2400, 2000, 1600, 1200, 800, 400];
        const absorbanceValues = [0.1, 0.15, 0.22, 0.18, 0.30, 0.25, 0.45, 0.35, 0.20, 0.12];

        const uploadRes = await request(app)
            .post('/api/spectral/batch')
            .set('Authorization', `Bearer ${mgrGtmToken}`)
            .send({
                scans: [
                    {
                        filename: 'test_alpha_mir_descending.csv',
                        labId: sampleGtmId,
                        modality: 'MIR',
                        wavelengths: descendingWavenumbers,
                        values: absorbanceValues
                    }
                ]
            });

        expect(uploadRes.status).toBe(200);
        expect(uploadRes.body.results.success).toBe(1);

        // Fetch the scan and verify the stored order
        const createdScan = await prisma.spectralData.findFirst({
            where: {
                sampleId: sampleGtmId,
                filename: 'test_alpha_mir_descending.csv'
            }
        });
        expect(createdScan).toBeDefined();

        const storedWavelengths = JSON.parse(createdScan.wavelengths);
        expect(storedWavelengths).toEqual(descendingWavenumbers);
        expect(storedWavelengths[0]).toBe(4000);
        expect(storedWavelengths[storedWavelengths.length - 1]).toBe(400);

        const meta = JSON.parse(createdScan.metadata);
        expect(meta.axisDirection).toBe('DESCENDING');
        expect(meta.axisUnit).toBe('WAVENUMBER_CM1');
        expect(meta.quantity).toBe('ABSORBANCE');
    });

    test('SL-04: Pagination and server-side stats endpoint', async () => {
        // 1. Pagination parameters
        const pageRes = await request(app)
            .get('/api/spectral')
            .set('Authorization', `Bearer ${mgrGtmToken}`)
            .query({ page: 1, limit: 1 });

        expect(pageRes.status).toBe(200);
        expect(pageRes.body.data.length).toBeLessThanOrEqual(1);
        expect(pageRes.body.page).toBe(1);
        expect(pageRes.body.total).toBeGreaterThanOrEqual(1);
        expect(pageRes.body.totalPages).toBeGreaterThanOrEqual(1);

        // 2. Server stats endpoint
        const statsRes = await request(app)
            .get('/api/spectral/stats')
            .set('Authorization', `Bearer ${mgrGtmToken}`);

        expect(statsRes.status).toBe(200);
        expect(statsRes.body.success).toBe(true);
        expect(statsRes.body.data).toHaveProperty('total');
        expect(statsRes.body.data).toHaveProperty('nir');
        expect(statsRes.body.data).toHaveProperty('mir');
        expect(statsRes.body.data).toHaveProperty('approved');
        expect(typeof statsRes.body.data.total).toBe('number');
    });
});
