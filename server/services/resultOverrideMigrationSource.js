const fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto');
const DIRECTORY='20261009000300_result_override_requests',SHA256='35ff44f0bd6b7b61289da296f1929d63a66f1c613d62836100923cd19e69bba9';
function loadResultOverrideMigrationSource(){
 const root=path.resolve(__dirname,'..',fs.existsSync('/.dockerenv')?'.migrations-backup/197':'prisma/migrations',DIRECTORY);
 let bytes;try{bytes=fs.readFileSync(path.join(root,'migration.sql'));}catch(cause){throw Object.assign(new Error('Override request DDL is unavailable.',{cause}),{code:'OVERRIDE_SOURCE_MISMATCH'});}
 if(createHash('sha256').update(bytes).digest('hex')!==SHA256)throw Object.assign(new Error('Override request DDL digest differs.'),{code:'OVERRIDE_SOURCE_MISMATCH'});
 const sql=bytes.toString('utf8'),boundary=sql.indexOf('-- Contract guards');
 return Object.freeze({sql,schemaSql:sql.slice(0,boundary),guardsSql:sql.slice(boundary),sha256:SHA256});
}
module.exports={loadResultOverrideMigrationSource};
