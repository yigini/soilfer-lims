"""Run the reviewed local package preparer once and retain its exact terminal output."""
import datetime,hashlib,json,pathlib,subprocess,sys
REPO=pathlib.Path(__file__).resolve().parents[2]
SOURCE=REPO/'WP/batch-release-cde8-20261014'
DEST=SOURCE/'reviewed-python39-package-preparation-once'
PACKAGE=SOURCE/'build-package-workflow-batch-build-cde8c889-20261014T221500Z'
assert not DEST.exists() and not PACKAGE.exists()
sys.path.insert(0,str(SOURCE))
from batch_build_contract import *
index=json_exact((SOURCE/'actual-build-python39-source-pass-6179940139/source-index-original.json').read_bytes())
review=json_exact((SOURCE/'actual-build-python39-source-pass-6179940139/source-review-original.json').read_bytes())
validate_source_review(review,'2afd192872ce38bfabbaf5c69404d0aa7e679123',index)
for n,row in index['files'].items():require(sha((SOURCE/n).read_bytes())==row['sha256'],'Executed current graph differs')
DEST.mkdir()
def save(n,raw):
    with (DEST/n).open('xb') as f:f.write(raw)
argv=[sys.executable,'-B',str(SOURCE/'prepare_batch_build.py'),'--tooling-commit',index['head'],'--source-review-id','6179940139','--root-name',FIRST_BUILD_ROOT_NAME]
save('command-original.json',(json.dumps({'argv':argv,'startedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'reviewId':6179940139,'toolingCommit':index['head'],'preparationCount':1,'buildsLaunched':0,'productionConnections':0,'neverReplay':True},indent=2)+'\n').encode())
try:result=subprocess.run(argv,cwd=REPO,capture_output=True,timeout=120)
except subprocess.TimeoutExpired as e:
    save('stdout-partial.log',e.stdout or b'');save('stderr-partial.log',e.stderr or b'');save('uncertain-local-package.json',b'{"status":"UNKNOWN_LOCAL_PREPARATION_OUTCOME","neverReplay":true}\n');raise
save('stdout-original.log',result.stdout);save('stderr-original.log',result.stderr)
save('exit-original.json',(json.dumps({'exitCode':result.returncode,'closedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'buildsLaunched':0,'productionConnections':0})+'\n').encode())
require(result.returncode==0,'Package preparation failed; inspect originals, never replay')
require({p.name for p in PACKAGE.iterdir()}==REQUIRED_ARTIFACTS and all(p.is_file() and not p.is_symlink() for p in PACKAGE.iterdir()),'Prepared package inventory differs')
spec=json_exact((PACKAGE/'build-input.json').read_bytes());actual_index=json_exact((PACKAGE/'tooling-source-index.json').read_bytes());actual_review=json_exact((PACKAGE/'source-review-original.json').read_bytes())
validate_spec(spec,actual_index,actual_review)
require(canonical(actual_index)==canonical(index) and canonical(actual_review)==canonical(review),'Prepared source/review differs')
for n,row in index['files'].items():require(sha((PACKAGE/n).read_bytes())==row['sha256'],'Prepared source bytes differ')
require(sha((PACKAGE/'source.tar.gz').read_bytes())==spec['archiveSha256'] and sha((PACKAGE/'source-index.json').read_bytes())==spec['applicationIndexSha256'],'Prepared archive/index differs')
require(spec['archiveSha256']=='6c54dbed48f4aab4d36286dd5e2a921587c1adae51fc4856f53cd321cf86144a','Archive constructor/source output changed')
record={'status':'PREPARED_REVIEWED_FIRST_BUILD_PACKAGE_NOT_LAUNCHED','preparedUtc':spec['preparedUtc'],'toolingCommit':index['head'],'sourceReviewId':6179940139,'package':str(PACKAGE),'root':str(safe_build_root(FIRST_BUILD_ROOT_NAME)),'packageFiles':[{'name':p.name,'bytes':p.stat().st_size,'sha256':sha(p.read_bytes())} for p in sorted(PACKAGE.iterdir())],'buildsLaunched':0,'productionConnections':0,'proofLaunches':0,'productionDeployments':0}
save('prepared-package-validation.json',(json.dumps(record,indent=2)+'\n').encode());print(json.dumps({k:v for k,v in record.items() if k!='packageFiles'}))
