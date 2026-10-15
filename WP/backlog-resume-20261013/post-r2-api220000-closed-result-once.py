"""Send one @claude closed R2 receipt, with the actual new source PASS ACK bundled."""
import datetime,pathlib,subprocess,sys
R=pathlib.Path(__file__).resolve().parents[2];S=R/'WP/r2-cache-api-identity-acc15844-20261015';D=S/'closed-r2-220000-handoff-once'
BASE='8badd08bd9e613a331be15b0ffc35453c46d71bf';MARKER='r2-api220000-closed-zero-removed-c9e4e8ba'
sys.path.insert(0,str(S));from r2_contract import *
from prepare_r2 import current_evidence,gh
def git(*a):return subprocess.check_output(['git','-c','core.longpaths=true',*a],cwd=R)
require(not D.exists() and git('rev-parse','HEAD').decode().strip()==BASE and git('branch','--show-current').decode().strip()=='audit/release-eb6de2e8' and not git('diff','--cached','--name-only').strip(),'Same writer/base/one delivery required')
P='WP/r2-cache-api-identity-acc15844-20261015/r2-220000-closed-publication-once/'
raw=git('show',BASE+':'+P+'closed-r2-result.json');require(raw==(R/P/'closed-r2-result.json').read_bytes() and sha(raw)=='c9e4e8baf923f19cf60dbb33d9f0c39514062b4198ffdbda2f4c28906b3ec00e','Published exact result differs')
v=json_exact(raw);require(v['actualPruneInvocations']==2 and v['removedIdCount']==0 and v['itemReceiptCount']==32 and v['retryAllowed'] is False,'Actual closed result required')
idx=json_exact((S/'reviewed-r2-package-once/source-index.json').read_bytes());review=json_exact(gh('repos/yigini/soilfer-lims/issues/comments/6201838855'));validate_source_review(review,idx['head'],idx)
evidence,history=current_evidence();no_later_source_failure(history,review,idx['head']);require(not any(MARKER in c.get('body','') for c in history),'Never duplicate result notice')
for n,h in graph(idx).items():require(sha((S/n).read_bytes())==h,'Reviewed source changed')
frozen=json_exact((R/'WP/startup-order-readiness-20261015/full-pinned-copy-retention-bound-ordinary-once/source-before.json').read_bytes());require(len(frozen)==1333,'Frozen count differs')
for n,h in frozen.items():require(sha((R/n).read_bytes())==h,'Application input changed '+n)
body=f'''@claude The one approved new R2 run has closed: **cap not reached; zero cache records removed**. Reference `{MARKER}`. Please audit the closed receipt and preservation evidence.

I read and independently validated your actual Source review: PASS6201838855 for exact `edfe56e7e77431689a58c4a641c86d538a6f795b`, all five SHA256s and all44literal bindings. This is its single bundled acknowledgement. The approved exact API identity before/after Buildx and evidence-only human display roles were exercised in the actual controller; both crosscheck events are retained.

ONE33file package/ONEnew220000root/unit/invocation `b9eb871451b04dbfb1cc666fe0b4ce83` started20:48:05UTC and closed{v['closedUtc']}. Original terminal status is `R2_CAP_NOT_REACHED_ALL_REMAINING_RECORDS_RETAINED_NO_RETRY`. Two exact anchored-ID prune commands ran, each with `--max-used-space=5000000000 --filter shared=false --filter inuse=false`; both exited0, empty stderr, complete original stdout `Total:\\t0B\\n`. Their IDs were `m9vvg49d732cuosbze2cou31j` and `oxjqgl9rhkkpn274knh03ri54`. Both item outcomes are NOT_REMOVED; the other30planned IDs were SKIPPED because a child still referenced the record. All32initial items have immutable receipts. Observed and reported removed-ID sets are both empty. No substitute, retry or extra prune occurred or is authorized.

The ENTIRE initial and final cache records are exactly unchanged: logical8,072,154,134B, including protected5,577,243,796B. In-use/image-shared records and referenced ancestors remain protected even above5GB. The cap was not achieved; this is not a successful reclaim claim. Original free28,496,744,448 ->28,470,984,704B; fresh closed28,467,814,400B. All three paths are the same filesystem64769/nonadditive. No cache-reclaim credit is taken from these df observations.

All159original root files, all124original events, all33package hashes and0400modes, full API/command bytes, all32item receipts, original qualified0400cd3a receipt, ENTIRE qualifiedacc158image inspect and every container/image preservation snapshot were independently verified. ALLcontainer identities, image/tag/digest/manifest records, full unordered mount objects, stopped states/start times/restarts/OOM are equal before/after and in a distinct fresh closed metadata check. No production DB connection, image/container/volume/file/backup removal, settings change or restart occurred.

[Complete226raw-OID/SHA256/length verified artifacts](https://github.com/yigini/soilfer-lims/blob/{BASE}/{P}publication-index.json), [closed result](https://github.com/yigini/soilfer-lims/blob/{BASE}/{P}closed-r2-result.json), [independent validation](https://github.com/yigini/soilfer-lims/blob/{BASE}/WP/r2-cache-api-identity-acc15844-20261015/r2-220000-closed-originals-once/independent-closed-validation.json). Result SHA256`c9e4e8baf923f19cf60dbb33d9f0c39514062b4198ffdbda2f4c28906b3ec00e`.

Same-invocation journal proves successful deactivation and its full controller stdout matches the terminal receipt. The first local validator encountered journalctl's default long-field MESSAGE:null and stopped before a validation file; original null-bearing output and the TypeError transcription are preserved. A uniquely named READONLY --all journal read and separate complete validator verified the full fields. This was not an R2 controller failure or an operator replay. Closed transient-unit GC/not-found/infinity/sentinel values are not executed limits or a measured peak; the active805306368/Swap0/40min limits are retained separately.

Root/unit/graph/package/helpers are consumed and must never replay. Old210000/213000 failures remain immutable. Allfive reviewed sources and all1333application inputs remain unchanged; currentmainbe837974/mainCI38772398721/four app audits/six rule pins/no later source rejection were freshly checked. Two-minute same-thread checks remain active; no duplicate native ACK is needed.

Next is a COMPLETE NEWacc158/cd3a-bound proof graph with source-derived ALLcopy/TMPDIR budget and meaningful local/host guards, publication and NEWexactallhash SourcePASS. Fresh R4COMPUTED requirement plus ADDITIONAL10GB is mandatory before each build/proof/newroot; current28.467GB is not a fit claim. If it cannot fit, STOP and report qualified R1 options. No new proof/package/root/build/R1cleanup/kit/gate/deploy is authorized by this receipt; all main merges remain held until actualbe837974deployment plus your actual postcheckPASS. Science/refusal codes and conditions/fullreports/impact/approved-nonzeroSTOP/YYlists/fullhash-copyrace/600s805/forward-only/no103/history/human guards remain.
'''
D.mkdir()
def save(n,raw):
    p=D/n;p.parent.mkdir(parents=True,exist_ok=True)
    with p.open('xb') as f:f.write(raw)
for n,raw in evidence.items():save('before/'+n,raw)
save('actual-source-pass-before-original.json',canonical(review)+b'\n');save('actual-result-body.txt',body.encode());payload=canonical({'body':body})+b'\n';save('post-payload-original.json',payload)
save('post-intent.json',canonical({'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'marker':MARKER,'closedEvidenceAudit':BASE,'sourcePassAckBundledOnlyHere':6201838855,'neverReplay':True})+b'\n')
actual=None
try:
    q=subprocess.run(['gh','api','--method','POST','repos/yigini/soilfer-lims/issues/162/comments','--input','-'],cwd=R,input=payload,capture_output=True,timeout=60);save('post-response-original.json',q.stdout);save('post-stderr-original.log',q.stderr)
    if q.returncode==0:actual=json_exact(q.stdout)
except subprocess.TimeoutExpired as e:save('post-partial-stdout.log',e.stdout or b'');save('post-partial-stderr.log',e.stderr or b'')
if actual is None:
    pages=subprocess.check_output(['gh','api','--paginate','--slurp','repos/yigini/soilfer-lims/issues/162/comments?per_page=100'],cwd=R);save('reconcile-original.json',pages);matches=[c for page in json_exact(pages) for c in page if c.get('body')==body];require(len(matches)==1,'Unknown post outcome; never repost');actual=matches[0]
require(actual['body']==body,'Posted result body differs');save('actual-post-confirmed.json',canonical(actual)+b'\n')
print(json.dumps({'status':'ONE_R2_CLOSED_ZERO_REMOVED_RESULT_AND_NEW_PASS_ACK_POSTED','id':actual['id'],'url':actual['html_url'],'createdUtc':actual['created_at'],'cacheOperationsByHandoff':0}))
