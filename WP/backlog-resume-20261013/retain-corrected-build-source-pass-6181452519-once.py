"""Retain new exact corrected-accounting build-only PASS and full same-ID/timeout limits."""
import datetime,json,pathlib,subprocess,sys
REPO=pathlib.Path(__file__).resolve().parents[2]
SOURCE=REPO/'WP/batch-build-containerd-cde8-20261015'
DEST=SOURCE/'actual-source-pass-6181452519'
TOOLING='6608548a58dd4bf581da4330f1cd7b0f68a86973'
def cmd(*a):return subprocess.check_output(a,cwd=REPO)
assert cmd('git','rev-parse','HEAD').decode().strip()=='2c825b92a4b3ac51c647fb382d361562bac0608b' and not cmd('git','diff','--cached','--name-only').strip() and not DEST.exists()
sys.path.insert(0,str(SOURCE))
from batch_build_contract import *
from prepare_batch_build import raw_git,current_evidence
index={'head':TOOLING,'files':{}}
for n in sorted(SOURCE_FILES):
    raw,index['files'][n]=raw_git(TOOLING,'WP/batch-build-containerd-cde8-20261015/'+n);require(raw==(SOURCE/n).read_bytes(),'Actual reviewed source changed')
review_raw=cmd('gh','api','repos/yigini/soilfer-lims/issues/comments/6181452519');review=json_exact(review_raw);validate_source_review(review,TOOLING,index)
require(review['created_at']=='2026-10-15T00:22:14Z' and 'That is acceptable.' in review['body'] and 'That successor still needs its own exact-source PASS' in review['body'],'Full same-cache-ID and separately reviewed timeout successor conditions missing')
current=current_evidence();direction_raw=cmd('gh','api','repos/yigini/soilfer-lims/issues/comments/'+str(FALLBACK_DIRECTION_ID))
refs={n:raw_git(row['audit'],row['path'])[0] for n,row in REFERENCE_FILES.items()}
for n,raw in refs.items():require(sha(raw)==REFERENCE_FILES[n]['sha256'],'Original reference differs')
fallback_evidence(json_exact(direction_raw),json_exact(refs['original-build-failure.json']),json_exact(refs['metadata-analysis-original.json']))
history_raw=cmd('gh','api','--paginate','--slurp','repos/yigini/soilfer-lims/issues/162/comments?per_page=100');no_later_source_failure([v for p in json_exact(history_raw) for v in p],review,TOOLING)
DEST.mkdir()
def save(n,raw):
    with (DEST/n).open('xb') as f:f.write(raw)
for n,raw in {'actual-source-review-original.json':review_raw,'actual-source-review-readable.txt':review['body'].encode(),'source-index-original.json':(json.dumps(index,indent=2)+'\n').encode(),'actual-fallback-direction-original.json':direction_raw,'history-original.json':history_raw,**current,**refs}.items():save(n,raw)
save('independent-source-binding.json',(json.dumps({'status':'ACTUAL_CORRECTED_ACCOUNTING_BUILD_ONLY_PASS_VALIDATED','sourceReviewId':6181452519,'reviewUtc':review['created_at'],'toolingCommit':TOOLING,'newRoot':str(safe_build_root(FIRST_BUILD_ROOT_NAME)),'allFiveRawSourceHashesVerified':True,'ordinaryCacheSameImageIdAcceptedByActualReviewer':True,'originalFailureStillFailed':True,'oldResidualNotCredited':True,'currentMeasurementTimeoutSeconds':120,'onlyIfThisRunTimeouts300SecondsSuccessorInScopeButRequiresOwnExactSourcePass':True,'newBuildsLaunched':0,'proofLaunches':0,'productionDeployments':0,'productionDatabaseConnections':0,'validatedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat()},indent=2)+'\n').encode())
paths=sorted(p for p in DEST.iterdir() if p.is_file())+[pathlib.Path(__file__)]
readme=REPO/'WP/audit-release-eb6de2e8/README.md'
readme.write_bytes(('## 2026-10-15 actualCl corrected build-only SourcePASS6181452519\n\nActual00:22:14UTC SourcePASS binds6608548a/all5hashes/exact010000root/requiredcontainerdphysicalaccounting/120smeasurement/reduced1800build/unit2700/controller805Swap0/pins/floor4GiB500MBguard. Fullactualverdict/freshmainCI/all3audits/review/fallback/refanalysis at WP/batch-build-containerd-cde8-20261015/actual-source-pass-6181452519/index.json. ONLYone NEWbuild-only qualification authorized; no package/root/unit/build yet. ActualCl explicitly accepts normalcache SAMEimageID under newcorrectedaccounting/newseparatereceipt; old221500FAILED/oldresidualunproved remainunchanged/noadoption/retroPASS. If120smeasurementtimeouts preflight/newBuildCount0/consumedroot, onlyMEASUREMENT_TIMEOUT300 successor is pre-agreedSCOPE but needs its OWNexact-sourcePASS; do NOTalter/run current approvedsource or inferapproval. No proofkitgatedeploy/productionDB103/humanchanges.\n\n').encode()+readme.read_bytes());paths.append(readme)
idx=DEST/'index.json'
with idx.open('x',encoding='utf-8') as f:json.dump({'status':'ACTUAL_CORRECTED_ACCOUNTING_BUILD_ONLY_PASS_RETAINED','sourceReviewId':6181452519,'toolingCommit':TOOLING,'files':[{'path':p.relative_to(REPO).as_posix(),'bytes':p.stat().st_size,'sha256':sha(p.read_bytes())} for p in paths]},f,indent=2)
paths.append(idx);rels=[p.relative_to(REPO).as_posix() for p in paths]
for i in range(0,len(rels),15):cmd('git','-c','core.autocrlf=false','add','-f','--',*rels[i:i+15])
require(set(cmd('git','diff','--cached','--name-only').decode().splitlines())==set(rels),'Staged owner differs')
tree=cmd('git','write-tree').decode().strip()
for p,rel in zip(paths,rels):require(raw_git(tree,rel)[0]==p.read_bytes(),'Raw staged bytes differ')
cmd('git','commit','-m','Retain actual corrected accounting build source PASS and same-cache-ID qualification')
head=cmd('git','rev-parse','HEAD').decode().strip()
for p,rel in zip(paths,rels):require(raw_git(head,rel)[0]==p.read_bytes(),'Raw committed bytes differ')
cmd('git','push','origin','audit/release-eb6de2e8');require(cmd('git','ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head,'Pushed audit differs')
print(json.dumps({'status':'PUSHED_ACTUAL_CORRECTED_BUILD_ONLY_SOURCE_PASS','head':head,'verifiedBlobs':len(paths),'sourceReviewId':6181452519,'toolingCommit':TOOLING,'newBuildsLaunched':0}))
