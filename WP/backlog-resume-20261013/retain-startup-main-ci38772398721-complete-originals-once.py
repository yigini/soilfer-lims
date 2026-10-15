"""Retain this one CLOSED CI run and every original archive entry; never dispatch CI."""
import datetime, hashlib, io, json, pathlib, re, subprocess, zipfile

R = pathlib.Path(__file__).resolve().parents[2]
D = R / 'WP/startup-order-readiness-20261015'
O = D / 'main-ci38772398721-closed-originals-once'
AUDIT = 'f91377a695ab925762de245c0a48216e7a74e505'
HEAD = 'be8379745bdfae52ce46496ff26514dc7d729640'
REVIEW_HEAD = 'eba02837eaa2ab797cad0572fecada686f660346'
TREE = '676b01e71211786d1aeace50f19a0b2c9f9c482e'
BASE = 'cde8c8896f5f9d5f1ab07b0ae16b1a765e0a6367'
RUN = 38772398721

def run(argv):
    p = subprocess.run(argv, cwd=R, capture_output=True)
    if p.returncode: raise RuntimeError(p.stderr.decode('utf-8', 'replace'))
    return p.stdout

def git(*args): return run(['git', '-c', 'core.longpaths=true', *args])
def gh(endpoint): return run(['gh', 'api', endpoint])
def sha(value): return hashlib.sha256(value).hexdigest()
def put(name, value):
    p = O / name
    assert not p.exists()
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_bytes(value)
    return p
def js(name, value): return put(name, (json.dumps(value, indent=2) + '\n').encode())

assert not O.exists(), 'Consumed boundary; inspect retained originals, never replay.'
assert git('rev-parse', 'HEAD').decode().strip() == AUDIT
assert git('branch', '--show-current').decode().strip() == 'audit/release-eb6de2e8'
assert not git('diff', '--cached', '--name-only').strip()
assert git('ls-remote', 'origin', 'refs/heads/audit/release-eb6de2e8').decode().split()[0] == AUDIT
review = json.loads((D / 'source-only-pr373-preparation-once/review-ref.json').read_bytes())
assert review['reviewHead'] == REVIEW_HEAD and review['base'] == BASE and review['reviewTree'] == TREE
assert git('show', '-s', '--format=%T', HEAD).decode().strip() == TREE
assert git('show', '-s', '--format=%P', HEAD).decode().strip().split() == [BASE, REVIEW_HEAD]
frozen = json.loads((D / 'full-pinned-copy-retention-bound-ordinary-once/source-before.json').read_bytes())
assert len(frozen) == 1333 and all(sha((R / p).read_bytes()) == v for p, v in frozen.items())
assert len(review['sourceBindings']) == 36
assert set(git('diff', '--name-only', BASE, HEAD).decode().splitlines()) == set(review['sourceBindings'])
for p, pin in review['sourceBindings'].items():
    value = git('show', HEAD + ':' + p)
    assert value == (R / p).read_bytes() and sha(value) == pin['sha256']
raw = {}
for name, endpoint in {
    'run-original.json': f'repos/yigini/soilfer-lims/actions/runs/{RUN}',
    'jobs-original.json': f'repos/yigini/soilfer-lims/actions/runs/{RUN}/jobs?per_page=100',
    'pr-original.json': 'repos/yigini/soilfer-lims/pulls/298',
    'pr-comments-original.json': 'repos/yigini/soilfer-lims/issues/298/comments?per_page=100',
    'main-original.json': 'repos/yigini/soilfer-lims/git/ref/heads/main',
    'pr-ci-original.json': 'repos/yigini/soilfer-lims/actions/runs/38738769335',
    'source-pass-original.json': 'repos/yigini/soilfer-lims/issues/comments/6195167175',
    'pr-reviews-original.json': 'repos/yigini/soilfer-lims/pulls/298/reviews?per_page=100',
    'coordination-original.json': 'repos/yigini/soilfer-lims/issues/162/comments?since=2026-10-15T16:50:00Z&per_page=100',
    'scope-original.json': 'repos/yigini/soilfer-lims/issues/comments/6189025975',
}.items(): raw[name] = gh(endpoint)
raw['closing-refs-original.json'] = run(['gh', 'pr', 'view', '298', '--repo', 'yigini/soilfer-lims', '--json', 'closingIssuesReferences'])
ci = json.loads(raw['run-original.json']); jobs = json.loads(raw['jobs-original.json'])['jobs']
pr = json.loads(raw['pr-original.json'])
assert ci['id'] == RUN and ci['status'] == 'completed' and ci['conclusion'] is not None
assert ci['run_attempt'] == 1 and ci['head_sha'] == HEAD and ci['event'] == 'push' and ci['head_branch'] == 'main'
assert ci['path'] == '.github/workflows/ci.yml'
assert json.loads(raw['jobs-original.json'])['total_count'] == 1 and jobs[0]['id'] == 116551310311
assert len(jobs) == 1 and jobs[0]['status'] == 'completed' and jobs[0]['conclusion'] is not None
assert pr['state'] == 'closed' and pr['merged'] is True and pr['merge_commit_sha'] == HEAD
assert pr['head']['sha'] == REVIEW_HEAD and pr['base']['sha'] == BASE
assert pr['body'] == (D / 'source-only-pr373-created-once/pr-body-original.md').read_text(encoding='utf-8')
assert json.loads(raw['main-original.json'])['object']['sha'] == HEAD
assert json.loads(raw['closing-refs-original.json'])['closingIssuesReferences'] == []
raw['workflow-original.yml'] = git('show', HEAD + ':.github/workflows/ci.yml')
assert raw['workflow-original.yml'] == git('show', BASE + ':.github/workflows/ci.yml')
previous_publications = {}
for label, folder in {'prCi': 'pr298-ci38738769335-closed-originals-once', 'sourcePass': 'pr298-actual-audit-pass-6195167175-once', 'merge': 'pr298-actual-merge-eba02837-once'}.items():
    index = D / folder / 'publication-index.json'; previous = json.loads(index.read_bytes())
    for binding in previous['files']:
        value = git('cat-file', 'blob', binding['gitBlobOid'])
        actual_oid = hashlib.sha1(('blob ' + str(len(value)) + '\0').encode() + value).hexdigest()
        assert actual_oid == binding['gitBlobOid'] and len(value) == binding['length'] and sha(value) == binding['sha256']
    previous_publications[label] = {'path': index.relative_to(R).as_posix(), 'sha256': sha(index.read_bytes()), 'rawVerifiedBlobs': len(previous['files'])}
verdict = json.loads(raw['source-pass-original.json'])
original_verdict = json.loads((D / 'pr298-actual-audit-pass-6195167175-once/actual-verdict-original.json').read_bytes())
assert all(verdict[k] == original_verdict[k] for k in ('id', 'body', 'created_at', 'updated_at'))
assert verdict['performed_via_github_app']['id'] == 1236702 and verdict['performed_via_github_app']['slug'] == 'claude'
assert 'Audit passed: OK to merge and deploy' in verdict['body'] and REVIEW_HEAD in verdict['body']
O.mkdir()
for name, value in raw.items(): put(name, value)
archive_bytes = gh(f'repos/yigini/soilfer-lims/actions/runs/{RUN}/logs')
put('logs-original.zip', archive_bytes)
assert len(archive_bytes) < 128 * 1024 * 1024
archive = zipfile.ZipFile(io.BytesIO(archive_bytes))
entries = archive.infolist()
assert 0 < len(entries) < 1000 and len({e.filename for e in entries}) == len(entries)
assert sum(e.file_size for e in entries) < 256 * 1024 * 1024
entry_records = []
for i, entry in enumerate(entries):
    assert not entry.is_dir() and entry.file_size < 128 * 1024 * 1024
    data = archive.read(entry)
    local = f'archive-entries/entry-{i:04d}-original.log'
    put(local, data)
    entry_records.append({'archiveName': entry.filename, 'retainedPath': local, 'bytes': len(data), 'sha256': sha(data), 'crc32': entry.CRC})
fragments = {
    'server-tests-original.log': 'Run server test suite',
    'client-build-original.log': 'Build client production bundle',
    'candidate-docker-build-original.log': 'Build Docker image',
    'baseline-docker-build-original.log': 'Build Supported Baseline Docker Image',
    'docker-boundary-original.log': 'Run Real Disposable Docker Boundary Rehearsal',
    'docker-readiness-original.log': 'Run Real Docker Deployment Readiness Acceptance',
}
selected = {}
for name, fragment in fragments.items():
    found = [e for e in entries if e.filename.rsplit('/', 1)[-1].split('_', 1)[-1].startswith(fragment)]
    if len(found) == 1:
        selected[name] = archive.read(found[0]); put(name, selected[name])
errors = []
def check(condition, message):
    if not condition: errors.append(message)
plain = re.sub(r'\x1b\[[0-9;]*m', '', selected.get('server-tests-original.log', b'').decode('utf-8', 'replace'))
suites = re.findall(r'Test Suites: [^\r\n]+', plain)
tests = re.findall(r'Tests: +[^\r\n]+', plain)
passed = re.findall(r'\bPASS (tests/[^\r\n]*?\.test\.js)\b', plain)
inventory = json.loads((D / 'full-pinned-copy-retention-bound-ordinary-once/inventory-original.json').read_bytes())
expected = {p.replace('\\', '/').split('/server/', 1)[1] for p in inventory}
check(len(expected) == 373, 'Expected discovery inventory must contain373 paths')
steps = {s['name']: s['conclusion'] for s in jobs[0]['steps']}
check(ci['conclusion'] == 'success' and jobs[0]['conclusion'] == 'success', 'Actual CI conclusion is not success')
check(all(s['status'] == 'completed' and s['conclusion'] == 'success' for s in jobs[0]['steps']), 'Not every actual step succeeded')
check(len(selected) == 6, 'Missing required original step logs')
check(suites == ['Test Suites: 373 passed, 373 total'], 'Unexpected exact Jest suite summary')
check(tests == ['Tests:       5679 passed, 5679 total'], 'Unexpected exact Jest test summary')
check(len(passed) == len(set(passed)) == 373 and set(passed) == expected, 'Actual PASS paths differ from complete inventory')
check(not re.search(r'\bFAIL tests/', plain), 'FAIL suite in original server log')
check('jest --maxWorkers=1 --workerIdleMemoryLimit=512MB' in plain, 'Ordinary Jest command missing')
check('visible-test-storage' not in plain and 'LIMS_VISIBLE_' not in plain and 'local-owned-pinned-copy-retention-bound' not in plain, 'Unexpected local fixture in CI')
boundary = selected.get('docker-boundary-original.log', b'').decode('utf-8', 'replace')
readiness = selected.get('docker-readiness-original.log', b'').decode('utf-8', 'replace')
check('ALL REAL DOCKER BOUNDARY REHEARSALS COMPLETED SUCCESSFULLY' in boundary, 'Boundary completion marker missing')
check('ALL REAL DOCKER DEPLOYMENT READINESS SCENARIOS PASSED' in readiness, 'Readiness completion marker missing')
proofs = {}
for line in readiness.splitlines():
    start = line.find('{')
    if start < 0: continue
    try: value = json.loads(line[start:])
    except json.JSONDecodeError: continue
    if isinstance(value, dict):
        for key, proof in value.items():
            if key.endswith('Proof'):
                check(key not in proofs, 'Repeated readiness proof ' + key)
                proofs[key] = proof
js('readiness-proofs-derived.json', proofs)
js('inventory-comparison-derived.json', {'expected': sorted(expected), 'actualPassPaths': passed, 'exactMatch': set(passed) == expected})
record = {
    'retainedUtc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'status': 'CLOSED_SUCCESS_VERIFIED' if not errors else 'CLOSED_ORIGINALS_RETAINED_REQUIRES_INSPECTION',
    'run': RUN, 'runUrl': ci['html_url'], 'attempt': 1, 'conclusion': ci['conclusion'],
    'job': jobs[0]['id'], 'completedUtc': jobs[0]['completed_at'], 'pr': 298,
    'head': HEAD, 'reviewHead': REVIEW_HEAD, 'tree': TREE, 'previousMain': BASE, 'event': ci['event'], 'exactJestSummary': suites + tests,
    'previousPublicationsReverified': previous_publications,
    'passedSuites': len(passed), 'passedTests': 5679 if tests == ['Tests:       5679 passed, 5679 total'] else None,
    'exactFullInventoryMatch': len(passed) == len(set(passed)) == 373 and set(passed) == expected,
    'all1333FrozenInputsUnchanged': all(sha((R / p).read_bytes()) == v for p, v in frozen.items()),
    'requiredSteps': steps, 'archiveEntries': entry_records, 'verificationProblems': errors,
    'standardWorkflowUnchanged': True, 'localStorageFixturesUsedInCI': False if not errors else None,
    'disposableCiImagesAreNotProductionImages': True, 'readyNoticeSent': False,
    'nativeAcknowledgementSent': False, 'sourceAuditAndMergeAlreadyComplete': True, 'productionStartupQualified': False,
    'newBuildOrProofDispatched': False, 'ciDispatches': 0, 'productionOperations': 0,
}
record['originalFiles'] = {p.relative_to(O).as_posix(): {'bytes': p.stat().st_size, 'sha256': sha(p.read_bytes())} for p in sorted(O.rglob('*')) if p.is_file()}
js('closed-record.json', record)
readme = R / 'WP/audit-release-eb6de2e8/README.md'
lead = f'''## 2026-10-15 main CI38772398721 CLOSED {record['status']}

Same attempt1/push/main{HEAD} closed{record['completedUtc']}, actual conclusion{ci['conclusion']}. Exact original Jest summaries: {suites!r} / {tests!r}; actual unique PASS paths{len(set(passed))}/expected373, fullinventorymatch{record['exactFullInventoryMatch']}. Client, candidate+supportedbaseline48d0e52 Docker builds and real boundary/readiness outcomes remain in full original ZIP/API/ALL archive-entry bytes+hashes and six selected logs at WP/startup-order-readiness-20261015/{O.name}/closed-record.json. Verification problems: {errors!r}. Stock workflow unchanged/no local storage or retention hooks; all1333 frozen inputs unchanged. CI images are disposable, not production builds. Actual exact-head source audit PASS6195167175 and PR298 merge are already complete; this helper sends no duplicate notice/ACK, merge/build/proof/gate/deploy. Main CI is not production600s/805306368 qualification. Future NEW app image/tooling all-hash review/fresh R4 computed requirement+10GB/new proof root; no cde8/B5/100000 retry. All science/refusal/fullhash/copy/race/600/805306368/forward-only/history and no103 guards remain; no proof DB removal underR1 pendingYY.

'''
runtime_readme = R / 'WP/runtime-recovery-kobo/README.md'
for p in (readme, runtime_readme): p.write_bytes(lead.encode() + p.read_bytes())
paths = [p for p in sorted(O.rglob('*')) if p.is_file()] + [pathlib.Path(__file__), readme, runtime_readme, R / 'WP/backlog-resume-20261013/retain-startup-main-ci38772398721-closed-originals-once.py', D / 'main-ci38772398721-retention-preflight-refusal-once/refusal-and-resolution.json']
bindings = []
for p in paths:
    value = p.read_bytes()
    bindings.append({'path': p.relative_to(R).as_posix(), 'length': len(value), 'sha256': sha(value), 'gitBlobOid': hashlib.sha1(('blob ' + str(len(value)) + '\0').encode() + value).hexdigest()})
index = js('publication-index.json', {'baseAudit': AUDIT, 'status': record['status'], 'run': RUN, 'head': HEAD, 'files': bindings, 'productionOperations': 0})
paths.append(index)
names = [p.relative_to(R).as_posix() for p in paths]
assert len(names) == len(set(names))
git('-c', 'core.autocrlf=false', 'add', '-f', '--', *names)
assert set(git('diff', '--cached', '--name-only').decode().splitlines()) == set(names)
tree = git('write-tree').decode().strip()
for p, name in zip(paths, names):
    value = git('show', tree + ':' + name)
    assert value == p.read_bytes() and hashlib.sha1(('blob ' + str(len(value)) + '\0').encode() + value).hexdigest() == git('rev-parse', tree + ':' + name).decode().strip()
assert record['all1333FrozenInputsUnchanged'] and all(sha((R / p).read_bytes()) == v for p, v in frozen.items())
git('commit', '-m', 'Retain main CI38772398721 complete closed original logs')
audit = git('rev-parse', 'HEAD').decode().strip()
git('push', 'origin', 'audit/release-eb6de2e8')
assert git('ls-remote', 'origin', 'refs/heads/audit/release-eb6de2e8').decode().split()[0] == audit
print(json.dumps({'audit': audit, 'rawVerifiedOwnedBlobs': len(paths), 'status': record['status'], 'exactJestSummary': record['exactJestSummary'], 'archiveEntries': len(entries), 'verificationProblems': errors}))
