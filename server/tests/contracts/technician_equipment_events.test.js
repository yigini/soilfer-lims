jest.mock('dotenv', () => ({ config: () => ({ parsed: {} }) }));

const request = require('supertest');
const { randomUUID } = require('crypto');
const jwt = require('jsonwebtoken');
const prisma = require('../../prisma');
const app = require('../../app');
const { JWT_SECRET } = require('../../config/auth');
const { registry } = require('../../config/policyRegistry');
const eventTypes = require('../../../shared/technicianEquipmentEventTypes.json');

const prefix = `I427-A-${randomUUID().slice(0, 8)}`;
const labA = `${prefix}-A`, labB = `${prefix}-B`;
const users = {}, tokens = {};
const auth = (method, route, who = 'tech') => request(app)[method](route).set('Authorization', `Bearer ${tokens[who]}`);
const atDay = days => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
const eventBody = (equipmentId, extra = {}) => ({ equipmentId, eventType: 'CALIBRATION_PERFORMED',
    summary: `Synthetic calibration ${randomUUID()}`, performedDate: atDay(-1), nextDueDate: atDay(365), ...extra });

async function makeUser(name, role, labId) {
    users[name] = await prisma.user.create({ data: { id: `${prefix}-${name}`, username: `${prefix}-${name}`,
        email: `${prefix}-${name}@example.test`, name: `Practice ${name}`, role, labId,
        password: 'unused-synthetic-fixture', isActive: true, countries: '[]', projects: '[]' } });
    const user = users[name];
    tokens[name] = jwt.sign({ id: user.id, username: user.username, role, labId, countries: [], projects: [] }, JWT_SECRET, { expiresIn: '1h' });
}
async function makeAsset(labId = labA) {
    const id = `${prefix}-equipment-${randomUUID()}`;
    await prisma.equipmentAsset.create({ data: { id, labId, assetType: 'PH_METER', name: 'Practice meter',
        status: 'IN_SERVICE', criticality: 'CRITICAL' } });
    await prisma.equipmentScheduleRule.create({ data: { id: randomUUID(), equipmentId: id, labId,
        scheduleType: 'CALIBRATION', frequencyDays: 365, dueSoonDays: 30, active: true } });
    return id;
}
async function preset(code) {
    const current = await prisma.labPolicy.findUnique({ where: { labId: labA } });
    const r = await auth('patch', `/api/labs/${labA}/policies`, 'manager').send({ presetCode: code,
        expectedVersion: current?.version || 0, reason: 'Synthetic workflow contract setup' });
    expect(r.status).toBe(200);
}

beforeAll(async () => {
    for (const id of [labA, labB]) await prisma.lab.create({ data: { id, code: id, name: `Practice ${id}`, country: 'GTM', isActive: true } });
    await makeUser('manager', 'LAB_MANAGER', labA);
    await makeUser('super', 'SUPER_ADMIN', null);
    await makeUser('reviewer', 'LAB_MANAGER', labA);
    await makeUser('tech', 'LAB_TECHNICIAN', labA);
    await makeUser('national', 'MASTER_USER', labA);
    await makeUser('viewer', 'VIEWER', labA);

});
beforeEach(async () => { await preset('BASIC'); });
afterAll(async () => { await prisma.$disconnect(); });

describe('Technician equipment event workflow', () => {
    test.each(eventTypes)('%s records the authenticated actor and one event audit', async type => {
        const id = await makeAsset();
        const r = await auth('post', '/api/equipment/events').send(eventBody(id, { eventType: type,
            outcome: type.endsWith('_FAILED') ? 'FAIL' : 'PASS', userId: users.manager.username,
            performedBy: users.manager.username }));
        expect(r.status).toBe(200);
        expect(r.body.userId).toBe(users.tech.username);
        expect(r.body.eventType).toBe(type);
        expect(r.body.requiresManagerSignoff).toBe(type.endsWith('_FAILED'));
        const rows = await prisma.auditLog.findMany({ where: { entity: 'EQUIPMENT_EVENT', entityId: r.body.id } });
        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({ performedBy: users.tech.username, action: 'EQUIPMENT_EVENT_LOGGED', labId: labA });
    });
    test.each(['STATUS_CHANGE', 'DECOMMISSION', 'DOWNTIME_START', 'DOWNTIME_END', 'REGISTER', 'EDIT', 'INCIDENT', 'CALIBRATION', 'MAINTENANCE'])('%s is refused without management authority', async type => {
        const id = await makeAsset();
        const r = await auth('post', '/api/equipment/events').send(eventBody(id, { eventType: type }));
        expect(r.status).toBe(403);
        expect(r.body.code).toBe('EQUIPMENT_EVENT_TYPE_NOT_ALLOWED');
        expect(await prisma.equipmentEvent.count({ where: { equipmentId: id } })).toBe(0);
    });
    test('another laboratory asset remains out of scope', async () => {
        const id = await makeAsset(labB);
        expect((await auth('post', '/api/equipment/events').send(eventBody(id))).status).toBe(403);
        expect(await prisma.equipmentEvent.count({ where: { equipmentId: id } })).toBe(0);
    });
    test('strict policy waits for another manager and records both actors', async () => {
        await preset('ISO17025_STRICT');
        const id = await makeAsset();
        const event = await auth('post', '/api/equipment/events').send(eventBody(id));
        expect(event.status).toBe(200);
        expect(event.body.requiresManagerSignoff).toBe(true);
        expect((await auth('get', `/api/equipment/${id}`)).body.readiness).not.toBe('READY');
        const approved = await auth('patch', `/api/equipment/events/${event.body.id}/disposition`, 'reviewer').send({ decision: 'APPROVED', reason: 'Checked practice evidence' });
        expect(approved.status).toBe(200);
        expect(approved.body.requiresManagerSignoff).toBe(false);
        expect((await auth('get', `/api/equipment/${id}`)).body.readiness).toBe('READY');
        const rows = await prisma.auditLog.findMany({ where: { entity: 'EQUIPMENT_EVENT', entityId: event.body.id }, orderBy: { timestamp: 'asc' } });
        expect(rows).toHaveLength(2);
        expect(rows.map(row => row.performedBy)).toEqual([users.tech.username, users.reviewer.username]);
        expect(JSON.parse(rows[1].details).decision).toBe('APPROVED');
    });
    test('a newer pending calibration must not retain a previous Ready qualification', async () => {
        const id = await makeAsset();
        const old = await auth('post', '/api/equipment/events', 'manager').send(eventBody(id, { performedDate: atDay(-2) }));
        expect(old.status).toBe(200);
        expect((await auth('get', `/api/equipment/${id}`)).body.readiness).toBe('READY');
        await preset('ISO17025_STRICT');
        const pending = await auth('post', '/api/equipment/events').send(eventBody(id));
        expect(pending.status).toBe(200);
        expect(pending.body.requiresManagerSignoff).toBe(true);
        expect((await auth('get', `/api/equipment/${id}`)).body.readiness).not.toBe('READY');
    });
    test('Basic policy permits immediate passing calibration; failures always await review', async () => {
        const id = await makeAsset();
        const pass = await auth('post', '/api/equipment/events').send(eventBody(id));
        expect(pass.status).toBe(200);
        expect(pass.body.requiresManagerSignoff).toBe(false);
        expect((await auth('get', `/api/equipment/${id}`)).body.readiness).toBe('READY');
        const failed = await auth('post', '/api/equipment/events').send(eventBody(id, { eventType: 'CALIBRATION_FAILED', outcome: 'FAIL', performedDate: atDay(0) }));
        expect(failed.body.requiresManagerSignoff).toBe(true);
        expect((await auth('get', `/api/equipment/${id}`)).body.readiness).toBe('BLOCKED');
    });
    test('a manager cannot sign their own failed event', async () => {
        const id = await makeAsset();
        const event = await auth('post', '/api/equipment/events', 'manager').send(eventBody(id, { eventType: 'CALIBRATION', outcome: 'FAIL' }));
        expect(event.status).toBe(200);
        const r = await auth('patch', `/api/equipment/events/${event.body.id}/disposition`, 'manager').send({ decision: 'APPROVED' });
        expect(r.status).toBe(409);
        expect(r.body.code).toBe('EQUIPMENT_SIGNOFF_SELF');
        expect((await prisma.equipmentEvent.findUnique({ where: { id: event.body.id } })).requiresManagerSignoff).toBe(true);
        expect(await prisma.auditLog.count({ where: { entityId: event.body.id, action: 'EQUIPMENT_EVENT_DISPOSITION' } })).toBe(0);
    });
    test('technicians cannot disposition an event', async () => {
        const id = await makeAsset();
        const event = await auth('post', '/api/equipment/events', 'manager').send(eventBody(id, { outcome: 'FAIL' }));
        expect((await auth('patch', `/api/equipment/events/${event.body.id}/disposition`).send({ decision: 'APPROVED' })).status).toBe(403);
    });
    test.each(['post:/api/equipment', 'put:/api/equipment/fixture', 'patch:/api/equipment/fixture/status', 'post:/api/equipment/eligibility'])('management route %s stays refused', async route => {
        const split = route.indexOf(':');
        expect((await auth(route.slice(0, split), route.slice(split + 1)).send({})).status).toBe(403);
    });
    test('managers keep other event types and duplicate submissions create no extra audit', async () => {
        const id = await makeAsset(), body = eventBody(id, { eventType: 'INCIDENT' });
        const first = await auth('post', '/api/equipment/events', 'manager').send(body);
        const repeated = await auth('post', '/api/equipment/events', 'manager').send(body);
        expect(first.status).toBe(200); expect(repeated.status).toBe(200);
        expect(first.body.id).toBe(repeated.body.id);
        expect(await prisma.auditLog.count({ where: { entity: 'EQUIPMENT_EVENT', entityId: first.body.id } })).toBe(1);
    });
    test.each(['viewer', 'national'])('%s cannot log equipment events', async who => {
        const id = await makeAsset();
        expect((await auth('post', '/api/equipment/events', who).send(eventBody(id))).status).toBe(403);
        expect(await prisma.equipmentEvent.count({ where: { equipmentId: id } })).toBe(0);
    });
    test('a technician cannot change the existing schedule through asset editing', async () => {
        const id = await makeAsset();
        const r = await auth('put', `/api/equipment/${id}`).send({ name: 'Unapproved edit', scheduleRules: [{ scheduleType: 'CALIBRATION', frequencyDays: 1 }] });
        expect(r.status).toBe(403);
        const rules = await prisma.equipmentScheduleRule.findMany({ where: { equipmentId: id } });
        expect(rules.map(rule => rule.frequencyDays)).toEqual([365]);
        expect((await prisma.equipmentAsset.findUnique({ where: { id } })).name).toBe('Practice meter');
    });
    test('a global manager retains event authority in another laboratory', async () => {
        const id = await makeAsset(labB);
        const r = await auth('post', '/api/equipment/events', 'super').send(eventBody(id, { eventType: 'INCIDENT' }));
        expect(r.status).toBe(200);
        expect(r.body).toMatchObject({ equipmentId: id, labId: labB, userId: users.super.username });
    });
    test('the equipment sign-off policy is laboratory-only with strict on and Basic/Advisory off', () => {
        expect(registry['equipment.technicianEventsRequireSignoff']).toMatchObject({ scope: 'LAB',
            presets: { ISO17025_STRICT: true, BASIC: false, ADVISORY: false } });
    });

});
