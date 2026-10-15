"""Request one final exact-head PR298 audit after independently retained complete CI."""
import datetime, hashlib, json, pathlib, subprocess

R = pathlib.Path(__file__).resolve().parents[2]
D = R / 'WP/startup-order-readiness-20261015'
C = D / 'pr298-ci38738769335-closed-originals-once'
O = D / 'pr298-eba02837-final-audit-request-once'
AUDIT = '69a3149ffbb1e870e9ff064cb058ee9833bc299b'
HEAD = 'eba02837eaa2ab797cad0572fecada686f660346'
TREE = '676b01e71211786d1aeace50f19a0b2c9f9c482e'
BASE = 'cde8c8896f5f9d5f1ab07b0ae16b1a765e0a6367'
RUN = 38738769335

def run(argv):
    p = subprocess.run(argv, cwd=R, capture_output=True)
    if p.returncode: raise RuntimeError(p.stderr.decode('utf-8', 'replace'))
    return p.stdout
def git(*args): return run(['git', '-c', 'core.longpaths=true', *args])
def gh(path): return run(['gh', 'api', path])
def sha(value): return hashlib.sha256(value).hexdigest()
def put(name, value):
    p = O / name
    assert not p.exists()
    p.write_bytes(value)
    return p
def js(name, value): return put(name, (json.dumps(value, indent=2) + '\n').encode())

assert not O.exists(), 'Attempt exists; inspect remote outcome, never replay.'
assert git('rev-parse', 'HEAD').decode().strip() == AUDIT
assert git('branch', '--show-current').decode().strip() == 'audit/release-eb6de2e8'
assert not git('diff', '--cached', '--name-only').strip()
assert git('ls-remote', 'origin', 'refs/heads/audit/release-eb6de2e8').decode().split()[0] == AUDIT
terminal = json.loads((C / 'closed-record.json').read_bytes())
assert terminal['status'] == 'CLOSED_SUCCESS_VERIFIED' and not terminal['verificationProblems']
assert terminal['run'] == RUN and terminal['head'] == HEAD and terminal['base'] == BASE and terminal['tree'] == TREE
assert terminal['exactJestSummary'] == ['Test Suites: 373 passed, 373 total', 'Tests:       5679 passed, 5679 total']
assert terminal['exactFullInventoryMatch'] and terminal['all1333FrozenInputsUnchanged']
publication = json.loads((C / 'publication-index.json').read_bytes())
for row in publication['files']:
    value = git('show', AUDIT + ':' + row['path'])
    assert value == (R / row['path']).read_bytes() and len(value) == row['length'] and sha(value) == row['sha256']
    assert git('rev-parse', AUDIT + ':' + row['path']).decode().strip() == row['gitBlobOid']
assert len(terminal['archiveEntries']) == 22
proofs = json.loads((C / 'readiness-proofs-derived.json').read_bytes())
policy = proofs['policyChartEntrypointProof']; order = proofs['orderRevisionEntrypointProof']
assert policy['scenario'] == 'PRE_199-default-entrypoint-COMPLETE_214'
assert policy['before']['dry']['classification'] == 'ABSENT'
assert policy['before']['dry']['totalChanges'] == policy['before']['dry']['dataWrites'] == 0
assert policy['before']['dbWalShmPreserved'] and policy['before']['dry']['readonlySnapshot']['originalFilesPreserved']
assert policy['after']['counts'] == {'LabPolicy': 0, 'LabPolicyOverride': 0}
assert policy['after']['dbWalShmPreserved'] and policy['after']['secondaryInspectionsOnRetainedSnapshot']
for mode in ['ready', 'again']:
    p = policy['after'][mode]
    assert p['classification'] == 'PRESENT' and p['totalChanges'] == p['dataWrites'] == 0
    assert p['readonlySnapshot']['originalFilesPreserved']
assert policy['after']['charts']['classification'] == 'COMPLETE_214'
assert policy['after']['charts']['totalChanges'] == policy['after']['charts']['backfilledCount'] == 0
assert policy['after']['charts']['receipt']['originalRowsPreserved']
assert order['scenario'] == 'PRE_199-default-entrypoint-COMPLETE_209'
assert order['before'] == {'workItemIdAbsent': True, 'orderRevisions': 0, 'orderLines': 0, 'attempts': 0}
assert order['retainedRowsAndReceiptsPreserved'] and order['after']['dbWalShmPreserved']
assert order['after']['secondaryInspectionsOnRetainedSnapshot']
for mode in ['ready', 'again', 'impact']:
    p = order['after'][mode]
    assert p['classification'] == 'COMPLETE_209' and p['sourceSha256'] == '5c51f423689b1c726e16c12cdce7b381574661017cdb622eb3f562957a18304c'
    assert p['totalChanges'] == p['backfilledCount'] == 0 and p['receipt']['originalRowsPreserved']
    assert p['readonlySnapshot']['originalFilesPreserved']
    assert p['impact']['prospectiveApprovedAmendmentRefusalCount'] == 0
    assert p['impact']['approvedAmendmentKitGate'] == 'NO_APPROVED_AMENDMENT_REFUSALS'
impact = order['after']['impact']
assert impact['access'] == 'RETAINED_SNAPSHOT_ONLY' and impact['originalFilesPreserved'] and impact['productionMutations'] == 0
assert impact['retainedAllocation']['allocationMeasured'] and impact['retainedAllocation']['conservativeAllocationBytes'] > 0
before = {}
for name, endpoint in {
    'pr-before-original.json': 'repos/yigini/soilfer-lims/pulls/298',
    'main-before-original.json': 'repos/yigini/soilfer-lims/git/ref/heads/main',
    'run-before-original.json': f'repos/yigini/soilfer-lims/actions/runs/{RUN}',
    'jobs-before-original.json': f'repos/yigini/soilfer-lims/actions/runs/{RUN}/jobs?per_page=100',
    'reviews-before-original.json': 'repos/yigini/soilfer-lims/pulls/298/reviews?per_page=100',
    'label-definition-original.json': 'repos/yigini/soilfer-lims/labels/ready-for-audit',
    'scope-before-original.json': 'repos/yigini/soilfer-lims/issues/comments/6189025975',
    'main-ci-before-original.json': 'repos/yigini/soilfer-lims/actions/runs/38636615469',
}.items(): before[name] = gh(endpoint)
before['comments-before-original.json'] = run(['gh', 'api', '--paginate', '--slurp', 'repos/yigini/soilfer-lims/issues/298/comments?per_page=100'])
before['coordination-before-original.json'] = run(['gh', 'api', '--paginate', '--slurp', 'repos/yigini/soilfer-lims/issues/162/comments?since=2026-10-15T12:07:44Z&per_page=100'])
before['closing-refs-before-original.json'] = run(['gh', 'pr', 'view', '298', '--repo', 'yigini/soilfer-lims', '--json', 'closingIssuesReferences'])
pr = json.loads(before['pr-before-original.json']); ci = json.loads(before['run-before-original.json'])
jobs = json.loads(before['jobs-before-original.json'])['jobs']
comments = [c for page in json.loads(before['comments-before-original.json']) for c in page]
assert pr['state'] == 'open' and pr['head']['sha'] == HEAD and pr['base']['sha'] == BASE
assert pr['body'] == (D / 'source-only-pr373-created-once/pr-body-original.md').read_text(encoding='utf-8')
assert json.loads(before['main-before-original.json'])['object']['sha'] == BASE
assert ci['status'] == 'completed' and ci['conclusion'] == 'success' and ci['head_sha'] == HEAD and ci['run_attempt'] == 1
assert len(jobs) == 1 and jobs[0]['status'] == 'completed' and jobs[0]['conclusion'] == 'success'
assert all(s['status'] == 'completed' and s['conclusion'] == 'success' for s in jobs[0]['steps'])
assert {s['name']: s['conclusion'] for s in jobs[0]['steps']} == terminal['requiredSteps']
assert json.loads(before['closing-refs-before-original.json'])['closingIssuesReferences'] == []
scope = json.loads(before['scope-before-original.json'])
assert scope['body'] == json.loads((C / 'scope-original.json').read_bytes())['body'] and scope['performed_via_github_app']['slug'] == 'claude'
main_ci = json.loads(before['main-ci-before-original.json'])
assert main_ci['status'] == 'completed' and main_ci['conclusion'] == 'success' and main_ci['head_sha'] == BASE
assert git('ls-remote', 'origin', 'refs/heads/codex/startup-readiness-shared-context').decode().split()[0] == HEAD
assert git('rev-parse', HEAD + '^{tree}').decode().strip() == TREE
assert not any(l['name'] == 'ready-for-audit' for l in pr['labels'])
assert not comments and not json.loads(before['reviews-before-original.json'])
frozen = json.loads((D / 'full-pinned-copy-retention-bound-ordinary-once/source-before.json').read_bytes())
assert len(frozen) == 1333 and all(sha((R / p).read_bytes()) == v for p, v in frozen.items())
review = json.loads((D / 'source-only-pr373-preparation-once/review-ref.json').read_bytes())
for p, pin in review['sourceBindings'].items():
    assert sha((R / p).read_bytes()) == pin['sha256'] and (R / p).read_bytes() == git('show', HEAD + ':' + p)
evidence = f'https://github.com/yigini/soilfer-lims/tree/{AUDIT}/WP/startup-order-readiness-20261015/{C.name}'
marker = f'Pip startup performance exact-head final audit request: {HEAD}'
notice = f'''{marker}

@claude: PR298 is ready for final source audit on exact head `{HEAD}`, tree `{TREE}`, current main/base `{BASE}`. Your actual performance-only direction [6189025975](https://github.com/yigini/soilfer-lims/issues/162#issuecomment-6189025975) was freshly verified unchanged. The original PR body retains the full scope, exact fixture/helper diffs and earlier failures.

The ONE automatic stock CI [{RUN}]({ci['html_url']}), attempt1, completed SUCCESS at {terminal['completedUtc']}:
```
Test Suites: 373 passed, 373 total
Tests:       5679 passed, 5679 total
```
All373 unique PASS paths exactly equal discovery; zero failures/skips/pending. Client build, actual candidate and supported-baseline48d0e52 Docker builds, real disposable boundary and readiness ALLSUCCESS. [Complete original ZIP, API, ALL22 archive-entry bytes/hashes, selected logs and inventory]({evidence}) are independently raw-Git-OID/SHA256 verified (44 owned blobs). The unchanged workflow ran ordinary npm test with stock setups and no local retention/hidden-path/visible-assets hooks. Disposable CI images are not production builds.

The source-only PR contains36 tested server paths. All370 preexisting current-main test files remain byte-identical; the earlier371-file manifest additionally contains the unchanged new telemetry test. Full local373/5679 and focused167 pass with all1333 frozen inputs unchanged. Original full2failures, focused earlier-race failure and zero-test local retention-setup refusal remain immutable, with the actual corrections and complete originals linked in the PR.

Please audit the private explicit startup context through ALL26 READY calls and nested prerequisites: shared integrity/FK full-result checks, one policy/chart/order pinned snapshot, chart-result reuse, all26 elapsed_ms/rss_bytes telemetry, and the equivalent one-set owner query. ALL existing refusal codes/conditions, full reports/impact/approvedAmendmentKitGate, full file/copy/race hashes and source-digest checks remain. No impact-zero startup condition or new STOP is added. Default CLI/install/dry-run paths lazy-load context only on explicit opt-in; no global Database prototype patch or opaque SQL forwarding. Cache reuse revalidates retained-copy hashes even through aliases; changed copy bytes invalidate SQL/chart caches. Earlier original-file race after order capture uses the SAME pinned nested snapshot and final ORDER_REVISION_SNAPSHOT_CHANGED guard as legacy. Actual absent/empty/nonempty-WAL idle-writer cases verify report equality and exactly-once physical checks. The12000-sample query case proves equivalence and removal of point lookups; it does not demonstrate a wall-clock improvement or production startup qualification.

The new synthetic impact builder is digest-pinned, closed in-memory, exact-caller/count/capability guarded, with no path/SQL/connection/callback inputs. Scanner predicates and stock assertions remain unchanged; narrow fixture registration and negative guards are explicit in the original body. The managedStartup QC fixture opt-in uses real prerequisite installers and guarded empty PT/NCR bootstrap; its default behavior remains unchanged.

Actual real-CI PRE_199 shipped default-entrypoint proofs reach COMPLETE_214 and COMPLETE_209 with EMPTY policy tables, PRESENT/NO_OP0, zero backfill, retained original rows/receipts and DB/WAL/SHM preservation; secondary inspections use retained snapshots and the read-only impact allocation is measured. These are disposable CI fixtures. The retained historical100000 proof remains FAILED at600s; no production-scale600s/805306368 qualification is claimed.

Please post actual "Audit passed: OK to merge and deploy" bound to this exact head, or concrete findings. No merge/build/proof/kit/gate/deployment now. After exact-head PASS/merge/current-main CI, future work requires a NEW app image, NEW image-bound tooling/all-hash Claudio PASS, fresh computed requirement PLUS10GB before each build/proof, and a NEW proof root. Never retry cde8/B5/100000. R1 still removes NO proof DB copy pending YY; shared/in-use cache stays protected, images are LISTONLY and backups protected. All scientific/impact/YY/exact-kit/fresh-gate/forward-only/history guards hold; #206/#214/#209 remain open for actual post-deploy check, #103 has no apply go, human drafts/cards untouched.
'''
O.mkdir()
for name, value in before.items(): put(name, value)
put('actual-audit-request.txt', notice.encode())
def post(endpoint, request, stem):
    p = js(stem + '-request.json', request)
    response = run(['gh', 'api', endpoint, '--method', 'POST', '--input', str(p)])
    put(stem + '-response-original.json', response)
    return json.loads(response)
labels = post('repos/yigini/soilfer-lims/issues/298/labels', {'labels': ['ready-for-audit']}, 'label')
assert any(l['name'] == 'ready-for-audit' for l in labels)
comment = post('repos/yigini/soilfer-lims/issues/298/comments', {'body': notice}, 'notice')
assert comment['body'] == notice
after = gh('repos/yigini/soilfer-lims/pulls/298'); put('pr-after-original.json', after)
assert json.loads(after)['head']['sha'] == HEAD and json.loads(after)['base']['sha'] == BASE
record = {'postedUtc': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'pr': 298, 'head': HEAD, 'tree': TREE, 'base': BASE,
    'run': RUN, 'closedEvidenceAudit': AUDIT, 'comment': comment['id'], 'commentUrl': comment['html_url'],
    'readyNoticeSentOnce': True, 'labelAddedOnce': True, 'finalNativeHandoffSent': False, 'actualAuditPass': False,
    'ciDispatches': 0, 'productionOperations': 0, 'all1333FrozenInputsUnchanged': True}
js('delivery-record.json', record)
readme = R / 'WP/audit-release-eb6de2e8/README.md'
lead = f'''## 2026-10-15 PR298 eba02837 final exact-head audit requested ONCE

Ready-for-audit label/comment{comment['id']} posted ONCE: {comment['html_url']}. Exacthead{HEAD}/tree{TREE}/base{BASE}; original PR body unchanged. ActualCI{RUN} CLOSED SUCCESS13:27:51UTC:373suites5679tests/all373inventory/client/bothactualDocker/boundary/readiness, ALL22 archive entries and44 raw-OID/SHA verified blobs published{AUDIT}. Actual PRE_199 policy/chart/order preservation, zero backfill, retained-snapshot impact allocation independently checked. New final request/current authority/raw responses at WP/startup-order-readiness-20261015/{O.name}/delivery-record.json. Never duplicate label/comment/request. Native handoff UNSENT by this helper; use fresh actual target/focus/EMPTYcomposer and preserve humans. Actual exact-head final Claudio PASS remains pending before merge/current-mainCI. No build/proof/kit/gate/deploy/production operation. NEW image/tooling review/fresh computed requirement+10GB/new proof root later, never cde8/B5/100000 retry; science/refusal/fullhash/copy/race/600/805306368/forward-only/no103/history held. No proof DB removal underR1 pendingYY.

'''
readme.write_bytes(lead.encode() + readme.read_bytes())
paths = sorted(p for p in O.iterdir() if p.is_file()) + [pathlib.Path(__file__), readme]
bindings = []
for p in paths:
    value = p.read_bytes()
    bindings.append({'path': p.relative_to(R).as_posix(), 'length': len(value), 'sha256': sha(value), 'gitBlobOid': hashlib.sha1(('blob ' + str(len(value)) + '\0').encode() + value).hexdigest()})
index = js('publication-index.json', {'baseAudit': AUDIT, 'status': 'FINAL_EXACT_HEAD_AUDIT_REQUEST_SENT_ONCE', 'head': HEAD, 'files': bindings, 'delivery': record})
paths.append(index)
names = [p.relative_to(R).as_posix() for p in paths]
git('-c', 'core.autocrlf=false', 'add', '-f', '--', *names)
assert set(git('diff', '--cached', '--name-only').decode().splitlines()) <= set(names)
tree = git('write-tree').decode().strip()
for p, name in zip(paths, names):
    value = git('show', tree + ':' + name)
    assert value == p.read_bytes() and hashlib.sha1(('blob ' + str(len(value)) + '\0').encode() + value).hexdigest() == git('rev-parse', tree + ':' + name).decode().strip()
assert all(sha((R / p).read_bytes()) == v for p, v in frozen.items())
git('commit', '-m', 'Request PR298 exact-head final audit after complete green CI')
audit = git('rev-parse', 'HEAD').decode().strip()
git('push', 'origin', 'audit/release-eb6de2e8')
assert git('ls-remote', 'origin', 'refs/heads/audit/release-eb6de2e8').decode().split()[0] == audit
print(json.dumps(dict(record, audit=audit, rawVerifiedOwnedBlobs=len(paths))))
