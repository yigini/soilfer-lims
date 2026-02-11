const request = require('supertest');
const app = require('../../app');
const { getAuthToken } = require('../setup');

describe('8.1 Section A: Status Contract Enforcement', () => {
    let managerToken;
    let sampleId;

    beforeAll(async () => {
        managerToken = await getAuthToken('LAB_MANAGER');
    });

    test('Should reject sample creation attempt to override status', async () => {
        // Walkin creation hardcodes status to RECEIVED. 
        // We verify that passing an invalid status doesn't break it, AND doesnt set it.
        const res = await request(app)
            .post('/api/samples/walkin')
            .set('Authorization', `Bearer ${managerToken}`)
            .send({
                submitter: 'Tester',
                description: 'Test Status Override',
                status: 'INVALID_STATUS'
            });

        if (res.status === 201) {
            expect(res.body.sample.status).toBe('RECEIVED');
            expect(res.body.sample.status).not.toBe('INVALID_STATUS');
        } else {
            // If validation is very strict it might reject
            expect(res.status).toBe(400); // Accepted fail state if API evolves to reject extra props
        }
    });

    test('Should reject updates to unknown status', async () => {
        // Create valid sample first
        const createRes = await request(app)
            .post('/api/samples/walkin')
            .set('Authorization', `Bearer ${managerToken}`)
            .send({
                submitter: 'Status Tester',
                description: 'Valid Sample'
            });

        expect(createRes.status).toBe(201);
        sampleId = createRes.body.sample.id;

        // Use correct status update route
        const res = await request(app)
            .put(`/api/samples/${sampleId}/status`)
            .set('Authorization', `Bearer ${managerToken}`)
            .send({ status: 'SUPER_DONE' });

        expect(res.status).toBe(400);
    });

    test('Should reject preparationStatus=FAILED', async () => {
        expect(sampleId).toBeDefined();

        const res = await request(app)
            .put(`/api/samples/${sampleId}/phase`)
            .set('Authorization', `Bearer ${managerToken}`)
            .send({ phase: 'PREPARATION', status: 'FAILED' }); // specific 'phase' param required by controller

        expect(res.status).toBe(400);
        // Optional: verify error message contains "preparationStatus=FAILED is not allowed"
        if (res.body.error) {
            expect(res.body.error).toMatch(/FAILED/);
        }
    });
});
