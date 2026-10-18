const { randomUUID } = require('node:crypto');
const request = require('supertest');
const { qcGateFixture } = require('../helpers/qcGateFixture');
const { withQcRunHttp } = require('../helpers/qcRunHttpHarness');
const { createSampleFixture, createWorkItemFixture } = require('../helpers/workflowFixtures');
const { buildNativeRun, startNativeRun } = require('../../services/qcNativeRunService');
const { writeNativeMeasurements } = require('../../services/qcNativeMeasurementService');
const { reopenNativeRun } = require('../../services/qcNativeLifecycleService');
const service = require('../../services/blankHistoryService');
const owned = [];
afterAll(async () => { for (const f of owned) await f.db.$disconnect(); });
const values = Array.from({ length: 20 }, (_, index) => index + 1);

// This read overlay exercises malformed/legacy retained evidence without
// changing a guarded database row or manufacturing an analytical write path.
function overlay(db, transform, historicalStart = false) {
    return new Proxy(db, { get(target, key) {
        if (key === '$transaction' && target.$transaction) return fn => target.$transaction(tx => fn(overlay(tx, transform, historicalStart)));
        if (key === 'batchAnalyte') return new Proxy(target.batchAnalyte, { get(model, operation) {
            if (operation === 'findMany' && !historicalStart) return async args => transform(await model.findMany(args));
            if (operation === 'update' && historicalStart) return args => {
                if (args.data.criteriaSnapshot) {
                    const criteria = JSON.parse(args.data.criteriaSnapshot); delete criteria.analysisUnit;
                    args = { ...args, data: { ...args.data, criteriaSnapshot: JSON.stringify(criteria) } };
                }
                return model.update(args);
            };
            const value = model[operation]; return typeof value === 'function' ? value.bind(model) : value;
        } });
        const value = target[key]; return typeof value === 'function' ? value.bind(target) : value;
    } });
}
async function fixture({ lrm = false } = {}) {
    const f = await qcGateFixture({ criteria: { blankPerBatch: 20, duplicateEvery: 0, lrmPerBatch: lrm ? 1 : 0, crmEveryNBatches: 0 } });
    owned.push(f);
    if (lrm) {
        f.lot = await f.db.referenceMaterial.create({ data: { id: randomUUID(), labId: f.labId, code: randomUUID(), name: 'Synthetic LRM',
            kind: 'LRM', matrix: 'SOIL', lotNumber: randomUUID(), status: 'ACTIVE', createdBy: f.actor.username } });
        await f.db.referenceValue.create({ data: { id: randomUUID(), referenceMaterialId: f.lot.id, analysisCode: f.analysisCode,
            assignedValue: 100, unit: 'fixture-unit', valueType: 'LAB_ASSIGNED', createdBy: f.actor.username } });
    }
    f.run = async ({ readings = values, historical = false } = {}) => {
        const sample = await createSampleFixture(f.db, { data: { id: randomUUID(), originalId: randomUUID(), assignedLab: f.labId,
            status: 'PROCESSING', dryingStatus: 'DONE', preparationStatus: 'DONE' } });
        const item = await createWorkItemFixture(f.db, { data: { id: randomUUID(), sampleId: sample.id, labId: f.labId,
            analysis: f.analysisCode, methodologyId: f.method.id, status: 'IN_PROGRESS' } });
        const built = await buildNativeRun(f.db, f.actor, { instrumentId: f.instrument.id, workItemIds: [item.id], seed: randomUUID(),
            ...(f.lot && { analyses: [{ analysisCode: f.analysisCode, references: [{ positionKind: 'LRM', referenceMaterialLotId: f.lot.id }] }] }) });
        // Reproduce the pre-#216 first-start JSON shape on a NEW public-schema
        // fixture, while retaining all normal SQLite write-once guards.
        const db = historical ? overlay(f.db, null, true) : f.db;
        const run = await startNativeRun(db, built.id, f.actor);
        if (!readings) return run;
        return writeNativeMeasurements(f.db, run.id, f.actor, { measurements: [
            ...run.positions.filter(row => row.kind === 'BLANK').map((row, index) => ({ positionId: row.id, value: readings[index] })),
            ...run.positions.filter(row => row.kind === 'LRM').map(row => ({ positionId: row.id, value: 100 }))] });
    };
    f.series = () => ({ labId: f.labId, analysisCode: f.analysisCode, methodologyId: f.method.id, methodRevision: 1, analysisUnit: 'fixture-unit' });
    f.view = (input = f.series(), db = f.db, actor = f.actor) => service.readHistory(db, actor, input);
    f.proposal = async (view, patch = {}) => service.propose(f.db, f.actor, { ...view.series, fingerprint: view.fingerprint,
        requestId: randomUUID(), reason: 'Reviewed synthetic blank history', selectedMeasurementIds: view.points.map(row => row.measurementId), exclusions: [], ...patch });
    return f;
}

test('twenty real blank positions match a hand sample-SD calculation; FAIL rows stay selected and an idempotent AuditLog proposal never applies limits', async () => {
    const f = await fixture(); await f.run();
    const before = await f.snapshot(), method = await f.db.methodology.findUnique({ where: { id: f.method.id } });
    const view = await f.view(); expect(await f.snapshot()).toEqual(before);
    expect(view.points).toHaveLength(20); expect(view.points.every(row => row.selected && row.verdict === 'FAIL')).toBe(true);
    expect(view.points.some(row => row.blankStatus === 'FAIL')).toBe(true);
    expect(view.points.map(row => row.value)).toEqual(values);
    const requestId = randomUUID(), proposal = await f.proposal(view, { requestId });
    expect(proposal).toMatchObject({ n: 20, mean: 10.5, sd: Math.sqrt(35), lod: 3 * Math.sqrt(35), loq: 10 * Math.sqrt(35),
        formula: 'K_TIMES_SAMPLE_SD', methodologyVersion: 1, proposedMethodologyVersion: 2, applyDeferred: true });
    expect(proposal.observations.every(row => row.measurementId && row.evaluationId && row.selected)).toBe(true);
    expect(await f.proposal(view, { requestId })).toEqual(proposal);
    expect(await f.db.auditLog.count({ where: { action: 'LOD_LOQ_PROPOSED' } })).toBe(1);
    expect(await f.db.methodology.findUnique({ where: { id: f.method.id } })).toEqual(method);
    expect(await f.db.controlLimitProposal.count()).toBe(0);
    const after = await f.snapshot(); after[5] = before[5]; expect(after).toEqual(before);
});

test('every window row needs a decision; exclusions freeze reasons, minimum is enforced, and stale policy or reused request ids fail closed', async () => {
    const f = await fixture(); await f.run(); const view = await f.view(), first = view.points[0].measurementId;
    await expect(f.proposal(view, { selectedMeasurementIds: view.points.slice(1).map(row => row.measurementId) })).rejects.toMatchObject({ code: 'LOD_LOQ_SELECTION_INVALID' });
    await expect(f.proposal(view, { exclusions: [{ measurementId: first, reason: 'Excluded twice' }] })).rejects.toMatchObject({ code: 'LOD_LOQ_SELECTION_INVALID' });
    await expect(f.proposal(view, { selectedMeasurementIds: view.points.slice(0, 9).map(row => row.measurementId),
        exclusions: view.points.slice(9).map(row => ({ measurementId: row.measurementId, reason: 'Documented investigation' })) }))
        .rejects.toMatchObject({ statusCode: 422, code: 'LOD_LOQ_MIN_POINTS_REQUIRED' });
    const id = randomUUID(), proposal = await f.proposal(view, { requestId: id, selectedMeasurementIds: view.points.slice(1).map(row => row.measurementId),
        exclusions: [{ measurementId: first, reason: 'Reviewed contamination evidence' }] });
    expect(proposal.n).toBe(19); expect(proposal.observations[0]).toMatchObject({ selected: false, exclusionReason: 'Reviewed contamination evidence', value: 1 });
    await expect(f.proposal(view, { requestId: id })).rejects.toMatchObject({ code: 'LOD_LOQ_REQUEST_CONFLICT' });
    await f.setPolicy([{ key: 'qc.blankLodMultiplier', value: 4, analysisCode: f.analysisCode, methodologyId: f.method.id }]);
    await expect(f.proposal(view)).rejects.toMatchObject({ statusCode: 409, code: 'LOD_LOQ_HISTORY_CHANGED' });
    expect((await f.view()).proposals[0].lod).toBe(proposal.lod);
});

test('actual per-method policy chooses the last N by execution position and permits a smaller selected n above the minimum', async () => {
    const f = await fixture(); await f.run();
    await f.setPolicy(['qc.blankHistoryWindow', 'qc.blankLodMultiplier', 'qc.blankLoqMultiplier'].map((key, i) => ({ key,
        value: [12, 2, 5][i], analysisCode: f.analysisCode, methodologyId: f.method.id })));
    const view = await f.view(); expect(view.points.map(row => row.value)).toEqual(values.slice(-12));
    const proposal = await f.proposal(view, { selectedMeasurementIds: view.points.slice(2).map(row => row.measurementId),
        exclusions: view.points.slice(0, 2).map(row => ({ measurementId: row.measurementId, reason: 'Reviewed exclusion' })) });
    expect(proposal).toMatchObject({ n: 10, windowSize: 12, lod: 2 * proposal.sd, loq: 5 * proposal.sd });
    await expect(f.setPolicy([{ key: 'qc.blankHistoryMinPoints', value: 13 }])).rejects.toMatchObject({ code: 'POLICY_VALUE_INVALID' });
    await f.setPolicy([{ key: 'qc.blankHistoryWindow', value: 30, analysisCode: f.analysisCode, methodologyId: f.method.id }]);
    const partial = await f.view();
    expect(partial.points).toHaveLength(20);
    expect(await f.proposal(partial)).toMatchObject({ n: 20, windowSize: 30 });
});

test('real corrections supersede prior measurements; an active reopen removes the current round without rewriting prior proposals', async () => {
    const f = await fixture(), run = await f.run({ readings: values.map(value => value / 1000) }), original = (await f.view()).points[0];
    const retained = await f.proposal(await f.view());
    await reopenNativeRun(f.db, run.id, f.actor, 'Synthetic documented blank correction');
    expect((await f.view()).points).toHaveLength(0);
    expect((await f.view()).excludedCounts.REOPENED).toBe(20);
    await writeNativeMeasurements(f.db, run.id, f.actor, { reason: 'Synthetic corrected blank', corrections: [{ positionId: original.positionId, value: 0.021 }] }, { correction: true });
    const corrected = await f.view(); expect(corrected.points).toHaveLength(20);
    expect(corrected.points.some(row => row.measurementId === original.measurementId)).toBe(false);
    expect(corrected.excludedCounts.SUPERSEDED).toBe(1);
    expect(corrected.proposals[0].observations).toEqual(retained.observations);
});

test('old started criteria retain identical bytes on resume/read; only a same-run frozen LRM supplies a historical unit', async () => {
    for (const lrm of [false, true]) {
        const f = await fixture({ lrm }), run = await f.run({ historical: true, readings: values.map(value => value / 1000) });
        const before = (await f.db.batchAnalyte.findFirst({ where: { batchId: run.id } })).criteriaSnapshot;
        expect(JSON.parse(before).analysisUnit).toBeUndefined();
        await f.db.unit.create({ data: { code: 'different-unit', display: 'Different', quantityKind: 'MASS_FRACTION', factorToBase: 2 } });
        await f.db.analysis.update({ where: { code: f.analysisCode }, data: { unitCode: 'different-unit' } });
        const view = await f.view();
        expect(view.points).toHaveLength(lrm ? 20 : 0);
        if (lrm) expect(view.points.every(row => row.analysisUnit === 'fixture-unit' && row.unitSource === 'FROZEN_LRM')).toBe(true);
        else expect(view.excludedCounts.UNIT_UNKNOWN).toBe(20);
        await reopenNativeRun(f.db, run.id, f.actor, 'Resume synthetic pre-release run');
        await startNativeRun(f.db, run.id, f.actor);
        expect((await f.db.batchAnalyte.findFirst({ where: { batchId: run.id } })).criteriaSnapshot).toBe(before);
    }
});

test('read-only evidence classification exposes legacy, multiple, censored, unknown/conflicting unit and revision exclusions without pooling', async () => {
    const f = await fixture(); await f.run();
    const cases = {
        LEGACY: rows => { rows[0].provenance = 'LEGACY'; },
        MULTIPLE_READINGS: rows => { const m = rows[0].batch.measurements[0]; rows[0].batch.measurements.push({ ...m, id: randomUUID(), replicateNo: 2 }); },
        CENSORED: rows => { rows[0].batch.measurements[0].censoring = '<'; },
        NON_FINITE: rows => { rows[0].batch.measurements[0].value = NaN; },
        METHOD_REVISION_UNKNOWN: rows => { const c = JSON.parse(rows[0].criteriaSnapshot); delete c.methodRevision; rows[0].criteriaSnapshot = JSON.stringify(c); },
        UNIT_UNKNOWN: rows => { const c = JSON.parse(rows[0].criteriaSnapshot); c.analysisUnit = null; rows[0].criteriaSnapshot = JSON.stringify(c); },
        REVISION_SPLIT: rows => { const c = JSON.parse(rows[0].criteriaSnapshot); c.methodRevision.version++; rows[0].criteriaSnapshot = JSON.stringify(c); },
        UNIT_SPLIT: rows => { const c = JSON.parse(rows[0].criteriaSnapshot); c.analysisUnit = 'another-frozen-unit'; rows[0].criteriaSnapshot = JSON.stringify(c); },
        UNIT_CONFLICT: rows => { const c = JSON.parse(rows[0].criteriaSnapshot); delete c.analysisUnit; c.controlCharts = ['a', 'b'].map(analysisUnit => ({ referenceSnapshot: { methodologyId: f.method.id, analysisUnit } })); rows[0].criteriaSnapshot = JSON.stringify(c); }
    };
    const before = await f.snapshot();
    for (const [code, mutate] of Object.entries(cases)) {
        const view = await f.view(f.series(), overlay(f.db, rows => { mutate(rows); return rows; }));
        expect(view.excludedCounts[code]).toBeGreaterThan(0);
        expect(view.points.length).toBeLessThan(20);
    }
    expect(await f.snapshot()).toEqual(before);
});

test('first start freezes the analysis unit; new revision/unit creates an independent series and HTTP routes enforce role/lab scope', async () => {
    const f = await fixture(); await f.run();
    const criteria = JSON.parse((await f.db.batchAnalyte.findFirst()).criteriaSnapshot); expect(criteria.analysisUnit).toBe('fixture-unit');
    await f.db.methodology.update({ where: { id: f.method.id }, data: { version: 2 } });
    await f.db.unit.create({ data: { code: 'new-unit', display: 'New', quantityKind: 'MASS_FRACTION', factorToBase: 1 } });
    await f.db.analysis.update({ where: { code: f.analysisCode }, data: { unitCode: 'new-unit' } });
    await f.run(); const options = await service.listSeries(f.db, f.actor, { labId: f.labId });
    expect(options.series.map(row => [row.methodRevision, row.analysisUnit])).toEqual([[1, 'fixture-unit'], [2, 'new-unit']]);
    expect((await f.view()).points).toHaveLength(20); expect((await f.view()).excludedCounts.REVISION_SPLIT).toBe(20);
    await expect(f.view(f.series(), f.db, { ...f.actor, role: 'LAB_MANAGER', labId: 'other' })).rejects.toMatchObject({ statusCode: 403 });
    await expect(service.propose(f.db, { ...f.actor, role: 'LAB_TECHNICIAN' }, {})).rejects.toMatchObject({ statusCode: 403 });
    await withQcRunHttp(f.db, f.actor, async (app, token) => {
        expect((await request(app).get('/api/qc/blank-history/series')).status).toBe(401);
        const response = await request(app).get('/api/qc/blank-history').query(f.series()).set('Authorization', 'Bearer ' + token);
        expect(response.status).toBe(200); expect(response.body.points).toHaveLength(20);
        const invalid = await request(app).post('/api/qc/lod-loq-proposals').send({ ...f.series() }).set('Authorization', 'Bearer ' + token);
        expect(invalid.status).toBe(400); expect(invalid.body.code).toBe('LOD_LOQ_PROPOSAL_INVALID');
        const ambiguousLab = await request(app).get('/api/qc/blank-history/series?labId=a&labId=b').set('Authorization', 'Bearer ' + token);
        expect(ambiguousLab.status).toBe(400); expect(ambiguousLab.body.code).toBe('LOD_LOQ_SERIES_INVALID');
    });
});

test('a constant blank distribution cannot create a zero-SD proposal or any automatic methodology write', async () => {
    const f = await fixture(); await f.run({ readings: values.map(() => 0.01) });
    const before = await f.snapshot();
    await expect(f.proposal(await f.view())).rejects.toMatchObject({ statusCode: 422, code: 'LOD_LOQ_SD_INVALID' });
    expect(await f.snapshot()).toEqual(before);
});
