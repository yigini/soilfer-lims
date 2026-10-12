"""Retain the posted review request and native delivery, without approval."""
import datetime
import hashlib
import json
from pathlib import Path
import subprocess

repo = Path(__file__).resolve().parents[2]
directory = Path(__file__).resolve().parent
destination = directory / 'pr294-source-delivery-1346.json'
assert not destination.exists(), 'Never replace original evidence'
request = json.loads(subprocess.check_output(['gh', 'api', 'repos/yigini/soilfer-lims/issues/comments/6125488121'], cwd=repo))
body = (directory / 'source-review-630b2354-final.md').read_text(encoding='utf-8')
assert request['html_url'] == 'https://github.com/yigini/soilfer-lims/issues/162#issuecomment-6125488121'
assert request['body'].rstrip() == body.rstrip()
preparation = json.loads((directory / 'pr294-source-request-preparation-1342.json').read_bytes())
assert preparation['sourceCommit'] == '630b2354a1a45df0d88545ac5c63594361615999'
main = json.loads(subprocess.check_output(['gh', 'api', 'repos/yigini/soilfer-lims/git/ref/heads/main'], cwd=repo))
ci = json.loads(subprocess.check_output(['gh', 'api', 'repos/yigini/soilfer-lims/actions/runs/38256676268'], cwd=repo))
assert main['object']['sha'] == ci['head_sha'] == '959d17e11c357266f7c2a41b0c84ab76914c591e'
for name, item in preparation['sourceIndex']['files'].items():
    assert hashlib.sha256((directory / 'proof-source-export-630b2354' / name).read_bytes()).hexdigest() == item['sha256']
record = {'observedUtc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'status': 'NEW_PR294_PROOF_SOURCE_REQUEST_POSTED_NOT_YET_VALIDATED_AS_APPROVED',
    'request': request, 'requestBodySha256': hashlib.sha256(body.encode()).hexdigest(),
    'sourceCommit': preparation['sourceCommit'], 'guards': preparation['guards'], 'mainCi': ci,
    'applicationAuditId': 6125341751, 'mergedHead': main['object']['sha'],
    'firstProofRoot': '/opt/lims/releases/instrument-import-proof-959d17e1-20261012T134000Z',
    'nativeDelivery': {'project': 'LIMS Audit', 'thread': 'Lab workflow audit and plan',
        'freshTargetEmptyComposerAndFocusChecked': True, 'sentMessageVisuallyVerified': True,
        'humanDraftsAndCardsUntouched': True},
    'sourcePassIndependentlyValidated': False, 'newBuildsOrProofs': 0, 'productionOperations': 0}
with destination.open('x', encoding='utf-8', newline='\n') as stream:
    json.dump(record, stream, indent=2)
prefix = ('PR294 merged/new-source checkpoint ' + record['observedUtc'] +
    ': actual applicationPASS6125341751 at13:33:47UTC/Clown360/5478/4064.9s. Pip exact gates/union tree verified before merging PR294 at13:34:52UTC as959d17e11c357266f7c2a41b0c84ab76914c591e; currentmain/parents5dd+5e/tree336223df0161caeae4eb7db1e40df748d8ba110f match. '
    'Main CI38256676268 ' + ci['status'] + '/' + str(ci['conclusion']) + ', must PASS before isolated proof. '
    'NEW proposed source630b2354a1a45df0d88545ac5c63594361615999 binds actualPR294/appaudit6125341751/merge959d/tree3362/exact firstroot /opt/lims/releases/instrument-import-proof-959d17e1-20261012T134000Z (reserved identifier, read-only absent check, not launched). '
    '175/175Windows+175/175Linux guards0failure/error/skip/no productionDB pass13:39:17/13:39:26UTC; coordinator8c65daee59ddd303adab4f7f48b1a22073472bd99203a8c45c31d9e4438fa213/contract2736d3ad6b788bb2e9302bb7e31fced42bead523e2f5889e7d9987a839657d55. '
    'Only actual contract bindings changed since4090 pre-review; closed native preservation2e282300/schema208c61/historical14helpers unchanged. Full31-file newSource request6125488121 posted ONCE and native delivery visually verified; NEW SourcePASS not yet independently validated. '
    'Flat raw-Git export630b retained/compiled only; never execute later docsHEAD as reviewed source. Production proof binding staysUNREVIEWED_NATIVE_FORWARD_REFUSE/0, cannot freeze. '
    'No newheadbuild/proof/kit/gate/production action. FAILED105200/receipt511c, original5ddbuild92be/image5757 and completedPR293 remain retained NEVERreplay/reuse. '
    'SAME writer continues actualNEWSourcePASS thenONEnewheadbuild/mainCIgreen/ONEexactfirstproof, separateNEWproductionSource/stoppedoriginalPASSkit/exactaudit/freshsingleusegate/forwarddeploy. '
    'Other app merges held until200live/Clpostchecked; batching/ownership cards remainYYdecisions untouched.\n\nPrevious checkpoint follows:\n\n')
for relative in ['WP/audit-release-eb6de2e8/README.md', 'WP/runtime-recovery-kobo/README.md', 'WP/pr284-release/README.md']:
    path = repo / relative
    path.write_text(prefix + path.read_text(encoding='utf-8'), encoding='utf-8', newline='\n')
print(json.dumps({'status': record['status'], 'createdUtc': request['created_at'],
    'recordSha256': hashlib.sha256(destination.read_bytes()).hexdigest(), 'mainCiStatus': ci['status']}))
