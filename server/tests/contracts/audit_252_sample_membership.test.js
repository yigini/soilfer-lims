const request = require('supertest');
const jwt = require('jsonwebtoken');
const { randomUUID } = require('node:crypto');
const app = require('../../app');
const prisma = require('../../prisma');
const { getAuthToken } = require('../setup');
const { createStoredProfileRunFixture } = require('../helpers/storedProfileRunFixture');

let token, actor;
beforeAll(async () => {
    token = await getAuthToken('LAB_MANAGER', `QC252-${randomUUID()}`, ['GTM'], ['QC252']);
    actor = await prisma.user.findUnique({ where: { id: jwt.decode(token).id } });
});
async function evidence() {
    const tables = ['batch','batchAnalyte','batchPosition','batchPositionWorkItem',
        'batchPositionReference','qcMeasurement','qcEvaluation','batchEvent','auditLog'];
    return Promise.all(tables.map(table => prisma[table].findMany({ orderBy: { id: 'asc' } })));
}

test.each([undefined, [], null, 'not-an-array', [''], ['repeated','repeated']])(
    'new run without distinct membership refuses with a stable 400 and zero writes: %s', async workItemIds => {
        const before = await evidence();
        const body = { analysis: 'PH_H2O', ...(workItemIds !== undefined && { workItemIds }) };
        const response = await request(app).post('/api/qc/batches').set('Authorization', `Bearer ${token}`).send(body);
        expect(response.status).toBe(400); expect(response.body.code).toBe('QC_WORK_ITEMS_REQUIRED');
        expect(await evidence()).toEqual(before);
    });

test('a stored PROFILE_ONLY run cannot rebuild into native under its existing ID and retains every row', async () => {
    // Preexisting stored data under pin6062398663, never created by the retired route.
    const stored = await createStoredProfileRunFixture(prisma, { actor,
        input: { analysis: 'PH_H2O', profile: 'RACK_40', notes: 'Retained stored run' } });
    const before = await evidence();
    const response = await request(app).post(`/api/qc/batches/${stored.id}/rebuild`)
        .set('Authorization', `Bearer ${token}`).send({ workItemIds: ['explicit-selection'] });
    expect(response.status).toBe(409); expect(response.body.code).toBe('QC_RUN_PROFILE_ONLY_STORED');
    expect(await evidence()).toEqual(before);
    expect((await prisma.batchAnalyte.findMany({ where: { batchId: stored.id } })).every(row=>row.provenance==='PROFILE_ONLY')).toBe(true);
});

test('refused new no-membership run cannot receive QC and leaves no run or evidence behind', async () => {
    const id = `QC252-NO-MEMBERS-${randomUUID()}`, before = await evidence();
    const created = await request(app).post('/api/qc/batches').set('Authorization', `Bearer ${token}`)
        .send({ id, analysis: 'PH_H2O' });
    expect(created.status).toBe(400); expect(created.body.code).toBe('QC_WORK_ITEMS_REQUIRED');
    const evaluated = await request(app).post(`/api/qc/batches/${id}/evaluate`).set('Authorization', `Bearer ${token}`)
        .send({ blanks: [{ value: 0 }], controls: [{ expected: 7, measured: 7 }], duplicates: [{ value1: 7, value2: 7 }] });
    expect(evaluated.status).toBe(404); expect(evaluated.body.code).toBe('BATCH_NOT_FOUND');
    expect(await evidence()).toEqual(before);
});

test('stored PROFILE_ONLY QC entry remains usable without relabeling the original run', async () => {
    // The original compatibility success values, held as preexisting data.
    const stored = await createStoredProfileRunFixture(prisma, { actor,
        input: { analysis: 'PH_H2O', profile: 'RACK_40' } });
    const original = await prisma.batch.findUnique({ where: { id: stored.id } });
    const analyte = await prisma.batchAnalyte.findFirst({ where: { batchId: stored.id } });
    const response = await request(app).post(`/api/qc/batches/${stored.id}/evaluate`)
        .set('Authorization', `Bearer ${token}`).send({
            blanks: [{ id: 'B2', value: 0.01, maxAllowed: 0.05 }],
            duplicates: ['D2','D3'].map(id=>({id,value1:6.8,value2:6.9,maxRpd:10.0})),
            controls: [{ id: 'C2', expected: 7.0, measured: 6.95, minRecovery: 90, maxRecovery: 110 }]
        });
    expect(response.status).toBe(200); expect(response.body.status).toBe('QC_PASS');
    expect(response.body.evaluation.summary.failed).toBe(0);
    const retained = await prisma.batch.findUnique({ where: { id: stored.id } });
    for (const key of ['id','labId','analysis','createdAt','createdBy','profile','qcResults','workItemIds','history','disposition'])
        expect(retained[key]).toEqual(original[key]);
    expect(await prisma.batchAnalyte.findUnique({ where: { id: analyte.id } })).toMatchObject({
        id:analyte.id,batchId:stored.id,provenance:'PROFILE_ONLY',methodResolution:analyte.methodResolution});
});
