const Database = require('better-sqlite3');
const { loadWorkAttemptMigrationSource } = require('../../services/workAttemptMigrationSource');
const { WORK_ATTEMPT_STATUS_LIST, LEGACY_WORK_ATTEMPT_STATUS_LIST, REPEAT_REASON_LIST, assertRepeatReason, canonicalWorkItemWhere } = require('../../services/workAttemptContract');
let db, source;
beforeEach(() => {
    db = new Database(':memory:'); db.pragma('foreign_keys=ON');
    db.exec(`CREATE TABLE Batch(id TEXT PRIMARY KEY);
        CREATE TABLE WorkItem(id TEXT PRIMARY KEY,sampleId TEXT,analysis TEXT,duplicateOf TEXT);
        CREATE TABLE WorkAttempt(id TEXT PRIMARY KEY,workItemId TEXT,orderLineId TEXT,attemptNo INTEGER DEFAULT 1,
            executedMethodRevision TEXT,author TEXT,authorName TEXT,materialAliquot TEXT,instrumentId TEXT,qcBatchId TEXT,
            version INTEGER DEFAULT 1,status TEXT DEFAULT 'RECORDED',evidenceHash TEXT,evidenceData TEXT,createdAt DATETIME,updatedAt DATETIME);
        CREATE TABLE Result(id TEXT PRIMARY KEY,sampleId TEXT,param TEXT,replicateNo INTEGER,attemptId TEXT,isCurrent INTEGER,provenance TEXT DEFAULT 'MEASURED');
        CREATE TABLE ReviewDecision(id TEXT PRIMARY KEY);`);
    source = loadWorkAttemptMigrationSource(); db.exec(source.schemaSql);
});
afterEach(() => db.close());
function insert(id, { workItemId = 'item', attemptNo = 1, status = 'RECORDED', flag = null, evidenceData = null, batchId = null, reason = null } = {}) {
    return db.prepare(`INSERT INTO WorkAttempt(id,workItemId,attemptNo,status,legacyAttemptNoConflict,evidenceData,batchId,reason)
        VALUES (?,?,?,?,?,?,?,?)`).run(id,workItemId,attemptNo,status,flag,evidenceData,batchId,reason);
}

test('every lab installs partial attempt uniqueness and current-result uniqueness with all guards', () => {
    db.exec(source.guardsSql); insert('first');
    expect(db.prepare("SELECT sql FROM sqlite_master WHERE name='WorkAttempt_workItemId_attemptNo_unique'").get().sql)
        .toMatch(/WHERE "legacyAttemptNoConflict" IS NULL$/);
    expect(() => insert('collision')).toThrow(/UNIQUE/);
    insert('next', { attemptNo: 2 }); insert('another-item', { workItemId: 'other' });
    const result = db.prepare('INSERT INTO Result(id,sampleId,param,replicateNo,attemptId,isCurrent) VALUES (?,?,?,?,?,?)');
    result.run('original','sample','P',1,'first',1);
    expect(() => result.run('duplicate','sample','P',1,'first',1)).toThrow(/UNIQUE/);
    result.run('replicate','sample','P',2,'first',1);
    result.run('other-attempt','sample','P',1,'next',1);
    result.run('historical','sample','P',1,'first',0);
});

test.each(WORK_ATTEMPT_STATUS_LIST)('canonical insert and status update %s are accepted', status => {
    db.exec(source.guardsSql); insert('canonical', { status });
    db.prepare('UPDATE WorkAttempt SET status=? WHERE id=?').run(status,'canonical');
});

test.each(LEGACY_WORK_ATTEMPT_STATUS_LIST)('historical %s stays stored but cannot be newly inserted or updated', status => {
    insert('historical', { status, evidenceData: '{"retained":"exact bytes"}' });
    const original = db.prepare('SELECT * FROM WorkAttempt').all(); db.exec(source.guardsSql);
    expect(db.prepare('SELECT * FROM WorkAttempt').all()).toEqual(original);
    expect(() => insert('new-legacy', { workItemId: 'another', status })).toThrow('WORK_ATTEMPT_STATUS_INVALID');
    expect(() => db.prepare('UPDATE WorkAttempt SET status=?').run(status)).toThrow('WORK_ATTEMPT_STATUS_INVALID');
    db.prepare("UPDATE WorkAttempt SET status='SUPERSEDED'").run();
    expect(db.prepare('SELECT evidenceData,status FROM WorkAttempt').get()).toEqual({ evidenceData:'{"retained":"exact bytes"}',status:'SUPERSEDED' });
});

test('the migration can flag every historical duplicate before guards, without renumbering', () => {
    insert('duplicate-one', { flag: 'migration-group', evidenceData: '{"original":1}' });
    insert('duplicate-two', { flag: 'migration-group', evidenceData: '{"original":2}' });
    const original = db.prepare('SELECT * FROM WorkAttempt ORDER BY id').all(); db.exec(source.guardsSql);
    expect(db.prepare('SELECT * FROM WorkAttempt ORDER BY id').all()).toEqual(original);
    insert('next', { attemptNo: 2 });
    expect(() => insert('forced-next-duplicate', { attemptNo: 2 })).toThrow(/UNIQUE/);
    db.prepare("UPDATE WorkAttempt SET status='SUPERSEDED' WHERE id='duplicate-one'").run();
    expect(db.prepare("SELECT attemptNo,legacyAttemptNoConflict,evidenceData FROM WorkAttempt WHERE id='duplicate-one'").get())
        .toEqual({attemptNo:1,legacyAttemptNoConflict:'migration-group',evidenceData:'{"original":1}'});
});

test.each([['unflagged','flag'],['flagged',null],['flagged','same'],['unflagged',null]])('all conflict flag updates %s -> %s are refused', (id,value) => {
    insert('unflagged'); insert('flagged', { workItemId:'another',flag:'same' }); db.exec(source.guardsSql);
    expect(() => db.prepare('UPDATE WorkAttempt SET legacyAttemptNoConflict=? WHERE id=?').run(value,id))
        .toThrow('WORK_ATTEMPT_CONFLICT_FLAG_IMMUTABLE');
    expect(() => insert('new-flagged', { workItemId:'new',flag:'pretended-migration' })).toThrow('WORK_ATTEMPT_CONFLICT_FLAG_FORBIDDEN');
});

test.each(['evidenceData','evidenceHash','instrumentId'])('evidence field %s is immutable even within its creating transaction', field => {
    db.exec(source.guardsSql);
    expect(() => db.transaction(() => {
        insert('new', { evidenceData:'{"final":"inserted"}' });
        db.prepare(`UPDATE WorkAttempt SET "${field}"=? WHERE id='new'`).run('changed');
    })()).toThrow('WORK_ATTEMPT_EVIDENCE_IMMUTABLE');
    expect(db.prepare('SELECT count(*) n FROM WorkAttempt').get().n).toBe(0);
});

test.each(['attemptNo','workItemId','author','createdAt','updatedAt','qcBatchId','rawData'])('recorded identity field %s cannot change', field => {
    insert('recorded', { flag:'historical-group' }); db.exec(source.guardsSql);
    expect(() => db.prepare(`UPDATE WorkAttempt SET "${field}"=?`).run(field==='attemptNo'?2:'changed'))
        .toThrow('WORK_ATTEMPT_IDENTITY_IMMUTABLE');
});

test('batch FK is additive, reference checked and write-once when recorded', () => {
    db.prepare('INSERT INTO Batch VALUES (?)').run('batch'); db.prepare('INSERT INTO Batch VALUES (?)').run('another');
    insert('historical'); db.prepare("UPDATE WorkAttempt SET batchId='batch'").run(); db.exec(source.guardsSql);
    for (const value of [null,'another']) expect(() => db.prepare('UPDATE WorkAttempt SET batchId=?').run(value)).toThrow('WORK_ATTEMPT_BATCH_IMMUTABLE');
    expect(() => insert('dangling', {workItemId:'different',batchId:'missing'})).toThrow(/FOREIGN KEY/);
    expect(() => db.prepare("DELETE FROM Batch WHERE id='batch'").run()).toThrow(/FOREIGN KEY/);
    expect(() => db.prepare('DELETE FROM WorkAttempt').run()).toThrow('WORK_ATTEMPT_DELETE_REFUSED');
});

test.each(REPEAT_REASON_LIST)('canonical reason %s is accepted by both the shared contract and SQL',reason=>{
    db.exec(source.guardsSql);expect(assertRepeatReason(reason)).toBe(reason);insert('canonical-reason',{reason});
});

test('reason remains nullable for a second execution, while noncanonical values are refused',()=>{
    db.exec(source.guardsSql);insert('first');insert('second',{attemptNo:2});
    expect(db.prepare("SELECT reason FROM WorkAttempt WHERE id='second'").get().reason).toBeNull();
    expect(assertRepeatReason(null)).toBeNull();
    for(const reason of ['free text','',1]) {
        expect(()=>assertRepeatReason(reason)).toThrow(expect.objectContaining({code:'WORK_ATTEMPT_REASON_INVALID',statusCode:409}));
        expect(()=>insert('invalid',{workItemId:'another',reason})).toThrow('WORK_ATTEMPT_REASON_INVALID');
    }
});

test('SQL and runtime canonical lookup agree: only orphan historical imports can omit an attempt',()=>{
    db.exec(source.guardsSql);
    const result=db.prepare('INSERT INTO Result(id,sampleId,param,replicateNo,attemptId,isCurrent,provenance) VALUES (?,?,?,?,?,?,?)');
    result.run('orphan','sample','P',1,null,1,'IMPORTED');
    db.prepare('INSERT INTO WorkItem VALUES (?,?,?,?)').run('child','sample','P','parent');
    result.run('duplicate-child-import','sample','P',2,null,1,'IMPORTED');
    expect(canonicalWorkItemWhere('sample','P')).toEqual({sampleId:'sample',analysis:'P',duplicateOf:null});
    db.prepare('INSERT INTO WorkItem VALUES (?,?,?,?)').run('canonical','sample','P',null);
    expect(()=>result.run('nonexempt-import','sample','P',3,null,1,'IMPORTED')).toThrow('RESULT_ATTEMPT_REQUIRED');
    result.run('linked-import','sample','P',3,'valid-attempt',1,'IMPORTED');
    for(const attemptId of [null,'replacement']) {
        expect(()=>db.prepare("UPDATE Result SET attemptId=? WHERE id='linked-import'").run(attemptId)).toThrow('RESULT_ATTEMPT_IMMUTABLE');
    }
    db.prepare("UPDATE Result SET attemptId='valid-attempt' WHERE id='linked-import'").run();
    for(const provenance of ['MEASURED','PREDICTED','DERIVED',null]) {
        expect(()=>result.run('refused','other-sample','P',1,null,1,provenance)).toThrow('RESULT_ATTEMPT_REQUIRED');
    }
});
