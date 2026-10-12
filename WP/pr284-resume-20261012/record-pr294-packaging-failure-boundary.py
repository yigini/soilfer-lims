"""Record the failed first package and actual native review conditions."""
import datetime
import hashlib
import json
from pathlib import Path
import subprocess

directory = Path(__file__).resolve().parent
root = directory.parent.parent
raw = subprocess.check_output(['gh', 'api', 'repos/yigini/soilfer-lims/issues/comments/6127786378'])
with (directory / 'pr294-packaging-failure-comment-6127786378.json').open('xb') as out: out.write(raw)
diagnosis = json.loads((directory / 'pr294-freeze-154640-timeout-diagnosis.json').read_bytes())
assert diagnosis['executionRootExists'] is False and diagnosis['freezerProcesses'] == []
stamp = datetime.datetime.now(datetime.timezone.utc).isoformat()
checkpoint = f'''PR294 packaging failure / read-only correction boundary {stamp}

The original stopped144000Z first proof remains PASSED, inactive/exit0; immutable0400 receipt f2aff1624aa6b11abeca36374ffe45fc3b06c9ab78727b48b877512ba9f2fbce unchanged. All31 proof bytes, original135400Z build/image7aeb and retained data/backups remain unchanged. Never replay/restart/retry/rebuild/retag them.

Actual production Source review: PASS6127651539 bound5fa7e65f/all39 hashes. Its ONE first package154640Z FAILED at300-second read-only verification deadline. Local98160 finishedexit1; no freezer process remains. Package154640 retained. Intended execution root instrument-import-release-959d17e1-20261012T154640Z DOES NOT EXIST; permanently excluded and never rerun/reused. No kit/manifest/gate/production operation occurred. Full intent/result/stdout/stderr/diagnosis and failure#162/6127786378 retained; precise timed-out component was unlogged and is not retrospectively claimed.

Actual native Claudio accepts a packaging-only correction subject to read-only immutable originalproof, measured verification times plus margin/per-stage progress, distinct newroot/no reuse of any failed partialoutput, all31 proof bytes/readiness600/productionunit5400/headroom/pins unchanged, no newproof/build. A ONE read-only timing diagnostic measures immutable retained-backup validators, not the freezer, while proposed progress/transport changes are prepared. NO NEW productionSourcePASS or packaging authority yet. Source review is required before a distinct package/kit from the SAME stopped PASS. Old5fa cannot authorize changed source. SAME writer continues.

Read-only15:53:29UTC: productionold51f/d4eb healthy0restart/HTTPShealth+login200TLS/free73517789184B. No quiesce/installer/defaultstartup/deploy/cleanup/card answer. Otherappmerges held until#200live/Clactualpostcheck. Original FAILED105200/134000 and completedPR293 artifacts remain excluded/preserved. Both workloadpins and absolute/scaled reserve/500MB unexplained-growth guard unchanged.
'''
for name in ['WP/audit-release-eb6de2e8/README.md', 'WP/runtime-recovery-kobo/README.md', 'WP/pr284-release/README.md']:
    path = root / name
    path.write_bytes((checkpoint + '\nPrevious checkpoint follows:\n\n').encode() + path.read_bytes())
record = {'recordedUtc': stamp, 'status': 'PACKAGING_TIMEOUT_NO_KIT_NEW_REVIEW_PENDING',
          'nativeDeliveryVisuallyVerified': True, 'nativeCorrectionConditionsRead': True,
          'failureCommentId': 6127786378, 'rawFailureCommentSha256': hashlib.sha256(raw).hexdigest(),
          'productionOperations': 0, 'activeFreezer': False}
with (directory / 'pr294-packaging-failure-boundary.json').open('x', encoding='utf-8') as out:
    json.dump(record, out, indent=2)
print(json.dumps(record))
