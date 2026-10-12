"""Retain the actual ready notice and successful CI without granting authority."""
import datetime
import hashlib
import json
from pathlib import Path
import subprocess

repo = Path(__file__).resolve().parents[2]
directory = Path(__file__).resolve().parent
destination = directory / 'pr294-ready-ci-boundary-1256.json'
assert not destination.exists(), 'Never replace original evidence'
head = '5e65fe5b587747efc717f167f9b61469effa9afe'
base = '5dd5488d138514351fffd54d0b0232ae19fcb64d'


def api(endpoint):
    return json.loads(subprocess.check_output(['gh', 'api', 'repos/yigini/soilfer-lims/' + endpoint], cwd=repo))


pr = api('pulls/294')
notice = api('issues/comments/6124673883')
assert pr['state'] == 'open' and not pr['draft'] and not pr['merged']
assert pr['head']['sha'] == head and pr['base']['sha'] == base
assert api('git/ref/heads/main')['object']['sha'] == base
assert notice['html_url'] == pr['html_url'] + '#issuecomment-6124673883'
assert notice['body'].splitlines()[0] == '@claude ready for audit at ' + head
assert 'Refs #200' in notice['body']
ci_raw = (directory / 'pr294-ci-completed-38247731718.json').read_bytes()
ci = json.loads(ci_raw)
assert ci['status'] == 'EXACT_PR294_CI_FULL_AND_ALL_DOCKER_GATES_PASS'
assert ci['run']['head_sha'] == head and ci['run']['conclusion'] == 'success'
assert hashlib.sha256((directory / 'pr294-ci-completed-38247731718.log').read_bytes()).hexdigest() == ci['logSha256']
assert subprocess.check_output(['git', 'rev-parse', head + '^{tree}'], cwd=repo).decode().strip() == '336223df0161caeae4eb7db1e40df748d8ba110f'
record = {'observedUtc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'status': 'PR294_READY_FULL_CI_PASS_FORMAL_AUDIT_PENDING', 'pr': pr, 'readyNotice': notice,
    'ciEvidenceSha256': hashlib.sha256(ci_raw).hexdigest(), 'ciLogSha256': ci['logSha256'],
    'nativeBoundaryDelivery': {'observedUtcMinute': '2026-10-12T12:56Z',
        'project': 'LIMS Audit', 'thread': 'Lab workflow audit and plan',
        'freshCorrectTargetEmptyComposerFocusedBeforeTyping': True,
        'sentMessageVisuallyVerified': True, 'humanDraftsAndCardsUntouched': True,
        'actualClaudioAcknowledgement': 'Ready-for-audit received and CI green; exact-head verdict after own full Linux run finishes',
        'ownFullRunLatestObservedCompletedSuites': 58, 'ownFullRunTotalSuites': 360,
        'ownFullRunFailuresSoFar': 0, 'ownFullRunComplete': False},
    'proposedSource': '4090ffcb89429bc8a902b5581b25811a367f2b89',
    'sourceExecutionAuthorityClaimed': False, 'formalAuditClaimed': False,
    'mergePerformed': False, 'productionOperations': 0, 'activeLocalTestsOrWriters': 0,
    'completedCiWatcherExitCode': 0}
with destination.open('x', encoding='utf-8', newline='\n') as stream:
    json.dump(record, stream, indent=2)
prefix = ('PR294 ready/CI boundary ' + record['observedUtc'] + ': exact application ' + head +
    '/tree336223df0161caeae4eb7db1e40df748d8ba110f/base' + base +
    ' remains unchanged. Exact CI38247731718 completed SUCCESS12:53:08UTC: ALL360/360 suites5478/5478tests, client build, both actual Docker builds, disposable boundary and readiness acceptance passed; original raw logSHA' + ci['logSha256'] +
    '. Existing PR294 marked READY; exact @claude ready for audit notice6124673883 posted ONCE and native delivery visually verified. Claudio actually acknowledged the notice/green CI and will post his exact-head verdict after his own full Linux run; latest observed58/360 suites0fail INCOMPLETE, never called PASS. Local full360/5478/build and six original DB/WAL/SHM hashes remain retained unchanged; no active local Jest, CI watcher or production writer. Proposed source4090 PR294-only175Win+Linux remains unreviewed/unbound; offered read-only pre-review, no SourcePASS requested or inferred. No formal application audit/merge or #200 build/proof/kit/gate/production action. FAILED105200/receipt511c and completed5dd build92be/image5757 never replayed; completedPR293 and healthyold51f untouched. Same writer continues actual formal audit, verified merge, NEW source review/one first proof/production source/exact kit/fresh gate/forward deploy. YY one-time PR exception is already resolved; do not reask it. Other application merges remain held until200live/Clpostchecked.\n\nPrevious checkpoint follows:\n\n')
for relative in ['WP/audit-release-eb6de2e8/README.md', 'WP/runtime-recovery-kobo/README.md', 'WP/pr284-release/README.md']:
    path = repo / relative
    existing = path.read_text(encoding='utf-8')
    path.write_text(prefix + existing, encoding='utf-8', newline='\n')
print(json.dumps({'status': record['status'], 'readyComment': notice['html_url'],
    'ciRun': ci['run']['id'], 'recordSha256': hashlib.sha256(destination.read_bytes()).hexdigest()}))
