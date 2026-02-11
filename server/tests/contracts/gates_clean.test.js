const request = require('supertest');
const app = require('../../app');
const { getAuthToken } = require('../setup');

describe('8.1 Section B: Gate Enforcement (Clean Flow)', () => {
    let managerToken;
    let techToken;
    let sampleId;
    let workItems = {};

    beforeAll(async () => {
        managerToken = await getAuthToken('LAB_MANAGER');
        techToken = await getAuthToken('LAB_TECHNICIAN');
    });

    test('Progressive Gate Unlocking', async () => {
        // 1. Create & Accept
        const createRes = await request(app)
            .post('/api/samples/walkin')
            .set('Authorization', `Bearer ${managerToken}`)
            .send({
                submitter: 'Tester',
                description: 'Gate Logic Sample',
                analyses: ['PH_H2O']
            });
        expect(createRes.status).toBe(201);
        sampleId = createRes.body.sample.id;

        const acceptRes = await request(app)
            .post(`/api/samples/${sampleId}/accept`)
            .set('Authorization', `Bearer ${managerToken}`)
            .send({ analyses: ['PH_H2O'] });

        expect(acceptRes.status).toBe(200);

        // Use body directly
        const items = acceptRes.body.workItems;
        items.forEach(i => workItems[i.analysis] = i.id);

        expect(workItems['PH_H2O']).toBeDefined();
        expect(workItems['PREPARATION']).toBeDefined();

        const phItem = workItems['PH_H2O'];
        const prepItem = workItems['PREPARATION'];

        // 2. Prep work item status update blocked because Drying is PENDING?
        // Wait, "Preparation blocked if Drying not DONE" is the logic.
        // Try updating PREPARATION work item to IN_PROGRESS
        const prepRes = await request(app)
            .put(`/api/work/${prepItem}/status`)
            .set('Authorization', `Bearer ${managerToken}`) // Manager can update any
            .send({ status: 'IN_PROGRESS' });

        expect(prepRes.status).toBe(400); // Drying not DONE
        expect(prepRes.body.error).toMatch(/Drying not completed/);

        // 3. Complete Drying (via Phase API)
        await request(app)
            .put(`/api/samples/${sampleId}/phase`)
            .set('Authorization', `Bearer ${managerToken}`)
            .send({ phase: 'DRYING', status: 'DONE' });

        // 4. Now Prep update to IN_PROGRESS should be allowed
        const prepAllowed = await request(app)
            .put(`/api/work/${prepItem}/status`)
            .set('Authorization', `Bearer ${managerToken}`)
            .send({ status: 'IN_PROGRESS' });
        expect(prepAllowed.status).toBe(200);

        // 5. Analysis still blocked (Prep is IN_PROGRESS, not DONE)
        const anaRes = await request(app)
            .put(`/api/work/${phItem}/status`)
            .set('Authorization', `Bearer ${managerToken}`)
            .send({ status: 'IN_PROGRESS' });
        expect(anaRes.status).toBe(400);
        expect(anaRes.body.error).toMatch(/Drying\/Preparation not completed/);

        // 6. Complete Prep (via Phase API)
        // Must mark Prep as DONE.
        // Wait, phase API updates sample.preparationStatus.
        // Updating workItem status to COMPLETED doesn't strictly update sample phase to DONE unless automated?
        // sampleController.updatePhaseStatus updates sample.preparationStatus.
        // Let's use Phase API to close the Gate.

        await request(app)
            .put(`/api/samples/${sampleId}/phase`)
            .set('Authorization', `Bearer ${managerToken}`)
            .send({ phase: 'PREPARATION', status: 'DONE' });

        // 7. Analysis Allowed
        // We need sample status to be PROCESSING? 
        // Or updated by logic?
        // updatePhaseStatus lines 381-386: if Drying=DONE & Prep=DONE & Status=ACCEPTED -> PROCESSING.
        // So yes, it should auto-transition.

        const anaAllowed = await request(app)
            .put(`/api/work/${phItem}/status`)
            .set('Authorization', `Bearer ${managerToken}`)
            .send({ status: 'IN_PROGRESS' });

        expect(anaAllowed.status).toBe(200);
    });
});
