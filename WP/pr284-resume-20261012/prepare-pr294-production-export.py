"""Export proposed production bytes only; no review request or execution."""
import datetime
import hashlib
import importlib
import json
from pathlib import Path
import subprocess
import sys

directory = Path(__file__).resolve().parent
source = '63761ad129afae735e83e0c330030d868dedfef4'
export = directory / 'production-source-export-63761ad1'
assert not export.exists(), 'Never overwrite a proposed raw source export'
sys.path.insert(0, str(directory / 'proof-source-export-630b2354'))
from import_source_graph import git_source
raw, index = git_source(source, lambda *args: subprocess.check_output(['git', *args]))
approved = json.loads((directory / 'source-pass-6125544861.json').read_bytes())
proof_hashes = {name: row['sha256'] for name, row in approved['sourceIndex']['files'].items()}
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
    with (export / name).open('xb') as output:
        output.write(data)
    if name.endswith('.py'):
        compile(data, '/compile-only-proposed-package/' + name, 'exec')
sys.path.insert(0, str(export))
release = importlib.import_module('import_release_contract')
assert release.REVIEWED_PROOF_SOURCE == approved['sourceIndex']['head']
assert release.PROOF_SOURCE_REVIEW_ID == 6125544861 and release.REVIEWED_PROOF_FILES == proof_hashes
assert set(raw) == release.PACKAGE_SOURCE_FILES and len(raw) == 39
hashes = {name: row['sha256'] for name, row in index['files'].items()}
tokens = release.release_binding_tokens() + release.source_policy_tokens() + [source,
    release.REVIEWED_PROOF_SOURCE, 'proofSourceReviewId=' + str(release.PROOF_SOURCE_REVIEW_ID)]
tokens += [name + '=' + digest for name, digest in sorted(hashes.items())]
guards = {platform: json.loads((directory / ('pr294-production-source-63761ad1-' + platform + '-1400.json')).read_bytes())
    for platform in ['windows', 'linux']}
assert all(row['exitCode'] == 0 and row['result']['tests'] == 175 and
    row['result']['failures'] == row['result']['errors'] == row['result']['skips'] == 0 for row in guards.values())
record = {'observedUtc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'status': 'PROPOSED_RAW_PRODUCTION_SOURCE_PREPARED_NO_REQUEST_NO_APPROVAL_NO_EXECUTION',
    'sourceCommit': source, 'proofSourceCommit': release.REVIEWED_PROOF_SOURCE,
    'proofSourceReviewId': 6125544861, 'sourceIndex': index, 'sourceHashes': hashes,
    'requiredReviewTokens': tokens, 'sourceFiles': len(raw), 'fixedFrozenFiles': len(release.FROZEN_FILE_SET),
    'guards': guards, 'proofPassClaimed': False, 'approvalClaimed': False, 'productionMutations': 0}
with (directory / 'production-source-63761ad1-preparation.json').open('x', encoding='utf-8', newline='\n') as output:
    json.dump(record, output, indent=2)
with (directory / 'production-source-index-63761ad1.json').open('x', encoding='utf-8', newline='\n') as output:
    json.dump(index, output, indent=2)
print(json.dumps({'status': record['status'], 'source': source, 'sourceFiles': len(raw),
    'fixedFrozenFiles': record['fixedFrozenFiles'], 'coordinatorSha256': hashes['deploy_import.py'],
    'contractSha256': hashes['import_release_contract.py']}))
