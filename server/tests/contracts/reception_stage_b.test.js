const request = require('supertest');
const app = require('../../app');
const prisma = require('../../prisma');
const { getAuthToken } = require('../setup');

describe('Stage B: Location, Provenance & Depth Contract (RC-05 - RC-11)', () => {
    let authHeader;
    const testLab = 'LAB-GTM';
    const testProjectId = `PROJ-GEO-${Date.now()}`;
    const testSample1 = `TEST-B-SMP1-${Date.now()}`;
    const testSample2 = `TEST-B-SMP2-${Date.now()}`;
    const outlierSample = `TEST-B-OUTLIER-${Date.now()}`;

    beforeAll(async () => {
        const token = await getAuthToken('SAMPLE_RECEPTION', testLab, ['GTM'], [testProjectId]);
        authHeader = `Bearer ${token}`;

        await prisma.user.updateMany({
            where: { role: 'SAMPLE_RECEPTION' },
            data: { mustChangePassword: false }
        });

        // Create a test project for cluster tests
        await prisma.project.create({
            data: {
                id: testProjectId,
                code: testProjectId,
                name: 'Stage B Spatial Test Project',
                status: 'ACTIVE'
            }
        });

        // Seed two nearby samples in Guatemala City (~14.63, -90.50)
        await prisma.sample.create({
            data: {
                id: testSample1,
                originalId: testSample1,
                projectId: testProjectId,
                projectCode: testProjectId,
                status: 'ACCEPTED',
                latitude: 14.6349,
                longitude: -90.5069,
                assignedLab: testLab
            }
        });

        await prisma.sample.create({
            data: {
                id: testSample2,
                originalId: testSample2,
                projectId: testProjectId,
                projectCode: testProjectId,
                status: 'ACCEPTED',
                latitude: 14.6400,
                longitude: -90.5100,
                assignedLab: testLab
            }
        });
    });

    afterAll(async () => {
        await prisma.workItem.deleteMany({
            where: { sampleId: { startsWith: 'TEST-B-' } }
        }).catch(() => {});

        await prisma.sample.deleteMany({
            where: {
                OR: [
                    { originalId: { startsWith: 'TEST-B-' } },
                    { id: { startsWith: 'TEST-B-' } }
                ]
            }
        }).catch(() => {});

        await prisma.project.delete({
            where: { id: testProjectId }
        }).catch(() => {});
    });

    test('RC-05: GET /api/reception/admin-units returns structured hierarchy', async () => {
        const res = await request(app)
            .get('/api/reception/admin-units?country=GT')
            .set('Authorization', authHeader);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.departments).toBeInstanceOf(Array);
        expect(res.body.departments.length).toBeGreaterThan(0);
        expect(res.body.departments[0].municipalities).toBeInstanceOf(Array);
    });

    test('RC-05: POST /api/reception/parse-coordinates parses UTM, DMS, and DD', async () => {
        // 1. UTM
        const utmRes = await request(app)
            .post('/api/reception/parse-coordinates')
            .set('Authorization', authHeader)
            .send({ coordinates: '15N 752300 1625400' });

        expect(utmRes.status).toBe(200);
        expect(utmRes.body.format).toBe('UTM');
        expect(utmRes.body.lat).toBeCloseTo(14.690472, 3);
        expect(utmRes.body.lng).toBeCloseTo(-90.657096, 3);

        // 2. DMS
        const dmsRes = await request(app)
            .post('/api/reception/parse-coordinates')
            .set('Authorization', authHeader)
            .send({ coordinates: '14°48\'12"N, 90°13\'48"W' });

        expect(dmsRes.status).toBe(200);
        expect(dmsRes.body.format).toBe('DMS');
        expect(dmsRes.body.lat).toBeCloseTo(14.803333, 3);

        // 3. DD
        const ddRes = await request(app)
            .post('/api/reception/parse-coordinates')
            .set('Authorization', authHeader)
            .send({ coordinates: '-1.2921, 36.8219' });

        expect(ddRes.status).toBe(200);
        expect(ddRes.body.format).toBe('DD');
        expect(ddRes.body.lat).toBeCloseTo(-1.2921, 3);
    });

    test('RC-08: GET /api/reception/reverse-geocode returns location data safely', async () => {
        const res = await request(app)
            .get('/api/reception/reverse-geocode?lat=14.6349&lng=-90.5069')
            .set('Authorization', authHeader);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(['ONLINE', 'CACHE', 'OFFLINE_BOUNDARY', 'FALLBACK']).toContain(res.body.source);
    });

    test('RC-10: GET /api/reception/batch-geometry-check flags candidate sample >40km away', async () => {
        // Candidate nearby in Guatemala City (<2km) -> Not outlier
        const normalRes = await request(app)
            .get(`/api/reception/batch-geometry-check?projectId=${testProjectId}&lat=14.6350&lng=-90.5050`)
            .set('Authorization', authHeader);

        expect(normalRes.status).toBe(200);
        expect(normalRes.body.isOutlier).toBe(false);
        expect(normalRes.body.distanceKm).toBeLessThan(10);

        // Candidate in Quetzaltenango (~110km away) -> Outlier!
        const outlierRes = await request(app)
            .get(`/api/reception/batch-geometry-check?projectId=${testProjectId}&lat=14.8347&lng=-91.5181`)
            .set('Authorization', authHeader);

        expect(outlierRes.status).toBe(200);
        expect(outlierRes.body.isOutlier).toBe(true);
        expect(outlierRes.body.distanceKm).toBeGreaterThan(40);
        expect(outlierRes.body.warning).toContain('Spatial Outlier Warning');
    });

    test('RC-06, RC-07, RC-11: Intake persists positional uncertainty, provenance, composite radius, and numeric depths', async () => {
        const intakePayload = {
            originalId: `TEST-B-INTAKE-${Date.now()}`,
            decision: 'ACCEPTED',
            isWalkIn: true,
            receivedMass: 250,
            moistureOnArrival: 'DRY',
            checklist: { bagIntact: true },
            samplingDetails: {
                siteName: 'Hacienda San Jerónimo',
                district: 'Baja Verapaz',
                areaVillage: 'San Jerónimo',
                landmark: 'KM 142 Highway',
                captureMethod: 'PASTE_COORDS',
                locationSource: 'DESK_PASTE',
                locationConfidence: 'MEDIUM',
                positionalUncertaintyM: 15.0,
                compositeRadiusM: 45.0,
                depthType: 'Custom',
                depthMin: 0,
                depthMax: 30,
                coordinates: {
                    lat: 15.0600,
                    lng: -90.2400,
                    elevation: 990
                }
            },
            submitterDetails: {
                name: 'Carlos Mendoza',
                phone: '+502 5555 1234'
            }
        };

        const res = await request(app)
            .post('/api/reception/intake')
            .set('Authorization', authHeader)
            .send(intakePayload);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);

        const sampleInDb = await prisma.sample.findUnique({
            where: { id: res.body.id }
        });

        expect(sampleInDb).not.toBeNull();
        expect(sampleInDb.latitude).toBeCloseTo(15.0600, 4);
        expect(sampleInDb.longitude).toBeCloseTo(-90.2400, 4);
        expect(sampleInDb.elevation).toBe(990);
        expect(sampleInDb.positionalUncertaintyM).toBe(15.0);
        expect(sampleInDb.compositeRadiusM).toBe(45.0);
        expect(sampleInDb.depthTopCm).toBe(0);
        expect(sampleInDb.depthBottomCm).toBe(30);
        expect(sampleInDb.locationSource).toBe('DESK_PASTE');
        expect(sampleInDb.siteName).toBe('Hacienda San Jerónimo');
        expect(sampleInDb.admin1).toBe('Baja Verapaz');
        expect(sampleInDb.admin2).toBe('San Jerónimo');
    });
});
