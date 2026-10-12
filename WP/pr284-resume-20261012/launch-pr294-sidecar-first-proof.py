"""Dispatch the ONE corrected source-reviewed first proof; no retry or rebuild."""
import datetime
import hashlib
import json
from pathlib import Path
import subprocess
import sys

directory = Path(__file__).resolve().parent
proof = '/opt/lims/releases/instrument-import-proof-959d17e1-20261012T144000Z'
unit = 'lims-owned-instrument-import-proof-959d17e1-20261012t144000z.service'
source = '201bb5fe8fd30cb2991f7169177a864265e6301b'
paths = {key: directory / ('pr294-sidecar-first-proof.' + extension) for key, extension in
    [('intent', 'intent.json'), ('stdout', 'stdout.log'), ('stderr', 'stderr.log'), ('result', 'result.json')]}
assert all(not path.exists() for path in paths.values()), 'Never replay this proof dispatch'
verification = json.loads((directory / 'pr294-sidecar-source-pass-verification.json').read_bytes())
assert verification['sourceCommit'] == source and verification['sourceReviewId'] == 6126765238
ci = json.loads(subprocess.check_output(['gh', 'api', 'repos/yigini/soilfer-lims/actions/runs/38256676268']))
assert ci['status'] == 'completed' and ci['conclusion'] == 'success' and ci['head_sha'] == '959d17e11c357266f7c2a41b0c84ab76914c591e'
pin_path = directory / 'target-pin-959d17e1-sidecar-144000.json'
assert hashlib.sha256(pin_path.read_bytes()).hexdigest() == verification['targetPinSha256'] == '241bd693b8cfdb3e9a05440716bd925a620a807bdb371206430a4abc2a9481b1'
intent = {'createdUtc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'status': 'SINGLE_NEW_REVIEWED_FIRST_PROOF_DISPATCH_INTENT_NO_RETRY', 'sourceCommit': source,
    'proofRoot': proof, 'proofUnit': unit, 'sourceReviewId': 6126765238,
    'applicationAuditId': 6125341751, 'mainCi': ci, 'targetPinSha256': verification['targetPinSha256'],
    'originalBuildReused': True, 'newBuilds': 0, 'productionMutations': 0}
with paths['intent'].open('x', encoding='utf-8', newline='\n') as stream: json.dump(intent, stream, indent=2)
command = [sys.executable, '-B', str(directory / 'proof-source-export-201bb5fe/export_launch_import_proof.py'),
    source, str(pin_path), proof, unit]
with paths['stdout'].open('xb') as stdout, paths['stderr'].open('xb') as stderr:
    result = subprocess.run(command, stdout=stdout, stderr=stderr, timeout=300)
record = dict(intent, completedUtc=datetime.datetime.now(datetime.timezone.utc).isoformat(),
    exitCode=result.returncode, stdoutSha256=hashlib.sha256(paths['stdout'].read_bytes()).hexdigest(),
    stderrSha256=hashlib.sha256(paths['stderr'].read_bytes()).hexdigest())
with paths['result'].open('x', encoding='utf-8', newline='\n') as stream: json.dump(record, stream, indent=2)
print(paths['stdout'].read_text(encoding='utf-8'))
if result.returncode: print(paths['stderr'].read_text(encoding='utf-8'))
raise SystemExit(result.returncode)
