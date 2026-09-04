const request = require('supertest');
const app = require('../../app');
const prisma = require('../../prisma');
const { getAuthToken } = require('../setup');

describe('Stage C: Consignment & High-Throughput Batch Intake Contract (RC-12 - RC-15)', () => {
    let authHeader;
    const testLab = 'LAB-GTM';
    const testProjectId = `PROJ-CSG-${Date.now()}`;
    const testSamples = [
        `TEST-C-SMP1-${Date.now()}`,
        `TEST-C-SMP2-${Date.now()}`,
        `TEST-C-SMP3-${Date.now()}`,
        `TEST-C-REJ4-${Date.now()}`
    ];
    let createdConsignmentId = null;

    beforeAll(async () => {
        const token = await getAuthToken('SAMPLE_RECEPTION', testLab, ['GTM'], [testProjectId]);
        authHeader = `Bearer ${token}`;

        await prisma.user.updateMany({
            where: { role: 'SAMPLE_RECEPTION' },
            data: { mustChangePassword: false }
        });

        // Create test project
        await prisma.project.create({
            data: {
                id: testProjectId,
                code: testProjectId,
                name: 'Stage C Consignment Test Project',
                status: 'ACTIVE'
            }
        });

        // Pre-create one EXPECTED sample to verify transitioning to ACCEPTED in batch
        await prisma.sample.create({
            data: {
                id: testSamples[0],
                originalId: testSamples[0],
                projectId: testProjectId,
                projectCode: testProjectId,
                status: 'EXPECTED',
                assignedLab: testLab
            }
        });
    });

    afterAll(async () => {
        try {
            const dbSamples = await prisma.sample.findMany({
                where: { originalId: { in: testSamples } },
                select: { id: true }
            });
            const sampleIds = dbSamples.map(s => s.id);

            await prisma.auditLog.deleteMany({
                where: {
                    OR: [
                        { entityId: { in: sampleIds } },
                        { sampleId: { in: sampleIds } },
                        ...(createdConsignmentId ? [{ entityId: createdConsignmentId }] : [])
                    ]
                }
            });
            await prisma.workItem.deleteMany({
                where: { sampleId: { in: sampleIds } }
            });
            await prisma.sample.deleteMany({
                where: { id: { in: sampleIds } }
            });
            if (createdConsignmentId) {
                await prisma.consignment.deleteMany({
                    where: { id: createdConsignmentId }
                });
            }
            await prisma.project.deleteMany({
                where: { id: testProjectId }
            });
        } catch (e) {
            console.error('Test cleanup error:', e);
        }
    });

    it('RC-12 & RC-13 & RC-14: POST /api/reception/consignments processes atomic batch with mixed statuses', async () => {
        const payload = {
            consignment: {
                deliveryNoteRef: 'WAYBILL-778899',
                deliveredBy: 'DHL Express - Driver Carlos',
                deliveredAt: new Date().toISOString(),
                expectedCount: 4,
                notes: 'Priority field trial consignment from Zacapa',
                submitter: {
                    name: 'Dr. Roberto Arbenz',
                    organization: 'ICTA Guatemala',
                    phone: '+502 2334-5678',
                    email: 'roberto.arbenz@icta.gob.gt'
                },
                projectCode: testProjectId
            },
            defaults: {
                receivedMass: 550.0,
                moistureOnArrival: 'MOIST',
                foreignMaterial: ['roots'],
                requiredAnalyses: ['PH_H2O'],
                depthTopCm: 0,
                depthBottomCm: 20,
                compositeRadiusM: 15.0,
                checklist: {
                    container: { status: 'PASS' },
                    label: { status: 'PASS' },
                    quantity: { status: 'PASS' },
                    condition: { status: 'PASS' },
                    coc: { status: 'PASS' }
                }
            },
            samples: [
                {
                    originalId: testSamples[0], // Pre-existing EXPECTED sample
                    status: 'ACCEPTED',
                    latitude: 14.9722,
                    longitude: -89.5306,
                    siteName: 'Zacapa Plot 1'
                },
                {
                    originalId: testSamples[1], // New sample 1
                    status: 'ACCEPTED',
                    latitude: 14.9750,
                    longitude: -89.5350,
                    siteName: 'Zacapa Plot 2'
                },
                {
                    originalId: testSamples[2], // New sample 2 with custom mass override
                    status: 'ACCEPTED',
                    receivedMass: 620.0,
                    latitude: 14.9800,
                    longitude: -89.5400,
                    siteName: 'Zacapa Plot 3'
                },
                {
                    originalId: testSamples[3], // Exception: REJECTED sample (RC-14)
                    status: 'REJECTED',
                    rejectionReason: 'Bag torn in transit; soil leaked and contaminated with gravel',
                    intakePhotos: ['/uploads/intake/torn_bag_sample4.jpg'],
                    siteName: 'Zacapa Plot 4'
                }
            ]
        };

        const res = await request(app)
            .post('/api/reception/consignments')
            .set('Authorization', authHeader)
            .send(payload);

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.consignment).toBeDefined();

        const csg = res.body.consignment;
        createdConsignmentId = csg.id;

        expect(csg.code).toMatch(/^CSG-\d{8}-\d{3}$/);
        expect(csg.deliveryNoteRef).toBe('WAYBILL-778899');
        expect(csg.deliveredBy).toBe('DHL Express - Driver Carlos');
        expect(csg.submitterName).toBe('Dr. Roberto Arbenz');
        expect(csg.sampleCount).toBe(4);
        expect(csg.acceptedCount).toBe(3);
        expect(csg.rejectedCount).toBe(1);
        expect(csg.status).toBe('PARTIAL');

        // Verify database persistence for samples
        const dbSamples = await prisma.sample.findMany({
            where: { originalId: { in: testSamples } },
            include: { workItems: true }
        });
        expect(dbSamples).toHaveLength(4);

        // Check each sample has consignmentId linked
        dbSamples.forEach(s => {
            expect(s.consignmentId).toBe(csg.id);
        });

        // Verify pre-existing sample transitioned from EXPECTED to ACCEPTED
        const s0 = dbSamples.find(s => s.originalId === testSamples[0]);
        expect(s0.status).toBe('ACCEPTED');
        expect(s0.labId).toBeDefined();
        expect(s0.receivedMass).toBe(550.0);
        expect(s0.workItems.length).toBeGreaterThanOrEqual(3); // DRYING, PREPARATION, PH_H2O

        // Verify sample 2 with custom mass override
        const s2 = dbSamples.find(s => s.originalId === testSamples[2]);
        expect(s2.status).toBe('ACCEPTED');
        expect(s2.receivedMass).toBe(620.0);

        // Verify sample 3 with REJECTED status (RC-14)
        const s3 = dbSamples.find(s => s.originalId === testSamples[3]);
        expect(s3.status).toBe('RECEIVED_REJECTED');
        expect(s3.rejectionReason).toContain('Bag torn in transit');
        expect(s3.workItems).toHaveLength(0); // No operational gate work items for rejected samples
    });

    it('RC-12: GET /api/reception/consignments lists consignments and GET /:id returns details', async () => {
        // List consignments
        const listRes = await request(app)
            .get('/api/reception/consignments?search=WAYBILL-778899')
            .set('Authorization', authHeader);

        expect(listRes.status).toBe(200);
        expect(listRes.body.success).toBe(true);
        expect(listRes.body.data.length).toBeGreaterThanOrEqual(1);

        const found = listRes.body.data.find(c => c.id === createdConsignmentId);
        expect(found).toBeDefined();
        expect(found.sampleCount).toBe(4);
        expect(found.acceptedCount).toBe(3);
        expect(found.rejectedCount).toBe(1);

        // Get single consignment detail
        const detailRes = await request(app)
            .get(`/api/reception/consignments/${createdConsignmentId}`)
            .set('Authorization', authHeader);

        expect(detailRes.status).toBe(200);
        expect(detailRes.body.success).toBe(true);
        expect(detailRes.body.consignment.id).toBe(createdConsignmentId);
        expect(detailRes.body.consignment.samples).toHaveLength(4);
    });

    it('RC-15: POST /api/reception/parse-manifest validates and converts coordinates from client spreadsheet rows', async () => {
        const mockRows = [
            {
                'Sample ID': 'CL-ZAC-01',
                'Latitude': '14.9722',
                'Longitude': '-89.5306',
                'Depth From': '0',
                'Depth To': '20',
                'Mass (g)': '500',
                'Site': 'Hacienda El Sol'
            },
            {
                'Sample ID': 'CL-ZAC-02',
                'Coordinates': '35S 631000 8530000', // UTM notation
                'Depth From': '0',
                'Depth To': '25',
                'Mass (g)': '600',
                'Site': 'Lusaka Farm A'
            },
            {
                'Sample ID': 'CL-ZAC-03',
                'Coordinates': `14°38'05"N, 90°30'25"W`, // DMS notation
                'Depth From': '20',
                'Depth To': '40',
                'Mass (g)': '480',
                'Site': 'Mixco Trial B'
            }
        ];

        const mapping = {
            sampleId: 'Sample ID',
            latitude: 'Latitude',
            longitude: 'Longitude',
            coordinates: 'Coordinates',
            depthTop: 'Depth From',
            depthBottom: 'Depth To',
            receivedMass: 'Mass (g)',
            siteName: 'Site'
        };

        const res = await request(app)
            .post('/api/reception/parse-manifest')
            .set('Authorization', authHeader)
            .send({ rows: mockRows, mapping });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.validCount).toBe(3);
        expect(res.body.errorCount).toBe(0);

        const parsed = res.body.parsedRows;
        expect(parsed[0].originalId).toBe('CL-ZAC-01');
        expect(parsed[0].latitude).toBe(14.9722);
        expect(parsed[0].depthTopCm).toBe(0);
        expect(parsed[0].depthBottomCm).toBe(20);

        // UTM conversion check
        expect(parsed[1].originalId).toBe('CL-ZAC-02');
        expect(parsed[1].coordFormat).toBe('UTM');
        expect(parsed[1].latitude).toBeCloseTo(-13.29, 1);
        expect(parsed[1].longitude).toBeCloseTo(28.21, 1);

        // DMS conversion check
        expect(parsed[2].originalId).toBe('CL-ZAC-03');
        expect(parsed[2].coordFormat).toBe('DMS');
        expect(parsed[2].latitude).toBeCloseTo(14.63, 1);
    });
});
