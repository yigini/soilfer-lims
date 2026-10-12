"""Retain each exact-source guard stream; no production database access."""
import hashlib
import json
from pathlib import Path
import subprocess
import sys

repo = Path(__file__).resolve().parents[2]
directory = Path(__file__).resolve().parent
source = '630b2354a1a45df0d88545ac5c63594361615999'
platform = sys.argv[1]
assert platform in ['windows', 'linux']
prefix = directory / ('pr294-merged-source-630b2354-' + platform + '-1344')
stdout_path = prefix.with_suffix('.stdout.log')
stderr_path = prefix.with_suffix('.stderr.log')
record_path = prefix.with_suffix('.json')
assert not any(path.exists() for path in [stdout_path, stderr_path, record_path]), 'Never replace original guard output'
command = ['py', '-B', '-X', 'utf8', 'WP/pr284-release/run_import_guards.py', source]
if platform == 'windows':
    command.append('--windows')
result = subprocess.run(command, cwd=repo, capture_output=True, timeout=75)
with stdout_path.open('xb') as stream:
    stream.write(result.stdout)
with stderr_path.open('xb') as stream:
    stream.write(result.stderr)
value = next(json.loads(line) for line in result.stdout.decode('utf-8').splitlines() if line.startswith('{'))
record = {'platform': platform, 'exitCode': result.returncode, 'result': value,
    'stdoutSha256': hashlib.sha256(result.stdout).hexdigest(),
    'stderrSha256': hashlib.sha256(result.stderr).hexdigest()}
with record_path.open('x', encoding='utf-8', newline='\n') as stream:
    json.dump(record, stream, indent=2)
print(json.dumps({key: record[key] for key in ['platform', 'exitCode', 'stdoutSha256', 'stderrSha256']} | {
    'sourceCommit': value['sourceCommit'], 'tests': value['tests'], 'failures': value['failures'],
    'errors': value['errors'], 'skips': value['skips'], 'completedUtc': value['completedUtc']}))
sys.exit(result.returncode)
