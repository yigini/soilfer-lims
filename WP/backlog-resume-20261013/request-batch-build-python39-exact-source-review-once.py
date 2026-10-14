"""One new exact-source review for the verified actual-host timestamp correction."""
import datetime,json,pathlib,subprocess,sys
REPO=pathlib.Path(__file__).resolve().parents[2]
SOURCE=REPO/'WP/batch-release-cde8-20261014'
TOOLING='2afd192872ce38bfabbaf5c69404d0aa7e679123'
DEST=SOURCE/'build-only-python39-source-review-request-2afd1928'
def cmd(*args):return subprocess.check_output(args,cwd=REPO)
assert not DEST.exists() and cmd('git','rev-parse','HEAD').decode().strip()==TOOLING
assert cmd('git','ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==TOOLING
sys.path.insert(0,str(SOURCE))
from batch_build_contract import *
from prepare_batch_build import raw_git,current_evidence
index={'head':TOOLING,'files':{}}
for n in sorted(SOURCE_FILES):
    raw,index['files'][n]=raw_git(TOOLING,'WP/batch-release-cde8-20261014/'+n)
    require(raw==(SOURCE/n).read_bytes(),'Published current source differs')
fresh=current_evidence()
history=cmd('gh','api','--paginate','--slurp','repos/yigini/soilfer-lims/issues/162/comments?per_page=100')
require(not any(TOOLING in v.get('body','') for p in json_exact(history) for v in p),'New source already has a notice/review; inspect')
links='\n'.join('- ['+n+'](https://github.com/yigini/soilfer-lims/blob/'+TOOLING+'/WP/batch-release-cde8-20261014/'+n+')' for n in sorted(SOURCE_FILES))
body='''Claudio: NEW successor build-only source review for actual host Python3.9, #206+#214+#209.

Your actual Source review PASS6179796996 on9ef893b3 is retained unchanged. The subsequent independent read-only host probe found Python3.9.23, lacking datetime.UTC but supporting backported tarfile extraction filters. It refused BEFORE any package, root, unit or build; first221500Z root is still ABSENT/unitnot-found and zero Docker builds were attempted. [Original actual PASS and refused host probe](https://github.com/yigini/soilfer-lims/blob/e4e835e8c54b111f079ca0d80e13f87318f90bb8/WP/batch-release-cde8-20261014/actual-build-source-pass-6179796996/index.json).

Please independently review NEW exact tooling source '''+TOOLING+'''. The ONLY graph delta from9ef is two timestamp calls in batch_build.py: datetime.UTC becomes datetime.timezone.utc. The four other graph files, scope/root/disk/lifetime/archive/YY pins are byte-identical. No application source changes, no production connection/count/build/proof/kit/gate/deploy, and no prior build replay. The old9ef source must not launch; this requires your NEW exact graph PASS before the unchanged first build.

'''+links+'''

[Scope and correction](https://github.com/yigini/soilfer-lims/blob/'''+TOOLING+'''/WP/batch-release-cde8-20261014/build-source-python39-review-ready.md) and [closed actual-host verification](https://github.com/yigini/soilfer-lims/blob/'''+TOOLING+'''/WP/batch-release-cde8-20261014/build-python39-source-host-verification-once/exit-original.json).

New closed verification:14 local and14 actual-host pure guard tests PASS. All five exact source blobs compile in actual Python3.9.23 in memory; datetime.timezone.utc and tar extract filter supported. No remote source file written or builder/main function executed. All five source hashes unchanged; narrow delta proves only the two calls changed. Prior actual1561rawGit archive verification remains applicable with unchanged candidate/preparer/archive contract. All earlier refusals/approved source/original archives remain immutable.

Candidate cde8c8896f5f9d5f1ab07b0ae16b1a765e0a6367/tree638580d50f61254609de3abd42d93afc676a5727/mainCI38636615469 attempt1 CLOSED SUCCESS370/5649/all370inventory/all realDocker. Actual appPASS PR2956146939836/PR2966163165778/PR2976178123314 and merges unchanged. Only one build-only package/root/unit/stock Docker build: ZERO DBconnection/volume/impact/proof/deploy, fixed firstroot, bothYYpins, floor+4GiB, signed per-filesystem ownedroot/disjointDocker growth<500MB, build2400/unit2700. Fresh approvals/main/CI/laterfailures before upload and again immediately before launch; exclusive intents/unknown outcome NEVERreplay. A unit closing without a receipt/failurefile requires journal inspection and never replay.

Future stopped production-copy proof, actual policyPRESENT/NO_OP0orSTOP,214 chart and unstarted-unbound servedLRM counts,209 causes/approved lists/invalidStoredAnalysisSampleCount+sample/ownerIDs and every retained allocation need separate source review. NonzeroYY/approvednonzeroSTOP/separate reviewed forward remedy; no amendment-side order/backfill/relink/normalizer change. Final exact-kit review/fresh gate before production. #103 no connection/APPLYGO; historical#200 helpers/roots consumed.

If approved, please start your NEW verdict with `Source review: PASS` and include all these full literal bindings:

```
'''+ '\n'.join(review_tokens(TOOLING,index))+'\n```\n'
DEST.mkdir()
def save(n,raw):
    with (DEST/n).open('xb') as f:f.write(raw)
save('source-index-original.json',(json.dumps(index,indent=2)+'\n').encode());save('request-body-actual.txt',body.encode());save('comments-before-original.json',history)
for n,raw in fresh.items():save(n,raw)
payload=(json.dumps({'body':body},ensure_ascii=False)+'\n').encode();save('request-payload-original.json',payload)
save('post-intent.json',(json.dumps({'status':'POST_ATTEMPTED_ONCE','toolingCommit':TOOLING,'startedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'neverRetry':True,'buildsLaunched':0,'productionOperations':0})+'\n').encode())
try:
    result=subprocess.run(['gh','api','--method','POST','repos/yigini/soilfer-lims/issues/162/comments','--input','-'],cwd=REPO,input=payload,capture_output=True,timeout=60)
    save('post-response-original.json',result.stdout);save('post-stderr-original.txt',result.stderr)
    actual=json_exact(result.stdout) if result.returncode==0 else None
except subprocess.TimeoutExpired as error:
    save('post-response-partial.txt',error.stdout or b'');save('post-stderr-partial.txt',error.stderr or b'');actual=None
if actual is None:
    after=cmd('gh','api','--paginate','--slurp','repos/yigini/soilfer-lims/issues/162/comments?per_page=100');save('post-reconcile-original.json',after)
    matches=[v for p in json_exact(after) for v in p if v.get('body')==body]
    require(len(matches)==1,'Unknown source request outcome; never repost');actual=matches[0]
require(actual['body']==body and actual['html_url']=='https://github.com/yigini/soilfer-lims/issues/162#issuecomment-'+str(actual['id']),'Posted source request differs')
save('actual-request-confirmed.json',(json.dumps(actual,indent=2,ensure_ascii=False)+'\n').encode())
print(json.dumps({'status':'NEW_PYTHON39_BUILD_ONLY_SOURCE_REVIEW_POSTED_ONCE','id':actual['id'],'url':actual['html_url'],'createdUtc':actual['created_at'],'source':TOOLING,'buildsLaunched':0,'productionOperations':0}))
