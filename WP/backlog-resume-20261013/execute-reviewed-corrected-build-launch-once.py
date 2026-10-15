"""Invoke exact approved corrected build launcher once; unknown outcome requires same-unit inspection."""
import datetime,json,pathlib,subprocess,sys
REPO=pathlib.Path(__file__).resolve().parents[2]
SOURCE=REPO/'WP/batch-build-containerd-cde8-20261015'
PACKAGE=SOURCE/'build-package-workflow-batch-build-cde8c889-20261015T010000Z'
DEST=SOURCE/'reviewed-launch-execution-once'
assert not DEST.exists() and PACKAGE.is_dir();sys.path.insert(0,str(SOURCE))
from batch_build_contract import *
load=lambda n:json_exact((PACKAGE/n).read_bytes());spec,index,review=[load(n) for n in ['build-input.json','tooling-source-index.json','source-review-original.json']]
validate_spec(spec,index,review);require(index['head']=='6608548a58dd4bf581da4330f1cd7b0f68a86973' and review['id']==6181452519,'Actual exact corrected-build graph required')
for n,v in index['files'].items():require(sha((SOURCE/n).read_bytes())==v['sha256'],'Executed source changed')
DEST.mkdir()
def save(n,raw):
    with (DEST/n).open('xb') as f:f.write(raw)
argv=[sys.executable,'-B',str(SOURCE/'launch_batch_build.py'),'--package',str(PACKAGE)]
save('command-original.json',(json.dumps({'startedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'argv':argv,'sourceReviewId':review['id'],'launcherInvocationCount':1,'neverReplay':True,'captureComplete':False},indent=2)+'\n').encode())
try:r=subprocess.run(argv,cwd=REPO,capture_output=True,timeout=300)
except subprocess.TimeoutExpired as e:
    save('stdout-partial.log',e.stdout or b'');save('stderr-partial.log',e.stderr or b'');save('uncertain-outcome.json',b'{"status":"UNKNOWN_NEW_BUILD_LAUNCH_OUTCOME","neverReplay":true}\n');raise
save('stdout-original.log',r.stdout);save('stderr-original.log',r.stderr);save('exit-original.json',(json.dumps({'exitCode':r.returncode,'closedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'captureComplete':False,'neverReplay':True})+'\n').encode())
require(r.returncode==0,'Launch refused or unknown; inspect same root/unit, never replay')
record=json_exact((SOURCE/(PACKAGE.name+'-launch')/'launch-record.json').read_bytes())
require(record['status']=='BUILD_UNIT_LAUNCHED_OBSERVE_SAME_UNIT' and record['sourceReviewId']==review['id'] and record['root']==str(safe_build_root(FIRST_BUILD_ROOT_NAME)),'Actual launch record differs')
print(json.dumps({k:record[k] for k in ['status','root','unit','sourceReviewId','toolingCommit','verifiedUtc']}))
