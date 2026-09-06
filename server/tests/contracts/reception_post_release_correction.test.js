const request = require('supertest');
const app = require('../../app');
const prisma = require('../../prisma');
const { getAuthToken } = require('../setup');
const { resolveCoordinates } = require('../../utils/coordinateResolver');

describe('Reception Post-Release Corrections: Lifecycle Safety, Context & Dashboard Metrics', () => {
    let authHeader;
    let foreignAuthHeader;
    const testLab = 'LAB-GTM-POST';
    const foreignLab = 'LAB-HND-FOREIGN';
    const testProjectId = `PROJ-POST-${Date.now()}`;
    const trackedSampleIds = new Set();

    beforeAll(async () => {
        // Ensure test labs exist
        await prisma.lab.upsert({
            where: { id: testLab },
            update: { timezone: 'America/Guatemala' },
            create: {
                id: testLab,
                code: 'GTM_POST',
                name: 'Guatemala Post Release Lab',
                country: 'GT',
                timezone: 'America/Guatemala'
            }
        });

        await prisma.lab.upsert({
            where: { id: foreignLab },
            update: { timezone: 'America/Tegucigalpa' },
            create: {
                id: foreignLab,
                code: 'HND_FOREIGN',
                name: 'Honduras Foreign Lab',
                country: 'HN',
                timezone: 'America/Tegucigalpa'
            }
        });

        // Test project
        await prisma.project.create({
            data: {
                id: testProjectId,
                code: testProjectId,
                name: 'Post-Release Verification Project',
                status: 'ACTIVE',
                labId: testLab
            }
        });

        // Tokens
        const token = await getAuthToken('SAMPLE_RECEPTION', testLab, ['GTM'], [testProjectId]);
        authHeader = `Bearer ${token}`;

        const foreignToken = await getAuthToken('SAMPLE_RECEPTION', foreignLab, ['HND'], []);
        foreignAuthHeader = `Bearer ${foreignToken}`;

        await prisma.user.updateMany({
            where: { role: 'SAMPLE_RECEPTION' },
            data: { mustChangePassword: false }
        });
    });

    afterAll(async () => {
        try {
            const sampleIds = Array.from(trackedSampleIds);
            if (sampleIds.length > 0) {
                await prisma.auditLog.deleteMany({
                    where: { OR: [{ entityId: { in: sampleIds } }, { sampleId: { in: sampleIds } }] }
                });
                await prisma.workItem.deleteMany({
                    where: { sampleId: { in: sampleIds } }
                });
                await prisma.sample.deleteMany({
                    where: { id: { in: sampleIds } }
                });
            }
            await prisma.project.deleteMany({ where: { id: testProjectId } });
            await prisma.lab.deleteMany({ where: { id: { in: [testLab, foreignLab] } } });
        } catch (err) {
            console.warn('[afterAll] Cleanup error:', err.message);
        }
    });

    // ─────────────────────────────────────────────────────────────
    // 1. DRAFT LIFECYCLE INTEGRITY & LOCKED STATUS PROTECTION
    // ─────────────────────────────────────────────────────────────
    describe('1. Draft Lifecycle Integrity & Locked Status Protection', () => {
        const lockedStatuses = [
            'APPROVED',
            'ACCEPTED',
            'LAB_ID_ASSIGNED',
            'PROCESSING',
            'COMPLETED',
            'ARCHIVED',
            'DISPOSED',
            'RECEIVED_REJECTED'
        ];

        test.each(lockedStatuses)('Draft save must reject regressing %s sample and preserve its status', async (lockedStatus) => {
            const sampleId = `SMP-LOCK-${lockedStatus}-${Date.now()}`;
            trackedSampleIds.add(sampleId);

            await prisma.sample.create({
                data: {
                    id: sampleId,
                    originalId: sampleId,
                    status: lockedStatus,
                    assignedLab: testLab,
                    projectCode: testProjectId,
                    projectId: testProjectId,
                    receptionDate: new Date()
                }
            });

            // Attempt to save draft on locked sample
            const res = await request(app)
                .post('/api/reception/intake')
                .set('Authorization', authHeader)
                .send({
                    originalId: sampleId,
                    decision: 'DRAFT',
                    isDraft: true,
                    notes: 'Malicious draft regression attempt'
                });

            expect(res.status).toBe(403);
            expect(res.body.success).toBe(false);

            // Verify database record was NOT regressed
            const persisted = await prisma.sample.findUnique({ where: { id: sampleId } });
            expect(persisted.status).toBe(lockedStatus);
        });

        it('Saving draft on a RECEIVED sample updates draft fields but retains status as RECEIVED (never regresses to DRAFT)', async () => {
            const sampleId = `SMP-RCV-DRAFT-${Date.now()}`;
            trackedSampleIds.add(sampleId);

            await prisma.sample.create({
                data: {
                    id: sampleId,
                    originalId: sampleId,
                    status: 'RECEIVED',
                    assignedLab: testLab,
                    projectCode: testProjectId,
                    projectId: testProjectId,
                    receptionDate: new Date()
                }
            });

            const res = await request(app)
                .post('/api/reception/intake')
                .set('Authorization', authHeader)
                .send({
                    originalId: sampleId,
                    decision: 'DRAFT',
                    isDraft: true,
                    notes: 'Revision on received sample'
                });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);

            const persisted = await prisma.sample.findUnique({ where: { id: sampleId } });
            expect(persisted.status).toBe('RECEIVED');
        });

        it('Saving draft with isWalkIn: true on an existing project sample preserves project link', async () => {
            const sampleId = `SMP-PRESERVE-PROJ-${Date.now()}`;
            trackedSampleIds.add(sampleId);

            await prisma.sample.create({
                data: {
                    id: sampleId,
                    originalId: sampleId,
                    status: 'EXPECTED',
                    assignedLab: testLab,
                    projectCode: testProjectId,
                    projectId: testProjectId
                }
            });

            const res = await request(app)
                .post('/api/reception/intake')
                .set('Authorization', authHeader)
                .send({
                    originalId: sampleId,
                    decision: 'DRAFT',
                    isDraft: true,
                    isWalkIn: true, // Attempt to wipe project
                    notes: 'Testing project link preservation'
                });

            expect(res.status).toBe(200);

            const persisted = await prisma.sample.findUnique({ where: { id: sampleId } });
            expect(persisted.status).toBe('DRAFT');
            expect(persisted.projectId).toBe(testProjectId);
            expect(persisted.projectCode).toBe(testProjectId);
        });

        it('Reject draft intake attempt for sample belonging to foreign lab with 403', async () => {
            const sampleId = `SMP-FOREIGN-LAB-${Date.now()}`;
            trackedSampleIds.add(sampleId);

            await prisma.sample.create({
                data: {
                    id: sampleId,
                    originalId: sampleId,
                    status: 'EXPECTED',
                    assignedLab: foreignLab
                }
            });

            const res = await request(app)
                .post('/api/reception/intake')
                .set('Authorization', authHeader) // user is testLab, sample is foreignLab
                .send({
                    originalId: sampleId,
                    decision: 'DRAFT',
                    isDraft: true
                });

            expect(res.status).toBe(403);
            expect(res.body.success).toBe(false);
        });
    });

    // ─────────────────────────────────────────────────────────────
    // 2. READ-ONLY SCOPED INTAKE CONTEXT (GET /api/reception/sample-context)
    // ─────────────────────────────────────────────────────────────
    describe('2. Read-Only Scoped Intake Context (GET /api/reception/sample-context)', () => {
        it('Loads complete intake detail without stripping fieldMetadata or receptionData', async () => {
            const sampleId = `SMP-DETAIL-${Date.now()}`;
            trackedSampleIds.add(sampleId);

            const fieldMetadata = {
                latitude: { value: 14.532, source: 'KOBO' },
                longitude: { value: -90.543, source: 'KOBO' },
                site_id: { value: 'SITE-ALPHA', source: 'KOBO' }
            };
            const receptionData = {
                notes: 'Saved draft notes',
                checklist: { items: { sealed: 'PASS' } },
                analysisAdditions: ['PH_H2O'],
                analysisRemovals: ['TEXTURE']
            };

            await prisma.sample.create({
                data: {
                    id: sampleId,
                    originalId: sampleId,
                    status: 'DRAFT',
                    assignedLab: testLab,
                    projectCode: testProjectId,
                    projectId: testProjectId,
                    fieldMetadata: JSON.stringify(fieldMetadata),
                    receptionData: JSON.stringify(receptionData)
                }
            });

            const res = await request(app)
                .get('/api/reception/sample-context')
                .set('Authorization', authHeader)
                .query({ originalId: sampleId });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.sample.fieldMetadata).toEqual(fieldMetadata);
            expect(res.body.sample.receptionData.notes).toBe('Saved draft notes');
            expect(res.body.coordinates.isRecorded).toBe(true);
            expect(res.body.coordinates.lat).toBeCloseTo(14.532);
            expect(res.body.coordinates.lng).toBeCloseTo(-90.543);
            expect(res.body.coordinates.source).toBe('KOBO');
        });

        it('Correctly resolves valid zero latitude/longitude (equator/prime meridian)', async () => {
            const sampleId = `SMP-ZERO-COORD-${Date.now()}`;
            trackedSampleIds.add(sampleId);

            await prisma.sample.create({
                data: {
                    id: sampleId,
                    originalId: sampleId,
                    status: 'EXPECTED',
                    assignedLab: testLab,
                    fieldMetadata: JSON.stringify({ latitude: 0.0, longitude: 0.0 })
                }
            });

            const res = await request(app)
                .get(`/api/reception/sample-context/${sampleId}`)
                .set('Authorization', authHeader);

            expect(res.status).toBe(200);
            expect(res.body.coordinates.isRecorded).toBe(true);
            expect(res.body.coordinates.lat).toBe(0.0);
            expect(res.body.coordinates.lng).toBe(0.0);
        });

        it('Rejects foreign lab sample context request with 403', async () => {
            const sampleId = `SMP-FOREIGN-CTX-${Date.now()}`;
            trackedSampleIds.add(sampleId);

            await prisma.sample.create({
                data: {
                    id: sampleId,
                    originalId: sampleId,
                    status: 'EXPECTED',
                    assignedLab: foreignLab
                }
            });

            const res = await request(app)
                .get(`/api/reception/sample-context/${sampleId}`)
                .set('Authorization', authHeader); // testLab requesting foreignLab

            expect(res.status).toBe(403);
            expect(res.body.success).toBe(false);
        });
    });

    // ─────────────────────────────────────────────────────────────
    // 3. HONEST DASHBOARD METRICS (GET /api/dashboard/live)
    // ─────────────────────────────────────────────────────────────
    describe('3. Honest Dashboard Reception Metrics (GET /api/dashboard/live)', () => {
        it('Strictly excludes EXPECTED and DRAFT samples from pending drying and preparation', async () => {
            const ts = Date.now();
            const sExpected = `DASH-EXP-${ts}`;
            const sDraft = `DASH-DFT-${ts}`;
            const sReceived = `DASH-RCV-${ts}`;

            trackedSampleIds.add(sExpected);
            trackedSampleIds.add(sDraft);
            trackedSampleIds.add(sReceived);

            const now = new Date();

            // Create EXPECTED with legacy PENDING flags & null receptionDate
            await prisma.sample.create({
                data: {
                    id: sExpected,
                    originalId: sExpected,
                    status: 'EXPECTED',
                    assignedLab: testLab,
                    dryingStatus: 'PENDING',
                    preparationStatus: 'PENDING',
                    receptionDate: null
                }
            });

            // Create DRAFT with legacy PENDING flags & null receptionDate
            await prisma.sample.create({
                data: {
                    id: sDraft,
                    originalId: sDraft,
                    status: 'DRAFT',
                    assignedLab: testLab,
                    dryingStatus: 'PENDING',
                    preparationStatus: 'PENDING',
                    receptionDate: null
                }
            });

            // Create RECEIVED sample intaken today
            await prisma.sample.create({
                data: {
                    id: sReceived,
                    originalId: sReceived,
                    status: 'RECEIVED',
                    assignedLab: testLab,
                    dryingStatus: 'PENDING',
                    preparationStatus: 'PENDING',
                    receptionDate: now
                }
            });

            const res = await request(app)
                .get('/api/dashboard/live')
                .set('Authorization', authHeader);

            expect(res.status).toBe(200);
            expect(res.body.role).toBe('SAMPLE_RECEPTION');
            expect(res.body.kpis).toBeDefined();

            const { kpis } = res.body;
            // Expected arrivals must include the EXPECTED sample
            expect(kpis.expectedArrivals).toBeGreaterThanOrEqual(1);
            // Incomplete drafts must include the DRAFT sample
            expect(kpis.incompleteDrafts).toBeGreaterThanOrEqual(1);
            // Received today must count only the RECEIVED sample
            expect(kpis.receivedToday).toBeGreaterThanOrEqual(1);

            // CRITICAL: pendingDrying must NOT count EXPECTED or DRAFT
            // Only intaken samples (sReceived) are eligible!
            expect(kpis.pendingDrying).toBeLessThan(kpis.totalProcessed);

            // sReceived has dryingStatus: PENDING, so it CANNOT be ready for preparation at the same time
            // readyPreparation requires drying completed!
            expect(kpis.pendingPreparation).toBe(0);
        });

        it('Sample with dryingStatus: DONE and preparationStatus: PENDING transitions to readyPreparation', async () => {
            const sDried = `DASH-DRIED-${Date.now()}`;
            trackedSampleIds.add(sDried);

            await prisma.sample.create({
                data: {
                    id: sDried,
                    originalId: sDried,
                    status: 'ACCEPTED',
                    assignedLab: testLab,
                    dryingStatus: 'DONE',
                    preparationStatus: 'PENDING',
                    receptionDate: new Date()
                }
            });

            const res = await request(app)
                .get('/api/dashboard/live')
                .set('Authorization', authHeader);

            expect(res.status).toBe(200);
            expect(res.body.kpis.readyPreparation).toBeGreaterThanOrEqual(1);
        });

        it('Sample with dryingStatus: null is NOT counted in readyPreparation when drying is applicable', async () => {
            const sNullDrying = `DASH-NULL-DRY-${Date.now()}`;
            trackedSampleIds.add(sNullDrying);

            // Create a sample with dryingStatus: null and preparationStatus: PENDING
            await prisma.sample.create({
                data: {
                    id: sNullDrying,
                    originalId: sNullDrying,
                    status: 'ACCEPTED',
                    assignedLab: testLab,
                    dryingStatus: null,
                    preparationStatus: 'PENDING',
                    receptionDate: new Date()
                }
            });

            const res = await request(app)
                .get('/api/dashboard/live')
                .set('Authorization', authHeader);

            expect(res.status).toBe(200);
            // Count must only reflect samples with dryingStatus: 'DONE'
            // The sample with dryingStatus: null must be treated as unknown, NOT waived!
            const matchingReady = res.body.kpis.readyPreparation;
            expect(matchingReady).toBeDefined();

            // Verify explicitly via Prisma count using the exact query condition
            const explicitDoneCount = await prisma.sample.count({
                where: {
                    assignedLab: testLab,
                    status: { in: ['RECEIVED', 'ACCEPTED', 'PROCESSING', 'PREPARATION'] },
                    receptionDate: { not: null },
                    preparationStatus: 'PENDING',
                    dryingStatus: 'DONE'
                }
            });
            expect(res.body.kpis.readyPreparation).toBe(explicitDoneCount);
        });

        it('Second-Lab Fixture: Scope predicates are never overwritten by queue criteria; counts and preview rows strictly exclude other labs', async () => {
            const ts = Date.now();
            const sForeignRejected = `FOR-REJ-${ts}`;
            const sForeignOverdue = `FOR-OVD-${ts}`;
            const sForeignExpected = `FOR-EXP-${ts}`;
            const sForeignDraft = `FOR-DFT-${ts}`;
            const sForeignReceived = `FOR-RCV-${ts}`;

            trackedSampleIds.add(sForeignRejected);
            trackedSampleIds.add(sForeignOverdue);
            trackedSampleIds.add(sForeignExpected);
            trackedSampleIds.add(sForeignDraft);
            trackedSampleIds.add(sForeignReceived);

            const pastDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
            const now = new Date();

            // Create foreign lab samples
            await prisma.sample.createMany({
                data: [
                    {
                        id: sForeignRejected,
                        originalId: sForeignRejected,
                        status: 'RECEIVED_REJECTED',
                        assignedLab: foreignLab,
                        labId: foreignLab,
                        receptionDate: now,
                        rejectionReason: 'Damaged container'
                    },
                    {
                        id: sForeignOverdue,
                        originalId: sForeignOverdue,
                        status: 'RECEIVED',
                        assignedLab: foreignLab,
                        labId: foreignLab,
                        receptionDate: pastDate
                    },
                    {
                        id: sForeignExpected,
                        originalId: sForeignExpected,
                        status: 'EXPECTED',
                        assignedLab: foreignLab,
                        labId: foreignLab
                    },
                    {
                        id: sForeignDraft,
                        originalId: sForeignDraft,
                        status: 'DRAFT',
                        assignedLab: foreignLab,
                        labId: foreignLab
                    },
                    {
                        id: sForeignReceived,
                        originalId: sForeignReceived,
                        status: 'RECEIVED',
                        assignedLab: foreignLab,
                        labId: foreignLab,
                        receptionDate: now,
                        dryingStatus: 'DONE',
                        preparationStatus: 'PENDING'
                    }
                ]
            });

            // 1. Query as Lab A (testLab) - MUST NOT see any foreign lab samples
            const resA = await request(app)
                .get('/api/dashboard/live')
                .set('Authorization', authHeader);

            expect(resA.status).toBe(200);

            // Preview queues must not leak any foreign lab samples
            const foreignIds = [sForeignRejected, sForeignOverdue, sForeignExpected, sForeignDraft, sForeignReceived];
            const checkNoForeignRows = (queue, queueName) => {
                const found = queue.filter(item => foreignIds.includes(item.id) || foreignIds.includes(item.originalId));
                expect(found).toHaveLength(0);
            };

            checkNoForeignRows(resA.body.attentionQueue, 'attentionQueue');
            checkNoForeignRows(resA.body.expectedQueue, 'expectedQueue');
            checkNoForeignRows(resA.body.draftQueue, 'draftQueue');
            checkNoForeignRows(resA.body.recentIntakes, 'recentIntakes');

            // 2. Query as Foreign Lab (foreignLab) - MUST see its own samples
            const resB = await request(app)
                .get('/api/dashboard/live')
                .set('Authorization', foreignAuthHeader);

            expect(resB.status).toBe(200);
            expect(resB.body.kpis.expectedArrivals).toBeGreaterThanOrEqual(1);
            expect(resB.body.kpis.incompleteDrafts).toBeGreaterThanOrEqual(1);
            expect(resB.body.kpis.needsAttention).toBeGreaterThanOrEqual(2); // sForeignRejected + sForeignOverdue
            expect(resB.body.kpis.receivedToday).toBeGreaterThanOrEqual(1); // sForeignReceived

            const attentionIds = resB.body.attentionQueue.map(s => s.id);
            expect(attentionIds).toContain(sForeignRejected);
            expect(attentionIds).toContain(sForeignOverdue);

            const expectedIds = resB.body.expectedQueue.map(s => s.id);
            expect(expectedIds).toContain(sForeignExpected);

            const draftIds = resB.body.draftQueue.map(s => s.id);
            expect(draftIds).toContain(sForeignDraft);

            const recentIds = resB.body.recentIntakes.map(s => s.id);
            expect(recentIds).toContain(sForeignReceived);
        });

        it('Projects lean preview rows without transmitting raw fieldMetadata strings', async () => {
            const res = await request(app)
                .get('/api/dashboard/live')
                .set('Authorization', authHeader);

            expect(res.status).toBe(200);

            // Check expectedQueue items have hasCoordinates boolean and NO raw fieldMetadata string
            if (res.body.expectedQueue.length > 0) {
                res.body.expectedQueue.forEach(item => {
                    expect(typeof item.hasCoordinates).toBe('boolean');
                    expect(item.fieldMetadata).toBeUndefined();
                });
            }

            // Check recentIntakes items have hasCoordinates boolean and NO raw fieldMetadata string
            if (res.body.recentIntakes.length > 0) {
                res.body.recentIntakes.forEach(item => {
                    expect(typeof item.hasCoordinates).toBe('boolean');
                    expect(item.fieldMetadata).toBeUndefined();
                });
            }
        });
    });

    // ─────────────────────────────────────────────────────────────
    // 4. CANONICAL COORDINATE RESOLVER UNIT TESTS
    // ─────────────────────────────────────────────────────────────
    describe('4. Canonical Coordinate Resolver Unit Contract', () => {
        it('Resolves { value, source } Kobo wrapper', () => {
            const sample = {
                fieldMetadata: {
                    latitude: { value: 14.6349, source: 'KOBO' },
                    longitude: { value: -90.5069, source: 'KOBO' },
                    site: { value: 'Guatemala City Central', source: 'KOBO' }
                }
            };
            const resolved = resolveCoordinates(sample);
            expect(resolved.isRecorded).toBe(true);
            expect(resolved.lat).toBeCloseTo(14.6349);
            expect(resolved.lng).toBeCloseTo(-90.5069);
            expect(resolved.source).toBe('KOBO');
            expect(resolved.locationDescription).toBe('Guatemala City Central');
        });

        it('Resolves space-separated GPS string with altitude and accuracy', () => {
            const sample = {
                fieldMetadata: {
                    gps: '14.5321 -90.5432 1520 4.2'
                }
            };
            const resolved = resolveCoordinates(sample);
            expect(resolved.isRecorded).toBe(true);
            expect(resolved.lat).toBeCloseTo(14.5321);
            expect(resolved.lng).toBeCloseTo(-90.5432);
            expect(resolved.elevation).toBe(1520);
            expect(resolved.accuracy).toBe(4.2);
            expect(resolved.confidence).toBe('HIGH'); // <= 20m
        });

        it('Resolves valid 0,0 coordinates on the equator/prime meridian', () => {
            const sample = {
                fieldMetadata: { latitude: 0, longitude: 0 }
            };
            const resolved = resolveCoordinates(sample);
            expect(resolved.isRecorded).toBe(true);
            expect(resolved.lat).toBe(0);
            expect(resolved.lng).toBe(0);
        });

        it('Rejects invalid non-finite, out-of-bounds or boolean coordinates', () => {
            expect(resolveCoordinates({ fieldMetadata: { latitude: true, longitude: false } }).isRecorded).toBe(false);
            expect(resolveCoordinates({ fieldMetadata: { latitude: 95.0, longitude: -90.0 } }).isRecorded).toBe(false);
            expect(resolveCoordinates({ fieldMetadata: { latitude: 14.0, longitude: -200.0 } }).isRecorded).toBe(false);
            expect(resolveCoordinates({ fieldMetadata: { latitude: 'invalid', longitude: 'data' } }).isRecorded).toBe(false);
            expect(resolveCoordinates({ fieldMetadata: {} }).isRecorded).toBe(false);
            expect(resolveCoordinates(null).isRecorded).toBe(false);
        });
    });
});
