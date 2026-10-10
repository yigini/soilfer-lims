#!/usr/bin/env node
const path=require('node:path'),{createHash}=require('node:crypto'),Database=require('better-sqlite3');
const {loadSampleAmendmentMigrationSource}=require('../services/sampleAmendmentMigrationSource');
const MARKER='210_sample_amendment_authorisation';
const COLUMNS=Object.freeze({requestPayload:'TEXT',version:'INTEGER',priorApprovedBy:'TEXT',priorApprovedAt:'DATETIME',selectedWorkItemIds:'TEXT'});
const fail=(code,message,differences=[])=>Object.assign(new Error(message),{statusCode:409,code,differences,totalChanges:0});
const fingerprint=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const normalized=sql=>(sql.match(/'(?:''|[^'])*'|"(?:""|[^"])*"|\s+|[^\s'"]+/g)||[]).filter(token=>!/^\s+$/.test(token)).join('').replace(/;$/,'');

function classify(db,source){
 if(db.pragma('integrity_check',{simple:true})!=='ok'||db.pragma('foreign_key_check').length)throw fail('AMENDMENT_INTEGRITY_REFUSED','An intact database is required.');
 const columns=db.prepare('PRAGMA table_xinfo("SampleAmendment")').all();
 if(!['id','sampleId','type','status','reason','createdBy','authorizedBy','authorizedAt','createdAt','updatedAt'].every(name=>columns.some(row=>row.name===name))||
  !db.prepare('PRAGMA table_info("_schema_migrations")').all().some(row=>row.name==='details'))
  throw fail('AMENDMENT_PREREQUISITE_REQUIRED','Install the prior application schema first.');
 const differences=[];
 const present=Object.entries(COLUMNS).map(([name,type])=>{
  const row=columns.find(value=>value.name===name);
  if(row&&(row.type!==type||row.notnull||row.dflt_value!==null||row.pk||row.hidden))differences.push('SampleAmendment.'+name+' differs');
  return Boolean(row);
 });
 const guards=[...source.guardsSql.matchAll(/^CREATE TRIGGER "([^"]+)"[\s\S]*?^END;/gm)].map(match=>({name:match[1],sql:match[0]}));
 if(guards.length!==5)throw fail('AMENDMENT_SOURCE_MISMATCH','The release requires all five request-evidence guards.');
 const installed=guards.map(guard=>{
  const row=db.prepare('SELECT type,sql FROM sqlite_master WHERE name=?').get(guard.name);
  if(row&&(row.type!=='trigger'||normalized(row.sql)!==normalized(guard.sql)))differences.push(guard.name+' differs');
  return Boolean(row);
 });
 const sources={migrationSha256:source.sha256,contractVersion:'210-v1'};
 const marker=db.prepare('SELECT details FROM _schema_migrations WHERE id=?').get(MARKER);
 let receipt;
 if(marker){
  try{receipt=JSON.parse(marker.details);}catch{/* Refuse unverified provenance. */}
  const keys=['sources','originalRowsSha256','originalRowsPreserved','newAmendmentCount','backfilledCount','receiptSha256'];
  if(!receipt||JSON.stringify(Object.keys(receipt).sort())!==JSON.stringify(keys.sort())||
   JSON.stringify(receipt.sources)!==JSON.stringify(sources)||!/^[a-f0-9]{64}$/.test(receipt.originalRowsSha256)||
   receipt.originalRowsPreserved!==true||receipt.newAmendmentCount!==0||receipt.backfilledCount!==0||
   receipt.receiptSha256!==fingerprint(Object.fromEntries(Object.entries(receipt).filter(([key])=>key!=='receiptSha256'))))
   differences.push('Amendment installation receipt differs');
 }
 let classification;
 if([...present,...installed,Boolean(marker)].every(value=>!value))classification='PRE_210';
 else if(present.every(Boolean)&&[...installed,Boolean(marker)].every(value=>!value)){
  classification='FRESH_PRISMA_210';
  if(db.prepare('SELECT count(*) n FROM SampleAmendment WHERE '+Object.keys(COLUMNS).map(name=>'"'+name+'" IS NOT NULL').join(' OR ')).get().n)
   differences.push('Unmarked request evidence must not be adopted');
 }else if([...present,...installed,Boolean(marker)].every(Boolean))classification='COMPLETE_210';
 else differences.push('Amendment installation is partial or unmarked');
 if(differences.length)throw fail('AMENDMENT_SCHEMA_MISMATCH','Amendment request evidence differs from the release.',differences);
 return{classification,sources,amendmentCount:db.prepare('SELECT count(*) n FROM SampleAmendment').get().n,...(receipt&&{receipt})};
}

function snapshot(db,originalColumns){
 const names=db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(row=>row.name);
 const tables={};
 for(const name of names){
  const quoted='"'+name.replace(/"/g,'""')+'"';
  const columns=originalColumns?.[name]?.columns||db.prepare('PRAGMA table_xinfo('+quoted+')').all().filter(row=>row.hidden===0).map(row=>row.name);
  const selected=columns.map(column=>'"'+column.replace(/"/g,'""')+'"').join(',');
  const hash=createHash('sha256');let rows=0;
  const where=name==='_schema_migrations'?' WHERE id<>?':'';
  const query=db.prepare('SELECT '+selected+' FROM '+quoted+where+' ORDER BY '+selected);
  for(const row of query.iterate(...(where?[MARKER]:[]))){hash.update(JSON.stringify(columns.map(column=>row[column]))+'\n');rows++;}
  tables[name]={columns,rows,sha256:hash.digest('hex')};
 }
 return{tables,objects:db.prepare("SELECT type,name,tbl_name,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' AND name<>'SampleAmendment' ORDER BY type,name").all(),
  amendmentColumns:db.prepare('PRAGMA table_xinfo("SampleAmendment")').all(),
  amendmentForeignKeys:db.prepare('PRAGMA foreign_key_list("SampleAmendment")').all()};
}

function installSampleAmendmentAuthorisation({dbPath,apply=false}={}){
 if(typeof dbPath!=='string'||!dbPath.trim())throw fail('AMENDMENT_DATABASE_REQUIRED','Provide an explicit database path.');
 const target=path.resolve(dbPath),source=loadSampleAmendmentMigrationSource();
 const reader=new Database(target,{readonly:true,fileMustExist:true});let reviewed;
 try{reviewed=reader.transaction(()=>classify(reader,source))();}finally{reader.close();}
 if(!apply||reviewed.classification==='COMPLETE_210')return{...reviewed,mode:apply?'NO_OP':'DRY_RUN',totalChanges:0,newAmendmentCount:0,backfilledCount:0};
 const db=new Database(target,{fileMustExist:true,timeout:5000});
 try{
  db.pragma('foreign_keys=ON');
  return db.transaction(()=>{
   const current=classify(db,source);
   if(current.classification==='COMPLETE_210')return{...current,mode:'NO_OP',totalChanges:0,newAmendmentCount:0,backfilledCount:0};
   if(db.pragma('integrity_check',{simple:true})!=='ok'||db.pragma('foreign_key_check').length)throw fail('AMENDMENT_INTEGRITY_REFUSED','An intact database is required.');
   const before=snapshot(db),release=loadSampleAmendmentMigrationSource();
   db.exec(current.classification==='PRE_210'?release.sql:release.guardsSql);
   const after=snapshot(db,before.tables),guardNames=new Set([...release.guardsSql.matchAll(/^CREATE TRIGGER "([^"]+)"/gm)].map(match=>match[1]));
   if(fingerprint(after.tables)!==fingerprint(before.tables)||fingerprint(after.objects.filter(row=>!guardNames.has(row.name)))!==fingerprint(before.objects)||
    fingerprint(after.amendmentForeignKeys)!==fingerprint(before.amendmentForeignKeys)||
    before.amendmentColumns.some(row=>fingerprint(after.amendmentColumns.find(value=>value.name===row.name))!==fingerprint(row))||
    db.prepare('SELECT count(*) n FROM SampleAmendment WHERE '+Object.keys(COLUMNS).map(name=>'"'+name+'" IS NOT NULL').join(' OR ')).get().n)
    throw fail('AMENDMENT_PRESERVATION_REFUSED','Installation changed historical rows or schema evidence.');
   const receipt={sources:current.sources,originalRowsSha256:fingerprint(before.tables),originalRowsPreserved:true,newAmendmentCount:0,backfilledCount:0};
   receipt.receiptSha256=fingerprint(receipt);
   db.prepare('INSERT INTO _schema_migrations(id,details) VALUES(?,?)').run(MARKER,JSON.stringify(receipt));
   if(fingerprint(snapshot(db,before.tables).tables)!==fingerprint(before.tables)||db.pragma('integrity_check',{simple:true})!=='ok'||db.pragma('foreign_key_check').length)
    throw fail('AMENDMENT_INTEGRITY_REFUSED','Installation failed preservation or integrity checks.');
   return{...classify(db,source),previousClassification:current.classification,mode:'APPLIED',newAmendmentCount:0,backfilledCount:0,totalChanges:db.prepare('SELECT total_changes() n').get().n};
  }).immediate();
 }finally{db.close();}
}
function parseArguments(args){
 const options={apply:false},seen=new Set();
 for(let index=0;index<args.length;index++){
  const arg=args[index];if(seen.has(arg))throw fail('AMENDMENT_ARGUMENT_INVALID','Repeated argument.');seen.add(arg);
  if(arg==='--apply')options.apply=true;
  else if(arg==='--dry-run')continue;
  else if(arg==='--db'&&args[index+1]&&!args[index+1].startsWith('--'))options.dbPath=args[++index];
  else throw fail('AMENDMENT_ARGUMENT_INVALID','Unknown or incomplete argument.');
 }
 if(!options.dbPath||seen.has('--apply')&&seen.has('--dry-run'))throw fail('AMENDMENT_ARGUMENT_INVALID','Provide --db and one mode.');
 return options;
}
if(require.main===module){
 try{process.stdout.write(JSON.stringify(installSampleAmendmentAuthorisation(parseArguments(process.argv.slice(2))),null,2)+'\n');}
 catch(error){process.stderr.write(JSON.stringify({error:error.code||'AMENDMENT_INSTALL_REFUSED',message:error.message,differences:error.differences||[],totalChanges:0})+'\n');process.exitCode=1;}
}
module.exports={installSampleAmendmentAuthorisation,parseArguments};
