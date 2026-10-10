const { randomUUID } = require('node:crypto');
const { qcGateFixture } = require('../helpers/qcGateFixture');
const { createWorkItemFixture } = require('../helpers/workflowFixtures');
const { xlsxWorkbook, xmlAttribute } = require('../helpers/instrumentXlsxBytes');
const { referenceRows } = require('../../services/calculationReferenceLibrary');
const templates = require('../../services/calculationTemplateService');
const activations = require('../../services/calculationActivationService');
const curves = require('../../services/calibrationCurveService');
const writer = require('../../services/resultWriteService');
const native = require('../../services/qcNativeRunService');
const rules = require('../../services/qcRuleService');
const { saveTemplate } = require('../../services/instrumentImportTemplateService');
const importer = require('../../services/instrumentImportService');
let owned;
afterEach(async () => { if (owned) await owned.close(); owned = null; });
async function fixture() {
    const criteria = { blankPerBatch: 0, lrmPerBatch: 0, duplicateEvery: 0, crmEveryNBatches: 0, ccvEvery: 0, curveMinPoints: 3, curveMinR: 0.995 };
    const f = owned = await qcGateFixture({ criteria });
    await f.setPolicy([{ key: 'numbers.decimalSeparator', value: ',' }, { key: 'numbers.thousandsSeparator', value: '.' }]);
    await f.db.equipmentQualification.create({ data: { id: randomUUID(), equipmentId: f.instrument.id, labId: f.labId,
        calibrationStatus: 'OK', verificationStatus: 'OK', nextCalibrationDueDate: new Date('2099-01-01') } });
    const sampleId = f.items[0].sampleId, selections = []; f.calculated = [];
    for (const code of ['EXCH_CA', 'P_OLSEN']) {
        const method = await f.db.methodology.create({ data: { analysisCode: code, name: 'Owned verified ' + code + ' SOP', version: 3 } });
        await rules.change(f.actor, { labId: f.labId, analysisCode: code, methodologyId: method.id, criteria,
            expectedVersion: 0, reason: 'Explicit synthetic input-import method criteria' }, { db: f.db });
        const source = referenceRows().find(row => row.analysisCode === code);
        const template = await templates.clone(f.db, f.actor, source.id, { labId: f.labId, methodologyId: method.id, expectedVersion: source.version,
            outputDecimals: 2, sopCitation: 'Synthetic lab SOP input-import §9, two decimals', reason: 'Owned local method verified for acceptance' });
        const activation = await activations.change(f.db, f.actor, template.id, { labId: f.labId, analysisCode: code, methodologyId: method.id,
            expectedVersion: template.version, expectedActivationId: null, action: 'ACTIVATE', verifiedAgainstSop: true, reason: 'Owned SOP verification' });
        const item = await createWorkItemFixture(f.db, { data: { id: randomUUID(), sampleId, labId: f.labId, analysis: code,
            methodologyId: method.id, status: 'IN_PROGRESS' } });
        f.calculated.push({ code, method, template, activation, item, source }); selections.push({ analysisCode: code, methodologyId: method.id });
    }
    f.run = await native.startNativeRun(f.db, (await native.buildNativeRun(f.db, f.actor, { instrumentId: f.instrument.id,
        workItemIds: f.calculated.map(row => row.item.id), analyses: selections, seed: 'owned-input-import' })).id, f.actor);
    const phosphorus = f.calculated[1];
    f.curve = await curves.recordCurve(f.db, f.run.id, f.actor, { analysisCode: phosphorus.code, templateId: phosphorus.template.id,
        templateVersion: phosphorus.template.version, activationId: phosphorus.activation.id, expectedCurveId: null,
        points: [{ standardConcentration: 0, response: 1 }, { standardConcentration: 1, response: 3 }, { standardConcentration: 2, response: 5 }] });
    f.sample = await f.db.sample.findUnique({ where: { id: sampleId } });
    const raw = { reading: '1.234', absorbance: '3.0000', blankConcentration: '0.0000', extractVolume: '20.0000', dilutionFactor: '2.0000',
        sampleMass: '1.0000', moistureCorrectionFactor: '1.0000' };
    let column = 1;
    f.mapping = { version: 1, delimiter: 'COMMA', hasHeader: false, idType: 'ORIGINAL_ID', idColumn: 0,
        analytes: f.calculated.map(row => ({ analysisCode: row.code, inputs: row.source.inputs.map(input => ({ variable: input.key, column: column++, unit: input.unit })) })) };
    f.cells = [f.sample.originalId];
    const xml = f.mapping.analytes.flatMap(row => row.inputs.map(input => {
        f.cells[input.column] = raw[input.variable]; return `<c r="${String.fromCharCode(65 + input.column)}1"><v>${raw[input.variable]}</v></c>`;
    })).join('');
    f.input = { batchId: f.run.id, sourceName: 'raw-inputs.xlsx', bytes: xlsxWorkbook({ sheets: [{ name: 'Raw', xml: '<sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>' +
        xmlAttribute(f.sample.originalId) + '</t></is></c>' + xml + '</row></sheetData>' }] }) };
    f.save = mapping => saveTemplate(f.db, f.actor, { labId: f.labId, instrumentId: f.instrument.id, name: 'Owned activated input mapping', supersedesId: null,
        expectedVersion: 0, mapping });
    f.importTemplate = await f.save(f.mapping); f.input.templateId = f.importTemplate.id;
    f.state = async () => JSON.parse(JSON.stringify(await Promise.all([f.snapshot(), f.db.workItemDraft.findMany(), f.db.instrumentImportReceipt.findMany(),
        f.db.resultCalculation.findMany(), f.db.calibrationCurve.findMany(), f.db.calibrationPoint.findMany(), f.db.workAttempt.findMany(),
        f.db.qcMeasurement.findMany(), f.db.qcEvaluation.findMany()])));
    return f;
}

test('actual EXCH_CA/Olsen activated input imports do not calculate; later typed recording freezes the selected local definitions and verified raw input text', async () => {
    const f = await fixture(), before = await f.state(), preview = await importer.preview(f.db, f.actor, f.input);
    expect(preview.canCommit).toBe(true); expect(preview.rows[0].cells).toEqual(Object.fromEntries(f.cells.map((raw, column) => [column, raw])));
    expect(await f.state()).toEqual(before);
    const committed = await importer.commit(f.db, f.actor, { ...f.input, previewToken: preview.previewToken }); expect(committed).toMatchObject({ draftCount: 2, qcCount: 0 });
    expect(await f.db.result.count()).toBe(0); expect(await f.db.resultCalculation.count()).toBe(0); expect(await f.db.qcEvaluation.count()).toBe(0);
    const receipt = await f.db.instrumentImportReceipt.findFirst(), snapshot = JSON.parse(receipt.mappingSnapshot);
    for (const row of f.calculated) {
        const draft = await f.db.workItemDraft.findUnique({ where: { workItemId: row.item.id } }), calculation = JSON.parse(draft.values).calculation;
        expect(draft.value).toBe(''); expect(calculation).toMatchObject({ templateId: row.template.id, templateVersion: row.template.version, activationId: row.activation.id });
        const mapping = f.mapping.analytes.find(item => item.analysisCode === row.code);
        for (const input of mapping.inputs) expect(calculation.inputs[input.variable]).toBe(f.cells[input.column].replace('.', ','));
        const plan = snapshot.rows[0].plans.find(item => item.analysisCode === row.code);
        expect(plan.evidence.activation).toMatchObject({ templateId: row.template.id, activationId: row.activation.id });
        for (const input of mapping.inputs) expect(plan.evidence.cells.find(cell => cell.column === input.column)).toMatchObject({ rawLexeme: f.cells[input.column],
            labText: calculation.inputs[input.variable], numberPolicyVersion: 1 });
        const output = await writer.previewResultCalculation(f.db, { sampleId: f.sample.id, workItemId: row.item.id, actor: f.actor, inputs: calculation.inputs });
        const result = await f.db.$transaction(tx => writer.writeResult(tx, { sampleId: f.sample.id, workItemId: row.item.id, actor: f.actor,
            measurement: { param: row.code, value: output.calculation.output, calculation: { ...calculation, ...(row.code === 'P_OLSEN' && { curveId: f.curve.id }) } } }));
        const frozen = await f.db.resultCalculation.findUnique({ where: { resultId: result.id } });
        expect(frozen).toMatchObject({ templateId: row.template.id, templateVersion: row.template.version, activationId: row.activation.id,
            curveId: row.code === 'P_OLSEN' ? f.curve.id : null });
        expect(JSON.parse(frozen.inputs)).toEqual(calculation.inputs); expect(result.numericValue).toBe(output.calculation.output);
    }
    expect(await f.db.result.count()).toBe(2); expect(await f.db.resultCalculation.count()).toBe(2);
    expect(await f.db.instrumentImportReceipt.findFirst()).toEqual(receipt);
});

test('missing/duplicate/unknown activated variables, output-unit input guesses and active direct-value mappings refuse the whole commit', async () => {
    const f = await fixture();
    for (const [edit, code] of [
        [mapping => mapping.analytes[0].inputs.pop(), 'IMPORT_TEMPLATE_BINDING_REQUIRED'],
        [mapping => mapping.analytes[0].inputs[1].variable = mapping.analytes[0].inputs[0].variable, 'IMPORT_TEMPLATE_BINDING_REQUIRED'],
        [mapping => mapping.analytes[0].inputs[0].variable = 'guessed', 'IMPORT_TEMPLATE_BINDING_REQUIRED'],
        [mapping => mapping.analytes[0].inputs[0].unit = 'cmol(+)/kg', 'IMPORT_UNIT_MISMATCH'],
        [mapping => mapping.analytes[0] = { analysisCode: 'EXCH_CA', valueColumn: 1, unit: 'cmol(+)/kg' }, 'IMPORT_TEMPLATE_MAPPING_INVALID']
    ]) {
        const mapping = JSON.parse(JSON.stringify(f.mapping)); edit(mapping); const template = await f.save(mapping);
        const input = { ...f.input, templateId: template.id }, before = await f.state(), preview = await importer.preview(f.db, f.actor, input);
        expect(preview.canCommit).toBe(false); expect(preview.refusals).toEqual(expect.arrayContaining([expect.objectContaining({ analysisCode: 'EXCH_CA', code })]));
        await expect(importer.commit(f.db, f.actor, { ...input, previewToken: preview.previewToken })).rejects.toMatchObject({ code });
        expect(await f.state()).toEqual(before);
    }
});

test('a calculation deactivation after preview refuses before any receipt, raw draft or scientific evidence is created', async () => {
    const f = await fixture(), preview = await importer.preview(f.db, f.actor, f.input), row = f.calculated[0];
    await activations.change(f.db, f.actor, row.template.id, { labId: f.labId, analysisCode: row.code, methodologyId: row.method.id,
        expectedVersion: row.template.version, expectedActivationId: row.activation.id, action: 'DEACTIVATE', verifiedAgainstSop: true, reason: 'Owned future-input SOP decision' });
    const before = await f.state();
    await expect(importer.commit(f.db, f.actor, { ...f.input, previewToken: preview.previewToken })).rejects.toMatchObject({ code: 'IMPORT_TEMPLATE_ACTIVATION_CHANGED' });
    expect(await f.state()).toEqual(before);
});
