const {randomUUID}=require('node:crypto');
const {qcGateFixture}=require('../helpers/qcGateFixture');
const {createSampleFixture,createWorkItemFixture}=require('../helpers/workflowFixtures');
const rules=require('../../services/workflowStateRules');
const writer=require('../../services/resultWriteService');
const {createExecutionResultFixture}=require('../helpers/workAttemptFixtures');
const {separateTextureChoice}=require('../../services/reportedValueTextureService');
const {textureInputs,closureOptions}=require('../../services/textureInputAuthority');
const {buildSelectionLineage}=require('../../services/reportedValueSelectionLineage');
const {explicitReportedChoice}=require('../../services/reportedValueChoiceContract');
// #291 review (P1): widening closure to the laboratory tolerance (#278) must keep
// the percent-only stored input authority in every texture derivation, not only
// in the submission gate. g/kg values are never classified as percentages.
const owned=[];
afterEach(async()=>{for(const f of owned.splice(0))await f.close();});
const one=(value,unit='%',censoring='NONE')=>[{value,unit,censoring}];

test('the shared authority refuses every non-authoritative input and widens only a valid policy value',()=>{
    expect(textureInputs([one(40),one(40),one(19)])).toEqual({values:[40,40,19]});
    expect(textureInputs([one(40,'g/kg'),one(40,'g/kg'),one(19,'g/kg')])).toEqual({reasonCode:'UNIT_MISMATCH'});
    expect(textureInputs([one(40,null),one(40),one(19)])).toEqual({reasonCode:'UNIT_MISSING'});
    expect(textureInputs([one(40,' '),one(40),one(19)])).toEqual({reasonCode:'UNIT_MISSING'});
    expect(textureInputs([one(40),one(40),one(19,'%','BELOW_LOQ')])).toEqual({reasonCode:'INPUT_CENSORED'});
    expect(textureInputs([one(40),one(null),one(19)])).toEqual({reasonCode:'INPUT_NON_NUMERIC'});
    expect(textureInputs([one(40),one(40),[]])).toEqual({reasonCode:'MULTIPLE_CANDIDATES'});
    expect(textureInputs([[...one(40),...one(41)],one(40),one(19)])).toEqual({reasonCode:'MULTIPLE_CANDIDATES'});
    expect(closureOptions(2)).toEqual({tolerance:2});
    for(const invalid of [-1,100.01,null,undefined,NaN,'2'])expect(closureOptions(invalid)).toBeNull();
});

function textureMean(unit) {
    const item={id:'texture-work',analysis:'TEXTURE'};
    const attempts=['a1','a2'].map((id,index)=>({id,workItemId:item.id,attemptNo:index+1,status:index?'ACCEPTED':'QUESTIONED',evidenceHash:'hash'+id}));
    const results=attempts.flatMap(attempt=>[['SAND','40'],['SILT','40'],['CLAY','19'],['TEXTURE','Retained class']].map(([param,value])=>({
        id:param+'-'+attempt.id,attemptId:attempt.id,param,value,unit:param==='TEXTURE'?null:unit,methodologyId:'method',censoring:'NONE',
        replicateNo:1,supersededBy:attempt.id==='a1'?param+'-a2':null,isCurrent:attempt.id==='a2'})));
    const limit={source:'QC_RULE',qcRuleId:'q1',qcRuleVersion:1,r:2,controlledUnit:unit,methodologyId:'method',recordedAt:'2026-10-08T10:00:00Z'};
    return ()=>explicitReportedChoice(item,buildSelectionLineage(attempts,results),{mode:'MEAN',attemptIds:['a1','a2']},
        {a1:limit,a2:{...limit,recordedAt:'2026-10-08T12:00:00Z'}},{textureTolerancePct:2});
}
test('a composite texture mean of g/kg fractions refuses; the same percent means derive within the tolerance',()=>{
    expect(textureMean('g/kg')).toThrow(expect.objectContaining({code:'REPORTED_VALUE_TEXTURE_UNRESOLVED',details:{reasonCode:'UNIT_MISMATCH'}}));
    expect(textureMean('%')().outputs.find(row=>row.analysisCode==='TEXTURE')).toMatchObject({valueText:'Loam',derivation:'calculateUsdaTexture'});
});

async function fixture(unit,values=[40,40,19]) {
    const f=await qcGateFixture();owned.push(f);
    const sample=await createSampleFixture(f.db,{data:{id:randomUUID(),originalId:randomUUID(),assignedLab:f.labId,
        status:'PROCESSING',dryingStatus:'DONE',preparationStatus:'DONE',requiredAnalyses:'["SAND","SILT","CLAY","TEXTURE"]'}});
    f.textureItems={};
    for(const analysis of ['SAND','SILT','CLAY','TEXTURE']) {
        await f.db.analysis.create({data:{code:analysis,name:'Owned '+analysis.toLowerCase()+' measurement',units:analysis==='TEXTURE'?'USDA_12_CLASS':unit,...(analysis==='TEXTURE'?{}:{unitCode:unit}),validation:'{}'}});
        const method=await f.db.methodology.create({data:{analysisCode:analysis,name:analysis+' owned method'}});
        await require('../../services/qcRuleService').change(f.actor,{labId:f.labId,analysisCode:analysis,methodologyId:method.id,
            expectedVersion:0,reason:'Owned texture authority case',criteria:{blankPerBatch:0,lrmPerBatch:0,
                duplicateEvery:0,crmEveryNBatches:0,ccvEvery:0,repeatabilityLimit:2}},{db:f.db});
        f.textureItems[analysis]=await createWorkItemFixture(f.db,{data:{id:randomUUID(),sampleId:sample.id,assignedLab:f.labId,
            analysis,methodologyId:method.id,status:'IN_PROGRESS'}});
    }
    for(const [index,param] of ['SAND','SILT','CLAY'].entries()) {
        // The normal writer stores fraction units as '%'; g/kg rows exist only as
        // legacy or imported rows, so they are created through the execution fixture.
        if(unit==='%')await rules.inTransaction(f.db,tx=>writer.writeResultsExecution(tx,{
            sampleId:sample.id,workItemId:f.textureItems[param].id,actor:f.actor,
            measurements:[{param,value:String(values[index]),unit,equipmentId:f.instrument.id}]}));
        else await createExecutionResultFixture(f.db,{attemptStatus:'RECORDED',data:{id:randomUUID(),sampleId:sample.id,param,
            value:String(values[index]),numericValue:values[index],unit,isCurrent:true,isValid:true,flags:'[]'}});
    }
    f.sample=sample;
    f.derive=()=>rules.inTransaction(f.db,tx=>writer.deriveTextureResult(tx,{sampleId:sample.id,actor:f.actor}));
    f.state=async()=>JSON.stringify([await f.db.result.findMany({orderBy:{id:'asc'}}),await f.db.workAttempt.findMany({orderBy:{id:'asc'}}),
        await f.db.reportedValueSelection.findMany({orderBy:{id:'asc'}})]);
    return f;
}

test('recording g/kg fractions derives no TEXTURE Result or attempt; the percent control derives Loam within the tolerance',async()=>{
    const grams=await fixture('g/kg'),before=await grams.state()
    expect(await grams.derive()).toBeNull();
    expect(await grams.state()).toBe(before);
    expect(await grams.db.result.count({where:{sampleId:grams.sample.id,param:'TEXTURE'}})).toBe(0);
    const percent=await fixture('%');
    expect(await percent.derive()).toMatchObject({param:'TEXTURE',value:'Loam',isValid:true});
});

function separate(rows) {
    const fractions=rows.map(([analysisCode,value,unit],index)=>({proof:{analysisCode,workItemId:'w'+index,selectionId:'s'+index,
        mode:'ATTEMPT',value,valueText:String(value),unit,censoring:'NONE',resultIds:['r'+index]},cited:[{replicateNo:1}]}));
    return ()=>separateTextureChoice({fractions,lineage:{eligible:[]},layout:{sources:{}},policy:{value:'MEAN_IF_WITHIN_R'},textureTolerancePct:2},null);
}
test('the selected-fraction derivation refuses g/kg, missing, mixed and duplicate proofs; the percent control is DERIVED Loam',()=>{
    const unresolved=reasonCode=>expect.objectContaining({code:'REPORTED_VALUE_TEXTURE_UNRESOLVED',details:{reasonCode}});
    expect(separate([['SAND',40,'g/kg'],['SILT',40,'g/kg'],['CLAY',19,'g/kg']])).toThrow(unresolved('UNIT_MISMATCH'));
    expect(separate([['SAND',40,'%'],['SILT',40,'g/kg'],['CLAY',19,'%']])).toThrow(unresolved('UNIT_MISMATCH'));
    expect(separate([['SAND',40,null],['SILT',40,'%'],['CLAY',19,'%']])).toThrow(unresolved('UNIT_MISSING'));
    expect(separate([['SAND',40,'%'],['SAND',40,'%'],['SILT',40,'%'],['CLAY',19,'%']])).toThrow(unresolved('MULTIPLE_CANDIDATES'));
    expect(separate([['SAND',40,'%'],['SILT',40,'%'],['CLAY',19,'%']])()).toMatchObject({mode:'DERIVED',outputs:[{valueText:'Loam'}]});
});

test('a stored out-of-range tolerance (#281) derives with exact closure only, never wider',async()=>{
    const f=await fixture('%');
    await f.db.labPolicyOverride.create({data:{id:randomUUID(),labId:f.labId,key:'crossCheck.textureClosureTolerancePct',
        value:JSON.stringify(-1),reason:'#281 pre-bounds fixture',setBy:'FIXTURE'}});
    expect(await f.derive()).toBeNull();
    const exact=await fixture('%',[40,40,20]);
    await exact.db.labPolicyOverride.create({data:{id:randomUUID(),labId:exact.labId,key:'crossCheck.textureClosureTolerancePct',
        value:JSON.stringify(-1),reason:'#281 pre-bounds fixture',setBy:'FIXTURE'}});
    expect(await exact.derive()).toMatchObject({value:'Loam'});
});
