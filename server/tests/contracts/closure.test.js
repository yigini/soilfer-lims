const request = require('supertest');
const app = require('../../app');
const { generateToken } = require('../setup');
const { usersDb, workItemsDb, samplesDb } = require('../../db');

describe('8.1 Section E: Approval & Closure Rules', () => {
    let mgrToken;
    let sampleId, workItemId;

    beforeAll(async () => {
        const suffix = Date.now();
        const mgr = usersDb.create({ username: `mgr_clo_${suffix}`, role: 'LAB_MANAGER', labId: 'LAB-CLO', countries: ['CLO'] });
        mgrToken = generateToken(mgr);
    });

    test('Setup: Create Sample and WorkItems', async () => {
        // Create Sample
        const createRes = await request(app)
            .post('/api/samples/walkin')
            .set('Authorization', `Bearer ${mgrToken}`)
            .send({ submitter: 'Close Tester', analyses: ['PH_H2O'], countryCode: 'CLO' });

        expect(createRes.status).toBe(201);
        sampleId = createRes.body.sample.id;

        // Accept
        const acceptRes = await request(app)
            .post(`/api/samples/${sampleId}/accept`)
            .set('Authorization', `Bearer ${mgrToken}`)
            .send({ analyses: ['PH_H2O'] });

        workItemId = acceptRes.body.workItems[0].id;

        // Complete Gates with procedural checklist
        await request(app).put(`/api/samples/${sampleId}/phase`).set('Authorization', `Bearer ${mgrToken}`).send({ phase: 'DRYING', status: 'DONE', checklist: [true, true, true] });
        await request(app).put(`/api/samples/${sampleId}/phase`).set('Authorization', `Bearer ${mgrToken}`).send({ phase: 'PREPARATION', status: 'DONE', checklist: [true, true, true] });
    });

    test('Scenario 1: Approve Blocked on Pending/Submitted Work', async () => {
        const res = await request(app)
            .post(`/api/samples/${sampleId}/approve`)
            .set('Authorization', `Bearer ${mgrToken}`);

        expect(res.status).toBe(409);
        expect(res.body.error).toMatch(/Work items pending/);
        expect(res.body.blockers).toBeDefined();
    });

    test('Scenario 2: Approve Success after All Items Accepted', async () => {
        // Force WorkItem to ACCEPTED (simulating review)
        // Force WorkItem to ACCEPTED (simulating review)
        const allItems = workItemsDb.getAll().filter(w => String(w.sampleId) === String(sampleId));

        allItems.forEach(w => {
            workItemsDb.update(w.id, { status: 'ACCEPTED' });
        });

        const res = await request(app)
            .post(`/api/samples/${sampleId}/approve`)
            .set('Authorization', `Bearer ${mgrToken}`);

        expect(res.status).toBe(200);
        expect(res.body.status).toBe('APPROVED');
    });

    test('Scenario 3: Archive Blocked Logic (Pre-check)', async () => {
        const createRes = await request(app)
            .post('/api/samples/walkin')
            .set('Authorization', `Bearer ${mgrToken}`)
            .send({ submitter: 'New One', analyses: ['PH_H2O'], countryCode: 'CLO' });
        const newId = createRes.body.sample.id;

        const res = await request(app)
            .post(`/api/samples/${newId}/archive`)
            .set('Authorization', `Bearer ${mgrToken}`)
            .send({ archiveLocation: 'Box 1' });

        expect(res.status).toBe(409);
    });

    test('Scenario 4: Archive Success (Task Created and Approved to ARCHIVED)', async () => {
        const res = await request(app)
            .post(`/api/samples/${sampleId}/archive`)
            .set('Authorization', `Bearer ${mgrToken}`)
            .send({ archiveLocation: 'Shelf A', notes: 'Done' });

        expect(res.status).toBe(200);
        expect(res.body.message).toMatch(/Archiving task created/i);

        // Accepting the ARCHIVING work item completes the transition to ARCHIVED
        const archItem = (await request(app).get('/api/work').set('Authorization', `Bearer ${mgrToken}`).query({ sampleId })).body.data.find(i => i.analysis === 'ARCHIVING');
        expect(archItem).toBeDefined();
        await request(app).post(`/api/work/${archItem.id}/review`).set('Authorization', `Bearer ${mgrToken}`).send({ decision: 'ACCEPT' });

        const finalSample = samplesDb.findById(sampleId);
        expect(finalSample.status).toBe('ARCHIVED');
        expect(finalSample.archiveLocation).toBe('Shelf A');
    });

    test('Scenario 5: Immutability (Cannot revert Archived)', async () => {
        const res = await request(app)
            .put(`/api/samples/${sampleId}/status`)
            .set('Authorization', `Bearer ${mgrToken}`)
            .send({ status: 'PROCESSING' });

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/Invalid transition/);
    });
});
