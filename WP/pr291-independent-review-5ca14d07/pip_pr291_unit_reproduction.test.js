const fs=require('node:fs');
const {randomUUID}=require('node:crypto');
const {qcGateFixture}=require('../helpers/qcGateFixture');
const {createSampleFixture,createWorkItemFixture}=require('../helpers/workflowFixtures');
const rules=require('../../services/workflowStateRules');
const writer=require('../../services/resultWriteService');
const validation=require('../../controllers/validationController');
const observed=[];
afterAll(()=>fs.writeFileSync(require('node:path').resolve(__dirname,'../../../independent-unit-reproduction.json'),JSON.stringify(observed,null,2)));
test.each(['g/kg','%'])('texture derivation must agree with percent-only gate (%s)',async unit=>{
 const f=await qcGateFixture();
 try{
  const sample=await createSampleFixture(f.db,{data:{id:randomUUID(),originalId:randomUUID(),assignedLab:f.labId,status:'PROCESSING',dryingStatus:'DONE',preparationStatus:'DONE',requiredAnalyses:'["SAND","SILT","CLAY","TEXTURE"]'}});
  const items={};
  for(const analysis of ['SAND','SILT','CLAY','TEXTURE']){
   await f.db.analysis.create({data:{code:analysis,name:'Independent '+analysis,units:analysis==='TEXTURE'?'USDA_12_CLASS':unit,validation:'{}'}});
   const method=await f.db.methodology.create({data:{analysisCode:analysis,name:analysis+' independent method'}});
   await require('../../services/qcRuleService').change(f.actor,{labId:f.labId,analysisCode:analysis,methodologyId:method.id,expectedVersion:0,reason:'Owned PR291 reproduction',criteria:{blankPerBatch:0,lrmPerBatch:0,duplicateEvery:0,crmEveryNBatches:0,ccvEvery:0,repeatabilityLimit:2}},{db:f.db});
   items[analysis]=await createWorkItemFixture(f.db,{data:{id:randomUUID(),sampleId:sample.id,assignedLab:f.labId,analysis,methodologyId:method.id,status:'IN_PROGRESS'}});
  }
  for(const [param,value] of [['SAND',40],['SILT',40],['CLAY',19]])await require('../helpers/workAttemptFixtures').createExecutionResultFixture(f.db,{data:{id:randomUUID(),sampleId:sample.id,param,value:String(value),numericValue:value,unit,methodologyId:items[param].methodologyId,isCurrent:true,isValid:true,flags:'[]',censoring:'NONE'}});
  const source=await f.db.result.findMany({where:{sampleId:sample.id,param:{in:['SAND','SILT','CLAY']},isCurrent:true},orderBy:{param:'asc'}});
  const gate=validation.validateSampleMatrix(source,await validation.matrixContext(f.db,sample));
  const before=await f.db.result.count({where:{sampleId:sample.id,param:'TEXTURE'}});
  const derived=await rules.inTransaction(f.db,tx=>writer.deriveTextureResult(tx,{sampleId:sample.id,actor:f.actor}));
  const after=await f.db.result.count({where:{sampleId:sample.id,param:'TEXTURE'}});
  observed.push({unit,source:source.map(r=>({param:r.param,numericValue:r.numericValue,unit:r.unit})),gate:gate.textureClosure,derived:derived&&{param:derived.param,value:derived.value,flags:derived.flags,attemptId:derived.attemptId},textureRowsBefore:before,textureRowsAfter:after});
  if(unit==='g/kg'){expect(gate.textureClosure[0]).toMatchObject({outcome:'NOT_EVALUATED',reasonCode:'UNIT_MISMATCH'});expect(derived).toBeNull();expect(after).toBe(before)}else{expect(gate.textureClosure[0].outcome).toBe('PASS');expect(derived).not.toBeNull()}
 }finally{await f.close()}
});

