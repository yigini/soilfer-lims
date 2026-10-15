"""Retain source-review follow-ups without changing the frozen active runner."""
import datetime,hashlib,json,pathlib,subprocess
R=pathlib.Path(__file__).resolve().parents[2];D=R/'WP/startup-order-readiness-20261015';BASE='eef826a3213a51135ee5a4e9593c984306c14ae8'
def cmd(*a):return subprocess.check_output(a,cwd=R,stderr=subprocess.PIPE)
def sha(b):return hashlib.sha256(b).hexdigest()
assert cmd('git','rev-parse','HEAD').decode().strip()==BASE and not cmd('git','diff','--cached','--name-only').strip()
assert cmd('git','ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==BASE
full=D/'full-ordinary-once';assert not (full/'summary.json').exists();frozen=json.loads((full/'source-before.json').read_bytes());assert all(sha((R/n).read_bytes())==v for n,v in frozen.items())
utc=datetime.datetime.now(datetime.timezone.utc).isoformat();headers=[line for line in (full/'stderr-original.log').read_text(encoding='utf-8').splitlines() if line.startswith(('PASS ','FAIL '))]
cutoff=datetime.datetime(2026,10,15,11,11,25,tzinfo=datetime.timezone.utc).timestamp();files=sorted([p for p in (R/'server/tests/.tmp').glob('startup-readiness-*/owned.db') if p.stat().st_mtime<=cutoff],key=lambda p:p.stat().st_mtime,reverse=True)[:6]
observed=[]
for p in files:
 with p.open('rb') as fd: header=fd.read(20)
 observed.append({'path':p.relative_to(R).as_posix(),'headerReadWriteVersions':list(header[18:20]),'walPresent':p.with_name(p.name+'-wal').exists()})
sources=['server/utils/startupReadinessContext.js','server/scripts/install_order_revisions.js','server/tests/contracts/startup_readiness_context.test.js','server/tests/helpers/workflowWriteScanner.js']
note={
 'status':'SOURCE_REVIEW_FOLLOWUPS_REQUIRED_AFTER_CURRENT_FULL_RUN_CLOSES_NOT_A_TEST_RESULT',
 'observedUtc':utc,'sourceAudit':BASE,'activeRunner':{'helper':'verify-startup-context-full-ordinary-once.py','session':76923,'inventory':373,'expectedTests':5672,'status':'RUNNING_METADATA_ONLY','observedCompletedSuiteHeaders':headers,'notFinalResult':True},
 'frozenSourceUnchanged':True,'closedFocusedResult':'3 suites /23 tests PASS; bounded to fixtures actually exercised',
 'sourceBindings':{n:sha((R/n).read_bytes()) for n in sources},
 'requiredNext':[
  {'work':'Wait for SAME frozen full runner to close; retain originals honestly before any edits. No interrupt/replay/concurrent runner. Inspect ALL actual failures first.','priority':1},
  {'work':'Verify WAL-mode coverage on new owned fixtures: empty/absent WAL and genuine nonempty WAL with an idle owned writer. Full26 legacy/context report equality, integrity/FK exactly once for stable bytes, one policy snapshot, unchanged original copy/hash/race guards. The existing focused fixtures sampled here use rollback-journal header versions1/1. No WAL-mode failure has been measured yet; do not invent one or a cache normalization fix.','priority':2,'closedFixtureHeaderObservationsFilesystemOnly':observed},
  {'work':'Add the earlier order race case: mutate ORIGINAL after order captures its policy snapshot but BEFORE its nested chart prerequisite. Compare exact legacy refusal code. Current context order branch passes target(original) to chart whereas the default path passes copy. That can refresh/rebind the shared snapshot mid-order instead of preserving the order snapshot and reaching the existing final ORDER_REVISION_SNAPSHOT_CHANGED guard. Verify and repair using the SAME pinned retained snapshot for nested chart/policy; preserve independent original-path validation, source-digest checks and final original hash guard. No new STOP/code or trigger change. This is source-inspection concern, not an executed new test result.','priority':3},
  {'work':'Inspect actual workflow scanner results. Source inspection finds a new read-only test canary DELETE FROM WorkItem, dynamic db.exec(sql) in its mutation helper, dynamic .pragma/.prepare forwarding in the new context and instrumentation. Existing scanner is intentionally fail-closed on protected SQL/unknown SQL. Do not weaken scanner predicates, add a general runtime writer exemption, hide forwarding through reflection, or change stock test assertions. Prefer explicit shared integrity/FK helpers using literal SQL and a module-private WeakMap bound only through the explicit startup context; keep private readonly reader lifecycle. A normal generic method binding can replace the unnecessary prepare-forwarding wrapper. New test canary may use harmless literal canary-table DDL on the readonly file; test mutation actions should be closed literal DDL, and instrumentation can use explicit known pragma calls. Replace the SQL-hook race test with an owner-result/snapshot-path hook so tests need no opaque SQL forwarder. Retain failed source bytes/results before successors. The actual full scanner outcome is still pending.','priority':4},
  {'work':'Only after these follow-ups and all existing policy/chart/order tests pass unchanged should source-only codex/* PR preparation proceed. If source changes, use new meaningful focused/full successors as warranted; never rerun consumed helpers. Actual CI and exact-head Claudio PASS remain required.','priority':5}
 ],'productionOperations':0,'cleanupReplayed':False,'appPrReady':False}
out=D/'private-context-review-followups-while-full-open.json';assert not out.exists();out.write_text(json.dumps(note,indent=2),encoding='utf-8')
lead='''## 2026-10-15 startup DRAFT23PASS / full373 ACTIVE / source-review follow-ups REQUIRED

Source remains eef826a3 DRAFT34app paths with closed3suites23PASS and full373/expected5672 runner session76923 ACTIVE since11:14:18UTC. No source edits/interruption/replay/concurrentrunner while frozen. New source-inspection follow-ups are recorded in WP/startup-order-readiness-20261015/private-context-review-followups-while-full-open.json. AFTER full closes and actual failures are retained: verify empty/nonempty WAL-mode counters (current sampled closed fixtures header1/1); test original-file change between order policy snapshot and nested chart and keep SAME pinned snapshot/final ORDER_REVISION_SNAPSHOT_CHANGED semantics; inspect scanner findings from new canary/dynamic forwarding and fix new code/tests without weakening stock scanner or hiding SQL. These are review concerns, not newly executed test outcomes. No source-only PR readiness even if the current full run passes until these cases are resolved. Original focused23PASS remains valid for its actual cases only. Full active logs remain OPEN/not a final result. Existing policy/chart/order tests remain unchanged. No new CI/build/proof/deploy/SQL/liveDB/settings/restart/cleanup operation. All earlier source/scientific/600/805306368/retention/no103/samewriter/forward-only guards hold.

'''
readme=R/'WP/audit-release-eb6de2e8/README.md';readme.write_bytes(lead.encode()+readme.read_bytes())
paths=[out,readme,pathlib.Path(__file__)];names=[p.relative_to(R).as_posix() for p in paths]
cmd('git','-c','core.autocrlf=false','add','-f','--',*names);assert set(cmd('git','diff','--cached','--name-only').decode().splitlines())==set(names)
tree=cmd('git','write-tree').decode().strip()
for p,n in zip(paths,names):
 b=cmd('git','show',tree+':'+n);oid=cmd('git','rev-parse',tree+':'+n).decode().strip();assert b==p.read_bytes() and hashlib.sha1(('blob '+str(len(b))+'\0').encode()+b).hexdigest()==oid
cmd('git','commit','-m','Record startup context review follow-ups during frozen full run');head=cmd('git','rev-parse','HEAD').decode().strip();cmd('git','push','origin','audit/release-eb6de2e8');assert cmd('git','ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head
assert all(sha((R/n).read_bytes())==v for n,v in frozen.items())
print(json.dumps({'head':head,'rawVerifiedOwnedBlobs':len(paths),'fullStillOpen':not (full/'summary.json').exists(),'observedSuiteHeaders':len(headers),'observedFailHeaders':[h for h in headers if h.startswith('FAIL ')],'sourceFrozenUnchanged':True,'appPrReady':False}))
