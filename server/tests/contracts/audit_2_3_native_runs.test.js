const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { PrismaClient } = require('../../prisma_client');
const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');
const Database = require('better-sqlite3');
const { beforeGuards } = require('../helpers/legacyWorkflowDatabase');
const { createSampleFixture, createWorkItemFixture } = require('../helpers/workflowFixtures');
const { installReferenceMaterials } = require('../../scripts/install_reference_materials');
const { installResultAttemptLinks } = require('../../scripts/install_result_attempt_links');
const { installSampleHolds } = require('../../scripts/install_sample_holds');
const { installQcRules } = require('../../scripts/install_qc_rules');
const { installQcRuns } = require('../../scripts/install_qc_runs');
const rules = require('../../services/qcRuleService');
const policies = require('../../services/policyService');
const { buildNativeRun, rebuildNativeRun, startNativeRun } = require('../../services/qcNativeRunService');
const { preparePositionBindings, applyPositionBindings } = require('../../services/qcRunReferenceService');
const { correctValue } = require('../../services/referenceMaterialService');
const { writeNativeMeasurements } = require('../../services/qcNativeMeasurementService');
const { createResultFixture } = require('../../services/resultWriteService');
const owned = [];

async function fixture(count = 1, criteria = { crmEveryNBatches: 0 }) {
    const labId = randomUUID(), analysisCode = `NATIVE-${randomUUID()}`, username = 'system:fixture';
    const historical = beforeGuards({ actor: username, schemaVariant: 'PRE_1_3_SAMPLE_CODES', relatedRows: {
        Lab: [{ id: labId, code: labId, name: 'Native run fixture', country: 'TEST', updatedAt: Date.now() }],
        User: [{ id: username, username, email: 'native@example.test', password: 'fixture', role: 'SUPER_ADMIN', updatedAt: Date.now() }]
    } });
    const { file } = historical;
    const ownedFile = { file, db: null }; owned.push(ownedFile);
    historical.applyPendingMigration({ migration: 'SAMPLE_CODES' });
    const connection = new Database(file, { fileMustExist: true });
    connection.exec('CREATE TABLE IF NOT EXISTS "_schema_migrations" ("id" TEXT PRIMARY KEY NOT NULL,"appliedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,"details" TEXT)');
    connection.close();
    installResultAttemptLinks({ dbPath: file, apply: true }); installSampleHolds({ dbPath: file, apply: true });
    installReferenceMaterials({ dbPath: file, apply: true }); installQcRules({ dbPath: file, apply: true });
    installQcRuns({ dbPath: file, apply: true });
    const db = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: `file:${file}` }) });
    ownedFile.db = db;
    await db.unit.create({ data: { code: 'fixture-unit', display: 'Fixture unit', quantityKind: 'MASS_FRACTION', factorToBase: 1 } });
    await db.analysis.create({ data: { code: analysisCode, name: 'Native fixture analyte', unitCode: 'fixture-unit' } });
    const method = await db.methodology.create({ data: { analysisCode, name: 'Recorded native method', loq: 0.123456789 } });
    const instrument = await db.equipmentAsset.create({ data: { id: randomUUID(), labId, name: 'Fixture instrument', assetType: 'OTHER', status: 'IN_SERVICE', criticality: 'NON_CRITICAL' } });
    const actor = { username, role: 'SUPER_ADMIN', labId }, f = { db, file, actor, labId, analysisCode, method, instrument };
    await rules.change(actor, { labId, analysisCode, methodologyId: method.id, criteria, expectedVersion: 0, reason: 'Reviewed fixture criteria' }, { db });
    f.workItemIds = await members(f, count);
    f.input = { instrumentId: instrument.id, workItemIds: f.workItemIds, seed: 'native-integration-fixture' };
    return f;
}
async function members(f, count) {
    const ids = [];
    for (let i = 0; i < count; i++) {
        const sampleId = randomUUID();
        await createSampleFixture(f.db, { data: { id: sampleId, originalId: sampleId, assignedLab: f.labId,
            status: 'PROCESSING', dryingStatus: 'DONE', preparationStatus: 'DONE' } });
        const item = await createWorkItemFixture(f.db, { data: { id: randomUUID(), sampleId, labId: f.labId,
            analysis: f.analysisCode, methodologyId: f.method.id, status: 'IN_PROGRESS' } });
        ids.push(item.id);
    }
    return ids;
}
async function evidence(db) {
    return JSON.parse(JSON.stringify(await Promise.all([db.batch.findMany({ orderBy: { id: 'asc' } }),
        db.batchAnalyte.findMany({ orderBy: { id: 'asc' } }), db.batchPosition.findMany({ orderBy: { id: 'asc' } }),
        db.batchPositionWorkItem.findMany({ orderBy: { id: 'asc' } }), db.batchPositionReference.findMany({ orderBy: { id: 'asc' } }),
        db.qcMeasurement.findMany({ orderBy: { id: 'asc' } }), db.qcEvaluation.findMany({ orderBy: { id: 'asc' } }),
        db.batchEvent.findMany({ orderBy: { id: 'asc' } }), db.workItem.findMany({ orderBy: { id: 'asc' } }), db.auditLog.count()])));
}
afterAll(async () => {
    for (const { file, db } of owned) {
        if (db) await db.$disconnect();
        if (path.dirname(file) !== path.resolve(__dirname, '../.tmp') || !path.basename(file).startsWith('audit_legacy_')) throw new Error('Native fixture cleanup requires its owned file.');
        for (const suffix of ['', '-wal', '-shm']) if (fs.existsSync(`${file}${suffix}`)) fs.unlinkSync(`${file}${suffix}`);
    }
});

async function referenceLot(f, assignedValue = 7.123456789, kind = 'LRM') {
    const lot = await f.db.referenceMaterial.create({ data: { id: randomUUID(), labId: f.labId, code: randomUUID(), name: 'Evaluation fixture lot',
        kind, matrix: 'SOIL', lotNumber: 'fixture', status: 'ACTIVE', createdBy: f.actor.username } });
    if (kind !== 'BLANK_MATRIX') await f.db.referenceValue.create({ data: { id: randomUUID(), referenceMaterialId: lot.id,
        analysisCode: f.analysisCode, assignedValue, unit: 'fixture-unit', valueType: kind === 'CRM' ? 'CERTIFIED' : 'LAB_ASSIGNED', createdBy: f.actor.username } });
    return lot;
}
async function secondAnalyte(f) {
    const analysisCode = `B-${randomUUID()}`;
    await f.db.analysis.create({ data: { code: analysisCode, name: 'Second evaluation analyte', unitCode: 'fixture-unit' } });
    const method = await f.db.methodology.create({ data: { analysisCode, name: 'Second recorded evaluation method', loq: f.method.loq } });
    await rules.change(f.actor, { labId: f.labId, analysisCode, methodologyId: method.id,
        criteria: { crmEveryNBatches: 0 }, expectedVersion: 0, reason: 'Second analyte evaluation rules' }, { db: f.db });
    const sampleId = (await f.db.workItem.findUnique({ where: { id: f.workItemIds[0] } })).sampleId;
    const item = await createWorkItemFixture(f.db, { data: { id: randomUUID(), sampleId, labId: f.labId, analysis: analysisCode, methodologyId: method.id, status: 'IN_PROGRESS' } });
    return { analysisCode, method, item, sampleId };
}
function readings(run, { blank = 0.0123456789, control = 7.123456789, duplicate = 2.123456789 } = {}) {
    const parents = new Set(run.positions.filter(row => row.kind === 'DUPLICATE').map(row => row.duplicateOfPositionId));
    return run.positions.filter(row => row.kind !== 'SAMPLE' || parents.has(row.id)).map(row => ({ positionId: row.id,
        value: ['BLANK', 'CCB'].includes(row.kind) ? blank : ['SAMPLE', 'DUPLICATE'].includes(row.kind) ? duplicate : control }));
}

test('native entry, explicit evaluation and corrections before first start refuse without any write', async () => {
    const f = await fixture(), run = await buildNativeRun(f.db, f.actor, f.input), before = await evidence(f.db);
    for (const options of [{}, { explicit: true }, { correction: true }]) {
        await expect(writeNativeMeasurements(f.db, run.id, f.actor, { reason: 'Before-start refusal', measurements: readings(run) }, options))
            .rejects.toMatchObject({ statusCode: 409, code: 'QC_RUN_NOT_STARTED' });
        expect(await evidence(f.db)).toEqual(before);
    }
});

test('partial native entry is retained; missing explicit values, malformed values and auto-evaluation while unbound refuse atomically', async () => {
    const f = await fixture(), run = await startNativeRun(f.db, (await buildNativeRun(f.db, f.actor, f.input)).id, f.actor), entries = readings(run);
    const blank = entries.find(row => run.positions.find(position => position.id === row.positionId).kind === 'BLANK');
    await writeNativeMeasurements(f.db, run.id, f.actor, { measurements: [blank] });
    expect(await f.db.qcMeasurement.count()).toBe(1); expect(await f.db.qcEvaluation.count()).toBe(0);
    const before = await evidence(f.db);
    await expect(writeNativeMeasurements(f.db, run.id, f.actor, {}, { explicit: true })).rejects.toMatchObject({ statusCode: 400, code: 'QC_VALUES_MISSING' });
    expect(await evidence(f.db)).toEqual(before);
    for (const value of [null, '', true, '<0.5']) {
        const control = entries.find(row => run.positions.find(position => position.id === row.positionId).kind === 'LRM');
        await expect(writeNativeMeasurements(f.db, run.id, f.actor, { measurements: [{ ...control, value }] })).rejects.toMatchObject({ statusCode: 400, code: 'QC_VALUES_MISSING' });
        expect(await evidence(f.db)).toEqual(before);
    }
    await expect(writeNativeMeasurements(f.db, run.id, f.actor, { measurements: entries.filter(row => row.positionId !== blank.positionId) }))
        .rejects.toMatchObject({ statusCode: 400, code: 'QC_REFERENCE_UNBOUND' });
    expect(await evidence(f.db)).toEqual(before);
    const lot = await referenceLot(f), control = run.positions.find(row => row.kind === 'LRM');
    const completed = await writeNativeMeasurements(f.db, run.id, f.actor, { measurements: entries.filter(row => row.positionId !== blank.positionId),
        references: [{ positionId: control.id, referenceMaterialId: lot.id }] });
    expect(completed.analytes[0]).toMatchObject({ status: 'QC_PASS', result: 'PASS' });
    expect(await f.db.qcMeasurement.count()).toBe(4); expect(await f.db.qcEvaluation.count()).toBe(1);
    expect((await f.db.batch.findUnique({ where: { id: run.id } })).qcResults).toBeNull();
});

test('reasoned corrections append two evaluation versions and exact measurements using the frozen start limit', async () => {
    const f = await fixture(), lot = await referenceLot(f), built = await buildNativeRun(f.db, f.actor, { ...f.input, analyses: [{ analysisCode: f.analysisCode,
        references: [{ positionKind: 'LRM', referenceMaterialLotId: lot.id }] }] }), run = await startNativeRun(f.db, built.id, f.actor);
    const first = await writeNativeMeasurements(f.db, run.id, f.actor, { measurements: readings(run) });
    const oldEvaluation = await f.db.qcEvaluation.findFirst(), oldMeasurements = await f.db.qcMeasurement.findMany({ orderBy: { id: 'asc' } });
    const blank = run.positions.find(row => row.kind === 'BLANK'), original = oldMeasurements.find(row => row.positionId === blank.id);
    await rules.change(f.actor, { labId: f.labId, analysisCode: f.analysisCode, methodologyId: f.method.id,
        criteria: { blankAbsLimit: 10 }, expectedVersion: 1, reason: 'Later rules do not alter started runs' }, { db: f.db });
    const before = await evidence(f.db);
    await expect(writeNativeMeasurements(f.db, run.id, f.actor, { measurements: [{ positionId: blank.id, value: 0.223456789 }] }))
        .rejects.toMatchObject({ code: 'QC_CORRECTION_REASON_REQUIRED' });
    await expect(writeNativeMeasurements(f.db, run.id, f.actor, { corrections: [{ positionId: blank.id, value: 0.223456789 }] }, { correction: true }))
        .rejects.toMatchObject({ code: 'QC_CORRECTION_REASON_REQUIRED' });
    expect(await evidence(f.db)).toEqual(before);
    const failed = await writeNativeMeasurements(f.db, run.id, f.actor, { reason: 'Correct the transcribed blank',
        corrections: [{ positionId: blank.id, value: 0.223456789 }] }, { correction: true });
    expect(first.status).toBe('QC_PASS'); expect(failed.status).toBe('QC_FAIL');
    const evaluations = await f.db.qcEvaluation.findMany({ orderBy: { version: 'asc' } });
    expect(evaluations).toHaveLength(2); expect(evaluations[0]).toEqual(oldEvaluation);
    expect(evaluations[1]).toMatchObject({ version: 2, supersedesId: oldEvaluation.id, verdict: 'FAIL' });
    expect(JSON.parse(evaluations[1].details).criteriaSnapshot).toBe(run.analytes[0].criteriaSnapshot);
    const next = await f.db.qcMeasurement.findFirst({ where: { positionId: blank.id, supersededById: null } });
    expect(next.value).toBe(0.223456789); expect(next.correctionReason).toBe('Correct the transcribed blank');
    expect(await f.db.qcMeasurement.findUnique({ where: { id: original.id } })).toEqual({ ...original, supersededById: next.id });
    const locked = await evidence(f.db);
    await expect(writeNativeMeasurements(f.db, run.id, f.actor, { reason: 'Still needs manager reopen', corrections: [{ positionId: blank.id, value: 0 }] }, { correction: true }))
        .rejects.toMatchObject({ statusCode: 409, code: 'QC_BATCH_LOCKED' });
    expect(await evidence(f.db)).toEqual(locked);
});

test('native censoring retains null numeric observations, canonical qualifiers and the frozen method limit', async () => {
    const f = await fixture(), lot = await referenceLot(f), built = await buildNativeRun(f.db, f.actor, { ...f.input, analyses: [{ analysisCode: f.analysisCode,
        references: [{ positionKind: 'LRM', referenceMaterialLotId: lot.id }] }] }), run = await startNativeRun(f.db, built.id, f.actor);
    const entries = readings(run).map(row => ({ ...row, value: ['SAMPLE', 'DUPLICATE'].includes(run.positions.find(position => position.id === row.positionId).kind) ? '<LOQ' : row.value }));
    const evaluated = await writeNativeMeasurements(f.db, run.id, f.actor, { measurements: entries });
    expect(evaluated.analytes[0].result).toBe('PASS');
    expect(evaluated.qcResults.duplicates[0]).toMatchObject({ value1: null, value2: null, criterion: 'CENSORED_PAIR', rpd: null });
    const censored = await f.db.qcMeasurement.findMany({ where: { censoring: '<' } });
    expect(censored).toHaveLength(2);
    expect(censored.every(row => row.value === null && row.rawInput === '<LOQ' && row.censoringLimit === f.method.loq)).toBe(true);
});

test('OFF start writes no evaluation; explicit evaluation records NOT_REQUIRED and never passing observation evidence', async () => {
    const f = await fixture();
    await policies.change(f.actor, f.labId, { reason: 'Explicitly disable QC for this fixture', changes: [{ key: 'qc.mode', value: 'OFF' }] }, { db: f.db });
    const run = await startNativeRun(f.db, (await buildNativeRun(f.db, f.actor, f.input)).id, f.actor);
    expect(run.positions.every(row => row.kind === 'SAMPLE')).toBe(true); expect(await f.db.qcEvaluation.count()).toBe(0);
    const evaluated = await writeNativeMeasurements(f.db, run.id, f.actor, {}, { explicit: true });
    expect(await f.db.qcMeasurement.count()).toBe(0);
    expect(evaluated.analytes[0]).toMatchObject({ status: 'QC_PASS', result: 'NOT_REQUIRED' });
    expect(evaluated.qcResults).toMatchObject({ result: 'NOT_REQUIRED', summary: { totalQcSamples: 0, passed: 0, mode: 'OFF', notRequired: true } });
    expect((await f.db.qcEvaluation.findFirst()).verdict).toBe('NOT_REQUIRED');
    await writeNativeMeasurements(f.db, run.id, f.actor, {}, { explicit: true });
    expect(await f.db.qcEvaluation.count()).toBe(1);
});

test('ADVISORY explicit evaluation records INCOMPLETE; later complete values supersede it using frozen criteria', async () => {
    const f = await fixture(), lot = await referenceLot(f);
    await policies.change(f.actor, f.labId, { reason: 'Advisory fixture QC mode', changes: [{ key: 'qc.mode', value: 'ADVISORY' }] }, { db: f.db });
    const run = await startNativeRun(f.db, (await buildNativeRun(f.db, f.actor, f.input)).id, f.actor);
    const incomplete = await writeNativeMeasurements(f.db, run.id, f.actor, {}, { explicit: true });
    expect(incomplete.analytes[0]).toMatchObject({ status: 'QC_PENDING', result: 'INCOMPLETE' });
    const complete = await writeNativeMeasurements(f.db, run.id, f.actor, { measurements: readings(run),
        references: [{ positionId: run.positions.find(row => row.kind === 'LRM').id, referenceMaterialId: lot.id }] });
    expect(complete.analytes[0].result).toBe('PASS');
    expect(complete.evaluations).toHaveLength(2);
    expect(complete.evaluations[1].supersedesId).toBe(complete.evaluations[0].id);
    expect(complete.evaluations.every(row => JSON.parse(row.details).criteriaSnapshot === run.analytes[0].criteriaSnapshot)).toBe(true);
});

test('mixed-analyte evaluations and flags are independent; a shared lot correction appends both verdicts atomically', async () => {
    const f = await fixture(), b = await secondAnalyte(f), lot = await referenceLot(f);
    await f.db.referenceValue.create({ data: { id: randomUUID(), referenceMaterialId: lot.id, analysisCode: b.analysisCode,
        assignedValue: 12.987654321, unit: 'fixture-unit', valueType: 'LAB_ASSIGNED', createdBy: f.actor.username } });
    const run = await startNativeRun(f.db, (await buildNativeRun(f.db, f.actor, { ...f.input, workItemIds: [...f.workItemIds, b.item.id],
        analyses: [{ analysisCode: f.analysisCode, references: [{ positionKind: 'LRM', referenceMaterialLotId: lot.id }] }, { analysisCode: b.analysisCode }] })).id, f.actor);
    const resultA = await createResultFixture(f.db, { data: { id: randomUUID(), sampleId: b.sampleId, param: f.analysisCode,
        batchId: run.id, value: '2.123456789', numericValue: 2.123456789, rawInput: '2.123456789', isValid: true, flags: '[]' } });
    const resultB = await createResultFixture(f.db, { data: { ...resultA, id: randomUUID(), param: b.analysisCode } });
    const first = await writeNativeMeasurements(f.db, run.id, f.actor, { analysisCode: f.analysisCode, measurements: readings(run) });
    expect(first.status).toBe('RUNNING'); expect(first.analytes.find(row => row.analysisCode === f.analysisCode).result).toBe('PASS');
    const both = await writeNativeMeasurements(f.db, run.id, f.actor, { analysisCode: b.analysisCode, measurements: readings(run, { control: 12.987654321 }) });
    expect(both.status).toBe('QC_PASS'); expect(both.evaluations).toHaveLength(2);
    const missingLot = await referenceLot(f, 7.223456789), lrm = run.positions.find(row => row.kind === 'LRM'), before = await evidence(f.db);
    await expect(writeNativeMeasurements(f.db, run.id, f.actor, { reason: 'A shared lot needs both analytes',
        references: [{ positionId: lrm.id, referenceMaterialId: missingLot.id }] }, { correction: true }))
        .rejects.toMatchObject({ code: 'REFERENCE_VALUE_NOT_FOUND', details: { analysisCode: b.analysisCode } });
    expect(await evidence(f.db)).toEqual(before);
    await f.db.referenceValue.create({ data: { id: randomUUID(), referenceMaterialId: missingLot.id, analysisCode: b.analysisCode,
        assignedValue: 13.087654321, unit: 'fixture-unit', valueType: 'LAB_ASSIGNED', createdBy: f.actor.username } });
    const corrected = await writeNativeMeasurements(f.db, run.id, f.actor, { reason: 'Record the replacement shared lot',
        references: [{ positionId: lrm.id, referenceMaterialId: missingLot.id }] }, { correction: true });
    expect(corrected.status).toBe('QC_PASS'); expect(corrected.evaluations).toHaveLength(4);
    const bindings = await f.db.batchPositionReference.findMany({ where: { positionId: lrm.id } });
    expect(bindings).toHaveLength(4); expect(bindings.filter(row => !row.supersededById)).toHaveLength(2);
    expect(bindings.filter(row => row.supersededById).every(row => bindings.some(next => next.id === row.supersededById && next.correctionReason === 'Record the replacement shared lot'))).toBe(true);
    for (const code of [f.analysisCode, b.analysisCode]) {
        const versions = corrected.evaluations.filter(row => row.analysisCode === code);
        expect(versions[1]).toMatchObject({ version: 2, supersedesId: versions[0].id, verdict: 'PASS' });
    }
    const failed = await writeNativeMeasurements(f.db, run.id, f.actor, { analysisCode: f.analysisCode, reason: 'Correct one analyte blank only',
        corrections: [{ positionId: run.positions.find(row => row.kind === 'BLANK').id, value: 0.223456789 }] }, { correction: true });
    expect(failed.analytes.find(row => row.analysisCode === f.analysisCode).status).toBe('QC_FAIL');
    expect(failed.analytes.find(row => row.analysisCode === b.analysisCode).status).toBe('QC_PASS');
    expect(await f.db.result.findUnique({ where: { id: resultB.id } })).toEqual(expect.objectContaining({ isValid: true, flags: '[]', value: resultB.value, numericValue: resultB.numericValue }));
    expect(await f.db.result.findUnique({ where: { id: resultA.id } })).toEqual(expect.objectContaining({ isValid: false, flags: '["QC_BATCH_FAILED"]', value: resultA.value, numericValue: resultA.numericValue, rawInput: resultA.rawInput }));
});

test('a late evaluation insert failure rolls back measurements, every shared binding and both analyte verdicts', async () => {
    const f = await fixture(), b = await secondAnalyte(f), firstLot = await referenceLot(f), nextLot = await referenceLot(f, 7.223456789);
    for (const lot of [firstLot, nextLot]) await f.db.referenceValue.create({ data: { id: randomUUID(), referenceMaterialId: lot.id,
        analysisCode: b.analysisCode, assignedValue: 12.987654321, unit: 'fixture-unit', valueType: 'LAB_ASSIGNED', createdBy: f.actor.username } });
    const run = await startNativeRun(f.db, (await buildNativeRun(f.db, f.actor, { ...f.input, workItemIds: [...f.workItemIds, b.item.id], analyses: [
        { analysisCode: f.analysisCode, references: [{ positionKind: 'LRM', referenceMaterialLotId: firstLot.id }] }, { analysisCode: b.analysisCode }] })).id, f.actor);
    await writeNativeMeasurements(f.db, run.id, f.actor, { measurements: readings(run) });
    await writeNativeMeasurements(f.db, run.id, f.actor, { analysisCode: b.analysisCode, measurements: readings(run, { control: 12.987654321 }) });
    const before = await evidence(f.db);
    const connection = new Database(f.file, { fileMustExist: true });
    connection.exec("CREATE TRIGGER qc186_fixture_evaluation_abort BEFORE INSERT ON QcEvaluation WHEN NEW.version=2 BEGIN SELECT RAISE(ABORT,'QC186_FIXTURE_EVALUATION_ABORT'); END;");
    connection.close();
    await expect(writeNativeMeasurements(f.db, run.id, f.actor, { reason: 'Inject a late shared correction failure',
        corrections: [{ positionId: run.positions.find(row => row.kind === 'BLANK').id, value: 0.0223456789 }],
        references: [{ positionId: run.positions.find(row => row.kind === 'LRM').id, referenceMaterialId: nextLot.id }] }, { correction: true })).rejects.toThrow();
    expect(await evidence(f.db)).toEqual(before);
});

test('calibration CHECK_STANDARD uses the frozen CCV criterion and unbound calibration blanks never block', async () => {
    const f = await fixture(), standard = await referenceLot(f, 7.123456789, 'CHECK_STANDARD');
    await policies.change(f.actor, f.labId, { reason: 'Enable calibration verification for the fixture',
        changes: [{ key: 'qc.calibrationVerification', value: true }] }, { db: f.db });
    await rules.change(f.actor, { labId: f.labId, analysisCode: f.analysisCode, methodologyId: f.method.id,
        criteria: { lrmWindowPct: 1 }, expectedVersion: 1, reason: 'Deliberately distinct calibration and LRM criteria' }, { db: f.db });
    const run = await startNativeRun(f.db, (await buildNativeRun(f.db, f.actor, { ...f.input, analyses: [{ analysisCode: f.analysisCode,
        references: ['LRM', 'ICV', 'CCV'].map(positionKind => ({ positionKind, referenceMaterialLotId: standard.id })) }] })).id, f.actor);
    const entries = readings(run).map(row => ['ICV', 'CCV'].includes(run.positions.find(position => position.id === row.positionId).kind)
        ? { ...row, value: 7.123456789 * 1.05 } : row);
    const evaluated = await writeNativeMeasurements(f.db, run.id, f.actor, { measurements: entries });
    expect(evaluated.status).toBe('QC_PASS');
    expect(evaluated.qcResults.controls.filter(row => ['ICV', 'CCV'].includes(row.kind)).every(row => row.criterion === 'CALIBRATION_RECOVERY' && row.status === 'PASS')).toBe(true);
    expect(await f.db.batchPositionReference.count({ where: { referenceUse: 'CCB' } })).toBe(0);
});

test('pre-start rebuild retains a bound extra and both certificate revisions when its lot changes', async () => {
    const f = await fixture(2), lot = await referenceLot(f), nextLot = await referenceLot(f, 7.223456789);
    const input = { ...f.input, analyses: [{ analysisCode: f.analysisCode, references: [{ positionKind: 'LRM', referenceMaterialLotId: lot.id }] }] };
    const run = await buildNativeRun(f.db, f.actor, input), lrm = run.positions.find(row => row.kind === 'LRM'), firstBinding = lrm.references[0];
    await rules.change(f.actor, { labId: f.labId, analysisCode: f.analysisCode, methodologyId: f.method.id,
        criteria: { lrmPerBatch: 0 }, expectedVersion: 1, reason: 'The retained LRM becomes optional' }, { db: f.db });
    const extra = await rebuildNativeRun(f.db, run.id, f.actor, { ...f.input, workItemIds: [f.workItemIds[0]], seed: 'rebuild-retention-fixture' });
    expect(extra.positions.find(row => row.id === lrm.id).references).toEqual([firstBinding]);
    expect(extra.positions.filter(row => row.kind === 'SAMPLE')).toHaveLength(1);
    expect(extra.positions.map(row => row.position)).toEqual(Array.from({ length: extra.positions.length }, (_, i) => i + 1));
    expect(await f.db.workItem.findUnique({ where: { id: f.workItemIds[1] } })).toMatchObject({ batchId: null, rackPosition: null });
    const changed = await rebuildNativeRun(f.db, run.id, f.actor, { ...f.input, workItemIds: [f.workItemIds[0]], analyses: [{ analysisCode: f.analysisCode,
        references: [{ positionKind: 'LRM', referenceMaterialLotId: nextLot.id }] }] });
    const retained = changed.positions.find(row => row.id === lrm.id), next = retained.references.find(row => !row.supersededById);
    expect(retained.references).toHaveLength(2);
    expect(next).toMatchObject({ referenceMaterialId: nextLot.id, correctionReason: 'REBUILD_BEFORE_START' });
    expect(retained.references.find(row => row.id === firstBinding.id)).toEqual({ ...firstBinding, supersededById: next.id });
    expect(changed.events.filter(row => row.type === 'RUN_BUILT')).toHaveLength(3);
    const lastBuild = JSON.parse(changed.events.filter(row => row.type === 'RUN_BUILT').at(-1).payload);
    expect(lastBuild.rebuild.retainedPositionIds).toContain(lrm.id);
    expect(lastBuild.duplicateSelection.picks).toHaveLength(1);
    await startNativeRun(f.db, changed.id, f.actor);
    const started = await evidence(f.db);
    await expect(rebuildNativeRun(f.db, run.id, f.actor, f.input)).rejects.toMatchObject({ statusCode: 409, code: 'BATCH_MEMBERSHIP_FROZEN' });
    expect(await evidence(f.db)).toEqual(started);
});

test('a measured extra CRM is optional at a not-due ordinal and its failure contributes to the analyte verdict', async () => {
    const f = await fixture(1, { crmEveryNBatches: 2 }), lrm = await referenceLot(f), crm = await referenceLot(f, 7.123456789, 'CRM');
    const input = { ...f.input, analyses: [{ analysisCode: f.analysisCode, references: [
        { positionKind: 'LRM', referenceMaterialLotId: lrm.id }, { positionKind: 'CRM', referenceMaterialLotId: crm.id }] }] };
    const pending = await buildNativeRun(f.db, f.actor, input);
    await startNativeRun(f.db, (await buildNativeRun(f.db, f.actor, { ...input, workItemIds: await members(f, 1) })).id, f.actor);
    const run = await startNativeRun(f.db, pending.id, f.actor);
    expect(run.analytes[0].crmOrdinal).toBe(2);
    const extra = run.positions.find(row => row.kind === 'CRM');
    const entries = readings(run).filter(row => row.positionId !== extra.id);
    const complete = await writeNativeMeasurements(f.db, run.id, f.actor, { measurements: entries });
    expect(complete.status).toBe('QC_PASS');
    const failed = await writeNativeMeasurements(f.db, run.id, f.actor, { measurements: [{ positionId: extra.id, value: 1.23456789 }] });
    expect(failed.status).toBe('QC_FAIL');
    expect(failed.qcResults.controls.find(row => row.positionId === extra.id)).toMatchObject({ kind: 'CRM', status: 'FAIL' });
    expect(failed.analytes[0].crmOrdinal).toBe(2);
});

test('removing a bound analyte last member is refused without writes; an unbound analyte removal is recorded', async () => {
    const f = await fixture(), b = await secondAnalyte(f), lot = await referenceLot(f);
    await f.db.referenceValue.create({ data: { id: randomUUID(), referenceMaterialId: lot.id, analysisCode: b.analysisCode,
        assignedValue: 12.987654321, unit: 'fixture-unit', valueType: 'LAB_ASSIGNED', createdBy: f.actor.username } });
    const input = { ...f.input, workItemIds: [...f.workItemIds, b.item.id], analyses: [
        { analysisCode: f.analysisCode, references: [{ positionKind: 'LRM', referenceMaterialLotId: lot.id }] }, { analysisCode: b.analysisCode }] };
    const bound = await buildNativeRun(f.db, f.actor, input), before = await evidence(f.db);
    await expect(rebuildNativeRun(f.db, bound.id, f.actor, { ...f.input, analyses: [{ analysisCode: f.analysisCode }] }))
        .rejects.toMatchObject({ statusCode: 409, code: 'QC_ANALYTE_REMOVAL_BLOCKED', details: { analysisCode: b.analysisCode,
            boundPositionIds: [bound.positions.find(row => row.kind === 'LRM').id] } });
    expect(await evidence(f.db)).toEqual(before);
    const u = await fixture(), ub = await secondAnalyte(u), unbound = await buildNativeRun(u.db, u.actor, { ...u.input, workItemIds: [...u.workItemIds, ub.item.id] });
    const rebuilt = await rebuildNativeRun(u.db, unbound.id, u.actor, u.input);
    expect(rebuilt.analytes).toHaveLength(1); expect(rebuilt.analytes[0].analysisCode).toBe(u.analysisCode);
    expect(await u.db.workItem.findUnique({ where: { id: ub.item.id } })).toMatchObject({ batchId: null, rackPosition: null });
    expect(JSON.parse(rebuilt.events.filter(row => row.type === 'RUN_BUILT').at(-1).payload).rebuild.removedAnalyteCodes).toEqual([ub.analysisCode]);
});

test('optional CRM lot correction records NOT_SERVED with intact prior evidence; a due CRM refuses the same missing value', async () => {
    const f = await fixture(1, { crmEveryNBatches: 2 }), b = await secondAnalyte(f), lrm = await referenceLot(f), crm = await referenceLot(f, 7.123456789, 'CRM');
    await rules.change(f.actor, { labId: f.labId, analysisCode: b.analysisCode, methodologyId: b.method.id,
        criteria: { crmEveryNBatches: 2 }, expectedVersion: 1, reason: 'Both analytes use the same CRM frequency' }, { db: f.db });
    for (const lot of [lrm, crm]) await f.db.referenceValue.create({ data: { id: randomUUID(), referenceMaterialId: lot.id,
        analysisCode: b.analysisCode, assignedValue: 12.987654321, unit: 'fixture-unit', valueType: lot.kind === 'CRM' ? 'CERTIFIED' : 'LAB_ASSIGNED', createdBy: f.actor.username } });
    const selections = [{ analysisCode: f.analysisCode, references: [{ positionKind: 'LRM', referenceMaterialLotId: lrm.id },
        { positionKind: 'CRM', referenceMaterialLotId: crm.id }] }, { analysisCode: b.analysisCode }];
    const pending = await buildNativeRun(f.db, f.actor, { ...f.input, workItemIds: [...f.workItemIds, b.item.id], analyses: selections });
    async function another() {
        const ids = await members(f, 1), sampleId = (await f.db.workItem.findUnique({ where: { id: ids[0] } })).sampleId;
        const item = await createWorkItemFixture(f.db, { data: { id: randomUUID(), sampleId, labId: f.labId, analysis: b.analysisCode,
            methodologyId: b.method.id, status: 'IN_PROGRESS' } });
        return buildNativeRun(f.db, f.actor, { ...f.input, workItemIds: [...ids, item.id], analyses: selections });
    }
    await startNativeRun(f.db, (await another()).id, f.actor);
    const run = await startNativeRun(f.db, pending.id, f.actor);
    expect(run.analytes.map(row => row.crmOrdinal)).toEqual([2, 2]);
    await writeNativeMeasurements(f.db, run.id, f.actor, { measurements: readings(run) });
    const initial = await writeNativeMeasurements(f.db, run.id, f.actor, { analysisCode: b.analysisCode, measurements: readings(run, { control: 12.987654321 }) });
    const oldMeasurements = await f.db.qcMeasurement.findMany({ orderBy: { id: 'asc' } }), oldEvaluations = await f.db.qcEvaluation.findMany({ orderBy: { id: 'asc' } });
    const onlyA = await referenceLot(f, 7.123456789, 'CRM'), position = run.positions.find(row => row.kind === 'CRM');
    const corrected = await writeNativeMeasurements(f.db, run.id, f.actor, { reason: 'Optional CRM no longer serves the second analyte',
        references: [{ positionId: position.id, referenceMaterialId: onlyA.id }] }, { correction: true });
    const current = (await f.db.batchPositionReference.findMany({ where: { positionId: position.id } })).filter(row => !row.supersededById);
    expect(current).toHaveLength(2); expect(current.every(row => row.referenceMaterialId === onlyA.id)).toBe(true);
    expect(current.find(row => row.analysisCode === b.analysisCode)).toMatchObject({ serviceStatus: 'NOT_SERVED', referenceValueId: null, referenceSnapshot: null });
    const latestB = corrected.analytes.find(row => row.analysisCode === b.analysisCode);
    expect(latestB.result).toBe('PASS'); expect(latestB.positions.some(row => row.id === position.id)).toBe(false);
    expect(JSON.parse(latestB.evaluation.details).measurementIds).not.toContain(initial.measurements.find(row => row.positionId === position.id && row.analysisCode === b.analysisCode).id);
    expect(await f.db.qcMeasurement.findMany({ orderBy: { id: 'asc' } })).toEqual(oldMeasurements);
    for (const evaluation of oldEvaluations) expect(await f.db.qcEvaluation.findUnique({ where: { id: evaluation.id } })).toEqual(evaluation);
    const due = await startNativeRun(f.db, (await another()).id, f.actor);
    expect(due.analytes.map(row => row.crmOrdinal)).toEqual([3, 3]);
    await writeNativeMeasurements(f.db, due.id, f.actor, { measurements: readings(due) });
    await writeNativeMeasurements(f.db, due.id, f.actor, { analysisCode: b.analysisCode, measurements: readings(due, { control: 12.987654321 }) });
    const before = await evidence(f.db);
    await expect(writeNativeMeasurements(f.db, due.id, f.actor, { reason: 'Required service cannot be dropped',
        references: [{ positionId: due.positions.find(row => row.kind === 'CRM').id, referenceMaterialId: onlyA.id }] }, { correction: true }))
        .rejects.toMatchObject({ code: 'REFERENCE_VALUE_NOT_CERTIFIED', details: { analysisCode: b.analysisCode } });
    expect(await evidence(f.db)).toEqual(before);
});

test('real 23-sample builder writes 28 physical members, recorded parent picks and no invented QC values or ordinal', async () => {
    const f = await fixture(23, { maxBatchSize: 23, crmEveryNBatches: 0 }), run = await buildNativeRun(f.db, f.actor, f.input);
    expect(run.positions).toHaveLength(28);
    expect(run.positions.map(row => row.position)).toEqual(Array.from({ length: 28 }, (_, i) => i + 1));
    expect(run.positions.filter(row => row.kind === 'DUPLICATE')).toHaveLength(3);
    expect(await f.db.batchPositionWorkItem.count()).toBe(23);
    expect(await f.db.qcMeasurement.count()).toBe(0); expect(await f.db.qcEvaluation.count()).toBe(0);
    expect(run).toMatchObject({ status: 'OPEN', analystUsername: null, startedAt: null, qcResults: null, disposition: null });
    expect(run.analytes[0]).toMatchObject({ provenance: 'NATIVE', crmOrdinal: null, criteriaSnapshot: null });
    const raw = await f.db.batch.findUnique({ where: { id: run.id } });
    expect([raw.qcResults, raw.workItemIds, raw.disposition, raw.history]).toEqual([null, null, null, null]);
    const built = JSON.parse(run.events[0].payload);
    expect(built.duplicateSelection.seed).toBe(f.input.seed); expect(built.duplicateSelection.picks).toHaveLength(3);
});

test('real default-capacity, missing method and cross-lab builds refuse with zero normalized, membership or audit writes', async () => {
    const f = await fixture(23), before = await evidence(f.db);
    await expect(buildNativeRun(f.db, f.actor, f.input)).rejects.toMatchObject({ statusCode: 422, code: 'QC_BATCH_TOO_LARGE', details: { maxBatchSize: 20, requested: 23, analysisCode: f.analysisCode } });
    expect(await evidence(f.db)).toEqual(before);
    await f.db.workItem.update({ where: { id: f.workItemIds[0] }, data: { methodologyId: null } });
    const missingMethod = await evidence(f.db);
    await expect(buildNativeRun(f.db, f.actor, { ...f.input, workItemIds: [f.workItemIds[0]] })).rejects.toMatchObject({ code: 'QC_BATCH_METHOD_AMBIGUOUS' });
    expect(await evidence(f.db)).toEqual(missingMethod);
    const foreignLab = randomUUID();
    await f.db.lab.create({ data: { id: foreignLab, code: foreignLab, name: 'Foreign fixture laboratory', country: 'TEST' } });
    await expect(buildNativeRun(f.db, { ...f.actor, role: 'LAB_MANAGER', labId: foreignLab }, { ...f.input, labId: f.labId })).rejects.toMatchObject({ statusCode: 403 });
    expect(await evidence(f.db)).toEqual(missingMethod);
});

test('first start freezes the newly effective limit, number policy and method LOQ with one ordinal, instrument and real analyst', async () => {
    const f = await fixture(), run = await buildNativeRun(f.db, f.actor, f.input);
    const revised = await rules.change(f.actor, { labId: f.labId, analysisCode: f.analysisCode, methodologyId: f.method.id,
        criteria: { blankAbsLimit: 0.0123456789 }, expectedVersion: 1, reason: 'Limit-only revision before start' }, { db: f.db });
    await policies.change(f.actor, f.labId, { reason: 'Record laboratory number conventions', changes: [
        { key: 'numbers.decimalSeparator', value: ',' }, { key: 'numbers.thousandsSeparator', value: '.' }] }, { db: f.db });
    const started = await startNativeRun(f.db, run.id, f.actor), analyte = started.analytes[0], frozen = JSON.parse(analyte.criteriaSnapshot);
    expect(started).toMatchObject({ status: 'RUNNING', analystUsername: f.actor.username, instrumentId: f.instrument.id });
    expect(started.startedAt).toBeInstanceOf(Date);
    expect(analyte).toMatchObject({ status: 'IN_RUN', crmOrdinal: 1, qcRuleId: revised.rule.id, qcRuleVersion: 2 });
    expect(frozen.qcRule.resolved.blankAbsLimit.value).toBe(0.0123456789);
    expect(frozen.methodContext.loq).toBe(0.123456789); expect(frozen.numberFormat).toEqual({ decimal: ',', thousands: '.' });
    expect(frozen.policySnapshot.values['qc.mode']).toBeDefined();
    const before = await evidence(f.db);
    await expect(startNativeRun(f.db, run.id, f.actor)).rejects.toMatchObject({ code: 'QC_BATCH_LOCKED' });
    expect(await evidence(f.db)).toEqual(before);
});

test('a first-start count revision refuses stale positions and leaves every row, actor and ordinal unchanged', async () => {
    const f = await fixture(), run = await buildNativeRun(f.db, f.actor, f.input);
    await rules.change(f.actor, { labId: f.labId, analysisCode: f.analysisCode, methodologyId: f.method.id,
        criteria: { blankPerBatch: 2 }, expectedVersion: 1, reason: 'Review blank frequency before start' }, { db: f.db });
    const before = await evidence(f.db);
    await expect(startNativeRun(f.db, run.id, f.actor)).rejects.toMatchObject({ statusCode: 409, code: 'QC_SEQUENCE_STALE' });
    expect(await evidence(f.db)).toEqual(before);
});

test('resuming a reopened native run reuses first-start metadata and criteria without resolving later policy', async () => {
    const f = await fixture(), run = await buildNativeRun(f.db, f.actor, f.input), initial = await startNativeRun(f.db, run.id, f.actor);
    await f.db.$transaction(async tx => {
        await tx.batchAnalyte.update({ where: { id: initial.analytes[0].id }, data: { status: 'QC_PENDING' } });
        await tx.batch.update({ where: { id: initial.id }, data: { status: 'OPEN' } });
        await tx.batchEvent.create({ data: { id: randomUUID(), batchId: initial.id, type: 'REOPENED', by: f.actor.username, at: new Date(),
            payload: JSON.stringify({ reason: 'Native resume fixture' }) } });
    });
    const policyRead = jest.spyOn(policies, 'snapshot').mockImplementation(() => { throw new Error('A started native run must not refresh policy.'); });
    try {
        const resumed = await startNativeRun(f.db, run.id, f.actor);
        expect(resumed.status).toBe('RUNNING');
        expect(resumed.startedAt).toEqual(initial.startedAt); expect(resumed.analystUsername).toBe(initial.analystUsername);
        expect(resumed.instrumentId).toBe(initial.instrumentId);
        expect(resumed.analytes[0]).toMatchObject({ criteriaSnapshot: initial.analytes[0].criteriaSnapshot, crmOrdinal: 1, status: 'IN_RUN' });
        expect(policyRead).not.toHaveBeenCalled();
    } finally { policyRead.mockRestore(); }
});

test('another start consumes the forecast ordinal; a now-due missing CRM refuses atomically instead of guessing or skipping it', async () => {
    const f = await fixture(1, { crmEveryNBatches: 2 });
    await startNativeRun(f.db, (await buildNativeRun(f.db, f.actor, f.input)).id, f.actor);
    const pending = await buildNativeRun(f.db, f.actor, { ...f.input, workItemIds: await members(f, 1) });
    const other = await buildNativeRun(f.db, f.actor, { ...f.input, workItemIds: await members(f, 1) });
    expect(pending.positions.some(row => row.kind === 'CRM')).toBe(false);
    await startNativeRun(f.db, other.id, f.actor);
    const before = await evidence(f.db);
    await expect(startNativeRun(f.db, pending.id, f.actor)).rejects.toMatchObject({ statusCode: 409, code: 'QC_SEQUENCE_STALE',
        details: expect.objectContaining({ crmOrdinal: 3, crmDue: true, analysisCode: f.analysisCode }) });
    expect(await evidence(f.db)).toEqual(before);
});

test('shared physical lot gets separate precise analyte snapshots; a missing second value and conflicting lot refuse the whole build', async () => {
    const f = await fixture(), otherCode = `B-${randomUUID()}`;
    await f.db.analysis.create({ data: { code: otherCode, name: 'Second native analyte', unitCode: 'fixture-unit' } });
    const otherMethod = await f.db.methodology.create({ data: { analysisCode: otherCode, name: 'Second recorded method' } });
    const sampleId = (await f.db.workItem.findUnique({ where: { id: f.workItemIds[0] } })).sampleId;
    const otherItem = await createWorkItemFixture(f.db, { data: { id: randomUUID(), sampleId, labId: f.labId, analysis: otherCode, methodologyId: otherMethod.id, status: 'IN_PROGRESS' } });
    const lot = await f.db.referenceMaterial.create({ data: { id: randomUUID(), labId: f.labId, code: randomUUID(), name: 'Shared in-house lot', kind: 'LRM', matrix: 'SOIL', lotNumber: 'fixture', status: 'ACTIVE', createdBy: f.actor.username } });
    const firstValue = await f.db.referenceValue.create({ data: { id: randomUUID(), referenceMaterialId: lot.id, analysisCode: f.analysisCode, assignedValue: 7.123456789, unit: 'fixture-unit', valueType: 'LAB_ASSIGNED', createdBy: f.actor.username } });
    const input = { ...f.input, workItemIds: [...f.workItemIds, otherItem.id], analyses: [
        { analysisCode: f.analysisCode, references: [{ positionKind: 'LRM', referenceMaterialLotId: lot.id }] }, { analysisCode: otherCode }] };
    const before = await evidence(f.db);
    await expect(buildNativeRun(f.db, f.actor, input)).rejects.toMatchObject({ code: 'REFERENCE_VALUE_NOT_FOUND', details: { analysisCode: otherCode } });
    expect(await evidence(f.db)).toEqual(before);
    await f.db.referenceValue.create({ data: { id: randomUUID(), referenceMaterialId: lot.id, analysisCode: otherCode, assignedValue: 12.987654321, unit: 'fixture-unit', valueType: 'LAB_ASSIGNED', createdBy: f.actor.username } });
    const conflict = { ...input, analyses: [input.analyses[0], { analysisCode: otherCode,
        references: [{ positionKind: 'LRM', referenceMaterialLotId: randomUUID() }] }] }, conflictBefore = await evidence(f.db);
    await expect(buildNativeRun(f.db, f.actor, conflict)).rejects.toMatchObject({ code: 'REFERENCE_POSITION_LOT_CONFLICT' });
    expect(await evidence(f.db)).toEqual(conflictBefore);
    const run = await buildNativeRun(f.db, f.actor, input), lrm = run.positions.find(row => row.kind === 'LRM');
    expect(lrm.references).toHaveLength(2);
    expect(lrm.references.map(row => JSON.parse(row.referenceSnapshot).expected).sort((a, b) => a - b)).toEqual([7.123456789, 12.987654321]);
    expect(lrm.references.map(row => row.referenceMaterialId)).toEqual([lot.id, lot.id]);
    const retained = JSON.stringify(lrm.references), row = lrm.references.find(binding => binding.analysisCode === f.analysisCode);
    await correctValue(f.db, f.actor, lot.id, firstValue.id, { assignedValue: 8.123456789, reason: 'Catalogue revision fixture' });
    const plan = await preparePositionBindings(f.db, { batch: run, position: lrm, analyses: run.analytes, actor: f.actor, referenceMaterialId: lot.id });
    expect(plan.replacements).toEqual([]); expect(plan.bindings.find(binding => binding.analysisCode === f.analysisCode).id).toBe(row.id);
    await f.db.$transaction(tx => applyPositionBindings(tx, plan));
    expect(JSON.stringify((await f.db.batchPosition.findUnique({ where: { id: lrm.id }, include: { references: true } })).references)).toBe(retained);
});
