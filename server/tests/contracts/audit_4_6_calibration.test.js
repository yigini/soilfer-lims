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
const request = require('supertest');
const { withQcRunHttp } = require('../helpers/qcRunHttpHarness');
const files = [];
const clients = [];
let context;

async function fixture({ additionalItem = false } = {}) {
    const directory = path.resolve(__dirname, '../.tmp'); fs.mkdirSync(directory, { recursive: true });
    const file = assertOwnedTestDatabase(path.join(directory, `audit_legacy_calibration_${randomUUID()}.db`), 'system:fixture'); files.push(file);
    beforeGuards({ actor: 'system:fixture', file, qcBootstrap: 'CREATE_PRISMA' });
    const db = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: `file:${file}` }) });
    clients.push(db);
    for (const row of UNITS) await db.unit.create({ data: row });
    const codes = new Set(referenceRows().map(row => row.analysisCode));
    for (const row of catalogue.analyses.filter(value => codes.has(value.code))) await db.analysis.create({ data: {
        code: row.code, name: row.name, unitCode: row.unitCode, units: row.units, isGlobal: true } });
    // Execute the actual prior installers in release order on the generated fresh schema.
    for (const [script, method] of [['install_workflow_state_guards', 'installWorkflowStateGuards'],
        ['install_result_attempt_links', 'installResultAttemptLinks'], ['install_sample_holds', 'installSampleHolds'],
        ['install_reference_materials', 'installReferenceMaterials'], ['install_qc_rules', 'installQcRules'],
        ['install_qc_runs', 'installQcRuns'], ['install_qc_gate_scope', 'installQcGateScope'],
        ['bootstrap_pt_nonconformity', 'bootstrapPtNonconformity'], ['install_result_equipment_evidence', 'installResultEquipmentEvidence'],
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
        methodologyId: method.id, assignedTo: analyst.username, status: 'IN_PROGRESS', history: '[]' } });
    let laterItem = null;
    if (additionalItem) {
        const laterSample = await createSampleFixture(db, { data: { id: randomUUID(), originalId: randomUUID(), status: 'PROCESSING', assignedLab: lab.id,
            dryingStatus: 'DONE', preparationStatus: 'DONE', receptionDate: new Date() } });
        laterItem = await createWorkItemFixture(db, { data: { id: randomUUID(), sampleId: laterSample.id, labId: lab.id, analysis: method.analysisCode,
            methodologyId: method.id, assignedTo: analyst.username, status: 'IN_PROGRESS', history: '[]' } });
    }
    const run = await native.buildNativeRun(db, analyst, { labId: lab.id, workItemIds: [item.id, ...(laterItem ? [laterItem.id] : [])], analyses: [{ analysisCode: method.analysisCode, methodologyId: method.id }], seed: 'owned-calibration' });
    const input = { analysisCode: method.analysisCode, templateId: template.id, templateVersion: template.version, activationId: activation.id,
        expectedCurveId: null, points: [{ standardConcentration: 0, response: 1 }, { standardConcentration: 1, response: 3 }, { standardConcentration: 2, response: 5 }] };
    return { file, db, lab, analyst, otherAnalyst, manager, outsider, method, template, activation, run, input, sample, item, laterItem,
        start: () => native.startNativeRun(db, run.id, analyst),
        snapshot: async () => JSON.parse(JSON.stringify(await Promise.all([db.calibrationCurve.findMany({ orderBy: { id: 'asc' } }),
            db.calibrationPoint.findMany({ orderBy: [{ curveId: 'asc' }, { ordinal: 'asc' }] }), db.auditLog.findMany({ orderBy: { id: 'asc' } }),
            db.batchEvent.findMany({ orderBy: { id: 'asc' } }), db.result.findMany({ orderBy: { id: 'asc' } })]))) };
}
beforeEach(async () => { context = await fixture(); });
afterEach(async () => { for (const db of clients.splice(0)) await db.$disconnect(); context = null; jest.restoreAllMocks(); });
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

test('the actual Result writer recomputes every reading, refuses tampering and atomically freezes its curve and raw inputs', async () => {
    const f = context; await f.start();
    const curve = await curves.recordCurve(f.db, f.run.id, f.analyst, f.input);
    const writer = require('../../services/resultWriteService'), calculations = require('../../services/resultCalculationService');
    const inputs = { absorbance: '3.00', blankConcentration: '0', extractVolume: '20', dilutionFactor: '2', sampleMass: '1', moistureCorrectionFactor: '1' };
    const preview = await writer.previewResultCalculation(f.db,{sampleId:f.sample.id,workItemId:f.item.id,actor:f.analyst,inputs});
    expect(preview.calculation).toMatchObject({ output: 40, nativeValue: 40, conversionFactor: 1, outputUnit: 'mg/kg' });
    const measurement = { param: 'P_OLSEN', value: '40', calculation: { ...preview.active, curveId: curve.id, inputs } };
    const before = await f.snapshot();
    const record = value => f.db.$transaction(tx => writer.writeResult(tx,{sampleId:f.sample.id,workItemId:f.item.id,actor:f.analyst,measurement:value}));
    await expect(record({...measurement,value:'41'})).rejects.toMatchObject({ statusCode: 409, code: 'CALCULATION_MISMATCH' });
    await expect(record({...measurement,calculation:{...measurement.calculation,templateVersion:99}}))
        .rejects.toMatchObject({ statusCode: 409, code: 'CALC_TEMPLATE_VERSION_CHANGED' });
    await expect(record({...measurement,calculation:{...measurement.calculation,inputs:{...inputs,sampleMass:''}}}))
        .rejects.toMatchObject({ statusCode: 422, code: 'CALC_INPUT_REQUIRED' });
    expect(await f.snapshot()).toEqual(before); expect(await f.db.resultCalculation.count()).toBe(0);
    const result = await record(measurement), frozen = await calculations.retained(f.db,result.id);
    expect(frozen).toMatchObject({ resultId:result.id,templateId:f.template.id,templateVersion:1,activationId:f.activation.id,
        output:40,nativeValue:40,conversionFactor:1,outputUnit:'mg/kg',curveId:curve.id,computedBy:f.analyst.username });
    expect(JSON.parse(frozen.inputs).absorbance).toBe('3.00');
    expect(JSON.parse(frozen.intermediate).numericInputs.absorbance).toBe(3);
    expect(frozen.curve.points).toHaveLength(3);
    expect(await f.db.auditLog.count({where:{entity:'RESULT_CALCULATION',entityId:frozen.id}})).toBe(1);
    const attempt = await f.db.workAttempt.findUnique({where:{id:result.attemptId}});
    expect(attempt.rawData).toBeNull(); expect(attempt.calcVersion).toBeNull();
    await activations.change(f.db,f.manager,f.template.id,{labId:f.lab.id,analysisCode:'P_OLSEN',methodologyId:f.method.id,
        expectedVersion:1,expectedActivationId:f.activation.id,action:'DEACTIVATE',verifiedAgainstSop:true,reason:'Future entries use the unactivated method path'});
    expect(await calculations.retained(f.db,result.id)).toEqual(frozen);
    expect(await f.db.result.findUnique({where:{id:result.id}})).toEqual(result);
});

test.each([[5.002,true],[4.998,false]])('response %s compares extract mg/L with the highest standard and retains an amber flag=%s after mg/kg conversion', async (response,aboveRange) => {
    const f = context; await f.start(); const curve = await curves.recordCurve(f.db,f.run.id,f.analyst,f.input);
    const writer = require('../../services/resultWriteService'), inputs = { absorbance:response,blankConcentration:0,extractVolume:20,dilutionFactor:2,sampleMass:1,moistureCorrectionFactor:1 };
    const preview = await writer.previewResultCalculation(f.db,{sampleId:f.sample.id,workItemId:f.item.id,actor:f.analyst,inputs});
    const [result] = await f.db.$transaction(tx => writer.writeResultsExecution(tx,{sampleId:f.sample.id,workItemId:f.item.id,actor:f.analyst,
        measurements:[{param:'P_OLSEN',value:preview.calculation.output,calculation:{...preview.active,curveId:curve.id,inputs}}]}));
    const frozen = await f.db.resultCalculation.findUnique({where:{resultId:result.id}}), intermediate = JSON.parse(frozen.intermediate);
    expect(result.isValid).toBe(true);
    expect(JSON.parse(result.flags).includes('ABOVE_RANGE')).toBe(aboveRange);
    expect(intermediate).toMatchObject({calibrationMax:2,calibrationUnit:'mg/L',curveId:curve.id,curveRevision:1,aboveRange});
    expect(intermediate.extractConcentration).toBeCloseTo((response-1)/2,12);
    expect(result.numericValue).toBe(preview.calculation.output);
    expect(result.numericValue).toBeGreaterThan(intermediate.calibrationMax);
});

test('a future failed curve blocks stored completion without changing an earlier Result or its frozen calculation', async () => {
    const f = context; await f.start(); const first = await curves.recordCurve(f.db,f.run.id,f.analyst,f.input);
    const writer = require('../../services/resultWriteService'), inputs = {absorbance:3,blankConcentration:0,extractVolume:20,dilutionFactor:2,sampleMass:1,moistureCorrectionFactor:1};
    const preview = await writer.previewResultCalculation(f.db,{sampleId:f.sample.id,workItemId:f.item.id,actor:f.analyst,inputs});
    const result = await f.db.$transaction(tx => writer.writeResult(tx,{sampleId:f.sample.id,workItemId:f.item.id,actor:f.analyst,
        measurement:{param:'P_OLSEN',value:40,calculation:{...preview.active,curveId:first.id,inputs}}}));
    const frozen = await f.db.resultCalculation.findUnique({where:{resultId:result.id}});
    await curves.recordCurve(f.db,f.run.id,f.analyst,{...f.input,expectedCurveId:first.id,reason:'Retain the failed recalibration',
        points:[{standardConcentration:1,response:2}]});
    const before = await f.snapshot(), item = await f.db.workItem.findUnique({where:{id:f.item.id}});
    const readiness = await require('../../services/storedResultCompletenessService').checkStoredCompletion(f.db,f.sample,item,[result],f.analyst);
    expect(readiness).toMatchObject({ready:false,code:'CALIBRATION_CURVE_FAILED'});
    expect(await f.snapshot()).toEqual(before);
    expect(await f.db.result.findUnique({where:{id:result.id}})).toEqual(result);
    expect(await f.db.resultCalculation.findUnique({where:{resultId:result.id}})).toEqual(frozen);
    await expect(curves.assertRunCalibration(f.db,f.run.id,f.manager,'P_OLSEN')).rejects.toMatchObject({statusCode:409,code:'CALIBRATION_CURVE_FAILED'});
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

test('actual authenticated HTTP entry retains permission, canonical scope, active context and stable refusal codes', async () => {
    const f = context; await f.start();
    await withQcRunHttp(f.db, f.analyst, async (app, token) => {
        const endpoint = `/api/qc/batches/${f.run.id}/calibration-curves`, before = await f.snapshot();
        expect((await request(app).post(endpoint).send(f.input)).status).toBe(401);
        const stale = await request(app).post(endpoint).set('Authorization', `Bearer ${token}`).send({ ...f.input, templateVersion: 99 });
        expect(stale.status).toBe(409); expect(stale.body.code).toBe('CALC_TEMPLATE_VERSION_CHANGED');
        expect(await f.snapshot()).toEqual(before);
        const saved = await request(app).post(endpoint).set('Authorization', `Bearer ${token}`).send(f.input);
        expect(saved.status).toBe(201); expect(saved.body.data).toMatchObject({ status: 'PASS', pointCount: 3 });
        const listed = await request(app).get(endpoint).query({ analysisCode: 'P_OLSEN' }).set('Authorization', `Bearer ${token}`);
        expect(listed.status).toBe(200); expect(listed.body.data.latest.id).toBe(saved.body.data.id);
        expect(listed.body.data.active).toMatchObject({ activationId: f.activation.id, requiresCurve: true });
    });
    await withQcRunHttp(f.db, f.outsider, async (app, token) => {
        const before = await f.snapshot();
        expect((await request(app).get(`/api/qc/batches/${f.run.id}/calibration-curves`).query({ analysisCode: 'P_OLSEN' })
            .set('Authorization', `Bearer ${token}`)).status).toBe(403);
        expect(await f.snapshot()).toEqual(before);
    });
});

test('the pinned prerequisite helper has only the closed owned successors and no runtime writer exemption', () => {
    const { scanSource } = require('../helpers/workflowWriteScanner');
    const source = fs.readFileSync(path.resolve(__dirname,'../helpers/calculationReleasePrerequisites.js'),'utf8');
    expect(scanSource(source,'tests/helpers/calculationReleasePrerequisites.js')).toEqual([]);
    expect(scanSource(`${source}\n// changed helper\n`,'tests/helpers/calculationReleasePrerequisites.js'))
        .toContainEqual(expect.objectContaining({code:'HISTORICAL_FIXTURE_SOURCE_MISMATCH'}));
    const probe = "const {installCalculationReleasePrerequisites}=require('./calculationReleasePrerequisites');installCalculationReleasePrerequisites(file);";
    for (const file of ['qcGateFixture','normalizedQcFixture','repeatQcPredecessors'])
        expect(scanSource(probe,`tests/helpers/${file}.js`)).toEqual([]);
    const positiveStartupProbe = "const {installCalculationReleasePrerequisites}=require('../helpers/calculationReleasePrerequisites');installCalculationReleasePrerequisites(file);";
    for (const file of ['audit_2_3_native_runs','audit_1_2_guard_installer','deployment_readiness_bootstrap'])
        expect(scanSource(positiveStartupProbe,`tests/contracts/${file}.test.js`)).toEqual([]);
    expect(scanSource(probe,'tests/helpers/fourthCaller.js')).toContainEqual(expect.objectContaining({code:'HISTORICAL_FIXTURE_CALLER_NOT_ALLOWED'}));
    const runtime = "const {installCalculationReleasePrerequisites}=require('../tests/helpers/calculationReleasePrerequisites');installCalculationReleasePrerequisites(file);";
    expect(scanSource(runtime,'services/fourthCaller.js')).toContainEqual(expect.objectContaining({code:'TEST_HELPER_IMPORTED_BY_RUNTIME'}));
});

const correctionInputs={absorbance:'3.00',blankConcentration:'0',extractVolume:'20',dilutionFactor:'2',sampleMass:'1',moistureCorrectionFactor:'1'};
// Audit6093305929: independent Pearson oracle for x=[0,1,2], y=[1,3,5.1].
const boundaryR = 0.9999008674099175;
test.each(['LAB', 'METHOD'].flatMap(scope => [
    { scope, key: 'curveMinPoints', minimum: 3, pass: true },
    { scope, key: 'curveMinPoints', minimum: 4, pass: false },
    { scope, key: 'curveMinR', minimum: boundaryR - 0.000001, pass: true },
    { scope, key: 'curveMinR', minimum: boundaryR + 0.000001, pass: false }
]))('$scope $key boundary $minimum retains a curve PASS=$pass from laboratory policy', async scenario => {
    const f = context;
    await rules.change(f.manager, { labId: f.lab.id, analysisCode: 'P_OLSEN', methodologyId: f.method.id, expectedVersion: 1,
        criteria: { curveMinPoints: null, curveMinR: null }, reason: 'Use laboratory policy calibration limits' }, { db: f.db });
    const scope = scenario.scope === 'METHOD' ? { analysisCode: 'P_OLSEN', methodologyId: f.method.id } : {};
    await require('../../services/policyService').change(f.manager, f.lab.id, { expectedVersion: 0,
        reason: 'Owned laboratory calibration policy boundary', changes: [
            { key: 'qc.curveMinPoints', value: scenario.key === 'curveMinPoints' ? scenario.minimum : 3, ...scope },
            { key: 'qc.curveMinR', value: scenario.key === 'curveMinR' ? scenario.minimum : 0.995, ...scope }
        ] }, { db: f.db });
    await f.start();
    const saved = await curves.recordCurve(f.db, f.run.id, f.analyst, { ...f.input, points: [
        { standardConcentration: 0, response: 1 }, { standardConcentration: 1, response: 3 }, { standardConcentration: 2, response: 5.1 }
    ] });
    expect(saved.r).toBeCloseTo(boundaryR, 12);
    expect(saved.status).toBe(scenario.pass ? 'PASS' : 'FAIL');
    expect(saved[scenario.key === 'curveMinPoints' ? 'minPointsApplied' : 'minRApplied']).toBe(scenario.minimum);
    expect(JSON.parse(saved.thresholdSource)[scenario.key].source).toBe(scenario.scope + '_OVERRIDE');
    const resolved = await rules.resolve(f.lab.id, 'P_OLSEN', { db: f.db, methodologyId: f.method.id });
    expect(resolved.deferredFields).not.toContain('curveMinPoints');
    expect(resolved.deferredFields).not.toContain('curveMinR');
});

test('a passing recalibration binds later readings to revision2 while the original Result/calculation remain on revision1', async () => {
    const f = await fixture({ additionalItem: true }), original = await correctionReading(f);
    const second = await curves.recordCurve(f.db, f.run.id, f.analyst, { ...f.input, expectedCurveId: original.curve.id,
        reason: 'Owned passing recalibration', points: [{ standardConcentration: 0, response: 2 },
            { standardConcentration: 1, response: 4 }, { standardConcentration: 2, response: 6 }] });
    expect(second).toMatchObject({ status: 'PASS', revision: 2, supersedesId: original.curve.id });
    const writer = require('../../services/resultWriteService'), inputs = { ...correctionInputs, absorbance: '4' };
    const preview = await writer.previewResultCalculation(f.db, { sampleId: f.laterItem.sampleId, workItemId: f.laterItem.id, actor: f.analyst, inputs });
    expect(preview.curve.id).toBe(second.id);
    const later = await f.db.$transaction(tx => writer.writeResult(tx, { sampleId: f.laterItem.sampleId, workItemId: f.laterItem.id, actor: f.analyst,
        measurement: { param: 'P_OLSEN', value: preview.calculation.output,
            calculation: { ...preview.active, curveId: second.id, inputs } } }));
    expect(await f.db.resultCalculation.findUnique({ where: { resultId: later.id } })).toMatchObject({ curveId: second.id });
    expect(await f.db.result.findUnique({ where: { id: original.result.id } })).toEqual(original.result);
    expect(await f.db.resultCalculation.findUnique({ where: { resultId: original.result.id } })).toEqual(original.calculation);
});
test.each([null, 'unresolvable-owned-lab'])('no-template completion retains the historical path for lab %s without writes', async lab => {
    const f = context;
    const item = await createWorkItemFixture(f.db, { data: { id: randomUUID(), sampleId: f.sample.id, labId: f.lab.id,
        analysis: 'P_BRAY1', assignedTo: f.analyst.username, status: 'IN_PROGRESS', history: '[]' } });
    const result = await require('../helpers/workAttemptFixtures').createExecutionResultFixture(f.db, { data: {
        id: randomUUID(), sampleId: f.sample.id, param: 'P_BRAY1', value: '7', numericValue: 7, unit: 'mg/kg', isCurrent: true, isValid: true
    } });
    const root = await f.db.user.create({ data: { id: randomUUID(), username: randomUUID(), email: `${randomUUID()}@example.invalid`,
        password: 'synthetic-unusable', role: 'SUPER_ADMIN' } });
    const historicalSample = { ...f.sample, assignedLab: lab, labId: lab }, before = await f.snapshot();
    expect(await require('../../services/storedResultCompletenessService').checkStoredCompletion(f.db, historicalSample, item, [result], root))
        .toMatchObject({ ready: true, resultIds: [result.id] });
    expect(await f.snapshot()).toEqual(before);
});

test('UPDATE and DELETE are refused on every calculation table, preserving all original rows', async () => {
    const f = context, original = await correctionReading(f), before = await correctionSnapshot(f);
    const unchanged = async (operation, code) => {
        await expect(operation).rejects.toThrow(code);
        expect(await correctionSnapshot(f)).toEqual(before);
    };
    // Literal statements keep every SQL probe statically inspectable by the
    // existing workflow scanner, without a dynamic SQL allowance.
    await unchanged(f.db.$executeRawUnsafe('UPDATE CalcTemplate SET id=id WHERE id=?', f.template.id), 'CALC_TEMPLATE_IMMUTABLE');
    await unchanged(f.db.$executeRawUnsafe('DELETE FROM CalcTemplate WHERE id=?', f.template.id), 'CALC_TEMPLATE_IMMUTABLE');
    await unchanged(f.db.$executeRawUnsafe('UPDATE CalcTemplateActivation SET id=id WHERE id=?', f.activation.id), 'CALC_ACTIVATION_IMMUTABLE');
    await unchanged(f.db.$executeRawUnsafe('DELETE FROM CalcTemplateActivation WHERE id=?', f.activation.id), 'CALC_ACTIVATION_IMMUTABLE');
    await unchanged(f.db.$executeRawUnsafe('UPDATE CalibrationCurve SET id=id WHERE id=?', original.curve.id), 'CALIBRATION_CURVE_IMMUTABLE');
    await unchanged(f.db.$executeRawUnsafe('DELETE FROM CalibrationCurve WHERE id=?', original.curve.id), 'CALIBRATION_CURVE_IMMUTABLE');
    await unchanged(f.db.$executeRawUnsafe('UPDATE CalibrationPoint SET ordinal=ordinal WHERE curveId=? AND ordinal=1', original.curve.id), 'CALIBRATION_POINT_IMMUTABLE');
    await unchanged(f.db.$executeRawUnsafe('DELETE FROM CalibrationPoint WHERE curveId=? AND ordinal=1', original.curve.id), 'CALIBRATION_POINT_IMMUTABLE');
    await unchanged(f.db.$executeRawUnsafe('UPDATE ResultCalculation SET id=id WHERE id=?', original.calculation.id), 'RESULT_CALCULATION_IMMUTABLE');
    await unchanged(f.db.$executeRawUnsafe('DELETE FROM ResultCalculation WHERE id=?', original.calculation.id), 'RESULT_CALCULATION_IMMUTABLE');
});
test('an actual calculation SQL context abort becomes a stable409 through the mapped repeat controller', async () => {
    const f = context, original = await correctionReading(f), before = await correctionSnapshot(f);
    let guardError;
    // Raw SQL retains the actual SQLite guard code instead of Prisma's generic
    // model-write constraint translation. Reuse the original context unchanged.
    try { await f.db.$executeRawUnsafe('INSERT INTO ResultCalculation(id,resultId,templateId,templateVersion,activationId,inputs,parameters,intermediate,nativeValue,nativeUnit,conversionFactor,unitConversion,unroundedOutput,output,outputUnit,curveId,engineVersion,computedBy,computedAt) SELECT ?,resultId,templateId,templateVersion,activationId,inputs,parameters,intermediate,nativeValue,nativeUnit,conversionFactor,unitConversion,unroundedOutput,?,outputUnit,curveId,engineVersion,computedBy,computedAt FROM ResultCalculation WHERE id=?',
        randomUUID(), original.calculation.output + 1, original.calculation.id); }
    catch (error) { guardError = error; }
    expect(guardError?.message).toContain('RESULT_CALCULATION_CONTEXT_MISMATCH');
    expect(await correctionSnapshot(f)).toEqual(before);
    // Exercise only the controller's service-error boundary with the real SQL
    // abort. Authentication/authorization and workflow behavior have their own
    // retained HTTP contracts; no role, guard or analytical data is mocked.
    jest.spyOn(require('../../services/workRepeatService'), 'requestRepeat').mockRejectedValueOnce(guardError);
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
    await require('../../controllers/workRepeatController').requestRepeat({ params: { id: f.item.id }, user: f.analyst, body: {} }, res);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'RESULT_CALCULATION_CONTEXT_MISMATCH' }));
    expect(await correctionSnapshot(f)).toEqual(before);
});
test.each([
    {absorbance:'3.00',value:40,extract:1,genericMax:0.1,above:false},
    {absorbance:'9.00',value:160,extract:4,genericMax:1000,above:true}
])('the actual curve governs extract $extract despite generic maximum $genericMax, with HTTP preview and immutable flags',async scenario=>{
    const f=context;
    await require('../../services/policyService').change(f.manager,f.lab.id,{reason:'Owned curve/generic maximum separation',changes:[
        {key:'results.calibrationMax',analysisCode:'P_OLSEN',methodologyId:f.method.id,value:scenario.genericMax}]},{db:f.db});
    await f.start();const curve=await curves.recordCurve(f.db,f.run.id,f.analyst,f.input);
    const measurement={param:'P_OLSEN',value:String(scenario.value),calculation:{activationId:f.activation.id,
        templateId:f.template.id,templateVersion:f.template.version,curveId:curve.id,inputs:{...correctionInputs,absorbance:scenario.absorbance}}};
    await withQcRunHttp(f.db,f.analyst,async(app,token)=>{
        const preview=await request(app).post('/api/workbench/v2/completion/preview').set('Authorization','Bearer '+token)
            .send({entries:[{workItemId:f.item.id,...measurement}]});
        expect(preview.status).toBe(200);expect(preview.body.excluded).toEqual([]);
        expect(preview.body.included[0].validation.flags.includes('ABOVE_RANGE')).toBe(scenario.above);
        expect(preview.body.included[0].calculationEvidence.intermediate).toMatchObject({extractConcentration:scenario.extract,
            calibrationMax:2,calibrationUnit:'mg/L',curveId:curve.id,curveRevision:curve.revision,aboveRange:scenario.above});
    },{workbench:true});
    const result=await f.db.$transaction(tx=>require('../../services/resultWriteService').writeResult(tx,
        {sampleId:f.sample.id,workItemId:f.item.id,actor:f.analyst,measurement}));
    expect(result).toMatchObject({numericValue:scenario.value,isValid:true});
    expect(JSON.parse(result.flags).includes('ABOVE_RANGE')).toBe(scenario.above);
    const frozen=await f.db.resultCalculation.findUnique({where:{resultId:result.id}});
    expect(JSON.parse(frozen.intermediate)).toMatchObject({extractConcentration:scenario.extract,calibrationMax:2,
        calibrationUnit:'mg/L',curveId:curve.id,curveRevision:curve.revision,aboveRange:scenario.above});
    const before=await f.snapshot();
    const prompt=await require('../../services/workbenchValueValidationService').dilutionOpportunity(f.db,f.item,f.manager);
    expect(prompt.eligible).toBe(scenario.above);expect(await f.snapshot()).toEqual(before);
});

test('a method with no active calculation keeps the generic #197 calibration maximum',async()=>{
    const f=context;
    await activations.change(f.db,f.manager,f.template.id,{labId:f.lab.id,analysisCode:'P_OLSEN',methodologyId:f.method.id,
        expectedVersion:f.template.version,action:'DEACTIVATE',expectedActivationId:f.activation.id,verifiedAgainstSop:true,reason:'Owned non-calculated method comparison'});
    await require('../../services/policyService').change(f.manager,f.lab.id,{reason:'Owned generic maximum',changes:[
        {key:'results.calibrationMax',analysisCode:'P_OLSEN',methodologyId:f.method.id,value:3}]},{db:f.db});
    await f.start();
    const result=await f.db.$transaction(tx=>require('../../services/resultWriteService').writeResult(tx,
        {sampleId:f.sample.id,workItemId:f.item.id,actor:f.analyst,measurement:{param:'P_OLSEN',value:'4'}}));
    expect(result).toMatchObject({numericValue:4,isValid:true});expect(JSON.parse(result.flags)).toContain('ABOVE_RANGE');
    expect(await f.db.resultCalculation.findUnique({where:{resultId:result.id}})).toBeNull();
});

async function correctionReading(f) {
    await f.start(); const curve=await curves.recordCurve(f.db,f.run.id,f.analyst,f.input);
    const result=await f.db.$transaction(tx=>require('../../services/resultWriteService').writeResult(tx,
        {sampleId:f.sample.id,workItemId:f.item.id,actor:f.analyst,measurement:{param:'P_OLSEN',value:40,
            calculation:{activationId:f.activation.id,templateId:f.template.id,templateVersion:1,curveId:curve.id,inputs:correctionInputs}}}));
    return {curve,result,calculation:await f.db.resultCalculation.findUnique({where:{resultId:result.id}})};
}
const correctionSnapshot=async f=>JSON.parse(JSON.stringify(await Promise.all([f.snapshot(),f.db.resultCalculation.findMany({orderBy:{id:'asc'}}),
    f.db.workItem.findMany({orderBy:{id:'asc'}}),f.db.workAttempt.findMany({orderBy:{id:'asc'}}),f.db.calcTemplate.findMany({orderBy:{id:'asc'}}),
    f.db.calcTemplateActivation.findMany({orderBy:{id:'asc'}})])));
const correctReading=(f,result,extra={})=>require('../../services/workAttemptCorrectionService').correctAttempt(f.db,result.attemptId,f.analyst,
    {value:'40.01',reason:'TRANSCRIPTION_ERROR',note:'Correct the mistyped absorbance from the original worksheet',
        resultId:result.id,calculation:{inputs:{...correctionInputs,absorbance:'3.0004'}},...extra});

test.each(['newer-active','deactivated'])('a calculated transcription correction keeps the original basis after %s, preserving every original scientific field',async mode=>{
    const f=context,original=await correctionReading(f);
    if(mode==='newer-active') {
        const next=await templates.revise(f.db,f.manager,f.template.id,{labId:f.lab.id,expectedVersion:1,outputDecimals:4,
            reason:'A future SOP uses four reporting decimals',sopCitation:'Synthetic future SOP §9'});
        await activations.change(f.db,f.manager,next.id,{labId:f.lab.id,analysisCode:'P_OLSEN',methodologyId:f.method.id,
            expectedVersion:next.version,expectedActivationId:f.activation.id,action:'ACTIVATE',verifiedAgainstSop:true,reason:'Future entries use the revised SOP'});
    } else await activations.change(f.db,f.manager,f.template.id,{labId:f.lab.id,analysisCode:'P_OLSEN',methodologyId:f.method.id,
        expectedVersion:1,expectedActivationId:f.activation.id,action:'DEACTIVATE',verifiedAgainstSop:true,reason:'Pause future calculations without rebasing historical entries'});
    const definitions=await f.db.calcTemplate.findMany({orderBy:{id:'asc'}}),activationRows=await f.db.calcTemplateActivation.findMany({orderBy:{id:'asc'}});
    const corrected=await correctReading(f,original.result),frozen=await f.db.resultCalculation.findUnique({where:{resultId:corrected.result.id}});
    expect(corrected.result).toMatchObject({numericValue:40.01,attemptId:original.result.attemptId,replicateNo:original.result.replicateNo,
        methodologyId:original.result.methodologyId,batchId:original.result.batchId,equipmentId:original.result.equipmentId,
        equipmentReadiness:original.result.equipmentReadiness,basis:original.result.basis,provenance:original.result.provenance});
    expect(frozen).toMatchObject({templateId:original.calculation.templateId,templateVersion:original.calculation.templateVersion,
        activationId:original.calculation.activationId,curveId:original.calculation.curveId,parameters:original.calculation.parameters,
        unitConversion:original.calculation.unitConversion,output:40.01});
    expect(await f.db.result.findUnique({where:{id:original.result.id}})).toEqual({...original.result,isCurrent:false,supersededBy:corrected.result.id});
    expect(await f.db.resultCalculation.findUnique({where:{resultId:original.result.id}})).toEqual(original.calculation);
    expect(await f.db.calcTemplate.findMany({orderBy:{id:'asc'}})).toEqual(definitions);
    expect(await f.db.calcTemplateActivation.findMany({orderBy:{id:'asc'}})).toEqual(activationRows);
    const audit=await f.db.auditLog.findFirst({where:{entity:'RESULT_CALCULATION',entityId:frozen.id,action:'RESULT_CALCULATION_CORRECTED'}});
    expect(JSON.parse(audit.details)).toMatchObject({templateId:original.calculation.templateId,templateVersion:1,activationId:f.activation.id,
        curveId:original.curve.id,correction:{originalResultCalculationId:original.calculation.id,originalResultId:original.result.id,
            changedInputs:[{key:'absorbance',oldValue:'3.00',newValue:'3.0004'}]}});
});

test('a correction of a correction keeps the first calculation basis and binds its own original evidence',async()=>{
    const f=context,original=await correctionReading(f);
    await activations.change(f.db,f.manager,f.template.id,{labId:f.lab.id,analysisCode:'P_OLSEN',methodologyId:f.method.id,
        expectedVersion:1,expectedActivationId:f.activation.id,action:'DEACTIVATE',verifiedAgainstSop:true,reason:'Pause future calculations'});
    const first=await correctReading(f,original.result),firstCalculation=await f.db.resultCalculation.findUnique({where:{resultId:first.result.id}});
    const retainedOriginal=await f.db.result.findUnique({where:{id:original.result.id}});
    const second=await correctReading(f,first.result,{value:'40.02',calculation:{inputs:{...correctionInputs,absorbance:'3.0008'}}});
    const secondCalculation=await f.db.resultCalculation.findUnique({where:{resultId:second.result.id}});
    for(const key of ['templateId','templateVersion','activationId','curveId','parameters','conversionFactor','unitConversion'])
        expect(secondCalculation[key]).toEqual(original.calculation[key]);
    expect(second.result).toMatchObject({numericValue:40.02,attemptId:original.result.attemptId,replicateNo:original.result.replicateNo});
    expect(await f.db.result.findUnique({where:{id:original.result.id}})).toEqual(retainedOriginal);
    expect(await f.db.result.findUnique({where:{id:first.result.id}})).toEqual({...first.result,isCurrent:false,supersededBy:second.result.id});
    expect(await f.db.resultCalculation.findUnique({where:{resultId:original.result.id}})).toEqual(original.calculation);
    expect(await f.db.resultCalculation.findUnique({where:{resultId:first.result.id}})).toEqual(firstCalculation);
    const audit=await f.db.auditLog.findFirst({where:{entity:'RESULT_CALCULATION',entityId:secondCalculation.id,action:'RESULT_CALCULATION_CORRECTED'}});
    expect(JSON.parse(audit.details).correction).toEqual({originalResultCalculationId:firstCalculation.id,originalResultId:first.result.id,
        changedInputs:[{key:'absorbance',oldValue:'3.0004',newValue:'3.0008'}]});
});

test('calculated final-only, mismatched output and partial raw-input corrections refuse with exact zero-write snapshots',async()=>{
    const f=context,{result}=await correctionReading(f),before=await correctionSnapshot(f);
    for(const [extra,code,statusCode] of [[{calculation:undefined},'CALC_CORRECTION_INPUTS_REQUIRED',422],
        [{value:41},'CALCULATION_MISMATCH',409],[{calculation:{inputs:{absorbance:3}}},'CALC_INPUT_REQUIRED',422]]) {
        const input={value:'40.01',reason:'TRANSCRIPTION_ERROR',note:'Controlled original-basis correction',resultId:result.id,
            calculation:{inputs:{...correctionInputs,absorbance:'3.0004'}},...extra};
        if(Object.hasOwn(extra,'calculation') && extra.calculation===undefined)delete input.calculation;
        await expect(require('../../services/workAttemptCorrectionService').correctAttempt(f.db,result.attemptId,f.analyst,input))
            .rejects.toMatchObject({code,statusCode});
        expect(await correctionSnapshot(f)).toEqual(before);
    }
});

test.each(['activationId','templateId','templateVersion','curveId'])('a correction cannot request a different %s basis',async key=>{
    const f=context,{result}=await correctionReading(f),before=await correctionSnapshot(f);
    await expect(correctReading(f,result,{calculation:{inputs:correctionInputs,[key]:'untrusted-basis'}}))
        .rejects.toMatchObject({statusCode:400,code:'ATTEMPT_CORRECTION_FIELDS_INVALID'});
    expect(await correctionSnapshot(f)).toEqual(before);
});

test('a revised original curve refuses a transcription correction without writes to either Result or calculation',async()=>{
    const f=context,{result,curve}=await correctionReading(f);
    await curves.recordCurve(f.db,f.run.id,f.analyst,{...f.input,expectedCurveId:curve.id,reason:'Retain a revised batch calibration'});
    const before=await correctionSnapshot(f);
    await expect(correctReading(f,result)).rejects.toMatchObject({statusCode:409,code:'CALC_CORRECTION_BASIS_SUPERSEDED'});
    expect(await correctionSnapshot(f)).toEqual(before);
});

test('the actual correction HTTP route recomputes the extract-range flag and binds only stored ids',async()=>{
    const f=context,{result,calculation}=await correctionReading(f),inputs={...correctionInputs,absorbance:'5.1'};
    await withQcRunHttp(f.db,f.analyst,async(app,token)=>{
        const response=await request(app).post(`/api/attempts/${result.attemptId}/corrections`).set('Authorization',`Bearer ${token}`)
            .send({resultId:result.id,value:82,reason:'TRANSCRIPTION_ERROR',note:'Correct an absorbance copied from the worksheet',calculation:{inputs}});
        expect(response.status).toBe(201);expect(response.body.result.numericValue).toBe(82);
        expect(JSON.parse(response.body.result.flags)).toContain('ABOVE_RANGE');
        const frozen=await f.db.resultCalculation.findUnique({where:{resultId:response.body.result.id}});
        expect(JSON.parse(frozen.intermediate)).toMatchObject({extractConcentration:2.05,calibrationMax:2,calibrationUnit:'mg/L',aboveRange:true});
        expect(await f.db.resultCalculation.findUnique({where:{resultId:result.id}})).toEqual(calculation);
    },{repeatCommands:true});
});

test('a calculation field on a non-calculated Result is refused, while its old final-only correction remains available',async()=>{
    const f=context;await f.start();
    await activations.change(f.db,f.manager,f.template.id,{labId:f.lab.id,analysisCode:'P_OLSEN',methodologyId:f.method.id,
        expectedVersion:1,expectedActivationId:f.activation.id,action:'DEACTIVATE',verifiedAgainstSop:true,reason:'Use the existing unactivated result path'});
    const result=await f.db.$transaction(tx=>require('../../services/resultWriteService').writeResult(tx,
        {sampleId:f.sample.id,workItemId:f.item.id,actor:f.analyst,measurement:{param:'P_OLSEN',value:7}}));
    const before=await correctionSnapshot(f);
    await expect(correctReading(f,result)).rejects.toMatchObject({statusCode:400,code:'ATTEMPT_CORRECTION_FIELDS_INVALID'});
    expect(await correctionSnapshot(f)).toEqual(before);
    const response=await require('../../services/workAttemptCorrectionService').correctAttempt(f.db,result.attemptId,f.analyst,
        {value:'7.25',reason:'TRANSCRIPTION_ERROR',note:'Existing uncalculated correction contract'});
    expect(response.result.numericValue).toBe(7.25);expect(await f.db.resultCalculation.count()).toBe(0);
});

test('the authoritative completion preview verifies nested raw calculations, refuses tampering and allocates no Result',async()=>{
    const f=context;await f.start();const curve=await curves.recordCurve(f.db,f.run.id,f.analyst,f.input),before=await correctionSnapshot(f);
    const calculation={activationId:f.activation.id,templateId:f.template.id,templateVersion:1,curveId:curve.id,inputs:correctionInputs};
    await withQcRunHttp(f.db,f.analyst,async(app,token)=>{
        const endpoint='/api/workbench/v2/completion/preview',entry={workItemId:f.item.id,value:'40',values:{calculation}};
        const accepted=await request(app).post(endpoint).set('Authorization',`Bearer ${token}`).send({entries:[entry]});
        expect(accepted.status).toBe(200);expect(accepted.body.eligibleCount).toBe(1);
        expect(accepted.body.included[0].calculationEvidence).toMatchObject({output:40,templateId:f.template.id,activationId:f.activation.id,curveId:curve.id});
        const refused=await request(app).post(endpoint).set('Authorization',`Bearer ${token}`).send({entries:[{...entry,value:41}]});
        expect(refused.status).toBe(200);expect(refused.body.excluded[0].blockers).toContain('CALCULATION_MISMATCH');
    },{workbench:true});
    expect(await correctionSnapshot(f)).toEqual(before);
});
