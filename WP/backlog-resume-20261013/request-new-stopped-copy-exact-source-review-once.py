"""One concrete exact SourceReview request; never collect production data or run the graph."""
import datetime,json,pathlib,subprocess,sys
REPO=pathlib.Path(__file__).resolve().parents[2];SOURCE=REPO/'WP/batch-proof-cde8-20261015';TOOLING='87dfedc68723a19bd25c05bc9f0f262b0239e922';DEST=SOURCE/'exact-source-review-request-87dfedc6'
sys.path.insert(0,str(SOURCE))
from proof_contract import *
from prepare_proof import raw_git,current_evidence
def command(*args):return subprocess.check_output(args,cwd=REPO)
require(not DEST.exists() and command('git','rev-parse','HEAD').decode().strip()==TOOLING,'Review boundary consumed or source head changed')
require(command('git','ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==TOOLING,'Published source differs')
index={'head':TOOLING,'files':{}}
for n in sorted(FILES):
    raw,index['files'][n]=raw_git(TOOLING,'WP/batch-proof-cde8-20261015/'+n);require(raw==(SOURCE/n).read_bytes(),'Published source bytes differ')
evidence=current_evidence();require(not any(TOOLING in c.get('body','') for c in evidence['sourceComments']),'This exact source already has a notice; inspect, never duplicate')
proof=exact_json((SOURCE/'source-local-host-verification-canonical-once/exit-original.json').read_bytes());require(proof['sourceSha256After']==graph(index) and proof['localTests']==proof['actualHostTests']==40,'Current closed verification differs')
base='https://github.com/yigini/soilfer-lims/blob/'+TOOLING+'/WP/batch-proof-cde8-20261015/'
body='''Claudio: NEW concrete closed source for production raw-snapshot inputs and the owned stopped-copy batch installation / jobs-OFF startup proof. Please review this exact graph before ANY production file collection or proof execution.

Tooling '''+TOOLING+''' has ten complete source files and40/40 local +40/40 actual host Python3.9 guards, all ten compiled/hash unchanged, closed2026-10-15T01:17:10.875877UTC. The synthetic tests include nonempty WAL folding into an owned backup while preserving all raw master bytes, valid additive receipt/table acceptance, and refusal of altered original rows/receipts/columns/backfill. No production file copy/database connection, image inspection, installer/default entrypoint or proof operator ran. All synthetic fixtures are retained; the40-test graph supersedes the immutable37-test predecessor before the explicit canonical policy-shape predicate.134 original owned blobs were independently Git-OID/SHA verified and pushed.

[Complete scope and failure paths]('''+base+'''SOURCE_REVIEW.md), [current CLOSED guard evidence]('''+base+'''source-local-host-verification-canonical-once/exit-original.json), [complete raw source/evidence publication index]('''+base+'''closed-source-publication-index.json).

'''+ '\n'.join('- ['+n+']('+base+n+')' for n in sorted(FILES))+'''

The qualified NEW b5 image/receiptc03/buildSource6608548a/actualSourcePASS6181452519/closed buildb1 evidence are bound separately from production's NORMALHEALTHY959d/7aeb/8109 predecessor. The original qualified receipt, raw application manifest and entire image inspection must match; pinned application sources from the immutable build package are rehashed. Current maincde8/tree638/mainCI38636615469 attempt1 SUCCESS370/5649/all actual Docker plus all three actual source-audit/merge records must still match, before upload and again immediately before launch. Old build/source/proof approvals do not authorize this graph. Actual normal predecessor health/identity/0restart/noOOM/memory805/existingSwap1610612736/blankheap/noautopush/noautoseed/jobsON/same volumes are refreshed. Full production environment is not persisted.

Proposed new root /opt/lims/releases/workflow-batch-stopped-copy-cde8c889-20261015T020000Z and unit/package are UNCREATED/UNUSED. Readonly filesystem bytes copy production DB/WAL/SHM and assets, with complete before/copy/after hashes and device/inode/mtime/mode/length/tree consistency. Any drift/alias/missing/special-file/size/output/deadline problem consumes and refuses this boundary, never retries. No SQLite/Prisma connection touches production or immutable raw masters. Only separate owned readers fold WAL and create retained consistent backups; no immutable=1 shortcut ignores committed WAL. All raw triples/readers/backups remain.

Installation is confined to one owned copy: policy must return PRESENT, shape CANONICAL, NO_OP0/dataWrites0/originaltriplepreserved or STOP; no policy normalization is performed. Then exact206/214/209 dry→apply→immediate NO_OP, each with independent stopped seals and every original row/column/schema object/receipt checked. New tables stay EMPTY, no scientific backfill,209nullable OrderLine.workItemId stays NULL.106/39→112/42 are source/historical-receipt expectations only until reviewed retained-copy collection; actual mismatch refuses and no production count is claimed now.

Actual214 policy/QC precedence collector prints chart lab/analyte/method contexts and created-unstarted-unboundservedLRM plus sequence refusals on the owned copy. Actual209 collector runs after COMPLETE214 and prints separate no-active/no-matching/fraction/texture/reservation causes, approved-amendment sample/refusal lists, invalidStoredAnalysisSampleCount with sample/owner IDs. Primary AND secondary prerequisite snapshots and every reported retained file hash/physical allocation are independently inspected under owned TMPDIR. Approved-amendment nonzero STOP occurs before209 apply, leaving all evidence for YY and a separately Claudio-reviewed forward remedy. Other nonzero lists must also be shown to YY before any future gate. No amendment-side order step/backfill/relink/normalizer change exists.

Two independent ordinary default startups use separate installed DB/assets copies, jobs OFF/network NONE/no production mount/no credential reuse/blankheap/memory805306368/no-swap container cap. Exact27 entrypoint NO_OP0 and26 READY0 expectations are pinned to current source. Readiness600, peak memory, health/login/unauthorized401 checks, exact full installed state in detached stopped seals. Every new CLI/runtime container is stopped and RETAINED. Every pre-existing stopped container must still have its original name/image/config labels/mounts/start time and remain stopped. No --rm/prune/delete/cleanup/older-image-start/restore/retag/rebuild is used.

This is intentionally the complete upstream snapshot + stopped installation/jobs-OFF startup graph, not release qualification. Its terminal explicitly says STOPPED_COPY_INSTALLATION_AND_JOBS_OFF_STARTUP_PASS_NOT_RELEASE_QUALIFIED. Jobs-ON natural scheduler/intake qualification and broader application postflights remain separately required, followed by final exact-kit review and a fresh single-use gate. It cannot stop/restart/reconfigure production, start historical images, deploy or issue a gate. Four refused Kobo configurations/#103 human card remain untouched.

Physical accounting includes ALL retained release roots, whole Docker storage (containers/logs/volumes included) and required /var/lib/containerd in one disjoint du -s -B1 invocation per checkpoint,120second/64KiB. No descendant mounts/aliases/device changes; actual overlayfs/containerd snapshotter/default daemon/configuration/PID must remain. Scaled reserve128 actual DB-triple allocations +3 actual asset copies +4GiB logs/headroom +fixed10556150894 floor; includes primary/secondary retained snapshots. Per-device measured free loss versus full physical growth keeps500000000 unexplained STOP. No daemon/production configuration change. Controller5400/memory805306368/swap0/Restartno/UMask0077; CLI600/readiness600 preserve60 stage+600 unit headroom. Output/reserve/deadlines are monitored while running. Only an owned transport process/exact labelled NEW b5 container may stop on refusal; all prior containers/daemon processes remain.

After ANY installer/default-entrypoint attempt including dry/NO_OP/refusal, recovery remains separately audited FORWARD FIX ONLY. All old failures, image1d exclusion/missing-before3609116672 residual, historical roots/raws/receipts/gates/backups/stopped containers and#200 completion stay immutable.206214209 source merged/undeployedOPEN; no#103 production connection/APPLYGO; both YY workload pins/human files/drafts/cards unchanged.

Please review THIS concrete ten-file graph. If it passes, issue a NEW unedited actual verdict `Source review: PASS` containing ALL literal bindings below. This approval would cover one new raw snapshot and this scoped owned proof only; it does not approve jobs-ON qualification, final kit/gate or deployment:

```
'''+ '\n'.join(tokens(index))+'\n```\n'
DEST.mkdir()
def save(n,raw):
    with (DEST/n).open('xb') as f:f.write(raw)
save('actual-request-body.txt',body.encode());save('tooling-source-index.json',canonical(index)+b'\n');save('fresh-current-evidence-before-request.json',canonical(evidence)+b'\n');save('closed-source-verification-original.json',canonical(proof)+b'\n')
payload=canonical({'body':body})+b'\n';save('request-payload-original.json',payload);save('post-intent.json',canonical({'startedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'toolingCommit':TOOLING,'neverRetry':True,'proofSourceApproved':False,'productionCopies':0})+b'\n')
actual=None
try:
    r=subprocess.run(['gh','api','--method','POST','repos/yigini/soilfer-lims/issues/162/comments','--input','-'],cwd=REPO,input=payload,capture_output=True,timeout=45);save('post-response-original.json',r.stdout);save('post-stderr-original.log',r.stderr)
    if r.returncode==0:actual=exact_json(r.stdout)
except subprocess.TimeoutExpired as e:save('post-response-partial.txt',e.stdout or b'');save('post-stderr-partial.txt',e.stderr or b'')
if actual is None:
    pages=exact_json(command('gh','api','--paginate','--slurp','repos/yigini/soilfer-lims/issues/162/comments?per_page=100'));save('reconcile-original.json',canonical(pages)+b'\n');matches=[c for p in pages for c in p if c.get('body')==body];require(len(matches)==1,'Unknown remote outcome; never repost');actual=matches[0]
require(actual['body']==body,'Posted source request changed');save('actual-request-confirmed.json',canonical(actual)+b'\n')
print(json.dumps({'status':'NEW_EXACT_STOPPED_COPY_SOURCE_REVIEW_POSTED_ONCE','id':actual['id'],'url':actual['html_url'],'createdUtc':actual['created_at'],'toolingCommit':TOOLING,'sourceApproval':None,'productionCopies':0,'proofOperatorsExecuted':0}))
