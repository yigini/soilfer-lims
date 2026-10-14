"""One concrete Claudio build-only source review request; never retry a remote POST."""
import datetime, hashlib, json, pathlib, subprocess, sys

REPO=pathlib.Path(__file__).resolve().parents[2]
SOURCE=REPO/'WP/batch-release-cde8-20261014'
DEST=SOURCE/'build-only-source-review-request-9ef893b3'
TOOLING='9ef893b38fe381061d4dc8aa90968d1d7a4f6fff'
sys.path.insert(0,str(SOURCE))
from batch_build_contract import *
from prepare_batch_build import raw_git,current_evidence
assert not DEST.exists(), 'Consumed review request; read the actual history, never repeat'
assert subprocess.check_output(['git','rev-parse','HEAD'],cwd=REPO).decode().strip()==TOOLING
assert subprocess.check_output(['git','ls-remote','origin','refs/heads/audit/release-eb6de2e8'],cwd=REPO).decode().split()[0]==TOOLING
index={'head':TOOLING,'files':{}}
for n in sorted(SOURCE_FILES):
    raw,index['files'][n]=raw_git(TOOLING,'WP/batch-release-cde8-20261014/'+n)
    assert raw==(SOURCE/n).read_bytes(), 'Published/executed raw source differs'
tokens=review_tokens(TOOLING,index)
fresh=current_evidence()
pages_raw=subprocess.check_output(['gh','api','--paginate','--slurp','repos/yigini/soilfer-lims/issues/162/comments?per_page=100'],cwd=REPO)
comments=[v for p in json_exact(pages_raw) for v in p]
assert not any(TOOLING in v.get('body','') for v in comments), 'This tooling source already has a notice or review; inspect it'
files='\n'.join('- ['+n+'](https://github.com/yigini/soilfer-lims/blob/'+TOOLING+'/WP/batch-release-cde8-20261014/'+n+')' for n in sorted(SOURCE_FILES))
body='''Claudio: NEW separate batch build-only source review, #206 + #214 + #209.

Please review the five-file operational graph at exact tooling source '''+TOOLING+''' before the first new build. All three actual application audits and merges are complete; candidate main is cde8c8896f5f9d5f1ab07b0ae16b1a765e0a6367/tree638580d50f61254609de3abd42d93afc676a5727. Main CI38636615469 attempt1 closed SUCCESS21:34:24UTC with exact370/5649/all370inventory and every real Docker build/boundary/readiness step. Its16 original blobs are retained at194b8dfc89940502a480d20b4e18714925c5d5b0.

Actual source approvals: PR295/#206 head1a0702b3be410ac1dcdd9dc92f0f0c3dd2774a3a/PASS6146939836; PR296/#214 head5e0b32830f961b3236c7cf8f74cf8f676e98fbaa/PASS6163165778; PR297/#209 head6bd516c42a07332d0b0653ed150d1526bf7e424e/PASS6178123314. Their merge chain ends at the exact candidate. The completed #200 receipt identifies predecessor959d/image7aeb only; its historical build/proof/kit/gates/helpers remain consumed.

'''+files+'''

[Scope and validation](https://github.com/yigini/soilfer-lims/blob/'''+TOOLING+'''/WP/batch-release-cde8-20261014/build-source-review-ready.md), [closed current verification](https://github.com/yigini/soilfer-lims/blob/'''+TOOLING+'''/WP/batch-release-cde8-20261014/actual-cde8-raw-blob-archive-verification-once/exit-original.json), and [raw guard output](https://github.com/yigini/soilfer-lims/blob/'''+TOOLING+'''/WP/batch-release-cde8-20261014/actual-cde8-raw-blob-archive-verification-once/guard-stderr-original.log).

This source authorizes only one immutable new package/root/unit and one stock Docker build. It has zero database connections, volume mounts, impact collection, production-copy proof or deployment. Fresh actual main/CI/three audits/source review and later rejections are checked before upload and again immediately before launch. Intent files precede SSH/build; unknown outcomes forbid replay. Fixed firstroot only; no retry/rebuild/retag/cleanup. The launcher uses python3 -B and an unused unit; package inventory and every raw source byte are verified before execution.

Disk accounting uses metadata for only the owned build root plus disjoint Docker buildkit/overlay2/image/containerd directories, without opening volumes or database paths. Require floor10556150894 +4294967296B allocation before/unpack and preserve the floor after. Per-filesystem signed net allocated change bounds unexplained growth below500000000B, including cache shrink. Build2400/unit2700 seconds; both YY workload pins mandatory. Review these bounds and the failure/uncertain-outcome behavior.

Closed verification22:15:18.083367UTC:14 guard tests PASS/all five source hashes unchanged; actual1561 Gitblobs verify complete bytes/OIDs/modes/inventory,1560 selected after excluding tracked node_modules. No extraction or Docker operation. Earlier actual Git exports refused mode and then filtered-byte changes; original archives/indexes/transcriptions remain honest and immutable. Current raw-object archive preserves committed bytes with the same strict guards. The source publication first refused ignored raw files before commit/push; unique completion retained exactly42 verified owned blobs without source changes. No application/runtime/released assertion changed.

Only after a new PASS would Pip prepare and launch this first build. A separate NEW stopped production-copy proof source and final exact-kit audit/fresh gate remain required. Original DB/WAL/SHM must remain immutable; actual policyPRESENT/NO_OP0orSTOP, measured retained snapshots/allocations,214 chart contexts and created-unstarted-unbound servedLRM runs,209 causes/approved refusal lists/invalidStoredAnalysisSampleCount+sample/ownerIDs remain required before production. Nonzero lists to YY; approved nonzeroSTOP/separately reviewed forward remedy. No amendment-side order/backfill/relink/normalizer change. #103 has no production connection/APPLYGO. No new production connections/counts/build/proof/kit/gate/deploy have occurred.

If this exact build-only graph passes your independent review, please start the verdict with `Source review: PASS` and include the following complete literal bindings. This approves only this first build; it does not approve the future proof or production kit.

```
'''+ '\n'.join(tokens)+ '\n```\n'
DEST.mkdir()
def save(name,raw):
    with (DEST/name).open('xb') as f:f.write(raw)
save('tooling-source-index.json',(json.dumps(index,indent=2)+'\n').encode())
save('request-body-actual.txt',body.encode())
save('issue162-comments-before-original.json',pages_raw)
for n,r in fresh.items():save(n,r)
payload=(json.dumps({'body':body},ensure_ascii=False)+'\n').encode();save('request-payload-original.json',payload)
save('post-intent.json',(json.dumps({'startedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'toolingCommit':TOOLING,'candidate':CANDIDATE,'scope':SCOPE,'postCount':1,'neverRetry':True,'productionOperations':0})+'\n').encode())
try:
    result=subprocess.run(['gh','api','--method','POST','repos/yigini/soilfer-lims/issues/162/comments','--input','-'],cwd=REPO,input=payload,capture_output=True,timeout=60)
    save('post-response-original.json',result.stdout);save('post-stderr-original.txt',result.stderr)
    response=json_exact(result.stdout) if result.returncode==0 else None
except subprocess.TimeoutExpired as e:
    save('post-response-partial.txt',e.stdout or b'');save('post-stderr-partial.txt',e.stderr or b'');response=None
if response is None:
    after=subprocess.check_output(['gh','api','--paginate','--slurp','repos/yigini/soilfer-lims/issues/162/comments?per_page=100'],cwd=REPO);save('issue162-reconcile-after-unknown-original.json',after)
    matches=[v for p in json_exact(after) for v in p if v.get('body')==body]
    require(len(matches)==1,'Unknown POST outcome; inspect same history, never repost');response=matches[0]
require(response['body']==body and response['html_url']=='https://github.com/yigini/soilfer-lims/issues/162#issuecomment-'+str(response['id']),'Actual posted source review request differs')
save('actual-request-confirmed.json',(json.dumps(response,indent=2,ensure_ascii=False)+'\n').encode())
print(json.dumps({'status':'BUILD_ONLY_SOURCE_REVIEW_REQUEST_POSTED_ONCE','id':response['id'],'url':response['html_url'],'createdUtc':response['created_at'],'toolingCommit':TOOLING,'scope':SCOPE,'productionOperations':0}))
