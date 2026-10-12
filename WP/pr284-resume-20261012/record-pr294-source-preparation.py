"""Retain guard results for actual-PR metadata; execution stays unbound."""
import datetime
import hashlib
import json
from pathlib import Path

repo = Path(__file__).resolve().parents[2]
here = Path(__file__).resolve().parent
records = {}
for platform, name in [('Windows', 'pr294-bound-source-windows-1232.log'), ('Linux', 'pr294-bound-source-linux-1232.log')]:
    raw = (here / name).read_bytes()
    text = raw.decode('utf-16' if raw.startswith(b'\xff\xfe') else 'utf-8-sig')
    value = next(json.loads(line) for line in text.splitlines() if line.startswith('{'))
    assert value['sourceCommit'] == '4090ffcb89429bc8a902b5581b25811a367f2b89'
    assert value['tests'] == 175 and value['errors'] == value['failures'] == value['skips'] == 0
    assert value['productionDatabaseAccess'] is False
    value['rawLogSha256'] = hashlib.sha256(raw).hexdigest()
    records[platform] = value
assert records['Windows']['packagingSourceHashes'] == records['Linux']['packagingSourceHashes']
live = json.loads((here / 'live-readonly-pr294-validation-1227.json').read_bytes())
assert live['status'] == 'INDEPENDENT_READ_ONLY_POST_DEPLOY_PASS' and live['productionMutations'] == 0
assert live['head'] == '51f6798806f630773786a08432290c1b21a841da' and live['restartCount'] == 0
record = {'observedUtc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'status': 'PROPOSED_PR294_SOURCE_METADATA_ONLY_EXECUTION_UNBOUND', 'pr': 294,
    'sourceCommit': records['Windows']['sourceCommit'], 'guards': records,
    'applicationAuditReviewId': 0, 'candidateMerge': 'UNMERGED_REFUSE',
    'firstProofRoot': 'UNREVIEWED_FIRST_PROOF_REFUSE', 'newSourcePassClaimed': False,
    'productionOperations': 0, 'freshReadOnlyLiveObservedUtc': live['observedUtc'],
    'freshReadOnlyLiveSha256': hashlib.sha256((here / 'live-readonly-pr294-validation-1227.json').read_bytes()).hexdigest()}
with (here / 'pr294-source-preparation-1233.json').open('x', encoding='utf-8', newline='\n') as stream:
    json.dump(record, stream, indent=2)
summary = (
    'PR294 source-preparation checkpoint ' + record['observedUtc'] + ': actual correction PR294/five-file head5e65 is DRAFT, full local360/5478 and client build passed; exact CI38247731718 still running. Proposed source4090ffcb89429bc8a902b5581b25811a367f2b89 now names actual authorized PR294, and all175/175Windows+175/175Linux pure guards pass0error/failure/skip/no production DB access. Only proposed contract PR metadata changed; application bytes remain frozen. Actual application audit ID0/mergeUNMERGED_REFUSE/first proof rootUNREVIEWED_FIRST_PROOF_REFUSE/source approval remain unbound and cannot execute/build/proof/freeze/gate/deploy. Fresh read-only live verification12:27:31UTC passed: exact old51f/d4eb healthy0restart/same volumes/HTTPShealth+login200/originalreceipt480f and41files unchanged/free86592835584B. Historical104/38 backups were verified byte-for-byte, not claimed as fresh live SQL counts; retained unauthorized401 was not a new POST. Failedf5e105200/receipt511c remains FAILED forever, original5dd build92be/image5757 retained, completedPR293 never replayed/reused. Same writer continues actual CI/formal application audit/new reviewed forward sources/first proof/kit/deploy chain.\n\nPrevious checkpoint follows:\n\n'
)
for relative in ['WP/audit-release-eb6de2e8/README.md', 'WP/runtime-recovery-kobo/README.md', 'WP/pr284-release/README.md']:
    path = repo / relative
    path.write_text(summary + path.read_text(encoding='utf-8'), encoding='utf-8', newline='\n')
print(json.dumps({'sourceCommit': record['sourceCommit'], 'guardTestsEach': 175,
    'observedUtc': record['observedUtc'], 'liveObservedUtc': live['observedUtc']}))
