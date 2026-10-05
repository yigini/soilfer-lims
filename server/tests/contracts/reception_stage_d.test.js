const { cleanupWorkflowFixtures } = require("../helpers/workflowFixtures");
const { createSampleFixture } = require('../helpers/workflowFixtures');
const request = require('supertest');
const app = require('../../app');
const prisma = require('../../prisma');
const { getAuthToken, ensureTestLab } = require('../setup');
const QRCode = require('../../../client/node_modules/qrcode');

describe('Stage D: Desk Ergonomics & Hardware Contract Tests (RC-16 - RC-18)', () => {
    let authHeader;
    const testLab = `LAB-D-${Date.now()}`;
    const testProjectId = `PROJ-D-${Date.now()}`;
    const testSampleId = `TEST-D-LBL-${Date.now()}`;
    let createdSampleDbId = null;

    beforeAll(async () => {
        await ensureTestLab(testLab, 'GTM');
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
                name: 'Stage D Ergonomics Test Project',
                status: 'ACTIVE'
            }
        });

        // Ensure ROUTINE_SOIL analysis group exists for intake package resolution
        await prisma.analysisGroup.upsert({
            where: { id: 'ROUTINE_SOIL' },
            update: {},
            create: {
                id: 'ROUTINE_SOIL',
                name: 'Routine Soil Fertility Package',
                analyses: JSON.stringify(['PH_H2O', 'EC', 'P_OLSEN'])
            }
        });
    });

    afterAll(async () => {
        try {
            if (createdSampleDbId) {
                await prisma.auditLog.deleteMany({
                    where: { OR: [{ sampleId: createdSampleDbId }, { entityId: createdSampleDbId }] }
                });
                await cleanupWorkflowFixtures(prisma, "workItem", (await prisma.workItem.findMany({ ...({
                    where: { sampleId: createdSampleDbId }
                }), select: { id: true } })).map(row => row.id), { single: false });
                await cleanupWorkflowFixtures(prisma, "sample", (await prisma.sample.findMany({ ...({
                    where: { id: createdSampleDbId }
                }), select: { id: true } })).map(row => row.id), { single: false });
            }
            await prisma.project.deleteMany({
                where: { id: testProjectId }
            });
            await prisma.analysisGroup.deleteMany({
                where: { id: 'ROUTINE_SOIL' }
            });
        } catch (e) {
            console.error('Error cleaning up Stage D test artifacts:', e);
        }
    });

    // RC-16: Fast Hardware Wedge Barcode Lookup
    test('RC-16: Rapid wedge barcode scanner lookup returns expected sample metadata immediately', async () => {
        // Pre-create expected sample in project
        const expected = await createSampleFixture(prisma, {
            data: {
                id: testSampleId,
                originalId: testSampleId,
                projectId: testProjectId,
                projectCode: testProjectId,
                status: 'EXPECTED',
                assignedLab: testLab
            }
        });
        createdSampleDbId = expected.id;

        // Simulate rapid wedge scan query (Enter/Tab suffix trigger)
        const start = Date.now();
        const res = await request(app)
            .get('/api/samples/expected')
            .query({ q: testSampleId, projectId: testProjectId, limit: 1 })
            .set('Authorization', authHeader);

        const duration = Date.now() - start;
        expect(res.statusCode).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.length).toBe(1);
        expect(res.body[0].originalId).toBe(testSampleId);
        expect(duration).toBeLessThan(1500); // Verify fast lookup response
    });

    // RC-17: Immediate Label Printing at ID Birth & Complete Label Payload
    test('RC-17: Sample intake returns minted permanent Lab ID and full metadata required for label printing', async () => {
        const intakePayload = {
            originalId: testSampleId,
            decision: 'ACCEPTED',
            receivedMass: 550,
            massWarningAcknowledged: false,
            moistureOnArrival: 'MOIST',
            foreignMaterial: ['Stones/Gravel'],
            analysisGroupIds: ['ROUTINE_SOIL'],
            checklist: {
                container: { status: 'PASS' },
                label: { status: 'PASS' },
                quantity: { status: 'PASS' },
                condition: { status: 'PASS' },
                coc: { status: 'PASS' }
            },
            notes: 'Stage D immediate label mint test',
            receivedBy: 'reception_officer',
            labId: testLab,
            isWalkIn: false,
            projectId: testProjectId
        };

        const res = await request(app)
            .post('/api/reception/intake')
            .set('Authorization', authHeader)
            .send(intakePayload);

        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.labId).toBeDefined();
        expect(typeof res.body.labId).toBe('string');
        expect(res.body.labId.length).toBeGreaterThan(3);
        expect(res.body.originalId).toBe(testSampleId);

        // Verify offline QR matrix generation for the minted lab ID
        const qrDataUrl = await QRCode.toDataURL(res.body.labId, {
            errorCorrectionLevel: 'M',
            width: 180
        });
        expect(qrDataUrl).toBeDefined();
        expect(qrDataUrl.startsWith('data:image/png;base64,')).toBe(true);
    });

    // RC-17: Batch Consignment Label Payload Delivery
    test('RC-17: Consignment batch query delivers all sample barcodes and statuses for thermal batch printing', async () => {
        const csgBatchPayload = {
            consignment: {
                deliveryNoteRef: `DN-D-${Date.now()}`,
                deliveredBy: 'Courier Driver',
                deliveredAt: new Date().toISOString(),
                expectedCount: 2,
                notes: 'Stage D thermal batch print test',
                projectCode: testProjectId
            },
            defaults: {
                receivedMass: 500,
                moistureOnArrival: 'DRY',
                foreignMaterial: [],
                requiredAnalyses: ['PH_H2O'],
                depthTopCm: 0,
                depthBottomCm: 20,
                checklist: {
                    container: { status: 'PASS' },
                    label: { status: 'PASS' },
                    quantity: { status: 'PASS' },
                    condition: { status: 'PASS' },
                    coc: { status: 'PASS' }
                }
            },
            samples: [
                { originalId: `TEST-D-CSG1-${Date.now()}`, status: 'ACCEPTED' },
                { originalId: `TEST-D-CSG2-${Date.now()}`, status: 'REJECTED', rejectionReason: 'Damaged' }
            ]
        };

        const res = await request(app)
            .post('/api/reception/consignments')
            .set('Authorization', authHeader)
            .send(csgBatchPayload);

        expect(res.statusCode).toBe(201);
        expect(res.body.success).toBe(true);
        const csgId = res.body.consignment.id;
        expect(res.body.samples).toBeDefined();
        expect(res.body.samples.length).toBe(2);

        // Fetch consignment detail as requested by LabelPrintDialog
        const detailRes = await request(app)
            .get(`/api/reception/consignments/${csgId}`)
            .set('Authorization', authHeader);

        expect(detailRes.statusCode).toBe(200);
        expect(detailRes.body.success).toBe(true);
        expect(detailRes.body.consignment.samples.length).toBe(2);

        // Verify accepted sample has labId for label printing
        const accepted = detailRes.body.consignment.samples.find(s => s.status === 'ACCEPTED');
        expect(accepted).toBeDefined();
        expect(accepted.labId).toBeDefined();

        // Cleanup created consignment and samples
        const sampleIds = detailRes.body.consignment.samples.map(s => s.id);
        await prisma.auditLog.deleteMany({
            where: { OR: [{ sampleId: { in: sampleIds } }, { entityId: { in: sampleIds } }] }
        });
        await cleanupWorkflowFixtures(prisma, "workItem", (await prisma.workItem.findMany({ ...({
            where: { sampleId: { in: sampleIds } }
        }), select: { id: true } })).map(row => row.id), { single: false });
        await cleanupWorkflowFixtures(prisma, "sample", (await prisma.sample.findMany({ ...({
            where: { id: { in: sampleIds } }
        }), select: { id: true } })).map(row => row.id), { single: false });
        await prisma.consignment.deleteMany({
            where: { id: csgId }
        });
    });
});
