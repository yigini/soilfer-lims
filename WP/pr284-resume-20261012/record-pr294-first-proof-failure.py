"""Retain original failure evidence and supersede the active-run checkpoint."""
import datetime
import hashlib
import json
from pathlib import Path
import subprocess

directory = Path(__file__).resolve().parent
repo = directory.parents[1]
for identifier in [6126115856, 6126290360]:
    raw = subprocess.check_output(['gh', 'api', 'repos/yigini/soilfer-lims/issues/comments/' + str(identifier)])
    value = json.loads(raw)
    assert value['id'] == identifier
    with (directory / ('pr294-comment-' + str(identifier) + '.json')).open('xb') as stream:
        stream.write(raw)
diagnosis_name = 'pr294-repeat-failure-physical-20261012T142709326307Z.json'
diagnosis = json.loads((directory / diagnosis_name).read_bytes())
receipt = diagnosis['records']['rehearsal-receipt.json']
assert receipt['sha256'] == 'e85e14bbe1fd46f312027443c8911e5eb5807e14787d4641141ef60c310e4fa2'
stamp = datetime.datetime.now(datetime.timezone.utc).isoformat()
header = ('PR294 FAILED first-proof checkpoint ' + stamp + ': original134000Z unit failed/exit1 at14:24:27.293103UTC; '
    'immutable0400FAILED receipt e85e14bbe1fd46f312027443c8911e5eb5807e14787d4641141ef60c310e4fa2. '
    'NEVER replay/retry/restart/relabel/reuse this burned root or feed it into a kit. All3 nativeCLI exited0 '
    '(DRY5.880794s/54718464B/0changes, APPLY75.018172s/90869760B/1schema receipt, repeat5.765935s/55762944B/NO_OP0); '
    'full10438→10639 empty additive preservation passed before repeat, scientificChanges0/all originalrows/schema retained. '
    'Guard refused physical repeat: main563322880B/SHA441cbb6d7d9d5b8070e3d9b99f86b251f12974f064ce450a130578ba9c30df51 '
    'identical; absent WAL/SHM became WAL0B/SHM32768B. Read-only zeroSQLite diagnosis '
    '2fd03a236975cd453f4677beb231e673b49f2bb645996610f8c6db3b9f7775af; all3CLI stopped/retained/exit0/OOMfalse/0restart. '
    'No default startup/jobsOFF/jobsON/probes/naturalproof completed. Failure162/6126290360/native delivered/Clactualdiagnosis read. '
    'Cl pins NEW forward-source repeat policy: exact main bytes/attributes, absent/emptyWAL, absent/32KiBSHM, '
    'full detached stopped WAL-aware seal equal installed baseline, shared proof/deploy/freeze bindings. '
    'Preparing guarded change/new exact firstroot; extra3DBallocations13→16 proposed; no NEWSourcePASS or newwriter. '
    'Old630b pass belongs burnedroot, production63761 cannot freeze/request approval. Validoriginal959d image7aeb/build1a983172 '
    'retained NEVERrebuild; separate reviewed reuse binding pendingCl. App/mainCI allgreen/current959d held. '
    'Liveold51f/d4eb healthy0restart/samevolumes, production untouched. No kit/gate/quiesce/installer/cleanup/cards/humancheckout changes. '
    'Same writer continues new-source repair/review/unique firstproof then productionSource/exactkit/gate/forwarddeploy/Clpostchecks.\n\n'
    'Previous checkpoint follows:\n\n')
for relative in ['WP/audit-release-eb6de2e8/README.md', 'WP/runtime-recovery-kobo/README.md', 'WP/pr284-release/README.md']:
    path = repo / relative
    path.write_bytes(header.encode('utf-8') + path.read_bytes())
record = {'observedUtc': stamp, 'status': 'FAILED_ORIGINAL_ROOT_PERMANENTLY_RETAINED_NEW_SOURCE_REQUIRED',
    'diagnosisRecord': diagnosis_name, 'diagnosisSha256': hashlib.sha256((directory / diagnosis_name).read_bytes()).hexdigest(),
    'originalReceiptSha256': receipt['sha256'], 'failureCommentId': 6126290360,
    'nativeScopeObserved': 'Exact main plus bounded readonly sidecars plus full detached WAL-aware seal; no replay',
    'newWriterStarted': False, 'productionMutations': 0}
with (directory / 'pr294-first-proof-failure-boundary.json').open('x', encoding='utf-8', newline='\n') as stream:
    json.dump(record, stream, indent=2)
print(json.dumps(record))
