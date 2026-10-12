"""Verify actual new202400 exact-kit verdict; no gate or production mutation."""
import datetime
import hashlib
import json
from pathlib import Path
import subprocess
import sys

d = Path(__file__).resolve().parent
k = d.parent / 'pr284-frozen-kit-20261012T202400Z'
f = k / 'frozen'
sys.path.insert(0, str(f))
import import_release_contract as c
from collect_import_gate import local_frozen_reference
review_id = int(sys.argv[1]); assert review_id > 6132251256
output = d / ('pr294-held-kit-pass-' + str(review_id) + '-verified.json')
assert not output.exists()
def gh(endpoint):
    return json.loads(subprocess.check_output(['gh', 'api', 'repos/yigini/soilfer-lims/' + endpoint]))
raw = subprocess.check_output(['gh', 'api', 'repos/yigini/soilfer-lims/issues/comments/' + str(review_id)])
review = json.loads(raw)
manifest_path = local_frozen_reference(f, 'prepared-manifest.json')
manifest = json.loads(manifest_path.read_bytes()); digest = c.sha(manifest_path)
retained = json.loads((d / 'held-kit-202400-retention/retention-index.json').read_bytes())
assert digest == retained['manifestSha256'] and manifest['packagingCommit'] == 'e4d692a0c0eaed34017f4419172dfcf8db563be0'
assert manifest['root'] == '/opt/lims/releases/instrument-import-release-959d17e1-20261012T202400Z'
c.measurement_manifest(manifest); c.require_unused_outputs(k, c.FROZEN_FILE_SET)
tokens = c.review_tokens(manifest, digest)
assert review['id'] == review_id and review['html_url'] == 'https://github.com/yigini/soilfer-lims/issues/162#issuecomment-' + str(review_id)
assert next(line.strip().strip('*_# ') for line in review['body'].splitlines() if line.strip()) == c.PHRASE
assert not c.has_failed_verdict(review['body']) and all(token in review['body'] for token in tokens)
for name, value in manifest['files'].items(): assert c.sha(local_frozen_reference(f, name)) == value
pages = json.loads(subprocess.check_output(['gh', 'api', 'repos/yigini/soilfer-lims/issues/162/comments?per_page=100', '--paginate', '--slurp']))
assert not any(c.has_failed_verdict(row['body'], include_source=True) and row['created_at'] > review['created_at'] for page in pages for row in page)
current = gh('git/ref/heads/main')['object']['sha']; assert current == manifest['head']
ci = gh('actions/runs/38256676268'); assert ci['head_sha'] == current and ci['status'] == 'completed' and ci['conclusion'] == 'success'
with (d / ('pr294-held-kit-pass-' + str(review_id) + '-api.json')).open('xb') as out: out.write(raw)
record = {'status': 'ACTUAL_NEW_EXACT_HELD_KIT_PASS_VERIFIED_NOT_EXECUTED',
    'observedUtc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'reviewId': review_id, 'reviewUrl': review['html_url'], 'reviewApiSha256': hashlib.sha256(raw).hexdigest(),
    'manifestSha256': digest, 'verifiedTokenCount': len(tokens), 'currentMainHead': current,
    'mainCiConclusion': ci['conclusion'], 'productionOperations': 0}
with output.open('x', encoding='utf-8', newline='\n') as out: json.dump(record, out, indent=2)
print(json.dumps(record))
