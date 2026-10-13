"""Retain the closed context-switch reproduction, repair and interrupted run."""
import datetime
import hashlib
import json
import re
from pathlib import Path

root = Path(__file__).resolve().parents[2]
evidence = Path(__file__).resolve().parent
destination = evidence / 'context-review-corrections-206.json'
assert not destination.exists()
source = json.loads((evidence/'issue-206-context-review-ref.json').read_bytes())

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
after = warnings('client-lint-context-fix-206.log')
assert len(before) == 14 and before == after
closed = list((evidence/'full-206-ui-serial').glob('*')) + [evidence/name for name in [
    'full-206-ui-serial-runner.log',
    'aliquot-context-before-fix-206.log', 'aliquot-context-before-fix-206-exit.txt',
    'aliquot-context-after-fix-206.log', 'aliquot-context-after-fix-206-exit.txt',
    'client-build-context-fix-206.log', 'client-build-context-fix-206-exit.txt',
    'client-lint-context-fix-206.log', 'client-lint-context-fix-206-exit.txt',
    'issue-206-context-review-ref.json', 'advance-issue-206-context-review.py',
    'run-issue-206-full-context-serial.py']]
assert all(file.is_file() for file in closed)
for name in ['aliquot-context-after-fix-206-exit.txt', 'client-build-context-fix-206-exit.txt',
    'client-lint-context-fix-206-exit.txt']:
    assert (evidence/name).read_text().strip() == '0'
assert (evidence/'aliquot-context-before-fix-206-exit.txt').read_text().strip() == '1'
partial = json.loads((evidence/'full-206-ui-serial/progress.json').read_bytes())
assert len(partial) == 11 and all(item['success'] and item['exitCode'] == 0 for item in partial)
assert not (evidence/'full-206-ui-serial/summary.json').exists()
record = dict(observedUtc=datetime.datetime.now(datetime.UTC).isoformat(), reviewHead=source['reviewHead'],
    auditSource=source['auditSource'], interruptedRun=dict(session=16276, status='INTERRUPTED', exitCode=1,
        completedBatches=11, passedSuites=132, passedTests=sum(item['passedTests'] for item in partial),
        fullPass=False, reason='Stopped to repair an independently reproduced stale aliquot context.'),
    reproducedFailure=dict(exitCode=1, expectedSelection=None, observedSelection='physical-aliquot'),
    fix='Reset dilution aliquot selection whenever workItemId changes; second request omits unselected identity.',
    focused=dict(suites=3, tests=41, failed=0, pending=0), clientBuild='PASS',
    lint=dict(errors=0, warnings=14, unchangedFromBaseline=True, introduced=[]),
    activeFullRun=dict(session=74560, status='RUNNING', suites=362, directory='full-206-context-serial',
        sourceFrozen=True, concurrentJestProcesses=1, batchSize=12, nodeOptions=''),
    actualClaudioFinalVerdict='NOT YET', auditPass=False, productionMutations=0,
    human103Decision='Unanswered native see-first/approve-now clarification; no apply authority inferred.',
    files={str(file.relative_to(evidence)).replace('\\', '/'):dict(bytes=file.stat().st_size,
        sha256=hashlib.sha256(file.read_bytes()).hexdigest()) for file in closed})
destination.write_bytes((json.dumps(record, indent=2) + '\n').encode())
prefix = f'''# #206 item-context repair frozen; full regression running — 2026-10-13

Current source-only head `{source['reviewHead']}` / `codex/issue-206-containers`; audit source `{source['auditSource']}`. The dilution selector now clears a prior physical aliquot when moving to another work item. The reproducing test failed before the fix and the three affected suites / 41 tests pass afterwards. Client build passes; lint has zero errors and the same 14 baseline warning tuples. Claudio's earlier LF and SPA-scope findings stay resolved.

Run 16276 / `full-206-ui-serial/` was interrupted after 132 passing suites / 2,593 passing tests to freeze this repair. Its raw partial evidence remains retained and must never be called a full PASS, overwritten or resumed. ONE new frozen 362-suite regression is RUNNING in session 74560 / `full-206-context-serial/`, through `run-issue-206-full-context-serial.py`, with 12-suite sequential processes, ordinary owned fixtures, default heap and blank NODE_OPTIONS. Observe the same process; do not dispatch duplicate Jest or change frozen source. Closed evidence and exact hashes: `context-review-corrections-206.json`.

No PR until the complete full suite passes. Real PR CI and actual exact-head Claudio acceptance still follow. No new release/kit/gate or production operation; every completed PR294/#200 helper, receipt and notice stays immutable. #103 remains read-only; the native clarification card is unanswered and no apply go is inferred. Human files, drafts and YY cards are untouched. Same worktree, branch and writer.

---

'''.encode()
for relative in ['WP/audit-release-eb6de2e8/README.md', 'WP/runtime-recovery-kobo/README.md']:
    file = root/relative
    file.write_bytes(prefix + file.read_bytes())
print(json.dumps({key:val for key,val in record.items() if key != 'files'}, indent=2))
