"""Retain an actual new packaging-source pass, without invoking packaging."""
import datetime
import hashlib
import json
from pathlib import Path
import subprocess
import sys

review_id = sys.argv[1]
assert review_id.isdigit() and int(review_id) not in [6127651539, 6126765238]
directory = Path(__file__).resolve().parent
source = 'abceab95b8d68b1b3202df9f4f9fc229d9baa2ae'
export = directory / 'production-source-export-abceab95'
sys.path.insert(0, str(export))
import import_release_contract as c

target = directory / ('production-source-pass-' + review_id + '.json')
assert not target.exists(), 'Never overwrite review evidence'
proof_dir = directory / 'completed-proof-144000'
proof_bytes = (proof_dir / 'rehearsal-receipt.json').read_bytes()
proof = json.loads(proof_bytes)
c.validate_proof(proof, json.loads((proof_dir / 'target-pin.json').read_bytes()))
hashes = json.loads((directory / 'production-source-abceab95-preparation.json').read_bytes())['sourceHashes']
assert all(hashlib.sha256((export / n).read_bytes()).hexdigest() == digest for n, digest in hashes.items())
raw = subprocess.check_output(['gh', 'api', 'repos/yigini/soilfer-lims/issues/comments/' + review_id])
review = json.loads(raw)
c.production_source_review(review, source, hashes)
assert c.utc_seconds(review['created_at']) > c.utc_seconds('2026-10-12T16:06:21Z')
assert all(token in review['body'] for token in ['PACKAGING_READ_ONLY_TIMEOUT_SECONDS=900',
                                              'PACKAGING_SSH_TIMEOUT_SECONDS=960'])
pages = json.loads(subprocess.check_output(['gh', 'api', 'repos/yigini/soilfer-lims/issues/162/comments?per_page=100', '--paginate', '--slurp']))
assert not any(c.has_failed_verdict(r['body'], True) and r['created_at'] > review['created_at'] for page in pages for r in page)
main = json.loads(subprocess.check_output(['gh', 'api', 'repos/yigini/soilfer-lims/git/ref/heads/main']))
assert main['object']['sha'] == c.CANDIDATE_HEAD
with target.open('xb') as out: out.write(raw)
record = {'verifiedUtc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'status': 'ACTUAL_NEW_PRODUCTION_SOURCE_PASS_VERIFIED_NO_EXECUTION', 'reviewId': review['id'],
    'sourceCommit': source, 'sourceFileCount': len(hashes), 'reviewSha256': hashlib.sha256(raw).hexdigest(),
    'originalStoppedProofReceiptSha256': hashlib.sha256(proof_bytes).hexdigest(),
    'currentMainHead': main['object']['sha'], 'packagingDeadlineSeconds': 900, 'productionOperations': 0}
with (directory / ('production-source-pass-' + review_id + '-verified.json')).open('x', encoding='utf-8', newline='\n') as out:
    json.dump(record, out, indent=2)
print(json.dumps(record))
