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

test('ATTEMPT selection from a batched source: every export carries the report value and its selection, attempt and batch ids',async()=>{
    const f=await fixture({criteria:{blankPerBatch:1}}),native=require('../../services/qcNativeRunService');
    const run=await native.startNativeRun(f.db,(await native.buildNativeRun(f.db,f.actor,{...f.input,workItemIds:[f.item.id]})).id,f.actor);
    await require('../../services/qcNativeMeasurementService').writeNativeMeasurements(f.db,run.id,f.actor,
        {measurements:[{positionId:run.positions.find(row=>row.kind==='BLANK').id,value:0}]});
    f.item=await f.db.workItem.findUnique({where:{id:f.item.id}});const row=await f.result(f.item);
    expect(row.batchId).toBe(run.id);
    await require('../../services/workItemStateService').transitionWorkItem(f.item.id,'COMPLETED',f.actor,'Owned batched source ready for review',{},f.db);
    await require('../../services/submissionStateService').createSubmissionForItems({db:f.db,actor:f.actor,sampleId:f.item.sampleId,type:'FULL',workItemIds:[f.item.id]});
    await expectRawV2(f,async()=>{
        const response=await f.http('/api/work/'+f.item.id+'/review',{decision:'ACCEPT',reportedValueSelection:{mode:'ATTEMPT',attemptIds:[row.attemptId]}});
        expect({status:response.status,body:response.body}).toMatchObject({status:200});
    });
    const saved=await f.db.reportedValueSelection.findFirst({where:{workItemId:f.item.id}});
    const {item,batchIds}=await expectExportsEqualReport(f,f.analysisCode);
    expect(item).toMatchObject({value:'7.123456789',reportedValueSelectionId:saved.id,attemptIds:[row.attemptId]});
    expect(batchIds).toEqual([run.id]);
    const v2=await invoke(f,'sisV2Controller','getObservations');
    expect(v2.data.find(obs=>obs.observationId===row.id)).toMatchObject({attemptId:row.attemptId,batchId:run.id,reportedValueSelectionId:saved.id});
});

test('MEAN of a retained questioned 12.0 and its repeat 12.6 exports 12.3 everywhere while v2 keeps its raw current row',async()=>{
    const f=await fixture({criteria:{repeatabilityLimit:1}}),{original,repeat}=await acceptedRepeat(f);
    const after=await expectRawV2(f,async()=>{
        const response=await f.http('/api/work/'+f.item.id+'/review',{decision:'ACCEPT',reportedValueSelection:{mode:'MEAN',
            attemptIds:[original.attemptId,repeat.attemptId],reason:'Compare complete original and repeat determinations'}});
        expect({status:response.status,body:response.body}).toMatchObject({status:200});
    });
    expect(after.data.filter(row=>[original.id,repeat.id].includes(row.observationId)).map(row=>row.asMeasured.value)).toEqual([12.6]);
    const {item,all}=await expectExportsEqualReport(f,f.analysisCode);
    expect(item).toMatchObject({value:'12.3',attemptIds:[original.attemptId,repeat.attemptId].sort()});
    expect(all.WET_CHEM.value).toBe(12.3);
});

test('a reviewer-selected retained QUESTIONED source exports its own value, not the current repeat',async()=>{
    const f=await fixture(),{original,repeat}=await acceptedRepeat(f);
    const response=await f.http('/api/work/'+f.item.id+'/review',{decision:'ACCEPT',reportedValueSelection:{mode:'ATTEMPT',
        attemptIds:[original.attemptId],reason:'Reviewer verified the original worksheet determination'}});
    expect({status:response.status,body:response.body}).toMatchObject({status:200});
    expect(await f.db.workAttempt.findUnique({where:{id:original.attemptId}})).toMatchObject({status:'QUESTIONED'});
    expect(await f.db.result.findUnique({where:{id:original.id}})).toMatchObject({isCurrent:false});
    const {item,all}=await expectExportsEqualReport(f,f.analysisCode);
    expect(item).toMatchObject({value:'12.0',sourceResultIds:[original.id],attemptIds:[original.attemptId]});
    for(const row of Object.values(all))expect(row.value).toBe(12);
    expect(repeat.value).toBe('12.6');
});

test('NOT_REPORTABLE exports the localized report text with its selection id and no source ids',async()=>{
    const f=await fixture({status:'ACCEPTED'});await f.result(f.item);
    const saved=await f.choose({mode:'NOT_REPORTABLE',reason:'Reference worksheet incomplete'});
    const {item}=await expectExportsEqualReport(f,f.analysisCode);
    expect(item).toMatchObject({value:'Not reportable: Reference worksheet incomplete',reportedValueSelectionId:saved[0].id});
});

test('an analysis configured in a non-standard unit (SOC in %) keeps its unconverted headline; normalized stays in _normalized',async()=>{
    const f=await fixture({status:'ACCEPTED'});
    if(!await f.db.analysis.findUnique({where:{code:'SOC'}}))await f.db.analysis.create({data:{code:'SOC',name:'Soil organic carbon',unitCode:'fixture-unit'}});
    await f.db.analysis.update({where:{code:'SOC'},data:{units:'%'}});
    const method=await f.db.methodology.create({data:{analysisCode:'SOC',name:'Owned percent method'}});
    await require('../../services/qcRuleService').change(f.actor,{labId:f.labId,analysisCode:'SOC',methodologyId:method.id,
        criteria:{...criteria},expectedVersion:0,reason:'Reviewed fixture criteria'},{db:f.db});
    const original=await f.result(f.items[0]);await f.choose({mode:'ATTEMPT',attemptIds:[original.attemptId]});
    f.item=await createWorkItemFixture(f.db,{data:{id:randomUUID(),sampleId:f.item.sampleId,labId:f.labId,analysis:'SOC',
        methodologyId:method.id,status:'ACCEPTED',result:'1.5',history:'[]'}});
    await require('../../services/orderService').reviseAnalyses(f.item.sampleId, {
        analyses: [f.items[0].analysis, 'SOC'], reason: 'Owned additional percent SOC determination'
    }, f.actor, { tx: f.db });
    const row=await createExecutionResultFixture(f.db,{attemptStatus:'ACCEPTED',data:{id:randomUUID(),sampleId:f.item.sampleId,param:'SOC',
        methodologyId:method.id,value:'1.5',numericValue:1.5,isCurrent:true,isValid:true,flags:'[]',unit:'%'}});
    await f.choose({mode:'ATTEMPT',attemptIds:[row.attemptId]});
    const {item,all}=await expectExportsEqualReport(f,'SOC');
    expect(item.value).toBe('1.5');
    for(const row of Object.values(all))expect(row.value).toBe(1.5);
    const exported=await invoke(f,'exportController','getExportData',{body:{type:'WET_CHEM',includeUnapproved:true}});
    expect(exported.data[0]).toMatchObject({SOC:1.5,soc_unit:'%',soc_normalized:15,soc_controlled_unit:'g/kg'});
    expect(exported.meta.analysisMetadata.SOC.unit).toBe('%');
    const matrix=await invoke(f,'sisController','getResultsMatrix');expect(matrix.data[0]).toMatchObject({SOC:1.5,soc_normalized:15});
    const geo=await invoke(f,'sisController','getGeoJson');expect(geo.features[0].properties).toMatchObject({soc:1.5,soc_normalized:15});
    const v1=await invoke(f,'sisController','getSamples');expect(v1.data[0].analyticalResults.SOC).toMatchObject({value:1.5,normalized:15});
    const grid=await invoke(f,'dataResultsController','getAnalyticalResults');
    expect(grid.data.find(row=>row.SOC!==undefined)).toMatchObject({SOC:1.5,soc_unit:'%',soc_normalized:15});
});
