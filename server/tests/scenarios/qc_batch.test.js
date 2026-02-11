const request = require('supertest');
const app = require('../../app');
const { samplesDb, workItemsDb, usersDb, batchesDb } = require('../../db');

describe('Scenario E: QC Batch Management', () => {
    let mgrToken, techToken;
    let workItemIds = [];

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
        workItemsDb.create({ id: `WI1_${suffix}`, sampleId: `S1_${suffix}`, analysis: 'PH_H2O', status: 'COMPLETED', assignedTo: `tech_qc_${suffix}`, assignedLab: 'LAB-QC', batchId: null });
        workItemsDb.create({ id: `WI2_${suffix}`, sampleId: `S2_${suffix}`, analysis: 'PH_H2O', status: 'COMPLETED', assignedTo: `tech_qc_${suffix}`, assignedLab: 'LAB-QC', batchId: null });
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
        // 1. Fail Batch
        await request(app)
            .put(`/api/qc/batches/${batchId}`)
            .set('Authorization', `Bearer ${techToken}`)
            .send({ status: 'QC_FAIL' });

        // 2. Create Submission
        const subRes = await request(app)
            .post('/api/submissions')
            .set('Authorization', `Bearer ${techToken}`)
            .send({
                sampleId: `S1_${Date.now()}`, // Fake sample just for test structure if controller validates it
                // Actually controller validates sample existence. Need real sample.
                // Let's skip full submission flow and test Review Logic directly? 
                // Creating a submission manually in DB is easier for unit test.
            });

        // Setup Manual Submission
        const { submissionsDb, samplesDb } = require('../../db');
        const subId = `SUB_QC_${Date.now()}`;
        const sampleId = `S_QC_${Date.now()}`;
        samplesDb.create({ id: sampleId, labId: 'LAB-QC-01', assignedLab: 'LAB-QC', status: 'SUBMITTED_PARTIAL' });
        submissionsDb.create({
            id: subId,
            status: 'PENDING_REVIEW',
            sampleId: sampleId,
            assignedLab: 'LAB-QC',
            workItemIds: workItemIds,
            submittedBy: `tech_qc_${Date.now()}` // Bypass check
        });

        // 3. Manager Review - Attempt Accept
        const reviewRes = await request(app)
            .post(`/api/submissions/${subId}/review`)
            .set('Authorization', `Bearer ${mgrToken}`)
            .send({
                decisions: workItemIds.map(id => ({ workItemId: id, decision: 'ACCEPT' }))
            });

        expect(reviewRes.status).toBe(409); // Conflict
        expect(reviewRes.body.error).toMatch(/FAILED QC Batch/);
    });

    it('should allow manager to disposition failed batch', async () => {
        const res = await request(app)
            .post(`/api/qc/batches/${batchId}/disposition`)
            .set('Authorization', `Bearer ${mgrToken}`)
            .send({ decision: 'PROCEED_WITH_WARNING', reason: 'Control slightly off but acceptable' });

        expect(res.status).toBe(200);
    });
});
