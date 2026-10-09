const {qcGateFixture}=require('../helpers/qcGateFixture');
const {inTransaction}=require('../../services/workflowStateRules');
const {resolveResultValidationContext,writeResult}=require('../../services/resultWriteService');
const {resolveNumericValueRules}=require('../../services/resultValueRulesService');
const owned=[];
afterEach(async()=>{for(const f of owned.splice(0))await f.close();});
async function fixture(){
    const f=await qcGateFixture();owned.push(f);
    await f.db.analysis.update({where:{code:f.analysisCode},data:{validation:JSON.stringify({min:2,max:14,loq:99,lod:98})}});
    f.method=await f.db.methodology.update({where:{id:f.method.id},data:{loq:0.5,lod:0.1}});
    await f.setPolicy([{key:'results.typicalMin',value:4,analysisCode:f.analysisCode,methodologyId:f.method.id},
        {key:'results.typicalMax',value:9,analysisCode:f.analysisCode,methodologyId:f.method.id},
        {key:'results.calibrationMax',value:10,analysisCode:f.analysisCode,methodologyId:f.method.id}]);
    f.options=(value,extra={})=>({sampleId:f.items[0].sampleId,workItemId:f.items[0].id,actor:f.actor,
        measurement:{param:f.analysisCode,value,equipmentId:f.instrument.id,...extra}});
    f.resolve=(value,extra)=>inTransaction(f.db,tx=>resolveResultValidationContext(tx,f.options(value,extra)));
    return f;
}
test('the request context is read-only and resolves actual hard/policy limits and method-only LOQ/LOD',async()=>{
    const f=await fixture(),before=await f.snapshot(),resolved=await f.resolve('65');
    expect(resolved.rules).toMatchObject({min:2,max:14,typicalMin:4,typicalMax:9,calibrationMax:10,loq:0.5,lod:0.1,unit:'fixture-unit'});
    expect(resolved.validation).toMatchObject({severity:'RED',canOverride:true});
    expect(resolved.rulesSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(resolved.ctx).toMatchObject({methodId:f.method.id,equipmentId:f.instrument.id,replicateNo:1,basis:'AIR_DRY'});
    expect(await f.snapshot()).toEqual(before);
});
test('unconfigured method LOQ/LOD never falls back to Analysis.validation, and nullable limits remain null',async()=>{
    const f=await fixture();
    const method=await f.db.methodology.update({where:{id:f.method.id},data:{loq:null,lod:null}});
    await f.setPolicy(['results.typicalMin','results.typicalMax','results.calibrationMax'].map(key=>({key,value:null,analysisCode:f.analysisCode,methodologyId:method.id})));
    const resolved=await resolveNumericValueRules(f.db,{labId:f.labId,analysis:await f.db.analysis.findUnique({where:{code:f.analysisCode}}),method});
    expect(resolved.rules).toMatchObject({loq:null,lod:null,typicalMin:null,typicalMax:null,calibrationMax:null});
});
test('rule hashes are stable across unrelated policy changes and change with authoritative warning criteria',async()=>{
    const f=await fixture(),first=await f.resolve('65');
    await f.setPolicy([{key:'sample.retentionDaysAfterReport',value:91}]);
    expect((await f.resolve('65')).rulesSha256).toBe(first.rulesSha256);
    await f.setPolicy([{key:'results.typicalMax',value:8,analysisCode:f.analysisCode,methodologyId:f.method.id}]);
    expect((await f.resolve('65')).rulesSha256).not.toBe(first.rulesSha256);
});
test('manager inline override cannot authorize a censor limit below actual method LOQ, with zero writes',async()=>{
    const f=await fixture(),before=await f.snapshot();
    await expect(inTransaction(f.db,tx=>writeResult(tx,f.options('<0.001',{overrideReason:'Manager reviewed the reading'}))))
        .rejects.toMatchObject({status:422,code:'CENSOR_LIMIT_BELOW_LOQ'});
    expect(await f.snapshot()).toEqual(before);
});
test('existing manager inline range override remains available and retains its original flag',async()=>{
    const f=await fixture();
    const row=await inTransaction(f.db,tx=>writeResult(tx,f.options('65',{overrideReason:'Verified genuine extreme'})));
    expect(row).toMatchObject({rawInput:'65',numericValue:65,isValid:true});
    expect(JSON.parse(row.flags)).toContain('MANAGER_OVERRIDE');
    expect(JSON.parse(row.flags)).not.toContain('OVERRIDE_APPROVED');
});
test('the request context inherits the started native run instrument rather than stale WorkItem equipment',async()=>{
    const f=await fixture(),native=require('../../services/qcNativeRunService');
    const run=await native.startNativeRun(f.db,(await native.buildNativeRun(f.db,f.actor,f.input)).id,f.actor);
    const stale=await f.db.equipmentAsset.create({data:{labId:f.labId,name:'Stale work item instrument',assetType:'OTHER',status:'IN_SERVICE',criticality:'NON_CRITICAL'}});
    await f.db.workItem.update({where:{id:f.items[0].id},data:{equipmentId:stale.id}});
    const resolved=await f.resolve('65',{equipmentId:null});
    expect(resolved.ctx).toMatchObject({batchId:run.id,equipmentId:f.instrument.id});
    const before=await f.snapshot();
    await expect(f.resolve('65',{equipmentId:stale.id})).rejects.toMatchObject({code:'RESULT_INSTRUMENT_MISMATCH'});
    expect(await f.snapshot()).toEqual(before);
});
