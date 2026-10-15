"""One NEW exact review of controller safety successor; predecessor PASS remains immutable."""
import datetime,json,pathlib,subprocess,sys
REPO=pathlib.Path(__file__).resolve().parents[2];SOURCE=REPO/'WP/batch-proof-cde8-20261015';TOOLING='6a235c68ecf3a8ef8c405d49ff4d3f41bedabe38';DEST=SOURCE/'exact-controller-review-request-6a235c68'
sys.path.insert(0,str(SOURCE))
from proof_contract import *
from prepare_proof import raw_git,current_evidence
def cmd(*args):return subprocess.check_output(args,cwd=REPO)
require(not DEST.exists() and cmd('git','rev-parse','HEAD').decode().strip()==TOOLING,'Consumed source request or writer changed')
require(cmd('git','ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==TOOLING,'Remote source moved')
index={'head':TOOLING,'files':{}}
for n in sorted(FILES):
    raw,index['files'][n]=raw_git(TOOLING,'WP/batch-proof-cde8-20261015/'+n);require(raw==(SOURCE/n).read_bytes(),'Published raw source differs')
evidence=current_evidence();require(not any(TOOLING in c.get('body','') for c in evidence['sourceComments']),'New head already has request/review; inspect never duplicate')
proof=exact_json((SOURCE/'source-local-host-verification-preflight-stop-short-once/exit-original.json').read_bytes());require(proof['sourceSha256After']==graph(index) and proof['localTests']==proof['actualHostTests']==44,'Fresh44 guard proof missing')
old_raw=cmd('gh','api','repos/yigini/soilfer-lims/issues/comments/6182389127');old=exact_json(old_raw);require(first_line(old['body'])=='Source review: PASS' and '87dfedc68723a19bd25c05bc9f0f262b0239e922' in old['body'],'Actual predecessor approval differs')
base='https://github.com/yigini/soilfer-lims/blob/'+TOOLING+'/WP/batch-proof-cde8-20261015/'
body='''Claudio: NEW exact controller successor BEFORE DISPATCH. Your actual87df SourcePASS6182389127 is retained unchanged at8c0039be; the approved predecessor was NEVER prepared/launched/executed and no production file was copied. I read your native verdict, both safe-stop notes, and the remaining jobs-ON/kit/gate scope. During the immediate pre-dispatch source check I found two controller errors that should be corrected before collection, so I held dispatch and completed this successor.

1. Policy preflight called `--apply`. If an owned copy were ABSENT, the unchanged installer could create canonical policy DDL before our PRESENT/NO_OP gate then refused. This contradicted the intended no-normalization preflight. It now calls the unchanged installer `--dry-run`: PRESENT still returns canonical NO_OP0, while ABSENT/other shape STOP without an owned policy write. No application/policy/scientific source changed.
2. The old `Docker.stop` used the ordinary command adapter, whose reserve/headroom guard could refuse the emergency stop after the original guard had already failed. Stop now first requires the id/owner pair to be tracked as created by THIS controller, then exact b5/owner-label validation, then performs one bounded30s Docker stop independent of reserve/headroom. It confirms stopped state BEFORE output retention, so even an output/disk failure cannot obstruct stopping that owned writer. It cannot stop a predecessor/historical/untracked container. Every stopped container remains retained.
3. File sampling also rejects symlinks in EVERY input ancestor before any file open, extending O_NOFOLLOW's leaf protection.

NEW source '''+TOOLING+''' is the same complete ten-file upstream graph, five code files changed and five byte-identical to approved87df. [Full current scope/changes]('''+base+'''SOURCE_REVIEW.md), [CLOSED44 local +44 actual-host verification]('''+base+'''source-local-host-verification-preflight-stop-short-once/exit-original.json), [96 raw-OID/SHA verified publication blobs]('''+base+'''controller-successor-publication-index.json).

'''+ '\n'.join('- ['+n+']('+base+n+')' for n in sorted(FILES))+'''

44/44 local +44/44 ACTUAL host Python3.9 passed, ten sources compiled/hash unchanged, CLOSED01:44:34.381557UTC. Added synthetic cases check ABSENT preflight leaving the copy unchanged/no apply, emergency stop after BOTH reserve and headroom refusal, untracked stop rejection BEFORE inspecting it, and ancestor alias rejection before file open. All prior40 authority/WAL/original-row/receipt/column/backfill/container/disk/startup guards pass too. All fixtures retained. First44 local attempt honestly closed43PASS/1 Windows264-character output-path error after the mocked stop already succeeded; HOSTNOTRUN. A NEW short hashed fixture-directory successor corrected verification storage only; full original failed logs/ten source bytes/fixtures remain. One publisher syntax refusal happened before any execution/mutation, original helper retained and corrected via a new syntax-only helper. No runtime guard was weakened, no production copy/connection/imageinspect/installer/entrypoint/proof operator ran.

Qualified NEW b5/414679214B/c03 receipt/build6608/PASS6181452519/closed evidenceb1 and NORMALHEALTHY production959d/7a/8109 are still separately bound. Current appmaincde8/tree638/mainCI38636615469 attempt1 SUCCESS370/5649/all realDocker/all three actual source-audit+merge records unchanged. Exact raw package/index/receipt/entire image inspect must match. Both YYpins/fresh source/mainCI/review/later-rejection checks before upload and immediately before launch remain. The020000 root/package/unit is still UNCREATED/UNUSED. This successor needs its OWN exact actual source PASS;87df PASS does not approve its changed hashes.

Scope remains raw production-filesystem-only DB/WAL/SHM/assets snapshot, no liveSQLite/Prisma, stable before/copy/after identities/hashes/modes/trees, raw masters never connected, WAL folded only on separate owned readers and every raw/reader/backup retained. Changing inputs refuse once/no retry. Canonical policy PRESENT/NO_OP0 or STOP through readonly preflight; owned206/214/209 dry/apply/immediate NO_OP and independent all original rows/columns/schema objects/receipts/EMPTYnewtables/NULL209column.10639→11242 are source/historical-receipt expectations ONLY until reviewed retained-copy collection.

Actual214 chart lab/analyte/method contexts/unstarted-unboundservedLRM/sequence lists and209 separate no-active/no-matching/fraction/texture/reservation causes, approved-amendment lists, invalidStoredAnalysisSampleCount/sample-owner IDs remain unchanged collectors on owned copies. Primary+secondary snapshots/each raw hash/physical allocation independently checked under ownedTMPDIR. Approved-amendment nonzero STOP before209 dry/apply; all nonzero lists toYYbeforefuturegate/separateClreviewed forward remedy. No amendment-side order step/backfill/relink/normalizer change.

Two independent ordinary jobs-OFF/networkNONE/memory805/blankheap default starts, sourceexpected27NOOP0/26READY0/readiness600/healthloginunauthorized401/peak/stoppedfullstateequality. Every new CLI/runtime container stopped and retained; every historical stopped container unchanged/still stopped. No production stop/restart/settingschange, --rm/prune/delete/cleanup/restore/oldimagestart/retag/rebuild.

Full disjoint physical retainedreleases+WHOLEDocker+requiredctrd accounting120s/64KiB/aliasesdescendantmounts/devices/defaultconfigPID unchanged; actual128DBtriples+3assets+4GiBlogreserve+floor10556150894;500000000 unexplained STOP. Controller5400/memory805Swap0/CLI600/readiness600/stage60+unit600headroom/bothpins unchanged. Only emergency strictly-owned stop is independent of already-failed reserve/headroom. After ANY installer/default-entrypoint attempt, dry/NOOP/refusal included, recovery only separately audited forward fix; no same helper/installer replay.

This source still grants only one NEW raw snapshot + scoped owned stopped-installation/jobs-OFF proof, terminalNOT_RELEASE_QUALIFIED. Jobs-ON natural scheduler/intake qualification/broader postflights, final exact-kit audit and fresh single-use gate are still required; no gate/deploy authority. Production959d/7a unchanged,206214209undeployedOPEN/#200historicalcomplete/#103no connection/APPLYGO. All historical failures/unproved3609116672/old1dexclusion/roots/raws/receipts/backups/containers/humanfilesdraftscards preserved.

Please review THIS exact successor. If it passes, post a NEW unedited actual `Source review: PASS` containing ALL literals below, including the three NEW safeguards. No old-pass inference, copy, preparation or launch before that exact actual verdict.

```
'''+ '\n'.join(tokens(index))+'\n```\n'
DEST.mkdir()
def save(n,raw):
    with (DEST/n).open('xb') as f:f.write(raw)
save('actual-request-body.txt',body.encode());save('tooling-source-index.json',canonical(index)+b'\n');save('fresh-current-evidence-before-request.json',canonical(evidence)+b'\n');save('actual-predecessor-pass-original.json',old_raw);save('current44-verification-original.json',canonical(proof)+b'\n')
payload=canonical({'body':body})+b'\n';save('request-payload-original.json',payload);save('post-intent.json',canonical({'startedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'toolingCommit':TOOLING,'neverRetry':True,'productionCopies':0,'sourceApproval':None})+b'\n')
actual=None
try:
    r=subprocess.run(['gh','api','--method','POST','repos/yigini/soilfer-lims/issues/162/comments','--input','-'],cwd=REPO,input=payload,capture_output=True,timeout=45);save('post-response-original.json',r.stdout);save('post-stderr-original.log',r.stderr)
    if r.returncode==0:actual=exact_json(r.stdout)
except subprocess.TimeoutExpired as e:save('partial-stdout.txt',e.stdout or b'');save('partial-stderr.txt',e.stderr or b'')
if actual is None:
    pages=exact_json(cmd('gh','api','--paginate','--slurp','repos/yigini/soilfer-lims/issues/162/comments?per_page=100'));save('reconcile-original.json',canonical(pages)+b'\n');matches=[v for p in pages for v in p if v.get('body')==body];require(len(matches)==1,'Uncertain outcome; never repost');actual=matches[0]
require(actual['body']==body,'Posted body differs');save('actual-request-confirmed.json',canonical(actual)+b'\n')
print(json.dumps({'status':'EXACT_NEW_CONTROLLER_SUCCESSOR_REVIEW_POSTED_ONCE','id':actual['id'],'url':actual['html_url'],'createdUtc':actual['created_at'],'toolingCommit':TOOLING,'sourceApproval':None,'productionCopies':0}))
