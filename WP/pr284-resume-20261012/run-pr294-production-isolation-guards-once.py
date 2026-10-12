"""Retain one exact-source guard run; owned fixtures only, no deployment."""
import datetime
import hashlib
import json
from pathlib import Path
import subprocess
import sys

d = Path(__file__).resolve().parent
w = d.parent.parent
head, platform = sys.argv[1:]
assert len(head) == 40 and all(c in '0123456789abcdef' for c in head)
assert platform in ['windows', 'linux']
root = d / ('production-isolation-guards-' + head[:8] + '-' + platform)
root.mkdir()
args = [sys.executable, '-B', '-X', 'utf8', str(w / 'WP/pr284-release/run_import_guards.py'), head]
if platform == 'windows':
    args.append('--windows')
result = subprocess.run(args, cwd=w, capture_output=True, timeout=90)
for name, data in [('stdout.log', result.stdout), ('stderr.log', result.stderr)]:
    with (root / name).open('xb') as out:
        out.write(data)
records = [json.loads(line) for line in result.stdout.decode('utf-8').splitlines() if line.startswith('{')]
summary = records[-1] if records else None
record = {'sourceCommit': head, 'platform': platform, 'exitCode': result.returncode,
    'retainedUtc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'stdoutSha256': hashlib.sha256(result.stdout).hexdigest(),
    'stderrSha256': hashlib.sha256(result.stderr).hexdigest(),
    'summary': summary, 'productionMutations': 0, 'approvalGranted': False}
with (root / 'result.json').open('x', encoding='utf-8', newline='\n') as out:
    json.dump(record, out, indent=2)
print(json.dumps({key: record[key] for key in ['sourceCommit', 'platform', 'exitCode',
    'stdoutSha256', 'stderrSha256', 'productionMutations']}))
if summary:
    print(json.dumps({key: summary[key] for key in ['tests', 'failures', 'errors', 'skips',
        'elapsedSeconds', 'completedUtc', 'productionDatabaseAccess', 'status']}))
if result.returncode:
    print(result.stderr.decode('utf-8')[-9000:])
sys.exit(result.returncode)
