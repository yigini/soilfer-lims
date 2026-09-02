const request = require('supertest');
const app = require('../../app');
const prisma = require('../../prisma');
const { getAuthToken } = require('../setup');
const { validateSpectra, evaluateReplicateAgreement } = require('../../services/spectralValidation');
const { screenScanAgainstLibrary } = require('../../services/spectralOutlier');

describe('Spectral Library Stage D: Quality Control Worth the Name (SL-17 to SL-21)', () => {
    let mgrGtmToken;
    let sampleGtmId;
    let equipmentId;

    beforeAll(async () => {
        // Clean up test data
        await prisma.spectralData.deleteMany({
            where: {
                OR: [
                    { id: { startsWith: 'test-staged-' } },
                    { filename: { contains: 'stage_d' } }
                ]
            }
        });
        await prisma.equipmentAsset.deleteMany({
            where: { id: { startsWith: 'TEST-EQ-STAGED-' } }
        });
        await prisma.sample.deleteMany({
            where: { id: { startsWith: 'TEST-STAGED-SMP-' } }
        });

        mgrGtmToken = await getAuthToken('LAB_MANAGER', 'LAB-GTM', ['GTM'], ['SOILFER-US']);

        // Create instrument with specific tolerances
        equipmentId = 'TEST-EQ-STAGED-FTIR-01';
        await prisma.equipmentAsset.create({
            data: {
                id: equipmentId,
                labId: 'LAB-GTM',
                assetType: 'SPECTROMETER',
                name: 'Bruker Alpha II FTIR',
                status: 'IN_SERVICE',
                criticality: 'CRITICAL',
                qcLimits: JSON.stringify({
                    maxNoise: 0.03,
                    maxRmsd: 0.04
                })
            }
        });

        // Create sample in GTM
        sampleGtmId = 'TEST-STAGED-SMP-01';
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
    });

    afterAll(async () => {
        await prisma.spectralData.deleteMany({
            where: {
                OR: [
                    { id: { startsWith: 'test-staged-' } },
                    { filename: { contains: 'stage_d' } }
                ]
            }
        });
        await prisma.equipmentAsset.deleteMany({
            where: { id: { startsWith: 'TEST-EQ-STAGED-' } }
        });
        await prisma.sample.deleteMany({
            where: { id: { startsWith: 'TEST-STAGED-SMP-' } }
        });
    });

    test('SL-17: Quantity-aware validation passes valid absorbance of 1.4 without flagging HIGH_REFLECTANCE_VALUES', () => {
        const wavelengths = [4000, 3500, 3000, 2500, 2000, 1800, 1500, 1200, 800, 400];
        const values = [0.2, 0.4, 0.8, 1.2, 1.45, 1.3, 0.9, 0.5, 0.3, 0.1];

        // Validate as ABSORBANCE
        const resAbs = validateSpectra(wavelengths, values, 'MIR', { quantity: 'ABSORBANCE' });
        expect(resAbs.flags).not.toContain('HIGH_REFLECTANCE_VALUES');
        expect(resAbs.qcStatus).toBe('PASS');

        // Validate same values as REFLECTANCE -> must flag HIGH_REFLECTANCE_VALUES
        const resRef = validateSpectra(wavelengths, values, 'NIR', { quantity: 'REFLECTANCE' });
        expect(resRef.flags).toContain('HIGH_REFLECTANCE_VALUES');
        expect(resRef.qcStatus).toBe('WARN');
    });

    test('SL-18: Artifact detection catches local saturation, atmospheric CO2 residual, and detector splice', () => {
        // 1. Local saturation: 5 identical values
        const satW = [4000, 3600, 3200, 2800, 2400, 2000, 1600, 1200, 800, 400];
        const satV = [0.1, 0.2, 0.3, 1.5, 1.5, 1.5, 1.5, 1.5, 0.4, 0.2];
        const satRes = validateSpectra(satW, satV, 'MIR', { quantity: 'ABSORBANCE' });
        expect(satRes.flags).toContain('LOCAL_SATURATION');
        expect(satRes.qcStatus).toBe('FAIL');

        // 2. Atmospheric CO2 doublet residual in MIR (2300-2400 cm-1)
        const co2W = [];
        const co2V = [];
        for (let w = 4000; w >= 400; w -= 50) {
            co2W.push(w);
            const base = 0.15 + (4000 - w) * 0.0001;
            if (w === 2350) {
                co2V.push(base + 0.35); // Sharp CO2 atmospheric peak at 2350 cm-1
            } else {
                co2V.push(base);
            }
        }
        const co2Res = validateSpectra(co2W, co2V, 'MIR', { quantity: 'ABSORBANCE' });
        expect(co2Res.flags).toContain('ATMOSPHERIC_CO2_RESIDUAL');
        expect(co2Res.qcStatus).toBe('WARN');

        // 3. Detector Splice Step at 1000 nm in Vis-NIR
        const spliceW = [900, 950, 980, 990, 1000, 1010, 1020, 1050, 1100, 1200];
        const spliceV = [0.2, 0.21, 0.22, 0.23, 0.24, 0.38, 0.39, 0.40, 0.41, 0.42]; // 0.14 jump across 1000 nm
        const spliceRes = validateSpectra(spliceW, spliceV, 'NIR', { quantity: 'REFLECTANCE' });
        expect(spliceRes.flags).toContain('DETECTOR_SPLICE_STEP');
        expect(spliceRes.qcStatus).toBe('WARN');
    });

    test('SL-19: Replicate repeatability agreement flags RMS difference above limit', async () => {
        // Upload Replicate 1
        const w = [4000, 3600, 3200, 2800, 2400, 2000, 1600, 1200, 800, 400];
        const v1 = [0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.3, 0.2, 0.1];

        const upload1 = await request(app)
            .post('/api/spectral/batch')
            .set('Authorization', `Bearer ${mgrGtmToken}`)
            .send({
                scans: [{
                    filename: 'stage_d_rep1.csv',
                    labId: sampleGtmId,
                    modality: 'MIR',
                    quantity: 'ABSORBANCE',
                    replicateNo: 1,
                    equipmentId: equipmentId,
                    wavelengths: w,
                    values: v1
                }]
            });
        expect(upload1.body.results.success).toBe(1);

        // Upload Replicate 2 with large disagreement (>0.15 AU shift)
        const v2 = [0.35, 0.40, 0.45, 0.50, 0.55, 0.60, 0.65, 0.55, 0.45, 0.35];
        const upload2 = await request(app)
            .post('/api/spectral/batch')
            .set('Authorization', `Bearer ${mgrGtmToken}`)
            .send({
                scans: [{
                    filename: 'stage_d_rep2.csv',
                    labId: sampleGtmId,
                    modality: 'MIR',
                    quantity: 'ABSORBANCE',
                    replicateNo: 2,
                    equipmentId: equipmentId,
                    wavelengths: w,
                    values: v2
                }]
            });
        expect(upload2.body.results.success).toBe(1);

        const rep2Scan = await prisma.spectralData.findFirst({
            where: { filename: 'stage_d_rep2.csv' }
        });
        expect(rep2Scan.qcFlags).toContain('REPLICATE_DISAGREEMENT');
        expect(rep2Scan.qcStatus).toBe('WARN');
    });

    test('SL-20: Library outlier screening flags background / empty cup scans', () => {
        const wavelengths = [4000, 3600, 3200, 2800, 2400, 2000, 1600, 1200, 800, 400];
        // Flatline near zero (empty cup or background mistakenly submitted)
        const emptyCupValues = [0.001, 0.001, 0.001, 0.002, 0.001, 0.001, 0.002, 0.001, 0.001, 0.001];

        const outlierRes = screenScanAgainstLibrary(wavelengths, emptyCupValues, []);
        expect(outlierRes.isOutlier).toBe(true);
        expect(outlierRes.reason).toBe('BACKGROUND_OR_EMPTY_CUP');
    });

    test('SL-21: Ingest of scanType CONTROL and retrieval via /control-drifts endpoint', async () => {
        const controlW = [4000, 3600, 3200, 2800, 2400, 2000, 1600, 1200, 800, 400];
        const controlV = [0.05, 0.05, 0.06, 0.05, 0.05, 0.05, 0.06, 0.05, 0.05, 0.05];

        // Upload CONTROL scan (no sampleId required)
        const uploadRes = await request(app)
            .post('/api/spectral/batch')
            .set('Authorization', `Bearer ${mgrGtmToken}`)
            .send({
                scans: [{
                    filename: 'stage_d_control_day1.csv',
                    scanType: 'CONTROL',
                    equipmentId: equipmentId,
                    modality: 'MIR',
                    quantity: 'ABSORBANCE',
                    wavelengths: controlW,
                    values: controlV
                }]
            });

        expect(uploadRes.status).toBe(200);
        expect(uploadRes.body.results.success).toBe(1);

        // Fetch control drifts
        const driftsRes = await request(app)
            .get(`/api/spectral/control-drifts?equipmentId=${equipmentId}`)
            .set('Authorization', `Bearer ${mgrGtmToken}`);

        expect(driftsRes.status).toBe(200);
        expect(driftsRes.body.success).toBe(true);
        expect(driftsRes.body.count).toBeGreaterThanOrEqual(1);
        const fetchedControl = driftsRes.body.scans.find(s => s.equipmentId === equipmentId);
        expect(fetchedControl).toBeDefined();
        expect(fetchedControl.modality).toBe('MIR');
    });
});
