"""Keep the published source request and actual native delivery boundary once."""
import datetime
import hashlib
import json
from pathlib import Path
import subprocess

repo = Path(__file__).resolve().parents[2]
directory = Path(__file__).resolve().parent
request = json.loads(subprocess.check_output(['gh', 'api',
    'repos/yigini/soilfer-lims/issues/comments/6126680868'], cwd=repo, text=True, encoding='utf-8'))
assert request['body'].replace('\r\n', '\n').rstrip('\n') == (directory /
    'source-review-201bb5fe-request.md').read_text(encoding='utf-8').rstrip('\n')
raw_path = directory / 'pr294-comment-6126680868.json'
with raw_path.open('x', encoding='utf-8', newline='\n') as stream: json.dump(request, stream, indent=2)
source = '201bb5fe8fd30cb2991f7169177a864265e6301b'
index = json.loads((directory / 'proof-source-export-201bb5fe/source-index.json').read_bytes())
now = datetime.datetime.now(datetime.timezone.utc).isoformat()
preflight = json.loads((directory / 'pr294-sidecar-preflight-1450.json').read_bytes())
record = {'recordedUtc': now, 'status': 'NEW_SOURCE_REVIEW_PENDING_NO_ACTIVE_WRITER',
    'sourceCommit': source, 'sourceRequestId': request['id'], 'sourceRequestUrl': request['html_url'],
    'rawRequestSha256': hashlib.sha256(raw_path.read_bytes()).hexdigest(),
    'coordinatorSha256': index['files']['rehearse_import.py']['sha256'],
    'stageSha256': index['files']['import_stage.py']['sha256'],
    'contractSha256': index['files']['import_proof_contract.py']['sha256'],
    'nativeDeliveryVisuallyVerified': True, 'nativeReviewRunningObserved': True,
    'sourceReviewPassClaimed': False, 'newProofs': 0, 'newBuilds': 0, 'productionOperations': 0}
with (directory / 'pr294-sidecar-review-boundary.json').open('x', encoding='utf-8', newline='\n') as stream: json.dump(record, stream, indent=2)
paragraph = ('PR294 corrected-sidecar source checkpoint ' + now + ': exact source ' + source +
    ' pushed; NEW source request162/6126680868 postedONCE/native delivered and visuallyverified, actual review running. '
    '185/185Windows+185/185Linux guards0failure/error/skip/no productionDB PASS; coordinator18984ff11f0bd2cd1871bb731d44e4985562b0b96b4bea2734b2a2e17b5ceafe/'
    'contractcfc8dab7db0e4861c5a5837811701e52f838111f5e72b7d82a1ea1ac27219d19/'
    'sharedstagedb27c39cfeb8ed58167f2fba108a91702498561245e57eefeaff1f5d7397aca6. '
    'Exact main bytes+inode/device/mtime/mode, absent/0WAL, absent/32768SHM plus NEW detached full10639 seal equality; '
    'newrepeatsealwallcost measured and included in5400sunit headroom;16retainedDBallocations; futurefixed62-filekit/sharedproof+deploy+freeze+manifest+gatepolicy. '
    'Clactualnative reuse approval scope read: original image7aebc035/413806636B/0400receipt1a983172/root135400/source630b/review6125544861 remain eligible when separatelybound; '
    'freshreadonly verification all31source/mode/receipt/archive/index/review/image/revision/originaltag unchanged/completedbuildunit0. '
    'Both new-source build entry points REFUSE immediately; NEVER rebuild/retag. '
    'NEW exact firstroot /opt/lims/releases/instrument-import-proof-959d17e1-20261012T144000Z verifiedABSENT, reservedidentifier; no newwriter. '
    'Actual NEW SourcePASS/reviewID/pin notyet recorded; old6125544861 cannotauthorize newproof. '
    'Both FAILED105200Z and134000Z permanentlyexcluded/retain originalFAILEDreceipts; NEVER replay/retry/relabel/feedkit. '
    'PR294/main959d/appPASS6125341751/allCIgreen unchanged. ProductioncontractUNREVIEWED_SIDECAR_FORWARD_REFUSE/0; old63761 noteligible. '
    'Liveold51f/d4ebhealthy0restart/samevolumes/free' + str(preflight['freeBytes']) + 'B atsourcepreflight; no SQLite originals/prodmutation/kit/gate/quiesce/installer/startup/cleanup/cards/drafts/humancheckout changes. '
    'SAMEwriter continues actualNEWSourcePASS→exclusive newpin/originalbuild reuse→ONEnewfirstproof→NEWproductionsource→stoppedoriginalPASSkit/exactaudit/freshgate/forwarddeploy/Clpostchecks; otherappmergesheld.')
for name in ['WP/audit-release-eb6de2e8/README.md', 'WP/runtime-recovery-kobo/README.md', 'WP/pr284-release/README.md']:
    path = repo / name
    previous = path.read_bytes()
    assert not previous.startswith(paragraph.encode()), 'Never repeat boundary'
    path.write_bytes((paragraph + '\n\nPrevious checkpoint follows:\n\n').encode() + previous)
print(json.dumps(record))
