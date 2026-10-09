const fs = require('node:fs');
const path = require('node:path');
const { randomUUID, createHash } = require('node:crypto');
const Database = require('better-sqlite3');
const { PrismaClient } = require('../../prisma_client');
const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');
const { beforeGuards } = require('../helpers/legacyWorkflowDatabase');
const { createSampleFixture, createWorkItemFixture } = require('../helpers/workflowFixtures');
const { withQcRunHttp } = require('../helpers/qcRunHttpHarness');
const request = require('supertest');
const rules = require('../../services/qcRuleService');
const policies = require('../../services/policyService');
const { buildNativeRun, startNativeRun } = require('../../services/qcNativeRunService');
const { writeNativeMeasurements } = require('../../services/qcNativeMeasurementService');
const { previewQcRun } = require('../../services/qcRunPreviewService');
const { apiRunView } = require('../../services/qcRunApiViewService');
const owned = [];

async function fixture(criteria = {}, { mode = 'ADVISORY', start = true } = {}) {
    const labId = randomUUID(), analysisCode = `PREVIEW-${randomUUID()}`, username = 'system:fixture';
    const historical = beforeGuards({ actor: username, schemaVariant: 'PRE_1_3_SAMPLE_CODES', relatedRows: {
        Lab: [{ id: labId, code: labId, name: 'Preview fixture', country: 'TEST', updatedAt: Date.now() }],
        User: [{ id: username, username, email: 'preview@example.test', password: 'fixture', role: 'SUPER_ADMIN', updatedAt: Date.now() }]
    } });
    const { file } = historical, resource = { file, db: null }; owned.push(resource);
    historical.applyPendingMigration({ migration: 'SAMPLE_CODES' });
    const connection = new Database(file, { fileMustExist: true });
    connection.exec('CREATE TABLE IF NOT EXISTS "_schema_migrations" ("id" TEXT PRIMARY KEY NOT NULL,"appliedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,"details" TEXT)');
    connection.close();
    for (const [script, installer] of [['result_attempt_links', 'installResultAttemptLinks'], ['sample_holds', 'installSampleHolds'],
        ['reference_materials', 'installReferenceMaterials'], ['qc_rules', 'installQcRules'], ['qc_runs', 'installQcRuns'], ['qc_gate_scope', 'installQcGateScope'],
        ['proficiency_evidence', 'installProficiencyEvidence'], ['result_equipment_evidence', 'installResultEquipmentEvidence'], ['batch_reagent_lots', 'installBatchReagentLots']]) {
        require(`../../scripts/install_${script}`)[installer]({ dbPath: file, apply: true });
    }
    const db = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: `file:${file}` }) }); resource.db = db;
    const actor = { username, role: 'SUPER_ADMIN', labId };
    await db.unit.create({ data: { code: 'preview-unit', display: 'Preview unit', quantityKind: 'MASS_FRACTION', factorToBase: 1 } });
    await db.analysis.create({ data: { code: analysisCode, name: 'Preview analysis', unitCode: 'preview-unit' } });
    const method = await db.methodology.create({ data: { analysisCode, name: 'Frozen preview method', loq: 0.123456789 } });
    const instrument = await db.equipmentAsset.create({ data: { id: randomUUID(), labId, name: 'Preview instrument', assetType: 'OTHER', status: 'IN_SERVICE', criticality: 'NON_CRITICAL' } });
    await policies.change(actor, labId, { reason: 'Preview fixture mode', changes: [{ key: 'qc.mode', value: mode }] }, { db });
    await rules.change(actor, { labId, analysisCode, methodologyId: method.id, expectedVersion: 0, reason: 'Reviewed preview criteria',
        criteria: { blankPerBatch: 1, lrmPerBatch: 0, duplicateEvery: 0, crmEveryNBatches: 0, blankAbsLimit: 0.37, ...criteria } }, { db });
    const sampleId = randomUUID();
    await createSampleFixture(db, { data: { id: sampleId, originalId: 'PREVIEW-SAMPLE', assignedLab: labId, status: 'PROCESSING', dryingStatus: 'DONE', preparationStatus: 'DONE' } });
    const work = await createWorkItemFixture(db, { data: { id: randomUUID(), sampleId, labId, analysis: analysisCode, methodologyId: method.id, status: 'IN_PROGRESS' } });
    let run = await buildNativeRun(db, actor, { instrumentId: instrument.id, workItemIds: [work.id], seed: 'preview-contract' });
    if (start) run = await startNativeRun(db, run.id, actor);
    return { db, file, actor, labId, analysisCode, method, run };
}

// Every table's original fields and rows, plus complete sqlite_master, are
// compared. A preview cannot conceal writes to a table outside its own models.
function snapshot(file) {
    const db = new Database(file, { readonly: true, fileMustExist: true });
    try {
        const schema = db.prepare('SELECT type,name,tbl_name,sql FROM sqlite_master ORDER BY type,name').all();
        const tables = schema.filter(row => row.type === 'table').map(({ name }) => {
            const rows = db.prepare(`SELECT * FROM "${name.replaceAll('"', '""')}"`).all().map(row => JSON.stringify(row)).sort();
            return { name, count: rows.length, digest: createHash('sha256').update(JSON.stringify(rows)).digest('hex') };
        });
        return { schema, tables };
    } finally { db.close(); }
}
const entries = (f, rawInput = '0.1') => [{ analysisCode: f.analysisCode, positionId: f.run.positions.find(row => row.kind === 'BLANK').id, rawInput }];

afterAll(async () => {
    for (const resource of owned) {
        if (resource.db) await resource.db.$disconnect();
        if (path.dirname(resource.file) !== path.resolve(__dirname, '../.tmp') || !path.basename(resource.file).startsWith('audit_legacy_')) throw Error('Refusing non-owned fixture cleanup');
        for (const suffix of ['', '-wal', '-shm']) if (fs.existsSync(resource.file + suffix)) fs.unlinkSync(resource.file + suffix);
    }
});

test.each([
    ['PASS', '0.1', {}], ['FAIL', '0.4', {}], ['INCOMPLETE', null, {}],
    ['WARN', '0.4', { failAction: { BLANK: 'WARN', DUPLICATE: 'FAIL_BATCH', LRM: 'FAIL_BATCH', CRM: 'FAIL_BATCH' } }]
])('native %s preview writes nothing and equals the persisted verdict and check details', async (verdict, rawInput, criteria) => {
    const f = await fixture(criteria), input = rawInput === null ? [] : entries(f, rawInput), before = snapshot(f.file);
    const preview = await previewQcRun(f.db, f.run.id, f.actor, input);
    expect(snapshot(f.file)).toEqual(before);
    expect(preview).toMatchObject({ batchId: f.run.id, preview: true, analytes: [{ analysisCode: f.analysisCode, verdict, preview: true }] });
    expect(preview.analytes[0].positions.find(row => row.kind === 'BLANK')).toMatchObject({ expected: null, limits: { maxAllowed: 0.37 } });
    const actual = await writeNativeMeasurements(f.db, f.run.id, f.actor, { analysisCode: f.analysisCode,
        measurements: input.map(({ positionId, rawInput }) => ({ positionId, rawInput })) }, { explicit: true });
    const stored = JSON.parse(actual.evaluations.at(-1).details);
    expect(stored.verdict).toBe(verdict);
    expect(stored.evaluation).toEqual(preview.analytes[0].evaluation);
    expect(actual.analytes[0].result).toBe(verdict);
});

test('a set of preview calls never writes rows/schema and keeps the started rule and mode after live changes', async () => {
    const f = await fixture();
    await policies.change(f.actor, f.labId, { reason: 'Live policy must not change frozen preview', changes: [{ key: 'qc.mode', value: 'OFF' }] }, { db: f.db });
    await rules.change(f.actor, { labId: f.labId, analysisCode: f.analysisCode, methodologyId: f.method.id, expectedVersion: 1,
        criteria: { blankAbsLimit: 0.001 }, reason: 'New rules apply to future runs' }, { db: f.db });
    const before = snapshot(f.file);
    for (const [input, verdict] of [[[], 'INCOMPLETE'], [entries(f, '0.01'), 'PASS'], [entries(f, '0.4'), 'FAIL']]) {
        const preview = await previewQcRun(f.db, f.run.id, f.actor, input);
        expect(preview.analytes[0]).toMatchObject({ verdict, qcRule: { version: 1 }, policyVersion: f.run.analytes[0].policyVersion });
        expect(preview.analytes[0].positions.find(row => row.kind === 'BLANK').limits.maxAllowed).toBe(0.37);
        expect(snapshot(f.file)).toEqual(before);
    }
});

test('initial run view supplies the frozen actual blank bound without a candidate or stored verdict', async () => {
    const f = await fixture({ blankLimitMode: 'LT_HALF_LOQ' }), before = snapshot(f.file);
    const view = await apiRunView(f.db, f.run, { detail: true });
    const entry = view.analytes[0].entryEvidence.find(row => row.positionId === f.run.positions.find(row => row.kind === 'BLANK').id);
    expect(entry).toMatchObject({ expected: null, limits: { maxAllowed: 0.123456789 / 2, mode: 'LT_HALF_LOQ', loq: 0.123456789 }, status: null });
    expect(entry).not.toHaveProperty('verdict');
    expect(snapshot(f.file)).toEqual(before);
    const closed = { ...f.run, status: 'CLOSED', analytes: f.run.analytes.map(row => ({ ...row, status: 'CLOSED' })) };
    expect((await apiRunView(f.db, closed, { detail: true })).analytes[0].entryEvidence).toEqual([]);
    expect(snapshot(f.file)).toEqual(before);
});

test.each(['<LOQ', '<0.05'])('censored parent/duplicate %s shares real parsing, LOQ and verdict without writes', async rawInput => {
    const f = await fixture({ duplicateEvery: 1 });
    const input = f.run.positions.map(row => ({ analysisCode: f.analysisCode, positionId: row.id, rawInput: row.kind === 'BLANK' ? '0.01' : rawInput }));
    const before = snapshot(f.file), preview = await previewQcRun(f.db, f.run.id, f.actor, input);
    expect(snapshot(f.file)).toEqual(before);
    const duplicate = preview.analytes[0].positions.find(row => row.kind === 'DUPLICATE');
    expect(duplicate).toMatchObject({ rawInput, measured: null, limits: { loq: 0.123456789 },
        parsedObservation: { numericValue: null, qualifier: '<', censoringLimit: rawInput === '<LOQ' ? 0.123456789 : 0.05 } });
    const actual = await writeNativeMeasurements(f.db, f.run.id, f.actor, { measurements: input.map(({ positionId, rawInput }) => ({ positionId, rawInput })) }, { explicit: true });
    expect(JSON.parse(actual.evaluations.at(-1).details).evaluation).toEqual(preview.analytes[0].evaluation);
    expect(actual.measurements.filter(row => row.censoring)).toHaveLength(2);
});

test('an existing observation can be substituted only in preview; ordinary persistence still requires a reasoned correction', async () => {
    const f = await fixture();
    await writeNativeMeasurements(f.db, f.run.id, f.actor, { measurements: entries(f).map(({ positionId, rawInput }) => ({ positionId, rawInput })) });
    const before = snapshot(f.file);
    expect((await previewQcRun(f.db, f.run.id, f.actor, entries(f, '0.4'))).analytes[0].verdict).toBe('FAIL');
    expect(snapshot(f.file)).toEqual(before);
    await expect(writeNativeMeasurements(f.db, f.run.id, f.actor, { measurements: entries(f, '0.4') }))
        .rejects.toMatchObject({ code: 'QC_CORRECTION_REASON_REQUIRED' });
    expect(snapshot(f.file)).toEqual(before);
});

test('preview rejects client rule/expected/limit overrides, duplicate positions and unknown analytes with zero writes', async () => {
    const f = await fixture(), before = snapshot(f.file);
    for (const [input, code] of [[[{ ...entries(f)[0], expected: 1 }], 'QC_PREVIEW_INPUT_INVALID'],
        [[{ ...entries(f)[0], limits: { maxAllowed: 99 } }], 'QC_PREVIEW_INPUT_INVALID'],
        [[{ ...entries(f)[0], criteriaSnapshot: {} }], 'QC_PREVIEW_INPUT_INVALID'],
        [[...entries(f), ...entries(f)], 'QC_VALUES_MISSING'],
        [[{ ...entries(f)[0], analysisCode: 'OTHER' }], 'QC_ANALYSIS_NOT_IN_RUN'],
        [entries(f, '<0.1'), 'QC_VALUES_MISSING']]) {
        await expect(previewQcRun(f.db, f.run.id, f.actor, input)).rejects.toMatchObject({ statusCode: 400, code });
        expect(snapshot(f.file)).toEqual(before);
    }
});

test('unstarted and compatibility runs return stable 409 instead of reevaluating historical evidence', async () => {
    const f = await fixture({}, { start: false }), before = snapshot(f.file);
    await expect(previewQcRun(f.db, f.run.id, f.actor, [])).rejects.toMatchObject({ statusCode: 409, code: 'QC_PREVIEW_UNAVAILABLE' });
    expect(snapshot(f.file)).toEqual(before);
    const historical = await require('../../services/qcCompatibilityRunService').createProfileRun(f.db, f.actor, { id: randomUUID(), labId: f.labId, analysis: f.analysisCode, profile: 'RACK_40' });
    const historicalBefore = snapshot(f.file);
    await expect(previewQcRun(f.db, historical.id, f.actor, [])).rejects.toMatchObject({ statusCode: 409, code: 'QC_PREVIEW_UNAVAILABLE' });
    expect(snapshot(f.file)).toEqual(historicalBefore);
});

test('preview HTTP route retains evaluate permission and canonical lab scope', async () => {
    const f = await fixture();
    await withQcRunHttp(f.db, f.actor, async (app, token) => {
        const before = snapshot(f.file);
        const response = await request(app).post(`/api/qc/batches/${f.run.id}/preview`).set('Authorization', `Bearer ${token}`).send(entries(f));
        expect(response.status).toBe(200); expect(response.body).toMatchObject({ preview: true, analytes: [{ verdict: 'PASS' }] });
        expect(snapshot(f.file)).toEqual(before);
        await f.db.user.update({ where: { username: f.actor.username }, data: { role: 'VIEWER' } });
        const viewerBefore = snapshot(f.file);
        expect((await request(app).post(`/api/qc/batches/${f.run.id}/preview`).set('Authorization', `Bearer ${token}`).send(entries(f))).status).toBe(403);
        expect(snapshot(f.file)).toEqual(viewerBefore);
        const otherLab = await f.db.lab.create({ data: { id: randomUUID(), code: 'OTHER-PREVIEW-LAB', name: 'Other preview lab', country: 'TEST' } });
        await f.db.user.update({ where: { username: f.actor.username }, data: { role: 'LAB_TECHNICIAN', labId: otherLab.code } });
        const otherBefore = snapshot(f.file);
        expect((await request(app).post(`/api/qc/batches/${f.run.id}/preview`).set('Authorization', `Bearer ${token}`).send(entries(f))).status).toBe(403);
        expect(snapshot(f.file)).toEqual(otherBefore);
    });
});
