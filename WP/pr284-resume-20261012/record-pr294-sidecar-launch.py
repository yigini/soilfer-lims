"""Record the already-dispatched single proof and fresh read-only observations."""
import datetime
import hashlib
import json
from pathlib import Path

directory = Path(__file__).resolve().parent
root = directory.parent.parent
observations = sorted(directory.glob('pr294-sidecar-proof-observation-*.json'))
last = json.loads(observations[-1].read_bytes())
assert last['unitState']['ActiveState'] == 'active' and last['receipt'] is None
assert last['root'].endswith('20261012T144000Z')
live = next(row for row in last['containers'] if row['name'] == 'soilfer-lims')
assert live['restartCount'] == 0 and live['state']['Health']['Status'] == 'healthy'
names = ['pr294-sidecar-first-proof.intent.json', 'pr294-sidecar-first-proof.result.json',
    'pr294-sidecar-first-proof.stdout.log', 'pr294-sidecar-first-proof.stderr.log',
    'source-pass-6126765238.json', 'target-pin-959d17e1-sidecar-144000.json',
    'pr294-sidecar-source-pass-verification.json'] + [p.name for p in observations]
record = {'recordedUtc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'status': 'SAME_APPROVED_FIRST_PROOF_RUNNING_NOT_PASSED',
    'sourceReviewId': 6126765238, 'sourceCommit': '201bb5fe8fd30cb2991f7169177a864265e6301b',
    'root': last['root'], 'unit': last['unit'], 'lastObservationUtc': last['observedUtc'],
    'freeBytes': last['freeBytes'], 'productionOperations': 0,
    'nativeClaudioAcknowledgement': 'Observed 15:06 UTC: source pass and launch checked; waiting for stopped PASS, then NEW production-source/exact-kit review and post-deploy check.',
    'files': {name: hashlib.sha256((directory / name).read_bytes()).hexdigest() for name in names}}
with (directory / 'pr294-sidecar-launch-checkpoint.json').open('x', encoding='utf-8', newline='\n') as stream:
    json.dump(record, stream, indent=2)
checkpoint = (f"PR294 NEW source-pass/active-proof checkpoint {record['recordedUtc']}: actual NEW Source review: PASS162/6126765238 independently verified for exact201bb5fe8fd30cb2991f7169177a864265e6301b/all31rawbytes/current959d/appPASS6125341751/allCIgreen/originalbuildreuse/bothpins. RawreviewSHA20d7807ac5973b2f6b30b60a20f8dfd221c8b200a502c30e6ed02c5a51801bf0; exclusiveNEWpin241bd693b8cfdb3e9a05440716bd925a620a807bdb371206430a4abc2a9481b1. ONE reviewed first proof ACTIVE at {last['root']}, unit {last['unit']}; continue SAMEunit/writer, NEVER replay/restart/retry/newwriter. Exactsourceindex786caccf8a72f290c03fcb01584eea6dd1ac54160d0b52d2641a97b3e5d7cbeb/coordinator18984ff11f0bd2cd1871bb731d44e4985562b0b96b4bea2734b2a2e17b5ceafe. Latestreadonly{last['observedUtc']} active/running/no terminalreceipt or PASS; liveold51f/d4ebhealthy0restart/free{last['freeBytes']}B. Native actualCl sourcepass/launch acknowledgement observed; he waits for stoppedPASS before NEW production-source review. Launcher completed0/no PTY remains; source31bytes untouched. Originalvalidbuild135400/image7aeb/receipt1a983 reusedunchanged/NEVERrebuildretag; both FAILED105200/134000 permanentlyexcluded/receiptsretained. No productionmutation/kit/gate/quiesce/installer/defaultstartup/cleanup/cards/humancheckout changes. Production binding preparation may continue independently, formal NEW production-source request only after actualstoppedfirstPASS. Same writer continues actualproof/newproductionSource/ONEfrozenkit/exactreview/freshsingle-usegate/forwarddeploy/Clpostchecks; otherappmergesheld.")
for name in ['WP/audit-release-eb6de2e8/README.md', 'WP/runtime-recovery-kobo/README.md', 'WP/pr284-release/README.md']:
    path = root / name
    path.write_bytes((checkpoint + '\n\nPrevious checkpoint follows:\n\n').encode() + path.read_bytes())
body = ("ONE newly reviewed #200 first proof is running; not yet PASSED.\n\n"
    "NEW Source review: PASS: https://github.com/yigini/soilfer-lims/issues/162#issuecomment-6126765238. "
    "I independently verified exact source 201bb5fe8fd30cb2991f7169177a864265e6301b, all31 raw hashes, actual application review6125341751, current main959d17e11c357266f7c2a41b0c84ab76914c591e and green PR/main CI. "
    "The original completed build135400Z/image7aebc035/receipt1a983172 is reused unchanged under its separate630b/6125544861 authority; no rebuild or retag.\n\n"
    f"Original first-proof root: {last['root']}\nUnit: {last['unit']}\n"
    "Coordinator SHA256: 18984ff11f0bd2cd1871bb731d44e4985562b0b96b4bea2734b2a2e17b5ceafe\n"
    "Source index SHA256: 786caccf8a72f290c03fcb01584eea6dd1ac54160d0b52d2641a97b3e5d7cbeb\n"
    "New target-pin SHA256: 241bd693b8cfdb3e9a05440716bd925a620a807bdb371206430a4abc2a9481b1\n\n"
    f"Read-only {last['observedUtc']}: same unit active/running, no terminal receipt. "
    f"Existing production51f/d4eb remains healthy/0restarts, free{last['freeBytes']}B. "
    "Claudio's native acknowledgement read. Continue this SAME proof; both failed roots remain sealed/excluded forever. "
    "NEW production-source request will follow only its actual stopped PASS, then ONE frozen kit/exact-kit audit/fresh single-use gate/forward deployment under YY's standing go. "
    "Both workload pins remain bound. No production mutation, gate, cleanup or YY-card answer.")
with (directory / 'pr294-sidecar-launch-notice.md').open('x', encoding='utf-8', newline='\n') as stream:
    stream.write(body)
print(json.dumps({'recordedUtc': record['recordedUtc'], 'observedUtc': last['observedUtc'], 'status': record['status']}))
