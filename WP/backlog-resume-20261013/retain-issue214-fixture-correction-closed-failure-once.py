"""Retain the closed focused fixture prerequisite failure without weakening assertions."""
import datetime, hashlib, json, subprocess, sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf-8')
root = Path(__file__).resolve().parents[2]
wp = Path(__file__).parent
run = wp / 'issue214-fixture-correction-focused-config'
summary = json.loads((run / 'summary.json').read_bytes())
assert summary['status'] == 'FAILED_OR_INCOMPLETE' and summary['suites'] == 12 and summary['tests'] == 175 and summary['failed'] == 28
assert summary['sourceUnchanged'] and summary['inventoryEqual'] and summary['pending'] == 0
before = json.loads((run / 'source-before.json').read_bytes())
assert before == json.loads((run / 'source-after.json').read_bytes())
assert all(hashlib.sha256((root / path).read_bytes()).hexdigest() == digest for path, digest in before.items())
dest = wp / 'issue214-fixture-correction-closed-failure'
assert not dest.exists()
dest.mkdir()
def git(*args, binary=False):
    result = subprocess.run(['git', *args], cwd=root, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if result.returncode: raise RuntimeError(result.stderr.decode('utf-8', 'replace'))
    return result.stdout if binary else result.stdout.decode('utf-8').strip()
assert git('branch', '--show-current') == 'audit/release-eb6de2e8'
assert git('rev-parse', 'HEAD') == '774a5c1121c93326aded6244fa911778f2c7231a'
assert not git('diff', '--cached', '--name-only')
record = {'retainedUtc': datetime.datetime.now(datetime.UTC).isoformat(), 'sessionId': 51135,
    'summary': summary, 'reason': 'The old compatibility fixture needs the normal WorkAttempt predecessor before the container/chart installers. All other 11 suites passed, including the seven policy-version and four visible-path failures.',
    'productionOperations': 0, 'nativeProgressAcknowledgementSent': False}
(dest / 'terminal-boundary.json').write_bytes((json.dumps(record, indent=2) + '\n').encode())
status = ('## 2026-10-13 #214 focused fixture correction CLOSED: 11/12 suites PASS\n\n'
    'At19:48:33UTC the new ordinary focused successor closed with12 suites/175 tests:147PASS,28FAILED,0pending, '
    'exact focused inventory and unchanged frozen source. All28 failures are the same missing WorkAttempt predecessor '
    'in the compatibility fixture before the container installer; no runtime absence catch is added. The other11 suites '
    'pass, including the previous policy-version and hidden-path failures. Retain all failed raw reports and the earlier '
    'pre-test configuration refusal. Correct only the fixture installation sequence, preserving every stock assertion, '
    'then use a unique successor. No full successor, PR, CI, audited214 head, merge, kit, gate or production operation yet.\n\n')
readmes = ['WP/audit-release-eb6de2e8/README.md', 'WP/runtime-recovery-kobo/README.md']
for relative in readmes:
    path = root / relative; path.write_bytes(status.encode() + path.read_bytes())
folders = [run, wp / 'issue214-fixture-correction-focused', dest]
evidence = [path.relative_to(root).as_posix() for folder in folders for path in folder.iterdir() if path.is_file()]
helpers = ['retain-issue214-fixture-correction-closed-failure-once.py',
    'prepare-issue214-fixture-correction-focused-successor-once.py',
    'verify-issue214-fixture-correction-focused-once.py',
    'prepare-issue214-fixture-correction-focused-config-successor-once.py',
    'verify-issue214-fixture-correction-focused-config-once.py']
evidence += [(wp / name).relative_to(root).as_posix() for name in helpers]
index = {path: {'bytes': (root / path).stat().st_size, 'sha256': hashlib.sha256((root / path).read_bytes()).hexdigest()} for path in evidence}
(dest / 'index.json').write_bytes((json.dumps(index, indent=2) + '\n').encode())
owned = evidence + readmes + [(dest / 'index.json').relative_to(root).as_posix(),
    'server/tests/helpers/qcGateFixture.js', 'server/tests/contracts/audit_2_3_compatibility_runs.test.js']
git('add', '-f', '--', *owned)
assert set(git('diff', '--cached', '--name-only').splitlines()) <= set(owned)
git('commit', '-m', 'Retain focused fixture prerequisite failure and passing correction coverage')
head = git('rev-parse', 'HEAD')
for path, record in index.items():
    assert hashlib.sha256(git('show', head + ':' + path, binary=True)).hexdigest() == record['sha256'], path
git('push', 'origin', 'HEAD:refs/heads/audit/release-eb6de2e8')
assert git('ls-remote', 'origin', 'refs/heads/audit/release-eb6de2e8').split()[0] == head
print(json.dumps({'status': 'CLOSED_FOCUSED_FAILURE_RETAINED', 'auditCommit': head, 'rawBlobsVerified': len(index), 'productionOperations': 0}))
