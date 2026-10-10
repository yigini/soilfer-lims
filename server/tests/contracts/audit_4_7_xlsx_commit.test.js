const request = require('supertest');
const { randomUUID } = require('node:crypto');
const { qcGateFixture } = require('../helpers/qcGateFixture');
const { withQcRunHttp } = require('../helpers/qcRunHttpHarness');
const { xlsxWorkbook, xmlAttribute } = require('../helpers/instrumentXlsxBytes');
const { buildNativeRun, startNativeRun } = require('../../services/qcNativeRunService');
const { saveTemplate } = require('../../services/instrumentImportTemplateService');
const importer = require('../../services/instrumentImportService');
const owned = [];
afterEach(async () => { for (const f of owned.splice(0)) await f.close(); });
async function fixture(count = 1) {
    const f = await qcGateFixture({ count, criteria: { blankPerBatch: 0, lrmPerBatch: 0, duplicateEvery: 0, crmEveryNBatches: 0, ccvEvery: 0 } });
    owned.push(f);
    await f.db.equipmentQualification.create({ data: { id: randomUUID(), equipmentId: f.instrument.id, labId: f.labId,
        calibrationStatus: 'OK', verificationStatus: 'OK', nextCalibrationDueDate: new Date('2099-01-01') } });
    f.run = await startNativeRun(f.db, (await buildNativeRun(f.db, f.actor, f.input)).id, f.actor);
    f.samples = await f.db.sample.findMany({ where: { id: { in: f.items.map(item => item.sampleId) } }, orderBy: { id: 'asc' } });
    f.template = await saveTemplate(f.db, f.actor, { labId: f.labId, instrumentId: f.instrument.id, name: 'Owned exact XLSX mapping',
        supersedesId: null, expectedVersion: 0, mapping: { version: 1, delimiter: 'SEMICOLON', hasHeader: false,
            idType: 'ORIGINAL_ID', idColumn: 0, analytes: [{ analysisCode: f.analysisCode, valueColumn: 1, unitColumn: 2 }] } });
    f.xml = values => '<sheetData>' + values.map((cell, index) => `<row r="${index + 1}"><c r="A${index + 1}" t="inlineStr"><is><t>${xmlAttribute(f.samples[index].originalId)}</t></is></c>` +
        cell.replace(/B1/g, 'B' + (index + 1)) + `<c r="C${index + 1}" t="inlineStr"><is><t>fixture-unit</t></is></c></row>`).join('') + '</sheetData>';
    f.input = (cells, options = {}) => ({ batchId: f.run.id, templateId: f.template.id, sourceName: 'owned-source.xlsx',
        bytes: xlsxWorkbook({ ...options, sheets: options.sheets || [{ name: 'Raw', xml: f.xml(cells) }] }) });
    f.state = async () => JSON.parse(JSON.stringify(await Promise.all([f.snapshot(), f.db.workItemDraft.findMany(), f.db.instrumentImportReceipt.findMany(),
        f.db.workAttempt.findMany(), f.db.qcMeasurement.findMany(), f.db.qcEvaluation.findMany(), f.db.nonconformityReport.findMany()])));
    return f;
}
const numeric = value => `<c r="B1"><v>${value}</v></c>`;
const customStyle = format => '<numFmts><numFmt numFmtId="164" formatCode="' + format + '"/></numFmts><cellXfs><xf numFmtId="164"/></cellXfs>';

test('real XLSX commit keeps long, exponent and rounded-display raw drafts plus immutable cell and policy evidence', async () => {
    const f = await fixture(3), values = ['0.30000000000000004', '1E-3', '0012.3400'];
    const input = f.input(values.map(numeric), { styles: '<cellXfs><xf numFmtId="2"/></cellXfs>' }), before = await f.state();
    const preview = await importer.preview(f.db, f.actor, input); expect(preview.canCommit).toBe(true); expect(await f.state()).toEqual(before);
    const committed = await importer.commit(f.db, f.actor, { ...input, previewToken: preview.previewToken });
    expect(committed).toMatchObject({ draftCount: 3, qcCount: 0 });
    const receipt = await f.db.instrumentImportReceipt.findUnique({ where: { id: committed.receiptId } }), snapshot = JSON.parse(receipt.mappingSnapshot);
    expect(snapshot.numberPolicy[f.analysisCode]).toMatchObject({ version: 0, format: { decimal: '.', thousands: null } });
    for (let index = 0; index < values.length; index++) {
        const draft = await f.db.workItemDraft.findFirst({ where: { sampleId: f.samples[index].id } });
        expect(draft).toMatchObject({ value: values[index], importReceiptId: receipt.id });
        expect(snapshot.rows[index].cellEvidence[1]).toMatchObject({ sheetName: 'Raw', cellRef: 'B' + (index + 1), t: null,
            numFmtId: 2, formatCode: '0.00', rawLexeme: values[index] });
    }
    expect(await f.db.result.count()).toBe(0); expect(await f.db.qcEvaluation.count()).toBe(0);
});

test('every mapped cell refusal lists its cell and leaves actual drafts, results, QC, attempts, audits and receipts unchanged', async () => {
    const f = await fixture(), before = await f.state();
    for (const [xml, styles, code] of [
        ['<c r="B1"><f>1+1</f><v>2</v></c>', null, 'IMPORT_XLSX_FORMULA_UNSUPPORTED'],
        ['<c r="B1" t="str"><v>2</v></c>', null, 'IMPORT_XLSX_FORMULA_UNSUPPORTED'],
        ['<c r="B1" t="e"><v>#DIV/0!</v></c>', null, 'IMPORT_XLSX_CELL_ERROR'],
        ['<c r="B1" t="b"><v>1</v></c>', null, 'IMPORT_XLSX_CELL_TYPE_UNSUPPORTED'],
        ['<c r="B1" t="d"><v>2026-10-10</v></c>', null, 'IMPORT_XLSX_CELL_TYPE_UNSUPPORTED'],
        [numeric('0.25'), customStyle('0%'), 'IMPORT_XLSX_DISPLAY_SCALED'],
        [numeric('12345'), customStyle('#,##0,'), 'IMPORT_XLSX_DISPLAY_SCALED'],
        [numeric('45200'), '<cellXfs><xf numFmtId="14"/></cellXfs>', 'IMPORT_XLSX_DISPLAY_SCALED'],
        [numeric('45200'), customStyle('yyyy-mm-dd'), 'IMPORT_XLSX_DISPLAY_SCALED'],
        [numeric('1,234'), null, 'IMPORT_XLSX_INVALID']
    ]) {
        const input = f.input([xml], { styles }), preview = await importer.preview(f.db, f.actor, input);
        expect(preview.canCommit).toBe(false); expect(preview.refusals).toEqual([expect.objectContaining({ code, rowNumber: 1, details: expect.objectContaining({ cellRef: 'B1' }) })]);
        await expect(importer.commit(f.db, f.actor, { ...input, previewToken: preview.previewToken })).rejects.toMatchObject({ code, details: { refusedRows: preview.refusals } });
        expect(await f.state()).toEqual(before);
    }
});

test.each([
    [{ decimal: ',', thousands: '.' }, true], [{ decimal: ',', thousands: null }, false],
    [{ decimal: '.', thousands: null }, false], [{ decimal: '.', thousands: ',' }, true]
])('actual lab number policy %j controls the verified numeric1.234 lab text', async (format, allowed) => {
    const f = await fixture();
    await f.setPolicy([{ key: 'numbers.decimalSeparator', value: format.decimal }, { key: 'numbers.thousandsSeparator', value: format.thousands }]);
    const before = await f.state(), input = f.input([numeric('1.234')]), preview = await importer.preview(f.db, f.actor, input);
    expect(preview.canCommit).toBe(allowed); expect(await f.state()).toEqual(before);
    if (!allowed) {
        expect(preview.refusals[0]).toMatchObject({ code: 'IMPORT_XLSX_NUMBER_POLICY_CONFLICT', statusCode: 409,
            details: { cellRef: 'B1', lexeme: '1.234', invariantCanonical: '1.234' } });
        await expect(importer.commit(f.db, f.actor, { ...input, previewToken: preview.previewToken })).rejects.toMatchObject({ code: 'IMPORT_XLSX_NUMBER_POLICY_CONFLICT' });
        expect(await f.state()).toEqual(before);
    } else {
        await importer.commit(f.db, f.actor, { ...input, previewToken: preview.previewToken });
        expect(await f.db.workItemDraft.findFirst()).toMatchObject({ value: format.decimal === ',' ? '1,234' : '1.234' });
    }
});

test.each([{ decimal: ',', thousands: '.' }, { decimal: ',', thousands: ' ' }, { decimal: '.', thousands: ',' }])(
    'numeric/text imports under%j keep source lexemes, verified draft text and the used policy version', async format => {
    const f = await fixture(6), textRaw = format.thousands === ' ' ? '1,234' : '1.234',
        original = ['1.5', '1.234', '12', '1E-3', '-1.5E-3', textRaw];
    await f.setPolicy([{ key: 'numbers.decimalSeparator', value: format.decimal }, { key: 'numbers.thousandsSeparator', value: format.thousands }]);
    const input = f.input([...original.slice(0, 5).map(numeric), '<c r="B1" t="s"><v>0</v></c>'], { sharedStrings: '<si><t>' + textRaw + '</t></si>' });
    const preview = await importer.preview(f.db, f.actor, input); expect(preview.canCommit).toBe(true);
    const result = await importer.commit(f.db, f.actor, { ...input, previewToken: preview.previewToken }); expect(result.draftCount).toBe(6);
    const receipt = await f.db.instrumentImportReceipt.findFirst();
    const snapshot = JSON.parse(receipt.mappingSnapshot);
    for (const [index, raw] of original.entries()) {
        const labText = index < 5 && format.decimal === ',' ? raw.replace('.', ',') : raw;
        const draft = await f.db.workItemDraft.findFirst({ where: { sampleId: f.samples[index].id } });
        expect(draft).toMatchObject({ value: labText });
        expect(snapshot.rows[index].cells[1]).toBe(raw);
        expect(snapshot.rows[index].plans[0].evidence.cells.find(cell => cell.column === 1)).toMatchObject({ rawLexeme: raw, labText, numberPolicyVersion: 1 });
        if (index < 5) {
            const recorded = await f.db.$transaction(tx => require('../../services/resultWriteService').writeResult(tx, {
                sampleId: draft.sampleId, workItemId: draft.workItemId, actor: f.actor,
                measurement: { param: f.analysisCode, value: draft.value, unit: 'fixture-unit' }
            }));
            expect(recorded).toMatchObject({ numericValue: Number(raw), rawInput: labText });
        }
    }
    expect(snapshot.numberPolicy[f.analysisCode]).toMatchObject({ version: 1, format });
});

test('shared-string1.234 remains ambiguous under comma/space policy and refuses the whole commit without transliteration', async () => {
    const f = await fixture(2);
    await f.setPolicy([{ key: 'numbers.decimalSeparator', value: ',' }, { key: 'numbers.thousandsSeparator', value: ' ' }]);
    const before = await f.state(), input = f.input([numeric('1.234'), '<c r="B1" t="s"><v>0</v></c>'], { sharedStrings: '<si><t>1.234</t></si>' });
    const preview = await importer.preview(f.db, f.actor, input);
    expect(preview.rows[0].plans[0].input.value).toBe('1,234');
    expect(preview.rows[1].cells[1]).toBe('1.234'); expect(preview.canCommit).toBe(false);
    expect(preview.refusals).toEqual([expect.objectContaining({ rowNumber: 2, code: 'AMBIGUOUS_NUMBER' })]);
    await expect(importer.commit(f.db, f.actor, { ...input, previewToken: preview.previewToken })).rejects.toMatchObject({ code: 'AMBIGUOUS_NUMBER' });
    expect(await f.state()).toEqual(before);
});

test('policy changes after preview invalidate the actual commit before any receipt or draft', async () => {
    const f = await fixture(), input = f.input([numeric('1.5')]), preview = await importer.preview(f.db, f.actor, input);
    await f.setPolicy([{ key: 'numbers.decimalSeparator', value: ',' }, { key: 'numbers.thousandsSeparator', value: '.' }]);
    const before = await f.state();
    await expect(importer.commit(f.db, f.actor, { ...input, previewToken: preview.previewToken })).rejects.toMatchObject({ code: 'IMPORT_PREVIEW_INVALID' });
    expect(await f.state()).toEqual(before);
});

test('mounted multipart sheets require an exact selection; changing it cannot authorize another sheet', async () => {
    const f = await fixture(), input = f.input([], { sheets: [{ name: 'Summary', xml: '<sheetData/>' }, { name: 'Raw é', state: 'hidden', xml: f.xml([numeric('1E-3')]) }] });
    await withQcRunHttp(f.db, f.actor, async (app, token) => {
        const route = '/api/workbench/runs/' + f.run.id + '/imports/', before = await f.state();
        for (const [sheetName, code] of [[null, 'IMPORT_XLSX_SHEET_REQUIRED'], ['missing', 'IMPORT_XLSX_SHEET_NOT_FOUND']]) {
            let query = request(app).post(route + 'preview').set('Authorization', 'Bearer ' + token).field('templateId', f.template.id);
            if (sheetName !== null) query = query.field('sheetName', sheetName);
            const response = await query.attach('file', input.bytes, input.sourceName);
            expect(response.status).toBe(400); expect(response.body.code).toBe(code); expect(await f.state()).toEqual(before);
        }
        const preview = await request(app).post(route + 'preview').set('Authorization', 'Bearer ' + token).field('templateId', f.template.id)
            .field('sheetName', 'Raw é').attach('file', input.bytes, input.sourceName);
        expect(preview.status).toBe(200); expect(preview.body.canCommit).toBe(true);
        const changed = await request(app).post(route + 'commit').set('Authorization', 'Bearer ' + token).field('templateId', f.template.id)
            .field('previewToken', preview.body.previewToken).field('sheetName', 'Summary').attach('file', input.bytes, input.sourceName);
        expect(changed.status).toBe(400); expect(changed.body.code).toBe('IMPORT_PREVIEW_INVALID'); expect(await f.state()).toEqual(before);
        const committed = await request(app).post(route + 'commit').set('Authorization', 'Bearer ' + token).field('templateId', f.template.id)
            .field('previewToken', preview.body.previewToken).field('sheetName', 'Raw é').attach('file', input.bytes, input.sourceName);
        expect(committed.status).toBe(201); expect(committed.body).toMatchObject({ draftCount: 1, qcCount: 0 });
    }, { workbench: true });
});

test('the actual multipart compressed-size cap returns the pinned XLSX code on both routes with zero writes', async () => {
    const f = await fixture(), before = await f.state(), bytes = Buffer.alloc(16 * 1024 * 1024 + 1);
    await withQcRunHttp(f.db, f.actor, async (app, token) => {
        for (const action of ['preview', 'commit']) {
            const query = request(app).post('/api/workbench/runs/' + f.run.id + '/imports/' + action)
                .set('Authorization', 'Bearer ' + token).field('templateId', f.template.id);
            if (action === 'commit') query.field('previewToken', 'oversized-file-never-reaches-the-owner');
            const response = await query.attach('file', bytes, 'compressed-cap.XLSX');
            expect(response.status).toBe(400); expect(response.body.code).toBe('IMPORT_XLSX_TOO_LARGE');
            expect(await f.state()).toEqual(before);
        }
    });
});

test('malformed XML, macros, external parts and XML resource overflow refuse the real preview with zero writes', async () => {
    const f = await fixture(), before = await f.state();
    for (const [extraParts, code] of [
        [[['unused.xml', '<bad>']], 'IMPORT_XLSX_INVALID'],
        [[['xl/vbaProject.bin', 'macro']], 'IMPORT_XLSX_INVALID'],
        [[['xl/externalLinks/externalLink1.xml', '<x/>']], 'IMPORT_XLSX_INVALID'],
        [[['unused.xml', '<!DOCTYPE x [<!ENTITY a "boom">]><x>&a;</x>']], 'IMPORT_XLSX_INVALID'],
        [[['unused.xml', '<x>'.repeat(65) + '</x>'.repeat(65)]], 'IMPORT_XLSX_TOO_LARGE']
    ]) {
        await expect(importer.preview(f.db, f.actor, f.input([numeric('12')], { extraParts }))).rejects.toMatchObject({ code });
        expect(await f.state()).toEqual(before);
    }
    await expect(importer.preview(f.db, f.actor, { ...f.input([numeric('12')]), sourceName: 'macro.xlsm' })).rejects.toMatchObject({ code: 'IMPORT_XLSX_INVALID' });
    expect(await f.state()).toEqual(before);
});
