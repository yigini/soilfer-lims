"""Verify one actual NEW held production-source verdict, never execute it."""
import datetime
import hashlib
import json
from pathlib import Path
import subprocess
import sys

source, review_id = sys.argv[1:]
assert len(source) == 40 and all(character in '0123456789abcdef' for character in source)
assert review_id.isdigit() and int(review_id) not in [6127651539, 6126765238, 6130963561, 6131228500]
d = Path(__file__).resolve().parent
export = d / ('production-source-export-' + source[:8])
sys.path.insert(0, str(export))
import import_release_contract as c
target = d / ('production-source-pass-' + review_id + '.json')
assert not target.exists(), 'Never overwrite approval evidence'
preparation = json.loads((d / ('production-source-' + source[:8] + '-preparation.json')).read_bytes())
assert preparation['sourceCommit'] == source and preparation['all31ProofBytesUnchanged'] is True
hashes = preparation['sourceHashes']
assert all(hashlib.sha256((export / name).read_bytes()).hexdigest() == digest for name, digest in hashes.items())
proof = json.loads((d / 'completed-proof-144000/rehearsal-receipt.json').read_bytes())
c.validate_proof(proof, json.loads((d / 'completed-proof-144000/target-pin.json').read_bytes()))
c.held_entry_authority(*(json.loads((export / name).read_bytes()) for name in
    ['held-entry-receipt.json', 'yy-maintenance-choice-evidence.json', 'held-entry-scope-review.json']))
raw = subprocess.check_output(['gh', 'api', 'repos/yigini/soilfer-lims/issues/comments/' + review_id])
review = json.loads(raw)
c.production_source_review(review, source, hashes)
assert source=='92e32e9464c5906aa2b8cb4c24089b8164ff1d4c' and int(review_id)>6132666918
assert all(token in review['body'] for token in ['GATE_TRANSPORT_TIMEOUT_SECONDS=180','LAUNCH_TRANSPORT_TIMEOUT_SECONDS=210'])
assert c.utc_seconds(review['created_at']) > c.utc_seconds('2026-10-12T20:07:22Z')
pages = json.loads(subprocess.check_output(['gh', 'api',
    'repos/yigini/soilfer-lims/issues/162/comments?per_page=100', '--paginate', '--slurp']))
assert not any(c.has_failed_verdict(row['body'], True) and row['created_at'] > review['created_at']
    for page in pages for row in page), 'Source pass superseded'
main = json.loads(subprocess.check_output(['gh', 'api', 'repos/yigini/soilfer-lims/git/ref/heads/main']))
assert main['object']['sha'] == c.CANDIDATE_HEAD
with target.open('xb') as out: out.write(raw)
record = {'verifiedUtc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'status': 'ACTUAL_NEW_PRODUCTION_SOURCE_PASS_VERIFIED_NO_EXECUTION', 'sourceCommit': source,
    'reviewId': int(review_id), 'reviewSha256': hashlib.sha256(raw).hexdigest(), 'sourceFileCount': len(hashes),
    'entryBinding': c.entry_binding(), 'outputNamespace': preparation['outputNamespace'],
    'originalStoppedProofReceiptSha256': hashlib.sha256((d / 'completed-proof-144000/rehearsal-receipt.json').read_bytes()).hexdigest(),
    'currentMainHead': main['object']['sha'], 'productionOperations': 0}
with (d / ('production-source-pass-' + review_id + '-verified.json')).open('x', encoding='utf-8', newline='\n') as out:
    json.dump(record, out, indent=2)
print(json.dumps(record))
