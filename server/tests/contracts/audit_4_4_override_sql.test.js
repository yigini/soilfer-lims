const Database=require('better-sqlite3');
const {loadResultOverrideMigrationSource}=require('../../services/resultOverrideMigrationSource');
const owned=[];
afterEach(()=>{for(const db of owned.splice(0))db.close();});
function fixture(){
    const db=new Database(':memory:');owned.push(db);db.pragma('foreign_keys=ON');
    db.exec(`CREATE TABLE Lab(id TEXT PRIMARY KEY,code TEXT);
        CREATE TABLE Sample(id TEXT PRIMARY KEY,assignedLab TEXT,labId TEXT);
        CREATE TABLE WorkItem(id TEXT PRIMARY KEY,sampleId TEXT,analysis TEXT,assignedLab TEXT);
        CREATE TABLE Analysis(code TEXT PRIMARY KEY); CREATE TABLE Methodology(id TEXT PRIMARY KEY);
        CREATE TABLE EquipmentAsset(id TEXT PRIMARY KEY); CREATE TABLE User(id TEXT PRIMARY KEY);
        CREATE TABLE Result(id TEXT PRIMARY KEY,sampleId TEXT,param TEXT,replicateNo INTEGER,rawInput TEXT,
            unit TEXT,basis TEXT,methodologyId TEXT,equipmentId TEXT,flags TEXT);
        INSERT INTO Lab VALUES('lab','lab-code'); INSERT INTO Sample VALUES('sample','lab','display-code');
        INSERT INTO WorkItem VALUES('work','sample','PH','lab'); INSERT INTO Analysis VALUES('PH');
        INSERT INTO Methodology VALUES('method'); INSERT INTO EquipmentAsset VALUES('instrument');
        INSERT INTO User VALUES('requester'),('approver');`);
    db.exec(loadResultOverrideMigrationSource().sql);
    db.prepare(`INSERT INTO ResultOverrideRequest(id,labId,workItemId,sampleId,analysisCode,replicateNo,rawValue,
        unit,basis,methodologyId,methodRevision,instrumentId,rulesSha256,flags,reason,requestedBy)
        VALUES('request','lab','work','sample','PH',1,'65','pH','AIR_DRY','method','2','instrument',?,'["ABOVE_MAX"]','Verified extreme','requester')`)
        .run('a'.repeat(64));
    return db;
}
const row=db=>db.prepare('SELECT * FROM ResultOverrideRequest').get();
const approve=db=>db.exec(`UPDATE ResultOverrideRequest SET status='APPROVED',decidedBy='approver',decidedAt='2026-10-09T13:00:00Z',decisionReason='Verified original worksheet'`);
function refuse(db,sql,code){const before=row(db),changes=db.prepare('SELECT total_changes() n').get().n;
    expect(()=>db.exec(sql)).toThrow(code);expect(row(db)).toEqual(before);expect(db.prepare('SELECT total_changes() n').get().n).toBe(changes);}
test.each(['rawValue','unit','basis','methodRevision','rulesSha256','reason','requestedBy'])('SQL refuses changes to immutable context %s with zero writes',field=>{
    const db=fixture();refuse(db,`UPDATE ResultOverrideRequest SET "${field}"='changed'`,'OVERRIDE_CONTEXT_IMMUTABLE');
});
test('SQL refuses deletion and terminal insertion, and enforces one active request per cell',()=>{
    const db=fixture();refuse(db,'DELETE FROM ResultOverrideRequest','OVERRIDE_REQUEST_IMMUTABLE');
    const columns=db.prepare('PRAGMA table_info(ResultOverrideRequest)').all().map(c=>c.name);
    const values=columns.map(c=>c==='id'?"'other'":`"${c}"`).join(',');
    expect(()=>db.exec(`INSERT INTO ResultOverrideRequest SELECT ${values} FROM ResultOverrideRequest`)).toThrow(/UNIQUE/);
    expect(db.prepare('SELECT count(*) n FROM ResultOverrideRequest').get().n).toBe(1);
});
test.each(["decidedBy='requester',decidedAt='now',decisionReason='Self approval'",
    "decidedBy='approver',decidedAt='now',decisionReason=' '","decidedBy='approver',decisionReason='Missing time'"])(
    'SQL refuses incomplete or self decisions %s with zero writes',decision=>{
        const db=fixture();refuse(db,`UPDATE ResultOverrideRequest SET status='APPROVED',${decision}`,'OVERRIDE_DECISION_REQUIRED');
    });
test('pending cancellation leaves decision fields null and requires its separate cancellation group',()=>{
    const db=fixture();
    refuse(db,"UPDATE ResultOverrideRequest SET status='CANCELLED',cancelledBy='requester',cancelledAt='now',cancelReason=' '",'OVERRIDE_CANCEL_REASON_REQUIRED');
    refuse(db,"UPDATE ResultOverrideRequest SET status='CANCELLED',cancelledBy='requester',cancelledAt='now',cancelReason='Cancel',decidedBy='requester'",'OVERRIDE_DECISION_IMMUTABLE');
    db.exec("UPDATE ResultOverrideRequest SET status='CANCELLED',cancelledBy='requester',cancelledAt='now',cancelReason='Correct context before asking again'");
    expect(row(db)).toMatchObject({status:'CANCELLED',decidedBy:null,decidedAt:null,decisionReason:null,cancelledBy:'requester'});
    refuse(db,"UPDATE ResultOverrideRequest SET cancelReason='Changed history'",'OVERRIDE_STATE_REFUSED');
});
test('approved cancellation retains the original approval byte for byte',()=>{
    const db=fixture();approve(db);const before=row(db);
    refuse(db,"UPDATE ResultOverrideRequest SET status='CANCELLED',cancelledBy='requester',cancelledAt='now',cancelReason='Changed unit',decisionReason='Overwritten'",'OVERRIDE_DECISION_IMMUTABLE');
    db.exec("UPDATE ResultOverrideRequest SET status='CANCELLED',cancelledBy='requester',cancelledAt='now',cancelReason='Changed unit'");
    expect(row(db)).toEqual({...before,status:'CANCELLED',cancelledBy:'requester',cancelledAt:'now',cancelReason:'Changed unit'});
});
test('consumption requires an actual exact-context Result and preserves approval with no cancellation fields',()=>{
    const db=fixture();approve(db);const before=row(db);
    refuse(db,"UPDATE ResultOverrideRequest SET status='CONSUMED',consumedAt='now'",'OVERRIDE_CONSUMPTION_REQUIRED');
    db.exec(`INSERT INTO Result VALUES('result','sample','PH',1,'65','pH','AIR_DRY','method','instrument','["ABOVE_MAX","OVERRIDE_APPROVED"]')`);
    refuse(db,"UPDATE ResultOverrideRequest SET status='CONSUMED',consumedResultId='result',consumedAt='now',cancelledBy='requester',cancelledAt='now',cancelReason='Cancel'",'OVERRIDE_CANCEL_FIELDS_REFUSED');
    db.exec("UPDATE ResultOverrideRequest SET status='CONSUMED',consumedResultId='result',consumedAt='now'");
    expect(row(db)).toEqual({...before,status:'CONSUMED',consumedResultId:'result',consumedAt:'now'});
    refuse(db,"UPDATE ResultOverrideRequest SET status='APPROVED'",'OVERRIDE_STATE_REFUSED');
});
test('consumption refuses a different raw string despite an identical numeric meaning',()=>{
    const db=fixture();approve(db);
    db.exec(`INSERT INTO Result VALUES('result','sample','PH',1,'65.0','pH','AIR_DRY','method','instrument','["OVERRIDE_APPROVED"]')`);
    refuse(db,"UPDATE ResultOverrideRequest SET status='CONSUMED',consumedResultId='result',consumedAt='now'",'OVERRIDE_CONTEXT_CHANGED');
});
