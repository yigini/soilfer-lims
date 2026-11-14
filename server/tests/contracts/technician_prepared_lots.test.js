jest.mock('dotenv', () => ({ config: () => ({ parsed: {} }) }));

const request = require('supertest');
const { randomUUID } = require('crypto');
const jwt = require('jsonwebtoken');
const prisma = require('../../prisma');
const app = require('../../app');
const { JWT_SECRET } = require('../../config/auth');
const { registry } = require('../../config/policyRegistry');

const prefix = `I427-B-${randomUUID().slice(0, 8)}`;
const labA = `${prefix}-A`, labB = `${prefix}-B`;
const users = {}, tokens = {}, items = {};
const auth = (method, route, who = 'tech') => request(app)[method](route).set('Authorization', `Bearer ${tokens[who]}`);
const lotBody = (inventoryItemId, extra = {}) => ({ inventoryItemId, lotNumber: `P-${randomUUID()}`, quantity: 4, ...extra });

async function makeUser(name, role, labId) {
    users[name] = await prisma.user.create({ data: { id: `${prefix}-${name}`, username: `${prefix}-${name}`,
        email: `${prefix}-${name}@example.test`, name: `Practice ${name}`, role, labId,
        password: 'unused-synthetic-fixture', isActive: true, countries: '[]', projects: '[]' } });
    const user = users[name];
    tokens[name] = jwt.sign({ id: user.id, username: user.username, role, labId, countries: [], projects: [] }, JWT_SECRET, { expiresIn: '1h' });
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
    for (const type of ['REAGENT', 'STANDARD', 'CHEMICAL', 'CONSUMABLE', 'CRM', 'CONTAINER', 'OTHER']) {
        items[type] = await prisma.inventoryItem.create({ data: { id: `${prefix}-${type}`, labId: labA,
            itemType: type, name: `Practice ${type}`, unitOfMeasure: 'mL' } });
    }
    items.foreign = await prisma.inventoryItem.create({ data: { id: `${prefix}-foreign`, labId: labB,
        itemType: 'REAGENT', name: 'Other practice laboratory reagent', unitOfMeasure: 'mL' } });
});
beforeEach(async () => { await preset('BASIC'); });
afterAll(async () => { await prisma.$disconnect(); });

describe('Technician prepared inventory lots', () => {
    test.each(['REAGENT', 'STANDARD'])('%s preparation forces the authenticated preparer', async type => {
        const r = await auth('post', '/api/inventory/lots').send(lotBody(items[type].id, { preparedBy: users.manager.username }));
        expect(r.status).toBe(201);
        expect(r.body).toMatchObject({ labId: labA, preparedBy: users.tech.username, status: 'AVAILABLE', coaAttachment: null });
        const rows = await prisma.auditLog.findMany({ where: { entityId: r.body.id } });
        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({ action: 'LOT_PREPARED', performedBy: users.tech.username });
        expect(JSON.parse(rows[0].details).parentLotIds).toEqual([]);
    });
    test.each(['CHEMICAL', 'CONSUMABLE', 'CRM', 'CONTAINER', 'OTHER'])('%s preparation is refused', async type => {
        const r = await auth('post', '/api/inventory/lots').send(lotBody(items[type].id));
        expect(r.status).toBe(403); expect(r.body.code).toBe('LOT_ITEM_TYPE_NOT_ALLOWED');
    });
    test('another laboratory item stays out of scope', async () => {
        const r = await auth('post', '/api/inventory/lots').send(lotBody(items.foreign.id));
        expect(r.status).toBe(403);
    });
    test('technicians cannot attach a certificate', async () => {
        const r = await auth('post', '/api/inventory/lots').send(lotBody(items.REAGENT.id, { coaAttachment: { filename: 'practice.pdf' } }));
        expect(r.status).toBe(403); expect(r.body.code).toBe('LOT_ATTACHMENT_NOT_ALLOWED');
    });
    test('same-lab parents are validated and retained in traceability and audit JSON', async () => {
        const parent = await auth('post', '/api/inventory/lots', 'manager').send(lotBody(items.REAGENT.id));
        expect(parent.status).toBe(201);
        const r = await auth('post', '/api/inventory/lots').send(lotBody(items.STANDARD.id, { parentLotIds: [parent.body.id, parent.body.id], traceabilityNotes: 'Synthetic dilution preparation' }));
        expect(r.status).toBe(201);
        expect(r.body.traceabilityNotes).toContain('Synthetic dilution preparation');
        expect(r.body.traceabilityNotes).toContain(parent.body.lotNumber);
        expect(r.body.traceabilityNotes).toContain(parent.body.id);
        const row = await prisma.auditLog.findFirst({ where: { entityId: r.body.id, action: 'LOT_PREPARED' } });
        expect(JSON.parse(row.details).parentLotIds).toEqual([parent.body.id]);
        expect((await prisma.inventoryLot.findUnique({ where: { id: parent.body.id } })).currentQuantity).toBe(4);
    });
    test.each(['missing', 'foreign', 'malformed'])('%s parents refuse the entire lot creation', async kind => {
        let ids = ['no-such-practice-lot'];
        if (kind === 'foreign') {
            const parent = await prisma.inventoryLot.create({ data: { id: randomUUID(), inventoryItemId: items.foreign.id, labId: labB,
                lotNumber: randomUUID(), initialQuantity: 5, currentQuantity: 5, unitOfMeasure: 'mL' } });
            ids = [parent.id];
        }
        if (kind === 'malformed') ids = 'not-an-array';
        const body = lotBody(items.REAGENT.id, { parentLotIds: ids });
        const r = await auth('post', '/api/inventory/lots').send(body);
        expect(r.status).toBe(400); expect(r.body.code).toBe('PARENT_LOT_INVALID');
        expect(await prisma.inventoryLot.count({ where: { lotNumber: body.lotNumber } })).toBe(0);
    });
    test('strict policy quarantines preparation and unchanged consume refuses until manager release', async () => {
        await preset('ISO17025_STRICT');
        const r = await auth('post', '/api/inventory/lots').send(lotBody(items.REAGENT.id, { status: 'AVAILABLE', labId: labB, preparedBy: 'forged-preparer' }));
        expect(r.status).toBe(201); expect(r.body.status).toBe('QUARANTINED');
        expect(r.body).toMatchObject({ labId: labA, preparedBy: users.tech.username });
        const received = await prisma.inventoryTransaction.findFirst({ where: { inventoryLotId: r.body.id, actionType: 'RECEIVE' } });
        expect(received.reasonCode).toBe('TECHNICIAN_PREPARATION_QUARANTINED');
        const refused = await auth('post', `/api/inventory/lots/${r.body.id}/consume`).send({ quantity: 1 });
        expect(refused.status).toBe(409); expect(refused.body.code).toBe('LOT_QUARANTINED');
        expect((await prisma.inventoryLot.findUnique({ where: { id: r.body.id } })).currentQuantity).toBe(4);
        expect((await auth('post', `/api/inventory/lots/${r.body.id}/release`, 'reviewer').send({ reason: 'Checked preparation' })).status).toBe(200);
        const consumed = await auth('post', `/api/inventory/lots/${r.body.id}/consume`).send({ quantity: 1 });
        expect(consumed.status).toBe(200); expect(consumed.body.currentQuantity).toBe(3);
    });
    test.each(['post:/api/inventory/items', 'put:/api/inventory/items/fixture', 'post:/api/inventory/lots/fixture/adjust',
        'post:/api/inventory/lots/fixture/transfer', 'post:/api/inventory/lots/fixture/dispose',
        'post:/api/inventory/lots/fixture/quarantine', 'post:/api/inventory/lots/fixture/release'])('management route %s stays refused', async route => {
        const split = route.indexOf(':');
        expect((await auth(route.slice(0, split), route.slice(split + 1)).send({})).status).toBe(403);
    });
    test.each(['manager', 'national'])('%s keeps existing receipt behavior, even under strict policy', async who => {
        await preset('ISO17025_STRICT');
        const r = await auth('post', '/api/inventory/lots', who).send(lotBody(items.OTHER.id, {
            preparedBy: 'Practice external preparer', coaAttachment: { filename: 'synthetic-certificate.pdf' } }));
        expect(r.status).toBe(201);
        expect(r.body).toMatchObject({ preparedBy: 'Practice external preparer', status: 'AVAILABLE' });
        expect(JSON.parse(r.body.coaAttachment).filename).toBe('synthetic-certificate.pdf');
        const row = await prisma.auditLog.findFirst({ where: { entityId: r.body.id } });
        expect(row.action).toBe('LOT_RECEIVED'); expect(row.performedBy).toBe(users[who].username);
        expect(row.details).toContain('Received');
    });
    test('new policies are laboratory-only with strict on and Basic/Advisory off', () => {
        for (const key of ['inventory.technicianLotsStartQuarantined']) {
            expect(registry[key].scope).toBe('LAB');
            expect(registry[key].presets).toEqual({ ISO17025_STRICT: true, BASIC: false, ADVISORY: false });
        }
    });
    test.each(['BASIC', 'ADVISORY'])('%s allows immediate use of technician-prepared lots', async code => {
        await preset(code);
        const r = await auth('post', '/api/inventory/lots').send(lotBody(items.STANDARD.id));
        expect(r.status).toBe(201); expect(r.body.status).toBe('AVAILABLE');
        const consumed = await auth('post', `/api/inventory/lots/${r.body.id}/consume`).send({ quantity: 1 });
        expect(consumed.status).toBe(200); expect(consumed.body.currentQuantity).toBe(3);
    });
    test.each([{ label: 'null', value: null }, { label: 'object', value: {} }, { label: 'null member', value: [null] }, { label: 'number member', value: [3] }, { label: 'empty id', value: [''] }, { label: 'whitespace id', value: ['  '] }])('invalid parent shape $label returns400 without creating a lot', async ({ value: parentLotIds }) => {
        const body = lotBody(items.REAGENT.id, { parentLotIds });
        const r = await auth('post', '/api/inventory/lots').send(body);
        expect(r.status).toBe(400); expect(r.body.code).toBe('PARENT_LOT_INVALID');
        expect(await prisma.inventoryLot.count({ where: { lotNumber: body.lotNumber } })).toBe(0);
    });
    test.each([null, {}, 'certificate'])('a certificate field %# is refused for technicians', async coaAttachment => {
        const r = await auth('post', '/api/inventory/lots').send(lotBody(items.REAGENT.id, { coaAttachment }));
        expect(r.status).toBe(403); expect(r.body.code).toBe('LOT_ATTACHMENT_NOT_ALLOWED');
    });
    test('view-only and anonymous callers cannot prepare lots', async () => {
        const body = lotBody(items.REAGENT.id);
        expect((await auth('post', '/api/inventory/lots', 'viewer').send(body)).status).toBe(403);
        expect((await request(app).post('/api/inventory/lots').send(body)).status).toBe(401);
        expect(await prisma.inventoryLot.count({ where: { lotNumber: body.lotNumber } })).toBe(0);
    });
    test('a global manager retains receipt authority in another lab', async () => {
        const r = await auth('post', '/api/inventory/lots', 'super').send(lotBody(items.foreign.id, { preparedBy: 'External practice preparer' }));
        expect(r.status).toBe(201);
        expect(r.body).toMatchObject({ labId: labB, status: 'AVAILABLE', preparedBy: 'External practice preparer' });
        const row = await prisma.auditLog.findFirst({ where: { entityId: r.body.id } });
        expect(row).toMatchObject({ action: 'LOT_RECEIVED', performedBy: users.super.username });
    });

});
