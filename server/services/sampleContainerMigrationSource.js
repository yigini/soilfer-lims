const fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto');
const DIRECTORY='20261013000100_sample_containers';
const SHA256='2a239bf9b13820a151e3fcc3e81fc47142a34027ec0502c5c26acd42200254b4';
const mismatch=(message,cause)=>Object.assign(new Error(message,cause&&{cause}),{statusCode:409,code:'SAMPLE_CONTAINER_SOURCE_MISMATCH'});
function loadSampleContainerMigrationSource(){
 const root=path.resolve(__dirname,'..',fs.existsSync('/.dockerenv')?'.migrations-backup/206':'prisma/migrations',DIRECTORY);
 let bytes;try{bytes=fs.readFileSync(path.join(root,'migration.sql'));}catch(cause){throw mismatch('Sample container DDL is unavailable.',cause);}
 if(createHash('sha256').update(bytes).digest('hex')!==SHA256)throw mismatch('Sample container DDL digest differs.');
 const sql=bytes.toString('utf8'),boundary=sql.indexOf('-- Contract guards');
 if(boundary<0)throw mismatch('Sample container guard boundary differs.');
 const counter=sql.indexOf('CREATE TABLE "ContainerSequence"');
 if(counter<0||counter>=boundary)throw mismatch('Sample container counter boundary differs.');
 return Object.freeze({sql,schemaSql:sql.slice(0,boundary),prismaSql:sql.slice(0,counter),counterSql:sql.slice(counter,boundary),guardsSql:sql.slice(boundary),sha256:SHA256});
}
module.exports={loadSampleContainerMigrationSource};
