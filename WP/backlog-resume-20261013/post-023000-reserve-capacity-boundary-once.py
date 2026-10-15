"""Post one concrete capacity boundary; no new source approval or operation requested."""
import datetime,json,pathlib,subprocess,sys
REPO=pathlib.Path(__file__).resolve().parents[2];SOURCE=REPO/'WP/batch-proof-cde8-20261015';DEST=SOURCE/'reserve-capacity-boundary-023000-once';BASE='e17d1529407b2c809587bef27a943f75073410e2'
sys.path.insert(0,str(SOURCE));from proof_contract import *
from prepare_proof import current_evidence
def cmd(*a):return subprocess.check_output(a,cwd=REPO)
require(not DEST.exists() and cmd('git','rev-parse','HEAD').decode().strip()==BASE,'Boundary consumed/writer moved')
require(cmd('git','ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==BASE,'Remote moved')
evidence=current_evidence();marker='stopped-copy-023000-reserve-stop-f65cb69c'
require(not any(marker in c.get('body','') for c in evidence['sourceComments']),'Boundary already posted; inspect never duplicate')
r=exact_json((SOURCE/'first-proof-023000-closed-reserve-stop/closed-retention-record.json').read_bytes());d=r['postFailureMetadataOnly']
body='''Claudio: actual023000 reserve STOP / capacity direction needed. Boundary `stopped-copy-023000-reserve-stop-f65cb69c`.

Your exact ea9ce209 SourcePASS6183081827 was retained and used ONCE. One17file package/one fresh023000 unit ran02:36:49–02:37:54UTC, invocation f65cb69ccc5542339f09fcab778bed23. The original sealed terminal02:37:54.846974UTC is FAILED_OR_REFUSED_RETAIN_ALL_FORWARD_FIX_ONLY: RuntimeError Measured/scaled reserve STOP. Root/unit/helpers are CONSUMED; no restart/retry/replay/cleanup.

The overlay correction passed the actual initial physical accounting: du-x exit0, all16views validated before+after, no view bytes credited, whole releases/Docker/containerd counted. Then the reviewed controller performed filesystem-only source hashing/asset inspection and refused at disk.bind's unchanged128x reserve. No fresh-production-snapshot/raw master/owned SQLite/tablecounts/installer/default-entrypoint/new container exists; no production copy, SQL connection, stop/restart/settingschange or deployment. All25root originals/17package hashes remain byte-identical0400. Final unit805306368/Swap0/90min, actual peak84631552, full original journal retained. All historical containers' names/images/labels/full mount objects/running/starttimes match; historical stopped containers still stopped. Fresh SAFESELECTEDderived production959d/7a/8109 healthy/0restart/noOOM/jobsON/sameflagslimitsvolumes. QualifiedB5/c03 build unchanged.

[38independently raw-Git-OID/SHA verified closed originals and diagnostic](https://github.com/yigini/soilfer-lims/blob/e17d1529407b2c809587bef27a943f75073410e2/WP/batch-proof-cde8-20261015/first-proof-023000-closed-reserve-stop/index.json). Original allocation-before/du stdoutstderr, refusal, package, journal, systemctl and fresh preservation evidence included. No original file changed.

NEW02:40:31.909041UTC diagnostic read current FILESYSTEM METADATA ONLY: stat of DB/WAL/SHM and asset files; no production file-content open, SQL, newdu, collection or proof replay. DBtriple reserveallocation567558144B (dev.db563322880B logical/563326976B allocated; WAL4198312B logical/4198400B allocated; SHM32768B), asset reserveallocation5787648B. Current pinned formula is:

10556150894 + 128*567558144 + 3*5787648 + 4294967296 = **87515923566B required**.

Fresh available **58602573824B** on all3bound paths sharing device64769, so **28913349742B shortfall**. These are labeled fresh postfailure metadata, not invented original bind inputs: the original controller threw before writing measured-copy-reserve.json, which remains absent. Actual10639→11242 and214/209scientific lists remain UNKNOWN; no database counts queried.

Please review this concrete capacity STOP and specify the forward capacity path that preserves the pinned128DB/3assets/4GiBlogs/floor10556150894/500MB guard and every retained artifact. If additional host capacity requires YY action or a new infrastructure scope, identify that exact boundary. No capacity/settings/guard change is authorized or being performed by this notice; no new source/root/package/proof is proposed or executed yet. SourcePASS6183081827 is consumed for023000; it cannot approve another root or capacity remedy. I will retain STOP and prepare any required genuinely NEW concrete source for its own review only after that direction.

BothYYpins/scientific214+4actual209answers/policyPRESENTCANONICALNOOPorSTOP/readonlydryrun/approvednonzeroSTOPbefore209/YYallnonzerolists/separateClforwardremedy/invalidStoredAnalysisSampleCount+sampleownerIDs/primarysecondarysnapshots/allstoppedcontainers/memory805blankheap/readiness600unit5400/headroom60+600/forward-only preserved. After ANY installer/entrypoint attempt evenDRYNOOPfailure, only separately audited forwardfix; this failure attempted neither. No cleanup/prune/delete/move/restore/olderimagestart/rebuild/retag/heapraise/coredisable/#103connection/APPLYGO/humanfilesdraftscards changes. Jobs-ON natural scheduler/intake+broadpostflights/final exactkit review/freshsingleusegate stilllater;206214209undeployedOPEN/#200historicalcomplete. This is a capacity boundary, not a deployment notice or proof PASS.
'''
DEST.mkdir()
def save(n,raw):
    with (DEST/n).open('xb') as f:f.write(raw)
save('actual-boundary-body.txt',body.encode());save('fresh-current-evidence-before-post.json',canonical(evidence)+b'\n');payload=canonical({'body':body})+b'\n';save('payload-original.json',payload);save('post-intent.json',canonical({'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'marker':marker,'neverRetry':True,'newOperations':0})+b'\n')
actual=None
try:
    result=subprocess.run(['gh','api','--method','POST','repos/yigini/soilfer-lims/issues/162/comments','--input','-'],cwd=REPO,input=payload,capture_output=True,timeout=45);save('post-response-original.json',result.stdout);save('post-stderr-original.log',result.stderr)
    if result.returncode==0:actual=exact_json(result.stdout)
except subprocess.TimeoutExpired as e:save('partial-stdout.log',e.stdout or b'');save('partial-stderr.log',e.stderr or b'')
if actual is None:
    pages=exact_json(cmd('gh','api','--paginate','--slurp','repos/yigini/soilfer-lims/issues/162/comments?per_page=100'));save('reconcile-original.json',canonical(pages)+b'\n');matches=[c for page in pages for c in page if c.get('body')==body];require(len(matches)==1,'Uncertain outcome, inspect never repost');actual=matches[0]
require(actual['body']==body,'Actual body differs');save('actual-boundary-confirmed.json',canonical(actual)+b'\n')
print(json.dumps({'status':'ACTUAL_CAPACITY_BOUNDARY_POSTED_ONCE','id':actual['id'],'url':actual['html_url'],'createdUtc':actual['created_at'],'newOperations':0}))
