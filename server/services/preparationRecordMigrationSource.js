const fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto');
const DIRECTORY='20261010000400_preparation_records';
const SHA256='e2d59e7b54096d97de5d1443f28516869672b2178cb3da345299d24838a7013c';
const mismatch=(message,cause)=>Object.assign(new Error(message,cause&&{cause}),{statusCode:409,code:'PREPARATION_RECORD_SOURCE_MISMATCH'});
function loadPreparationRecordMigrationSource(){
 const root=path.resolve(__dirname,'..',fs.existsSync('/.dockerenv')?'.migrations-backup/205':'prisma/migrations',DIRECTORY);
 let bytes;try{bytes=fs.readFileSync(path.join(root,'migration.sql'));}catch(cause){throw mismatch('Preparation record DDL is unavailable.',cause);}
 if(createHash('sha256').update(bytes).digest('hex')!==SHA256)throw mismatch('Preparation record DDL digest differs.');
 const sql=bytes.toString('utf8'),boundary=sql.indexOf('-- Contract guards');
 if(boundary<0)throw mismatch('Preparation record guard boundary differs.');
 return Object.freeze({sql,schemaSql:sql.slice(0,boundary),guardsSql:sql.slice(boundary),sha256:SHA256});
}
module.exports={loadPreparationRecordMigrationSource};
