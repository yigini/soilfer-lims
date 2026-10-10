const { randomUUID } = require('node:crypto');
const { qcGateFixture } = require('../helpers/qcGateFixture');
const { createWorkItemFixture } = require('../helpers/workflowFixtures');
const { buildNativeRun, startNativeRun } = require('../../services/qcNativeRunService');
const { saveTemplate } = require('../../services/instrumentImportTemplateService');
const references = require('../../services/referenceMaterialService');
const rules = require('../../services/qcRuleService');
const importer = require('../../services/instrumentImportService');
let owned;
afterEach(async () => { if (owned) await owned.close(); owned = null; });

test('one real ICP CSV places40 samples by four analytes and six native QC rows without recording or evaluating', async () => {
    const criteria = { maxBatchSize: 40, blankPerBatch: 2, lrmPerBatch: 4, duplicateEvery: 0, crmEveryNBatches: 0, ccvEvery: 0 };
    const f = owned = await qcGateFixture({ count: 40, criteria });
    await f.setPolicy([{ key: 'qc.calibrationVerification', value: false }]);
    await f.db.equipmentAsset.update({ where: { id: f.instrument.id }, data: { assetType: 'ICP', name: 'Owned ICP instrument' } });
    await f.db.equipmentQualification.create({ data: { id: randomUUID(), equipmentId: f.instrument.id, labId: f.labId,
        calibrationStatus: 'OK', verificationStatus: 'OK', nextCalibrationDueDate: new Date('2099-01-01') } });
    const codes = [f.analysisCode], items = [...f.items], methods = [f.method];
    for (const label of ['Mg', 'K', 'Na']) {
        const code = 'ICP-' + label + '-' + randomUUID(); codes.push(code);
        await f.db.analysis.create({ data: { code, name: 'Owned ICP ' + label, unitCode: 'fixture-unit' } });
        const method = await f.db.methodology.create({ data: { analysisCode: code, name: 'Owned direct ICP method', loq: 0.1 } }); methods.push(method);
        await rules.change(f.actor, { labId: f.labId, analysisCode: code, methodologyId: method.id,
            criteria, expectedVersion: 0, reason: 'Explicit synthetic forty-sample ICP criteria' }, { db: f.db });
        for (const item of f.items) items.push(await createWorkItemFixture(f.db, { data: { id: randomUUID(), sampleId: item.sampleId,
            labId: f.labId, analysis: code, methodologyId: method.id, status: 'IN_PROGRESS' } }));
    }
    const lot = await references.createMaterial(f.db, f.actor, { labId: f.labId, code: 'ICP-' + randomUUID(), name: 'Owned ICP check lot',
        kind: 'LRM', matrix: 'SOIL', lotNumber: 'synthetic-acceptance', status: 'ACTIVE', expiryDate: '2099-01-01T00:00:00.000Z' });
    for (const code of codes) await references.addValue(f.db, f.actor, lot.id, { analysisCode: code, assignedValue: '7.0000', unit: 'fixture-unit', valueType: 'LAB_ASSIGNED' });
    const run = await startNativeRun(f.db, (await buildNativeRun(f.db, f.actor, { instrumentId: f.instrument.id, workItemIds: items.map(item => item.id),
        seed: 'owned-icp-acceptance', analyses: codes.map((analysisCode, index) => ({ analysisCode, methodologyId: methods[index].id,
            references: [{ positionKind: 'LRM', referenceMaterialLotId: lot.id }] })) })).id, f.actor);
    const controls = run.positions.filter(position => position.kind !== 'SAMPLE'); expect(controls).toHaveLength(6);
    expect(controls.map(position => position.kind)).toEqual(['BLANK', 'BLANK', 'LRM', 'LRM', 'LRM', 'LRM']);
    expect(run.positions.filter(position => position.kind === 'SAMPLE')).toHaveLength(40);
    const template = await saveTemplate(f.db, f.actor, { labId: f.labId, instrumentId: f.instrument.id, name: 'Owned four-analyte ICP source',
        supersedesId: null, expectedVersion: 0, mapping: { version: 1, delimiter: 'COMMA', hasHeader: true, idType: 'ORIGINAL_ID', idColumn: 0,
            analytes: codes.map((analysisCode, index) => ({ analysisCode, valueColumn: index + 1, unitColumn: 5, dilutionColumn: 6 })),
            qcDetector: { positionColumn: 7, prefixes: [{ prefix: 'BLK-', kind: 'BLANK' }, { prefix: 'LRM-', kind: 'LRM' }] } } });
    const samples = await f.db.sample.findMany({ where: { id: { in: f.items.map(item => item.sampleId) } }, orderBy: { id: 'asc' } });
    const rows = [['unknown-export-id', '1', '2', '3', '4', 'fixture-unit', '1', ''], ...samples.map((sample, index) =>
        [sample.originalId, ...codes.map((_, analyte) => ' ' + (index + 1) + '.' + String(analyte).padStart(4, '0') + ' '), 'fixture-unit', '1.0000', '']),
        ...controls.map((position, index) => [position.kind === 'BLANK' ? 'BLK-' + index : 'LRM-' + index,
            ...codes.map((_, analyte) => position.kind === 'BLANK' ? '0.0000' : '7.' + String(index * 4 + analyte).padStart(4, '0')),
            'fixture-unit', '1', String(position.position)])];
    const input = { batchId: run.id, templateId: template.id, sourceName: 'forty-by-four-icp.csv',
        bytes: Buffer.from('id,Ca,Mg,K,Na,unit,dilution,position\n' + rows.map(row => row.join(',')).join('\n') + '\n') };
    const before = { workflow: await f.snapshot(), references: await f.db.batchPositionReference.findMany(), materials: await f.db.referenceMaterial.findMany(),
        values: await f.db.referenceValue.findMany(), items: await f.db.workItem.findMany(), attempts: await f.db.workAttempt.findMany() };
    const preview = await importer.preview(f.db, f.actor, input); expect(preview.canCommit).toBe(true); expect(preview.refusals).toEqual([]);
    expect(await f.snapshot()).toEqual(before.workflow); expect(preview.rows[0]).toMatchObject({ status: 'SKIPPED_UNMATCHED', cells: rows[0] });
    expect(preview.rows.filter(row => row.match.kind === 'SAMPLE')).toHaveLength(40); expect(preview.rows.filter(row => row.match.kind === 'QC')).toHaveLength(6);
    const result = await importer.commit(f.db, f.actor, { ...input, previewToken: preview.previewToken }); expect(result).toMatchObject({ draftCount: 160, qcCount: 24 });
    const drafts = await f.db.workItemDraft.findMany(); expect(drafts).toHaveLength(160);
    for (const [index, sample] of samples.entries()) for (const [analyte, code] of codes.entries())
        expect(drafts.find(draft => draft.sampleId === sample.id && draft.analysis === code)).toMatchObject({ value: rows[index + 1][analyte + 1], importReceiptId: result.receiptId });
    const observations = await f.db.qcMeasurement.findMany(); expect(observations).toHaveLength(24);
    for (const [index, position] of controls.entries()) for (const [analyte, code] of codes.entries())
        expect(observations.find(row => row.positionId === position.id && row.analysisCode === code)).toMatchObject({ rawInput: rows[index + 41][analyte + 1], supersededById: null });
    const receipt = await f.db.instrumentImportReceipt.findFirst(); expect(JSON.parse(receipt.mappingSnapshot).rows.map(row => row.cells)).toEqual(rows);
    expect(await f.db.result.count()).toBe(0); expect(await f.db.qcEvaluation.count()).toBe(0); expect(await f.db.nonconformityReport.count()).toBe(0);
    expect(await f.db.workAttempt.findMany()).toEqual(before.attempts); expect(await f.db.workItem.findMany()).toEqual(before.items);
    expect(await f.db.batchPositionReference.findMany()).toEqual(before.references); expect(await f.db.referenceMaterial.findMany()).toEqual(before.materials);
    expect(await f.db.referenceValue.findMany()).toEqual(before.values);
    expect((await f.db.batchAnalyte.findMany()).map(row => row.status)).toEqual(['QC_PENDING', 'QC_PENDING', 'QC_PENDING', 'QC_PENDING']);
    const afterAudits = JSON.parse(JSON.stringify(await f.db.auditLog.findMany()));
    for (const old of before.workflow[5]) expect(afterAudits.find(row => row.id === old.id)).toEqual(old);
});
