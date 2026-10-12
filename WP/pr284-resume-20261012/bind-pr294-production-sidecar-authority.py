"""Prepare only the production contract; the active proof bytes stay unchanged."""
import ast
import hashlib
import json
from pathlib import Path
import re
import subprocess

directory = Path(__file__).resolve().parent
root = directory.parent.parent
source_commit = '201bb5fe8fd30cb2991f7169177a864265e6301b'
source = json.loads((directory / 'proof-source-export-201bb5fe/source-index.json').read_bytes())
review = json.loads((directory / 'source-pass-6126765238.json').read_bytes())
assert source['head'] == source_commit and review['id'] == 6126765238
assert review['body'].startswith('Source review: PASS')
files = {name: item['sha256'] for name, item in source['files'].items()}
assert len(files) == 31 and all(name + '=' + digest in review['body'] for name, digest in files.items())
for name, row in source['files'].items():
    raw = subprocess.check_output(['git', 'show', source_commit + ':' + row['path']])
    assert hashlib.sha256(raw).hexdigest() == row['sha256']
    assert (root / row['path']).read_bytes().replace(b'\r\n', b'\n') == raw
path = root / 'WP/pr284-release/import_release_contract.py'
raw = path.read_bytes().replace(b'\r\n', b'\n')
assert b"REVIEWED_PROOF_SOURCE = 'UNREVIEWED_SIDECAR_FORWARD_REFUSE'" in raw
text = raw.decode()
text = text.replace("REVIEWED_PROOF_SOURCE = 'UNREVIEWED_SIDECAR_FORWARD_REFUSE'",
    "REVIEWED_PROOF_SOURCE = '" + source_commit + "'")
text = text.replace('PROOF_SOURCE_REVIEW_ID = 0', 'PROOF_SOURCE_REVIEW_ID = 6126765238')
mapping = 'REVIEWED_PROOF_FILES = {\n' + ''.join('    ' + repr(name) + ': ' + repr(files[name]) + ',\n' for name in sorted(files)) + '}'
text, count = re.subn(r'REVIEWED_PROOF_FILES = \{\n.*?\n\}', lambda _: mapping, text, count=1, flags=re.S)
assert count == 1
ast.parse(text)
path.write_bytes(text.encode())
for name, row in source['files'].items():
    assert (root / row['path']).read_bytes().replace(b'\r\n', b'\n') == subprocess.check_output(['git', 'show', source_commit + ':' + row['path']])
result = {'status': 'PROPOSED_PRODUCTION_BINDING_ONLY_NO_EXECUTION_AUTHORITY',
    'proofSourceCommit': source_commit, 'proofSourceReviewId': 6126765238,
    'reviewSha256': hashlib.sha256((directory / 'source-pass-6126765238.json').read_bytes()).hexdigest(),
    'productionContractSha256': hashlib.sha256(path.read_bytes()).hexdigest(),
    'activeProofFilesUnchanged': 31, 'productionReviewRequested': False,
    'productionOperations': 0, 'proofReplay': False}
with (directory / 'pr294-production-sidecar-binding.json').open('x', encoding='utf-8', newline='\n') as stream:
    json.dump(result, stream, indent=2)
print(json.dumps(result))
