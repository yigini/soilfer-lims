const request = require('supertest');
const app = require('../../app');
const prisma = require('../../prisma');
const { samplesDb, workItemsDb, usersDb } = require('../../db');

describe('Scenario H: Scientific Validation', () => {
    let techToken;
    let sampleId;
    let workItemId;
    let originalValidation;

    beforeAll(async () => {
        originalValidation = (await prisma.analysis.findUnique({ where: { code: 'PH_H2O' } })).validation;
        await prisma.analysis.update({ where: { code: 'PH_H2O' }, data: { validation: JSON.stringify({ type: 'numeric', min: 2, max: 14 }) } });
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
            assignedLab: 'LAB-VAL',
            assignedTo: techUser.username,
            status: 'IN_PROGRESS',
            history: []
        });
        workItemId = wi.id;
    });

    afterAll(async () => {
        await prisma.analysis.update({ where: { code: 'PH_H2O' }, data: { validation: originalValidation } });
    });

    it('should BLOCK invalid numeric > 14 for pH', async () => {
        const res = await request(app)
            .post('/api/workbench/batch-save')
            .set('Authorization', `Bearer ${techToken}`)
            .send({
                draft: false,
                entries: [{ workItemId, value: 15.5 }]
            });

        expect(res.status).toBe(422);
        expect(res.body.errors[0].error).toMatch(/ABOVE_MAX/);
        expect(await prisma.result.count({ where: { sampleId } })).toBe(0);
    });

    it('should BLOCK invalid numeric < 2 for pH', async () => {
        const res = await request(app)
            .post('/api/workbench/batch-save')
            .set('Authorization', `Bearer ${techToken}`)
            .send({
                draft: false,
                entries: [{ workItemId, value: 1.5 }]
            });

        expect(res.status).toBe(422);
        expect(res.body.errors[0].error).toMatch(/BELOW_MIN/);
        expect(await prisma.result.count({ where: { sampleId } })).toBe(0);
    });

    it('should BLOCK non-numeric values for numeric method', async () => {
        const res = await request(app)
            .post('/api/workbench/batch-save')
            .set('Authorization', `Bearer ${techToken}`)
            .send({
                draft: false,
                entries: [{ workItemId, value: "pH is good" }]
            });

        expect(res.status).toBe(422);
        expect(res.body.errors[0].error).toMatch(/numeric|number|format/i);
        expect(await prisma.result.count({ where: { sampleId } })).toBe(0);
    });

    it('should ACCEPT valid result within range', async () => {
        const res = await request(app)
            .post('/api/workbench/batch-save')
            .set('Authorization', `Bearer ${techToken}`)
            .send({
                draft: false,
                entries: [{ workItemId, value: 7.2 }]
            });

        expect(res.status).toBe(200);
        expect((await prisma.workItem.findUnique({ where: { id: workItemId } })).status).toBe('COMPLETED');
        expect((await prisma.result.findFirst({ where: { sampleId, param: 'PH_H2O', isCurrent: true } })).numericValue).toBe(7.2);
    });
});
