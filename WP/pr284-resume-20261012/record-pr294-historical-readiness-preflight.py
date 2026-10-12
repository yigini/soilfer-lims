"""Read prior immutable receipts only; no candidate timing or execution claim."""
import datetime
import hashlib
import json
from pathlib import Path

repo = Path(__file__).resolve().parents[2]
output = Path(__file__).resolve().parent / 'pr294-historical-readiness-preflight-1304.json'
assert not output.exists(), 'Never replace original timing evidence'
records = []
for relative, expected_hash, expected_status in [
    ('WP/pr293-frozen-kit-20261012T044924Z/kit/rehearsal-receipt.json',
     '4b18963ae410af1afb0c9458ab759a50f2de3dfbf591771f28233636fc321cc9',
     'PASSED_NEW_CANDIDATE_NATURAL_KOBO_PROOF'),
    ('WP/pr293-independent-postdeploy/completed-052300Z/production-receipt.json',
     '480f9e1a102533f6b8e2e1646db1bfbaeeab30f9e63a1a3611926dd82e621515',
     'DEPLOYED_NEW_RUNTIME_FORWARD')]:
    path = repo / relative
    raw = path.read_bytes()
    assert hashlib.sha256(raw).hexdigest() == expected_hash
    receipt = json.loads(raw)
    assert receipt['status'] == expected_status
    timings = {stage: receipt[stage]['elapsedSeconds'] for stage in ['jobsOffReadiness', 'jobsOnReadiness']}
    assert all(type(value) in [int, float] and 0 < value < 540 for value in timings.values())
    records.append({'relativeFile': relative, 'receiptSha256': expected_hash,
        'historicalHead': receipt['head'], 'historicalStatus': receipt['status'],
        'elapsedSeconds': timings,
        'distanceFromProposed540SecondMaximum': {stage: 540 - value for stage, value in timings.items()},
        'distanceFrom600SecondTimeout': {stage: 600 - value for stage, value in timings.items()}})
    assert path.read_bytes() == raw
result = {'observedUtc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'status': 'HISTORICAL_READ_ONLY_TIMING_REVIEW_NOT_NEW_PROOF', 'records': records,
    'newCandidateCliOrReadinessMeasured': False, 'newCandidatePassClaimed': False,
    'newTotalProductionWallTimeEstimated': False,
    'remainingNewMeasurementsRequired': ['import-dry', 'import-apply', 'import-repeat',
        'new-jobs-off-readiness', 'new-jobs-on-readiness'],
    'unmeasuredCostsRemainExplicit': ['quiesce', 'backup', 'seals', 'API probes', 'ingress', 'coordination'],
    'nativeClaudioPreReview': {'source': '4090ffcb89429bc8a902b5581b25811a367f2b89',
        'hisReportedOwnedGuardsPassed': 175, 'isSourceReviewPass': False,
        'requiredBeforeSourceRequest': ['exact EXPECTED_PROOF_ROOT with timestamp',
            'actual application audit and merge', 'no intervening application merge',
            'review prior measured readiness timings; failed first root can never retry'],
        'optionalSubstringVerdictClassifierChangeApplied': False},
    'productionOperations': 0, 'newBuildsOrProofs': 0}
with output.open('x', encoding='utf-8', newline='\n') as stream:
    json.dump(result, stream, indent=2)
print(json.dumps({'status': result['status'], 'historicalReadinessTimings': records,
    'recordSha256': hashlib.sha256(output.read_bytes()).hexdigest()}))
