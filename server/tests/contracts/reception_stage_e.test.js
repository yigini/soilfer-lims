const request = require('supertest');
const app = require('../../app');
const prisma = require('../../prisma');
const workflow = require('../../workflowContract');
const { getAuthToken } = require('../setup');

describe('Stage E: Distinct RECEIVED_REJECTED State & Immutable Chain of Custody (RC-19)', () => {
    let authHeader;
    const testLab = 'LAB-GTM';
    const testProjectId = `PROJ-E-${Date.now()}`;
    const testRejectSampleId = `TEST-E-REJ-${Date.now()}`;
    const testAcceptSampleId = `TEST-E-ACC-${Date.now()}`;
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
                name: 'Stage E Chain of Custody Test Project',
                status: 'ACTIVE'
            }
        });
    });

    afterAll(async () => {
        try {
            // Clean up samples
            const testIds = [testRejectSampleId, testAcceptSampleId];
            for (const sid of testIds) {
                await prisma.auditLog.deleteMany({
                    where: { OR: [{ sampleId: sid }, { entityId: sid }] }
                });
                await prisma.workItem.deleteMany({
                    where: { sampleId: sid }
                });
                await prisma.sample.deleteMany({
                    where: { OR: [{ id: sid }, { originalId: sid }] }
                });
            }

            // Clean up consignment
            if (createdConsignmentId) {
                const csgSamples = await prisma.sample.findMany({
                    where: { consignmentId: createdConsignmentId },
                    select: { id: true }
                });
                for (const s of csgSamples) {
                    await prisma.workItem.deleteMany({ where: { sampleId: s.id } });
                    await prisma.auditLog.deleteMany({ where: { sampleId: s.id } });
                }
                await prisma.sample.deleteMany({ where: { consignmentId: createdConsignmentId } });
                await prisma.consignment.deleteMany({ where: { id: createdConsignmentId } });
            }

            await prisma.project.deleteMany({
                where: { id: testProjectId }
            });
        } catch (e) {
            console.error('Error cleaning up Stage E test artifacts:', e);
        }
    });

    // 1. RC-19: Explicit RECEIVED_REJECTED state & exclusion from expected count
    test('RC-19: Intake rejection transitions sample to RECEIVED_REJECTED (not EXPECTED) and excludes it from expected backlog', async () => {
        // Pre-create expected sample
        await prisma.sample.create({
            data: {
                id: testRejectSampleId,
                originalId: testRejectSampleId,
                projectId: testProjectId,
                projectCode: testProjectId,
                status: 'EXPECTED',
                assignedLab: testLab
            }
        });

        const handoverDate = new Date('2026-09-04T08:30:00Z');
        const rejectPayload = {
            originalId: testRejectSampleId,
            decision: 'REJECTED',
            checklist: {
                container: { status: 'FAIL', reason: 'Torn plastic bag, soil leaking' },
                condition: { status: 'FAIL', reason: 'Cross-contaminated with motor oil' },
                nonConformance: true,
                reason: 'Bag compromised with petroleum hydrocarbon contamination'
            },
            notes: 'Refused intake as per Biosafety ISO 17025 protocol',
            ncReason: 'Bag compromised with petroleum hydrocarbon contamination',
            intakePhotos: ['https://storage.lims.yigini.net/uploads/intake/torn_bag.jpg'],
            custodyHandoverAt: handoverDate.toISOString(),
            custodyCarrierName: 'DHL Express Driver Gomez',
            custodyTrackingNumber: 'WB-GT-994827',
            custodySenderSignature: 'Gomez / DHL Courier',
            receivingOfficerSignature: 'CONFIRMED:reception_officer_gtm'
        };

        const res = await request(app)
            .post('/api/reception/intake')
            .set('Authorization', authHeader)
            .send(rejectPayload);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.rejected).toBe(true);
        expect(res.body.status).toBe('RECEIVED_REJECTED');
        expect(res.body.rejectionReason).toBe('Bag compromised with petroleum hydrocarbon contamination');

        // Verify DB record
        const dbSample = await prisma.sample.findUnique({
            where: { id: testRejectSampleId }
        });
        expect(dbSample.status).toBe('RECEIVED_REJECTED');
        expect(dbSample.rejectionReason).toBe('Bag compromised with petroleum hydrocarbon contamination');
        expect(dbSample.custodyCarrierName).toBe('DHL Express Driver Gomez');
        expect(dbSample.custodyTrackingNumber).toBe('WB-GT-994827');
        expect(new Date(dbSample.custodyHandoverAt).toISOString()).toBe(handoverDate.toISOString());

        // Crucial RC-19 assertion: Rejected sample must NOT show up in EXPECTED backlog
        const searchRes = await request(app)
            .get(`/api/samples/expected?q=${testRejectSampleId}&projectId=${testProjectId}`)
            .set('Authorization', authHeader);

        expect(searchRes.status).toBe(200);
        const matchingExpected = (searchRes.body.data || searchRes.body || []).filter(s => s.originalId === testRejectSampleId);
        expect(matchingExpected.length).toBe(0);

        // Verify audit log
        const audit = await prisma.auditLog.findFirst({
            where: { sampleId: testRejectSampleId, action: 'SAMPLE_REJECTED' }
        });
        expect(audit).toBeTruthy();
    });

    // 2. RC-19: Separate Handover Timestamp & Officer Counter-Signature for Accepted Samples
    test('RC-19: Accepted intake separates custody handover timestamp from system entry and immutably records officer counter-signature', async () => {
        // Pre-create expected sample
        await prisma.sample.create({
            data: {
                id: testAcceptSampleId,
                originalId: testAcceptSampleId,
                projectId: testProjectId,
                projectCode: testProjectId,
                status: 'EXPECTED',
                assignedLab: testLab
            }
        });

        // Courier handover occurred 3 hours prior to desk entry
        const handoverDate = new Date(Date.now() - 3 * 3600 * 1000);

        const acceptPayload = {
            originalId: testAcceptSampleId,
            decision: 'ACCEPTED',
            checklist: {
                container: { status: 'PASS' },
                label: { status: 'PASS' },
                quantity: { status: 'PASS' },
                condition: { status: 'PASS' },
                coc: { status: 'PASS' }
            },
            receivedMass: 550.0,
            massWarningAcknowledged: true,
            moistureOnArrival: 'MOIST',
            foreignMaterial: [],
            custodyHandoverAt: handoverDate.toISOString(),
            custodyCarrierName: 'AgroExtension Officer Perez',
            custodyTrackingNumber: 'EXT-WAYBILL-2026-09',
            custodySenderSignature: 'Perez / MOA',
            receivingOfficerSignature: 'CONFIRMED:reception_officer_gtm'
        };

        const res = await request(app)
            .post('/api/reception/intake')
            .set('Authorization', authHeader)
            .send(acceptPayload);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.labId).toBeTruthy();

        // Verify DB record
        const dbSample = await prisma.sample.findUnique({
            where: { id: testAcceptSampleId }
        });
        expect(dbSample.status).toBe('ACCEPTED');
        expect(dbSample.custodyCarrierName).toBe('AgroExtension Officer Perez');
        expect(dbSample.custodyTrackingNumber).toBe('EXT-WAYBILL-2026-09');
        expect(dbSample.custodySenderSignature).toBe('Perez / MOA');
        expect(dbSample.receivingOfficerSignature).toContain('CONFIRMED');

        // Handover timestamp must be preserved separately from receptionDate/createdAt
        const recordedHandover = new Date(dbSample.custodyHandoverAt).getTime();
        const recordedReception = new Date(dbSample.receptionDate).getTime();
        expect(recordedReception).toBeGreaterThan(recordedHandover);
    });

    // 3. RC-19: Consignment Batch Intake with Mixed Accepted & RECEIVED_REJECTED
    test('RC-19: Consignment batch registers mixed accepted and RECEIVED_REJECTED with structured chain of custody', async () => {
        const batchSample1 = `TEST-E-CSG1-${Date.now()}`;
        const batchSample2 = `TEST-E-CSG2-${Date.now()}`;
        const handoverTime = new Date('2026-09-04T07:15:00Z');

        const consignmentPayload = {
            consignment: {
                projectCode: testProjectId,
                deliveryNoteRef: 'DN-E-CUSTODY-8819',
                deliveredBy: 'SpeedyLogistics Driver Silva',
                custodyHandoverAt: handoverTime.toISOString(),
                custodyCarrierName: 'SpeedyLogistics Driver Silva',
                custodyTrackingNumber: 'DN-E-CUSTODY-8819',
                custodySenderSignature: 'Silva / Driver',
                receivingOfficerSignature: 'CONFIRMED:reception_officer_gtm',
                expectedCount: 2,
                submitter: { name: 'Regional Agricultural Office' }
            },
            defaults: {
                receivedMass: 400.0,
                moistureOnArrival: 'MOIST'
            },
            samples: [
                {
                    originalId: batchSample1,
                    status: 'ACCEPTED',
                    receivedMass: 420.0
                },
                {
                    originalId: batchSample2,
                    status: 'REJECTED',
                    rejectionReason: 'Sample bag arrived completely unsealed with loss of core matrix',
                    receivedMass: 50.0
                }
            ]
        };

        const res = await request(app)
            .post('/api/reception/consignments')
            .set('Authorization', authHeader)
            .send(consignmentPayload);

        expect([200, 201]).toContain(res.status);
        expect(res.body.success).toBe(true);
        expect(res.body.consignment.acceptedCount).toBe(1);
        expect(res.body.consignment.rejectedCount).toBe(1);
        expect(res.body.consignment.status).toBe('PARTIAL');
        createdConsignmentId = res.body.consignment.id;

        // Verify rejected sample has RECEIVED_REJECTED in database
        const dbRejected = await prisma.sample.findFirst({
            where: { originalId: batchSample2 }
        });
        expect(dbRejected).toBeTruthy();
        expect(dbRejected.status).toBe('RECEIVED_REJECTED');
        expect(dbRejected.rejectionReason).toContain('loss of core matrix');
        expect(dbRejected.custodyCarrierName).toBe('SpeedyLogistics Driver Silva');
        expect(dbRejected.custodyTrackingNumber).toBe('DN-E-CUSTODY-8819');
        expect(new Date(dbRejected.custodyHandoverAt).toISOString()).toBe(handoverTime.toISOString());

        // Verify accepted sample has ACCEPTED status
        const dbAccepted = await prisma.sample.findFirst({
            where: { originalId: batchSample1 }
        });
        expect(dbAccepted).toBeTruthy();
        expect(dbAccepted.status).toBe('ACCEPTED');
        expect(dbAccepted.custodyCarrierName).toBe('SpeedyLogistics Driver Silva');
    });

    // 4. RC-19: State Machine Transition Rules
    test('RC-19: State machine permits valid RECEIVED_REJECTED transitions and rejects illegal legacy states', () => {
        // Valid transitions
        expect(workflow.isValidSampleTransition('EXPECTED', 'RECEIVED_REJECTED')).toBe(true);
        expect(workflow.isValidSampleTransition('RECEIVED', 'RECEIVED_REJECTED')).toBe(true);
        expect(workflow.isValidSampleTransition('RECEIVED_REJECTED', 'DISPOSED')).toBe(true);
        expect(workflow.isValidSampleTransition('RECEIVED_REJECTED', 'ACCEPTED')).toBe(true);

        // Illegal transitions
        expect(workflow.isValidSampleTransition('RECEIVED_REJECTED', 'PROCESSING')).toBe(false);
        expect(workflow.isValidSampleTransition('RECEIVED_REJECTED', 'APPROVED')).toBe(false);

        // Legacy states
        expect(workflow.isLegacySampleState('RECEIVED_REJECTED')).toBe(false);
        expect(workflow.isLegacySampleState('REJECTED')).toBe(true);
        expect(workflow.isValidSampleState('RECEIVED_REJECTED')).toBe(true);
    });
});
