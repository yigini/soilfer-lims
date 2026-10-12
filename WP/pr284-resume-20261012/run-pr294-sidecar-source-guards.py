"""Keep exact-source guard streams, including failures; never reuse a prefix."""
import hashlib
import json
from pathlib import Path
import subprocess
import sys

repo = Path(__file__).resolve().parents[2]
directory = Path(__file__).resolve().parent
source, platform, suffix = sys.argv[1:]
assert len(source) == 40 and all(char in '0123456789abcdef' for char in source)
assert platform in ['windows', 'linux'] and suffix.isalnum()
prefix = directory / ('pr294-sidecar-source-' + source[:8] + '-' + platform + '-' + suffix)
paths = {kind: prefix.with_suffix(extension) for kind, extension in
    [('stdout', '.stdout.log'), ('stderr', '.stderr.log'), ('record', '.json')]}
assert not any(path.exists() for path in paths.values()), 'Never replace original guard output'
command = ['py', '-B', '-X', 'utf8', 'WP/pr284-release/run_import_guards.py', source]
if platform == 'windows': command.append('--windows')
result = subprocess.run(command, cwd=repo, capture_output=True, timeout=75)
for kind in ['stdout', 'stderr']:
    with paths[kind].open('xb') as stream: stream.write(getattr(result, kind))
values = [json.loads(line) for line in result.stdout.decode('utf-8').splitlines() if line.startswith('{')]
value = values[-1] if values else None
record = {'platform': platform, 'sourceCommit': source, 'exitCode': result.returncode, 'result': value,
    'stdoutSha256': hashlib.sha256(result.stdout).hexdigest(),
    'stderrSha256': hashlib.sha256(result.stderr).hexdigest()}
with paths['record'].open('x', encoding='utf-8', newline='\n') as stream: json.dump(record, stream, indent=2)
print(json.dumps(record if value is None else {key: record[key] for key in
    ['platform', 'sourceCommit', 'exitCode', 'stdoutSha256', 'stderrSha256']} | {
        key: value[key] for key in ['tests', 'failures', 'errors', 'skips', 'completedUtc']}))
if result.returncode: sys.stderr.write(result.stderr.decode('utf-8')[-8000:])
sys.exit(result.returncode)
