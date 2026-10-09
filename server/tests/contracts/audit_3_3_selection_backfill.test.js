const fs = require('node:fs');
const { createHash } = require('node:crypto');
const { qcGateFixture } = require('../helpers/qcGateFixture');
const { backfillReportedValues, parseArguments } = require('../../scripts/backfill_reported_values');
const { appendReportedSelection } = require('../../services/reportedValueSelectionService');
const rules = require('../../services/workflowStateRules');
const owned = [];
afterEach(async () => { for (const f of owned.splice(0)) await f.close(); });
async function fixture(count=1) {
    const f = await qcGateFixture({ count, sharedSample:true, status:'ACCEPTED',
        criteria:{ blankPerBatch:0,lrmPerBatch:0,duplicateEvery:0,crmEveryNBatches:0,ccvEvery:0 } });
    owned.push(f); f.rows=[]; for (const item of f.items) f.rows.push(await f.result(item));
    f.run = options => backfillReportedValues({ dbPath:f.file, by:f.actor.username, ...options });
    f.bytes = () => createHash('sha256').update(fs.readFileSync(f.file)).digest('hex');
    return f;
}

test('default dry-run writes zero bytes, reports exact outcomes, and apply preserves both published and superseded report content',async () => {
    const f = await fixture(3);
    await f.setPolicy([{ key:'results.reportedValueRule', analysisCode:f.items[1].analysis, value:'REVIEWER_PICKS' }]);
    await rules.inTransaction(f.db,tx => appendReportedSelection(tx,f.items[2],f.actor));
    for (const [index,status] of ['PUBLISHED','SUPERSEDED'].entries()) await f.db.report.create({ data:{ sampleId:f.items[0].sampleId,
        version:index+1,status,generatedBy:f.actor.username,content:JSON.stringify({ legacyIssuedValue:9.87654321012345, status }) } });
    const retained = await f.snapshot(), attempts = await f.db.workAttempt.findMany({orderBy:{id:'asc'}}), bytes = f.bytes();
    const dry = await f.run();
    expect(dry).toMatchObject({ mode:'DRY_RUN',totalChanges:0,newSelectionRows:0,totalMeasuredAccepted:3,
        counts:{ AUTO_SINGLE:1,ALREADY_SELECTED:1,AMBIGUOUS:1 },ambiguousWorkItemIds:[f.items[1].id] });
    expect(dry.tests.find(row => row.workItemId===f.items[1].id).reasons).toEqual(['REVIEWER_PICKS']);
    expect(f.bytes()).toBe(bytes); expect(await f.snapshot()).toEqual(retained);
    const applied = await f.run({ apply:true, planSha256:dry.planSha256 });
    expect(applied).toMatchObject({ mode:'APPLIED',newSelectionGroups:1,newSelectionRows:1,newAuditRows:1,totalChanges:2,reportsPreserved:true });
    expect(applied.reportsSha256After).toBe(dry.reportsSha256Before);
    expect(await f.db.workAttempt.findMany({orderBy:{id:'asc'}})).toEqual(attempts);
    const after=await f.snapshot();
    for (const index of [0,1,2,3,4,6,7,8]) expect(after[index]).toEqual(retained[index]);
    expect(await f.db.reportedValueSelection.findFirst({where:{workItemId:f.items[0].id}})).toMatchObject({backfill:true,policyVersion:1});
    const installed=f.bytes(), repeat = await f.run({apply:true});
    expect(repeat).toMatchObject({mode:'NO_OP',totalChanges:0,newSelectionRows:0,counts:{ALREADY_SELECTED:2,AMBIGUOUS:1}});
    expect(f.bytes()).toBe(installed);
});

test('a missing or stale dry-run fingerprint refuses with zero writes',async () => {
    const f=await fixture(), before=await f.snapshot();
    await expect(f.run({apply:true})).rejects.toMatchObject({code:'REPORTED_VALUE_BACKFILL_PLAN_STALE'});
    expect(await f.snapshot()).toEqual(before);
    const dry=await f.run(); await f.setPolicy([{key:'results.reportedValueRule',value:'LATEST_VALID'}]);
    const changed=await f.snapshot(), bytes=f.bytes();
    await expect(f.run({apply:true,planSha256:dry.planSha256})).rejects.toMatchObject({code:'REPORTED_VALUE_BACKFILL_PLAN_STALE'});
    expect(await f.snapshot()).toEqual(changed); expect(f.bytes()).toBe(bytes);
});

test('a missing named active global approver refuses dry and apply without writes',async () => {
    const f=await fixture(), before=f.bytes();
    await expect(f.run({by:'unknown'})).rejects.toMatchObject({code:'REPORTED_VALUE_BACKFILL_ACTOR_REQUIRED'});
    await expect(f.run({by:null,apply:true})).rejects.toMatchObject({code:'REPORTED_VALUE_BACKFILL_ACTOR_REQUIRED'});
    expect(f.bytes()).toBe(before);
});

test.each([[],['--db','owned'],['--db','owned','--by','reviewer','--apply','--dry-run'],['--db','owned','--by','reviewer','--wat'],
    ['--db','owned','--by','reviewer','--db','other']].map(args => ({args})))('CLI refuses incomplete, duplicate or contradictory arguments $args',({args}) => {
    expect(() => parseArguments(args)).toThrow(expect.objectContaining({code:'REPORTED_VALUE_ARGUMENT_INVALID'}));
});

test('CLI defaults to dry-run and requires an explicit database and actor',() => {
    expect(parseArguments(['--db','owned-copy.db','--by','reviewer'])).toEqual({dbPath:'owned-copy.db',by:'reviewer'});
});
