const { randomUUID } = require('node:crypto');
const Database = require('better-sqlite3');
const { qcGateFixture } = require('../helpers/qcGateFixture');
const { createWorkItemFixture } = require('../helpers/workflowFixtures');
const { createExecutionResultFixture } = require('../helpers/workAttemptFixtures');
const rules = require('../../services/workflowStateRules');
const { recordSubmissionCrossChecks: record, reviewCrossChecks: review } = require('../../services/crossCheckEvaluationService');
const { createSubmissionForItems } = require('../../services/submissionStateService');
const { transitionWorkItem } = require('../../services/workItemStateService');
const { replaceReportedSelection } = require('../../services/reportedValueSelectionService');
const owned = [];
afterEach(async () => { for (const f of owned.splice(0)) await f.close(); });
async function fixture({ differentText = false } = {}) {
    const criteria = { blankPerBatch: 0, lrmPerBatch: 0, duplicateEvery: 0, crmEveryNBatches: 0, ccvEvery: 0 };
    const f = await qcGateFixture({ criteria }); owned.push(f);
    require('../../scripts/install_cross_check_evaluations').installCrossCheckEvaluations({ dbPath: f.file, apply: true });
    f.sampleId = f.items[0].sampleId; f.rows = [await f.result(f.items[0])];
    const unit = require('../../seeds/units').UNITS.find(row => row.code === 'cmol(+)/kg');
    await f.db.unit.create({ data: unit });
    for (const [param, value] of [['EXCH_CA', 8], ['EXCH_MG', 3], ['EXCH_K', 1], ['EXCH_NA', 1], ['CEC', 10]]) {
        await f.db.analysis.create({ data: { code: param, name: param, units: unit.code, unitCode: unit.code } });
        const method = await f.db.methodology.create({ data: { analysisCode: param, name: 'Owned cross-check method', loq: 0 } });
        await require('../../services/qcRuleService').change(f.actor, { labId: f.labId, analysisCode: param,
            methodologyId: method.id, criteria, expectedVersion: 0, reason: 'Owned non-QC cross-check test' }, { db: f.db });
        const item = await createWorkItemFixture(f.db, { data: { id: randomUUID(), sampleId: f.sampleId,
            assignedLab: f.labId, analysis: param, methodologyId: method.id, status: 'IN_PROGRESS' } });
        f.items.push(item);
        f.rows.push(await createExecutionResultFixture(f.db, { data: { id: randomUUID(), sampleId: f.sampleId,
            param, methodologyId: method.id, value: differentText ? 'original text ' + value : String(value), numericValue: value, unit: unit.code,
            basis: 'AIR_DRY', censoring: 'NONE', flags: '["RETAINED_QC_FLAG"]', isCurrent: true } }));
    }
    for (const item of f.items) await transitionWorkItem(item.id, 'COMPLETED', f.actor, 'Owned recorded determination', {}, f.db);
    f.submit = () => rules.inTransaction(f.db, async tx => {
        const submission = await createSubmissionForItems({ db: tx, actor: f.actor, sampleId: f.sampleId,
            type: 'FULL', workItemIds: f.items.map(item => item.id) });
        return { ...submission, evaluations: await record(tx, f.sampleId, f.actor) };
    });
    f.snapshotAll = async () => JSON.stringify({ sample: await f.db.sample.findUnique({ where: { id: f.sampleId } }),
        items: await f.db.workItem.findMany({ orderBy: { id: 'asc' } }), results: await f.db.result.findMany({ orderBy: { id: 'asc' } }),
        attempts: await f.db.workAttempt.findMany({ orderBy: { id: 'asc' } }),
        submissions: await f.db.submission.findMany({ orderBy: { id: 'asc' } }), audits: await f.db.auditLog.findMany({ orderBy: { id: 'asc' } }),
        evaluations: await f.db.crossCheckEvaluation.findMany({ orderBy: { id: 'asc' } }), selections: await f.db.reportedValueSelection.findMany({ orderBy: { id: 'asc' } }) });
    return f;
}
async function acceptAll(f) {
    await require('../helpers/qcRunHttpHarness').withQcRunHttp(f.db, f.actor, async (app, token) => {
        for (const item of f.items) {
            const response = await require('supertest')(app).post(`/api/work/${item.id}/review`)
                .set('Authorization', 'Bearer ' + token).send({ decision: 'ACCEPT' });
            expect({ status: response.status, body: response.body }).toMatchObject({ status: 200 });
        }
    }, { reviews: true });
}
test('real submission retains all seven numeric-evidence checks and review reads the frozen 1.3 × CEC flag without parsing text', async () => {
    const f = await fixture({ differentText: true }), results = await f.db.result.findMany({ orderBy: { id: 'asc' } }), submitted = await f.submit();
    expect(submitted.sample.status).toBe('SUBMITTED_FULL');
    expect(submitted.evaluations).toHaveLength(7);
    const base = submitted.evaluations.find(row => row.ruleCode === 'BASES_CEC');
    expect(base).toMatchObject({ outcome: 'FLAGGED', flagCode: 'CROSS_CHECK_BASES_GT_CEC', evaluatedBy: f.actor.username,
        labId: f.labId, thresholds: { policyVersion: 0, 'crossCheck.basesCecFactor': 1.1 } });
    expect(base.inputs.values.find(row => row.analysisCode === 'EXCH_CA')).toMatchObject({ value: 8, basis: 'AIR_DRY',
        unit: 'cmol(+)/kg', resultIds: [f.rows.find(row => row.param === 'EXCH_CA').id] });
    expect(await f.db.result.findMany({ orderBy: { id: 'asc' } })).toEqual(results);
    const before = await f.snapshotAll(), panel = await review(f.db, f.sampleId, f.actor);
    expect(panel.current).toBeNull();
    expect(panel.atSubmission.find(row => row.ruleCode === 'BASES_CEC')).toEqual(base);
    expect(await f.snapshotAll()).toBe(before);
    await require('../helpers/qcRunHttpHarness').withQcRunHttp(f.db, f.actor, async (app, token) => {
        const response = await require('supertest')(app).get(`/api/results/${f.sampleId}/cross-checks`)
            .set('Authorization', 'Bearer ' + token);
        expect(response.status).toBe(200);
        expect(response.body.atSubmission.find(row => row.ruleCode === 'BASES_CEC'))
            .toMatchObject({ outcome: 'FLAGGED', flagCode: 'CROSS_CHECK_BASES_GT_CEC' });
    }, { repeatCommands: true });
    expect(await f.snapshotAll()).toBe(before);
});
test('a late evidence insert refusal rolls back the complete submission, attempts, events, Sample and audits', async () => {
    const f = await fixture(), db = new Database(f.file);
    try { db.exec("CREATE TRIGGER Cross_owned_late_refusal BEFORE INSERT ON CrossCheckEvaluation WHEN NEW.ruleCode='BASES_CEC' BEGIN SELECT RAISE(ABORT,'OWNED_LATE_REFUSAL'); END;"); }
    finally { db.close(); }
    const before = await f.snapshotAll();
    await expect(f.submit()).rejects.toMatchObject({ statusCode: 409, code: 'CROSS_CHECK_EVIDENCE_WRITE_FAILED' });
    expect(await f.snapshotAll()).toBe(before);
});
test('cross-check writes require a caller transaction and permission; foreign review reads and writes refuse without changes', async () => {
    const f = await fixture(), before = await f.snapshotAll();
    await expect(record(f.db, f.sampleId, f.actor)).rejects.toMatchObject({ statusCode: 400, code: 'WORKFLOW_TRANSACTION_REQUIRED' });
    await expect(rules.inTransaction(f.db, tx => record(tx, f.sampleId, f.actor)))
        .rejects.toMatchObject({ statusCode: 409, code: 'CROSS_CHECK_SUBMISSION_REQUIRED' });
    const foreign = { username: 'foreign', role: 'LAB_MANAGER', labId: randomUUID() };
    await expect(review(f.db, f.sampleId, foreign)).rejects.toMatchObject({ statusCode: 403 });
    await expect(rules.inTransaction(f.db, tx => record(tx, f.sampleId, foreign))).rejects.toMatchObject({ statusCode: 403 });
    await expect(review(f.db, f.sampleId, { ...f.actor, role: 'LAB_TECHNICIAN' })).rejects.toMatchObject({ code: 'CROSS_CHECK_FORBIDDEN' });
    await expect(rules.inTransaction(f.db, tx => record(tx, f.sampleId, { ...f.actor, role: 'SAMPLE_RECEPTION' })))
        .rejects.toMatchObject({ code: 'CROSS_CHECK_FORBIDDEN' });
    expect(await f.snapshotAll()).toBe(before);
});
test('after selection the live panel uses the real saved selections, supersedes without mixing observations, and preserves submission evidence', async () => {
    const f = await fixture(); await f.submit();
    const old = await f.db.crossCheckEvaluation.findMany({ orderBy: { id: 'asc' } });
    // Real review acceptance creates the selections through #192's authority.
    await acceptAll(f);
    const before = await f.snapshotAll(), panel = await review(f.db, f.sampleId, f.actor);
    expect({ base: panel.current.evaluations.find(row => row.ruleCode === 'BASES_CEC'), errors: panel.selectionErrors })
        .toMatchObject({ base: { outcome: 'FLAGGED' }, errors: [] });
    expect(panel.current.evaluations.find(row => row.ruleCode === 'BASES_CEC').inputs.values.every(row => row.selectionId)).toBe(true);
    expect(await f.snapshotAll()).toBe(before);
    const item = f.items.find(row => row.analysis === 'EXCH_CA'), current = await f.db.reportedValueSelection.findFirst({ where: { workItemId: item.id } });
    await replaceReportedSelection(f.db, item.id, f.actor, { expectedGroupId: current.selectionGroupId,
        selection: { mode: 'NOT_REPORTABLE', reason: 'Reviewer withheld this determination' } });
    const revised = await review(f.db, f.sampleId, f.actor);
    expect(revised.current.evaluations.find(row => row.ruleCode === 'BASES_CEC')).toMatchObject({ outcome: 'NOT_EVALUATED', reasonCode: 'INPUT_NOT_REPORTABLE' });
    expect(await f.db.crossCheckEvaluation.findMany({ orderBy: { id: 'asc' } })).toEqual(old);
    expect(await f.db.reportedValueSelection.findUnique({ where: { id: current.id } })).toEqual(current);
});
test('a later laboratory policy affects only live selected checks; stored submission thresholds and another lab remain fixed', async () => {
    const f = await fixture(), other = await fixture(); await f.submit(); await other.submit();
    const frozen = await f.db.crossCheckEvaluation.findMany();
    await acceptAll(f); await acceptAll(other);
    await f.setPolicy([{ key: 'crossCheck.basesCecFactor', value: 1.4 }]);
    const panel = await review(f.db, f.sampleId, f.actor), otherPanel = await review(other.db, other.sampleId, other.actor);
    expect(panel.current.evaluations.find(row => row.ruleCode === 'BASES_CEC').outcome).toBe('PASS');
    expect(otherPanel.current.evaluations.find(row => row.ruleCode === 'BASES_CEC').outcome).toBe('FLAGGED');
    expect(panel.atSubmission.find(row => row.ruleCode === 'BASES_CEC').outcome).toBe('FLAGGED');
    expect(otherPanel.atSubmission.find(row => row.ruleCode === 'BASES_CEC').thresholds['crossCheck.basesCecFactor']).toBe(1.1);
    expect(await f.db.crossCheckEvaluation.findMany()).toEqual(frozen);
});
