// One NEW owned clone probes current order normalization/reconciliation only.
// Never opens SQLite on the retained source or a working/production database.
const fs=require('node:fs'),path=require('node:path'),{randomUUID,createHash}=require('node:crypto');
const root=path.resolve(__dirname,'../..'),dest=path.join(__dirname,'issue209-owned-fraction-order-probe');
if(fs.existsSync(dest)||process.env.NODE_OPTIONS)throw Error('Fresh probe destination/default heap required');fs.mkdirSync(dest);
const held=JSON.parse(fs.readFileSync(path.join(__dirname,'issue209-historical-context-family-regression/physical-retained-terminal-index.json'),'utf8'));
const candidates=[...new Set(held.files.map(row=>row.path).filter(file=>/^audit_legacy_190_execution-.*\.db$/.test(path.basename(file))))];
if(candidates.length!==1)throw Error('Expected one actual retained attempt-execution fixture');
const original=path.resolve(candidates[0]),target=path.join(root,'server/tests/.tmp/audit_legacy_209_fraction_order_probe-'+randomUUID()+'.db');
if(path.dirname(original)!==path.dirname(target)||fs.existsSync(target)||fs.realpathSync(original)!==original)throw Error('Owned source/target binding differs');
const hash=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const triples=file=>Object.fromEntries(['','-wal','-shm'].map(suffix=>[suffix,fs.existsSync(file+suffix)?hash(file+suffix):null]));
const originalBefore=triples(original);
for(const suffix of ['','-wal','-shm'])if(originalBefore[suffix]!==null)fs.copyFileSync(original+suffix,target+suffix,fs.constants.COPYFILE_EXCL);
if(JSON.stringify(triples(target))!==JSON.stringify(originalBefore)||JSON.stringify(triples(original))!==JSON.stringify(originalBefore))throw Error('Retained copy differs');
process.env.NODE_ENV='test';process.env.DATABASE_PATH=target;process.env.DATABASE_URL='file:'+target;
const {PrismaClient}=require('../../server/prisma_client'),{PrismaBetterSqlite3}=require('../../server/node_modules/@prisma/adapter-better-sqlite3');
const client=new PrismaClient({adapter:new PrismaBetterSqlite3({url:'file:'+target})});
const selected=['SAND','SILT','CLAY','TEXTURE'];
(async()=>{
 const sourceFiles=['server/services/orderRevisionContract.js','server/services/orderService.js','server/services/analysisCodesService.js','server/services/orderLineResolutionService.js','server/services/workItemReconciliationService.js'];
 const frozen=Object.fromEntries(sourceFiles.filter(file=>fs.existsSync(path.join(root,file))).map(file=>[file,hash(path.join(root,file))]));
 const samples=await client.sample.findMany({include:{workItems:true}});
 const eligible=[];
 for(const sample of samples)if(selected.every(code=>sample.workItems.filter(item=>item.analysis===code&&item.duplicateOf===null).length===1)
   &&await client.result.count({where:{sampleId:sample.id}})===0&&await client.sampleOrderRevision.count({where:{sampleId:sample.id}})===0)eligible.push(sample);
 if(!eligible.length)throw Error('No retained empty-result fraction fixture fits the exact probe');
 const sample=eligible[0],actor={username:'attempt-executor',role:'LAB_MANAGER',labId:sample.assignedLab};
 const before={sample,items:await client.workItem.findMany({where:{sampleId:sample.id},orderBy:{analysis:'asc'}})};
 const request=require('../../server/services/orderRevisionContract').orderRevisionRequest({analyses:selected,reason:'Explicit complete retained fraction target'},
  {currentAnalyses:JSON.parse(sample.requiredAnalyses),priorActiveCount:0});
 let outcome,error;
 try{outcome=await require('../../server/services/orderService').reviseAnalyses(sample.id,{analyses:selected,reason:'Explicit complete retained fraction target'},actor,{tx:client,mode:'order'});}
 catch(failure){error={code:failure.code,statusCode:failure.statusCode,message:failure.message,details:failure.details};}
 const after={sample:await client.sample.findUnique({where:{id:sample.id}}),items:await client.workItem.findMany({where:{sampleId:sample.id},orderBy:{analysis:'asc'}}),
  revisions:await client.sampleOrderRevision.findMany({where:{sampleId:sample.id},include:{lines:true},orderBy:{id:'asc'}})};
 const resolutions=[];
 for(const item of after.items)if(selected.includes(item.analysis))resolutions.push({workItemId:item.id,analysis:item.analysis,status:item.status,
  ...await require('../../server/services/orderLineResolutionService').inspectOrderLine(client,item)});
 await client.$disconnect();await require('../../server/prisma').$disconnect();
 const originalAfter=triples(original),sourceAfter=Object.fromEntries(Object.keys(frozen).map(file=>[file,hash(path.join(root,file))]));
 const result={closedUtc:new Date().toISOString(),status:'CLOSED_OWNED_FRACTION_TARGET_PROBE',original,target,originalBefore,originalAfter,
  originalDbWalShmPreserved:JSON.stringify(originalBefore)===JSON.stringify(originalAfter),sourceUnchanged:JSON.stringify(frozen)===JSON.stringify(sourceAfter),
  sourceFiles:frozen,requestedTarget:selected,normalizedRequest:request,before,after,outcome,error,resolutions,
  limitation:'Reproduces an actual retained owned fixture on a NEW clone; probes order contract/reconciliation without adding or disabling guards. Not production inspection, full209owner/Docker acceptance or overall application PASS.',productionOperations:0};
 fs.writeFileSync(path.join(dest,'probe-original.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
 if(!result.originalDbWalShmPreserved||!result.sourceUnchanged)throw Error('Original/source preservation differs');
 console.log(JSON.stringify({closedUtc:result.closedUtc,requested:selected,normalized:request.analyses,error,afterItems:after.items.map(row=>({analysis:row.analysis,status:row.status})),
  orderLines:after.revisions.flatMap(row=>row.lines.map(line=>({analysis:line.analysis,workItemId:line.workItemId}))),resolutions,originalDbWalShmPreserved:true,sourceUnchanged:true,productionOperations:0}));
})().catch(error=>{console.error(error.stack);process.exitCode=1});
