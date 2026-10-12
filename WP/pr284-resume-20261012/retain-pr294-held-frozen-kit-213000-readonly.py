"""Retain the one actual213000 kit without modifying any remote evidence.

The local mirror contains ONLY frozen/. Retention metadata and review requests
live beside the mirror, so closed-root gate validation sees no extra entries.
Remote original files remain exact0400; Windows copies use the read-only flag.
"""
import base64
import datetime
import hashlib
import json
from pathlib import Path
import subprocess
import sys

directory = Path(__file__).resolve().parent
source = '92e32e9464c5906aa2b8cb4c24089b8164ff1d4c'
export = directory / 'production-source-export-92e32e94'
root = '/opt/lims/releases/instrument-import-release-959d17e1-20261012T213000Z'
package = '/opt/lims/releases/instrument-import-package-959d17e1-20261012T213000Z'
mirror = directory.parent / 'pr284-frozen-kit-20261012T213000Z'
metadata = directory / 'held-kit-213000-retention'
assert not mirror.exists() and not metadata.exists(), 'Never overwrite retained kit or metadata'
finished = json.loads((directory / 'pr294-freeze-held-213000-result.json').read_bytes())
assert finished['exitCode'] == 0 and finished['sourceCommit'] == source
actual = finished['actualFreeze']
assert actual['root'] == root and actual['fileCount'] == 66
manifest_sha = actual['manifestSha256']
assert len(manifest_sha) == 64
sys.path.insert(0, str(export))
import import_release_contract as c
from collect_import_gate import local_frozen_reference

payload = base64.b64encode(json.dumps({'root': root, 'package': package,
    'manifestSha256': manifest_sha, 'sourceCommit': source}).encode()).decode()
code = r'''import base64,datetime,hashlib,json,pathlib,sys
p=json.loads(base64.b64decode(PAYLOAD));r=pathlib.Path(p['root']);f=r/'frozen';sys.path.insert(0,str(f))
import import_release_contract as c
c.require_unused_outputs(r,c.FROZEN_FILE_SET)
manifest=c.safe_reference(f,'prepared-manifest.json')
assert c.sha(manifest)==p['manifestSha256']
m=json.loads(manifest.read_bytes());c.frozen_files(r,m)
assert m['packagingCommit']==p['sourceCommit'] and len(m['files'])==66
proof=pathlib.Path(m['originalProofRoot'])
assert c.sha(c.safe_reference(proof,'rehearsal-receipt.json'))==m['files']['rehearsal-receipt.json']
files={}
for name in sorted(set(m['files'])|{'prepared-manifest.json'}):
 path=c.safe_reference(f,name);data=path.read_bytes()
 files[name]={'data':base64.b64encode(data).decode(),'sha256':hashlib.sha256(data).hexdigest(),
  'mode':'0o400','bytes':len(data)}
terminal={}
pack=pathlib.Path(p['package'])
for name in ['freeze.stdout','freeze.stderr','freeze-result.json']:
 path=c.safe_reference(pack,name);data=path.read_bytes()
 terminal[name]={'data':base64.b64encode(data).decode(),'sha256':hashlib.sha256(data).hexdigest(),
  'mode':'0o400','bytes':len(data)}
result=json.loads(base64.b64decode(terminal['freeze-result.json']['data']))
assert result['status']=='PASSED' and result['returncode']==0 and result['attemptCount']==1
assert result['retried'] is False and result['timeoutSeconds']==900 and result['elapsedSeconds']<=900
c.frozen_files(r,m);c.require_unused_outputs(r,c.FROZEN_FILE_SET)
assert c.sha(manifest)==p['manifestSha256']
print(json.dumps({'observedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),
 'root':str(r),'status':'READ_ONLY_UNUSED_HELD_FROZEN_KIT_VERIFIED',
 'manifestSha256':p['manifestSha256'],'rootInventory':['frozen'],
 'files':files,'packagingTerminal':terminal,'productionOperations':0,'sqliteConnections':0}))
'''.replace('PAYLOAD', repr(payload))
response = subprocess.run(['ssh', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=15',
    'root@46.19.33.37', 'python3', '-B', '-'], input=code.encode(), capture_output=True, timeout=120)
assert response.returncode == 0, response.stderr.decode(errors='replace')
record = json.loads(response.stdout)
raw = {name: base64.b64decode(row['data']) for name, row in record['files'].items()}
assert all(hashlib.sha256(data).hexdigest() == record['files'][name]['sha256'] for name, data in raw.items())
manifest = json.loads(raw['prepared-manifest.json'])
c.measurement_manifest(manifest)
assert len(manifest['files']) == 66 and set(raw) == c.FROZEN_FILE_SET | {'prepared-manifest.json'}
assert hashlib.sha256(raw['prepared-manifest.json']).hexdigest() == manifest_sha
assert all(hashlib.sha256(raw[name]).hexdigest() == digest for name, digest in manifest['files'].items())
for name in c.PACKAGE_SOURCE_FILES:
    assert raw[name] == (export / name).read_bytes(), 'Exact raw reviewed production bytes differ: ' + name
pin = json.loads(raw['target-pin.json']); proof = json.loads(raw['rehearsal-receipt.json'])
c.validate_proof(proof, pin)
c.production_source_review(json.loads(raw['production-baseline-source-review.json']), source, manifest['files'])
assert manifest['entryBinding'] == c.entry_binding()
assert manifest['productionBaselineSourceReviewId'] == finished['sourceReviewId']
terminal_raw = {name: base64.b64decode(row['data']) for name, row in record['packagingTerminal'].items()}
assert all(hashlib.sha256(data).hexdigest() == record['packagingTerminal'][name]['sha256']
    for name, data in terminal_raw.items())
terminal = json.loads(terminal_raw['freeze-result.json'])
assert terminal['status'] == 'PASSED' and terminal['attemptCount'] == 1 and terminal['retried'] is False
events = [json.loads(line) for line in terminal_raw['freeze.stdout'].splitlines() if line.strip()]
assert events[-1] == actual and terminal_raw['freeze.stderr'] == b''
tokens = c.review_tokens(manifest, manifest_sha)
mirror.mkdir(); frozen = mirror / 'frozen'; frozen.mkdir()
for name, data in raw.items():
    with (frozen / name).open('xb') as stream: stream.write(data)
    (frozen / name).chmod(0o400)
    assert local_frozen_reference(frozen, name).read_bytes() == data
c.require_unused_outputs(mirror, c.FROZEN_FILE_SET)
metadata.mkdir()
for name, data in terminal_raw.items():
    with (metadata / name).open('xb') as stream: stream.write(data)
for group in ['files', 'packagingTerminal']:
    for row in record[group].values(): row.pop('data')
with (metadata / 'retention-index.json').open('x', encoding='utf-8', newline='\n') as stream:
    json.dump(record, stream, indent=2)
request = f'''Claudio: NEW exact-kit review request for the separately reviewed #200 held-entry forward fix.

Application {manifest['head']}, image {manifest['image']}.
ONE immutable unused kit {root}; actual preparedUtc {manifest['preparedUtc']}.
Manifest SHA256 {manifest_sha}
Coordinator SHA256 {manifest['files']['deploy_import.py']}
Original stopped PASSED proof receipt SHA256 {manifest['files']['rehearsal-receipt.json']}
Target-pin SHA256 {manifest['files']['target-pin.json']}
Original YY go SHA256 {manifest['files']['yy-authorization-evidence.md']}
Original YY maintenance choice SHA256 {manifest['files']['yy-maintenance-choice-evidence.json']}
Held-entry scope SHA256 {manifest['files']['held-entry-scope-review.json']}
Failed receipt SHA256 {manifest['files']['held-entry-receipt.json']} (entry evidence ONLY).
Historical production receipt SHA256 {manifest['historicalReceiptSha256']}
Production source {source}, actual NEW SourcePASS {manifest['productionBaselineSourceReviewId']}.
Freeze stdout SHA256 {record['packagingTerminal']['freeze.stdout']['sha256']}
Original freeze-result.json SHA256 {record['packagingTerminal']['freeze-result.json']['sha256']}

All66 frozen files plus manifest independently re-read with exact remote0400 modes/hashes. Remote root inventory is ONLY frozen/. All43 production source bytes equal exact92e32e94, all31 original201bb proof bytes remain unchanged. Downloaded Windows read-only copies and hash-bound local reader verified; retention metadata lives OUTSIDE the closed kit mirror. Original terminal status PASSED, attemptCount1, retriedfalse, elapsed{terminal['elapsedSeconds']}s/900s. No failed proof, failed161000 outputs or consumed gate contributes. Original144000PASS and original135400build remain the sole proof/build authority, with no new copy, rehearsal or build.

Actual NEW transport-source PASS6132712806 binds GATE_TRANSPORT_TIMEOUT_SECONDS=180 and LAUNCH_TRANSPORT_TIMEOUT_SECONDS=210. These two local SSH budgets are the only package changes from the untouched unused202400 kit; all physical preflights run in full. New one-shot outer controllers wait420s/240s, with no retry. Gate freshness600s, CLI/readiness600s, systemd dispatch20s and productionunit5400s remain unchanged. The202400 kit is superseded for execution and stays unchanged unused; no gate was collected from it.

Output catalog SHA256 {manifest['outputNamespace']['catalogSha256']}; frozen inputs only in frozen/, all execution outputs at root; exhaustive closed root preflight before gate/intent/quiesce. Only exact STOPPED_HELD_UNAPPLIED is accepted, bound to YY's actual B choice, original stopped/unrenamed51f container, held ingress, unchanged raw DB/WAL/SHM and stopped backup, no APPLY/repeat/startup/otherwriter. Failed161000root/gate/receipt/outputs permanently excluded from replay/retry/reuse.

Measured timing headroom {json.dumps(manifest['measuredTimingHeadroom'], sort_keys=True)}. Unmeasured quiesce/backup/seal/API/ingress/coordination costs remain explicit. Both workload pins,16 retained database allocations, absolute/scaled reserve,500MB unexplained-growth abort,768MiB/blankheap and forward-only recovery unchanged. No gate, execution attempt or production receipt exists for this kit.

Please post NEW primary Audit passed: OK to merge and deploy with ALL exact tokens below if the unchanged kit passes. Then currentmain/allgreen/unusedkit/headroom are freshly rechecked before ONE single-use10minute gate and ONE separately reviewed forward deployment under existing automatic-after-review go. No extra YY go, restore, olderimage start, installer replay, override or cleanup. Claudio owns actual postchecks/closure/ticks. Other app merges stay held until#200 live/postchecked.

''' + '\n'.join(tokens) + '\n'
with (metadata / 'exact-kit-review-request.md').open('x', encoding='utf-8', newline='\n') as stream:
    stream.write(request)
print(json.dumps({'status': record['status'], 'root': root, 'localKit': str(mirror),
    'metadataDirectory': str(metadata), 'manifestSha256': manifest_sha,
    'coordinatorSha256': manifest['files']['deploy_import.py'], 'receiptSha256': actual['receiptSha256'],
    'fileCount': 66, 'reviewRequestPreparedNotPosted': True, 'productionOperations': 0}))
