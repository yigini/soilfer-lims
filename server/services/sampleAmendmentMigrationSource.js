const fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto');
const DIRECTORY='20261010000000_sample_amendment_authorisation';
const SHA256='27572a538f7d1467049c75bdfc53c4a9862d4c1b6ec1a1970fab4acb51a187b3';
function loadSampleAmendmentMigrationSource(){
 const root=path.resolve(__dirname,'..',fs.existsSync('/.dockerenv')?'.migrations-backup/210':'prisma/migrations',DIRECTORY);
 let bytes;try{bytes=fs.readFileSync(path.join(root,'migration.sql'));}catch(cause){throw Object.assign(new Error('Amendment request DDL is unavailable.',{cause}),{statusCode:409,code:'AMENDMENT_SOURCE_MISMATCH'});}
 if(createHash('sha256').update(bytes).digest('hex')!==SHA256)throw Object.assign(new Error('Amendment request DDL digest differs.'),{statusCode:409,code:'AMENDMENT_SOURCE_MISMATCH'});
 const sql=bytes.toString('utf8'),boundary=sql.indexOf('-- Contract guards');
 if(boundary<0)throw Object.assign(new Error('Amendment request guard boundary differs.'),{statusCode:409,code:'AMENDMENT_SOURCE_MISMATCH'});
 return Object.freeze({sql,schemaSql:sql.slice(0,boundary),guardsSql:sql.slice(boundary),sha256:SHA256});
}
module.exports={loadSampleAmendmentMigrationSource};
