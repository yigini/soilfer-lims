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
const { buildNativeRun, startNativeRun } = require('../../services/qcNativeRunService');
const { preparePositionBindings, applyPositionBindings } = require('../../services/qcRunReferenceService');
const { correctValue } = require('../../services/referenceMaterialService');
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
