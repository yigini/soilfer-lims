"""Retain and publish the same completed session29474; never run tests."""
import datetime, hashlib, json, pathlib, re, subprocess

R = pathlib.Path(__file__).resolve().parents[2]
D = R / 'WP/startup-order-readiness-20261015'
F = D / 'full-pinned-copy-retention-bound-ordinary-once'
O = D / 'full-pinned-copy-retention-bound-closed-pass-once'
BASE = 'e8d786d007e2f46d22ac7c6964e7fab0942b81a2'
APP = '7611ae485d1a29818d62fb53c32825abaac409f1'

def git(*args):
    return subprocess.check_output(['git', '-c', 'core.longpaths=true', *args], cwd=R, stderr=subprocess.PIPE)

def sha(value):
    return hashlib.sha256(value).hexdigest()

def stable(file):
    first = file.stat()
    assert file.is_file() and first.st_size <= 100 * 1024 * 1024
    value = file.read_bytes()
    last = file.stat()
    assert (first.st_size, first.st_mtime_ns) == (last.st_size, last.st_mtime_ns)
    assert len(value) == first.st_size
    return value

assert not O.exists()
assert git('rev-parse', 'HEAD').decode().strip() == BASE
assert git('branch', '--show-current').decode().strip() == 'audit/release-eb6de2e8'
assert not git('diff', '--cached', '--name-only').strip()
assert git('ls-remote', 'origin', 'refs/heads/audit/release-eb6de2e8').decode().split()[0] == BASE
summary = json.loads(stable(F / 'summary.json'))
report = json.loads(stable(F / 'report-original.json'))
before = json.loads(stable(F / 'source-before.json'))
after = json.loads(stable(F / 'source-after.json'))
inventory = json.loads(stable(F / 'inventory-original.json'))
assert int(stable(F / 'exit-original.txt').decode().strip()) == summary['exitCode'] == 0
assert summary['closedUtc'] == '2026-10-15T12:52:22.721011+00:00' and summary['status'] == 'PASS'
assert summary['suites'] == summary['passedSuites'] == 373
assert summary['tests'] == summary['passedTests'] == 5679
assert summary['failed'] == summary['pending'] == 0
assert report['success'] and report['numTotalTestSuites'] == report['numPassedTestSuites'] == 373
assert report['numTotalTests'] == report['numPassedTests'] == 5679
assert all(report[k] == 0 for k in ['numFailedTests', 'numPendingTests', 'numTodoTests', 'numFailedTestSuites', 'numPendingTestSuites'])
assert len(before) == len(after) == 1333 and before == after
assert all(sha(stable(R / name)) == value for name, value in before.items())
assert len(inventory) == len(set(inventory)) == 373
actual = [row['name'] for row in report['testResults']]
assert len(actual) == len(set(actual)) == 373 and set(actual) == set(inventory)
assert all(row['status'] == 'passed' and all(case['status'] == 'passed' for case in row['assertionResults']) for row in report['testResults'])
stderr = stable(F / 'stderr-original.log').decode('utf-8')
headers = re.findall(r'^(PASS|FAIL) (tests/[^\r\n]+?\.test\.js)(?:\s|$)', stderr, re.M)
assert len(headers) == 373 and len({p for _, p in headers}) == 373 and all(status == 'PASS' for status, _ in headers)
assert 'Test Suites: 373 passed, 373 total' in stderr
assert re.search(r'Tests:\s+5679 passed, 5679 total', stderr)
assert summary['sourceUnchanged'] and summary['exactInventory'] and summary['visibleAssetsUnchanged'] and summary['bothOrdinarySetups']
stock = json.loads(stable(F / 'existing-policy-chart-order-tests-unchanged.json'))
assert len(stock) == 371 and all(before[n] == v for n, v in stock.items())
app_index = json.loads(stable(D / 'private-context-closed-guards-pinned-copy-complete-publication-index.json'))
assert len(app_index['appPaths']) == 36
for name in app_index['appPaths']:
    value = stable(R / name)
    assert value == git('show', APP + ':' + name)
    assert sha(value) == before[name]

originals = sorted(p for p in F.iterdir() if p.is_file())
assert len(originals) == 19
original_bytes = {p: stable(p) for p in originals}
O.mkdir()
record = {
    'status': 'CLOSED_FULL_ORDINARY_PASS_ORIGINALS_RETAINED',
    'retainedUtc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'session': 29474, 'runnerHelper': 'verify-startup-pinned-copy-retention-bound-full-ordinary-once.py',
    'appSourceAudit': APP, 'actualSummary': summary,
    'exact373InventoryIndependentlyVerified': True, 'all1333FrozenInputsUnchanged': True,
    'all370PreexistingCurrentMainTestFilesUnchanged': True,
    'unchanged371ManifestIncludesNewTelemetryTest': True,
    'all36AppPathsEqualPublished7611Bytes': True,
    'ordinarySetupsAndStockAssertionsUnchanged': True,
    'localOnlyFixtures': ['exact-directory-bound physical retention', 'hidden-checkout testMatch', 'byte-identical visible assets and disposable uploads'],
    'stockCiHasNoneOfLocalFixtures': True,
    'originalClosedDirectory': F.relative_to(R).as_posix(),
    'earlierFailedOriginalsAndOpeningRecordsUnchanged': True,
    'productionOperations': 0, 'ciQualification': False, 'runtimeStartupQualification': False,
    'next': 'Prepare a normal codex source-only PR on freshly verified current main; require actual complete real PR CI and exact-head Claudio PASS before merge.'
}
result = O / 'closed-result-independently-verified.json'
result.write_text(json.dumps(record, indent=2), encoding='utf-8')
readme = R / 'WP/audit-release-eb6de2e8/README.md'
lead = '''## 2026-10-15 corrected full ordinary373/5679 CLOSED PASS / source-only PR next

SAME session29474 closed2026-10-15T12:52:22.721011UTC exit0: Test Suites: 373 passed, 373 total / Tests: 5679 passed, 5679 total; zero failed/pending/todo. Every373 unique reported suite equals discovery, all1333 frozen inputs unchanged, visible assets unchanged. Both ordinary setups, stock assertions, maxWorkers1/512000000/blank NODE_OPTIONS retained. LOCAL exact-root DB retention, hidden-worktree testMatch and byte-identical visible assets/disposable uploads are storage fixtures only; stock CI has none. Full19 original report/log/config/command/inventory/exit/source-before+after/declared mutable help-manifest-before+after/physical ledger retained untouched in full-pinned-copy-retention-bound-ordinary-once, with independent result and publication bindings in full-pinned-copy-retention-bound-closed-pass-once. All36 app paths equal published7611 source; all370 preexisting current-main test files unchanged (371 manifest additionally includes new unchanged telemetry test). Earlier original full2failures,166focused earlier race failure, zero-test setup refusal and all failed bytes remain honestly retained.

This is local full-suite PASS, not CI or production/startup qualification. Next normal codex/* source-only PR on exact fresh current main, actual full PR CI including both real Docker builds/boundary/readiness, then exact-head Claudio audit PASS before merge/current-main CI. Future app image/build/tooling/all-hash review/fresh computed capacity+10GB/new proof root remain required; never cde8/B5/100000 retry. No production operation/cleanup replay/no103; all refusal/science/fullhash/copy/race/600/805306368/forward-only/history guards hold. No proof DB copy removal underR1 pendingYY.

'''
readme.write_bytes(lead.encode() + readme.read_bytes())
paths = originals + [result, pathlib.Path(__file__), readme]
bindings = []
for p in paths:
    value = stable(p)
    bindings.append({'path': p.relative_to(R).as_posix(), 'length': len(value), 'sha256': sha(value),
        'gitBlobOid': hashlib.sha1(('blob ' + str(len(value)) + '\0').encode() + value).hexdigest()})
index = O / 'publication-index.json'
index.write_text(json.dumps({'baseAudit': BASE, 'status': record['status'], 'session': 29474,
    'appSourceAudit': APP, 'actualSummary': summary, 'files': bindings, 'productionOperations': 0}, indent=2), encoding='utf-8')
paths.append(index)
names = [p.relative_to(R).as_posix() for p in paths]
git('-c', 'core.autocrlf=false', 'add', '-f', '--', *names)
assert set(git('diff', '--cached', '--name-only').decode().splitlines()) <= set(names)
tree = git('write-tree').decode().strip()
for p, name in zip(paths, names):
    value = git('show', tree + ':' + name)
    oid = git('rev-parse', tree + ':' + name).decode().strip()
    assert value == stable(p) and hashlib.sha1(('blob ' + str(len(value)) + '\0').encode() + value).hexdigest() == oid
assert all(stable(p) == value for p, value in original_bytes.items())
assert all(sha(stable(R / name)) == value for name, value in before.items())
git('commit', '-m', 'Retain corrected startup full ordinary373 suites5679 tests PASS')
head = git('rev-parse', 'HEAD').decode().strip()
git('push', 'origin', 'audit/release-eb6de2e8')
assert git('ls-remote', 'origin', 'refs/heads/audit/release-eb6de2e8').decode().split()[0] == head
print(json.dumps({'head': head, 'rawVerifiedOwnedBlobs': len(paths), 'actualSummary': summary, 'sourceUnchanged': True}))
