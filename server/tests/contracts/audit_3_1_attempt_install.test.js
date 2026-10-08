const fs = require('node:fs'), path = require('node:path');
const { createHash, randomUUID } = require('node:crypto');
const Database = require('better-sqlite3');
const { installWorkAttemptContract, assertWorkAttemptStartupReady, parseArguments, MARKER } = require('../../scripts/install_work_attempt_contract');
const { beforeGuards } = require('../helpers/legacyWorkflowDatabase');
const ownedFiles = [];
const directory = path.resolve(__dirname,'../.tmp');
function ownedFile() {
    fs.mkdirSync(directory,{recursive:true});
    const file=path.join(directory,'audit_legacy_190_attempt_install-'+randomUUID()+'.db');ownedFiles.push(file);return file;
}
function fixture() {
    const file=ownedFile(),db=new Database(file);
    db.exec(`CREATE TABLE _schema_migrations(id TEXT PRIMARY KEY,details TEXT NOT NULL);
        CREATE TABLE Sample(id TEXT PRIMARY KEY,assignedLab TEXT,requiredAnalyses TEXT);
        INSERT INTO _schema_migrations VALUES ('prior-retained','{"original":"receipt"}');
        CREATE TABLE Batch(id TEXT PRIMARY KEY);
        INSERT INTO Batch VALUES ('batch');
        CREATE TABLE WorkItem(id TEXT PRIMARY KEY,sampleId TEXT,analysis TEXT,status TEXT,result TEXT,duplicateOf TEXT);
        CREATE TABLE WorkAttempt(id TEXT PRIMARY KEY,workItemId TEXT REFERENCES WorkItem(id),orderLineId TEXT,
            attemptNo INTEGER DEFAULT 1,executedMethodRevision TEXT,author TEXT,authorName TEXT,materialAliquot TEXT,
            instrumentId TEXT,qcBatchId TEXT,version INTEGER DEFAULT 1,status TEXT DEFAULT 'RECORDED',
            evidenceHash TEXT,evidenceData TEXT,createdAt DATETIME NOT NULL,updatedAt DATETIME NOT NULL);
        CREATE TABLE Result(id TEXT PRIMARY KEY,sampleId TEXT,param TEXT,replicateNo INTEGER,attemptId TEXT,
            isCurrent INTEGER,value TEXT,equipmentReadiness TEXT,batchId TEXT,updatedAt TEXT,provenance TEXT DEFAULT 'MEASURED');
        CREATE TABLE ReviewDecision(id TEXT PRIMARY KEY,reason TEXT,workItemId TEXT,sampleId TEXT,attemptId TEXT,decision TEXT);
        INSERT INTO ReviewDecision(id,reason) VALUES ('legacy-review','stored reason');
        CREATE TABLE AuditLog(id TEXT PRIMARY KEY,details TEXT);
        INSERT INTO AuditLog VALUES ('original','unchanged technical audit');
        INSERT INTO WorkItem(id,sampleId,analysis,status,result) VALUES ('measured','sample','P','ACCEPTED','original cache');
        INSERT INTO Result(id,sampleId,param,replicateNo,attemptId,isCurrent,value,equipmentReadiness,batchId,updatedAt) VALUES ('result','sample','P',1,NULL,1,'0.123456789',NULL,'batch','original-timestamp');`);
    db.close();return file;
}
const hash=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function retained(file) {
    const db=new Database(file,{readonly:true});
    try { return ['WorkItem','WorkAttempt','Result','ReviewDecision','AuditLog','_schema_migrations']
        .map(table=>({table,rows:db.prepare(`SELECT * FROM "${table}" ORDER BY id`).all()}))
        .concat([{schema:db.prepare('SELECT * FROM sqlite_master ORDER BY name').all()}]); }
    finally { db.close(); }
}
afterEach(()=>{
    for(const file of ownedFiles.splice(0)) {
        if(path.dirname(file)!==directory || !path.basename(file).startsWith('audit_legacy_190_attempt_install-')) throw Error('Unexpected fixture path');
        for(const suffix of ['','-wal','-shm'])fs.rmSync(file+suffix,{force:true});
    }
});

test('read-only PRE_190 dry-run plans one attempt and one link, without changing database bytes',()=>{
    const file=fixture(),before=hash(file);
    const dry=installWorkAttemptContract({dbPath:file});
    expect(dry).toMatchObject({classification:'PRE_190',mode:'DRY_RUN',totalChanges:0,bootstrapRebuild:[],
        plan:{status:'READY',newAttempts:[{workItemId:'measured',attemptNo:1,status:'ACCEPTED'}],links:[{resultId:'result'}]}});
    expect(hash(file)).toBe(before);
    expect(()=>assertWorkAttemptStartupReady(file)).toThrow(expect.objectContaining({code:'WORK_ATTEMPT_NOT_INSTALLED'}));
    expect(hash(file)).toBe(before);
});

test('atomic additive apply links every Result, records provenance, preserves original values and is idempotent',()=>{
    const file=fixture(),before=retained(file);
    const applied=installWorkAttemptContract({dbPath:file,apply:true});
    expect(applied).toMatchObject({classification:'COMPLETE',previousClassification:'PRE_190',mode:'APPLIED',
        newAttemptCount:1,linkedResultCount:1,flaggedAttemptCount:0,bootstrapRebuild:[],
        receipt:{originalRowsAndFieldsPreserved:true,createdAttempts:[{workItemId:'measured',sourceStatus:'ACCEPTED',status:'ACCEPTED',resultIds:['result']}]}});
    const db=new Database(file);
    const result=db.prepare('SELECT * FROM Result').get(),attempt=db.prepare('SELECT * FROM WorkAttempt').get();
    expect(result.attemptId).toBe(attempt.id);expect(attempt.attemptNo).toBe(1);expect(attempt.reason).toBeNull();
    expect(attempt.batchId).toBe('batch');expect(attempt.evidenceData).toBeNull();expect(attempt.instrumentId).toBeNull();
    expect({...result,attemptId:null}).toEqual(before.find(row=>row.table==='Result').rows[0]);
    expect(db.prepare('SELECT * FROM AuditLog').all()).toEqual(before.find(row=>row.table==='AuditLog').rows);
    expect(db.prepare('SELECT * FROM WorkItem').all()).toEqual(before.find(row=>row.table==='WorkItem').rows);
    expect(db.prepare("SELECT details FROM _schema_migrations WHERE id='prior-retained'").get().details).toBe('{"original":"receipt"}');
    expect(db.pragma('integrity_check',{simple:true})).toBe('ok');expect(db.pragma('foreign_key_check')).toEqual([]);db.close();
    const installed=hash(file);
    expect(installWorkAttemptContract({dbPath:file,apply:true})).toMatchObject({mode:'NO_OP',totalChanges:0,classification:'COMPLETE'});
    expect(hash(file)).toBe(installed);expect(assertWorkAttemptStartupReady(file).classification).toBe('COMPLETE');
});

test('all duplicate attempts are flagged without rewriting original fields, legacy evidence is retained, and frozen new evidence is copied',()=>{
    const file=fixture(),db=new Database(file);
    db.exec(`INSERT INTO WorkItem(id,sampleId,analysis,status,result) VALUES ('duplicates','other-sample','P','REPEAT_REQUIRED','retained');
        INSERT INTO WorkItem(id,sampleId,analysis,status,result) VALUES ('empty','empty-sample','P','NOT_ASSIGNED',NULL);
        INSERT INTO WorkAttempt(id,workItemId,attemptNo,status,qcBatchId,evidenceData,evidenceHash,instrumentId,createdAt,updatedAt)
        VALUES ('old-one','duplicates',4,'RETURNED','batch','{"old":1}','hash-one','old-one-instrument','old-created','old-updated'),
            ('old-two','duplicates',4,'REJECTED','missing-batch','{"old":2}','hash-two','old-two-instrument','old-created','old-updated');`);
    const frozen=JSON.stringify({equipmentId:'frozen-id',evaluatedAt:'retained-measurement-time',readiness:'READY'});
    db.prepare('UPDATE Result SET equipmentReadiness=?').run(frozen);
    const before=db.prepare('SELECT * FROM WorkAttempt ORDER BY id').all();db.close();
    const applied=installWorkAttemptContract({dbPath:file,apply:true});
    expect(applied).toMatchObject({newAttemptCount:1,linkedResultCount:1,flaggedAttemptCount:2});
    const after=new Database(file);
    for(const original of before) {
        const row=after.prepare('SELECT * FROM WorkAttempt WHERE id=?').get(original.id);
        expect(Object.fromEntries(Object.keys(original).map(key=>[key,row[key]]))).toEqual(original);
        expect(row.legacyAttemptNoConflict).toMatch(/^190:/);
    }
    const newer=after.prepare("SELECT * FROM WorkAttempt WHERE workItemId='measured'").get();
    expect(newer.instrumentId).toBe('frozen-id');expect(JSON.parse(newer.evidenceData)).toEqual({equipmentReadiness:JSON.parse(frozen)});
    expect(after.prepare("SELECT count(*) n FROM WorkAttempt WHERE workItemId='empty'").get().n).toBe(0);
    expect(applied.receipt.historicalBatchEvidence).toEqual(expect.arrayContaining([
        expect.objectContaining({attemptId:'old-one',batchId:'batch',outcome:'COPIED'}),
        expect.objectContaining({attemptId:'old-two',batchId:null,reason:'BATCH_REFERENCE_MISSING'})]));
    expect(()=>after.prepare("INSERT INTO WorkAttempt(id,workItemId,attemptNo,status,createdAt,updatedAt) VALUES ('forced','measured',1,'RECORDED','created','updated')").run()).toThrow(/UNIQUE/);
    after.close();
});

test.each(['REPEAT_REQUIRED','REANALYSIS_REQUIRED','REJECTED','NOT_ASSIGNED','PENDING','ASSIGNED','IN_PROGRESS','ON_HOLD','WAIVED','CANCELLED','unknown'])('unmapped stored %s refuses whole apply without schema or data changes',status=>{
    const file=fixture(),db=new Database(file);db.prepare('UPDATE WorkItem SET status=?').run(status);db.close();
    const before=hash(file);
    expect(installWorkAttemptContract({dbPath:file})).toMatchObject({plan:{status:'REFUSED',blockers:[{sourceStatus:status}]},totalChanges:0});
    expect(()=>installWorkAttemptContract({dbPath:file,apply:true})).toThrow(expect.objectContaining({code:'WORK_ATTEMPT_BACKFILL_REFUSED'}));
    expect(hash(file)).toBe(before);
});

test('unmatched Results and current-result collisions are both reported and never partially applied',()=>{
    const file=fixture(),db=new Database(file);
    db.exec(`INSERT INTO Result(id,sampleId,param,replicateNo,attemptId,isCurrent,value,equipmentReadiness,batchId,updatedAt) VALUES ('conflict','sample','P',1,NULL,1,'other retained value',NULL,'batch','retained');
        INSERT INTO Result(id,sampleId,param,replicateNo,attemptId,isCurrent,value,equipmentReadiness,batchId,updatedAt) VALUES ('unmatched','missing-sample','P',1,NULL,1,'unmatched scientific value',NULL,NULL,'retained');`);db.close();
    const before=hash(file),dry=installWorkAttemptContract({dbPath:file});
    expect(dry.plan.blockers.map(row=>row.code)).toEqual(expect.arrayContaining(['WORK_ATTEMPT_WORKITEM_UNMATCHED','WORK_ATTEMPT_CURRENT_RESULT_CONFLICT']));
    expect(()=>installWorkAttemptContract({dbPath:file,apply:true})).toThrow(expect.objectContaining({code:'WORK_ATTEMPT_BACKFILL_REFUSED'}));
    expect(hash(file)).toBe(before);
});

test('a receipt-write failure rolls back metadata, attempts, links, guards and indexes together',()=>{
    const file=fixture(),db=new Database(file);
    db.exec(`CREATE TRIGGER owned_receipt_fault BEFORE INSERT ON _schema_migrations WHEN NEW.id='${MARKER}' BEGIN SELECT RAISE(ABORT,'OWNED_190_RECEIPT_FAULT'); END;`);db.close();
    const before=retained(file);
    expect(()=>installWorkAttemptContract({dbPath:file,apply:true})).toThrow('OWNED_190_RECEIPT_FAULT');
    expect(retained(file)).toEqual(before);expect(installWorkAttemptContract({dbPath:file}).classification).toBe('PRE_190');
});

test('existing exchange UDF triggers compile without emitting amendments for an attemptId-only backfill',()=>{
    const file=fixture(),db=new Database(file);
    db.exec(`CREATE TABLE _exchange_journal(id TEXT PRIMARY KEY,content_hash TEXT);
        INSERT INTO _exchange_journal VALUES ('retained','original exchange evidence');
        CREATE TRIGGER existing_exchange_trigger AFTER UPDATE ON Result
        WHEN NEW.value IS NOT OLD.value
        BEGIN INSERT INTO _exchange_journal VALUES ('unexpected',exchange_compute_hash('{}','[]')); END;`);
    const trigger=db.prepare("SELECT sql FROM sqlite_master WHERE name='existing_exchange_trigger'").get().sql;
    db.close();
    expect(installWorkAttemptContract({dbPath:file,apply:true})).toMatchObject({classification:'COMPLETE',linkedResultCount:1});
    const after=new Database(file,{readonly:true});
    expect(after.prepare('SELECT * FROM _exchange_journal').all()).toEqual([{id:'retained',content_hash:'original exchange evidence'}]);
    expect(after.prepare("SELECT sql FROM sqlite_master WHERE name='existing_exchange_trigger'").get().sql).toBe(trigger);
    after.close();
});

test('historical orphan imports are separately receipted and never get fabricated work or attempts',()=>{
    const file=fixture(),db=new Database(file);
    db.prepare(`INSERT INTO Result(id,sampleId,param,replicateNo,attemptId,isCurrent,value,provenance,updatedAt)
        VALUES ('orphan-import','orphan','P',1,NULL,1,'<0.0000123','IMPORTED','retained-time')`).run();
    const original=db.prepare("SELECT * FROM Result WHERE id='orphan-import'").get();db.close();
    const applied=installWorkAttemptContract({dbPath:file,apply:true});
    expect(applied).toMatchObject({newAttemptCount:1,linkedResultCount:1,receipt:{exemptImportCount:1,exemptImports:[{resultId:'orphan-import'}]}});
    const after=new Database(file,{readonly:true});
    expect(after.prepare("SELECT * FROM Result WHERE id='orphan-import'").get()).toEqual(original);
    expect(after.prepare("SELECT count(*) n FROM WorkItem WHERE sampleId='orphan'").get().n).toBe(0);after.close();
    expect(assertWorkAttemptStartupReady(file)).toMatchObject({classification:'COMPLETE',plan:{exemptImportCount:1}});
});

test('fresh Prisma gets partial uniqueness before COMPLETE (actual db push on Linux, compiler-emitted DDL on Windows)',()=>{
    const file=ownedFile();
    // Use the existing closed fixture authority: Linux/CI runs actual db push;
    // the Windows schema engine rejects owned URLs, so Prisma emits its DDL.
    beforeGuards({actor:'system:fixture',file,qcBootstrap:'CREATE_PRISMA'});
    const db=new Database(file);db.exec('CREATE TABLE _schema_migrations(id TEXT PRIMARY KEY,details TEXT NOT NULL)');db.close();
    expect(installWorkAttemptContract({dbPath:file})).toMatchObject({classification:'FRESH_PRISMA',totalChanges:0});
    expect(installWorkAttemptContract({dbPath:file,apply:true})).toMatchObject({classification:'COMPLETE',previousClassification:'FRESH_PRISMA',newAttemptCount:0,linkedResultCount:0});
    const installed=new Database(file,{readonly:true});
    expect(installed.prepare("SELECT sql FROM sqlite_master WHERE name='WorkAttempt_workItemId_attemptNo_unique'").get().sql).toMatch(/WHERE "legacyAttemptNoConflict" IS NULL$/);
    expect(installed.prepare("SELECT count(*) n FROM sqlite_master WHERE type='trigger' AND name LIKE 'WorkAttempt_%'").get().n).toBe(11);
    installed.close();expect(assertWorkAttemptStartupReady(file).classification).toBe('COMPLETE');
},60000);

test('startup refuses removed or altered guards without repairing schema automatically',()=>{
    const file=fixture();installWorkAttemptContract({dbPath:file,apply:true});const db=new Database(file);
    db.exec('DROP TRIGGER WorkAttempt_evidence_update');db.close();const before=hash(file);
    expect(()=>assertWorkAttemptStartupReady(file)).toThrow(expect.objectContaining({code:'WORK_ATTEMPT_SCHEMA_MISMATCH'}));
    expect(()=>installWorkAttemptContract({dbPath:file,apply:true})).toThrow(expect.objectContaining({code:'WORK_ATTEMPT_SCHEMA_MISMATCH'}));
    expect(hash(file)).toBe(before);
});

test('startup refuses edited backfill provenance even when the release source fields stay unchanged',()=>{
    const file=fixture();installWorkAttemptContract({dbPath:file,apply:true});const db=new Database(file);
    const receipt=JSON.parse(db.prepare('SELECT details FROM _schema_migrations WHERE id=?').get(MARKER).details);
    receipt.links[0].attemptId='altered-history';
    db.prepare('UPDATE _schema_migrations SET details=? WHERE id=?').run(JSON.stringify(receipt),MARKER);db.close();
    const before=hash(file);
    expect(()=>assertWorkAttemptStartupReady(file)).toThrow(expect.objectContaining({code:'WORK_ATTEMPT_SCHEMA_MISMATCH',
        differences:expect.arrayContaining(['WorkAttempt receipt integrity differs'])}));
    expect(hash(file)).toBe(before);
});

test('fresh unmarked conflict flags are refused rather than treated as trusted migration provenance',()=>{
    const file=fixture(),db=new Database(file);
    db.exec(require('../../services/workAttemptMigrationSource').loadWorkAttemptMigrationSource().schemaSql);
    db.prepare(`INSERT INTO WorkAttempt(id,workItemId,attemptNo,status,legacyAttemptNoConflict,createdAt,updatedAt)
        VALUES ('pretended','measured',1,'RECORDED','not-a-reviewed-migration','created','updated')`).run();db.close();
    const before=hash(file);
    expect(()=>installWorkAttemptContract({dbPath:file,apply:true})).toThrow(expect.objectContaining({code:'WORK_ATTEMPT_SCHEMA_MISMATCH',
        differences:expect.arrayContaining(['Unmarked conflict flags cannot be trusted as migration provenance'])}));
    expect(hash(file)).toBe(before);
});

test('CLI requires a database, refuses conflicting modes and does not default to a production path',()=>{
    expect(parseArguments(['--db','owned.db','--dry-run'])).toEqual({dbPath:'owned.db',apply:false});
    expect(parseArguments(['--db','owned.db','--apply'])).toEqual({dbPath:'owned.db',apply:true});
    for(const args of [[],['--apply'],['--db','owned.db','--apply','--dry-run'],['--db','owned.db','--unknown']])
        expect(()=>parseArguments(args)).toThrow(expect.objectContaining({code:'WORK_ATTEMPT_ARGUMENT_INVALID'}));
});
