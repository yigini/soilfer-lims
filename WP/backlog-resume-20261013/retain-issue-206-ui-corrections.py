"""Retain closed UI failures and repaired evidence; never capture the active run."""
import datetime
import hashlib
import json
import re
from pathlib import Path

root = Path(__file__).resolve().parents[2]
evidence = Path(__file__).resolve().parent
destination = evidence / 'ui-review-corrections-206.json'
assert not destination.exists()
source = json.loads((evidence/'issue-206-ui-review-ref.json').read_bytes())
def warnings(name):
    filename = None
    rows = []
    for line in (evidence/name).read_text(errors='replace').splitlines():
        if line.startswith(str(root)):
            filename = line.replace(str(root), '').replace('\\', '/')
        if re.search(r'\d+:\d+\s+warning\s+', line):
            rows.append((filename, re.sub(r'\s+', ' ', line.strip())))
    return sorted(rows)
before = warnings('client-lint-canonical-206.log')
after = warnings('client-lint-ui-correction-206.log')
assert len(before) == 14 and before == after
closed = list((evidence/'full-206-serial').glob('*')) + [evidence/name for name in [
    'full-206-serial-runner.log', 'full-206-serial-runner-exit.txt',
    'ui-compatibility-correction-206.log', 'ui-compatibility-correction-206-exit.txt',
    'ui-compatibility-final-206.log', 'ui-compatibility-final-206-exit.txt',
    'ui-compatibility-reviewed-206.log', 'ui-compatibility-reviewed-206-exit.txt',
    'client-build-ui-correction-206.log', 'client-build-ui-correction-206-exit.txt',
    'client-lint-ui-correction-206.log', 'client-lint-ui-correction-206-exit.txt',
    'issue-206-ui-review-ref.json', 'advance-issue-206-ui-review.py', 'run-issue-206-full-ui-serial.py']]
assert all(file.is_file() for file in closed)
for name in ['ui-compatibility-reviewed-206-exit.txt', 'client-build-ui-correction-206-exit.txt', 'client-lint-ui-correction-206-exit.txt']:
    assert (evidence/name).read_text().strip() == '0'
failed = json.loads((evidence/'full-206-serial/batch-12.json').read_bytes())
assert failed['numFailedTests'] == 15 and not failed['success']
record = dict(observedUtc=datetime.datetime.now(datetime.UTC).isoformat(), reviewHead=source['reviewHead'],
    auditSource=source['auditSource'], failedRun=dict(session=38170, exitCode=1, failedTests=15,
        failedSuites=[item['name'] for item in failed['testResults'] if item['status'] == 'failed'], fullPass=False),
    fixes=['Explicit React bindings for the three new JSX components.',
        'Unselected repeat omits the optional aliquot field; selected repeat sends the chosen physical identity.'],
    focused=dict(suites=3, tests=41, failed=0, pending=0), clientBuild='PASS',
    lint=dict(errors=0, warnings=14, unchangedFromBaseline=True, introduced=[]),
    activeFullRun=dict(session=16276, status='RUNNING', suites=362, directory='full-206-ui-serial',
        sourceFrozen=True, concurrentJestProcesses=1, batchSize=12, nodeOptions=''),
    actualClaudioFinalVerdict='NOT YET', auditPass=False, productionMutations=0,
    files={str(file.relative_to(evidence)).replace('\\', '/'):dict(bytes=file.stat().st_size,
        sha256=hashlib.sha256(file.read_bytes()).hexdigest()) for file in closed})
destination.write_bytes((json.dumps(record, indent=2) + '\n').encode())
prefix = f'''# #206 UI compatibility repaired; successor full regression running — 2026-10-13

Current source-only head `{source['reviewHead']}` / `codex/issue-206-containers`; audit source `{source['auditSource']}`. Claudio's LF and SPA-scope findings stay resolved: two LF attribute additions, zero CR bytes, and `server/app.js` exactly main. Subsequent regression stopped at batch 12 with 15 UI failures (classic JSX React binding and an unnecessary null field on unselected repeat requests). Those failures are repaired. Three affected suites / 41 tests PASS, rebuilt client PASS, canonical lint zero errors and the identical 14 baseline warnings.

The failed run is retained under `WP/backlog-resume-20261013/full-206-serial/` and must not be resumed, overwritten or called PASS. ONE new frozen 362-suite regression is RUNNING in session 16276 / `full-206-ui-serial/`, through `run-issue-206-full-ui-serial.py`; 12-suite sequential processes, ordinary owned fixtures, default heap and blank NODE_OPTIONS. Observe that SAME run; no concurrent Jest or duplicate dispatch. No full PASS or final Claudio acceptance yet. Closed raw logs and exact hashes: `ui-review-corrections-206.json`.

No PR until complete full-suite PASS, then actual PR CI and exact-head Claudio audit. No new release/kit/gate or production operation. PR294/#200 and every completed historical helper/receipt/notice remain immutable. Same worktree, branch and writer; human files, drafts and YY cards untouched.

---

'''.encode()
for relative in ['WP/audit-release-eb6de2e8/README.md', 'WP/runtime-recovery-kobo/README.md']:
    file = root/relative
    file.write_bytes(prefix + file.read_bytes())
print(json.dumps({key:value for key,value in record.items() if key != 'files'}, indent=2))
