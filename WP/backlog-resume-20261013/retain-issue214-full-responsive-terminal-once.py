"""Retain one genuinely closed #214 full-run boundary; never replay this helper."""
import datetime, hashlib, json, subprocess, sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf-8')
root = Path(__file__).resolve().parents[2]
wp = Path(__file__).parent
run = wp / 'issue214-full-server-responsive'

def git(*args, binary=False):
    result = subprocess.run(['git', *args], cwd=root, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if result.returncode:
        raise RuntimeError(result.stderr.decode('utf-8', 'replace'))
    return result.stdout if binary else result.stdout.decode('utf-8').strip()

assert git('branch', '--show-current') == 'audit/release-eb6de2e8'
assert git('rev-parse', 'HEAD') == '4febba371c87af907b8df23b84ccddf1db3db066'
assert not git('diff', '--cached', '--name-only')
names = ['source-before.json', 'source-after.json', 'inventory-original.json',
         'inventory-stderr-original.log', 'command.json', 'stdout-original.log',
         'stderr-original.log', 'report-original.json', 'exit-original.txt', 'summary.json']
assert all((run / name).is_file() for name in names), 'The original run has not closed.'
summary = json.loads((run / 'summary.json').read_bytes())
report = json.loads((run / 'report-original.json').read_bytes())
inventory = json.loads((run / 'inventory-original.json').read_bytes())
before = json.loads((run / 'source-before.json').read_bytes())
after = json.loads((run / 'source-after.json').read_bytes())
assert before == after and summary['sourceUnchanged']
assert all(hashlib.sha256((root / path).read_bytes()).hexdigest() == digest for path, digest in before.items())
assert len(inventory) == len(set(inventory)) == report['numTotalTestSuites'] == 365
assert set(inventory) == {suite['name'] for suite in report['testResults']} and summary['inventoryEqual']
assert int((run / 'exit-original.txt').read_text()) == summary['exitCode']
assert summary['tests'] == report['numTotalTests']
assert summary['failed'] == report['numFailedTests'] and summary['pending'] == report['numPendingTests']
assert summary['failedSuites'] == report['numFailedTestSuites']
assert summary['status'] == 'FAILED_OR_INCOMPLETE' and summary['exitCode'] != 0 and summary['failed'] > 0
failures = [{'suite': suite['name'], 'test': case['fullName'], 'status': case['status']}
            for suite in report['testResults'] for case in suite['assertionResults'] if case['status'] == 'failed']
assert len(failures) == report['numFailedTests']
dest = wp / 'issue214-full-responsive-terminal'
assert not dest.exists()
dest.mkdir()
terminal = {'retainedUtc': datetime.datetime.now(datetime.UTC).isoformat(), 'sessionId': 49046,
            'originalSummary': summary, 'passedSuites': report['numPassedTestSuites'],
            'passedTests': report['numPassedTests'], 'failedCases': failures,
            'originalCommand': json.loads((run / 'command.json').read_bytes()),
            'productionOperations': 0, 'closed': True, 'consumedHelperMustNeverReplay': True}
(dest / 'terminal-boundary.json').write_bytes((json.dumps(terminal, indent=2) + '\n').encode())
status = ('## 2026-10-13 #214 responsive full regression CLOSED with failures\n\n'
          f"The ordinary frozen full run closed at {summary['observedUtc']} with "
          f"{report['numPassedTestSuites']}/{report['numTotalTestSuites']} passing suites and "
          f"{report['numPassedTests']}/{report['numTotalTests']} passing tests; "
          f"{summary['failed']} failed tests and {summary['pending']} pending tests. "
          'This is a complete failed regression result, never a PASS. Discovery equals the exact 365-suite inventory, '
          'both ordinary setups and stock assertions remained enabled, the single-worker harness and blank local NODE_OPTIONS '
          'were unchanged, and every frozen source hash equals its original value. Original closed stdout/stderr/report/exit/summary '
          'and each failed case are retained at `WP/backlog-resume-20261013/issue214-full-responsive-terminal/index.json`. '
          'No runner is replayed. Fix only the identified fixture/application issues under actual Claudio direction, '
          'preserve stock assertions, then verify with a genuinely new successor. No #214 PR, actual CI, audited head, '
          'merge, kit, gate or production operation exists. #103 remains without production connection or apply go.\n\n')
readmes = ['WP/audit-release-eb6de2e8/README.md', 'WP/runtime-recovery-kobo/README.md']
for relative in readmes:
    path = root / relative
    path.write_bytes(status.encode() + path.read_bytes())
evidence = [(run / name).relative_to(root).as_posix() for name in names]
evidence += [Path(__file__).relative_to(root).as_posix(), (dest / 'terminal-boundary.json').relative_to(root).as_posix()]
index = {relative: {'bytes': (root / relative).stat().st_size,
                    'sha256': hashlib.sha256((root / relative).read_bytes()).hexdigest()} for relative in evidence}
(dest / 'index.json').write_bytes((json.dumps(index, indent=2) + '\n').encode())
owned = evidence + readmes + [(dest / 'index.json').relative_to(root).as_posix()]
git('add', '-f', '--', *owned)
assert set(git('diff', '--cached', '--name-only').splitlines()) <= set(owned)
git('commit', '-m', 'Retain closed control chart full regression failures honestly')
head = git('rev-parse', 'HEAD')
for relative, record in index.items():
    assert hashlib.sha256(git('show', head + ':' + relative, binary=True)).hexdigest() == record['sha256'], relative
git('push', 'origin', 'HEAD:refs/heads/audit/release-eb6de2e8')
assert git('ls-remote', 'origin', 'refs/heads/audit/release-eb6de2e8').split()[0] == head
print(json.dumps({'status': 'CLOSED_FAILED_REGRESSION_RETAINED', 'auditCommit': head,
                  'exactRawBlobsVerified': len(index), 'summary': summary, 'productionOperations': 0}), flush=True)
