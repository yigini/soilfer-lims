const request = require('supertest');
const app = require('../../app');
const prisma = require('../../prisma');
const { getAuthToken } = require('../setup');
const fs = require('fs');
const path = require('path');

describe('Spectral Library Stage B (SL-06 to SL-12)', () => {
    let mgrGtmToken;
    let sampleGtmId;
    let spectrometerId;

    beforeAll(async () => {
        // Clean up any test fixtures
        await prisma.spectralData.deleteMany({
            where: { id: { startsWith: 'test-spec-b-' } }
        });
        await prisma.sample.deleteMany({
            where: { id: { startsWith: 'TEST-STAGEB-SMP-' } }
        });
        await prisma.equipmentAsset.deleteMany({
            where: { id: { startsWith: 'TEST-EQ-SPEC-' } }
        });

        mgrGtmToken = await getAuthToken('LAB_MANAGER', 'LAB-GTM', ['GTM'], ['SOILFER-US']);

        // Create sample in GTM
        sampleGtmId = 'TEST-STAGEB-SMP-01';
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

        // Create spectrometer asset in GTM
        spectrometerId = 'TEST-EQ-SPEC-01';
        await prisma.equipmentAsset.create({
            data: {
                id: spectrometerId,
                labId: 'LAB-GTM',
                assetType: 'SPECTROMETER',
                name: 'Alpha II FT-IR Spectrometer',
                manufacturer: 'Bruker',
                model: 'Alpha II',
                serialNumber: 'SN-ALPHA-2026',
                status: 'IN_SERVICE',
                criticality: 'CRITICAL'
            }
        });
    });

    afterAll(async () => {
        await prisma.spectralData.deleteMany({
            where: { id: { startsWith: 'test-spec-b-' } }
        });
        await prisma.sample.deleteMany({
            where: { id: { startsWith: 'TEST-STAGEB-SMP-' } }
        });
        await prisma.equipmentAsset.deleteMany({
            where: { id: { startsWith: 'TEST-EQ-SPEC-' } }
        });
    });

    test('SL-06 & SL-08 & SL-09 & SL-10: Ingest stores raw file, links equipment, and saves typed metadata', async () => {
        const rawCsv = 'wavelength,absorbance\n4000,0.12\n3000,0.25\n2000,0.45\n1000,0.30\n400,0.15';
        const wavelengths = [4000, 3000, 2000, 1000, 400];
        const values = [0.12, 0.25, 0.45, 0.30, 0.15];

        const uploadRes = await request(app)
            .post('/api/spectral/batch')
            .set('Authorization', `Bearer ${mgrGtmToken}`)
            .send({
                scans: [
                    {
                        filename: 'alpha_mir_sample01_rep1.csv',
                        labId: sampleGtmId,
                        modality: 'MIR',
                        quantity: 'ABSORBANCE',
                        wavelengths,
                        values,
                        rawContent: rawCsv,
                        equipmentId: spectrometerId,
                        resolution: 4.0,
                        coAddedScans: 32,
                        accessory: 'DRIFT',
                        backgroundRef: 'GOLD',
                        detector: 'DTGS',
                        beamsplitter: 'KBR',
                        preparation: 'BALL_MILLED',
                        moistureState: 'AIR_DRY',
                        replicateNo: 1
                    }
                ]
            });

        expect(uploadRes.status).toBe(200);
        expect(uploadRes.body.results.success).toBe(1);

        const scan = await prisma.spectralData.findFirst({
            where: { sampleId: sampleGtmId, filename: 'alpha_mir_sample01_rep1.csv' }
        });
        expect(scan).toBeDefined();

        // SL-06: Raw file storage & sha256
        expect(scan.sourceFile).toBeDefined();
        expect(scan.sha256).toBeDefined();
        expect(scan.sourceFormat).toBe('CSV');
        expect(scan.parserVersion).toBe('1.0.0');

        const fullDiskPath = path.join(__dirname, '..', '..', scan.sourceFile);
        expect(fs.existsSync(fullDiskPath)).toBe(true);
        const diskContent = fs.readFileSync(fullDiskPath, 'utf8');
        expect(diskContent).toBe(rawCsv);

        // SL-07: Typed signal & quantity
        expect(scan.quantity).toBe('ABSORBANCE');
        expect(scan.axisUnit).toBe('WAVENUMBER_CM1');
        expect(scan.axisDirection).toBe('DESCENDING');
        expect(scan.isRaw).toBe(true);

        // SL-08: Equipment register link
        expect(scan.equipmentId).toBe(spectrometerId);

        // SL-09: Optical acquisition
        expect(scan.resolution).toBe(4.0);
        expect(scan.coAddedScans).toBe(32);
        expect(scan.accessory).toBe('DRIFT');
        expect(scan.backgroundRef).toBe('GOLD');
        expect(scan.detector).toBe('DTGS');
        expect(scan.beamsplitter).toBe('KBR');

        // SL-10: Sample presentation
        expect(scan.preparation).toBe('BALL_MILLED');
        expect(scan.moistureState).toBe('AIR_DRY');
        expect(scan.replicateNo).toBe(1);
        expect(scan.isCurrent).toBe(true);

        // SL-06: Test download raw file endpoint
        const downloadRes = await request(app)
            .get(`/api/spectral/${scan.id}/raw`)
            .set('Authorization', `Bearer ${mgrGtmToken}`);

        expect(downloadRes.status).toBe(200);
        expect(downloadRes.text).toBe(rawCsv);
        expect(downloadRes.headers['etag']).toBe(scan.sha256);
    });

    test('SL-07: Cannot approve spectrum if physical quantity is UNVERIFIED', async () => {
        // Create an unverified scan
        const unverifiedScan = await prisma.spectralData.create({
            data: {
                id: 'test-spec-b-unverified',
                sampleId: sampleGtmId,
                labId: 'LAB-GTM',
                modality: 'MIR',
                filename: 'mystery_scan.csv',
                wavelengths: JSON.stringify([4000, 2000, 400]),
                values: JSON.stringify([0.1, 0.2, 0.3]),
                quantity: 'UNVERIFIED',
                axisUnit: 'WAVENUMBER_CM1',
                status: 'VALIDATED',
                isCurrent: true
            }
        });

        const reviewRes = await request(app)
            .post(`/api/spectral/${unverifiedScan.id}/review`)
            .set('Authorization', `Bearer ${mgrGtmToken}`)
            .send({ action: 'APPROVE' });

        expect(reviewRes.status).toBe(400);
        expect(reviewRes.body.error).toContain('physical quantity must be confirmed');
    });

    test('SL-11: Checksum Deduplication rejects identical file in same lab', async () => {
        const rawCsv = 'wavelength,absorbance\n4000,0.12\n3000,0.25\n2000,0.45\n1000,0.30\n400,0.15';
        const wavelengths = [4000, 3000, 2000, 1000, 400];
        const values = [0.12, 0.25, 0.45, 0.30, 0.15];

        // Attempt duplicate upload of exact same content
        const dupRes = await request(app)
            .post('/api/spectral/batch')
            .set('Authorization', `Bearer ${mgrGtmToken}`)
            .send({
                scans: [
                    {
                        filename: 'duplicate_attempt.csv',
                        labId: sampleGtmId,
                        modality: 'MIR',
                        wavelengths,
                        values,
                        rawContent: rawCsv
                    }
                ]
            });

        expect(dupRes.status).toBe(200);
        expect(dupRes.body.results.skipped).toBe(1);
        const hasDupError = dupRes.body.results.errors.some(e => e.error && e.error.includes('Duplicate spectrum rejected'));
        expect(hasDupError).toBe(true);
    });

    test('SL-12: Supersession marks prior scan isCurrent: false and supersedes', async () => {
        // Upload a new determination/rescan for the same sample, modality, and replicateNo
        const rescanWavelengths = [4000, 3500, 3000, 2500, 2000, 1500, 1000, 500, 400];
        const rescanValues = [0.11, 0.18, 0.24, 0.35, 0.44, 0.38, 0.29, 0.20, 0.14];

        const rescanRes = await request(app)
            .post('/api/spectral/batch')
            .set('Authorization', `Bearer ${mgrGtmToken}`)
            .send({
                scans: [
                    {
                        filename: 'alpha_mir_sample01_rep1_rescan.csv',
                        labId: sampleGtmId,
                        modality: 'MIR',
                        wavelengths: rescanWavelengths,
                        values: rescanValues,
                        replicateNo: 1,
                        rescanReason: 'High noise on first acquisition'
                    }
                ]
            });

        expect(rescanRes.status).toBe(200);
        expect(rescanRes.body.results.success).toBe(1);

        // Fetch original scan and verify it is now superseded
        const originalScan = await prisma.spectralData.findFirst({
            where: { sampleId: sampleGtmId, filename: 'alpha_mir_sample01_rep1.csv' }
        });
        expect(originalScan.isCurrent).toBe(false);
        expect(originalScan.supersededBy).toBeDefined();
        expect(originalScan.supersededAt).toBeDefined();

        // Fetch the new rescan
        const newScan = await prisma.spectralData.findFirst({
            where: { sampleId: sampleGtmId, filename: 'alpha_mir_sample01_rep1_rescan.csv' }
        });
        expect(newScan.isCurrent).toBe(true);
        expect(newScan.supersedes).toBe(originalScan.id);

        // Verify GET /api/spectral only returns current scan by default
        const listRes = await request(app)
            .get('/api/spectral')
            .set('Authorization', `Bearer ${mgrGtmToken}`)
            .query({ search: sampleGtmId });

        expect(listRes.status).toBe(200);
        const scanIds = listRes.body.data.map(s => s.id);
        expect(scanIds).toContain(newScan.id);
        expect(scanIds).not.toContain(originalScan.id);

        // Verify includeSuperseded=true returns both
        const listAllRes = await request(app)
            .get('/api/spectral')
            .set('Authorization', `Bearer ${mgrGtmToken}`)
            .query({ search: sampleGtmId, includeSuperseded: 'true' });

        expect(listAllRes.status).toBe(200);
        const allScanIds = listAllRes.body.data.map(s => s.id);
        expect(allScanIds).toContain(newScan.id);
        expect(allScanIds).toContain(originalScan.id);
    });
});
