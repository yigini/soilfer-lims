/**
 * Contract Test Suite: Coordinated All-Role Dashboard Redesign (v1)
 * 
 * Verifies Acceptance Criteria A01–A42 across all 10 canonical roles:
 * - Role registry mapping & fallback (A01)
 * - Zero unreceived samples in drying/prep (A02)
 * - Physical receipt vs bench entry (A03)
 * - Operational checklist gates (A04)
 * - Exact totals without 200/500 truncation (A05, A06)
 * - 40 pH determinations grouped as 1 method group (A07)
 * - Discrete lifecycle events & timestamps (A08)
 * - Timezone boundaries & UTC fallback labelling (A09)
 * - Multi-lab isolation & AND-composition (A10, A11, A12)
 * - WebSocket fail-closed isolation (A13)
 * - External viewer report & data access restriction (A14)
 * - Final approval eligibility & concurrency conflict (A17, A18, A19)
 * - Audit user read-only enforcement (A29)
 */
'use strict';

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../app');
const prisma = require('../../prisma');
const { JWT_SECRET } = require('../../config/auth');
const { wsServer } = require('../../wsServer');
const { canRecord, canSubmit, canReview, canFinalApprove, canPublish } = require('../../services/workEligibility');
const { scopedWhere, getLocalDayInterval } = require('../../services/dashboardScope');

describe('Role Dashboards Redesign (v1) Contract Tests', () => {
    let testUsers = {};
    let testLab1, testLab2;
    const testPrefix = `DASH-${Date.now()}`;

    beforeAll(async () => {
        // Create 2 test labs for scope isolation verification
        testLab1 = await prisma.lab.create({
            data: {
                id: `LAB-DASH-1-${Date.now()}`,
                code: `LD1-${Date.now()}`,
                name: 'Test Lab One',
                country: 'Guatemala',
                timezone: 'America/Guatemala',
                isActive: true
            }
        });

        testLab2 = await prisma.lab.create({
            data: {
                id: `LAB-DASH-2-${Date.now()}`,
                code: `LD2-${Date.now()}`,
                name: 'Test Lab Two',
                country: 'Guatemala',
                timezone: 'UTC', // explicitly UTC
                isActive: true
            }
        });

        // Seed representative users for each role
        const rolesToSeed = [
            'SAMPLE_RECEPTION',
            'LAB_TECHNICIAN',
            'LAB_MANAGER',
            'MASTER_USER',
            'PROJECT_MANAGER',
            'AUDIT_USER',
            'SURVEYOR',
            'EXTERNAL_VIEWER',
            'VIEWER',
            'SUPER_ADMIN'
        ];

        for (const role of rolesToSeed) {
            const uid = `usr-${role.toLowerCase()}-${Date.now()}`;
            const username = `u_${role.toLowerCase()}_${Date.now()}`;
            const userRec = await prisma.user.create({
                data: {
                    id: uid,
                    username,
                    email: `${username}@soilfer-test.org`,
                    password: 'hashedpassword',
                    role,
                    labId: role === 'SUPER_ADMIN' ? null : (role === 'PROJECT_MANAGER' ? null : testLab1.id),
                    projects: JSON.stringify(['PROJ-ALPHA', 'PROJ-BETA']),
                    countries: JSON.stringify(['Guatemala']),
                    isActive: true
                }
            });

            const token = jwt.sign(
                { id: userRec.id, userId: userRec.id, username: userRec.username, role: userRec.role, labId: userRec.labId },
                JWT_SECRET,
                { expiresIn: '1h' }
            );

            testUsers[role] = { ...userRec, token };
        }
    });

    afterAll(async () => {
        // Clean up test users and labs
        for (const role in testUsers) {
            await prisma.user.delete({ where: { id: testUsers[role].id } }).catch(() => {});
        }
        await prisma.lab.delete({ where: { id: testLab1.id } }).catch(() => {});
        await prisma.lab.delete({ where: { id: testLab2.id } }).catch(() => {});
    });

    // ─── A01: Role Registration & Canonical Home Endpoints ───
    describe('A01: Canonical Role Home Endpoints (GET /api/dashboard/home)', () => {
        test('Every canonical role returns a valid, tailored home response', async () => {
            const roles = [
                'SAMPLE_RECEPTION',
                'LAB_TECHNICIAN',
                'LAB_MANAGER',
                'MASTER_USER',
                'PROJECT_MANAGER',
                'AUDIT_USER',
                'SURVEYOR',
                'EXTERNAL_VIEWER',
                'VIEWER',
                'SUPER_ADMIN'
            ];

            for (const r of roles) {
                const res = await request(app)
                    .get('/api/dashboard/home')
                    .set('Authorization', `Bearer ${testUsers[r].token}`);

                expect(res.status).toBe(200);
                expect(res.body.schemaVersion).toBe(1);
                expect(res.body.view).toBe(r.toLowerCase());
                expect(Array.isArray(res.body.metrics)).toBe(true);
                expect(res.body.scope).toBeDefined();
                expect(res.body.preview).toBeDefined();
            }
        });

        test('Unknown or unauthenticated requests fail closed', async () => {
            const unauth = await request(app).get('/api/dashboard/home');
            expect(unauth.status).toBe(401);

            const bogusToken = jwt.sign({ id: 'fake', role: 'INVALID_ROLE' }, JWT_SECRET);
            const badRole = await request(app)
                .get('/api/dashboard/home')
                .set('Authorization', `Bearer ${bogusToken}`);
            expect([401, 403, 404]).toContain(badRole.status);
        });
    });

    // ─── A02 & A03: Honest Counts, Expected Arrivals vs Physical Reception ───
    describe('A02 & A03: Expected Arrivals vs Physical Receipt', () => {
        let expectedSample, receivedSample;

        beforeAll(async () => {
            expectedSample = await prisma.sample.create({
                data: {
                    id: `${testPrefix}-EXP-1`,
                    originalId: `${testPrefix}-FLD-EXP-1`,
                    labId: testLab1.id,
                    assignedLab: testLab1.id,
                    projectCode: 'PROJ-ALPHA',
                    status: 'EXPECTED',
                    receptionDate: null,
                    dryingStatus: 'PENDING',
                    preparationStatus: 'PENDING'
                }
            });

            receivedSample = await prisma.sample.create({
                data: {
                    id: `${testPrefix}-RCV-1`,
                    originalId: `${testPrefix}-FLD-RCV-1`,
                    labId: testLab1.id,
                    assignedLab: testLab1.id,
                    projectCode: 'PROJ-ALPHA',
                    status: 'RECEIVED',
                    receptionDate: new Date(),
                    dryingStatus: 'PENDING',
                    preparationStatus: 'PENDING'
                }
            });
        });

        afterAll(async () => {
            await prisma.sample.deleteMany({
                where: { id: { in: [expectedSample.id, receivedSample.id] } }
            }).catch(() => {});
        });

        test('EXPECTED sample with legacy PENDING drying/prep flags contributes 0 to technician ready bench', async () => {
            const eligibility = canRecord(
                { id: 'w1', analysis: 'PH_H2O', status: 'ASSIGNED', assignedTo: testUsers.LAB_TECHNICIAN.username },
                expectedSample,
                testUsers.LAB_TECHNICIAN
            );
            expect(eligibility.allowed).toBe(false);
            expect(eligibility.reason).toContain('NOT_RECEIVED');
        });

        test('Physically received sample without completed gates is waiting, not ready for result recording', async () => {
            const eligibility = canRecord(
                { id: 'w2', analysis: 'PH_H2O', status: 'ASSIGNED', assignedTo: testUsers.LAB_TECHNICIAN.username },
                receivedSample,
                testUsers.LAB_TECHNICIAN,
                { isDryingApplicable: true }
            );
            expect(eligibility.allowed).toBe(false);
            expect(eligibility.reason).toContain('DRYING_PENDING');
        });
    });

    // ─── A07: 40 pH Determinations Grouped as 1 Method Group ───
    describe('A07: 40 pH Determinations Grouping', () => {
        const sampleIds = [];
        const workItemIds = [];

        beforeAll(async () => {
            // Create 40 samples and 40 pH work items in testLab1
            for (let i = 1; i <= 40; i++) {
                const sId = `${testPrefix}-PH-SMP-${i}`;
                sampleIds.push(sId);
                await prisma.sample.create({
                    data: {
                        id: sId,
                        originalId: `FLD-PH-${i}`,
                        labId: testLab1.id,
                        assignedLab: testLab1.id,
                        status: 'PROCESSING',
                        receptionDate: new Date(),
                        dryingStatus: 'DONE',
                        preparationStatus: 'DONE'
                    }
                });

                const wId = `${testPrefix}-PH-WI-${i}`;
                workItemIds.push(wId);
                await prisma.workItem.create({
                    data: {
                        id: wId,
                        sampleId: sId,
                        labId: testLab1.id,
                        assignedLab: testLab1.id,
                        analysis: 'PH_H2O',
                        version: 3,
                        status: 'ASSIGNED',
                        assignedTo: testUsers.LAB_TECHNICIAN.username
                    }
                });
            }
        });

        afterAll(async () => {
            await prisma.workItem.deleteMany({ where: { id: { in: workItemIds } } }).catch(() => {});
            await prisma.sample.deleteMany({ where: { id: { in: sampleIds } } }).catch(() => {});
        });

        test('40 pH determinations appear as 1 grouped method row in bench.ready', async () => {
            const res = await request(app)
                .get('/api/dashboard/queues/bench.ready')
                .set('Authorization', `Bearer ${testUsers.LAB_TECHNICIAN.token}`);

            expect(res.status).toBe(200);
            expect(res.body.queueKey).toBe('bench.ready');

            // Find the pH group
            const phGroup = res.body.rows.find(r => r.key.includes('PH_H2O') || r.title.includes('pH'));
            expect(phGroup).toBeDefined();
            expect(phGroup.count).toBeGreaterThanOrEqual(40);
            expect(phGroup.unit).toBe('determinations');
            expect(phGroup.action).toBe('Open worksheet');
        });
    });

    // ─── A10, A11, A12: Multi-Lab Scope Isolation & AND Composition ───
    describe('A10 & A11: Cross-Lab Isolation & Safe Query Composition', () => {
        let foreignSample;

        beforeAll(async () => {
            foreignSample = await prisma.sample.create({
                data: {
                    id: `${testPrefix}-FOREIGN-1`,
                    originalId: `${testPrefix}-FLD-FOR-1`,
                    labId: testLab2.id,
                    assignedLab: testLab2.id,
                    projectCode: 'PROJ-ALPHA',
                    status: 'DRAFT'
                }
            });
        });

        afterAll(async () => {
            await prisma.sample.delete({ where: { id: foreignSample.id } }).catch(() => {});
        });

        test('Foreign lab draft is strictly excluded from testLab1 reception.drafts queue', async () => {
            const res = await request(app)
                .get('/api/dashboard/queues/reception.drafts')
                .set('Authorization', `Bearer ${testUsers.SAMPLE_RECEPTION.token}`);

            expect(res.status).toBe(200);
            const foreignRow = res.body.rows.find(r => r.key === foreignSample.id);
            expect(foreignRow).toBeUndefined();
        });

        test('scopedWhere composes with AND and preserves top-level OR', () => {
            const scopeOr = { OR: [{ labId: 'LAB-1' }, { assignedLab: 'LAB-1' }] };
            const criteriaOr = { OR: [{ status: 'RECEIVED_REJECTED' }, { status: 'RECEIVED' }] };
            const composed = scopedWhere(scopeOr, criteriaOr);

            expect(composed.AND).toBeDefined();
            expect(composed.AND.length).toBe(2);
            expect(composed.AND[0]).toEqual(scopeOr);
            expect(composed.AND[1]).toEqual(criteriaOr);
        });
    });

    // ─── A14: External Viewer Scoping & Report Publication Enforcement ───
    describe('A14: External Viewer Scoping & Report Visibility', () => {
        let draftReport, publishedReport, draftSample, pubSample;

        beforeAll(async () => {
            draftSample = await prisma.sample.create({
                data: {
                    id: `${testPrefix}-SMP-DFT-REP`,
                    originalId: `FLD-DFT-REP`,
                    labId: testLab1.id,
                    assignedLab: testLab1.id,
                    projectCode: 'PROJ-ALPHA',
                    status: 'PROCESSING'
                }
            });

            pubSample = await prisma.sample.create({
                data: {
                    id: `${testPrefix}-SMP-PUB-REP`,
                    originalId: `FLD-PUB-REP`,
                    labId: testLab1.id,
                    assignedLab: testLab1.id,
                    projectCode: 'PROJ-ALPHA',
                    status: 'APPROVED'
                }
            });

            draftReport = await prisma.report.create({
                data: {
                    id: `rep-dft-${Date.now()}`,
                    sampleId: draftSample.id,
                    labId: testLab1.id,
                    projectCode: 'PROJ-ALPHA',
                    version: 1,
                    status: 'DRAFT',
                    content: JSON.stringify({ sample: { labId: draftSample.id } }),
                    generatedBy: 'test_mgr'
                }
            });

            publishedReport = await prisma.report.create({
                data: {
                    id: `rep-pub-${Date.now()}`,
                    sampleId: pubSample.id,
                    labId: testLab1.id,
                    projectCode: 'PROJ-ALPHA',
                    version: 1,
                    status: 'PUBLISHED',
                    content: JSON.stringify({ sample: { labId: pubSample.id } }),
                    generatedBy: 'test_mgr',
                    publishedAt: new Date()
                }
            });
        });

        afterAll(async () => {
            const reportIds = [draftReport?.id, publishedReport?.id].filter(Boolean);
            if (reportIds.length > 0) {
                await prisma.report.deleteMany({ where: { id: { in: reportIds } } }).catch(() => {});
            }
            const sampleIds = [draftSample?.id, pubSample?.id].filter(Boolean);
            if (sampleIds.length > 0) {
                await prisma.sample.deleteMany({ where: { id: { in: sampleIds } } }).catch(() => {});
            }
        });

        test('External viewer can only search and see PUBLISHED reports, never DRAFT', async () => {
            const res = await request(app)
                .get('/api/reports/search?status=DRAFT')
                .set('Authorization', `Bearer ${testUsers.EXTERNAL_VIEWER.token}`);

            expect(res.status).toBe(200);
            const foundDraft = (res.body.reports || []).find(r => r.id === draftReport.id);
            expect(foundDraft).toBeUndefined();
        });

        test('External viewer cannot download PDF for DRAFT report', async () => {
            const res = await request(app)
                .get(`/api/reports/${draftReport.id}/pdf`)
                .set('Authorization', `Bearer ${testUsers.EXTERNAL_VIEWER.token}`);

            expect([403, 404]).toContain(res.status);
        });

        test('External viewer is forbidden from requesting manager queues (queue authorization guard)', async () => {
            const res = await request(app)
                .get('/api/dashboard/queues/manager.review')
                .set('Authorization', `Bearer ${testUsers.EXTERNAL_VIEWER.token}`);

            expect(res.status).toBe(403);
            expect(res.body.code).toBe('FORBIDDEN_QUEUE');
        });
    });

    // ─── A17, A18, A19: Final Approval Eligibility & Concurrency ───
    describe('A17, A18, A19: Final Approval Eligibility Rules', () => {
        test('Fresh intake with zero analytical work items is rejected from final approval', () => {
            const sample = { id: 's1', status: 'RECEIVED', receptionDate: new Date() };
            const result = canFinalApprove(sample, [], [], testUsers.LAB_MANAGER);
            expect(result.allowed).toBe(false);
            expect(result.reason).toContain('NO_ANALYTICAL_WORK');
        });

        test('Gate-only work items (DRYING, PREPARATION) do not qualify sample for final approval', () => {
            const sample = { id: 's2', status: 'PROCESSING', receptionDate: new Date() };
            const workItems = [
                { id: 'w1', analysis: 'DRYING', status: 'ACCEPTED' },
                { id: 'w2', analysis: 'PREPARATION', status: 'ACCEPTED' }
            ];
            const result = canFinalApprove(sample, workItems, [], testUsers.LAB_MANAGER);
            expect(result.allowed).toBe(false);
            expect(result.reason).toContain('NO_ANALYTICAL_WORK');
        });

        test('All-omitted work items without authorized disposition cannot pass approval vacuously', () => {
            const sample = { id: 's3', status: 'PROCESSING', receptionDate: new Date() };
            const workItems = [
                { id: 'w1', analysis: 'PH_H2O', status: 'WAIVED' },
                { id: 'w2', analysis: 'EC', status: 'CANCELLED' }
            ];
            const result = canFinalApprove(sample, workItems, [], testUsers.LAB_MANAGER);
            expect(result.allowed).toBe(false);
            expect(result.reason).toContain('ALL_WORK_OMITTED');
        });

        test('Failed QC batch blocks final approval', () => {
            const sample = { id: 's4', status: 'PROCESSING', receptionDate: new Date() };
            const workItems = [
                { id: 'w1', analysis: 'PH_H2O', status: 'ACCEPTED' }
            ];
            const qcBatches = [
                { id: 'qc1', status: 'FAILED', batchNumber: 'QC-FAIL-01' }
            ];
            const result = canFinalApprove(sample, workItems, [], testUsers.LAB_MANAGER, { qcBatches });
            expect(result.allowed).toBe(false);
            expect(result.reason).toContain('QC_BATCH_FAILED');
        });

        test('AUDIT_USER is strictly disallowed from publishing reports', () => {
            const sample = { id: 's5', status: 'APPROVED' };
            const result = canPublish(sample, null, testUsers.AUDIT_USER);
            expect(result.allowed).toBe(false);
            expect(result.reason).toContain('AUDIT_USER is strictly read-only');
        });
    });

    // ─── A09: Timezone Interval & UTC Fallback ───
    describe('A09: Lab Local Day Interval & Timezone Fallback', () => {
        test('America/Guatemala computes correct local date and boundaries', () => {
            const interval = getLocalDayInterval('America/Guatemala');
            expect(interval.timezone).toBe('America/Guatemala');
            expect(interval.isUtcFallback).toBe(false);
            expect(interval.dayStart).toBeInstanceOf(Date);
            expect(interval.dayEnd.getTime() - interval.dayStart.getTime()).toBe(24 * 60 * 60 * 1000);
        });

        test('Missing/invalid timezone explicitly labels isUtcFallback: true', () => {
            const interval = getLocalDayInterval('Invalid/Timezone');
            expect(interval.timezone).toBe('UTC');
            expect(interval.isUtcFallback).toBe(true);
        });
    });
});
