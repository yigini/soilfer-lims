"""Retain the actual interim review and completed source-correction evidence."""
import datetime
import hashlib
import json
import re
from pathlib import Path

root = Path(__file__).resolve().parents[2]
evidence = Path(__file__).resolve().parent
record_path = evidence / 'review-corrections-206.json'
assert not record_path.exists(), 'Keep prior evidence; no overwrite.'
source = json.loads((evidence / 'issue-206-corrected-review-ref.json').read_bytes())
names = ['server-full-final-206.log', 'keyboard-review-correction-206.log',
    'keyboard-review-correction-206-exit.txt', 'issue-206-corrected-review-ref.json',
    'advance-issue-206-source-review.py', 'run-issue-206-full-serial.py']
files = {name: dict(bytes=len((evidence/name).read_bytes()), sha256=hashlib.sha256((evidence/name).read_bytes()).hexdigest()) for name in names}
interrupted = (evidence / 'server-full-final-206.log').read_text(errors='replace')
keyboard = (evidence / 'keyboard-review-correction-206.log').read_text(errors='replace')
assert 'Test Suites: 1 passed, 1 total' in keyboard and 'Tests:       1 passed, 1 total' in keyboard
assert (evidence / 'keyboard-review-correction-206-exit.txt').read_text().strip() == '0'
record = dict(observedUtc=datetime.datetime.now(datetime.UTC).isoformat(),
    actualNativeTarget='Claude / LIMS Audit / Lab workflow audit and plan',
    interimReviewHead=source['priorHead'], reviewHead=source['reviewHead'], auditSource=source['auditSource'],
    actualReviewerFindings=[
        '.gitattributes Windows line endings: restore LF and retain only the two new byte pins.',
        'server/app.js SPA fallback is outside #206: drop it or justify its necessity in the PR.',
    ], resolutions=[
        'Binary Git stdin: source review attributes have zero CR bytes and two LF additions.',
        'server/app.js equals main exactly; owned keyboard fixture serves identical built assets from a visible test directory.',
        'Physical parentage has no mandatory kind ordering; documented alongside #207/#208 deferrals.',
    ], finalVerdict='WITHHELD pending complete regression and CI', auditPass=False,
    interruptedFullRun=dict(session=17934, exitCode=1, reason='Stopped before source corrections to freeze the successor.',
        completedPassSuites=len(re.findall(r'^PASS ', interrupted, re.M)), fullSuitePass=False),
    correctedKeyboard=dict(session=37711, exitCode=0, recordedDeterminations=40, keyboardOnly=True),
    activeFullRun=dict(session=38170, suiteCount=362, status='RUNNING', batchSize=12,
        concurrentJestProcesses=1, nodeOptions='', directory='full-206-serial'),
    files=files, productionMutations=0, newWorktrees=0)
record_path.write_bytes((json.dumps(record, indent=2) + '\n').encode())
checkpoint = f'''# #206 source corrections; full regression in progress — 2026-10-13

Claudio inspected source `7b893c5` and withheld his final verdict pending the full regression and CI. His two pre-PR findings are resolved at source-only review head `{source['reviewHead']}` (`codex/issue-206-containers`); audit source `{source['auditSource']}`. `.gitattributes` now has only two added LF entries and zero CR bytes. `server/app.js` equals main exactly. The owned keyboard fixture uses byte-identical built assets outside the hidden checkout; actual Chromium keyboard recording of 40 determinations passed. Physical parentage intentionally has no fixed kind ordering, documented with the #207/#208 lifecycle and location deferrals.

The preceding full run was stopped after {record['interruptedFullRun']['completedPassSuites']} passing suites to freeze those corrections. The new full run covers the exact 362-suite inventory in sequential batches of 12 at the default heap, with no concurrent Jest process. It is **RUNNING**, not a full PASS. Observe the same session 38170 and `WP/backlog-resume-20261013/full-206-serial/`; never dispatch a duplicate runner. Completed raw evidence and actual interim-review transcription: `WP/backlog-resume-20261013/review-corrections-206.json`.

No PR yet: CONTRIBUTING requires the full suite to pass before submission. Final exact-head Claudio acceptance still requires complete regression and real PR CI. No release or production operation. PR294/#200 and its completed build/proof/kit/gate/install/verification/notices stay immutable. Same worktree/branch/writer; human files, drafts and YY cards untouched.

---

'''.encode()
for relative in ['WP/audit-release-eb6de2e8/README.md', 'WP/runtime-recovery-kobo/README.md']:
    file = root / relative
    old = file.read_bytes()
    file.write_bytes(checkpoint + old)
print(json.dumps(record, indent=2))
