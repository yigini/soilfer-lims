const { createExecutionResultFixture,createExecutionResultsFixture } = require('../helpers/workAttemptFixtures');
const { createWorkItemFixture, createSampleFixture } = require('../helpers/workflowFixtures');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { correctAndApproveReportedValue } = require('../helpers/reportedValueReviewFixture');
const request = require('supertest');
const app = require('../../app');
const prisma = require('../../prisma');
const policy = require('../../services/policyService');
const { getAuthToken, ensureTestLab } = require('../setup');
const { calculateReportedMean } = require('../../services/reportedValueMeanContract');
// Keep random, unique identifiers while excluding the numeric sentinel values
// used below to detect leaked analytical data in the entire response payload.
const id = prefix => `${prefix}-${crypto.randomUUID().replace(/\d/g, digit => String.fromCharCode(103 + Number(digit)))}`;
const labId = 'LAB-AUDIT-010';
const scalar = cell => cell && typeof cell === 'object' ? cell.value : cell;

describe('Audit 0.10: current results in exports and working grid', () => {
    let token,methodologyId;
    beforeAll(async () => {
        await ensureTestLab(labId,'GTM');token=await getAuthToken('LAB_MANAGER',labId);
        await require('../helpers/qcPolicyFixture').setFixtureQcRequirement(prisma,token,labId);
        methodologyId=id('METHOD-010');
        await prisma.methodology.create({data:{id:methodologyId,analysisCode:'SOC',name:'Owned reported-grid method',labId}});
        await require('../../services/qcRuleService').change(jwt.decode(token),{labId,analysisCode:'SOC',methodologyId,
            expectedVersion:0,reason:'Owned complete-replicate reader fixture',criteria:{blankPerBatch:0,lrmPerBatch:0,
                duplicateEvery:0,crmEveryNBatches:0,ccvEvery:0,repeatabilityLimit:10}},{db:prisma});
    });
    afterEach(() => jest.restoreAllMocks());
    test('fixture metadata cannot contain excluded analytical-value sentinels', () => {
        jest.spyOn(crypto, 'randomUUID').mockReturnValue('77778888-9999-4777-8888-999977778888');
        expect(id('SMP-010')).not.toMatch(/7777|8888|9999/);
    });
    async function fixture({ status = 'APPROVED', itemStatus = 'ACCEPTED', receptionDate, projectCode = id('PROJ-010').toUpperCase(), assignedLab = labId } = {}) {
        const sampleId = id('SMP-010');
        const sample = await createSampleFixture(prisma, { data: { id: sampleId, originalId: sampleId, labId: sampleId,
            assignedLab, status, projectCode, preparationStatus: 'DONE', dryingStatus: 'DONE',
            receptionDate: receptionDate ? new Date(receptionDate) : new Date(), requiredAnalyses: '["SOC"]' } });
        const item = await createWorkItemFixture(prisma, { data: { id: id('WI-010'), sampleId, analysis: 'SOC',
            status: itemStatus, assignedLab, assignedTo: jwt.decode(token).username,methodologyId, result: '9999' } });
        return { sample, item, projectCode };
    }
    async function result(f, value, data = {}) {
        const row=await createExecutionResultFixture(prisma, { attemptStatus: f.item.status === 'ACCEPTED' ? 'ACCEPTED' : 'RECORDED',
            data: { id: id('R-010'), sampleId: f.sample.id, param: 'SOC', value: String(value), unit: 'g/kg',
            methodologyId:f.item.methodologyId,isCurrent: true, isValid: true, ...data } });
        if(f.item.status==='ACCEPTED' && f.sample.assignedLab===labId)await choose(f);
        return row;
    }
    const choose=(f,choice)=>require('../helpers/reportedSelectionFixture').selectReviewedFixtureItem(prisma,f.item.id,token,choice);
    const resultSet=async(f,entries,{select=true}={})=>{
        const rows=await createExecutionResultsFixture(prisma,{attemptStatus:'ACCEPTED',data:entries.map(({value,...data})=>({
            id:id('R-010'),sampleId:f.sample.id,param:'SOC',value:String(value),unit:'g/kg',methodologyId:f.item.methodologyId,
            isCurrent:true,isValid:true,...data}))});
        if(select)await choose(f);return rows;
    };
    const exportData = (project, auth = token) => request(app).post('/api/exports/data').set('Authorization', `Bearer ${auth}`).send({ type: 'WET_CHEM', project });
    const grid = (query, auth = token) => request(app).get('/api/data-results').set('Authorization', `Bearer ${auth}`).query(query);
    test('incomplete invalid evidence refuses; a complete selected mean excludes cached values and retains both sources', async () => {
        const f = await fixture();
        await resultSet(f,[{value:7777,isCurrent:false},{value:8888,isValid:false,replicateNo:3},
            {value:10,replicateNo:1},{value:20,replicateNo:2}],{select:false});
        const before=await prisma.auditLog.count();
        const refused=await exportData(f.projectCode),refusedGrid=await grid({project:f.projectCode});
        expect(refused).toMatchObject({status:409,body:{code:'REPORTED_VALUE_SELECTION_REQUIRED'}});
        expect(refusedGrid).toMatchObject({status:409,body:{code:'REPORTED_VALUE_SELECTION_REQUIRED'}});
        expect(await prisma.auditLog.count()).toBe(before);
        const valid=await fixture(),[first,second]=await resultSet(valid,[{value:10,replicateNo:1},{value:20,replicateNo:2}]);
        const exported = await exportData(valid.projectCode);
        expect(exported.status).toBe(200);
        expect(exported.body.data[0]).toMatchObject({ SOC: 15, soc_as_measured: '', soc_unit: 'g/kg', soc_normalized: 15,
            soc_controlled_unit: 'g/kg', soc_n: 2, soc_flag: 'AUTO_DUPLICATE_MEAN' });
        expect(exported.body.meta.headerNotes).toContain('Reported values: saved reviewer selection with its recorded source evidence and policy version.');
        const view = await grid({ project: valid.projectCode });
        expect(view.status).toBe(200); expect(view.body.data).toHaveLength(1);
        expect(view.body.data[0]).toMatchObject({SOC:15,sampleId:valid.sample.id,sourceResultIds:[first.id,second.id].sort()});
        expect(view.body.data[0].reportedValueSelectionId).toBe(exported.body.data[0].soc_selection_id);
        expect(JSON.stringify([exported.body.data, view.body.data])).not.toMatch(/7777|8888|9999/);
        expect(await prisma.result.count({ where: { sampleId: f.sample.id } })).toBe(4);
        expect(await prisma.result.findMany({where:{sampleId:valid.sample.id},orderBy:{replicateNo:'asc'}})).toEqual([first,second]);
    });
    test('different controlled units refuse averaging and no normalized mean is invented', async () => {
        const f=await fixture();await resultSet(f,[{value:1,unit:'%',replicateNo:1},{value:20,replicateNo:2}],{select:false});
        await expect(choose(f)).rejects.toMatchObject({code:'REPORTED_VALUE_SELECTION_REQUIRED'});
        const response = await exportData(f.projectCode);
        expect(response).toMatchObject({status:409,body:{code:'REPORTED_VALUE_SELECTION_REQUIRED'}});
        expect(await prisma.reportedValueSelection.count({where:{workItemId:f.item.id}})).toBe(0);
    });
    test.each(['methodology', 'unit', 'qualified'])('ambiguous %s evidence refuses until an explicit not-reportable choice; other selected samples remain intact', async kind => {
        const good = await fixture(), bad = await fixture({ projectCode: good.projectCode });
        await result(good, 42);
        await resultSet(bad,[{value:10,replicateNo:1,methodologyId:kind==='methodology'?'method-a':null},
            {value:kind==='qualified'?'<0.1':20,replicateNo:2,methodologyId:kind==='methodology'?'method-b':null,
                censoring:kind==='qualified'?'BELOW_LOQ':'NONE',unit:kind==='unit'?'mg/L':'g/kg'}],{select:false});
        const auditBefore=await prisma.auditLog.count();
        expect(await exportData(good.projectCode)).toMatchObject({status:409,body:{code:'REPORTED_VALUE_SELECTION_REQUIRED'}});
        expect(await prisma.auditLog.count()).toBe(auditBefore);
        await expect(choose(bad)).rejects.toMatchObject({code:'REPORTED_VALUE_SELECTION_REQUIRED'});
        const reason='Retained '+kind+' evidence cannot be combined';
        await choose(bad,{mode:'NOT_REPORTABLE',reason});
        const response = await exportData(good.projectCode);
        expect(response.status).toBe(200);
        expect(response.body.data.find(row => row['Sample ID'] === bad.sample.id)).toMatchObject({ SOC:'Not reportable: '+reason,soc_n:0,soc_flag:'NOT_REPORTABLE' });
        expect(response.body.data.find(row => row['Sample ID'] === good.sample.id)).toMatchObject({ SOC: 42, soc_n: 1, soc_flag:'AUTO_SINGLE' });
        expect(response.body.meta.ambiguousCellCount).toBe(0);
        const audit = await prisma.auditLog.findFirst({ where: { entity: 'EXPORT', entityId: response.body.meta.exportId } });
        expect(audit.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
        expect(audit.entityId).toBe(response.body.meta.exportId);
        expect(JSON.parse(audit.details).ambiguousCellCount).toBe(0);
        expect(await prisma.result.count({where:{sampleId:bad.sample.id}})).toBe(2);
    });
    test('single qualified and legacy null-validity results keep their exact value', async () => {
        const f = await fixture(); await result(f, '<0.1', { isValid: null });
        const response = await exportData(f.projectCode);
        expect(response.status).toBe(200); expect(response.body.data[0]).toMatchObject({ SOC: '<0.1', soc_as_measured: '<0.1', soc_normalized: '<0.1', soc_n: 1, soc_flag:'AUTO_SINGLE' });
        expect(scalar((await grid({ project: f.projectCode })).body.data[0].SOC)).toBe('<0.1');
    });
    test('archived approved samples remain exportable without enabling unapproved exports', async () => {
        const f = await fixture({ status: 'ARCHIVED' }); await result(f, 18);
        const response = await exportData(f.projectCode);
        expect(response.status).toBe(200); expect(response.body.data).toHaveLength(1); expect(response.body.data[0].SOC).toBe(18);
    });
    test('exports retain the saved lab/method policy after a later LATEST_VALID edit', async () => {
        const f = await fixture({ status: 'PROCESSING', itemStatus: 'IN_PROGRESS' });
        await prisma.methodology.create({ data: { id: 'same-method', analysisCode: 'SOC', name: 'Owned selection method', labId } });
        await prisma.workItem.update({ where: { id: f.item.id }, data: { methodologyId: 'same-method' } });
        const old = await result(f, 10, { createdAt: new Date('2020-01-01'), methodologyId: 'same-method' });
        await correctAndApproveReportedValue(prisma, { app, token, labId, item: f.item, original: old, value: 20 });
        const saved=await prisma.reportedValueSelection.findFirst({where:{workItemId:f.item.id}});
        await policy.change(jwt.decode(token),labId,{reason:'Later lab selection policy',changes:[{key:'results.reportedValueRule',value:'LATEST_VALID'}]});
        const original = policy.resolve;
        const lookup = jest.spyOn(policy, 'resolve').mockImplementation((lab,key,context)=>{
            if(key==='results.reportedValueRule')throw Error('Reader must use the saved policy');
            return original(lab,key,context);
        });
        const response = await exportData(f.projectCode);
        expect(response.status).toBe(200); expect(response.body.data[0]).toMatchObject({ SOC: 20, soc_n: 1, soc_flag:'AUTO_SINGLE', soc_as_measured: 20 });
        expect(response.body.meta.selectionPolicies).toEqual([expect.objectContaining({labId,analysisCode:'SOC',methodologyId:'same-method',
            version:saved.policyVersion,rule:saved.policyRule,reportedValueSelectionId:saved.id})]);
        expect(lookup.mock.calls.filter(([,key])=>key==='results.reportedValueRule')).toEqual([]);
        expect(await prisma.reportedValueSelection.findUnique({where:{id:saved.id}})).toEqual(saved);
    });
    test('an unknown policy refuses a new choice; a missing choice refuses export without an audit', async () => {
        const f = await fixture();await resultSet(f,[{value:10}],{select:false});
        const before = await prisma.auditLog.count();
        const original = policy.resolve;
        jest.spyOn(policy,'resolve').mockImplementation(async(lab,key,context)=>key==='results.reportedValueRule'?
            {...await original(lab,key,context),value:'UNKNOWN'}:original(lab,key,context));
        await expect(choose(f)).rejects.toMatchObject({code:'RESULT_POLICY_UNRESOLVED'});
        const response = await exportData(f.projectCode);
        expect(response.status).toBe(409); expect(response.body.code).toBe('REPORTED_VALUE_SELECTION_REQUIRED');
        expect(await prisma.auditLog.count()).toBe(before);
    });
    test.each([
        [{ startDate: '2026-01-02T00:00:00Z', endDate: '2026-01-02T23:59:59Z' }, [2]],
        [{ startDate: '2026-01-02T00:00:00Z' }, [2, 3]],
        [{ endDate: '2026-01-02T23:59:59Z' }, [1, 2]]
    ])('date bounds are merged and each bound works alone (%s)', async (bounds, expected) => {
        const projectCode = id('PROJ-010-DATES').toUpperCase();
        for (const day of [1, 2, 3]) { const f = await fixture({ projectCode, receptionDate: `2026-01-0${day}T12:00:00Z` }); await result(f, day); }
        const response = await grid({ project: projectCode, ...bounds });
        expect(response.status).toBe(200); expect(response.body.data.map(row => scalar(row.SOC)).sort()).toEqual(expected);
    });
    test('scope filters cannot expose another lab in either working view or WET_CHEM export', async () => {
        const f = await fixture({ assignedLab: 'OTHER-LAB-010' }); await result(f, 10);
        expect((await exportData(f.projectCode)).body.data).toEqual([]);
        expect((await grid({ project: f.projectCode })).body.data).toEqual([]);
        const external = await getAuthToken('EXTERNAL_VIEWER', labId, ['GTM'], [f.projectCode]);
        expect((await grid({ project: f.projectCode }, external)).status).toBe(403);
    });
    test('the actual mean authority enforces recorded r and refuses an unavailable limit', () => {
        const rows=[10,12].map((value,index)=>({id:String(index),attemptId:'owned',param:'SOC',value:String(value),unit:'g/kg',methodologyId,censoring:'NONE'}));
        const limit={attemptId:'owned',source:'QC_RULE',qcRuleId:'owned-rule',qcRuleVersion:1,controlledUnit:'g/kg',methodologyId,r:2};
        expect(calculateReportedMean(rows,[limit])).toMatchObject({value:11});
        expect(()=>calculateReportedMean(rows,[{...limit,r:1}])).toThrow(expect.objectContaining({code:'REPORTED_VALUE_OUTSIDE_LIMIT'}));
        expect(()=>calculateReportedMean(rows,[{...limit,r:null}])).toThrow(expect.objectContaining({code:'REPORTED_VALUE_LIMIT_MISSING'}));
    });
});
