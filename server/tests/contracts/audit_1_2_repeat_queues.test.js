const request = require('supertest');
const jwt = require('jsonwebtoken');
const { randomUUID } = require('node:crypto');
const app = require('../../app');
const prisma = require('../../prisma');
const { getAuthToken, ensureTestLab } = require('../setup');
const { createSampleFixture, createWorkItemFixture } = require('../helpers/workflowFixtures');
const { createLegacyClosureDatabase, useLegacyRouteDatabase } = require('../helpers/legacyWorkflowDatabase');

const labId = 'LAB-REPEAT-READS-179', analysis = 'REPEAT_QUEUE_179';
let token, actor, database, canonical, legacyId;
beforeAll(async () => {
    await ensureTestLab(labId, 'TEST');
    token = await getAuthToken('LAB_TECHNICIAN', labId); actor = jwt.decode(token);
    await prisma.analysis.create({ data: { code: analysis, name: 'Repeat queue method', units: 'mg/kg', prerequisites: '[]' } });
    const sampleId = randomUUID(), otherSampleId = randomUUID(), otherTechSampleId = randomUUID(), otherLabItemId = randomUUID(), otherTechItemId = randomUUID(); legacyId = randomUUID();
    const now = Date.now();
    database = await createLegacyClosureDatabase({ analysis: 'ARCHIVING', labId,
        samples: [sampleId, otherSampleId, otherTechSampleId].map(id => ({ id, originalId: id, status: 'PROCESSING',
            assignedLab: id === otherSampleId ? 'OTHER-LAB' : labId, receptionDate: now, dryingStatus: 'DONE', preparationStatus: 'DONE',
            createdAt: now, updatedAt: now })),
        workItems: [
            { id: legacyId, sampleId, analysis, assignedLab: labId,
                status: 'REANALYSIS_REQUIRED', reanalysisReason: 'Historical repeat reason', createdAt: now, updatedAt: now },
            { id: otherLabItemId, sampleId: otherSampleId, analysis, assignedLab: 'OTHER-LAB',
                status: 'REANALYSIS_REQUIRED', createdAt: now, updatedAt: now },
            { id: otherTechItemId, sampleId: otherTechSampleId, analysis, assignedLab: labId,
                status: 'REANALYSIS_REQUIRED', createdAt: now, updatedAt: now }
        ] });
    for (const username of [actor.username, 'another-technician']) await database.client.user.create({ data: {
        id: randomUUID(), username, email: `${username}@example.test`, password: 'isolated-fixture', role: 'LAB_TECHNICIAN', labId } });
    for (const [id, assignedTo] of [[legacyId, actor.username], [otherLabItemId, actor.username], [otherTechItemId, 'another-technician']]) {
        await database.client.workItem.update({ where: { id }, data: { assignedTo } });
    }
    const sample = await createSampleFixture(database.client, { data: { id: randomUUID(), originalId: randomUUID(), assignedLab: labId,
        status: 'PROCESSING', receptionDate: new Date(), dryingStatus: 'DONE', preparationStatus: 'DONE' } });
    canonical = await createWorkItemFixture(database.client, { data: { id: randomUUID(), sampleId: sample.id, analysis, assignedLab: labId,
        assignedTo: actor.username, status: 'REPEAT_REQUIRED', reanalysisReason: 'Current repeat reason' } });
});
afterEach(() => jest.restoreAllMocks());
afterAll(async () => { if (database) await database.close(); });
async function snapshot() {
    return { samples: await database.client.sample.findMany({ orderBy: { id: 'asc' } }),
        items: await database.client.workItem.findMany({ orderBy: { id: 'asc' } }),
        audits: await database.client.auditLog.findMany({ orderBy: { id: 'asc' } }) };
}
const get = path => request(app).get(path).set('Authorization', `Bearer ${token}`);

test('my-work queue and counts include both repeat names, enforce assignment/lab scope and never change stored lifecycle', async () => {
    const before = await snapshot(); useLegacyRouteDatabase(prisma, database.client);
    const response = await get('/api/workbench/queue');
    expect(response.status).toBe(200);
    const items = response.body.groups.flatMap(group => group.items);
    expect(items.map(item => item.id).sort()).toEqual([canonical.id, legacyId].sort());
    expect(items.find(item => item.id === canonical.id).status).toBe('REPEAT_REQUIRED');
    expect(items.find(item => item.id === legacyId).status).toBe('REANALYSIS_REQUIRED');
    expect(response.body.stats).toMatchObject({ totalReanalysis: 2, totalItems: 2, myWorkCount: 2 });
    expect(await snapshot()).toEqual(before);
});

test('dashboard repeat metric and queue count canonical and historical work once each and preserve all stored rows', async () => {
    const before = await snapshot(); useLegacyRouteDatabase(prisma, database.client);
    const home = await get('/api/dashboard/home');
    expect(home.status).toBe(200);
    expect(home.body.metrics.find(metric => metric.key === 'bench.returned').value).toBe(2);
    const queue = await get('/api/dashboard/queues/bench.returned');
    expect(queue.status).toBe(200); expect(queue.body.total).toBe(2);
    expect(queue.body.rows.map(row => row.key).sort()).toEqual([canonical.id, legacyId].sort());
    expect(queue.body.rows.map(row => row.note).sort()).toEqual(['Current repeat reason', 'Historical repeat reason']);
    expect(await snapshot()).toEqual(before);
});
