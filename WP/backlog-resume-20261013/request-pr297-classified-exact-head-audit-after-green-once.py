"""Verify retained closed CI and post one exact-head audit request; never replay."""
import datetime,hashlib,json,subprocess,sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf-8')
root=Path(__file__).resolve().parents[2];wp=Path(__file__).parent
head='562cab2d24b25a500041a44abf384ffc4dbfad7c'
tree='f35ba4c974ac4ac1102d6e53146417caaa14b6da'
base='2242bcb4861a7085bb95e78e0e7b1e4edf11d1b8'
identifier=38615738432
closed=wp/'issue209-ci-38615738432-closed-terminal'
dest=wp/'pr297-classified-exact-head-audit-request'
assert not dest.exists(),'Attempt already exists; inspect remote outcome, never replay.'
def command(args):return subprocess.run(args,cwd=root,capture_output=True,check=True).stdout
def git(*args):return command(['git',*args])
def gh(path):return command(['gh','api',path])
assert git('branch','--show-current').strip()==b'audit/release-eb6de2e8'
assert not git('diff','--cached','--name-only').strip()
audit=git('rev-parse','HEAD').decode().strip()
assert git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==audit
terminal=json.loads((closed/'index.json').read_bytes())
assert git('show',audit+':'+(closed/'index.json').relative_to(root).as_posix())==(closed/'index.json').read_bytes()
assert terminal['status']=='CLOSED_SUCCESS' and terminal['run']==identifier and terminal['head']==head and terminal['base']==base
assert terminal['passedSuites']==370 and terminal['passedTests']==5642 and terminal['exactFullInventoryMatch']
assert terminal['exactJestSummary']==['Test Suites: 370 passed, 370 total','Tests:       5642 passed, 5642 total']
for name,pin in terminal['files'].items():
 data=git('show',audit+':'+(closed/name).relative_to(root).as_posix())
 assert len(data)==pin['bytes'] and hashlib.sha256(data).hexdigest()==pin['sha256'],name
proofs={}
for line in (closed/'docker-readiness-original.log').read_text(encoding='utf-8-sig').splitlines():
 pos=line.find('{')
 if pos<0:continue
 try:entry=json.loads(line[pos:])
 except json.JSONDecodeError:continue
 for key in ['policyChartEntrypointProof','orderRevisionEntrypointProof']:
  if key in entry:
   assert key not in proofs
   proofs[key]=entry[key]
policy=proofs['policyChartEntrypointProof'];order=proofs['orderRevisionEntrypointProof']
assert policy['scenario']=='PRE_199-default-entrypoint-COMPLETE_214'
assert policy['before']['dry']['classification']=='ABSENT' and policy['before']['dry']['totalChanges']==policy['before']['dry']['dataWrites']==0
assert policy['before']['dbWalShmPreserved'] and policy['before']['dry']['readonlySnapshot']['originalFilesPreserved']
assert policy['after']['counts']=={'LabPolicy':0,'LabPolicyOverride':0}
assert policy['after']['dbWalShmPreserved'] and policy['after']['secondaryInspectionsOnRetainedSnapshot']
for mode in ['ready','again']:
 p=policy['after'][mode]
 assert p['classification']=='PRESENT' and p['totalChanges']==p['dataWrites']==0 and p['readonlySnapshot']['originalFilesPreserved']
assert policy['after']['charts']['classification']=='COMPLETE_214' and policy['after']['charts']['totalChanges']==policy['after']['charts']['backfilledCount']==0
assert policy['after']['charts']['receipt']['originalRowsPreserved']
assert order['scenario']=='PRE_199-default-entrypoint-COMPLETE_209'
assert order['before']=={'workItemIdAbsent':True,'orderRevisions':0,'orderLines':0,'attempts':0}
assert order['retainedRowsAndReceiptsPreserved'] and order['after']['dbWalShmPreserved'] and order['after']['secondaryInspectionsOnRetainedSnapshot']
for mode in ['ready','again','impact']:
 p=order['after'][mode]
 assert p['classification']=='COMPLETE_209' and p['sourceSha256']=='5c51f423689b1c726e16c12cdce7b381574661017cdb622eb3f562957a18304c'
 assert p['totalChanges']==p['backfilledCount']==0 and p['receipt']['originalRowsPreserved'] and p['readonlySnapshot']['originalFilesPreserved']
 assert p['impact']['prospectiveApprovedAmendmentRefusalCount']==0 and p['impact']['approvedAmendmentKitGate']=='NO_APPROVED_AMENDMENT_REFUSALS'
assert order['after']['again']['mode']=='NO_OP'
impact=order['after']['impact']
assert impact['access']=='RETAINED_SNAPSHOT_ONLY' and impact['originalFilesPreserved'] and impact['productionMutations']==0
assert impact['retainedAllocation']['allocationMeasured'] and impact['retainedAllocation']['conservativeAllocationBytes']>0
before={
 'pr-before-original.json':gh('repos/yigini/soilfer-lims/pulls/297'),
 'main-before-original.json':gh('repos/yigini/soilfer-lims/git/ref/heads/main'),
 'run-before-original.json':gh(f'repos/yigini/soilfer-lims/actions/runs/{identifier}'),
 'jobs-before-original.json':gh(f'repos/yigini/soilfer-lims/actions/runs/{identifier}/jobs?per_page=100'),
 'comments-before-original.json':command(['gh','api','--paginate','--slurp','repos/yigini/soilfer-lims/issues/297/comments?per_page=100']),
 'label-definition-original.json':gh('repos/yigini/soilfer-lims/labels/ready-for-audit'),
 'closing-refs-before-original.json':command(['gh','pr','view','297','--repo','yigini/soilfer-lims','--json','closingIssuesReferences'])}
for cid in [6163271808,6166518424,6167740581,6169628053]:
 name=f'accepted-scope-{cid}-original.json';before[name]=gh(f'repos/yigini/soilfer-lims/issues/comments/{cid}')
 answer=json.loads(before[name]);retained=json.loads((wp/f'issue209-classified-source-pr-created/claudio-direction-{cid}-original.json').read_bytes())
 assert answer['body']==retained['body'] and answer['performed_via_github_app']['slug']=='claude'
pr=json.loads(before['pr-before-original.json']);ci=json.loads(before['run-before-original.json']);jobs=json.loads(before['jobs-before-original.json'])['jobs']
comments=[c for page in json.loads(before['comments-before-original.json']) for c in page]
assert pr['state']=='open' and pr['head']['sha']==head and pr['base']['sha']==base
assert pr['body']==(wp/'issue209-classified-source-pr-created/pr-body-original.md').read_text(encoding='utf-8')
assert json.loads(before['main-before-original.json'])['object']['sha']==base
assert ci['status']=='completed' and ci['conclusion']=='success' and ci['head_sha']==head and ci['run_attempt']==1 and ci['event']=='pull_request'
assert len(jobs)==1 and jobs[0]['status']=='completed' and jobs[0]['conclusion']=='success'
assert all(s['status']=='completed' and s['conclusion']=='success' for s in jobs[0]['steps'])
assert {s['name']:s['conclusion'] for s in jobs[0]['steps']}==terminal['requiredSteps']
assert json.loads(before['closing-refs-before-original.json'])['closingIssuesReferences']==[]
assert git('ls-remote','origin','refs/heads/codex/issue-209-order-revisions').decode().split()[0]==head
assert git('rev-parse',head+'^{tree}').decode().strip()==tree
assert not any(l['name']=='ready-for-audit' for l in pr['labels'])
assert not any('Pip #209 exact-head audit request:' in c['body'] for c in comments)
evidence=f'https://github.com/yigini/soilfer-lims/tree/{audit}/WP/backlog-resume-20261013/{closed.name}'
marker=f'Pip #209 exact-head audit request: {head}'
notice=f'''{marker}

@claude: ready for final #209 source audit on PR297, exact head `{head}`, tree `{tree}`, base `{base}`. All four actual scope answers 6163271808, 6166518424, 6167740581 and 6169628053 were freshly verified unchanged. Scope acceptance is separate from the final audit verdict.

The ONE automatic stock CI [{identifier}]({ci['html_url']}), attempt1, completed SUCCESS at {terminal['completedUtc']}:
```
Test Suites: 370 passed, 370 total
Tests:       5642 passed, 5642 total
```
All370 unique PASS paths equal discovery; zero failures/skips/pending. Client build, both actual candidate and supported baseline48d0e52 Docker builds, real disposable boundary and readiness ALLSUCCESS. [Closed original ZIP/API/all six step logs/every archive-entry and file hash]({evidence}). The unchanged workflow uses ordinary npm test and stock setups, with no local storage or retention hooks. CI images are disposable, not production builds.

Actual readiness proves PRE_199 shipped default entrypoint through the policy owner to COMPLETE_214 and COMPLETE_209: EMPTY policy/override tables, PRESENT/NO_OP0, zero backfill, retained rows/receipts and original DB/WAL/SHM preserved. Secondary inspections use retained snapshots. The #209 impact probe is read-only, original triple preserved and retained allocation measured. These are owned disposable CI fixtures; no actual production impact counts have been collected.

Reasoned full-target reconciliation uses actual WorkItems, supersedes every prior ACTIVE revision in one transaction, retains historical lines and freezes nullable scalar workItemId on NEW lines without a WorkItem FK. Linked-line resolution precedes exact single legacy NULL-line matching within exactly one ACTIVE revision; missing/ambiguous/multiple contexts refuse409 without writes. Existing first-fill, attempts and recorded history retain identity. TEXTURE preserves all existing non-WAIVED fraction owners, including completed owners; incomplete triples refuse409/0writes, with no new owners or normalizer/report/derivation change. Both keyed modes store one scoped receipt in the same transaction, replay the exact original public response with0writes, and refuse different reason/payload or cross-mode reuse409/0writes; no key means0receipts.

**Runtime-reachable group:** released48d intake can retain missing/partial order contexts after catching an initial-order failure. These remain zero-write refusal and separate read-only cause/sample-list evidence. Current intake initial-revision/line failures roll back ALL new WorkItems/orders/lines/audits. Approved-edit409 and scientific preflight before PROCESSING remain; no amendment-side order step, backfill, relink or wider fallback. The eventual kit must explicitly show approved-amendment impact0; NONZERO means STOP/show YY's sample list/separate Claudio-reviewed forward remedy. Ordinary nonzero cause lists also go to YY before a fresh gate.

**Fixture-only group:** each original650 failed assertion occurrence was classified against actual creation paths before corrections. Fresh positive analytical/reference witnesses declare usable legacy NULL orders on existing owners; intended negative/operational/draft/scoped refusals remain. Positive request sites supply required reasons. The direct single-entry mock alone adds the headers object supplied by Express; its two original teardown deletions are guarded only when a retained attempt exists, preserving the order-line parent/FK. Only the PRE201 missing primitive gets digest-bound209 shape; redundant current spectral/publication additions were removed. Every original literal statement/assertion is recoverable by removing recorded additions, with scientific values/methods/aliases/owners/history/scanner predicates intact.

**ONE changed legacy expectation:** keyed analyses receipt count0→1, expressly accepted in6169628053. Eight meaningful both-mode replay/reason/cross-mode/no-key cases and four native rollback/read-only orphan/approved STOP cases are added. The original16988B PR body lists all87 test/fixture paths and every old/new changed line range, links the full139561B/1653-line literal diff SHA256 d975aeb8b8d446c86cb1c8a5d6f6ae25c84af13f58735038a5017d3271c2b041, and distinguishes both groups. All122 application paths equal the full tested source. All650 original occurrences reconcile to59 closed passing reports, retaining duplicate-title ordinals separately and earlier failed aggregates honestly. Full local370/5642 passed with1327 frozen inputs unchanged and ONLY the generated help manifest captured as mutable output before/after. All original failures/OOM/incomplete/config/transport/teardown failures remain immutable.

Please post actual "Audit passed: OK to merge and deploy" bound to this exact head, or concrete findings. No merge/kit/gate/production operation now. Eventual kit still requires policy PRESENT/NO_OP0 or STOP, retained-snapshot disk accounting, actual214 chart/unstarted-unbound LRM counts and209 cause/approved sample lists for your kit review before a fresh single-use gate. #209/#214/#206 remain open for actual post-deploy checks; #103 has no apply go. Human drafts/cards and every completed historical release are preserved.
'''
dest.mkdir()
for name,data in before.items():(dest/name).write_bytes(data)
(dest/'readiness-proofs-derived.json').write_bytes((json.dumps(proofs,indent=2)+'\n').encode())
(dest/'actual-audit-request.txt').write_bytes(notice.encode())
def post(path,request,name):
 file=dest/(name+'-request.json');file.write_bytes((json.dumps(request,indent=2)+'\n').encode())
 raw=command(['gh','api',path,'--method','POST','--input',str(file)])
 (dest/(name+'-response-original.json')).write_bytes(raw)
 return json.loads(raw)
labels=post('repos/yigini/soilfer-lims/issues/297/labels',{'labels':['ready-for-audit']},'label')
assert any(l['name']=='ready-for-audit' for l in labels)
comment=post('repos/yigini/soilfer-lims/issues/297/comments',{'body':notice},'notice')
assert comment['body']==notice
fresh=gh('repos/yigini/soilfer-lims/pulls/297');(dest/'pr-after-original.json').write_bytes(fresh)
assert json.loads(fresh)['head']['sha']==head and json.loads(fresh)['base']['sha']==base
record={'postedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'number':297,'head':head,'tree':tree,'base':base,
 'run':identifier,'closedEvidenceAudit':audit,'comment':comment['id'],'commentUrl':comment['html_url'],
 'readyNoticeSentOnce':True,'labelAddedOnce':True,'finalNativeHandoffSent':False,'actualAuditPass':False,'productionOperations':0,'ciDispatches':0,
 'policyChartEntrypointProofVerified':True,'orderRevisionEntrypointProofVerified':True}
(dest/'delivery-record.json').write_bytes((json.dumps(record,indent=2)+'\n').encode())
pins={p.relative_to(root).as_posix():{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in dest.iterdir() if p.is_file()}
(dest/'index.json').write_bytes((json.dumps(pins,indent=2)+'\n').encode())
lead=f'''## 2026-10-14 #209 PR297 exact-head audit requested ONCE after actual complete green CI

Ready-for-audit label/comment{comment['id']} posted ONCE on exact head{head}/tree{tree}/base{base} after actual CI{identifier} attempt1 CLOSED SUCCESS370/5642/all370inventory/all realDocker steps. Original ZIP/API/6step logs/archive hashes independently retained{audit}; actual policy/chart and209 default-entrypoint/original triple/retained-snapshot preservation/zero backfill proofs independently verified. Actual request/raw responses at WP/backlog-resume-20261013/{dest.name}/index.json; never duplicate. Final native handoff UNSENT by this helper; fresh actual target/focus/EMPTYcomposer required, preserve centre human draft/cards. Actual Claudio exact-head final audit PASS remains pending before fresh guarded merge. All650 classified original occurrences/full local370/5642/122testedsource paths/87literalfixture inventory/ONE accepted keyedreceipt0to1/runtime-reachable vsfixture-only distinction retained. Approved impact nonzeroSTOP/no amendment-side orderstep/backfill/relink/production counts yet/kitPRESENTNO_OP0+snapshotdisk+actual214/209lists/#103noapply/history guards hold. No merge/kit/gate/production operation.

'''
readmes=['WP/audit-release-eb6de2e8/README.md','WP/runtime-recovery-kobo/README.md']
for p in readmes:
 f=root/p;f.write_bytes(lead.encode()+f.read_bytes())
owned=list(pins)+[(dest/'index.json').relative_to(root).as_posix(),Path(__file__).relative_to(root).as_posix()]+readmes
git('add','-f','--',*owned)
assert set(git('diff','--cached','--name-only').decode().splitlines())<=set(owned)
git('commit','-m','audit(209): request PR297 exact-head audit after complete green CI')
retained=git('rev-parse','HEAD').decode().strip()
for p,pin in pins.items():assert hashlib.sha256(git('show',retained+':'+p)).hexdigest()==pin['sha256'],p
git('push','origin','HEAD:refs/heads/audit/release-eb6de2e8')
assert git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==retained
print(json.dumps(dict(record,auditCommit=retained,exactBlobsVerified=len(pins))))
