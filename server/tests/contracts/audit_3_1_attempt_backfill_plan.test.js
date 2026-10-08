const Database = require('better-sqlite3');
const { planHistoricalAttempts } = require('../../services/workAttemptBackfillPlan');
const { assertWorkAttemptStatus } = require('../../services/workAttemptContract');
const { parseArguments } = require('../../scripts/plan_work_attempt_backfill');

let db;
beforeEach(() => {
    db = new Database(':memory:');
    db.exec(`CREATE TABLE WorkItem(id TEXT PRIMARY KEY,sampleId TEXT,analysis TEXT,status TEXT);
        CREATE TABLE WorkAttempt(id TEXT PRIMARY KEY,workItemId TEXT,attemptNo INTEGER,status TEXT,
            evidenceData TEXT,evidenceHash TEXT,instrumentId TEXT,qcBatchId TEXT,createdAt TEXT,updatedAt TEXT);
        CREATE TABLE Result(id TEXT PRIMARY KEY,sampleId TEXT,param TEXT,attemptId TEXT,replicateNo INTEGER,isCurrent INTEGER,value TEXT);
        CREATE TABLE AuditLog(id TEXT PRIMARY KEY,detail TEXT);
        INSERT INTO AuditLog VALUES ('retained','scientific audit');`);
});
afterEach(() => db.close());
function item(id, status = 'ACCEPTED', analysis = 'P') {
    db.prepare('INSERT INTO WorkItem VALUES (?,?,?,?)').run(id, id + '-sample', analysis, status);
}
function result(id, workItemId, { attemptId = null, replicateNo = 1, isCurrent = 1 } = {}) {
    db.prepare('INSERT INTO Result VALUES (?,?,?,?,?,?,?)').run(id, workItemId + '-sample', 'P', attemptId, replicateNo, isCurrent, '0.123456789');
}
function attempt(id, workItemId, attemptNo = 1, status = 'RECORDED') {
    db.prepare('INSERT INTO WorkAttempt VALUES (?,?,?,?,?,?,?,?,?,?)').run(id, workItemId, attemptNo, status,
        '{"fractions":[1,2,3],"original":"kept"}', 'original-hash', 'old-instrument', 'old-batch', 'old-created', 'old-updated');
}
function evidence() {
    return ['WorkItem', 'WorkAttempt', 'Result', 'AuditLog'].map(table => db.prepare(`SELECT * FROM "${table}" ORDER BY id`).all())
        .concat([db.prepare('SELECT * FROM sqlite_master ORDER BY name').all()]);
}
function readonlyPlan() {
    const before = evidence(), changes = db.prepare('SELECT total_changes() n').get().n;
    const plan = planHistoricalAttempts(db);
    expect(evidence()).toEqual(before);
    expect(db.prepare('SELECT total_changes() n').get().n).toBe(changes);
    return plan;
}

test.each([
    ['COMPLETED', 'RECORDED'], ['AWAITING_VERIFICATION', 'RECORDED'],
    ['SUBMITTED', 'SUBMITTED'], ['QA_PENDING', 'SUBMITTED'],
    ['ACCEPTED', 'ACCEPTED'], ['APPROVED', 'ACCEPTED']
])('backfill plans the pinned literal stored status %s as %s without writes', (stored, mapped) => {
    item('measured', stored); result('result', 'measured'); item('without-result', stored);
    expect(readonlyPlan()).toMatchObject({ status: 'READY', newAttempts: [{ workItemId: 'measured', attemptNo: 1,
        sourceStatus: stored, status: mapped, resultIds: ['result'] }], blockers: [], totalChanges: 0 });
});

test.each(['REPEAT_REQUIRED', 'REANALYSIS_REQUIRED', 'REJECTED', 'NOT_ASSIGNED', 'PENDING', 'ASSIGNED',
    'IN_PROGRESS', 'ON_HOLD', 'WAIVED', 'CANCELLED', 'unknown'])('unmapped %s refuses the whole plan despite another eligible row', stored => {
    item('eligible'); result('eligible-result', 'eligible'); item('unmapped', stored); result('unmapped-result', 'unmapped');
    expect(readonlyPlan()).toMatchObject({ status: 'REFUSED', blockers: [{ code: 'WORK_ATTEMPT_STATUS_UNMAPPED',
        workItemId: 'unmapped', sourceStatus: stored, resultId: 'unmapped-result' }] });
    expect(db.prepare('SELECT count(*) n FROM WorkAttempt').get().n).toBe(0);
});

test('one existing attempt is linked deterministically and legacy evidence/status stays byte-for-byte', () => {
    item('legacy-returned', 'REPEAT_REQUIRED'); attempt('returned', 'legacy-returned', 1, 'RETURNED'); result('r-returned', 'legacy-returned');
    item('legacy-rejected', 'ON_HOLD'); attempt('rejected', 'legacy-rejected', 1, 'REJECTED'); result('r-rejected', 'legacy-rejected');
    const plan = readonlyPlan();
    expect(plan).toMatchObject({ status: 'READY', newAttempts: [], links: [
        { resultId: 'r-rejected', attemptId: 'rejected' }, { resultId: 'r-returned', attemptId: 'returned' }] });
    for (const legacy of ['RETURNED', 'REJECTED']) expect(() => assertWorkAttemptStatus(legacy)).toThrow(
        expect.objectContaining({ code: 'WORK_ATTEMPT_STATUS_INVALID', statusCode: 409 }));
});

test('multiple existing attempts refuse null links while retaining every already-linked Result', () => {
    item('repeated'); attempt('first', 'repeated', 1, 'SUPERSEDED'); attempt('second', 'repeated', 2);
    result('already-linked', 'repeated', { attemptId: 'first', isCurrent: 0 }); result('ambiguous', 'repeated');
    expect(readonlyPlan()).toMatchObject({ status: 'REFUSED', alreadyLinkedResultCount: 1, links: [],
        blockers: [{ code: 'WORK_ATTEMPT_LINK_AMBIGUOUS', resultId: 'ambiguous', attemptIds: ['first', 'second'] }] });
});

test('duplicate attempt numbers are fully reported with their ids and never renumbered', () => {
    item('conflicted'); attempt('first', 'conflicted', 1); attempt('second', 'conflicted', 1);
    expect(readonlyPlan().duplicateAttemptNumberGroups).toEqual([{ workItemId: 'conflicted', attemptNo: 1, attemptIds: ['first', 'second'] }]);
});

test('current-result collisions are reported after proposed links, distinct replicates and attempts remain separate', () => {
    item('collision'); result('one', 'collision'); result('two', 'collision');
    item('replicates'); result('rep-one', 'replicates'); result('rep-two', 'replicates', { replicateNo: 2 });
    item('attempts'); attempt('attempt-one', 'attempts', 1); attempt('attempt-two', 'attempts', 2);
    result('att-one', 'attempts', { attemptId: 'attempt-one' }); result('att-two', 'attempts', { attemptId: 'attempt-two' });
    expect(readonlyPlan().currentResultConflicts).toEqual([{ key: ['collision-sample', 'P', 1, 'PLANNED_WORKITEM:collision'], resultIds: ['one', 'two'] }]);
});

test('unmatched and multiple exact WorkItem candidates are reported without guessed texture aliases', () => {
    item('texture', 'ACCEPTED', 'TEXTURE'); result('unmatched', 'texture');
    item('duplicate'); result('ambiguous-workitem', 'duplicate');
    db.prepare('INSERT INTO WorkItem VALUES (?,?,?,?)').run('other', 'duplicate-sample', 'P', 'ACCEPTED');
    expect(readonlyPlan().blockers.map(row => row.code)).toEqual(['WORK_ATTEMPT_WORKITEM_AMBIGUOUS', 'WORK_ATTEMPT_WORKITEM_UNMATCHED']);
});

test('planning CLI requires an explicit database and dry-run and refuses apply', () => {
    expect(parseArguments(['--db', 'owned.db', '--dry-run'])).toMatch(/owned\.db$/);
    for (const args of [[], ['--db', 'owned.db', '--apply'], ['--db', 'owned.db'], ['--db', 'owned.db', '--dry-run', '--apply']]) {
        expect(() => parseArguments(args)).toThrow(expect.objectContaining({ code: 'WORK_ATTEMPT_PLAN_ARGUMENT_INVALID' }));
    }
});
