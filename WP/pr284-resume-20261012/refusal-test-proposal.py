"""Prepare test additions separately; never alter the running Jest source."""
import hashlib
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2]
DEST = pathlib.Path(__file__).resolve().parent / 'refusal-test-proposals'
DEST.mkdir(exist_ok=True)
changes = {}

def propose(name, content):
    source = ROOT / 'server/tests/contracts' / name
    before = source.read_bytes()
    (DEST / name).write_text(content, encoding='utf-8', newline='\n')
    changes[name] = {'beforeSha256': hashlib.sha256(before).hexdigest(),
        'proposedSha256': hashlib.sha256((DEST / name).read_bytes()).hexdigest()}

name = 'audit_4_7_import_commit.test.js'
text = (ROOT / 'server/tests/contracts' / name).read_text(encoding='utf-8')
text += '''

test('HTTP preview and commit refuse another same-lab instrument mapping with 409 and zero writes', async () => {
    const f = await fixture();
    const instrument = await f.db.equipmentAsset.create({ data: { id: randomUUID(), labId: f.labId,
        name: 'Other owned import instrument', assetType: 'OTHER', status: 'IN_SERVICE', criticality: 'NON_CRITICAL' } });
    await f.db.equipmentQualification.create({ data: { id: randomUUID(), equipmentId: instrument.id, labId: f.labId,
        calibrationStatus: 'OK', verificationStatus: 'OK', nextCalibrationDueDate: new Date('2099-01-01') } });
    const template = await saveTemplate(f.db, f.actor, { labId: f.labId, instrumentId: instrument.id,
        name: 'Other instrument mapping', mapping: f.template.mapping, supersedesId: null, expectedVersion: 0 });
    const input = f.input();
    await withQcRunHttp(f.db, f.actor, async (app, token) => {
        const route = '/api/workbench/runs/' + f.run.id + '/imports/';
        // Obtain a real signed preview while the synthetic run selects B,
        // then change its selection to A before both requests. The commit
        // must reach its actual instrument recheck, not fail an invented token.
        await f.db.batch.update({ where: { id: f.run.id }, data: { instrumentId: instrument.id } });
        const valid = await request(app).post(route + 'preview').set('Authorization', 'Bearer ' + token)
            .field('templateId', template.id).attach('file', input.bytes, input.sourceName);
        expect(valid.status).toBe(200); expect(valid.body.canCommit).toBe(true);
        await f.db.batch.update({ where: { id: f.run.id }, data: { instrumentId: f.instrument.id } });
        const before = await f.state(), batchBefore = await f.db.batch.findUnique({ where: { id: f.run.id } });
        for (const action of ['preview', 'commit']) {
            const req = request(app).post(route + action).set('Authorization', 'Bearer ' + token).field('templateId', template.id);
            if (action === 'commit') req.field('previewToken', valid.body.previewToken);
            const response = await req.attach('file', input.bytes, input.sourceName);
            expect(response.status).toBe(409);
            expect(response.body.code).toBe('IMPORT_TEMPLATE_INSTRUMENT_MISMATCH');
            expect(await f.state()).toEqual(before);
            expect(await f.db.batch.findUnique({ where: { id: f.run.id } })).toEqual(batchBefore);
        }
    }, { workbench: true });
});

test.each([['direct sample', 1], ['QC', 3]])('dilution10 on a %s row refuses the whole file with zero writes', async (_label, index) => {
    const f = await fixture(), rows = f.rows.map(row => [...row]); rows[index][3] = '10';
    const before = await f.state(), input = f.input(rows), preview = await importer.preview(f.db, f.actor, input);
    expect(preview.canCommit).toBe(false);
    expect(preview.refusals).toEqual([expect.objectContaining({ rowNumber: index + 2,
        analysisCode: f.analysisCode, statusCode: 409, code: 'IMPORT_DILUTION_UNSUPPORTED' })]);
    await expect(importer.commit(f.db, f.actor, { ...input, previewToken: preview.previewToken }))
        .rejects.toMatchObject({ statusCode: 409, code: 'IMPORT_DILUTION_UNSUPPORTED', details: { refusedRows: preview.refusals } });
    expect(await f.state()).toEqual(before);
});

test('missing catalogue units refuse commit even with the instrument source unit, retaining every row', async () => {
    const f = await fixture();
    await f.db.analysis.update({ where: { code: f.analysisCode }, data: { units: null, unitCode: null } });
    const before = await f.state(), input = f.input(), preview = await importer.preview(f.db, f.actor, input);
    expect(preview.canCommit).toBe(false);
    expect(preview.refusals).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'IMPORT_UNIT_UNAVAILABLE', statusCode: 409 })]));
    await expect(importer.commit(f.db, f.actor, { ...input, previewToken: preview.previewToken }))
        .rejects.toMatchObject({ statusCode: 409, code: 'IMPORT_UNIT_UNAVAILABLE' });
    expect(await f.state()).toEqual(before);
});

test('a QC unit mismatch refuses otherwise valid direct samples and commit with zero writes', async () => {
    const f = await fixture(), rows = f.rows.map(row => [...row]); rows[3][2] = 'unconfigured-QC-unit';
    const before = await f.state(), input = f.input(rows), preview = await importer.preview(f.db, f.actor, input);
    expect(preview.canCommit).toBe(false);
    expect(preview.refusals).toEqual([expect.objectContaining({ rowNumber: 5, code: 'IMPORT_UNIT_MISMATCH', statusCode: 409 })]);
    await expect(importer.commit(f.db, f.actor, { ...input, previewToken: preview.previewToken }))
        .rejects.toMatchObject({ statusCode: 409, code: 'IMPORT_UNIT_MISMATCH' });
    expect(await f.state()).toEqual(before);
});
'''
propose(name, text)

name = 'audit_4_7_calculation_import.test.js'
text = (ROOT / 'server/tests/contracts' / name).read_text(encoding='utf-8')
text = text.replace('async function fixture() {', 'async function fixture({ qc = false } = {}) {', 1)
text = text.replace('const criteria = { blankPerBatch: 0,', 'const criteria = { blankPerBatch: qc ? 1 : 0,', 1)
text += '''

test('QC under an input-only mapping refuses the whole file before any draft, receipt or scientific writes', async () => {
    const f = await fixture({ qc: true }), blank = f.run.positions.find(row => row.kind === 'BLANK');
    expect(blank).toBeDefined();
    const positionColumn = f.cells.length;
    const mapping = { ...f.mapping, qcDetector: { positionColumn, prefixes: [{ prefix: 'BLK', kind: 'BLANK' }] } };
    const template = await f.save(mapping);
    const cells = (row, number) => row.map((value, column) => column === 0
        ? `<c r="A${number}" t="inlineStr"><is><t>${xmlAttribute(value)}</t></is></c>`
        : `<c r="${String.fromCharCode(65 + column)}${number}"><v>${value}</v></c>`).join('');
    const samplePosition = f.run.positions.find(row => row.sampleId === f.sample.id).position;
    const sample = cells([...f.cells, String(samplePosition)], 1), qc = cells(['BLK-input-only', ...f.cells.slice(1), String(blank.position)], 2);
    const input = { ...f.input, templateId: template.id, bytes: xlsxWorkbook({ sheets: [{ name: 'Raw',
        xml: `<sheetData><row r="1">${sample}</row><row r="2">${qc}</row></sheetData>` }] }) };
    const before = await f.state(), preview = await importer.preview(f.db, f.actor, input);
    expect(preview.canCommit).toBe(false);
    expect(preview.rows[0].errors).toEqual([]);
    expect(preview.rows[0].plans).toHaveLength(2);
    expect(preview.refusals).toEqual(f.calculated.map(row => expect.objectContaining({ rowNumber: 2,
        analysisCode: row.code, statusCode: 400, code: 'IMPORT_TEMPLATE_MAPPING_INVALID' })));
    await expect(importer.commit(f.db, f.actor, { ...input, previewToken: preview.previewToken }))
        .rejects.toMatchObject({ statusCode: 400, code: 'IMPORT_TEMPLATE_MAPPING_INVALID', details: { refusedRows: preview.refusals } });
    expect(await f.state()).toEqual(before);
});
'''
propose(name, text)

name = 'audit_4_7_import_templates.test.js'
text = (ROOT / 'server/tests/contracts' / name).read_text(encoding='utf-8')
text = "const { randomUUID } = require('node:crypto');\n" + text
text += '''

test('a same-lab different-instrument revision refuses with its exact code and no mapping or audit writes', async () => {
    const f = await fixture(), root = await service.saveTemplate(f.db, f.actor, input(f));
    const instrument = await f.db.equipmentAsset.create({ data: { id: randomUUID(), labId: f.labId,
        name: 'Other owned revision instrument', assetType: 'OTHER', status: 'IN_SERVICE', criticality: 'NON_CRITICAL' } });
    const state = () => Promise.all([f.db.importTemplate.findMany(), f.db.auditLog.findMany(), f.snapshot()]);
    const before = await state();
    await expect(service.saveTemplate(f.db, f.actor, input(f, { instrumentId: instrument.id, supersedesId: root.id, expectedVersion: root.version })))
        .rejects.toMatchObject({ statusCode: 409, code: 'IMPORT_TEMPLATE_INSTRUMENT_MISMATCH' });
    expect(await state()).toEqual(before);
});
'''
propose(name, text)
(DEST / 'proposal-bindings.json').write_text(json.dumps(changes, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'status': 'TEST_PROPOSAL_ONLY_NOT_APPLIED', 'files': changes}))
