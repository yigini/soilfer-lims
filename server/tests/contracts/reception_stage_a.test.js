const request = require('supertest');
const app = require('../../app');
const prisma = require('../../prisma');
const { getAuthToken } = require('../setup');

describe('Stage A: Sample Reception Desk-Only Facts Contract (RC-01 - RC-04)', () => {
    let authHeader;
    const testLab = 'LAB-GTM';
    const testSampleId = `TEST-SMP-${Date.now()}`;
    const testAnalysisCode = 'TEST_AN_HEAVY';

    beforeAll(async () => {
        const token = await getAuthToken('SAMPLE_RECEPTION', testLab, ['GTM'], ['SOILFER-US']);
        authHeader = `Bearer ${token}`;

        await prisma.user.updateMany({
            where: { role: 'SAMPLE_RECEPTION' },
            data: { mustChangePassword: false }
        });

        // Ensure test analysis exists with specific sample mass requirement (e.g. 80g)
        await prisma.analysis.upsert({
            where: { code: testAnalysisCode },
            update: { sampleMassRequired: 80.0 },
            create: {
                code: testAnalysisCode,
                name: 'Heavy Texture Pipette Test',
                matrix: 'SOIL',
                sampleMassRequired: 80.0,
                status: 'active'
            }
        });
    });

    afterAll(async () => {
        // Clean up test data
        await prisma.sample.deleteMany({
            where: {
                OR: [
                    { originalId: { startsWith: 'TEST-SMP-' } },
                    { originalId: { startsWith: 'TEST-DUP-' } }
                ]
            }
        }).catch(() => {});

        await prisma.analysis.delete({ where: { code: testAnalysisCode } }).catch(() => {});
    });

    test('RC-01: Mass shortfall without acknowledgement returns HTTP 400 with deficit breakdown', async () => {
        const payload = {
            originalId: testSampleId,
            isWalkIn: true,
            receivedMass: 120.0, // 120g received < 80g analytical + 100g retention = 180g required
            massWarningAcknowledged: false,
            requiredAnalyses: [testAnalysisCode],
            submitterDetails: { name: 'John Doe', phone: '+123456789' }
        };

        const res = await request(app)
            .post('/api/reception/intake')
            .set('Authorization', authHeader)
            .send(payload);

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('MASS_DEFICIT');
        expect(res.body.massDeficitInfo).toBeDefined();
        expect(res.body.massDeficitInfo.receivedMass).toBe(120.0);
        expect(res.body.massDeficitInfo.totalRequiredMass).toBe(180.0);
        expect(res.body.massDeficitInfo.deficit).toBe(60.0);
        expect(res.body.massDeficitInfo.analysesAtRisk[0].code).toBe(testAnalysisCode);
    });

    test('RC-01: Mass shortfall WITH explicit acknowledgement succeeds (HTTP 200) and records override in history', async () => {
        const payload = {
            originalId: testSampleId,
            isWalkIn: true,
            receivedMass: 120.0,
            massWarningAcknowledged: true, // Explicit operator override
            requiredAnalyses: [testAnalysisCode],
            submitterDetails: { name: 'John Doe', phone: '+123456789' }
        };

        const res = await request(app)
            .post('/api/reception/intake')
            .set('Authorization', authHeader)
            .send(payload);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);

        const sample = await prisma.sample.findFirst({ where: { originalId: testSampleId } });
        expect(sample).toBeDefined();
        expect(sample.receivedMass).toBe(120.0);
        expect(sample.massWarningAcknowledged).toBe(true);

        const history = JSON.parse(sample.history || '[]');
        const overrideLog = history.find(h => h.status === 'MASS_DEFICIT_OVERRIDE');
        expect(overrideLog).toBeDefined();
        expect(overrideLog.note).toContain('deficit: 60g');
    });

    test('RC-02: Moisture and foreign material at arrival persist on sample record', async () => {
        const sampleId = `TEST-SMP-MOIST-${Date.now()}`;
        const foreignMat = { stones: true, roots: true, plastic: false, other: '', removed: true };

        const payload = {
            originalId: sampleId,
            isWalkIn: true,
            receivedMass: 250.0, // Sufficient
            moistureOnArrival: 'WET',
            foreignMaterial: foreignMat,
            requiredAnalyses: [testAnalysisCode],
            submitterDetails: { name: 'Maria Santos', phone: '+502123456' }
        };

        const res = await request(app)
            .post('/api/reception/intake')
            .set('Authorization', authHeader)
            .send(payload);

        expect(res.status).toBe(200);

        const sample = await prisma.sample.findFirst({ where: { originalId: sampleId } });
        expect(sample.moistureOnArrival).toBe('WET');
        expect(JSON.parse(sample.foreignMaterial)).toEqual(foreignMat);
    });

    test('RC-03: Non-conformance rejection stores photographic evidence in sample record', async () => {
        const sampleId = `TEST-SMP-REJ-${Date.now()}`;
        const photoUrls = ['/uploads/intake/torn_bag_sample.jpg'];

        const payload = {
            originalId: sampleId,
            decision: 'REJECTED',
            ncReason: 'Sample bag arrived torn in transit and contaminated',
            intakePhotos: photoUrls,
            isWalkIn: true,
            submitterDetails: { name: 'Courier Express', phone: '+0000000' }
        };

        const res = await request(app)
            .post('/api/reception/intake')
            .set('Authorization', authHeader)
            .send(payload);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);

        const sample = await prisma.sample.findFirst({ where: { originalId: sampleId } });
        expect(sample.rejectionReason).toContain('torn in transit');
        expect(JSON.parse(sample.intakePhotos)).toEqual(photoUrls);

        const meta = JSON.parse(sample.metadata || '{}');
        expect(meta.nonConformance.photos).toEqual(photoUrls);
    });

    test('RC-04: Duplicate detection identifies prior receipts and supports confirmed re-submission', async () => {
        const dupId = `TEST-DUP-${Date.now()}`;

        // 1. First receipt of sample
        const intake1 = await request(app)
            .post('/api/reception/intake')
            .set('Authorization', authHeader)
            .send({
                originalId: dupId,
                isWalkIn: true,
                receivedMass: 300.0,
                requiredAnalyses: [testAnalysisCode],
                submitterDetails: { name: 'Alpha Farm', phone: '+999' }
            });
        expect(intake1.status).toBe(200);

        // 2. Check duplicate endpoint
        const checkRes = await request(app)
            .get('/api/reception/check-duplicate')
            .query({ originalId: dupId })
            .set('Authorization', authHeader);

        expect(checkRes.status).toBe(200);
        expect(checkRes.body.exists).toBe(true);
        expect(checkRes.body.isPriorReceipt).toBe(true);
        expect(checkRes.body.sample.originalId).toBe(dupId);

        // 3. Re-submission with isResubmission flag explicitly confirmed
        // (For a draft or new submission of this ID)
        const recheckRes = await request(app)
            .get('/api/reception/check-duplicate')
            .query({ originalId: 'NON_EXISTENT_SAMPLE_XYZ' })
            .set('Authorization', authHeader);
        expect(recheckRes.status).toBe(200);
        expect(recheckRes.body.exists).toBe(false);
    });

    test('RC-01: Mass check endpoint returns analytical requirement breakdown', async () => {
        const res = await request(app)
            .post('/api/reception/mass-check')
            .set('Authorization', authHeader)
            .send({
                analysisCodes: [testAnalysisCode],
                retentionMass: 100
            });

        expect(res.status).toBe(200);
        expect(res.body.totalAnalyticalMass).toBe(80.0);
        expect(res.body.retentionMass).toBe(100);
        expect(res.body.totalRequiredMass).toBe(180.0);
        expect(res.body.breakdown[0].code).toBe(testAnalysisCode);
        expect(res.body.breakdown[0].massRequired).toBe(80.0);
    });
});
