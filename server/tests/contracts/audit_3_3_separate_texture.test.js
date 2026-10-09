const {randomUUID}=require('node:crypto');
const request=require('supertest');
const {qcGateFixture}=require('../helpers/qcGateFixture');
const {withQcRunHttp}=require('../helpers/qcRunHttpHarness');
const {createSampleFixture,createWorkItemFixture}=require('../helpers/workflowFixtures');
const rules=require('../../services/workflowStateRules');
const selections=require('../../services/reportedValueSelectionService');
const owned=[];
afterEach(async()=>{for(const f of owned.splice(0))await f.close();});
async function fixture({mean=false}={}) {
    const f=await qcGateFixture();owned.push(f);
    const sample=await createSampleFixture(f.db,{data:{id:randomUUID(),originalId:randomUUID(),assignedLab:f.labId,
        status:'PROCESSING',dryingStatus:'DONE',preparationStatus:'DONE',requiredAnalyses:'["SAND","SILT","CLAY","TEXTURE"]'}});
    await f.db.unit.create({data:{code:'%',display:'%',quantityKind:'MASS_FRACTION',factorToBase:1}});
    f.textureItems={};f.fractions=[];
    for(const analysis of ['SAND','SILT','CLAY','TEXTURE']) {
        await f.db.analysis.create({data:{code:analysis,name:'Owned '+analysis.toLowerCase()+' measurement',units:analysis==='TEXTURE'?'USDA_12_CLASS':'%',validation:'{}'}});
        const method=await f.db.methodology.create({data:{analysisCode:analysis,name:analysis+' owned method'}});
        await require('../../services/qcRuleService').change(f.actor,{labId:f.labId,analysisCode:analysis,methodologyId:method.id,
            expectedVersion:0,reason:'Owned texture selection case',criteria:{blankPerBatch:0,lrmPerBatch:0,
                duplicateEvery:0,crmEveryNBatches:0,ccvEvery:0,repeatabilityLimit:2}},{db:f.db});
        f.textureItems[analysis]=await createWorkItemFixture(f.db,{data:{id:randomUUID(),sampleId:sample.id,assignedLab:f.labId,
            analysis,methodologyId:method.id,status:'IN_PROGRESS'}});
    }
    for(const [param,values] of [['SAND',mean?[59.8,60.2]:[60]],['SILT',[25]],['CLAY',[15]]]) {
        const rows=await rules.inTransaction(f.db,tx=>require('../../services/resultWriteService').writeResultsExecution(tx,{
            sampleId:sample.id,workItemId:f.textureItems[param].id,actor:f.actor,
            measurements:values.map((value,index)=>({param,value:String(value),unit:'%',replicateNo:index+1,equipmentId:f.instrument.id}))}));
        f.fractions.push(...rows);
    }
    f.texture=await rules.inTransaction(f.db,tx=>require('../../services/resultWriteService').deriveTextureResult(tx,{sampleId:sample.id,actor:f.actor}));
    expect(f.texture).not.toBeNull();
    for(const item of Object.values(f.textureItems)) await require('../../services/workItemStateService').transitionWorkItem(item.id,'COMPLETED',f.actor,'Owned texture review',{},f.db);
    await require('../../services/submissionStateService').createSubmissionForItems({db:f.db,actor:f.actor,sampleId:sample.id,type:'FULL',
        workItemIds:Object.values(f.textureItems).map(row=>row.id)});
    f.sample=sample;
    f.review=async(param,body={})=>{
        let response;await withQcRunHttp(f.db,f.actor,async(app,token)=>{
            response=await request(app).post('/api/work/'+f.textureItems[param].id+'/review').set('Authorization','Bearer '+token).send({decision:'ACCEPT',...body});
        },{reviews:true});return response;
    };
    f.acceptFractions=async()=>{for(const param of ['SAND','SILT','CLAY'])expect(await f.review(param)).toMatchObject({status:200});};
    f.all=async()=>JSON.stringify([await f.snapshot(),await f.db.workAttempt.findMany({orderBy:{id:'asc'}}),
        await f.db.reportedValueSelection.findMany({orderBy:{id:'asc'}})]);
    f.read=()=>rules.inTransaction(f.db,tx=>selections.readReportedSelection(tx,f.textureItems.TEXTURE));
    return f;
}
test('separate TEXTURE first refuses with zero writes, then chooses the exact matching retained derived Result',async()=>{
    const f=await fixture(),before=await f.all();
    const refused=await f.review('TEXTURE');expect(refused).toMatchObject({status:409,body:{code:'REPORTED_VALUE_SOURCE_SELECTION_REQUIRED'}});
    expect(await f.all()).toBe(before);
    await f.acceptFractions();const retained=await f.db.result.findMany({orderBy:{id:'asc'}});
    expect(await f.review('TEXTURE')).toMatchObject({status:200});
    const saved=await f.read();expect(saved.rows).toHaveLength(1);
    expect(saved.rows[0]).toMatchObject({analysisCode:'TEXTURE',mode:'ATTEMPT',rule:'AUTO_SINGLE',valueText:f.texture.value});
    expect(JSON.parse(saved.rows[0].resultIds)).toEqual([f.texture.id]);
    expect(JSON.parse(saved.rows[0].evidenceSnapshot).fractionSelections).toHaveLength(3);
    expect(await f.db.result.findMany({orderBy:{id:'asc'}})).toEqual(retained);
});
test('a fraction MEAN re-derives a single class and retains every one of its four raw source ids',async()=>{
    const f=await fixture({mean:true});await f.acceptFractions();
    const retained=await f.db.result.findMany({orderBy:{id:'asc'}});expect(await f.review('TEXTURE')).toMatchObject({status:200});
    const saved=(await f.read()).rows[0];expect(saved).toMatchObject({mode:'DERIVED',rule:'AUTO_DERIVED_FROM_FRACTIONS',derivation:'calculateUsdaTexture'});
    expect(JSON.parse(saved.attemptIds)).toEqual([]);
    expect(JSON.parse(saved.resultIds)).toEqual(f.fractions.map(row=>row.id).sort());
    expect(saved.valueText).toBe(require('../../utils/soilCalculations').calculateUsdaTexture(60,25,15).className);
    const sand=JSON.parse(saved.evidenceSnapshot).fractionSelections.find(row=>row.analysisCode==='SAND');
    expect(sand.value).toBe(60);expect(sand.resultIds).toHaveLength(2);
    expect(await f.db.result.findMany({orderBy:{id:'asc'}})).toEqual(retained);
});
test.each(['en','es','es-419','fr','pt'])('a not-reportable fraction propagates its id and localized reason to TEXTURE (%s)',async locale=>{
    const f=await fixture();
    expect(await f.review('SAND',{reportedValueSelection:{mode:'NOT_REPORTABLE',reason:'Worksheet absent'}})).toMatchObject({status:200});
    for(const param of ['SILT','CLAY'])expect(await f.review(param)).toMatchObject({status:200});
    expect(await f.review('TEXTURE')).toMatchObject({status:200});
    const saved=(await f.read()).rows[0],sand=await f.db.reportedValueSelection.findFirst({where:{workItemId:f.textureItems.SAND.id}});
    expect(saved).toMatchObject({mode:'NOT_REPORTABLE',rule:'AUTO_DERIVED_FROM_FRACTIONS'});
    expect(JSON.parse(saved.reason)).toMatchObject({fractions:[{analysisCode:'SAND',selectionId:sand.id}]});
    const text=require('../../services/reportedValueReadService').reportedValueText({mode:saved.mode,reason:saved.reason},locale);
    expect(text).toBe(require('../../locales/'+locale+'.json').reportedValue.notReportable+': '+
        require('../../locales/'+locale+'.json').reportedValue.fractionNotReportable.replace('{{fraction}}','SAND').replace('{{selectionId}}',sand.id));
});
test('REVIEWER_PICKS refuses implicit texture, but an explicit DERIVED confirmation is recorded as REVIEWER',async()=>{
    const f=await fixture();await f.acceptFractions();await f.setPolicy([{key:'results.reportedValueRule',value:'REVIEWER_PICKS'}]);
    const before=await f.all();expect(await f.review('TEXTURE')).toMatchObject({status:409,body:{code:'REPORTED_VALUE_SELECTION_REQUIRED'}});
    expect(await f.all()).toBe(before);
    expect(await f.review('TEXTURE',{reportedValueSelection:{mode:'DERIVED',reason:'Fraction report values verified'}})).toMatchObject({status:200});
    expect((await f.read()).rows[0]).toMatchObject({mode:'DERIVED',rule:'REVIEWER',reason:'Fraction report values verified'});
});
test('a replacement fraction selection makes retained TEXTURE stale without changing it',async()=>{
    const f=await fixture();await f.acceptFractions();expect(await f.review('TEXTURE')).toMatchObject({status:200});
    const first=(await f.read()).rows[0],item=f.textureItems.SAND;
    const current=await rules.inTransaction(f.db,tx=>selections.readReportedSelection(tx,item));
    await selections.replaceReportedSelection(f.db,item.id,f.actor,{expectedGroupId:current.rows[0].selectionGroupId,
        selection:{mode:'ATTEMPT',attemptIds:JSON.parse(current.rows[0].attemptIds),reason:'Fraction selection re-confirmed'}});
    await expect(f.read()).rejects.toMatchObject({code:'REPORTED_VALUE_STALE'});
    expect(await f.db.reportedValueSelection.findUnique({where:{id:first.id}})).toEqual(first);
});

test('canonical uniqueness prevents a duplicate owner; unresolved retained owners refuse layout with ids and zero writes',async()=>{
    const f=await fixture();await f.acceptFractions();
    const before=await f.all(),duplicate={...f.textureItems.SAND,id:randomUUID()};
    await expect(createWorkItemFixture(f.db,{data:{id:duplicate.id,sampleId:f.sample.id,analysis:'SAND',
        assignedLab:f.labId,status:'WAIVED'}})).rejects.toMatchObject({code:'P2002'});
    await expect(rules.inTransaction(f.db,async tx=>{
        const context=await require('../../services/reportedValueSelectionContext').loadSelectionEvidence(tx,f.textureItems.TEXTURE);
        const items=await tx.workItem.findMany({where:{sampleId:f.sample.id,duplicateOf:null}});
        return require('../../services/reportedValueTextureService').textureLayout({workItem:{findMany:async()=>[...items,duplicate]}},
            f.textureItems.TEXTURE,context);
    })).rejects.toMatchObject({code:'REPORTED_VALUE_LAYOUT_UNSUPPORTED',details:{workItemIds:
        expect.arrayContaining([duplicate.id,f.textureItems.SAND.id,f.textureItems.TEXTURE.id])}});
    expect(await f.all()).toBe(before);
});

test.each(['partial','mixed','unresolved'])('texture layout validator refuses %s retained facts and makes zero writes',async kind=>{
    const f=await fixture(),before=await f.all();
    await expect(rules.inTransaction(f.db,async tx=>{
        const item=f.textureItems.TEXTURE,attempts=await tx.workAttempt.findMany({where:{workItemId:item.id}}),
            results=await tx.result.findMany({where:{attemptId:{in:attempts.map(row=>row.id)}}});
        const lineage=require('../../services/reportedValueSelectionLineage').buildSelectionLineage(attempts,results);
        const candidate=lineage.eligible[0];
        if(kind==='partial')candidate.results=[{...candidate.results[0],param:'SAND'}];
        if(kind==='mixed')candidate.results=[...candidate.results,{...candidate.results[0],id:'retained-partial-fraction',param:'SAND'}];
        if(kind==='unresolved')candidate.results=[{...candidate.results[0],flags:JSON.stringify(['SOURCE_SAND_missing','SOURCE_SILT_missing','SOURCE_CLAY_missing'])}];
        return require('../../services/reportedValueTextureService').textureLayout(tx,item,{sample:f.sample,lineage});
    })).rejects.toMatchObject({statusCode:409,code:'REPORTED_VALUE_LAYOUT_UNSUPPORTED'});
    expect(await f.all()).toBe(before);
});

test('a complete composite execution still saves one atomic four-output selection group',async()=>{
    const f=await fixture(),sample=await createSampleFixture(f.db,{data:{id:randomUUID(),originalId:randomUUID(),assignedLab:f.labId,
        status:'PROCESSING',dryingStatus:'DONE',preparationStatus:'DONE',requiredAnalyses:'["TEXTURE"]'}});
    const item=await createWorkItemFixture(f.db,{data:{id:randomUUID(),sampleId:sample.id,assignedLab:f.labId,analysis:'TEXTURE',
        methodologyId:f.textureItems.TEXTURE.methodologyId,status:'IN_PROGRESS'}});
    await rules.inTransaction(f.db,tx=>require('../../services/resultWriteService').writeTextureDetermination(tx,{sampleId:sample.id,
        workItemId:item.id,actor:f.actor,measurement:{param:'TEXTURE',equipmentId:f.instrument.id},fractions:{sand:60,silt:25,clay:15}}));
    await require('../../services/workItemStateService').transitionWorkItem(item.id,'COMPLETED',f.actor,'Composite comparison',{},f.db);
    await require('../../services/submissionStateService').createSubmissionForItems({db:f.db,actor:f.actor,sampleId:sample.id,type:'FULL',workItemIds:[item.id]});
    const retained=await f.db.result.findMany({orderBy:{id:'asc'}});
    await withQcRunHttp(f.db,f.actor,async(app,token)=>{
        expect(await request(app).post('/api/work/'+item.id+'/review').set('Authorization','Bearer '+token).send({decision:'ACCEPT'})).toMatchObject({status:200});
    },{reviews:true});
    const saved=await rules.inTransaction(f.db,tx=>selections.readReportedSelection(tx,item));
    expect(saved.rows.map(row=>row.analysisCode).sort()).toEqual(['CLAY','SAND','SILT','TEXTURE']);
    expect(new Set(saved.rows.map(row=>row.selectionGroupId)).size).toBe(1);
    expect(await f.db.result.findMany({orderBy:{id:'asc'}})).toEqual(retained);
});
test.each(['attempt','tooFew','duplicateResult','missingProof','duplicateProof'])('SQL refuses malformed DERIVED %s shape with zero writes',async shape=>{
    const f=await fixture({mean:true});await f.acceptFractions();expect(await f.review('TEXTURE')).toMatchObject({status:200});
    const saved=(await f.read()).rows[0],{workItem:unused,...data}=saved;
    const evidence=JSON.parse(data.evidenceSnapshot),ids=JSON.parse(data.resultIds);
    if(shape==='attempt')data.attemptIds=JSON.stringify([f.texture.attemptId]);
    if(shape==='tooFew')data.resultIds=JSON.stringify(ids.slice(0,2));
    if(shape==='duplicateResult')data.resultIds=JSON.stringify([ids[0],...ids]);
    if(shape==='missingProof')evidence.fractionSelections.pop();
    if(shape==='duplicateProof')evidence.fractionSelections[2]=evidence.fractionSelections[0];
    data.evidenceSnapshot=JSON.stringify(evidence);data.id=randomUUID();data.selectionGroupId=randomUUID();data.supersedesId=saved.id;
    const before=await f.all();
    await expect(rules.inTransaction(f.db,tx=>tx.reportedValueSelection.create({data}))).rejects.toMatchObject({code:'REPORTED_VALUE_SELECTION_INVALID'});
    expect(await f.all()).toBe(before);
    expect(unused).toBeUndefined();
});
