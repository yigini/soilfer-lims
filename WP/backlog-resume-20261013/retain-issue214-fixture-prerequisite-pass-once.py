"""Checkpoint the closed corrected fixture PASS and its exact retained statements."""
import datetime, hashlib, json, subprocess, sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf-8')
root = Path(__file__).resolve().parents[2]
wp = Path(__file__).parent
run = wp / 'issue214-compatibility-prerequisite-corrected'
def git(*args, binary=False):
    result = subprocess.run(['git', *args], cwd=root, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if result.returncode: raise RuntimeError(result.stderr.decode('utf-8', 'replace'))
    return result.stdout if binary else result.stdout.decode('utf-8').strip()
assert git('branch', '--show-current') == 'audit/release-eb6de2e8'
assert git('rev-parse', 'HEAD') == '9908030b2f5d0bb91cc7e36c45814074450dccb7'
assert not git('diff', '--cached', '--name-only')
summary = json.loads((run / 'summary.json').read_bytes())
assert summary['status'] == 'PASS' and summary['suites'] == 12 and summary['tests'] == summary['passedTests'] == 175
assert summary['failed'] == summary['pending'] == 0 and summary['sourceUnchanged'] and summary['inventoryEqual']
before = json.loads((run / 'source-before.json').read_bytes())
assert before == json.loads((run / 'source-after.json').read_bytes())
assert all(hashlib.sha256((root / path).read_bytes()).hexdigest() == digest for path, digest in before.items())
relative = 'server/tests/contracts/audit_2_3_compatibility_runs.test.js'
current = (root / relative).read_bytes().decode().replace('\r\n', '\n')
restored = current.replace(', nativeCurrentSchema = false', '').replace(", nativeCurrentSchema: targetKind === 'NATIVE'", '')
start = restored.index('    if (nativeCurrentSchema) {\n')
end = restored.index('    }\n', start) + len('    }\n')
inserted = restored[start:end]
assert inserted.count('require(') == 6
restored = restored[:start] + restored[end:]
baseline = git('show', '6d750914d8565acdd496767a7dd935811b5a89b2:' + relative, binary=True).decode().replace('\r\n', '\n')
assert restored == baseline, 'Only the approved fixture context may change; every original statement remains identical.'
dest = wp / 'issue214-fixture-prerequisite-pass'
assert not dest.exists(); dest.mkdir()
record = {'retainedUtc': datetime.datetime.now(datetime.UTC).isoformat(), 'sessionId': 53157,
    'summary': summary, 'compatibilityOriginalStatementsByteIdenticalAfterRemovingFixtureContext': True,
    'releasedBaseline': '6d750914d8565acdd496767a7dd935811b5a89b2',
    'normalInstallersOnlyForNativeCase': True, 'futureFullHelper': 'verify-issue214-full-fixture-corrected-once.py',
    'futureFullStatus': 'PREPARED_NOT_EXECUTED', 'productionOperations': 0}
(dest / 'terminal-boundary.json').write_bytes((json.dumps(record, indent=2) + '\n').encode())
status = ('## 2026-10-13 #214 corrected fixture regression CLOSED PASS; new full successor prepared\n\n'
    f"The unique successor closed at {summary['observedUtc']} with12/12 suites and175/175 tests PASS,0failed/pending, "
    'unchanged frozen source, all ordinary setups/assertions, single worker512MB and blank local NODE_OPTIONS. '
    'It includes all eight formerly failing suites, the three new chart suites and the retained Native suite. '
    'The compatibility fixture installs normal WorkAttempt/repeat/calculation/import/container/chart predecessors '
    'only for its new Native case. Removing that fixture context leaves every original released statement byte-identical. '
    'No-LRM fixtures keep their original policy version. Byte-identical visible assets and disposable uploads are local '
    'filesystem fixtures only. Closed originals/hashes are at `WP/backlog-resume-20261013/issue214-fixture-prerequisite-pass/index.json`. '
    'Earlier full365/5547 with12failures, focused175/28failures and pre-test configuration refusal remain honest and immutable. '
    'The new full365-suite successor is PREPARED, not yet a result. No214 PR, realCI, audited head, merge, kit, gate '
    'or production operation exists. #103 remains without production connection or apply go.\n\n')
readmes = ['WP/audit-release-eb6de2e8/README.md', 'WP/runtime-recovery-kobo/README.md']
for relative in readmes:
    path = root / relative; path.write_bytes(status.encode() + path.read_bytes())
evidence = [path.relative_to(root).as_posix() for folder in [run, dest] for path in folder.iterdir() if path.is_file()]
helpers = ['prepare-issue214-compatibility-prerequisite-successor-once.py',
    'verify-issue214-compatibility-prerequisite-corrected-once.py',
    'verify-issue214-full-fixture-corrected-once.py', 'retain-issue214-fixture-prerequisite-pass-once.py']
evidence += [(wp / name).relative_to(root).as_posix() for name in helpers]
index = {path: {'bytes': (root / path).stat().st_size, 'sha256': hashlib.sha256((root / path).read_bytes()).hexdigest()} for path in evidence}
(dest / 'index.json').write_bytes((json.dumps(index, indent=2) + '\n').encode())
owned = evidence + readmes + [(dest / 'index.json').relative_to(root).as_posix(), 'server/tests/contracts/audit_2_3_compatibility_runs.test.js']
git('add', '-f', '--', *owned)
assert set(git('diff', '--cached', '--name-only').splitlines()) <= set(owned)
git('commit', '-m', 'Verify normal chart fixture predecessors and preserve all stock assertions')
head = git('rev-parse', 'HEAD')
for path, record in index.items():
    assert hashlib.sha256(git('show', head + ':' + path, binary=True)).hexdigest() == record['sha256'], path
git('push', 'origin', 'HEAD:refs/heads/audit/release-eb6de2e8')
assert git('ls-remote', 'origin', 'refs/heads/audit/release-eb6de2e8').split()[0] == head
print(json.dumps({'status': 'CLOSED_FOCUSED_PASS_RETAINED', 'auditCommit': head, 'rawBlobsVerified': len(index), 'summary': summary, 'productionOperations': 0}))
