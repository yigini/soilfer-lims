const fs=require('node:fs'),path=require('node:path');
const {randomUUID,createHash}=require('node:crypto');
const Database=require('better-sqlite3');
const {beforeGuards}=require('../helpers/legacyWorkflowDatabase');
const {proficiencyEvidenceFixture}=require('../helpers/proficiencyEvidenceFixture');
const {assertOwnedTestDatabase}=require('../helpers/testOwnedDatabase');
const {installProficiencyEvidence}=require('../../scripts/install_proficiency_evidence');
const {installNonconformityReports,assertNonconformityStartupReady}=require('../../scripts/install_nonconformity_reports');
const {loadProficiencyMigrationSource}=require('../../services/proficiencyMigrationSource');
const owned=[];
const hash=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function raw(file,execute) {
    const db=new Database(assertOwnedTestDatabase(file,'system:fixture'));
    try{return execute(db);}finally{db.close();}
}
function historical() {
    const f=proficiencyEvidenceFixture([{sigma:1,zScore:3,outcome:'UNSATISFACTORY'},{sigma:null,zScore:7,outcome:'QUESTIONABLE'}]);
    owned.push(f.file);installProficiencyEvidence({dbPath:f.file,apply:true});return f.file;
}
function fresh() {
    const file=path.resolve(__dirname,'../.tmp',`ncr_fresh_${randomUUID()}.db`);
    beforeGuards({actor:'system:fixture',file,qcBootstrap:'CREATE_PRISMA'});owned.push(file);
    raw(file,db=>db.exec('CREATE TABLE "_schema_migrations" ("id" TEXT PRIMARY KEY NOT NULL,"appliedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,"details" TEXT)'));
    return file;
}
afterAll(()=>{for(const file of owned){assertOwnedTestDatabase(file,'system:fixture');for(const suffix of ['','-wal','-shm'])if(fs.existsSync(file+suffix))fs.unlinkSync(file+suffix);}});
test('PRE_193 upgrades additively with zero NCR/backfill rows, retained evidence and byte-identical repeat apply',()=>{
    const file=historical(),before=raw(file,db=>({rounds:db.prepare('SELECT * FROM ProficiencyRound ORDER BY id').all(),
        ledger:db.prepare('SELECT * FROM _schema_migrations ORDER BY id').all()})),initialHash=hash(file);
    expect(installNonconformityReports({dbPath:file})).toMatchObject({classification:'PRE_193',mode:'DRY_RUN',totalChanges:0,roundCount:2,ncrCount:0});
    expect(hash(file)).toBe(initialHash);
    expect(()=>assertNonconformityStartupReady(file)).toThrow(expect.objectContaining({code:'NCR_NOT_INSTALLED'}));
    expect(installNonconformityReports({dbPath:file,apply:true})).toMatchObject({classification:'COMPLETE_193',previousClassification:'PRE_193',newNcrCount:0,backfilledCount:0,totalChanges:1});
    raw(file,db=>{
        expect(db.prepare('SELECT * FROM ProficiencyRound ORDER BY id').all()).toEqual(before.rounds.map(row=>({...row,nonconformityId:null})));
        expect(db.prepare("SELECT * FROM _schema_migrations WHERE id!='193_nonconformity_reports' ORDER BY id").all()).toEqual(before.ledger);
    });
    const completeHash=hash(file);
    expect(installNonconformityReports({dbPath:file,apply:true})).toMatchObject({classification:'COMPLETE_193',mode:'NO_OP',totalChanges:0});
    expect(hash(file)).toBe(completeHash);
    expect(installProficiencyEvidence({dbPath:file})).toMatchObject({classification:'COMPLETE',successor:'COMPLETE_193',totalChanges:0});
});
test('actual fresh Prisma schema bootstraps both complete receipts atomically; predecessor alone refuses',()=>{
    const file=fresh(),initialHash=hash(file);
    expect(installNonconformityReports({dbPath:file})).toMatchObject({classification:'FRESH_PRISMA_193',mode:'DRY_RUN',totalChanges:0,ncrCount:0,roundCount:0});
    expect(hash(file)).toBe(initialHash);
    expect(()=>installProficiencyEvidence({dbPath:file,apply:true})).toThrow(expect.objectContaining({code:'PT_SCHEMA_MISMATCH'}));
    expect(hash(file)).toBe(initialHash);
    expect(installNonconformityReports({dbPath:file,apply:true})).toMatchObject({classification:'COMPLETE_193',previousClassification:'FRESH_PRISMA_193',totalChanges:2});
    raw(file,db=>expect(JSON.parse(db.prepare('SELECT details FROM _schema_migrations WHERE id=?').get('189_proficiency_evidence').details)).toEqual({migrationSha256:loadProficiencyMigrationSource().sha256}));
    const completeHash=hash(file);
    expect(installNonconformityReports({dbPath:file,apply:true})).toMatchObject({mode:'NO_OP',totalChanges:0});
    expect(hash(file)).toBe(completeHash);
    expect(assertNonconformityStartupReady(file).classification).toBe('COMPLETE_193');
});
test('failed fresh bootstrap rolls back both guard sets and receipts without changing retained rows',()=>{
    const file=fresh();raw(file,db=>db.exec(`CREATE TRIGGER owned_ncr_receipt_failure BEFORE INSERT ON _schema_migrations
        WHEN NEW.id='193_nonconformity_reports' BEGIN SELECT RAISE(ABORT,'OWNED_NCR_RECEIPT_FAILURE'); END;`));
    const before=hash(file);
    expect(()=>installNonconformityReports({dbPath:file,apply:true})).toThrow('OWNED_NCR_RECEIPT_FAILURE');
    expect(hash(file)).toBe(before);
    raw(file,db=>{
        expect(db.prepare('SELECT count(*) n FROM _schema_migrations').get().n).toBe(0);
        expect(db.prepare("SELECT count(*) n FROM sqlite_master WHERE type='trigger' AND (name LIKE 'NonconformityReport_%' OR name LIKE 'ProficiencyRound_ncr_%')").get().n).toBe(0);
    });
});
test.each(['ncrRow','linkedRound','raisedRound','badPending'])('fresh bootstrap refuses inconsistent %s with ids and zero writes',kind=>{
    const file=fresh(),id=randomUUID(),labId=randomUUID();
    raw(file,db=>{
        db.prepare('INSERT INTO Lab(id,code,name,country,updatedAt) VALUES (?,?,?,?,?)').run(labId,labId,'Owned fresh NCR lab','TEST',Date.now());
        if(kind==='ncrRow')db.prepare('INSERT INTO NonconformityReport(id,labId,source,refType,refId,description,status,raisedBy,updatedAt) VALUES (?,?,?,?,?,?,?,?,?)').run(id,labId,'OTHER','OwnedSource',id,'Owned historical NCR','OPEN','system:fixture',Date.now());
        else db.prepare(`INSERT INTO ProficiencyRound(id,labId,provider,roundRef,analysisCode,assignedValue,uncertainty,labResult,zScore,outcome,date,updatedAt,ncrStatus,nonconformityId)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(id,labId,'Owned','Old','PH',0,1,3,3,kind==='badPending'?'SATISFACTORY':'UNSATISFACTORY',Date.now(),Date.now(),
                kind==='raisedRound'?'RAISED':kind==='badPending'?'PENDING':null,kind==='linkedRound'?randomUUID():null);
    });
    const before=hash(file);
    let failure;try{installNonconformityReports({dbPath:file,apply:true});}catch(error){failure=error;}
    expect(failure).toMatchObject({code:'NCR_BOOTSTRAP_DATA_REFUSED',totalChanges:0});
    expect([...failure.invalidRoundIds,...failure.ncrIds]).toContain(id);expect(hash(file)).toBe(before);
});
test.each(['partialColumn','oldGuards','oldReceipt','extraColumn','partialNewGuard','tamperedGuard','tamperedReceipt'])('mixed/partial/tampered %s refuses without writes',kind=>{
    const file=kind==='partialColumn'?historical():fresh();
    raw(file,db=>{
        if(kind==='partialColumn')db.exec('ALTER TABLE ProficiencyRound ADD COLUMN nonconformityId TEXT;');
        if(kind==='oldGuards')db.exec(loadProficiencyMigrationSource().guardsSql);
        if(kind==='oldReceipt')db.prepare('INSERT INTO _schema_migrations(id,details) VALUES (?,?)').run('189_proficiency_evidence',JSON.stringify({migrationSha256:loadProficiencyMigrationSource().sha256}));
        if(kind==='extraColumn')db.exec('ALTER TABLE NonconformityReport ADD COLUMN stray TEXT;');
        if(kind==='partialNewGuard')db.exec('CREATE TRIGGER NonconformityReport_delete_guard BEFORE DELETE ON NonconformityReport BEGIN SELECT RAISE(ABORT,\'NCR_DELETE_REFUSED\'); END;');
    });
    if(['tamperedGuard','tamperedReceipt'].includes(kind)) {
        installNonconformityReports({dbPath:file,apply:true});
        raw(file,db=>{
            if(kind==='tamperedGuard')db.exec("DROP TRIGGER ProficiencyRound_ncr_status_insert_guard; CREATE TRIGGER ProficiencyRound_ncr_status_insert_guard BEFORE INSERT ON ProficiencyRound BEGIN SELECT RAISE(ABORT,'TAMPERED'); END;");
            else db.prepare('UPDATE _schema_migrations SET details=? WHERE id=?').run('{}','193_nonconformity_reports');
        });
    }
    const before=hash(file);
    expect(()=>installNonconformityReports({dbPath:file,apply:true})).toThrow(expect.objectContaining({code:'NCR_SCHEMA_MISMATCH'}));
    expect(()=>installProficiencyEvidence({dbPath:file,apply:true})).toThrow(expect.objectContaining({code:'PT_SCHEMA_MISMATCH'}));
    expect(hash(file)).toBe(before);
});
