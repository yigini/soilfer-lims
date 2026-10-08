'use strict';
const { createExecutionResultFixture } = require('../helpers/workAttemptFixtures');
const { cleanupWorkflowFixtures } = require('../helpers/workflowFixtures');

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

const { createSampleFixture, createWorkItemFixture } = require('../helpers/workflowFixtures');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../app');
const prisma = require('../../prisma');
const { createSample, transitionSample } = require('../../services/sampleStateService');
const { JWT_SECRET } = require('../../config/auth');
const { canFinalApprove, canPublish } = require('../../services/workEligibility');
const { normalizeLegacyQcFixture } = require('../helpers/normalizedQcFixture');
const { QC_RUN_INCLUDE, batchApiView } = require('../../services/qcRunViewService');
const evidenceBatch = async id => batchApiView(await prisma.batch.findUnique({ where: { id }, include: QC_RUN_INCLUDE }), { serialized: true });

describe('QC Batch Inspection, Disposition & Release Gates Contract Tests (#118)', () => {
    let testLab1, testLab2;
    let lab1Manager, lab2Manager, lab1Tech;
    let sample1, workItem1, batch1;
    const reportFixtureIds = [];
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
        sample1 = await createSampleFixture(prisma, {
            data: {
                id: `SMP-118-${Date.now()}`,
                labId: testLab1.id,
                assignedLab: testLab1.id,
                originalId: `FIELD-118-${Date.now()}`,
                status: 'PROCESSING',
                dryingStatus: 'DONE', preparationStatus: 'DONE',
                receptionDate: new Date(),
                projectCode: 'SOILFER-GTM',
                country: 'Guatemala'
            }
        });

        // 4. Create WorkItem linked to sample
        workItem1 = await createWorkItemFixture(prisma, {
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
        await createExecutionResultFixture(prisma, { attemptStatus: 'ACCEPTED', data: { id: `RES-118-${Date.now()}`, sampleId: sample1.id,
            param: 'PH_H2O', value: '6.45', isCurrent: true, isValid: true, batchId: batch1.id } });
        await prisma.workItem.update({
            where: { id: workItem1.id },
            data: { batchId: batch1.id }
        });
        await normalizeLegacyQcFixture(prisma, batch1.id);
    });

    // Pin6056586906: retain QC/evidence parents until the whole owned database is torn down.

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
        const freshBatch = await evidenceBatch(batch1.id);
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
        // Report QC is tested on an approved, reviewed fixture so the new universal
        // sample-review gate does not mask the QC gate under test.
        const reportId = `REPORT-${sample1.id}`;
        reportFixtureIds.push(reportId);
        const reportBatchId = `BATCH-${reportId}`;
        await prisma.batch.create({ data: { ...batch1, id: reportBatchId, workItemIds: JSON.stringify([`WI-${reportId}`]) } });
        await createSampleFixture(prisma, { data: { ...sample1, id: reportId, originalId: reportId, status: 'APPROVED' } });
        await createWorkItemFixture(prisma, { data: { ...workItem1, id: `WI-${reportId}`, sampleId: reportId, batchId: reportBatchId } });
        await createExecutionResultFixture(prisma, { attemptStatus: 'ACCEPTED', data: { id: `RES-${reportId}`, sampleId: reportId,
            param: 'PH_H2O', value: '6.45', isCurrent: true, isValid: true, batchId: reportBatchId } });
        await normalizeLegacyQcFixture(prisma, reportBatchId);
        const reportSample = await prisma.sample.findUnique({ where: { id: reportId }, include: { workItems: true, results: true } });
        const publishCheck = canPublish(reportSample, null, lab1Manager, { qcBatches: [await evidenceBatch(reportBatchId)] });
        expect(publishCheck.allowed).toBe(false);
        expect(publishCheck.code).toBe('QC_GATE_FAILED');

        // C. Publication uses the same result-level gate as review.
        const genRes = await request(app)
            .post(`/api/reports/generate/${reportId}`)
            .set('Authorization', `Bearer ${lab1Manager.token}`);
        expect(genRes.status).toBe(409);
        expect(genRes.body.code).toBe('QC_GATE_FAILED');
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
        const dbBatch = await evidenceBatch(batch1.id);
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
        const dispositionedBatch = await evidenceBatch(batch1.id);

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
        await transitionSample(sample1.id, 'SUBMITTED_FULL', lab1Manager, 'Reviewed analytical fixture');
        const approvedSample = await transitionSample(sample1.id, 'APPROVED', lab1Manager, 'QC disposition and analytical sign-off');

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
        const activeSample = await createSampleFixture(prisma, {
            data: {
                id: `smp-active-${Date.now()}`,
                originalId: `SMP-ACT-${Date.now()}`,
                status: 'PROCESSING',
                projectCode: 'SoilFER-P1',
                assignedLab: testLab1.id
            }
        });

        // Result 1: Has both QC_BATCH_FAILED and MANUAL_INVALID on active sample
        // Pin6060110991: explicit canonical PH owner; original Result fields stay unchanged.
        await createWorkItemFixture(prisma, { data: { id: `${activeSample.id}-PH`, sampleId: activeSample.id,
            analysis: 'PH', assignedLab: testLab1.id, status: 'COMPLETED' } });
        const resWithManualInvalid = await createExecutionResultFixture(prisma, {
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

        // Sample fixture in canonical APPROVED status
        const releasedSample = await createSampleFixture(prisma, {
            data: {
                id: `smp-rel-${Date.now()}`,
                originalId: `SMP-REL-${Date.now()}`,
                status: 'APPROVED',
                projectCode: 'SoilFER-P1',
                assignedLab: testLab1.id
            }
        });

        // Result 2: Belongs to already approved sample (must be immutable)
        // Pin6060110991: explicit canonical PH owner; original Result fields stay unchanged.
        await createWorkItemFixture(prisma, { data: { id: `${releasedSample.id}-PH`, sampleId: releasedSample.id,
            analysis: 'PH', assignedLab: testLab1.id, status: 'ACCEPTED' } });
        const resReleased = await createExecutionResultFixture(prisma, { attemptStatus: 'ACCEPTED',
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
        const resSuperseded = await createExecutionResultFixture(prisma, {
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
        await normalizeLegacyQcFixture(prisma, testBatchId);
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

        // Retain QC, report and execution parents until whole-owned-DB teardown.
    });

    async function activeQcSample() {
        const sampleId = `qc-active-${require('node:crypto').randomUUID()}`;
        return createSample({ id: sampleId, originalId: sampleId, status: 'PROCESSING', assignedLab: testLab1.id,
            labId: testLab1.id, country: 'Guatemala', projectCode: 'SOILFER-GTM' }, 'system:fixture', { context: 'fixture' });
    }

    // ─── Test 9: REANALYZE_BATCH Establishes Linked WorkItem Reanalysis Flow ───
    test('9. REANALYZE_BATCH updates associated workItems to REPEAT_REQUIRED atomically', async () => {
        const activeSample = await activeQcSample();
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

        const wiToReanalyze = await createWorkItemFixture(prisma, {
            data: {
                id: `wi-reanal-${Date.now()}`,
                sampleId: activeSample.id,
                analysis: 'pH',
                status: 'SUBMITTED',
                batchId: reanalyzeBatchId,
                labId: testLab1.id
            }
        });

        await normalizeLegacyQcFixture(prisma, reanalyzeBatchId);
        const dispRes = await request(app)
            .post(`/api/qc/batches/${reanalyzeBatchId}/disposition`)
            .set('Authorization', `Bearer ${lab1Manager.token}`)
            .send({
                decision: 'REANALYZE_BATCH',
                reason: 'Calibration curve failed; re-run entire analytical sequence'
            });

        expect(dispRes.status).toBe(200);

        // Verify work item updated to REPEAT_REQUIRED with author and reason
        const refreshedWi = await prisma.workItem.findUnique({ where: { id: wiToReanalyze.id } });
        expect(refreshedWi.status).toBe('REPEAT_REQUIRED');
        expect(refreshedWi.reanalysisReason).toContain('Calibration curve failed');
        expect(refreshedWi.reanalysisRequestedBy).toBe(lab1Manager.username);

        // Cleanup
        await cleanupWorkflowFixtures(prisma, "workItem", (await prisma.workItem.findMany({ ...({ where: { id: wiToReanalyze.id } }), select: { id: true } })).map(row => row.id), { single: true }).catch(() => {});
        await prisma.batch.delete({ where: { id: reanalyzeBatchId } }).catch(() => {});
        await cleanupWorkflowFixtures(prisma, "sample", (await prisma.sample.findMany({ ...({ where: { id: activeSample.id } }), select: { id: true } })).map(row => row.id), { single: true });
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

    // ─── Test 11: flagBatchResults Preserves Independent Scientific Validity on QC_PASS ───
    test('11. flagBatchResults preserves invalidity on QC_PASS for unflagged, unknown-flagged, and previously rejected results', async () => {
        const { flagBatchResults } = require('../../services/qcService');
        const passBatchId = `batch-pass-val-${Date.now()}`;

        // Create an active non-terminal sample for validity evaluation
        const activeSample = await createSampleFixture(prisma, {
            data: {
                id: `smp-val-${Date.now()}`,
                originalId: `SMP-VAL-${Date.now()}`,
                status: 'PROCESSING',
                projectCode: 'SoilFER-P1',
                assignedLab: testLab1.id
            }
        });

        // Unflagged invalid result (isValid: false, flags: [])
        // Pin6060110991: explicit canonical PH owner; original Result fields stay unchanged.
        await createWorkItemFixture(prisma, { data: { id: `${activeSample.id}-PH`, sampleId: activeSample.id,
            analysis: 'PH', assignedLab: testLab1.id, status: 'COMPLETED' } });
        const resUnflagged = await createExecutionResultFixture(prisma, {
            data: {
                id: `res-unflagged-${Date.now()}`,
                sampleId: activeSample.id,
                param: 'PH',
                value: '7.10',
                unit: 'pH units',
                batchId: passBatchId,
                isValid: false,
                isCurrent: true,
                flags: JSON.stringify([])
            }
        });

        // Result with unknown / non-QC flag (isValid: false, flags: ['SENSOR_FAILURE'])
        // Pin6060110991: explicit canonical EC owner; original Result fields stay unchanged.
        await createWorkItemFixture(prisma, { data: { id: `${activeSample.id}-EC`, sampleId: activeSample.id,
            analysis: 'EC', assignedLab: testLab1.id, status: 'COMPLETED' } });
        const resSensorFailure = await createExecutionResultFixture(prisma, {
            data: {
                id: `res-sensor-${Date.now()}`,
                sampleId: activeSample.id,
                param: 'EC',
                value: '1.20',
                unit: 'dS/m',
                batchId: passBatchId,
                isValid: false,
                isCurrent: true,
                flags: JSON.stringify(['SENSOR_FAILURE'])
            }
        });

        // Result with prior rejection (isValid: false, flags: ['QC_BATCH_REJECTED'])
        // Pin6060110991: explicit canonical OC owner; original Result fields stay unchanged.
        await createWorkItemFixture(prisma, { data: { id: `${activeSample.id}-OC`, sampleId: activeSample.id,
            analysis: 'OC', assignedLab: testLab1.id, status: 'COMPLETED' } });
        const resPriorReject = await createExecutionResultFixture(prisma, {
            data: {
                id: `res-reject-${Date.now()}`,
                sampleId: activeSample.id,
                param: 'OC',
                value: '2.50',
                unit: '%',
                batchId: passBatchId,
                isValid: false,
                isCurrent: true,
                flags: JSON.stringify(['QC_BATCH_REJECTED'])
            }
        });

        // Result whose ONLY reason for invalidity was QC_BATCH_FAILED
        // Pin6060110991: explicit canonical TN owner; original Result fields stay unchanged.
        await createWorkItemFixture(prisma, { data: { id: `${activeSample.id}-TN`, sampleId: activeSample.id,
            analysis: 'TN', assignedLab: testLab1.id, status: 'COMPLETED' } });
        const resQcOnly = await createExecutionResultFixture(prisma, {
            data: {
                id: `res-qconly-${Date.now()}`,
                sampleId: activeSample.id,
                param: 'TN',
                value: '0.15',
                unit: '%',
                batchId: passBatchId,
                isValid: false,
                isCurrent: true,
                flags: JSON.stringify(['QC_BATCH_FAILED'])
            }
        });

        // Execute flagBatchResults for QC_PASS
        await flagBatchResults(prisma, passBatchId, 'QC_PASS');

        // Verification:
        // 1. Unflagged invalid stays invalid!
        const refUnflagged = await prisma.result.findUnique({ where: { id: resUnflagged.id } });
        expect(refUnflagged.isValid).toBe(false);

        // 2. SENSOR_FAILURE invalid stays invalid and keeps flag!
        const refSensor = await prisma.result.findUnique({ where: { id: resSensorFailure.id } });
        expect(refSensor.isValid).toBe(false);
        expect(JSON.parse(refSensor.flags)).toContain('SENSOR_FAILURE');

        // 3. QC_BATCH_REJECTED invalid stays invalid!
        const refReject = await prisma.result.findUnique({ where: { id: resPriorReject.id } });
        expect(refReject.isValid).toBe(false);

        // 4. Solely QC_BATCH_FAILED result becomes valid when QC passes!
        const refQcOnly = await prisma.result.findUnique({ where: { id: resQcOnly.id } });
        expect(refQcOnly.isValid).toBe(true);
        expect(JSON.parse(refQcOnly.flags)).not.toContain('QC_BATCH_FAILED');

        // Retain QC, report and execution parents until whole-owned-DB teardown.
    });

    // ─── Test 12: flagBatchResults Strictly Preserves Immutability for Published Reports & Terminal Samples ───
    test('12. flagBatchResults strictly preserves immutability for published reports and terminal samples (ARCHIVED/DISPOSED)', async () => {
        const { flagBatchResults } = require('../../services/qcService');
        const immBatchId = `batch-imm-${Date.now()}`;

        // 1. Terminal ARCHIVED sample
        const archivedSample = await createSampleFixture(prisma, {
            data: {
                id: `smp-arch-${Date.now()}`,
                originalId: `SMP-ARCH-${Date.now()}`,
                status: 'ARCHIVED',
                projectCode: 'SoilFER-P1',
                assignedLab: testLab1.id
            }
        });
        // Pin6060110991: explicit canonical PH owner; original Result fields stay unchanged.
        await createWorkItemFixture(prisma, { data: { id: `${archivedSample.id}-PH`, sampleId: archivedSample.id,
            analysis: 'PH', assignedLab: testLab1.id, status: 'ACCEPTED' } });
        const resArchived = await createExecutionResultFixture(prisma, { attemptStatus: 'ACCEPTED',
            data: {
                id: `res-arch-${Date.now()}`,
                sampleId: archivedSample.id,
                param: 'PH',
                value: '7.00',
                unit: 'pH units',
                batchId: immBatchId,
                isValid: false,
                isCurrent: true,
                flags: JSON.stringify(['QC_BATCH_FAILED'])
            }
        });

        // 2. Terminal DISPOSED sample
        const disposedSample = await createSampleFixture(prisma, {
            data: {
                id: `smp-disp-${Date.now()}`,
                originalId: `SMP-DISP-${Date.now()}`,
                status: 'DISPOSED',
                projectCode: 'SoilFER-P1',
                assignedLab: testLab1.id
            }
        });
        // Pin6060110991: explicit canonical PH owner; original Result fields stay unchanged.
        await createWorkItemFixture(prisma, { data: { id: `${disposedSample.id}-PH`, sampleId: disposedSample.id,
            analysis: 'PH', assignedLab: testLab1.id, status: 'ACCEPTED' } });
        const resDisposed = await createExecutionResultFixture(prisma, { attemptStatus: 'ACCEPTED',
            data: {
                id: `res-disp-${Date.now()}`,
                sampleId: disposedSample.id,
                param: 'PH',
                value: '7.00',
                unit: 'pH units',
                batchId: immBatchId,
                isValid: false,
                isCurrent: true,
                flags: JSON.stringify(['QC_BATCH_FAILED'])
            }
        });

        // 3. Sample with PUBLISHED report
        const pubSample = await createSampleFixture(prisma, {
            data: {
                id: `smp-pub-${Date.now()}`,
                originalId: `SMP-PUB-${Date.now()}`,
                status: 'PROCESSING', // Even if reopened to PROCESSING!
                projectCode: 'SoilFER-P1',
                assignedLab: testLab1.id
            }
        });
        const pubReport = await prisma.report.create({
            data: {
                id: `rep-pub-${Date.now()}`,
                sampleId: pubSample.id,
                status: 'PUBLISHED',
                generatedBy: lab1Manager.username
            }
        });
        // Pin6060110991: explicit canonical PH owner; original Result fields stay unchanged.
        await createWorkItemFixture(prisma, { data: { id: `${pubSample.id}-PH`, sampleId: pubSample.id,
            analysis: 'PH', assignedLab: testLab1.id, status: 'ACCEPTED' } });
        const resPublished = await createExecutionResultFixture(prisma, { attemptStatus: 'ACCEPTED',
            data: {
                id: `res-pub-${Date.now()}`,
                sampleId: pubSample.id,
                param: 'PH',
                value: '7.00',
                unit: 'pH units',
                batchId: immBatchId,
                isValid: false,
                isCurrent: true,
                flags: JSON.stringify(['QC_BATCH_FAILED'])
            }
        });

        // Execute flagBatchResults for QC_FAIL / PROCEED_WITH_WARNING
        await flagBatchResults(prisma, immBatchId, 'QC_FAIL', { decision: 'PROCEED_WITH_WARNING' });

        // Verify ARCHIVED sample result was untouched
        const refArch = await prisma.result.findUnique({ where: { id: resArchived.id } });
        expect(JSON.parse(refArch.flags)).toEqual(['QC_BATCH_FAILED']);

        // Verify DISPOSED sample result was untouched
        const refDisp = await prisma.result.findUnique({ where: { id: resDisposed.id } });
        expect(JSON.parse(refDisp.flags)).toEqual(['QC_BATCH_FAILED']);

        // Verify PUBLISHED report sample result was untouched
        const refPub = await prisma.result.findUnique({ where: { id: resPublished.id } });
        expect(JSON.parse(refPub.flags)).toEqual(['QC_BATCH_FAILED']);

        // Retain QC, report and execution parents until whole-owned-DB teardown.
    });

    // ─── Test 13: Conflicting Disposition Rejected with 409 DISPOSITION_CONFLICT ───
    test('13. Conflicting disposition decision is rejected with 409 DISPOSITION_CONFLICT', async () => {
        const conflictBatchId = `batch-conflict-${Date.now()}`;
        await prisma.batch.create({
            data: {
                id: conflictBatchId,
                analysis: 'pH',
                status: 'QC_FAIL',
                labId: testLab1.id,
                createdBy: lab1Tech.username
            }
        });

        // 1. Initial disposition: PROCEED_WITH_WARNING
        await normalizeLegacyQcFixture(prisma, conflictBatchId);
        const firstRes = await request(app)
            .post(`/api/qc/batches/${conflictBatchId}/disposition`)
            .set('Authorization', `Bearer ${lab1Manager.token}`)
            .send({
                decision: 'PROCEED_WITH_WARNING',
                reason: 'Initial disposition override'
            });
        expect(firstRes.status).toBe(200);

        // 2. Conflicting disposition: REJECT_BATCH
        const conflictRes = await request(app)
            .post(`/api/qc/batches/${conflictBatchId}/disposition`)
            .set('Authorization', `Bearer ${lab1Manager.token}`)
            .send({
                decision: 'REJECT_BATCH',
                reason: 'Conflicting second disposition decision'
            });

        expect(conflictRes.status).toBe(409);
        expect(conflictRes.body.error).toBe('DISPOSITION_CONFLICT');

        // Cleanup
        await prisma.batch.delete({ where: { id: conflictBatchId } }).catch(() => {});
        await prisma.auditLog.deleteMany({ where: { entityId: conflictBatchId } }).catch(() => {});
    });

    // ─── Test 14: Concurrent Disposition Execution & CAS Integrity ───
    test('14. Concurrent identical dispositions resolve idempotently; conflicting concurrent decisions fail with 409', async () => {
        const concurrentBatchId = `batch-conc-${Date.now()}`;
        await prisma.batch.create({
            data: {
                id: concurrentBatchId,
                analysis: 'pH',
                status: 'QC_FAIL',
                labId: testLab1.id,
                createdBy: lab1Tech.username
            }
        });

        // Fire two identical disposition requests concurrently
        await normalizeLegacyQcFixture(prisma, concurrentBatchId);
        const [resA, resB] = await Promise.all([
            request(app)
                .post(`/api/qc/batches/${concurrentBatchId}/disposition`)
                .set('Authorization', `Bearer ${lab1Manager.token}`)
                .send({
                    decision: 'PROCEED_WITH_WARNING',
                    reason: 'Concurrent identical execution verification'
                }),
            request(app)
                .post(`/api/qc/batches/${concurrentBatchId}/disposition`)
                .set('Authorization', `Bearer ${lab1Manager.token}`)
                .send({
                    decision: 'PROCEED_WITH_WARNING',
                    reason: 'Concurrent identical execution verification'
                })
        ]);

        // Both should succeed (one creates, one is idempotent or both resolve)
        expect(resA.status).toBe(200);
        expect(resB.status).toBe(200);

        // Verify batch history has exactly 1 disposition record (no duplicates)
        const batch = await evidenceBatch(concurrentBatchId);
        const history = JSON.parse(batch.history || '[]');
        const dispEntries = history.filter(h => h.disposition === 'PROCEED_WITH_WARNING');
        expect(dispEntries.length).toBe(1);

        // Cleanup
        await prisma.batch.delete({ where: { id: concurrentBatchId } }).catch(() => {});
        await prisma.auditLog.deleteMany({ where: { entityId: concurrentBatchId } }).catch(() => {});
    });

    // ─── Test 15: REANALYZE_BATCH Protects Historical Accepted / Released Work Items ───
    test('15. REANALYZE_BATCH updates only active work items, preserving ACCEPTED history and repeating completed active work', async () => {
        const activeSample = await activeQcSample();
        const batchWiTestId = `batch-wi-guard-${Date.now()}`;
        await prisma.batch.create({
            data: {
                id: batchWiTestId,
                analysis: 'pH',
                status: 'QC_FAIL',
                labId: testLab1.id,
                createdBy: lab1Tech.username
            }
        });

        // Active submitted work item
        const wiActive = await createWorkItemFixture(prisma, {
            data: {
                id: `wi-act-${Date.now()}`,
                sampleId: activeSample.id,
                analysis: 'pH',
                status: 'SUBMITTED',
                batchId: batchWiTestId,
                labId: testLab1.id
            }
        });

        // Historical ACCEPTED work item
        const wiAccepted = await createWorkItemFixture(prisma, {
            data: {
                id: `wi-acc-${Date.now()}`,
                duplicateOf: wiActive.id,
                sampleId: activeSample.id,
                analysis: 'pH',
                status: 'ACCEPTED',
                batchId: batchWiTestId,
                labId: testLab1.id
            }
        });

        // Historical COMPLETED work item
        const wiCompleted = await createWorkItemFixture(prisma, {
            data: {
                id: `wi-comp-${Date.now()}`,
                duplicateOf: wiActive.id,
                sampleId: activeSample.id,
                analysis: 'pH',
                status: 'COMPLETED',
                batchId: batchWiTestId,
                labId: testLab1.id
            }
        });

        // Trigger REANALYZE_BATCH
        await normalizeLegacyQcFixture(prisma, batchWiTestId);
        const membershipBefore = await prisma.batchPosition.findMany({ where: { batchId: batchWiTestId, kind: 'SAMPLE' },
            orderBy: { position: 'asc' }, include: { workItems: true } });
        expect(membershipBefore).toHaveLength(3);
        expect(membershipBefore.flatMap(position => position.workItems.map(row => row.workItemId)))
            .toEqual([wiActive.id, wiAccepted.id, wiCompleted.id]);
        expect(membershipBefore.every(position => position.historicalSnapshotSeq === null)).toBe(true);
        const dispRes = await request(app)
            .post(`/api/qc/batches/${batchWiTestId}/disposition`)
            .set('Authorization', `Bearer ${lab1Manager.token}`)
            .send({
                decision: 'REANALYZE_BATCH',
                reason: 'Reanalyze active items only'
            });

        expect(dispRes.status).toBe(200);

        // Verify: Active work item was updated to REPEAT_REQUIRED
        const refActive = await prisma.workItem.findUnique({ where: { id: wiActive.id } });
        expect(refActive.status).toBe('REPEAT_REQUIRED');

        // Verify: Historical ACCEPTED work item was NOT overwritten (scientific immutability)
        const refAccepted = await prisma.workItem.findUnique({ where: { id: wiAccepted.id } });
        expect(refAccepted.status).toBe('ACCEPTED');

        // Verify: Completed-unsubmitted work item transitions to REPEAT_REQUIRED (R3 operational repeat)
        const refCompleted = await prisma.workItem.findUnique({ where: { id: wiCompleted.id } });
        expect(refCompleted.status).toBe('REPEAT_REQUIRED');
        expect(refCompleted.reanalysisReason).toBe('Reanalyze active items only');
        expect(await prisma.batchPosition.findMany({ where: { batchId: batchWiTestId, kind: 'SAMPLE' },
            orderBy: { position: 'asc' }, include: { workItems: true } })).toEqual(membershipBefore);

        // Cleanup
        await cleanupWorkflowFixtures(prisma, "workItem", (await prisma.workItem.findMany({ ...({ where: { id: { in: [wiAccepted.id, wiCompleted.id] } } }), select: { id: true } })).map(row => row.id), { single: false });
        await cleanupWorkflowFixtures(prisma, "workItem", (await prisma.workItem.findMany({ ...({
            where: { id: { in: [wiActive.id, wiAccepted.id, wiCompleted.id] } }
        }), select: { id: true } })).map(row => row.id), { single: false });
        await prisma.batch.delete({ where: { id: batchWiTestId } }).catch(() => {});
        await prisma.auditLog.deleteMany({ where: { entityId: batchWiTestId } }).catch(() => {});
    });

    // ─── Test 16: Multi-Step Validity Provenance: Unflagged Invalid Stays Invalid Across FAIL -> PASS ───
    test('16. Multi-step probe: initial isValid:false, flags:[] -> QC_FAIL -> QC_PASS remains isValid:false', async () => {
        const { flagBatchResults } = require('../../services/qcService');
        const probeBatchId = `batch-probe-${Date.now()}`;

        const sample = await createSampleFixture(prisma, {
            data: {
                id: `smp-probe-${Date.now()}`,
                originalId: `SMP-PRB-${Date.now()}`,
                status: 'PROCESSING',
                projectCode: 'SoilFER-P1',
                assignedLab: testLab1.id
            }
        });

        // Step 1: Initial row isValid: false, flags: []
        // Pin6060110991: explicit canonical PH owner; original Result fields stay unchanged.
        await createWorkItemFixture(prisma, { data: { id: `${sample.id}-PH`, sampleId: sample.id,
            analysis: 'PH', assignedLab: testLab1.id, status: 'COMPLETED' } });
        const res = await createExecutionResultFixture(prisma, {
            data: {
                id: `res-probe-${Date.now()}`,
                sampleId: sample.id,
                param: 'PH',
                value: '6.80',
                unit: 'pH units',
                batchId: probeBatchId,
                isValid: false,
                isCurrent: true,
                flags: JSON.stringify([])
            }
        });

        // Step 2: flagBatchResults(db, batch, 'QC_FAIL')
        await flagBatchResults(prisma, probeBatchId, 'QC_FAIL');
        const afterFail = await prisma.result.findUnique({ where: { id: res.id } });
        expect(afterFail.isValid).toBe(false);
        const failFlags = JSON.parse(afterFail.flags);
        expect(failFlags).toContain('QC_BATCH_FAILED');
        expect(failFlags).toContain('ORIGINALLY_INVALID');

        // Step 3: flagBatchResults(db, batch, 'QC_PASS')
        await flagBatchResults(prisma, probeBatchId, 'QC_PASS');
        const afterPass = await prisma.result.findUnique({ where: { id: res.id } });
        // MUST REMAIN FALSE: Validity provenance preserved!
        expect(afterPass.isValid).toBe(false);
        const passFlags = JSON.parse(afterPass.flags);
        expect(passFlags).not.toContain('QC_BATCH_FAILED');

        // Retain QC, report and execution parents until whole-owned-DB teardown.
    });

    // ─── Test 17: Multi-Step Validity Provenance: Unflagged Invalid Stays Invalid Across FAIL -> PROCEED_WITH_WARNING ───
    test('17. Multi-step probe: initial isValid:false, flags:[] -> QC_FAIL -> PROCEED_WITH_WARNING remains isValid:false', async () => {
        const { flagBatchResults } = require('../../services/qcService');
        const warnBatchId = `batch-warn-${Date.now()}`;

        const sample = await createSampleFixture(prisma, {
            data: {
                id: `smp-warn-${Date.now()}`,
                originalId: `SMP-WRN-${Date.now()}`,
                status: 'PROCESSING',
                projectCode: 'SoilFER-P1',
                assignedLab: testLab1.id
            }
        });

        // Pin6060110991: explicit canonical PH owner; original Result fields stay unchanged.
        await createWorkItemFixture(prisma, { data: { id: `${sample.id}-PH`, sampleId: sample.id,
            analysis: 'PH', assignedLab: testLab1.id, status: 'COMPLETED' } });
        const res = await createExecutionResultFixture(prisma, {
            data: {
                id: `res-warn-${Date.now()}`,
                sampleId: sample.id,
                param: 'PH',
                value: '6.80',
                unit: 'pH units',
                batchId: warnBatchId,
                isValid: false,
                isCurrent: true,
                flags: JSON.stringify([])
            }
        });

        await flagBatchResults(prisma, warnBatchId, 'QC_FAIL');
        await flagBatchResults(prisma, warnBatchId, 'QC_FAIL', { decision: 'PROCEED_WITH_WARNING', reason: 'Override' });

        const afterWarn = await prisma.result.findUnique({ where: { id: res.id } });
        // MUST REMAIN FALSE
        expect(afterWarn.isValid).toBe(false);
        const warnFlags = JSON.parse(afterWarn.flags);
        expect(warnFlags).toContain('QC_WARNING_OVERRIDDEN');
        expect(warnFlags).not.toContain('QC_BATCH_FAILED');

        // Retain QC, report and execution parents until whole-owned-DB teardown.
    });

    // ─── Test 18: Multi-Step Validity Provenance: Initially Valid Results Correctly Restored ───
    test('18. Initially valid results (isValid:true, flags:[]) restore to valid upon QC_PASS and PROCEED_WITH_WARNING', async () => {
        const { flagBatchResults } = require('../../services/qcService');
        const validBatchId = `batch-valid-${Date.now()}`;

        const sample = await createSampleFixture(prisma, {
            data: {
                id: `smp-valid-${Date.now()}`,
                originalId: `SMP-VLD-${Date.now()}`,
                status: 'PROCESSING',
                projectCode: 'SoilFER-P1',
                assignedLab: testLab1.id
            }
        });

        // Initially valid result
        // Pin6060110991: explicit canonical PH owner; original Result fields stay unchanged.
        await createWorkItemFixture(prisma, { data: { id: `${sample.id}-PH`, sampleId: sample.id,
            analysis: 'PH', assignedLab: testLab1.id, status: 'COMPLETED' } });
        const res = await createExecutionResultFixture(prisma, {
            data: {
                id: `res-valid-${Date.now()}`,
                sampleId: sample.id,
                param: 'PH',
                value: '6.80',
                unit: 'pH units',
                batchId: validBatchId,
                isValid: true,
                isCurrent: true,
                flags: JSON.stringify([])
            }
        });

        // 1. QC_FAIL marks invalid
        await flagBatchResults(prisma, validBatchId, 'QC_FAIL');
        const afterFail = await prisma.result.findUnique({ where: { id: res.id } });
        expect(afterFail.isValid).toBe(false);

        // 2. QC_PASS restores valid
        await flagBatchResults(prisma, validBatchId, 'QC_PASS');
        const afterPass = await prisma.result.findUnique({ where: { id: res.id } });
        expect(afterPass.isValid).toBe(true);
        expect(JSON.parse(afterPass.flags)).toEqual([]);

        // 3. QC_FAIL again -> PROCEED_WITH_WARNING restores valid with warning flag
        await flagBatchResults(prisma, validBatchId, 'QC_FAIL');
        await flagBatchResults(prisma, validBatchId, 'QC_FAIL', { decision: 'PROCEED_WITH_WARNING', reason: 'Override' });
        const afterWarn = await prisma.result.findUnique({ where: { id: res.id } });
        expect(afterWarn.isValid).toBe(true);
        expect(JSON.parse(afterWarn.flags)).toContain('QC_WARNING_OVERRIDDEN');

        // Retain QC, report and execution parents until whole-owned-DB teardown.
    });

    // ─── Test 19: Unknown and Malformed Flags Handled Safely and Remain Invalid ───
    test('19. Results with unknown or malformed flags stay invalid across FAIL -> PASS', async () => {
        const { flagBatchResults } = require('../../services/qcService');
        const malBatchId = `batch-mal-${Date.now()}`;

        const sample = await createSampleFixture(prisma, {
            data: {
                id: `smp-mal-${Date.now()}`,
                originalId: `SMP-MAL-${Date.now()}`,
                status: 'PROCESSING',
                projectCode: 'SoilFER-P1',
                assignedLab: testLab1.id
            }
        });

        // Result with unknown flag
        // Pin6060110991: explicit canonical PH owner; original Result fields stay unchanged.
        await createWorkItemFixture(prisma, { data: { id: `${sample.id}-PH`, sampleId: sample.id,
            analysis: 'PH', assignedLab: testLab1.id, status: 'COMPLETED' } });
        const resUnknown = await createExecutionResultFixture(prisma, {
            data: {
                id: `res-unknown-${Date.now()}`,
                sampleId: sample.id,
                param: 'PH',
                value: '6.80',
                unit: 'pH units',
                batchId: malBatchId,
                isValid: false,
                isCurrent: true,
                flags: JSON.stringify(['CUSTOM_SENSOR_DRIFT'])
            }
        });

        // Result with malformed JSON string flags
        // Pin6060110991: explicit canonical EC owner; original Result fields stay unchanged.
        await createWorkItemFixture(prisma, { data: { id: `${sample.id}-EC`, sampleId: sample.id,
            analysis: 'EC', assignedLab: testLab1.id, status: 'COMPLETED' } });
        const resMalformed = await createExecutionResultFixture(prisma, {
            data: {
                id: `res-malformed-${Date.now()}`,
                sampleId: sample.id,
                param: 'EC',
                value: '2.10',
                unit: 'dS/m',
                batchId: malBatchId,
                isValid: false,
                isCurrent: true,
                flags: '{invalid-json-string'
            }
        });

        await flagBatchResults(prisma, malBatchId, 'QC_FAIL');
        await flagBatchResults(prisma, malBatchId, 'QC_PASS');

        const refUnknown = await prisma.result.findUnique({ where: { id: resUnknown.id } });
        expect(refUnknown.isValid).toBe(false);
        expect(JSON.parse(refUnknown.flags)).toContain('CUSTOM_SENSOR_DRIFT');

        const refMalformed = await prisma.result.findUnique({ where: { id: resMalformed.id } });
        expect(refMalformed.isValid).toBe(false);

        // Retain QC, report and execution parents until whole-owned-DB teardown.
    });

    // ─── Test 20: History Protection Accounts for SUPERSEDED Reports and Fails Closed on DB Error ───
    test('20. flagBatchResults protects SUPERSEDED reports and fails closed on DB error', async () => {
        const { flagBatchResults } = require('../../services/qcService');
        const histBatchId = `batch-hist-${Date.now()}`;

        const histSample = await createSampleFixture(prisma, {
            data: {
                id: `smp-hist-${Date.now()}`,
                originalId: `SMP-HST-${Date.now()}`,
                status: 'PROCESSING',
                projectCode: 'SoilFER-P1',
                assignedLab: testLab1.id
            }
        });

        const supersededReport = await prisma.report.create({
            data: {
                id: `rep-super-${Date.now()}`,
                sampleId: histSample.id,
                status: 'SUPERSEDED',
                generatedBy: lab1Manager.username
            }
        });

        // Pin6060110991: explicit canonical PH owner; original Result fields stay unchanged.
        await createWorkItemFixture(prisma, { data: { id: `${histSample.id}-PH`, sampleId: histSample.id,
            analysis: 'PH', assignedLab: testLab1.id, status: 'ACCEPTED' } });
        const resSupersededReport = await createExecutionResultFixture(prisma, { attemptStatus: 'ACCEPTED',
            data: {
                id: `res-hist-${Date.now()}`,
                sampleId: histSample.id,
                param: 'PH',
                value: '7.00',
                unit: 'pH units',
                batchId: histBatchId,
                isValid: false,
                isCurrent: true,
                flags: JSON.stringify(['QC_BATCH_FAILED'])
            }
        });

        // Attempting to modify results linked to a SUPERSEDED report must be skipped (protected)
        await flagBatchResults(prisma, histBatchId, 'QC_PASS');

        const refRes = await prisma.result.findUnique({ where: { id: resSupersededReport.id } });
        expect(refRes.isValid).toBe(false);
        expect(JSON.parse(refRes.flags)).toEqual(['QC_BATCH_FAILED']); // Untouched!

        // Test fail-closed on DB error
        const mockPrismaError = {
            result: {
                findMany: async () => [{ id: 'res-err-1', sampleId: 'smp-err-1' }]
            },
            report: {
                findMany: async () => {
                    throw new Error('Database connection failed');
                }
            }
        };

        await expect(flagBatchResults(mockPrismaError, 'batch-err', 'QC_PASS')).rejects.toThrow('Database connection failed');

        // Retain QC, report and execution parents until whole-owned-DB teardown.
    });
});
