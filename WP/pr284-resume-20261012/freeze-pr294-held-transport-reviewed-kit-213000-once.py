"""One distinct held-entry kit only after actual NEW source approval."""
import datetime
import json
from pathlib import Path
import subprocess
import sys

review_id = sys.argv[1]
assert review_id.isdigit() and int(review_id) > 6132666918
d = Path(__file__).resolve().parent
source = '92e32e9464c5906aa2b8cb4c24089b8164ff1d4c'
verified = json.loads((d / ('production-source-pass-' + review_id + '-verified.json')).read_bytes())
assert verified['status'] == 'ACTUAL_NEW_PRODUCTION_SOURCE_PASS_VERIFIED_NO_EXECUTION'
assert verified['sourceCommit'] == source and verified['reviewId'] == int(review_id)
assert verified['sourceFileCount'] == 43
proof = '/opt/lims/releases/instrument-import-proof-959d17e1-20261012T144000Z'
package = '/opt/lims/releases/instrument-import-package-959d17e1-20261012T213000Z'
target = '/opt/lims/releases/instrument-import-release-959d17e1-20261012T213000Z'
check = 'import pathlib;paths=' + repr([package, target]) + ';assert all(not pathlib.Path(p).exists() and not pathlib.Path(p).is_symlink() for p in paths);print("EXACT_FUTURE_ROOTS_ABSENT")'
absence = subprocess.run(['ssh', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=15',
    'root@46.19.33.37', 'python3', '-B', '-'], input=check.encode(), capture_output=True, timeout=30)
assert absence.returncode == 0 and absence.stdout.strip() == b'EXACT_FUTURE_ROOTS_ABSENT', absence.stderr.decode()
intent = {'startedUtc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'sourceCommit': source, 'sourceReviewId': int(review_id), 'originalProofRoot': proof,
    'packageRoot': package, 'executionRoot': target, 'originalFailedRootExcluded': verified['entryBinding']['failedProductionRoot'],
    'entryBinding': verified['entryBinding'], 'packagingReadOnlyDeadlineSeconds': 900,
    'status': 'ONE_NEW_HELD_KIT_FREEZE_INTENT_NEVER_REPLAY', 'productionOperations': 0}
with (d / 'pr294-freeze-held-213000-intent.json').open('x', encoding='utf-8', newline='\n') as out:
    json.dump(intent, out, indent=2)
result = subprocess.run([sys.executable, '-B', '-X', 'utf8',
    str(d / 'production-source-export-92e32e94/export_freeze_import_kit.py'),
    source, proof, package, target, review_id], cwd=d.parent.parent, capture_output=True, timeout=1100)
for label, value in [('stdout', result.stdout), ('stderr', result.stderr)]:
    with (d / ('pr294-freeze-held-213000.' + label)).open('xb') as out: out.write(value)
record = {'finishedUtc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'exitCode': result.returncode, 'sourceCommit': source, 'sourceReviewId': int(review_id),
    'root': target, 'productionOperations': 0}
if result.returncode == 0:
    rows = [json.loads(line) for line in result.stdout.decode().splitlines() if line.strip()]
    actual = rows[-1]
    assert actual['status'] == 'PREPARED_IMPORT_FORWARD_ONLY_NOT_EXECUTED' and actual['root'] == target
    assert actual['fileCount'] == 66 and len(actual['manifestSha256']) == 64
    record['actualFreeze'] = actual
    record['validationStageEvents'] = rows[:-1]
with (d / 'pr294-freeze-held-213000-result.json').open('x', encoding='utf-8', newline='\n') as out:
    json.dump(record, out, indent=2)
print(json.dumps(record))
if result.returncode: print(result.stderr.decode(errors='replace'), file=sys.stderr)
sys.exit(result.returncode)
