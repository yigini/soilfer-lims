const request = require('supertest');
const app = require('../../app');
const prisma = require('../../prisma');
const { getAuthToken } = require('../setup');
const { parseSpectralFile } = require('../../services/spectralParser');

describe('Spectral Library Stage C (SL-13 to SL-16)', () => {
    let mgrGtmToken;
    let sampleGtmId;
    let workItemId;

    beforeAll(async () => {
        // Clean up any test records
        await prisma.spectralData.deleteMany({
            where: { id: { startsWith: 'test-spec-c-' } }
        });
        await prisma.sample.deleteMany({
            where: { id: { startsWith: 'TEST-STAGEC-SMP-' } }
        });

        mgrGtmToken = await getAuthToken('LAB_MANAGER', 'LAB-GTM', ['GTM'], ['SOILFER-US']);

        // Create sample in GTM
        sampleGtmId = 'TEST-STAGEC-SMP-01';
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

        // Create a spectral work item for this sample
        workItemId = 'TEST-WORKITEM-SPEC-01';
        await prisma.workItem.create({
            data: {
                id: workItemId,
                sampleId: sampleGtmId,
                assignedLab: 'LAB-GTM',
                analysis: 'SPEC_MIR',
                status: 'ASSIGNED'
            }
        });
    });

    afterAll(async () => {
        await prisma.spectralData.deleteMany({
            where: { id: { startsWith: 'test-spec-c-' } }
        });
        await prisma.workItem.deleteMany({
            where: { id: { startsWith: 'TEST-WORKITEM-SPEC-' } }
        });
        await prisma.sample.deleteMany({
            where: { id: { startsWith: 'TEST-STAGEC-SMP-' } }
        });
    });

    test('SL-13 & SL-14: Server parses raw JCAMP-DX file directly and extracts acquisition metadata', async () => {
        const jcampContent = `##TITLE= Soil Sample Alpha MIR
##JCAMP-DX= 5.01
##DATA TYPE= INFRARED SPECTRUM
##ORIGIN= SoilFER Reference Laboratory
##SPECTROMETER/DATA SYSTEM= Bruker Alpha II FT-IR
##RESOLUTION= 4.0
##DELTAX= -200.0
##XUNITS= 1/CM
##YUNITS= ABSORBANCE
##FIRSTX= 4000.0
##LASTX= 2000.0
##NPOINTS= 11
##XYDATA= (X++(Y..Y))
4000.0 0.120 0.140 0.160 0.180 0.200 0.220 0.240 0.260 0.280 0.300 0.320
##END=`;

        const uploadRes = await request(app)
            .post('/api/spectral/batch')
            .set('Authorization', `Bearer ${mgrGtmToken}`)
            .send({
                scans: [
                    {
                        filename: 'alpha_sample01.dx',
                        labId: sampleGtmId,
                        rawContent: jcampContent
                    }
                ]
            });

        expect(uploadRes.status).toBe(200);
        expect(uploadRes.body.results.success).toBe(1);

        const scan = await prisma.spectralData.findFirst({
            where: { sampleId: sampleGtmId, filename: 'alpha_sample01.dx' }
        });
        expect(scan).toBeDefined();

        // SL-13 & SL-14: Server-side parsed attributes
        expect(scan.sourceFormat).toBe('JCAMP-DX');
        expect(scan.modality).toBe('MIR');
        expect(scan.axisUnit).toBe('WAVENUMBER_CM1');
        expect(scan.quantity).toBe('ABSORBANCE');
        expect(scan.resolution).toBe(4.0);

        const wavelengths = JSON.parse(scan.wavelengths);
        const values = JSON.parse(scan.values);
        expect(wavelengths.length).toBe(11);
        expect(wavelengths[0]).toBe(4000.0);
        expect(wavelengths[1]).toBe(3800.0);
        expect(values[0]).toBe(0.120);
        expect(values[4]).toBe(0.200);

        // SL-14: Deterministic re-parsing test
        const reParsed = parseSpectralFile(jcampContent, 'alpha_sample01.dx');
        expect(reParsed.wavelengths).toEqual(wavelengths);
        expect(reParsed.values).toEqual(values);
        expect(reParsed.sha256).toBe(scan.sha256);
    });

    test('SL-15: Indexed sample matching succeeds past 500 samples without in-memory cap', async () => {
        // Create 510 dummy samples
        const dummySamples = [];
        for (let i = 1; i <= 510; i++) {
            const id = `TEST-STAGEC-SMP-DUMMY-${String(i).padStart(4, '0')}`;
            dummySamples.push({
                id,
                originalId: id,
                assignedLab: 'LAB-GTM',
                labId: 'LAB-GTM',
                status: 'APPROVED',
                matrix: 'SOIL'
            });
        }
        await prisma.sample.createMany({ data: dummySamples });

        // Target sample is at the end (record > 500)
        const targetSampleId = 'TEST-STAGEC-SMP-DUMMY-0505';

        const uploadRes = await request(app)
            .post('/api/spectral/batch')
            .set('Authorization', `Bearer ${mgrGtmToken}`)
            .send({
                scans: [
                    {
                        filename: 'scan_505.csv',
                        labId: targetSampleId,
                        modality: 'MIR',
                        wavelengths: [4000, 2000, 400],
                        values: [0.1, 0.2, 0.3]
                    }
                ]
            });

        expect(uploadRes.status).toBe(200);
        expect(uploadRes.body.results.success).toBe(1);

        const createdScan = await prisma.spectralData.findFirst({
            where: { sampleId: targetSampleId }
        });
        expect(createdScan).toBeDefined();
        expect(createdScan.sampleId).toBe(targetSampleId);
    });

    test('SL-15: Refuses laboratory ID mismatch', async () => {
        // Attempt upload where CSV says LAB-CONFLICT but context sample belongs to GTM
        const uploadRes = await request(app)
            .post('/api/spectral/batch')
            .set('Authorization', `Bearer ${mgrGtmToken}`)
            .send({
                contextSampleId: sampleGtmId,
                scans: [
                    {
                        filename: 'mismatched_scan.csv',
                        labId: 'LAB-CONFLICT-MISMATCH',
                        modality: 'MIR',
                        wavelengths: [4000, 2000, 400],
                        values: [0.1, 0.2, 0.3]
                    }
                ]
            });

        expect(uploadRes.status).toBe(200);
        expect(uploadRes.body.results.failed).toBe(1);
        expect(uploadRes.body.results.errors[0].error).toContain('Laboratory ID mismatch');
    });

    test('SL-16: Route work-item status update via catalogue analysis match and audit history', async () => {
        // Verify the work item created in beforeAll transitioned to COMPLETED when alpha_sample01.dx was uploaded
        const updatedItem = await prisma.workItem.findUnique({
            where: { id: workItemId }
        });

        expect(updatedItem.status).toBe('COMPLETED');
        expect(updatedItem.result).toContain('Spectrum Uploaded');
        const history = JSON.parse(updatedItem.history);
        expect(history.length).toBeGreaterThanOrEqual(1);
        expect(history[history.length - 1].note).toContain('Spectrum uploaded by');
    });
});
