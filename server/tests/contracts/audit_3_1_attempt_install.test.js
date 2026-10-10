const fs = require('node:fs'), path = require('node:path');
const { createHash, randomUUID } = require('node:crypto');
const Database = require('better-sqlite3');
const { installWorkAttemptContract, assertWorkAttemptStartupReady, parseArguments, MARKER } = require('../../scripts/install_work_attempt_contract');
const { beforeGuards } = require('../helpers/legacyWorkflowDatabase');
const { createPre190AttemptFixture } = require('../helpers/workAttemptHistoricalFixtures');
const { loadWorkAttemptMigrationSource } = require('../../services/workAttemptMigrationSource');
const { installResultAttemptLinks } = require('../../scripts/install_result_attempt_links');
const { installResultEquipmentEvidence } = require('../../scripts/install_result_equipment_evidence');
const { installWorkItemUniqueness, assertWorkItemUniquenessStartupReady, MARKER_ID, INDEX_ID,
    parseArguments: prerequisiteArguments } = require('../../scripts/install_workitem_uniqueness');
const { loadWorkItemDuplicateMarkerSource, loadActiveWorkItemIndexSource } = require('../../services/workItemUniquenessMigrationSource');
const { installWorkRepeatContract, assertWorkRepeatStartupReady, MARKER: REPEAT_MARKER } = require('../../scripts/install_work_repeat_contract');
const { loadWorkRepeatMigrationSource } = require('../../services/workRepeatMigrationSource');
const { repeatReleaseObjects } = require('../../services/workRepeatInstallationEvidence');
const ownedFiles = [];
const directory = path.resolve(__dirname,'../.tmp');
function ownedFile() {
    fs.mkdirSync(directory,{recursive:true});
    const file=path.join(directory,'audit_legacy_190_attempt_install-'+randomUUID()+'.db');ownedFiles.push(file);return file;
}
const timestamp='2026-10-01T12:00:00Z';
const sampleRow=id=>({id,originalId:id,status:'PROCESSING',updatedAt:timestamp});
const resultRow=(id,sampleId,options={})=>({id,sampleId,param:'P',replicateNo:1,attemptId:null,isCurrent:1,
    value:'0.123456789',provenance:'MEASURED',updatedAt:'original-timestamp',...options});
function fixture({status='ACCEPTED',equipmentReadiness=null,extra={},batchStatus='COMPLETED'}={}) {
    const file=ownedFile();
    const rows={Sample:[sampleRow('sample')],Batch:[{id:'batch',analysis:'P',status:batchStatus,createdBy:'system:fixture'}],
        WorkItem:[{id:'measured',sampleId:'sample',analysis:'P',status,result:'original cache',updatedAt:timestamp}],
        Result:[resultRow('result','sample',{equipmentReadiness,batchId:'batch'})],
        ReviewDecision:[{id:'legacy-review',sampleId:'sample',workItemId:'measured',decision:'ACCEPT',reviewerId:'system:fixture',reason:'stored reason'}],
        AuditLog:[{id:'original',entity:'Sample',entityId:'sample',action:'RETAINED',performedBy:'system:fixture',details:'unchanged technical audit'}]};
    for(const [table,entries] of Object.entries(extra))rows[table]=[...(rows[table]||[]),...entries];
    createPre190AttemptFixture({actor:'system:fixture',file,rows});
    const db=new Database(file);
    db.prepare('INSERT INTO _schema_migrations(id,details) VALUES (?,?)').run('prior-retained','{"original":"receipt"}');
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
        duplicateMarkerPrerequisite:{classification:'PARTIAL'},
        plan:{status:'READY',newAttempts:[{workItemId:'measured',attemptNo:1,status:'ACCEPTED'}],links:[{resultId:'result'}]}});
    expect(hash(file)).toBe(before);
    expect(()=>assertWorkAttemptStartupReady(file)).toThrow(expect.objectContaining({code:'WORK_ATTEMPT_NOT_INSTALLED'}));
    expect(hash(file)).toBe(before);
});

test.each(['SUBMITTED','ACCEPTED'])('191 release inventory reports %s work owned by RECORDED evidence without repairing it',status=>{
    // Keep the unrelated legacy run explicitly OPEN: a COMPLETED run without
    // QC evidence correctly refuses #186 and is a separate release defect.
    const file=fixture({status,batchStatus:'OPEN',extra:{WorkAttempt:[{id:'recorded-owner',workItemId:'measured',attemptNo:1,
        status:'RECORDED',evidenceHash:'retained-hash',evidenceData:'retained-evidence',createdAt:timestamp,updatedAt:timestamp}]}});
    installWorkAttemptContract({dbPath:file,apply:true});
    require('../helpers/repeatQcPredecessors').installRepeatQcPredecessors(file);
    const before=hash(file),rows=retained(file);
    const dry=installWorkRepeatContract({dbPath:file});
    expect(dry.releaseInventory).toEqual({blockedWorkItemCount:1,totalChanges:0,
        blockedWorkItems:[{workItemId:'measured',status,owners:[{attemptId:'recorded-owner',resultIds:['result']}]}]});
    expect(dry.totalChanges).toBe(0);expect(hash(file)).toBe(before);expect(retained(file)).toEqual(rows);
    installWorkRepeatContract({dbPath:file,apply:true});
    const installed=hash(file);
    expect(assertWorkRepeatStartupReady(file).releaseInventory).toEqual(dry.releaseInventory);
    expect(hash(file)).toBe(installed);
});

test('atomic additive apply links every Result, records provenance, preserves original values and is idempotent',()=>{
    const file=fixture(),before=retained(file);
    const applied=installWorkAttemptContract({dbPath:file,apply:true});
    expect(applied).toMatchObject({classification:'COMPLETE',previousClassification:'PRE_190',mode:'APPLIED',
        newAttemptCount:1,linkedResultCount:1,flaggedAttemptCount:0,bootstrapRebuild:[],
        receipt:{originalRowsAndFieldsPreserved:true,duplicateMarkerPrerequisite:{classification:'PARTIAL'},
            createdAttempts:[{workItemId:'measured',sourceStatus:'ACCEPTED',status:'ACCEPTED',resultIds:['result']}]}});
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
    const frozen=JSON.stringify({equipmentId:'frozen-id',evaluatedAt:'retained-measurement-time',readiness:'READY'});
    const file=fixture({equipmentReadiness:frozen,extra:{Sample:[sampleRow('other-sample'),sampleRow('empty-sample')],
        WorkItem:[{id:'duplicates',sampleId:'other-sample',analysis:'P',status:'REPEAT_REQUIRED',result:'retained',updatedAt:timestamp},
            {id:'empty',sampleId:'empty-sample',analysis:'P',status:'NOT_ASSIGNED',result:null,updatedAt:timestamp}],
        WorkAttempt:[{id:'old-one',workItemId:'duplicates',attemptNo:4,status:'RETURNED',qcBatchId:'batch',evidenceData:'{"old":1}',
            evidenceHash:'hash-one',instrumentId:'old-one-instrument',createdAt:'old-created',updatedAt:'old-updated'},
            {id:'old-two',workItemId:'duplicates',attemptNo:4,status:'REJECTED',qcBatchId:'missing-batch',evidenceData:'{"old":2}',
                evidenceHash:'hash-two',instrumentId:'old-two-instrument',createdAt:'old-created',updatedAt:'old-updated'}]}}),db=new Database(file);
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
    const file=fixture({status});
    const before=hash(file);
    expect(installWorkAttemptContract({dbPath:file})).toMatchObject({plan:{status:'REFUSED',blockers:[{sourceStatus:status}]},totalChanges:0});
    expect(()=>installWorkAttemptContract({dbPath:file,apply:true})).toThrow(expect.objectContaining({code:'WORK_ATTEMPT_BACKFILL_REFUSED'}));
    expect(hash(file)).toBe(before);
});

test('unmatched Results and current-result collisions are both reported and never partially applied',()=>{
    const file=fixture({extra:{Sample:[sampleRow('missing-sample')],Result:[
        resultRow('conflict','sample',{value:'other retained value',equipmentReadiness:null,batchId:'batch',updatedAt:'retained'}),
        resultRow('unmatched','missing-sample',{value:'unmatched scientific value',equipmentReadiness:null,batchId:null,updatedAt:'retained'})]}});
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
    const file=fixture({extra:{Sample:[sampleRow('orphan')],Result:[
        resultRow('orphan-import','orphan',{value:'<0.0000123',provenance:'IMPORTED',updatedAt:'retained-time'})]}}),db=new Database(file);
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
    const db=new Database(file);db.exec('CREATE TABLE "_schema_migrations" ("id" TEXT PRIMARY KEY NOT NULL, "appliedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "details" TEXT)');db.close();
    expect(installWorkItemUniqueness({dbPath:file,apply:true})).toMatchObject({classification:'COMPLETE',previousClassification:'FRESH_PRISMA'});
    expect(installWorkAttemptContract({dbPath:file})).toMatchObject({classification:'FRESH_PRISMA',totalChanges:0});
    expect(installWorkAttemptContract({dbPath:file,apply:true})).toMatchObject({classification:'COMPLETE',previousClassification:'FRESH_PRISMA',newAttemptCount:0,linkedResultCount:0,
        duplicateMarkerPrerequisite:{classification:'COMPLETE'},receipt:{duplicateMarkerPrerequisite:{classification:'COMPLETE'}}});
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
    const source=loadWorkAttemptMigrationSource(); db.exec(source.schemaSql);
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

function emptyMarkerFixture() {
    const file=ownedFile();
    createPre190AttemptFixture({actor:'system:fixture',file,rows:{}});
    return file;
}

// Pin6063339165: the genuine owned ABSENT baseline with the prior reviewed
// Result additions installed. No ad-hoc SQL loader or factory authority change.
function absentAttemptMarkerFixture({foreignIndex=false}={}) {
    const file=absentMarkerFixture();
    expect(installResultAttemptLinks({dbPath:file,apply:true}).classification).toBe('COMPLETE');
    expect(installResultEquipmentEvidence({dbPath:file,apply:true}).classification).toBe('COMPLETE');
    const db=new Database(file,{fileMustExist:true});
    try {
        if(foreignIndex)db.exec('CREATE UNIQUE INDEX "WorkItem_one_active_per_analysis" ON "WorkItem"("id")');
        expect(db.prepare('PRAGMA table_xinfo("WorkItem")').all().some(row=>row.name==='duplicateOf')).toBe(false);
        expect(db.prepare('PRAGMA foreign_key_list("WorkItem")').all().some(row=>row.from==='duplicateOf')).toBe(false);
        expect(db.pragma('foreign_key_check')).toEqual([]);
    } finally { db.close(); }
    return file;
}

test.each([['ABSENT',false],['FOREIGN',true]])('missing duplicateOf reports %s without planning; apply and startup refuse without changing bytes',(classification,foreignIndex)=>{
    const file=absentAttemptMarkerFixture({foreignIndex}),before=retained(file),bytes=hash(file);
    expect(installWorkAttemptContract({dbPath:file})).toMatchObject({classification:'PRE_190',mode:'DRY_RUN',totalChanges:0,
        duplicateMarkerPrerequisite:{classification},code:'WORK_ATTEMPT_PREREQUISITE_INCOMPLETE',plan:null});
    expect(retained(file)).toEqual(before);expect(hash(file)).toBe(bytes);
    const refusal=expect.objectContaining({code:'WORK_ATTEMPT_PREREQUISITE_INCOMPLETE',totalChanges:0,
        duplicateMarkerPrerequisite:expect.objectContaining({classification})});
    expect(()=>installWorkAttemptContract({dbPath:file,apply:true})).toThrow(refusal);
    expect(()=>assertWorkAttemptStartupReady(file)).toThrow(refusal);
    expect(retained(file)).toEqual(before);expect(hash(file)).toBe(bytes);
});

function absentMarkerFixture({duplicates=false}={}) {
    const file=ownedFile(),now=Date.UTC(2026,9,1);
    beforeGuards({actor:'system:fixture',file,schemaVariant:'PRE_1_1_DUPLICATES',markerPending:true,
        samples:[{id:'old-sample',originalId:'old-sample',status:'PROCESSING',createdAt:now,updatedAt:now}],
        workItems:(duplicates?['original-one','original-two']:['original-one']).map(id=>
            ({id,sampleId:'old-sample',analysis:'PH',status:'NOT_ASSIGNED',updatedAt:now}))});
    const db=new Database(file);
    // The prior #179 ledger definition; no receipt or analytical row is invented.
    db.exec('CREATE TABLE "_schema_migrations" ("id" TEXT PRIMARY KEY NOT NULL, "appliedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "details" TEXT)');
    db.prepare('INSERT INTO _schema_migrations(id,details) VALUES (?,?)').run('prior-retained','{"original":"receipt"}');
    db.close();return file;
}

test('ABSENT prerequisite applies the two shipped sources and receipts atomically, preserving every original row',()=>{
    const file=absentMarkerFixture(),before=retained(file),bytes=hash(file);
    expect(installWorkItemUniqueness({dbPath:file})).toMatchObject({classification:'ABSENT',mode:'DRY_RUN',
        workItemCount:1,duplicateGroupCount:0,duplicateGroups:[],totalChanges:0});
    expect(hash(file)).toBe(bytes);
    const applied=installWorkItemUniqueness({dbPath:file,apply:true});
    expect(applied).toMatchObject({previousClassification:'ABSENT',classification:'COMPLETE',mode:'APPLIED',
        receiptsInserted:2,totalChanges:2,preservation:{originalRowsAndFieldsPreserved:true}});
    expect(applied.preservation.before).toEqual(applied.preservation.after);
    const after=retained(file);
    expect(after.find(row=>row.table==='WorkItem').rows.map(({duplicateOf,...row})=>row))
        .toEqual(before.find(row=>row.table==='WorkItem').rows);
    for(const table of ['WorkAttempt','Result','ReviewDecision','AuditLog'])
        expect(after.find(row=>row.table===table)).toEqual(before.find(row=>row.table===table));
    const db=new Database(file,{readonly:true});
    for(const id of [MARKER_ID,INDEX_ID]) {
        const receipt=JSON.parse(db.prepare('SELECT details FROM _schema_migrations WHERE id=?').get(id).details);
        expect(receipt).toMatchObject({classification:'ABSENT',mode:'APPLIED',sourceExecuted:true,
            workItemCount:1,duplicateGroupCount:0,preservation:{originalRowsAndFieldsPreserved:true}});
        expect(receipt.sqlSha256).toBe(applied.sources.find(row=>row.id===id).sqlSha256);
    }
    expect(db.pragma('foreign_key_check')).toEqual([]);db.close();
    const complete=hash(file);
    expect(installWorkItemUniqueness({dbPath:file,apply:true})).toMatchObject({classification:'COMPLETE',mode:'NO_OP',totalChanges:0});
    expect(assertWorkItemUniquenessStartupReady(file).classification).toBe('COMPLETE');expect(hash(file)).toBe(complete);
});

test('one baseline duplicate group reports every ID and refuses apply and startup with zero changes',()=>{
    const file=absentMarkerFixture({duplicates:true}),before=retained(file),bytes=hash(file);
    const report=installWorkItemUniqueness({dbPath:file});
    expect(report).toMatchObject({classification:'ABSENT',workItemCount:2,duplicateGroupCount:1,
        duplicateGroups:[{sampleId:'old-sample',analysis:'PH',workItemIds:['original-one','original-two']}],totalChanges:0});
    expect(()=>installWorkItemUniqueness({dbPath:file,apply:true})).toThrow(expect.objectContaining({
        code:'WORKITEM_PREREQUISITE_DUPLICATES',report:expect.objectContaining({duplicateGroups:report.duplicateGroups})}));
    expect(()=>assertWorkItemUniquenessStartupReady(file)).toThrow(expect.objectContaining({code:'WORKITEM_PREREQUISITE_NOT_INSTALLED'}));
    expect(retained(file)).toEqual(before);expect(hash(file)).toBe(bytes);
});

test('a second prerequisite receipt failure rolls back both schema objects and the first receipt',()=>{
    const file=absentMarkerFixture(),db=new Database(file);
    db.exec(`CREATE TRIGGER owned_prerequisite_receipt_fault BEFORE INSERT ON _schema_migrations WHEN NEW.id='${INDEX_ID}'
        BEGIN SELECT RAISE(ABORT,'OWNED_PREREQUISITE_RECEIPT_FAULT'); END;`);db.close();
    const before=retained(file);
    expect(()=>installWorkItemUniqueness({dbPath:file,apply:true})).toThrow('OWNED_PREREQUISITE_RECEIPT_FAULT');
    expect(retained(file)).toEqual(before);expect(installWorkItemUniqueness({dbPath:file}).classification).toBe('ABSENT');
});

test('empty Prisma bootstrap verifies the existing column/FK, executes only the shipped index and records honest receipts',()=>{
    const file=emptyMarkerFixture(),before=retained(file);
    expect(installWorkItemUniqueness({dbPath:file})).toMatchObject({classification:'FRESH_PRISMA',workItemCount:0,duplicateGroupCount:0,totalChanges:0});
    const applied=installWorkItemUniqueness({dbPath:file,apply:true});
    expect(applied).toMatchObject({classification:'COMPLETE',previousClassification:'FRESH_PRISMA',receiptsInserted:2,totalChanges:2});
    expect(applied.preservation.before).toEqual(applied.preservation.after);
    const db=new Database(file,{readonly:true});
    expect(db.prepare('PRAGMA table_xinfo("WorkItem")').all().filter(row=>row.name==='duplicateOf')).toHaveLength(1);
    expect(db.prepare('PRAGMA foreign_key_list("WorkItem")').all().filter(row=>row.from==='duplicateOf'))
        .toEqual([expect.objectContaining({table:'WorkItem',to:'id',on_delete:'RESTRICT',on_update:'CASCADE'})]);
    const marker=JSON.parse(db.prepare('SELECT details FROM _schema_migrations WHERE id=?').get(MARKER_ID).details);
    const index=JSON.parse(db.prepare('SELECT details FROM _schema_migrations WHERE id=?').get(INDEX_ID).details);
    expect(marker).toMatchObject({mode:'FRESH_PRISMA_BOOTSTRAP',sourceExecuted:false,columnAndForeignKeyVerified:true});
    expect(index).toMatchObject({mode:'APPLIED',sourceExecuted:true});db.close();
    for(const row of before.filter(row=>row.table && row.table!=='_schema_migrations'))
        expect(retained(file).find(after=>after.table===row.table)).toEqual(row);
});

test('populated Prisma-shaped WorkItem without prerequisite receipts is PARTIAL and refuses all writes',()=>{
    const file=fixture(),before=retained(file),bytes=hash(file);
    expect(installWorkItemUniqueness({dbPath:file})).toMatchObject({classification:'PARTIAL',workItemCount:1});
    expect(()=>installWorkItemUniqueness({dbPath:file,apply:true})).toThrow(expect.objectContaining({code:'WORKITEM_PREREQUISITE_SCHEMA_MISMATCH'}));
    expect(retained(file)).toEqual(before);expect(hash(file)).toBe(bytes);
});

test('an empty Prisma schema with the index but no receipts is PARTIAL, never adopted or repaired',()=>{
    const file=emptyMarkerFixture(),db=new Database(file),source=loadActiveWorkItemIndexSource();db.exec(source.sql);db.close();
    const before=retained(file),bytes=hash(file);
    expect(installWorkItemUniqueness({dbPath:file})).toMatchObject({classification:'PARTIAL',workItemCount:0});
    expect(()=>installWorkItemUniqueness({dbPath:file,apply:true})).toThrow(expect.objectContaining({code:'WORKITEM_PREREQUISITE_SCHEMA_MISMATCH'}));
    expect(retained(file)).toEqual(before);expect(hash(file)).toBe(bytes);
});

test('Prisma-shaped historical Results prevent fresh bootstrap even when WorkItem and WorkAttempt are empty',()=>{
    const file=ownedFile();
    createPre190AttemptFixture({actor:'system:fixture',file,rows:{Sample:[sampleRow('imported')],
        Result:[resultRow('imported-result','imported',{provenance:'IMPORTED'})]}});
    const before=retained(file),bytes=hash(file);
    expect(installWorkItemUniqueness({dbPath:file})).toMatchObject({classification:'PARTIAL',workItemCount:0,executionTablesEmpty:false});
    expect(()=>installWorkItemUniqueness({dbPath:file,apply:true})).toThrow(expect.objectContaining({code:'WORKITEM_PREREQUISITE_SCHEMA_MISMATCH'}));
    expect(retained(file)).toEqual(before);expect(hash(file)).toBe(bytes);
});

test('an unexpected index definition is FOREIGN and refused even on an empty owned schema',()=>{
    const file=emptyMarkerFixture(),db=new Database(file);
    db.exec('CREATE UNIQUE INDEX "WorkItem_one_active_per_analysis" ON "WorkItem"("id")');db.close();
    const before=retained(file),bytes=hash(file);
    expect(installWorkItemUniqueness({dbPath:file})).toMatchObject({classification:'FOREIGN',differences:['Active WorkItem index definition differs']});
    expect(()=>installWorkItemUniqueness({dbPath:file,apply:true})).toThrow(expect.objectContaining({code:'WORKITEM_PREREQUISITE_SCHEMA_MISMATCH'}));
    expect(retained(file)).toEqual(before);expect(hash(file)).toBe(bytes);
});

test('legacy #178 receipts match only their source digests and remain byte-for-byte unchanged on COMPLETE NO_OP',()=>{
    const file=emptyMarkerFixture(),db=new Database(file),source=loadActiveWorkItemIndexSource();db.exec(source.sql);
    const markerSource=loadWorkItemDuplicateMarkerSource();
    for(const [id,sqlSha256] of [[MARKER_ID,markerSource.sha256],[INDEX_ID,source.sha256]])
        db.prepare('INSERT INTO _schema_migrations(id,details) VALUES (?,?)').run(id,JSON.stringify({
            release:'1.8.0-audit-1.1-pr243',sqlSha256,backupSha256:'original-backup',
            backfill:{originalCount:8},duplicatesResolved:0}));
    db.close();const before=retained(file),bytes=hash(file);
    expect(installWorkItemUniqueness({dbPath:file,apply:true})).toMatchObject({classification:'COMPLETE',mode:'NO_OP',totalChanges:0});
    expect(retained(file)).toEqual(before);expect(hash(file)).toBe(bytes);
});

test('COMPLETE legacy prerequisite remains intact when the separate #190 migration later refuses',()=>{
    const file=fixture({status:'unknown'}),db=new Database(file),source=loadActiveWorkItemIndexSource();db.exec(source.sql);
    const markerSource=loadWorkItemDuplicateMarkerSource();
    for(const [id,sqlSha256] of [[MARKER_ID,markerSource.sha256],[INDEX_ID,source.sha256]])
        db.prepare('INSERT INTO _schema_migrations(id,details) VALUES (?,?)').run(id,JSON.stringify({sqlSha256,release:'retained #178'}));
    db.close();const before=retained(file),bytes=hash(file);
    expect(installWorkItemUniqueness({dbPath:file,apply:true})).toMatchObject({classification:'COMPLETE',mode:'NO_OP',totalChanges:0});
    expect(installWorkAttemptContract({dbPath:file})).toMatchObject({duplicateMarkerPrerequisite:{classification:'COMPLETE'},plan:{status:'REFUSED'}});
    expect(()=>installWorkAttemptContract({dbPath:file,apply:true})).toThrow(expect.objectContaining({code:'WORK_ATTEMPT_BACKFILL_REFUSED'}));
    expect(retained(file)).toEqual(before);expect(hash(file)).toBe(bytes);
    expect(()=>assertWorkAttemptStartupReady(file)).toThrow(expect.objectContaining({code:'WORK_ATTEMPT_NOT_INSTALLED'}));
    expect(assertWorkItemUniquenessStartupReady(file).classification).toBe('COMPLETE');
});

test.each(['unparseable','missing-sha','wrong-sha','missing-object'])(
    'a foreign prerequisite receipt (%s) refuses without rewriting provenance',kind=>{
        const file=emptyMarkerFixture(),db=new Database(file),source=loadActiveWorkItemIndexSource();
        if(kind!=='missing-object')db.exec(source.sql);
        const markerSource=loadWorkItemDuplicateMarkerSource();
        db.prepare('INSERT INTO _schema_migrations(id,details) VALUES (?,?)').run(MARKER_ID,
            kind==='unparseable'?'{':JSON.stringify(kind==='missing-sha'?{}:{sqlSha256:kind==='wrong-sha'?'foreign-source':markerSource.sha256}));
        db.prepare('INSERT INTO _schema_migrations(id,details) VALUES (?,?)').run(INDEX_ID,JSON.stringify({sqlSha256:source.sha256}));
        db.close();const before=retained(file),bytes=hash(file);
        expect(installWorkItemUniqueness({dbPath:file}).classification).toBe('FOREIGN');
        expect(()=>installWorkItemUniqueness({dbPath:file,apply:true})).toThrow(expect.objectContaining({code:'WORKITEM_PREREQUISITE_SCHEMA_MISMATCH'}));
        expect(retained(file)).toEqual(before);expect(hash(file)).toBe(bytes);
    });

test('prerequisite CLI needs an explicit owned path and refuses duplicate, incomplete and conflicting options',()=>{
    expect(prerequisiteArguments(['--db','owned.db','--apply'])).toEqual({dbPath:'owned.db',apply:true});
    expect(prerequisiteArguments(['--db','owned.db','--dry-run'])).toEqual({dbPath:'owned.db',apply:false});
    for(const args of [[],['--db'],['--db','owned.db','--apply','--dry-run'],['--db','owned.db','--db','other.db'],['--db','owned.db','--unknown']])
        expect(()=>prerequisiteArguments(args)).toThrow(expect.objectContaining({code:'WORKITEM_PREREQUISITE_ARGUMENT_INVALID'}));
});

// #191 chain rehearsals stay in this already authorized, literal historical
// factory caller. The factory bytes and its closed caller list are unchanged.
function repeatFixture({ interim = false } = {}) {
    const file = fixture({ batchStatus: 'OPEN', extra: {
        WorkItem: [{ id: 'open-work', sampleId: 'sample', analysis: 'Q', status: 'IN_PROGRESS', updatedAt: timestamp }],
        WorkAttempt: [{ id: 'open-attempt', workItemId: 'open-work', attemptNo: 1, status: 'OPEN', createdAt: timestamp, updatedAt: timestamp },
            ...(interim ? [{ id: 'interim-repeat', workItemId: 'open-work', attemptNo: 2, status: 'RECORDED',
                author: 'historical-tech', evidenceData: '{"retained":true}', evidenceHash: 'historical-hash', createdAt: timestamp, updatedAt: timestamp }] : [])]
    } });
    expect(installWorkAttemptContract({ dbPath: file, apply: true }).classification).toBe('COMPLETE');
    require('../helpers/repeatQcPredecessors').installRepeatQcPredecessors(file);
    return file;
}

test('#191 retained dry-run/apply/no-op preserves every original field and the exact #190 receipt', () => {
    const file = repeatFixture({ interim: true }), before = retained(file), bytes = hash(file);
    const original = new Database(file, { readonly: true, fileMustExist: true });
    let originalRowsSha256;
    try {
        originalRowsSha256 = createHash('sha256').update(JSON.stringify(Object.fromEntries(['WorkAttempt','WorkItem','Result','ReviewDecision','AuditLog','_schema_migrations',
            'Batch','BatchAnalyte','BatchPosition','BatchPositionWorkItem','BatchPositionReference','QcMeasurement','QcEvaluation','BatchDisposition','BatchEvent']
            .map(table => [table, original.prepare('SELECT * FROM "'+table+'" ORDER BY id').all()])))).digest('hex');
    } finally { original.close(); }
    expect(installWorkRepeatContract({ dbPath: file })).toMatchObject({ classification: 'PRE_191', mode: 'DRY_RUN', totalChanges: 0,
        plan: { reasonNotRecordedCount: 1, backfilledCount: 0, reasonNotRecorded: [{ id: 'interim-repeat', description: 'reason not recorded', reason: null }] } });
    expect(hash(file)).toBe(bytes);
    expect(() => assertWorkRepeatStartupReady(file)).toThrow(expect.objectContaining({ code: 'WORK_REPEAT_NOT_INSTALLED' }));
    const applied = installWorkRepeatContract({ dbPath: file, apply: true });
    expect(applied).toMatchObject({ classification: 'COMPLETE', previousClassification: 'PRE_191', mode: 'APPLIED', totalChanges: 1,
        newAttemptCount: 0, linkedResultCount: 0, backfilledCount: 0, receipt: { originalRowsAndFieldsPreserved: true, reasonNotRecordedCount: 1, originalRowsSha256 } });
    const after = retained(file);
    for (const group of before.filter(row => row.table)) {
        const rows = after.find(row => row.table === group.table).rows;
        expect(group.table === '_schema_migrations' ? rows.filter(row => row.id !== REPEAT_MARKER) : rows)
            .toEqual(group.table === 'WorkAttempt' ? group.rows.map(row => ({ ...row, parentAttemptId: null, note: null })) : group.rows);
    }
    const installedBytes = hash(file);
    expect(installWorkRepeatContract({ dbPath: file, apply: true })).toMatchObject({ classification: 'COMPLETE', mode: 'NO_OP', totalChanges: 0 });
    expect(installWorkAttemptContract({ dbPath: file, apply: true })).toMatchObject({ classification: 'COMPLETE', mode: 'NO_OP', totalChanges: 0 });
    expect(assertWorkAttemptStartupReady(file).classification).toBe('COMPLETE');
    expect(assertWorkRepeatStartupReady(file).classification).toBe('COMPLETE');
    expect(require('../../scripts/install_qc_runs').assertQcRunStartupReady(file).classification).toBe('COMPLETE');
    expect(require('../../scripts/install_qc_gate_scope').assertQcGateScopeStartupReady(file).classification).toBe('COMPLETE');
    expect(require('../../scripts/install_qc_runs').installQcRuns({dbPath:file,apply:true})).toMatchObject({mode:'NO_OP',totalChanges:0});
    expect(require('../../scripts/install_qc_gate_scope').installQcGateScope({dbPath:file,apply:true})).toMatchObject({mode:'NO_OP',totalChanges:0});
    expect(hash(file)).toBe(installedBytes);
});

test('#191 installs the same verified chain on an empty current-Prisma column shape', () => {
    const file = repeatFixture(), db = new Database(file), source = loadWorkRepeatMigrationSource();
    db.exec(source.schemaSql); db.close();
    expect(installWorkRepeatContract({ dbPath: file })).toMatchObject({ classification: 'FRESH_PRISMA', totalChanges: 0 });
    expect(installWorkRepeatContract({ dbPath: file, apply: true })).toMatchObject({ classification: 'COMPLETE', previousClassification: 'FRESH_PRISMA', mode: 'APPLIED' });
});

test.each(['missing-186-receipt', 'missing-187-receipt', 'missing-190-receipt', 'missing-191-receipt',
    'tampered-186-receipt', 'tampered-187-receipt', 'tampered-190-receipt', 'tampered-191-receipt',
    'missing-successor', 'altered-successor', 'missing-membership-successor', 'altered-membership-successor',
    'missing-event-guard', 'partial-column', 'receipt-before-guards'])(
    '#191 broken chain (%s) refuses dry-run/apply/startup without changing database bytes', kind => {
        const file = repeatFixture();
        if (!['partial-column', 'receipt-before-guards'].includes(kind)) installWorkRepeatContract({ dbPath: file, apply: true });
        const db = new Database(file);
        const receiptMarkers = { '186': '186_normalized_qc_runs', '187': '187_qc_gate_scope', '190': MARKER, '191': REPEAT_MARKER };
        if (kind.startsWith('missing-') && kind.endsWith('-receipt')) db.prepare('DELETE FROM _schema_migrations WHERE id=?').run(receiptMarkers[kind.split('-')[1]]);
        if (kind.startsWith('tampered-')) db.prepare('UPDATE _schema_migrations SET details=? WHERE id=?').run('{}', receiptMarkers[kind.split('-')[1]]);
        if (kind === 'missing-successor') db.exec('DROP TRIGGER WorkAttempt_evidence_update');
        if (kind === 'altered-successor') db.exec("DROP TRIGGER WorkAttempt_identity_update; CREATE TRIGGER WorkAttempt_identity_update BEFORE UPDATE ON WorkAttempt BEGIN SELECT RAISE(ABORT,'foreign guard'); END;");
        if (kind === 'missing-membership-successor') db.exec('DROP TRIGGER WorkItem_batch_membership_guard');
        if (kind === 'altered-membership-successor') db.exec("DROP TRIGGER WorkItem_batch_membership_guard; CREATE TRIGGER WorkItem_batch_membership_guard BEFORE UPDATE ON WorkItem BEGIN SELECT RAISE(ABORT,'foreign guard'); END;");
        if (kind === 'missing-event-guard') db.exec('DROP TRIGGER AuditLog_attempt_event_update');
        if (kind === 'partial-column') db.exec('ALTER TABLE WorkAttempt ADD COLUMN parentAttemptId TEXT');
        if (kind === 'receipt-before-guards') db.prepare('INSERT INTO _schema_migrations(id,details) VALUES (?,?)').run(REPEAT_MARKER, '{}');
        db.close(); const before = retained(file), bytes = hash(file);
        for (const run of [() => installWorkRepeatContract({ dbPath: file }), () => installWorkRepeatContract({ dbPath: file, apply: true }), () => assertWorkRepeatStartupReady(file)]) {
            expect(run).toThrow(); expect(retained(file)).toEqual(before); expect(hash(file)).toBe(bytes);
        }
    });

test('#191 receipt-write failure rolls back columns and all guard replacements together', () => {
    const file = repeatFixture(), db = new Database(file);
    db.exec(`CREATE TRIGGER owned_repeat_receipt_fault BEFORE INSERT ON _schema_migrations WHEN NEW.id='${REPEAT_MARKER}' BEGIN SELECT RAISE(ABORT,'OWNED_REPEAT_RECEIPT_FAULT'); END;`);
    db.close(); const before = retained(file);
    expect(() => installWorkRepeatContract({ dbPath: file, apply: true })).toThrow('OWNED_REPEAT_RECEIPT_FAULT');
    expect(retained(file)).toEqual(before);
    expect(installWorkRepeatContract({ dbPath: file }).classification).toBe('PRE_191');
    expect(assertWorkAttemptStartupReady(file).classification).toBe('COMPLETE');
});

const firstFill = { status: 'RECORDED', evidenceData: '{"equipmentReadiness":{"equipmentId":"actual-instrument"}}',
    instrumentId: 'actual-instrument', executedMethodRevision: 'method-v2', author: 'authenticated-tech', authorName: 'Authenticated Technician',
    qcBatchId: 'batch', materialAliquot: 'aliquot-ref' };
firstFill.evidenceHash = createHash('sha256').update(firstFill.evidenceData).digest('hex');
function fill(db, changes = {}) {
    const values = { ...db.prepare('SELECT * FROM WorkAttempt WHERE id=?').get('open-attempt'), ...firstFill, ...changes };
    if(Object.hasOwn(changes,'legacyAttemptNoConflict'))return db.prepare('UPDATE WorkAttempt SET status=?,evidenceData=?,evidenceHash=?,legacyAttemptNoConflict=? WHERE id=?')
        .run(values.status,values.evidenceData,values.evidenceHash,values.legacyAttemptNoConflict,'open-attempt');
    return db.prepare(`UPDATE WorkAttempt SET status=?,evidenceData=?,evidenceHash=?,instrumentId=?,executedMethodRevision=?,author=?,authorName=?,qcBatchId=?,materialAliquot=?,
        id=?,workItemId=?,orderLineId=?,attemptNo=?,batchId=?,reason=?,requestedBy=?,requestedAt=?,parentAttemptId=?,note=?,rawData=?,calcVersion=?,dilutionFactor=?,aliquotId=?,version=?,createdAt=?,updatedAt=? WHERE id=?`)
        .run(...['status','evidenceData','evidenceHash','instrumentId','executedMethodRevision','author','authorName','qcBatchId','materialAliquot',
            'id','workItemId','orderLineId','attemptNo','batchId','reason','requestedBy','requestedAt','parentAttemptId','note','rawData','calcVersion','dilutionFactor','aliquotId','version','createdAt','updatedAt']
            .map(name => values[name]), 'open-attempt');
}
test('#191 actual SQLite guards permit exactly one NULL-only first fill and freeze it immediately', () => {
    const file = repeatFixture(); installWorkRepeatContract({ dbPath: file, apply: true });
    const db = new Database(file); db.pragma('foreign_keys=ON');
    try {
        const before = db.prepare('SELECT * FROM WorkAttempt WHERE id=?').get('open-attempt');
        expect(fill(db).changes).toBe(1);
        const after = db.prepare('SELECT * FROM WorkAttempt WHERE id=?').get('open-attempt');
        expect(after).toEqual({ ...before, ...firstFill });
        for (const name of Object.keys(firstFill).filter(name => name !== 'status')) {
            expect(() => db.prepare(`UPDATE WorkAttempt SET "${name}"=? WHERE id=?`).run('second fill', 'open-attempt')).toThrow();
            expect(db.prepare('SELECT * FROM WorkAttempt WHERE id=?').get('open-attempt')).toEqual(after);
        }
        expect(() => db.prepare('UPDATE WorkAttempt SET status=? WHERE id=?').run('OPEN', 'open-attempt')).toThrow('WORK_ATTEMPT_TRANSITION_REFUSED');
    } finally { db.close(); }
});

test.each(['id','workItemId','orderLineId','attemptNo','batchId','reason','requestedBy','requestedAt','parentAttemptId','note',
    'rawData','calcVersion','dilutionFactor','aliquotId','legacyAttemptNoConflict','version','createdAt','updatedAt'])(
    '#191 refuses changing frozen %s during first fill with zero changes', name => {
        const file = repeatFixture(); installWorkRepeatContract({ dbPath: file, apply: true });
        const db = new Database(file); db.pragma('foreign_keys=ON');
        try {
            const before = db.prepare('SELECT * FROM WorkAttempt WHERE id=?').get('open-attempt');
            const changesBefore = db.prepare('SELECT total_changes() n').get().n;
            const value = ['attemptNo', 'version'].includes(name) ? 3 : name === 'dilutionFactor' ? 2 : 'changed';
            expect(() => fill(db, { [name]: value })).toThrow();
            expect(db.prepare('SELECT total_changes() n').get().n).toBe(changesBefore);
            expect(db.prepare('SELECT * FROM WorkAttempt WHERE id=?').get('open-attempt')).toEqual(before);
        } finally { db.close(); }
    });

test('#191 an unreviewed added column is frozen by default under actual SQLite triggers', () => {
    const file = repeatFixture(); installWorkRepeatContract({ dbPath: file, apply: true });
    const db = new Database(file);
    try {
        db.exec('ALTER TABLE WorkAttempt ADD COLUMN unreviewedEvidence TEXT');
        expect(() => db.prepare('UPDATE WorkAttempt SET unreviewedEvidence=? WHERE id=?').run('caller value', 'open-attempt')).toThrow('WORK_ATTEMPT_COLUMN_CONTRACT_MISMATCH');
        expect(() => fill(db)).toThrow('WORK_ATTEMPT_COLUMN_CONTRACT_MISMATCH');
    } finally { db.close(); }
    const bytes = hash(file);
    expect(() => assertWorkRepeatStartupReady(file)).toThrow(expect.objectContaining({ code: 'WORK_REPEAT_SCHEMA_MISMATCH' }));
    expect(hash(file)).toBe(bytes);
});

test('#191 attempt audit events cannot be rewritten, retagged or deleted; other audit entities retain their behaviour', () => {
    const file = repeatFixture(); installWorkRepeatContract({ dbPath: file, apply: true });
    const db = new Database(file);
    try {
        db.prepare('INSERT INTO AuditLog(id,entity,entityId,action,performedBy,details) VALUES (?,?,?,?,?,?)')
            .run('attempt-event', 'WORK_ATTEMPT', 'open-attempt', 'CREATED', 'authenticated-tech', '{"from":null,"to":"OPEN"}');
        const before = db.prepare('SELECT * FROM AuditLog WHERE id=?').get('attempt-event');
        expect(() => db.prepare('UPDATE AuditLog SET details=? WHERE id=?').run('changed','attempt-event')).toThrow('WORK_ATTEMPT_EVENT_IMMUTABLE');
        expect(() => db.prepare('UPDATE AuditLog SET entity=? WHERE id=?').run('changed','attempt-event')).toThrow('WORK_ATTEMPT_EVENT_IMMUTABLE');
        expect(() => db.prepare('DELETE FROM AuditLog WHERE id=?').run('attempt-event')).toThrow('WORK_ATTEMPT_EVENT_IMMUTABLE');
        expect(db.prepare('SELECT * FROM AuditLog WHERE id=?').get('attempt-event')).toEqual(before);
        expect(db.prepare('UPDATE AuditLog SET details=? WHERE id=?').run('ordinary updated details', 'original').changes).toBe(1);
        expect(() => db.prepare('UPDATE AuditLog SET entity=? WHERE id=?').run('WORK_ATTEMPT', 'original')).toThrow('WORK_ATTEMPT_EVENT_IMMUTABLE');
        expect(db.prepare('DELETE FROM AuditLog WHERE id=?').run('original').changes).toBe(1);
    } finally { db.close(); }
});

test('#191 release objects include the two exact successors and both append-only event guards', () => {
    expect(repeatReleaseObjects().map(row => row.name)).toEqual(expect.arrayContaining([
        'WorkAttempt_evidence_update', 'WorkAttempt_identity_update', 'WorkItem_batch_membership_guard', 'AuditLog_attempt_event_update', 'AuditLog_attempt_event_delete'
    ]));
});

// YY decision 2026-10-10 ("Link recorded accept"): legacy ACCEPTED work whose
// stored ACCEPT decision pre-dates attempt review is linked before #191.
describe('#191 recorded-acceptance link between the #190 and #191 installers', () => {
    const { linkRecordedAcceptance, parseArguments: linkArguments, ACTOR } = require('../../scripts/link_recorded_acceptance');
    const attemptAt = '2026-09-08T13:00:00.000Z', reviewAt = '2026-09-08T15:00:00.000Z';
    function blockedFixture({ status = 'ACCEPTED', decisions } = {}) {
        const file = fixture({ status, batchStatus: 'OPEN', extra: {
            WorkAttempt: [{ id: 'recorded-owner', workItemId: 'measured', attemptNo: 1, status: 'RECORDED',
                evidenceHash: 'retained-hash', evidenceData: 'retained-evidence', createdAt: attemptAt, updatedAt: attemptAt }],
            ReviewDecision: decisions || [{ id: 'legacy-reject', sampleId: 'sample', workItemId: 'measured', decision: 'REJECT',
                reviewerId: 'system:fixture', reason: 'reanalysis', createdAt: '2026-09-07T10:00:00.000Z' }] } });
        const db = new Database(file);
        try {
            db.prepare('UPDATE "ReviewDecision" SET "createdAt"=? WHERE "id"=\'legacy-review\'').run(reviewAt);
            db.prepare('UPDATE "Result" SET "createdAt"=? WHERE "id"=\'result\'').run(attemptAt);
            db.prepare('UPDATE "WorkItem" SET "reviewedAt"=?, "reviewDecision"=\'ACCEPT\' WHERE "id"=\'measured\'').run(reviewAt);
        } finally { db.close(); }
        installWorkAttemptContract({ dbPath: file, apply: true });
        require('../helpers/repeatQcPredecessors').installRepeatQcPredecessors(file);
        return file;
    }
    const rowsWithout = (file, eventIds = []) => retained(file).map(entry => entry.table === 'AuditLog'
        ? { ...entry, rows: entry.rows.filter(row => !eventIds.includes(row.id)) }
        : entry.table === 'WorkAttempt' ? { ...entry, rows: entry.rows.map(row => row.id === 'recorded-owner' ? { ...row, status: 'LINKED' } : row) } : entry);

    test('dry-run names the single eligible item and its recorded decision without changing bytes', () => {
        const file = blockedFixture(), before = hash(file);
        expect(linkRecordedAcceptance({ dbPath: file })).toMatchObject({ mode: 'DRY_RUN', totalChanges: 0, blockedWorkItemCount: 1,
            unresolved: [], alreadyLinked: [], eligible: [{ workItemId: 'measured', attemptId: 'recorded-owner', resultIds: ['result'],
                reviewDecisionId: 'legacy-review', reviewedAt: reviewAt }] });
        expect(hash(file)).toBe(before);
    });

    test('apply needs the exact named scope and refuses any other scope with zero writes', () => {
        const file = blockedFixture(), before = hash(file);
        for (const workItemIds of [[], ['other'], ['measured', 'other']]) {
            expect(() => linkRecordedAcceptance({ dbPath: file, apply: true, workItemIds }))
                .toThrow(expect.objectContaining({ code: 'ACCEPTANCE_LINK_SCOPE_MISMATCH', totalChanges: 0 }));
        }
        expect(hash(file)).toBe(before);
        expect(() => linkArguments(['--db', file, '--apply'])).toThrow(expect.objectContaining({ code: 'ACCEPTANCE_LINK_ARGUMENT_INVALID' }));
        expect(() => linkArguments(['--db', file, '--apply', '--work-item', 'measured'])).toThrow(expect.objectContaining({ code: 'ACCEPTANCE_LINK_ARGUMENT_INVALID' }));
        const planSha256 = linkRecordedAcceptance({ dbPath: file }).planSha256;
        expect(linkArguments(['--db', file, '--apply', '--work-item', 'measured', '--plan-sha256', planSha256]))
            .toEqual({ dbPath: file, apply: true, workItemIds: ['measured'], planSha256 });
        expect(() => linkRecordedAcceptance({ dbPath: file, apply: true, workItemIds: ['measured'], planSha256: '0'.repeat(64) }))
            .toThrow(expect.objectContaining({ code: 'ACCEPTANCE_LINK_PLAN_MISMATCH', totalChanges: 0 }));
        expect(hash(file)).toBe(before);
    });

    test('apply links the recorded ACCEPT, preserves every other row, clears the #191 gate and is idempotent', () => {
        const file = blockedFixture(), original = rowsWithout(file), { planSha256 } = linkRecordedAcceptance({ dbPath: file });
        const applied = linkRecordedAcceptance({ dbPath: file, apply: true, workItemIds: ['measured'], planSha256 });
        expect(applied).toMatchObject({ mode: 'APPLIED', blockedWorkItemCount: 0, eligible: [], unresolved: [],
            receipt: { planSha256, originalRowsAndFieldsPreserved: true, attemptStatusChanges: 1, auditEventsAdded: 1,
                links: [{ workItemId: 'measured', attemptId: 'recorded-owner', reviewDecisionId: 'legacy-review' }] } });
        const eventId = applied.receipt.links[0].eventId;
        expect(rowsWithout(file, [eventId])).toEqual(original);
        const db = new Database(file, { readonly: true });
        try {
            expect(db.prepare('SELECT status, updatedAt, version FROM "WorkAttempt" WHERE id=\'recorded-owner\'').get())
                .toEqual({ status: 'ACCEPTED', updatedAt: attemptAt, version: 1 });
            const event = db.prepare('SELECT * FROM "AuditLog" WHERE id=?').get(eventId);
            expect(event).toMatchObject({ entity: 'WORK_ATTEMPT', entityId: 'recorded-owner', action: 'ACCEPTED', performedBy: ACTOR,
                sampleId: 'sample', analysisCode: 'P' });
            expect(JSON.parse(event.details)).toMatchObject({ from: 'RECORDED', to: 'ACCEPTED', reviewDecisionId: 'legacy-review',
                oldResultIds: [], newResultIds: [], linkedResultIds: ['result'] });
            expect(db.prepare('SELECT attemptId FROM "ReviewDecision" WHERE id=\'legacy-review\'').get()).toEqual({ attemptId: null });
        } finally { db.close(); }
        const linked = hash(file);
        expect(linkRecordedAcceptance({ dbPath: file, apply: true, workItemIds: ['measured'], planSha256 }))
            .toMatchObject({ mode: 'NO_OP', totalChanges: 0, alreadyLinked: [{ eventId, workItemId: 'measured' }] });
        expect(hash(file)).toBe(linked);
        expect(installWorkRepeatContract({ dbPath: file }).releaseInventory).toEqual({ blockedWorkItemCount: 0, blockedWorkItems: [], totalChanges: 0 });
        installWorkRepeatContract({ dbPath: file, apply: true });
        expect(assertWorkRepeatStartupReady(file).releaseInventory.blockedWorkItemCount).toBe(0);
        expect(() => linkRecordedAcceptance({ dbPath: file })).toThrow(expect.objectContaining({ code: 'ACCEPTANCE_LINK_AFTER_191_REFUSED' }));
    });

    test.each([
        ['submitted work has no acceptance to link', { status: 'SUBMITTED' }, 'WORK_ITEM_NOT_ACCEPTED'],
        ['a later rejection is the current decision', { decisions: [{ id: 'later-reject', sampleId: 'sample', workItemId: 'measured',
            decision: 'REJECT', reviewerId: 'system:fixture', reason: 'later', createdAt: '2026-09-09T10:00:00.000Z' }] }, 'LATEST_DECISION_NOT_ACCEPT'],
    ])('%s: the item stays unresolved and apply refuses with zero writes', (_, options, reason) => {
        const file = blockedFixture(options), before = hash(file);
        const dry = linkRecordedAcceptance({ dbPath: file });
        expect(dry.eligible).toEqual([]);
        expect(dry.unresolved).toEqual([expect.objectContaining({ workItemId: 'measured', reasons: expect.arrayContaining([reason]) })]);
        expect(() => linkRecordedAcceptance({ dbPath: file, apply: true, workItemIds: ['measured'] }))
            .toThrow(expect.objectContaining({ code: 'ACCEPTANCE_LINK_UNRESOLVED', totalChanges: 0 }));
        expect(hash(file)).toBe(before);
    });

    test('changed evidence for the same eligible work item refuses apply with zero writes', () => {
        const file = blockedFixture(), reviewed = linkRecordedAcceptance({ dbPath: file });
        const db = new Database(file), moved = '2026-09-08T15:30:00.000Z';
        try {
            db.prepare('UPDATE "ReviewDecision" SET "createdAt"=? WHERE "id"=\'legacy-review\'').run(moved);
            db.prepare('UPDATE "WorkItem" SET "reviewedAt"=? WHERE "id"=\'measured\'').run(moved);
        } finally { db.close(); }
        const before = hash(file), changed = linkRecordedAcceptance({ dbPath: file });
        expect(changed.eligible.map(row => row.workItemId)).toEqual(['measured']);
        expect(changed.planSha256).not.toBe(reviewed.planSha256);
        expect(() => linkRecordedAcceptance({ dbPath: file, apply: true, workItemIds: ['measured'], planSha256: reviewed.planSha256 }))
            .toThrow(expect.objectContaining({ code: 'ACCEPTANCE_LINK_PLAN_MISMATCH', totalChanges: 0 }));
        expect(hash(file)).toBe(before);
    });

    test('zone-less SQLite timestamps are compared as UTC, not host-local time', () => {
        const file = blockedFixture(), db = new Database(file);
        try { db.prepare('UPDATE "ReviewDecision" SET "createdAt"=? WHERE "id"=\'legacy-review\'').run('2026-09-08 15:00:00'); } finally { db.close(); }
        expect(linkRecordedAcceptance({ dbPath: file })).toMatchObject({ unresolved: [], eligible: [{ workItemId: 'measured' }] });
    });

    test('an acceptance recorded before the attempt or its Result is never linked', () => {
        const file = blockedFixture(), db = new Database(file);
        try { db.prepare('UPDATE "Result" SET "createdAt"=? WHERE "id"=\'result\'').run('2026-09-08T16:00:00.000Z'); } finally { db.close(); }
        expect(linkRecordedAcceptance({ dbPath: file }).unresolved[0].reasons).toEqual(['DECISION_PRECEDES_RESULT']);
    });
});
