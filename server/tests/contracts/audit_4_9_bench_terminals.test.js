const { randomUUID } = require('node:crypto');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const app = require('../../app');
const prisma = require('../../prisma');
const policyService = require('../../services/policyService');
const draftService = require('../../services/draftService');
const { createSampleFixture, createWorkItemFixture, createAuthTokenFixture } = require('../helpers/workflowFixtures');

const labId = `BENCH-LAB-${randomUUID()}`;
let manager, managerToken, analyst, analystToken;
beforeAll(async () => {
    await prisma.lab.create({ data: { id: labId, code: labId, name: 'Bench terminal laboratory', country: 'GTM' } });
    managerToken = await createAuthTokenFixture(prisma, 'LAB_MANAGER', labId); manager = jwt.decode(managerToken);
    analystToken = await createAuthTokenFixture(prisma, 'LAB_TECHNICIAN', labId); analyst = jwt.decode(analystToken);
});
const as = token => ({ get: url => request(app).get(url).set('Authorization', `Bearer ${token}`),
    put: (url, body) => request(app).put(url).set('Authorization', `Bearer ${token}`).send(body),
    post: (url, body) => request(app).post(url).set('Authorization', `Bearer ${token}`).send(body) });

test('bench settings come from the lab policy registry and report whether a PIN exists', async () => {
    const response = await as(analystToken).get('/api/auth/bench');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ idleLockMinutes: await policyService.get(labId, 'bench.idleLockMinutes'),
        pinAtRecord: await policyService.get(labId, 'bench.pinAtRecord'), pinSet: false });
});

test('a bench PIN needs the password, is stored only as a hash, and locks after repeated wrong entries', async () => {
    const client = as(managerToken);
    expect((await client.post('/api/auth/bench/pin/verify', { pin: '2468' })).body.code).toBe('BENCH_PIN_NOT_SET');
    expect((await client.put('/api/auth/bench/pin', { password: 'password', pin: '12' })).body.code).toBe('BENCH_PIN_FORMAT_INVALID');
    const wrongPassword = await client.put('/api/auth/bench/pin', { password: 'not-it', pin: '2468' });
    expect(wrongPassword.status).toBe(403); expect(wrongPassword.body.code).toBe('BENCH_PIN_PASSWORD_INVALID');
    expect(await prisma.userBenchCredential.findUnique({ where: { userId: manager.id } })).toBeNull();

    expect((await client.put('/api/auth/bench/pin', { password: 'password', pin: '2468' })).body).toEqual({ pinSet: true });
    const stored = await prisma.userBenchCredential.findUnique({ where: { userId: manager.id } });
    expect(stored.pinHash).not.toContain('2468');
    expect(await prisma.auditLog.count({ where: { entityId: manager.id, action: 'BENCH_PIN_SET' } })).toBe(1);
    expect((await client.get('/api/auth/bench')).body.pinSet).toBe(true);
    expect((await client.post('/api/auth/bench/pin/verify', { pin: '2468' })).body).toEqual({ verified: true });

    for (let attempt = 1; attempt < 5; attempt++) {
        const wrong = await client.post('/api/auth/bench/pin/verify', { pin: '0000' });
        expect(wrong.status).toBe(403); expect(wrong.body.code).toBe('BENCH_PIN_INVALID');
    }
    const locked = await client.post('/api/auth/bench/pin/verify', { pin: '0000' });
    expect(locked.status).toBe(423); expect(locked.body.code).toBe('BENCH_PIN_LOCKED');
    const stillLocked = await client.post('/api/auth/bench/pin/verify', { pin: '2468' });
    expect(stillLocked.status).toBe(423); expect(stillLocked.body.code).toBe('BENCH_PIN_LOCKED');
    // Another analyst's PIN state is unaffected.
    expect((await as(analystToken).post('/api/auth/bench/pin/verify', { pin: '2468' })).body.code).toBe('BENCH_PIN_NOT_SET');
});

test('an active session refreshes in place to a token for the same analyst', async () => {
    const response = await as(analystToken).post('/api/auth/refresh');
    expect(response.status).toBe(200);
    expect(jwt.decode(response.body.token)).toMatchObject({ id: analyst.id, username: analyst.username, role: analyst.role });
    expect((await as(response.body.token).get('/api/auth/bench')).status).toBe(200);
    expect((await request(app).post('/api/auth/refresh')).status).toBe(401);
});

test('a handed-over work item keeps one draft that the new assignee sees and then owns', async () => {
    const sampleId = randomUUID();
    await createSampleFixture(prisma, { data: { id: sampleId, originalId: sampleId, assignedLab: labId, status: 'ACCEPTED',
        requiredAnalyses: JSON.stringify(['SOC']), dryingStatus: 'PENDING', preparationStatus: 'PENDING' } });
    const item = await createWorkItemFixture(prisma, { data: { id: randomUUID(), sampleId, analysis: 'SOC', status: 'ASSIGNED',
        assignedLab: labId, assignedTo: manager.username, assignedBy: manager.username, assignedAt: new Date(), history: '[]' } });
    await prisma.workItemDraft.create({ data: { id: randomUUID(), workItemId: item.id, sampleId, analysis: 'SOC', labId,
        userId: manager.username, value: '1.25' } });
    const analystUser = { ...analyst, labId, isActive: true };
    expect((await draftService.getDrafts(analystUser)).map(draft => draft.workItemId)).not.toContain(item.id);

    await require('../../services/workItemStateService').transitionWorkItem(item.id, 'ASSIGNED', { ...manager, labId },
        'Bench handover', { assignedTo: analyst.username });
    const visible = (await draftService.getDrafts(analystUser)).find(draft => draft.workItemId === item.id);
    expect(visible).toMatchObject({ value: '1.25', userId: manager.username });
    // The previous analyst keeps sight of the draft they saved.
    expect((await draftService.getDrafts({ ...manager, labId, isActive: true })).some(draft => draft.workItemId === item.id)).toBe(true);
});
