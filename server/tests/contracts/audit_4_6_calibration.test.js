const fs = require('node:fs'), path = require('node:path');
const { randomUUID } = require('node:crypto');
const { PrismaClient } = require('../../prisma_client');
const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');
const { beforeGuards } = require('../helpers/legacyWorkflowDatabase');
const { assertOwnedTestDatabase } = require('../helpers/testOwnedDatabase');
const { createSampleFixture, createWorkItemFixture } = require('../helpers/workflowFixtures');
const { UNITS } = require('../../seeds/units');
const catalogue = require('../../seeds/data/catalogue.json');
const { referenceRows } = require('../../services/calculationReferenceLibrary');
const templates = require('../../services/calculationTemplateService');
const activations = require('../../services/calculationActivationService');
const curves = require('../../services/calibrationCurveService');
const native = require('../../services/qcNativeRunService');
const rules = require('../../services/qcRuleService');
const files = [];
let context;

async function fixture() {
    const directory = path.resolve(__dirname, '../.tmp'); fs.mkdirSync(directory, { recursive: true });
    const file = assertOwnedTestDatabase(path.join(directory, `audit_legacy_calibration_${randomUUID()}.db`), 'system:fixture'); files.push(file);
    beforeGuards({ actor: 'system:fixture', file, qcBootstrap: 'CREATE_PRISMA' });
    const db = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: `file:${file}` }) });
    for (const row of UNITS.filter(unit => unit.code !== 'pct_mass')) await db.unit.create({ data: row });
    const codes = new Set(referenceRows().map(row => row.analysisCode));
    for (const row of catalogue.analyses.filter(value => codes.has(value.code))) await db.analysis.create({ data: {
        code: row.code, name: row.name, unitCode: row.unitCode, units: row.units, isGlobal: true } });
    // Execute the actual prior installers in release order on the generated fresh schema.
    for (const [script, method] of [['install_workflow_state_guards', 'installWorkflowStateGuards'],
        ['install_result_attempt_links', 'installResultAttemptLinks'], ['install_sample_holds', 'installSampleHolds'],
        ['install_reference_materials', 'installReferenceMaterials'], ['install_qc_rules', 'installQcRules'],
        ['install_qc_runs', 'installQcRuns'], ['install_qc_gate_scope', 'installQcGateScope'],
        ['install_proficiency_evidence', 'installProficiencyEvidence'], ['install_result_equipment_evidence', 'installResultEquipmentEvidence'],
        ['install_work_attempt_contract', 'installWorkAttemptContract'], ['install_work_repeat_contract', 'installWorkRepeatContract'],
        ['install_reported_value_selections', 'installReportedValueSelections'], ['install_batch_reagent_lots', 'installBatchReagentLots'],
        ['install_calculation_templates', 'installCalculationTemplates']]) {
        const install = require(`../../scripts/${script}`)[method], options = { dbPath: file, apply: true };
        if (script === 'install_qc_runs') options.planSha256 = install({ dbPath: file }).backfillFingerprint;
        install(options);
    }
    const lab = await db.lab.create({ data: { id: randomUUID(), code: `CURVE_${randomUUID()}`, name: 'Owned calibration lab', country: 'ZZ' } });
    const otherLab = await db.lab.create({ data: { id: randomUUID(), code: `OTHER_${randomUUID()}`, name: 'Other owned lab', country: 'ZZ' } });
    const actor = async (role, assignedLab = lab) => db.user.create({ data: { id: randomUUID(), username: randomUUID(),
        email: `${randomUUID()}@example.invalid`, password: 'synthetic-unusable', role, labId: assignedLab.id } });
    const analyst = await actor('LAB_TECHNICIAN'), otherAnalyst = await actor('LAB_TECHNICIAN'), manager = await actor('LAB_MANAGER'), outsider = await actor('LAB_MANAGER', otherLab);
    const method = await db.methodology.create({ data: { id: randomUUID(), analysisCode: 'P_OLSEN', name: 'Owned Olsen method', version: 3, standard: 'Synthetic SOP' } });
    await rules.change(manager, { labId: lab.id, analysisCode: method.analysisCode, methodologyId: method.id, expectedVersion: 0,
        criteria: { blankPerBatch: 0, lrmPerBatch: 0, duplicateEvery: 0, crmEveryNBatches: 0, curveMinPoints: 3, curveMinR: 0.995 },
        reason: 'Synthetic lab-approved calibration criteria' }, { db });
    const source = referenceRows().find(row => row.templateKey === 'olsen-phosphorus');
    const template = await templates.clone(db, manager, source.id, { labId: lab.id, methodologyId: method.id, expectedVersion: source.version,
        outputDecimals: 2, reason: 'Verify this local colorimetric method', sopCitation: 'Synthetic SOP-CURVE §9, two decimals' });
    const activation = await activations.change(db, manager, template.id, { labId: lab.id, analysisCode: method.analysisCode, methodologyId: method.id,
        expectedVersion: template.version, expectedActivationId: null, action: 'ACTIVATE', verifiedAgainstSop: true, reason: 'Verified against local SOP' });
    const sample = await createSampleFixture(db, { data: { id: randomUUID(), originalId: randomUUID(), status: 'PROCESSING', assignedLab: lab.id,
        dryingStatus: 'DONE', preparationStatus: 'DONE', receptionDate: new Date() } });
    const item = await createWorkItemFixture(db, { data: { id: randomUUID(), sampleId: sample.id, labId: lab.id, analysis: method.analysisCode,
        methodologyId: method.id, status: 'IN_PROGRESS', history: '[]' } });
    const run = await native.buildNativeRun(db, analyst, { labId: lab.id, workItemIds: [item.id], analyses: [{ analysisCode: method.analysisCode, methodologyId: method.id }], seed: 'owned-calibration' });
    const input = { analysisCode: method.analysisCode, templateId: template.id, templateVersion: template.version, activationId: activation.id,
        expectedCurveId: null, points: [{ standardConcentration: 0, response: 1 }, { standardConcentration: 1, response: 3 }, { standardConcentration: 2, response: 5 }] };
    return { file, db, lab, analyst, otherAnalyst, manager, outsider, method, template, activation, run, input,
        start: () => native.startNativeRun(db, run.id, analyst),
        snapshot: async () => JSON.parse(JSON.stringify(await Promise.all([db.calibrationCurve.findMany({ orderBy: { id: 'asc' } }),
            db.calibrationPoint.findMany({ orderBy: [{ curveId: 'asc' }, { ordinal: 'asc' }] }), db.auditLog.findMany({ orderBy: { id: 'asc' } }),
            db.batchEvent.findMany({ orderBy: { id: 'asc' } }), db.result.findMany({ orderBy: { id: 'asc' } })]))) };
}
beforeEach(async () => { context = await fixture(); });
afterEach(async () => { await context?.db.$disconnect(); context = null; jest.restoreAllMocks(); });
afterAll(() => { for (const file of files) fs.rmSync(assertOwnedTestDatabase(file, 'system:fixture'), { force: true }); });

test('only a started native run supplies the real frozen method revision; refusal writes nothing', async () => {
    const f = context, before = await f.snapshot();
    await expect(curves.recordCurve(f.db, f.run.id, f.analyst, f.input)).rejects.toMatchObject({ statusCode: 409, code: 'CALIBRATION_CURVE_REQUIRED' });
    expect(await f.snapshot()).toEqual(before);
    await f.start();
    const saved = await curves.recordCurve(f.db, f.run.id, f.analyst, f.input);
    expect(saved).toMatchObject({ status: 'PASS', slope: 2, intercept: 1, r: 1, rSquared: 1, pointCount: 3, levelCount: 3,
        minPointsApplied: 3, minRApplied: 0.995, recordedBy: f.analyst.username, calibrationMax: 2 });
    expect(JSON.parse(saved.executedMethodRevision)).toEqual({ methodologyId: f.method.id, name: f.method.name, standard: f.method.standard, version: 3 });
    expect(JSON.parse(saved.thresholdSource)).toMatchObject({ qcRuleVersion: 1, curveMinPoints: { value: 3, source: 'QC_RULE' } });
    expect(saved.points.map(point => point.ordinal)).toEqual([1, 2, 3]);
    const active = await curves.activeTemplate(f.db, await curves.executionContext(f.db, f.run.id, f.analyst, 'P_OLSEN'));
    expect(await curves.requireLatestCurve(f.db, await curves.executionContext(f.db, f.run.id, f.analyst, 'P_OLSEN'), active)).toMatchObject({ id: saved.id });
});

test('every replicate participates in the unweighted fit; zero counts and repeated standards add no distinct levels', async () => {
    const f = context; await f.start();
    const points = [{ standardConcentration: 0, response: 0 }, { standardConcentration: 1, response: 1 }, { standardConcentration: 1, response: 3 }];
    const saved = await curves.recordCurve(f.db, f.run.id, f.analyst, { ...f.input, points });
    expect(saved).toMatchObject({ status: 'FAIL', failReason: 'TOO_FEW_LEVELS', slope: 2, intercept: 0, pointCount: 3, levelCount: 2, calibrationMax: 1 });
    expect(saved.points.map(({ standardConcentration, response }) => ({ standardConcentration, response }))).toEqual(points);
});

test('negative correlation fails and a degenerate fit retains four null coefficients', async () => {
    const f = context; await f.start();
    const first = await curves.recordCurve(f.db, f.run.id, f.analyst, { ...f.input, points: f.input.points.map(point => ({ ...point, response: -point.response })) });
    expect(first).toMatchObject({ status: 'FAIL', failReason: 'CORRELATION_BELOW_MINIMUM', r: -1, rSquared: 1, slope: -2 });
    const second = await curves.recordCurve(f.db, f.run.id, f.analyst, { ...f.input, expectedCurveId: first.id, reason: 'Record all repeated standards for investigation',
        points: [{ standardConcentration: 1, response: 2 }, { standardConcentration: 1, response: 3 }] });
    expect(second).toMatchObject({ status: 'FAIL', failReason: 'DEGENERATE_FIT', slope: null, intercept: null, r: null, rSquared: null, pointCount: 2, levelCount: 1 });
});

test('a new reasoned revision freezes new resolved limits; an old PASS cannot bypass the latest failed curve', async () => {
    const f = context; await f.start();
    const first = await curves.recordCurve(f.db, f.run.id, f.analyst, f.input);
    await rules.change(f.manager, { labId: f.lab.id, analysisCode: 'P_OLSEN', methodologyId: f.method.id, expectedVersion: 1,
        criteria: { curveMinPoints: 4 }, reason: 'New approved minimum applies to future calibration revisions' }, { db: f.db });
    const second = await curves.recordCurve(f.db, f.run.id, f.analyst, { ...f.input, expectedCurveId: first.id, reason: 'Recalibrate under the new rule' });
    expect(second).toMatchObject({ revision: 2, supersedesId: first.id, minPointsApplied: 4, status: 'FAIL', failReason: 'TOO_FEW_LEVELS' });
    expect(await f.db.calibrationCurve.findUnique({ where: { id: first.id } })).toMatchObject({ minPointsApplied: 3, status: 'PASS' });
    const execution = await curves.executionContext(f.db, f.run.id, f.analyst, 'P_OLSEN');
    await expect(curves.requireLatestCurve(f.db, execution, await curves.activeTemplate(f.db, execution)))
        .rejects.toMatchObject({ statusCode: 409, code: 'CALIBRATION_CURVE_FAILED' });
    expect(await f.db.result.count()).toBe(0);
});

test('assigned analyst, scoped manager reason, and optimistic curve head protect the immutable revision chain', async () => {
    const f = context; await f.start(); const before = await f.snapshot();
    await expect(curves.recordCurve(f.db, f.run.id, f.otherAnalyst, f.input)).rejects.toMatchObject({ statusCode: 403, code: 'CALIBRATION_ANALYST_REQUIRED' });
    await expect(curves.recordCurve(f.db, f.run.id, f.manager, f.input)).rejects.toMatchObject({ statusCode: 422, code: 'CALIBRATION_REASON_REQUIRED' });
    await expect(curves.recordCurve(f.db, f.run.id, f.outsider, { ...f.input, reason: 'Outside lab' })).rejects.toMatchObject({ statusCode: 403 });
    expect(await f.snapshot()).toEqual(before);
    const first = await curves.recordCurve(f.db, f.run.id, f.manager, { ...f.input, reason: 'Scoped manager records calibration for this analyst' });
    const recorded = await f.snapshot();
    await expect(curves.recordCurve(f.db, f.run.id, f.analyst, { ...f.input, reason: 'Stale head' }))
        .rejects.toMatchObject({ statusCode: 409, code: 'CALIBRATION_CURVE_VERSION_CHANGED' });
    await expect(curves.recordCurve(f.db, f.run.id, f.analyst, { ...f.input, expectedCurveId: first.id }))
        .rejects.toMatchObject({ statusCode: 422, code: 'CALIBRATION_REASON_REQUIRED' });
    expect(await f.snapshot()).toEqual(recorded);
});

test('missing points, qualifiers, negative concentrations and a stale activation refuse with zero writes', async () => {
    const f = context; await f.start(); const before = await f.snapshot();
    for (const points of [[], [{ standardConcentration: '<1', response: 2 }], [{ standardConcentration: -1, response: 2 }], [{ standardConcentration: 1, response: 'Infinity' }]]) {
        await expect(curves.recordCurve(f.db, f.run.id, f.analyst, { ...f.input, points })).rejects.toMatchObject({ statusCode: 422, code: 'CALIBRATION_POINT_INVALID' });
    }
    await expect(curves.recordCurve(f.db, f.run.id, f.analyst, { ...f.input, activationId: 'stale' })).rejects.toMatchObject({ statusCode: 409, code: 'CALC_TEMPLATE_VERSION_CHANGED' });
    expect(await f.snapshot()).toEqual(before);
});

test('a late event failure rolls back curve, all points and calibration audit together', async () => {
    const f = context; await f.start(); const before = await f.snapshot(), transaction = f.db.$transaction.bind(f.db);
    const spy = jest.spyOn(f.db, '$transaction').mockImplementation(execute => transaction(async tx => {
        const create = tx.batchEvent.create.bind(tx.batchEvent);
        tx.batchEvent.create = args => args.data.type === 'CALIBRATION_RECORDED' ? Promise.reject(new Error('Injected late calibration event failure')) : create(args);
        return execute(tx);
    }));
    await expect(curves.recordCurve(f.db, f.run.id, f.analyst, f.input)).rejects.toThrow('Injected late calibration event failure'); spy.mockRestore();
    expect(await f.snapshot()).toEqual(before);
});

test('incomplete retained point sets cannot bind, and a nondeclared AAS/ICP template needs no curve', async () => {
    for (const row of [null, { pointCount: 0, points: [] }, { pointCount: 2, levelCount: 2, points: [{ ordinal: 1, standardConcentration: 0 }] },
        { pointCount: 2, levelCount: 2, points: [{ ordinal: 1, standardConcentration: 0 }, { ordinal: 3, standardConcentration: 1 }] }]) {
        expect(() => curves.completeCurve(row)).toThrow(expect.objectContaining({ code: 'CALIBRATION_CURVE_INCOMPLETE' }));
    }
    expect(JSON.parse(referenceRows().find(row => row.templateKey === 'exchangeable-ca').curve || 'null')).toBeNull();
});
