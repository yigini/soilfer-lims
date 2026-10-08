const Database = require('better-sqlite3');
const fs = require('node:fs'), path = require('node:path');
const { randomUUID, createHash } = require('node:crypto');
const { createPre190AttemptFixture } = require('../helpers/workAttemptHistoricalFixtures');
const { installWorkAttemptContract } = require('../../scripts/install_work_attempt_contract');
const { planHistoricalAttempts } = require('../../services/workAttemptBackfillPlan');
const { assertWorkAttemptStatus } = require('../../services/workAttemptContract');
const { parseArguments } = require('../../scripts/plan_work_attempt_backfill');

let db, rows;
const files = [], directory = path.resolve(__dirname, '../.tmp'), timestamp = '2026-10-01T12:00:00Z';
beforeEach(() => {
    rows = { Batch: [], Sample: [], WorkItem: [], WorkAttempt: [], Result: [], AuditLog: [
        { id: 'retained', entity: 'Sample', entityId: 'historical', action: 'RETAINED', performedBy: 'system:fixture', details: 'scientific audit' }] };
});
afterEach(() => {
    db?.close(); db = null;
    for (const file of files.splice(0)) {
        if (path.dirname(file) !== directory || !path.basename(file).startsWith('audit_legacy_190_plan-')) throw Error('Unexpected owned fixture.');
        for (const suffix of ['', '-wal', '-shm']) fs.rmSync(file + suffix, { force: true });
    }
});
function sample(id, assignedLab = null, requiredAnalyses = null) {
    if (!rows.Sample.some(row => row.id === id)) rows.Sample.push({ id, originalId: id,
        status: 'PROCESSING', assignedLab, requiredAnalyses, updatedAt: timestamp });
}
function batch(id) { rows.Batch.push({ id, analysis: 'P', status: 'COMPLETED', createdBy: 'system:fixture' }); }
function openFixture() {
    db?.close(); fs.mkdirSync(directory, { recursive: true });
    const file = path.join(directory, `audit_legacy_190_plan-${randomUUID()}.db`); files.push(file);
    createPre190AttemptFixture({ actor: 'system:fixture', file, rows });
    db = new Database(file, { readonly: true }); return file;
}
function item(id, status = 'ACCEPTED', analysis = 'P') {
    sample(id + '-sample');
    rows.WorkItem.push({ id, sampleId: id + '-sample', analysis, status, updatedAt: timestamp });
}
function result(id, workItemId, { attemptId = null, replicateNo = 1, isCurrent = 1, batchId = null } = {}) {
    sample(workItemId + '-sample');
    rows.Result.push({ id, sampleId: workItemId + '-sample', param: 'P', attemptId, replicateNo, isCurrent,
        value: '0.123456789', batchId, provenance: 'MEASURED', updatedAt: timestamp });
}
function attempt(id, workItemId, attemptNo = 1, status = 'RECORDED') {
    rows.WorkAttempt.push({ id, workItemId, attemptNo, status, evidenceData: '{"fractions":[1,2,3],"original":"kept"}',
        evidenceHash: 'original-hash', instrumentId: 'old-instrument', qcBatchId: 'old-batch', createdAt: 'old-created', updatedAt: 'old-updated' });
}
function evidence() {
    return ['Batch', 'WorkItem', 'WorkAttempt', 'Result', 'AuditLog'].map(table => db.prepare(`SELECT * FROM "${table}" ORDER BY id`).all())
        .concat([db.prepare('SELECT * FROM sqlite_master ORDER BY name').all()]);
}
function readonlyPlan({ retainedDb = false } = {}) {
    if (!retainedDb) openFixture();
    const file = db.name, sha = createHash('sha256').update(fs.readFileSync(file)).digest('hex');
    const before = evidence(), changes = db.prepare('SELECT total_changes() n').get().n;
    const plan = planHistoricalAttempts(db);
    expect(evidence()).toEqual(before);
    expect(db.prepare('SELECT total_changes() n').get().n).toBe(changes);
    expect(createHash('sha256').update(fs.readFileSync(file)).digest('hex')).toBe(sha);
    return plan;
}

test('the closed historical factory refuses an existing owned target without changing its bytes', () => {
    const file = openFixture(), before = createHash('sha256').update(fs.readFileSync(file)).digest('hex');
    expect(() => createPre190AttemptFixture({ actor: 'system:fixture', file, rows })).toThrow('existing target');
    expect(createHash('sha256').update(fs.readFileSync(file)).digest('hex')).toBe(before);
});

test('the historical factory rejects SQL options, callbacks and unknown columns before creating a file', () => {
    for (const variant of ['sql','callback','column']) {
        const file = path.join(directory, `audit_legacy_190_plan-${randomUUID()}.db`); files.push(file);
        const options = {actor:'system:fixture',file,rows:{Sample:[]}};
        if (variant === 'sql') options.sql = 'SELECT 1';
        if (variant === 'callback') options.rows.Sample.push(() => {});
        if (variant === 'column') options.rows.Sample.push({id:'refused',legacyAttemptNoConflict:'injected'});
        expect(() => createPre190AttemptFixture(options)).toThrow();
        expect(fs.existsSync(file)).toBe(false);
    }
});

test('historical provenance must be supplied and no WorkItem or attempt is implicitly fabricated', () => {
    result('orphan','missing'); delete rows.Result[0].provenance;
    expect(() => openFixture()).toThrow('provenance must be explicitly supplied');
    rows.Result[0].provenance = 'MEASURED';
    expect(readonlyPlan()).toMatchObject({status:'REFUSED',blockers:[{code:'WORK_ATTEMPT_WORKITEM_UNMATCHED'}]});
    expect(db.prepare('SELECT count(*) n FROM WorkItem').get().n).toBe(0);
    expect(db.prepare('SELECT count(*) n FROM WorkAttempt').get().n).toBe(0);
    expect(db.prepare('SELECT provenance,value FROM Result').get()).toEqual({provenance:'MEASURED',value:'0.123456789'});
});

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
    rows.WorkItem.push({ id: 'other', sampleId: 'duplicate-sample', analysis: 'P', status: 'ACCEPTED', updatedAt: timestamp });
    expect(readonlyPlan().blockers.map(row => row.code)).toEqual(['WORK_ATTEMPT_WORKITEM_AMBIGUOUS', 'WORK_ATTEMPT_WORKITEM_UNMATCHED']);
});

test('planning CLI requires an explicit database and dry-run and refuses apply', () => {
    expect(parseArguments(['--db', 'owned.db', '--dry-run'])).toMatch(/owned\.db$/);
    for (const args of [[], ['--db', 'owned.db', '--apply'], ['--db', 'owned.db'], ['--db', 'owned.db', '--dry-run', '--apply']]) {
        expect(() => parseArguments(args)).toThrow(expect.objectContaining({ code: 'WORK_ATTEMPT_PLAN_ARGUMENT_INVALID' }));
    }
});

test('only imported rows without a canonical WorkItem are exempt, including a duplicate child',()=>{
    result('orphan-import','orphan');
    item('child');result('child-import','child');
    item('parent', 'ACCEPTED', 'OTHER');
    rows.WorkItem.unshift(rows.WorkItem.pop()); // The real duplicateOf FK requires its explicit parent first.
    rows.WorkItem.find(row => row.id === 'child').duplicateOf = 'parent';
    for (const row of rows.Result) row.provenance = 'IMPORTED';
    expect(readonlyPlan()).toMatchObject({status:'READY',exemptImportCount:2,newAttempts:[],links:[],blockers:[],
        exemptImports:[{resultId:'child-import'},{resultId:'orphan-import'}]});
});

test('an imported row with canonical work uses the normal historical attempt mapping',()=>{
    item('imported');result('result','imported');rows.Result[0].provenance = 'IMPORTED';
    expect(readonlyPlan()).toMatchObject({status:'READY',exemptImportCount:0,newAttempts:[{workItemId:'imported'}],links:[{resultId:'result'}]});
});

test.each(['MEASURED','PREDICTED','DERIVED'])('unmatched %s has no historical-import exemption',provenance=>{
    result('orphan','missing');rows.Result[0].provenance = provenance;
    expect(readonlyPlan()).toMatchObject({status:'REFUSED',exemptImportCount:0,blockers:[{code:'WORK_ATTEMPT_WORKITEM_UNMATCHED'}]});
});
test('the actual pre-190 schema refuses NULL Result provenance instead of manufacturing it', () => {
    result('orphan','missing'); rows.Result[0].provenance = null;
    expect(() => openFixture()).toThrow('NOT NULL constraint failed: Result.provenance');
});

test('unmapped statuses report grouped WorkItem and Result counts and every id',()=>{
    item('first','REPEAT_REQUIRED');item('second','REPEAT_REQUIRED');
    result('one','first');result('two','first',{replicateNo:2});result('three','second');
    expect(readonlyPlan().unmappedStatusGroups).toEqual([{sourceStatus:'REPEAT_REQUIRED',workItemIds:['first','second'],
        resultIds:['one','three','two'],workItemCount:2,resultCount:3}]);
});

test('ordered parameters missing canonical work are reported by laboratory and parameter, without creating work',()=>{
    sample('one','lab-a','["P","P","TEXTURE"]');sample('two','lab-a','["P"]');
    sample('three','lab-b','["P"]');sample('invalid','lab-b','invalid JSON');
    rows.WorkItem.push({id:'parent',sampleId:'one',analysis:'OTHER',status:'ACCEPTED',updatedAt:timestamp},
        {id:'child',sampleId:'one',analysis:'P',status:'ACCEPTED',duplicateOf:'parent',updatedAt:timestamp},
        {id:'canonical',sampleId:'three',analysis:'P',status:'ACCEPTED',updatedAt:timestamp});
    expect(readonlyPlan()).toMatchObject({status:'READY',missingOrderedWorkCount:3,samplesWithMissingOrderedWorkCount:2,
        missingOrderedWorkGroups:[{labId:'lab-a',param:'P',sampleIds:['one','two'],sampleCount:2},
            {labId:'lab-a',param:'TEXTURE',sampleIds:['one'],sampleCount:1}],invalidOrderMetadata:[{sampleId:'invalid'}],newAttempts:[]});
});

test('new historical attempts copy only identical frozen Result evidence and its instrument, with no request or equipment lookup', () => {
    item('frozen'); result('first', 'frozen'); result('second', 'frozen', { replicateNo: 2 });
    const snapshot = { equipmentId: 'frozen-instrument', assetStatus: 'IN_SERVICE', evaluatedAt: 'historical-time' };
    for (const row of rows.Result) row.equipmentReadiness = JSON.stringify(snapshot);
    expect(readonlyPlan().historicalEquipmentEvidence).toEqual([{ workItemId: 'frozen', resultIds: ['first', 'second'],
        outcome: 'COPIED', reason: null, instrumentId: 'frozen-instrument', evidenceData: JSON.stringify({ equipmentReadiness: snapshot }) }]);
});

test.each(['MISSING', 'DIFFERENT', 'INVALID'])('historical %s snapshots stay not recorded and are reported without invented evidence', kind => {
    item('frozen'); result('first', 'frozen'); result('second', 'frozen', { replicateNo: 2 });
    const snapshot = JSON.stringify({ equipmentId: 'frozen-instrument' });
    rows.Result.find(row=>row.id==='first').equipmentReadiness = kind === 'INVALID' ? '{broken' : snapshot;
    rows.Result.find(row=>row.id==='second').equipmentReadiness = kind === 'MISSING' ? null :
        kind === 'INVALID' ? '{broken' : JSON.stringify({ equipmentId: 'other-instrument' });
    expect(readonlyPlan().historicalEquipmentEvidence).toEqual([{ workItemId: 'frozen', resultIds: ['first', 'second'],
        outcome: 'NOT_RECORDED', reason: kind === 'MISSING' ? 'SNAPSHOT_NOT_RECORDED' : kind === 'INVALID' ? 'SNAPSHOT_INVALID' : 'SNAPSHOTS_DIFFER',
        evidenceData: null, instrumentId: null }]);
});

test('historical existing attempts never receive evidence copies, even when linked Results have snapshots', () => {
    item('legacy'); attempt('retained', 'legacy', 1, 'RETURNED'); result('result', 'legacy');
    rows.Result[0].equipmentReadiness = JSON.stringify({ equipmentId: 'different-from-old-attempt' });
    expect(readonlyPlan().historicalEquipmentEvidence).toEqual([]);
    expect(db.prepare('SELECT instrumentId,evidenceData FROM WorkAttempt WHERE id=?').get('retained'))
        .toEqual({ instrumentId: 'old-instrument', evidenceData: '{"fractions":[1,2,3],"original":"kept"}' });
});

test('new historical batch FK plans only the single existing batch shared by all linked Results', () => {
    item('batched'); result('first', 'batched', { batchId: 'existing-batch' });
    result('second', 'batched', { batchId: 'existing-batch', replicateNo: 2 });
    batch('existing-batch');
    expect(readonlyPlan().historicalBatchEvidence).toEqual([{ newAttemptForWorkItemId: 'batched', resultIds: ['first', 'second'],
        outcome: 'COPIED', reason: null, batchId: 'existing-batch' }]);
});

test.each([
    [null, 'BATCH_NOT_RECORDED'], ['different-batch', 'BATCHES_DIFFER'], ['dangling-batch', 'BATCH_REFERENCE_MISSING']
])('missing, mixed or dangling historical batch %s is reported without blocking or inventing a reference', (other, reason) => {
    item('batched'); result('first', 'batched', { batchId: other === 'dangling-batch' ? other : 'existing-batch' });
    result('second', 'batched', { batchId: other, replicateNo: 2 });
    batch('existing-batch');
    expect(readonlyPlan()).toMatchObject({ status: 'READY', historicalBatchEvidence: [{
        newAttemptForWorkItemId: 'batched', resultIds: ['first', 'second'], outcome: 'NOT_RECORDED', reason, batchId: null }] });
});

test('existing attempts plan batch FK only from their exact qcBatchId and retain every original field', () => {
    item('old'); attempt('retained', 'old');
    batch('old-batch');
    expect(readonlyPlan().historicalBatchEvidence).toEqual([{ attemptId: 'retained', workItemId: 'old',
        outcome: 'COPIED', reason: null, batchId: 'old-batch' }]);
    rows.Batch = [];
    expect(readonlyPlan().historicalBatchEvidence).toEqual([{ attemptId: 'retained', workItemId: 'old',
        outcome: 'NOT_RECORDED', reason: 'BATCH_REFERENCE_MISSING', batchId: null }]);
});

test('already populated additive batch FK is retained without re-copying historical qcBatchId', () => {
    item('old'); attempt('retained', 'old');
    batch('recorded-batch'); const file = openFixture(); db.close(); db = null;
    installWorkAttemptContract({dbPath:file,apply:true});
    const writer = new Database(file); writer.pragma('foreign_keys=ON');
    writer.prepare('UPDATE WorkAttempt SET batchId=? WHERE id=?').run('recorded-batch', 'retained'); writer.close();
    db = new Database(file,{readonly:true});
    expect(readonlyPlan({retainedDb:true}).historicalBatchEvidence).toEqual([{ attemptId: 'retained', workItemId: 'old',
        outcome: 'RETAINED', reason: null, batchId: 'recorded-batch' }]);
});

function batchPair() {
    item('repeated'); attempt('first', 'repeated', 1, 'SUPERSEDED'); attempt('second', 'repeated', 2);
    rows.WorkAttempt.find(row=>row.id==='first').qcBatchId = 'batch-one';
    rows.WorkAttempt.find(row=>row.id==='second').qcBatchId = 'batch-two';
    result('run-one', 'repeated', { batchId: 'batch-one', isCurrent: 0 });
    result('run-two', 'repeated', { batchId: 'batch-two' });
}
test('the pinned historical pair links only by frozen batch, preserving both attempts and their status', () => {
    batchPair();
    expect(readonlyPlan()).toMatchObject({ status: 'READY', newAttempts: [], currentResultConflicts: [], links: [
        { resultId: 'run-one', attemptId: 'first', attemptNo: 1, attemptStatus: 'SUPERSEDED',
            attemptQcBatchId: 'batch-one', resultBatchId: 'batch-one', isCurrent: 0, rule: 'EXISTING_ATTEMPT_ONE_TO_ONE_BATCH_MATCH' },
        { resultId: 'run-two', attemptId: 'second', attemptNo: 2, attemptStatus: 'RECORDED',
            attemptQcBatchId: 'batch-two', resultBatchId: 'batch-two', isCurrent: 1, rule: 'EXISTING_ATTEMPT_ONE_TO_ONE_BATCH_MATCH' }
    ] });
});
test.each([
    ['WorkAttempt','second','qcBatchId','batch-one'],
    ['Result','run-two','batchId',null],
    ['WorkAttempt','second','qcBatchId',null],
    ['Result','run-one','isCurrent',1],
    ['Result','run-one','batchId','batch-two']
])('invalid historical batch pairing refuses the whole read-only plan: %s %s %s=%s', (table,id,column,value) => {
    batchPair(); rows[table].find(row=>row.id===id)[column] = value;
    expect(readonlyPlan()).toMatchObject({ status: 'REFUSED', blockers: expect.arrayContaining([
        expect.objectContaining({ code: 'WORK_ATTEMPT_LINK_AMBIGUOUS' })
    ]) });
});
