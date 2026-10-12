"""Retain verified build and actual native clarification, with CI still separate."""
import datetime
import hashlib
import json
from pathlib import Path
import subprocess

directory = Path(__file__).resolve().parent
repo = directory.parents[1]
destination = directory / 'pr294-build-completed-boundary-1400.json'
assert not destination.exists(), 'Never overwrite original evidence'
built = json.loads((directory / 'build-959d17e1-135400' / 'independent-verification.json').read_bytes())
pin = json.loads((directory / 'target-pin-959d17e1.json').read_bytes())
ci = json.loads(subprocess.check_output(['gh', 'api', 'repos/yigini/soilfer-lims/actions/runs/38256676268'], encoding='utf-8'))
assert ci['head_sha'] == pin['head'] and (ci['status'] != 'completed' or ci['conclusion'] == 'success')
guards = {platform: json.loads((directory / ('pr294-production-source-63761ad1-' + platform + '-1400.json')).read_bytes())
    for platform in ['windows', 'linux']}
assert all(row['exitCode'] == 0 and row['result']['tests'] == 175 and row['result']['failures'] == row['result']['errors'] == row['result']['skips'] == 0 for row in guards.values())
record = {'observedUtc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'status': 'ORIGINAL_NEW_BUILD_INDEPENDENTLY_VERIFIED_PROOF_WAITING_FOR_MAIN_CI',
    'buildVerification': built, 'pin': pin, 'mainCi': ci, 'proposedProductionSource': '63761ad129afae735e83e0c330030d868dedfef4',
    'guards': guards, 'productionSourceApproved': False, 'proofLaunched': False,
    'nativeClaudioClarification': {'project': 'LIMS Audit', 'thread': 'Lab workflow audit and plan',
        'readDirectlyFromFreshCapture': True,
        'transcription': 'My sentence in the thread was too strict. The approved code and my posted review are what count, so the one build you dispatched stays eligible. The preparer allows an image-only/no-database build while main CI runs unless CI has failed. The proof launcher requires main CI38256676268 SUCCESS before any copy/proof. If CI fails, this build is unusable; new forward reviews, no second build of this source. Main stays959d17e1 throughout.',
        'cardsAndDraftsUntouched': True}, 'productionMutations': 0}
with destination.open('x', encoding='utf-8', newline='\n') as stream:
    json.dump(record, stream, indent=2)
prefix = ('PR294 completed-build checkpoint ' + record['observedUtc'] +
    ': ONE original build /opt/lims/releases/instrument-import-build-959d17e1-20261012T135400Z completed13:55:19.757668UTC/inactive-dead/exit0. Original0400 BUILT_ONLY_NOT_DEPLOYED receipt1a983172adebaba8b1a61959810d5469d9c12d706725bd33783d43cc8cceabe0; '
    'image sha256:7aebc035254a61b0b4b8ecb59492d582af7f3769c147a35a7e92a43fb7a642d2/413806636B/exact959d revision/2286rawGitblobs/archive99c40eef08c11ad0dbc2576b7e6f36abd56f4e0bb68e36102b187cb9fb20cbe1/index35c20fd965066aabb123d059a79f240223a40a9b9602ef87216ec126fa47c76a independentlyverified. '
    'ActualNEWSourcePASS6125544861/source630b/all31bytes unchanged; targetpin3786a68f0df9e0762a4d7cc144251b9180297f7dbf9d5745a8591d58f9680a8f bindsappPASS6125341751/mainCI38256676268/exactFIRSTroot134000Z/bothpins. '
    'NativeClaudio clarified his wait-before-build wording was too strict; reviewedcode/postedpassallow this one image-only buildwhileCIruns. Actualclarificationreadfreshly, buildeligible; no secondbuild/replay/retry. MainCI ' + ci['status'] + '/' + str(ci['conclusion']) +
    '; proof MUST waitSUCCESS and currentmain959d. No proofrootcreated/no copy/installer/startup/production action. '
    'ProposedNEWproduction source63761ad129afae735e83e0c330030d868dedfef4 bindsactual630b/6125544861/all31proofbytes;175/175Windows+175/175Linux0fail/error/skip/no productionDB pass13:57:41/13:57:59UTC. NOT productionSourcePASS; request after actualfirstproof perCl. '
    'Live13:47old51f/d4eb healthy0restart/HTTPS200/samevolumes/original480f+41files unchanged/free86583988224B. All oldFAILED105200/5ddbuild5757/completedPR293 originalartifacts remainretained, neverreused/replayed. '
    'Same writer continuesCI→ONEexactfirstproof→NEWproductionSource→originalstoppedPASSkit→exactaudit→freshsingle-usegate→forwarddeploy/Clpostcheck. No cleanup/cards/drafts/humancheckout changes; other app merges held until200live/postchecked.\n\nPrevious checkpoint follows:\n\n')
for relative in ['WP/audit-release-eb6de2e8/README.md', 'WP/runtime-recovery-kobo/README.md', 'WP/pr284-release/README.md']:
    path = repo / relative
    path.write_text(prefix + path.read_text(encoding='utf-8'), encoding='utf-8', newline='\n')
print(json.dumps({'status': record['status'], 'sha256': hashlib.sha256(destination.read_bytes()).hexdigest(), 'mainCiStatus': ci['status']}))
