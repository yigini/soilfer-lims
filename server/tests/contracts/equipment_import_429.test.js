jest.mock('dotenv', () => ({ config: () => ({ parsed: {} }) }));
const request = require('supertest');
const { randomUUID, createHash } = require('node:crypto');
const fs = require('node:fs'), path = require('node:path');
const jwt = require('jsonwebtoken');
const prisma = require('../../prisma');
const app = require('../../app');
const { JWT_SECRET } = require('../../config/auth');
const writes = require('../../services/equipmentWriteService');
const imports = require('../../services/equipmentImportService');
const { eligibleEquipmentForItem } = require('../../services/workbenchReadinessService');
let labA, labB, code, users, tokens;
const atDay = days => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
const row = (extra = {}) => ({ rowNumber: 2, internalAssetTag: 'PRACTICE-01', name: 'Practice meter', assetType: 'PH_METER', criticality: 'CRITICAL', ...extra });
const book = (rows = [row()]) => ({ fileName: 'practice-equipment.xlsx', duplicateMode: 'SKIP', atomic: true, sheets: { equipment: rows } });
const auth = (mode, body, who = 'manager') => request(app).post('/api/equipment/import/' + mode).set('Authorization', 'Bearer ' + tokens[who]).send(body);
async function counts() {
    const where = { labId: labA };
    return { assets: await prisma.equipmentAsset.count({ where }), qualification: await prisma.equipmentQualification.count({ where }),
        events: await prisma.equipmentEvent.count({ where }), mappings: await prisma.equipmentMethodEligibility.count({ where }), audits: await prisma.auditLog.count({ where }) };
}
beforeEach(async () => {
    const prefix = 'I429E-' + randomUUID().slice(0, 8); labA = prefix + '-A'; labB = prefix + '-B'; code = prefix + '-analysis'; users = {}; tokens = {};
    for (const id of [labA, labB]) await prisma.lab.create({ data: { id, code: id, name: 'Practice lab', country: 'GTM', isActive: true } });
    await prisma.analysis.create({ data: { code, name: 'Practice pH', status: 'active', labId: labA, isGlobal: false } });
    for (const [name, role] of [['manager','LAB_MANAGER'],['super','SUPER_ADMIN'],['tech','LAB_TECHNICIAN'],['viewer','VIEWER']]) {
        const labId = name === 'super' ? null : labA;
        users[name] = await prisma.user.create({ data: { id: prefix + '-' + name, username: prefix + '-' + name, email: prefix + '-' + name + '@example.test', name: 'Practice ' + name,
            role, labId, password: 'unused-synthetic-fixture', isActive: true, countries: '[]', projects: '[]' } });
        tokens[name] = jwt.sign({ id: users[name].id, username: users[name].username, role, labId, countries: [], projects: [] }, JWT_SECRET, { expiresIn: '1h' });
    }
});
afterAll(async () => prisma.$disconnect());
test('preview leaves database and WAL unchanged; calibration uses the real event path and is Ready in Workbench choices', async () => {
    const body = book([row({ eligibleAnalyses: code, lastCalibrationDate: atDay(-2), nextCalibrationDueDate: atDay(365) })]);
    expect((await auth('preview', body)).status).toBe(200);
    const filename = (await prisma.$queryRawUnsafe('PRAGMA database_list')).find(row => row.name === 'main').file;
    expect(path.resolve(filename).startsWith(path.resolve(__dirname, '../.tmp') + path.sep)).toBe(true);
    const hash = suffix => fs.existsSync(filename + suffix) ? createHash('sha256').update(fs.readFileSync(filename + suffix)).digest('hex') : null;
    const before = [hash(''), hash('-wal')];
    const preview = await auth('preview', body); expect(preview.status).toBe(200); expect(preview.body.sheets.equipment[0].status).toBe('NEW');
    expect([hash(''), hash('-wal')]).toEqual(before);
    expect(await counts()).toEqual({ assets: 0, qualification: 0, events: 0, mappings: 0, audits: 0 });
    const result = await auth('commit', body); expect(result.status).toBe(200); expect(result.body.committed).toBe(true);
    expect(await counts()).toEqual({ assets: 1, qualification: 1, events: 2, mappings: 1, audits: 3 });
    const assetId = result.body.sheets.equipment[0].id;
    const asset = await prisma.equipmentAsset.findUnique({ where: { id: assetId }, include: { qualification: true, events: true } });
    expect(asset).toMatchObject({ status: 'IN_SERVICE', criticality: 'CRITICAL', qualification: { calibrationStatus: 'OK', verificationStatus: 'NOT_CONFIGURED', lastUpdatedBy: users.manager.username } });
    expect(asset.events.find(e => e.eventType === 'CALIBRATION')).toMatchObject({ userId: users.manager.username, outcome: 'PASS', requiresManagerSignoff: false });
    const options = await eligibleEquipmentForItem(prisma, { analysis: code }, labA);
    expect(options.eligibleEquipment).toEqual([expect.objectContaining({ id: assetId, readiness: 'READY', calibrationStatus: 'OK' })]);
    const api = await request(app).get('/api/equipment/eligibility/' + code).set('Authorization', 'Bearer ' + tokens.tech);
    expect(api.status).toBe(200); expect(api.body).toEqual([expect.objectContaining({ id: assetId, readiness: 'READY' })]);
    const audits = await prisma.auditLog.findMany({ where: { labId: labA } });
    expect(audits.every(a => a.performedBy === users.manager.username)).toBe(true);
    expect(JSON.parse(audits.find(a => a.action === 'IMPORT_COMPLETED').details)).toMatchObject({ fileName: body.fileName, user: users.manager.username, labId: labA, totals: { created: 1 } });
});
test('without calibration data a new instrument stays NOT_CONFIGURED with the ordinary registration event', async () => {
    const result = await auth('commit', book()); expect(result.status).toBe(200);
    const asset = await prisma.equipmentAsset.findUnique({ where: { id: result.body.sheets.equipment[0].id }, include: { qualification: true, events: true } });
    expect(asset.qualification).toMatchObject({ calibrationStatus: 'NOT_CONFIGURED', verificationStatus: 'NOT_CONFIGURED', lastCalibrationDate: null });
    expect(asset.events.map(e => e.eventType)).toEqual(['REGISTER']); expect((await counts()).audits).toBe(2);
});
test('SKIP writes no asset/event/qualification; UPDATE changes only descriptive fields through the shared editor path', async () => {
    const body = book(); await auth('commit', body);
    const existing = await prisma.equipmentAsset.findFirst({ where: { labId: labA } });
    await prisma.equipmentAsset.update({ where: { id: existing.id }, data: { status: 'OUT_OF_SERVICE' } });
    const before = await counts(), qualification = await prisma.equipmentQualification.findUnique({ where: { equipmentId: existing.id } });
    const skip = await auth('commit', body); expect(skip.body.totals).toEqual({ created: 0, updated: 0, skipped: 1, errors: 0 });
    expect(await counts()).toEqual({ ...before, audits: before.audits + 1 });
    body.duplicateMode = 'UPDATE'; body.sheets.equipment[0] = row({ name: 'New description', manufacturer: 'Practice maker', assetType: 'OTHER', criticality: 'NON_CRITICAL', status: 'IN_SERVICE',
        lastCalibrationDate: atDay(-1), nextCalibrationDueDate: atDay(365), eligibleAnalyses: code });
    const update = await auth('commit', body); expect(update.status).toBe(200); expect(update.body.totals.updated).toBe(1);
    expect(await prisma.equipmentAsset.findUnique({ where: { id: existing.id } })).toMatchObject({ name: 'New description', manufacturer: 'Practice maker', assetType: existing.assetType, criticality: existing.criticality, status: 'OUT_OF_SERVICE' });
    expect(await prisma.equipmentQualification.findUnique({ where: { equipmentId: existing.id } })).toEqual(qualification);
    expect(await prisma.equipmentEvent.count({ where: { equipmentId: existing.id, eventType: 'CALIBRATION' } })).toBe(0);
    expect(await prisma.equipmentEvent.count({ where: { equipmentId: existing.id, eventType: 'METADATA_UPDATE' } })).toBe(1);
    expect((await counts()).mappings).toBe(0); expect(update.body.ignoredColumns.equipment).toContain('status');
});
test('a partial description update retains omitted name, serial number, type and location', async () => {
    await auth('commit', book([row({ serialNumber: 'KEEP-SERIAL', locationId: 'Practice bench' })]));
    const result = await auth('commit', { ...book([{ internalAssetTag: 'PRACTICE-01', manufacturer: 'Changed maker' }]), duplicateMode: 'UPDATE' });
    expect(result.status).toBe(200);
    expect(await prisma.equipmentAsset.findFirst({ where: { labId: labA } })).toMatchObject({ name: 'Practice meter', manufacturer: 'Changed maker', serialNumber: 'KEEP-SERIAL', locationId: 'Practice bench', assetType: 'PH_METER' });
});
test('eligibility appends multiple imported instruments and retains the existing instruments, method and required flag', async () => {
    const existing = await writes.addEquipment(users.manager, row({ internalAssetTag: 'KEEP' }));
    const method = await prisma.methodology.create({ data: { id: randomUUID(), analysisCode: code, name: 'Practice method', labId: labA } });
    await writes.updateEligibility(users.manager, { analysisCode: code, methodId: method.id, eligibleEquipmentIds: [existing.id], isRequired: false });
    const result = await auth('commit', book([row({ eligibleAnalyses: code }), row({ rowNumber: 3, internalAssetTag: 'PRACTICE-02', eligibleAnalyses: code })]));
    expect(result.status).toBe(200); expect(result.body.totals.created).toBe(2);
    const mapping = await prisma.equipmentMethodEligibility.findFirst({ where: { labId: labA, analysisCode: code } });
    expect(mapping).toMatchObject({ methodId: method.id, isRequired: false });
    expect(JSON.parse(mapping.eligibleEquipmentIds)).toEqual([existing.id, ...result.body.sheets.equipment.map(r => r.id)]);
});
test.each([true, false])('atomic=%s uses one transaction and only the permitted rows', async atomic => {
    const body = { ...book([row(), row({ rowNumber: 91, internalAssetTag: 'BAD', assetType: 'INVALID' })]), atomic };
    const result = await auth('commit', body); expect(result.status).toBe(atomic ? 422 : 200);
    expect(result.body.sheets.equipment[1]).toMatchObject({ rowNumber: 91, status: 'ERROR', errors: [{ code: 'IMPORT_INVALID_ENUM', field: 'assetType' }] });
    expect((await counts()).assets).toBe(atomic ? 0 : 1); expect((await counts()).audits).toBe(atomic ? 0 : 2);
});
test.each([
    ['missing tag', { internalAssetTag: '' }, 'IMPORT_REQUIRED'],
    ['missing name', { name: '' }, 'IMPORT_REQUIRED'],
    ['bad criticality', { criticality: 'UNSUPPORTED' }, 'IMPORT_INVALID_ENUM'],
    ['invalid date', { lastCalibrationDate: '2030-02-31' }, 'IMPORT_INVALID_DATE'],
    ['future calibration', { lastCalibrationDate: atDay(10) }, 'IMPORT_FUTURE_DATE'],
    ['due date alone', { nextCalibrationDueDate: atDay(365) }, 'IMPORT_CALIBRATION_DATE_REQUIRED'],
    ['unknown analysis', { eligibleAnalyses: 'unknown' }, 'IMPORT_ANALYSIS_UNAVAILABLE'],
    ['object cell', { manufacturer: { value: 'not text' } }, 'IMPORT_INVALID_CELL'],
    ['control character', { name: 'Bad\u0000name' }, 'IMPORT_CONTROL_CHARACTER']
])('%s returns a stable per-row error without writes', async (_label, changes, expected) => {
    const body = book([row({ rowNumber: 77, ...changes })]);
    const response = await auth('preview', body); expect(response.status).toBe(200); expect(response.body.sheets.equipment[0]).toMatchObject({ rowNumber: 77, status: 'ERROR' });
    expect(response.body.sheets.equipment[0].errors.some(e => e.code === expected)).toBe(true);
    expect((await auth('commit', body)).status).toBe(422); expect((await counts()).assets).toBe(0);
});
test('inactive, foreign-lab and malformed eligibility lists are refused', async () => {
    const foreign = code + '-foreign', inactive = code + '-inactive';
    await prisma.analysis.create({ data: { code: foreign, name: 'Other lab', labId: labB, status: 'active' } });
    await prisma.analysis.create({ data: { code: inactive, name: 'Retired', labId: null, status: 'inactive' } });
    for (const [eligibleAnalyses, expected] of [[foreign,'IMPORT_ANALYSIS_UNAVAILABLE'],[inactive,'IMPORT_ANALYSIS_UNAVAILABLE'],[code + ' | ' + code,'IMPORT_INVALID_ANALYSIS_LIST'],[code + ' | ','IMPORT_INVALID_ANALYSIS_LIST']]) {
        const response = await auth('preview', book([row({ eligibleAnalyses })])); expect(response.status).toBe(200);
        expect(response.body.sheets.equipment[0].errors.some(e => e.code === expected)).toBe(true);
    }
});
test('broken existing eligibility is a row error before any write', async () => {
    await prisma.equipmentMethodEligibility.create({ data: { id: randomUUID(), labId: labA, analysisCode: code, eligibleEquipmentIds: 'not-json' } });
    const response = await auth('commit', book([row({ eligibleAnalyses: code })])); expect(response.status).toBe(422);
    expect(response.body.sheets.equipment[0].errors).toContainEqual({ code: 'IMPORT_ELIGIBILITY_INVALID', field: 'eligibleAnalyses' }); expect((await counts()).assets).toBe(0);
});
test('duplicate tags in the same file mark every row; identical source row numbers do not collide', async () => {
    const duplicate = await auth('commit', book([row(), row({ rowNumber: 9 })])); expect(duplicate.status).toBe(422);
    expect(duplicate.body.sheets.equipment.every(r => r.errors.some(e => e.code === 'IMPORT_DUPLICATE_IN_FILE'))).toBe(true);
    const valid = await auth('commit', book([row(), row({ internalAssetTag: 'PRACTICE-02' })])); expect(valid.body.totals.created).toBe(2);
});
test.each(['tech','viewer'])('%s cannot preview or commit', async who => {
    for (const mode of ['preview','commit']) expect((await auth(mode, book(), who)).status).toBe(403);
    expect((await counts()).assets).toBe(0);
});
test('scope is enforced for explicit lab, row lab, active destination and Super Admin selection', async () => {
    expect((await auth('commit', { ...book(), labId: labB })).status).toBe(403);
    const rowForeign = await auth('preview', book([row({ labId: labB })])); expect(rowForeign.body.sheets.equipment[0].errors).toContainEqual({ code: 'IMPORT_LAB_FORBIDDEN', field: 'labId' });
    expect((await auth('commit', book(), 'super')).body.code).toBe('IMPORT_LAB_REQUIRED');
    await prisma.lab.update({ where: { id: labB }, data: { isActive: false } });
    expect((await auth('commit', { ...book(), labId: labB }, 'super')).body.code).toBe('IMPORT_LAB_UNAVAILABLE');
    const result = await auth('commit', { ...book([row({ eligibleAnalyses: code, lastCalibrationDate: atDay(-1), nextCalibrationDueDate: atDay(365) })]), labId: labA }, 'super');
    expect(result.status).toBe(200); expect(result.body.totals.created).toBe(1);
    expect((await prisma.equipmentEvent.findFirst({ where: { labId: labA, eventType: 'CALIBRATION' } })).userId).toBe(users.super.username);
});
test('same tag in another lab is never matched or updated', async () => {
    const foreign = await writes.addEquipment(users.super, { ...row(), labId: labB });
    const result = await auth('commit', { ...book(), duplicateMode: 'UPDATE' }); expect(result.body.totals.created).toBe(1);
    expect(result.body.sheets.equipment[0].id).not.toBe(foreign.id);
    expect(await prisma.equipmentAsset.findUnique({ where: { id: foreign.id } })).toEqual(foreign);
});
test('limits are 2000 rows and 2 MB with no silent truncation', async () => {
    for (const body of [book(Array.from({ length: 2001 }, (_, i) => row({ internalAssetTag: 'TAG-' + i }))), { ...book(), padding: 'x'.repeat(2 * 1024 * 1024) }]) {
        const response = await auth('preview', body); expect(response.status).toBe(413); expect(response.body.code).toBe('IMPORT_TOO_LARGE');
    }
});
test('a database failure rolls back the asset, event, eligibility, qualification and audits together', async () => {
    const spy = jest.spyOn(writes, 'updateEligibility').mockRejectedValueOnce(new Error('Synthetic eligibility failure'));
    try { expect((await auth('commit', book([row({ eligibleAnalyses: code, lastCalibrationDate: atDay(-1), nextCalibrationDueDate: atDay(365) })]))).status).toBe(500); }
    finally { spy.mockRestore(); }
    expect(await counts()).toEqual({ assets: 0, qualification: 0, events: 0, mappings: 0, audits: 0 });
});
test('commit validates again even after a successful preview', async () => {
    const body = book([row({ eligibleAnalyses: code })]); expect((await auth('preview', body)).body.totals.errors).toBe(0);
    await prisma.analysis.update({ where: { code }, data: { status: 'inactive' } });
    expect((await auth('commit', body)).status).toBe(422); expect((await counts()).assets).toBe(0);
});
test('a transaction client exposing $transaction is reused rather than nested', async () => {
    await prisma.$transaction(async tx => {
        const nested = jest.fn(() => { throw new Error('Nested transaction must not be called'); });
        const exposed = new Proxy(tx, { get(target, key) { return key === '$transaction' ? nested : Reflect.get(target, key); } });
        const result = await imports.commit(users.manager, book([row({ eligibleAnalyses: code, lastCalibrationDate: atDay(-1), nextCalibrationDueDate: atDay(365) })]), { db: exposed });
        expect(result.totals.created).toBe(1); expect(nested).not.toHaveBeenCalled();
    });
});
test('CSV has template column names, exact descriptions and formula-safe text; exports remain lab-scoped', async () => {
    const body = book([row({ name: '=1+1', serialNumber: '"Practice, serial"', manufacturer: "'maker", eligibleAnalyses: code })]);
    expect((await auth('commit', body)).status).toBe(200);
    const exported = await request(app).get('/api/equipment/export').set('Authorization', 'Bearer ' + tokens.manager);
    expect(exported.status).toBe(200); expect(exported.text.split('\n')[0]).toBe(imports.COLUMNS.equipment.map(c => '"' + c + '"').join(','));
    expect(exported.text).toContain('"\'=1+1"'); expect(exported.text).toContain('""Practice, serial""'); expect(exported.text).toContain("''maker");
    expect((await request(app).get('/api/equipment/export').set('Authorization', 'Bearer ' + tokens.super)).body.code).toBe('IMPORT_LAB_REQUIRED');
    expect((await request(app).get('/api/equipment/export?labId=' + labB).set('Authorization', 'Bearer ' + tokens.manager)).status).toBe(403);
});
