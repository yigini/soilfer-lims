// One owned diagnostic; never a production connection or replay of the CI run.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const Database=require('../../server/node_modules/better-sqlite3');
const {qcGateFixture}=require('../../server/tests/helpers/qcGateFixture');
const {installControlCharts}=require('../../server/scripts/install_control_charts');
const root=path.resolve(__dirname,'../..'),dest=path.join(__dirname,'issue214-ci-policy-prerequisite-diagnostic');
assert.equal(process.env.NODE_ENV,'test');assert(!fs.existsSync(dest));fs.mkdirSync(dest);
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const triple=file=>Object.fromEntries(['','-wal','-shm'].map(s=>[s,fs.existsSync(file+s)?sha(fs.readFileSync(file+s)):null]));
function snapshot(db){
 const result={};
 for(const {name} of db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all()){
  const quote='"'+name.replaceAll('"','""')+'"';
  result[name]=sha(JSON.stringify(db.prepare('SELECT * FROM '+quote+' ORDER BY rowid').all()));
 }
 return result;
}
(async()=>{
 const fixture=await qcGateFixture({installControlCharts:false,fixedWindowPolicy:false,resolvedRules:false});
 await fixture.db.$disconnect();
 const ownedDir=path.join(root,'server/tests/.tmp');
 assert.equal(path.dirname(fixture.file),ownedDir);assert(path.basename(fixture.file).startsWith('audit_legacy_'));
 const clone=path.join(ownedDir,'issue214_policy_absent_'+crypto.randomUUID()+'.db');
 const source=new Database(fixture.file,{readonly:true,fileMustExist:true});
 const originalTriple=triple(fixture.file);
 try{await source.backup(clone);}finally{source.close();}
 assert.deepEqual(triple(fixture.file),originalTriple);
 const db=new Database(clone,{fileMustExist:true});let beforeRows,constructedRows,missing,columns;
 try{
  assert.equal(db.prepare('SELECT count(*) n FROM LabPolicy').get().n,0);
  assert.equal(db.prepare('SELECT count(*) n FROM LabPolicyOverride').get().n,0);
  beforeRows=snapshot(db);
  // Construct the confirmed tableless-policy predecessor on this NEW owned
  // clone only. Preserve the source fixture and all other rows byte logically.
  db.exec('DROP TABLE "LabPolicyOverride"; DROP TABLE "LabPolicy";');
  constructedRows=snapshot(db);
  assert.deepEqual(constructedRows,Object.fromEntries(Object.entries(beforeRows).filter(([table])=>!['LabPolicy','LabPolicyOverride'].includes(table))));
  columns=Object.fromEntries(['QcEvaluation','Batch','QcMeasurement','LabPolicyOverride','_schema_migrations'].map(table=>[table,db.prepare('PRAGMA table_info("'+table+'")').all().map(row=>row.name)]));
  missing=[['QcEvaluation','details'],['Batch','startedAt'],['QcMeasurement','supersededById'],['LabPolicyOverride','value'],['_schema_migrations','details']].filter(([table,column])=>!columns[table].includes(column)).map(([table,column])=>table+'.'+column);
  assert.deepEqual(missing,['LabPolicyOverride.value']);
 }finally{db.close();}
 const before=triple(clone);let refusal;
 try{installControlCharts({dbPath:clone});assert.fail('Expected the original prerequisite refusal');}
 catch(error){assert.equal(error.code,'QC_CHART_PREREQUISITE_REQUIRED');refusal={code:error.code,message:error.message,totalChanges:error.totalChanges};}
 assert.deepEqual(triple(clone),before);
 const check=new Database(clone,{readonly:true,fileMustExist:true});
 try{assert.deepEqual(snapshot(check),constructedRows);assert.equal(check.pragma('integrity_check',{simple:true}),'ok');assert.equal(check.pragma('foreign_key_check').length,0);}finally{check.close();}
 const record={completedUtc:new Date().toISOString(),status:'ORIGINAL_REFUSAL_REPRODUCED',sourceFixture:fixture.file,ownedClone:clone,
  fixturePolicyTablesWereEmpty:true,sourceFixtureTripleUnchanged:true,allOtherRowsPreserved:true,missingPrerequisites:missing,columns,
  refusal,diagnosticDryRunTripleUnchanged:true,sourceTriple:originalTriple,cloneTriple:triple(clone),
  simulatedTablelessPolicyPredecessor:true,actualCiVolumeIndependentlyInspected:false,filesRetained:true,productionConnections:0,productionOperations:0};
 fs.writeFileSync(path.join(dest,'diagnostic-original.json'),JSON.stringify(record,null,2)+'\n');
 console.log(JSON.stringify(record));
})().catch(error=>{console.error(error);process.exitCode=1;});
