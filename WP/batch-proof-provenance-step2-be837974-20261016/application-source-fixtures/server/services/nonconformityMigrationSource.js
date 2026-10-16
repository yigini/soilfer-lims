const fs=require('node:fs'),path=require('node:path');
const {createHash}=require('node:crypto');
const DIRECTORY='20261009000100_nonconformity_reports';
const SHA256='3b52e666a829449062b700948d9ccb6ccedb562b631509590f9a8b7cc8b94c47';
function loadNonconformityMigrationSource() {
    const root=path.resolve(__dirname,'..',fs.existsSync('/.dockerenv')?'.migrations-backup/193':'prisma/migrations',DIRECTORY);
    const fail=cause=>Object.assign(new Error('The NCR release DDL is unavailable or differs from its reviewed digest.',{cause}),{code:'NCR_SOURCE_MISMATCH'});
    let bytes;try{bytes=fs.readFileSync(path.join(root,'migration.sql'));}catch(cause){throw fail(cause);}
    if(createHash('sha256').update(bytes).digest('hex')!==SHA256)throw fail();
    const sql=bytes.toString('utf8'),boundary=sql.indexOf('CREATE TRIGGER');
    if(boundary<0)throw fail();
    return Object.freeze({sql,schemaSql:sql.slice(0,boundary),guardsSql:sql.slice(boundary),sha256:SHA256});
}
module.exports={loadNonconformityMigrationSource};
