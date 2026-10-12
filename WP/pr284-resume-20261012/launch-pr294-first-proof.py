"""Dispatch the exact source-reviewed first proof once, only after main CI PASS."""
import datetime
import hashlib
import json
from pathlib import Path
import subprocess
import sys

directory = Path(__file__).resolve().parent
proof = '/opt/lims/releases/instrument-import-proof-959d17e1-20261012T134000Z'
unit = 'lims-owned-instrument-import-proof-959d17e1-20261012t134000z.service'
source = '630b2354a1a45df0d88545ac5c63594361615999'
paths = {key: directory / ('pr294-first-proof.' + extension) for key, extension in
    [('intent', 'intent.json'), ('stdout', 'stdout.log'), ('stderr', 'stderr.log'), ('result', 'result.json')]}
assert all(not path.exists() for path in paths.values()), 'Never replay this proof dispatch'
ci = json.loads(subprocess.check_output(['gh', 'api', 'repos/yigini/soilfer-lims/actions/runs/38256676268']))
assert ci['status'] == 'completed' and ci['conclusion'] == 'success' and ci['head_sha'] == '959d17e11c357266f7c2a41b0c84ab76914c591e'
pin_bytes = (directory / 'target-pin-959d17e1.json').read_bytes()
assert hashlib.sha256(pin_bytes).hexdigest() == '3786a68f0df9e0762a4d7cc144251b9180297f7dbf9d5745a8591d58f9680a8f'
intent = {'createdUtc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'status': 'SINGLE_EXACT_FIRST_PROOF_DISPATCH_INTENT_NO_RETRY', 'sourceCommit': source,
    'proofRoot': proof, 'proofUnit': unit, 'sourceReviewId': 6125544861,
    'applicationAuditId': 6125341751, 'mainCi': ci, 'productionMutations': 0}
with paths['intent'].open('x', encoding='utf-8', newline='\n') as stream:
    json.dump(intent, stream, indent=2)
command = [sys.executable, '-B', str(directory / 'proof-source-export-630b2354' / 'export_launch_import_proof.py'),
    source, str(directory / 'target-pin-959d17e1.json'), proof, unit]
with paths['stdout'].open('xb') as stdout, paths['stderr'].open('xb') as stderr:
    result = subprocess.run(command, stdout=stdout, stderr=stderr, timeout=300)
record = dict(intent, completedUtc=datetime.datetime.now(datetime.timezone.utc).isoformat(),
    exitCode=result.returncode, stdoutSha256=hashlib.sha256(paths['stdout'].read_bytes()).hexdigest(),
    stderrSha256=hashlib.sha256(paths['stderr'].read_bytes()).hexdigest())
with paths['result'].open('x', encoding='utf-8', newline='\n') as stream:
    json.dump(record, stream, indent=2)
print(paths['stdout'].read_text(encoding='utf-8'))
if result.returncode:
    print(paths['stderr'].read_text(encoding='utf-8'))
raise SystemExit(result.returncode)
