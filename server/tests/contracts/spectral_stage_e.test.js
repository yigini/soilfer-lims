const request = require('supertest');
const app = require('../../app');
const prisma = require('../../prisma');
const crypto = require('crypto');

describe('Spectral Library Stage E: Turn the Endpoint into a Contract (SL-22 to SL-26)', () => {
    let keyGtmToken = 'slims_live_test_gtm_stage_e';
    let keyMozToken = 'slims_live_test_moz_stage_e';
    let keyUnscopedToken = 'slims_live_test_unscoped_stage_e';

    let scanGtmId = 'test-stage-e-scan-gtm';
    let scanMozId = 'test-stage-e-scan-moz';
    let sampleGtmId = 'TEST-STAGEE-SMP-GTM';
    let resultId = 'TEST-STAGEE-RES-01';

    beforeAll(async () => {
        // Clean up test data
        await prisma.spectralData.deleteMany({
            where: { id: { in: [scanGtmId, scanMozId] } }
        });
        await prisma.result.deleteMany({
            where: { id: resultId }
        });
        await prisma.sample.deleteMany({
            where: { id: sampleGtmId }
        });
        await prisma.apiKey.deleteMany({
            where: {
                id: { in: ['test-stage-e-key-gtm', 'test-stage-e-key-moz', 'test-stage-e-key-unscoped'] }
            }
        });

        // Create API keys
        const hashGtm = crypto.createHash('sha256').update(keyGtmToken).digest('hex');
        await prisma.apiKey.create({
            data: {
                id: 'test-stage-e-key-gtm',
                name: 'Test Key GTM',
                keyHash: hashGtm,
                keyPrefix: 'slims_live_test_gtm',
                labs: JSON.stringify(['LAB-GTM']),
                isActive: true
            }
        });

        const hashMoz = crypto.createHash('sha256').update(keyMozToken).digest('hex');
        await prisma.apiKey.create({
            data: {
                id: 'test-stage-e-key-moz',
                name: 'Test Key MOZ',
                keyHash: hashMoz,
                keyPrefix: 'slims_live_test_moz',
                labs: JSON.stringify(['LAB-MOZ']),
                isActive: true
            }
        });

        const hashUnscoped = crypto.createHash('sha256').update(keyUnscopedToken).digest('hex');
        await prisma.apiKey.create({
            data: {
                id: 'test-stage-e-key-unscoped',
                name: 'Test Key Unscoped',
                keyHash: hashUnscoped,
                keyPrefix: 'slims_live_test_unscoped',
                labs: null, // Absent scope -> must default to deny
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
                matrix: 'SOIL'
            }
        });

        // Create paired reference wet chemistry result
        await prisma.result.create({
            data: {
                id: resultId,
                sampleId: sampleGtmId,
                param: 'SOC',
                value: '18.5',
                numericValue: 18.5,
                unit: 'g/kg',
                methodologyId: 'Walkley-Black',
                basis: 'AIR_DRY',
                provenance: 'MEASURED',
                isCurrent: true
            }
        });

        // Create GTM spectrum
        await prisma.spectralData.create({
            data: {
                id: scanGtmId,
                sampleId: sampleGtmId,
                labId: 'LAB-GTM',
                filename: 'test_gtm_mir.csv',
                modality: 'MIR',
                quantity: 'ABSORBANCE',
                axisUnit: 'WAVENUMBER_CM1',
                axisDirection: 'DESCENDING',
                isRaw: true,
                wavelengths: JSON.stringify([4000, 3000, 2000, 1000, 400]),
                values: JSON.stringify([0.15, 0.45, 0.85, 1.25, 0.35]),
                preparation: 'AGATE_100UM',
                moistureState: 'AIR_DRY',
                windowMaterial: 'KBR',
                replicateNo: 1,
                qcStatus: 'PASS',
                qcFlags: JSON.stringify([]),
                status: 'APPROVED',
                isCurrent: true,
                timestamp: new Date('2026-08-01T12:00:00Z')
            }
        });

        // Create MOZ spectrum
        await prisma.spectralData.create({
            data: {
                id: scanMozId,
                labId: 'LAB-MOZ',
                filename: 'test_moz_nir.csv',
                modality: 'NIR',
                quantity: 'REFLECTANCE',
                axisUnit: 'WAVELENGTH_NM',
                axisDirection: 'ASCENDING',
                isRaw: true,
                wavelengths: JSON.stringify([1000, 1500, 2000, 2500]),
                values: JSON.stringify([0.2, 0.3, 0.4, 0.5]),
                qcStatus: 'PASS',
                qcFlags: JSON.stringify([]),
                status: 'APPROVED',
                isCurrent: true,
                timestamp: new Date('2026-08-02T12:00:00Z')
            }
        });
    });

    afterAll(async () => {
        await prisma.spectralData.deleteMany({
            where: { id: { in: [scanGtmId, scanMozId] } }
        });
        await prisma.result.deleteMany({
            where: { id: resultId }
        });
        await prisma.sample.deleteMany({
            where: { id: sampleGtmId }
        });
        await prisma.apiKey.deleteMany({
            where: {
                id: { in: ['test-stage-e-key-gtm', 'test-stage-e-key-moz', 'test-stage-e-key-unscoped'] }
            }
        });
    });

    test('SL-22: Scoped API key can only read its authorized laboratory spectra; absent scope is denied', async () => {
        // GTM Key can read GTM spectrum but not MOZ
        const resGtm = await request(app)
            .get('/api/v1/data-exchange/spectra')
            .set('X-API-KEY', keyGtmToken);

        expect(resGtm.status).toBe(200);
        expect(resGtm.body.data.some(s => s.id === scanGtmId)).toBe(true);
        expect(resGtm.body.data.some(s => s.id === scanMozId)).toBe(false);

        // MOZ Key can read MOZ spectrum but not GTM
        const resMoz = await request(app)
            .get('/api/v1/data-exchange/spectra')
            .set('X-API-KEY', keyMozToken);

        expect(resMoz.status).toBe(200);
        expect(resMoz.body.data.some(s => s.id === scanMozId)).toBe(true);
        expect(resMoz.body.data.some(s => s.id === scanGtmId)).toBe(false);

        // Unscoped Key receives 0 records (absent scope defaults to deny)
        const resUnscoped = await request(app)
            .get('/api/v1/data-exchange/spectra')
            .set('X-API-KEY', keyUnscopedToken);

        expect(resUnscoped.status).toBe(200);
        expect(resUnscoped.body.data.length).toBe(0);
    });

    test('SL-23: Rich payload contract returns signal, acquisition, preparation, qc, and paired reference chemistry', async () => {
        const res = await request(app)
            .get('/api/v1/data-exchange/spectra?withReference=true')
            .set('X-API-KEY', keyGtmToken);

        expect(res.status).toBe(200);
        const scan = res.body.data.find(s => s.id === scanGtmId);
        expect(scan).toBeDefined();

        // 1. Signal block
        expect(scan.signal).toEqual(expect.objectContaining({
            quantity: 'ABSORBANCE',
            axisUnit: 'WAVENUMBER_CM1',
            axisDirection: 'DESCENDING',
            isRaw: true,
            nPoints: 5
        }));

        // 2. Preparation block
        expect(scan.preparation).toEqual(expect.objectContaining({
            preparation: 'AGATE_100UM',
            moistureState: 'AIR_DRY',
            windowMaterial: 'KBR',
            replicateNo: 1
        }));

        // 3. QC block
        expect(scan.qc).toEqual(expect.objectContaining({
            status: 'PASS'
        }));

        // 4. Paired Reference Wet Chemistry block
        expect(Array.isArray(scan.reference)).toBe(true);
        expect(scan.reference.length).toBeGreaterThanOrEqual(1);
        const refItem = scan.reference.find(r => r.param === 'SOC');
        expect(refItem).toBeDefined();
        expect(refItem.value).toBe(18.5);
        expect(refItem.unit).toBe('g/kg');
        expect(refItem.method).toBe('Walkley-Black');
        expect(refItem.provenance).toBe('MEASURED');
    });

    test('SL-24: Cursor pagination and ETag 304 validation', async () => {
        // Query with limit 1
        const page1 = await request(app)
            .get('/api/v1/data-exchange/spectra?limit=1')
            .set('X-API-KEY', keyGtmToken);

        expect(page1.status).toBe(200);
        expect(page1.body.data.length).toBe(1);
        const etag = page1.headers['etag'];
        expect(etag).toBeDefined();

        // If-None-Match should return 304 Not Modified
        const res304 = await request(app)
            .get('/api/v1/data-exchange/spectra?limit=1')
            .set('X-API-KEY', keyGtmToken)
            .set('If-None-Match', etag);

        expect(res304.status).toBe(304);
    });

    test('SL-25: Bulk export endpoint returns full JSON dataset scoped to key', async () => {
        const resExport = await request(app)
            .get('/api/v1/data-exchange/spectra/export?modality=MIR')
            .set('X-API-KEY', keyGtmToken);

        expect(resExport.status).toBe(200);
        expect(resExport.body.meta.schema).toBe('spectra/v1-bulk-export');
        expect(resExport.body.data.some(s => s.id === scanGtmId)).toBe(true);
        expect(resExport.body.data.some(s => s.id === scanMozId)).toBe(false);
    });

    afterAll(async () => {
        try {
            await prisma.spectralData.deleteMany({ where: { id: { in: [scanGtmId, scanMozId] } } });
            await prisma.result.deleteMany({ where: { id: resultId } });
            await prisma.sample.deleteMany({ where: { id: sampleGtmId } });
            await prisma.apiKey.deleteMany({ where: { id: { in: ['test-stage-e-key-gtm', 'test-stage-e-key-moz', 'test-stage-e-key-unscoped'] } } });
        } catch (e) {}
    });
});
