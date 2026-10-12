const { randomUUID } = require('node:crypto');
const request = require('supertest');
const { qcGateFixture } = require('../helpers/qcGateFixture');
const { withQcRunHttp } = require('../helpers/qcRunHttpHarness');
const { buildNativeRun, startNativeRun } = require('../../services/qcNativeRunService');
const { saveTemplate } = require('../../services/instrumentImportTemplateService');
const { saveDraft } = require('../../services/draftService');
const { commitImportedDraft } = require('../../services/instrumentImportDraftService');
const owned = [];
afterEach(async () => { for (const f of owned.splice(0)) await f.close(); });
async function fixture() {
    const f = await qcGateFixture({ criteria: { blankPerBatch: 0, lrmPerBatch: 0, duplicateEvery: 0, crmEveryNBatches: 0, ccvEvery: 0 } });
    owned.push(f);
    await f.db.equipmentQualification.create({ data: { id: randomUUID(), equipmentId: f.instrument.id, labId: f.labId,
        calibrationStatus: 'OK', verificationStatus: 'OK', nextCalibrationDueDate: new Date('2099-01-01') } });
    f.run = await startNativeRun(f.db, (await buildNativeRun(f.db, f.actor, f.input)).id, f.actor);
    f.item = await f.db.workItem.findUnique({ where: { id: f.items[0].id } });
    const template = await saveTemplate(f.db, f.actor, { labId: f.labId, instrumentId: f.instrument.id,
        name: 'Owned draft raw columns', supersedesId: null, expectedVersion: 0,
        mapping: { version: 1, delimiter: 'COMMA', hasHeader: true, idType: 'POSITION', idColumn: 0,
            analytes: [{ analysisCode: f.analysisCode, valueColumn: 1, unit: 'fixture-unit' }] } });
    f.receipt = await f.db.instrumentImportReceipt.create({ data: { id: randomUUID(), labId: f.labId,
        instrumentId: f.instrument.id, templateId: template.id, templateVersion: template.version,
        sourceSha256: 'a'.repeat(64), sourceName: 'owned-draft.csv', importedBy: f.actor.username,
        mappingSnapshot: JSON.stringify({ batchId: f.run.id, rows: [{ cells: ['1', ' 0007.1000 '],
            match: { workItemIdsByAnalysis: { [f.analysisCode]: f.item.id } } }] }) } });
    f.command = { workItemId: f.item.id, sampleId: f.item.sampleId, analysis: f.analysisCode,
        value: ' 0007.1000 ', instrumentId: f.instrument.id, methodologyId: f.method.id, baseVersion: f.item.version };
    f.state = async () => JSON.parse(JSON.stringify(await Promise.all([
        f.snapshot(), f.db.workItemDraft.findMany(), f.db.instrumentImportReceipt.findMany(),
        f.db.workAttempt.findMany(), f.db.qcMeasurement.findMany(), f.db.qcEvaluation.findMany()
    ])));
    return f;
}

test.each([{ importReceiptId: 'forged' }, { receipt: {} }, { options: { importReceiptId: 'forged' } },
    { values: { calculation: { receiptId: 'forged' } } }])('ordinary draft owner refuses receipt fields before writing: %j', async fields => {
    const f = await fixture(), before = await f.state();
    await expect(saveDraft(f.actor, { ...f.command, ...fields }, f.db))
        .rejects.toMatchObject({ statusCode: 400, code: 'DRAFT_FIELDS_INVALID' });
    expect(await f.state()).toEqual(before);
});

test.each([{ importReceiptId: 'forged' }, { options: { importReceiptId: 'forged' } }])('mounted ordinary draft HTTP cannot reach the server receipt option: %j', async fields => {
    const f = await fixture(), before = await f.state();
    await withQcRunHttp(f.db, f.actor, async (app, token) => {
        const response = await request(app).post('/api/workbench/batch-save').set('Authorization', 'Bearer ' + token)
            .send({ draft: true, entries: [{ ...f.command, equipmentId: f.instrument.id }, { ...f.command, ...fields }] });
        expect(response.status).toBe(400); expect(response.body.code).toBe('DRAFT_FIELDS_INVALID');
    }, { workbench: true });
    expect(await f.state()).toEqual(before);
});

test('the server option binds exact raw input to its persisted receipt through the existing draft owner', async () => {
    const f = await fixture(), before = await f.db.result.findMany();
    const draft = await commitImportedDraft(f.db, f.actor, f.command, f.receipt.id);
    expect(draft).toMatchObject({ value: ' 0007.1000 ', importReceiptId: f.receipt.id, workItemId: f.item.id });
    expect(await f.db.result.findMany()).toEqual(before); expect(await f.db.qcMeasurement.count()).toBe(0);
    expect(await f.db.qcEvaluation.count()).toBe(0);
});

test.each(['populated', 'receipt-linked', 'empty'])('an existing %s draft blocks import and retains every row', async kind => {
    const f = await fixture();
    if (kind === 'receipt-linked') await commitImportedDraft(f.db, f.actor, f.command, f.receipt.id);
    else await saveDraft(f.actor, { ...f.command, value: kind === 'empty' ? null : 'retained raw' }, f.db);
    const before = await f.state();
    await expect(commitImportedDraft(f.db, f.actor, f.command, f.receipt.id))
        .rejects.toMatchObject({ statusCode: 409, code: 'IMPORT_DRAFT_EXISTS' });
    expect(await f.state()).toEqual(before);
});

test('a current Result refuses the imported draft with the existing sealed-line code and retains all evidence', async () => {
    const f = await fixture(); await f.result(f.item); const before = await f.state();
    await expect(commitImportedDraft(f.db, f.actor, f.command, f.receipt.id))
        .rejects.toMatchObject({ statusCode: 409, code: 'RESULT_WORKITEM_SEALED' });
    expect(await f.state()).toEqual(before);
});

test('an unavailable receipt refuses before writing; unknown non-receipt draft fields retain ordinary behavior', async () => {
    const f = await fixture(), before = await f.state();
    await expect(commitImportedDraft(f.db, f.actor, f.command, 'unavailable'))
        .rejects.toMatchObject({ statusCode: 400, code: 'DRAFT_FIELDS_INVALID' });
    expect(await f.state()).toEqual(before);
    const draft = await saveDraft(f.actor, { ...f.command, unrelated: { oldUnknownField: true } }, f.db);
    expect(draft).toMatchObject({ value: ' 0007.1000 ', importReceiptId: null });
});
