const { randomUUID } = require('node:crypto');
const Database = require('better-sqlite3');
const request = require('supertest');
const { qcGateFixture } = require('../helpers/qcGateFixture');
const { withQcRunHttp } = require('../helpers/qcRunHttpHarness');
const { createSampleFixture, createWorkItemFixture } = require('../helpers/workflowFixtures');
const { buildNativeRun, startNativeRun } = require('../../services/qcNativeRunService');
const { writeNativeMeasurements } = require('../../services/qcNativeMeasurementService');
const charts = require('../../services/controlChartService');
const { installControlCharts, assertControlChartStartupReady } = require('../../scripts/install_control_charts');
const owned = [];
afterEach(async () => { for (const f of owned.splice(0)) await f.close(); });
async function fixture(options = {}) {
    const f = await qcGateFixture({ criteria: { blankPerBatch: 0, duplicateEvery: 0, lrmPerBatch: 2, lrmMode: 'CONTROL_CHART' }, ...options });
    owned.push(f);
    f.approver = { username: 'manager-' + randomUUID(), role: 'LAB_MANAGER', labId: f.labId };
    await f.db.user.create({ data: { id: f.approver.username, username: f.approver.username, email: f.approver.username + '@example.test', password: 'fixture', role: 'LAB_MANAGER', labId: f.labId } });
    f.lot = await f.db.referenceMaterial.create({ data: { id: randomUUID(), labId: f.labId, code: randomUUID(), name: 'Synthetic LRM', kind: 'LRM', matrix: 'SOIL', lotNumber: 'lot-a', status: 'ACTIVE', createdBy: f.actor.username } });
    await f.db.referenceValue.create({ data: { id: randomUUID(), referenceMaterialId: f.lot.id, analysisCode: f.analysisCode, assignedValue: 100, unit: 'fixture-unit', valueType: 'LAB_ASSIGNED', createdBy: f.actor.username } });
    f.series = { labId: f.labId, analysisCode: f.analysisCode, methodologyId: f.method.id, referenceMaterialId: f.lot.id };
    await f.setPolicy([{ key: 'qc.controlChartMinPoints', value: 2, analysisCode: f.analysisCode, methodologyId: f.method.id }]);
    f.run = async values => {
        const sample = await createSampleFixture(f.db, { data: { id: randomUUID(), originalId: randomUUID(), assignedLab: f.labId, status: 'PROCESSING', dryingStatus: 'DONE', preparationStatus: 'DONE' } });
        const item = await createWorkItemFixture(f.db, { data: { id: randomUUID(), sampleId: sample.id, labId: f.labId, analysis: f.analysisCode, methodologyId: f.method.id, status: 'IN_PROGRESS' } });
        const built = await buildNativeRun(f.db, f.actor, { instrumentId: f.instrument.id, workItemIds: [item.id], seed: 'chart-fixture',
            analyses: [{ analysisCode: f.analysisCode, references: [{ positionKind: 'LRM', referenceMaterialLotId: f.lot.id }] }] });
        const run = await startNativeRun(f.db, built.id, f.actor);
        if (!values) return run;
        return writeNativeMeasurements(f.db, run.id, f.actor, { measurements: run.positions.filter(row => row.kind === 'LRM').map((row, i) => ({ positionId: row.id, value: values[i] })) });
    };
    f.propose = async exclusions => {
        const view = await charts.readSeries(f.db, f.actor, f.series), eligible = view.points.filter(row => row.inControl);
        return charts.propose(f.db, f.actor, { ...f.series, reason: 'Synthetic baseline reviewed', selectedMeasurementIds: eligible.filter(row => !(exclusions || []).some(ex => ex.measurementId === row.measurementId)).map(row => row.measurementId), exclusions: exclusions || [] });
    };
    return f;
}
const evaluations = f => f.db.qcEvaluation.findMany({ orderBy: { id: 'asc' } });

test('the explicit SQLite read-only impact report resolves actual policy scopes and counts unbound new runs without changing database bytes', async () => {
    const f = await fixture({ criteria: { blankPerBatch: 0, duplicateEvery: 0, lrmPerBatch: 2 }, fixedWindowPolicy: false });
    const built = await buildNativeRun(f.db, f.actor, f.input);
    const { collectReadonly } = require('../../scripts/control_chart_prebinding_impact');
    const fs = require('node:fs'), hash = () => Object.fromEntries(['', '-wal', '-shm'].map(suffix => [suffix,
        fs.existsSync(f.file + suffix) ? require('node:crypto').createHash('sha256').update(fs.readFileSync(f.file + suffix)).digest('hex') : null]));
    const before = hash(), report = await collectReadonly(f.file);
    expect(hash()).toEqual(before);
    expect(report.access).toBe('SQLITE_READONLY_SNAPSHOT');
    expect(report.controlChartContexts).toEqual(expect.arrayContaining([expect.objectContaining({ labId: f.labId,
        analysisCode: f.analysisCode, methodologyId: f.method.id, lrmMode: 'CONTROL_CHART' })]));
    expect(report.affectedRuns.find(row => row.batchId === built.id).unbound).toHaveLength(2);
    await f.setPolicy([{ key: 'qc.lrmLimitMode', value: 'FIXED_WINDOW', analysisCode: f.analysisCode, methodologyId: f.method.id }]);
    const fixedBefore = hash(), fixed = await collectReadonly(f.file);
    expect(hash()).toEqual(fixedBefore);
    expect(fixed.controlChartContexts.some(row => row.labId === f.labId && row.analysisCode === f.analysisCode && row.methodologyId === f.method.id)).toBe(false);
    expect(fixed.affectedRuns.some(row => row.batchId === built.id)).toBe(false);
});

test('an effective corrected observation replaces its original in future baselines while prior proposals and evaluations stay immutable', async () => {
    const f = await fixture(), run = await f.run([99, 101]), proposal = await f.propose();
    const original = (await evaluations(f))[0], measurement = run.measurements.find(row => row.value === 99);
    await require('../../services/qcNativeLifecycleService').reopenNativeRun(f.db, run.id, f.actor, 'Reopen accepted QC for the documented correction');
    const reopened = await f.snapshot();
    await expect(startNativeRun(f.db, run.id, f.actor, { references: [{ positionId: measurement.positionId, referenceMaterialId: f.lot.id }] }))
        .rejects.toMatchObject({ statusCode: 409, code: 'QC_CHART_LOT_FROZEN' });
    expect(await f.snapshot()).toEqual(reopened);
    await writeNativeMeasurements(f.db, run.id, f.actor, { reason: 'Documented synthetic correction',
        corrections: [{ positionId: measurement.positionId, value: 100 }] }, { correction: true });
    const points = (await charts.readSeries(f.db, f.actor, f.series)).points;
    expect(points).toHaveLength(2); expect(points.some(row => row.measurementId === measurement.id)).toBe(false);
    expect(points.find(row => row.value === 100).replacesMeasurementId).toBe(measurement.id);
    expect(await f.db.controlLimitProposal.findUnique({ where: { id: proposal.id } })).toEqual(proposal);
    expect(await f.db.qcEvaluation.findUnique({ where: { id: original.id } })).toEqual(original);
});

test('a different reference-material lot is a new Provisional series and cannot inherit approved limits or history', async () => {
    const f = await fixture(); await f.run([99,101]); const set = await charts.approve(f.db, f.approver, (await f.propose()).id);
    const oldLot = f.lot;
    f.lot = await f.db.referenceMaterial.create({ data: { id: randomUUID(), labId:f.labId, code:randomUUID(), name:'Another lot', kind:'LRM', matrix:'SOIL',lotNumber:'lot-b',status:'ACTIVE',createdBy:f.actor.username } });
    await f.db.referenceValue.create({ data: { id:randomUUID(),referenceMaterialId:f.lot.id,analysisCode:f.analysisCode,assignedValue:100,unit:'fixture-unit',valueType:'LAB_ASSIGNED',createdBy:f.actor.username } });
    const run = await f.run(), context = JSON.parse((await f.db.batchAnalyte.findFirst({where:{batchId:run.id}})).criteriaSnapshot).controlCharts[0];
    expect(context.series.referenceMaterialId).toBe(f.lot.id); expect(context.basis.mode).toBe('PROVISIONAL'); expect(context.history).toEqual([]);
    expect(await f.db.controlLimitSet.findUnique({where:{id:set.id}})).toMatchObject({status:'APPROVED',referenceMaterialId:oldLot.id});
});

test('run-first options expose eligible chart lots and the actual start binds them in its guarded transaction', async () => {
    const f = await fixture();
    for (const analysis of ['DRYING','PREPARATION']) await createWorkItemFixture(f.db, { data: {
        id: randomUUID(), sampleId: f.items[0].sampleId, labId: f.labId, analysis, status: 'COMPLETED', history: '[]'
    } });
    const { runOptions, startWorkbenchRun } = require('../../services/workbenchRunService');
    const input = { labId: f.labId, analysisCode: f.analysisCode, methodologyId: f.method.id, workItemIds: f.workItemIds };
    const options = await runOptions(f.db, f.actor, input);
    expect(options.chartLotRequired).toBe(true);
    expect(options.eligibleLrmLots.map(row => row.id)).toEqual([f.lot.id]);
    const before = await f.snapshot();
    await expect(startWorkbenchRun(f.db, f.actor, input)).rejects.toMatchObject({ statusCode: 422, code: 'QC_CHART_LOT_REQUIRED' });
    expect(await f.snapshot()).toEqual(before);
    const started = await startWorkbenchRun(f.db, f.actor, { ...input, referenceMaterialLotId: f.lot.id });
    expect(started.startedAt).not.toBeNull();
    const context = JSON.parse((await f.db.batchAnalyte.findFirst()).criteriaSnapshot).controlCharts[0];
    expect(context.positions).toHaveLength(2);
    expect(context.positions.every(row => row.referenceMaterialId === f.lot.id)).toBe(true);
});

test('chart lots freeze at start; fixed-window late binding and a pre-release started run retain their original path', async () => {
    const f = await fixture(), run = await f.run(), replacement = await f.db.referenceMaterial.create({ data: {
        id: randomUUID(), labId: f.labId, code: randomUUID(), name: 'Replacement lot', kind: 'LRM', matrix: 'SOIL', lotNumber: 'lot-b', status: 'ACTIVE', createdBy: f.actor.username
    } });
    await f.db.referenceValue.create({ data: { id: randomUUID(), referenceMaterialId: replacement.id, analysisCode: f.analysisCode, assignedValue: 100, unit: 'fixture-unit', valueType: 'LAB_ASSIGNED', createdBy: f.actor.username } });
    const before = await f.snapshot();
    await expect(writeNativeMeasurements(f.db, run.id, f.actor, { measurements: run.positions.filter(row => row.kind === 'LRM').map(row => ({ positionId: row.id, value: 100 })),
        references: [{ positionId: run.positions.find(row => row.kind === 'LRM').id, referenceMaterialId: replacement.id }] })).rejects.toMatchObject({ statusCode: 409, code: 'QC_CHART_LOT_FROZEN' });
    expect(await f.snapshot()).toEqual(before);
    const fixed = await fixture({ criteria: { blankPerBatch: 0, duplicateEvery: 0, lrmPerBatch: 2, lrmMode: 'FIXED_WINDOW' } });
    const unbound = await startNativeRun(fixed.db, (await buildNativeRun(fixed.db, fixed.actor, fixed.input)).id, fixed.actor);
    expect(JSON.parse((await fixed.db.batchAnalyte.findFirst()).criteriaSnapshot).controlCharts).toEqual([]);
    const completed = await writeNativeMeasurements(fixed.db, unbound.id, fixed.actor, {
        measurements: unbound.positions.filter(row => row.kind === 'LRM').map(row => ({ positionId: row.id, value: 100 })),
        references: unbound.positions.filter(row => row.kind === 'LRM').map(row => ({ positionId: row.id, referenceMaterialId: fixed.lot.id }))
    });
    expect(completed.analytes[0].status).toBe('QC_PASS');
    // A genuine pre-release start is produced by the retained, unmodified source,
    // using the same disposable database. No historical criteria are edited.
    const old = await fixture({ installControlCharts: false });
    const rawSource = require('node:fs').readFileSync(require('node:path').resolve(__dirname, '../fixtures/pre214-native-run-source.cjs'));
    expect(require('node:crypto').createHash('sha256').update(rawSource).digest('hex')).toBe('6feb54119690380ebdcf372f8b053e592a81d9506e134b018bf39c6eb92eddaa');
    const source = rawSource.toString('utf8');
    const legacy = { exports: {} }, ownRequire = require('node:module').createRequire(require('node:path').resolve(__dirname, '../../services/qcNativeRunService.js'));
    new Function('require', 'module', 'exports', source)(ownRequire, legacy, legacy.exports);
    const started = await legacy.exports.startNativeRun(old.db, (await legacy.exports.buildNativeRun(old.db, old.actor, old.input)).id, old.actor);
    const criteria = (await old.db.batchAnalyte.findFirst()).criteriaSnapshot;
    expect(JSON.parse(criteria)).not.toHaveProperty('controlCharts');
    installControlCharts({ dbPath: old.file, apply: true });
    const oldResult = await writeNativeMeasurements(old.db, started.id, old.actor, {
        measurements: started.positions.filter(row => row.kind === 'LRM').map(row => ({ positionId: row.id, value: 100 })),
        references: started.positions.filter(row => row.kind === 'LRM').map(row => ({ positionId: row.id, referenceMaterialId: old.lot.id }))
    });
    expect(oldResult.analytes[0].status).toBe('QC_PASS');
    expect((await old.db.batchAnalyte.findFirst()).criteriaSnapshot).toBe(criteria);
    expect(JSON.parse((await evaluations(old))[0].details).evaluation).not.toHaveProperty('controlCharts');
});

test('provisional limits, approval by a second user and supersession preserve all past and already-started criteria', async () => {
    const f = await fixture(), first = await f.run([99, 101]);
    const firstRecord = (await evaluations(f))[0];
    expect(JSON.parse(firstRecord.details).evaluation.controlCharts[0].rules.every(row => row.status === 'NOT_EVALUATED_PROVISIONAL')).toBe(true);
    expect(first.analytes[0].status).toBe('QC_PASS');
    const started = await f.run(), frozen = (await f.db.batchAnalyte.findFirst({ where: { batchId: started.id } })).criteriaSnapshot;
    const proposal = await f.propose();
    expect(proposal).toMatchObject({ mean: 100, n: 2 }); expect(proposal.sd).toBe(Math.sqrt(2));
    await expect(charts.approve(f.db, f.actor, proposal.id)).rejects.toMatchObject({ statusCode: 403, code: 'QC_CHART_SECOND_PERSON_REQUIRED' });
    const set = await charts.approve(f.db, f.approver, proposal.id);
    expect(await charts.approve(f.db, f.approver, proposal.id)).toEqual(set);
    expect(await evaluations(f)).toEqual([firstRecord]);
    expect((await f.db.batchAnalyte.findFirst({ where: { batchId: started.id } })).criteriaSnapshot).toBe(frozen);
    const next = await f.run([99, 101]);
    const row = (await evaluations(f)).find(e => e.batchId === next.id);
    expect(JSON.parse(row.details).evaluation.controlCharts[0].basis.controlLimitSetId).toBe(set.id);
    const before = await evaluations(f), replacement = await f.propose(), second = await charts.approve(f.db, f.approver, replacement.id);
    expect(second.id).not.toBe(set.id);
    expect(await f.db.controlLimitSet.findUnique({ where: { id: set.id } })).toMatchObject({ status: 'SUPERSEDED', mean: set.mean, sd: set.sd, n: set.n, fromDate: set.fromDate, toDate: second.fromDate });
    expect(await evaluations(f)).toEqual(before);
    const reset = await f.run();
    const context = JSON.parse((await f.db.batchAnalyte.findFirst({ where: { batchId: reset.id } })).criteriaSnapshot).controlCharts[0];
    expect(context.basis.controlLimitSetId).toBe(second.id); expect(context.history).toEqual([]);
});

test('QC_FAIL controls remain in sequence history but cannot enter a passing baseline', async () => {
    const f = await fixture(); await f.run([99, 101]); const set = await charts.approve(f.db, f.approver, (await f.propose()).id);
    const failed = await f.run([106, 94]); expect(failed.analytes[0].status).toBe('QC_FAIL');
    const record = (await evaluations(f)).find(row => row.batchId === failed.id), result = JSON.parse(record.details).evaluation.controlCharts[0];
    expect(result.reject).toEqual(expect.arrayContaining(['1-3s', 'R-4s']));
    const points = (await charts.readSeries(f.db, f.actor, f.series)).points;
    expect(points.filter(row => row.runId === failed.id)).toHaveLength(2);
    expect(points.filter(row => row.runId === failed.id).every(row => !row.inControl && row.verdict === 'FAIL')).toBe(true);
    const next = await f.run(), context = JSON.parse((await f.db.batchAnalyte.findFirst({ where: { batchId: next.id } })).criteriaSnapshot).controlCharts[0];
    expect(context.basis.controlLimitSetId).toBe(set.id); expect(context.history.map(row => row.runId)).toEqual([failed.id, failed.id]);
    expect(await f.db.qcReviewObligation.count()).toBe(0);
});

test('review rules create idempotent scoped obligations and append-only resolutions without changing verdicts', async () => {
    const f = await fixture(); await f.run([99, 101]); await charts.approve(f.db, f.approver, (await f.propose()).id);
    // Four consecutive observations beyond +1s but below +2s.
    await f.run([102, 102]); const run = await f.run([102, 102]);
    expect(run.analytes[0].status).toBe('QC_PASS');
    const record = (await evaluations(f)).find(row => row.batchId === run.id);
    expect(JSON.parse(record.details).evaluation.controlCharts[0].review).toEqual(['4-1s']);
    await charts.createReviews(f.db, record, f.labId); await charts.createReviews(f.db, record, f.labId);
    expect(await f.db.qcReviewObligation.count()).toBe(1);
    const before = await evaluations(f), obligation = (await charts.reviews(f.db, f.actor, f.labId)).obligations[0];
    await expect(charts.resolveReview(f.db, { ...f.actor, role: 'LAB_TECHNICIAN' }, obligation.id, { outcome: 'NO_ACTION', note: 'Reviewed' })).rejects.toMatchObject({ statusCode: 403 });
    await expect(charts.resolveReview(f.db, f.approver, obligation.id, { outcome: 'NO_ACTION', note: '' })).rejects.toMatchObject({ statusCode: 400 });
    const resolution = await charts.resolveReview(f.db, f.approver, obligation.id, { outcome: 'NO_ACTION', note: 'Synthetic review retained' });
    await expect(charts.resolveReview(f.db, f.approver, obligation.id, { outcome: 'INVESTIGATE_NEW_LIMITS', note: 'Overwrite' })).rejects.toMatchObject({ statusCode: 409 });
    await expect(f.db.qcReviewResolution.update({ where: { id: resolution.id }, data: { note: 'Changed' } })).rejects.toBeDefined();
    expect(await evaluations(f)).toEqual(before); expect((await charts.reviews(f.db, f.actor, f.labId)).obligations[0].status).toBe('RESOLVED');
    expect(await f.db.nonconformityReport.count()).toBe(0);
});

test('every baseline exclusion is explicit and retained; ambiguous chronology and wrong scope refuse atomically', async () => {
    const f = await fixture(); await f.run([99, 101]); await f.run([100, 102]);
    const view = await charts.readSeries(f.db, f.actor, f.series), id = view.points[0].measurementId;
    await expect(charts.propose(f.db, f.actor, { ...f.series, reason: 'Missing reason', selectedMeasurementIds: view.points.slice(1).map(row => row.measurementId), exclusions: [{ measurementId: id, reason: '' }] })).rejects.toMatchObject({ statusCode: 400 });
    const proposal = await f.propose([{ measurementId: id, reason: 'Documented synthetic exclusion' }]);
    expect(JSON.parse(proposal.selectionSnapshot).find(row => row.measurementId === id)).toMatchObject({ value: view.points[0].value, selected: false, exclusionReason: 'Documented synthetic exclusion' });
    expect(proposal.n).toBe(3);
    await expect(charts.readSeries(f.db, { ...f.approver, labId: 'another-lab' }, f.series)).rejects.toMatchObject({ statusCode: 403 });
    const db = new Database(f.file); try { db.exec('DROP TRIGGER IF EXISTS "batch_started_at_immutable"');
        // Fault injection on this disposable fixture only: retain original rows
        // and show that missing scientific order is refused, never inferred.
        const triggers = db.prepare("SELECT name FROM sqlite_master WHERE type='trigger' AND tbl_name='Batch'").all();
        for (const row of triggers) db.exec('DROP TRIGGER "' + row.name.replace(/"/g, '""') + '"');
        db.prepare('UPDATE Batch SET startedAt=NULL WHERE id=?').run(view.points[0].runId);
    } finally { db.close(); }
    await expect(charts.readSeries(f.db, f.actor, f.series)).rejects.toMatchObject({ statusCode: 422, code: 'QC_CHART_ORDER_AMBIGUOUS' });
    expect(await f.db.controlLimitProposal.count()).toBe(1);
});

test('HTTP scope and approval permissions use actual token validation and stable refusal codes', async () => {
    const f = await fixture(); await f.run([99, 101]); const proposal = await f.propose();
    await withQcRunHttp(f.db, f.actor, async (app, token) => {
        expect((await request(app).get('/api/qc/control-charts').query(f.series)).status).toBe(401);
        const auth = { Authorization: `Bearer ${token}` };
        const view = await request(app).get('/api/qc/control-charts').query(f.series).set(auth);
        expect(view.status).toBe(200); expect(view.body.points).toHaveLength(2);
        const refused = await request(app).post('/api/qc/control-limit-proposals/' + proposal.id + '/approve').set(auth).send({});
        expect(refused.status).toBe(403); expect(refused.body.code).toBe('QC_CHART_SECOND_PERSON_REQUIRED');
        const invalid = await request(app).get('/api/qc/control-charts').query({ ...f.series, methodologyId: 'missing' }).set(auth);
        expect(invalid.status).toBe(422); expect(invalid.body.code).toBe('QC_CHART_SERIES_INVALID');
    });
    expect(await f.db.controlLimitSet.count()).toBe(0);
});

test('additive installation preserves stored legacy policy bytes and old rows with DRY 0 / APPLY 1 / NO_OP 0', async () => {
    const f = await fixture({ installControlCharts: false });
    const legacy = { reject: ['1-3s'], warn: ['1-2s'] };
    await f.setPolicy([{ key: 'qc.westgardRules', value: legacy }]);
    const policies = await f.db.labPolicyOverride.findMany(), before = await f.snapshot();
    expect(installControlCharts({ dbPath: f.file })).toMatchObject({ classification: 'PRE_214', mode: 'DRY_RUN', totalChanges: 0 });
    expect(await f.snapshot()).toEqual(before);
    expect(installControlCharts({ dbPath: f.file, apply: true })).toMatchObject({ classification: 'COMPLETE_214', mode: 'APPLIED', totalChanges: 1, backfilledCount: 0 });
    expect(await f.snapshot()).toEqual(before); expect(await f.db.labPolicyOverride.findMany()).toEqual(policies);
    expect(await require('../../services/policyService').get(f.labId, 'qc.westgardRules', { db: f.db })).toEqual({ ...legacy, review: [] });
    expect(await f.db.labPolicyOverride.findMany()).toEqual(policies);
    expect(installControlCharts({ dbPath: f.file, apply: true })).toMatchObject({ mode: 'NO_OP', totalChanges: 0 });
    expect(assertControlChartStartupReady(f.file)).toMatchObject({ classification: 'COMPLETE_214', totalChanges: 0 });
    for (const model of ['controlLimitProposal', 'controlLimitSet', 'qcReviewObligation', 'qcReviewResolution']) expect(await f.db[model].count()).toBe(0);
});
