"""Invoke the exact source-approved launcher once; retain terminal or uncertain output."""
import datetime,json,pathlib,subprocess,sys
REPO=pathlib.Path(__file__).resolve().parents[2]
SOURCE=REPO/'WP/batch-release-cde8-20261014'
PACKAGE=SOURCE/'build-package-workflow-batch-build-cde8c889-20261014T221500Z'
DEST=SOURCE/'reviewed-python39-build-launch-execution-once'
assert not DEST.exists() and PACKAGE.is_dir()
sys.path.insert(0,str(SOURCE))
from batch_build_contract import *
index=json_exact((PACKAGE/'tooling-source-index.json').read_bytes());review=json_exact((PACKAGE/'source-review-original.json').read_bytes());spec=json_exact((PACKAGE/'build-input.json').read_bytes())
validate_spec(spec,index,review)
require(index['head']=='2afd192872ce38bfabbaf5c69404d0aa7e679123' and review['id']==6179940139,'Corrected actual source PASS required')
for n,row in index['files'].items():require(sha((SOURCE/n).read_bytes())==row['sha256'],'Executed current reviewed graph differs')
DEST.mkdir()
def save(n,raw):
    with (DEST/n).open('xb') as f:f.write(raw)
argv=[sys.executable,'-B',str(SOURCE/'launch_batch_build.py'),'--package',str(PACKAGE)]
save('command-original.json',(json.dumps({'argv':argv,'startedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'sourceReviewId':6179940139,'toolingCommit':index['head'],'launcherInvocationCount':1,'neverReplay':True,'productionConnections':0,'proofsLaunched':0,'productionDeployments':0},indent=2)+'\n').encode())
try:result=subprocess.run(argv,cwd=REPO,capture_output=True,timeout=600)
except subprocess.TimeoutExpired as e:
    save('stdout-partial.log',e.stdout or b'');save('stderr-partial.log',e.stderr or b'');save('uncertain-launch-outcome.json',b'{"status":"UNKNOWN_LAUNCH_OUTCOME_INSPECT_SAME_ROOT_UNIT","neverReplay":true}\n');raise
save('stdout-original.log',result.stdout);save('stderr-original.log',result.stderr)
save('exit-original.json',(json.dumps({'exitCode':result.returncode,'closedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'neverReplay':True,'buildComplete':False,'productionConnections':0})+'\n').encode())
require(result.returncode==0,'Launcher refused or uncertain; inspect same root/unit, never replay')
launch=json_exact((SOURCE/(PACKAGE.name+'-launch')/'launch-record.json').read_bytes())
require(launch['status']=='BUILD_UNIT_LAUNCHED_OBSERVE_SAME_UNIT' and launch['sourceReviewId']==6179940139 and launch['toolingCommit']==index['head'] and launch['root']==str(safe_build_root(FIRST_BUILD_ROOT_NAME)),'Actual launch receipt differs')
print(json.dumps({'status':launch['status'],'root':launch['root'],'unit':launch['unit'],'sourceReviewId':6179940139,'toolingCommit':index['head'],'verifiedUtc':launch['verifiedUtc'],'buildComplete':False,'productionConnections':0,'proofsLaunched':0,'productionDeployments':0}))
