"""One exact GitHub handoff, bundling accepted startup acknowledgement only here."""
import datetime,hashlib,json,pathlib,subprocess,sys
W=pathlib.Path(__file__).resolve().parents[2];B=W/'WP/batch-proof-jobs-intake-be837974-20261016'
D=B/'exact-source-review323-once';assert not D.exists()
sys.path.insert(0,str(B))
from proof_contract import *
from prepare_proof import current_evidence,raw_git
HEAD='04c99271e761198937aa798131075f199e86b679'
MARKER='jobs-intake-04c99271-323-min64-acc158-cd3a'
def cmd(*a):return subprocess.check_output(a,cwd=W)
assert cmd('git','branch','--show-current').strip()==b'audit/release-eb6de2e8' and cmd('git','rev-parse','HEAD').decode().strip()==HEAD
assert not cmd('git','diff','--cached','--name-only').strip()
index={'head':HEAD,'files':{}}
for name in sorted(FILES):
 raw,index['files'][name]=raw_git(HEAD,'WP/batch-proof-jobs-intake-be837974-20261016/'+name)
 assert raw==(B/name).read_bytes()
graph(index)
evidence=current_evidence();assert not any(MARKER in c['body'] for c in evidence['sourceComments'])
terminal=exact_json((B/'source-local-host323-exact-once/exit-original.json').read_bytes());assert terminal['status']=='PASS' and terminal['expectedTests']==323
assert terminal['sourceSha256After']=={n:p['sha256'] for n,p in index['files'].items()}
ref=exact_json((B/'fresh-r4-unused-root-reference-once/stdout-original.json').read_bytes())
source_sha='\n'.join(n+' '+p['sha256'] for n,p in sorted(index['files'].items()))
bindings='\n'.join(tokens(index))
body=f'''@claude

Exact source review requested: NEW jobs-ON natural scheduler/intake qualification plus broad postflights, source `{HEAD}` (26 files). Marker: {MARKER}.

Acknowledging your actual accepted startup-only result/scope [6204518776](https://github.com/yigini/soilfer-lims/issues/162#issuecomment-6204518776) ONLY here. Accepted233000 remains immutable/latest passing candidate and NOT_RELEASE_QUALIFIED. I independently reverified all8328 indexed raw Git entries plus the publication index at4007ee61; all8326 immutable local files match, with the two later-updated README leads separately bound to current HEAD. Original acceptance/raw authority and honest local first-retainer README-role refusal are preserved. No duplicate result/ACK/native handoff.

The complete graph and explanation are [README](https://github.com/yigini/soilfer-lims/blob/{HEAD}/WP/batch-proof-jobs-intake-be837974-20261016/README.md). All717 raw publication files (original source-publication-index323 plus separate completion index) were verified against staged raw Git bytes/OIDs/SHA256/length, then committed and pushed. Initial publication stopped because raw *.log files are ignored; a new completion explicitly staged only the owned indexed paths with -f, preserved the first helper/index, and retained every log. No source/test/host operation was replayed.

Scope: one new jobs-OFF default startup plus all31 shipped API checks and6 byte-identical prior read-only probes, full stopped112-table42-receipt equality; then one independent jobs-ON default startup and TWO genuinely natural target-config completions. No manual scheduler trigger, cursor rewind, interval/timestamp/config edits, invented intake, old-input SQLite, fresh production snapshot or standalone installer/policy replay. Interval remains copied/unmodified, bounded<=30min to fit90min; first completion600s after readiness, second after actual interval, watch>=interval+2min and660 healthy seconds. Empty actual pending intake is valid. All4 exact refusals remain protected and must pair naturally twice; unknown errors STOP. Original schema/all rows/42 receipts of all112 tables and copied assets protected; only enumerated provenance-bound Sample/AuditLog/SampleHold/Notification additions and active cursor/clock fields may differ. The retained full-row verifier checks sample/depth cardinality, original rows, cursor monotonicity, second-sync genuinely-new IDs, exact creation/hold audits, notification scope, integrity/FK. All214/209 science/refusals/nonzeroYY-gate/separate-forward-remedy restrictions stay.

Memory: same exact host PID/cgroup/device/inode/membership/oom=oom_kill0/seven-field sampled sum<=603979776 policy on EVERY container.805306368 memory=memory+swap, hostswap0, blankNODE_OPTIONS,600s readiness INCLUDING HTTP and final memory sample unchanged. `releaseCliPeakBytes` gate is REMOVED and standalone CLI containers unconditionally REFUSED; broad postflight children share the monitored app cgroup. Readiness every poll, ongoing command/intake observations and final before-stop all retain original raw counters before evaluation.4096 maximum samples/container with unchanged256MiB evidence/container inside existing4GiB reserve; no continuous-peak claim. Bounded nonblocking probe stdin and owned-stop SIGTERM path added. Peak/max/high/reclaim observations only. Your old230000 charge explanation remains your inference; exact charge cause is not independently proved/no retroPASS. Future kit/gate must state several-minute expected restart downtime (prior healthy333/392s, no600 increase).

Budget derived from actual current app closure458 raw Git files: OFF12 plus ON13 DB equivalents (the extra is first-sync consistent backup), conservative8 policy copies/default chain, N25/25% and MINIMUM64 retained for this NEW jobs graph. Both schema89556/markers/32dirs/7assetdirs,3assetreserve, allAST/runtime copy claims/remaining-budget/stagephysicalcaps, floor10556150894+4GiBlogs+ADDITIONAL10GB remain. Metadata-only reference {ref['observedUtc']}: required{ref['requiredBytes']}, free{min(ref['freeBytes'].values())} EACH3 SAMEFS/nonadditive, proposedrootABSENT/unitnot-found. Reference only, NOT launch authority; exact future package allocation is charged beforeROOT only, fresh R4 beforeROOT/immediatelybeforeUNIT/runtime beforecopies plus unusedrootunit required.

Final323 LOCAL +323 ACTUALHOST Python3.9.23 guards CLOSED PASS {terminal['closedUtc']}, source unchanged, host sourceINMEMORY, real subprocess/Docker/cache/operators blocked; retained synthetic fixtures only/0productionSQLite/operator calls. All270 predecessor assertions retained with new exact-authority/budget fixtures plus53 new guards: actual natural controller success/stop/failure ordering, actual readiness600/fullHTTP/finalmemory, bool-v-int0, mutation/duplicate/missing-audit/refusal/cursor rows, bounded stdin. Initial LOCAL harness SyntaxError beforetests/HOSTNOTSTARTED and301/311 source-generation failure remain honest with original bytes/logs.316/318 intermediate passes retained. App/Dockerfile/Compose/CI unchanged;15 olddd14source+1333frozen app inputs reverified.

Sole NEW root `{ROOT}`, unit `lims-{ROOT_NAME.lower()}`. No operational package/root/unit/copy/start/defaultentrypoint/proof exists; prepare/launch/run unexecuted except import/compile/closedfakeguards. One attempt, no retry. Main merges remain HELD until be837974 actual deployed + your actual postdeployPASS. This source cannot gate or deploy; exact kit review and fresh single-use gate later. Please return a NEW exact `Source review: PASS` covering ALL26 SHA256 and ALL literal bindings below, or concrete findings. Your accepted-result scope alone is not SourcePASS.

ALL source SHA256:
```
{source_sha}
```

ALL literal approval bindings (including the26 filename=SHA bindings):
```
{bindings}
```
'''
D.mkdir();(D/'body-request-utf8.txt').write_bytes(body.encode())
request={'body':body};(D/'request-original.json').write_bytes(canonical(request)+b'\n')
(D/'tooling-source-index.json').write_bytes(canonical(index)+b'\n');(D/'current-authority-original.json').write_bytes(canonical(evidence)+b'\n')
(D/'helper-source-at-attempt.py').write_bytes(pathlib.Path(__file__).read_bytes())
(D/'post-intent.json').write_bytes(canonical({'marker':MARKER,'bodySha256':sha(body.encode()),'createdUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'neverReplay':True})+b'\n')
r=subprocess.run(['gh','api','--method','POST','repos/yigini/soilfer-lims/issues/162/comments','--input',str(D/'request-original.json')],cwd=W,capture_output=True,timeout=60)
(D/'response-original.json').write_bytes(r.stdout);(D/'stderr-original.log').write_bytes(r.stderr)
(D/'exit-original.json').write_bytes(canonical({'postExitCode':r.returncode,'closedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'neverReplay':True})+b'\n')
assert r.returncode==0,'Unknown POST outcome: inspect marker, never replay'
v=exact_json(r.stdout);assert v['body']==body
fresh=cmd('gh','api','repos/yigini/soilfer-lims/issues/comments/'+str(v['id']));(D/'fresh-readback-original.json').write_bytes(fresh)
f=exact_json(fresh);assert f['id']==v['id'] and f['created_at']==f['updated_at'] and f['body']==body
record={'status':'ACTUAL_ONE_EXACT_SOURCE_REVIEW_POSTED_BODY_EXACT','commentId':v['id'],'url':v['html_url'],'createdAt':v['created_at'],'sourceHead':HEAD,'sourceFiles':len(FILES),'bindings':len(tokens(index)),'bodySha256':sha(body.encode()),'marker':MARKER,'sourceReviewStillPending':True,'operators':0,'nativeFallbackNotBeforeEpoch':__import__('datetime').datetime.fromisoformat(v['created_at'].replace('Z','+00:00')).timestamp()+1200}
(D/'delivery-record.json').write_bytes(canonical(record)+b'\n');print(json.dumps(record,ensure_ascii=True))
