const { createSampleFixture, createWorkItemFixture } = require('../helpers/workflowFixtures');
const request = require('supertest');
const app = require('../../app');
const prisma = require('../../prisma');
const { workItemsDb, usersDb, submissionsDb } = require('../../db');
const { transitionWorkItem } = require('../../services/workItemStateService');

describe('Scenario E: QC Batch Management', () => {
    let mgrToken, techToken;
    let workItemIds = [];
    let sampleIds = [];

    beforeAll(async () => {
        // Setup Users
        const suffix = Date.now();
        usersDb.create({ username: `mgr_qc_${suffix}`, password: 'p', role: 'LAB_MANAGER', labId: 'LAB-QC', countries: ['QC'] });
        usersDb.create({ username: `tech_qc_${suffix}`, password: 'p', role: 'LAB_TECHNICIAN', labId: 'LAB-QC', countries: ['QC'] });

        const mgrLog = await request(app).post('/api/auth/login').send({ username: `mgr_qc_${suffix}`, password: 'p' });
        mgrToken = mgrLog.body.token;
        const techLog = await request(app).post('/api/auth/login').send({ username: `tech_qc_${suffix}`, password: 'p' });
        techToken = techLog.body.token;

        // Create Sample & WorkItems
        sampleIds = [`S1_${suffix}`, `S2_${suffix}`];
        for (const id of sampleIds) {
            await createSampleFixture(prisma, { data: {
                id, originalId: id, labId: id, assignedLab: 'LAB-QC', country: 'QC',
                status: 'SUBMITTED_PARTIAL', receptionDate: new Date(),
                dryingStatus: 'DONE', preparationStatus: 'DONE'
            } });
        }
        await createWorkItemFixture(prisma, { data: { id: `WI1_${suffix}`,
            sampleId: `S1_${suffix}`,
            analysis: 'PH_H2O',
            status: 'COMPLETED',
            assignedTo: `tech_qc_${suffix}`,
            assignedLab: 'LAB-QC',
            batchId: null } });
        await createWorkItemFixture(prisma, { data: { id: `WI2_${suffix}`,
            sampleId: `S2_${suffix}`,
            analysis: 'PH_H2O',
            status: 'COMPLETED',
            assignedTo: `tech_qc_${suffix}`,
            assignedLab: 'LAB-QC',
            batchId: null } });
        workItemIds = [`WI1_${suffix}`, `WI2_${suffix}`];
    });

    let batchId;

    it('should create a QC Batch', async () => {
        const res = await request(app)
            .post('/api/qc/batches')
            .set('Authorization', `Bearer ${techToken}`)
            .send({ analysis: 'PH_H2O', instrument: 'Meter-1' });

        expect(res.status).toBe(201);
        batchId = res.body.id;
        expect(res.body.status).toBe('OPEN');
    });

    it('should add items to QC Batch', async () => {
        const res = await request(app)
            .post(`/api/qc/batches/${batchId}/items`)
            .set('Authorization', `Bearer ${techToken}`)
            .send({ workItemIds });

        expect(res.status).toBe(200);

        // Verify Work Item Updated
        const wi = workItemsDb.findById(workItemIds[0]);
        expect(wi.batchId).toBe(batchId);
    });

    it('should fail submission review if Batch fails', async () => {
        const parent = await prisma.batchPosition.findFirst({ where: { batchId, kind: 'SAMPLE' } });
        // 1. Fail Batch with evaluated failing QC data
        const failRes = await request(app)
            .put(`/api/qc/batches/${batchId}`)
            .set('Authorization', `Bearer ${techToken}`)
            .send({
                blanks: [{ value: 99.0 }], controls: [{ expected: 7, measured: 7 }],
                duplicates: [{ duplicateOfPositionId: parent.id, value1: 7, value2: 7 }]
            });
        expect(failRes.status).toBe(200);
        expect(failRes.body.status).toBe('QC_FAIL');

        // Each submission owns work from its actual parent; both specimens share the failed batch.
        const technician = usersDb.findByUsername(require('jsonwebtoken').decode(techToken).username);
        for (const [index, workItemId] of workItemIds.entries()) {
            const subId = `SUB_QC_${workItemId}`;
            submissionsDb.create({
                id: subId, status: 'PENDING_REVIEW', sampleId: sampleIds[index],
                assignedLab: 'LAB-QC', workItemIds: [workItemId], submittedBy: technician.username
            });
            await transitionWorkItem(workItemId, 'SUBMITTED', technician, null, { submissionId: subId });

            const reviewRes = await request(app)
                .post(`/api/submissions/${subId}/review`)
                .set('Authorization', `Bearer ${mgrToken}`)
                .send({ decisions: [{ workItemId, decision: 'ACCEPT' }] });

            expect(reviewRes.status).toBe(409);
            expect(reviewRes.body.error).toMatch(/FAILED QC Batch/);
        }
    });

    it('should allow manager to disposition failed batch', async () => {
        const res = await request(app)
            .post(`/api/qc/batches/${batchId}/disposition`)
            .set('Authorization', `Bearer ${mgrToken}`)
            .send({ decision: 'PROCEED_WITH_WARNING', reason: 'Control slightly off but acceptable' });

        expect(res.status).toBe(200);
    });
});
