#!/usr/bin/env node
const { openReadonlyDatabase } = require('../utils/startupReadinessContext');
const fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto'),Database=require('better-sqlite3');
const {loadSampleContainerMigrationSource}=require('../services/sampleContainerMigrationSource');
const MARKER='206_sample_containers',TABLE='SampleContainer',COUNTER='ContainerSequence';
const fail=(code,message,differences=[])=>Object.assign(new Error(message),{statusCode:409,code,differences,totalChanges:0});
const fingerprint=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const normalized=sql=>(sql.match(/'(?:''|[^'])*'|"(?:""|[^"])*"|\s+|[^\s'"]+/g)||[]).filter(token=>!/^\s+$/.test(token)).join('').replace(/;$/,'');

// #206 adds container identities and an independent counter. No old columns or
// rows change; the empty Prisma identity table may gain its counter and guards.
function objects(sql,expected){
 const found=[...[...sql.matchAll(/^CREATE TABLE "([^"]+)"[\s\S]*?^\);/gm)].map(match=>({name:match[1],table:match[1],type:'table',sql:match[0]})),
  ...[...sql.matchAll(/^CREATE (?:UNIQUE )?INDEX "([^"]+)"[^;]*;/gm)].map(match=>({name:match[1],table:match[0].match(/ ON "([^"]+)"/)[1],type:'index',sql:match[0]})),
  ...[...sql.matchAll(/^CREATE TRIGGER "([^"]+)"[\s\S]*?^END;/gm)].map(match=>({name:match[1],table:match[0].match(/ ON "([^"]+)"/)[1],type:'trigger',sql:match[0]}))];
 if(found.length!==expected)throw fail('SAMPLE_CONTAINER_SOURCE_MISMATCH','The release object list differs.');
 return found;
}
function classify(db,source){
 if(db.pragma('integrity_check',{simple:true})!=='ok'||db.pragma('foreign_key_check').length)throw fail('SAMPLE_CONTAINER_INTEGRITY_REFUSED','An intact database is required.');
 for(const [table,column] of [['Sample','id'],['WorkItem','id'],['EquipmentAsset','id'],['WorkAttempt','aliquotId'],['_schema_migrations','details']])
  if(!db.prepare('PRAGMA table_info("'+table+'")').all().some(row=>row.name===column))
   throw fail('SAMPLE_CONTAINER_PREREQUISITE_REQUIRED','Install the prior application schema first.');
 const differences=[];
 const check=wanted=>{
  const row=db.prepare('SELECT type,tbl_name,sql FROM sqlite_master WHERE name=?').get(wanted.name);
  if(row&&(row.type!==wanted.type||row.tbl_name!==wanted.table||normalized(row.sql)!==normalized(wanted.sql)))differences.push(wanted.name+' differs');
  return Boolean(row);
 };
 const schema=objects(source.schemaSql,5),guards=objects(source.guardsSql,4);
 const schemaPresent=schema.map(check),guardsPresent=guards.map(check);
 const known=new Set([...schema,...guards].map(row=>row.name));
 for(const row of db.prepare("SELECT name FROM sqlite_master WHERE tbl_name IN (?,?) AND name NOT LIKE 'sqlite_autoindex_%'").all(TABLE,COUNTER))
  if(!known.has(row.name))differences.push(row.name+' is not part of the release');
 const sources={migrationSha256:source.sha256,contractVersion:'206-v1'};
 const marker=db.prepare('SELECT details FROM _schema_migrations WHERE id=?').get(MARKER);
 let receipt;
 if(marker){
  try{receipt=JSON.parse(marker.details);}catch{/* Refuse unverified provenance. */}
  const keys=['sources','originalRowsSha256','originalRowsPreserved','backfilledCount','receiptSha256'];
  if(!receipt||JSON.stringify(Object.keys(receipt).sort())!==JSON.stringify(keys.sort())||
   JSON.stringify(receipt.sources)!==JSON.stringify(sources)||!/^[a-f0-9]{64}$/.test(receipt.originalRowsSha256)||
   receipt.originalRowsPreserved!==true||receipt.backfilledCount!==0||
   receipt.receiptSha256!==fingerprint(Object.fromEntries(Object.entries(receipt).filter(([key])=>key!=='receiptSha256'))))
   differences.push('Sample container installation receipt differs');
 }
 const all=[...schemaPresent,...guardsPresent,Boolean(marker)];
 let classification;
 if(all.every(value=>!value))classification='PRE_206';
 else if(schema.filter(row=>row.name!==COUNTER).every(row=>check(row))&&!check(schema.find(row=>row.name===COUNTER))&&[...guardsPresent,Boolean(marker)].every(value=>!value)){
  classification='FRESH_PRISMA_206';
  if(!differences.length&&db.prepare('SELECT count(*) n FROM "SampleContainer"').get().n)differences.push('Unmarked sample containers must not be adopted');
 }else if(all.every(Boolean))classification='COMPLETE_206';
 else differences.push('Sample container installation is partial or unmarked');
 if(differences.length)throw fail('SAMPLE_CONTAINER_SCHEMA_MISMATCH','Sample container storage differs from the release.',differences);
 return{classification,sources,...(receipt&&{receipt})};
}
function snapshot(db){
 const tables={};
 for(const {name}of db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT IN (?,?) ORDER BY name").all(TABLE,COUNTER)){
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
function installSampleContainers({dbPath,apply=false, startupContext}={}){
 if(typeof dbPath!=='string'||!dbPath.trim())throw fail('SAMPLE_CONTAINER_DATABASE_REQUIRED','Provide an explicit database path.');
 const target=path.resolve(dbPath),source=loadSampleContainerMigrationSource();
 require('./install_instrument_imports').assertInstrumentImportStartupReady(target, apply ? undefined : startupContext);
 const reader=openReadonlyDatabase(Database, target, {readonly:true,fileMustExist:true}, apply ? undefined : startupContext);let reviewed;
 try{reviewed=reader.transaction(()=>classify(reader,source))();}finally{reader.close();}
 if(!apply||reviewed.classification==='COMPLETE_206')return{...reviewed,mode:apply?'NO_OP':'DRY_RUN',totalChanges:0,backfilledCount:0};
 const db=new Database(target,{fileMustExist:true,timeout:5000});
 try{
  db.pragma('foreign_keys=ON');
  return db.transaction(()=>{
   const current=classify(db,source);
   if(current.classification==='COMPLETE_206')return{...current,mode:'NO_OP',totalChanges:0,backfilledCount:0};
   const before=snapshot(db),release=loadSampleContainerMigrationSource();
   if(current.classification==='PRE_206')db.exec(release.sql);
   else{db.exec(release.counterSql);db.exec(release.guardsSql);}
   if(fingerprint(snapshot(db))!==fingerprint(before))throw fail('SAMPLE_CONTAINER_PRESERVATION_REFUSED','Installation changed existing rows.');
   const receipt={sources:current.sources,originalRowsSha256:fingerprint(before),originalRowsPreserved:true,backfilledCount:0};
   receipt.receiptSha256=fingerprint(receipt);
   db.prepare('INSERT INTO _schema_migrations(id,details) VALUES(?,?)').run(MARKER,JSON.stringify(receipt));
   if(db.pragma('integrity_check',{simple:true})!=='ok'||db.pragma('foreign_key_check').length)
    throw fail('SAMPLE_CONTAINER_INTEGRITY_REFUSED','Installation failed integrity checks.');
   return{...classify(db,source),previousClassification:current.classification,mode:'APPLIED',backfilledCount:0,totalChanges:db.prepare('SELECT total_changes() n').get().n};
  }).immediate();
 }finally{db.close();}
}
function assertSampleContainerStartupReady(dbPath, startupContext){
 if(typeof dbPath!=='string'||!dbPath.trim()||!fs.existsSync(dbPath))
  throw fail('SAMPLE_CONTAINER_DATABASE_REQUIRED','The lab database does not exist.');
 const outcome=installSampleContainers({dbPath, startupContext});
 if(outcome.classification!=='COMPLETE_206')
  throw fail('SAMPLE_CONTAINER_STARTUP_REQUIRED','Run the reviewed sample container installer before starting the lab.');
 return outcome;
}
function parseArguments(args){
 const options={apply:false},seen=new Set();
 for(let index=0;index<args.length;index++){
  const arg=args[index];if(seen.has(arg))throw fail('SAMPLE_CONTAINER_ARGUMENT_INVALID','Repeated argument.');seen.add(arg);
  if(arg==='--apply')options.apply=true;
  else if(arg==='--dry-run')continue;
  else if(arg==='--db'&&args[index+1]&&!args[index+1].startsWith('--'))options.dbPath=args[++index];
  else throw fail('SAMPLE_CONTAINER_ARGUMENT_INVALID','Unknown or incomplete argument.');
 }
 if(!options.dbPath||seen.has('--apply')&&seen.has('--dry-run'))throw fail('SAMPLE_CONTAINER_ARGUMENT_INVALID','Provide --db and one mode.');
 return options;
}
if(require.main===module){
 try{process.stdout.write(JSON.stringify(installSampleContainers(parseArguments(process.argv.slice(2))),null,2)+'\n');}
 catch(error){process.stderr.write(JSON.stringify({error:error.code||'SAMPLE_CONTAINER_INSTALL_REFUSED',message:error.message,differences:error.differences||[],totalChanges:0})+'\n');process.exitCode=1;}
}
module.exports={installSampleContainers,assertSampleContainerStartupReady,parseArguments};
