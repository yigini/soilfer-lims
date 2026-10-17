"""ONCE NEW LOCAL native file-observation diagnostic, not qualification."""
from pathlib import Path
import subprocess,json,os,tempfile,hashlib,datetime
W=Path(__file__).resolve().parents[2];K=W/'WP/batch-release-kit-be837974-20261016';base=K/'statement-journal-local-retained-fixtures';base.mkdir(exist_ok=True);d=Path(tempfile.mkdtemp(prefix='diagnostic-',dir=base)).resolve();(d/'tmp').mkdir()
program=r"""const fs=require('node:fs'),os=require('node:os'),Database=require('better-sqlite3');
const dir=process.argv[1],tmp=dir+'/tmp',events=[],samples=[],db=new Database(dir+'/dev.db');
db.pragma('page_size=512');db.pragma('cache_size=4');db.exec('CREATE TABLE payload(id INTEGER PRIMARY KEY,value BLOB NOT NULL CHECK(length(value)>0))');
const put=db.prepare('INSERT INTO payload VALUES(?,?)');db.transaction(()=>{for(let i=1;i<=96;i++)put.run(i,Buffer.alloc(8192,i));})();
const watch=fs.watch(tmp,(event,name)=>events.push({event,name:name&&name.toString()}));let calls=0,inside;
db.function('sample',value=>{calls++;inside=db.inTransaction;for(const name of fs.readdirSync(tmp)){try{samples.push({name,bytes:fs.statSync(tmp+'/'+name).size});}catch(e){samples.push({name,error:e.code});}}const b=Buffer.from(value);b[0]^=1;return b;});
const info={platform:process.platform,tempStore:db.pragma('temp_store',{simple:true}),journalMode:db.pragma('journal_mode',{simple:true}),cache:db.pragma('cache_size',{simple:true}),osTmp:os.tmpdir(),envTmp:process.env.TMP,envTemp:process.env.TEMP,options:db.pragma('compile_options'),sourceId:db.prepare('SELECT sqlite_source_id() v').get().v};
db.transaction(()=>{db.prepare('UPDATE payload SET value=?').run(Buffer.alloc(8192,10));db.prepare('UPDATE payload SET value=sample(value)').run();}).immediate();
db.close();setTimeout(()=>{watch.close();process.stdout.write(JSON.stringify({info,calls,inside,events,samples,qualification:false,scientificOwnersExecuted:false}));},100);
"""
(d/'program-original.cjs.txt').write_text(program,encoding='utf8');env=dict(os.environ,TMP=str(d/'tmp'),TEMP=str(d/'tmp'),SQLITE_TMPDIR=str(d/'tmp'));began=datetime.datetime.now(datetime.timezone.utc).isoformat();r=subprocess.run(['node','-e',program,str(d)],cwd=W/'server',capture_output=True,env=env)
(d/'stdout-original.json').write_bytes(r.stdout);(d/'stderr-original.txt').write_bytes(r.stderr);meta={'startedUtc':began,'closedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'exitCode':r.returncode,'root':str(d),'hostCalls':0,'scientificOwnersExecuted':False,'isQualification':False,'stdoutSha256':hashlib.sha256(r.stdout).hexdigest()};(d/'diagnostic-command-original.json').write_text(json.dumps(meta,indent=2)+'\n',encoding='utf8');print(json.dumps(meta))
if r.returncode==0:
 v=json.loads(r.stdout);print(json.dumps({'info':{q:v['info'][q] for q in ('platform','tempStore','journalMode','cache','osTmp','envTmp','envTemp')},'calls':v['calls'],'inside':v['inside'],'events':v['events'],'sampleCount':len(v['samples'])}))
else:print(r.stderr.decode(errors='replace'))