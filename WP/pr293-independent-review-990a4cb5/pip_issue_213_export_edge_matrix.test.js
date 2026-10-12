const {randomUUID}=require('node:crypto');
const request=require('supertest');
const {qcGateFixture}=require('../helpers/qcGateFixture');
const {withQcRunHttp}=require('../helpers/qcRunHttpHarness');
const rules=require('../../services/workflowStateRules');
const {appendReportedSelection}=require('../../services/reportedValueSelectionService');
const {assembleReport}=require('../../services/reportAssembly');
const {createWorkItemFixture}=require('../helpers/workflowFixtures');
const {createExecutionResultFixture}=require('../helpers/workAttemptFixtures');
// #213: every export headline equals the report item's unrounded value and
// names the saved selection, its attempts and the source Result batches.
const owned=[];
afterEach(async()=>{for(const f of owned.splice(0))await f.close();});
const criteria={blankPerBatch:0,lrmPerBatch:0,duplicateEvery:0,crmEveryNBatches:0,ccvEvery:0};
async function fixture(options={}) {
    const f=await qcGateFixture({...options,criteria:{...criteria,...options.criteria}});owned.push(f);
    await f.db.sample.update({where:{id:f.items[0].sampleId},data:{latitude:1,longitude:2}});
    f.item=f.items[0];f.choose=choice=>rules.inTransaction(f.db,tx=>appendReportedSelection(tx,f.item,f.actor,choice));
    f.http=async(path,body)=>{let response;await withQcRunHttp(f.db,f.actor,async(app,token)=>{
        response=await request(app).post(path).set('Authorization','Bearer '+token).send(body);},{reviews:true});return response;};
    return f;
}
async function invoke(f,controller,action,{query={},body={},params={}}={}) {
    let response;const previousSource=process.env.SOURCE_SYSTEM_ID;process.env.SOURCE_SYSTEM_ID='owned-issue-213-source';
    try { await jest.isolateModulesAsync(async()=>{
        jest.doMock('../../prisma',()=>f.db);
        const res={headersSent:false,getHeader:()=>null,setHeader:()=>{},status(status){this.statusCode=status;return this;},
            json(value){response={status:this.statusCode || 200,body:value};return this;}};
        await require('../../controllers/'+controller)[action]({query,body,params,user:f.actor,
            sisAuth:{...f.actor,type:'USER',countries:['*'],projects:['*']}},res);
    }); } finally {jest.dontMock('../../prisma');if(previousSource===undefined)delete process.env.SOURCE_SYSTEM_ID;else process.env.SOURCE_SYSTEM_ID=previousSource;}
    expect({controller,action,status:response.status,body:response.status===200?null:response.body}).toMatchObject({status:200});
    return response.body;
}
const ids=text=>text ? text.split(';') : [];
async function surfaces(f,code) {
    const sampleId=f.item.sampleId,p=code.toLowerCase(),out={};
    const legacy=row=>({value:row.value,selectionId:row.reportedValueSelectionId,attemptIds:row.attemptIds,batchIds:row.batchIds});
    const flat=(row,key)=>({value:row[key],selectionId:row[p+'_selection_id'],attemptIds:ids(row[p+'_attempt_ids']),batchIds:ids(row[p+'_batch_ids'])});
    const query={updatedSince:'2020-01-01T00:00:00Z'};
    out.v1List=legacy((await invoke(f,'sisController','getSamples')).data.find(row=>row.specimenId===sampleId).analyticalResults[code]);
    out.v1Detail=legacy((await invoke(f,'sisController','getSampleById',{params:{id:sampleId}})).data.analyticalResults[code]);
    out.v1Delta=legacy((await invoke(f,'sisController','syncDelta',{query})).samples.find(row=>row.specimenId===sampleId).analyticalResults[code]);
    out.matrix=flat((await invoke(f,'sisController','getResultsMatrix')).data.find(row=>row.sample_id===(f.sample.originalId || sampleId)),code);
    out.geoJson=flat((await invoke(f,'sisController','getGeoJson')).features.find(row=>row.properties.id===(f.sample.originalId || sampleId)).properties,p);
    for(const type of ['WET_CHEM','SPECTRAL'])
        out[type]=flat((await invoke(f,'exportController','getExportData',{body:{type,includeUnapproved:true}})).data
            .find(row=>row['Sample ID']===(f.sample.originalId || sampleId)),code);
    const grid=(await invoke(f,'dataResultsController','getAnalyticalResults')).data.find(row=>row.sampleId===sampleId && row[code]!==undefined);
    out.grid={...flat(grid,code),rowSelectionId:grid.reportedValueSelectionId,rowAttemptIds:grid.attemptIds,rowBatchIds:grid.batchIds};
    return out;
}
async function expectExportsEqualReport(f,code,extra=()=>{}) {
    f.sample=await f.db.sample.findUnique({where:{id:f.item.sampleId}});
    const report=await assembleReport(f.item.sampleId,{...f.actor,language:'en'},{db:f.db});
    const item=report.content.resultGroups.flatMap(group=>group.items).find(row=>row.param===code);
    const sources=await f.db.result.findMany({where:{id:{in:item.sourceResultIds}}});
    const batchIds=[...new Set(sources.map(row=>row.batchId).filter(Boolean))].sort();
    const headline=item.reportedMode!=='NOT_REPORTABLE' && Number.isFinite(Number(item.value)) ? Number(item.value) : item.value;
    const before=await f.db.result.findMany({orderBy:{id:'asc'}}),all=await surfaces(f,code);
    for(const [surface,row] of Object.entries(all)) {
        expect({surface,value:row.value}).toEqual({surface,value:headline});
        expect({surface,selectionId:row.selectionId,attemptIds:row.attemptIds,batchIds:row.batchIds})
            .toEqual({surface,selectionId:item.reportedValueSelectionId,attemptIds:item.attemptIds,batchIds});
    }
    expect(all.grid).toMatchObject({rowSelectionId:item.reportedValueSelectionId,rowAttemptIds:item.attemptIds,rowBatchIds:batchIds});
    expect(await f.db.result.findMany({orderBy:{id:'asc'}})).toEqual(before);
    extra({item,all,sources,batchIds});
    return {item,all,sources,batchIds};
}
const V2_FIELDS=['observationId','reportedValueSelectionId','specimenId','fieldSampleId','labSampleId','laboratoryId','country','projectCode',
    'parameter','parameterCode','parameterName','asMeasured','normalized','controlledUnit','qudtUnit','lod','loq','provenance','basis',
    'censoring','replicateNo','attemptId','batchId','isValid','method','glosis','analysedAt','updatedAt'].sort();
async function expectRawV2(f,choose) {
    const before=await invoke(f,'sisV2Controller','getObservations');await choose();
    const after=await invoke(f,'sisV2Controller','getObservations'),raw=await f.db.result.findMany();
    expect({total:after.total,count:after.count,nextCursor:after.nextCursor}).toEqual({total:before.total,count:before.count,nextCursor:before.nextCursor});
    const strip=rows=>rows.map(({reportedValueSelectionId,...row})=>row);
    expect(strip(after.data)).toEqual(strip(before.data));
    for(const row of after.data) {
        const result=raw.find(source=>source.id===row.observationId);
        expect(Object.keys(row).sort()).toEqual(V2_FIELDS);
        expect(row).toMatchObject({attemptId:result.attemptId ?? null,batchId:result.batchId ?? null,asMeasured:{rawEntry:result.value}});
    }
    const capabilities=await invoke(f,'sisV2Controller','getCapabilities');
    expect(capabilities.observationFields).toMatchObject({attemptId:{nullable:true},batchId:{nullable:true}});
    return after;
}
async function acceptedRepeat(f) {
    const item=f.item,original=await rules.inTransaction(f.db,tx=>require('../../services/resultWriteService').writeResultsExecution(tx,
        {sampleId:item.sampleId,workItemId:item.id,actor:f.actor,measurements:[{param:item.analysis,value:'12.0',equipmentId:f.instrument.id}]}));
    const submit=async note=>{
        await require('../../services/workItemStateService').transitionWorkItem(item.id,'COMPLETED',f.actor,note,{},f.db);
        await require('../../services/submissionStateService').createSubmissionForItems({db:f.db,actor:f.actor,sampleId:item.sampleId,type:'FULL',workItemIds:[item.id]});
    };
    await submit('Recorded owned original');
    expect((await f.http('/api/work/'+item.id+'/review',{decision:'RETURN',attemptId:original[0].attemptId,reasonCode:'REVIEW_OUTLIER',
        note:'Compare original worksheet measurement with repeat'})).status).toBe(200);
    const [repeat]=await rules.inTransaction(f.db,tx=>require('../../services/resultWriteService').writeResultsExecution(tx,
        {sampleId:item.sampleId,workItemId:item.id,actor:f.actor,measurements:[{param:item.analysis,value:'12.6',equipmentId:f.instrument.id}]}));
    await submit('Complete repeat');
    return {original:original[0],repeat};
}


const protectedRows=async f=>JSON.parse(JSON.stringify(await Promise.all([
 f.db.result.findMany({orderBy:{id:'asc'}}),f.db.workAttempt.findMany({orderBy:{id:'asc'}}),
 f.db.reviewDecision.findMany({orderBy:{id:'asc'}}),f.db.reportedValueSelection.findMany({orderBy:{id:'asc'}})
])));
async function independentlyCompare(f, expected) {
 f.sample=await f.db.sample.findUnique({where:{id:f.item.sampleId}});
 const report=await assembleReport(f.item.sampleId,f.actor,{db:f.db});
 const item=report.content.resultGroups.flatMap(g=>g.items).find(row=>row.param===f.analysisCode);
 expect(item.value).toBe(expected);
 const before=await protectedRows(f),all=await surfaces(f,f.analysisCode);
 for(const [name,row] of Object.entries(all)){
  expect({surface:name,value:row.value}).toEqual({surface:name,value:expected});
  expect(row.selectionId).toBe(item.reportedValueSelectionId);
  expect(row.attemptIds).toEqual(item.attemptIds);
 }
 expect(await protectedRows(f)).toEqual(before);
}
test.each(['en','es','es-419','fr','pt'])('localized NOT_REPORTABLE matches the actual report on all eight surfaces (%s)',async locale=>{
 const f=await fixture({status:'ACCEPTED'});f.actor.language=locale;
 await f.result(f.item);await f.choose({mode:'NOT_REPORTABLE',reason:'Retained worksheet missing'});
 const expected=require('../../locales/'+locale+'.json').reportedValue.notReportable+': Retained worksheet missing';
 await independentlyCompare(f,expected);
});
test.each([
 {value:'<5',numericValue:5,censoring:'LT'},
 {value:'>20',numericValue:20,censoring:'GT'},
 {value:'Loam',numericValue:null,censoring:'NONE'}
])('censored or categorical selected text remains unchanged in every report/export ($value)',async data=>{
 const f=await fixture({status:'ACCEPTED'});f.actor.language='en';
 const row=await createExecutionResultFixture(f.db,{attemptStatus:'ACCEPTED',data:{id:randomUUID(),sampleId:f.item.sampleId,
  param:f.analysisCode,methodologyId:f.item.methodologyId,unit:'fixture-unit',isCurrent:true,isValid:true,flags:'[]',...data}});
 await f.choose({mode:'ATTEMPT',attemptIds:[row.attemptId]});
 await independentlyCompare(f,data.value);
});
