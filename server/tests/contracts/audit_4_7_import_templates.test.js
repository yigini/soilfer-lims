const service = require('../../services/instrumentImportTemplateService');
const { qcGateFixture } = require('../helpers/qcGateFixture');
const { withQcRunHttp } = require('../helpers/qcRunHttpHarness');
const request = require('supertest');
const mapping = () => ({ version: 1, delimiter: 'SEMICOLON', hasHeader: true, idColumn: 0, idType: 'LAB_SAMPLE_CODE',
    analytes: [{ analysisCode: 'EXCH_CA', inputs: [{ variable: 'concentration', column: 1, unit: 'mg/L' }] }],
    qcDetector: { positionColumn: 4, prefixes: [{ prefix: 'BLK', kind: 'BLANK' }, { prefix: 'CCV', kind: 'CCV' }, { prefix: 'LRM', kind: 'LRM' }] } });
const owned = [];
afterEach(async () => { for (const f of owned.splice(0)) await f.close(); });
async function fixture() { const f = await qcGateFixture(); owned.push(f); return f; }
const input = (f, changes = {}) => ({ instrumentId: f.instrument.id, labId: f.labId, name: 'Raw ICP columns',
    mapping: { ...mapping(), analytes: [{ analysisCode: f.analysisCode, valueColumn: 1, unit: 'fixture-unit' }] },
    supersedesId: null, expectedVersion: 0, ...changes });

test('mapping preserves raw column choices and never supplies a calculation, conversion or final value', () => {
    const original = mapping(), before = JSON.stringify(original), result = service.validateMapping(original);
    expect(result).toEqual(original); expect(JSON.stringify(original)).toBe(before); expect(result).not.toBe(original);
    result.analytes[0].inputs[0].unit = 'changed'; expect(original.analytes[0].inputs[0].unit).toBe('mg/L');
});
test.each([
    { delimiter: 'AUTO' }, { idColumn: -1 }, { idColumn: 1.5 }, { idType: 'GUESS' }, { hasHeader: 'yes' },
    { conversionFactor: 1000 }, { analytes: [] },
    { analytes: [{ analysisCode: 'X', valueColumn: 1, unit: 'mg/L', unitColumn: 2 }] },
    { analytes: [{ analysisCode: 'X', valueColumn: 1, unit: 'mg/L', unitColumn: -1 }] },
    { analytes: [{ analysisCode: 'X', valueColumn: 1 }] },
    { analytes: [{ analysisCode: 'X', valueColumn: 1, unitColumn: 2, inputs: [{ variable: 'c', column: 1, unit: 'mg/L' }] }] },
    { analytes: [{ analysisCode: 'X', inputs: [{ inputKey: 'c', column: 1, unit: 'mg/L' }] }] },
    { analytes: [{ analysisCode: 'X', inputs: [] }] },
    { analytes: [{ analysisCode: 'X', inputs: [{ variable: 'c', column: 1 }] }] },
    { analytes: [{ analysisCode: 'X', valueColumn: 1, unit: 'mg/L' }, { analysisCode: 'X', valueColumn: 2, unit: 'mg/L' }] },
    { qcDetector: { prefixes: [{ prefix: 'BLK', kind: 'BLANK' }] } },
    { qcDetector: { positionColumn: 4, prefixes: [{ prefix: 'BLK', kind: 'GUESS' }] } }
])('invalid or implicit mapping is refused without changing the supplied cells: %j', changes => {
    const value = { ...mapping(), ...changes }, before = JSON.stringify(value);
    expect(() => service.validateMapping(value)).toThrow(expect.objectContaining({ statusCode: 400, code: 'IMPORT_TEMPLATE_MAPPING_INVALID' }));
    expect(JSON.stringify(value)).toBe(before);
});
test('actual scoped template owner appends revisions, retains the root and audits each save', async () => {
    const f = await fixture(), root = await service.saveTemplate(f.db, f.actor, input(f));
    expect(root).toMatchObject({ labId: f.labId, instrumentId: f.instrument.id, version: 1, supersedesId: null });
    const original = await f.db.importTemplate.findUnique({ where: { id: root.id } });
    const next = await service.saveTemplate(f.db, f.actor, input(f, { supersedesId: root.id, expectedVersion: 1, name: 'Reviewed mapping' }));
    expect(next).toMatchObject({ version: 2, supersedesId: root.id });
    expect(await f.db.importTemplate.findUnique({ where: { id: root.id } })).toEqual(original);
    expect(await service.listTemplates(f.db, f.actor, f.instrument.id, f.labId)).toHaveLength(2);
    expect(await f.db.auditLog.count({ where: { entity: 'IMPORT_TEMPLATE' } })).toBe(2);
    await expect(service.saveTemplate(f.db, f.actor, input(f, { supersedesId: root.id, expectedVersion: 1 })))
        .rejects.toMatchObject({ statusCode: 409, code: 'IMPORT_TEMPLATE_VERSION_CHANGED' });
    expect(await f.db.importTemplate.count()).toBe(2); expect(await f.db.result.count()).toBe(0);
    expect(await f.db.qcMeasurement.count()).toBe(0); expect(await f.db.instrumentImportReceipt.count()).toBe(0);
});
test('another laboratory and an unprivileged actor cannot save a mapping or an audit row', async () => {
    const f = await fixture(), other = await fixture();
    await expect(service.saveTemplate(f.db, { ...f.actor, role: 'LAB_TECHNICIAN' }, input(f)))
        .rejects.toMatchObject({ statusCode: 403, code: 'IMPORT_PERMISSION_DENIED' });
    await expect(service.saveTemplate(f.db, f.actor, input(f, { labId: other.labId })))
        .rejects.toMatchObject({ statusCode: 403, code: 'IMPORT_SCOPE_DENIED' });
    expect(await f.db.importTemplate.count()).toBe(0); expect(await f.db.auditLog.count({ where: { entity: 'IMPORT_TEMPLATE' } })).toBe(0);
});
test('mounted template routes save and list through actual token, scope and permission middleware', async () => {
    const f = await fixture(), body = input(f); delete body.instrumentId;
    await withQcRunHttp(f.db, f.actor, async (app, token) => {
        const url = '/api/workbench/instruments/' + f.instrument.id + '/import-templates';
        const saved = await request(app).post(url).set('Authorization', 'Bearer ' + token).send(body);
        expect(saved.status).toBe(201); expect(saved.body).toMatchObject({ version: 1, instrumentId: f.instrument.id, mapping: body.mapping });
        const listed = await request(app).get(url).set('Authorization', 'Bearer ' + token);
        expect(listed.status).toBe(200); expect(listed.body.map(row => row.id)).toEqual([saved.body.id]);
        const forged = await request(app).post(url).set('Authorization', 'Bearer ' + token).send({ ...body, instrumentId: 'different' });
        expect(forged.status).toBe(422); expect(forged.body.code).toBe('IMPORT_TEMPLATE_INVALID');
        expect(await f.db.importTemplate.count()).toBe(1);
    }, { workbench: true });
});
