const Database=require('better-sqlite3');
const {loadNonconformityMigrationSource}=require('../../services/nonconformityMigrationSource');
const {loadProficiencyMigrationSource}=require('../../services/proficiencyMigrationSource');
const owned=[];afterEach(()=>{for(const db of owned.splice(0))db.close();});
// Explicit synthetic SQL-boundary fixture. It carries no historical lab data,
// and the actual pinned predecessor/successor DDL supplies every tested guard.
function fixture() {
    const db=new Database(':memory:');owned.push(db);db.pragma('foreign_keys=ON');
    db.exec('CREATE TABLE Lab(id TEXT PRIMARY KEY); INSERT INTO Lab VALUES (\'lab-a\'),(\'lab-b\'); CREATE TABLE ProficiencyRound(id TEXT PRIMARY KEY,labId TEXT NOT NULL,zScore REAL,outcome TEXT);');
    const predecessor=loadProficiencyMigrationSource();
    db.exec(predecessor.sql);
    db.prepare('INSERT INTO ProficiencyRound(id,labId,zScore,outcome,ncrStatus) VALUES (?,?,?,?,?)').run('historical','lab-a',4,'UNSATISFACTORY','PENDING');
    db.prepare('INSERT INTO ProficiencyRound(id,labId,zScore,outcome) VALUES (?,?,?,?)').run('correction','lab-a',1,'SATISFACTORY');
    const retained=db.prepare('SELECT id,labId,zScore,outcome,ncrStatus FROM ProficiencyRound ORDER BY id').all();
    const successor=loadNonconformityMigrationSource();
    db.exec(successor.sql);
    expect(db.prepare('SELECT id,labId,zScore,outcome,ncrStatus FROM ProficiencyRound ORDER BY id').all()).toEqual(retained);
    const raise=(id,patch={})=>{
        const row={id,labId:'lab-a',source:'PT',refType:'ProficiencyRound',refId:id==='history-ncr'?'historical':'correction',
            description:'The retained proficiency assessment was unsatisfactory',raisedBy:'manager',updatedAt:1,...patch};
        db.prepare('INSERT INTO NonconformityReport('+Object.keys(row).map(k=>'"'+k+'"').join(',')+') VALUES ('+Object.keys(row).map(()=>'?').join(',')+')').run(...Object.values(row));
    };
    const snapshot=()=>JSON.stringify([db.prepare('SELECT * FROM NonconformityReport ORDER BY id').all(),db.prepare('SELECT * FROM ProficiencyRound ORDER BY id').all()]);
    return {db,raise,snapshot};
}
test('additive DDL retains classifications; historical PENDING and first corrected NULL link directly to RAISED',()=>{
    const {db,raise}=fixture();raise('history-ncr');raise('new-ncr');
    for(const [id,ncr] of [['historical','history-ncr'],['correction','new-ncr']])
        db.prepare('UPDATE ProficiencyRound SET ncrStatus=\'RAISED\',nonconformityId=? WHERE id=?').run(ncr,id);
    expect(db.prepare('SELECT id,zScore,outcome,ncrStatus,nonconformityId FROM ProficiencyRound ORDER BY id').all()).toEqual([
        {id:'correction',zScore:1,outcome:'SATISFACTORY',ncrStatus:'RAISED',nonconformityId:'new-ncr'},
        {id:'historical',zScore:4,outcome:'UNSATISFACTORY',ncrStatus:'RAISED',nonconformityId:'history-ncr'}]);
    db.prepare('UPDATE ProficiencyRound SET zScore=0,outcome=\'SATISFACTORY\',ncrStatus=\'RAISED\' WHERE id=\'historical\'').run();
    expect(db.prepare('SELECT ncrStatus,nonconformityId FROM ProficiencyRound WHERE id=\'historical\'').get())
        .toEqual({ncrStatus:'RAISED',nonconformityId:'history-ncr'});
});
test.each(['missing','otherLab','otherSource','otherType','otherRound'])('PT RAISED with %s NCR linkage refuses with zero writes',kind=>{
    const f=fixture(),patch={};
    if(kind==='otherLab')patch.labId='lab-b';if(kind==='otherSource')patch.source='OTHER';
    if(kind==='otherType')patch.refType='Customer';if(kind==='otherRound')patch.refId='historical';
    if(kind!=='missing')f.raise('ncr',patch);const before=f.snapshot();
    expect(()=>f.db.prepare('UPDATE ProficiencyRound SET ncrStatus=\'RAISED\',nonconformityId=\'ncr\' WHERE id=\'correction\'').run())
        .toThrow('PT_NCR_STATUS_INVALID');expect(f.snapshot()).toBe(before);
});
test.each(['newPending','nullPending','pendingNull','nullLinked','raiseWithoutLink','insertRaiseWithoutLink'])('PT %s refuses with zero writes',kind=>{
    const f=fixture();f.raise('ncr');const before=f.snapshot();
    const write=()=>{
        if(['newPending','insertRaiseWithoutLink'].includes(kind))return f.db.prepare('INSERT INTO ProficiencyRound(id,labId,ncrStatus) VALUES (?,?,?)')
            .run('new','lab-a',kind==='newPending'?'PENDING':'RAISED');
        const status={nullPending:'PENDING',pendingNull:null,nullLinked:null,raiseWithoutLink:'RAISED'}[kind];
        return f.db.prepare('UPDATE ProficiencyRound SET ncrStatus=?,nonconformityId=? WHERE id=?')
            .run(status,kind==='nullLinked'?'ncr':null,kind==='pendingNull'?'historical':'correction');
    };
    expect(write).toThrow('PT_NCR_STATUS_INVALID');expect(f.snapshot()).toBe(before);
});
test.each(['clear','replace','pending','null'])('a RAISED PT %s link/status refuses with zero writes',kind=>{
    const f=fixture();f.raise('ncr');f.db.exec('UPDATE ProficiencyRound SET ncrStatus=\'RAISED\',nonconformityId=\'ncr\' WHERE id=\'correction\'');
    const before=f.snapshot(),set={clear:'nonconformityId=NULL',replace:'nonconformityId=\'other\'',pending:'ncrStatus=\'PENDING\'',null:'ncrStatus=NULL'}[kind];
    expect(()=>f.db.exec('UPDATE ProficiencyRound SET '+set+' WHERE id=\'correction\'')).toThrow('PT_NCR_STATUS_INVALID');expect(f.snapshot()).toBe(before);
});
test('source deduplication and OPEN→ACTION→CLOSED preserve NCR identity',()=>{
    const f=fixture();f.raise('ncr');const before=f.snapshot();
    expect(()=>f.raise('another')).toThrow('UNIQUE');expect(f.snapshot()).toBe(before);
    f.db.exec('UPDATE NonconformityReport SET status=\'ACTION\',impactAssessment=\'Affected test report withheld\' WHERE id=\'ncr\'');
    f.db.exec('UPDATE NonconformityReport SET status=\'CLOSED\',correctiveAction=\'Training and comparison completed\',closedBy=\'manager\',closedAt=2 WHERE id=\'ncr\'');
    expect(f.db.prepare('SELECT status,closedBy,closedAt FROM NonconformityReport').get()).toEqual({status:'CLOSED',closedBy:'manager',closedAt:2});
});
test.each(['skip','reopen','closedEdit','blankAssessment','blankAction','clearAssessment','delete','identity'])('NCR %s refuses and preserves every row',kind=>{
    const f=fixture();f.raise('ncr');
    if(['reopen','closedEdit'].includes(kind))f.db.exec('UPDATE NonconformityReport SET status=\'ACTION\',impactAssessment=\'Affected work withheld\' WHERE id=\'ncr\'; UPDATE NonconformityReport SET status=\'CLOSED\',correctiveAction=\'Comparison completed\',closedBy=\'manager\',closedAt=2 WHERE id=\'ncr\'');
    if(['blankAction','clearAssessment'].includes(kind))f.db.exec('UPDATE NonconformityReport SET status=\'ACTION\',impactAssessment=\'Affected work withheld\' WHERE id=\'ncr\'');
    const before=f.snapshot(),query={skip:'UPDATE NonconformityReport SET status=\'CLOSED\',impactAssessment=\'Impact\',correctiveAction=\'Action\',closedBy=\'manager\',closedAt=2',
        reopen:'UPDATE NonconformityReport SET status=\'OPEN\'',closedEdit:'UPDATE NonconformityReport SET updatedAt=3',
        blankAssessment:'UPDATE NonconformityReport SET status=\'ACTION\',impactAssessment=\'   \'',
        blankAction:'UPDATE NonconformityReport SET status=\'CLOSED\',correctiveAction=\'   \',closedBy=\'manager\',closedAt=2',
        clearAssessment:'UPDATE NonconformityReport SET status=\'CLOSED\',impactAssessment=NULL,correctiveAction=\'Action\',closedBy=\'manager\',closedAt=2',
        delete:'DELETE FROM NonconformityReport',identity:'UPDATE NonconformityReport SET status=\'ACTION\',impactAssessment=\'Impact\',description=\'Changed\''}[kind];
    expect(()=>f.db.exec(query+' WHERE id=\'ncr\'')).toThrow(kind==='delete'?'NCR_DELETE_REFUSED':'NCR_TRANSITION_REFUSED');
    expect(f.snapshot()).toBe(before);
});
