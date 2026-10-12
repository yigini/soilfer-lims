"""Record partial evidence; never call it a completed proof."""
import datetime
import hashlib
import json
from pathlib import Path

directory = Path(__file__).resolve().parent
root = directory.parent.parent
observation = sorted(directory.glob('pr294-sidecar-proof-observation-*.json'))[-1]
evidence = json.loads(observation.read_bytes())
assert evidence['unitState']['ActiveState'] == 'active' and evidence['receipt'] is None
first = evidence['progress']['first-sync-preservation.json']
assert first['value']['allOriginalRowsPreserved'] and first['value']['schemaPreserved']
stamp = datetime.datetime.now(datetime.timezone.utc).isoformat()
checkpoint = f'''PR294 first natural sync checkpoint {stamp}

The SAME approved first proof remains active at /opt/lims/releases/instrument-import-proof-959d17e1-20261012T144000Z, unit lims-owned-instrument-import-proof-959d17e1-20261012t144000z.service. Source 201bb5fe8fd30cb2991f7169177a864265e6301b / review 6126765238; no terminal receipt or completed PASS. Read-only observation: {evidence['observedUtc']}.

All three native CLI stages and the immediate repeat passed. Jobs-OFF startup and its stopped seal completed; the distinct jobs-ON startup is healthy with zero restarts. The first NATURAL scheduler completion passed full preservation; first-sync-preservation.json SHA256 {first['sha256']}. It made no new sample intake. The original 15-minute interval and cursor were not edited. The second natural completion, interval-plus-two-minute observation, final stopped seals and immutable receipt remain pending. Continue ONLY this SAME unit; never restart, replay or launch another proof.

Proposed production source 5fa7e65f3d13a04f270e90e0b4b129f8eaf3296e / coordinator 4cc81f6428a55f50aa3d0d30514ee9de82e0e55246970a967dbde3d6d7d19b9c passed 185 Windows and 185 Linux guards. All 31 approved proof bytes are unchanged. No formal production-source request until the actual stopped first PASS; then NEW source review, ONE 62-file frozen kit, NEW exact-kit audit, ONE fresh single-use gate and ONE forward deployment. Prepared read-only evidence helpers do not grant execution authority.

Old production 51f/d4eb remains healthy with zero restarts. Free bytes {evidence['freeBytes']}. No production mutation, cleanup, card answer, build or retag. Failed roots 105200Z and 134000Z remain permanently excluded; the original valid build 135400Z is retained unchanged. Other application merges remain held until #200 is live and Claudio completes actual post-checks.
'''
for name in ['WP/audit-release-eb6de2e8/README.md', 'WP/runtime-recovery-kobo/README.md', 'WP/pr284-release/README.md']:
    path = root / name
    path.write_bytes((checkpoint + '\nPrevious checkpoint follows:\n\n').encode() + path.read_bytes())
record = {'recordedUtc': stamp, 'status': 'FIRST_NATURAL_PRESERVATION_PASSED_PROOF_STILL_ACTIVE',
    'observation': observation.name, 'observationSha256': hashlib.sha256(observation.read_bytes()).hexdigest(),
    'firstPreservationSha256': first['sha256'], 'productionOperations': 0}
with (directory / 'pr294-first-natural-progress.json').open('x', encoding='utf-8', newline='\n') as stream:
    json.dump(record, stream, indent=2)
print(json.dumps(record))
