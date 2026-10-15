"""Invoke exact approved new build preparer once; retain output, never launch a build here."""
import datetime,json,pathlib,subprocess,sys
REPO=pathlib.Path(__file__).resolve().parents[2]
SOURCE=REPO/'WP/batch-build-containerd-cde8-20261015'
DEST=SOURCE/'reviewed-package-preparation-once'
PACKAGE=SOURCE/'build-package-workflow-batch-build-cde8c889-20261015T010000Z'
assert not DEST.exists() and not PACKAGE.exists();sys.path.insert(0,str(SOURCE))
from batch_build_contract import *
index=json_exact((SOURCE/'actual-source-pass-6181452519/source-index-original.json').read_bytes());review=json_exact((SOURCE/'actual-source-pass-6181452519/actual-source-review-original.json').read_bytes())
validate_source_review(review,index['head'],index);require(index['head']=='6608548a58dd4bf581da4330f1cd7b0f68a86973' and review['id']==6181452519,'Actual exact reviewed new graph required')
for n,v in index['files'].items():require(sha((SOURCE/n).read_bytes())==v['sha256'],'Executed source changed')
DEST.mkdir()
def save(n,raw):
    with (DEST/n).open('xb') as f:f.write(raw)
argv=[sys.executable,'-B',str(SOURCE/'prepare_batch_build.py'),'--tooling-commit',index['head'],'--source-review-id',str(review['id']),'--root-name',FIRST_BUILD_ROOT_NAME]
save('command-original.json',(json.dumps({'startedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'argv':argv,'sourceReviewId':review['id'],'preparationCount':1,'neverReplay':True,'newBuildCount':0},indent=2)+'\n').encode())
try:r=subprocess.run(argv,cwd=REPO,capture_output=True,timeout=120)
except subprocess.TimeoutExpired as e:
    save('stdout-partial.log',e.stdout or b'');save('stderr-partial.log',e.stderr or b'');raise
save('stdout-original.log',r.stdout);save('stderr-original.log',r.stderr);save('exit-original.json',(json.dumps({'exitCode':r.returncode,'closedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'newBuildCount':0})+'\n').encode())
require(r.returncode==0,'Preparation refused; inspect original files, never replay')
require({p.name for p in PACKAGE.iterdir()}==REQUIRED_ARTIFACTS and len(REQUIRED_ARTIFACTS)==24,'Complete24file package required')
load=lambda n:json_exact((PACKAGE/n).read_bytes());validate_spec(load('build-input.json'),load('tooling-source-index.json'),load('source-review-original.json'))
fallback_evidence(load('fallback-direction-original.json'),load('original-build-failure.json'),load('metadata-analysis-original.json'))
for n,v in index['files'].items():require(sha((PACKAGE/n).read_bytes())==v['sha256'],'Prepared raw source changed')
record={'status':'PREPARED_REVIEWED_CORRECTED_ACCOUNTING_BUILD_PACKAGE_NOT_LAUNCHED','preparedUtc':load('build-input.json')['preparedUtc'],'package':str(PACKAGE),'root':str(safe_build_root(FIRST_BUILD_ROOT_NAME)),'toolingCommit':index['head'],'sourceReviewId':review['id'],'newBuildCount':0,'files':[{'name':p.name,'bytes':p.stat().st_size,'sha256':sha(p.read_bytes())} for p in sorted(PACKAGE.iterdir())]}
save('package-validation.json',(json.dumps(record,indent=2)+'\n').encode());print(json.dumps({k:v for k,v in record.items() if k!='files'}))
