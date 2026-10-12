"""Download and verify an actual unused frozen kit; never freeze or execute it."""
import base64
import datetime
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys

root, manifest_sha, destination = sys.argv[1:]
assert re.fullmatch('/opt/lims/releases/instrument-import-release-[A-Za-z0-9_-]+', root)
assert re.fullmatch('[a-f0-9]{64}', manifest_sha)
target = Path(destination)
assert not target.exists(), 'Never overwrite retained kit bytes'
directory = Path(__file__).resolve().parent
export = directory / 'production-source-export-abceab95'
sys.path.insert(0, str(export))
import import_release_contract as c

payload = base64.b64encode(json.dumps({'root': root, 'manifestSha256': manifest_sha}).encode()).decode()
code = r'''import base64,datetime,hashlib,json,pathlib,sys
p=json.loads(base64.b64decode(PAYLOAD));r=pathlib.Path(p['root']);sys.path.insert(0,str(r))
import import_release_contract as c
assert not any((r/n).exists() for n in ['production-gate.json','production-receipt.json','execution-attempt.json'])
assert c.sha(r/'prepared-manifest.json')==p['manifestSha256']
m=json.loads((r/'prepared-manifest.json').read_bytes());c.frozen_files(r,m)
assert m['packagingCommit']=='abceab95b8d68b1b3202df9f4f9fc229d9baa2ae' and len(m['files'])==62
proof=pathlib.Path(m['originalProofRoot']);assert c.sha(proof/'rehearsal-receipt.json')==m['files']['rehearsal-receipt.json']
assert (proof/'rehearsal-receipt.json').stat().st_mode&0o777==0o400
files={}
for n in list(m['files'])+['prepared-manifest.json']:
 f=r/n;data=f.read_bytes();assert f.stat().st_mode&0o777==0o400
 files[n]={'data':base64.b64encode(data).decode(),'sha256':hashlib.sha256(data).hexdigest(),'mode':'0o400','bytes':len(data)}
assert c.sha(r/'prepared-manifest.json')==p['manifestSha256'];c.frozen_files(r,m)
print(json.dumps({'observedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'root':str(r),'status':'READ_ONLY_UNUSED_FROZEN_KIT_VERIFIED','manifestSha256':p['manifestSha256'],'files':files,'productionOperations':0,'sqliteConnections':0}))
'''.replace('PAYLOAD', repr(payload))
result = subprocess.run(['ssh', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=15', 'root@46.19.33.37', 'python3', '-B', '-'],
    input=code.encode(), capture_output=True, timeout=120)
assert result.returncode == 0, result.stderr.decode('utf-8', errors='replace')
evidence = json.loads(result.stdout)
raw = {name: base64.b64decode(row['data']) for name, row in evidence['files'].items()}
assert all(hashlib.sha256(value).hexdigest() == evidence['files'][name]['sha256'] for name, value in raw.items())
manifest = json.loads(raw['prepared-manifest.json'])
c.measurement_manifest(manifest)
assert len(manifest['files']) == 62 and hashlib.sha256(raw['prepared-manifest.json']).hexdigest() == manifest_sha
assert all(hashlib.sha256(raw[name]).hexdigest() == digest for name, digest in manifest['files'].items())
for name in c.PACKAGE_SOURCE_FILES:
    assert raw[name] == (export / name).read_bytes(), 'Raw proposed production source differs: ' + name
pin = json.loads(raw['target-pin.json']); proof = json.loads(raw['rehearsal-receipt.json'])
c.validate_proof(proof, pin)
c.production_source_review(json.loads(raw['production-baseline-source-review.json']), manifest['packagingCommit'], manifest['files'])
tokens = c.review_tokens(manifest, manifest_sha)
target.mkdir()
for name, data in raw.items():
    with (target / name).open('xb') as stream: stream.write(data)
for row in evidence['files'].values(): row.pop('data')
with (target / 'retention-index.json').open('x', encoding='utf-8', newline='\n') as stream: json.dump(evidence, stream, indent=2)
request = f'''Claudio: NEW exact-kit review request for #200 / PR294, from the actual stopped first PASSED proof.

Application {manifest['head']}, image {manifest['image']}.
ONE immutable unused kit: {root}
Manifest SHA256 {manifest_sha}
Coordinator SHA256 {manifest['files']['deploy_import.py']}
Original stopped PASSED rehearsal receipt SHA256 {manifest['files']['rehearsal-receipt.json']}
Target-pin SHA256 {manifest['files']['target-pin.json']}
Original YY authorization SHA256 {manifest['files']['yy-authorization-evidence.md']}
Historical production receipt SHA256 {manifest['historicalReceiptSha256']}
Proof source {manifest['proofToolingCommit']} / {manifest['sourceReviewId']}; separate production source {manifest['packagingCommit']} / {manifest['productionBaselineSourceReviewId']}.

All62 source/proof files and manifest were independently re-read with immutable0400 modes and exact hashes. Every measured proof byte equals201bb, every production source byte equalsabceab95, original PASSED receipt remains unchanged. The original stopped first proof root144000Z and original valid build135400Z remain retained; failed105200Z/134000Z proofs and failed154640Z package/root are excluded forever. Freeze recomputed original full preservation against the immutable detached backups, without a new copy/rehearsal.

Actual measured timing headroom: {json.dumps(manifest['measuredTimingHeadroom'], sort_keys=True)}. Other quiesce/backup/seal/API/ingress/coordination costs remain unmeasured. No execution gate or production attempt/receipt exists. Both workload pins,16 retained database allocations, absolute/scaled reserve,500MB unexplained-growth abort and forward-only recovery remain bound.

Please post a NEW primary Audit passed: OK to merge and deploy with ALL exact tokens below if this unchanged kit passes. Then, under YY's existing automatic-after-review go, I will independently recheck currentmain/allgreen/unusedkit/headroom, collect ONE fresh10minute single-use gate and execute ONE forward deployment. No installer replay, older image, restore, retry/override or cleanup. Claudio owns actual post-deploy checks/closure/ticks.

''' + '\n'.join(tokens) + '\n'
with (target / 'exact-kit-review-request.md').open('x', encoding='utf-8', newline='\n') as stream: stream.write(request)
print(json.dumps({'status': evidence['status'], 'root': root, 'localKit': str(target),
    'manifestSha256': manifest_sha, 'coordinatorSha256': manifest['files']['deploy_import.py'],
    'receiptSha256': manifest['files']['rehearsal-receipt.json'], 'fileCount': 62,
    'reviewRequestPreparedNotPosted': True, 'productionOperations': 0}))
