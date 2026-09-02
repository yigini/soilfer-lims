const request = require('supertest');
const app = require('../../app');
const { getAuthToken } = require('../setup');
const { samplesDb, workItemsDb, usersDb, submissionsDb } = require('../../db');
const {
    evaluateBlank,
    evaluateDuplicate,
    evaluateControl,
    evaluateBatchQc
} = require('../../services/qcService');

describe('BLK-2: Minimum Viable Typed QC Controls Contract', () => {
    let techToken, mgrToken;
    let batchId, sampleId, workItemId, subId;

    beforeAll(async () => {
        techToken = await getAuthToken('LAB_TECHNICIAN', 'LAB-QC2', ['GTM'], ['QC-PROJ']);
        mgrToken = await getAuthToken('LAB_MANAGER', 'LAB-QC2', ['GTM'], ['QC-PROJ']);

        // Create sample and work item
        const s = samplesDb.create({
            id: `SMP-QC2-${Date.now()}`,
            labId: 'LAB-QC2-001',
            assignedLab: 'LAB-QC2',
            status: 'ACCEPTED'
        });
        sampleId = s.id;

        const wi = workItemsDb.create({
            id: `WI-QC2-${Date.now()}`,
            sampleId: s.id,
            analysis: 'PH_H2O',
            assignedLab: 'LAB-QC2',
            status: 'COMPLETED',
            result: '6.8'
        });
        workItemId = wi.id;
    });

    test('1. Typed QC Pure Functions: Blank, Duplicate (RPD), and Control (Recovery %)', () => {
        // Blank checks
        const blankPass = evaluateBlank({ value: 0.015, maxAllowed: 0.05 });
        expect(blankPass.status).toBe('PASS');
        const blankFail = evaluateBlank({ value: 0.08, maxAllowed: 0.05 });
        expect(blankFail.status).toBe('FAIL');

        // Duplicate checks (RPD = |V1-V2| / Avg * 100)
        // |6.8 - 7.0| / 6.9 = 2.898%
        const dupPass = evaluateDuplicate({ value1: 6.8, value2: 7.0, maxRpd: 10.0 });
        expect(dupPass.status).toBe('PASS');
        expect(dupPass.rpd).toBeCloseTo(2.90, 1);

        // |5.0 - 6.0| / 5.5 = 18.18%
        const dupFail = evaluateDuplicate({ value1: 5.0, value2: 6.0, maxRpd: 10.0 });
        expect(dupFail.status).toBe('FAIL');
        expect(dupFail.rpd).toBeCloseTo(18.18, 1);

        // Control checks (Recovery = measured / expected * 100)
        // 24.5 / 25.0 = 98.0%
        const crmPass = evaluateControl({ expected: 25.0, measured: 24.5, minRecovery: 90, maxRecovery: 110 });
        expect(crmPass.status).toBe('PASS');
        expect(crmPass.recoveryPct).toBe(98.0);

        // 18.0 / 25.0 = 72.0%
        const crmFail = evaluateControl({ expected: 25.0, measured: 18.0, minRecovery: 90, maxRecovery: 110 });
        expect(crmFail.status).toBe('FAIL');
        expect(crmFail.recoveryPct).toBe(72.0);
    });

    test('2. Creates a QC batch and groups work items', async () => {
        const createRes = await request(app)
            .post('/api/qc/batches')
            .set('Authorization', `Bearer ${techToken}`)
            .send({ analysis: 'PH_H2O', instrument: 'Mettler Toledo pH' });

        expect(createRes.status).toBe(201);
        batchId = createRes.body.id;
        expect(createRes.body.status).toBe('OPEN');

        // Add work item to batch
        const addRes = await request(app)
            .post(`/api/qc/batches/${batchId}/items`)
            .set('Authorization', `Bearer ${techToken}`)
            .send({ workItemIds: [workItemId] });

        expect(addRes.status).toBe(200);
        const wi = workItemsDb.findById(workItemId);
        expect(wi.batchId).toBe(batchId);
    });

    test('3. Batch evaluation endpoint transitions status to QC_FAIL when any control fails', async () => {
        const evalRes = await request(app)
            .post(`/api/qc/batches/${batchId}/evaluate`)
            .set('Authorization', `Bearer ${techToken}`)
            .send({
                blanks: [{ id: 'B1', value: 0.02, maxAllowed: 0.05 }],
                duplicates: [{ id: 'D1', value1: 6.8, value2: 7.9, maxRpd: 10.0 }], // RPD ~15% -> FAIL
                controls: [{ id: 'C1', expected: 7.0, measured: 6.9, minRecovery: 90, maxRecovery: 110 }]
            });

        expect(evalRes.status).toBe(200);
        expect(evalRes.body.status).toBe('QC_FAIL');
        expect(evalRes.body.evaluation.duplicates[0].status).toBe('FAIL');
    });

    test('4. Submission review blocks acceptance (HTTP 409) if batch is in QC_FAIL without disposition', async () => {
        subId = `SUB-QC2-${Date.now()}`;
        submissionsDb.create({
            id: subId,
            sampleId: sampleId,
            assignedLab: 'LAB-QC2',
            status: 'PENDING_REVIEW',
            workItemIds: [workItemId],
            submittedBy: `tech_qc2_${Date.now()}`
        });

        const reviewRes = await request(app)
            .post(`/api/submissions/${subId}/review`)
            .set('Authorization', `Bearer ${mgrToken}`)
            .send({
                decisions: [{ workItemId: workItemId, decision: 'ACCEPT' }]
            });

        expect(reviewRes.status).toBe(409);
        expect(reviewRes.body.error).toMatch(/FAILED QC Batch/);
    });

    test('5. Manager disposition override (PROCEED_WITH_WARNING) allows submission acceptance', async () => {
        // Manager dispositions the failed batch
        const dispRes = await request(app)
            .post(`/api/qc/batches/${batchId}/disposition`)
            .set('Authorization', `Bearer ${mgrToken}`)
            .send({
                decision: 'PROCEED_WITH_WARNING',
                reason: 'Duplicate variance acceptable given sample matrix heterogeneity'
            });

        expect(dispRes.status).toBe(200);
        expect(dispRes.body.disposition.decision).toBe('PROCEED_WITH_WARNING');

        // Review submission again - should succeed now!
        const reviewRes = await request(app)
            .post(`/api/submissions/${subId}/review`)
            .set('Authorization', `Bearer ${mgrToken}`)
            .send({
                decisions: [{ workItemId: workItemId, decision: 'ACCEPT' }]
            });

        expect(reviewRes.status).toBe(200);
    });

    test('6. Batch evaluation endpoint transitions status to QC_PASS when all controls pass', async () => {
        const evalRes = await request(app)
            .post(`/api/qc/batches/${batchId}/evaluate`)
            .set('Authorization', `Bearer ${techToken}`)
            .send({
                blanks: [{ id: 'B1', value: 0.01, maxAllowed: 0.05 }],
                duplicates: [{ id: 'D1', value1: 6.8, value2: 6.9, maxRpd: 10.0 }], // RPD 1.46% -> PASS
                controls: [{ id: 'C1', expected: 7.0, measured: 6.95, minRecovery: 90, maxRecovery: 110 }] // Recovery 99.3% -> PASS
            });

        expect(evalRes.status).toBe(200);
        expect(evalRes.body.status).toBe('QC_PASS');
        expect(evalRes.body.evaluation.summary.failed).toBe(0);
    });
});
