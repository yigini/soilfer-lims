const request = require('supertest');
const app = require('../../app');
const prisma = require('../../prisma');
const { getAuthToken } = require('../setup');
const { deriveLocationConfidence } = require('../../controllers/receptionController');
const { parseCoordinates } = require('../../utils/coordParser');
const workflow = require('../../workflowContract');

describe('Stage F: Reception Contract and End-to-End Regression Suite (RC-20)', () => {
    let authHeader;
    const testLab = 'LAB-GTM';
    const testProjectId = `PROJ-REG-${Date.now()}`;
    const trackedSampleIds = new Set();
    let trackedConsignmentId = null;

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
                name: 'Stage F Regression Test Project',
                status: 'ACTIVE'
            }
        });

        // Ensure dummy test analysis exists with known mass requirement
        await prisma.analysis.upsert({
            where: { code: 'REG_TEST_PH' },
            update: { sampleMassRequired: 50.0 },
            create: {
                code: 'REG_TEST_PH',
                name: 'Regression Test pH Method',
                matrix: 'SOIL',
                sampleMassRequired: 50.0,
                status: 'active'
            }
        });
    });

    afterAll(async () => {
        try {
            const sampleIds = Array.from(trackedSampleIds);
            if (sampleIds.length > 0) {
                await prisma.auditLog.deleteMany({
                    where: {
                        OR: [
                            { entityId: { in: sampleIds } },
                            { sampleId: { in: sampleIds } },
                            ...(trackedConsignmentId ? [{ entityId: trackedConsignmentId }] : [])
                        ]
                    }
                });
                await prisma.workItem.deleteMany({
                    where: { sampleId: { in: sampleIds } }
                });
                await prisma.sample.deleteMany({
                    where: { id: { in: sampleIds } }
                });
            }
            if (trackedConsignmentId) {
                await prisma.consignment.deleteMany({
                    where: { id: trackedConsignmentId }
                });
            }
            await prisma.project.deleteMany({
                where: { id: testProjectId }
            });
            await prisma.analysis.deleteMany({
                where: { code: 'REG_TEST_PH' }
            });
        } catch (err) {
            console.error('[afterAll cleanup] Error:', err.message);
        }
    });

    // -------------------------------------------------------------------------
    // 1. RC-01: Mass Sufficiency & Acknowledgement Path
    // -------------------------------------------------------------------------
    describe('1. Mass Sufficiency and Deficit Acknowledgement (RC-01)', () => {
        it('calculates mass requirement accurately across catalogue + 100g retention', async () => {
            const res = await request(app)
                .post('/api/reception/mass-check')
                .set('Authorization', authHeader)
                .send({
                    analysisCodes: ['REG_TEST_PH'],
                    retentionMass: 100
                });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.totalAnalyticalMass).toBe(50.0);
            expect(res.body.retentionMass).toBe(100.0);
            expect(res.body.totalRequiredMass).toBe(150.0);
        });

        it('rejects under-mass sample without explicit acknowledgement', async () => {
            const sampleId = `REG-MASS-FAIL-${Date.now()}`;
            trackedSampleIds.add(sampleId);

            const res = await request(app)
                .post('/api/reception/intake')
                .set('Authorization', authHeader)
                .send({
                    originalId: sampleId,
                    projectId: testProjectId,
                    receivedMass: 60.0, // Deficit: 150 - 60 = 90g
                    massWarningAcknowledged: false,
                    requiredAnalyses: ['REG_TEST_PH'],
                    decision: 'ACCEPT',
                    labId: testLab,
                    isWalkIn: true
                });

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('MASS_DEFICIT');
            expect(res.body.massDeficitInfo.deficit).toBe(90.0);
            expect(res.body.massDeficitInfo.analysesAtRisk.length).toBeGreaterThanOrEqual(1);
        });

        it('accepts under-mass sample WITH explicit acknowledgement and records override', async () => {
            const sampleId = `REG-MASS-PASS-${Date.now()}`;
            trackedSampleIds.add(sampleId);

            const res = await request(app)
                .post('/api/reception/intake')
                .set('Authorization', authHeader)
                .send({
                    originalId: sampleId,
                    projectId: testProjectId,
                    receivedMass: 60.0,
                    massWarningAcknowledged: true,
                    requiredAnalyses: ['REG_TEST_PH'],
                    decision: 'ACCEPT',
                    labId: testLab,
                    isWalkIn: true
                });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);

            // Verify in DB that sample persisted mass and acknowledgment
            const dbSample = await prisma.sample.findUnique({ where: { id: res.body.id || sampleId } });
            expect(dbSample).toBeTruthy();
            expect(dbSample.receivedMass).toBe(60.0);
            expect(dbSample.massWarningAcknowledged).toBe(true);
            expect(dbSample).toBeTruthy();
            const history = JSON.parse(dbSample.history || '[]');
            const massNote = history.find(h => h.status === 'MASS_DEFICIT_OVERRIDE' || (h.note && h.note.includes('mass deficit')));
            expect(massNote).toBeTruthy();
            expect(massNote.note).toContain('Accepted with mass deficit');
        });
    });

    // -------------------------------------------------------------------------
    // 2. RC-05: Three Coordinate Formats Conversion (DD, DMS, UTM)
    // -------------------------------------------------------------------------
    describe('2. Three Coordinate Formats Conversion (RC-05)', () => {
        it('parses Decimal Degrees accurately', () => {
            const res = parseCoordinates('14.6349, -90.5069');
            expect(res).toBeTruthy();
            expect(res.format).toBe('DD');
            expect(res.lat).toBeCloseTo(14.6349, 4);
            expect(res.lng).toBeCloseTo(-90.5069, 4);
        });

        it('parses Degrees Minutes Seconds (DMS) accurately into Decimal Degrees', () => {
            const res = parseCoordinates('14°38\'5.64"N, 90°30\'24.84"W');
            expect(res).toBeTruthy();
            expect(res.format).toBe('DMS');
            expect(res.lat).toBeCloseTo(14.6349, 3);
            expect(res.lng).toBeCloseTo(-90.5069, 3);
        });

        it('parses UTM with Zone & Hemisphere accurately into WGS84 Decimal Degrees', () => {
            const res = parseCoordinates('15N 752300 1625400');
            expect(res).toBeTruthy();
            expect(res.format).toBe('UTM');
            expect(res.lat).toBeCloseTo(14.690, 2);
            expect(res.lng).toBeCloseTo(-90.657, 2);
        });

        it('POST /api/reception/parse-coordinates exposes all three formats over API', async () => {
            const formats = [
                { input: '-1.2921, 36.8219', expectedFormat: 'DD' },
                { input: '14°48\'12"N, 90°13\'48"W', expectedFormat: 'DMS' },
                { input: '15N 752300 1625400', expectedFormat: 'UTM' }
            ];

            for (const f of formats) {
                const res = await request(app)
                    .post('/api/reception/parse-coordinates')
                    .set('Authorization', authHeader)
                    .send({ coordinates: f.input });

                expect(res.status).toBe(200);
                expect(res.body.format).toBe(f.expectedFormat);
                expect(res.body.lat).toBeDefined();
                expect(res.body.lng).toBeDefined();
            }
        });
    });

    // -------------------------------------------------------------------------
    // 3. RC-06 & RC-11: Uncertainty Defaults & Composite Geometry
    // -------------------------------------------------------------------------
    describe('3. Positional Uncertainty Defaults & Composite Depth (RC-06, RC-11)', () => {
        it('persists uncertainty, composite radius, and numeric depths', async () => {
            const sampleId = `REG-UNCERT-${Date.now()}`;
            trackedSampleIds.add(sampleId);

            const res = await request(app)
                .post('/api/reception/intake')
                .set('Authorization', authHeader)
                .send({
                    originalId: sampleId,
                    projectId: testProjectId,
                    decision: 'ACCEPTED',
                    labId: testLab,
                    isWalkIn: true,
                    receivedMass: 250,
                    samplingDetails: {
                        captureMethod: 'DEVICE_GPS',
                        coordinates: { lat: 14.6349, lng: -90.5069, accuracy: 8.4 },
                        positionalUncertaintyM: 8.4,
                        compositeRadiusM: 120.0,
                        depthTopCm: 0,
                        depthBottomCm: 20
                    }
                });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);

            const s = await prisma.sample.findUnique({ where: { id: res.body.id || sampleId } });
            expect(s).toBeTruthy();
            expect(s.positionalUncertaintyM).toBeCloseTo(8.4, 1);
            expect(s.compositeRadiusM).toBe(120.0);
            expect(s.depthTopCm).toBe(0);
            expect(s.depthBottomCm).toBe(20);
        });
    });

    // -------------------------------------------------------------------------
    // 4. RC-07: Derived Confidence Resisting Unevidenced HIGH
    // -------------------------------------------------------------------------
    describe('4. Derived Location Confidence Resisting Unevidenced HIGH (RC-07)', () => {
        it('derives HIGH confidence ONLY for evidenced GPS with tight accuracy', () => {
            expect(deriveLocationConfidence('FIELD_GPS', 10)).toBe('HIGH');
            expect(deriveLocationConfidence('DEVICE_GPS', 15)).toBe('HIGH');
            expect(deriveLocationConfidence('FIELD_GPS', 40)).toBe('MEDIUM');
        });

        it('resists HIGH confidence for manual desk entry even if claimed tight uncertainty', () => {
            expect(deriveLocationConfidence('DESK_PASTE', 5)).toBe('MEDIUM');
            expect(deriveLocationConfidence('MAP_PIN', 10)).toBe('MEDIUM');
            expect(deriveLocationConfidence('ADMIN_UNIT', 1000)).toBe('LOW');
            expect(deriveLocationConfidence('TEXT_ONLY', null)).toBe('LOW');
        });

        it('downgrades intake claiming HIGH confidence on DESK_PASTE method', async () => {
            const sampleId = `REG-CONF-RESIST-${Date.now()}`;
            trackedSampleIds.add(sampleId);

            const res = await request(app)
                .post('/api/reception/intake')
                .set('Authorization', authHeader)
                .send({
                    originalId: sampleId,
                    projectId: testProjectId,
                    decision: 'ACCEPTED',
                    labId: testLab,
                    isWalkIn: true,
                    receivedMass: 200,
                    samplingDetails: {
                        captureMethod: 'DESK_PASTE',
                        locationConfidence: 'HIGH', // Unevidenced claim!
                        coordinates: { lat: 14.6349, lng: -90.5069, accuracy: 10 },
                        positionalUncertaintyM: 10
                    }
                });

            expect(res.status).toBe(200);
            const dbSample = await prisma.sample.findUnique({ where: { id: sampleId } });
            const fieldMeta = JSON.parse(dbSample.fieldMetadata || '{}');
            // Must have been downgraded to MEDIUM or LOW, never HIGH
            expect(fieldMeta.locationConfidence?.value).toBe('MEDIUM');
            expect(fieldMeta.locationCanonical?.value?.locationConfidence).toBe('MEDIUM');
        });
    });

    // -------------------------------------------------------------------------
    // 5. RC-08: Offline Intake with Geocoding Fallback
    // -------------------------------------------------------------------------
    describe('5. Offline Reverse Geocoding Fallback (RC-08)', () => {
        it('falls back to offline administrative boundaries safely', async () => {
            const res = await request(app)
                .get('/api/reception/reverse-geocode?lat=14.6349&lng=-90.5069')
                .set('Authorization', authHeader);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(['ONLINE', 'OFFLINE_BOUNDARY', 'CACHE']).toContain(res.body.source);
            expect(res.body.country).toBeDefined();
        });
    });

    // -------------------------------------------------------------------------
    // 6. RC-12, RC-13, RC-14: 40-Sample Consignment Batch with 2 Exceptions
    // -------------------------------------------------------------------------
    describe('6. 40-Sample Consignment Intake with 2 Exceptions (RC-12, RC-13, RC-14)', () => {
        it('processes 40-sample atomic batch with 2 rejected exceptions resulting in PARTIAL status', async () => {
            const batchTimestamp = Date.now();
            const samples = [];

            for (let i = 1; i <= 40; i++) {
                const sampleId = `REG-40B-${batchTimestamp}-${String(i).padStart(2, '0')}`;
                trackedSampleIds.add(sampleId);

                if (i === 13) {
                    // Exception 1: Damaged/punctured package
                    samples.push({
                        originalId: sampleId,
                        receivedMass: 85.0,
                        status: 'REJECTED',
                        rejectionReason: 'Punctured packaging during road freight transport',
                        checklist: {
                            container: { status: 'FAIL', reason: 'Punctured polybag' },
                            condition: { status: 'FAIL', reason: 'Leaked sample' }
                        },
                        photos: ['/uploads/intake/damaged_13.jpg']
                    });
                } else if (i === 27) {
                    // Exception 2: Illegible label and desiccated
                    samples.push({
                        originalId: sampleId,
                        receivedMass: 110.0,
                        status: 'REJECTED',
                        rejectionReason: 'Barcode torn off and container unsealed',
                        checklist: {
                            label: { status: 'FAIL', reason: 'Torn barcode' },
                            condition: { status: 'FAIL', reason: 'Unsealed' }
                        },
                        photos: ['/uploads/intake/torn_27.jpg']
                    });
                } else {
                    // Standard accepted sample
                    samples.push({
                        originalId: sampleId,
                        receivedMass: 450.0,
                        status: 'ACCEPTED',
                        checklist: {
                            container: { status: 'PASS' },
                            label: { status: 'PASS' },
                            condition: { status: 'PASS' }
                        }
                    });
                }
            }

            const handoverTime = new Date(Date.now() - 3600000).toISOString();
            const payload = {
                consignment: {
                    deliveryNoteRef: `WAYBILL-REG40-${batchTimestamp}`,
                    deliveredBy: 'Trans-Regional Express Logistics',
                    deliveredAt: handoverTime,
                    expectedCount: 40,
                    notes: 'RC-20 40-sample batch verification trial',
                    submitter: {
                        name: 'Ing. Maria Morales',
                        organization: 'MAGA Guatemala',
                        phone: '+502 5555-4040'
                    },
                    projectCode: testProjectId
                },
                custody: {
                    handoverAt: handoverTime,
                    carrierName: 'Trans-Regional Express Driver Lopez',
                    trackingNumber: `TRX-${batchTimestamp}`,
                    senderSignature: 'Lopez / Carrier Driver',
                    officerSignature: 'CONFIRMED:reception_officer'
                },
                samples
            };

            const res = await request(app)
                .post('/api/reception/consignments')
                .set('Authorization', authHeader)
                .send(payload);

            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);

            const consignment = res.body.consignment;
            trackedConsignmentId = consignment.id;
            expect(consignment.sampleCount).toBe(40);
            expect(consignment.expectedCount).toBe(40);
            expect(consignment.status).toBe('PARTIAL'); // Mixed accepted & rejected

            // Verify all 40 samples in DB
            const dbSamples = await prisma.sample.findMany({
                where: { consignmentId: consignment.id },
                orderBy: { originalId: 'asc' }
            });
            expect(dbSamples.length).toBe(40);

            const acceptedSamples = dbSamples.filter(s => s.status === 'ACCEPTED');
            const rejectedSamples = dbSamples.filter(s => s.status === 'RECEIVED_REJECTED');

            expect(acceptedSamples.length).toBe(38);
            expect(rejectedSamples.length).toBe(2);

            // Verify exception details on the 2 rejected samples
            const rej1 = rejectedSamples.find(s => s.originalId.endsWith('-13'));
            const rej2 = rejectedSamples.find(s => s.originalId.endsWith('-27'));
            expect(rej1).toBeTruthy();
            expect(rej1.rejectionReason).toContain('Punctured packaging');
            expect(rej2).toBeTruthy();
            expect(rej2.rejectionReason).toContain('Barcode torn off');

            // Verify operational gate work items: accepted samples have PREPARATION gate, rejected do not
            const sample1Id = acceptedSamples[0].id;
            const prepWorkItemsAccepted = await prisma.workItem.findMany({
                where: { sampleId: sample1Id, analysis: 'PREPARATION' }
            });
            expect(prepWorkItemsAccepted.length).toBe(1);

            const prepWorkItemsRejected = await prisma.workItem.findMany({
                where: { sampleId: rej1.id }
            });
            expect(prepWorkItemsRejected.length).toBe(0);
        });
    });

    // -------------------------------------------------------------------------
    // 7. RC-19: Rejected State Distinctness
    // -------------------------------------------------------------------------
    describe('7. Rejected State Distinctness (RC-19)', () => {
        let rejectedSampleId;

        beforeAll(async () => {
            rejectedSampleId = `REG-DISTINCT-REJ-${Date.now()}`;
            trackedSampleIds.add(rejectedSampleId);

            await request(app)
                .post('/api/reception/intake')
                .set('Authorization', authHeader)
                .send({
                    originalId: rejectedSampleId,
                    projectId: testProjectId,
                    decision: 'REJECTED',
                    ncReason: 'Contaminated packaging with oil spill',
                    checklist: {
                        condition: { status: 'FAIL', reason: 'Oil spill' }
                    },
                    labId: testLab,
                    isWalkIn: true
                });
        });

        it('ensures rejected sample has status RECEIVED_REJECTED in database', async () => {
            const dbSample = await prisma.sample.findUnique({ where: { id: rejectedSampleId } });
            expect(dbSample).toBeTruthy();
            expect(dbSample.status).toBe('RECEIVED_REJECTED');
        });

        it('strictly excludes rejected sample from GET /api/samples/expected backlog', async () => {
            const res = await request(app)
                .get(`/api/samples/expected?q=${rejectedSampleId}`)
                .set('Authorization', authHeader);

            expect(res.status).toBe(200);
            const list = Array.isArray(res.body) ? res.body : (res.body.data || []);
            const found = list.find(s => s.originalId === rejectedSampleId);
            expect(found).toBeUndefined();
        });

        it('returns rejected sample under status=RECEIVED_REJECTED query', async () => {
            const res = await request(app)
                .get(`/api/samples?status=RECEIVED_REJECTED&search=${rejectedSampleId}`)
                .set('Authorization', authHeader);

            expect(res.status).toBe(200);
            const list = res.body.data || [];
            const found = list.find(s => s.originalId === rejectedSampleId);
            expect(found).toBeTruthy();
            expect(found.status).toBe('RECEIVED_REJECTED');
        });

        it('enforces workflow transition bounds: permits DISPOSED, rejects PROCESSING', () => {
            // Valid transition from RECEIVED_REJECTED
            const valid = workflow.SAMPLE_TRANSITIONS[workflow.SAMPLE_STATES.RECEIVED_REJECTED];
            expect(valid).toContain(workflow.SAMPLE_STATES.DISPOSED);
            expect(valid).toContain(workflow.SAMPLE_STATES.ACCEPTED);
            expect(valid).not.toContain(workflow.SAMPLE_STATES.PROCESSING);
            expect(workflow.isValidSampleTransition('RECEIVED_REJECTED', 'DISPOSED')).toBe(true);
            expect(workflow.isValidSampleTransition('RECEIVED_REJECTED', 'PROCESSING')).toBe(false);
        });
    });

    // -------------------------------------------------------------------------
    // 8. RC-19: Three Custody Timestamps & Counter-Signature
    // -------------------------------------------------------------------------
    describe('8. Custody Timestamps and Counter-Signature (RC-19)', () => {
        it('records physical handover separate from system entry with officer counter-signature', async () => {
            const sampleId = `REG-CUSTODY-${Date.now()}`;
            trackedSampleIds.add(sampleId);

            const handoverTime = new Date('2026-09-04T08:15:00.000Z');

            const res = await request(app)
                .post('/api/reception/intake')
                .set('Authorization', authHeader)
                .send({
                    originalId: sampleId,
                    projectId: testProjectId,
                    decision: 'ACCEPT',
                    labId: testLab,
                    isWalkIn: true,
                    receivedMass: 300,
                    custodyHandoverAt: handoverTime.toISOString(),
                    custodyCarrierName: 'AeroFlash Cargo Express Driver Ortiz',
                    custodyTrackingNumber: 'AF-WB-90901',
                    custodySenderSignature: 'Ortiz / Courier',
                    receivingOfficerSignature: 'CONFIRMED:receiving_officer_sig'
                });

            expect(res.status).toBe(200);
            const dbSample = await prisma.sample.findUnique({ where: { id: sampleId } });
            expect(dbSample).toBeTruthy();

            // 1. Handover timestamp vs System entry timestamp
            expect(new Date(dbSample.custodyHandoverAt).toISOString()).toBe(handoverTime.toISOString());
            expect(new Date(dbSample.createdAt).getTime()).toBeGreaterThan(handoverTime.getTime());

            // 2. Carrier & courier tracking
            expect(dbSample.custodyCarrierName).toBe('AeroFlash Cargo Express Driver Ortiz');
            expect(dbSample.custodyTrackingNumber).toBe('AF-WB-90901');
            expect(dbSample.custodySenderSignature).toBe('Ortiz / Courier');

            // 3. Officer identification & counter-signature
            expect(dbSample.receivingOfficerId).toBeDefined();
            expect(dbSample.receivingOfficerName).toBeDefined();
            expect(dbSample.receivingOfficerSignature).toBe('CONFIRMED:receiving_officer_sig');
        });
    });
});
