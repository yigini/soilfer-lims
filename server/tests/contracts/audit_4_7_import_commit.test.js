const request = require('supertest');
const { randomUUID } = require('node:crypto');
const { qcGateFixture } = require('../helpers/qcGateFixture');
const { withQcRunHttp } = require('../helpers/qcRunHttpHarness');
const { buildNativeRun, startNativeRun } = require('../../services/qcNativeRunService');
const { saveTemplate } = require('../../services/instrumentImportTemplateService');
const { saveDraft } = require('../../services/draftService');
const importer = require('../../services/instrumentImportService');
const owned = [];
afterEach(async () => { for (const f of owned.splice(0)) await f.close(); });
async function fixture() {
    const f = await qcGateFixture({ count: 2, criteria: { blankPerBatch: 1, lrmPerBatch: 0, duplicateEvery: 0, crmEveryNBatches: 0, ccvEvery: 0 } });
    owned.push(f);
    await f.db.equipmentQualification.create({ data: { id: randomUUID(), equipmentId: f.instrument.id, labId: f.labId,
        calibrationStatus: 'OK', verificationStatus: 'OK', nextCalibrationDueDate: new Date('2099-01-01') } });
    f.run = await startNativeRun(f.db, (await buildNativeRun(f.db, f.actor, f.input)).id, f.actor);
    f.samples = await f.db.sample.findMany({ where: { id: { in: f.items.map(item => item.sampleId) } }, orderBy: { id: 'asc' } });
    f.blank = f.run.positions.find(row => row.kind === 'BLANK');
    f.template = await saveTemplate(f.db, f.actor, { labId: f.labId, instrumentId: f.instrument.id, name: 'Owned atomic source mapping',
        supersedesId: null, expectedVersion: 0, mapping: { version: 1, delimiter: 'SEMICOLON', hasHeader: true,
            idType: 'ORIGINAL_ID', idColumn: 0, analytes: [{ analysisCode: f.analysisCode, valueColumn: 1, unitColumn: 2, dilutionColumn: 3 }],
            qcDetector: { positionColumn: 4, prefixes: [{ prefix: 'BLK', kind: 'BLANK' }] } } });
    f.rows = [['unknown-id', '7', 'fixture-unit', '1', ''], ...f.samples.map(sample =>
        [sample.originalId, ' 0007.1000 ', 'fixture-unit', '1', '']), ['BLK-A', '0.0000', 'fixture-unit', '1', String(f.blank.position)]];
    f.input = (rows = f.rows) => ({ batchId: f.run.id, templateId: f.template.id, sourceName: 'owned-source.csv',
        bytes: Buffer.from('id;value;unit;dilution;position\n' + rows.map(row => row.join(';')).join('\n') + '\n') });
    f.state = async () => JSON.parse(JSON.stringify(await Promise.all([f.snapshot(), f.db.workItemDraft.findMany(),
        f.db.instrumentImportReceipt.findMany(), f.db.workAttempt.findMany(), f.db.qcMeasurement.findMany(), f.db.qcEvaluation.findMany()])));
    return f;
}

test('preview is read-only; commit saves exact sample drafts, pending QC and a complete immutable source receipt', async () => {
    const f = await fixture(), before = await f.state(), input = f.input();
    const preview = await importer.preview(f.db, f.actor, input);
    expect(preview.canCommit).toBe(true); expect(preview.refusals).toEqual([]); expect(await f.state()).toEqual(before);
    expect(preview.rows[0]).toMatchObject({ status: 'SKIPPED_UNMATCHED', cells: f.rows[0] });
    const result = await importer.commit(f.db, f.actor, { ...input, previewToken: preview.previewToken });
    expect(result).toMatchObject({ draftCount: 2, qcCount: 1 });
    const drafts = await f.db.workItemDraft.findMany(); expect(drafts).toHaveLength(2);
    for (const draft of drafts) expect(draft).toMatchObject({ value: ' 0007.1000 ', importReceiptId: result.receiptId });
    expect(await f.db.result.count()).toBe(0); expect(await f.db.qcEvaluation.count()).toBe(0);
    expect((await f.db.batchAnalyte.findFirst()).status).toBe('QC_PENDING');
    expect(await f.db.qcMeasurement.findFirst()).toMatchObject({ rawInput: '0.0000', positionId: f.blank.id });
    const receipt = await f.db.instrumentImportReceipt.findUnique({ where: { id: result.receiptId } });
    expect(receipt).toMatchObject({ sourceName: input.sourceName, sourceSha256: preview.sourceSha256, templateVersion: 1 });
    const snapshot = JSON.parse(receipt.mappingSnapshot); expect(snapshot.rows.map(row => row.cells)).toEqual(f.rows);
    expect(snapshot.rows[0].status).toBe('SKIPPED_UNMATCHED');
    expect(snapshot.rows[1].plans[0].evidence).toMatchObject({ rawValue: ' 0007.1000 ', rawUnit: 'fixture-unit', rawDilution: '1',
        reportingUnit: { unitCode: 'fixture-unit', matchedField: 'unitCode' } });
    const committed = await f.state();
    await expect(importer.commit(f.db, f.actor, { ...input, previewToken: preview.previewToken }))
        .rejects.toMatchObject({ code: 'IMPORT_DRAFT_EXISTS' });
    expect(await f.state()).toEqual(committed);
});

test('two bad matched rows and valid sample/QC values refuse the whole file and list every row with zero writes', async () => {
    const f = await fixture(), rows = f.rows.map(row => [...row]); rows[1][2] = 'wrong-unit'; rows[2][1] = 'not-numeric';
    const input = f.input(rows), before = await f.state(), preview = await importer.preview(f.db, f.actor, input);
    expect(preview.canCommit).toBe(false);
    expect(preview.refusals).toEqual(expect.arrayContaining([{ rowNumber: 3, analysisCode: f.analysisCode,
        code: 'IMPORT_UNIT_MISMATCH', message: expect.any(String), statusCode: 409 }, { rowNumber: 4, analysisCode: f.analysisCode,
        code: 'INVALID_NUMBER', message: expect.any(String), statusCode: 400 }]));
    await expect(importer.commit(f.db, f.actor, { ...input, previewToken: preview.previewToken }))
        .rejects.toMatchObject({ code: 'IMPORT_UNIT_MISMATCH', details: { refusedRows: preview.refusals } });
    expect(await f.state()).toEqual(before);
});

test('zero matches and duplicate destinations are explicit refusals, never a skipped ambiguity or partial receipt', async () => {
    const f = await fixture(), before = await f.state();
    for (const [rows, code] of [[[f.rows[0]], 'IMPORT_NO_MATCHED_ROWS'], [[f.rows[1], f.rows[1], f.rows[3]], 'IMPORT_MATCH_AMBIGUOUS']]) {
        const input = f.input(rows), preview = await importer.preview(f.db, f.actor, input);
        expect(preview.canCommit).toBe(false);
        await expect(importer.commit(f.db, f.actor, { ...input, previewToken: preview.previewToken })).rejects.toMatchObject({ code });
        expect(await f.state()).toEqual(before);
    }
});

test('a draft appearing after preview is rechecked at commit and retains every saved raw input', async () => {
    const f = await fixture(), input = f.input(), preview = await importer.preview(f.db, f.actor, input);
    const item = await f.db.workItem.findUnique({ where: { id: f.items[0].id } });
    await saveDraft(f.actor, { workItemId: item.id, value: 'retained post-preview draft', instrumentId: f.instrument.id }, f.db);
    const before = await f.state();
    await expect(importer.commit(f.db, f.actor, { ...input, previewToken: preview.previewToken })).rejects.toMatchObject({ code: 'IMPORT_DRAFT_EXISTS' });
    expect(await f.state()).toEqual(before);
});

test('changing the exact file, actor or preview signature cannot authorize a commit', async () => {
    const f = await fixture(), input = f.input(), preview = await importer.preview(f.db, f.actor, input), before = await f.state();
    await expect(importer.commit(f.db, f.actor, { ...input, bytes: Buffer.concat([input.bytes, Buffer.from('extra')]), previewToken: preview.previewToken }))
        .rejects.toMatchObject({ code: 'IMPORT_PREVIEW_INVALID' });
    await expect(importer.commit(f.db, { ...f.actor, username: 'another-actor' }, { ...input, previewToken: preview.previewToken }))
        .rejects.toMatchObject({ code: 'IMPORT_PREVIEW_INVALID' });
    await expect(importer.commit(f.db, f.actor, { ...input, previewToken: preview.previewToken + 'x' })).rejects.toMatchObject({ code: 'IMPORT_PREVIEW_INVALID' });
    expect(await f.state()).toEqual(before);
});

test('mounted multipart preview and commit use actual token/permission/run owners; HTTP cannot claim receipt authority', async () => {
    const f = await fixture(), input = f.input();
    await withQcRunHttp(f.db, f.actor, async (app, token) => {
        const route = '/api/workbench/runs/' + f.run.id + '/imports/';
        const preview = await request(app).post(route + 'preview').set('Authorization', 'Bearer ' + token)
            .field('templateId', f.template.id).attach('file', input.bytes, input.sourceName);
        expect(preview.status).toBe(200); expect(preview.body.canCommit).toBe(true);
        const before = await f.state();
        const forged = await request(app).post(route + 'commit').set('Authorization', 'Bearer ' + token)
            .field('templateId', f.template.id).field('importReceiptId', 'forged').attach('file', input.bytes, input.sourceName);
        expect(forged.status).toBe(400); expect(await f.state()).toEqual(before);
        const committed = await request(app).post(route + 'commit').set('Authorization', 'Bearer ' + token)
            .field('templateId', f.template.id).field('previewToken', preview.body.previewToken).attach('file', input.bytes, input.sourceName);
        expect(committed.status).toBe(201); expect(committed.body).toMatchObject({ draftCount: 2, qcCount: 1 });
    }, { workbench: true });
});

test('mounted wizard context reads only the actual scoped native instrument/run metadata and persisted templates', async () => {
    const f = await fixture(), before = await f.state();
    await withQcRunHttp(f.db, f.actor, async (app, token) => {
        const response = await request(app).get('/api/workbench/runs/' + f.run.id + '/imports/context').set('Authorization', 'Bearer ' + token);
        expect(response.status).toBe(200); expect(response.body).toMatchObject({ batchId: f.run.id, labId: f.labId, instrumentId: f.instrument.id,
            analyses: [{ analysisCode: f.analysisCode, methodologyId: f.method.id, reportingUnits: ['fixture-unit'], active: null, inputs: null }],
            templates: [{ id: f.template.id, version: 1, mapping: f.template.mapping }] });
        expect(await f.state()).toEqual(before);
    }, { workbench: true });
    const lab = await f.db.lab.create({ data: { id: randomUUID(), code: randomUUID(), name: 'Other owned context lab', country: 'ZZ' } });
    const actor = await f.db.user.create({ data: { id: randomUUID(), username: randomUUID(), email: randomUUID() + '@example.test', password: 'synthetic', role: 'LAB_TECHNICIAN', labId: lab.id } });
    const foreignBefore = await f.state();
    await withQcRunHttp(f.db, actor, async (app, token) => {
        const response = await request(app).get('/api/workbench/runs/' + f.run.id + '/imports/context').set('Authorization', 'Bearer ' + token);
        expect(response.status).toBe(403); expect(await f.state()).toEqual(foreignBefore);
    }, { workbench: true });
});
