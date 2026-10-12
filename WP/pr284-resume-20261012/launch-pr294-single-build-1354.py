"""Dispatch the one new reviewed image build and retain the original outcome."""
import datetime
import hashlib
import json
from pathlib import Path
import subprocess
import sys

root = Path(__file__).resolve().parent
source = '630b2354a1a45df0d88545ac5c63594361615999'
build = '/opt/lims/releases/instrument-import-build-959d17e1-20261012T135400Z'
unit = 'lims-build-instrument-import-build-959d17e1-20261012t135400z.service'
paths = {key: root / ('pr294-single-build-1354.' + extension) for key, extension in
    [('intent', 'intent.json'), ('stdout', 'stdout.log'), ('stderr', 'stderr.log'), ('result', 'result.json')]}
assert all(not path.exists() for path in paths.values()), 'Never replay or replace a build dispatch'
authority = json.loads((root / 'source-pass-6125544861.json').read_bytes())
assert authority['status'] == 'ACTUAL_EXACT_PR294_PROOF_BUILD_SOURCE_PASS_VERIFIED'
assert authority['review']['id'] == 6125544861 and authority['sourceIndex']['head'] == source
intent = {'createdUtc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'sourceCommit': source, 'reviewId': 6125544861, 'applicationAuditId': 6125341751,
    'mainCiRunId': 38256676268, 'buildRoot': build, 'buildUnit': unit,
    'status': 'SINGLE_BUILD_DISPATCH_INTENT_NO_RETRY', 'productionMutations': 0}
with paths['intent'].open('x', encoding='utf-8', newline='\n') as stream:
    json.dump(intent, stream, indent=2)
command = [sys.executable, '-B', str(root / 'proof-source-export-630b2354' / 'prepare_import_build.py'),
    source, '6125341751', '38256676268', build, unit, '6125544861']
with paths['stdout'].open('xb') as stdout, paths['stderr'].open('xb') as stderr:
    result = subprocess.run(command, stdout=stdout, stderr=stderr, timeout=600)
record = dict(intent, completedUtc=datetime.datetime.now(datetime.timezone.utc).isoformat(),
    exitCode=result.returncode, stdoutSha256=hashlib.sha256(paths['stdout'].read_bytes()).hexdigest(),
    stderrSha256=hashlib.sha256(paths['stderr'].read_bytes()).hexdigest())
with paths['result'].open('x', encoding='utf-8', newline='\n') as stream:
    json.dump(record, stream, indent=2)
print(paths['stdout'].read_text(encoding='utf-8'))
if result.returncode:
    print(paths['stderr'].read_text(encoding='utf-8'))
raise SystemExit(result.returncode)
