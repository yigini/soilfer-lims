const request = require('supertest');
const jwt = require('jsonwebtoken');
const { randomUUID } = require('node:crypto');
const app = require('../../app');
const prisma = require('../../prisma');
const { getAuthToken } = require('../setup');
const { createSampleFixture, createWorkItemFixture } = require('../helpers/workflowFixtures');
const labId = 'LAB-LEGACY-RESULTS-179', analysis = 'PH_LEGACY_RESULT_179';
let token, actor;
beforeAll(async () => {
    token = await getAuthToken('LAB_TECHNICIAN', labId);
    actor = jwt.decode(token);
    await prisma.analysis.create({ data: { code: analysis, name: 'Legacy result test pH', units: 'pH',
        prerequisites: '[]', validation: '{"min":0,"max":14}' } });
});
afterEach(() => jest.restoreAllMocks());
async function fixture(status = 'PROCESSING', flags = {}) {
    const sample = await createSampleFixture(prisma, { data: { id: randomUUID(), originalId: randomUUID(), assignedLab: labId,
        status, receptionDate: new Date(), requiredAnalyses: JSON.stringify([analysis]), dryingStatus: 'DONE', preparationStatus: 'DONE', ...flags } });
    const item = await createWorkItemFixture(prisma, { data: { id: randomUUID(), sampleId: sample.id, assignedLab: labId,
        assignedTo: actor.username, analysis, status: 'IN_PROGRESS' } });
    const result = await prisma.result.create({ data: { id: randomUUID(), sampleId: sample.id, param: analysis, value: '6.2',
        numericValue: 6.2, unit: 'pH', isCurrent: true, isValid: true, flags: '["ORIGINAL_NOTE"]' } });
    return { sample, item, result };
}
const save = row => request(app).post(`/api/results/${row.sample.id}`).set('Authorization', `Bearer ${token}`)
    .send({ measurements: [{ param: analysis, value: '7.2', unit: 'pH' }] });
async function snapshot(row) {
    return { sample: await prisma.sample.findUnique({ where: { id: row.sample.id } }),
        items: await prisma.workItem.findMany({ where: { sampleId: row.sample.id }, orderBy: { id: 'asc' } }),
        results: await prisma.result.findMany({ where: { sampleId: row.sample.id }, orderBy: { id: 'asc' } }),
        audits: await prisma.auditLog.findMany({ where: { OR: [{ sampleId: row.sample.id }, { entityId: row.sample.id }] }, orderBy: { id: 'asc' } }),
        submissions: await prisma.submission.findMany({ where: { sampleId: row.sample.id }, orderBy: { id: 'asc' } }) };
}

test.each(['PROCESSING', 'SUBMITTED_PARTIAL'])('saving results keeps %s lifecycle and every WorkItem unchanged', async status => {
    const row = await fixture(status), before = await snapshot(row);
    expect((await save(row)).status).toBe(200);
    const after = await snapshot(row);
    expect(after.sample).toEqual(before.sample);
    expect(after.items).toEqual(before.items);
    expect(after.submissions).toEqual(before.submissions);
    expect(after.results).toHaveLength(2);
    const previous = after.results.find(result => result.id === row.result.id);
    expect(previous).toMatchObject({ value: '6.2', numericValue: 6.2, flags: '["ORIGINAL_NOTE"]', isCurrent: false });
    expect(after.results.find(result => result.isCurrent)).toMatchObject({ value: '7.2', enteredBy: actor.username });
    const audit = after.audits.find(audit => audit.action === 'UPDATE_RESULTS');
    expect(JSON.parse(audit.after)).toEqual({ gateEvidence: 'LEGACY_SAMPLE_FLAG', legacyGates: ['DRYING', 'PREPARATION'] });
});

test.each(['scope', 'gate', 'audit'])('a %s refusal inside the result-save transaction writes nothing', async kind => {
    const row = await fixture(), before = await snapshot(row), transaction = prisma.$transaction.bind(prisma);
    jest.spyOn(prisma, '$transaction').mockImplementationOnce(callback => transaction(async tx => {
        if (kind === 'scope') await tx.sample.update({ where: { id: row.sample.id }, data: { assignedLab: 'OTHER-LAB' } });
        if (kind === 'gate') await tx.sample.update({ where: { id: row.sample.id }, data: { preparationStatus: 'PENDING' } });
        if (kind === 'audit') return callback({ ...tx, auditLog: { ...tx.auditLog, create: async () => { throw new Error('Injected result audit failure'); } } });
        return callback(tx);
    }));
    const response = await save(row);
    expect(response.status).toBe({ scope: 403, gate: 412, audit: 500 }[kind]);
    expect(await snapshot(row)).toEqual(before);
});

test.each([
    [{ preparationStatus: 'PENDING' }, 'Sample preparation has not been completed'],
    [{ dryingStatus: 'PENDING' }, 'Sample drying has not been completed']
])('missing preparation evidence retains HTTP 412 and its existing message', async (flags, message) => {
    const row = await fixture('PROCESSING', flags), before = await snapshot(row);
    const response = await save(row);
    expect(response.status).toBe(412); expect(response.body.error).toBe(message);
    expect(await snapshot(row)).toEqual(before);
});

test('a present gate WorkItem overrides a saved DONE flag and refuses inconsistent evidence', async () => {
    const row = await fixture();
    await createWorkItemFixture(prisma, { data: { id: randomUUID(), sampleId: row.sample.id, analysis: 'DRYING',
        assignedLab: labId, status: 'NOT_ASSIGNED' } });
    const before = await snapshot(row), response = await save(row);
    expect(response.status).toBe(409); expect(response.body.code).toBe('GATE_STATE_MISMATCH');
    expect(await snapshot(row)).toEqual(before);
});

test.each(['APPROVED', 'ARCHIVED', 'DISPOSED'])('final %s result edits require an amendment and write nothing', async status => {
    const row = await fixture(status), before = await snapshot(row), response = await save(row);
    expect(response.status).toBe(409); expect(response.body.code).toBe('AMENDMENT_WORKFLOW_REQUIRED');
    expect(await snapshot(row)).toEqual(before);
});
