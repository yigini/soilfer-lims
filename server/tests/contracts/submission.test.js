const request = require('supertest');
const app = require('../../app');
const { generateToken } = require('../setup');
const { usersDb, workItemsDb, samplesDb, submissionsDb } = require('../../db');

describe('8.1 Section D: Submission Rules', () => {
    let mgrToken, techToken;
    let techUsername;
    let sampleId;
    let phItemId, condItemId;

    beforeAll(async () => {
        const suffix = Date.now();
        techUsername = `tech_sub_${suffix}`;
        const mgr = usersDb.create({ username: `mgr_sub_${suffix}`, role: 'LAB_MANAGER', labId: 'LAB-SUB', countries: ['SUB'] });
        const tech = usersDb.create({ username: techUsername, role: 'LAB_TECHNICIAN', labId: 'LAB-SUB' });

        mgrToken = generateToken(mgr);
        techToken = generateToken(tech);
    });

    test('Setup: Create Sample and WorkItems', async () => {
        const createRes = await request(app)
            .post('/api/samples/walkin')
            .set('Authorization', `Bearer ${mgrToken}`)
            .send({ submitter: 'Sub Tester', analyses: ['PH_H2O', 'EC'], countryCode: 'SUB' });

        expect(createRes.status).toBe(201);
        sampleId = createRes.body.sample.id;

        await request(app)
            .post(`/api/samples/${sampleId}/accept`)
            .set('Authorization', `Bearer ${mgrToken}`)
            .send({ analyses: ['PH_H2O', 'EC'] });

        const itemsRes = await request(app)
            .get('/api/work')
            .set('Authorization', `Bearer ${mgrToken}`)
            .query({ sampleId });

        const ph = itemsRes.body.data.find(i => i.analysis === 'PH_H2O');
        const cond = itemsRes.body.data.find(i => i.analysis === 'EC');

        expect(ph).toBeDefined();
        phItemId = ph.id;
        condItemId = cond.id;

        // Assign using explicit username
        await request(app)
            .post('/api/work/assign')
            .set('Authorization', `Bearer ${mgrToken}`)
            .send({ workItemIds: [phItemId, condItemId], assignee: techUsername });

        // Gates
        const dRes = await request(app).put(`/api/samples/${sampleId}/phase`).set('Authorization', `Bearer ${mgrToken}`).send({ phase: 'DRYING', status: 'DONE' });
        if (dRes.status !== 200) console.log('DEBUG Drying Gate Failure:', dRes.body);
        expect(dRes.status).toBe(200);

        const pRes = await request(app).put(`/api/samples/${sampleId}/phase`).set('Authorization', `Bearer ${mgrToken}`).send({ phase: 'PREPARATION', status: 'DONE' });
        if (pRes.status !== 200) console.log('DEBUG Prep Gate Failure:', pRes.body);
        expect(pRes.status).toBe(200);
    });

    test('Scenario 1: Tech can Submit Partial (PH)', async () => {
        const completeRes = await request(app)
            .put(`/api/work/${phItemId}/status`)
            .set('Authorization', `Bearer ${techToken}`)
            .send({ status: 'COMPLETED', result: '7.0' });
        expect(completeRes.status).toBe(200);

        const subRes = await request(app)
            .post('/api/submissions')
            .set('Authorization', `Bearer ${techToken}`)
            .send({
                sampleId,
                type: 'PARTIAL',
                workItemIds: [phItemId]
            });

        expect(subRes.status).toBe(201);
        expect(subRes.body.submission.status).toBe('PENDING_REVIEW');
    });

    test('Scenario 2: Full Submission Blocked if items incomplete', async () => {
        const completeRes = await request(app)
            .put(`/api/work/${condItemId}/status`)
            .set('Authorization', `Bearer ${techToken}`)
            .send({ status: 'COMPLETED', result: '5.0' });
        if (completeRes.status !== 200) console.log('DEBUG Scenario 2 Complete Failure:', completeRes.body);
        expect(completeRes.status).toBe(200);

        const subRes = await request(app)
            .post('/api/submissions')
            .set('Authorization', `Bearer ${techToken}`)
            .send({
                sampleId,
                type: 'FULL',
                workItemIds: [condItemId]
            });

        if (subRes.status !== 409) console.log('DEBUG Scenario 2:', subRes.body);
        expect(subRes.status).toBe(409);
        expect(subRes.body.blocking).toBeDefined();
    });

    test('Scenario 3: Manager accepts Submission (PH)', async () => {
        const listRes = await request(app)
            .get('/api/submissions')
            .set('Authorization', `Bearer ${mgrToken}`)
            .query({ sampleId });

        const partialSub = listRes.body.find(s => s.type === 'PARTIAL');
        expect(partialSub).toBeDefined();
        const subId = partialSub.id;

        const reviewRes = await request(app)
            .post(`/api/submissions/${subId}/review`)
            .set('Authorization', `Bearer ${mgrToken}`)
            .send({
                decisions: [{ workItemId: phItemId, decision: 'ACCEPT' }]
            });

        expect(reviewRes.status).toBe(200);
    });

    test('Scenario 4: Rejection (COND)', async () => {
        // Re-complete the rejected item
        const completeRes = await request(app)
            .put(`/api/work/${condItemId}/status`)
            .set('Authorization', `Bearer ${techToken}`)
            .send({ status: 'COMPLETED', result: '5.1' });
        expect(completeRes.status).toBe(200);

        const subRes = await request(app)
            .post('/api/submissions')
            .set('Authorization', `Bearer ${techToken}`)
            .send({
                sampleId,
                type: 'PARTIAL',
                workItemIds: [condItemId]
            });
        if (subRes.status !== 201) console.log('DEBUG Scenario 4:', subRes.body);
        expect(subRes.status).toBe(201);
        const subId = subRes.body.submission.id;

        const reviewRes = await request(app)
            .post(`/api/submissions/${subId}/review`)
            .set('Authorization', `Bearer ${mgrToken}`)
            .send({
                decisions: [{ workItemId: condItemId, decision: 'REJECT_REANALYSIS', reason: 'Value too high' }]
            });

        expect(reviewRes.status).toBe(200);

        const cond = workItemsDb.findById(condItemId);
        expect(cond.status).toBe('REANALYSIS_REQUIRED');
    });
});
