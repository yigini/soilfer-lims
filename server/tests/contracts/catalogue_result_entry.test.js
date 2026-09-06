const crypto = require('crypto');
const request = require('supertest');
const prisma = require('../../prisma');
const app = require('../../app');
const { getAuthToken } = require('../setup');
const controller = require('../../controllers/resultsController');
const validation = require('../../controllers/validationController');
const id = crypto.randomUUID().slice(0, 8);
const sampleId = `CAT_RESULT_${id}`, param = `CAT_RESULT_PARAM_${id}`, labId = `CAT_LAB_${id}`;
const user = { username: `cat_tech_${id}`, role: 'LAB_TECHNICIAN', labId };
let workItem, method;
async function save(measurements, actor = user) {
    const res = { code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
    await controller.saveResults({ params: { sampleId }, body: { measurements }, user: actor }, res);
    return res;
}
describe('Catalogue rules also govern the sample results endpoint', () => {
    beforeAll(async () => {
        await prisma.user.create({ data: { id: `CAT_USER_${id}`, username: user.username, email: `${user.username}@example.test`, password: 'test-only', role: user.role, labId } });
        await prisma.analysis.create({ data: { code: param, name: 'Configured result test', units: 'mg/kg', status: 'active', validation: JSON.stringify({ min: 1, max: 10 }) } });
        method = await prisma.methodology.create({ data: { analysisCode: param, name: 'Assigned laboratory procedure', labId } });
        await prisma.sample.create({ data: { id: sampleId, originalId: sampleId, labId: `S_${id}`, assignedLab: labId, status: 'PROCESSING', dryingStatus: 'DONE', preparationStatus: 'DONE', requiredAnalyses: JSON.stringify([param]) } });
        workItem = await prisma.workItem.create({ data: { id: `CAT_WI_${id}`, sampleId, analysis: param, labId, assignedLab: labId, assignedTo: user.username, status: 'IN_PROGRESS', methodologyId: method.id } });
    });
    test.each(['DRYING', 'PREPARATION', 'SPEC_MIR', 'SPEC_VIS_NIR'])('%s cannot accept a scalar through the alternate endpoint', async code => {
        expect((await save([{ param: code, value: '5' }])).code).toBe(400);
        expect(await prisma.result.count({ where: { sampleId } })).toBe(0);
    });
    test('An unknown parameter cannot be smuggled into an otherwise valid batch', async () => {
        const response = await save([{ param, value: '5', methodologyId: method.id }, { param: 'CAT_UNKNOWN', value: '5' }]);
        expect(response.code).toBe(400);
        expect(await prisma.result.count({ where: { sampleId } })).toBe(0);
    });
    test('A technician cannot record another technician’s work', async () => {
        expect((await save([{ param, value: '5', methodologyId: method.id }], { ...user, username: 'someone_else' })).code).toBe(400);
    });
    test('Assigned method and reporting units must match', async () => {
        expect((await save([{ param, value: '5' }])).code).toBe(400);
        expect((await save([{ param, value: '5', methodologyId: method.id, unit: 'pH' }])).code).toBe(400);
    });
    test('Configured lower bounds are honored when the optional LOQ is null', async () => {
        expect((await validation.validateResult(param, '0.5', method.id)).flags).toContain('BELOW_MIN');
    });
    test('Duplicate replicate keys cannot create two current results', async () => {
        const m = { param, value: '5', methodologyId: method.id };
        expect((await save([m, m])).code).toBe(400);
    });
    test('Valid assigned measurement is saved and still uses a human parameter name', async () => {
        const response = await save([{ param, value: '5', methodologyId: method.id, unit: 'mg/kg' }]);
        expect(response.code).toBe(200);
        expect(await prisma.result.count({ where: { sampleId, isCurrent: true } })).toBe(1);
        const res = { status() { return this; }, json(body) { this.body = body; } };
        await controller.getResults({ params: { sampleId }, user }, res);
        expect(res.body[0].paramName).toBe('Configured result test');
    });
    test('Completed or submitted work cannot be edited through the sample results endpoint', async () => {
        for (const status of ['COMPLETED', 'SUBMITTED', 'ACCEPTED']) {
            await prisma.workItem.update({ where: { id: workItem.id }, data: { status } });
            expect((await save([{ param, value: '6', methodologyId: method.id }])).code).toBe(400);
        }
        expect((await prisma.result.findFirst({ where: { sampleId, isCurrent: true } })).value).toBe('5');
    });
    test('The mounted configuration route rejects technician writes', async () => {
        const token = await getAuthToken('LAB_TECHNICIAN', labId);
        const response = await request(app).post('/api/config/analyses').set('Authorization', `Bearer ${token}`).send({ code: `NO_${id}`, name: 'Not authorized' });
        expect(response.status).toBe(403);
    });
});
