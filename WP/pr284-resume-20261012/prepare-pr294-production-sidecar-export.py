"""Compile and guard the proposed production source; no execution or request."""
import datetime
import hashlib
import importlib
import json
from pathlib import Path
import subprocess
import sys

directory = Path(__file__).resolve().parent
source = '5fa7e65f3d13a04f270e90e0b4b129f8eaf3296e'
export = directory / 'production-source-export-5fa7e65f'
assert not export.exists(), 'Never overwrite a raw proposed source export'
sys.path.insert(0, str(directory / 'proof-source-export-201bb5fe'))
from import_source_graph import git_source
raw, index = git_source(source, lambda *args: subprocess.check_output(['git', *args]))
approved_index = json.loads((directory / 'proof-source-export-201bb5fe/source-index.json').read_bytes())
proof_hashes = {name: row['sha256'] for name, row in approved_index['files'].items()}
assert {name: row['sha256'] for name, row in index['files'].items()} == proof_hashes
paths = {name: 'WP/pr284-release/' + name for name in ['import_release_contract.py',
    'deploy_import.py', 'freeze_import.py', 'known_core_disk_guard_import_deploy.py',
    'collect_import_gate.py', 'export_freeze_import_kit.py', 'launch_import_release.py']}
paths['yy-authorization-evidence.md'] = 'WP/forward-ae64f169/yy-authorization-evidence.md'
for name, path in paths.items():
    metadata, returned = subprocess.check_output(['git', 'ls-tree', source, '--', path]).decode().strip().split('\t')
    mode, kind, blob = metadata.split()
    assert returned == path and mode in ['100644', '100755'] and kind == 'blob'
    data = subprocess.check_output(['git', 'cat-file', 'blob', blob])
    assert hashlib.sha1(('blob ' + str(len(data)) + '\0').encode() + data).hexdigest() == blob
    raw[name] = data
    index['files'][name] = {'path': path, 'blob': blob, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()}
export.mkdir()
for name, data in raw.items():
    with (export / name).open('xb') as output: output.write(data)
    if name.endswith('.py'): compile(data, '/compile-only-proposed-production/' + name, 'exec')
sys.path.insert(0, str(export))
release = importlib.import_module('import_release_contract')
assert release.REVIEWED_PROOF_SOURCE == approved_index['head'] == '201bb5fe8fd30cb2991f7169177a864265e6301b'
assert release.PROOF_SOURCE_REVIEW_ID == 6126765238 and release.REVIEWED_PROOF_FILES == proof_hashes
assert set(raw) == release.PACKAGE_SOURCE_FILES and len(raw) == 39 and len(release.FROZEN_FILE_SET) == 62
hashes = {name: row['sha256'] for name, row in index['files'].items()}
tokens = release.release_binding_tokens() + release.source_policy_tokens() + [source,
    release.REVIEWED_PROOF_SOURCE, 'proofSourceReviewId=' + str(release.PROOF_SOURCE_REVIEW_ID)]
tokens += [name + '=' + digest for name, digest in sorted(hashes.items())]
guards = {}
for platform in ['windows', 'linux']:
    command = ['py', '-B', '-X', 'utf8', str(directory.parent / 'pr284-release/run_import_guards.py'), source]
    if platform == 'windows': command.append('--windows')
    result = subprocess.run(command, capture_output=True, timeout=100)
    streams = {}
    for label, value in [('stdout', result.stdout), ('stderr', result.stderr)]:
        path = directory / ('pr294-production-5fa7e65f-' + platform + '.' + label + '.log')
        with path.open('xb') as output: output.write(value)
        streams[label + 'Sha256'] = hashlib.sha256(value).hexdigest()
    value = json.loads(result.stdout.decode('utf-8'))
    guards[platform] = {'exitCode': result.returncode, 'result': value, **streams}
    assert result.returncode == 0 and value['tests'] == 185
    assert value['failures'] == value['errors'] == value['skips'] == 0 and value['productionDatabaseAccess'] is False
record = {'preparedUtc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'status': 'PROPOSED_PRODUCTION_SOURCE_NO_REQUEST_NO_APPROVAL_NO_EXECUTION',
    'sourceCommit': source, 'proofSourceCommit': release.REVIEWED_PROOF_SOURCE,
    'proofSourceReviewId': 6126765238, 'sourceIndex': index, 'sourceHashes': hashes,
    'requiredReviewTokens': tokens, 'sourceFiles': len(raw), 'fixedFrozenFiles': len(release.FROZEN_FILE_SET),
    'guards': guards, 'proofPassClaimed': False, 'approvalClaimed': False, 'productionMutations': 0}
for name, value in [('production-source-5fa7e65f-preparation.json', record), ('production-source-index-5fa7e65f.json', index)]:
    with (directory / name).open('x', encoding='utf-8', newline='\n') as output: json.dump(value, output, indent=2)
print(json.dumps({'status': record['status'], 'sourceCommit': source, 'sourceFiles': 39, 'fixedFrozenFiles': 62,
    'coordinatorSha256': hashes['deploy_import.py'], 'contractSha256': hashes['import_release_contract.py'],
    'guards': {key: {'tests': value['result']['tests'], 'completedUtc': value['result']['completedUtc'],
        'elapsedSeconds': value['result']['elapsedSeconds']} for key, value in guards.items()}}))
