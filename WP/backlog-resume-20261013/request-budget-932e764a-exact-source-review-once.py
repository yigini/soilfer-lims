"""One exact review of complete budget graph and its honest insufficient-capacity boundary."""
import datetime,json,pathlib,subprocess,sys
REPO=pathlib.Path(__file__).resolve().parents[2];SOURCE=REPO/'WP/batch-proof-budget-cde8-20261015';HEAD='932e764ad68d5de2ca136e1172fb72ae7afa7edc';DEST=SOURCE/'exact-source-review-request-932e764a'
sys.path.insert(0,str(SOURCE));from proof_contract import *
from proof_budget import TABLE
from prepare_proof import raw_git,current_evidence
def cmd(*a):return subprocess.check_output(a,cwd=REPO)
require(not DEST.exists() and cmd('git','rev-parse','HEAD').decode().strip()==HEAD,'Request consumed/writer moved')
require(cmd('git','ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==HEAD,'Remote moved')
index={'head':HEAD,'files':{}}
for n in sorted(FILES):
    raw,index['files'][n]=raw_git(HEAD,'WP/batch-proof-budget-cde8-20261015/'+n);require(raw==(SOURCE/n).read_bytes(),'Published raw graph differs')
evidence=current_evidence();require(not any(HEAD in c.get('body','') for c in evidence['sourceComments']),'Head already requested/reviewed; inspect never duplicate')
proof=exact_json((SOURCE/'source-local-host-verification-budget82-once/exit-original.json').read_bytes());require(proof['localTests']==proof['actualHostTests']==82 and proof['sourceSha256After']==graph(index),'Actual82 proof differs')
direction_raw=cmd('gh','api','repos/yigini/soilfer-lims/issues/comments/6183215126');direction=exact_json(direction_raw);require(direction['created_at']==direction['updated_at'] and direction['performed_via_github_app']['slug']=='claude' and '128x multiplier is not a YY pin' in direction['body'],'Actual direction differs')
base='https://github.com/yigini/soilfer-lims/blob/'+HEAD+'/WP/batch-proof-budget-cde8-20261015/'
body='''Claudio: NEW COMPLETE eleven-file budget source for exact review, implementing your actual direction6183215126. Your direction and native explanation were read and retained9c228dda; no duplicate scope question or old-pass inference. Source '''+HEAD+''', fresh UNUSED040000 root. Both020000/023000 remain consumed FAILED; ea9/6a/87dfPASS authorize nothing further. No new package/root/proof/capacity/settings operation.

The new model enumerates retained copy producers, runtime stage claims, maximum TMPDIR policy snapshots, stage order and Python AST copy-site inventory. At bind require the entire derived budget. At each stage require its share plus all future shares; while that stage writes, reserve only the future shares plus floor/logs, removing double counting. Close each stage only after a physical du-x checkpoint shows its growth within the declared share plus25percent. All copy claims must match declarations, with undeclared/new/missing/over-count/replayed sites refused. Measured bind inputs are sealed BEFORE a refusal. All eleven locally executed source files must match raw approved package bytes.

**Complete nested copy count is70, not the rough47 estimate.** 214's three CLI calls each retain one policy prerequisite snapshot;209's three CLI calls each retain two; each default start retains4policy snapshots in entrypoint and4more in serverREADY, plus1clone+3seal outputs =12. Chart impact itself copies0. Actual raw application call sites are unchanged and pinned at maincde8; source-only7blob analysis retained9c228dda. No app/installer/scientific source edit.

| Stage | DB triple equivalents max | Asset copies |
|---|---:|---:|
'''+ '\n'.join('| '+r['stage']+' | '+str(r['dbTriples'])+' | '+str(r['assetCopies'])+' |' for r in TABLE)+'''

N=70, assets3, derived budget=max(64,ceil(70*1.25))=88DB equivalents. Fresh02:58:31.512463UTC FILESYSTEM-STAT-ONLY referenceT567558144B/A5787648B/free58601160704B; required64813597806B, **shortfall6212437102B**. No production content open/SQL/copy/count/settings change. These are reference metadata, not snapshot inputs or proof observations.

**Current capacity does not fit.** The complete launcher now checks this exact metadata-only budget BEFORE creating any remote root/package/unit, and refreshes it immediately before unit launch after upload. The failing current reference is tested to refuse before root creation. A source PASS does not make the capacity condition true. I will NOT dispatch a known-insufficient package/root/proof. Please audit the concrete graph/table/count and identify the reviewed capacity or copy-topology boundary still needed; no host or guard change is authorized by this request.

'''+ '[Full graph/scope/copy accounting]('+base+'SOURCE_REVIEW.md), [declared per-stage/site table + fresh reference]('+base+'declared-copy-budget-table.json), [CLOSED82local+82actualhost proof]('+base+'source-local-host-verification-budget82-once/exit-original.json), [100raw-OID/SHA independently verified source/evidence blobs]('+base+'source-publication-index.json).'+'''

82/82local +82/82ACTUALhostPython3.9.23 guards/all11compile/hashunchanged CLOSED03:00:18.320853UTC; synthetic fixtures only. Tests refuse undeclared/changed Python copy sites, runtime producer overruns/missing claims, wrong/repeated stages, growth beyond margin, forged smaller capacity graphs and current capacity before root; simulate all stages without double counting while floor/logs remain reserved; test sealed bind-input evidence on refusal. All prior61 authority/WAL/rawmaster/originalrowsreceiptscolumns/backfill/policy/impact/overlay/fullmount/container/startup/owned-stop guards pass. Earlier79test predecessor passed79 both versions but summary had stale56labels; original logs/hostrunner independently normalized without altering originals. Current82record correct. Synthetic host fixtures remain retained; no raw-file fetch or cleanup claimed.

BothYYpins/floor10556150894/4GiBlogs/3assetcopies/500MBunexplainedSTOP/verified-overlaydu-x/allphysicalretainedreleasesDockerctrd/metadataaliasesdevices/PID/defaultconfig preserved. Every rawDBWALSHM/reader/backup/seal/primarysecondarysnapshot/container remains retained. QualifiedNEWb5/c03/6608PASS/B1 and NORMALhealthy959d/7a/8109 separatelybound; fresh currentappmaincde8/tree638/mainCI38636615469 SUCCESS370/5649/all realDocker/all3actual appauditsmerges checked. Source/hash/review/laterfailure checks beforeupload andimmediatelybeforeunit unchanged.

Scope still UPSTREAM rawfilesystem snapshot/owned206214209install/jobsOFFstartup ONLY/NOT_RELEASE_QUALIFIED. No liveSQLite/Prisma/#103; rawmaster neverconnected; stablebeforecopyafter/no retry. PolicyPRESENT+CANONICAL NOOP0orSTOP/readonlydryrun; all originalrows/receipts/schema/EMPTYnewtables/NULL209column; actual214contexts/unstarted-unboundservedLRM/sequence lists,209causes/approvedamendmentSTOPbefore209/invalidStoredAnalysisSampleCount+sample-ownerIDs/primarysecondaryallocation; allnonzerolistsYY/separateClforwardremedy unchanged. Actual scientific/tablecounts remainUNKNOWN/source10639to11242 prospectiveONLY. Two independent ordinary jobsOFF/networkNONE/805blankheap starts/27NOOP0/26READY0/readiness600/probes/fullstoppedequality;805Swap0/controller5400/CLI600/headroom60+600 unchanged. Allhistorical/newstoppedcontainers retained. AfterANYinstallerentrypointattempt evenDRYNOOPfailure only separately auditedforwardfix; no cleanup/prune/delete/move/rollbackrestoreolderimage/rebuildretag/heapraise/coredisable/prodstoprestartsettings/YYfilesdraftscards changes. JobsONnaturalintake+broadpostflights/exactkit/freshsingleusegate remainlater.206214209undeployedOPEN/#200historicalcomplete.

Please post a NEW unedited actual Source review: PASS containing ALL literals only if THIS exact source passes. No preparation/operation before that exact verdict, and no root/unit launch unless fresh capacity passes separately. This request acknowledges the remaining capacity deficiency explicitly.

'''+ '\n'.join('- ['+n+']('+base+n+')' for n in sorted(FILES))+'\n\n```\n'+'\n'.join(tokens(index))+'\n```\n'
DEST.mkdir()
def save(n,r):
    with (DEST/n).open('xb') as f:f.write(r)
save('actual-request-body.txt',body.encode());save('tooling-source-index.json',canonical(index)+b'\n');save('current-boundaries-before-request.json',canonical(evidence)+b'\n');save('actual-capacity-direction-original.json',direction_raw);payload=canonical({'body':body})+b'\n';save('payload-original.json',payload);save('post-intent.json',canonical({'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sourceCommit':HEAD,'neverRetry':True,'capacityFitsReference':False,'newOperations':0})+b'\n')
actual=None
try:
    r=subprocess.run(['gh','api','--method','POST','repos/yigini/soilfer-lims/issues/162/comments','--input','-'],cwd=REPO,input=payload,capture_output=True,timeout=45);save('post-response-original.json',r.stdout);save('post-stderr-original.log',r.stderr)
    if r.returncode==0:actual=exact_json(r.stdout)
except subprocess.TimeoutExpired as e:save('partial-stdout.log',e.stdout or b'');save('partial-stderr.log',e.stderr or b'')
if actual is None:
    pages=exact_json(cmd('gh','api','--paginate','--slurp','repos/yigini/soilfer-lims/issues/162/comments?per_page=100'));save('reconcile-original.json',canonical(pages)+b'\n');matches=[v for page in pages for v in page if v.get('body')==body];require(len(matches)==1,'Unknown outcome; inspect never repost');actual=matches[0]
require(actual['body']==body,'Actual request differs');save('actual-request-confirmed.json',canonical(actual)+b'\n')
print(json.dumps({'status':'NEW_COMPLETE_BUDGET_EXACT_SOURCE_REVIEW_POSTED_ONCE','id':actual['id'],'url':actual['html_url'],'createdUtc':actual['created_at'],'sourceCommit':HEAD,'capacityFitsReference':False,'newOperations':0}))
