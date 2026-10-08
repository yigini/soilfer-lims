const Database = require('better-sqlite3');
const { qcGateFixture } = require('../helpers/qcGateFixture');
const { planInterimRepeatReasons } = require('../../services/workRepeatBackfillPlan');
const owned = [];
afterAll(async () => { for (const fixture of owned) await fixture.close(); });

test('actual interim repeated executions without reasons are listed and preserved with zero planner writes', async () => {
    // These are executions produced by the existing #190 fixture authority,
    // before #191's mandatory-reason installer. No historical factory changes
    // or synthetic reason inferred from WorkItem.reanalysisReason are used.
    const fixture = await qcGateFixture(); owned.push(fixture);
    await fixture.result(fixture.items[0]);
    await fixture.result(fixture.items[0]);
    const before = await fixture.db.workAttempt.findMany({ orderBy: { attemptNo: 'asc' } });
    expect(before.map(row => [row.attemptNo, row.reason])).toEqual([[1, null], [2, null]]);
    const evidenceBefore = await fixture.snapshot();
    const reader = new Database(fixture.file, { readonly: true, fileMustExist: true });
    try {
        const plan = planInterimRepeatReasons(reader);
        expect(plan).toEqual({ reasonNotRecordedCount: 1, reasonNotRecorded: [{
            id: before[1].id, workItemId: fixture.items[0].id, attemptNo: 2,
            status: 'RECORDED', reason: null, description: 'reason not recorded'
        }], backfilledCount: 0, originalReasonFieldsPreserved: true });
        expect(reader.prepare('SELECT total_changes() AS count').get().count).toBe(0);
    } finally { reader.close(); }
    expect(await fixture.db.workAttempt.findMany({ orderBy: { attemptNo: 'asc' } })).toEqual(before);
    expect(await fixture.snapshot()).toEqual(evidenceBefore);
});

test('an unavailable predecessor schema refuses before planning with a stable code and zero writes', () => {
    const empty = new Database(':memory:');
    try {
        expect(() => planInterimRepeatReasons(empty)).toThrow(expect.objectContaining({
            statusCode: 409, code: 'WORK_REPEAT_PREREQUISITE_NOT_INSTALLED'
        }));
        expect(empty.prepare('SELECT total_changes() AS count').get().count).toBe(0);
    } finally { empty.close(); }
});
