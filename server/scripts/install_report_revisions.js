#!/usr/bin/env node
const fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto'),Database=require('better-sqlite3');
const {loadReportRevisionMigrationSource}=require('../services/reportRevisionMigrationSource');
const MARKER='211_report_revisions';
const COLUMNS=Object.freeze(['supersedesReportId','amendmentId','amendmentReason','issuedBy','approvedBy','amendmentAuthorizedBy']);
const fail=(code,message,differences=[])=>Object.assign(new Error(message),{statusCode:409,code,differences,totalChanges:0});
const fingerprint=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const normalized=sql=>(sql.match(/'(?:''|[^'])*'|"(?:""|[^"])*"|\s+|[^\s'"]+/g)||[]).filter(token=>!/^\s+$/.test(token)).join('').replace(/;$/,'');
const populated=db=>db.prepare('SELECT count(*) n FROM "Report" WHERE '+COLUMNS.map(name=>'"'+name+'" IS NOT NULL').join(' OR ')).get().n;

function guardObjects(source){
 const objects=[...[...source.guardsSql.matchAll(/^CREATE UNIQUE INDEX "([^"]+)"[^;]*;/gm)].map(match=>({name:match[1],type:'index',sql:match[0]})),
  ...[...source.guardsSql.matchAll(/^CREATE TRIGGER "([^"]+)"[\s\S]*?^END;/gm)].map(match=>({name:match[1],type:'trigger',sql:match[0]}))];
 if(objects.length!==3)throw fail('REPORT_REVISION_SOURCE_MISMATCH','The release requires its amendment index and two guards.');
 return objects;
}
function classify(db,source){
 if(db.pragma('integrity_check',{simple:true})!=='ok'||db.pragma('foreign_key_check').length)throw fail('REPORT_REVISION_INTEGRITY_REFUSED','An intact database is required.');
 const columns=db.prepare('PRAGMA table_xinfo("Report")').all();
 // #170 numbering columns may still be pending on a supported upgrade copy;
 // the guards bind them by name and only fire on new report writes.
 if(!['id','sampleId','status','content'].every(name=>columns.some(row=>row.name===name))||
  !db.prepare('PRAGMA table_info("_schema_migrations")').all().some(row=>row.name==='details'))
  throw fail('REPORT_REVISION_PREREQUISITE_REQUIRED','Install the prior application schema first.');
 const differences=[];
 const present=COLUMNS.map(name=>{
  const row=columns.find(value=>value.name===name);
  if(row&&(row.type!=='TEXT'||row.notnull||row.dflt_value!==null||row.pk||row.hidden))differences.push('Report.'+name+' differs');
  return Boolean(row);
 });
 const installed=guardObjects(source).map(wanted=>{
  const row=db.prepare('SELECT type,tbl_name,sql FROM sqlite_master WHERE name=?').get(wanted.name);
  if(row&&(row.type!==wanted.type||row.tbl_name!=='Report'||normalized(row.sql)!==normalized(wanted.sql)))differences.push(wanted.name+' differs');
  return Boolean(row);
 });
 const sources={migrationSha256:source.sha256,contractVersion:'211-v1'};
 const marker=db.prepare('SELECT details FROM _schema_migrations WHERE id=?').get(MARKER);
 let receipt;
 if(marker){
  try{receipt=JSON.parse(marker.details);}catch{/* Refuse unverified provenance. */}
  const keys=['sources','originalRowsSha256','originalRowsPreserved','backfilledCount','receiptSha256'];
  if(!receipt||JSON.stringify(Object.keys(receipt).sort())!==JSON.stringify(keys.sort())||
   JSON.stringify(receipt.sources)!==JSON.stringify(sources)||!/^[a-f0-9]{64}$/.test(receipt.originalRowsSha256)||
   receipt.originalRowsPreserved!==true||receipt.backfilledCount!==0||
   receipt.receiptSha256!==fingerprint(Object.fromEntries(Object.entries(receipt).filter(([key])=>key!=='receiptSha256'))))
   differences.push('Report revision installation receipt differs');
 }
 let classification;
 if([...present,...installed,Boolean(marker)].every(value=>!value))classification='PRE_211';
 else if(present.every(Boolean)&&[...installed,Boolean(marker)].every(value=>!value)){
  classification='FRESH_PRISMA_211';
  if(populated(db))differences.push('Unmarked report revision evidence must not be adopted');
 }else if([...present,...installed,Boolean(marker)].every(Boolean))classification='COMPLETE_211';
 else differences.push('Report revision installation is partial or unmarked');
 if(differences.length)throw fail('REPORT_REVISION_SCHEMA_MISMATCH','Report revision evidence differs from the release.',differences);
 return{classification,sources,reportCount:db.prepare('SELECT count(*) n FROM "Report"').get().n,...(receipt&&{receipt})};
}
function snapshot(db){
 const tables={};
 for(const {name}of db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all()){
  const quoted='"'+name.replace(/"/g,'""')+'"';
  const columns=db.prepare('PRAGMA table_xinfo('+quoted+')').all().filter(row=>row.hidden===0&&!(name==='Report'&&COLUMNS.includes(row.name))).map(row=>row.name);
  const selected=columns.map(column=>'"'+column.replace(/"/g,'""')+'"').join(',');
  const hash=createHash('sha256');let rows=0;
  const where=name==='_schema_migrations'?' WHERE id<>?':'';
  for(const row of db.prepare('SELECT '+selected+' FROM '+quoted+where+' ORDER BY '+selected).iterate(...(where?[MARKER]:[]))){hash.update(JSON.stringify(columns.map(column=>row[column]))+'\n');rows++;}
  tables[name]={columns,rows,sha256:hash.digest('hex')};
 }
 return tables;
}
function installReportRevisions({dbPath,apply=false}={}){
 if(typeof dbPath!=='string'||!dbPath.trim())throw fail('REPORT_REVISION_DATABASE_REQUIRED','Provide an explicit database path.');
 const target=path.resolve(dbPath),source=loadReportRevisionMigrationSource();
 require('./install_sample_amendment_authorisation').assertAmendmentStartupReady(target);
 const reader=new Database(target,{readonly:true,fileMustExist:true});let reviewed;
 try{reviewed=reader.transaction(()=>classify(reader,source))();}finally{reader.close();}
 if(!apply||reviewed.classification==='COMPLETE_211')return{...reviewed,mode:apply?'NO_OP':'DRY_RUN',totalChanges:0,backfilledCount:0};
 const db=new Database(target,{fileMustExist:true,timeout:5000});
 try{
  db.pragma('foreign_keys=ON');
  return db.transaction(()=>{
   const current=classify(db,source);
   if(current.classification==='COMPLETE_211')return{...current,mode:'NO_OP',totalChanges:0,backfilledCount:0};
   const before=snapshot(db),release=loadReportRevisionMigrationSource();
   db.exec(current.classification==='PRE_211'?release.sql:release.guardsSql);
   if(fingerprint(snapshot(db))!==fingerprint(before)||populated(db))
    throw fail('REPORT_REVISION_PRESERVATION_REFUSED','Installation changed historical rows.');
   const receipt={sources:current.sources,originalRowsSha256:fingerprint(before),originalRowsPreserved:true,backfilledCount:0};
   receipt.receiptSha256=fingerprint(receipt);
   db.prepare('INSERT INTO _schema_migrations(id,details) VALUES(?,?)').run(MARKER,JSON.stringify(receipt));
   if(db.pragma('integrity_check',{simple:true})!=='ok'||db.pragma('foreign_key_check').length)
    throw fail('REPORT_REVISION_INTEGRITY_REFUSED','Installation failed integrity checks.');
   return{...classify(db,source),previousClassification:current.classification,mode:'APPLIED',backfilledCount:0,totalChanges:db.prepare('SELECT total_changes() n').get().n};
  }).immediate();
 }finally{db.close();}
}
function assertReportRevisionStartupReady(dbPath){
 if(typeof dbPath!=='string'||!dbPath.trim()||!fs.existsSync(dbPath))
  throw fail('REPORT_REVISION_DATABASE_REQUIRED','The lab database does not exist.');
 const outcome=installReportRevisions({dbPath});
 if(outcome.classification!=='COMPLETE_211')
  throw fail('REPORT_REVISION_STARTUP_REQUIRED','Run the reviewed report revision installer before starting the lab.');
 return outcome;
}
function parseArguments(args){
 const options={apply:false},seen=new Set();
 for(let index=0;index<args.length;index++){
  const arg=args[index];if(seen.has(arg))throw fail('REPORT_REVISION_ARGUMENT_INVALID','Repeated argument.');seen.add(arg);
  if(arg==='--apply')options.apply=true;
  else if(arg==='--dry-run')continue;
  else if(arg==='--db'&&args[index+1]&&!args[index+1].startsWith('--'))options.dbPath=args[++index];
  else throw fail('REPORT_REVISION_ARGUMENT_INVALID','Unknown or incomplete argument.');
 }
 if(!options.dbPath||seen.has('--apply')&&seen.has('--dry-run'))throw fail('REPORT_REVISION_ARGUMENT_INVALID','Provide --db and one mode.');
 return options;
}
if(require.main===module){
 try{process.stdout.write(JSON.stringify(installReportRevisions(parseArguments(process.argv.slice(2))),null,2)+'\n');}
 catch(error){process.stderr.write(JSON.stringify({error:error.code||'REPORT_REVISION_INSTALL_REFUSED',message:error.message,differences:error.differences||[],totalChanges:0})+'\n');process.exitCode=1;}
}
module.exports={installReportRevisions,assertReportRevisionStartupReady,parseArguments};
