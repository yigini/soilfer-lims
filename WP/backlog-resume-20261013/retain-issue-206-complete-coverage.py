"""Retain completed frozen-source coverage without relabelling failed attempts."""
import datetime, hashlib, json, subprocess
from pathlib import Path

root = Path(__file__).resolve().parents[2]
evidence = Path(__file__).resolve().parent
directory = evidence / 'full-206-visible-completion'
destination = evidence / 'full-context-pass-retention-206.json'
assert not destination.exists(), 'Single-use retention boundary.'
digest = lambda file: hashlib.sha256(file.read_bytes()).hexdigest()
summary = json.loads((directory / 'summary.json').read_bytes())
manifest = json.loads((directory / 'manifest.json').read_bytes())
progress = json.loads((directory / 'progress.json').read_bytes())
source = json.loads((evidence / 'issue-206-context-review-ref.json').read_bytes())
assert (evidence / 'full-206-visible-completion-runner-exit.txt').read_text().strip() == '0'
assert summary['status'] == 'PASS' and summary['scope'] == 'ALL_FROZEN_SOURCE_REGRESSION_SUITE_COVERAGE'
assert summary['failedTests'] == summary['pendingTests'] == 0
assert summary['passedTests'] == summary['totalTests'] == 5508
assert summary['reviewHead'] == manifest['reviewHead'] == source['reviewHead']
assert summary['source'] == manifest['source'] == source['auditSource']
assert summary['priorRunStatuses'] == {'74560': 'FAILED', '26052': 'INCOMPLETE', '87152': 'FAILED'}
for key in ['exactInventoryCoverage', 'frozenSourceUnchanged', 'batchesSerial',
            'originalReportsUnchanged', 'unchangedStockAssertions', 'ordinarySetupFilesPreserved',
            'visibleByteIdenticalAssets', 'visibleDisposableUploads']:
    assert summary[key]
assert summary['nodeOptions'] == '' and summary['productionMutations'] == 0
assert manifest['ordinarySetupFilesPreserved'] and not manifest['sourceChanged']
assert not manifest['stockAssertionsChanged'] and manifest['initialVisibleUploadsFiles'] == 0
assert subprocess.check_output(['git', 'rev-parse', 'codex/issue-206-containers'], cwd=root).decode().strip() == source['reviewHead']
assert len(progress) == summary['batches'] == 76
assert progress[:38] == manifest['priorPassingReports']
actual, totals = [], []
for row in progress:
    report = root / row['report']
    data = json.loads(report.read_bytes())
    assert digest(report) == row['sha256']
    assert data['success'] and data['numFailedTests'] == data['numPendingTests'] == 0
    assert data['numPassedTests'] == data['numTotalTests'] == row['passedTests'] == row['totalTests']
    assert row['source'] == source['auditSource'] and row['reviewHead'] == source['reviewHead']
    assert all(test['status'] == 'passed' for test in data['testResults'])
    assert all(test['status'] == 'passed' for result in data['testResults'] for test in result['assertionResults'])
    actual.extend(item['name'] for item in data['testResults'])
    totals.append(data['numPassedTests'])
assert sum(totals) == summary['passedTests']
assert sorted(actual) == sorted(manifest['suites'])
assert len(actual) == len(set(actual)) == summary['suiteCount'] == 362
assert len(manifest['sourceFileHashes']) == 51
assert all(digest(root / path) == value for path, value in manifest['sourceFileHashes'].items())
assert all(digest(root / path) == value for path, value in manifest['priorClosedFileHashes'].items())
for stem in ['full-206-context-serial', 'full-206-context-completion', 'full-206-owned-completion']:
    assert (evidence / (stem + '-runner-exit.txt')).read_text().strip() == '1'
    assert not (evidence / stem / 'summary.json').exists()
failed_first = json.loads((evidence / 'full-206-context-serial/batch-26.json').read_bytes())
failed_owned = json.loads((evidence / 'full-206-owned-completion/batch-39.json').read_bytes())
assert failed_first['numFailedTests'] == 2 and failed_owned['numFailedTests'] == 1
assert [Path(row['name']).name for row in failed_first['testResults'] if row['status'] == 'failed'] == ['reception_route_smoke.test.js']
assert [Path(row['name']).name for row in failed_owned['testResults'] if row['status'] == 'failed'] == ['spectral_multipart_upload.test.js']
assert subprocess.check_output(['git', 'show', source['reviewHead'] + ':server/app.js'], cwd=root) == subprocess.check_output(['git', 'show', source['base'] + ':server/app.js'], cwd=root)
assert not subprocess.check_output(['git', 'diff', '--cached', '--name-only'], cwd=root).strip(), 'Preserve prior staging.'
closed = []
for stem in ['full-206-context-serial', 'full-206-context-completion', 'full-206-owned-completion', 'full-206-visible-completion']:
    closed.extend(file for file in (evidence / stem).rglob('*') if file.is_file())
    closed.extend(evidence / (stem + suffix) for suffix in ['-runner.log', '-runner-exit.txt'])
closed.extend(evidence / name for name in [
    'run-issue-206-full-context-serial.py', 'finish-issue-206-frozen-regression.py',
    'finish-issue-206-frozen-regression-owned.py', 'finish-issue-206-visible-storage-regression.py',
    'visible-client-assets-206.setup.cjs', 'visible-test-storage-206.setup.cjs',
    'issue-206-context-review-ref.json', 'retain-issue-206-complete-coverage.py',
    'prepare-issue-206-pr-description.py'])
assert all(file.is_file() for file in closed)
closed = sorted(set(closed))
record = dict(retainedUtc=datetime.datetime.now(datetime.UTC).isoformat(), summary=summary,
    reviewHead=source['reviewHead'], auditSource=source['auditSource'], exactCoverageVerified=True,
    sourceRawHashesUnchanged=True, closedWriter=True, productionMutations=0,
    actualClaudioFinalVerdict='NOT YET', prCI='NOT YET',
    acceptedReports='76 hash-bound reports: 324 prior passing suites plus 38 fresh suites; no failed report accepted',
    failedAttempts=dict(run74560='FAILED: two hidden-path SPA assertions',
        run26052='INCOMPLETE: omitted ordinary setup and Windows native-process crash',
        run87152='FAILED: one hidden-path raw-upload download assertion'),
    files={str(file.relative_to(evidence)).replace('\\', '/'): dict(bytes=file.stat().st_size,
        sha256=digest(file)) for file in closed})
destination.write_bytes((json.dumps(record, indent=2) + '\n').encode())
prefix = f'''# #206 complete frozen-source regression coverage PASS — 2026-10-13

Source-only head `{source['reviewHead']}` / `codex/issue-206-containers`, audit source `{source['auditSource']}`: all 362 unique discovered suites / 5,508 tests PASS, zero failed or pending in the accepted results. Coverage combines 324 independently valid passing suites from closed source-pinned runs and 38 remaining suites in fresh serial processes. Both ordinary owned database setup files and stock assertions were preserved; all 51 frozen source hashes stayed unchanged. The final completion exited 0 at {summary['finishedUtc']}. No test writer remains. Raw files are indexed in `WP/backlog-resume-20261013/full-context-pass-retention-206.json`; accepted-report hashes and exact inventory are in `full-206-visible-completion/progress.json` and `manifest.json`.

Original run 74560 remains FAILED (two SPA hidden-path 404 assertions); 26052 remains INCOMPLETE (omitted ordinary setup plus Windows native-process crash); 87152 remains FAILED (one raw-upload hidden-path 404 assertion). Raw logs/reports remain unchanged and none is relabelled PASS. Test-only visible storage serves hash-identical built client assets and separately owned empty upload fixtures. Application source and stock assertions were unchanged; `server/app.js` equals main. Successful coverage is not described as one clean monolithic run. All consumed runners stay closed; never redispatch or overwrite them. The unused earlier `retain-issue-206-full-context-pass.py` assumes a failed run passed and MUST NOT be executed; this record was generated by `retain-issue-206-complete-coverage.py` instead.

Client build PASS; canonical lint zero errors and the same 14 baseline warning tuples. Desktop/mobile hierarchy, printed 100 × 50 mm QR label and actual Chromium keyboard recording of all 40 determinations were checked. The physical-aliquot context reproduction failed before its repair; 41 affected UI tests pass afterwards.

Local checks are ready for one source-only PR. Real PR CI and Claudio's actual exact-head audit verdict remain required before merge or any new release. No new production action. Completed PR294/#200 helpers, receipts and notices remain immutable. Same writer/worktree/branch; #103 stays read-only and human cards/drafts/files untouched. Earlier RUNNING statements below are historical and superseded by this completed-coverage record.

---

'''.encode()
readmes = ['WP/audit-release-eb6de2e8/README.md', 'WP/runtime-recovery-kobo/README.md']
for relative in readmes:
    file = root / relative
    file.write_bytes(prefix + file.read_bytes())
paths = [str(file.relative_to(root)).replace('\\', '/') for file in closed + [destination]] + readmes
subprocess.check_call(['git', 'add', '-f', '--'] + paths, cwd=root)
for file in closed + [destination]:
    relative = str(file.relative_to(root)).replace('\\', '/')
    blob = subprocess.check_output(['git', 'show', ':' + relative], cwd=root)
    assert hashlib.sha256(blob).hexdigest() == digest(file), relative
staged = subprocess.check_output(['git', 'diff', '--cached', '--name-only'], cwd=root).decode().splitlines()
assert set(staged).issubset(set(paths)) and all(path.startswith('WP/') for path in staged)
print(json.dumps(dict(status='RETAINED_AND_STAGED', rawFiles=len(closed),
    acceptedSuites=summary['suiteCount'], tests=summary['passedTests'], exactGitBlobHashesVerified=True,
    priorRunsStillFailedOrIncomplete=True, stagedPaths=len(staged), reviewHead=source['reviewHead']), indent=2))
