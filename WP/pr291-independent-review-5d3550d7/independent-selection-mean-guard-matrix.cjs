const fs=require('node:fs');
const {explicitReportedChoice}=require('./server/services/reportedValueChoiceContract');
const {separateTextureChoice}=require('./server/services/reportedValueTextureService');
const params=['SAND','SILT','CLAY'],values=[40,40,19];
const cases=[
 {name:'valid_percent',units:['%','%','%'],expectedDerived:true},
 {name:'non_percent',units:['g/kg','g/kg','g/kg'],expectedDerived:false},
 {name:'missing_unit',units:[null,null,null],expectedDerived:false},
 {name:'mixed_units',units:['%','%','g/kg'],expectedDerived:false},
 {name:'null_censoring',units:['%','%','%'],nullCensoring:true,expectedDerived:false},
 {name:'censored',units:['%','%','%'],censor:'BELOW_LOQ',expectedDerived:false},
 {name:'non_finite',units:['%','%','%'],badNumeric:true,expectedDerived:false},
 {name:'ambiguous_fraction',units:['%','%','%'],duplicate:true,expectedDerived:false}
];
const output=[];
for(const specimen of cases){
 const proofs=params.map((analysisCode,i)=>({analysisCode,value:specimen.badNumeric&&i===2?NaN:values[i],unit:specimen.units[i],censoring:specimen.nullCensoring&&i===2?null:specimen.censor&&i===2?specimen.censor:'NONE',mode:'ATTEMPT',resultIds:[analysisCode+'-source']}));
 if(specimen.duplicate)proofs.push({...proofs[0],resultIds:['duplicate-source']});
 const context={textureTolerancePct:2,policy:{value:'MEAN_IF_WITHIN_R'},layout:{kind:'SEPARATE',sources:{}},lineage:{eligible:[]},fractions:proofs.map(proof=>({proof:{...proof,censoring:proof.censoring??'NONE'},cited:[{id:proof.resultIds[0],replicateNo:1,unit:proof.unit,censoring:proof.censoring}]}))};
 let separate,mean;
 try{const choice=separateTextureChoice(context,null);separate={derived:choice.mode==='DERIVED',outputs:choice.outputs}}catch(error){separate={derived:false,code:error.code,message:error.message}}
 const eligible=[1,2].map(j=>({attempt:{id:'attempt-'+j},results:[...params.map((param,i)=>({id:param+'-'+j,param,attemptId:'attempt-'+j,replicateNo:1,value:specimen.badNumeric&&i===2?'not a number':String(values[i]),numericValue:values[i],unit:specimen.units[i],censoring:specimen.nullCensoring&&i===2?null:specimen.censor&&i===2?specimen.censor:'NONE',methodologyId:'method'})),{id:'TEXTURE-'+j,param:'TEXTURE',attemptId:'attempt-'+j,replicateNo:1,value:'Loam',unit:'USDA_12_CLASS',censoring:'NONE',methodologyId:'method'}]}));
 if(specimen.duplicate)eligible[0].results.push({...eligible[0].results[0],id:'extra-SAND'});
 // Existing mean authority demands a shared unit for all outputs. Retained g/kg is
 // deliberately supplied as that authority to test the later percent-only derivation.
 const limits=Object.fromEntries(eligible.map(c=>[c.attempt.id,{attemptId:c.attempt.id,source:'QC_RULE',qcRuleId:'rule',qcRuleVersion:1,r:2,controlledUnit:specimen.units[0],methodologyId:'method'}]));
 try{const choice=explicitReportedChoice({analysis:'TEXTURE'},{eligible},{mode:'MEAN',attemptIds:eligible.map(c=>c.attempt.id)},limits,{textureTolerancePct:2});mean={derived:choice.outputs.some(o=>o.analysisCode==='TEXTURE'&&o.derivation==='calculateUsdaTexture'),outputs:choice.outputs}}catch(error){mean={derived:false,code:error.code,message:error.message}}
 output.push({case:specimen.name,expectedDerived:specimen.expectedDerived,separate,mean,separatePass:separate.derived===specimen.expectedDerived,meanPass:mean.derived===specimen.expectedDerived});
}
fs.writeFileSync('independent-selection-mean-guard-matrix.json',JSON.stringify(output,null,2));
process.stdout.write(JSON.stringify(output.map(({case:name,expectedDerived,separate,mean,separatePass,meanPass})=>({case:name,expectedDerived,separateDerived:separate.derived,meanDerived:mean.derived,separatePass,meanPass})),null,2));
process.exitCode=output.every(r=>r.separatePass&&r.meanPass)?0:1;