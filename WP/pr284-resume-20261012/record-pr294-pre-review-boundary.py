"""Retain a native read-only pre-review boundary without granting authority."""
import datetime
import hashlib
import json
from pathlib import Path
import subprocess

repo = Path(__file__).resolve().parents[2]
directory = Path(__file__).resolve().parent
destination = directory / 'pr294-pre-review-boundary-1312.json'
assert not destination.exists(), 'Never replace original evidence'
head = '5e65fe5b587747efc717f167f9b61469effa9afe'
base = '5dd5488d138514351fffd54d0b0232ae19fcb64d'
pr = json.loads(subprocess.check_output(['gh', 'api', 'repos/yigini/soilfer-lims/pulls/294'], cwd=repo))
main = json.loads(subprocess.check_output(['gh', 'api', 'repos/yigini/soilfer-lims/git/ref/heads/main'], cwd=repo))
assert pr['state'] == 'open' and not pr['draft'] and not pr['merged']
assert pr['head']['sha'] == head and pr['base']['sha'] == base
assert main['object']['sha'] == base
timing_path = directory / 'pr294-historical-readiness-preflight-1304.json'
timing_bytes = timing_path.read_bytes()
timing = json.loads(timing_bytes)
timing_sha = hashlib.sha256(timing_bytes).hexdigest()
assert timing_sha == '7e0dc8de6ba16bb97c3c02552386d96caccfd745093aefe64500a5db988875c5'
assert timing['status'] == 'HISTORICAL_READ_ONLY_TIMING_REVIEW_NOT_NEW_PROOF'
assert not timing['newCandidatePassClaimed'] and not timing['newCandidateCliOrReadinessMeasured']
record = {
    'observedUtc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'status': 'NATIVE_READ_ONLY_HELPER_PRE_REVIEW_FORMAL_APPLICATION_AUDIT_PENDING',
    'applicationHead': head, 'baseAndCurrentMain': base, 'pr': pr,
    'source': '4090ffcb89429bc8a902b5581b25811a367f2b89',
    'nativeObservation': {
        'project': 'LIMS Audit', 'thread': 'Lab workflow audit and plan',
        'freshTargetAndEmptyComposersObserved': True,
        'humanDraftsAndDecisionCardsUntouched': True,
        'helperPreReviewReportedPassingGuards': 175,
        'helperPreReviewIsSourcePass': False,
        'ownFullLinuxRunCompletedSuites': 115, 'ownFullLinuxRunTotalSuites': 360,
        'ownFullLinuxRunFailuresSoFar': 0, 'ownFullLinuxRunComplete': False,
        'historicalTimingReplySentAndVisuallyVerified': True,
    },
    'historicalReadinessRecordSha256': timing_sha,
    'historicalReadinessRecord': timing,
    'formalApplicationAuditClaimed': False, 'sourceApprovalClaimed': False,
    'mergePerformed': False, 'newBuildsOrProofs': 0, 'productionOperations': 0,
    'remainingAuthority': ['actual exact-head PR294 audit', 'verified merge',
        'new source review with exact timestamped first proof root', 'one new first proof',
        'new production source review', 'new exact-kit audit', 'one fresh single-use gate'],
}
with destination.open('x', encoding='utf-8', newline='\n') as stream:
    json.dump(record, stream, indent=2)
prefix = (
    'PR294 read-only helper pre-review boundary ' + record['observedUtc'] + ': application ' + head +
    '/tree336223df0161caeae4eb7db1e40df748d8ba110f/base' + base +
    ' remains READY and unchanged; local and exact CI38247731718 all360/5478/client/both actual Docker gates PASS retained. '
    'Actual native Claudio pre-reviewed proposed4090 helpers and reported175/175 guards passing; this is NOT Source review: PASS. '
    'He requires the exact timestamped EXPECTED_PROOF_ROOT before the NEW source request, actual app audit/merge and no intervening app merge. '
    'Read-only historical readiness inspection found prior51f proof102.867705434/103.132669299s and production102.358188913/102.734928024s; original receipts unchanged. '
    'Historical timing recordSHA' + timing_sha + ' is prior-release evidence ONLY, not a new candidate measurement/PASS or total-wall estimate. '
    'All three new CLI and both new readiness timings still need actual measurement; unmeasured quiesce/backup/seal/API/ingress costs remain explicit. '
    'Timing reply sent to the correct native thread and visually verified; fresh actual ownLinux audit115/360 suites0fail INCOMPLETE. '
    'Formal app verdict remains pending; no SourcePASS/merge/newbuild/proof/kit/gate/production action. Optional broader failure-classifier refactor left unchanged. '
    'YY one-time PR exception already resolved; never reask. FAILED105200/receipt511c, originalbuild92be/image5757 and completedPR293 stay retained and never replayed. '
    'Same writer continues the exact formal review and NEW forward chain; other app merges held until200live/Clpostchecked.\n\nPrevious checkpoint follows:\n\n'
)
for relative in ['WP/audit-release-eb6de2e8/README.md', 'WP/runtime-recovery-kobo/README.md', 'WP/pr284-release/README.md']:
    path = repo / relative
    path.write_text(prefix + path.read_text(encoding='utf-8'), encoding='utf-8', newline='\n')
print(json.dumps({'status': record['status'], 'recordSha256': hashlib.sha256(destination.read_bytes()).hexdigest()}))
