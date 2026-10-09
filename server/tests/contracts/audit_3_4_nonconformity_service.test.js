const { randomUUID } = require('node:crypto');
const Database = require('better-sqlite3');
const { qcGateFixture } = require('../helpers/qcGateFixture');
const { assertOwnedTestDatabase } = require('../helpers/testOwnedDatabase');
const { installNonconformityReports } = require('../../scripts/install_nonconformity_reports');
const ncr = require('../../services/nonconformityService');
const pt = require('../../services/proficiencyRoundService');
const owned = [];
async function fixture() {
    const f = await qcGateFixture(); owned.push(f);
    installNonconformityReports({dbPath:f.file,apply:true});
    f.ptInput = { labId:f.labId, analysisCode:f.analysisCode, provider:'Owned PT provider', roundRef:'Owned PT round',
        assignedValue:0, labResult:0, uncertainty:1 };
    f.source = { labId:f.labId, source:'OTHER', refType:'OwnedSource', refId:randomUUID(), description:'Recorded owned failure' };
    f.snapshot = async () => JSON.parse(JSON.stringify(await Promise.all([
        f.db.nonconformityReport.findMany({orderBy:{id:'asc'}}), f.db.proficiencyRound.findMany({orderBy:{id:'asc'}}),
        f.db.auditLog.findMany({orderBy:{id:'asc'}})])));
    return f;
}
afterAll(async () => { for (const f of owned) await f.close(); });
test('a real source transaction raises exactly one NCR and one audit under retries and concurrent requests', async () => {
    const f=await fixture();
    const raise=()=>f.db.$transaction(tx=>ncr.raise(tx,f.actor,f.source));
    const first=await raise(), before=await f.snapshot();
    expect(first).toMatchObject({created:true,report:{status:'OPEN',description:f.source.description,raisedBy:f.actor.username}});
    const repeated=await Promise.all([raise(),raise()]);
    expect(repeated.map(row=>row.report.id)).toEqual([first.report.id,first.report.id]);
    expect(repeated.every(row=>row.created===false)).toBe(true);
    expect(await f.snapshot()).toEqual(before);
    expect(await f.db.auditLog.count({where:{entityId:first.report.id,action:'NCR_RAISED'}})).toBe(1);
});
test('lifecycle uses actual forward commands and audits every old/new value and actor', async () => {
    const f=await fixture(), {report}=await f.db.$transaction(tx=>ncr.raise(tx,f.actor,f.source));
    const action=await ncr.transition(f.db,report.id,f.actor,{status:'ACTION',impactAssessment:'  Review impacted work  '});
    expect(action).toMatchObject({status:'ACTION',impactAssessment:'Review impacted work',closedBy:null,closedAt:null});
    const closed=await ncr.transition(f.db,report.id,f.actor,{status:'CLOSED',correctiveAction:'  Corrected and checked  '});
    expect(closed).toMatchObject({status:'CLOSED',correctiveAction:'Corrected and checked',closedBy:f.actor.username});
    expect(closed.closedAt).toBeInstanceOf(Date);
    const events=await f.db.auditLog.findMany({where:{entityId:report.id}});
    const assess=events.find(row=>row.action==='NCR_ACTION'), finish=events.find(row=>row.action==='NCR_CLOSED');
    expect(JSON.parse(assess.before)).toMatchObject({status:'OPEN'});
    expect(JSON.parse(assess.after)).toMatchObject({status:'ACTION',impactAssessment:action.impactAssessment});
    expect(JSON.parse(finish.before)).toMatchObject({status:'ACTION'});
    expect(JSON.parse(finish.after)).toMatchObject({status:'CLOSED',closedBy:f.actor.username});
    expect(events.every(row=>row.performedBy===f.actor.username)).toBe(true);
});
test.each([
    [{status:'CLOSED',correctiveAction:'Skip'},'NCR_TRANSITION_REFUSED'],
    [{status:'ACTION',impactAssessment:' '},'NCR_ASSESSMENT_REQUIRED'],
    [{status:'ACTION',impactAssessment:'Review',description:'Replace source'},'NCR_INPUT_INVALID']
])('refused open command %s makes zero writes', async (input,code) => {
    const f=await fixture(), {report}=await f.db.$transaction(tx=>ncr.raise(tx,f.actor,f.source)), before=await f.snapshot();
    await expect(ncr.transition(f.db,report.id,f.actor,input)).rejects.toMatchObject({code,statusCode:409});
    expect(await f.snapshot()).toEqual(before);
});
test('blank closure, technician changes, foreign lab changes, reopening and closed edits each make zero writes', async () => {
    const f=await fixture(), {report}=await f.db.$transaction(tx=>ncr.raise(tx,f.actor,f.source));
    await ncr.transition(f.db,report.id,f.actor,{status:'ACTION',impactAssessment:'Retained impact'});
    for (const [actor,input,code,statusCode] of [
        [f.actor,{status:'CLOSED',correctiveAction:' '},'NCR_ACTION_REQUIRED',409],
        [{...f.actor,role:'LAB_TECHNICIAN'},{status:'CLOSED',correctiveAction:'Fix'},'NCR_MANAGEMENT_FORBIDDEN',403],
        [{...f.actor,role:'LAB_MANAGER',labId:randomUUID()},{status:'CLOSED',correctiveAction:'Fix'},'NCR_SCOPE_DENIED',403]
    ]) {
        const before=await f.snapshot();
        await expect(ncr.transition(f.db,report.id,actor,input)).rejects.toMatchObject({code,statusCode});
        expect(await f.snapshot()).toEqual(before);
    }
    await ncr.transition(f.db,report.id,f.actor,{status:'CLOSED',correctiveAction:'Verified correction'});
    for(const input of [{status:'OPEN'},{status:'CLOSED',correctiveAction:'Replacement'}]) {
        const before=await f.snapshot();
        await expect(ncr.transition(f.db,report.id,f.actor,input)).rejects.toMatchObject({code:'NCR_TRANSITION_REFUSED',statusCode:409});
        expect(await f.snapshot()).toEqual(before);
    }
});
test('new unsatisfactory PT creates its NCR, link and classification audits atomically', async () => {
    const f=await fixture(), round=await pt.record(f.actor,{...f.ptInput,labResult:3},{db:f.db});
    expect(round).toMatchObject({outcome:'UNSATISFACTORY',zScore:3,ncrStatus:'RAISED'});
    const report=await f.db.nonconformityReport.findUnique({where:{id:round.nonconformityId}});
    expect(report).toMatchObject({labId:f.labId,source:'PT',refType:'ProficiencyRound',refId:round.id,status:'OPEN'});
    expect(await f.db.auditLog.count({where:{entityId:round.id,action:{in:['RECORD_PT','PT_UNSATISFACTORY']}}})).toBe(2);
    expect(await f.db.auditLog.count({where:{entityId:report.id,action:'NCR_RAISED'}})).toBe(1);
});
test('first unsatisfactory correction jumps NULL to RAISED; later classifications retain and reuse that one NCR', async () => {
    const f=await fixture(), first=await pt.record(f.actor,f.ptInput,{db:f.db});
    expect(first).toMatchObject({outcome:'SATISFACTORY',ncrStatus:null,nonconformityId:null});
    const failed=await pt.update(f.actor,first.id,{labResult:3,uncertainty:1},{db:f.db});
    const retained=await f.db.nonconformityReport.findUnique({where:{id:failed.nonconformityId}});
    expect(failed).toMatchObject({outcome:'UNSATISFACTORY',ncrStatus:'RAISED'});
    for(const labResult of [0,-3,0,3]) {
        const corrected=await pt.update(f.actor,first.id,{labResult,uncertainty:1},{db:f.db});
        expect(corrected).toMatchObject({zScore:labResult,ncrStatus:'RAISED',nonconformityId:retained.id});
        expect(await f.db.nonconformityReport.findUnique({where:{id:retained.id}})).toEqual(retained);
    }
    expect(await f.db.nonconformityReport.count({where:{source:'PT',refId:first.id}})).toBe(1);
    const audit=await f.db.auditLog.findFirst({where:{entityId:first.id,action:'UPDATE_PT'},orderBy:{timestamp:'asc'}});
    expect(JSON.parse(audit.before)).toMatchObject({ncrStatus:null,nonconformityId:null});
    expect(JSON.parse(audit.after)).toMatchObject({ncrStatus:'RAISED',nonconformityId:retained.id});
});
test('forced NCR failure rolls back first PT correction and new-round classification, including all audit rows', async () => {
    const f=await fixture(), first=await pt.record(f.actor,f.ptInput,{db:f.db});
    const raw=new Database(assertOwnedTestDatabase(f.file,'system:fixture'));
    try {
        raw.exec("CREATE TRIGGER owned_ncr_failure BEFORE INSERT ON NonconformityReport BEGIN SELECT RAISE(ABORT,'OWNED_NCR_FAILURE'); END;");
        for(const operation of [()=>pt.update(f.actor,first.id,{labResult:3,uncertainty:1},{db:f.db}),
            ()=>pt.record(f.actor,{...f.ptInput,labResult:3},{db:f.db})]) {
            // The SQLite Prisma adapter exposes trigger ABORT as P2003.
            // The actual trigger and every retained row prove rollback.
            const before=await f.snapshot(); await expect(operation()).rejects.toMatchObject({code:'P2003'});
            expect(await f.snapshot()).toEqual(before);
        }
    } finally {raw.exec('DROP TRIGGER owned_ncr_failure');raw.close();}
});
test('failed lifecycle audit rolls back the status change', async () => {
    const f=await fixture(), {report}=await f.db.$transaction(tx=>ncr.raise(tx,f.actor,f.source));
    const raw=new Database(assertOwnedTestDatabase(f.file,'system:fixture'));
    try {
        raw.exec("CREATE TRIGGER owned_ncr_audit_failure BEFORE INSERT ON AuditLog WHEN NEW.entity='NONCONFORMITY_REPORT' BEGIN SELECT RAISE(ABORT,'OWNED_NCR_AUDIT_FAILURE'); END;");
        const before=await f.snapshot();
        await expect(ncr.transition(f.db,report.id,f.actor,{status:'ACTION',impactAssessment:'Checked scope'})).rejects.toMatchObject({code:'P2003'});
        expect(await f.snapshot()).toEqual(before);
    } finally {raw.exec('DROP TRIGGER owned_ncr_audit_failure');raw.close();}
});
