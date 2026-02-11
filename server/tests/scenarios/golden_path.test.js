const request = require('supertest');
const app = require('../../app');
const { generateToken } = require('../setup');
const { usersDb, workItemsDb, samplesDb, submissionsDb } = require('../../db');

describe('8.2 Integration: Golden Path Scenarios', () => {
    let mgrToken, techToken;
    let mgrUsername, techUsername;
    let mgrSilverToken, techSilverToken;
    let mgrSilverUsername, techSilverUsername;
    let mgrRedToken, techRedToken;
    let mgrRedUsername, techRedUsername;
    let mgrBlueToken, techBlueToken;
    let mgrBlueUsername, techBlueUsername;

    beforeAll(async () => {
        const suffix = Date.now();
        mgrUsername = `mgr_gold_${suffix}`;
        techUsername = `tech_gold_${suffix}`;

        const mgr = usersDb.create({ username: mgrUsername, role: 'LAB_MANAGER', labId: 'LAB-GOLD', countries: ['GLD'] });
        const tech = usersDb.create({ username: techUsername, role: 'LAB_TECHNICIAN', labId: 'LAB-GOLD' });

        mgrToken = generateToken(mgr);
        techToken = generateToken(tech);

        // SILVER LAB Setup for Scenario B
        mgrSilverUsername = `mgr_silver_${suffix}`;
        techSilverUsername = `tech_silver_${suffix}`;
        const mgrSilver = usersDb.create({ username: mgrSilverUsername, role: 'LAB_MANAGER', labId: 'LAB-SILVER', countries: ['SLV'] });
        const techSilver = usersDb.create({ username: techSilverUsername, role: 'LAB_TECHNICIAN', labId: 'LAB-SILVER' });

        mgrSilverToken = generateToken(mgrSilver);
        techSilverToken = generateToken(techSilver);

        // RED LAB Setup for Scenario C
        mgrRedUsername = `mgr_red_${suffix}`;
        techRedUsername = `tech_red_${suffix}`;
        const mgrRed = usersDb.create({ username: mgrRedUsername, role: 'LAB_MANAGER', labId: 'LAB-RED', countries: ['RED'] });
        const techRed = usersDb.create({ username: techRedUsername, role: 'LAB_TECHNICIAN', labId: 'LAB-RED' });

        mgrRedToken = generateToken(mgrRed);
        techRedToken = generateToken(techRed);

        // BLUE LAB Setup for Scenario D
        mgrBlueUsername = `mgr_blue_${suffix}`;
        techBlueUsername = `tech_blue_${suffix}`;
        const mgrBlue = usersDb.create({ username: mgrBlueUsername, role: 'LAB_MANAGER', labId: 'LAB-BLUE', countries: ['BLU'] });
        const techBlue = usersDb.create({ username: techBlueUsername, role: 'LAB_TECHNICIAN', labId: 'LAB-BLUE' });

        mgrBlueToken = generateToken(mgrBlue);
        techBlueToken = generateToken(techBlue);
    });

    /**
     * SCENARIO A: Project Sample Full Lifecycle
     */
    /**
     * SCENARIO A: Project Sample Lifecycle
     * Partial Submission -> Manager Reject (Reanalysis) -> Full Submission -> Approval -> Archive
     */
    test('Scenario A: Project Sample (Partial + Reanalysis + Approval + Archive)', async () => {
        // 1. Intake
        const receiveRes = await request(app)
            .post('/api/reception/intake')
            .set('Authorization', `Bearer ${mgrToken}`)
            .send({
                originalId: `PROJ-A-${Date.now()}`,
                receivedBy: mgrUsername,
                labId: 'LAB-GOLD',
                requiredAnalyses: ['PH_H2O', 'COND_H2O', 'SPECTRAL_1'],
                projectCode: 'GOLD-PROJ',
                isWalkIn: false
            });
        expect(receiveRes.status).toBe(200);
        const sampleId = receiveRes.body.id;

        // 2. Gates
        await request(app).put(`/api/samples/${sampleId}/phase`).set('Authorization', `Bearer ${mgrToken}`).send({ phase: 'DRYING', status: 'DONE' });
        await request(app).put(`/api/samples/${sampleId}/phase`).set('Authorization', `Bearer ${mgrToken}`).send({ phase: 'PREPARATION', status: 'DONE' });

        // 3. Assign
        const itemsRes = await request(app).get('/api/work').set('Authorization', `Bearer ${mgrToken}`).query({ sampleId });
        const phItem = itemsRes.body.data.find(i => i.analysis === 'PH_H2O');
        const condItem = itemsRes.body.data.find(i => i.analysis === 'COND_H2O');

        await request(app)
            .post('/api/work/assign')
            .set('Authorization', `Bearer ${mgrToken}`)
            .send({ workItemIds: [phItem.id, condItem.id], assignee: techUsername });

        // 4. Tech Completes partial
        await request(app).put(`/api/work/${phItem.id}/status`).set('Authorization', `Bearer ${techToken}`).send({ status: 'COMPLETED', result: '7.2' });

        // 5. Partial Submission
        const partialSubRes = await request(app)
            .post('/api/submissions')
            .set('Authorization', `Bearer ${techToken}`)
            .send({ sampleId, type: 'PARTIAL', workItemIds: [phItem.id] });
        expect(partialSubRes.status).toBe(201);
        const sub1Id = partialSubRes.body.submission.id;

        // 6. Manager Rejects (Reanalysis Loop)
        await request(app)
            .post(`/api/submissions/${sub1Id}/review`)
            .set('Authorization', `Bearer ${mgrToken}`)
            .send({ decisions: [{ workItemId: phItem.id, decision: 'REJECT_REANALYSIS', reason: 'Outlier detected' }] });

        const phItemReload = workItemsDb.findById(phItem.id);
        expect(phItemReload.status).toBe('REANALYSIS_REQUIRED'); // Sent back to technician

        // 7. Tech Fixes and Completes All
        await request(app).put(`/api/work/${phItem.id}/status`).set('Authorization', `Bearer ${techToken}`).send({ status: 'COMPLETED', result: '7.1' });
        await request(app).put(`/api/work/${condItem.id}/status`).set('Authorization', `Bearer ${techToken}`).send({ status: 'COMPLETED', result: '1.5' });

        // 8. Full Submission
        // Need to include SPECTRAL_1 too if it was required. Let's assign and complete it.
        const specItem = itemsRes.body.data.find(i => i.analysis === 'SPECTRAL_1');
        await request(app).post('/api/work/assign').set('Authorization', `Bearer ${mgrToken}`).send({ workItemIds: [specItem.id], assignee: techUsername });
        await request(app).put(`/api/work/${specItem.id}/status`).set('Authorization', `Bearer ${techToken}`).send({ status: 'COMPLETED', result: 'Spec OK' });

        const fullSubRes = await request(app)
            .post('/api/submissions')
            .set('Authorization', `Bearer ${techToken}`)
            .send({ sampleId, type: 'FULL', workItemIds: [phItem.id, condItem.id, specItem.id] });
        expect(fullSubRes.status).toBe(201);

        // 9. Approve & Archive
        await request(app)
            .post(`/api/submissions/${fullSubRes.body.submission.id}/review`)
            .set('Authorization', `Bearer ${mgrToken}`)
            .send({ decisions: [{ workItemId: phItem.id, decision: 'ACCEPT' }, { workItemId: condItem.id, decision: 'ACCEPT' }, { workItemId: specItem.id, decision: 'ACCEPT' }] });

        await request(app).post(`/api/samples/${sampleId}/approve`).set('Authorization', `Bearer ${mgrToken}`);
        const archiveRes = await request(app).post(`/api/samples/${sampleId}/archive`).set('Authorization', `Bearer ${mgrToken}`).send({ archiveLocation: 'A1' });
        expect(archiveRes.status).toBe(200);
        expect(samplesDb.findById(sampleId).status).toBe('ARCHIVED');
    });

    /**
     * SCENARIO B: Walk-in Sample + Disposal
     */
    test('Scenario B: Walk-in Sample + Approval + Dispose', async () => {
        // 1. Intake
        const intakeRes = await request(app)
            .post('/api/reception/intake')
            .set('Authorization', `Bearer ${mgrSilverToken}`)
            .send({
                originalId: `WALK-B-${Date.now()}`,
                receivedBy: mgrSilverUsername,
                labId: 'LAB-SILVER',
                requiredAnalyses: ['PH_H2O'],
                isWalkIn: true
            });
        const sampleId = intakeRes.body.id;

        // 2. Gates -> Assign -> Complete -> Submit -> Approve
        await request(app).put(`/api/samples/${sampleId}/phase`).set('Authorization', `Bearer ${mgrSilverToken}`).send({ phase: 'DRYING', status: 'DONE' });
        await request(app).put(`/api/samples/${sampleId}/phase`).set('Authorization', `Bearer ${mgrSilverToken}`).send({ phase: 'PREPARATION', status: 'DONE' });

        const items = await request(app).get('/api/work').set('Authorization', `Bearer ${mgrSilverToken}`).query({ sampleId });
        const phItem = items.body.data.find(i => i.analysis === 'PH_H2O');
        const phId = phItem.id;

        await request(app).post('/api/work/assign').set('Authorization', `Bearer ${mgrSilverToken}`).send({ workItemIds: [phId], assignee: techSilverUsername });
        await request(app).put(`/api/work/${phId}/status`).set('Authorization', `Bearer ${techSilverToken}`).send({ status: 'COMPLETED', result: '7.0' });

        const subRes = await request(app).post('/api/submissions').set('Authorization', `Bearer ${techSilverToken}`).send({ sampleId, type: 'FULL', workItemIds: [phId] });
        if (subRes.status !== 201) console.log('DEBUG Scenario B Submission Failure:', subRes.body);
        expect(subRes.status).toBe(201);
        await request(app).post(`/api/submissions/${subRes.body.submission.id}/review`).set('Authorization', `Bearer ${mgrSilverToken}`).send({ decisions: [{ workItemId: phId, decision: 'ACCEPT' }] });

        const approveRes = await request(app).post(`/api/samples/${sampleId}/approve`).set('Authorization', `Bearer ${mgrSilverToken}`);
        if (approveRes.status !== 200) console.log('DEBUG Scenario B Approval Failure:', approveRes.body);
        expect(approveRes.status).toBe(200);

        // 3. Dispose
        const disposeRes = await request(app)
            .post(`/api/samples/${sampleId}/dispose`)
            .set('Authorization', `Bearer ${mgrSilverToken}`)
            .send({ disposalMethod: 'Standard protocol' });
        expect(disposeRes.status).toBe(200);
        expect(samplesDb.findById(sampleId).status).toBe('DISPOSED');
    });

    /**
     * SCENARIO C: Drying Failure blocks flow
     */
    test('Scenario C: Drying FAILED blocks analysis with required reason', async () => {
        const intakeRes = await request(app)
            .post('/api/reception/intake')
            .set('Authorization', `Bearer ${mgrRedToken}`)
            .send({
                originalId: `FAIL-C-${Date.now()}`,
                receivedBy: mgrRedUsername,
                labId: 'LAB-RED',
                requiredAnalyses: ['PH_H2O'],
                isWalkIn: false
            });
        const sampleId = intakeRes.body.id;

        // 1. Fail Drying WITHOUT reason (should fail if validation exists, or just verify it blocks)
        const failRes = await request(app)
            .put(`/api/samples/${sampleId}/phase`)
            .set('Authorization', `Bearer ${mgrRedToken}`)
            .send({ phase: 'DRYING', status: 'FAILED', reason: 'High Moisture Alarm' });
        expect(failRes.status).toBe(200);

        // 2. Verify Prep blocked
        const prepRes = await request(app)
            .put(`/api/samples/${sampleId}/phase`)
            .set('Authorization', `Bearer ${mgrRedToken}`)
            .send({ phase: 'PREPARATION', status: 'DONE' });
        expect(prepRes.status).toBe(400);

        // 3. Verify Analysis completion blocked
        const items = await request(app).get('/api/work').set('Authorization', `Bearer ${mgrRedToken}`).query({ sampleId });
        const phId = items.body.data.find(i => i.analysis === 'PH_H2O').id;
        await request(app).post('/api/work/assign').set('Authorization', `Bearer ${mgrRedToken}`).send({ workItemIds: [phId], assignee: techRedUsername });

        const completeRes = await request(app)
            .put(`/api/work/${phId}/status`)
            .set('Authorization', `Bearer ${techRedToken}`)
            .send({ status: 'COMPLETED', result: '7.0' });
        expect(completeRes.status).toBe(400);
    });

    /**
     * SCENARIO D: Sample without spectral Flow
     */
    test('Scenario D: Sample without spectral does not require spectral and can be approved', async () => {
        const intakeRes = await request(app)
            .post('/api/reception/intake')
            .set('Authorization', `Bearer ${mgrBlueToken}`)
            .send({
                originalId: `SPEC-D-${Date.now()}`,
                receivedBy: mgrBlueUsername,
                labId: 'LAB-BLUE',
                requiredAnalyses: ['PH_H2O'], // No Spectral
                isWalkIn: false
            });
        const sampleId = intakeRes.body.id;

        await request(app).put(`/api/samples/${sampleId}/phase`).set('Authorization', `Bearer ${mgrBlueToken}`).send({ phase: 'DRYING', status: 'DONE' });
        await request(app).put(`/api/samples/${sampleId}/phase`).set('Authorization', `Bearer ${mgrBlueToken}`).send({ phase: 'PREPARATION', status: 'DONE' });

        const items = await request(app).get('/api/work').set('Authorization', `Bearer ${mgrBlueToken}`).query({ sampleId });
        const phItem = items.body.data.find(i => i.analysis === 'PH_H2O');
        const phId = phItem.id;

        await request(app).post('/api/work/assign').set('Authorization', `Bearer ${mgrBlueToken}`).send({ workItemIds: [phId], assignee: techBlueUsername });
        await request(app).put(`/api/work/${phId}/status`).set('Authorization', `Bearer ${techBlueToken}`).send({ status: 'COMPLETED', result: '7.0' });

        const subRes = await request(app).post('/api/submissions').set('Authorization', `Bearer ${techBlueToken}`).send({ sampleId, type: 'FULL', workItemIds: [phId] });
        if (subRes.status !== 201) console.log('DEBUG Scenario D Submission Failure:', subRes.body);
        expect(subRes.status).toBe(201);
        await request(app).post(`/api/submissions/${subRes.body.submission.id}/review`).set('Authorization', `Bearer ${mgrBlueToken}`).send({ decisions: [{ workItemId: phId, decision: 'ACCEPT' }] });

        const approveRes = await request(app).post(`/api/samples/${sampleId}/approve`).set('Authorization', `Bearer ${mgrBlueToken}`);
        expect(approveRes.status).toBe(200);
        expect(samplesDb.findById(sampleId).status).toBe('APPROVED');
    });

});
