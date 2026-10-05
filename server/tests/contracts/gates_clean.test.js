const { ensureTestLab } = require('../setup');
const request = require('supertest');
const app = require('../../app');
const { getAuthToken } = require('../setup');
const prisma = require('../../prisma');
const jwt = require('jsonwebtoken');
const { transitionWorkItem } = require('../../services/workItemStateService');

describe('8.1 Section B: Gate Enforcement (Clean Flow)', () => {
    let managerToken;
    let techToken;
    let sampleId;
    let workItems = {};

    beforeAll(async () => {
        await ensureTestLab('LAB-GTM', 'GTM');
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
            .send({ analyses: ['PH_H2O'], checklist: { items: Object.fromEntries(['container', 'label', 'quantity', 'condition', 'coc'].map(key => [key, { status: 'PASS' }])) } });

        expect(acceptRes.status).toBe(200);

        // Use body directly
        const items = acceptRes.body.workItems;
        items.forEach(i => workItems[i.analysis] = i.id);

        expect(workItems['PH_H2O']).toBeDefined();
        expect(workItems['PREPARATION']).toBeDefined();

        const phItem = workItems['PH_H2O'];
        const prepItem = workItems['PREPARATION'];
        const manager = await prisma.user.findUnique({ where: { username: jwt.decode(managerToken).username } });
        for (const item of items) {
            await transitionWorkItem(item.id, 'ASSIGNED', manager, null,
                { assignedTo: manager.username, assignedBy: manager.username, assignedLab: manager.labId });
        }

        // 2. Prep work item status update blocked because Drying is PENDING?
        // Wait, "Preparation blocked if Drying not DONE" is the logic.
        // Try updating PREPARATION work item to IN_PROGRESS
        const prepRes = await request(app)
            .put(`/api/work/${prepItem}/status`)
            .set('Authorization', `Bearer ${managerToken}`) // Manager can update any
            .send({ status: 'IN_PROGRESS' });

        expect(prepRes.status).toBe(409);
        expect(prepRes.body.code).toBe('DRYING_PREREQUISITE_BLOCKED');
        expect(prepRes.body.error).toMatch(/DRYING must be completed/i);

        // 3. Complete Drying (via Phase API)
        await request(app)
            .put(`/api/samples/${sampleId}/phase`)
            .set('Authorization', `Bearer ${managerToken}`)
            .send({ phase: 'DRYING', status: 'DONE', checklist: [true, true, true] });

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
        expect(anaRes.status).toBe(412);
        expect(anaRes.body.error).toMatch(/Sample preparation has not been completed/i);

        // 6. Complete Prep (via Phase API)
        // Must mark Prep as DONE.
        // Wait, phase API updates sample.preparationStatus.
        // Updating workItem status to COMPLETED doesn't strictly update sample phase to DONE unless automated?
        // sampleController.updatePhaseStatus updates sample.preparationStatus.
        // Let's use Phase API to close the Gate.

        await request(app)
            .put(`/api/samples/${sampleId}/phase`)
            .set('Authorization', `Bearer ${managerToken}`)
            .send({ phase: 'PREPARATION', status: 'DONE', checklist: [true, true, true] });

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
