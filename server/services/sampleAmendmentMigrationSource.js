const fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto');
const DIRECTORY='20261010000000_sample_amendment_authorisation';
const SHA256='98f180e1fe6464f0fb8e4f23a8d83832994216ff9f8174e205f75320395727f0';
const ORACLE_SHA256='d738c6f76e59daea9b48824bb0dd39eb0ee390e3548c801229e593d3e3914aa2';
function loadSampleAmendmentMigrationSource(){
 const root=path.resolve(__dirname,'..',fs.existsSync('/.dockerenv')?'.migrations-backup/210':'prisma/migrations',DIRECTORY);
 let bytes;try{bytes=fs.readFileSync(path.join(root,'migration.sql'));}catch(cause){throw Object.assign(new Error('Amendment request DDL is unavailable.',{cause}),{statusCode:409,code:'AMENDMENT_SOURCE_MISMATCH'});}
 if(createHash('sha256').update(bytes).digest('hex')!==SHA256)throw Object.assign(new Error('Amendment request DDL digest differs.'),{statusCode:409,code:'AMENDMENT_SOURCE_MISMATCH'});
 let oracleBytes;try{oracleBytes=fs.readFileSync(path.join(root,'fresh-prisma-tables.json'));}catch(cause){throw Object.assign(new Error('Amendment link oracle is unavailable.',{cause}),{statusCode:409,code:'AMENDMENT_SOURCE_MISMATCH'});}
 if(createHash('sha256').update(oracleBytes).digest('hex')!==ORACLE_SHA256)throw Object.assign(new Error('Amendment link oracle digest differs.'),{statusCode:409,code:'AMENDMENT_SOURCE_MISMATCH'});
 const freshTables=JSON.parse(oracleBytes.toString('utf8'));
 const sql=bytes.toString('utf8'),boundary=sql.indexOf('-- Contract guards');
 if(boundary<0)throw Object.assign(new Error('Amendment request guard boundary differs.'),{statusCode:409,code:'AMENDMENT_SOURCE_MISMATCH'});
 if(Object.keys(freshTables).sort().join(',')!=='ReportAmendmentWithdrawal,SampleAmendmentAttempt'||
  Object.entries(freshTables).some(([name,ddl])=>sql.match(new RegExp('CREATE TABLE "'+name+'" \\([\\s\\S]*?\\n\\);'))?.[0]!==ddl))
  throw Object.assign(new Error('Managed amendment link DDL differs from the fresh oracle.'),{statusCode:409,code:'AMENDMENT_SOURCE_MISMATCH'});
 return Object.freeze({sql,schemaSql:sql.slice(0,boundary),guardsSql:sql.slice(boundary),sha256:SHA256,oracleSha256:ORACLE_SHA256,freshTables:Object.freeze(freshTables)});
}
module.exports={loadSampleAmendmentMigrationSource};
