const request = require('supertest');
const app = require('../../app');
const { samplesDb, workItemsDb, usersDb } = require('../../db');

describe('Scenario H: Scientific Validation', () => {
    let techToken;
    let sampleId;
    let workItemId;

    beforeAll(async () => {
        // 1. Setup Tech User
        const uniqueSuffix = Date.now();
        const techUser = {
            id: `tech_val_${uniqueSuffix}`,
            username: `tech_val_${uniqueSuffix}`,
            password: 'password',
            role: 'LAB_TECHNICIAN',
            labId: 'LAB-VAL',
            countries: ['VAL']
        };
        usersDb.create(techUser);

        const loginRes = await request(app)
            .post('/api/auth/login')
            .send({ username: techUser.username, password: 'password' });
        techToken = loginRes.body.token;

        // 2. Create Sample & WorkItem directly (shortcut for unit test)
        const sample = samplesDb.create({
            labId: 'LAB-VAL-001',
            assignedLab: 'LAB-VAL',
            status: 'PROCESSING',
            dryingStatus: 'DONE',
            preparationStatus: 'DONE'
        });
        sampleId = sample.id;

        const wi = workItemsDb.create({
            id: `WI-VAL-${uniqueSuffix}`,
            sampleId: sample.id,
            analysis: 'PH_H2O',
            assignedTo: techUser.username,
            status: 'IN_PROGRESS',
            history: []
        });
        workItemId = wi.id;
    });

    it('should BLOCK invalid numeric > 14 for pH', async () => {
        const res = await request(app)
            .put(`/api/work/${workItemId}/status`)
            .set('Authorization', `Bearer ${techToken}`)
            .send({
                status: 'COMPLETED',
                result: 15.5
            });

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/above maximum 14/);
    });

    it('should BLOCK invalid numeric < 2 for pH', async () => {
        const res = await request(app)
            .put(`/api/work/${workItemId}/status`)
            .set('Authorization', `Bearer ${techToken}`)
            .send({
                status: 'COMPLETED',
                result: 1.5
            });

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/below minimum 2/);
    });

    it('should BLOCK non-numeric values for numeric method', async () => {
        const res = await request(app)
            .put(`/api/work/${workItemId}/status`)
            .set('Authorization', `Bearer ${techToken}`)
            .send({
                status: 'COMPLETED',
                result: "pH is good"
            });

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/must be a number/);
    });

    it('should ACCEPT valid result within range', async () => {
        const res = await request(app)
            .put(`/api/work/${workItemId}/status`)
            .set('Authorization', `Bearer ${techToken}`)
            .send({
                status: 'COMPLETED',
                result: 7.2
            });

        expect(res.status).toBe(200);
        expect(res.body.updates.status).toBe('COMPLETED');
        expect(res.body.updates.result).toBe(7.2);
    });
});
