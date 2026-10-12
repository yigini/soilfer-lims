"""Retain a precise request copy before publication; original draft stays intact."""
import hashlib
import json
from pathlib import Path

directory = Path(__file__).resolve().parent
draft = directory / 'source-review-630b2354-request.md'
raw = draft.read_bytes()
text = raw.decode('utf-8')
before = 'Both default-entrypoint jobs-OFF readinesses require23NO_OP0/22READY0/31+6 probes and full WAL-aware zero-change seals.'
after = 'The jobs-OFF default entrypoint requires23NO_OP0/22READY0/31+6 probes and full WAL-aware zero-change seals.'
assert text.count(before) == 1
final = directory / 'source-review-630b2354-final.md'
with final.open('x', encoding='utf-8', newline='\n') as stream:
    stream.write(text.replace(before, after))
record = {'status': 'FINAL_UNPUBLISHED_SOURCE_REQUEST_WORDING_ONLY',
    'source': '630b2354a1a45df0d88545ac5c63594361615999',
    'originalDraftSha256': hashlib.sha256(raw).hexdigest(),
    'finalRequestSha256': hashlib.sha256(final.read_bytes()).hexdigest(),
    'change': 'Clarify the proof has one jobs-OFF readiness followed by distinct jobs-ON proof',
    'sourceChanges': 0, 'originalDraftRetained': True, 'productionOperations': 0}
with (directory / 'pr294-final-source-request-1343.json').open('x', encoding='utf-8', newline='\n') as stream:
    json.dump(record, stream, indent=2)
print(json.dumps(record))
