const fs=require('node:fs');
const {createHash}=require('node:crypto');
const Database=require('better-sqlite3');
const {proficiencyEvidenceFixture}=require('../helpers/proficiencyEvidenceFixture');
const {assertOwnedTestDatabase}=require('../helpers/testOwnedDatabase');
const {installProficiencyEvidence}=require('../../scripts/install_proficiency_evidence');
const {installNonconformityReports}=require('../../scripts/install_nonconformity_reports');
const {backfillPtNonconformity,parseArguments}=require('../../scripts/backfill_pt_nonconformity');
const owned=[],hash=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function raw(f,execute){const db=new Database(assertOwnedTestDatabase(f.file,'system:fixture'));try{return execute(db);}finally{db.close();}}
function fixture() {
    const f=proficiencyEvidenceFixture([{sigma:1,zScore:3,outcome:'UNSATISFACTORY'},{sigma:1,zScore:0,outcome:'SATISFACTORY'},
        {sigma:1,zScore:4,outcome:'UNSATISFACTORY'}]);owned.push(f);
    installProficiencyEvidence({dbPath:f.file,apply:true});
    // Before #193, a retained PENDING marker survived a later SATISFACTORY
    // correction. The unchanged historical outcome must stay that way.
    raw(f,db=>db.exec("UPDATE ProficiencyRound SET ncrStatus='PENDING' WHERE id IN ('round-0','round-1');"));
    installNonconformityReports({dbPath:f.file,apply:true});return f;
}
afterAll(()=>{for(const f of owned)f.close();});
test('dry-default PT backfill lists ids/counts, preserves NULL rounds and every classification field, and repeats byte-identically',()=>{
    const f=fixture(),before=raw(f,db=>db.prepare('SELECT * FROM ProficiencyRound ORDER BY id').all()),beforeHash=hash(f.file);
    const dry=backfillPtNonconformity({dbPath:f.file});
    expect(dry).toMatchObject({mode:'DRY_RUN',pendingRoundIds:['round-0','round-1'],nullRoundIds:['round-2'],
        newNcrCount:0,plannedNewNcrCount:2,linkedCount:0,newAuditCount:0,totalChanges:0});
    expect(hash(f.file)).toBe(beforeHash);
    const applied=backfillPtNonconformity({dbPath:f.file,apply:true,planSha256:dry.planSha256,by:f.by});
    expect(applied).toMatchObject({mode:'APPLIED',newNcrCount:2,linkedCount:2,newAuditCount:4,otherRowsAndClassificationFieldsPreserved:true});
    raw(f,db=>{
        expect(db.prepare('SELECT * FROM ProficiencyRound ORDER BY id').all()).toEqual(before.map(row=>{
            const link=applied.links.find(link=>link.roundId===row.id);return link?{...row,ncrStatus:'RAISED',nonconformityId:link.nonconformityId}:row;
        }));
        expect(db.prepare('SELECT count(*) n FROM NonconformityReport').get().n).toBe(2);
        expect(db.prepare('SELECT count(*) n FROM AuditLog').get().n).toBe(4);
    });
    const completeHash=hash(f.file);
    expect(backfillPtNonconformity({dbPath:f.file,apply:true})).toMatchObject({mode:'NO_OP',newNcrCount:0,linkedCount:0,newAuditCount:0,totalChanges:0});
    expect(hash(f.file)).toBe(completeHash);
});
test('missing/stale fingerprint and missing actor refuse with zero writes',()=>{
    const f=fixture(),dry=backfillPtNonconformity({dbPath:f.file}),before=hash(f.file);
    for(const planSha256 of [null,'0'.repeat(64)])expect(()=>backfillPtNonconformity({dbPath:f.file,apply:true,planSha256,by:f.by})).toThrow(expect.objectContaining({code:'NCR_PLAN_STALE'}));
    expect(()=>backfillPtNonconformity({dbPath:f.file,apply:true,planSha256:dry.planSha256})).toThrow(expect.objectContaining({code:'NCR_BACKFILL_ACTOR_REQUIRED'}));
    expect(hash(f.file)).toBe(before);
    raw(f,db=>db.prepare('UPDATE ProficiencyRound SET notes=? WHERE id=?').run('Later recorded metadata','round-0'));
    const changed=hash(f.file);
    expect(()=>backfillPtNonconformity({dbPath:f.file,apply:true,planSha256:dry.planSha256,by:f.by})).toThrow(expect.objectContaining({code:'NCR_PLAN_STALE'}));
    expect(hash(f.file)).toBe(changed);
});
test('a forced second audit failure rolls all NCRs, links and earlier audit inserts back',()=>{
    const f=fixture();raw(f,db=>db.exec("CREATE TRIGGER owned_pt_ncr_audit_failure BEFORE INSERT ON AuditLog WHEN NEW.action='PT_NCR_BACKFILLED' BEGIN SELECT RAISE(ABORT,'OWNED_PT_NCR_AUDIT_FAILURE'); END;"));
    const dry=backfillPtNonconformity({dbPath:f.file}),before=hash(f.file);
    expect(()=>backfillPtNonconformity({dbPath:f.file,apply:true,planSha256:dry.planSha256,by:f.by})).toThrow('OWNED_PT_NCR_AUDIT_FAILURE');
    expect(hash(f.file)).toBe(before);
    raw(f,db=>{
        expect(db.prepare('SELECT count(*) n FROM NonconformityReport').get().n).toBe(0);
        expect(db.prepare('SELECT count(*) n FROM AuditLog').get().n).toBe(0);
        expect(db.prepare("SELECT id FROM ProficiencyRound WHERE ncrStatus='PENDING' ORDER BY id").all().map(row=>row.id)).toEqual(['round-0','round-1']);
    });
});
test('CLI requires an explicit database and rejects repeated or contradictory execution arguments',()=>{
    expect(parseArguments(['--db','owned.db'])).toEqual({dbPath:'owned.db',apply:false});
    for(const args of [[],['--db'],['--db','owned.db','--apply','--dry-run'],['--db','owned.db','--by']])
        expect(()=>parseArguments(args)).toThrow(expect.objectContaining({code:'NCR_ARGUMENT_INVALID'}));
});
