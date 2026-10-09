const {qcGateFixture}=require('../helpers/qcGateFixture');
const rules=require('../../services/workflowStateRules');
const {appendReportedSelection}=require('../../services/reportedValueSelectionService');
const {readSampleReportedValues}=require('../../services/reportedValueReadService');
const {assembleReport}=require('../../services/reportAssembly');
const {canPublish}=require('../../services/workEligibility');
const {formatReportedValue}=require('../../../shared/reportedValueFormat');
const owned=[];
afterEach(async()=>{for(const f of owned.splice(0))await f.close();});
async function fixture() {
    const f=await qcGateFixture({status:'ACCEPTED',criteria:{blankPerBatch:0,lrmPerBatch:0,duplicateEvery:0,crmEveryNBatches:0,ccvEvery:0}});
    owned.push(f);f.row=await f.result(f.items[0]);
    await f.db.sample.update({where:{id:f.items[0].sampleId},data:{latitude:1,longitude:2}});
    f.choose=choice=>rules.inTransaction(f.db,tx=>appendReportedSelection(tx,f.items[0],f.actor,choice));
    return f;
}
async function invoke(f,controller,action,{query={},body={},params={}}={}) {
    let response; const previousSource=process.env.SOURCE_SYSTEM_ID;
    process.env.SOURCE_SYSTEM_ID='owned-audit-192-source';
    try { await jest.isolateModulesAsync(async()=>{
        jest.doMock('../../prisma',()=>f.db);
        const res={headersSent:false,getHeader:()=>null,setHeader:()=>{},status(status){this.statusCode=status;return this;},
            json(value){response={status:this.statusCode || 200,body:value};return this;}};
        await require('../../controllers/'+controller)[action]({query,body,params,user:f.actor,
            sisAuth:{...f.actor,type:'USER',countries:['*'],projects:['*']}},res);
    }); } finally {jest.dontMock('../../prisma'); if(previousSource===undefined)delete process.env.SOURCE_SYSTEM_ID;else process.env.SOURCE_SYSTEM_ID=previousSource;}
    return response;
}
test('assembly reads the saved selection once, keeps full precision, source ids and methodology precision',async()=>{
    const f=await fixture(), saved=await f.choose(), before=await f.snapshot();
    const report=await assembleReport(f.items[0].sampleId,{...f.actor,language:'en'},{db:f.db});
    expect(report.content.resultGroups.flatMap(group=>group.items)).toHaveLength(1);
    expect(report.content.resultGroups[0].items[0]).toMatchObject({value:saved[0].valueText,reportedValueSelectionId:saved[0].id,
        sourceResultIds:[f.row.id],decimalPlaces:f.method.decimalPlaces});
    expect(report.content.evidence.reportedValueSelections[0]).toMatchObject({selectionGroupId:saved[0].selectionGroupId});
    expect(await f.snapshot()).toEqual(before);
});
test.each(['en','es','es-419','fr','pt'])('not-reportable assembly displays its localized recorded reason (%s) and supplies publication proof',async locale=>{
    const f=await fixture();await f.choose({mode:'NOT_REPORTABLE',reason:'Reference worksheet incomplete'});
    const sample=await f.db.sample.findUnique({where:{id:f.items[0].sampleId},include:{workItems:true,results:true}});
    const proof=await readSampleReportedValues(f.db,sample), before=await f.snapshot();
    expect(canPublish({...sample,status:'APPROVED'},null,f.actor,{reportedSelectionProof:proof})).toMatchObject({allowed:true});
    const report=await assembleReport(sample.id,{...f.actor,language:locale},{db:f.db,reportedSelectionProof:proof});
    expect(report.content.resultGroups[0].items[0]).toMatchObject({reportedMode:'NOT_REPORTABLE',
        value:require('../../locales/'+locale+'.json').reportedValue.notReportable+': Reference worksheet incomplete',unit:''});
    expect(await f.snapshot()).toEqual(before);
});
test('accepted measured work with no selection refuses assembly instead of reading a raw result',async()=>{
    const f=await fixture(), before=await f.snapshot();
    await expect(assembleReport(f.items[0].sampleId,f.actor,{db:f.db})).rejects.toMatchObject({code:'REPORTED_VALUE_SELECTION_REQUIRED'});
    expect(await f.snapshot()).toEqual(before);
});
test.each(['ATTEMPT','NOT_REPORTABLE'])('WET_CHEM, reported grid and every SIS v1 surface match the persisted %s outcome',async mode=>{
    const f=await fixture(), reason='Reference worksheet incomplete';
    const saved=await f.choose(mode==='NOT_REPORTABLE'?{mode,reason}:{mode,attemptIds:[f.row.attemptId]});
    const expected=mode==='NOT_REPORTABLE'?'Not reportable: '+reason:Number(f.row.value);
    const before=await f.snapshot();
    const exported=await invoke(f,'exportController','getExportData',{body:{type:'WET_CHEM',includeUnapproved:true}});
    expect(exported.status).toBe(200);expect(exported.body.data[0][f.analysisCode]).toBe(expected);
    expect(exported.body.data[0][f.analysisCode.toLowerCase()+'_selection_id']).toBe(saved[0].id);
    const grid=await invoke(f,'dataResultsController','getAnalyticalResults');
    expect(grid.status).toBe(200);expect(grid.body.data).toHaveLength(1);expect(grid.body.data[0][f.analysisCode]).toBe(expected);
    expect(grid.body.data[0]).toMatchObject({reportedValueSelectionId:saved[0].id,sourceResultIds:JSON.parse(saved[0].resultIds)});
    for(const action of ['getSamples','getSampleById','getResultsMatrix','syncDelta']) {
        const response=await invoke(f,'sisController',action,{params:{id:f.items[0].sampleId},query:{updatedSince:'2020-01-01T00:00:00Z'}});
        expect({action,status:response.status,body:response.body}).toMatchObject({status:200});
        const sample=action==='getSamples'?response.body.data[0]:action==='syncDelta'?response.body.samples[0]:response.body.data;
        if(action==='getResultsMatrix')expect(response.body.data[0][f.analysisCode]).toBe(expected);
        else expect(sample.analyticalResults[f.analysisCode]).toMatchObject({value:expected,reportedValueSelectionId:saved[0].id});
    }
    const geo=await invoke(f,'sisController','getGeoJson');expect(geo.status).toBe(200);
    expect(geo.body.features[0].properties[f.analysisCode.toLowerCase()]).toBe(expected);
    // Export appends its audit; every analytical, attempt and report row remains.
    const after=await f.snapshot();for(const index of [0,1,2,3,4,6,7,8])expect(after[index]).toEqual(before[index]);
});
test('raw v2 rows, counts and ordering retain their contract; only selection membership is added',async()=>{
    const f=await fixture();
    const before=await invoke(f,'sisV2Controller','getObservations');
    expect(before.status).toBe(200);expect(before.body.data[0]).toMatchObject({observationId:f.row.id,reportedValueSelectionId:null});
    const saved=await f.choose(), retained=await f.snapshot(), after=await invoke(f,'sisV2Controller','getObservations');
    expect(after.status).toBe(200);expect(after.body.total).toBe(before.body.total);expect(after.body.count).toBe(before.body.count);
    expect(after.body.nextCursor).toBe(before.body.nextCursor);
    const strip=rows=>rows.map(({reportedValueSelectionId,...row})=>row);
    expect(strip(after.body.data)).toEqual(strip(before.body.data));
    expect(after.body.data[0].reportedValueSelectionId).toBe(saved[0].id);
    expect(await f.snapshot()).toEqual(retained);
    const capabilities=await invoke(f,'sisV2Controller','getCapabilities');
    expect(capabilities.body.observationFields.reportedValueSelectionId).toMatchObject({nullable:true});
});
test.each([
    {value:'12.3456789',decimalPlaces:2,expected:'12.35'},
    {value:'12.3456789',decimalPlaces:0,expected:'12'},
    {value:'12.3456789',decimalPlaces:null,expected:'12.3456789'},
    {value:'<0.005123',decimalPlaces:2,censoring:'LT',expected:'<0.005123'},
    {value:'Not reportable: No evidence',reportedMode:'NOT_REPORTABLE',decimalPlaces:2,expected:'Not reportable: No evidence'},
    {value:'loam',decimalPlaces:2,expected:'loam'}
])('report rendering applies frozen methodology precision to $value',({expected,...item})=>{
    expect(formatReportedValue(item)).toBe(expected);
});
