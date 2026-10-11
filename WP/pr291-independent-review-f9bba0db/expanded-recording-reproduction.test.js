const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {qcGateFixture}=require('../helpers/qcGateFixture');
const {createSampleFixture,createWorkItemFixture}=require('../helpers/workflowFixtures');
const {createExecutionResultFixture}=require('../helpers/workAttemptFixtures');
const rules=require('../../services/workflowStateRules');
const writer=require('../../services/resultWriteService');
const validation=require('../../controllers/validationController');
const observed=[];
afterAll(()=>fs.writeFileSync(path.resolve(__dirname,'../../../independent-recording-guard-matrix.json'),JSON.stringify(observed,null,2)));
const cases=[
 {name:'non_percent',units:['g/kg','g/kg','g/kg'],valid:false},
 {name:'missing_unit',units:[null,null,null],valid:false},
 {name:'mixed_units',units:['%','%','g/kg'],valid:false},
 {name:'censored',units:['%','%','%'],censor:'BELOW_LOQ',valid:false},
 {name:'null_censoring',units:['%','%','%'],nullCensoring:true,valid:false},
 {name:'stored_numeric_missing',units:['%','%','%'],numericMissing:true,valid:false},
 {name:'ambiguous_fraction',units:['%','%','%'],duplicate:true,valid:false},
 {name:'valid_percent',units:['%','%','%'],valid:true}
];
const fingerprint=rows=>crypto.createHash('sha256').update(JSON.stringify(rows)).digest('hex');
test.each(cases)('real recording input guard: $name',async specimen=>{
 const f=await qcGateFixture();
 try{
  const sample=await createSampleFixture(f.db,{data:{id:crypto.randomUUID(),originalId:crypto.randomUUID(),assignedLab:f.labId,status:'PROCESSING',dryingStatus:'DONE',preparationStatus:'DONE',requiredAnalyses:'["SAND","SILT","CLAY","TEXTURE"]'}});
  const items={};
  for(const analysis of ['SAND','SILT','CLAY','TEXTURE']){
   await f.db.analysis.create({data:{code:analysis,name:'Independent '+analysis,units:analysis==='TEXTURE'?'USDA_12_CLASS':'%',validation:'{}'}});
   const method=await f.db.methodology.create({data:{analysisCode:analysis,name:analysis+' independent method'}});
   await require('../../services/qcRuleService').change(f.actor,{labId:f.labId,analysisCode:analysis,methodologyId:method.id,expectedVersion:0,reason:'Owned independent guard check',criteria:{blankPerBatch:0,lrmPerBatch:0,duplicateEvery:0,crmEveryNBatches:0,ccvEvery:0,repeatabilityLimit:2}},{db:f.db});
   items[analysis]=await createWorkItemFixture(f.db,{data:{id:crypto.randomUUID(),sampleId:sample.id,assignedLab:f.labId,analysis,methodologyId:method.id,status:'IN_PROGRESS'}});
  }
  for(const [i,[param,value]] of [['SAND',40],['SILT',40],['CLAY',19]].entries())await createExecutionResultFixture(f.db,{data:{id:crypto.randomUUID(),sampleId:sample.id,param,value:String(value),numericValue:specimen.numericMissing&&i===2?null:value,unit:specimen.units[i],methodologyId:items[param].methodologyId,isCurrent:true,isValid:true,flags:'[]',censoring:i===2&&specimen.nullCensoring?null:i===2&&specimen.censor?specimen.censor:'NONE'}});
  if(specimen.duplicate){ const existing=await f.db.result.findFirst({where:{sampleId:sample.id,param:'SAND'}}); await rules.inTransaction(f.db,tx=>writer.createResultFixture(tx,{data:{id:crypto.randomUUID(),sampleId:sample.id,param:'SAND',value:'40',numericValue:40,unit:'%',methodologyId:items.SAND.methodologyId,attemptId:existing.attemptId,isCurrent:true,isValid:true,flags:'[]',censoring:'NONE'}})); }
  const source=await f.db.result.findMany({where:{sampleId:sample.id},orderBy:{id:'asc'}});
  const gate=validation.validateSampleMatrix(source,await validation.matrixContext(f.db,sample));
  const before={result:source,attempt:await f.db.workAttempt.findMany({where:{workItemId:{in:Object.values(items).map(i=>i.id)}},orderBy:{id:'asc'}}),item:await f.db.workItem.findMany({where:{sampleId:sample.id},orderBy:{id:'asc'}}),audit:await f.db.auditLog.findMany({where:{sampleId:sample.id},orderBy:{id:'asc'}})};
  const derived=await rules.inTransaction(f.db,tx=>writer.deriveTextureResult(tx,{sampleId:sample.id,actor:f.actor}));
  const after={result:await f.db.result.findMany({where:{sampleId:sample.id},orderBy:{id:'asc'}}),attempt:await f.db.workAttempt.findMany({where:{workItemId:{in:Object.values(items).map(i=>i.id)}},orderBy:{id:'asc'}}),item:await f.db.workItem.findMany({where:{sampleId:sample.id},orderBy:{id:'asc'}}),audit:await f.db.auditLog.findMany({where:{sampleId:sample.id},orderBy:{id:'asc'}})};
  observed.push({case:specimen.name,expectedDerived:specimen.valid,source:source.map(r=>({param:r.param,numericValue:r.numericValue,unit:r.unit,censoring:r.censoring})),gate:gate.textureClosure,derived:derived&&{param:derived.param,value:derived.value,attemptId:derived.attemptId},beforeSha256:fingerprint(before),afterSha256:fingerprint(after),countsBefore:Object.fromEntries(Object.entries(before).map(([k,v])=>[k,v.length])),countsAfter:Object.fromEntries(Object.entries(after).map(([k,v])=>[k,v.length]))});
  if(specimen.valid){expect(gate.textureClosure[0].outcome).toBe('PASS');expect(derived).toMatchObject({param:'TEXTURE',value:'Loam'});expect(after.result.length).toBe(before.result.length+1)}else{expect(derived).toBeNull();expect(fingerprint(after)).toBe(fingerprint(before))}
 }finally{await f.close()}
});