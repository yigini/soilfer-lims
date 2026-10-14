"""Run the exact reviewed metadata package preparer once, with original output capture."""
import datetime,json,pathlib,subprocess,sys
REPO=pathlib.Path(__file__).resolve().parents[2]
SOURCE=REPO/'WP/batch-forward-metadata-cde8-20261014'
DEST=SOURCE/'reviewed-package-preparation-once'
PACKAGE=SOURCE/'metadata-package-workflow-batch-forward-metadata-cde8c889-20261014T233000Z'
assert not DEST.exists() and not PACKAGE.exists();sys.path.insert(0,str(SOURCE))
from forward_metadata_contract import *
index=exact_json((SOURCE/'actual-source-pass-6180876636/source-index-original.json').read_bytes());review=exact_json((SOURCE/'actual-source-pass-6180876636/actual-source-review-original.json').read_bytes());source_review(review,index)
for n,v in index['files'].items():require(sha((SOURCE/n).read_bytes())==v['sha256'],'Executed reviewed source changed')
DEST.mkdir()
def save(n,raw):
    with (DEST/n).open('xb') as f:f.write(raw)
argv=[sys.executable,'-B',str(SOURCE/'prepare_forward_metadata.py'),'--tooling-commit',index['head'],'--source-review-id','6180876636']
save('command-original.json',(json.dumps({'startedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'argv':argv,'sourceReviewId':6180876636,'preparationCount':1,'neverReplay':True,'imageEligibility':False},indent=2)+'\n').encode())
try:r=subprocess.run(argv,cwd=REPO,capture_output=True,timeout=120)
except subprocess.TimeoutExpired as e:
    save('stdout-partial.log',e.stdout or b'');save('stderr-partial.log',e.stderr or b'');raise
save('stdout-original.log',r.stdout);save('stderr-original.log',r.stderr);save('exit-original.json',(json.dumps({'exitCode':r.returncode,'closedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'imageEligibility':False,'metadataCollectorsRun':0})+'\n').encode())
require(r.returncode==0,'Preparation failed; inspect exact original files, never replay')
require({p.name for p in PACKAGE.iterdir()}==REQUIRED,'Prepared package inventory differs')
load=lambda n:exact_json((PACKAGE/n).read_bytes())
validate_spec(load('metadata-input.json'),load('tooling-source-index.json'),load('source-review-original.json'),load('scope-direction-original.json'),load('reference-direction-original.json'))
for n,v in index['files'].items():require(sha((PACKAGE/n).read_bytes())==v['sha256'],'Prepared raw source changed')
record={'status':'PREPARED_REVIEWED_METADATA_PACKAGE_NOT_LAUNCHED','preparedUtc':load('metadata-input.json')['preparedUtc'],'package':str(PACKAGE),'root':str(safe_root(ROOT_NAME)),'toolingCommit':index['head'],'sourceReviewId':6180876636,'imageEligibility':False,'metadataCollectorsRun':0,'newReceipts':0,'files':[{'name':p.name,'bytes':p.stat().st_size,'sha256':sha(p.read_bytes())} for p in sorted(PACKAGE.iterdir())]}
save('package-validation.json',(json.dumps(record,indent=2)+'\n').encode());print(json.dumps({k:v for k,v in record.items() if k!='files'}))
