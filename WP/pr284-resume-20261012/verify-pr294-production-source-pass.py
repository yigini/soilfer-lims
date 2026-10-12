"""Verify and retain an actual NEW production-source verdict; no execution."""
import datetime
import hashlib
import json
from pathlib import Path
import subprocess
import sys

review_id = sys.argv[1]
assert review_id.isdigit()
directory = Path(__file__).resolve().parent
export = directory / 'production-source-export-5fa7e65f'
sys.path.insert(0, str(export))
import import_release_contract as c

target = directory / ('production-source-pass-' + review_id + '.json')
assert not target.exists(), 'Never overwrite original review evidence'
proof_directory = directory / 'completed-proof-144000'
proof_bytes = (proof_directory / 'rehearsal-receipt.json').read_bytes()
proof = json.loads(proof_bytes); pin = json.loads((proof_directory / 'target-pin.json').read_bytes())
c.validate_proof(proof, pin)
retained = json.loads((proof_directory / 'retention-index.json').read_bytes())
assert retained['unitState']['ActiveState'] == 'inactive' and retained['unitState']['ExecMainStatus'] == '0'
preparation = json.loads((directory / 'production-source-5fa7e65f-preparation.json').read_bytes())
hashes = preparation['sourceHashes']
assert all(hashlib.sha256((export / name).read_bytes()).hexdigest() == digest for name, digest in hashes.items())
raw = subprocess.check_output(['gh', 'api', 'repos/yigini/soilfer-lims/issues/comments/' + review_id])
review = json.loads(raw)
c.production_source_review(review, '5fa7e65f3d13a04f270e90e0b4b129f8eaf3296e', hashes)
assert c.utc_seconds(review['created_at']) >= c.utc_seconds(proof['completedUtc'])
pages = json.loads(subprocess.check_output(['gh', 'api', 'repos/yigini/soilfer-lims/issues/162/comments?per_page=100', '--paginate', '--slurp']))
assert not any(c.has_failed_verdict(row['body'], True) and row['created_at'] > review['created_at'] for page in pages for row in page)
main = json.loads(subprocess.check_output(['gh', 'api', 'repos/yigini/soilfer-lims/git/ref/heads/main']))
assert main['object']['sha'] == c.CANDIDATE_HEAD
with target.open('xb') as stream: stream.write(raw)
record = {'verifiedUtc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'status': 'ACTUAL_NEW_PRODUCTION_SOURCE_PASS_VERIFIED_NO_EXECUTION', 'reviewId': review['id'],
    'sourceCommit': '5fa7e65f3d13a04f270e90e0b4b129f8eaf3296e', 'sourceFileCount': 39,
    'reviewSha256': hashlib.sha256(raw).hexdigest(), 'originalStoppedProofReceiptSha256': hashlib.sha256(proof_bytes).hexdigest(),
    'currentMainHead': main['object']['sha'], 'productionOperations': 0}
with (directory / ('production-source-pass-' + review_id + '-verified.json')).open('x', encoding='utf-8', newline='\n') as stream:
    json.dump(record, stream, indent=2)
print(json.dumps(record))
