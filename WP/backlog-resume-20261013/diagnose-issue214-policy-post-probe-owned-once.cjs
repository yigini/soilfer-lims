// New owned reproduction only; never inspect or replay discarded CI/production volumes.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),ownedDir=path.join(root,'server/tests/.tmp');
assert.equal(process.env.NODE_ENV,'test');assert.equal(path.dirname(process.env.DATABASE_PATH),ownedDir);
assert(path.basename(process.env.DATABASE_PATH).startsWith('test_issue214_policy_probe_context_'));
const Database=require('../../server/node_modules/better-sqlite3');
const {assertOwnedTestDatabase}=require('../../server/tests/helpers/testOwnedDatabase');
const {qcGateFixture}=require('../../server/tests/helpers/qcGateFixture');
const policy=require('../../server/scripts/install_lab_policy_schema'),chart=require('../../server/scripts/install_control_charts');
const dest=path.join(__dirname,'issue214-policy-post-probe-owned-diagnostic'),recordFile=path.join(dest,'diagnostic-original.json');
assert(fs.existsSync(dest));assert(!fs.existsSync(recordFile));
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const triple=file=>Object.fromEntries(['','-wal','-shm'].map(suffix=>[suffix,fs.existsSync(file+suffix)?sha(fs.readFileSync(file+suffix)):null]));
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function counts(file){const db=new Database(file,{readonly:true,fileMustExist:true});try{return Object.fromEntries(['LabPolicy','LabPolicyOverride'].map(name=>[name,db.prepare('SELECT count(*) n FROM "'+name+'"').get().n]));}finally{db.close();}}
(async()=>{
 const f=await qcGateFixture({fixedWindowPolicy:false,resolvedRules:false});await f.db.$disconnect();
 assert.equal(path.dirname(f.file),ownedDir);const sourceBefore=triple(f.file),targets={};
 for(const kind of ['legacy','counts','charts','snapshot']){
  const file=assertOwnedTestDatabase(path.join(ownedDir,'test_issue214_policy_probe_'+kind+'_'+crypto.randomUUID()+'.db'),'system:fixture');
  for(const suffix of ['','-wal','-shm'])if(sourceBefore[suffix]!==null)fs.copyFileSync(f.file+suffix,file+suffix,fs.constants.COPYFILE_EXCL);
  const writer=new Database(file,{fileMustExist:true});try{writer.pragma('journal_mode=WAL');}finally{writer.close();}
  assert.equal(triple(file)['-wal'],null);assert.equal(triple(file)['-shm'],null);targets[kind]=file;
 }
 assert.deepEqual(triple(f.file),sourceBefore);
 const original=targets.legacy,before=triple(original),ready=policy.assertLabPolicyStartupReady(original),afterOwner=triple(original);
 const again=policy.installLabPolicySchema({dbPath:original,apply:true}),afterNoOp=triple(original);
 const charts=chart.assertControlChartStartupReady(original),afterCharts=triple(original),rows=counts(original),afterCounts=triple(original);
 assert.equal(ready.classification,'PRESENT');assert.equal(again.mode,'NO_OP');assert.equal(again.totalChanges,0);
 assert.equal(charts.classification,'COMPLETE_214');assert.equal(charts.totalChanges,0);assert(Object.values(rows).every(n=>n===0));
 assert.deepEqual(afterOwner,before);assert.deepEqual(afterNoOp,before);assert(!same(afterCounts,before));
 const countBefore=triple(targets.counts),countRows=counts(targets.counts),countAfter=triple(targets.counts);
 const chartBefore=triple(targets.charts),chartOnly=chart.assertControlChartStartupReady(targets.charts),chartAfter=triple(targets.charts);
 assert(Object.values(countRows).every(n=>n===0));assert(!same(countBefore,countAfter));
 const corrected=targets.snapshot,correctedBefore=triple(corrected),copyReady=policy.assertLabPolicyStartupReady(corrected);
 const copyNoOp=policy.installLabPolicySchema({dbPath:corrected,apply:true});
 const inspected=copyReady.readonlySnapshot.path,copyCharts=chart.assertControlChartStartupReady(inspected),copyCounts=counts(inspected);
 const correctedAfter=triple(corrected);assert.deepEqual(correctedAfter,correctedBefore);
 assert.equal(copyReady.classification,'PRESENT');assert.equal(copyNoOp.mode,'NO_OP');assert.equal(copyNoOp.totalChanges,0);
 assert.equal(copyCharts.classification,'COMPLETE_214');assert.equal(copyCharts.totalChanges,0);assert(Object.values(copyCounts).every(n=>n===0));
 assert.deepEqual(triple(f.file),sourceBefore);
 const record={completedUtc:new Date().toISOString(),status:'OWNED_PROBE_SIDE_EFFECT_REPRODUCED_AND_SNAPSHOT_PROOF_PASS',
  sourceFixture:f.file,sourceFixtureTripleUnchanged:true,targets,
  legacy:{before,afterOwner,afterNoOp,afterCharts,afterCounts,readyClassification:ready.classification,noOpMode:again.mode,chartClassification:charts.classification,counts:rows,
   everySchemaAndRowAssertionPassed:true,failedPredicate:'Only original DB/WAL/SHM hash equality after secondary original-file readonly inspections'},
  isolatedCounts:{before:countBefore,after:countAfter,counts:countRows,originalMainFileUnchanged:countBefore['']===countAfter['']},
  isolatedCharts:{before:chartBefore,after:chartAfter,classification:chartOnly.classification,originalMainFileUnchanged:chartBefore['']===chartAfter['']},
  corrected:{before:correctedBefore,after:correctedAfter,inspectionSnapshot:inspected,charts:copyCharts.classification,counts:copyCounts,originalDbWalShmPreserved:true},
  sourceCI38515104824Replayed:false,discardedCiVolumeIndependentlyInspected:false,productionConnections:0,productionOperations:0,allFilesRetained:true};
 fs.writeFileSync(recordFile,JSON.stringify(record,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(record));
})().catch(e=>{console.error(e);process.exitCode=1;});
