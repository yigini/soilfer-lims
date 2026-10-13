
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),{randomUUID}=require('node:crypto'),Database=require('better-sqlite3');
const file=require('./tests/helpers/testOwnedDatabase').assertOwnedTestDatabase(path.resolve('tests/.tmp','installer_214_comparison_'+randomUUID()+'.db'),'system:fixture');
fs.closeSync(fs.openSync(file,'wx'));
const push=cp.spawnSync(process.execPath,['node_modules/prisma/build/index.js','db','push','--url','file:'+file.replace(/\\/g,'/')],{cwd:process.cwd(),encoding:'utf8'});
if(push.status!==0)throw Error(push.stdout+push.stderr);
const sql=require('./services/controlChartMigrationSource').loadControlChartMigrationSource().schemaSql;
const wanted=[...[...sql.matchAll(/^CREATE TABLE "([^"]+)"[\s\S]*?^\);/gm)],...[...sql.matchAll(/^CREATE (?:UNIQUE )?INDEX "([^"]+)"[^;]*;/gm)]];
const db=new Database(file,{readonly:true,fileMustExist:true});
try{console.log(JSON.stringify({file,inspectionUtc:new Date().toISOString(),prismaPush:push.stdout,objects:wanted.map(m=>({name:m[1],expected:m[0],actual:db.prepare('SELECT sql FROM sqlite_master WHERE name=?').get(m[1])?.sql}))},null,2));}finally{db.close();}
