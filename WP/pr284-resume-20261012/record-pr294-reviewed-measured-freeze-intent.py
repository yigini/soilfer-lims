"""Record the actual approved one-shot read-only package now in progress."""
import datetime
import json
from pathlib import Path

directory = Path(__file__).resolve().parent
root = directory.parent.parent
verified = json.loads((directory / 'production-source-pass-6130963561-verified.json').read_bytes())
intent = json.loads((directory / 'pr294-freeze-161000-intent.json').read_bytes())
assert verified['reviewId'] == intent['sourceReviewId'] == 6130963561
assert verified['sourceCommit'] == intent['sourceCommit'] == 'abceab95b8d68b1b3202df9f4f9fc229d9baa2ae'
assert not (directory / 'pr294-freeze-161000-result.json').exists()
stamp = datetime.datetime.now(datetime.timezone.utc).isoformat()
checkpoint = f'''PR294 actual measured-source PASS / SAME read-only freeze in progress {stamp}

Actual NEW Source review: PASS#162/6130963561 at19:16:37UTC for exactabceab95b8d68b1b3202df9f4f9fc229d9baa2ae/all39hashes/900packaging and960SSH limits. Independently verified19:18:17/rawreviewSHAeea070fac0690382eea797fc6763cd6ba077ca72cd05d8895195b252be737da9/currentmain959d/no laterfailure; actualnative acknowledgement read. All190/190 Windows+Linux guards passed and all31 measured proof/runtime policy bytes unchanged.

Both distinct161000Z roots were freshly absent before dispatch. ONE reviewed read-only freezer is ACTIVE in SAME localsession47957, using freeze-pr294-measured-reviewed-kit-once.py6130963561; intent retained. Package /opt/lims/releases/instrument-import-package-959d17e1-20261012T161000Z exists; target /opt/lims/releases/instrument-import-release-959d17e1-20261012T161000Z does NOT exist at19:19:46UTC. Per-stage log currently stopped-authority-and-retained-file-hashes, no terminal result. Never rerun/retry/refreeze/launch another package. Await actual result; no kit PASS/manifest/gate/production operation claimed. This suffix is identifier, not actual preparation time. On success retain62immutable files/manifest and original package freeze.stdout/freeze-result.json, then send actual hashes for NEW exact-kit audit. On any failure stop/preserve/notify; any created root burned and no partial reuse.

Original stopped144000 firstPASS receiptf2aff162 unchanged/source201bb/6126765238; original135400build/image7aeb/receipt1a983 unchanged. Never proof replay/newcopy/build/retag. Failed154640package/execution root excluded forever; failedproof105200/134000 and completedPR293 untouched/retained/excluded. No production mutation/quiesce/defaultstartup/installer/cleanup/card/humancheckout changes. Otherapplicationmerges held until#200live/Clactualpostcheck. SAMEwriter continues SAME freezer then exactreview/freshsingle-usegate/forwarddeploy/independentverification/Clhandoff under existing go.
'''
for name in ['WP/audit-release-eb6de2e8/README.md', 'WP/runtime-recovery-kobo/README.md', 'WP/pr284-release/README.md']:
    path = root / name
    path.write_bytes((checkpoint + '\nPrevious checkpoint follows:\n\n').encode() + path.read_bytes())
record = {'recordedUtc': stamp, 'status': 'ACTUAL_SOURCE_PASS_SAME_FREEZER_IN_PROGRESS',
    'sourceReviewId': 6130963561, 'localSession': 47957, 'intent': intent, 'productionOperations': 0}
with (directory / 'pr294-measured-freeze-intent-checkpoint.json').open('x', encoding='utf-8', newline='\n') as out:
    json.dump(record, out, indent=2)
print(json.dumps(record))
