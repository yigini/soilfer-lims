"""Invoke exact reviewed new build launcher once; never retry an uncertain outcome."""
import datetime,json,pathlib,subprocess,sys
R=pathlib.Path(__file__).resolve().parents[2]
S=R/'WP/batch-build-stable-accounting-be837974-20261015'
P=S/'build-package-workflow-batch-build-be837974-20261015T190000Z'
D=S/'reviewed-launch-execution-6200145007-once'
assert not D.exists() and P.is_dir();sys.path.insert(0,str(S))
from batch_build_contract import *
load=lambda n:json_exact((P/n).read_bytes())
spec,index,review=[load(n) for n in ['build-input.json','tooling-source-index.json','source-review-original.json']]
validate_spec(spec,index,review)
require(index['head']=='4de3e334d8e498783a4cf20df4a5f93acfdbeb21' and review['id']==6200145007,'Exact actual graph required')
for n,v in index['files'].items():require(sha((S/n).read_bytes())==v['sha256'],'Executed source changed '+n)
D.mkdir()
def save(n,v):
 with (D/n).open('xb') as f:f.write(v)
argv=[sys.executable,'-B',str(S/'launch_batch_build.py'),'--package',str(P)]
save('command-original.json',(json.dumps({'startedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'argv':argv,'sourceReviewId':review['id'],'launcherInvocationCount':1,'neverReplay':True,'buildCompletionClaimed':False},indent=2)+'\n').encode())
try:r=subprocess.run(argv,cwd=R,capture_output=True,timeout=360)
except subprocess.TimeoutExpired as e:
 save('stdout-partial.log',e.stdout or b'');save('stderr-partial.log',e.stderr or b'');save('uncertain-outcome.json',b'{"status":"UNKNOWN_NEW_BUILD_LAUNCH_OUTCOME","neverReplay":true}\n');raise
save('stdout-original.log',r.stdout);save('stderr-original.log',r.stderr)
save('exit-original.json',(json.dumps({'exitCode':r.returncode,'closedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'buildCompletionClaimed':False,'neverReplay':True})+'\n').encode())
require(r.returncode==0,'Launch refused or unknown; inspect same root/unit, never replay')
record=json_exact((S/(P.name+'-launch')/'launch-record.json').read_bytes())
require(record['status']=='BUILD_UNIT_LAUNCHED_OBSERVE_SAME_UNIT' and record['sourceReviewId']==review['id'] and record['root']==str(safe_build_root(FIRST_BUILD_ROOT_NAME)),'Actual launch record differs')
print(json.dumps({k:record[k] for k in ['status','root','unit','sourceReviewId','toolingCommit','verifiedUtc']}))
