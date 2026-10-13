const fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto');
const DIRECTORY='20261013000200_control_charts',SHA256='49b378296a8a0ede3318ae1e543060478b55827db0ec981d8cc4bd6180a56df6';
function loadControlChartMigrationSource(){
 const root=path.resolve(__dirname,'..',fs.existsSync('/.dockerenv')?'.migrations-backup/214':'prisma/migrations',DIRECTORY);
 let bytes;try{bytes=fs.readFileSync(path.join(root,'migration.sql'));}catch(cause){throw Object.assign(new Error('Control chart DDL unavailable.',{cause}),{statusCode:409,code:'QC_CHART_SOURCE_MISMATCH'});}
 if(createHash('sha256').update(bytes).digest('hex')!==SHA256)throw Object.assign(new Error('Control chart DDL digest differs.'),{statusCode:409,code:'QC_CHART_SOURCE_MISMATCH'});
 const sql=bytes.toString('utf8'),boundary=sql.indexOf('-- Contract guards');
 if(boundary<0)throw Object.assign(new Error('Control chart guard boundary differs.'),{statusCode:409,code:'QC_CHART_SOURCE_MISMATCH'});
 return Object.freeze({sql,schemaSql:sql.slice(0,boundary),guardsSql:sql.slice(boundary),sha256:SHA256});
}
module.exports={loadControlChartMigrationSource};
