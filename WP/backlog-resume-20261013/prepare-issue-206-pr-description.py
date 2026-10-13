"""Prepare the review description only after exact-inventory regression PASS."""
import json
import subprocess
from pathlib import Path

root = Path(__file__).resolve().parents[2]
evidence = Path(__file__).resolve().parent
summary = json.loads((evidence/'full-206-visible-completion/summary.json').read_bytes())
source = json.loads((evidence/'issue-206-context-review-ref.json').read_bytes())
assert summary['status'] == 'PASS' and summary['failedTests'] == 0 and summary['exactInventoryCoverage']
assert summary['passedTests'] == summary['totalTests'] and summary['pendingTests'] == 0
assert summary['frozenSourceUnchanged'] and summary['batchesSerial'] and summary['nodeOptions'] == ''
assert summary['reviewHead'] == source['reviewHead']
assert summary['scope'] == 'ALL_FROZEN_SOURCE_REGRESSION_SUITE_COVERAGE'
assert summary['ordinarySetupFilesPreserved'] and summary['unchangedStockAssertions']
assert summary['priorRunStatuses'] == {'74560': 'FAILED', '26052': 'INCOMPLETE', '87152': 'FAILED'}
assert (evidence/'full-206-visible-completion-runner-exit.txt').read_text().strip() == '0'
retained = json.loads((evidence/'full-context-pass-retention-206.json').read_bytes())
assert retained['summary'] == summary and retained['exactCoverageVerified']
head = subprocess.check_output(['git', 'rev-parse', 'codex/issue-206-containers'], cwd=root).decode().strip()
assert head == summary['reviewHead']
audit = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=root).decode().strip()
destination = evidence/'issue-206-pr-body.md'
assert not destination.exists(), 'Keep prior descriptions; inspect before replacing.'
body = f'''`Closes #206` — issue closure remains with Claudio after deployment and his post-deploy check.

Samples now have scoped, append-only physical containers with parentage, mass and locally generated printable QR labels. Sample detail shows the bulk → fine earth → aliquot hierarchy and linked attempts. New execution attempts and repeat reservations may select an active same-sample aliquot; existing #190/#191 guards and all historical links remain unchanged.

- Container codes use `container.codeFormat` / `container.sequenceReset` LAB policies and a separate transactional counter, preserving sample numbering. Both allocators reject collisions with sample aliases and container codes.
- The additive migration/installer provides source-bound receipts, read-only dry run, old-row/schema preservation, zero backfill and zero-change repeat/startup checks. New storage is empty; no analytical or historical attempt data is rewritten. Two LF attributes pin the migration bytes on every platform.
- Creation requires `MANAGE_CONTAINERS`, the existing laboratory/project scope and a named actor. Closed/held samples, invalid mass, foreign/inactive parents and foreign/non-aliquot attempt links return stable 4xx codes. Labels and policy strings cover all five locales.

Validation at `{head}`: complete coverage of all {summary['suiteCount']} unique discovered server suites / {summary['passedTests']} tests passed, with {summary['failedTests']} failed and {summary['pendingTests']} pending in the accepted results. The hash-bound coverage combines 324 valid passing suites on this frozen head with 38 remaining suites in fresh serial processes. Both ordinary owned database setup files, stock assertions and the default heap were preserved; exact inventory coverage and all 51 unchanged source hashes were checked. This is combined complete coverage, not one clean monolithic run. Client production build passed; canonical lint had zero errors and the same 14 baseline warning tuples. Desktop/mobile hierarchy and a 100 × 50 mm printed label were checked. Actual Chromium recorded all 40 determinations using keyboard input alone. Barcode, approval and container UI contracts passed together (41 tests), including an explicitly selected physical-aliquot repeat and clearing that selection when moving to another work item; unselected repeats retain their existing request shape.

[Raw regression, accepted-report hashes, source identities, review corrections and UI evidence](https://github.com/yigini/soilfer-lims/tree/{audit}/WP/backlog-resume-20261013). `full-context-pass-retention-206.json` indexes closed original reports and `full-206-visible-completion/progress.json` identifies every accepted result. Original attempts 74560 and 87152 remain FAILED (Express hidden-path SPA and raw-upload download refusals); 26052 remains INCOMPLETE (omitted ordinary setup plus a Windows native-process crash). Earlier interrupted/heap-exhausted runs also remain retained. Test-only path fixtures serve byte-identical built assets and owned disposable uploads outside the hidden `.codex` checkout; application source and stock assertions were unchanged, and `server/app.js` equals main. Standard Linux CI still needs to pass without these local path fixtures.

Deferred: locations/movement/custody (#207); consumption/disposal/retention transitions (#208). Inserted containers are ACTIVE and immutable until those reviewed successor contracts exist. Parent/child kinds intentionally have no fixed ordering: this tree records physical derivation, while preparation/method records continue to enforce processing rules. Workbench prepopulation/read-only display of an existing reserved OPEN attempt's aliquot remains a follow-up; the server preserves its original link and refuses a different selection, and sample detail displays attempt links.

Claudio's interim source review requested the LF and SPA-scope corrections; both are resolved. Final acceptance requires real PR CI and an audit PASS on this exact head. This PR grants no authority to replay any completed production release, build, proof, installer, verifier, gate or notice. A new forward deployment needs its own exact-kit review and fresh single-use gate under the standing authorization.
'''
destination.write_bytes(body.encode())
print(str(destination))
