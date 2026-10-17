#!/usr/bin/env node
// The optional startup context must not become a default CLI/image-copy dependency.
function openReadonlyDatabase(Database, target, options, startupContext) {
    return startupContext
        ? require('../utils/startupReadinessContext').openReadonlyDatabase(Database, target, options, startupContext)
        : new Database(target, options);
}
const fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto'),Database=require('better-sqlite3');
const {loadLabelPrintMigrationSource}=require('../services/labelPrintMigrationSource');
const MARKER='208_label_print_events',TABLES=['LabelPrintEvent'];
const fail=(code,message,differences=[])=>Object.assign(new Error(message),{statusCode:409,code,differences,totalChanges:0});
const fingerprint=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const normalized=sql=>(sql.match(/'(?:''|[^'])*'|"(?:""|[^"])*"|\s+|[^\s'"]+/g)||[]).filter(token=>!/^\s+$/.test(token)).join('').replace(/;$/,'');
function objects(sql,expected){
 const found=[...[...sql.matchAll(/^CREATE TABLE "([^"]+)"[\s\S]*?^\);/gm)].map(m=>({name:m[1],table:m[1],type:'table',sql:m[0]})),
  ...[...sql.matchAll(/^CREATE (?:UNIQUE )?INDEX "([^"]+)"[^;]*;/gm)].map(m=>({name:m[1],table:m[0].match(/ ON "([^"]+)"/)[1],type:'index',sql:m[0]})),
  ...[...sql.matchAll(/^CREATE TRIGGER "([^"]+)"[\s\S]*?^END;/gm)].map(m=>({name:m[1],table:m[0].match(/ ON "([^"]+)"/)[1],type:'trigger',sql:m[0]}))];
 if(found.length!==expected)throw fail('LABEL_PRINT_SOURCE_MISMATCH','Label print release objects differ.');
 return found;
}
function classify(db,source){
 if(db.pragma('integrity_check',{simple:true})!=='ok'||db.pragma('foreign_key_check').length)throw fail('LABEL_PRINT_INTEGRITY_REFUSED','An intact database is required.');
 for(const [table,column] of [['Sample','labSampleCode'],['SampleContainer','code'],['_schema_migrations','details']])
  if(!db.prepare('PRAGMA table_info("'+table+'")').all().some(row=>row.name===column))throw fail('LABEL_PRINT_PREREQUISITE_REQUIRED','Install the previous application schema first.');
 const differences=[],schema=objects(source.schemaSql,4),guards=objects(source.guardsSql,3);
 const check=wanted=>{
  const row=db.prepare('SELECT type,tbl_name,sql FROM sqlite_master WHERE name=?').get(wanted.name);
  if(row&&(row.type!==wanted.type||row.tbl_name!==wanted.table||normalized(row.sql)!==normalized(wanted.sql)))differences.push(wanted.name+' differs');
  return Boolean(row);
 };
 const schemaPresent=schema.map(check),guardsPresent=guards.map(check),known=new Set([...schema,...guards].map(row=>row.name));
 for(const row of db.prepare("SELECT name FROM sqlite_master WHERE tbl_name IN (?) AND name NOT LIKE 'sqlite_autoindex_%'").all(...TABLES))
  if(!known.has(row.name))differences.push(row.name+' is not part of this release');
 const sources={migrationSha256:source.sha256,contractVersion:'208-v1'};
 const marker=db.prepare('SELECT details FROM _schema_migrations WHERE id=?').get(MARKER);let receipt;
 if(marker){
  try{receipt=JSON.parse(marker.details);}catch{/* Refuse unverified provenance. */}
  const keys=['sources','originalRowsSha256','originalRowsPreserved','backfilledCount','receiptSha256'];
  if(!receipt||JSON.stringify(Object.keys(receipt).sort())!==JSON.stringify(keys.sort())||JSON.stringify(receipt.sources)!==JSON.stringify(sources)||
   !/^[a-f0-9]{64}$/.test(receipt.originalRowsSha256)||receipt.originalRowsPreserved!==true||receipt.backfilledCount!==0||
   receipt.receiptSha256!==fingerprint(Object.fromEntries(Object.entries(receipt).filter(([key])=>key!=='receiptSha256'))))differences.push('Label print receipt differs');
 }
 const all=[...schemaPresent,...guardsPresent,Boolean(marker)];let classification;
 if(all.every(value=>!value))classification='PRE_208';
 else if(schemaPresent.every(Boolean)&&guardsPresent.every(value=>!value)&&!marker){
  classification='FRESH_PRISMA_208';
  for(const table of TABLES)if(db.prepare('SELECT count(*) n FROM "'+table+'"').get().n)differences.push('Unmarked '+table+' rows must not be adopted');
 }else if(all.every(Boolean))classification='COMPLETE_208';else differences.push('Label print installation is partial or unmarked');
 if(differences.length)throw fail('LABEL_PRINT_SCHEMA_MISMATCH','Label print storage differs from this release.',differences);
 return{classification,sources,...(receipt&&{receipt})};
}
function snapshot(db){
 const tables={};
 for(const {name}of db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT IN (?) ORDER BY name").all(...TABLES)){
  const quoted='"'+name.replace(/"/g,'""')+'"',columns=db.prepare('PRAGMA table_xinfo('+quoted+')').all().filter(row=>row.hidden===0).map(row=>row.name);
  const selected=columns.map(column=>'"'+column.replace(/"/g,'""')+'"').join(','),hash=createHash('sha256');let rows=0;
  const where=name==='_schema_migrations'?' WHERE id<>?':'';
  for(const row of db.prepare('SELECT '+selected+' FROM '+quoted+where+' ORDER BY '+selected).iterate(...(where?[MARKER]:[]))){hash.update(JSON.stringify(columns.map(column=>row[column]))+'\n');rows++;}
  tables[name]={columns,rows,sha256:hash.digest('hex')};
 }
 return tables;
}
function installLabelPrintEvents({dbPath,apply=false, startupContext}={}){
 if(typeof dbPath!=='string'||!dbPath.trim())throw fail('LABEL_PRINT_DATABASE_REQUIRED','Provide an explicit database path.');
 const target=path.resolve(dbPath),source=loadLabelPrintMigrationSource();
 require('./install_sample_code_schema').assertSampleCodeStartupReady(target, apply ? undefined : startupContext);
 require('./install_sample_containers').assertSampleContainerStartupReady(target, apply ? undefined : startupContext);
 const reader=openReadonlyDatabase(Database, target, {readonly:true,fileMustExist:true}, apply ? undefined : startupContext);let reviewed;
 try{reviewed=reader.transaction(()=>classify(reader,source))();}finally{reader.close();}
 if(!apply||reviewed.classification==='COMPLETE_208')return{...reviewed,mode:apply?'NO_OP':'DRY_RUN',totalChanges:0,backfilledCount:0};
 const db=new Database(target,{fileMustExist:true,timeout:5000});
 try{
  db.pragma('foreign_keys=ON');
  return db.transaction(()=>{
   const current=classify(db,source);
   if(current.classification==='COMPLETE_208')return{...current,mode:'NO_OP',totalChanges:0,backfilledCount:0};
   const before=snapshot(db),release=loadLabelPrintMigrationSource();
   db.exec(current.classification==='PRE_208'?release.sql:release.guardsSql);
   if(fingerprint(snapshot(db))!==fingerprint(before))throw fail('LABEL_PRINT_PRESERVATION_REFUSED','Installation changed existing rows or policies.');
   const receipt={sources:current.sources,originalRowsSha256:fingerprint(before),originalRowsPreserved:true,backfilledCount:0};receipt.receiptSha256=fingerprint(receipt);
   db.prepare('INSERT INTO _schema_migrations(id,details) VALUES(?,?)').run(MARKER,JSON.stringify(receipt));
   if(db.pragma('integrity_check',{simple:true})!=='ok'||db.pragma('foreign_key_check').length)throw fail('LABEL_PRINT_INTEGRITY_REFUSED','Installation failed integrity checks.');
   return{...classify(db,source),previousClassification:current.classification,mode:'APPLIED',backfilledCount:0,totalChanges:db.prepare('SELECT total_changes() n').get().n};
  }).immediate();
 }finally{db.close();}
}
function assertLabelPrintStartupReady(dbPath, startupContext){
 if(typeof dbPath!=='string'||!dbPath.trim()||!fs.existsSync(dbPath))throw fail('LABEL_PRINT_DATABASE_REQUIRED','The lab database does not exist.');
 const result=installLabelPrintEvents({dbPath, startupContext});
 if(result.classification!=='COMPLETE_208')throw fail('LABEL_PRINT_STARTUP_REQUIRED','Run the reviewed label print installer before starting the lab.');
 return result;
}
function parseArguments(args){
 const options={apply:false},seen=new Set();
 for(let i=0;i<args.length;i++){
  const arg=args[i];if(seen.has(arg))throw fail('LABEL_PRINT_ARGUMENT_INVALID','Repeated argument.');seen.add(arg);
  if(arg==='--apply')options.apply=true;else if(arg==='--dry-run')continue;
  else if(arg==='--db'&&args[i+1]&&!args[i+1].startsWith('--'))options.dbPath=args[++i];
  else throw fail('LABEL_PRINT_ARGUMENT_INVALID','Unknown or incomplete argument.');
 }
 if(!options.dbPath||seen.has('--apply')&&seen.has('--dry-run'))throw fail('LABEL_PRINT_ARGUMENT_INVALID','Provide --db and one mode.');
 return options;
}
if(require.main===module){
 try{process.stdout.write(JSON.stringify(installLabelPrintEvents(parseArguments(process.argv.slice(2))),null,2)+'\n');}
 catch(error){process.stderr.write(JSON.stringify({error:error.code||'LABEL_PRINT_INSTALL_REFUSED',message:error.message,differences:error.differences||[],totalChanges:0})+'\n');process.exitCode=1;}
}
module.exports={installLabelPrintEvents,assertLabelPrintStartupReady,parseArguments};
