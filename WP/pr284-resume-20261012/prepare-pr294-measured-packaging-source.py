"""Export and guard exact proposed packaging-only bytes; no freezer operation."""
import datetime
import hashlib
import importlib
import json
import math
from pathlib import Path
import subprocess
import sys

directory = Path(__file__).resolve().parent
source = 'abceab95b8d68b1b3202df9f4f9fc229d9baa2ae'
label = source[:8]
export = directory / ('production-source-export-' + label)
assert not export.exists(), 'Never overwrite a raw export'
sys.path.insert(0, str(directory / 'proof-source-export-201bb5fe'))
from import_source_graph import git_source
raw, index = git_source(source, lambda *args: subprocess.check_output(['git', *args]))
approved = json.loads((directory / 'proof-source-export-201bb5fe/source-index.json').read_bytes())
assert {n: r['sha256'] for n, r in index['files'].items()} == {n: r['sha256'] for n, r in approved['files'].items()}
paths = {name: 'WP/pr284-release/' + name for name in ['import_release_contract.py', 'deploy_import.py',
    'freeze_import.py', 'known_core_disk_guard_import_deploy.py', 'collect_import_gate.py',
    'export_freeze_import_kit.py', 'launch_import_release.py']}
paths['yy-authorization-evidence.md'] = 'WP/forward-ae64f169/yy-authorization-evidence.md'
for name, path in paths.items():
    metadata, returned = subprocess.check_output(['git', 'ls-tree', source, '--', path]).decode().strip().split('\t')
    mode, kind, blob = metadata.split()
    assert returned == path and mode in ['100644', '100755'] and kind == 'blob'
    value = subprocess.check_output(['git', 'cat-file', 'blob', blob])
    assert hashlib.sha1(('blob ' + str(len(value)) + '\0').encode() + value).hexdigest() == blob
    raw[name] = value
    index['files'][name] = {'path': path, 'blob': blob, 'bytes': len(value), 'sha256': hashlib.sha256(value).hexdigest()}
export.mkdir()
for name, value in raw.items():
    with (export / name).open('xb') as out: out.write(value)
    if name.endswith('.py'): compile(value, '/compile-only-new-packaging/' + name, 'exec')
sys.path.insert(0, str(export))
release = importlib.import_module('import_release_contract')
transport = importlib.import_module('export_freeze_import_kit')
assert release.REVIEWED_PROOF_SOURCE == approved['head'] and release.PROOF_SOURCE_REVIEW_ID == 6126765238
assert set(raw) == release.PACKAGE_SOURCE_FILES and len(raw) == 39 and len(release.FROZEN_FILE_SET) == 62
old = json.loads((directory / 'production-source-5fa7e65f-preparation.json').read_bytes())
hashes = {n: r['sha256'] for n, r in index['files'].items()}
changed = sorted(n for n, digest in hashes.items() if digest != old['sourceHashes'][n])
assert changed == ['export_freeze_import_kit.py', 'freeze_import.py']
measurement = json.loads((directory / 'pr294-packaging-readonly-measurement-1600.result.json').read_bytes())
assert measurement['status'] == 'READ_ONLY_PACKAGING_VALIDATOR_TIMING_PASS'
assert measurement['freezerInvocations'] == measurement['productionOperations'] == 0
deadline = math.ceil((2 * measurement['measuredSeconds'] + 300) / 300) * 300
assert deadline == transport.PACKAGING_READ_ONLY_TIMEOUT_SECONDS == 900
assert transport.PACKAGING_SSH_TIMEOUT_SECONDS == 960
receipt = (directory / 'completed-proof-144000/rehearsal-receipt.json').read_bytes()
assert hashlib.sha256(receipt).hexdigest() == measurement['receiptSha256']
assert json.loads(receipt)['status'] == 'PASSED_NEW_IMPORT_NATURAL_KOBO_PROOF'
tokens = release.release_binding_tokens() + release.source_policy_tokens() + [source,
    release.REVIEWED_PROOF_SOURCE, 'proofSourceReviewId=6126765238',
    'PACKAGING_READ_ONLY_TIMEOUT_SECONDS=900', 'PACKAGING_SSH_TIMEOUT_SECONDS=960']
tokens += [name + '=' + digest for name, digest in sorted(hashes.items())]
guards = {}
for platform in ['windows', 'linux']:
    command = ['py', '-B', '-X', 'utf8', str(directory.parent / 'pr284-release/run_import_guards.py'), source]
    if platform == 'windows': command.append('--windows')
    result = subprocess.run(command, capture_output=True, timeout=100)
    streams = {}
    for stream, value in [('stdout', result.stdout), ('stderr', result.stderr)]:
        with (directory / ('pr294-production-' + label + '-' + platform + '.' + stream + '.log')).open('xb') as out:
            out.write(value)
        streams[stream + 'Sha256'] = hashlib.sha256(value).hexdigest()
    assert result.returncode == 0, result.stderr.decode('utf-8', errors='replace')
    value = json.loads(result.stdout.decode('utf-8'))
    assert value['tests'] == 190 and value['failures'] == value['errors'] == value['skips'] == 0
    assert value['productionDatabaseAccess'] is False
    guards[platform] = {'exitCode': 0, 'result': value, **streams}
record = {'preparedUtc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'status': 'PROPOSED_MEASURED_PACKAGING_ONLY_NOT_APPROVED_NOT_EXECUTED',
    'sourceCommit': source, 'sourceIndex': index, 'sourceHashes': hashes, 'requiredReviewTokens': tokens,
    'changedPackagingFiles': changed, 'all31ProofBytesUnchanged': True, 'guards': guards,
    'measuredVerificationSeconds': measurement['measuredSeconds'], 'packagingDeadlineSeconds': deadline,
    'packagingDeadlinePolicy': 'ROUND_UP_300_SECONDS_OF_2_TIMES_READ_ONLY_MEASURED_PLUS_300_OVERHEAD',
    'originalPassedReceiptSha256': measurement['receiptSha256'], 'productionOperations': 0}
for name, value in [('production-source-' + label + '-preparation.json', record),
                    ('production-source-index-' + label + '.json', index)]:
    with (directory / name).open('x', encoding='utf-8', newline='\n') as out: json.dump(value, out, indent=2)
print(json.dumps({'status': record['status'], 'sourceCommit': source, 'changedPackagingFiles': changed,
    'guards': {p: {'tests': v['result']['tests'], 'elapsedSeconds': v['result']['elapsedSeconds']} for p, v in guards.items()},
    'packagingDeadlineSeconds': deadline, 'sourceFiles': len(raw)}))
