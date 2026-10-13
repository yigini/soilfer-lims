"""Retain only an actually completed frozen regression; never snapshot an active run."""
import datetime
import hashlib
import json
import subprocess
from pathlib import Path

root = Path(__file__).resolve().parents[2]
evidence = Path(__file__).resolve().parent
directory = evidence/'full-206-context-serial'
destination = evidence/'full-context-pass-retention-206.json'
assert not destination.exists()
summary = json.loads((directory/'summary.json').read_bytes())
manifest = json.loads((directory/'manifest.json').read_bytes())
source = json.loads((evidence/'issue-206-context-review-ref.json').read_bytes())
assert (evidence/'full-206-context-serial-runner-exit.txt').read_text().strip() == '0'
assert summary['status'] == 'PASS' and summary['failedTests'] == 0 and summary['pendingTests'] == 0
assert summary['passedTests'] == summary['totalTests']
assert summary['reviewHead'] == manifest['reviewHead'] == source['reviewHead']
assert summary['source'] == manifest['source'] == source['auditSource']
assert summary['exactInventoryCoverage'] and summary['frozenSourceUnchanged'] and summary['batchesSerial']
assert summary['nodeOptions'] == ''
assert subprocess.check_output(['git','rev-parse','codex/issue-206-containers'], cwd=root).decode().strip() == source['reviewHead']
actual=[]
for report in sorted(directory.glob('batch-*.json')):
    data=json.loads(report.read_bytes())
    assert data['success'] and data['numFailedTests'] == 0 and data['numPendingTests'] == 0
    actual.extend(item['name'] for item in data['testResults'])
assert sorted(actual)==sorted(manifest['suites']) and len(actual)==len(set(actual))==summary['suiteCount']
assert all(hashlib.sha256((root/path).read_bytes()).hexdigest()==digest
    for path,digest in manifest['sourceFileHashes'].items())
closed=list(directory.glob('*')) + [evidence/'full-206-context-serial-runner.log',
    evidence/'full-206-context-serial-runner-exit.txt', evidence/'run-issue-206-full-context-serial.py']
assert all(file.is_file() for file in closed)
record=dict(retainedUtc=datetime.datetime.now(datetime.UTC).isoformat(), summary=summary,
    reviewHead=source['reviewHead'], auditSource=source['auditSource'], exactCoverageVerified=True,
    sourceRawHashesUnchanged=True, closedWriter=True, productionMutations=0,
    actualClaudioFinalVerdict='NOT YET', prCI='NOT YET',
    files={str(file.relative_to(evidence)).replace('\\','/'):dict(bytes=file.stat().st_size,
        sha256=hashlib.sha256(file.read_bytes()).hexdigest()) for file in closed})
destination.write_bytes((json.dumps(record,indent=2)+'\n').encode())
prefix=f'''# #206 frozen source full regression PASS — 2026-10-13

Source-only review head `{source['reviewHead']}` / `codex/issue-206-containers`, audit source `{source['auditSource']}`: all {summary['suiteCount']} discovered suites / {summary['passedTests']} tests PASS, zero failures or skips, {summary['batches']} sequential bounded batches at the default heap and blank NODE_OPTIONS. The exact discovered inventory ran once and all frozen raw source hashes stayed unchanged. Run 74560 completed exit0; it is closed and must not be replayed or overwritten. All raw results/logs plus exact byte sizes and SHA256 are retained under `full-206-context-serial/` and indexed by `full-context-pass-retention-206.json`.

Client build PASS; canonical lint zero errors and the same 14 baseline warnings. Actual desktop/mobile hierarchy, printed 100 × 50 mm QR label and keyboard-only recording of 40 determinations were checked. The context-switch reproduction failed before the fix and now passes. Earlier interrupted/failed/OOM runs are retained honestly and do not substitute for this completed run.

Local checks are ready for a source-only PR. Real PR CI and Claudio's actual exact-head final audit verdict remain required; no audit PASS or production deployment is claimed. Completed PR294/#200 releases, helpers, evidence and notices remain immutable. Same writer/worktree/branch; #103 remains read-only and all human cards/drafts/files untouched.

---

'''.encode()
for relative in ['WP/audit-release-eb6de2e8/README.md','WP/runtime-recovery-kobo/README.md']:
    file=root/relative
    file.write_bytes(prefix+file.read_bytes())
print(json.dumps({key:val for key,val in record.items() if key!='files'},indent=2))
