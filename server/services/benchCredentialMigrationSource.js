const fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto');
const DIRECTORY='20261010000300_bench_credentials';
const SHA256='954639ef2839b158cf19f827adad0fbae6a973e1491ace2b352415957afc4a2b';
const mismatch=(message,cause)=>Object.assign(new Error(message,cause&&{cause}),{statusCode:409,code:'BENCH_CREDENTIAL_SOURCE_MISMATCH'});
function loadBenchCredentialMigrationSource(){
 const root=path.resolve(__dirname,'..',fs.existsSync('/.dockerenv')?'.migrations-backup/202':'prisma/migrations',DIRECTORY);
 let bytes;try{bytes=fs.readFileSync(path.join(root,'migration.sql'));}catch(cause){throw mismatch('Bench credential DDL is unavailable.',cause);}
 if(createHash('sha256').update(bytes).digest('hex')!==SHA256)throw mismatch('Bench credential DDL digest differs.');
 const sql=bytes.toString('utf8'),table=sql.match(/^CREATE TABLE "UserBenchCredential"[\s\S]*?^\);/m);
 if(!table)throw mismatch('Bench credential table definition differs.');
 return Object.freeze({sql,tableSql:table[0],sha256:SHA256});
}
module.exports={loadBenchCredentialMigrationSource};
