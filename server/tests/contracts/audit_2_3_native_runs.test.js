const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { PrismaClient } = require('../../prisma_client');
const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');
const Database = require('better-sqlite3');
const { beforeGuards } = require('../helpers/legacyWorkflowDatabase');
const { createSampleFixture, createWorkItemFixture, cleanupWorkflowFixtures } = require('../helpers/workflowFixtures');
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
const { reopenNativeRun } = require('../../services/qcNativeLifecycleService');
const { mutateQcRun } = require('../../services/qcRunMutationService');
const { dispositionBatch } = require('../../services/qcDispositionStateService');
const { createResultFixture } = require('../../services/resultWriteService');
const { createProfileRun } = require('../../services/qcCompatibilityRunService');
const { writeCompatibilityMeasurements } = require('../../services/qcCompatibilityRunService');
const { resolveReportingModes } = require('../../services/reportResultGovernance');
const { assembleReport } = require('../../services/reportAssembly');
const { canPublish } = require('../../services/workEligibility');
const { QC_RUN_INCLUDE, batchApiView } = require('../../services/qcRunViewService');
const { changeRunMembers } = require('../../services/qcRunMembershipService');
const { reorderNativeRun } = require('../../services/qcRunOrderService');
const request = require('supertest');
const { withQcRunHttp } = require('../helpers/qcRunHttpHarness');
const owned = [];

async function fixture(count = 1, criteria = { crmEveryNBatches: 0 }, recordedAnalysisCode = null) {
    const labId = randomUUID(), analysisCode = recordedAnalysisCode || `NATIVE-${randomUUID()}`, username = 'system:fixture';
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
        db.batchEvent.findMany({ orderBy: { id: 'asc' } }), db.workItem.findMany({ orderBy: { id: 'asc' } }), db.auditLog.count(),
        db.batchDisposition.findMany({ orderBy: { id: 'asc' } }), db.result.findMany({ orderBy: { id: 'asc' } })])));
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

async function reviewedSample(f) {
    const item = await f.db.workItem.findUnique({ where: { id: f.workItemIds[0] } });
    for (const status of ['COMPLETED', 'SUBMITTED', 'ACCEPTED']) {
        await require('../../services/workItemStateService').transitionWorkItem(item.id, status, f.actor,
            'Reviewed report-policy fixture', {}, f.db);
    }
    await require('../../services/sampleStateService').transitionSample(item.sampleId, 'APPROVED', f.actor,
        'Approved report-policy fixture', {}, f.db);
    return f.db.sample.findUnique({ where: { id: item.sampleId }, include: { workItems: true, results: true } });
}

test.each([false, true])('a failed analyte leaves its sibling measurable, reopenable and closable (deviation=%s)', async deviation => {
    const criteria = { blankPerBatch: 1, lrmPerBatch: 0, duplicateEvery: 0, crmEveryNBatches: 0 };
    const f = await fixture(1, criteria), code = `B-${randomUUID()}`;
    await f.db.analysis.create({ data: { code, name: 'Independent sibling', unitCode: 'fixture-unit' } });
    const method = await f.db.methodology.create({ data: { analysisCode: code, name: 'Sibling method' } });
    await rules.change(f.actor, { labId: f.labId, analysisCode: code, methodologyId: method.id, criteria,
        expectedVersion: 0, reason: 'Reviewed independent sibling criteria' }, { db: f.db });
    const sampleId = (await f.db.workItem.findUnique({ where: { id: f.workItemIds[0] } })).sampleId;
    const item = await createWorkItemFixture(f.db, { data: { id: randomUUID(), sampleId, labId: f.labId,
        analysis: code, methodologyId: method.id, status: 'IN_PROGRESS' } });
    const run = await startNativeRun(f.db, (await buildNativeRun(f.db, f.actor, { ...f.input, workItemIds: [...f.workItemIds, item.id] })).id, f.actor);
    const blank = run.positions.find(row => row.kind === 'BLANK');
    await withQcRunHttp(f.db, f.actor, async (app, token) => {
        const auth = { Authorization: `Bearer ${token}` }, route = `/api/qc/batches/${run.id}`;
        const failed = await request(app).post(`${route}/evaluate`).set(auth).send({ analysisCode: f.analysisCode, measurements: [{ positionId: blank.id, value: 10 }] });
        expect(failed.status).toBe(200); expect(failed.body.status).toBe('QC_FAIL');
        if (deviation) await dispositionBatch(run.id, 'PROCEED_WITH_WARNING', 'Reviewed matrix interference in the first analyte', f.actor, f.db, { analysisCode: f.analysisCode });
        const oldObservations = await f.db.qcMeasurement.findMany({ where: { batchId: run.id, analysisCode: f.analysisCode } });
        const oldEvaluations = await f.db.qcEvaluation.findMany({ where: { batchId: run.id, analysisCode: f.analysisCode } });
        const oldDisposition = await f.db.batchDisposition.findMany({ where: { batchId: run.id, analysisCode: f.analysisCode } });
        const sibling = await request(app).post(`${route}/evaluate`).set(auth).send({ analysisCode: code, measurements: [{ positionId: blank.id, value: 0.01 }] });
        expect(sibling.status).toBe(200); expect(sibling.body.batch.analytes.find(row => row.analysisCode === code).status).toBe('QC_PASS');
        const before = await evidence(f.db);
        const locked = await request(app).post(`${route}/evaluate`).set(auth).send({ analysisCode: f.analysisCode, measurements: [{ positionId: blank.id, value: 0.01 }] });
        expect(locked.status).toBe(409); expect(locked.body.code).toBe('QC_BATCH_LOCKED'); expect(await evidence(f.db)).toEqual(before);
        const reopened = await request(app).put(route).set(auth).send({ status: 'OPEN', analysisCode: code, reason: 'Review only the accepted sibling observation' });
        expect(reopened.status).toBe(200); expect(reopened.body.batch.analytes.find(row => row.analysisCode === code).result).toBeNull();
        expect(reopened.body.batch.analytes.find(row => row.analysisCode === f.analysisCode).status).toBe(deviation ? 'ACCEPTED_WITH_DEVIATION' : 'QC_FAIL');
        if (deviation) expect(reopened.body.batch.analytes.find(row => row.analysisCode === f.analysisCode).disposition.reason).toBe('Reviewed matrix interference in the first analyte');
        const corrected = await request(app).post(`${route}/corrections`).set(auth).send({ analysisCode: code, reason: 'Reviewed sibling transcription', corrections: [{ positionId: blank.id, value: 0.02 }] });
        expect(corrected.status).toBe(200); expect(corrected.body.batch.analytes.find(row => row.analysisCode === code).status).toBe('QC_PASS');
        const closed = await request(app).put(route).set(auth).send({ status: 'CLOSED', analysisCode: code });
        expect(closed.status).toBe(200); expect(closed.body.batch.analytes.find(row => row.analysisCode === code).status).toBe('CLOSED');
        expect(closed.body.batch.analytes.find(row => row.analysisCode === f.analysisCode).status).toBe(deviation ? 'ACCEPTED_WITH_DEVIATION' : 'QC_FAIL');
        expect(await f.db.qcMeasurement.findMany({ where: { batchId: run.id, analysisCode: f.analysisCode } })).toEqual(oldObservations);
        expect(await f.db.qcEvaluation.findMany({ where: { batchId: run.id, analysisCode: f.analysisCode } })).toEqual(oldEvaluations);
        expect(await f.db.batchDisposition.findMany({ where: { batchId: run.id, analysisCode: f.analysisCode } })).toEqual(oldDisposition);
    });
});

test('an explicit method cannot replace recorded strict work-item methods with a lax QC rule', async () => {
    const f = await fixture(), method = await f.db.methodology.create({ data: { analysisCode: f.analysisCode, name: 'Different lax method' } });
    await rules.change(f.actor, { labId: f.labId, analysisCode: f.analysisCode, methodologyId: method.id,
        criteria: { blankPerBatch: 0, lrmPerBatch: 0, duplicateEvery: 0, crmEveryNBatches: 0 }, expectedVersion: 0,
        reason: 'A separate method has independently reviewed criteria' }, { db: f.db });
    const before = await evidence(f.db);
    await expect(buildNativeRun(f.db, f.actor, { ...f.input, analyses: [{ analysisCode: f.analysisCode, methodologyId: method.id }] }))
        .rejects.toMatchObject({ statusCode: 422, code: 'QC_BATCH_METHOD_AMBIGUOUS' });
    expect(await evidence(f.db)).toEqual(before);
});

test('a real failed Native blocking run remains excluded from reports and publication after live QC becomes OFF', async () => {
    const f = await fixture(), lot = await referenceLot(f);
    const run = await startNativeRun(f.db, (await buildNativeRun(f.db, f.actor, { ...f.input,
        analyses: [{ analysisCode: f.analysisCode, references: [{ positionKind: 'LRM', referenceMaterialLotId: lot.id }] }] })).id, f.actor);
    const item = await f.db.workItem.findUnique({ where: { id: f.workItemIds[0] } });
    const result = await createResultFixture(f.db, { data: { id: randomUUID(), sampleId: item.sampleId, param: f.analysisCode,
        batchId: run.id, value: '2.123456789', numericValue: 2.123456789, isCurrent: true, isValid: true, flags: '[]' } });
    await writeNativeMeasurements(f.db, run.id, f.actor, { measurements: readings(run, { blank: 10 }) });
    await policies.change(f.actor, f.labId, { reason: 'Later live policy must not reinterpret a started run',
        changes: [{ key: 'qc.mode', value: 'OFF' }] }, { db: f.db });
    const sample = await reviewedSample(f), batch = await f.db.batch.findUnique({ where: { id: run.id }, include: QC_RUN_INCLUDE });
    const resolved = await resolveReportingModes(sample, [batch], { db: f.db });
    expect(resolved.qcModes[result.id]).toBe('REQUIRED_BLOCKING');
    expect(resolved.qcModeEvidence[0]).toMatchObject({ resultId: result.id, effectiveMode: 'REQUIRED_BLOCKING',
        source: 'FROZEN', contributingBatchIds: [run.id] });
    expect(canPublish(sample, null, f.actor, { ...resolved, qcBatches: [batch] })).toMatchObject({ allowed: false, code: 'QC_BATCH_FAILED' });
    const { content } = await assembleReport(sample.id, f.actor, { db: f.db });
    expect(content.resultGroups.flatMap(group => group.items)).toEqual([]);
    expect(content.evidence.qcModes).toEqual(resolved.qcModeEvidence);
    const before = await evidence(f.db), reports = await f.db.report.count();
    await withQcRunHttp(f.db, f.actor, async (app, token) => {
        const response = await request(app).post(`/api/reports/generate/${sample.id}`).set('Authorization', `Bearer ${token}`);
        expect(response.status).toBe(409); expect(response.body.code).toBe('QC_BATCH_FAILED');
        expect(response.body.qcModeEvidence).toEqual(resolved.qcModeEvidence);
    }, { reports: true });
    expect(await evidence(f.db)).toEqual(before); expect(await f.db.report.count()).toBe(reports);
});

test('mixed actual Native ADVISORY and compatibility live BLOCKING batches use the strictest effective report mode', async () => {
    const f = await fixture();
    await policies.change(f.actor, f.labId, { reason: 'Freeze advisory Native mode', changes: [{ key: 'qc.mode', value: 'ADVISORY' }] }, { db: f.db });
    const native = await startNativeRun(f.db, (await buildNativeRun(f.db, f.actor, f.input)).id, f.actor);
    const compatibility = await createProfileRun(f.db, f.actor, { analysis: f.analysisCode, profile: 'RACK_40' });
    const item = await f.db.workItem.findUnique({ where: { id: f.workItemIds[0] } });
    const result = await createResultFixture(f.db, { data: { id: randomUUID(), sampleId: item.sampleId, param: f.analysisCode,
        batchId: compatibility.id, value: '7', isCurrent: true, isValid: true, flags: '[]' } });
    await policies.change(f.actor, f.labId, { reason: 'Require live compatibility QC', changes: [{ key: 'qc.mode', value: 'REQUIRED_BLOCKING' }] }, { db: f.db });
    const sample = await reviewedSample(f), batches = await f.db.batch.findMany({ include: QC_RUN_INCLUDE });
    const resolved = await resolveReportingModes(sample, batches, { db: f.db });
    expect(resolved.qcModes[result.id]).toBe('REQUIRED_BLOCKING');
    expect(resolved.qcModeEvidence[0]).toMatchObject({ source: 'LIVE', contributingBatchIds: [compatibility.id, native.id],
        contributions: [{ batchId: compatibility.id, mode: 'REQUIRED_BLOCKING', source: 'LIVE' }, { batchId: native.id, mode: 'ADVISORY', source: 'FROZEN' }] });
    expect(canPublish(sample, null, f.actor, { ...resolved, qcBatches: batches }).allowed).toBe(false);
});

test('a compatibility-only failed run retains live policy changes for report validity and publication', async () => {
    const f = await fixture(), run = await createProfileRun(f.db, f.actor, { analysis: f.analysisCode, profile: 'RACK_40' });
    const item = await f.db.workItem.findUnique({ where: { id: f.workItemIds[0] } });
    const result = await createResultFixture(f.db, { data: { id: randomUUID(), sampleId: item.sampleId, param: f.analysisCode,
        batchId: run.id, value: '7', isCurrent: true, isValid: true, flags: '[]' } });
    await writeCompatibilityMeasurements(f.db, run.id, f.actor, { blanks: [{ value: 10 }], controls: [{ expected: 7, measured: 7 }],
        duplicates: [{ value1: 7, value2: 7 }, { value1: 7, value2: 7 }] });
    const sample = await reviewedSample(f), batches = await f.db.batch.findMany({ include: QC_RUN_INCLUDE });
    const blocking = await resolveReportingModes(sample, batches, { db: f.db });
    expect(blocking.qcModes[result.id]).toBe('REQUIRED_BLOCKING');
    expect(canPublish(sample, null, f.actor, { ...blocking, qcBatches: batches }).allowed).toBe(false);
    await policies.change(f.actor, f.labId, { reason: 'Live compatibility policy remains authoritative', changes: [{ key: 'qc.mode', value: 'OFF' }] }, { db: f.db });
    const off = await resolveReportingModes(sample, batches, { db: f.db });
    expect(off.qcModeEvidence[0]).toMatchObject({ resultId: result.id, effectiveMode: 'OFF', source: 'LIVE', contributingBatchIds: [run.id] });
    expect(canPublish(sample, null, f.actor, { ...off, qcBatches: batches }).allowed).toBe(true);
    const { content } = await assembleReport(sample.id, f.actor, { db: f.db });
    expect(content.resultGroups.flatMap(group => group.items)).toEqual([expect.objectContaining({ param: f.analysisCode, value: '7' })]);
    expect(content.evidence.qcModes).toEqual(off.qcModeEvidence);
});

test('Native texture QC flags its governed fractions independently and preserves their values on deviation acceptance', async () => {
    const f = await fixture(1, { crmEveryNBatches: 0 }, 'PSA'), b = await secondAnalyte(f), lot = await referenceLot(f);
    await f.db.referenceValue.create({ data: { id: randomUUID(), referenceMaterialId: lot.id, analysisCode: b.analysisCode,
        assignedValue: 7.123456789, unit: 'fixture-unit', valueType: 'LAB_ASSIGNED', createdBy: f.actor.username } });
    const run = await startNativeRun(f.db, (await buildNativeRun(f.db, f.actor, { ...f.input, workItemIds: [...f.workItemIds, b.item.id],
        analyses: [f.analysisCode, b.analysisCode].map(analysisCode => ({ analysisCode,
            references: [{ positionKind: 'LRM', referenceMaterialLotId: lot.id }] })) })).id, f.actor);
    const fractions = [];
    for (const [param, value] of [['SAND', '45'], ['SILT', '30'], ['CLAY', '25']]) {
        fractions.push(await createResultFixture(f.db, { data: { id: randomUUID(), sampleId: b.sampleId, param, value,
            numericValue: Number(value), rawInput: value, methodologyId: f.method.id, batchId: run.id, isCurrent: true, isValid: true, flags: '[]' } }));
    }
    const unrelated = await createResultFixture(f.db, { data: { id: randomUUID(), sampleId: b.sampleId, param: b.analysisCode,
        methodologyId: b.method.id, value: '7', batchId: run.id, isCurrent: true, isValid: true, flags: '[]' } });
    await writeNativeMeasurements(f.db, run.id, f.actor, { analysisCode: f.analysisCode, measurements: readings(run, { control: 20 }) });
    for (const original of fractions) expect(await f.db.result.findUnique({ where: { id: original.id } }))
        .toEqual({ ...original, updatedAt: expect.any(Date), isValid: false, flags: '["QC_BATCH_FAILED"]' });
    expect(await f.db.result.findUnique({ where: { id: unrelated.id } })).toEqual(unrelated);
    const failedEvidence = await f.db.qcMeasurement.findMany(), evaluations = await f.db.qcEvaluation.findMany();
    await dispositionBatch(run.id, 'ACCEPT_WITH_DEVIATION', 'Reviewed texture control deviation', f.actor, f.db, { analysisCode: f.analysisCode });
    for (const original of fractions) expect(await f.db.result.findUnique({ where: { id: original.id } }))
        .toEqual({ ...original, updatedAt: expect.any(Date), flags: '["QC_WARNING_OVERRIDDEN"]' });
    expect(await f.db.result.findUnique({ where: { id: unrelated.id } })).toEqual(unrelated);
    expect(await f.db.qcMeasurement.findMany()).toEqual(failedEvidence); expect(await f.db.qcEvaluation.findMany()).toEqual(evaluations);
});

test('test-owned cleanup retains QC-referenced workflow evidence and still removes unrelated explicit fixture ids', async () => {
    const f = await fixture(), run = await buildNativeRun(f.db, f.actor, f.input);
    const item = await f.db.workItem.findUnique({ where: { id: f.workItemIds[0] } });
    const before = await evidence(f.db);
    expect(await cleanupWorkflowFixtures(f.db, 'workItem', [item.id], { single: true }))
        .toEqual({ count: 0, retainedIds: [item.id] });
    expect(await cleanupWorkflowFixtures(f.db, 'sample', [item.sampleId], { single: true }))
        .toEqual({ count: 0, retainedIds: [item.sampleId] });
    expect(await evidence(f.db)).toEqual(before);
    const [unrelatedId] = await members(f, 1);
    const unrelated = await f.db.workItem.findUnique({ where: { id: unrelatedId } });
    expect(await cleanupWorkflowFixtures(f.db, 'workItem', [item.id, unrelatedId])).toEqual({ count: 1 });
    expect(await cleanupWorkflowFixtures(f.db, 'sample', [item.sampleId, unrelated.sampleId])).toEqual({ count: 1 });
    expect(await f.db.workItem.findUnique({ where: { id: unrelatedId } })).toBeNull();
    expect(await f.db.sample.findUnique({ where: { id: unrelated.sampleId } })).toBeNull();
    expect(await f.db.batchPositionWorkItem.findMany({ where: { workItemId: item.id } })).toHaveLength(1);
    expect(await f.db.batchPosition.count({ where: { batchId: run.id, kind: 'SAMPLE', sampleId: item.sampleId } })).toBe(1);
});

test('Native builds refuse two active attempts for a sample/analyte and never attach ACCEPTED history, with zero writes', async () => {
    const f = await fixture(), original = await f.db.workItem.findUnique({ where: { id: f.workItemIds[0] } });
    const duplicate = await createWorkItemFixture(f.db, { data: { id: randomUUID(), sampleId: original.sampleId, labId: f.labId,
        analysis: f.analysisCode, methodologyId: f.method.id, duplicateOf: original.id, status: 'IN_PROGRESS' } });
    const accepted = await createWorkItemFixture(f.db, { data: { id: randomUUID(), sampleId: original.sampleId, labId: f.labId,
        analysis: f.analysisCode, methodologyId: f.method.id, duplicateOf: original.id, status: 'ACCEPTED' } });
    const before = await evidence(f.db);
    await expect(buildNativeRun(f.db, f.actor, { ...f.input, workItemIds: [original.id, duplicate.id] }))
        .rejects.toMatchObject({ statusCode: 422, code: 'QC_BATCH_DUPLICATE_MEMBERSHIP' });
    expect(await evidence(f.db)).toEqual(before);
    await expect(buildNativeRun(f.db, f.actor, { ...f.input, workItemIds: [accepted.id] }))
        .rejects.toMatchObject({ statusCode: 400, code: 'QC_WORK_ITEM_SEALED' });
    expect(await evidence(f.db)).toEqual(before);
});

test.each(['SUBMITTED', 'ACCEPTED', 'WAIVED', 'CANCELLED'])('sealed %s work items cannot join Native or ordinary runs', async status => {
    const f = await fixture(), original = await f.db.workItem.findUnique({ where: { id: f.workItemIds[0] } });
    const sealed = await createWorkItemFixture(f.db, { data: { id: randomUUID(), sampleId: original.sampleId, labId: f.labId,
        analysis: f.analysisCode, methodologyId: f.method.id, duplicateOf: original.id, status } });
    const profile = await createProfileRun(f.db, f.actor, { analysis: f.analysisCode, profile: 'RACK_40' });
    const before = await evidence(f.db);
    await expect(buildNativeRun(f.db, f.actor, { ...f.input, workItemIds: [sealed.id] })).rejects.toMatchObject({ statusCode: 400, code: 'QC_WORK_ITEM_SEALED' });
    await expect(changeRunMembers(f.db, profile.id, f.actor, { workItemIds: [sealed.id] })).rejects.toMatchObject({ statusCode: 400, code: 'QC_WORK_ITEM_SEALED' });
    expect(await evidence(f.db)).toEqual(before);
});

test('concurrent A/B first starts allocate distinct ordinals; abandoned OPEN builds do not consume C’s ordinal', async () => {
    const f = await fixture(), lot = await referenceLot(f), runs = [];
    const selections = [{ analysisCode: f.analysisCode, references: [{ positionKind: 'LRM', referenceMaterialLotId: lot.id }] }];
    for (let index = 0; index < 4; index++) runs.push(await buildNativeRun(f.db, f.actor, { ...f.input,
        workItemIds: index ? await members(f, 1) : f.workItemIds, analyses: selections, seed: `concurrent-${index}` }));
    expect(runs.every(row => row.analytes[0].crmOrdinal === null)).toBe(true);
    const results = await Promise.allSettled(runs.slice(0, 2).map(run => startNativeRun(f.db, run.id, f.actor)));
    expect(results.some(row => row.status === 'fulfilled')).toBe(true);
    for (const [index, outcome] of results.entries()) if (outcome.status === 'rejected') {
        expect(outcome.reason).toMatchObject({ statusCode: 409, code: 'QC_SEQUENCE_STALE' });
        const refused = await f.db.batch.findUnique({ where: { id: runs[index].id }, include: QC_RUN_INCLUDE });
        expect(refused.startedAt).toBeNull(); expect(refused.analytes[0].crmOrdinal).toBeNull();
        expect(refused.events.some(row => row.type === 'RUN_STARTED')).toBe(false);
        await startNativeRun(f.db, runs[index].id, f.actor);
    }
    const allocated = await f.db.batchAnalyte.findMany({ where: { batchId: { in: runs.slice(0, 2).map(row => row.id) } } });
    expect(allocated.map(row => row.crmOrdinal).sort()).toEqual([1, 2]);
    const third = await startNativeRun(f.db, runs[2].id, f.actor);
    expect(third.analytes[0].crmOrdinal).toBe(3);
    const abandoned = await f.db.batch.findUnique({ where: { id: runs[3].id }, include: QC_RUN_INCLUDE });
    expect(abandoned.startedAt).toBeNull(); expect(abandoned.analytes[0].crmOrdinal).toBeNull();
    expect(abandoned.events.some(row => row.type === 'RUN_STARTED')).toBe(false);
});

test('actual OPEN reorder retains physical ids, lot evidence and duplicate parents; invalid and frozen orders write nothing', async () => {
    const f = await fixture(2), run = await buildNativeRun(f.db, f.actor, f.input), lot = await referenceLot(f);
    const control = run.positions.find(row => row.kind === 'LRM');
    await f.db.$transaction(async tx => applyPositionBindings(tx, await preparePositionBindings(tx, { batch: run, position: control,
        analyses: run.analytes, actor: f.actor, referenceMaterialId: lot.id }, new Date())));
    const bindings = await f.db.batchPositionReference.findMany(), originalPositions = await f.db.batchPosition.findMany();
    const samples = run.positions.filter(row => row.kind === 'SAMPLE'), ids = run.positions.map(row => row.id);
    const duplicateIds = run.positions.filter(row => row.kind === 'DUPLICATE').map(row => row.id);
    const swapped = [...ids.filter(id => !duplicateIds.includes(id)).map(id => id === samples[0].id ? samples[1].id : id === samples[1].id ? samples[0].id : id), ...duplicateIds];
    await withQcRunHttp(f.db, f.actor, async (app, token) => {
        const auth = { Authorization: `Bearer ${token}` }, route = `/api/qc/batches/${run.id}/reorder`, before = await evidence(f.db);
        const duplicate = run.positions.find(row => row.kind === 'DUPLICATE');
        const parentFirst = [duplicate.id, ...ids.filter(id => id !== duplicate.id)];
        for (const [positionIds, code] of [[ids.slice(1), 'QC_SEQUENCE_ORDER_INVALID'], [[ids[0], ...ids.slice(0, -1)], 'QC_SEQUENCE_ORDER_INVALID'], [parentFirst, 'QC_SEQUENCE_STALE']]) {
            const refused = await request(app).post(route).set(auth).send({ positionIds });
            expect(refused.status).toBe(code === 'QC_SEQUENCE_STALE' ? 409 : 400); expect(refused.body.code).toBe(code);
            expect(await evidence(f.db)).toEqual(before);
        }
        const response = await request(app).post(route).set(auth).send({ positionIds: swapped });
        expect(response.status).toBe(200); expect(response.body.batch.positions.map(row => row.id)).toEqual(swapped);
        expect(await f.db.batchPositionReference.findMany()).toEqual(bindings); expect(await f.db.qcMeasurement.count()).toBe(0);
        for (const old of originalPositions) expect(await f.db.batchPosition.findUnique({ where: { id: old.id } })).toEqual({ ...old, position: swapped.indexOf(old.id) + 1 });
        for (const sample of samples) {
            const item = await f.db.workItem.findFirst({ where: { sampleId: sample.sampleId } });
            expect(item.rackPosition).toBe(swapped.indexOf(sample.id) + 1);
        }
        const analyte = await f.db.batchAnalyte.findFirst(); expect(analyte.crmOrdinal).toBeNull(); expect(analyte.criteriaSnapshot).toBeNull();
        const event = await f.db.batchEvent.findFirst({ where: { type: 'RUN_REORDERED' } });
        const buildEvent = await f.db.batchEvent.findFirst({ where: { type: 'RUN_BUILT' } });
        expect(JSON.parse(event.payload).duplicateSelection).toEqual(JSON.parse(buildEvent.payload).duplicateSelection);
        const started = await startNativeRun(f.db, run.id, f.actor); expect(started.positions.map(row => row.id)).toEqual(swapped);
        const frozen = await evidence(f.db);
        const refused = await request(app).post(route).set(auth).send({ positionIds: ids });
        expect(refused.status).toBe(409); expect(refused.body.code).toBe('BATCH_MEMBERSHIP_FROZEN'); expect(await evidence(f.db)).toEqual(frozen);
    });
});

test('a late reorder event fault rolls back temporary numbering and all work-item rack changes', async () => {
    const f = await fixture(2), run = await buildNativeRun(f.db, f.actor, f.input), before = await evidence(f.db);
    const samples = run.positions.filter(row => row.kind === 'SAMPLE');
    const ids = [...run.positions.filter(row => row.kind !== 'DUPLICATE').map(row => row.id === samples[0].id ? samples[1].id : row.id === samples[1].id ? samples[0].id : row.id),
        ...run.positions.filter(row => row.kind === 'DUPLICATE').map(row => row.id)];
    await f.db.$executeRawUnsafe(`CREATE TRIGGER "fixture_reorder_event_fault" BEFORE INSERT ON "BatchEvent" WHEN NEW.type='RUN_REORDERED' BEGIN SELECT RAISE(ABORT, 'fixture reorder event fault'); END`);
    // The SQLite adapter maps a trigger ABORT to P2003, losing its message.
    await expect(reorderNativeRun(f.db, run.id, f.actor, { positionIds: ids })).rejects.toMatchObject({ code: 'P2003' });
    expect(await evidence(f.db)).toEqual(before);
});

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
    expect((await f.db.batchAnalyte.findFirst()).status).toBe('QC_PENDING');
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

test('retained Native collection input uses physical ids, real duplicate parents and immutable full-precision expected values', async () => {
    const f = await fixture(), lot = await referenceLot(f), built = await buildNativeRun(f.db, f.actor, f.input);
    const started = await mutateQcRun(f.db, built.id, f.actor, { status: 'IN_RUN' }), run = started.batch;
    expect(started.status).toBe('RUNNING');
    const blank = run.positions.find(row => row.kind === 'BLANK'), control = run.positions.find(row => row.kind === 'LRM'), duplicate = run.positions.find(row => row.kind === 'DUPLICATE');
    const input = { blanks: [{ id: blank.id, value: 0.0123456789 }], controls: [{ id: control.id, measured: 7.123456789, expected: 7.123456789,
        referenceMaterialId: lot.id, referenceUse: 'LRM' }], duplicates: [{ id: duplicate.id, value1: 2.123456789, value2: 2.123456789 }] };
    const before = await evidence(f.db);
    for (const invalid of [{ ...input, blanks: [{ id: 'client-invented-position', value: 0 }] },
        { ...input, duplicates: [{ ...input.duplicates[0], duplicateOfPositionId: 'invented-parent' }] },
        { ...input, duplicates: [{ id: duplicate.id, value1: 2.123456789 }] },
        { ...input, controls: [{ ...input.controls[0], expected: 7.12 }] },
        { measurements: [], expectedValues: [] }]) {
        await expect(mutateQcRun(f.db, run.id, f.actor, invalid)).rejects.toHaveProperty('statusCode');
        expect(await evidence(f.db)).toEqual(before);
    }
    const response = await mutateQcRun(f.db, run.id, f.actor, input, { explicit: true });
    expect(response.status).toBe('QC_PASS');
    expect(response.batch.qcResults.duplicates[0]).toMatchObject({ duplicateOfPositionId: duplicate.duplicateOfPositionId, value1: 2.123456789, value2: 2.123456789 });
    expect(await f.db.qcMeasurement.findFirst({ where: { positionId: duplicate.duplicateOfPositionId } })).toMatchObject({ replicateNo: 1, value: 2.123456789 });
    expect(await f.db.qcMeasurement.findFirst({ where: { positionId: duplicate.id } })).toMatchObject({ replicateNo: 1, value: 2.123456789 });
    expect(await f.db.batchQcResult.count()).toBe(0);
});

test('the shared Native mutation rolls back evaluated observations when requested acceptance, close or metadata is refused', async () => {
    const f = await fixture(), lot = await referenceLot(f), run = await startNativeRun(f.db, (await buildNativeRun(f.db, f.actor, { ...f.input,
        analyses: [{ analysisCode: f.analysisCode, references: [{ positionKind: 'LRM', referenceMaterialLotId: lot.id }] }] })).id, f.actor);
    const before = await evidence(f.db);
    for (const input of [{ measurements: readings(run, { blank: 10 }), status: 'QC_PASS', notes: 'Refused acceptance must not persist' },
        { measurements: readings(run, { blank: 10 }), status: 'CLOSED' }, { measurements: readings(run), notes: { invalid: 'metadata' } }]) {
        await expect(mutateQcRun(f.db, run.id, f.actor, input)).rejects.toHaveProperty('statusCode');
        expect(await evidence(f.db)).toEqual(before);
    }
    const failed = await mutateQcRun(f.db, run.id, f.actor, { measurements: readings(run, { blank: 10 }), status: 'RUNNING' });
    expect(failed.status).toBe('QC_FAIL'); expect(failed.batch.analytes[0].result).toBe('FAIL');
    const locked = await evidence(f.db);
    await expect(mutateQcRun(f.db, run.id, f.actor, { status: 'OPEN' })).rejects.toMatchObject({ statusCode: 409, code: 'QC_BATCH_LOCKED' });
    expect(await evidence(f.db)).toEqual(locked);
});

test('actual authenticated Native routes build, start, evaluate, reopen and correct using frozen API criteria and exact retained values', async () => {
    const f = await fixture(), lot = await referenceLot(f);
    await f.db.user.update({ where: { username: f.actor.username }, data: { labId: f.labId } });
    await withQcRunHttp(f.db, f.actor, async (app, token) => {
        const auth = { Authorization: `Bearer ${token}` };
        const created = await request(app).post('/api/qc/batches').set(auth).send({ ...f.input, analyses: [{ analysisCode: f.analysisCode,
            references: [{ positionKind: 'LRM', referenceMaterialLotId: lot.id }] }] });
        expect(created.status).toBe(201); const id = created.body.id;
        const preStart = await evidence(f.db);
        const refused = await request(app).post(`/api/qc/batches/${id}/evaluate`).set(auth).send({});
        expect(refused.status).toBe(409); expect(refused.body.code).toBe('QC_RUN_NOT_STARTED'); expect(await evidence(f.db)).toEqual(preStart);
        const started = await request(app).put(`/api/qc/batches/${id}`).set(auth).send({ status: 'IN_RUN' });
        expect(started.status).toBe(200); expect(started.body.status).toBe('RUNNING');
        const run = started.body.batch;
        const evaluated = await request(app).post(`/api/qc/batches/${id}/evaluate`).set(auth).send({ measurements: readings(run) });
        expect(evaluated.status).toBe(200); expect(evaluated.body.status).toBe('QC_PASS'); expect(typeof evaluated.body.batch.qcResults).toBe('string');
        const frozen = JSON.parse(run.analytes[0].criteriaSnapshot);
        await rules.change(f.actor, { labId: f.labId, analysisCode: f.analysisCode, methodologyId: f.method.id,
            criteria: { blankAbsLimit: 10 }, expectedVersion: 1, reason: 'Later criteria must not change started API metadata' }, { db: f.db });
        await policies.change(f.actor, f.labId, { reason: 'Later lab mode must not change this started run', changes: [{ key: 'qc.mode', value: 'OFF' }] }, { db: f.db });
        const detail = await request(app).get(`/api/qc/batches/${id}`).set(auth);
        expect(detail.status).toBe(200); expect(detail.body.data.qcRule).toEqual(frozen.qcRule);
        expect(detail.body.data.numberFormat).toEqual(frozen.numberFormat); expect(detail.body.data.qcRequirements.LRM.required).toBe(1);
        expect(detail.body.data.qcMode).toBe(frozen.qcMode);
        expect(detail.body.data.qcResults.blanks[0].value).toBe(0.0123456789); expect(typeof detail.body.data.workItemIds).toBe('string');
        const list = await request(app).get('/api/qc/batches').set(auth);
        expect(list.status).toBe(200); const listed = list.body.data.find(row => row.id === id);
        for (const key of ['qcResults', 'workItemIds', 'history']) expect(typeof listed[key]).toBe('string');
        expect(JSON.parse(listed.qcResults)).toEqual(detail.body.data.qcResults);
        const reopened = await request(app).put(`/api/qc/batches/${id}`).set(auth).send({ status: 'OPEN', reason: 'Reviewed Native transcription correction' });
        expect(reopened.status).toBe(200); expect(reopened.body.status).toBe('OPEN');
        const corrected = await request(app).post(`/api/qc/batches/${id}/corrections`).set(auth).send({ reason: 'Correct the measured blank',
            analysisCode: f.analysisCode, corrections: [{ positionId: run.positions.find(row => row.kind === 'BLANK').id, replicateNo: 1, value: 0.0223456789 }] });
        expect(corrected.status).toBe(200); expect(corrected.body.batch.analytes[0].result).toBe('PASS');
        expect(await f.db.qcEvaluation.count()).toBe(2);
        const raw = await f.db.batch.findUnique({ where: { id } });
        for (const key of ['qcResults', 'workItemIds', 'history', 'disposition']) expect(raw[key]).toBeNull();
        expect(await f.db.batchQcResult.count()).toBe(0);
    });
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
    await expect(writeNativeMeasurements(f.db, run.id, f.actor, { reason: 'A correction does not itself reopen acceptance',
        corrections: [{ positionId: blank.id, value: 0.223456789 }] }, { correction: true }))
        .rejects.toMatchObject({ statusCode: 409, code: 'QC_BATCH_LOCKED' });
    expect(await evidence(f.db)).toEqual(before);
    await expect(reopenNativeRun(f.db, run.id, { ...f.actor, role: 'LAB_TECHNICIAN' }, 'Reopen needs manager authority'))
        .rejects.toMatchObject({ statusCode: 403, code: 'QC_REOPEN_PERMISSION_REQUIRED' });
    await expect(reopenNativeRun(f.db, run.id, f.actor, '')).rejects.toMatchObject({ statusCode: 400, code: 'REASON_REQUIRED' });
    expect(await evidence(f.db)).toEqual(before);
    const reopened = await reopenNativeRun(f.db, run.id, f.actor, 'Reopen the accepted run for checked transcription correction');
    expect(reopened.analytes[0].status).toBe('QC_PENDING');
    expect(reopened.qcResults.blanks[0].value).toBe(original.value);
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
    for (const role of ['LAB_TECHNICIAN', 'LAB_MANAGER', 'SUPER_ADMIN']) {
        const actor = { ...f.actor, role };
        for (const change of [{ corrections: [{ positionId: blank.id, value: 0 }] },
            { references: [{ positionId: run.positions.find(row => row.kind === 'LRM').id, referenceMaterialId: lot.id }] }]) {
            await expect(writeNativeMeasurements(f.db, run.id, actor, { reason: 'Failed evidence stays locked', ...change }, { correction: true }))
                .rejects.toMatchObject({ statusCode: 409, code: 'QC_BATCH_LOCKED' });
            expect(await evidence(f.db)).toEqual(locked);
        }
        await expect(reopenNativeRun(f.db, run.id, actor, 'Failed evidence stays locked')).rejects.toMatchObject({ statusCode: 409, code: 'QC_BATCH_LOCKED' });
        expect(await evidence(f.db)).toEqual(locked);
    }
});

test('explicit evaluation after reopen appends fresh acceptance without rewriting retained readings', async () => {
    const f = await fixture(), lot = await referenceLot(f);
    expect((await f.db.$queryRawUnsafe('PRAGMA foreign_keys')).map(row => Number(row.foreign_keys))).toEqual([1]);
    expect((await require('../../prisma').$queryRawUnsafe('PRAGMA foreign_keys')).map(row => Number(row.foreign_keys))).toEqual([1]);
    const run = await startNativeRun(f.db, (await buildNativeRun(f.db, f.actor, { ...f.input,
        analyses: [{ analysisCode: f.analysisCode, references: [{ positionKind: 'LRM', referenceMaterialLotId: lot.id }] }] })).id, f.actor);
    const first = await writeNativeMeasurements(f.db, run.id, f.actor, { measurements: readings(run) });
    const observations = await f.db.qcMeasurement.findMany({ orderBy: { id: 'asc' } });
    const reopened = await reopenNativeRun(f.db, run.id, f.actor, 'Recheck the retained evidence before acceptance');
    expect(reopened.analytes[0]).toMatchObject({ status: 'QC_PENDING', result: null });
    const accepted = await writeNativeMeasurements(f.db, run.id, f.actor, { analysisCode: f.analysisCode }, { explicit: true });
    expect(accepted.analytes[0]).toMatchObject({ status: 'QC_PASS', result: 'PASS' });
    expect(accepted.evaluations).toHaveLength(2);
    expect(accepted.evaluations[0]).toEqual(first.evaluations[0]);
    expect(accepted.evaluations[1]).toMatchObject({ supersedesId: first.evaluations[0].id, version: 2, verdict: 'PASS' });
    expect(await f.db.qcMeasurement.findMany({ orderBy: { id: 'asc' } })).toEqual(observations);
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

test('explicit evaluation records each OFF analyte without fake readings or passed QC counts', async () => {
    const f = await fixture(), b = await secondAnalyte(f);
    await policies.change(f.actor, f.labId, { reason: 'Both fixture analyses do not require QC', changes: [{ key: 'qc.mode', value: 'OFF' }] }, { db: f.db });
    const run = await startNativeRun(f.db, (await buildNativeRun(f.db, f.actor, { ...f.input, workItemIds: [...f.workItemIds, b.item.id] })).id, f.actor);
    expect(await f.db.qcEvaluation.count()).toBe(0);
    const evaluated = await mutateQcRun(f.db, run.id, f.actor, {}, { explicit: true });
    expect(evaluated.batch.analytes).toHaveLength(2);
    for (const row of evaluated.batch.analytes) {
        expect(row.result).toBe('NOT_REQUIRED'); expect(row.qcResults.summary).toMatchObject({ passed: 0, totalQcSamples: 0, notRequired: true });
    }
    expect(await f.db.qcEvaluation.count()).toBe(2); expect(await f.db.qcMeasurement.count()).toBe(0);
});

test('part 13 profile conversion and direct non-calibration runs preserve free text and may start without a registered asset', async () => {
    const f = await fixture(), profile = await createProfileRun(f.db, f.actor, { analysis: f.analysisCode, instrument: 'Manual bench text', profile: 'RACK_40' });
    const built = await rebuildNativeRun(f.db, profile.id, f.actor, { workItemIds: f.workItemIds });
    expect(built).toMatchObject({ instrumentId: null, instrument: 'Manual bench text' }); expect(built.analytes[0].provenance).toBe('NATIVE');
    const started = await startNativeRun(f.db, built.id, f.actor);
    expect(started).toMatchObject({ instrumentId: null, instrument: 'Manual bench text', status: 'RUNNING' });
    expect(JSON.parse(started.analytes[0].criteriaSnapshot)).toMatchObject({ instrumentId: null, instrumentText: 'Manual bench text' });
    const direct = await buildNativeRun(f.db, f.actor, { workItemIds: await members(f, 1), instrument: 'Another manual bench' });
    expect((await startNativeRun(f.db, direct.id, f.actor)).instrumentId).toBeNull();
});

test('part 13 calibration start requires a valid active scoped asset, refuses without writes and freezes its exact identity and text', async () => {
    const f = await fixture();
    await policies.change(f.actor, f.labId, { reason: 'Calibration verification requires a registered fixture instrument',
        changes: [{ key: 'qc.calibrationVerification', value: true }] }, { db: f.db });
    const profile = await createProfileRun(f.db, f.actor, { analysis: f.analysisCode, instrument: 'Recorded bench name' });
    const built = await rebuildNativeRun(f.db, profile.id, f.actor, { workItemIds: f.workItemIds });
    const before = await evidence(f.db);
    await expect(startNativeRun(f.db, built.id, f.actor)).rejects.toMatchObject({ statusCode: 422, code: 'QC_INSTRUMENT_REQUIRED' });
    expect(await evidence(f.db)).toEqual(before);
    const outside = await f.db.equipmentAsset.create({ data: { id: randomUUID(), labId: 'OTHER-LAB', name: 'Outside instrument', assetType: 'OTHER', status: 'IN_SERVICE', criticality: 'NON_CRITICAL' } });
    const inactive = await f.db.equipmentAsset.create({ data: { id: randomUUID(), labId: f.labId, name: 'Inactive instrument', assetType: 'OTHER', status: 'OUT_OF_SERVICE', criticality: 'NON_CRITICAL' } });
    for (const id of ['nonexistent-asset', outside.id, inactive.id]) {
        await expect(mutateQcRun(f.db, built.id, f.actor, { instrumentId: id })).rejects.toMatchObject({ statusCode: 422, code: 'QC_INSTRUMENT_INVALID' });
        expect(await evidence(f.db)).toEqual(before);
    }
    const selected = await mutateQcRun(f.db, built.id, f.actor, { instrumentId: f.instrument.id });
    expect(selected.batch).toMatchObject({ instrumentId: f.instrument.id, instrument: 'Recorded bench name' });
    const started = await mutateQcRun(f.db, built.id, f.actor, { status: 'RUNNING' });
    expect(JSON.parse(started.batch.analytes[0].criteriaSnapshot)).toMatchObject({ instrumentId: f.instrument.id, instrumentText: 'Recorded bench name' });
    const frozen = await evidence(f.db);
    await expect(mutateQcRun(f.db, built.id, f.actor, { instrumentId: null })).rejects.toMatchObject({ statusCode: 409, code: 'QC_INSTRUMENT_FROZEN' });
    expect(await evidence(f.db)).toEqual(frozen);
});

test.each(['REPEAT_BATCH', 'REJECT'])('failed Native disposition %s retains failed evidence and uses the central work transition', async decision => {
    const f = await fixture(), lot = await referenceLot(f), run = await startNativeRun(f.db, (await buildNativeRun(f.db, f.actor, { ...f.input,
        analyses: [{ analysisCode: f.analysisCode, references: [{ positionKind: 'LRM', referenceMaterialLotId: lot.id }] }] })).id, f.actor);
    const failed = await writeNativeMeasurements(f.db, run.id, f.actor, { measurements: readings(run, { blank: 10 }) });
    const before = await evidence(f.db), oldMeasurements = await f.db.qcMeasurement.findMany(), oldEvaluation = await f.db.qcEvaluation.findFirst();
    await expect(dispositionBatch(run.id, decision, 'Reviewed disposition requires manager authority', { ...f.actor, role: 'LAB_TECHNICIAN' }, f.db))
        .rejects.toMatchObject({ statusCode: 403, code: 'QC_DISPOSITION_FORBIDDEN' });
    expect(await evidence(f.db)).toEqual(before);
    const outcome = await dispositionBatch(run.id, decision, 'Reviewed failed evidence requires a new run', f.actor, f.db);
    expect(outcome.disposition.canonicalDecision).toBe(decision);
    const analyte = await f.db.batchAnalyte.findFirst(); expect(analyte.status).toBe(decision === 'REJECT' ? 'REJECTED' : 'REPEAT_ORDERED');
    expect((await f.db.workItem.findUnique({ where: { id: f.workItemIds[0] } })).status).toBe('REPEAT_REQUIRED');
    expect(await f.db.qcMeasurement.findMany()).toEqual(oldMeasurements); expect(await f.db.qcEvaluation.findFirst()).toEqual(oldEvaluation);
    expect((await f.db.batch.findUnique({ where: { id: run.id } })).status).toBe(failed.status);
    const disposed = await evidence(f.db);
    expect((await dispositionBatch(run.id, decision, outcome.disposition.reason, f.actor, f.db)).idempotent).toBe(true);
    expect(await evidence(f.db)).toEqual(disposed);
    await expect(mutateQcRun(f.db, run.id, f.actor, { status: 'CLOSED' })).rejects.toHaveProperty('statusCode');
    expect(await evidence(f.db)).toEqual(disposed);
    const oldJoins = await f.db.batchPositionWorkItem.findMany({ where: { position: { batchId: run.id } }, orderBy: { id: 'asc' } });
    const repeated = await buildNativeRun(f.db, f.actor, { ...f.input,
        analyses: [{ analysisCode: f.analysisCode, references: [{ positionKind: 'LRM', referenceMaterialLotId: lot.id }] }] });
    const started = await startNativeRun(f.db, repeated.id, f.actor);
    expect(started.workItemIds).toEqual(run.workItemIds);
    expect(repeated.events.filter(row => row.type === 'MEMBER_REPEATED').map(row => JSON.parse(row.payload)))
        .toEqual(f.workItemIds.map(workItemId => ({ fromBatchId: run.id, workItemId, analysisCode: f.analysisCode })));
    expect(await f.db.batchPositionWorkItem.findMany({ where: { position: { batchId: run.id } }, orderBy: { id: 'asc' } })).toEqual(oldJoins);
    expect(await f.db.qcMeasurement.findMany()).toEqual(oldMeasurements);
    expect(await f.db.qcEvaluation.findFirst()).toEqual(oldEvaluation);
    const historical = batchApiView(await f.db.batch.findUnique({ where: { id: run.id }, include: QC_RUN_INCLUDE }));
    expect(historical.workItemIds).toEqual(run.workItemIds);
    expect(historical.workItems.map(row => row.id)).toEqual(run.workItems.map(row => row.id));
    expect(historical.workItems.every(row => row.currentBatchId === repeated.id)).toBe(true);
    expect(historical.analytes[0].result).toBe('FAIL');
    const passing = await writeNativeMeasurements(f.db, started.id, f.actor, { measurements: readings(started) });
    expect(passing.analytes[0].result).toBe('PASS');
    expect(await f.db.qcMeasurement.findMany({ where: { batchId: run.id } })).toEqual(oldMeasurements);
    expect(await f.db.qcEvaluation.findMany({ where: { batchId: run.id } })).toEqual([oldEvaluation]);
});

test.each([false, true])('failed membership cannot move without repeat/reject disposition (warning=%s)', async warning => {
    const f = await fixture(), lot = await referenceLot(f);
    const run = await startNativeRun(f.db, (await buildNativeRun(f.db, f.actor, { ...f.input,
        analyses: [{ analysisCode: f.analysisCode, references: [{ positionKind: 'LRM', referenceMaterialLotId: lot.id }] }] })).id, f.actor);
    await writeNativeMeasurements(f.db, run.id, f.actor, { measurements: readings(run, { blank: 10 }) });
    if (warning) await dispositionBatch(run.id, 'ACCEPT_WITH_DEVIATION', 'Retain the reviewed warning', f.actor, f.db);
    const target = await createProfileRun(f.db, f.actor, { analysis: f.analysisCode, profile: 'RACK_40' });
    const before = await evidence(f.db);
    await expect(buildNativeRun(f.db, f.actor, f.input)).rejects.toMatchObject({ code: 'QC_WORK_ITEM_ALREADY_BATCHED' });
    await expect(changeRunMembers(f.db, target.id, f.actor, { workItemIds: f.workItemIds })).rejects.toMatchObject({ code: 'QC_WORK_ITEM_ALREADY_BATCHED' });
    await expect(f.db.workItem.update({ where: { id: f.workItemIds[0] }, data: { batchId: target.id, rackPosition: 1 } })).rejects.toThrow();
    expect(await evidence(f.db)).toEqual(before);
    const connection = new Database(f.file);
    try { expect(() => connection.prepare('UPDATE WorkItem SET batchId=NULL,rackPosition=NULL WHERE id=?').run(f.workItemIds[0])).toThrow('BATCH_MEMBERSHIP_FROZEN'); }
    finally { connection.close(); }
    expect(await evidence(f.db)).toEqual(before);
});

test('actual manager disposition accepts a failed Native analyte with deviation, preserves warning flags and closes without changing failed readings', async () => {
    const f = await fixture(), lot = await referenceLot(f), run = await startNativeRun(f.db, (await buildNativeRun(f.db, f.actor, { ...f.input,
        analyses: [{ analysisCode: f.analysisCode, references: [{ positionKind: 'LRM', referenceMaterialLotId: lot.id }] }] })).id, f.actor);
    const item = await f.db.workItem.findUnique({ where: { id: f.workItemIds[0] } });
    const result = await createResultFixture(f.db, { data: { id: randomUUID(), sampleId: item.sampleId, param: f.analysisCode, batchId: run.id,
        value: '2.123456789', numericValue: 2.123456789, rawInput: '2.123456789', isValid: true, flags: '[]' } });
    await writeNativeMeasurements(f.db, run.id, f.actor, { measurements: readings(run, { blank: 10 }) });
    const oldMeasurements = await f.db.qcMeasurement.findMany(), oldEvaluation = await f.db.qcEvaluation.findFirst();
    await f.db.user.update({ where: { username: f.actor.username }, data: { role: 'LAB_MANAGER', labId: f.labId } });
    await withQcRunHttp(f.db, f.actor, async (app, token) => {
        const auth = { Authorization: `Bearer ${token}` };
        const accepted = await request(app).post(`/api/qc/batches/${run.id}/disposition`).set(auth)
            .send({ decision: 'PROCEED_WITH_WARNING', reason: 'Manager accepts the documented deviation' });
        expect(accepted.status).toBe(200); expect(accepted.body.disposition.canonicalDecision).toBe('ACCEPT_WITH_DEVIATION');
        expect((await f.db.batchAnalyte.findFirst()).status).toBe('ACCEPTED_WITH_DEVIATION');
        const flagged = await f.db.result.findUnique({ where: { id: result.id } });
        expect(flagged.isValid).toBe(true); expect(JSON.parse(flagged.flags)).toContain('QC_WARNING_OVERRIDDEN'); expect(flagged.value).toBe(result.value);
        const close = await request(app).put(`/api/qc/batches/${run.id}`).set(auth).send({ status: 'CLOSED' });
        expect(close.status).toBe(200); expect(close.body.status).toBe('CLOSED');
        expect((await f.db.batchAnalyte.findFirst()).status).toBe('CLOSED');
        expect(await f.db.result.findUnique({ where: { id: result.id } })).toEqual(flagged);
        const detail = await request(app).get(`/api/qc/batches/${run.id}`).set(auth);
        expect(detail.body.data).toMatchObject({ result: 'FAIL', disposition: { decision: 'PROCEED_WITH_WARNING' } });
        expect(detail.body.data.qcResults.blanks[0].value).toBe(10);
    });
    expect(await f.db.qcMeasurement.findMany()).toEqual(oldMeasurements); expect(await f.db.qcEvaluation.findFirst()).toEqual(oldEvaluation);
    const raw = await f.db.batch.findUnique({ where: { id: run.id } });
    expect([raw.qcResults, raw.disposition, raw.history, raw.workItemIds]).toEqual([null, null, null, null]);
});

test('actual profile membership converts recorded methods to Native without an asset and remains frozen after manager reopen', async () => {
    const f = await fixture(2), lot = await referenceLot(f);
    await f.db.user.update({ where: { username: f.actor.username }, data: { labId: f.labId } });
    await withQcRunHttp(f.db, f.actor, async (app, token) => {
        const auth = { Authorization: `Bearer ${token}` };
        const profile = await request(app).post('/api/qc/batches').set(auth).send({ analysis: f.analysisCode, instrument: 'Manual bench text', profile: 'RACK_40' });
        expect(profile.status).toBe(201); const id = profile.body.id;
        const added = await request(app).post(`/api/qc/batches/${id}/items`).set(auth).send({ workItemIds: f.workItemIds,
            analyses: [{ analysisCode: f.analysisCode, references: [{ positionKind: 'LRM', referenceMaterialLotId: lot.id }] }] });
        expect(added.status).toBe(200); expect(added.body.batch).toMatchObject({ instrumentId: null, instrument: 'Manual bench text' });
        expect(added.body.batch.analytes[0].provenance).toBe('NATIVE'); expect(added.body.batch.positions.filter(row => row.kind === 'SAMPLE')).toHaveLength(2);
        const removed = await request(app).delete(`/api/qc/batches/${id}/items`).set(auth).send({ workItemIds: [f.workItemIds[1]] });
        expect(removed.status).toBe(200); expect(removed.body.remaining).toBe(1);
        expect(await f.db.workItem.findUnique({ where: { id: f.workItemIds[1] } })).toMatchObject({ batchId: null, rackPosition: null });
        const started = await request(app).post(`/api/qc/batches/${id}/start`).set(auth).send({});
        expect(started.status).toBe(200); expect(started.body.batch.instrumentId).toBeNull();
        const pass = await request(app).post(`/api/qc/batches/${id}/evaluate`).set(auth).send({ measurements: readings(started.body.batch) });
        expect(pass.status).toBe(200); expect(pass.body.status).toBe('QC_PASS');
        expect((await request(app).put(`/api/qc/batches/${id}`).set(auth).send({ status: 'OPEN', reason: 'Reviewed manager reopen' })).status).toBe(200);
        const frozen = await evidence(f.db);
        for (const remove of [false, true]) {
            const response = remove ? await request(app).delete(`/api/qc/batches/${id}/items`).set(auth).send({ workItemIds: [f.workItemIds[0]] })
                : await request(app).post(`/api/qc/batches/${id}/items`).set(auth).send({ workItemIds: [f.workItemIds[1]] });
            expect(response.status).toBe(409); expect(response.body.code).toBe('BATCH_MEMBERSHIP_FROZEN'); expect(await evidence(f.db)).toEqual(frozen);
        }
    });
});

test('actual Native builder refuses 23 samples at the default limit and builds the specified 23-sample sequence through a method rule', async () => {
    const f = await fixture(23);
    await f.db.user.update({ where: { username: f.actor.username }, data: { labId: f.labId } });
    await withQcRunHttp(f.db, f.actor, async (app, token) => {
        const auth = { Authorization: `Bearer ${token}` }, before = await evidence(f.db);
        const tooLarge = await request(app).post('/api/qc/batches').set(auth).send(f.input);
        expect(tooLarge.status).toBe(422); expect(tooLarge.body).toMatchObject({ code: 'QC_BATCH_TOO_LARGE', details: { maxBatchSize: 20, requested: 23 } });
        expect(await evidence(f.db)).toEqual(before);
        await rules.change(f.actor, { labId: f.labId, analysisCode: f.analysisCode, methodologyId: f.method.id,
            criteria: { maxBatchSize: 23 }, expectedVersion: 1, reason: 'Approved 23-sample method capacity' }, { db: f.db });
        const created = await request(app).post('/api/qc/batches').set(auth).send(f.input);
        expect(created.status).toBe(201); const positions = created.body.positions;
        for (const [kind, count] of [['SAMPLE', 23], ['BLANK', 1], ['LRM', 1], ['DUPLICATE', 3]]) expect(positions.filter(row => row.kind === kind)).toHaveLength(count);
        expect(positions.map(row => row.position)).toEqual(Array.from({ length: positions.length }, (_, index) => index + 1));
        expect(positions.filter(row => row.kind === 'DUPLICATE').every(row => positions.some(parent => parent.id === row.duplicateOfPositionId && parent.kind === 'SAMPLE'))).toBe(true);
    });
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
    const corrected = await writeNativeMeasurements(f.db, run.id, f.actor, { reason: 'Advisory evidence can be corrected without a reopen',
        corrections: [{ positionId: run.positions.find(row => row.kind === 'BLANK').id, value: 0.0223456789 }] }, { correction: true });
    expect(corrected.analytes[0].result).toBe('PASS'); expect(corrected.evaluations).toHaveLength(3);
    expect(corrected.events.some(row => row.type === 'REOPENED')).toBe(false);
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
    await reopenNativeRun(f.db, run.id, f.actor, 'Reopen both accepted analytes for a shared lot correction');
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
    await reopenNativeRun(f.db, run.id, f.actor, 'Reopen the accepted analytes before a blank correction');
    const failed = await writeNativeMeasurements(f.db, run.id, f.actor, { analysisCode: f.analysisCode, reason: 'Correct one analyte blank only',
        corrections: [{ positionId: run.positions.find(row => row.kind === 'BLANK').id, value: 0.223456789 }] }, { correction: true });
    expect(failed.analytes.find(row => row.analysisCode === f.analysisCode).status).toBe('QC_FAIL');
    // Reopening withdraws current acceptance; the unaffected prior PASS is still
    // immutable historical evidence, rather than a current accepted verdict.
    expect(failed.evaluations.filter(row => row.analysisCode === b.analysisCode).at(-1).verdict).toBe('PASS');
    expect(failed.analytes.find(row => row.analysisCode === b.analysisCode).result).toBeNull();
    expect(failed.analytes.find(row => row.analysisCode === b.analysisCode).status).toBe('QC_PENDING');
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
    await reopenNativeRun(f.db, run.id, f.actor, 'Reopen both accepted analytes before the rollback probe');
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
    await reopenNativeRun(f.db, run.id, f.actor, 'Reopen both accepted analytes before the optional CRM lot correction');
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
    await reopenNativeRun(f.db, due.id, f.actor, 'Reopen accepted analytes for the required-service refusal probe');
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

test('positive-minimum shared LRM extras use frozen required ids; only the extra may drop optional analyte service', async () => {
    const f = await fixture(), b = await secondAnalyte(f), lot = await referenceLot(f);
    await rules.change(f.actor, { labId: f.labId, analysisCode: b.analysisCode, methodologyId: b.method.id,
        criteria: { lrmPerBatch: 2 }, expectedVersion: 1, reason: 'Second analyte needs two LRM positions' }, { db: f.db });
    await f.db.referenceValue.create({ data: { id: randomUUID(), referenceMaterialId: lot.id, analysisCode: b.analysisCode,
        assignedValue: 12.987654321, unit: 'fixture-unit', valueType: 'LAB_ASSIGNED', createdBy: f.actor.username } });
    const onlyB = await f.db.referenceMaterial.create({ data: { id: randomUUID(), labId: f.labId, code: randomUUID(), name: 'Second analyte only lot',
        kind: 'LRM', matrix: 'SOIL', lotNumber: 'fixture', status: 'ACTIVE', createdBy: f.actor.username } });
    await f.db.referenceValue.create({ data: { id: randomUUID(), referenceMaterialId: onlyB.id, analysisCode: b.analysisCode,
        assignedValue: 12.987654321, unit: 'fixture-unit', valueType: 'LAB_ASSIGNED', createdBy: f.actor.username } });
    const run = await startNativeRun(f.db, (await buildNativeRun(f.db, f.actor, { ...f.input, workItemIds: [...f.workItemIds, b.item.id], analyses: [
        { analysisCode: f.analysisCode, references: [{ positionKind: 'LRM', referenceMaterialLotId: lot.id }] }, { analysisCode: b.analysisCode }] })).id, f.actor);
    const positions = run.positions.filter(row => row.kind === 'LRM'), aRequired = JSON.parse(run.analytes.find(row => row.analysisCode === f.analysisCode).criteriaSnapshot).requiredPositions;
    const bRequired = JSON.parse(run.analytes.find(row => row.analysisCode === b.analysisCode).criteriaSnapshot).requiredPositions;
    expect(aRequired.LRM).toEqual([positions[0].id]); expect(bRequired.LRM).toEqual(positions.map(row => row.id));
    const first = await writeNativeMeasurements(f.db, run.id, f.actor, { measurements: readings(run).filter(row => row.positionId !== positions[1].id) });
    expect(first.analytes.find(row => row.analysisCode === f.analysisCode).result).toBe('PASS');
    await writeNativeMeasurements(f.db, run.id, f.actor, { analysisCode: b.analysisCode, measurements: readings(run, { control: 12.987654321 }) });
    await reopenNativeRun(f.db, run.id, f.actor, 'Reopen accepted QC for the optional second LRM placement');
    const corrected = await writeNativeMeasurements(f.db, run.id, f.actor, { reason: 'Extra second LRM no longer serves the first analyte',
        references: [{ positionId: positions[1].id, referenceMaterialId: onlyB.id }] }, { correction: true });
    expect(corrected.analytes.find(row => row.analysisCode === f.analysisCode).result).toBe('PASS');
    expect((await f.db.batchPositionReference.findMany({ where: { positionId: positions[1].id, analysisCode: f.analysisCode } })).find(row => !row.supersededById))
        .toMatchObject({ serviceStatus: 'NOT_SERVED', referenceSnapshot: null });
    await reopenNativeRun(f.db, run.id, f.actor, 'Reopen before checking mandatory first-position service');
    const before = await evidence(f.db);
    await expect(writeNativeMeasurements(f.db, run.id, f.actor, { reason: 'Required first LRM cannot drop service',
        references: [{ positionId: positions[0].id, referenceMaterialId: onlyB.id }] }, { correction: true }))
        .rejects.toMatchObject({ code: 'REFERENCE_VALUE_NOT_FOUND', details: { analysisCode: f.analysisCode } });
    expect(await evidence(f.db)).toEqual(before);
});

test('mixed calibration frequencies freeze each analyte opening, closing and first boundary pair ids independently', async () => {
    const f = await fixture(11), b = await secondAnalyte(f), ids = [b.item.id];
    for (const id of f.workItemIds.slice(1)) {
        const member = await f.db.workItem.findUnique({ where: { id } });
        ids.push((await createWorkItemFixture(f.db, { data: { id: randomUUID(), sampleId: member.sampleId, labId: f.labId,
            analysis: b.analysisCode, methodologyId: b.method.id, status: 'IN_PROGRESS' } })).id);
    }
    await policies.change(f.actor, f.labId, { reason: 'Enable shared calibration fixture positions', changes: [{ key: 'qc.calibrationVerification', value: true }] }, { db: f.db });
    await rules.change(f.actor, { labId: f.labId, analysisCode: b.analysisCode, methodologyId: b.method.id,
        criteria: { ccvEvery: 4 }, expectedVersion: 1, reason: 'Second analyte has a different calibration interval' }, { db: f.db });
    const run = await startNativeRun(f.db, (await buildNativeRun(f.db, f.actor, { ...f.input, workItemIds: [...f.workItemIds, ...ids] })).id, f.actor);
    const ownSamples = run.positions.filter(row => row.kind === 'SAMPLE'), pairAfter = sampleIndex => run.positions.find(row => row.kind === 'CCV' && row.position > ownSamples[sampleIndex].position);
    const a = JSON.parse(run.analytes.find(row => row.analysisCode === f.analysisCode).criteriaSnapshot).requiredPositions;
    const requiredB = JSON.parse(run.analytes.find(row => row.analysisCode === b.analysisCode).criteriaSnapshot).requiredPositions;
    expect(a.CCV).toEqual([pairAfter(9).id, run.positions.at(-2).id]);
    expect(requiredB.CCV).toEqual([pairAfter(3).id, pairAfter(7).id, run.positions.at(-2).id]);
    for (const requirements of [a, requiredB]) {
        expect(requirements.ICV).toEqual([run.positions[0].id]);
        expect(requirements.CCB).toEqual([run.positions[1].id, ...requirements.CCV.map(id => run.positions[run.positions.findIndex(row => row.id === id) + 1].id)]);
    }
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
    const f = await fixture(), lot = await referenceLot(f), run = await buildNativeRun(f.db, f.actor, { ...f.input, analyses: [
        { analysisCode: f.analysisCode, references: [{ positionKind: 'LRM', referenceMaterialLotId: lot.id }] }] }), initial = await startNativeRun(f.db, run.id, f.actor);
    await writeNativeMeasurements(f.db, run.id, f.actor, { measurements: readings(initial) });
    await reopenNativeRun(f.db, run.id, f.actor, 'Native resume fixture');
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
