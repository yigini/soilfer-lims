"""Publish the same full runner's CLOSED originals, including every failure.

Prepared while session76923 is active. Execute ONCE only after that SAME
session has returned completion. This helper never runs tests or edits source.
"""
import datetime
import hashlib
import json
import pathlib
import re
import subprocess

R = pathlib.Path(__file__).resolve().parents[2]
D = R / 'WP/startup-order-readiness-20261015'
F = D / 'full-ordinary-once'
O = D / 'full-ordinary-closed-terminal-once'
BASE = '4649a05e8b0a8bf488c3371f62154f84662ed096'

def cmd(*args):
    return subprocess.check_output(args, cwd=R, stderr=subprocess.PIPE)

def sha(value):
    return hashlib.sha256(value).hexdigest()

def stable_bytes(file):
    first = file.stat()
    assert file.is_file() and first.st_size <= 100 * 1024 * 1024
    value = file.read_bytes()
    last = file.stat()
    assert (first.st_size, first.st_mtime_ns) == (last.st_size, last.st_mtime_ns)
    assert len(value) == first.st_size
    return value

assert not O.exists()
assert cmd('git', 'rev-parse', 'HEAD').decode().strip() == BASE
assert not cmd('git', 'diff', '--cached', '--name-only').strip()
assert cmd('git', 'ls-remote', 'origin', 'refs/heads/audit/release-eb6de2e8').decode().split()[0] == BASE
summary = json.loads(stable_bytes(F / 'summary.json'))
before = json.loads(stable_bytes(F / 'source-before.json'))
after = json.loads(stable_bytes(F / 'source-after.json'))
report = json.loads(stable_bytes(F / 'report-original.json'))
inventory = json.loads(stable_bytes(F / 'inventory-original.json'))
exit_code = int(stable_bytes(F / 'exit-original.txt').decode().strip())
assert summary['closedUtc'] and exit_code == summary['exitCode']
assert summary['status'] in ['PASS', 'FAILED_OR_INCOMPLETE']
assert len(before) == len(after) == 1332 and before == after
assert all(sha(stable_bytes(R / name)) == value for name, value in before.items())
assert len(inventory) == len(set(inventory)) == 373
actual_inventory = [row['name'] for row in report.get('testResults', [])]
exact_inventory = len(actual_inventory) == len(inventory) and set(actual_inventory) == set(inventory)
assert exact_inventory == summary['exactInventory']

originals = sorted(file for file in F.iterdir() if file.is_file())
original_bytes = {file: stable_bytes(file) for file in originals}
assert {file.name for file in originals} >= {
    'command.json', 'config-original.json', 'config-stderr-original.log',
    'derived-help-manifest-before-original.json', 'derived-help-manifest-after-original.json',
    'existing-policy-chart-order-tests-unchanged.json', 'inventory-original.json',
    'inventory-stderr-original.log', 'open-metadata.json', 'physical-retention-original.jsonl',
    'report-original.json', 'source-before.json', 'source-after.json',
    'stderr-original.log', 'stdout-original.log', 'summary.json',
    'exit-original.txt', 'visible-local-storage.json'
}
failed = [{
    'name': row['name'], 'status': row.get('status'),
    'message': row.get('message'),
    'failedAssertions': [case for case in row.get('assertionResults', []) if case.get('status') == 'failed']
} for row in report.get('testResults', [])
    if row.get('status') != 'passed' or any(case.get('status') == 'failed' for case in row.get('assertionResults', []))]
text = re.sub(r'\x1b\[[0-9;]*m', '', original_bytes[F / 'stderr-original.log'].decode('utf-8'))
findings = []
for body in re.findall(r'\+\s+Object \{([\s\S]*?)\+\s+\}', text):
    finding = dict(re.findall(r'\+\s+"(code|detail|file)": "([^"]+)"', body))
    line = re.search(r'\+\s+"line": (\d+)', body)
    if finding and line:
        finding['line'] = int(line[1])
        findings.append(finding)

O.mkdir()
record = {
    'status': 'CLOSED_ORIGINALS_RETAINED_WITH_ACTUAL_RESULT',
    'retainedUtc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'runnerSession': 76923,
    'runnerHelper': 'verify-startup-context-full-ordinary-once.py',
    'actualSummary': summary, 'reportSuccess': report.get('success'),
    'exactInventoryIndependentlyVerified': exact_inventory,
    'all1332FrozenInputsUnchanged': True,
    'allFailures': failed,
    'scannerFindingsParsedDerivedFromFullClosedStderr': findings,
    'closedOriginalsDirectory': F.relative_to(R).as_posix(),
    'earlierOpenExcerptsRemainUntouched': True,
    'noTestRedispatchOrProductionOperations': True,
    'notCiBuildOrStartupQualification': True,
    'sourceCorrectionsStillRequired': True,
    'requiredSuccessors': [
        'Inspect every closed failure before correcting new performance source/tests.',
        'Verify isolated CLI missing-context dependency cause, then lazy-load context only on explicit opt-in; default CLI stays independent.',
        'Keep stock scanner/assertions and original policy/chart/order tests unchanged. Use literal integrity/FK queries, private cached rows, ordinary prepared-method binding and narrow closed test fixture authority.',
        'Add actual earlier order-policy snapshot race equivalence before fixing nested copy alias handling; preserve final ORDER_REVISION_SNAPSHOT_CHANGED and all original copy/hash guards.',
        'Add owned WAL-mode absent/empty and genuinely nonempty WAL fixtures; compare all26 reports and exactly-once checks without inventing an unobserved failure or relaxing original guards.',
        'Run new uniquely named focused/full successors as warranted. No source PR readiness, CI, image or proof qualification inferred from this retention.'
    ]
}
result_file = O / 'closed-result-and-all-failures-parsed-derived.json'
result_file.write_text(json.dumps(record, indent=2), encoding='utf-8')
readme = R / 'WP/audit-release-eb6de2e8/README.md'
lead = (
    '## 2026-10-15 full373 CLOSED / actual result retained before source correction\n\n'
    f"Same session76923 CLOSED {summary['closedUtc']}, exit{exit_code}, status{summary['status']}; "
    f"actual suites{summary.get('suites')}, tests{summary.get('tests')}, passedSuites{summary.get('passedSuites')}, "
    f"passedTests{summary.get('passedTests')}, failedTests{summary.get('failed')}, pending{summary.get('pending')}. "
    f"Exact inventory={exact_inventory}; all1332 frozen source inputs unchanged. "
    'Full original report/stdout/stderr/exit/config/inventory/source-before+after/declared mutable output-before+after retained at '
    'WP/startup-order-readiness-20261015/full-ordinary-once; all failure details and parsed scanner findings at '
    'full-ordinary-closed-terminal-once. Original failed bytes and earlier OPEN records remain untouched. '
    'Current startup performance source is DRAFT/not PR-ready: correct new context dependency/visible SQL and owned test fixtures, '
    'then verify WAL-mode equivalence and earlier order-snapshot race with new unique meaningful successors. '
    'No stock scanner or assertion weakening, general runtime writer exemption, hidden SQL forwarding, or changes to existing209/chart/policy tests. '
    'All refusal codes/conditions/report/science/copy/hash/race/600/805306368/forward-only guards remain. '
    'No production operation/cleanup replay/new CI/build/proof/deployment.\n\n'
)
readme.write_bytes(lead.encode() + readme.read_bytes())
paths = originals + [result_file, pathlib.Path(__file__), readme]
bindings = []
for file in paths:
    value = stable_bytes(file)
    bindings.append({'path': file.relative_to(R).as_posix(), 'length': len(value),
        'sha256': sha(value), 'gitBlobOid': hashlib.sha1(('blob ' + str(len(value)) + '\0').encode() + value).hexdigest()})
index = O / 'publication-index.json'
index.write_text(json.dumps({'baseAudit': BASE, 'status': 'CLOSED_ACTUAL_RESULT_NOT_QUALIFICATION',
    'runnerSession': 76923, 'actualSummary': summary, 'ownedBindings': bindings,
    'originalReportsPreservedByteForByte': True, 'productionOperations': 0}, indent=2), encoding='utf-8')
paths.append(index)
names = [file.relative_to(R).as_posix() for file in paths]
cmd('git', '-c', 'core.autocrlf=false', 'add', '-f', '--', *names)
staged = set(cmd('git', 'diff', '--cached', '--name-only').decode().splitlines())
assert staged and staged <= set(names)
assert result_file.relative_to(R).as_posix() in staged and index.relative_to(R).as_posix() in staged
tree = cmd('git', 'write-tree').decode().strip()
for file, name in zip(paths, names):
    value = cmd('git', 'show', tree + ':' + name)
    oid = cmd('git', 'rev-parse', tree + ':' + name).decode().strip()
    assert value == stable_bytes(file)
    assert hashlib.sha1(('blob ' + str(len(value)) + '\0').encode() + value).hexdigest() == oid
assert all(stable_bytes(file) == value for file, value in original_bytes.items())
assert all(sha(stable_bytes(R / name)) == value for name, value in before.items())
cmd('git', 'commit', '-m', 'Retain complete startup context full-suite terminal result and all failures')
head = cmd('git', 'rev-parse', 'HEAD').decode().strip()
cmd('git', 'push', 'origin', 'audit/release-eb6de2e8')
assert cmd('git', 'ls-remote', 'origin', 'refs/heads/audit/release-eb6de2e8').decode().split()[0] == head
print(json.dumps({'head': head, 'rawVerifiedOwnedBlobs': len(paths), 'actualSummary': summary,
    'failedSuites': len(failed), 'scannerFindingCount': len(findings), 'sourceUnchanged': True}))
