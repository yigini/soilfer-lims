const Database=require('better-sqlite3');
const {randomUUID}=require('node:crypto');
const {qcGateFixture}=require('../helpers/qcGateFixture');
const {inTransaction}=require('../../services/workflowStateRules');
const {writeResult}=require('../../services/resultWriteService');
const overrideService=require('../../services/resultOverrideService');
const owned=[];
afterEach(async()=>{for(const {db,f} of owned.splice(0)){db.close();await f.close();}});
async function fixture(rawValue='65'){
    const f=await qcGateFixture(),db=new Database(f.file,{fileMustExist:true});owned.push({db,f});db.pragma('foreign_keys=ON');
    await f.db.analysis.update({where:{code:f.analysisCode},data:{validation:'{"min":2,"max":14}'}});
    const reviewer=await f.db.user.create({data:{id:randomUUID(),username:'sql-approver-'+randomUUID(),email:randomUUID()+'@example.test',
        password:'owned-fixture',role:'LAB_MANAGER',labId:f.labId}});
    const request=await overrideService.request(f.db,f.items[0].id,f.actor,{value:rawValue,unit:'fixture-unit',equipmentId:f.instrument.id,
        reason:'Original worksheet confirms an extreme reading'});
    db.activeRequestId=request.id;db.requesterId=request.requestedBy;db.approverId=reviewer.id;db.recordedAt=new Date('2026-10-09T15:00:00Z');
    db.record=(value=rawValue)=>inTransaction(f.db,tx=>writeResult(tx,{sampleId:f.items[0].sampleId,workItemId:f.items[0].id,actor:f.actor,now:db.recordedAt,
        measurement:{param:f.analysisCode,value,unit:'fixture-unit',equipmentId:f.instrument.id,overrideRequestId:db.activeRequestId}}));
    return db;
}
const row=db=>db.prepare('SELECT * FROM ResultOverrideRequest WHERE id=?').get(db.activeRequestId);
const approve=db=>db.prepare(`UPDATE ResultOverrideRequest SET status='APPROVED',decidedBy=?,decidedAt='2026-10-09T13:00:00Z',decisionReason='Verified original worksheet' WHERE id=?`)
    .run(db.approverId,db.activeRequestId);
function refuse(db,sql,code){const before=row(db),changes=db.prepare('SELECT total_changes() n').get().n;
    expect(()=>db.exec(sql)).toThrow(code);expect(row(db)).toEqual(before);expect(db.prepare('SELECT total_changes() n').get().n).toBe(changes);}
test.each(['rawValue','unit','basis','methodRevision','rulesSha256','reason','requestedBy'])('SQL refuses changes to immutable context %s with zero writes',async field=>{
    const db=await fixture();refuse(db,`UPDATE ResultOverrideRequest SET "${field}"='changed'`,'OVERRIDE_CONTEXT_IMMUTABLE');
});
test('SQL refuses deletion and terminal insertion, and enforces one active request per cell',async()=>{
    const db=await fixture();refuse(db,'DELETE FROM ResultOverrideRequest','OVERRIDE_REQUEST_IMMUTABLE');
    const columns=db.prepare('PRAGMA table_info(ResultOverrideRequest)').all().map(c=>c.name);
    const values=columns.map(c=>c==='id'?"'other'":`"${c}"`).join(',');
    expect(()=>db.exec(`INSERT INTO ResultOverrideRequest SELECT ${values} FROM ResultOverrideRequest`)).toThrow(/UNIQUE/);
    expect(db.prepare('SELECT count(*) n FROM ResultOverrideRequest').get().n).toBe(1);
    const terminalValues=columns.map(c=>c==='id'?"'terminal'":c==='status'?"'CONSUMED'":`"${c}"`).join(',');
    refuse(db,`INSERT INTO ResultOverrideRequest SELECT ${terminalValues} FROM ResultOverrideRequest`,'OVERRIDE_REQUEST_SHAPE_INVALID');
});
test.each(['self approval','blank reason','missing time'])(
    'SQL refuses incomplete or self decisions %s with zero writes',async kind=>{
        const db=await fixture(),decision=kind==='self approval'?`decidedBy='${db.requesterId}',decidedAt='now',decisionReason='Self approval'`:
            kind==='blank reason'?`decidedBy='${db.approverId}',decidedAt='now',decisionReason=' '`:`decidedBy='${db.approverId}',decisionReason='Missing time'`;
        refuse(db,`UPDATE ResultOverrideRequest SET status='APPROVED',${decision}`,'OVERRIDE_DECISION_REQUIRED');
    });
test('pending cancellation leaves decision fields null and requires its separate cancellation group',async()=>{
    const db=await fixture();
    refuse(db,`UPDATE ResultOverrideRequest SET status='CANCELLED',cancelledBy='${db.requesterId}',cancelledAt='now',cancelReason=' '`,'OVERRIDE_CANCEL_REASON_REQUIRED');
    refuse(db,`UPDATE ResultOverrideRequest SET status='CANCELLED',cancelledBy='${db.requesterId}',cancelledAt='now',cancelReason='Cancel',decidedBy='${db.requesterId}'`,'OVERRIDE_DECISION_IMMUTABLE');
    db.exec(`UPDATE ResultOverrideRequest SET status='CANCELLED',cancelledBy='${db.requesterId}',cancelledAt='now',cancelReason='Correct context before asking again'`);
    expect(row(db)).toMatchObject({status:'CANCELLED',decidedBy:null,decidedAt:null,decisionReason:null,cancelledBy:db.requesterId});
    refuse(db,"UPDATE ResultOverrideRequest SET cancelReason='Changed history'",'OVERRIDE_STATE_REFUSED');
});
test('approved cancellation retains the original approval byte for byte',async()=>{
    const db=await fixture();approve(db);const before=row(db);
    refuse(db,`UPDATE ResultOverrideRequest SET status='CANCELLED',cancelledBy='${db.requesterId}',cancelledAt='now',cancelReason='Changed unit',decisionReason='Overwritten'`,'OVERRIDE_DECISION_IMMUTABLE');
    db.exec(`UPDATE ResultOverrideRequest SET status='CANCELLED',cancelledBy='${db.requesterId}',cancelledAt='now',cancelReason='Changed unit'`);
    expect(row(db)).toEqual({...before,status:'CANCELLED',cancelledBy:db.requesterId,cancelledAt:'now',cancelReason:'Changed unit'});
});
test('consumption requires an actual exact-context Result and preserves approval with no cancellation fields',async()=>{
    const db=await fixture();approve(db);const before=row(db);
    refuse(db,"UPDATE ResultOverrideRequest SET status='CONSUMED',consumedAt='now'",'OVERRIDE_CONSUMPTION_REQUIRED');
    refuse(db,`UPDATE ResultOverrideRequest SET status='CONSUMED',consumedResultId='missing',consumedAt='now',cancelledBy='${db.requesterId}',cancelledAt='now',cancelReason='Cancel'`,'OVERRIDE_CANCEL_FIELDS_REFUSED');
    const result=await db.record();
    expect(JSON.parse(result.flags)).toContain('OVERRIDE_APPROVED');
    expect(row(db)).toEqual({...before,status:'CONSUMED',consumedResultId:result.id,consumedAt:db.recordedAt.getTime()});
    refuse(db,"UPDATE ResultOverrideRequest SET status='APPROVED'",'OVERRIDE_STATE_REFUSED');
});
test('consumption refuses a different raw string despite an identical numeric meaning',async()=>{
    const db=await fixture('65.0');approve(db);const result=await db.record();
    expect(result).toMatchObject({rawInput:'65.0',numericValue:65});expect(JSON.parse(result.flags)).toContain('OVERRIDE_APPROVED');
    const columns=db.prepare('PRAGMA table_info(ResultOverrideRequest)').all().map(c=>c.name),newId=randomUUID();
    const values=columns.map(c=>c==='id'?`'${newId}'`:c==='rawValue'?"'65'":c==='status'?"'REQUESTED'":
        ['decidedBy','decidedAt','decisionReason','consumedResultId','consumedAt'].includes(c)?'NULL':`"${c}"`).join(',');
    db.exec(`INSERT INTO ResultOverrideRequest SELECT ${values} FROM ResultOverrideRequest`);db.activeRequestId=newId;approve(db);
    refuse(db,`UPDATE ResultOverrideRequest SET status='CONSUMED',consumedResultId='${result.id}',consumedAt='now' WHERE id='${newId}'`,'OVERRIDE_CONTEXT_CHANGED');
});
