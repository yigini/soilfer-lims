"""Invoke the exact reviewed new startup build preparer once; no SSH or build."""
import datetime,json,pathlib,subprocess,sys
R=pathlib.Path(__file__).resolve().parents[2]
S=R/'WP/batch-build-stable-accounting-be837974-20261015'
D=S/'reviewed-package-preparation-6200145007-once'
P=S/'build-package-workflow-batch-build-be837974-20261015T190000Z'
assert not D.exists() and not P.exists();sys.path.insert(0,str(S))
from batch_build_contract import *
load=lambda n:json_exact((S/'actual-source-pass-6200145007-complete-publication-once'/n).read_bytes())
index=load('source-index-original.json');review=load('actual-source-review-original.json')
validate_source_review(review,index['head'],index)
require(index['head']=='4de3e334d8e498783a4cf20df4a5f93acfdbeb21' and review['id']==6200145007,'Exact actual source PASS required')
for n,v in index['files'].items():require(sha((S/n).read_bytes())==v['sha256'],'Executed source changed '+n)
D.mkdir()
def save(n,v):
 with (D/n).open('xb') as f:f.write(v)
argv=[sys.executable,'-B',str(S/'prepare_batch_build.py'),'--tooling-commit',index['head'],'--source-review-id',str(review['id']),'--root-name',FIRST_BUILD_ROOT_NAME]
save('command-original.json',(json.dumps({'startedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'argv':argv,'sourceReviewId':review['id'],'preparationInvocationCount':1,'neverReplay':True,'builds':0,'hostConnections':0},indent=2)+'\n').encode())
try:r=subprocess.run(argv,cwd=R,capture_output=True,timeout=180)
except subprocess.TimeoutExpired as e:
 save('stdout-partial.log',e.stdout or b'');save('stderr-partial.log',e.stderr or b'');raise
save('stdout-original.log',r.stdout);save('stderr-original.log',r.stderr)
save('exit-original.json',(json.dumps({'exitCode':r.returncode,'closedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'builds':0,'hostConnections':0})+'\n').encode())
require(r.returncode==0,'Preparation refused; retain originals, never replay')
require({p.name for p in P.iterdir()}==REQUIRED_ARTIFACTS,'Complete exact package required')
get=lambda n:json_exact((P/n).read_bytes())
spec=get('build-input.json');validate_spec(spec,get('tooling-source-index.json'),get('source-review-original.json'))
validate_capacity_files(spec,get('source-index.json'),{p.name:p.stat().st_size for p in P.iterdir() if p.name!='build-input.json'})
record={'status':'REVIEWED_STARTUP_BUILD_PACKAGE_PREPARED_NOT_LAUNCHED','package':str(P),'preparedUtc':spec['preparedUtc'],'root':str(safe_build_root(FIRST_BUILD_ROOT_NAME)),'toolingCommit':index['head'],'sourceReviewId':review['id'],'capacityPlan':spec['capacityPlan'],'requiredFreeBytesByPhase':{phase:capacity_requirement(spec['capacityPlan'],phase) for phase in ['before-root','before-unit','before-build']},'files':[{'name':p.name,'bytes':p.stat().st_size,'sha256':sha(p.read_bytes())} for p in sorted(P.iterdir())],'builds':0,'hostConnections':0}
save('package-validation.json',(json.dumps(record,indent=2)+'\n').encode())
print(json.dumps({k:v for k,v in record.items() if k not in ['files','capacityPlan']}))
