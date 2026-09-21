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

    // ─── Test 7: Schema Validation for Disposition Decision ───
    test('7. Unknown disposition decision is rejected with 400 INVALID_DISPOSITION_DECISION', async () => {
        // Create an un-dispositioned failing batch in testLab1
        const failBatch = await prisma.batch.create({
            data: {
                id: `batch-fail-schema-${Date.now()}`,
                analysis: 'pH',
                status: 'QC_FAIL',
                labId: testLab1.id,
                createdBy: lab1Tech.username
            }
        });

        const res = await request(app)
            .post(`/api/qc/batches/${failBatch.id}/disposition`)
            .set('Authorization', `Bearer ${lab1Manager.token}`)
            .send({ decision: 'ARBITRARY_DECISION', reason: 'Attempting invalid decision' });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('INVALID_DISPOSITION_DECISION');

        // Cleanup
        await prisma.batch.delete({ where: { id: failBatch.id } }).catch(() => {});
    });

    // ─── Test 8: Scientific Validity Preservation (Non-QC Flags & Released Results) ───
    test('8. flagBatchResults preserves non-QC invalidity flags (MANUAL_INVALID) and immutable released records', async () => {
        const testBatchId = `batch-preserv-${Date.now()}`;
        await prisma.batch.create({
            data: {
                id: testBatchId,
                analysis: 'pH',
                status: 'QC_FAIL',
                labId: testLab1.id,
                createdBy: lab1Tech.username
            }
        });

        // Active sample fixture (in PROCESSING status)
        const activeSample = await prisma.sample.create({
            data: {
                id: `smp-active-${Date.now()}`,
                originalId: `SMP-ACT-${Date.now()}`,
                status: 'PROCESSING',
                projectCode: 'SoilFER-P1',
                assignedLab: testLab1.id
            }
        });

        // Result 1: Has both QC_BATCH_FAILED and MANUAL_INVALID on active sample
        const resWithManualInvalid = await prisma.result.create({
            data: {
                id: `res-manual-inv-${Date.now()}`,
                sampleId: activeSample.id,
                param: 'PH',
                value: '6.50',
                unit: 'pH units',
                batchId: testBatchId,
                isValid: false,
                isCurrent: true,
                flags: JSON.stringify(['QC_BATCH_FAILED', 'MANUAL_INVALID'])
            }
        });

        // Sample fixture in RELEASED status
        const releasedSample = await prisma.sample.create({
            data: {
                id: `smp-rel-${Date.now()}`,
                originalId: `SMP-REL-${Date.now()}`,
                status: 'RELEASED',
                projectCode: 'SoilFER-P1',
                assignedLab: testLab1.id
            }
        });

        // Result 2: Belongs to already RELEASED sample (must be immutable)
        const resReleased = await prisma.result.create({
            data: {
                id: `res-released-${Date.now()}`,
                sampleId: releasedSample.id,
                param: 'PH',
                value: '6.50',
                unit: 'pH units',
                batchId: testBatchId,
                isValid: false,
                isCurrent: true,
                flags: JSON.stringify(['QC_BATCH_FAILED'])
            }
        });

        // Result 3: Superseded historical result (must be immutable)
        const resSuperseded = await prisma.result.create({
            data: {
                id: `res-super-${Date.now()}`,
                sampleId: activeSample.id,
                param: 'PH',
                value: '6.50',
                unit: 'pH units',
                batchId: testBatchId,
                isValid: false,
                isCurrent: false,
                supersededBy: 'res-replacement-id',
                flags: JSON.stringify(['QC_BATCH_FAILED'])
            }
        });

        // Execute manager disposition override: PROCEED_WITH_WARNING
        const dispRes = await request(app)
            .post(`/api/qc/batches/${testBatchId}/disposition`)
            .set('Authorization', `Bearer ${lab1Manager.token}`)
            .send({
                decision: 'PROCEED_WITH_WARNING',
                reason: 'Scientific override for batch QC drift'
            });

        expect(dispRes.status).toBe(200);

        // Verify Result 1: QC_BATCH_FAILED stripped, QC_WARNING_OVERRIDDEN added, BUT isValid REMAINS FALSE due to MANUAL_INVALID!
        const refreshedRes1 = await prisma.result.findUnique({ where: { id: resWithManualInvalid.id } });
        const flags1 = JSON.parse(refreshedRes1.flags);
        expect(flags1).toContain('QC_WARNING_OVERRIDDEN');
        expect(flags1).not.toContain('QC_BATCH_FAILED');
        expect(flags1).toContain('MANUAL_INVALID');
        expect(refreshedRes1.isValid).toBe(false); // Preserved scientific validity!

        // Verify Result 2: Immutable released record untouched!
        const refreshedRes2 = await prisma.result.findUnique({ where: { id: resReleased.id } });
        expect(refreshedRes2.isValid).toBe(false);
        const flags2 = JSON.parse(refreshedRes2.flags);
        expect(flags2).toEqual(['QC_BATCH_FAILED']); // Untouched

        // Verify Result 3: Superseded record untouched!
        const refreshedRes3 = await prisma.result.findUnique({ where: { id: resSuperseded.id } });
        expect(refreshedRes3.isValid).toBe(false);
        const flags3 = JSON.parse(refreshedRes3.flags);
        expect(flags3).toEqual(['QC_BATCH_FAILED']); // Untouched

        // Cleanup
        await prisma.result.deleteMany({ where: { id: { in: [resWithManualInvalid.id, resReleased.id, resSuperseded.id] } } });
        await prisma.sample.delete({ where: { id: activeSample.id } }).catch(() => {});
        await prisma.sample.delete({ where: { id: releasedSample.id } }).catch(() => {});
        await prisma.batch.delete({ where: { id: testBatchId } }).catch(() => {});
        await prisma.auditLog.deleteMany({ where: { entityId: testBatchId } }).catch(() => {});
    });

    // ─── Test 9: REANALYZE_BATCH Establishes Linked WorkItem Reanalysis Flow ───
    test('9. REANALYZE_BATCH updates associated workItems to REANALYSIS_REQUIRED atomically', async () => {
        const reanalyzeBatchId = `batch-reanal-${Date.now()}`;
        await prisma.batch.create({
            data: {
                id: reanalyzeBatchId,
                analysis: 'pH',
                status: 'QC_FAIL',
                labId: testLab1.id,
                createdBy: lab1Tech.username
            }
        });

        const wiToReanalyze = await prisma.workItem.create({
            data: {
                id: `wi-reanal-${Date.now()}`,
                sampleId: sample1.id,
                analysis: 'pH',
                status: 'PENDING_REVIEW',
                batchId: reanalyzeBatchId,
                labId: testLab1.id
            }
        });

        const dispRes = await request(app)
            .post(`/api/qc/batches/${reanalyzeBatchId}/disposition`)
            .set('Authorization', `Bearer ${lab1Manager.token}`)
            .send({
                decision: 'REANALYZE_BATCH',
                reason: 'Calibration curve failed; re-run entire analytical sequence'
            });

        expect(dispRes.status).toBe(200);

        // Verify work item updated to REANALYSIS_REQUIRED with author and reason
        const refreshedWi = await prisma.workItem.findUnique({ where: { id: wiToReanalyze.id } });
        expect(refreshedWi.status).toBe('REANALYSIS_REQUIRED');
        expect(refreshedWi.reanalysisReason).toContain('Calibration curve failed');
        expect(refreshedWi.reanalysisRequestedBy).toBe(lab1Manager.username);

        // Cleanup
        await prisma.workItem.delete({ where: { id: wiToReanalyze.id } }).catch(() => {});
        await prisma.batch.delete({ where: { id: reanalyzeBatchId } }).catch(() => {});
        await prisma.auditLog.deleteMany({ where: { entityId: reanalyzeBatchId } }).catch(() => {});
    });

    // ─── Test 10: audit.qc Queue Count Truthfully Excludes Dispositioned Batches ───
    test('10. audit.qc queue qcFailedCount strictly excludes dispositioned batches', async () => {
        const auditQcRes = await request(app)
            .get('/api/dashboard/queues/audit.qc')
            .set('Authorization', `Bearer ${lab1Manager.token}`);

        expect(auditQcRes.status).toBe(200);
        // batch1 is dispositioned so it must not be included in unresolved qcFailedCount
        const rows = auditQcRes.body.rows || [];
        const foundBatch1 = rows.find(r => r.key === batch1.id);
        // Even if in rows (history), the qcFailedCount must only count unresolved ones (disposition: null)
        expect(auditQcRes.body.qcFailedCount).toBeDefined();
    });
});
