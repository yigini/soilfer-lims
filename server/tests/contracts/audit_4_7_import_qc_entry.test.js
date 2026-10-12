const { randomUUID } = require('node:crypto');
const { qcGateFixture } = require('../helpers/qcGateFixture');
const { buildNativeRun, startNativeRun } = require('../../services/qcNativeRunService');
const { writeNativeMeasurements } = require('../../services/qcNativeMeasurementService');
const { commitQcMeasurements } = require('../../services/instrumentImportQcService');
const { saveTemplate } = require('../../services/instrumentImportTemplateService');
const owned = [];
afterEach(async () => { for (const f of owned.splice(0)) await f.close(); });
async function fixture() {
    const f = await qcGateFixture({ criteria: { blankPerBatch: 1, lrmPerBatch: 0, duplicateEvery: 0, crmEveryNBatches: 0, ccvEvery: 0 } });
    owned.push(f); f.run = await startNativeRun(f.db, (await buildNativeRun(f.db, f.actor, f.input)).id, f.actor);
    f.blank = f.run.positions.find(row => row.kind === 'BLANK'); expect(f.blank).toBeDefined();
    const template = await saveTemplate(f.db, f.actor, { labId: f.labId, instrumentId: f.instrument.id, name: 'Owned native QC columns',
        supersedesId: null, expectedVersion: 0, mapping: { version: 1, delimiter: 'COMMA', hasHeader: true,
            idType: 'POSITION', idColumn: 0, analytes: [{ analysisCode: f.analysisCode, valueColumn: 1, unit: 'fixture-unit' }] } });
    f.receipt = await f.db.instrumentImportReceipt.create({ data: { id: randomUUID(), labId: f.labId, instrumentId: f.instrument.id,
        templateId: template.id, templateVersion: template.version, sourceSha256: 'a'.repeat(64), sourceName: 'owned-qc.csv',
        mappingSnapshot: JSON.stringify({ batchId: f.run.id, rows: [{ cells: [String(f.blank.position), '0.0000'] }] }),
        importedBy: f.actor.username } });
    f.measurements = [{ positionId: f.blank.id, value: '0.0000' }];
    f.state = async () => JSON.parse(JSON.stringify(await Promise.all(['batch', 'batchAnalyte', 'qcMeasurement', 'qcEvaluation', 'batchEvent', 'auditLog',
        'result', 'nonconformityReport', 'batchPositionReference'].map(table => f.db[table].findMany({ orderBy: { id: 'asc' } })))));
    return f;
}
test('importing the last required QC value leaves pending evidence and a receipt-bound event/audit until explicit evaluation', async () => {
    const f = await fixture();
    const item = await f.db.workItem.findUnique({ where: { id: f.items[0].id } }); await f.result(item);
    const original = await f.db.result.findMany(), references = await f.db.batchPositionReference.findMany();
    const imported = await commitQcMeasurements(f.db, f.actor, { batchId: f.run.id, importReceiptId: f.receipt.id,
        analysisCode: f.analysisCode, measurements: f.measurements });
    expect(imported.analytes[0].status).toBe('QC_PENDING'); expect(await f.db.qcEvaluation.count()).toBe(0);
    expect(await f.db.result.findMany()).toEqual(original); expect(await f.db.batchPositionReference.findMany()).toEqual(references);
    expect(await f.db.nonconformityReport.count()).toBe(0);
    const observation = await f.db.qcMeasurement.findFirst(); expect(observation).toMatchObject({ rawInput: '0.0000', supersededById: null });
    const events = await f.db.batchEvent.findMany({ where: { type: 'QC_ENTERED' } }); expect(events).toHaveLength(1);
    expect(JSON.parse(events[0].payload)).toMatchObject({ evaluations: [], entryMode: 'INSTRUMENT_IMPORT', importReceiptId: f.receipt.id });
    const audits = await f.db.auditLog.findMany({ where: { entityId: f.run.id } });
    expect(audits.some(row => { try { return JSON.parse(row.details).operation === 'MEASUREMENT_WRITE'; } catch { return false; } })).toBe(true);
    const evaluated = await writeNativeMeasurements(f.db, f.run.id, f.actor, { analysisCode: f.analysisCode }, { explicit: true });
    expect(evaluated.analytes[0]).toMatchObject({ status: 'QC_PASS', result: 'PASS' }); expect(await f.db.qcEvaluation.count()).toBe(1);
    expect(await f.db.qcMeasurement.findUnique({ where: { id: observation.id } })).toEqual(observation);
});
test.each([
    [{ references: [] }, {}], [{ expectedValues: {} }, {}], [{ mode: 'REVIEWED_CORRECTION' }, {}], [{ reason: 'Correction' }, {}],
    [{ measurements: [] }, {}], [{}, { correction: true }], [{}, { explicit: true }], [{}, { entryOnly: 'yes' }],
    [{}, { importReceiptId: null }], [{}, { importReceiptId: 'unavailable' }]
])('invalid internal entry-only combination refuses atomically: %j %j', async (input, options) => {
    const f = await fixture(), before = await f.state();
    await expect(writeNativeMeasurements(f.db, f.run.id, f.actor, { analysisCode: f.analysisCode, measurements: f.measurements, ...input },
        { entryOnly: true, importReceiptId: f.receipt.id, ...options })).rejects.toMatchObject({ statusCode: 400, code: 'QC_IMPORT_ENTRY_ONLY_INVALID' });
    expect(await f.state()).toEqual(before);
});
test('already evaluated native analyte refuses imported values without changing retained evidence', async () => {
    const f = await fixture();
    await writeNativeMeasurements(f.db, f.run.id, f.actor, { analysisCode: f.analysisCode, measurements: f.measurements });
    expect(await f.db.qcEvaluation.count()).toBe(1); const before = await f.state();
    await expect(commitQcMeasurements(f.db, f.actor, { batchId: f.run.id, importReceiptId: f.receipt.id,
        analysisCode: f.analysisCode, measurements: f.measurements })).rejects.toMatchObject({ statusCode: 409, code: 'QC_IMPORT_ANALYTE_EVALUATED' });
    expect(await f.state()).toEqual(before);
});
test('a current unevaluated QC value cannot be overwritten by another import', async () => {
    const f = await fixture(), command = { batchId: f.run.id, importReceiptId: f.receipt.id, analysisCode: f.analysisCode, measurements: f.measurements };
    await commitQcMeasurements(f.db, f.actor, command); const before = await f.state();
    await expect(commitQcMeasurements(f.db, f.actor, command)).rejects.toMatchObject({ code: 'QC_CORRECTION_REASON_REQUIRED' });
    expect(await f.state()).toEqual(before);
});
