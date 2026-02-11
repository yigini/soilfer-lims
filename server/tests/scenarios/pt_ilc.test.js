const request = require('supertest');
const app = require('../../app');
const { usersDb } = require('../../db');

describe('Scenario F: PT/ILC Support', () => {
    let rxToken, mgrToken;

    beforeAll(async () => {
        const suffix = Date.now();
        usersDb.create({ username: `rx_pt_${suffix}`, password: 'p', role: 'SAMPLE_RECEPTION', labId: 'LAB-PT', countries: ['PT'] });
        usersDb.create({ username: `mgr_pt_${suffix}`, password: 'p', role: 'LAB_MANAGER', labId: 'LAB-PT', countries: ['PT'] });

        const rxLog = await request(app).post('/api/auth/login').send({ username: `rx_pt_${suffix}`, password: 'p' });
        rxToken = rxLog.body.token;
        const mgrLog = await request(app).post('/api/auth/login').send({ username: `mgr_pt_${suffix}`, password: 'p' });
        mgrToken = mgrLog.body.token;
    });

    it('should create a PT sample with Correct Metadata', async () => {
        const res = await request(app)
            .post('/api/samples/walkin')
            .set('Authorization', `Bearer ${rxToken}`)
            .send({
                submitter: 'Global Soil Lab NET',
                sampleType: 'PT',
                ptRound: 'GLOSOLAN-2026-01',
                analyses: ['PH_H2O', 'EC'],
                expectedValues: { PH_H2O: 7.0, EC: 150 }
            });

        expect(res.status).toBe(201);
        expect(res.body.sample.sampleType).toBe('PT');
        expect(res.body.sample.originalId).toMatch(/PT-GLOSOLAN-2026-01/);
        expect(res.body.sample.expectedValues.PH_H2O).toBe(7.0);
    });

    it('should validate missing PT Round', async () => {
        const res = await request(app)
            .post('/api/samples/walkin')
            .set('Authorization', `Bearer ${rxToken}`)
            .send({
                submitter: 'Bad Submitter',
                sampleType: 'PT',
                // Missing ptRound
                analyses: ['PH_H2O']
            });

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/ptRound is required/);
    });
});
