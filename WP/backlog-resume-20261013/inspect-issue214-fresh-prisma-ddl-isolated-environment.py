import datetime, json, subprocess, sys, os
from pathlib import Path
sys.stdout.reconfigure(encoding='utf-8')
root=Path(__file__).resolve().parents[2];dest=Path(__file__).parent/'issue214-fresh-prisma-ddl-isolated-environment'
assert not dest.exists();dest.mkdir()
script=r'''
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),{randomUUID}=require('node:crypto'),Database=require('better-sqlite3');
const file=require('./tests/helpers/testOwnedDatabase').assertOwnedTestDatabase(path.resolve('tests/.tmp','installer_214_comparison_'+randomUUID()+'.db'),'system:fixture');
fs.closeSync(fs.openSync(file,'wx'));
const push=cp.spawnSync(process.execPath,['node_modules/prisma/build/index.js','db','push','--url','file:'+file.replace(/\\/g,'/')],{cwd:process.cwd(),encoding:'utf8'});
if(push.status!==0)throw Error(push.stdout+push.stderr);
const sql=require('./services/controlChartMigrationSource').loadControlChartMigrationSource().schemaSql;
const wanted=[...[...sql.matchAll(/^CREATE TABLE "([^"]+)"[\s\S]*?^\);/gm)],...[...sql.matchAll(/^CREATE (?:UNIQUE )?INDEX "([^"]+)"[^;]*;/gm)]];
const db=new Database(file,{readonly:true,fileMustExist:true});
try{console.log(JSON.stringify({file,inspectionUtc:new Date().toISOString(),prismaPush:push.stdout,objects:wanted.map(m=>({name:m[1],expected:m[0],actual:db.prepare('SELECT sql FROM sqlite_master WHERE name=?').get(m[1])?.sql}))},null,2));}finally{db.close();}
'''
(dest/'script-original.cjs').write_bytes(script.encode())
with (dest/'stdout-original.json').open('wb') as out,(dest/'stderr-original.log').open('wb') as err:
 result=subprocess.run(['node','-e',script],cwd=root/'server',env={**os.environ,'NODE_ENV':'test','DATABASE_PATH':str(root/'server/tests/.tmp/inspection-configured-isolated.db')},stdout=out,stderr=err)
(dest/'exit-original.txt').write_bytes((str(result.returncode)+'\n').encode())
assert result.returncode==0
data=json.loads((dest/'stdout-original.json').read_bytes())
for obj in data['objects']:
 if ''.join(obj['expected'].split()).rstrip(';')!=''.join((obj['actual']or'').split()).rstrip(';'): print(json.dumps(obj),flush=True)
print(json.dumps({'observedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'exit':0,'file':data['file'],'productionOperations':0}))
