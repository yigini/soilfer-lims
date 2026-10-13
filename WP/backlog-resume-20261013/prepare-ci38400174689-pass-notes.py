"""Record the verified CI pass in the two current notes once."""
import json
import subprocess
from pathlib import Path

root = Path(__file__).resolve().parents[2]
work = Path(__file__).resolve().parent
pin = json.loads((work / 'ci-38400174689-completed-success/index.json').read_text(encoding='utf-8'))
assert pin['status'] == 'COMPLETED_SUCCESS'
assert pin['exactJestSummary'] == ['Test Suites: 362 passed, 362 total', 'Tests:       5508 passed, 5508 total']
heading = '# #206 PR295 full CI PASS; final exact-head audit pending — 2026-10-13\n\n'
prefix = heading + '''PR295 remains OPEN at source-only head `1a0702b3be410ac1dcdd9dc92f0f0c3dd2774a3a`, base `959d17e11c357266f7c2a41b0c84ab76914c591e`. Real CI [38400174689](https://github.com/yigini/soilfer-lims/actions/runs/38400174689), attempt 1, completed SUCCESS at 13:25:41 UTC. The closed original archive, extracted server/Docker boundary/readiness logs, full run/jobs/PR API records, entry inventory and exact hashes are retained in `WP/backlog-resume-20261013/ci-38400174689-completed-success/index.json`. Retainer `retain-ci38400174689-completed-success.py` completed once and must never be rerun or overwrite this evidence.

Exact final Jest summary:

```text
Test Suites: 362 passed, 362 total
Tests:       5508 passed, 5508 total
```

All 362 unique PASS suite paths exactly match the frozen full discovery inventory; zero failures, skips or pending. This is the complete ordinary Linux CI run without local path fixtures. Client build, candidate Docker build, supported baseline `48d0e526ded03232ac8516dd867f4b14923bdb58` Docker build, real disposable Docker boundary rehearsal and deployment readiness acceptance all completed SUCCESS. Raw logs bind candidate `sha256:01156a6664039eda5c5291e471a9e1a70672c0383ed9a335f333cce3a83e747f` and baseline `sha256:cfe2f47c47d421ec18275c74e77b35855aa93d18bb324f8b758b9874fbbaa254` in disposable CI resources. These are CI evidence, not a production release/image.

Actual Claudio scope acceptance #206/6145765510 remains satisfied: only the test script differs from prior `9ae02f6a`, using one serial recyclable worker with the unchanged discovery/config/setup/teardown/timeouts/assertions/8192 MB CI heap. All prior 51 source paths are byte-identical between source commits, and `server/app.js` equals main. Prior local complete combined coverage and failed/incomplete runs remain honestly identified by their original heads. Original CI38393187129 stays FAILED/incomplete, never retried. No source push follows this pass.

Next: one ready-for-audit label/comment and one final native handoff for this exact head, then Claudio's actual fresh audit PASS before merge. Current native read confirms LIMS Audit / Lab workflow audit and plan with both empty composers and the #103 human clarification unanswered. Human files/cards/drafts remain untouched. `closingIssuesReferences=[]`; #206 remains OPEN for Claudio's actual post-deploy closure. No new release/kit/gate/production operation, no local runner or helper remains. Historical completed production releases and notices remain immutable. Same worktree, branch and writer.

---

'''
paths = []
for rel in ['WP/audit-release-eb6de2e8/README.md', 'WP/runtime-recovery-kobo/README.md']:
    path = root / rel
    old = path.read_text(encoding='utf-8')
    assert heading.strip() not in old
    path.write_bytes((prefix + old).encode('utf-8'))
    paths.append(rel)
paths.append(str(Path(__file__).relative_to(root)).replace('\\', '/'))
subprocess.check_call(['git','add','--',*paths],cwd=root)
staged = subprocess.check_output(['git','diff','--cached','--name-only'],cwd=root).decode().splitlines()
assert len(staged) == 12
assert all(p.startswith('WP/backlog-resume-20261013/ci-38400174689-completed-success/') or
           p in paths or p == 'WP/backlog-resume-20261013/retain-ci38400174689-completed-success.py' for p in staged)
print(json.dumps({'stagedPaths':staged,'exactJestSummary':pin['exactJestSummary']}))
