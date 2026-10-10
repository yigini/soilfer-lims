#!/usr/bin/env node
const fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto'),Database=require('better-sqlite3');
const {loadBenchCredentialMigrationSource}=require('../services/benchCredentialMigrationSource');
const MARKER='202_bench_credentials',TABLE='UserBenchCredential';
const fail=(code,message,differences=[])=>Object.assign(new Error(message),{statusCode:409,code,differences,totalChanges:0});
const fingerprint=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const normalized=sql=>(sql.match(/'(?:''|[^'])*'|"(?:""|[^"])*"|\s+|[^\s'"]+/g)||[]).filter(token=>!/^\s+$/.test(token)).join('').replace(/;$/,'');

// #202 is a single additive credential table. Fresh Prisma files are adopted
// only while empty; every other shape is refused with zero writes.
function classify(db,source){
 if(db.pragma('integrity_check',{simple:true})!=='ok'||db.pragma('foreign_key_check').length)throw fail('BENCH_CREDENTIAL_INTEGRITY_REFUSED','An intact database is required.');
 if(!db.prepare('PRAGMA table_info("User")').all().some(row=>row.name==='id')||
  !db.prepare('PRAGMA table_info("_schema_migrations")').all().some(row=>row.name==='details'))
  throw fail('BENCH_CREDENTIAL_PREREQUISITE_REQUIRED','Install the prior application schema first.');
 const differences=[],table=db.prepare("SELECT type,sql FROM sqlite_master WHERE name=?").get(TABLE);
 if(table&&(table.type!=='table'||normalized(table.sql)!==normalized(source.tableSql)))differences.push(TABLE+' differs');
 if(table&&db.prepare("SELECT count(*) n FROM sqlite_master WHERE tbl_name=? AND name NOT LIKE 'sqlite_autoindex_%' AND name<>?").get(TABLE,TABLE).n)
  differences.push(TABLE+' has unreviewed objects');
 const sources={migrationSha256:source.sha256,contractVersion:'202-v1'};
 const marker=db.prepare('SELECT details FROM _schema_migrations WHERE id=?').get(MARKER);
 let receipt;
 if(marker){
  try{receipt=JSON.parse(marker.details);}catch{/* Refuse unverified provenance. */}
  const keys=['sources','originalRowsSha256','originalRowsPreserved','backfilledCount','receiptSha256'];
  if(!receipt||JSON.stringify(Object.keys(receipt).sort())!==JSON.stringify(keys.sort())||
   JSON.stringify(receipt.sources)!==JSON.stringify(sources)||!/^[a-f0-9]{64}$/.test(receipt.originalRowsSha256)||
   receipt.originalRowsPreserved!==true||receipt.backfilledCount!==0||
   receipt.receiptSha256!==fingerprint(Object.fromEntries(Object.entries(receipt).filter(([key])=>key!=='receiptSha256'))))
   differences.push('Bench credential installation receipt differs');
 }
 let classification;
 if(!table&&!marker)classification='PRE_202';
 else if(table&&!marker){
  classification='FRESH_PRISMA_202';
  if(!differences.length&&db.prepare('SELECT count(*) n FROM "UserBenchCredential"').get().n)differences.push('Unmarked bench credentials must not be adopted');
 }else if(table&&marker)classification='COMPLETE_202';
 else differences.push('Bench credential installation is partial or unmarked');
 if(differences.length)throw fail('BENCH_CREDENTIAL_SCHEMA_MISMATCH','Bench credential storage differs from the release.',differences);
 return{classification,sources,...(receipt&&{receipt})};
}
function snapshot(db){
 const tables={};
 for(const {name}of db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name<>? ORDER BY name").all(TABLE)){
  const quoted='"'+name.replace(/"/g,'""')+'"';
  const columns=db.prepare('PRAGMA table_xinfo('+quoted+')').all().filter(row=>row.hidden===0).map(row=>row.name);
  const selected=columns.map(column=>'"'+column.replace(/"/g,'""')+'"').join(',');
  const hash=createHash('sha256');let rows=0;
  const where=name==='_schema_migrations'?' WHERE id<>?':'';
  for(const row of db.prepare('SELECT '+selected+' FROM '+quoted+where+' ORDER BY '+selected).iterate(...(where?[MARKER]:[]))){hash.update(JSON.stringify(columns.map(column=>row[column]))+'\n');rows++;}
  tables[name]={columns,rows,sha256:hash.digest('hex')};
 }
 return tables;
}
function installBenchCredentials({dbPath,apply=false}={}){
 if(typeof dbPath!=='string'||!dbPath.trim())throw fail('BENCH_CREDENTIAL_DATABASE_REQUIRED','Provide an explicit database path.');
 const target=path.resolve(dbPath),source=loadBenchCredentialMigrationSource();
 require('./install_report_revisions').assertReportRevisionStartupReady(target);
 const reader=new Database(target,{readonly:true,fileMustExist:true});let reviewed;
 try{reviewed=reader.transaction(()=>classify(reader,source))();}finally{reader.close();}
 if(!apply||reviewed.classification==='COMPLETE_202')return{...reviewed,mode:apply?'NO_OP':'DRY_RUN',totalChanges:0,backfilledCount:0};
 const db=new Database(target,{fileMustExist:true,timeout:5000});
 try{
  db.pragma('foreign_keys=ON');
  return db.transaction(()=>{
   const current=classify(db,source);
   if(current.classification==='COMPLETE_202')return{...current,mode:'NO_OP',totalChanges:0,backfilledCount:0};
   const before=snapshot(db),release=loadBenchCredentialMigrationSource();
   if(current.classification==='PRE_202')db.exec(release.sql);
   if(fingerprint(snapshot(db))!==fingerprint(before))throw fail('BENCH_CREDENTIAL_PRESERVATION_REFUSED','Installation changed existing rows.');
   const receipt={sources:current.sources,originalRowsSha256:fingerprint(before),originalRowsPreserved:true,backfilledCount:0};
   receipt.receiptSha256=fingerprint(receipt);
   db.prepare('INSERT INTO _schema_migrations(id,details) VALUES(?,?)').run(MARKER,JSON.stringify(receipt));
   if(db.pragma('integrity_check',{simple:true})!=='ok'||db.pragma('foreign_key_check').length)
    throw fail('BENCH_CREDENTIAL_INTEGRITY_REFUSED','Installation failed integrity checks.');
   return{...classify(db,source),previousClassification:current.classification,mode:'APPLIED',backfilledCount:0,totalChanges:db.prepare('SELECT total_changes() n').get().n};
  }).immediate();
 }finally{db.close();}
}
function assertBenchCredentialStartupReady(dbPath){
 if(typeof dbPath!=='string'||!dbPath.trim()||!fs.existsSync(dbPath))
  throw fail('BENCH_CREDENTIAL_DATABASE_REQUIRED','The lab database does not exist.');
 const outcome=installBenchCredentials({dbPath});
 if(outcome.classification!=='COMPLETE_202')
  throw fail('BENCH_CREDENTIAL_STARTUP_REQUIRED','Run the reviewed bench credential installer before starting the lab.');
 return outcome;
}
function parseArguments(args){
 const options={apply:false},seen=new Set();
 for(let index=0;index<args.length;index++){
  const arg=args[index];if(seen.has(arg))throw fail('BENCH_CREDENTIAL_ARGUMENT_INVALID','Repeated argument.');seen.add(arg);
  if(arg==='--apply')options.apply=true;
  else if(arg==='--dry-run')continue;
  else if(arg==='--db'&&args[index+1]&&!args[index+1].startsWith('--'))options.dbPath=args[++index];
  else throw fail('BENCH_CREDENTIAL_ARGUMENT_INVALID','Unknown or incomplete argument.');
 }
 if(!options.dbPath||seen.has('--apply')&&seen.has('--dry-run'))throw fail('BENCH_CREDENTIAL_ARGUMENT_INVALID','Provide --db and one mode.');
 return options;
}
if(require.main===module){
 try{process.stdout.write(JSON.stringify(installBenchCredentials(parseArguments(process.argv.slice(2))),null,2)+'\n');}
 catch(error){process.stderr.write(JSON.stringify({error:error.code||'BENCH_CREDENTIAL_INSTALL_REFUSED',message:error.message,differences:error.differences||[],totalChanges:0})+'\n');process.exitCode=1;}
}
module.exports={installBenchCredentials,assertBenchCredentialStartupReady,parseArguments};
