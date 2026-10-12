"""Bind production packaging to the actual new proof source; never execute it."""
import hashlib
import json
from pathlib import Path
import re
import subprocess

directory = Path(__file__).resolve().parent
repo = directory.parents[1]
evidence = json.loads((directory / 'source-pass-6125544861.json').read_bytes())
assert evidence['status'] == 'ACTUAL_EXACT_PR294_PROOF_BUILD_SOURCE_PASS_VERIFIED'
assert evidence['review']['id'] == 6125544861
source = '630b2354a1a45df0d88545ac5c63594361615999'
assert evidence['sourceIndex']['head'] == source
hashes = {name: row['sha256'] for name, row in evidence['sourceIndex']['files'].items()}
for name, row in evidence['sourceIndex']['files'].items():
    raw = subprocess.check_output(['git', 'show', source + ':' + row['path']], cwd=repo)
    current = subprocess.check_output(['git', 'show', 'HEAD:' + row['path']], cwd=repo)
    assert raw == current and hashlib.sha256(raw).hexdigest() == hashes[name]
path = repo / 'WP/pr284-release/import_release_contract.py'
text = path.read_text(encoding='utf-8')
assert "REVIEWED_PROOF_SOURCE = 'UNREVIEWED_NATIVE_FORWARD_REFUSE'" in text
assert 'PROOF_SOURCE_REVIEW_ID = 0' in text
text = text.replace("REVIEWED_PROOF_SOURCE = 'UNREVIEWED_NATIVE_FORWARD_REFUSE'",
    "REVIEWED_PROOF_SOURCE = '" + source + "'")
text = text.replace('PROOF_SOURCE_REVIEW_ID = 0', 'PROOF_SOURCE_REVIEW_ID = 6125544861')
replacement = 'REVIEWED_PROOF_FILES = {\n' + ''.join(
    '    ' + repr(name) + ': ' + repr(digest) + ',\n' for name, digest in sorted(hashes.items())) + '}'
text, count = re.subn(r'REVIEWED_PROOF_FILES = \{.*?\n\}', lambda match: replacement, text, count=1, flags=re.S)
assert count == 1
path.write_text(text, encoding='utf-8', newline='\n')
print(json.dumps({'status': 'PRODUCTION_SOURCE_BINDING_PROPOSED_NOT_APPROVED',
    'proofSource': source, 'reviewId': 6125544861, 'files': len(hashes),
    'productionExecution': False, 'proofPassClaimed': False}))
