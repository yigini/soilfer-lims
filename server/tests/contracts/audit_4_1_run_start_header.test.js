const { randomUUID } = require('node:crypto');
const request = require('supertest');
const { qcGateFixture } = require('../helpers/qcGateFixture');
const { createSampleFixture, createWorkItemFixture } = require('../helpers/workflowFixtures');
const { withQcRunHttp } = require('../helpers/qcRunHttpHarness');
const { buildNativeRun, startNativeRun } = require('../../services/qcNativeRunService');
const { startWorkbenchRun, runOptions } = require('../../services/workbenchRunService');
const { apiRunView } = require('../../services/qcRunApiViewService');
const { readQcRun } = require('../../services/qcRunViewService');
const { writeResult } = require('../../services/resultWriteService');
const { writeNativeMeasurements } = require('../../services/qcNativeMeasurementService');
const { reopenNativeRun } = require('../../services/qcNativeLifecycleService');
const owned = [];
async function fixture(count = 1) {
    const f = await qcGateFixture({ count, criteria: { maxBatchSize: 40, blankPerBatch: 1, lrmPerBatch: 0, duplicateEvery: 0, crmEveryNBatches: 0 } });
    owned.push(f);
    await f.db.methodology.update({ where: { id: f.method.id }, data: { version: 7, standard: 'Owned method standard' } });
    await f.db.labMethodDefault.create({ data: { labId: f.labId, analysisCode: f.analysisCode, methodologyId: f.method.id } });
    await f.db.equipmentQualification.create({ data: { id: randomUUID(), equipmentId: f.instrument.id, labId: f.labId,
        calibrationStatus: 'OK', verificationStatus: 'OK', nextCalibrationDueDate: new Date('2099-01-01') } });
    await f.db.equipmentMethodEligibility.create({ data: { id: randomUUID(), labId: f.labId, analysisCode: f.analysisCode,
        methodId: f.method.id, isRequired: true, eligibleEquipmentIds: JSON.stringify([f.instrument.id]) } });
    for (const sampleId of new Set(f.items.map(item => item.sampleId))) for (const analysis of ['DRYING', 'PREPARATION']) {
        await createWorkItemFixture(f.db, { data: { id: randomUUID(), sampleId, labId: f.labId, analysis, status: 'COMPLETED', history: '[]' } });
    }
    f.startInput = { labId: f.labId, analysisCode: f.analysisCode, instrumentId: f.instrument.id, workItemIds: f.workItemIds };
    return f;
}
async function snapshot(f) { return JSON.parse(JSON.stringify(await Promise.all([f.snapshot(), f.db.batch.findMany({ orderBy: { id: 'asc' } }),
    f.db.batchAnalyte.findMany({ orderBy: { id: 'asc' } }), f.db.batchPosition.findMany({ orderBy: { id: 'asc' } }), f.db.workAttempt.findMany({ orderBy: { id: 'asc' } })]))); }
afterEach(async () => { for (const f of owned.splice(0)) await f.close(); });

test('40 policy-permitted samples start atomically with the LabMethodDefault and every committed Result retains its run instrument', async () => {
    const f = await fixture(40);
    const options = await runOptions(f.db, f.actor, { labId: f.labId, analysisCode: f.analysisCode });
    expect(options).toMatchObject({ defaultMethodologyId: f.method.id, methodologyId: f.method.id, maxBatchSize: 40, equipmentRequired: true });
    expect(options.eligibleEquipment.map(row => row.id)).toEqual([f.instrument.id]);
    let batch;
    await withQcRunHttp(f.db, f.actor, async (app, token) => {
        const response = await request(app).post('/api/qc/runs/start').set('Authorization', `Bearer ${token}`).send(f.startInput);
        expect(response.status).toBe(201); batch = response.body.batch;
    });
    expect(batch).toMatchObject({ instrumentId: f.instrument.id, analystUsername: f.actor.username, status: 'RUNNING' });
    expect(batch.workItemIds).toHaveLength(40);
    const revision = { methodologyId: f.method.id, name: f.method.name, standard: 'Owned method standard', version: 7 };
    expect(JSON.parse(batch.analytes[0].criteriaSnapshot).methodRevision).toEqual(revision);
    const started = await f.db.batchEvent.findFirst({ where: { batchId: batch.id, type: 'RUN_STARTED' } });
    expect(JSON.parse(started.payload)).toMatchObject({ methodRevision: revision, methodRevisions: [{ analysisCode: f.analysisCode, methodRevision: revision }] });
    const blank = batch.positions.find(row => row.kind === 'BLANK');
    await writeNativeMeasurements(f.db, batch.id, f.actor, { measurements: [{ positionId: blank.id, value: 0.01 }] });
    for (const item of f.items) {
        const result = await f.db.$transaction(tx => writeResult(tx, { sampleId: item.sampleId, actor: f.actor,
            measurement: { param: item.analysis, value: '7.1', equipmentId: batch.instrumentId } }));
        expect(result).toMatchObject({ batchId: batch.id, equipmentId: batch.instrumentId });
        expect(await f.db.workAttempt.findUnique({ where: { id: result.attemptId } })).toMatchObject({ instrumentId: batch.instrumentId, qcBatchId: batch.id });
    }
    expect(await f.db.result.count({ where: { batchId: batch.id, equipmentId: batch.instrumentId } })).toBe(40);
}, 60000);
test.each(['ineligible', 'overdue', 'method-mismatch', 'held', 'capacity', 'curve'])('%s start refuses with a stable 4xx and rolls back every run/membership/audit row', async kind => {
    const f = await fixture(kind === 'capacity' ? 2 : 1); let input = { ...f.startInput }, code;
    if (kind === 'ineligible') { input.instrumentId = 'unregistered'; code = 'INSTRUMENT_NOT_ELIGIBLE'; }
    if (kind === 'overdue') {
        await f.db.equipmentQualification.update({ where: { equipmentId: f.instrument.id }, data: { nextCalibrationDueDate: new Date('2000-01-01') } }); code = 'INSTRUMENT_NOT_ELIGIBLE';
    }
    if (kind === 'method-mismatch') {
        input.methodologyId = (await f.db.methodology.create({ data: { analysisCode: f.analysisCode, name: 'Different recorded method' } })).id;
        await f.db.equipmentMethodEligibility.create({ data: { id: randomUUID(), labId: f.labId, analysisCode: f.analysisCode, methodId: input.methodologyId,
            isRequired: true, eligibleEquipmentIds: JSON.stringify([f.instrument.id]) } }); code = 'QC_BATCH_METHOD_AMBIGUOUS';
    }
    if (kind === 'held') {
        await f.db.$transaction(tx => require('../../services/sampleHoldService').raiseHold(tx,
            { sampleId: f.items[0].sampleId, actor: f.actor, type: 'OTHER', reason: 'Explicit held-run refusal' })); code = 'QC_RUN_NOT_READY';
    }
    if (kind === 'capacity') {
        await require('../../services/qcRuleService').change(f.actor, { labId: f.labId, analysisCode: f.analysisCode, methodologyId: f.method.id,
            criteria: { maxBatchSize: 1 }, expectedVersion: 1, reason: 'Explicit reduced-capacity fixture' }, { db: f.db }); code = 'QC_BATCH_TOO_LARGE';
    }
    if (kind === 'curve') { input.calibrationCurve = { fabricated: true }; code = 'QC_RUN_INPUT_INVALID'; }
    const before = await snapshot(f);
    await expect(startWorkbenchRun(f.db, f.actor, input)).rejects.toMatchObject({ code, statusCode: expect.any(Number) });
    expect(await snapshot(f)).toEqual(before);
});
test('first-start revision remains frozen after Methodology changes/reopen; old missing snapshots remain unknown and QC ignores the new key', async () => {
    const f = await fixture();
    const batch = await startWorkbenchRun(f.db, f.actor, f.startInput);
    const originalCriteria = batch.analytes[0].criteriaSnapshot, blank = batch.positions.find(row => row.kind === 'BLANK');
    await writeNativeMeasurements(f.db, batch.id, f.actor, { measurements: [{ positionId: blank.id, value: 0.01 }] });
    const beforeView = await apiRunView(f.db, await readQcRun(f.db, batch.id, f.actor), { detail: true });
    await f.db.methodology.update({ where: { id: f.method.id }, data: { version: 8, name: 'Later method name', standard: 'Later standard' } });
    const view = await apiRunView(f.db, await readQcRun(f.db, batch.id, f.actor), { detail: true });
    expect(view.analytes[0]).toMatchObject({ methodRevisionSource: 'FROZEN', methodRevision: { name: f.method.name, version: 7, standard: 'Owned method standard' } });
    expect(view.analytes[0].qcResults).toEqual(beforeView.analytes[0].qcResults);
    // Exercise a historical reader shape, without altering retained database evidence.
    const legacy = { ...await readQcRun(f.db, batch.id, f.actor), analytes: view.analytes.map(row => {
        const criteria = JSON.parse(row.criteriaSnapshot); delete criteria.methodRevision;
        return { ...row, criteriaSnapshot: JSON.stringify(criteria) };
    }) };
    const unknown = await apiRunView(f.db, legacy, { detail: true });
    expect(unknown.analytes[0]).toMatchObject({ methodRevision: null, methodRevisionSource: 'UNKNOWN' });
    expect(unknown.analytes[0].qcResults).toEqual(view.analytes[0].qcResults);
    await reopenNativeRun(f.db, batch.id, f.actor, 'Resume with the recorded revision');
    expect((await readQcRun(f.db, batch.id, f.actor)).analytes[0].criteriaSnapshot).toBe(originalCriteria);
});
test('My runs ownership is applied on the server; All runs retains existing lab visibility and both exclude foreign labs', async () => {
    const f = await fixture(4);
    const other = await f.db.user.create({ data: { id: randomUUID(), username: `other-${randomUUID()}`, email: `${randomUUID()}@example.test`, password: 'fixture', role: 'SUPER_ADMIN', labId: f.labId } });
    const ids = [];
    for (let index = 0; index < 4; index++) {
        const actor = index < 2 ? f.actor : other;
        let batch = await buildNativeRun(f.db, actor, { ...f.input, workItemIds: [f.items[index].id] });
        if (index % 2 === 0) batch = await startNativeRun(f.db, batch.id, actor);
        ids.push(batch.id);
    }
    const foreignLab = randomUUID(); await f.db.lab.create({ data: { id: foreignLab, code: foreignLab, name: 'Foreign run fixture', country: 'TEST' } });
    const sample = await createSampleFixture(f.db, { data: { id: randomUUID(), originalId: randomUUID(), assignedLab: foreignLab, status: 'PROCESSING', dryingStatus: 'DONE', preparationStatus: 'DONE' } });
    const item = await createWorkItemFixture(f.db, { data: { id: randomUUID(), sampleId: sample.id, labId: foreignLab, analysis: f.analysisCode, methodologyId: f.method.id, status: 'IN_PROGRESS' } });
    const foreign = await buildNativeRun(f.db, other, { labId: foreignLab, workItemIds: [item.id] });
    await f.db.user.update({ where: { username: f.actor.username }, data: { role: 'LAB_MANAGER', labId: f.labId } });
    await withQcRunHttp(f.db, { ...f.actor, role: 'LAB_MANAGER' }, async (app, token) => {
        const auth = { Authorization: `Bearer ${token}` };
        const mine = await request(app).get('/api/qc/batches?view=my_runs').set(auth);
        const all = await request(app).get('/api/qc/batches?view=all_runs').set(auth);
        const old = await request(app).get('/api/qc/batches').set(auth);
        expect(mine.status).toBe(200); expect(all.status).toBe(200); expect(old.status).toBe(200);
        expect(mine.body.data.map(row => row.id).sort()).toEqual(ids.slice(0, 2).sort());
        expect(all.body.data.map(row => row.id).sort()).toEqual(ids.sort());
        expect(all.body.data).toEqual(old.body.data);
        expect([...mine.body.data, ...all.body.data].some(row => row.id === foreign.id)).toBe(false);
        expect((await request(app).get(`/api/qc/batches/${foreign.id}`).set(auth)).status).toBe(403);
        expect((await request(app).get('/api/qc/batches?view=anything').set(auth)).body.code).toBe('QC_RUN_FILTER_INVALID');
    });
});
