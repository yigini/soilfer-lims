const fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto');
const DIRECTORY='20261024000100_signin_protection';
const SHA256='80b70b997a54824fe2e37da30fc2bce104b7ea963e722c102bde1da29f24667b';
const mismatch=(message,cause)=>Object.assign(new Error(message,cause&&{cause}),{statusCode:409,code:'SIGNIN_SOURCE_MISMATCH'});
function loadSignInMigrationSource(){
 const root=path.resolve(__dirname,'..',fs.existsSync('/.dockerenv')?'.migrations-backup/338':'prisma/migrations',DIRECTORY);
 let bytes;try{bytes=fs.readFileSync(path.join(root,'migration.sql'));}catch(cause){throw mismatch('Sign-in DDL is unavailable.',cause);}
 if(createHash('sha256').update(bytes).digest('hex')!==SHA256)throw mismatch('Sign-in DDL digest differs.');
 const sql=bytes.toString('utf8'),table=sql.match(/^CREATE TABLE "AuthLoginState"[\s\S]*?^\);/m);
 if(!table)throw mismatch('Sign-in table definition differs.');
 return Object.freeze({sql,tableSql:table[0],sha256:SHA256});
}
module.exports={loadSignInMigrationSource};
