jest.mock('dotenv', () => ({ config: () => ({ parsed: {} }) }));
const request = require('supertest');
const { randomUUID, createHash } = require('node:crypto');
const fs = require('node:fs'), path = require('node:path');
const jwt = require('jsonwebtoken');
const prisma = require('../../prisma');
const app = require('../../app');
const { JWT_SECRET } = require('../../config/auth');
const writes = require('../../services/inventoryWriteService');
let labA, labB, users, tokens;
const auth = (mode, body, who = 'manager') => request(app).post('/api/inventory/import/' + mode).set('Authorization', 'Bearer ' + tokens[who]).send(body);
function workbook() {
    return { fileName: 'practice-stock.xlsx', duplicateMode: 'SKIP', atomic: true, sheets: {
        locations: Array.from({ length: 6 }, (_, i) => ({ rowNumber: i + 2, name: 'Shelf ' + i, purpose: 'REAGENT', locationType: 'SHELF' })),
        items: Array.from({ length: 18 }, (_, i) => ({ rowNumber: i + 2, shortCode: 'ITEM-' + i, name: 'Practice item ' + i, itemType: 'REAGENT', unitOfMeasure: 'mL', defaultLocationName: 'Shelf ' + i % 6 })),
        lots: Array.from({ length: 18 }, (_, i) => ({ rowNumber: i + 2, itemShortCode: 'ITEM-' + i, lotNumber: 'LOT-' + i, quantity: '10.5', expiryDate: '2030-12-31' }))
    } };
}
async function counts() {
    const where = { labId: labA };
    return { locations: await prisma.inventoryLocation.count({ where }), items: await prisma.inventoryItem.count({ where }), lots: await prisma.inventoryLot.count({ where }),
        receipts: await prisma.inventoryTransaction.count({ where: { ...where, actionType: 'RECEIVE' } }), audits: await prisma.auditLog.count({ where }) };
}
beforeEach(async () => {
    const prefix = 'I429-' + randomUUID().slice(0, 8); labA = prefix + '-A'; labB = prefix + '-B'; users = {}; tokens = {};
    for (const id of [labA, labB]) await prisma.lab.create({ data: { id, code: id, name: 'Practice lab', country: 'GTM', isActive: true } });
    for (const [name, role] of [['manager','LAB_MANAGER'],['super','SUPER_ADMIN'],['tech','LAB_TECHNICIAN'],['viewer','VIEWER']]) {
        const labId = name === 'super' ? null : labA;
        users[name] = await prisma.user.create({ data: { id: prefix + '-' + name, username: prefix + '-' + name, email: prefix + '-' + name + '@example.test', name: 'Practice ' + name,
            role, labId, password: 'unused-synthetic-fixture', isActive: true, countries: '[]', projects: '[]' } });
        tokens[name] = jwt.sign({ id: users[name].id, username: users[name].username, role, labId, countries: [], projects: [] }, JWT_SECRET, { expiresIn: '1h' });
    }
});
afterAll(async () => prisma.$disconnect());
test('preview leaves database and WAL bytes unchanged, then commit creates exactly 6/18/18 with normal audits and RECEIVE rows', async () => {
    const body = workbook();
    expect((await auth('preview', body)).status).toBe(200); // Warm the ordinary auth path before measuring the read-only call.
    const databases = await prisma.$queryRawUnsafe('PRAGMA database_list');
    const filename = databases.find(row => row.name === 'main').file;
    expect(path.resolve(filename).startsWith(path.resolve(__dirname, '../.tmp') + path.sep)).toBe(true);
    const hash = suffix => fs.existsSync(filename + suffix) ? createHash('sha256').update(fs.readFileSync(filename + suffix)).digest('hex') : null;
    const before = [hash(''), hash('-wal')];
    const preview = await auth('preview', body); expect(preview.status).toBe(200); expect(preview.body.totals.errors).toBe(0);
    expect([hash(''), hash('-wal')]).toEqual(before); expect(await counts()).toEqual({ locations: 0, items: 0, lots: 0, receipts: 0, audits: 0 });
    const commit = await auth('commit', body); expect(commit.status).toBe(200); expect(commit.body.committed).toBe(true);
    expect(commit.body.totals).toEqual({ created: 42, updated: 0, skipped: 0, errors: 0 });
    expect(await counts()).toEqual({ locations: 6, items: 18, lots: 18, receipts: 18, audits: 43 });
    const summary = await prisma.auditLog.findFirst({ where: { labId: labA, action: 'IMPORT_COMPLETED' } });
    expect(JSON.parse(summary.details)).toMatchObject({ fileName: body.fileName, user: users.manager.username, labId: labA, totals: { created: 42 } });
    const receipt = await prisma.inventoryTransaction.findFirst({ where: { labId: labA } });
    expect(receipt).toMatchObject({ reasonCode: 'STOCK_RECEIPT', userId: users.manager.id, deltaQuantity: 10.5 });
});
test('reimport SKIP creates no records or stock changes and UPDATE changes only descriptive fields', async () => {
    const body = workbook(); expect((await auth('commit', body)).status).toBe(200);
    const before = await counts(); const skip = await auth('commit', body);
    expect(skip.body.totals).toEqual({ created: 0, updated: 0, skipped: 42, errors: 0 });
    const after = await counts(); expect({ ...after, audits: before.audits }).toEqual(before); expect(after.audits).toBe(before.audits + 1);
    body.duplicateMode = 'UPDATE'; body.sheets.items[0] = { ...body.sheets.items[0], name: 'Renamed description', grade: 'ACS', itemType: 'STANDARD', unitOfMeasure: 'g', reorderPoint: '999' };
    body.sheets.locations[0].temperatureRange = '2-8 C';
    body.sheets.lots[0] = { ...body.sheets.lots[0], quantity: '999', expiryDate: '2000-01-01' };
    const itemBefore = await prisma.inventoryItem.findFirst({ where: { labId: labA, shortCode: 'ITEM-0' } });
    const lotBefore = await prisma.inventoryLot.findFirst({ where: { labId: labA, lotNumber: 'LOT-0' } });
    const update = await auth('commit', body); expect(update.status).toBe(200); expect(update.body.totals).toEqual({ created: 0, updated: 24, skipped: 18, errors: 0 });
    const itemAfter = await prisma.inventoryItem.findUnique({ where: { id: itemBefore.id } });
    expect(itemAfter).toMatchObject({ name: 'Renamed description', grade: 'ACS', itemType: itemBefore.itemType, unitOfMeasure: itemBefore.unitOfMeasure, reorderPoint: itemBefore.reorderPoint, defaultLocationId: itemBefore.defaultLocationId });
    expect(await prisma.inventoryLot.findUnique({ where: { id: lotBefore.id } })).toEqual(lotBefore);
});
test.each([true, false])('atomic=%s: invalid parent item and dependent lot fail; valid rows follow the pinned mode', async atomic => {
    const body = workbook(); body.atomic = atomic; body.sheets.items[0].itemType = 'INVALID';
    const preview = await auth('preview', body); expect(preview.status).toBe(200);
    expect(preview.body.sheets.items[0]).toMatchObject({ status: 'ERROR', errors: [{ code: 'IMPORT_INVALID_ENUM', field: 'itemType' }] });
    expect(preview.body.sheets.lots[0].errors).toContainEqual({ code: 'IMPORT_PARENT_FAILED', field: 'itemShortCode' });
    const commit = await auth('commit', body); expect(commit.status).toBe(atomic ? 422 : 200);
    expect(await counts()).toEqual(atomic ? { locations: 0, items: 0, lots: 0, receipts: 0, audits: 0 } : { locations: 6, items: 17, lots: 17, receipts: 17, audits: 41 });
});
test.each([
    ['unknown location', body => { body.sheets.items[0].defaultLocationName = 'not in this lab'; }, 'items', 'IMPORT_UNKNOWN_LOCATION'],
    ['unknown item', body => { body.sheets.lots[0].itemShortCode = 'not in this lab'; }, 'lots', 'IMPORT_UNKNOWN_ITEM'],
    ['invalid location enum', body => { body.sheets.locations[0].locationType = 'INVALID'; }, 'locations', 'IMPORT_INVALID_ENUM'],
    ['invalid purpose', body => { body.sheets.locations[0].purpose = 'INVALID'; }, 'locations', 'IMPORT_INVALID_ENUM'],
    ['invalid quantity', body => { body.sheets.lots[0].quantity = '-1'; }, 'lots', 'IMPORT_INVALID_NUMBER'],
    ['invalid date', body => { body.sheets.lots[0].expiryDate = '2030-02-31'; }, 'lots', 'IMPORT_INVALID_DATE'],
    ['control character', body => { body.sheets.items[0].name = 'invalid\u0000name'; }, 'items', 'IMPORT_CONTROL_CHARACTER'],
    ['object cell', body => { body.sheets.items[0].notes = { value: 'nested' }; }, 'items', 'IMPORT_INVALID_CELL']
])('%s is a stable per-row error with the original sheet row number', async (_name, change, sheet, code) => {
    const body = workbook(); change(body); const response = await auth('preview', body); expect(response.status).toBe(200);
    expect(response.body.sheets[sheet][0].rowNumber).toBe(2); expect(response.body.sheets[sheet][0].status).toBe('ERROR');
    expect(response.body.sheets[sheet][0].errors.some(error => error.code === code)).toBe(true);
    expect((await auth('commit', body)).status).toBe(422); expect((await counts()).items).toBe(0);
});
test.each(['locations', 'items', 'lots'])('duplicates inside the %s sheet mark both rows as errors', async sheet => {
    const body = workbook(); body.sheets[sheet][1] = { ...body.sheets[sheet][0], rowNumber: 19 };
    const response = await auth('preview', body); expect(response.status).toBe(200);
    for (const index of [0, 1]) expect(response.body.sheets[sheet][index].errors.some(error => error.code === 'IMPORT_DUPLICATE_IN_FILE')).toBe(true);
    expect(response.body.sheets[sheet][1].rowNumber).toBe(19);
});
test('all item/location ID references stay inside the selected laboratory', async () => {
    const foreignLocation = await prisma.inventoryLocation.create({ data: { id: randomUUID(), labId: labB, name: 'Foreign shelf', purpose: 'REAGENT', locationType: 'SHELF' } });
    const foreignItem = await prisma.inventoryItem.create({ data: { id: randomUUID(), labId: labB, name: 'Foreign item', shortCode: 'FOREIGN', itemType: 'REAGENT', unitOfMeasure: 'mL' } });
    const body = workbook(); body.sheets.items[0].defaultLocationId = foreignLocation.id; body.sheets.lots[0].inventoryItemId = foreignItem.id;
    const response = await auth('commit', body); expect(response.status).toBe(422); expect(response.body.sheets.items[0].status).toBe('ERROR'); expect(response.body.sheets.lots[0].status).toBe('ERROR');
    expect(await counts()).toEqual({ locations: 0, items: 0, lots: 0, receipts: 0, audits: 0 });
});
test.each(['tech','viewer'])('%s cannot preview or commit imports', async who => {
    for (const mode of ['preview','commit']) expect((await auth(mode, workbook(), who)).status).toBe(403);
});
test('only Super Admin chooses another laboratory and must explicitly choose one', async () => {
    const body = workbook();
    expect((await auth('preview', { ...body, labId: labB })).status).toBe(403);
    const missing = await auth('preview', body, 'super'); expect(missing.status).toBe(400); expect(missing.body.code).toBe('IMPORT_LAB_REQUIRED');
    const allowed = await auth('commit', { ...body, labId: labB }, 'super'); expect(allowed.status).toBe(200); expect(allowed.body.labId).toBe(labB);
    expect((await counts()).items).toBe(0); expect(await prisma.inventoryItem.count({ where: { labId: labB } })).toBe(18);
});
test('unknown columns are ignored and listed; plain trimmed cell text is preserved', async () => {
    const body = workbook(); body.sheets.items[0].name = '  =plain text name  '; body.sheets.items[0].unusedColumn = 'not imported';
    const response = await auth('commit', body); expect(response.status).toBe(200); expect(response.body.ignoredColumns.items).toEqual(['unusedColumn']);
    expect(await prisma.inventoryItem.findFirst({ where: { labId: labA, shortCode: 'ITEM-0' } })).toMatchObject({ name: '=plain text name' });
});
test.each(['preview','commit'])('%s returns 413 IMPORT_TOO_LARGE at the row and body limits', async mode => {
    const body = workbook(); body.sheets.locations = Array.from({ length: 2001 }, (_, i) => ({ name: 'Shelf ' + i }));
    const rows = await auth(mode, body); expect(rows.status).toBe(413); expect(rows.body.code).toBe('IMPORT_TOO_LARGE');
    const bytes = await auth(mode, { ...workbook(), padding: 'x'.repeat(2 * 1024 * 1024) });
    expect(bytes.status).toBe(413); expect(bytes.body.code).toBe('IMPORT_TOO_LARGE');
});
test('commit revalidates changed location state instead of trusting a previous preview', async () => {
    const location = await writes.createLocation(users.manager, { name: 'Existing shelf', purpose: 'REAGENT' });
    const body = { ...workbook(), sheets: { items: [{ name: 'Practice item', itemType: 'REAGENT', unitOfMeasure: 'mL', defaultLocationName: location.name }] } };
    expect((await auth('preview', body)).body.totals.errors).toBe(0);
    await prisma.inventoryLocation.update({ where: { id: location.id }, data: { isActive: false } });
    const response = await auth('commit', body); expect(response.status).toBe(422); expect(response.body.sheets.items[0].errors).toContainEqual({ code: 'CUSTODY_LOCATION_INVALID', field: 'defaultLocationName' });
    expect(await prisma.inventoryItem.count({ where: { labId: labA } })).toBe(0);
});
test('unexpected shared-service failure rolls back the complete transaction and its audits', async () => {
    const failure = jest.spyOn(writes, 'createLot').mockRejectedValueOnce(new Error('Synthetic import fault'));
    try { const response = await auth('commit', workbook()); expect(response.status).toBe(500);
        expect(await counts()).toEqual({ locations: 0, items: 0, lots: 0, receipts: 0, audits: 0 }); }
    finally { failure.mockRestore(); }
});
test('the shared lot writer preserves an existing transaction client even when it exposes $transaction', async () => {
    const item = await writes.createItem(users.manager, { name: 'Transaction item', itemType: 'REAGENT', unitOfMeasure: 'mL' });
    const nested = jest.fn(() => { throw new Error('Nested transaction must not be used'); });
    await prisma.$transaction(async tx => {
        const client = new Proxy(tx, { get(target, key) { return key === '$transaction' ? nested : Reflect.get(target, key); } });
        await writes.createLot(users.manager, { inventoryItemId: item.id, lotNumber: 'TX-LOT', quantity: 2 }, { db: client });
    });
    expect(nested).not.toHaveBeenCalled(); expect(await prisma.inventoryLot.count({ where: { labId: labA } })).toBe(1);
});

test('CSV exports share the import column names, scope and formula-safe quoting', async () => {
    const body = workbook(); body.sheets.items[0].name = '=sum("x,y")'; body.sheets.items[0].shortCode = '@ITEM-0'; body.sheets.lots[0].itemShortCode = '@ITEM-0';
    expect((await auth('commit', body)).status).toBe(200);
    const { parseDelimited } = require('../../../shared/delimitedText');
    const { inventory: columns } = require('../../../shared/importColumns.json');
    const get = (type, who = 'manager', query = '') => request(app).get('/api/inventory/export/' + type + query).set('Authorization', 'Bearer ' + tokens[who]);
    for (const type of ['locations', 'items', 'lots']) {
        const response = await get(type); expect(response.status).toBe(200);
        const parsed = parseDelimited(response.text, ','); expect(parsed.every(row => !row.error)).toBe(true); expect(parsed[0].cells).toEqual(columns[type]);
        expect(parsed.slice(1).every(row => row.cells[0] === labA)).toBe(true);
        if (type === 'items') {
            expect(parsed[1].cells[columns.items.indexOf('name')]).toBe("'=sum(\"x,y\")");
            expect(parsed[1].cells[columns.items.indexOf('shortCode')]).toBe("'@ITEM-0");
        }
    }
    const stock = await get('stock'); const parsed = parseDelimited(stock.text, ',');
    expect(parsed[0].cells).toContain('itemShortCode'); expect(parsed[0].cells).toContain('quantity'); expect(parsed.every(row => row.cells.length === parsed[0].cells.length)).toBe(true);
    expect((await get('items', 'manager', '?labId=' + labB)).status).toBe(403);
    expect((await get('items', 'super')).status).toBe(400);
    expect((await get('items', 'super', '?labId=' + labB)).status).toBe(200);
});
test.each(['=SUM(A1)', '+cmd', '-1', '@value', "'original", '  =hidden', 'comma, and "quote"'])('CSV cell escaping preserves %s as quoted plain text', value => {
    const { csvCell } = require('../../utils/importCsv'); const { parseDelimited } = require('../../../shared/delimitedText');
    const cell = parseDelimited(csvCell(value), ',')[0].cells[0];
    expect(cell).toBe(/^[\u0000-\u0020]*[=+\-@']/.test(value) ? "'" + value : value);
});
test('row laboratory values cannot silently move exported data into a different destination', async () => {
    const body = workbook(); body.sheets.items[0].labId = labB;
    const result = await auth('commit', body); expect(result.status).toBe(422);
    expect(result.body.sheets.items[0].errors).toContainEqual({ code: 'IMPORT_LAB_FORBIDDEN', field: 'labId' });
});
test('parent locations are created before their children; a cycle refuses with no writes', async () => {
    const body = { ...workbook(), sheets: { locations: [ { name: 'Child', parentLocationName: 'Parent' }, { name: 'Parent' } ] } };
    const result = await auth('commit', body); expect(result.status).toBe(200);
    const parent = await prisma.inventoryLocation.findFirst({ where: { labId: labA, name: 'Parent' } });
    const child = await prisma.inventoryLocation.findFirst({ where: { labId: labA, name: 'Child' } }); expect(child.parentLocationId).toBe(parent.id);
    body.sheets.locations = [{ name: 'Cycle A', parentLocationName: 'Cycle B' }, { name: 'Cycle B', parentLocationName: 'Cycle A' }];
    const cycle = await auth('commit', body); expect(cycle.status).toBe(422); expect(cycle.body.totals.errors).toBe(2);
    expect(await prisma.inventoryLocation.count({ where: { labId: labA } })).toBe(2);
});

test('descriptive UPDATE preserves a location type when that column is omitted', async () => {
    const location = await writes.createLocation(users.manager, { name: 'Cold store', purpose: 'REAGENT', locationType: 'FRIDGE' });
    const body = { ...workbook(), duplicateMode: 'UPDATE', sheets: { locations: [{ name: location.name, temperatureRange: '2-8 C' }] } };
    expect((await auth('commit', body)).status).toBe(200);
    expect(await prisma.inventoryLocation.findUnique({ where: { id: location.id } })).toMatchObject({ locationType: 'FRIDGE', temperatureRange: '2-8 C' });
});
test('reported sheet row numbers cannot collide with internal parent identities', async () => {
    const body = workbook();
    for (const rows of Object.values(body.sheets)) for (const row of rows) row.rowNumber = 2;
    const result = await auth('commit', body); expect(result.status).toBe(200); expect(result.body.totals).toEqual({ created: 42, updated: 0, skipped: 0, errors: 0 });
});
