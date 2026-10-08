const Database = require('better-sqlite3');
const { qcGateFixture } = require('../helpers/qcGateFixture');
const { planInterimRepeatReasons } = require('../../services/workRepeatBackfillPlan');
const owned = [];
afterAll(async () => { for (const fixture of owned) await fixture.close(); });

test('actual mandatory-reason repeats are excluded from the interim list with zero planner writes', async () => {
    // Historical NULL-reason coverage remains in the genuine pre-191 owned
    // installer rehearsal in audit_3_1_attempt_install. This current fixture
    // runs the full chain and requests its new repeat through the real service.
    const fixture = await qcGateFixture(); owned.push(fixture);
    await require('../../services/workRepeatService').requestRepeat(fixture.db,fixture.items[0].id,fixture.actor,
        {reason:'CONFIRMATION',note:'Explicit current execution repeat'});
    await fixture.result(fixture.items[0]);
    const before = await fixture.db.workAttempt.findMany({ orderBy: { attemptNo: 'asc' } });
    expect(before.map(row => [row.attemptNo, row.reason])).toEqual([[1, null], [2, 'CONFIRMATION']]);
    const evidenceBefore = await fixture.snapshot();
    const reader = new Database(fixture.file, { readonly: true, fileMustExist: true });
    try {
        const plan = planInterimRepeatReasons(reader);
        expect(plan).toEqual({ reasonNotRecordedCount: 0, reasonNotRecorded: [], backfilledCount: 0, originalReasonFieldsPreserved: true });
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
