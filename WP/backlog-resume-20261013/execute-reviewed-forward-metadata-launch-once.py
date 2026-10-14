"""Invoke the source-approved metadata launcher once and retain exact output, never replay."""
import datetime,json,pathlib,subprocess,sys
REPO=pathlib.Path(__file__).resolve().parents[2]
SOURCE=REPO/'WP/batch-forward-metadata-cde8-20261014'
PACKAGE=SOURCE/'metadata-package-workflow-batch-forward-metadata-cde8c889-20261014T233000Z'
DEST=SOURCE/'reviewed-launch-execution-once'
assert not DEST.exists() and PACKAGE.is_dir();sys.path.insert(0,str(SOURCE))
from forward_metadata_contract import *
load=lambda n:exact_json((PACKAGE/n).read_bytes())
spec,index,review,scope,reference=[load(n) for n in ['metadata-input.json','tooling-source-index.json','source-review-original.json','scope-direction-original.json','reference-direction-original.json']]
validate_spec(spec,index,review,scope,reference);require(review['id']==6180876636 and index['head']=='0b01804f9d409d74a19472c22469824e2df95005','Actual reviewed metadata graph required')
for n,v in index['files'].items():require(sha((SOURCE/n).read_bytes())==v['sha256'],'Executed source changed')
DEST.mkdir()
def save(n,raw):
    with (DEST/n).open('xb') as f:f.write(raw)
argv=[sys.executable,'-B',str(SOURCE/'launch_forward_metadata.py'),'--package',str(PACKAGE)]
save('command-original.json',(json.dumps({'startedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'argv':argv,'sourceReviewId':6180876636,'launcherInvocationCount':1,'neverReplay':True,'imageEligibility':False,'newReceipts':0},indent=2)+'\n').encode())
try:r=subprocess.run(argv,cwd=REPO,capture_output=True,timeout=300)
except subprocess.TimeoutExpired as e:
    save('stdout-partial.log',e.stdout or b'');save('stderr-partial.log',e.stderr or b'');save('uncertain-outcome.json',b'{"status":"UNKNOWN_METADATA_LAUNCH_OUTCOME","neverReplay":true}\n');raise
save('stdout-original.log',r.stdout);save('stderr-original.log',r.stderr);save('exit-original.json',(json.dumps({'exitCode':r.returncode,'closedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'captureComplete':False,'imageEligibility':False,'neverReplay':True})+'\n').encode())
require(r.returncode==0,'Launch refused or uncertain; inspect same root/unit, never replay')
record=exact_json((SOURCE/(PACKAGE.name+'-launch')/'launch-record.json').read_bytes())
require(record['status']=='READONLY_METADATA_UNIT_LAUNCHED_OBSERVE_SAME' and record['sourceReviewId']==6180876636 and record['root']==str(safe_root(ROOT_NAME)),'Actual metadata launch record differs')
print(json.dumps({k:record[k] for k in ['status','root','unit','sourceReviewId','toolingCommit','verifiedUtc','imageEligibility']}))
