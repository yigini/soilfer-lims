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

// Revised pin6071874424: these are trigger-level probes, deliberately not
// installation proofs. No historical factory, classifier or receipt is used.
const HANDOFF_CASES=Object.freeze({
    'old-repeat-required':{oldStatus:'REPEAT_REQUIRED'},
    'parent-null-hash':{hash:null},
    'parent-wrong-batch':{parentBatch:'other-batch'},
    'parent-wrong-qc-batch':{parentQcBatch:'other-batch'},
    'wrong-analyte':{analysis:'Q'},
    'mixed-failed-membership':{secondStatus:'QC_FAIL'},
    'mixed-accepted-wrong-membership':{secondStatus:'QC_PASS'},
    'qc-fail':{status:'QC_FAIL'},
    'qc-pending':{status:'QC_PENDING'},
    'open-unstarted':{status:'OPEN',startedAt:null},
    'accepted-pass':{status:'QC_PASS'},
    'accepted-warn':{status:'QC_WARN'},
    'accepted-deviation':{status:'ACCEPTED_WITH_DEVIATION'},
    'accepted-texture-alias':{textureAlias:true,status:'QC_PASS'}
});
function triggerFrom(source,name) {
    const matches=[...source.matchAll(/^CREATE TRIGGER "([^"]+)"[\s\S]*?^END;/gm)].filter(match=>match[1]===name);
    expect(matches).toHaveLength(1);expect(source.includes(matches[0][0])).toBe(true);
    return matches[0][0];
}
function handoffTriggerProbe(caseName) {
    if(!Object.hasOwn(HANDOFF_CASES,caseName))throw Error('Unknown closed handoff trigger case.');
    const c=HANDOFF_CASES[caseName];
    fs.mkdirSync(directory,{recursive:true});file=path.join(directory,`audit_legacy_190_sql-${randomUUID()}.db`);
    require('../helpers/testOwnedDatabase').assertOwnedTestDatabase(file,'system:fixture');
    const ddl=fs.readFileSync(path.resolve(__dirname,'../helpers/fixtures/pre190_full_application_schema.sql'));
    expect(createHash('sha256').update(ddl).digest('hex')).toBe('e2496a65a9c607e80a82924ff7ed6a4033d1da05fedb907c83dd0918f022923b');
    db=new Database(file);db.pragma('foreign_keys=ON');db.exec(ddl.toString('utf8'));
    const predecessor=require('../../services/workAttemptMigrationSource').loadWorkAttemptMigrationSource();
    const successor=loadWorkRepeatMigrationSource();
    db.exec(predecessor.schemaSql);db.exec(successor.schemaSql);
    const analysis=c.textureAlias?'SOIL_PSD_TEXTURE':c.analysis||'P';
    const itemAnalysis=c.textureAlias?'TEXTURE':'P';
    const evidenceData='{"retained":"original execution"}';
    db.prepare('INSERT INTO Sample(id,originalId,status,updatedAt) VALUES (?,?,?,?)').run('sample','sample','PROCESSING',timestamp);
    for(const id of ['batch','other-batch'])db.prepare('INSERT INTO Batch(id,analysis,status,createdBy,startedAt) VALUES (?,?,?,?,?)')
        .run(id,analysis,'OPEN','system:fixture',Object.hasOwn(c,'startedAt')?c.startedAt:timestamp);
    db.prepare('INSERT INTO WorkItem(id,sampleId,analysis,status,batchId,rackPosition,updatedAt) VALUES (?,?,?,?,?,?,?)')
        .run('item','sample',itemAnalysis,c.oldStatus||'COMPLETED','batch',1,timestamp);
    db.prepare('INSERT INTO WorkAttempt(id,workItemId,attemptNo,status,evidenceHash,evidenceData,batchId,qcBatchId,updatedAt) VALUES (?,?,?,?,?,?,?,?,?)')
        .run('parent','item',1,'QUESTIONED',Object.hasOwn(c,'hash')?c.hash:createHash('sha256').update(evidenceData).digest('hex'),
            evidenceData,c.parentBatch||'batch',c.parentQcBatch||'batch',timestamp);
    db.prepare('INSERT INTO WorkAttempt(id,workItemId,attemptNo,status,parentAttemptId,reason,requestedBy,requestedAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?)')
        .run('child','item',2,'OPEN','parent','CONFIRMATION','system:fixture',timestamp,timestamp);
    db.prepare('INSERT INTO AuditLog(id,entity,entityId,action,details,performedBy) VALUES (?,?,?,?,?,?)')
        .run('created','WORK_ATTEMPT','child','CREATED',JSON.stringify({from:null,to:'OPEN',reason:'CONFIRMATION',note:null}),'system:fixture');
    const members=[[analysis,c.status||'QC_PASS'],...(c.secondStatus?[['Q',c.secondStatus]]:[])];
    for(const [index,[code,status]] of members.entries()) {
        db.prepare('INSERT INTO BatchAnalyte(id,batchId,analysisCode,status,provenance) VALUES (?,?,?,?,?)')
            .run('analyte-'+index,'batch',code,status,'NATIVE');
        db.prepare('INSERT INTO BatchPosition(id,batchId,position,kind,sampleId,provenance,legacySource) VALUES (?,?,?,?,?,?,?)')
            .run('position-'+index,'batch',index+1,'SAMPLE','sample','NATIVE',c.textureAlias?JSON.stringify({textureAlias:1,batchAnalysis:analysis}):null);
        db.prepare('INSERT INTO BatchPositionWorkItem(id,positionId,workItemId,analysisCode) VALUES (?,?,?,?)')
            .run('membership-'+index,'position-'+index,'item',c.textureAlias?itemAnalysis:code);
    }
    expect(db.pragma('foreign_key_check')).toEqual([]);
    const membership=require('../../services/qcBracketMembershipMigrationSource').loadBracketMembershipSource();
    const priorTrigger=triggerFrom(membership.sql,'WorkItem_batch_membership_guard');
    db.exec(priorTrigger);
    expect(db.prepare("SELECT sql FROM sqlite_master WHERE name='WorkItem_batch_membership_guard'").get().sql+';').toBe(priorTrigger);
    // The committed successor atomically replaces its predecessor guards.
    // Execute the actual release statements; no copied or weakened SQL.
    db.transaction(()=>{db.exec(predecessor.guardsSql);db.exec(successor.guardsSql);})();
    for(const match of successor.guardsSql.matchAll(/^CREATE TRIGGER "([^"]+)"[\s\S]*?^END;/gm))
        expect(db.prepare('SELECT sql FROM sqlite_master WHERE name=?').get(match[1]).sql+';').toBe(triggerFrom(successor.sql,match[1]));
    expect(db.prepare("SELECT name FROM sqlite_master WHERE name='_schema_migrations'").get()).toBeUndefined();
}
function triggerRows() {
    return db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all()
        .map(({name})=>({name,rows:db.prepare(`SELECT * FROM "${name}"`).all()}));
}
describe('#191 membership trigger SQL defence in depth (not installer or receipt evidence)',()=>{
    test.each(Object.keys(HANDOFF_CASES).filter(name=>!name.startsWith('accepted-')))('%s refuses a direct repeat pointer clear with exact zero writes',caseName=>{
        handoffTriggerProbe(caseName);
        const before=triggerRows(),changes=db.prepare('SELECT total_changes() n').get().n;
        const bytes=createHash('sha256').update(fs.readFileSync(file)).digest('hex');
        expect(()=>db.prepare("UPDATE WorkItem SET status='REPEAT_REQUIRED',batchId=NULL,rackPosition=NULL WHERE id=?").run('item'))
            .toThrow('BATCH_MEMBERSHIP_FROZEN');
        expect(db.prepare('SELECT total_changes() n').get().n-changes).toBe(0);
        expect(triggerRows()).toEqual(before);
        expect(createHash('sha256').update(fs.readFileSync(file)).digest('hex')).toBe(bytes);
    });
    test.each(Object.keys(HANDOFF_CASES).filter(name=>name.startsWith('accepted-')))('%s permits the proven SQL handoff and retains all old execution/QC evidence',caseName=>{
        handoffTriggerProbe(caseName);const before=triggerRows();
        expect(db.prepare("UPDATE WorkItem SET status='REPEAT_REQUIRED',batchId=NULL,rackPosition=NULL WHERE id=?").run('item').changes).toBe(1);
        expect(triggerRows().filter(row=>row.name!=='WorkItem')).toEqual(before.filter(row=>row.name!=='WorkItem'));
        expect(db.prepare('SELECT status,batchId,rackPosition FROM WorkItem WHERE id=?').get('item'))
            .toEqual({status:'REPEAT_REQUIRED',batchId:null,rackPosition:null});
    });
    test('an unknown trigger probe case refuses before creating an owned database',()=>{
        expect(()=>handoffTriggerProbe('unreviewed-case')).toThrow('Unknown closed handoff trigger case.');
        expect(file).toBeNull();
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
