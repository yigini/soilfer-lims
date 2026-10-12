"""Invoke the exact reviewed freezer ONCE; retain all outputs and intent."""
import datetime
import json
from pathlib import Path
import subprocess
import sys

directory = Path(__file__).resolve().parent
proof = '/opt/lims/releases/instrument-import-proof-959d17e1-20261012T144000Z'
package = '/opt/lims/releases/instrument-import-package-959d17e1-20261012T154640Z'
target = '/opt/lims/releases/instrument-import-release-959d17e1-20261012T154640Z'
source = '5fa7e65f3d13a04f270e90e0b4b129f8eaf3296e'
verified = json.loads((directory / 'production-source-pass-6127651539-verified.json').read_bytes())
assert verified['status'] == 'ACTUAL_NEW_PRODUCTION_SOURCE_PASS_VERIFIED_NO_EXECUTION' and verified['sourceCommit'] == source
intent = {'startedUtc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'sourceCommit': source, 'sourceReviewId': 6127651539, 'originalProofRoot': proof,
    'packageRoot': package, 'executionRoot': target, 'productionOperations': 0,
    'status': 'ONE_FREEZE_DISPATCH_INTENT_NEVER_REPLAY'}
with (directory / 'pr294-freeze-154640-intent.json').open('x', encoding='utf-8', newline='\n') as stream: json.dump(intent, stream, indent=2)
result = subprocess.run([sys.executable, '-B', str(directory / 'production-source-export-5fa7e65f/export_freeze_import_kit.py'),
    source, proof, package, target, '6127651539'], cwd=directory.parent.parent, capture_output=True, timeout=370)
for name, value in [('stdout', result.stdout), ('stderr', result.stderr)]:
    with (directory / ('pr294-freeze-154640.' + name)).open('xb') as stream: stream.write(value)
record = {'finishedUtc': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'exitCode': result.returncode,
    'sourceCommit': source, 'sourceReviewId': 6127651539, 'root': target, 'productionOperations': 0}
if result.returncode == 0: record['actualFreeze'] = json.loads(result.stdout)
with (directory / 'pr294-freeze-154640-result.json').open('x', encoding='utf-8', newline='\n') as stream: json.dump(record, stream, indent=2)
print(json.dumps(record))
if result.returncode: print(result.stderr.decode('utf-8', errors='replace'), file=sys.stderr)
sys.exit(result.returncode)
