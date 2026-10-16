const fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto');
const DIRECTORY='20261010000200_report_revision_amendment';
const SHA256='3acf8e97469c826b163f956e0701841143144d7fcd982fee3ba85151acfefe52';
const mismatch=(message,cause)=>Object.assign(new Error(message,cause&&{cause}),{statusCode:409,code:'REPORT_REVISION_SOURCE_MISMATCH'});
function loadReportRevisionMigrationSource(){
 const root=path.resolve(__dirname,'..',fs.existsSync('/.dockerenv')?'.migrations-backup/211':'prisma/migrations',DIRECTORY);
 let bytes;try{bytes=fs.readFileSync(path.join(root,'migration.sql'));}catch(cause){throw mismatch('Report revision DDL is unavailable.',cause);}
 if(createHash('sha256').update(bytes).digest('hex')!==SHA256)throw mismatch('Report revision DDL digest differs.');
 const sql=bytes.toString('utf8'),boundary=sql.indexOf('-- Contract guards');
 if(boundary<0)throw mismatch('Report revision guard boundary differs.');
 return Object.freeze({sql,schemaSql:sql.slice(0,boundary),guardsSql:sql.slice(boundary),sha256:SHA256});
}
module.exports={loadReportRevisionMigrationSource};
