const fs=require('node:fs'),path=require('node:path'),Database=require('better-sqlite3');
const {randomUUID,createHash}=require('node:crypto');
const {PrismaClient}=require('../../prisma_client');
const {PrismaBetterSqlite3}=require('@prisma/adapter-better-sqlite3');
const {createPre190AttemptFixture}=require('../helpers/workAttemptHistoricalFixtures');
const {rejectedGuardWrite}=require('../helpers/rejectedGuardWrite');
const {createWorkItemFixture}=require('../helpers/workflowFixtures');
const {createRawResultFixture}=require('../../services/resultWriteService');
const {installWorkflowStateGuards}=require('../../scripts/install_workflow_state_guards');
const {installResultAttemptLinks}=require('../../scripts/install_result_attempt_links');
const {installWorkAttemptContract}=require('../../scripts/install_work_attempt_contract');
const {loadWorkRepeatMigrationSource}=require('../../services/workRepeatMigrationSource');
const {WORK_ATTEMPT_STATUS_LIST,LEGACY_WORK_ATTEMPT_STATUS_LIST,REPEAT_REASON_LIST,assertRepeatReason,canonicalWorkItemWhere}=require('../../services/workAttemptContract');
const directory=path.resolve(__dirname,'../.tmp'),timestamp=Date.parse('2026-10-01T12:00:00Z');
let db,client,file;
const itemRow=(id,analysis='P')=>({id,sampleId:'sample',analysis,status:'COMPLETED',updatedAt:timestamp});
const historicalAttempt=(id,workItemId='item',options={})=>({id,workItemId,attemptNo:1,status:'RECORDED',createdAt:timestamp,updatedAt:timestamp,...options});
async function guarded({items=[itemRow('item'),itemRow('other','Q'),itemRow('another','R'),itemRow('new','S'),itemRow('different','T')],attempts=[],batches=[],assignedLab=null,successor=false}={}){
    fs.mkdirSync(directory,{recursive:true});file=path.join(directory,`audit_legacy_190_sql-${randomUUID()}.db`);
    createPre190AttemptFixture({actor:'system:fixture',file,rows:{Sample:['sample','other-sample'].map(id=>({id,originalId:id,status:'PROCESSING',assignedLab,updatedAt:timestamp})),WorkItem:items,WorkAttempt:attempts,Batch:batches}});
    // Actual complete release chain: no copied trigger subset or simplified FK.
    expect(installWorkflowStateGuards({dbPath:file,apply:true}).mode).toBe('APPLIED');
    expect(installWorkflowStateGuards({dbPath:file}).classification).toBe('COMPLETE');
    expect(installResultAttemptLinks({dbPath:file,apply:true}).classification).toBe('COMPLETE');
    expect(installWorkAttemptContract({dbPath:file,apply:true}).classification).toBe('COMPLETE');
    // The predecessor guard suite intentionally remains pre-191 (including
    // its historical nullable-reason case). Add only the nullable model
    // columns so the current generated client can read its literal old rows.
    if(successor) {
        require('../helpers/repeatQcPredecessors').installRepeatQcPredecessors(file);
        expect(require('../../scripts/install_work_repeat_contract').installWorkRepeatContract({dbPath:file,apply:true}).classification).toBe('COMPLETE');
    }
    else {
        const modelColumns=loadWorkRepeatMigrationSource();
        const shape=new Database(file);shape.exec(modelColumns.schemaSql);shape.close();
    }
    db=new Database(file);db.pragma('foreign_keys=ON');client=new PrismaClient({adapter:new PrismaBetterSqlite3({url:'file:'+file})});
}
afterEach(async()=>{
    jest.restoreAllMocks();
    await client?.$disconnect();client=null;db?.close();db=null;
    if(file){if(path.dirname(file)!==directory||!path.basename(file).startsWith('audit_legacy_190_sql-'))throw Error('Unexpected owned guard fixture.');for(const suffix of ['','-wal','-shm'])fs.rmSync(file+suffix,{force:true});file=null;}
});
function insert(id,{workItemId='item',attemptNo=1,status='RECORDED',evidenceData=null,batchId=null,reason=null}={}){
    return client.workAttempt.create({data:{id,workItemId,attemptNo,status,evidenceData,batchId,reason,createdAt:new Date(timestamp),updatedAt:new Date(timestamp)}});
}
function result(id,{sampleId='sample',param='P',replicateNo=1,attemptId=null,isCurrent=1,provenance='MEASURED'}={}){
    return createRawResultFixture(db,{id,sampleId,param,replicateNo,attemptId,isCurrent,provenance,value:'0.123456789',updatedAt:timestamp});
}
function probe(statement,parameters,expectedGuardCode,expectedConstraint){return rejectedGuardWrite({actor:'system:fixture',file,statement,parameters,expectedGuardCode,...(expectedConstraint&&{expectedConstraint})});}
const attemptInsert='INSERT INTO WorkAttempt (id,workItemId,attemptNo,status,batchId,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?)';

// Pins6071874424/6072132694: only the exact trigger is probed. The existing
// raw-write helper builds its own scratch, rolls back every case and deletes it.
function handoffTriggerProbe(fixtureCase, extra={}) {
    fs.mkdirSync(directory,{recursive:true});file=path.join(directory,`audit_legacy_190_sql-${randomUUID()}.db`);
    return rejectedGuardWrite({actor:'system:fixture',file,case:'WorkItem_191_handoff_trigger',fixtureCase,...extra});
}
describe('#191 membership trigger SQL defence in depth (not installer or receipt evidence)',()=>{
    test.each(['old-repeat-required','parent-null-hash','parent-wrong-batch','parent-wrong-qc-batch','wrong-analyte',
        'mixed-failed-membership','mixed-accepted-wrong-membership','qc-fail','qc-pending','open-unstarted'])
        ('%s refuses a direct repeat pointer clear with exact zero writes',fixtureCase=>{
            expect(handoffTriggerProbe(fixtureCase)).toEqual({fixtureCase,expected:'REFUSED',probeChanges:0,
                committedChanges:0,rolledBack:true,scratchRemoved:true,callerFileUntouched:true,evidencePreserved:true});
            expect(fs.existsSync(file)).toBe(false);
        });
    test.each(['accepted-pass','accepted-warn','accepted-deviation','accepted-texture-alias'])
        ('%s permits the proven SQL handoff and retains all old execution/QC evidence',fixtureCase=>{
            expect(handoffTriggerProbe(fixtureCase)).toEqual({fixtureCase,expected:'HANDOFF',probeChanges:1,
                committedChanges:0,rolledBack:true,scratchRemoved:true,callerFileUntouched:true,evidencePreserved:true});
            expect(fs.existsSync(file)).toBe(false);
        });
    // The original fifteenth probe was unknown-name refusal, not a fixed
    // fixture case. It remains and now covers unknown options/callers too.
    test.each(['name','option','caller'])('unknown %s refuses before opening a scratch or caller database',kind=>{
        if(kind==='caller')jest.spyOn(globalThis.expect,'getState').mockReturnValue({
            ...globalThis.expect.getState(),testPath:path.join(directory,'unlisted.test.js')});
        const extra=kind==='option'?{statement:'unreviewed SQL'}:{};
        expect(()=>handoffTriggerProbe(kind==='name'?'unreviewed-case':'accepted-pass',extra)).toThrow(/closed handoff trigger/i);
        expect(fs.existsSync(file)).toBe(false);
    });
});

describe('all #190 refusals remain effective after the receipt-verified #191 successor installation',()=>{
    test.each(['evidenceData','evidenceHash','instrumentId'])('creating-transaction evidence %s still refuses and rolls back',async field=>{
        await guarded({successor:true});const evidenceData='{"final":"recorded before the attempted edit"}';
        rejectedGuardWrite({actor:'system:fixture',file,case:'WorkAttempt_evidence_immutable_same_transaction',values:{id:'new',workItemId:'item',
            evidenceData,evidenceHash:createHash('sha256').update(evidenceData).digest('hex'),field,replacement:'changed'}});
        expect(db.prepare('SELECT count(*) n FROM WorkAttempt').get().n).toBe(0);
    });
    test.each(['id','workItemId','orderLineId','attemptNo','executedMethodRevision','author','authorName','materialAliquot','qcBatchId','version',
        'createdAt','updatedAt','reason','requestedBy','requestedAt','rawData','calcVersion','dilutionFactor','aliquotId'])('recorded identity %s remains frozen',async field=>{
        await guarded({successor:true,attempts:[historicalAttempt('recorded')]});
        const value=field==='reason'?'CONFIRMATION':['attemptNo','version','dilutionFactor'].includes(field)?2:'changed';
        probe(`UPDATE WorkAttempt SET "${field}"=? WHERE id=?`,[value,'recorded'],'WORK_ATTEMPT_IDENTITY_IMMUTABLE');
    });
    test.each([...LEGACY_WORK_ATTEMPT_STATUS_LIST,'unknown'])('invalid status %s still refuses insertion and update',async status=>{
        await guarded({successor:true,attempts:[historicalAttempt('recorded')]});
        probe(attemptInsert,['invalid-status','other',1,status,null,timestamp,timestamp],'WORK_ATTEMPT_STATUS_INVALID');
        probe('UPDATE WorkAttempt SET status=? WHERE id=?',[status,'recorded'],'WORK_ATTEMPT_STATUS_INVALID');
    });
    test('canonical reasons, positive numbers, conflict flags and both unique indexes retain their original refusals',async()=>{
        await guarded({successor:true,attempts:[historicalAttempt('first'),historicalAttempt('flagged','another'),historicalAttempt('flagged-peer','another')]});
        probe(attemptInsert,['collision','item',1,'RECORDED',null,timestamp,timestamp],'SQLITE_CONSTRAINT_UNIQUE','WorkAttempt_workItemId_attemptNo_unique');
        // Supply a canonical reason so the independent #191 mandatory-reason
        // check does not mask #190's fractional-number refusal.
        for(const number of [0,-1,1.5])probe('INSERT INTO WorkAttempt (id,workItemId,attemptNo,status,reason,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?)',
            ['bad-number','other',number,'RECORDED','CONFIRMATION',timestamp,timestamp],'WORK_ATTEMPT_NUMBER_INVALID');
        for(const reason of ['free text','',1])probe('INSERT INTO WorkAttempt (id,workItemId,attemptNo,status,reason,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?)',
            ['invalid-reason','other',1,'RECORDED',reason,timestamp,timestamp],'WORK_ATTEMPT_REASON_INVALID');
        probe('UPDATE WorkAttempt SET reason=? WHERE id=?',['free text','first'],'WORK_ATTEMPT_IDENTITY_IMMUTABLE');
        for(const [id,value] of [['first','flag'],['first',null],['flagged',null],['flagged','same']])
            probe('UPDATE WorkAttempt SET legacyAttemptNoConflict=? WHERE id=?',[value,id],'WORK_ATTEMPT_CONFLICT_FLAG_IMMUTABLE');
        probe('INSERT INTO WorkAttempt (id,workItemId,attemptNo,status,legacyAttemptNoConflict,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?)',
            ['new-flagged','new',1,'RECORDED','pretended-migration',timestamp,timestamp],'WORK_ATTEMPT_CONFLICT_FLAG_FORBIDDEN');
        result('current',{attemptId:'first'});
        probe('INSERT INTO Result (id,sampleId,param,value,replicateNo,attemptId,isCurrent,provenance,updatedAt) VALUES (?,?,?,?,?,?,?,?,?)',
            ['collision-result','sample','P','retained',1,'first',1,'MEASURED',timestamp],'SQLITE_CONSTRAINT_UNIQUE','result_one_current');
    });
    test('batch FK, write-once batch and deletion refusals survive the successor chain',async()=>{
        const batch=id=>({id,analysis:'P',status:'OPEN',createdBy:'system:fixture'});
        await guarded({successor:true,batches:[batch('batch'),batch('other-batch')],attempts:[historicalAttempt('historical','item',{qcBatchId:'batch'})]});
        for(const value of [null,'other-batch'])probe('UPDATE WorkAttempt SET batchId=? WHERE id=?',[value,'historical'],'WORK_ATTEMPT_BATCH_IMMUTABLE');
        probe(attemptInsert,['dangling','other',1,'RECORDED','missing',timestamp,timestamp],'SQLITE_CONSTRAINT_FOREIGNKEY','WorkAttempt_batchId_foreign_key');
        probe('DELETE FROM Batch WHERE id=?',['batch'],'SQLITE_CONSTRAINT_TRIGGER','Batch_WorkAttempt_restrict');
        probe('DELETE FROM WorkAttempt WHERE id=?',['historical'],'WORK_ATTEMPT_DELETE_REFUSED');
    });
    test('Result required and immutable-link guards keep all #190 import and provenance refusal cases',async()=>{
        await guarded({successor:true});await insert('current');await insert('other-attempt',{attemptNo:2,reason:'CONFIRMATION'});
        result('linked',{attemptId:'current'});
        for(const attemptId of [null,'other-attempt'])probe('UPDATE Result SET attemptId=? WHERE id=?',[attemptId,'linked'],'RESULT_ATTEMPT_IMMUTABLE');
        const statement='INSERT INTO Result (id,sampleId,param,value,replicateNo,attemptId,isCurrent,provenance,updatedAt) VALUES (?,?,?,?,?,?,?,?,?)';
        for(const provenance of ['MEASURED','PREDICTED','DERIVED',null])probe(statement,['refused','other-sample','P','retained',1,null,1,provenance,timestamp],'RESULT_ATTEMPT_REQUIRED');
        probe(statement,['canonical-import','sample','P','retained',2,null,1,'IMPORTED',timestamp],'RESULT_ATTEMPT_REQUIRED');
    });
    test('ReviewDecision required, ownership, current-evidence and immutable-attempt guards keep every #190 refusal',async()=>{
        await guarded({successor:true});await insert('current');await insert('historical',{attemptNo:2,reason:'CONFIRMATION'});await insert('wrong-item',{workItemId:'other'});
        result('current-result',{attemptId:'current'});result('old-result',{attemptId:'historical',isCurrent:0});result('other-result',{param:'Q',attemptId:'wrong-item'});
        const statement='INSERT INTO ReviewDecision (id,workItemId,sampleId,attemptId,decision,reviewerId) VALUES (?,?,?,?,?,?)';
        for(const [attemptId,sampleId,code] of [[null,'sample','REVIEW_ATTEMPT_REQUIRED'],['historical','sample','REVIEW_ATTEMPT_INVALID'],
            ['wrong-item','sample','REVIEW_ATTEMPT_INVALID'],['current','other-sample','REVIEW_ATTEMPT_INVALID'],['missing','sample','REVIEW_ATTEMPT_INVALID']])
            probe(statement,['invalid','item',sampleId,attemptId,'ACCEPT','system:fixture'],code);
        db.prepare(statement).run('accepted','item','sample','current','ACCEPT','system:fixture');
        probe('UPDATE ReviewDecision SET attemptId=? WHERE id=?',[null,'accepted'],'REVIEW_DECISION_IMMUTABLE');
        const withoutAttempt='INSERT INTO ReviewDecision (id,workItemId,sampleId,decision,reviewerId) VALUES (?,?,?,?,?)';
        probe(withoutAttempt,['unexecuted-accept','new','sample','ACCEPT','system:fixture'],'REVIEW_ATTEMPT_REQUIRED');
        probe(withoutAttempt,['executed-waiver','item','sample','OMIT','system:fixture'],'REVIEW_ATTEMPT_REQUIRED');
    });
});

test('every lab installs partial attempt uniqueness and current-result uniqueness with all guards',async()=>{
    await guarded();await insert('first');
    expect(db.prepare("SELECT sql FROM sqlite_master WHERE name='WorkAttempt_workItemId_attemptNo_unique'").get().sql).toMatch(/WHERE "legacyAttemptNoConflict" IS NULL$/);
    probe(attemptInsert,['collision','item',1,'RECORDED',null,timestamp,timestamp],'SQLITE_CONSTRAINT_UNIQUE','WorkAttempt_workItemId_attemptNo_unique');
    await insert('next',{attemptNo:2});await insert('another-item',{workItemId:'other'});result('original',{attemptId:'first'});
    probe('INSERT INTO Result (id,sampleId,param,value,replicateNo,attemptId,isCurrent,provenance,updatedAt) VALUES (?,?,?,?,?,?,?,?,?)',['duplicate','sample','P','retained',1,'first',1,'MEASURED',timestamp],'SQLITE_CONSTRAINT_UNIQUE','result_one_current');
    result('replicate',{replicateNo:2,attemptId:'first'});result('other-attempt',{attemptId:'next'});result('historical',{attemptId:'first',isCurrent:0});
});
test.each(WORK_ATTEMPT_STATUS_LIST)('canonical insert and status update %s are accepted',async status=>{await guarded();await insert('canonical',{status});db.prepare('UPDATE WorkAttempt SET status=? WHERE id=?').run(status,'canonical');});
test.each(LEGACY_WORK_ATTEMPT_STATUS_LIST)('historical %s stays stored but cannot be newly inserted or updated',async status=>{
    const original=historicalAttempt('historical','item',{status,evidenceData:'{"retained":"exact bytes"}'});await guarded({attempts:[original]});
    const retained=db.prepare('SELECT * FROM WorkAttempt').all();expect(retained[0]).toMatchObject(original);
    probe(attemptInsert,['new-legacy','another',1,status,null,timestamp,timestamp],'WORK_ATTEMPT_STATUS_INVALID');
    probe('UPDATE WorkAttempt SET status=? WHERE id=?',[status,'historical'],'WORK_ATTEMPT_STATUS_INVALID');expect(db.prepare('SELECT * FROM WorkAttempt').all()).toEqual(retained);
    db.prepare('UPDATE WorkAttempt SET status=? WHERE id=?').run('SUPERSEDED','historical');expect(db.prepare('SELECT evidenceData,status FROM WorkAttempt').get()).toEqual({evidenceData:'{"retained":"exact bytes"}',status:'SUPERSEDED'});
});
test('the migration can flag every historical duplicate before guards, without renumbering',async()=>{
    await guarded({attempts:[historicalAttempt('duplicate-one','item',{evidenceData:'{"original":1}'}),historicalAttempt('duplicate-two','item',{evidenceData:'{"original":2}'})]});
    const original=db.prepare('SELECT * FROM WorkAttempt ORDER BY id').all();expect(original).toHaveLength(2);expect(original.every(row=>row.attemptNo===1&&/^190:/.test(row.legacyAttemptNoConflict))).toBe(true);expect(original[0].legacyAttemptNoConflict).toBe(original[1].legacyAttemptNoConflict);
    await insert('next',{attemptNo:2});probe(attemptInsert,['forced-next-duplicate','item',2,'RECORDED',null,timestamp,timestamp],'SQLITE_CONSTRAINT_UNIQUE','WorkAttempt_workItemId_attemptNo_unique');
    db.prepare('UPDATE WorkAttempt SET status=? WHERE id=?').run('SUPERSEDED','duplicate-one');const after=db.prepare('SELECT * FROM WorkAttempt WHERE id=?').get('duplicate-one');expect({...after,status:original[0].status}).toEqual(original[0]);
});
test.each([['unflagged','flag'],['flagged',null],['flagged','same'],['unflagged',null]])('all conflict flag updates %s -> %s are refused',async(id,value)=>{
    await guarded({attempts:[historicalAttempt('unflagged'),historicalAttempt('flagged','another'),historicalAttempt('flagged-peer','another')]});
    probe('UPDATE WorkAttempt SET legacyAttemptNoConflict=? WHERE id=?',[value,id],'WORK_ATTEMPT_CONFLICT_FLAG_IMMUTABLE');
    probe('INSERT INTO WorkAttempt (id,workItemId,attemptNo,status,legacyAttemptNoConflict,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?)',['new-flagged','new',1,'RECORDED','pretended-migration',timestamp,timestamp],'WORK_ATTEMPT_CONFLICT_FLAG_FORBIDDEN');
});
test.each(['evidenceData','evidenceHash','instrumentId'])('evidence field %s is immutable even within its creating transaction',async field=>{
    await guarded();const evidenceData='{"final":"inserted","equipmentReadiness":{"equipmentId":"frozen-instrument"}}';
    rejectedGuardWrite({actor:'system:fixture',file,case:'WorkAttempt_evidence_immutable_same_transaction',values:{id:'new',workItemId:'item',evidenceData,evidenceHash:createHash('sha256').update(evidenceData).digest('hex'),field,replacement:'changed'}});
    expect(db.prepare('SELECT count(*) n FROM WorkAttempt').get().n).toBe(0);
});
test('the fixed evidence case refuses caller SQL, unknown fields and invalid parents without writes',async()=>{
    await guarded();
    const evidenceData='{"final":"bound values only"}',values={id:'new',workItemId:'item',evidenceData,
        evidenceHash:createHash('sha256').update(evidenceData).digest('hex'),field:'evidenceData',replacement:'changed'};
    const options={actor:'system:fixture',file,case:'WorkAttempt_evidence_immutable_same_transaction',values};
    const before=fs.readFileSync(file);
    for(const invalid of [
        {...options,statement:'UPDATE WorkAttempt SET evidenceData=? WHERE id=?'},
        {...options,callback:()=>{throw Error('Caller callback must never run.');}},
        {...options,case:'arbitrary-two-step-writer'},
        {...options,values:{...values,field:'status'}},
        {...options,values:{...values,evidenceHash:'invalid'}},
        {...options,values:{...values,workItemId:'absent'}}
    ]){
        expect(()=>rejectedGuardWrite(invalid)).toThrow();
        expect(fs.readFileSync(file)).toEqual(before);
        expect(db.prepare('SELECT count(*) n FROM WorkAttempt').get().n).toBe(0);
    }
});
test('the new native FK identity cannot authorize arbitrary WorkAttempt SQL or an invalid parent',async()=>{
    await guarded();const before=fs.readFileSync(file);
    for(const [statement,parameters] of [
        ['DELETE FROM WorkAttempt WHERE id=?',['item']],
        [attemptInsert,['dangling','absent',1,'RECORDED','missing',timestamp,timestamp]],
        [attemptInsert,['dangling','item',1,'RECORDED',null,timestamp,timestamp]]
    ]){
        expect(()=>probe(statement,parameters,'SQLITE_CONSTRAINT_FOREIGNKEY','WorkAttempt_batchId_foreign_key')).toThrow();
        expect(fs.readFileSync(file)).toEqual(before);
    }
    expect(()=>probe(attemptInsert,['dangling','item',1,'RECORDED','missing',timestamp,timestamp],
        'SQLITE_CONSTRAINT_FOREIGNKEY','arbitrary-foreign-key')).toThrow('single workflow guard probe');
    expect(fs.readFileSync(file)).toEqual(before);
});
test.each(['attemptNo','workItemId','author','createdAt','updatedAt','qcBatchId','rawData'])('recorded identity field %s cannot change',async field=>{
    await guarded({attempts:[historicalAttempt('recorded'),historicalAttempt('recorded-peer')]});probe(`UPDATE WorkAttempt SET "${field}"=? WHERE id=?`,[field==='attemptNo'?2:'changed','recorded'],'WORK_ATTEMPT_IDENTITY_IMMUTABLE');
});
test('batch FK is additive, reference checked and write-once when recorded',async()=>{
    const batch=id=>({id,analysis:'P',status:'COMPLETED',createdBy:'system:fixture'});await guarded({batches:[batch('batch'),batch('another')],attempts:[historicalAttempt('historical','item',{qcBatchId:'batch'})]});
    expect(db.prepare('SELECT batchId FROM WorkAttempt WHERE id=?').get('historical').batchId).toBe('batch');
    for(const value of [null,'another'])probe('UPDATE WorkAttempt SET batchId=? WHERE id=?',[value,'historical'],'WORK_ATTEMPT_BATCH_IMMUTABLE');
    probe(attemptInsert,['dangling','different',1,'RECORDED','missing',timestamp,timestamp],'SQLITE_CONSTRAINT_FOREIGNKEY','WorkAttempt_batchId_foreign_key');
    probe('DELETE FROM Batch WHERE id = ?',['batch'],'SQLITE_CONSTRAINT_TRIGGER','Batch_WorkAttempt_restrict');probe('DELETE FROM WorkAttempt WHERE id=?',['historical'],'WORK_ATTEMPT_DELETE_REFUSED');
});
test.each(REPEAT_REASON_LIST)('canonical reason %s is accepted by both the shared contract and SQL',async reason=>{await guarded();expect(assertRepeatReason(reason)).toBe(reason);await insert('canonical-reason',{reason});});
test('reason remains nullable for a second execution, while noncanonical values are refused',async()=>{
    await guarded();await insert('first');await insert('second',{attemptNo:2});expect(db.prepare('SELECT reason FROM WorkAttempt WHERE id=?').get('second').reason).toBeNull();expect(assertRepeatReason(null)).toBeNull();
    for(const reason of ['free text','',1]){expect(()=>assertRepeatReason(reason)).toThrow(expect.objectContaining({code:'WORK_ATTEMPT_REASON_INVALID',statusCode:409}));probe('INSERT INTO WorkAttempt (id,workItemId,attemptNo,status,reason,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?)',['invalid','another',1,'RECORDED',reason,timestamp,timestamp],'WORK_ATTEMPT_REASON_INVALID');}
});
test('SQL and runtime canonical lookup agree: only orphan historical imports can omit an attempt',async()=>{
    await guarded({items:[itemRow('parent','OTHER')]});result('orphan',{provenance:'IMPORTED'});
    await createWorkItemFixture(client,{data:{id:'child',sampleId:'sample',analysis:'P',status:'COMPLETED',duplicateOf:'parent'}});result('duplicate-child-import',{replicateNo:2,provenance:'IMPORTED'});
    expect(canonicalWorkItemWhere('sample','P')).toEqual({sampleId:'sample',analysis:'P',duplicateOf:null});await createWorkItemFixture(client,{data:{id:'canonical',sampleId:'sample',analysis:'P',status:'COMPLETED'}});
    const insertResult='INSERT INTO Result (id,sampleId,param,value,replicateNo,attemptId,isCurrent,provenance,updatedAt) VALUES (?,?,?,?,?,?,?,?,?)';
    probe(insertResult,['nonexempt-import','sample','P','retained',3,null,1,'IMPORTED',timestamp],'RESULT_ATTEMPT_REQUIRED');await insert('valid-attempt',{workItemId:'canonical'});await insert('replacement',{workItemId:'canonical',attemptNo:2});result('linked-import',{replicateNo:3,attemptId:'valid-attempt',provenance:'IMPORTED'});
    for(const attemptId of [null,'replacement'])probe('UPDATE Result SET attemptId=? WHERE id=?',[attemptId,'linked-import'],'RESULT_ATTEMPT_IMMUTABLE');db.prepare('UPDATE Result SET attemptId=? WHERE id=?').run('valid-attempt','linked-import');
    for(const provenance of ['MEASURED','PREDICTED','DERIVED',null])probe(insertResult,['refused','other-sample','P','retained',1,null,1,provenance,timestamp],'RESULT_ATTEMPT_REQUIRED');
});
test('raw review inserts require a current attempt of the same work item and sample',async()=>{
    await guarded();await insert('current');await insert('historical',{attemptNo:2});await insert('wrong-item',{workItemId:'other'});result('current-result',{attemptId:'current'});result('old-result',{attemptId:'historical',isCurrent:0});result('other-result',{param:'Q',attemptId:'wrong-item'});
    const decision='INSERT INTO ReviewDecision (id,workItemId,sampleId,attemptId,decision,reviewerId) VALUES (?,?,?,?,?,?)';
    for(const [attemptId,sampleId,code] of [[null,'sample','REVIEW_ATTEMPT_REQUIRED'],['historical','sample','REVIEW_ATTEMPT_INVALID'],['wrong-item','sample','REVIEW_ATTEMPT_INVALID'],['current','other-sample','REVIEW_ATTEMPT_INVALID'],['missing','sample','REVIEW_ATTEMPT_INVALID']]){probe(decision,['invalid','item',sampleId,attemptId,'ACCEPT','system:fixture'],code);expect(db.prepare('SELECT count(*) n FROM ReviewDecision').get().n).toBe(0);}
    db.prepare(decision).run('accepted','item','sample','current','ACCEPT','system:fixture');probe('UPDATE ReviewDecision SET attemptId=? WHERE id=?',[null,'accepted'],'REVIEW_DECISION_IMMUTABLE');expect(db.prepare('SELECT attemptId FROM ReviewDecision').get().attemptId).toBe('current');
});
test('the raw review guard permits only an unexecuted analytical OMIT with no attempt',async()=>{
    await guarded();const decision='INSERT INTO ReviewDecision (id,workItemId,sampleId,decision,reviewerId) VALUES (?,?,?,?,?)';db.prepare(decision).run('unexecuted-waiver','item','sample','OMIT','system:fixture');
    probe(decision,['unexecuted-accept','item','sample','ACCEPT','system:fixture'],'REVIEW_ATTEMPT_REQUIRED');await insert('executed-without-current-result');probe(decision,['executed-waiver','item','sample','OMIT','system:fixture'],'REVIEW_ATTEMPT_REQUIRED');
});
test.each(require('../../services/workItemKinds').NON_MEASUREMENT_CODES)('SQL keeps non-measurement %s review on its separate evidence workflow',async analysis=>{
    await guarded({items:[itemRow('item',analysis)]});db.prepare('INSERT INTO ReviewDecision (id,workItemId,sampleId,decision,reviewerId) VALUES (?,?,?,?,?)').run('review','item','sample','ACCEPT','system:fixture');expect(db.prepare('SELECT attemptId FROM ReviewDecision').get().attemptId).toBeNull();
});

test('the authenticated workspace returns linked and unlinked attempt metadata without evidence or cross-lab access',async()=>{
    // #190 pin6058381799: the existing exact factory caller supplies historical
    // statuses before installation; the actual route then reads COMPLETE guards.
    const labId='LAB-190-EVIDENCE',otherLab='LAB-190-OTHER';
    await guarded({assignedLab:labId,items:[itemRow('item'),{...itemRow('orphan-child','NO_WORK'),duplicateOf:'item'}],attempts:[
        historicalAttempt('legacy-returned','item',{status:'RETURNED',evidenceData:'{"private":"retained"}',authorName:'Original author'}),
        historicalAttempt('legacy-rejected','item',{attemptNo:3,status:'REJECTED',evidenceHash:'private-hash',instrumentId:'private-instrument'})
    ]});
    for(const id of [labId,otherLab])await client.lab.create({data:{id,code:id,name:'Owned evidence laboratory',country:'TEST'}});
    // The current route includes retained reagent links. Install their actual
    // additive schema without changing this predecessor's attempt guards.
    require('../../scripts/install_batch_reagent_lots').installBatchReagentLots({dbPath:file,apply:true});
    require('../../scripts/install_sample_amendment_authorisation').installSampleAmendmentAuthorisation({dbPath:file,apply:true});
    // Current workspace reads include the nullable draft import pointer. Prepare
    // this one owned predecessor through the actual prerequisite and import
    // installers; all retained raw Result/attempt assertions stay unchanged.
    require('../helpers/calculationReleasePrerequisites').installCalculationReleasePrerequisites(file);
    require('../../scripts/install_instrument_imports').installInstrumentImports({dbPath:file,apply:true});
    await insert('linked',{attemptNo:2,evidenceData:'{"private":"linked"}'});
    result('linked-result',{attemptId:'linked'});result('imported',{param:'NO_WORK',provenance:'IMPORTED'});
    const {createAuthTokenFixture}=require('../helpers/workflowFixtures');
    const token=await createAuthTokenFixture(client,'LAB_MANAGER',labId),otherToken=await createAuthTokenFixture(client,'LAB_MANAGER',otherLab);
    require('../helpers/legacyWorkflowDatabase').useLegacyRouteDatabase(require('../../prisma'),client,{allModels:true});
    const request=require('supertest'),app=require('../../app');
    const before=db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all()
        .map(({name})=>({name,rows:db.prepare(`SELECT * FROM "${name}"`).all()}));
    const response=await request(app).get('/api/samples/sample/workspace').set('Authorization',`Bearer ${token}`);
    expect(response.status).toBe(200);
    const item=response.body.workItems.find(row=>row.id==='item');
    expect(item.results.find(row=>row.id==='linked-result').attempt).toEqual({id:'linked',attemptNo:2,status:'RECORDED'});
    // A duplicate child supplies the existing evidence block while the exact
    // exemption still has no canonical WorkItem for the imported parameter.
    const imported=response.body.workItems.find(row=>row.id==='orphan-child').results.find(row=>row.id==='imported');
    expect(imported).toMatchObject({provenance:'IMPORTED',attemptId:null,attempt:null});
    expect(item.attempts.map(row=>[row.id,row.attemptNo,row.status])).toEqual([
        ['legacy-returned',1,'RETURNED'],['linked',2,'RECORDED'],['legacy-rejected',3,'REJECTED']]);
    expect(item.attempts[0]).toMatchObject({authorName:'Original author',createdAt:expect.any(String)});
    for(const attempt of [item.results[0].attempt,...item.attempts]){
        for(const field of ['evidenceData','evidenceHash','instrumentId'])expect(attempt).not.toHaveProperty(field);
    }
    const denied=await request(app).get('/api/samples/sample/workspace').set('Authorization',`Bearer ${otherToken}`);
    expect(denied).toMatchObject({status:403,body:{code:'FORBIDDEN_SCOPE'}});
    expect(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all()
        .map(({name})=>({name,rows:db.prepare(`SELECT * FROM "${name}"`).all()}))).toEqual(before);
});
