const request = require('supertest');
const { qcGateFixture } = require('../helpers/qcGateFixture');
const { withQcRunHttp } = require('../helpers/qcRunHttpHarness');
const owned = [];
afterEach(async () => { for (const f of owned.splice(0)) await f.close(); });
async function fixture(count = 1) {
    const f = await qcGateFixture({ count, criteria: { blankPerBatch: 0, lrmPerBatch: 0, duplicateEvery: 0, crmEveryNBatches: 0, ccvEvery: 0 } });
    owned.push(f); f.rows = []; f.submissions = [];
    for (const item of f.items) {
        f.rows.push(await f.result(item));
        await require('../../services/workItemStateService').transitionWorkItem(item.id, 'COMPLETED', f.actor, 'Recorded owned selection test', {}, f.db);
        f.submissions.push(await require('../../services/submissionStateService').createSubmissionForItems({ db: f.db, actor: f.actor,
            sampleId: item.sampleId, type: 'FULL', workItemIds: [item.id] }));
    }
    f.http = async (path, body) => {
        let response; await withQcRunHttp(f.db, f.actor, async (app, token) => {
            response = await request(app).post(path).set('Authorization','Bearer '+token).send(body);
        }, { reviews: true }); return response;
    };
    f.all = async () => JSON.stringify({ retained: await f.snapshot(), attempts: await f.db.workAttempt.findMany({ orderBy: { id: 'asc' } }),
        selections: await f.db.reportedValueSelection.findMany({ orderBy: { id: 'asc' } }) });
    return f;
}

test('actual scalar acceptance with no r atomically saves AUTO_SINGLE after ACCEPTED and is immediately fresh', async () => {
    const f = await fixture(), response = await f.http('/api/work/'+f.items[0].id+'/review', { decision: 'ACCEPT' });
    expect({ status: response.status, body: response.body }).toMatchObject({ status: 200 });
    expect(await f.db.workAttempt.findUnique({ where: { id: f.rows[0].attemptId } })).toMatchObject({ status: 'ACCEPTED' });
    const selections = await f.db.reportedValueSelection.findMany(); expect(selections).toHaveLength(1);
    expect(selections[0]).toMatchObject({ rule: 'AUTO_SINGLE', valueText: f.rows[0].value });
    expect(JSON.parse(selections[0].lineageSnapshot).attempts).toContainEqual({ id: f.rows[0].attemptId, status: 'ACCEPTED' });
    await expect(require('../../services/workflowStateRules').inTransaction(f.db, tx =>
        require('../../services/reportedValueSelectionService').readReportedSelection(tx,f.items[0]))).resolves.toMatchObject({ rows: selections });
});

test('REVIEWER_PICKS without a choice refuses actual acceptance with zero writes, then explicit choice succeeds', async () => {
    const f = await fixture();
    await f.setPolicy([{ key: 'results.reportedValueRule', value: 'REVIEWER_PICKS' }]);
    const before = await f.all(), response = await f.http('/api/work/'+f.items[0].id+'/review', { decision: 'ACCEPT' });
    expect(response.status).toBe(409); expect(response.body.code).toBe('REPORTED_VALUE_SELECTION_REQUIRED');
    expect(await f.all()).toBe(before);
    const chosen = await f.http('/api/work/'+f.items[0].id+'/review', { decision: 'ACCEPT',
        reportedValueSelection: { mode: 'ATTEMPT', attemptIds: [f.rows[0].attemptId] } });
    expect({ status: chosen.status, body: chosen.body }).toMatchObject({ status: 200 });
    expect(await f.db.reportedValueSelection.findFirst()).toMatchObject({ rule: 'REVIEWER', policyRule: 'REVIEWER_PICKS' });
});

test('bulk acceptance refuses only the row without a required choice and preserves that row completely', async () => {
    const f = await fixture(2); await f.setPolicy([{ key: 'results.reportedValueRule', value: 'REVIEWER_PICKS' }]);
    const itemBefore = await f.db.workItem.findUnique({ where: { id: f.items[1].id } }), attemptBefore = await f.db.workAttempt.findUnique({ where: { id: f.rows[1].attemptId } });
    const response = await f.http('/api/work/review/bulk', { workItemIds: f.items.map(row => row.id), status: 'ACCEPTED',
        reportedValueSelections: { [f.items[0].id]: { mode: 'ATTEMPT', attemptIds: [f.rows[0].attemptId] } } });
    expect({ status: response.status, body: response.body }).toMatchObject({ status: 200,
        body: { results: [{ workItemId: f.items[0].id }], errors: [{ workItemId: f.items[1].id, code: 'REPORTED_VALUE_SELECTION_REQUIRED' }] } });
    expect(await f.db.workItem.findUnique({ where: { id: f.items[1].id } })).toEqual(itemBefore);
    expect(await f.db.workAttempt.findUnique({ where: { id: f.rows[1].attemptId } })).toEqual(attemptBefore);
    expect(await f.db.reviewDecision.count({ where: { workItemId: f.items[1].id } })).toBe(0);
    expect(await f.db.reportedValueSelection.count({ where: { workItemId: f.items[1].id } })).toBe(0);
});

test('a SQL refusal after review writes rolls back just that bulk row, including its decision, attempt event and status', async () => {
    const f = await fixture(2), failedItem = f.items[0];
    if (!/^[a-f0-9-]+$/.test(failedItem.id)) throw Error('Owned fault trigger requires a generated UUID.');
    // This additional refusal is confined to the owned new selection table. It
    // never removes or weakens any workflow, analytical or QC guard.
    await f.db.$executeRawUnsafe('CREATE TRIGGER "owned_selection_refusal" BEFORE INSERT ON "ReportedValueSelection" WHEN NEW."workItemId"=\''+
        failedItem.id+'\' BEGIN SELECT RAISE(ABORT, \'REPORTED_VALUE_SELECTION_INVALID\'); END;');
    const before = await f.db.workItem.findUnique({ where: { id: failedItem.id } }), attempt = await f.db.workAttempt.findUnique({ where: { id: f.rows[0].attemptId } });
    const audit = await f.db.auditLog.findMany({ where: { sampleId: failedItem.sampleId }, orderBy: { id: 'asc' } });
    const response = await f.http('/api/work/review/bulk', { workItemIds: f.items.map(row => row.id), status: 'ACCEPTED' });
    expect({ status: response.status, body: response.body }).toMatchObject({ status: 200,
        body: { results: [{ workItemId: f.items[1].id }], errors: [{ workItemId: failedItem.id, code: 'REPORTED_VALUE_SELECTION_INVALID' }] } });
    expect(await f.db.workItem.findUnique({ where: { id: failedItem.id } })).toEqual(before);
    expect(await f.db.workAttempt.findUnique({ where: { id: attempt.id } })).toEqual(attempt);
    expect(await f.db.auditLog.findMany({ where: { sampleId: failedItem.sampleId }, orderBy: { id: 'asc' } })).toEqual(audit);
    expect(await f.db.reviewDecision.count({ where: { workItemId: failedItem.id } })).toBe(0);
    expect(await f.db.reportedValueSelection.count({ where: { workItemId: failedItem.id } })).toBe(0);
});
