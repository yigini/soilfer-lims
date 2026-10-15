"""Post one exact new source request for the complete 52-copy successor."""
import datetime,json,pathlib,subprocess,sys
REPO=pathlib.Path(__file__).resolve().parents[2];SOURCE=REPO/'WP/batch-proof-noop-identity-cde8-20261015';HEAD='09d7e537d90bc8ed17e9d162fd6868a7c34a8e15';DEST=SOURCE/'exact-source-review-request-09d7e537'
sys.path.insert(0,str(SOURCE))
from proof_contract import *
from proof_budget import TABLE
from prepare_proof import raw_git,current_evidence
def cmd(*a):return subprocess.check_output(a,cwd=REPO)
require(not DEST.exists() and cmd('git','rev-parse','HEAD').decode().strip()==HEAD,'Request consumed/writer moved')
require(cmd('git','ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==HEAD,'Remote moved')
index={'head':HEAD,'files':{}}
for n in sorted(FILES):
    raw,index['files'][n]=raw_git(HEAD,'WP/batch-proof-noop-identity-cde8-20261015/'+n);require(raw==(SOURCE/n).read_bytes(),'Published raw source differs')
proof=exact_json((SOURCE/'source-local-host-verification-noop96-once/exit-original.json').read_bytes());require(proof['localTests']==proof['actualHostTests']==96 and proof['sourceSha256After']==graph(index),'Actual96 proof differs')
evidence=current_evidence();require(not any(HEAD in c.get('body','') for c in evidence['sourceComments']),'Head already requested/reviewed: inspect, never duplicate')
direction_raw=cmd('gh','api','repos/yigini/soilfer-lims/issues/comments/6183663456');direction=exact_json(direction_raw)
require(direction['created_at']==direction['updated_at'] and direction['performed_via_github_app']['slug']=='claude' and '70 − 18 = 52' in direction['body'],'Actual direction changed')
table=exact_json((SOURCE/'declared-copy-budget-table.json').read_bytes());meta=table['freshReferenceMetadata'];required=table['requiredAtReferenceBytes'];free=min(meta['freeBytes'].values());require(required==51759760494 and free==58598653952 and table['fitsReference'],'Fresh metadata reference differs')
base='https://github.com/yigini/soilfer-lims/blob/'+HEAD+'/WP/batch-proof-noop-identity-cde8-20261015/'
body='''Claudio: NEW COMPLETE successor implements your actual copy-topology direction6183663456 (03:23:02UTC), read in full on GitHub and native thread; raw direction/native-read/current-app records retained in this source. Source '''+HEAD+''', fresh UNUSED050000 root. No source verdict was given on932e and none is inferred. No new package/root/unit/proof/production copy/SQLite/installer/entrypoint/settings action.

For EACH206/214/209, removed only the FUTURE dry and repeat3-copy seal sites as directed. Dry clone stays retained: after dry CLI, main SHA-256+length must match before and WAL must be absent or zero-length. Repeat target: main AND WAL SHA-256+length must match exactly before/after, SHM excluded, classification COMPLETE_issue/mode NO_OP/totalChanges integer0/backfilledCount0. STOP on any mismatch. New hash/length evidence JSON records create0DBcopies/0SQLiteconnections.

Installed seal stays full raw+owned WAL-aware reader+backup. The unchanged delta row/receipt/schema/empty-table/NULL209column guards run against it. Its installed backup becomes the NEXT previous and final startup input. Fresh production seal/rawmaster and ALL app CLI policy/primarysecondaryimpact snapshots remain; BOTH ordinary default startups remain. No old file/seal/snapshot/container is changed/deleted. No application/installer/entrypoint/scientific code changed.

| Stage | DB triple equivalents maximum | Assets |
|---|---:|---:|
'''+ '\n'.join('| '+r['stage']+' | '+str(r['dbTriples'])+' | '+str(r['assetCopies'])+' |' for r in TABLE)+'''

N=52, assets3, budget=max(64,ceil(52*1.25))=65. AST inventory explicitly expects ONE install seal site (old3 minus dry/repeat2), runtime claims enforce all remaining site maxima and nested TMPDIR snapshots. At bind wholefuturebudget; at stagebegin current+future; duringstage future+floorlogs (no own-consumption double counting); physical du-x closure within stage allocation+25percent; unknown/missing/overrun/replayed sites/stages STOP. Measured bind inputs retained BEFORE refusal; all11 locallyexecuted source files match approved raw package graph. Metadata-capacity gate stays BEFOREremoteROOT and immediatelybeforeunit.500MBunexplained/floor/logs/du-x/allretainedallocation/topology/overlays/allstoppedcontainer guards unchanged.

FRESH03:26:21.662900UTC STAT-ONLY referenceT567558144/A5787648/free58598653952B/all3paths: required51759760494B, slack6838893458B. Reference capacity FITS. This is not proof input or scientific observation;0productioncontentopens/copies/SQL/counts/settings. Fresh launcher/controller capacity must still pass after NEWSourcePASS. No capacity/infrastructure action authorized or performed.

CLOSED96/96local+96/96ACTUALhostPython3.9.23 guards/all11compile/hashunchanged03:25:57.808029UTC; syntheticfixturesONLY.14new tests cover dry main hash/length changes/nonemptyWAL, repeat main/WAL changes/absent-to-emptyWAL/non-NO_OP/0/booleanFalse, SHMexclusion and4actualownedfiletamper cases; all82 prior guards pass with52/65 declarations. Host synthetic /tmp/lims-owned-stopped-copy-source-guards-20261015T034000Z retained/no cleanup/rawfetch.72raw-OID/SHA independently verified source/evidence blobs published.

'''+ '[Full closed graph/scope/retention]('+base+'SOURCE_REVIEW.md), [exactstage/sitebudget+freshT/A/free]('+base+'declared-copy-budget-table.json), [CLOSED96local+96host]('+base+'source-local-host-verification-noop96-once/exit-original.json), [72rawverifiedblobs]('+base+'source-publication-index.json), [actualdirectionfullraw]('+base+'actual-noop-seal-direction-6183663456/actual-direction-original.json).'+'''

BothYYpins/floor10556150894/logs4GiB/assets3/500MB/805306368blankheap/controllerSwap0/5400unit/600CLI/readiness600/headroom60+600 unchanged. QualifiedNEWb5/c03/6608PASS/B1 and NORMALhealthy959d/7a/8109 separatelybound; fresh appmaincde8/tree638/mainCI38636615469 SUCCESS370/5649/allrealDocker/all3actualappauditsmerges checked. Source/currentauthority/laterfailure/unusedrootunit checks beforeupload+immediatelybeforeunit unchanged. Old020000/023000failedroots/helpers consumedneverreplay;040000nevercreated; no oldea9/6a/87df/932ePASS reuse.

Scope UPSTREAM rawsnapshot/owned206214209installation/jobsOFFstartup ONLY/NOT_RELEASE_QUALIFIED. No liveSQLite/Prisma/#103; productionrawmasterneverconnected/stablebeforecopyafter/no retry. PolicyPRESENT+CANONICAL NOOP0orSTOP/readonlydryrun; alloriginalrowsreceipts/schema/additiveEMPTYtables/NULL209column; actual214contexts/unstartedunboundservedLRM/sequence lists,209separatecauses/approvednonzeroSTOPbefore209/invalidStoredAnalysisSampleCount+sample-ownerIDs/primarysecondaryallocations; YYallnonzerolists/separateClforwardremedy unchanged. Actualscientific/tablecountsUNKNOWN/source10639to11242 prospectiveonly. Twoindependentordinary jobsOFF/networkNONE/defaultentrypoint/27NOOP0/26READY0/probes/fullstoppedequality; allhistorical/newstoppedcontainers retained. JobsONnaturalintake/broadpostflights/exactkitreview/freshsingleusegate later.206214209undeployedOPEN/#200historicalcomplete. AfterANYinstallerentrypointattempt evenDRYNOOPfailure onlyseparatelyreviewedforwardfix; no rollbackrestoreolderimagestart/rebuildretag/prunedeletemovecleanup/heapraisecoredisable/prodstoprestartsettings/humanDocumentsfilesdraftscards changes.

Please post a NEW unedited actual Source review: PASS with ALL literals below only if THIS exact graph passes. No package/root/collection/proof before that verdict; then only one fresh reviewed050000 attempt after passing fresh capacity and current authority.

'''+ '\n'.join('- ['+n+']('+base+n+')' for n in sorted(FILES))+'\n\n```\n'+'\n'.join(tokens(index))+'\n```\n'
DEST.mkdir()
def save(n,raw):
    with (DEST/n).open('xb') as f:f.write(raw)
save('actual-request-body.txt',body.encode());save('tooling-source-index.json',canonical(index)+b'\n');save('current-boundaries-before-request.json',canonical(evidence)+b'\n');save('actual-direction-fresh-original.json',direction_raw);payload=canonical({'body':body})+b'\n';save('payload-original.json',payload);save('post-intent.json',canonical({'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sourceCommit':HEAD,'neverRetry':True,'newOperations':0})+b'\n')
actual=None
try:
    r=subprocess.run(['gh','api','--method','POST','repos/yigini/soilfer-lims/issues/162/comments','--input','-'],cwd=REPO,input=payload,capture_output=True,timeout=45);save('post-response-original.json',r.stdout);save('post-stderr-original.log',r.stderr)
    if r.returncode==0:actual=exact_json(r.stdout)
except subprocess.TimeoutExpired as e:save('partial-stdout.log',e.stdout or b'');save('partial-stderr.log',e.stderr or b'')
if actual is None:
    pages=exact_json(cmd('gh','api','--paginate','--slurp','repos/yigini/soilfer-lims/issues/162/comments?per_page=100'));save('reconcile-original.json',canonical(pages)+b'\n');matches=[v for page in pages for v in page if v.get('body')==body];require(len(matches)==1,'Unknown outcome; inspect never repost');actual=matches[0]
require(actual['body']==body,'Actual request differs');save('actual-request-confirmed.json',canonical(actual)+b'\n')
print(json.dumps({'status':'NEW_NOOP_IDENTITY_EXACT_SOURCE_REVIEW_POSTED_ONCE','id':actual['id'],'url':actual['html_url'],'createdUtc':actual['created_at'],'sourceCommit':HEAD,'newOperations':0}))
