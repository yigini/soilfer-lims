"""Prepare the review description only after exact-inventory regression PASS."""
import json
import subprocess
from pathlib import Path

root = Path(__file__).resolve().parents[2]
evidence = Path(__file__).resolve().parent
summary = json.loads((evidence/'full-206-context-serial/summary.json').read_bytes())
source = json.loads((evidence/'issue-206-context-review-ref.json').read_bytes())
assert summary['status'] == 'PASS' and summary['failedTests'] == 0 and summary['exactInventoryCoverage']
assert summary['passedTests'] == summary['totalTests'] and summary['pendingTests'] == 0
assert summary['frozenSourceUnchanged'] and summary['batchesSerial'] and summary['nodeOptions'] == ''
assert summary['reviewHead'] == source['reviewHead']
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

Validation at `{head}`: all {summary['suiteCount']} discovered server suites / {summary['passedTests']} tests passed, with {summary['failedTests']} failed and {summary['pendingTests']} pending. Local execution used bounded sequential Jest processes, the ordinary owned database fixtures and the default heap; exact inventory coverage and unchanged source hashes were checked. Client production build passed; canonical lint had zero errors and the same 14 baseline warnings. Desktop/mobile hierarchy and a 100 × 50 mm printed label were checked. Actual Chromium recorded all 40 determinations using keyboard input alone. Barcode, approval and container UI contracts passed together (41 tests), including an explicitly selected physical-aliquot repeat and clearing that selection when moving to another work item; unselected repeats retain their existing request shape.

[Raw regression, source identities, review corrections and UI evidence](https://github.com/yigini/soilfer-lims/tree/{audit}/WP/backlog-resume-20261013). Earlier interrupted/heap-exhausted runs are retained separately and are not claimed as acceptance. The keyboard fixture serves byte-identical built assets from an owned visible directory so the hidden `.codex` checkout does not require a production SPA change; `server/app.js` equals main.

Deferred: locations/movement/custody (#207); consumption/disposal/retention transitions (#208). Inserted containers are ACTIVE and immutable until those reviewed successor contracts exist. Parent/child kinds intentionally have no fixed ordering: this tree records physical derivation, while preparation/method records continue to enforce processing rules. Workbench prepopulation/read-only display of an existing reserved OPEN attempt's aliquot remains a follow-up; the server preserves its original link and refuses a different selection, and sample detail displays attempt links.

Claudio's interim source review requested the LF and SPA-scope corrections; both are resolved. Final acceptance requires real PR CI and an audit PASS on this exact head. This PR grants no authority to replay any completed production release, build, proof, installer, verifier, gate or notice. A new forward deployment needs its own exact-kit review and fresh single-use gate under the standing authorization.
'''
destination.write_bytes(body.encode())
print(str(destination))
