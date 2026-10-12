"""Retain the single dispatch and live/source evidence without changing the host."""
import datetime
import hashlib
import json
from pathlib import Path
import subprocess

directory = Path(__file__).resolve().parent
repo = directory.parents[1]
destination = directory / 'pr294-build-source-boundary-1357.json'
assert not destination.exists(), 'Never overwrite boundary evidence'
dispatch = json.loads((directory / 'pr294-single-build-1354.result.json').read_bytes())
assert dispatch['exitCode'] == 0
launch = json.loads((directory / 'pr294-single-build-1354.stdout.log').read_text().strip())
assert launch['root'] == dispatch['buildRoot'] and launch['unit'] == dispatch['buildUnit']
state = subprocess.check_output(['ssh', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=15',
    'root@46.19.33.37', 'systemctl', 'show', dispatch['buildUnit'], '-p', 'ActiveState',
    '-p', 'SubState', '-p', 'ExecMainStatus', '-p', 'Result'], encoding='utf-8')
ci = json.loads(subprocess.check_output(['gh', 'api',
    'repos/yigini/soilfer-lims/actions/runs/38256676268'], encoding='utf-8'))
source = json.loads((directory / 'source-pass-6125544861.json').read_bytes())
live = json.loads((directory / 'live-readonly-pr294-source-boundary-1347.json').read_bytes())
record = {'observedUtc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'status': 'ONE_NEW_BUILD_DISPATCHED_PROOF_HELD_FOR_MAIN_CI_AND_NATIVE_ORDERING_CLARIFICATION',
    'dispatch': dispatch, 'launch': launch, 'unitState': state, 'mainCi': ci,
    'sourcePassRecordSha256': hashlib.sha256((directory / 'source-pass-6125544861.json').read_bytes()).hexdigest(),
    'sourceReviewId': source['review']['id'], 'sourceCommit': source['sourceIndex']['head'],
    'liveVerificationSha256': hashlib.sha256((directory / 'live-readonly-pr294-source-boundary-1347.json').read_bytes()).hexdigest(),
    'liveReadOnlyVerification': live,
    'nativeDelivery': {'project': 'LIMS Audit', 'thread': 'Lab workflow audit and plan',
        'emptyComposerAndFocusChecked': True, 'sentMessageVisuallyVerified': True,
        'clarification': 'Native wait-before-build sentence differs from reviewed preparer build-while-CI policy; dispatched before sentence observed; proof held pending reply',
        'cardsAndHumanDraftsUntouched': True}, 'productionMutations': 0, 'newProofs': 0}
with destination.open('x', encoding='utf-8', newline='\n') as stream:
    json.dump(record, stream, indent=2)
prefix = ('PR294 source/build boundary ' + record['observedUtc'] +
    ': actual NEW SourcePASS6125544861 at13:45:56UTC independently validated against630b2354a1a45df0d88545ac5c63594361615999/all31rawbytes; rawrecordSHA6439506e4c7962fe19fdfd3e4c18e976044c8a725578c2e5b354bb208fa568d2. '
    'Actual applicationPASS6125341751/PR294 merge959d17e11c357266f7c2a41b0c84ab76914c591e/tree3362/currentmain unchanged. ONE new image-only build dispatched at ' + dispatch['buildRoot'] + ', unit ' + dispatch['buildUnit'] +
    '. Never replay/rebuild/relaunch; continue this same unit. Main CI38256676268 ' + ci['status'] + '/' + str(ci['conclusion']) +
    '; no proof before SUCCESS. Native Claudio wait-before-build wording differs from reviewed preparer build-while-CI policy; actual clarification delivered and visually verified after dispatch; hold proof/reuse pending reply, no second build. '
    'Reserved first proof root /opt/lims/releases/instrument-import-proof-959d17e1-20261012T134000Z still not launched; firstProofPolicy exact/no replay. Production source remains unreviewed/unbound, no kit/gate/production action. '
    'Read-only13:47:11UTC old51f/d4eb healthy0restart/HTTPShealthlogin200/samevolumes/original480f+41files unchanged/free86583988224B; historical104/38 seals verified, not fresh SQL counts; retained401 not newPOST. '
    '175/175Windows+Linux630b guards retained. FAILED105200/original5dd build5757/completedPR293 artifacts never replayed/reused. Same writer continues singlebuild/mainCI/firstproof/newproductionSource/stoppedPASSkit/exactaudit/freshgate/forwarddeployment; no cleanup/cards/drafts/humancheckout changes.\n\nPrevious checkpoint follows:\n\n')
for relative in ['WP/audit-release-eb6de2e8/README.md', 'WP/runtime-recovery-kobo/README.md', 'WP/pr284-release/README.md']:
    path = repo / relative
    path.write_text(prefix + path.read_text(encoding='utf-8'), encoding='utf-8', newline='\n')
print(json.dumps({'status': record['status'], 'sha256': hashlib.sha256(destination.read_bytes()).hexdigest(),
    'unitState': state, 'mainCiStatus': ci['status']}))
