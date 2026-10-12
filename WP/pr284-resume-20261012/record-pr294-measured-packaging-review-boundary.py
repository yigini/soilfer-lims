"""Record the actual posted correction and native review acknowledgement."""
import datetime
import hashlib
import json
from pathlib import Path
import subprocess

directory = Path(__file__).resolve().parent
root = directory.parent.parent
raw = subprocess.check_output(['gh', 'api', 'repos/yigini/soilfer-lims/issues/comments/6130853606'])
comment = json.loads(raw)
assert 'abceab95b8d68b1b3202df9f4f9fc229d9baa2ae' in comment['body']
with (directory / 'production-source-request-6130853606.json').open('xb') as out: out.write(raw)
stamp = datetime.datetime.now(datetime.timezone.utc).isoformat()
checkpoint = f'''PR294 measured packaging-only correction / actual review boundary {stamp}

Exact proposed packaging source abceab95b8d68b1b3202df9f4f9fc229d9baa2ae pushed,39 raw files/62 future kit files. Only freeze_import.py and export_freeze_import_kit.py differ within the packaging graph; all31 measured proof files and production coordinator/contract/gate/launcher unchanged.190/190 Windows and190/190 exact-source Linux pure guards PASS0failure/error/skip/no productionDB. Six actual read-only retained-backup validators completed16:06:21UTC in253.819321910s; all original bytes/modes/mtime and stoppedPASS receipt unchanged. Proposed packaging deadline900s=round300(2*measured+300overhead), SSH960s; per-stage flushed progress/immutable retained terminal logs, ONE child/no retry. Original failed component at300s was unlogged and remains unknown.

NEW source request #162/6130853606 posted ONCE at{comment['created_at']}, raw/comment/guards/measurements retained. Actual native delivery visually verified; Claudio acknowledged he is diffing against5fa7e65f then running his own guards. This is NOT Source review: PASS. No freeze/gate/production action yet. ONE future distinct package/kit161000Z (suffix identifier, not actual preparation time) may use ONLY original stopped144000Z PASS after actual new-source approval. Failed154640Z package/execution root permanently excluded, never rerun/reused. Prepared one-shot wrapper and read-only new-source kit retainer are unexecuted and require actual review evidence.

Original144000 proof PASSED15:40:30UTC/inactive0, immutable0400 receipt f2aff1624aa6b11abeca36374ffe45fc3b06c9ab78727b48b877512ba9f2fbce, source201bb5fe8fd30cb2991f7169177a864265e6301b/6126765238. Original135400 build/image7aeb/receipt1a983 unchanged and never rebuilt/retagged. No newproof/build/installer. Currentmain959d17e11c357266f7c2a41b0c84ab76914c591e/all360/5478 PR+mainCI green. Both default23NO_OP0/22READY0/31+6zero, natural sync/full preservation and empty10438→10639 import delta passed. No analytical backfill or acceptance changes. Production unit5400/readiness600/headroom/pins/reserve/forward-only rules unchanged. Original failed105200/134000 and completedPR293 artifacts retained/excluded.

Fresh public HTTPS health19:11 returned200/OK/version1.9.0; current deployment still old51f/d4eb. No fresh SQL/image-restart claim from that HTTP check. Otherappmerges held until#200live/Clactualpostcheck. SAME writer continues new sourcePASS→ONE distinct originalPASS kit→NEW exact-kit audit→ONE fresh single-use gate→ONE forwarddeploy→independent verification→Clactualhandoff. No human draft/card/checkout touched; no cleanup or retry.
'''
for name in ['WP/audit-release-eb6de2e8/README.md', 'WP/runtime-recovery-kobo/README.md', 'WP/pr284-release/README.md']:
    path = root / name
    path.write_bytes((checkpoint + '\nPrevious checkpoint follows:\n\n').encode() + path.read_bytes())
record = {'recordedUtc': stamp, 'status': 'MEASURED_PACKAGING_CORRECTION_ACTUAL_REVIEW_PENDING',
    'requestId': comment['id'], 'requestSha256': hashlib.sha256(raw).hexdigest(),
    'nativeDeliveryVisuallyVerified': True, 'actualClaudioDiffAndGuardReviewAcknowledged': True,
    'formalSourcePassClaimed': False, 'productionOperations': 0}
with (directory / 'pr294-measured-packaging-review-boundary.json').open('x', encoding='utf-8', newline='\n') as out:
    json.dump(record, out, indent=2)
print(json.dumps(record))
