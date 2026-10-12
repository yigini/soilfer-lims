"""Record actual terminal PASS and the posted separate review request."""
import datetime
import hashlib
import json
from pathlib import Path
import subprocess

directory = Path(__file__).resolve().parent
root = directory.parent.parent
raw = (directory / 'completed-proof-144000/rehearsal-receipt.json').read_bytes()
proof = json.loads(raw)
assert proof['status'] == 'PASSED_NEW_IMPORT_NATURAL_KOBO_PROOF'
digest = hashlib.sha256(raw).hexdigest()
request_raw = subprocess.check_output(['gh', 'api', 'repos/yigini/soilfer-lims/issues/comments/6127597671'])
request = json.loads(request_raw)
assert '5fa7e65f3d13a04f270e90e0b4b129f8eaf3296e' in request['body'] and digest in request['body']
with (directory / 'production-source-request-6127597671.json').open('xb') as stream: stream.write(request_raw)
stamp = datetime.datetime.now(datetime.timezone.utc).isoformat()
checkpoint = f'''PR294 stopped first PASS / production-source review boundary {stamp}

The original reviewed144000Z first proof completed {proof['completedUtc']}, PASSED_NEW_IMPORT_NATURAL_KOBO_PROOF, unit inactive/dead/exit0 and all owned writers stopped/retained. Immutable0400 receipt SHA256 {digest}. Never replay/restart/retry/rebuild/retag this completed proof or its original135400Z build. Failed105200Z/134000Z roots remain permanently excluded.

Actual native DRY/APPLY/immediateNO_OP passed; full104tables38receipts to106tables39receipts empty additive delta, all original rows/schema and scientific fields retained. Both default startups23NO_OP0/22READY0;31+6 read-only probes made zero changes. First natural sync {proof['firstScheduledSync']['utc']} and second {proof['secondScheduledSync']['utc']} passed full preservation, with zero new sample intake and original cursor/15-minute interval unchanged. Healthy soak {proof['healthySoakSeconds']}s/0restarts/peak{proof['peakBytes']}B. Original acceptance/event, ReviewDecision.attemptId NULL and PUBLISHED report remain intact. Raw32files plus original sealed scheduler streams committed/pushed; original backups, raw triples and ledger remain retained on host.

NEW separate production-source request #162/6127597671 posted ONCE and delivered/visually verified in Claudio's native thread. Exact proposed source5fa7e65f3d13a04f270e90e0b4b129f8eaf3296e,39rawfiles/62futurekitfiles, deploycoord4cc81f6428a55f50aa3d0d30514ee9de82e0e55246970a967dbde3d6d7d19b9c, contracta7a5b83de579ba5f4ff992094a25c91e92d26b44e908a115c55d67158eb485f7;185Windows+185Linux pure guards pass. All31 measured201bb/6126765238 proof bytes unchanged. Actual measured stages+repeatseal+660health total1169.471064s, leaving4230.528936s of5400unit; other costs explicitly unmeasured. Await actual NEW formal Source review: PASS; then ONE immutable kit from this original stopped PASS, NEW exact-kit audit, ONE fresh10minute gate and ONE forward deployment under standinggo. No source approval inferred, no kit/gate/production mutation/cleanup/cards. Old51f/d4eb healthy0restart/free73519087616B at terminal retention. Other application merges held until#200live/Clactualpostcheck. SAME writer continues.
'''
for name in ['WP/audit-release-eb6de2e8/README.md', 'WP/runtime-recovery-kobo/README.md', 'WP/pr284-release/README.md']:
    path = root / name
    path.write_bytes((checkpoint + '\nPrevious checkpoint follows:\n\n').encode() + path.read_bytes())
record = {'recordedUtc': stamp, 'status': 'STOPPED_FIRST_PASS_NEW_PRODUCTION_SOURCE_REVIEW_PENDING',
    'receiptSha256': digest, 'sourceRequestId': request['id'],
    'sourceRequestSha256': hashlib.sha256(request_raw).hexdigest(),
    'nativeDeliveryVisuallyVerified': True, 'productionOperations': 0}
with (directory / 'pr294-stopped-pass-source-request-checkpoint.json').open('x', encoding='utf-8', newline='\n') as stream:
    json.dump(record, stream, indent=2)
print(json.dumps(record))
