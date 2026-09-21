/**
 * Contract Test Suite: QC Batch Inspection, Disposition & Release Gates (Refs #118)
 *
 * Verifies Acceptance Criteria for Issue #118:
 * - Canonical batch inspection returns actual control values, affected items, and notes
 * - Cross-lab manager access rejected with 403
 * - Unresolved failed QC strictly blocks sample approval (409) and report generation (409)
 * - Technician disposition attempt rejected with 403
 * - Authorized manager disposition (PROCEED_WITH_WARNING) with reason succeeds atomically and logs audit entry
 * - Duplicate retry is idempotent (no duplicate audit/history)
 * - Resolved batch clears from pending dashboard exception counts while remaining in history
 */
'use strict';

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../app');
const prisma = require('../../prisma');
const { JWT_SECRET } = require('../../config/auth');
const { canFinalApprove, canPublish } = require('../../services/workEligibility');

describe('QC Batch Inspection, Disposition & Release Gates Contract Tests (#118)', () => {
    let testLab1, testLab2;
    let lab1Manager, lab2Manager, lab1Tech;
    let sample1, workItem1, batch1;
    const testPrefix = `QC-118-${Date.now()}`;

    beforeAll(async () => {
        // 1. Create two isolated test labs
        testLab1 = await prisma.lab.create({
            data: {
                id: `LAB-118-A-${Date.now()}`,
                code: `L118A-${Date.now()}`,
                name: 'QC Test Lab Alpha',
                country: 'Guatemala',
                isActive: true
            }
        });

        testLab2 = await prisma.lab.create({
            data: {
                id: `LAB-118-B-${Date.now()}`,
                code: `L118B-${Date.now()}`,
                name: 'QC Test Lab Beta',
                country: 'Honduras',
                isActive: true
            }
        });

        // 2. Create users: Lab 1 Manager, Lab 2 Manager, Lab 1 Technician
        const createTestUser = async (role, labId, usernamePrefix) => {
            const uid = `usr-${usernamePrefix}-${Date.now()}`;
            const username = `u_${usernamePrefix}_${Date.now()}`;
            const userRec = await prisma.user.create({
                data: {
                    id: uid,
                    username,
                    email: `${username}@test.org`,
                    password: 'hashedpassword',
                    role,
                    labId,
                    isActive: true
                }
            });
            const token = jwt.sign(
                { id: userRec.id, userId: userRec.id, username: userRec.username, role: userRec.role, labId: userRec.labId },
                JWT_SECRET,
                { expiresIn: '1h' }
            );
            return { ...userRec, token };
        };

        lab1Manager = await createTestUser('LAB_MANAGER', testLab1.id, 'l1mgr');
        lab2Manager = await createTestUser('LAB_MANAGER', testLab2.id, 'l2mgr');
        lab1Tech = await createTestUser('LAB_TECHNICIAN', testLab1.id, 'l1tech');

        // 3. Create Sample in Lab 1
        sample1 = await prisma.sample.create({
            data: {
                id: `SMP-118-${Date.now()}`,
                labId: testLab1.id,
                assignedLab: testLab1.id,
                originalId: `FIELD-118-${Date.now()}`,
                status: 'PROCESSING',
                receptionDate: new Date(),
                projectCode: 'SOILFER-GTM',
                country: 'Guatemala'
            }
        });

        // 4. Create WorkItem linked to sample
        workItem1 = await prisma.workItem.create({
            data: {
                id: `WI-118-${Date.now()}`,
                sampleId: sample1.id,
                labId: testLab1.id,
                assignedLab: testLab1.id,
                analysis: 'PH_H2O',
                status: 'ACCEPTED',
                result: '6.45',
                rackPosition: 3
            }
        });

        // 5. Create QC Batch with failed QC results
        batch1 = await prisma.batch.create({
            data: {
                id: `BATCH-118-${Date.now()}`,
                labId: testLab1.id,
                analysis: 'PH_H2O',
                instrument: 'pH Meter Bench #2',
                status: 'QC_FAIL',
                createdBy: lab1Tech.username,
                notes: 'pH slope drift observed on slot 2 CRM',
                workItemIds: JSON.stringify([workItem1.id]),
                qcResults: JSON.stringify({
                    blanks: [{ position: 1, label: 'Reagent Blank', measured: 0.02, limit: 0.05, status: 'PASS' }],
                    controls: [{ standard: 'CRM Soil 01', measured: 7.8, expected: 7.0, recovery: 111.4, status: 'FAIL' }],
                    duplicates: [{ pair: 'Pos 3 & Pos 20', val1: 6.45, val2: 6.48, rpd: 0.46, status: 'PASS' }]
                }),
                history: JSON.stringify([{
                    status: 'OPEN',
                    changedBy: lab1Tech.username,
                    timestamp: new Date()
                }, {
                    status: 'QC_FAIL',
                    changedBy: lab1Tech.username,
                    timestamp: new Date()
                }])
            }
        });

        // Link work item to batch
        await prisma.workItem.update({
            where: { id: workItem1.id },
            data: { batchId: batch1.id }
        });
    });

    afterAll(async () => {
        // Clean up test data
        await prisma.report.deleteMany({ where: { sampleId: sample1.id } }).catch(() => {});
        await prisma.workItem.deleteMany({ where: { id: workItem1.id } }).catch(() => {});
        await prisma.sample.deleteMany({ where: { id: sample1.id } }).catch(() => {});
        await prisma.batch.deleteMany({ where: { id: batch1.id } }).catch(() => {});
        await prisma.auditLog.deleteMany({ where: { entityId: batch1.id } }).catch(() => {});
        await prisma.user.deleteMany({
            where: { id: { in: [lab1Manager.id, lab2Manager.id, lab1Tech.id] } }
        }).catch(() => {});
        await prisma.lab.deleteMany({
            where: { id: { in: [testLab1.id, testLab2.id] } }
        }).catch(() => {});
    });

    // ─── Test 1: Canonical Batch Inspection ───
    test('1. GET /api/qc/batches/:id returns canonical batch with actual control values, affected items, and scope protection', async () => {
        // Cross-lab manager access rejected
        const crossLabRes = await request(app)
            .get(`/api/qc/batches/${batch1.id}`)
            .set('Authorization', `Bearer ${lab2Manager.token}`);
        expect(crossLabRes.status).toBe(403);

        // Authorized lab manager inspection
        const res = await request(app)
            .get(`/api/qc/batches/${batch1.id}`)
            .set('Authorization', `Bearer ${lab1Manager.token}`);

        expect(res.status).toBe(200);
        expect(res.body.data.id).toBe(batch1.id);
        expect(res.body.data.status).toBe('QC_FAIL');
        expect(res.body.data.notes).toContain('pH slope drift');

        // Structured parsed QC control values
        expect(res.body.data.qcResults).toBeDefined();
        expect(res.body.data.qcResults.controls).toHaveLength(1);
        expect(res.body.data.qcResults.controls[0].status).toBe('FAIL');
        expect(res.body.data.qcResults.controls[0].recovery).toBe(111.4);

        // Affected work items with canonical sample ID, labId, and originalId
        expect(res.body.data.workItems).toHaveLength(1);
        expect(res.body.data.workItems[0].id).toBe(workItem1.id);
        expect(res.body.data.workItems[0].sampleId).toBe(sample1.id);
        expect(res.body.data.workItems[0].sample.originalId).toBe(sample1.originalId);

        // Run profile resolved
        expect(res.body.runProfile).toBeDefined();
    });

    // ─── Test 2: Unresolved Failed QC Release Gates ───
    test('2. Unresolved QC_FAIL strictly blocks downstream sample approval and report release', async () => {
        // A. workEligibility.canFinalApprove blocks approval
        const freshBatch = await prisma.batch.findUnique({ where: { id: batch1.id } });
        const eligibility = canFinalApprove(
            sample1,
            [workItem1],
            [],
            lab1Manager,
            { qcBatches: [freshBatch] }
        );
        expect(eligibility.allowed).toBe(false);
        expect(eligibility.blockers.some(b => b.startsWith('QC_BATCH_FAILED'))).toBe(true);

        // B. workEligibility.canPublish blocks official report publication
        const publishCheck = canPublish(sample1, null, lab1Manager, { qcBatches: [freshBatch] });
        expect(publishCheck.allowed).toBe(false);
        expect(publishCheck.code).toBe('QC_BATCH_FAILED');

        // C. POST /api/reports/generate/:sampleId returns 409 Conflict with code QC_BATCH_FAILED
        const genRes = await request(app)
            .post(`/api/reports/generate/${sample1.id}`)
            .set('Authorization', `Bearer ${lab1Manager.token}`);
        expect(genRes.status).toBe(409);
        expect(genRes.body.code).toBe('QC_BATCH_FAILED');
    });

    // ─── Test 3: Manager QC Disposition Authorization & Validation ───
    test('3. POST /api/qc/batches/:id/disposition enforces manager role, scope, and non-empty reason', async () => {
        // Technician rejected with 403
        const techRes = await request(app)
            .post(`/api/qc/batches/${batch1.id}/disposition`)
            .set('Authorization', `Bearer ${lab1Tech.token}`)
            .send({ decision: 'PROCEED_WITH_WARNING', reason: 'Attempted by tech' });
        expect(techRes.status).toBe(403);

        // Cross-lab manager rejected with 403
        const crossMgrRes = await request(app)
            .post(`/api/qc/batches/${batch1.id}/disposition`)
            .set('Authorization', `Bearer ${lab2Manager.token}`)
            .send({ decision: 'PROCEED_WITH_WARNING', reason: 'Cross-lab manager' });
        expect(crossMgrRes.status).toBe(403);

        // Empty reason rejected with 400
        const emptyReasonRes = await request(app)
            .post(`/api/qc/batches/${batch1.id}/disposition`)
            .set('Authorization', `Bearer ${lab1Manager.token}`)
            .send({ decision: 'PROCEED_WITH_WARNING', reason: '   ' });
        expect(emptyReasonRes.status).toBe(400);

        // Valid manager disposition succeeds atomically
        const validRes = await request(app)
            .post(`/api/qc/batches/${batch1.id}/disposition`)
            .set('Authorization', `Bearer ${lab1Manager.token}`)
            .send({
                decision: 'PROCEED_WITH_WARNING',
                reason: 'CRM slope slightly high (+1.4%) but sample replicate duplicate RPD is 0.46% (excellent). Approved under scientific justification.'
            });

        expect(validRes.status).toBe(200);
        expect(validRes.body.success).toBe(true);
        expect(validRes.body.disposition.decision).toBe('PROCEED_WITH_WARNING');
        expect(validRes.body.disposition.by).toBe(lab1Manager.username);

        // Check persisted batch disposition and audit log
        const dbBatch = await prisma.batch.findUnique({ where: { id: batch1.id } });
        const parsedDisp = JSON.parse(dbBatch.disposition);
        expect(parsedDisp.decision).toBe('PROCEED_WITH_WARNING');

        const auditLogs = await prisma.auditLog.findMany({
            where: { entityId: batch1.id, action: 'QC_DISPOSITION' }
        });
        expect(auditLogs).toHaveLength(1);
        expect(auditLogs[0].performedBy).toBe(lab1Manager.username);
        expect(auditLogs[0].details).toContain('PROCEED_WITH_WARNING');
    });

    // ─── Test 4: Disposition Idempotency ───
    test('4. Resending identical manager disposition is idempotent and does not create duplicate audit entries', async () => {
        const repeatRes = await request(app)
            .post(`/api/qc/batches/${batch1.id}/disposition`)
            .set('Authorization', `Bearer ${lab1Manager.token}`)
            .send({
                decision: 'PROCEED_WITH_WARNING',
                reason: 'CRM slope slightly high (+1.4%) but sample replicate duplicate RPD is 0.46% (excellent). Approved under scientific justification.'
            });

        expect(repeatRes.status).toBe(200);
        expect(repeatRes.body.success).toBe(true);
        expect(repeatRes.body.idempotent).toBe(true);

        // Verify audit log count did not increase
        const auditLogs = await prisma.auditLog.findMany({
            where: { entityId: batch1.id, action: 'QC_DISPOSITION' }
        });
        expect(auditLogs).toHaveLength(1);
    });

    // ─── Test 5: Release Gates Unblocked After Manager Disposition ───
    test('5. Manager disposition override unblocks sample approval and report publication eligibility', async () => {
        const dispositionedBatch = await prisma.batch.findUnique({ where: { id: batch1.id } });

        // canFinalApprove is now allowed
        const eligibility = canFinalApprove(
            sample1,
            [workItem1],
            [],
            lab1Manager,
            { qcBatches: [dispositionedBatch] }
        );
        expect(eligibility.allowed).toBe(true);
        expect(eligibility.blockers).toHaveLength(0);

        // Update sample to APPROVED following successful approval eligibility
        const approvedSample = await prisma.sample.update({
            where: { id: sample1.id },
            data: { status: 'APPROVED' }
        });

        // canPublish is now allowed for approved sample with dispositioned QC
        const publishCheck = canPublish(approvedSample, null, lab1Manager, { qcBatches: [dispositionedBatch] });
        expect(publishCheck.allowed).toBe(true);
    });

    // ─── Test 6: Dashboard Pending Exceptions Cleared While Retaining History ───
    test('6. Dispositioned batch clears from actionable pending exception queues while remaining in history', async () => {
        // Query manager.exceptions queue
        const exceptionsRes = await request(app)
            .get('/api/dashboard/queues/manager.exceptions')
            .set('Authorization', `Bearer ${lab1Manager.token}`);

        expect(exceptionsRes.status).toBe(200);
        const pendingRows = exceptionsRes.body.rows || [];
        // The dispositioned batch should NOT be in the pending actionable exceptions list
        expect(pendingRows.some(r => r.key === batch1.id)).toBe(false);

        // Batch inspection still returns the full history and active disposition override
        const inspectRes = await request(app)
            .get(`/api/qc/batches/${batch1.id}`)
            .set('Authorization', `Bearer ${lab1Manager.token}`);

        expect(inspectRes.status).toBe(200);
        expect(inspectRes.body.data.disposition.decision).toBe('PROCEED_WITH_WARNING');
        expect(inspectRes.body.data.history.length).toBeGreaterThanOrEqual(3);
    });
});
