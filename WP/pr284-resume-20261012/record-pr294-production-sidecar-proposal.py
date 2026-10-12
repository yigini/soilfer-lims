"""Checkpoint the validated proposal while the same proof continues."""
import datetime
import hashlib
import json
from pathlib import Path

directory = Path(__file__).resolve().parent
root = directory.parent.parent
proposal = json.loads((directory / 'production-source-5fa7e65f-preparation.json').read_bytes())
assert proposal['status'] == 'PROPOSED_PRODUCTION_SOURCE_NO_REQUEST_NO_APPROVAL_NO_EXECUTION'
assert all(row['result']['tests'] == 185 and row['exitCode'] == 0 for row in proposal['guards'].values())
last = sorted(directory.glob('pr294-sidecar-proof-observation-*.json'))[-1]
observed = json.loads(last.read_bytes())
assert observed['unitState']['ActiveState'] == 'active' and observed['receipt'] is None
repeat = observed['progress']['import-repeat-preservation.json']
assert repeat['value']['mainBytesAndAttributesPreserved'] is True and repeat['value']['fullInstalledStateEqual'] is True
stamp = datetime.datetime.now(datetime.timezone.utc).isoformat()
checkpoint = (f"PR294 active-proof/production-proposal checkpoint {stamp}: SAME approved201bb/6126765238 firstroot144000Z unit ACTIVE, no terminalreceipt/PASS at{observed['observedUtc']}. All3nativeCLI exit0/blankheap/networknone/768MiB (7.368493/74.207254/6.068385s, peaks91516928/92438528/54587392B). Exact10438→10639 emptyadditive preservation18e1379bac2f9b93696cf97e19a4d68e52aa3ff2e85053adf8e9d3c5d2efaafe/alloriginalrows-schema/scientificChanges0; immediate repeat authoritya6b464115fceebf06f14158b752b3e7fb2c51ffaf6fa4204f862d773dfdc8836/full detachedseal5d0ec77dae5735313792a3536c052837c1c29acfea47455cac0f8891d2b2b7a5 equality PASSED. JobsOFFdefaultstartup underway, proof notyetcomplete. Native partialboundary delivered/visuallyverified. PROPOSED production source5fa7e65f3d13a04f270e90e0b4b129f8eaf3296e now bindsactual201bb/6126765238/all31approvedproofbytesunchanged; onlyproductioncontractbindings changed.39rawfilescompile/62fixedfuturekit;185Win+185Linuxguards0failure-error-skip/no productionDB PASS15:10:52/15:11:14UTC. Deploycoord4cc81f6428a55f50aa3d0d30514ee9de82e0e55246970a967dbde3d6d7d19b9c/contracta7a5b83de579ba5f4ff992094a25c91e92d26b44e908a115c55d67158eb485f7. NO formalproductionSource request/pass, nofreeze/gate/productionmutation/cleanup/rebuildretag/replay; formalrequestONLYafteractualstoppedfirstPASS. Liveold51f/d4ebhealthy0restart/free{observed['freeBytes']}B. SamewritercontinuesSAMEunit; oldFAILED134000/105200/source63761 excludedforever, originalbuild135400 retainedeligibleunchanged; otherappmergesheld.")
for name in ['WP/audit-release-eb6de2e8/README.md', 'WP/runtime-recovery-kobo/README.md', 'WP/pr284-release/README.md']:
    path = root / name
    path.write_bytes((checkpoint + '\n\nPrevious checkpoint follows:\n\n').encode() + path.read_bytes())
record = {'recordedUtc': stamp, 'proposalSource': proposal['sourceCommit'],
    'status': proposal['status'], 'activeProofObservation': last.name,
    'observationSha256': hashlib.sha256(last.read_bytes()).hexdigest(),
    'nativeBoundaryDeliveredAndVerified': True, 'productionOperations': 0}
with (directory / 'pr294-production-sidecar-proposal-checkpoint.json').open('x', encoding='utf-8', newline='\n') as output:
    json.dump(record, output, indent=2)
print(json.dumps(record))
