"""One new exact-source review for fallback accounting build graph; no build authority inferred."""
import datetime,json,pathlib,subprocess,sys
REPO=pathlib.Path(__file__).resolve().parents[2]
SOURCE=REPO/'WP/batch-build-containerd-cde8-20261015'
TOOLING='6608548a58dd4bf581da4330f1cd7b0f68a86973'
DEST=SOURCE/'exact-source-review-request-6608548a'
def cmd(*a):return subprocess.check_output(a,cwd=REPO)
assert not DEST.exists() and cmd('git','rev-parse','HEAD').decode().strip()==TOOLING
assert cmd('git','ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==TOOLING
sys.path.insert(0,str(SOURCE))
from batch_build_contract import *
from prepare_batch_build import raw_git,current_evidence
index={'head':TOOLING,'files':{}}
for n in sorted(SOURCE_FILES):
    raw,index['files'][n]=raw_git(TOOLING,'WP/batch-build-containerd-cde8-20261015/'+n);require(raw==(SOURCE/n).read_bytes(),'Published source differs')
direction_raw=cmd('gh','api','repos/yigini/soilfer-lims/issues/comments/6180234041');direction=json_exact(direction_raw)
failed_raw=raw_git(REFERENCE_FILES['original-build-failure.json']['audit'],REFERENCE_FILES['original-build-failure.json']['path'])[0]
analysis_raw=raw_git(ANALYSIS_AUDIT,REFERENCE_FILES['metadata-analysis-original.json']['path'])[0]
fallback_evidence(direction,json_exact(failed_raw),json_exact(analysis_raw));current=current_evidence()
history=cmd('gh','api','--paginate','--slurp','repos/yigini/soilfer-lims/issues/162/comments?per_page=100');require(not any(TOOLING in v.get('body','') for p in json_exact(history) for v in p),'Existing exact source notice; never duplicate')
base='https://github.com/yigini/soilfer-lims/blob/'+TOOLING+'/WP/batch-build-containerd-cde8-20261015/'
body='''Claudio: targeted metadata succeeded, but adoption is refused; NEW concrete corrected Docker+containerd BUILD-ONLY source for exact review, under your6180234041 fallback.

I read your actual targeted8df SourcePASS6181164638 and later-validator caution. The ONE000500capture completed00:02:26.298363UTC/7.431630seconds/133metadatareadsALLexit0/0problems. It retained all complete catalogues/59Committedexactchain+parents/59info+59usagepairs/379cache records/6smallOCIobjects/freshinspectbyteexactc4/all3FSfloorPASS. [All476verified originals](https://github.com/yigini/soilfer-lims/blob/2f7594ac4596ae71e2f912533f371c1492165cb6/WP/batch-forward-metadata-cde8-20261014/targeted-metadata-000500-closed-originals/index.json) bind actualONE invocation1fdffe01c57e4b9f8a26cdc9a1b579fc and successfuldeactivation journal. Transientunit was unloaded afterward; not-found systemctl defaults are retained honestly, not claimed as executed limits. No metadata replay or adoption occurred.

[Retained-only analysis850cc](https://github.com/yigini/soilfer-lims/blob/850cc7670aceaa4fc2823aa3e0b5b5cf58c347da/WP/batch-forward-metadata-cde8-20261014/retained-targeted-analysis-no-adoption-once/index.json) classifies58snapshots during actualfailedbuild22:33:26.906969–22:38:24.457022UTC/1older;379cache records/68createdthen/58Shared10unshared. Usage/cache sizes are rounded; shared cache overlaps image storage; exact OCI compressed descriptor lengths are not a measured physical before/after union. Missing pre-build containerd allocation remains UNKNOWN. Pointtotals are retained as rounded/non-disjoint/uncredited. Creditedgrowth0;3,609,116,672B remains unproved>=500MB STOP. Image1d remains excluded, no adoption receipt. First221500FAILED/233000STOP/000500evidence-only success stay immutable.

You explicitly directed: if conditions2–4 cannot be shown, keep image excluded and send new build source with corrected Docker+containerd accounting for review instead. Here is NEW exact tooling '''+TOOLING+''' with a complete five-file graph, current20local+20actualhostPython3.9pure guard PASS/all5compile/hashunchanged CLOSED00:16:03.366342UTC/no operator run. All19source-publication blobs independently rawOIDverified and pushed. No server/client/Dockerfile/CI source changed.

'''+ '\n'.join('- ['+n+']('+base+n+')' for n in sorted(SOURCE_FILES))+'''

[Full scope/limits/failure cases](BASEREADME.md), [closed source verification](BASEsource-local-host-verification-once/exit-original.json).

Proposed NEW root /opt/lims/releases/workflow-batch-build-cde8c889-20261015T010000Z/package/unit UNCREATED. Old build/metadata approvals do not approve it. The graph measures exact physical integer allocations before and after across the NEW ownedroot, disjoint /var/lib/docker/{buildkit,overlay2,image,containerd}, and REQUIRED /var/lib/containerd. Docker volumes are excluded; no database connection. One bounded `du -s -B1` invocation per measurement counts hardlinks once. Complete rows/real devices/aliases/required absence/descendant mounts are guarded. The whole-store physical measurement is proposed here for a NEW build, not a metadata/adoption replay. Each call120seconds/64KiB; the old read-only whole-store probe timed out60seconds and remains retained. Incomplete/timed-out measurement stops this new preflight with newBuildCount0; no estimate/retry/bound widening.

Docker root/overlayfs/containerd snapshotter and active default-config containerd service plus top-level version3/root=/var/lib/containerd/state=/run/containerd must be actual and stable. Full config is not persisted; selected facts/full-outputSHA only, explicitly labeled. Both topology checks/daemonPID/configSHA/devices must match. Bound3filesystems use same10556150894floor and4GiBbuildallocationreserve. Exact per-device free-space drop versus all disjoint measured allocation growth keeps500000000unexplainedSTOP; shrink and different-filesystem credits cannot hide shortage.

New exclusive accounting-preflight intent/refusal terminal consumes the new boundary. Any pre-build failure records BUILD_PREFLIGHT_REFUSED_NOT_BUILT_RETAIN_ALL/newBuildCount0. Any post-build topology/allocation/reserve/growth failure retains a new FAILED result and no successful receipt. All originals/partiallogs/images/roots remain. No restoration/older-image-start/retry/override/cleanup.

Please specifically review CACHE ID behavior: ONE ordinary unchanged Docker build from audited rawGitcde8/tree638 may return the SAME1dimage ID through normal cache. There is no explicit retag/pull/no-cache/oldroot operation. It would create a separately qualified new build invocation/receipt with the new measured before/after baseline, not adopt/retroPASS the first failure or explain its missing before-state. The proposed new receipt BUILT_AFTER_EXCLUDED_ACCOUNTING_FAILURE_NOT_PROVED_OR_DEPLOYED cites originalfailure4474dc and excludedanalysisc2f4fc/850cc, binds actual new source/application/log/inspection/accounting and states oldfailurestillfailed. It is not a stopped-production-copy proof/kit/deploy approval.

Dockerbuildtimeout REDUCED2400→1800; unit2700 unchanged/Restartno/UMask0077 with controllerMemoryMax805306368/Swap0/blankouterNODE_OPTIONS. This governs owned controller/CLI children, not Docker/containerd daemon/build-worker config, which is unchanged. No heap raise/coredisable/production volume/containerstart/SQLiteconnection/installer/default-entrypoint/proof/deployment. Both YYpins unchanged. Immutable24filepackage includes full actual fallbackdirection and digest-bound originalfailure/adoption-refusalanalysis along with reviewedgraph/rawapplication/newactualPASS/currentmainCI/all3issuePASS+merge records. Fresh review/main/CI/issue audits/fallback/rejection checks before upload and again before launch; once-only roots/intents/unusedunit/unknown outcome same-root inspection.

All eventual separate stoppedproduction-copy proof, policyPRESENT/NO_OP0orSTOP,214chart+unstarted-unboundservedLRM/209causesapprovedrefusals+invalidStoredAnalysisSampleCount/sample-owner lists, retainedsnapshot/assets/logallocation, nonzeroYY/approved-amendmentnonzeroSTOP/separateforwardremedy/exactkit/freshgate remain.206214209undeployedOPEN/currentmaincde8/production#200959dimage7aeb unchanged. #103 no connection/APPLYGO; humanDocuments/files/drafts/cards/history untouched.

Please review THIS concrete graph. If it passes, start a NEW verdict `Source review: PASS` and include ALL literal bindings below. Direction alone/oldPASS does not authorize any new build; this review would cover only one new build-only qualification, not proof/kit/deploy:

```
'''.replace('BASE',base)+'\n'.join(review_tokens(TOOLING,index))+'\n```\n'
DEST.mkdir()
def save(n,raw):
    with (DEST/n).open('xb') as f:f.write(raw)
for n,raw in {'actual-fallback-direction-original.json':direction_raw,'original-failed-build-record.json':failed_raw,'excluded-metadata-analysis-original.json':analysis_raw,'history-before-original.json':history,'actual-review-request-body.txt':body.encode(),'tooling-source-index.json':(json.dumps(index,indent=2)+'\n').encode(),**current}.items():save(n,raw)
payload=(json.dumps({'body':body},ensure_ascii=False)+'\n').encode();save('request-payload-original.json',payload)
save('post-intent.json',(json.dumps({'startedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'toolingCommit':TOOLING,'neverRetry':True,'newBuildAuthority':None,'originalImageStillExcluded':True})+'\n').encode())
try:
    r=subprocess.run(['gh','api','--method','POST','repos/yigini/soilfer-lims/issues/162/comments','--input','-'],cwd=REPO,input=payload,capture_output=True,timeout=60)
    save('post-response-original.json',r.stdout);save('post-stderr-original.txt',r.stderr);actual=json_exact(r.stdout) if r.returncode==0 else None
except subprocess.TimeoutExpired as e:
    save('post-response-partial.txt',e.stdout or b'');save('post-stderr-partial.txt',e.stderr or b'');actual=None
if actual is None:
    after=cmd('gh','api','--paginate','--slurp','repos/yigini/soilfer-lims/issues/162/comments?per_page=100');save('reconcile-original.json',after)
    matches=[v for p in json_exact(after) for v in p if v.get('body')==body];require(len(matches)==1,'Unknown outcome; never repost');actual=matches[0]
require(actual['body']==body,'Actual review request differs');save('actual-request-confirmed.json',(json.dumps(actual,indent=2,ensure_ascii=False)+'\n').encode())
print(json.dumps({'status':'CORRECTED_CONTAINERD_BUILD_SOURCE_REVIEW_POSTED_ONCE','id':actual['id'],'url':actual['html_url'],'createdUtc':actual['created_at'],'toolingCommit':TOOLING,'newBuildAuthority':None,'originalImageStillExcluded':True}))
