"""One distinct freeze only after an actual verified NEW source pass."""
import datetime
import json
from pathlib import Path
import subprocess
import sys

review_id = sys.argv[1]
assert review_id.isdigit() and int(review_id) not in [6127651539, 6126765238]
directory = Path(__file__).resolve().parent
source = 'abceab95b8d68b1b3202df9f4f9fc229d9baa2ae'
verified = json.loads((directory / ('production-source-pass-' + review_id + '-verified.json')).read_bytes())
assert verified['status'] == 'ACTUAL_NEW_PRODUCTION_SOURCE_PASS_VERIFIED_NO_EXECUTION'
assert verified['sourceCommit'] == source and verified['reviewId'] == int(review_id)
proof = '/opt/lims/releases/instrument-import-proof-959d17e1-20261012T144000Z'
package = '/opt/lims/releases/instrument-import-package-959d17e1-20261012T161000Z'
target = '/opt/lims/releases/instrument-import-release-959d17e1-20261012T161000Z'
intent = {'startedUtc': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'sourceCommit': source,
    'sourceReviewId': int(review_id), 'originalProofRoot': proof, 'packageRoot': package, 'executionRoot': target,
    'packagingReadOnlyDeadlineSeconds': 900, 'productionOperations': 0,
    'status': 'ONE_DISTINCT_REVIEWED_FREEZE_INTENT_NEVER_REPLAY'}
with (directory / 'pr294-freeze-161000-intent.json').open('x', encoding='utf-8', newline='\n') as out:
    json.dump(intent, out, indent=2)
result = subprocess.run([sys.executable, '-B', str(directory / 'production-source-export-abceab95/export_freeze_import_kit.py'),
    source, proof, package, target, review_id], cwd=directory.parent.parent, capture_output=True, timeout=1100)
for label, value in [('stdout', result.stdout), ('stderr', result.stderr)]:
    with (directory / ('pr294-freeze-161000.' + label)).open('xb') as out: out.write(value)
record = {'finishedUtc': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'exitCode': result.returncode,
    'sourceCommit': source, 'sourceReviewId': int(review_id), 'root': target, 'productionOperations': 0}
if result.returncode == 0:
    rows = [json.loads(line) for line in result.stdout.decode('utf-8').splitlines() if line.strip()]
    actual = rows[-1]
    assert actual['status'] == 'PREPARED_IMPORT_FORWARD_ONLY_NOT_EXECUTED' and actual['root'] == target
    assert actual['fileCount'] == 62 and len(actual['manifestSha256']) == 64
    record['actualFreeze'] = actual
    record['validationStageEvents'] = rows[:-1]
with (directory / 'pr294-freeze-161000-result.json').open('x', encoding='utf-8', newline='\n') as out:
    json.dump(record, out, indent=2)
print(json.dumps(record))
if result.returncode: print(result.stderr.decode('utf-8', errors='replace'), file=sys.stderr)
sys.exit(result.returncode)
