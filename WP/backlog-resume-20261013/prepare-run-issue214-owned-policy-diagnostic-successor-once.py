"""Retain the pre-fixture refusal and run one new explicitly isolated probe."""
import datetime,hashlib,json,os,subprocess,sys,uuid
from pathlib import Path
sys.stdout.reconfigure(encoding='utf-8')
root=Path(__file__).resolve().parents[2];wp=Path(__file__).parent
original=wp/'diagnose-issue214-ci-policy-prerequisite-owned-once.cjs'
successor=wp/'diagnose-issue214-ci-policy-prerequisite-owned-isolated-once.cjs'
dest=wp/'issue214-ci-policy-prerequisite-diagnostic-isolated-run'
assert not successor.exists() and not dest.exists()
first=wp/'issue214-ci-policy-prerequisite-diagnostic'
assert first.is_dir() and not list(first.iterdir())
frozen=json.loads((wp/'issue214-scanner-call-form-full/source-before.json').read_bytes())
assert len(frozen)==415 and all(hashlib.sha256((root/p).read_bytes()).hexdigest()==d for p,d in frozen.items())
successor.write_text(original.read_text(encoding='utf-8').replace("'issue214-ci-policy-prerequisite-diagnostic'","'issue214-ci-policy-prerequisite-diagnostic-isolated'"),encoding='utf-8')
dest.mkdir()
(dest/'first-pre-fixture-refusal-record.json').write_text(json.dumps({
 'observedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'helper':original.name,'exitCode':1,
 'code':'WORKFLOW_FIXTURE_REFUSED','message':'Workflow fixtures require an explicitly isolated database.',
 'boundary':'Before any fixture connection','cause':'DATABASE_PATH was not supplied','originalHelperPreserved':True,
 'rawStderrWasReturnedByTerminalNotCapturedToFile':True,'productionOperations':0},indent=2)+'\n',encoding='utf-8')
env=dict(os.environ,NODE_ENV='test')
context=root/'server/tests/.tmp'/('test_issue214_diagnostic_context_'+str(uuid.uuid4())+'.db')
assert context.parent.is_dir() and not context.exists()
env['DATABASE_PATH']=str(context);env['DATABASE_URL']='file:'+str(context)
args=['node',str(successor)]
(dest/'command-original.json').write_text(json.dumps({'argv':args,'cwd':str(root),
 'environment':{k:env[k] for k in ['NODE_ENV','DATABASE_PATH','DATABASE_URL']},'sourceFrozenCount':415,
 'productionOperations':0},indent=2)+'\n',encoding='utf-8')
with (dest/'stdout-original.log').open('wb') as out,(dest/'stderr-original.log').open('wb') as err:
 result=subprocess.run(args,cwd=root,env=env,stdout=out,stderr=err)
(dest/'exit-original.txt').write_text(str(result.returncode)+'\n')
unchanged=all(hashlib.sha256((root/p).read_bytes()).hexdigest()==d for p,d in frozen.items())
summary={'completedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'exitCode':result.returncode,
 'status':'PASS' if result.returncode==0 and unchanged else 'FAILED','sourceUnchanged':unchanged,'productionOperations':0}
(dest/'summary-original.json').write_text(json.dumps(summary,indent=2)+'\n',encoding='utf-8')
print(json.dumps(summary));sys.exit(result.returncode or (0 if unchanged else 1))
