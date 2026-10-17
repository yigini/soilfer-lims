const { randomUUID } = require('node:crypto');
const request = require('supertest');
const { qcGateFixture } = require('../helpers/qcGateFixture');
const { withQcRunHttp } = require('../helpers/qcRunHttpHarness');
const { createSampleFixture, createWorkItemFixture } = require('../helpers/workflowFixtures');
const { buildNativeRun, startNativeRun } = require('../../services/qcNativeRunService');
const { writeNativeMeasurements } = require('../../services/qcNativeMeasurementService');
const { reopenNativeRun } = require('../../services/qcNativeLifecycleService');
const { getQaDashboard } = require('../../services/qaDashboardService');
const { requestRepeat } = require('../../services/workRepeatService');
const DAY = 86400000, NOW = new Date('2031-01-01T12:00:00Z');
const ago = days => new Date(NOW.getTime() - days * DAY);
const owned = [];
async function sources(f) {
    return JSON.parse(JSON.stringify(await Promise.all([f.snapshot(), ...[
        'workAttempt', 'nonconformityReport', 'referenceMaterial', 'inventoryLot', 'equipmentAsset', 'equipmentQualification',
        'equipmentScheduleRule', 'proficiencyRound', 'labPolicy', 'labPolicyOverride'
    ].map(model => f.db[model].findMany({ orderBy: { id: 'asc' } }))])));
}
// Retain the new disposable databases for this local release's evidence.
afterAll(async () => { for (const f of owned) await f.db.$disconnect(); });

async function at(date, exercise) {
    jest.useFakeTimers({ doNotFake: ['hrtime', 'nextTick', 'performance', 'queueMicrotask', 'setImmediate', 'clearImmediate', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
    jest.setSystemTime(date);
    try { return await exercise(); } finally { jest.useRealTimers(); }
}
async function fixture() {
    const f = await qcGateFixture({ criteria: { blankPerBatch: 1, lrmPerBatch: 0, duplicateEvery: 0, crmEveryNBatches: 0 } });
    owned.push(f);
    f.view = (query = {}, actor = f.actor) => getQaDashboard(actor, { labId: f.labId, ...query }, { db: f.db, now: NOW });
    f.run = (date, value = 0) => at(date, async () => {
        const sample = await createSampleFixture(f.db, { data: { id: randomUUID(), originalId: randomUUID(), assignedLab: f.labId,
            status: 'PROCESSING', dryingStatus: 'DONE', preparationStatus: 'DONE' } });
        const item = await createWorkItemFixture(f.db, { data: { id: randomUUID(), sampleId: sample.id, labId: f.labId,
            analysis: f.analysisCode, methodologyId: f.method.id, status: 'IN_PROGRESS' } });
        const built = await buildNativeRun(f.db, f.actor, { instrumentId: f.instrument.id, workItemIds: [item.id], seed: randomUUID() });
        const run = await startNativeRun(f.db, built.id, f.actor);
        return value === null ? run : writeNativeMeasurements(f.db, run.id, f.actor, {
            measurements: [{ positionId: run.positions.find(row => row.kind === 'BLANK').id, value }] });
    });
    return f;
}

test('rates reconcile with actual current normalized evaluations, retaining failed deviations and exposing exclusions', async () => {
    const f = await fixture();
    const failing = await f.run(ago(10), 1), passing = await f.run(ago(20));
    await f.run(ago(30)); // Inclusive lower boundary.
    await f.run(ago(40), 1); // Outside 30 days, inside 90.
    await f.run(ago(91), 1); // Outside both windows.
    const pending = await f.run(ago(5), null);
    await at(ago(4), () => writeNativeMeasurements(f.db, pending.id, f.actor, {}));
    const reopened = await f.run(ago(15));
    await at(ago(3), () => reopenNativeRun(f.db, reopened.id, f.actor, 'Documented retest of accepted QC'));
    await at(ago(2), () => require('../../services/qcDispositionStateService').dispositionBatch(
        failing.id, 'ACCEPT_WITH_DEVIATION', 'Reviewed retained failure', f.actor, f.db));
    const source = await f.db.qcEvaluation.findMany({ where: { batch: { labId: f.labId } } });
    expect(source.filter(row => row.batchId === failing.id)[0].verdict).toBe('FAIL');
    const before = await f.snapshot(), view = await f.view();
    expect(view.qcFailures).toEqual([{ analysisCode: f.analysisCode, evaluated: 3, failed: 1, notEvaluable: 2, undated: 1, rate: 1 / 3 }]);
    const wide = await f.view({ days: '90' });
    expect(wide.qcFailures[0]).toMatchObject({ evaluated: 4, failed: 2, notEvaluable: 2, rate: 0.5 });
    expect(view.awaitingDisposition).toBe(2); // The undispositioned 40/91-day failures remain operational work.
    expect(await f.snapshot()).toEqual(before);
    expect(passing.evaluations).toHaveLength(1);
});

test('the latest evaluation is selected before its window; superseded and reopened values cannot inflate the denominator', async () => {
    const f = await fixture(), run = await f.run(ago(40));
    await at(ago(10), async () => {
        await reopenNativeRun(f.db, run.id, f.actor, 'Correct recorded blank reading');
        await writeNativeMeasurements(f.db, run.id, f.actor, { reason: 'Correct worksheet transcription',
            corrections: [{ positionId: run.positions.find(row => row.kind === 'BLANK').id, value: 1 }] }, { correction: true });
    });
    const rows = await f.db.qcEvaluation.findMany({ where: { batchId: run.id }, orderBy: { version: 'asc' } });
    expect(rows.map(row => row.verdict)).toEqual(['PASS', 'FAIL']);
    for (const days of ['30', '90']) expect((await f.view({ days })).qcFailures[0]).toMatchObject({ evaluated: 1, failed: 1, rate: 1 });
    // A later snapshot cannot resurrect the old in-window version.
    const later = await getQaDashboard(f.actor, { labId: f.labId, days: 30 }, { db: f.db, now: new Date(NOW.getTime() + 31 * DAY) });
    expect(later.qcFailures).toEqual([]);
});

test('repeat rates count execution owners, open child requests and retained attribution, never requester or replicate rows', async () => {
    const f = await fixture(), manager = { id: randomUUID(), username: 'qa-requester-' + randomUUID(), role: 'LAB_MANAGER', labId: f.labId };
    await f.db.user.create({ data: { ...manager, email: manager.username + '@example.test', password: 'fixture' } });
    const rows = await at(ago(20), () => require('../../services/workflowStateRules').inTransaction(f.db, tx =>
        require('../../services/resultWriteService').writeResultsExecution(tx, { sampleId: f.items[0].sampleId,
            workItemId: f.items[0].id, actor: f.actor, measurements: [1, 2].map(replicateNo => ({ param: f.analysisCode,
                value: '7', equipmentId: f.instrument.id, replicateNo })) })));
    expect(rows[0].attemptId).toBe(rows[1].attemptId);
    await at(ago(18), () => require('../../services/workAttemptCorrectionService').correctAttempt(f.db, rows[0].attemptId, manager,
        { resultId: rows[0].id, value: '7.01', reason: 'TRANSCRIPTION_ERROR', note: 'Synthetic same-execution correction' }));
    expect((await f.view()).repeats).toMatchObject({ executions: 1, repeated: 0 });
    await at(ago(10), () => requestRepeat(f.db, f.items[0].id, manager, { reason: 'PREP_ERROR' }));
    const before = await f.snapshot(), first = (await f.view()).repeats;
    expect(first).toMatchObject({ executions: 1, repeated: 1, rate: 1,
        byReason: [{ reason: 'PREP_ERROR', executions: 1, repeated: 1, rate: 1 }],
        byAnalystMethod: [{ analyst: 'system:fixture', methodologyId: f.method.id, methodRevision: '1', executions: 1, repeated: 1, rate: 1 }] });
    expect(await f.snapshot()).toEqual(before);
    await at(ago(8), () => require('../../services/workflowStateRules').inTransaction(f.db, tx =>
        require('../../services/resultWriteService').writeResultsExecution(tx, { sampleId: f.items[0].sampleId,
            workItemId: f.items[0].id, actor: f.actor, measurements: [1, 2].map(replicateNo => ({ param: f.analysisCode,
                value: '7', equipmentId: f.instrument.id, replicateNo })) })));
    await at(ago(7), () => requestRepeat(f.db, f.items[0].id, manager, { reason: 'INSTRUMENT_FAULT' }));
    const next = (await f.view()).repeats;
    expect(next).toMatchObject({ executions: 2, repeated: 2, rate: 1 });
    expect(next.byReason).toEqual(expect.arrayContaining([
        { reason: 'PREP_ERROR', executions: 2, repeated: 1, rate: 0.5 },
        { reason: 'INSTRUMENT_FAULT', executions: 2, repeated: 1, rate: 0.5 }
    ]));
    expect(next.byAnalystMethod.every(row => row.analyst !== manager.username)).toBe(true);
    const oldWindow = await getQaDashboard(f.actor, { labId: f.labId }, { db: f.db, now: ago(15) });
    expect(oldWindow.repeats).toMatchObject({ executions: 1, repeated: 0, rate: 0 });
});

test('lab-scoped operational rows reconcile across NCR, effective inventory expiry, calibration and stored PT scores without writes', async () => {
    const f = await fixture(), other = await f.db.lab.create({ data: { id: randomUUID(), code: randomUUID(), name: 'Other lab', country: 'OTHER' } });
    for (const labId of [f.labId, other.id]) {
        for (const status of ['OPEN', 'ACTION', 'CLOSED']) {
            const ncr = require('../../services/nonconformityService');
            const { report } = await require('../../services/workflowStateRules').inTransaction(f.db, tx => ncr.raise(tx, f.actor, {
                labId, source: 'OTHER', refType: 'Fixture', refId: randomUUID(), description: 'Synthetic dashboard NCR' }));
            if (status !== 'OPEN') await ncr.transition(f.db, report.id, f.actor, { status: 'ACTION', impactAssessment: 'Synthetic assessment' });
            if (status === 'CLOSED') await ncr.transition(f.db, report.id, f.actor, { status: 'CLOSED', correctiveAction: 'Synthetic action' });
        }
        for (const offset of [-1, 5, 30, 31]) await f.db.referenceMaterial.create({ data: { id: randomUUID(), labId, code: randomUUID(), name: 'Synthetic RM',
            kind: 'LRM', matrix: 'SOIL', lotNumber: randomUUID(), status: 'ACTIVE', createdBy: f.actor.username,
            expiryDate: new Date(NOW.getTime() + offset * DAY) } });
        const inventory = await f.db.inventoryItem.create({ data: { id: randomUUID(), labId, name: 'RM inventory', itemType: 'CRM', unitOfMeasure: 'g' } });
        const lot = await f.db.inventoryLot.create({ data: { id: randomUUID(), labId, inventoryItemId: inventory.id, lotNumber: randomUUID(),
            expiryDate: new Date(NOW.getTime() + 2 * DAY), initialQuantity: 10, currentQuantity: 10, unitOfMeasure: 'g' } });
        await f.db.referenceMaterial.create({ data: { id: randomUUID(), labId, code: randomUUID(), name: 'Inventory expires first', kind: 'LRM', matrix: 'SOIL',
            lotNumber: lot.lotNumber, inventoryLotId: lot.id, status: 'ACTIVE', createdBy: f.actor.username, expiryDate: new Date(NOW.getTime() + 50 * DAY) } });
        for (const offset of [-1, 3, 50]) await f.db.equipmentAsset.create({ data: { id: randomUUID(), labId, name: 'Calibration fixture',
            assetType: 'OTHER', status: 'IN_SERVICE', criticality: 'NON_CRITICAL',
            scheduleRules: { create: { id: randomUUID(), labId, scheduleType: 'CALIBRATION', dueSoonDays: 7 } },
            qualification: { create: { id: randomUUID(), labId, calibrationStatus: 'OK', verificationStatus: 'OK', lastUpdatedBy: f.actor.username,
                nextCalibrationDueDate: new Date(NOW.getTime() + offset * DAY) } } } });
        for (const offset of [5, 20, 40, 91]) await require('../../services/proficiencyRoundService').record(f.actor, { labId, provider: 'Synthetic provider',
            roundRef: randomUUID(), analysisCode: f.analysisCode, assignedValue: 10, labResult: 11.23456789, uncertainty: 1, date: ago(offset) }, { db: f.db });
        const pt = require('../../services/proficiencyRoundService');
        const withdrawn = await pt.record(f.actor, { labId, provider: 'Synthetic provider', roundRef: randomUUID(), analysisCode: f.analysisCode,
            assignedValue: 10, labResult: 10, uncertainty: 1, date: ago(3) }, { db: f.db });
        await pt.softDelete(f.actor, withdrawn.id, 'Synthetic withdrawal retained for the dashboard exclusion contract', { db: f.db });
    }
    const before = await sources(f), view = await f.view();
    expect(view.openNcrs).toBe(await f.db.nonconformityReport.count({ where: { labId: f.labId, status: { in: ['OPEN', 'ACTION'] } } }));
    expect(view.openNcrs).toBe(2); expect(view.expiringMaterials).toHaveLength(3);
    expect(view.expiringMaterials.find(row => row.name === 'Inventory expires first').expiresAt).toEqual(new Date(NOW.getTime() + 2 * DAY));
    expect(view.calibrationDue.map(row => row.status)).toEqual(['OVERDUE', 'DUE_SOON']);
    expect(view.ptResults).toHaveLength(2);
    expect(view.ptResults[0].zScore).toBe((await f.db.proficiencyRound.findUnique({ where: { id: view.ptResults[0].id } })).zScore);
    expect(view.ptResults.map(row => row.date)).toEqual([ago(20), ago(5)]);
    expect((await f.view({ days: 90 })).ptResults).toHaveLength(3);
    expect(await sources(f)).toEqual(before);
    const selected = await f.view({ labId: other.id }); expect(selected.lab.id).toBe(other.id);
    expect(selected.qcFailures).toEqual([]); expect(selected.repeats.executions).toBe(0);
});

test('scope and role checks fail closed and route errors retain stable 4xx codes', async () => {
    const f = await fixture(), lab = await f.db.lab.findUnique({ where: { id: f.labId } });
    const audit = { ...f.actor, role: 'AUDIT_USER', labId: lab.code };
    expect((await f.view({}, audit)).laboratories.map(row => row.id)).toEqual([f.labId]);
    await expect(f.view({ labId: 'unassigned-lab' }, audit)).rejects.toMatchObject({ statusCode: 403, code: 'QA_DASHBOARD_SCOPE_DENIED' });
    await expect(f.view({}, { ...audit, labId: null })).rejects.toMatchObject({ statusCode: 403 });
    await expect(f.view({}, { ...audit, role: 'LAB_TECHNICIAN' })).rejects.toMatchObject({ statusCode: 403, code: 'QA_DASHBOARD_FORBIDDEN' });
    for (const days of ['0', '30.0', '31', '365', ['30', '90']]) await expect(f.view({ days })).rejects.toMatchObject({ statusCode: 400, code: 'QA_DASHBOARD_WINDOW_INVALID' });
    await withQcRunHttp(f.db, f.actor, async (app, token) => {
        app.use('/api/dashboard', require('../../routes/dashboardRoutes'));
        expect((await request(app).get('/api/dashboard/qa')).status).toBe(401);
        const response = await request(app).get('/api/dashboard/qa').query({ labId: f.labId }).set('Authorization', 'Bearer ' + token);
        expect(response.status).toBe(200); expect(response.body.lab.id).toBe(f.labId);
        expect(response.body.qcFailures).toEqual([]); expect(response.body.repeats.rate).toBeNull();
        const invalid = await request(app).get('/api/dashboard/qa').query({ days: 31 }).set('Authorization', 'Bearer ' + token);
        expect(invalid.status).toBe(400); expect(invalid.body.code).toBe('QA_DASHBOARD_WINDOW_INVALID');
    });
});
