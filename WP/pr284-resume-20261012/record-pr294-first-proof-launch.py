"""Checkpoint the single active proof and completed CI without touching the host."""
import datetime
import hashlib
import json
from pathlib import Path

directory = Path(__file__).resolve().parent
repo = directory.parents[1]
destination = directory / 'pr294-first-proof-launch-boundary.json'
assert not destination.exists(), 'Never replace a launch record'
dispatch = json.loads((directory / 'pr294-first-proof.result.json').read_bytes())
assert dispatch['exitCode'] == 0
launch = json.loads((directory / 'pr294-first-proof.stdout.log').read_text().strip())
ci = json.loads((directory / 'pr294-main-ci-38256676268.json').read_bytes())
assert ci['status'] == 'EXACT_PR294_MERGED_MAIN_CI_FULL_SUCCESS'
observations = sorted(directory.glob('pr294-first-proof-observation-*.json'))
assert observations
observation = json.loads(observations[-1].read_bytes())
record = {'observedUtc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'status': 'SINGLE_SOURCE_REVIEWED_FIRST_PROOF_ACTIVE_NO_TERMINAL_PASS_YET',
    'launch': launch, 'dispatch': dispatch, 'mainCi': ci,
    'latestReadOnlyObservation': observation, 'nativeDelivery': {
        'project': 'LIMS Audit', 'thread': 'Lab workflow audit and plan',
        'freshEmptyComposerAndFocusChecked': True, 'sentMessageVisuallyVerified': True,
        'cardsAndDraftsUntouched': True}, 'productionMutations': 0, 'productionGateCollected': False}
with destination.open('x', encoding='utf-8', newline='\n') as stream:
    json.dump(record, stream, indent=2)
prefix = ('PR294 first-proof launch checkpoint ' + record['observedUtc'] +
    ': exact mainCI38256676268 completedSUCCESS14:14:27UTC/ALL360suites5478tests/client/bothactualDocker/boundary/readiness; originalfullCIlogSHA80ee2fb7510a7023c42f8c956b6100884d83b1dad9108d4c4a032264134bba46. '
    'ONE original source-reviewed first proof nowACTIVE at /opt/lims/releases/instrument-import-proof-959d17e1-20261012T134000Z, unit lims-owned-instrument-import-proof-959d17e1-20261012t134000z.service; continue SAMEunit/writer, never replay/restart/retry/newwriter. '
    'Actual raw630b2354a1a45df0d88545ac5c63594361615999 SourcePASS6125544861/appPASS6125341751/merge959d/currentmain/tree3362/pin3786a68f/sourceindex49f6a0f360f5424be3ffac8cbd7eefdf690464449ae5c1d6f28487df86eafe84/coordinator8c65daee unchanged. '
    'Read-only14:16:47UTC unitACTIVE/running, fresh backup and protected-state file exist; no terminalreceipt/PASS yet. Liveold51f/d4eb remainshealthy0restart; free84550557696B. Native launchboundary delivered/visuallyverified. '
    'Original completednewbuild135400Z/image7aebc035/receipt1a983172 retained/neverrebuild; FAILED105200/old5ddbuild5757/completedPR293 neverreplayed/reused. '
    'Proposed63761ad129afae735e83e0c330030d868dedfef4 productionrawexport39files/60fixedfiles/175Win+Linux remainsUNAPPROVED; request after actualfirstproof perCl. No kit/gate/quiesce/production installer/defaultstartup/mutation/cleanup/cards/humancheckout changes. '
    'Continue same activeproof actualnative3CLI/2readiness/timing/full10438→10639 preservation/twoNATURALcompletions/interval+2min+660healthy/stopwriters/immutableoriginalPASSorFAILED, thenseparateproductionSource/exactkit/freshgate/forwarddeploy/Clactualpostcheck.\n\nPrevious checkpoint follows:\n\n')
for relative in ['WP/audit-release-eb6de2e8/README.md', 'WP/runtime-recovery-kobo/README.md', 'WP/pr284-release/README.md']:
    path = repo / relative
    path.write_text(prefix + path.read_text(encoding='utf-8'), encoding='utf-8', newline='\n')
body = ('Claudio: mainCI38256676268 is now fully SUCCESS (completed2026-10-12T14:14:27UTC): '
    'ALL360/5478, client, both actual Docker builds, boundary and readiness acceptance. Raw CI logSHA25680ee2fb7510a7023c42f8c956b6100884d83b1dad9108d4c4a032264134bba46.\n\n'
    'ONE first proof has been launched from actual reviewed source630b2354a1a45df0d88545ac5c63594361615999 with SourcePASS6125544861/appPASS6125341751/current959d17e11c357266f7c2a41b0c84ab76914c591e/exacttree3362 and the original new build7aebc035.\n\n'
    'Root: /opt/lims/releases/instrument-import-proof-959d17e1-20261012T134000Z\n'
    'Unit: lims-owned-instrument-import-proof-959d17e1-20261012t134000z.service\n'
    'Original source index SHA25649f6a0f360f5424be3ffac8cbd7eefdf690464449ae5c1d6f28487df86eafe84\n'
    'Coordinator SHA2568c65daee59ddd303adab4f7f48b1a22073472bd99203a8c45c31d9e4438fa213\n'
    'Target pin SHA2563786a68f0df9e0762a4d7cc144251b9180297f7dbf9d5745a8591d58f9680a8f\n\n'
    'Read-only14:16:47UTC: unit ACTIVE/running; fresh backup and protected-state capture exist. No terminal receipt or proof PASS yet. Same writer continues this single unit; never restart, replay, retry or create another writer. Actual full-size native/readiness/timing/preservation/natural scheduler evidence must finish and all owned writers must stop before a PASSED claim.\n\n'
    'The old51f/d4eb live app remains healthy/0restarts. No production installer, quiesce, gate, deploy or cleanup. Both workload pins remain bound. Proposed63761 production source will be submitted separately after this original first proof, as requested. Native launch delivery was visually verified; human cards/drafts untouched. All historical failed proofs, builds and completed consumed kits are retained and never reused.\n')
with (directory / 'pr294-first-proof-launch-comment.md').open('x', encoding='utf-8', newline='\n') as stream:
    stream.write(body)
print(json.dumps({'status': record['status'], 'sha256': hashlib.sha256(destination.read_bytes()).hexdigest()}))
