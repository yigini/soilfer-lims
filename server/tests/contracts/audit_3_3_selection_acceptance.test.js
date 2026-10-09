const request = require('supertest');
const { qcGateFixture } = require('../helpers/qcGateFixture');
const { withQcRunHttp } = require('../helpers/qcRunHttpHarness');
const owned = [];
afterEach(async () => { for (const f of owned.splice(0)) await f.close(); });
async function fixture(count = 1,criteria={},initialValue=null) {
    const f = await qcGateFixture({ count, criteria: { blankPerBatch: 0, lrmPerBatch: 0, duplicateEvery: 0, crmEveryNBatches: 0, ccvEvery: 0,...criteria } });
    owned.push(f); f.rows = []; f.submissions = [];
    for (const item of f.items) {
        f.rows.push(initialValue===null ? await f.result(item) : (await require('../../services/workflowStateRules').inTransaction(f.db,
            tx=>require('../../services/resultWriteService').writeResultsExecution(tx,{sampleId:item.sampleId,workItemId:item.id,
                actor:f.actor,measurements:[{param:item.analysis,value:String(initialValue),equipmentId:f.instrument.id}]})))[0]);
        await require('../../services/workItemStateService').transitionWorkItem(item.id, 'COMPLETED', f.actor, 'Recorded owned selection test', {}, f.db);
        f.submissions.push(await require('../../services/submissionStateService').createSubmissionForItems({ db: f.db, actor: f.actor,
            sampleId: item.sampleId, type: 'FULL', workItemIds: [item.id] }));
    }
    f.http = async (path, body) => {
        let response; await withQcRunHttp(f.db, f.actor, async (app, token) => {
            response = await request(app).post(path).set('Authorization','Bearer '+token).send(body);
        }, { reviews: true }); return response;
    };
    f.get = async (actor = f.actor) => {
        let response; await withQcRunHttp(f.db, actor, async (app, token) => {
            response = await request(app).get('/api/work/'+f.items[0].id+'/reported-value').set('Authorization','Bearer '+token);
        }, { reviews: true }); return response;
    };
    f.all = async () => JSON.stringify({ retained: await f.snapshot(), attempts: await f.db.workAttempt.findMany({ orderBy: { id: 'asc' } }),
        selections: await f.db.reportedValueSelection.findMany({ orderBy: { id: 'asc' } }) });
    return f;
}

test('actual scalar acceptance with no r atomically saves AUTO_SINGLE after ACCEPTED and is immediately fresh', async () => {
    const f = await fixture(), response = await f.http('/api/work/'+f.items[0].id+'/review', { decision: 'ACCEPT' });
    expect({ status: response.status, body: response.body }).toMatchObject({ status: 200 });
    expect(await f.db.workAttempt.findUnique({ where: { id: f.rows[0].attemptId } })).toMatchObject({ status: 'ACCEPTED' });
    const selections = await f.db.reportedValueSelection.findMany(); expect(selections).toHaveLength(1);
    expect(selections[0]).toMatchObject({ rule: 'AUTO_SINGLE', valueText: f.rows[0].value });
    expect(JSON.parse(selections[0].lineageSnapshot).attempts).toContainEqual({ id: f.rows[0].attemptId, status: 'ACCEPTED' });
    await expect(require('../../services/workflowStateRules').inTransaction(f.db, tx =>
        require('../../services/reportedValueSelectionService').readReportedSelection(tx,f.items[0]))).resolves.toMatchObject({ rows: selections });
});

test('REVIEWER_PICKS without a choice refuses actual acceptance with zero writes, then explicit choice succeeds', async () => {
    const f = await fixture();
    await f.setPolicy([{ key: 'results.reportedValueRule', value: 'REVIEWER_PICKS' }]);
    const before = await f.all(), response = await f.http('/api/work/'+f.items[0].id+'/review', { decision: 'ACCEPT' });
    expect(response.status).toBe(409); expect(response.body.code).toBe('REPORTED_VALUE_SELECTION_REQUIRED');
    expect(await f.all()).toBe(before);
    const chosen = await f.http('/api/work/'+f.items[0].id+'/review', { decision: 'ACCEPT',
        reportedValueSelection: { mode: 'ATTEMPT', attemptIds: [f.rows[0].attemptId] } });
    expect({ status: chosen.status, body: chosen.body }).toMatchObject({ status: 200 });
    expect(await f.db.reportedValueSelection.findFirst()).toMatchObject({ rule: 'REVIEWER', policyRule: 'REVIEWER_PICKS' });
});

test('bulk acceptance refuses only the row without a required choice and preserves that row completely', async () => {
    const f = await fixture(2); await f.setPolicy([{ key: 'results.reportedValueRule', value: 'REVIEWER_PICKS' }]);
    const itemBefore = await f.db.workItem.findUnique({ where: { id: f.items[1].id } }), attemptBefore = await f.db.workAttempt.findUnique({ where: { id: f.rows[1].attemptId } });
    const response = await f.http('/api/work/review/bulk', { workItemIds: f.items.map(row => row.id), status: 'ACCEPTED',
        reportedValueSelections: { [f.items[0].id]: { mode: 'ATTEMPT', attemptIds: [f.rows[0].attemptId] } } });
    expect({ status: response.status, body: response.body }).toMatchObject({ status: 200,
        body: { results: [{ workItemId: f.items[0].id }], errors: [{ workItemId: f.items[1].id, code: 'REPORTED_VALUE_SELECTION_REQUIRED' }] } });
    expect(await f.db.workItem.findUnique({ where: { id: f.items[1].id } })).toEqual(itemBefore);
    expect(await f.db.workAttempt.findUnique({ where: { id: f.rows[1].attemptId } })).toEqual(attemptBefore);
    expect(await f.db.reviewDecision.count({ where: { workItemId: f.items[1].id } })).toBe(0);
    expect(await f.db.reportedValueSelection.count({ where: { workItemId: f.items[1].id } })).toBe(0);
});

test('a SQL refusal after review writes rolls back just that bulk row, including its decision, attempt event and status', async () => {
    const f = await fixture(2), failedItem = f.items[0];
    if (!/^[a-f0-9-]+$/.test(failedItem.id)) throw Error('Owned fault trigger requires a generated UUID.');
    // This additional refusal is confined to the owned new selection table. It
    // never removes or weakens any workflow, analytical or QC guard.
    await f.db.$executeRawUnsafe('CREATE TRIGGER "owned_selection_refusal" BEFORE INSERT ON "ReportedValueSelection" WHEN NEW."workItemId"=\''+
        failedItem.id+'\' BEGIN SELECT RAISE(ABORT, \'REPORTED_VALUE_SELECTION_INVALID\'); END;');
    const before = await f.db.workItem.findUnique({ where: { id: failedItem.id } }), attempt = await f.db.workAttempt.findUnique({ where: { id: f.rows[0].attemptId } });
    const audit = await f.db.auditLog.findMany({ where: { sampleId: failedItem.sampleId }, orderBy: { id: 'asc' } });
    const response = await f.http('/api/work/review/bulk', { workItemIds: f.items.map(row => row.id), status: 'ACCEPTED' });
    expect({ status: response.status, body: response.body }).toMatchObject({ status: 200,
        body: { results: [{ workItemId: f.items[1].id }], errors: [{ workItemId: failedItem.id, code: 'REPORTED_VALUE_SELECTION_INVALID' }] } });
    expect(await f.db.workItem.findUnique({ where: { id: failedItem.id } })).toEqual(before);
    expect(await f.db.workAttempt.findUnique({ where: { id: attempt.id } })).toEqual(attempt);
    expect(await f.db.auditLog.findMany({ where: { sampleId: failedItem.sampleId }, orderBy: { id: 'asc' } })).toEqual(audit);
    expect(await f.db.reviewDecision.count({ where: { workItemId: failedItem.id } })).toBe(0);
    expect(await f.db.reportedValueSelection.count({ where: { workItemId: failedItem.id } })).toBe(0);
});

test('actual review preview exposes complete attempt evidence and disabled mean reason with zero writes', async () => {
    const f = await fixture(), before = await f.all(), response = await f.get();
    expect({ status: response.status, body: response.body }).toMatchObject({ status: 200, body: {
        automatic: { choice: { rule: 'AUTO_SINGLE' } },
        attempts: [{ id: f.rows[0].attemptId, status: 'SUBMITTED', eligible: true,
            results: [{ id: f.rows[0].id, valueText: f.rows[0].value, replicateNo: 1 }], option: { allowed: true } }],
        mean: { allowed: false, code: 'REPORTED_VALUE_SELECTION_INVALID' },
        current: { groupId: null, code: 'REPORTED_VALUE_SELECTION_REQUIRED' }
    } });
    expect(response.body.attempts[0].qcGates).toHaveLength(1);
    expect(await f.all()).toBe(before);
    const preview = await f.http('/api/work/'+f.items[0].id+'/reported-value/preview', { mode: 'ATTEMPT', attemptIds: ['foreign'] });
    expect(preview.status).toBe(409); expect(preview.body).toMatchObject({ allowed: false, code: 'REPORTED_VALUE_SELECTION_INVALID' });
    expect(await f.all()).toBe(before);
});

test('actual accepted selection endpoint appends a whole replacement and rejects the stale displayed group with zero writes', async () => {
    const f = await fixture(); await f.http('/api/work/'+f.items[0].id+'/review', { decision: 'ACCEPT' });
    const current = await f.get(), first = await f.db.reportedValueSelection.findFirst();
    expect(current.body.current).toMatchObject({ groupId: first.selectionGroupId, code: null });
    const path = '/api/work/'+f.items[0].id+'/reported-value', body = { expectedGroupId: first.selectionGroupId,
        selection: { mode: 'NOT_REPORTABLE', reason: 'Reviewer excluded this determination' } };
    const next = await f.http(path, body);
    expect(next.status).toBe(201); expect(next.body.selections[0]).toMatchObject({ supersedesId: first.id, mode: 'NOT_REPORTABLE' });
    expect(await f.db.reportedValueSelection.findUnique({ where: { id: first.id } })).toEqual(first);
    const before = await f.all(), stale = await f.http(path, body);
    expect(stale.status).toBe(409); expect(stale.body.code).toBe('REPORTED_VALUE_SELECTION_CONFLICT');
    expect(await f.all()).toBe(before);
});

test('selection inspection checks lab scope before exposing attempts, values or policy', async () => {
    const f = await fixture(); const other = await f.db.user.create({ data: { id: require('node:crypto').randomUUID(),
        username: 'foreign-selection-reviewer', email: 'foreign-selection@example.test',
        password: 'unused-owned-test', role: 'LAB_MANAGER', labId: null } });
    const response = await f.get(other);
    expect(response.status).toBe(403);
    expect(response.body.attempts).toBeUndefined(); expect(response.body.policy).toBeUndefined();
});

test('actual RETURN, repeat recording and accept retain a questioned original, requiring its explicit selection reason',async () => {
    const f=await fixture(), item=f.items[0];
    const returned=await f.http('/api/work/'+item.id+'/review',{decision:'RETURN',attemptId:f.rows[0].attemptId,
        reasonCode:'REVIEW_OUTLIER',note:'Compare the original and repeated worksheet measurements'});
    expect({status:returned.status,body:returned.body}).toMatchObject({status:200});
    await require('../../services/workflowStateRules').inTransaction(f.db,tx => require('../../services/resultWriteService').writeResultsExecution(tx,{
        sampleId:item.sampleId,workItemId:item.id,actor:f.actor,
        measurements:[{param:item.analysis,value:'7.2',equipmentId:f.instrument.id}]
    }));
    await require('../../services/workItemStateService').transitionWorkItem(item.id,'COMPLETED',f.actor,'Recorded repeat ready for review',{},f.db);
    await require('../../services/submissionStateService').createSubmissionForItems({db:f.db,actor:f.actor,sampleId:item.sampleId,type:'FULL',workItemIds:[item.id]});
    const selection={mode:'ATTEMPT',attemptIds:[f.rows[0].attemptId]}, before=await f.all();
    const missing=await f.http('/api/work/'+item.id+'/review',{decision:'ACCEPT',reportedValueSelection:selection});
    expect(missing.status).toBe(409); expect(missing.body.code).toBe('REPORTED_VALUE_REASON_REQUIRED'); expect(await f.all()).toBe(before);
    const preview=await f.get(); expect(preview.body.attempts.find(row=>row.id===f.rows[0].attemptId).option).toMatchObject({allowed:true,requiresReason:true});
    const chosen=await f.http('/api/work/'+item.id+'/review',{decision:'ACCEPT',reportedValueSelection:{...selection,reason:'Retained original agrees with the reference worksheet'}});
    expect({status:chosen.status,body:chosen.body}).toMatchObject({status:200});
    const saved=await f.db.reportedValueSelection.findFirst();
    expect(saved).toMatchObject({rule:'REVIEWER',valueText:f.rows[0].value,reason:'Retained original agrees with the reference worksheet'});
    expect(await f.db.reviewDecision.findFirst({where:{workItemId:item.id,decision:'ACCEPT'}}))
        .toMatchObject({reason:'Retained original agrees with the reference worksheet'});
    expect(await f.db.result.findUnique({where:{id:f.rows[0].id}})).toMatchObject({isCurrent:false,isValid:false});
    const retained = await f.all(), sample = await f.db.sample.findUnique({where:{id:item.sampleId}});
    const reported = await require('../../services/reportedValueReadService').readSampleReportedValues(f.db,sample);
    expect(reported.values).toHaveLength(1);
    expect(reported.values[0]).toMatchObject({value:f.rows[0].value,sourceResultIds:[f.rows[0].id]});
    expect(reported.sourceResults[0]).toMatchObject({id:f.rows[0].id,isCurrent:false,isValid:false});
    expect(await f.all()).toBe(retained);
});

test('submission review preserves the explicit selection and its reason through request normalization',async()=>{
    const f=await fixture(),item=f.items[0],path='/api/submissions/'+f.submissions[0].submission.id+'/review';
    await f.setPolicy([{key:'results.reportedValueRule',value:'REVIEWER_PICKS'}]);
    const before=await f.all();
    const missing=await f.http(path,{decisions:[{workItemId:item.id,decision:'ACCEPT'}]});
    expect(missing).toMatchObject({status:409,body:{errors:[{workItemId:item.id,code:'REPORTED_VALUE_SELECTION_REQUIRED'}]}});
    expect(await f.all()).toBe(before);
    const reason='Reviewer verified the complete worksheet determination';
    const chosen=await f.http(path,{decisions:[{workItemId:item.id,decision:'ACCEPT',
        reportedValueSelection:{mode:'ATTEMPT',attemptIds:[f.rows[0].attemptId],reason}}]});
    expect(chosen).toMatchObject({status:200,body:{results:[{workItemId:item.id,status:'ACCEPTED',decision:'ACCEPT'}],errors:[]}});
    expect(await f.db.reportedValueSelection.findFirst()).toMatchObject({rule:'REVIEWER',reason});
    expect(await f.db.reviewDecision.findFirst({where:{workItemId:item.id,decision:'ACCEPT'}})).toMatchObject({reason});
    expect(await f.db.result.findUnique({where:{id:f.rows[0].id}})).toEqual(f.rows[0]);
});

test.each([{r:1,allowed:true},{r:0.5,allowed:false}])('actual questioned12.0/repeat12.6 uses recorded r$r and complete retained evidence',async({r,allowed})=>{
    const f=await fixture(1,{repeatabilityLimit:r},12), item=f.items[0];
    const returned=await f.http('/api/work/'+item.id+'/review',{decision:'RETURN',attemptId:f.rows[0].attemptId,
        reasonCode:'REVIEW_OUTLIER',note:'Compare original worksheet measurement with repeat'});
    expect(returned.status).toBe(200);
    const [repeat]=await require('../../services/workflowStateRules').inTransaction(f.db,tx=>require('../../services/resultWriteService').writeResultsExecution(tx,{
        sampleId:item.sampleId,workItemId:item.id,actor:f.actor,measurements:[{param:item.analysis,value:'12.6',equipmentId:f.instrument.id}]}));
    await require('../../services/workItemStateService').transitionWorkItem(item.id,'COMPLETED',f.actor,'Complete repeat',{},f.db);
    await require('../../services/submissionStateService').createSubmissionForItems({db:f.db,actor:f.actor,sampleId:item.sampleId,type:'FULL',workItemIds:[item.id]});
    const retained=await f.db.result.findMany({orderBy:{id:'asc'}}), before=await f.all();
    const selection={mode:'MEAN',attemptIds:[f.rows[0].attemptId,repeat.attemptId],reason:'Compare complete original and repeat determinations'};
    const response=await f.http('/api/work/'+item.id+'/review',{decision:'ACCEPT',reportedValueSelection:selection});
    if(!allowed) {
        expect(response.status).toBe(409);expect(response.body.code).toBe('REPORTED_VALUE_OUTSIDE_LIMIT');expect(await f.all()).toBe(before);
    } else {
        expect({status:response.status,body:response.body}).toMatchObject({status:200});
        const saved=await f.db.reportedValueSelection.findFirst();expect(saved).toMatchObject({value:12.3,valueText:'12.3',rule:'REVIEWER'});
        expect(JSON.parse(saved.resultIds)).toEqual([f.rows[0].id,repeat.id].sort());
        const report=await require('../../services/reportAssembly').assembleReport(item.sampleId,f.actor,{db:f.db});
        expect(report.content.resultGroups[0].items).toEqual([expect.objectContaining({value:'12.3',sourceResultIds:[f.rows[0].id,repeat.id].sort()})]);
        expect(await f.db.result.findMany({orderBy:{id:'asc'}})).toEqual(retained);
    }
});
