"""Retain directly observed YY card and actual Claudio held-entry scope once."""
import datetime
import hashlib
import json
from pathlib import Path
import subprocess

d = Path(__file__).resolve().parent
w = d.parent.parent
raw = subprocess.check_output(['gh', 'api', 'repos/yigini/soilfer-lims/issues/comments/6131752416'])
scope = json.loads(raw)
assert scope['id'] == 6131752416 and scope['created_at'] == '2026-10-12T20:07:22Z'
assert '**stay in maintenance**' in scope['body']
choice = {
    'evidenceKind': 'DIRECT_NATIVE_CARD_READ_TRANSCRIPTION',
    'project': 'LIMS Audit', 'thread': 'Lab workflow audit and plan',
    'originalQuestion': 'Bring the LIMS back online on the old version while Pip builds the fix?',
    'originalSelectedOption': 'B — Stay in maintenance',
    'originalChosenDisplay': 'You chose · 10:07 PM',
    'chosenUtcMinute': '2026-10-12T20:07:00Z', 'timePrecision': 'minute',
    'displayTimeZone': 'Europe/Rome', 'choice': 'STAY_IN_MAINTENANCE',
    'confirmedByYY': True, 'observer': 'Pip',
    'observedUtc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'observationActions': ['read', 'scroll'], 'cardAnswerActionsByPip': 0,
    'entryScopeCommentId': scope['id'], 'entryScopeUrl': scope['html_url'],
    'entryScopeRawSha256': hashlib.sha256(raw).hexdigest(),
    'standingGoEvidenceRewritten': False, 'productionMutations': 0,
}
encoded = (json.dumps(choice, ensure_ascii=False, indent=2) + '\n').encode('utf-8')
for path, data in [
    (d / 'pr294-entry-scope-6131752416-api.json', raw),
    (w / 'WP/pr284-release/held-entry-scope-review.json', raw),
    (w / 'WP/pr284-release/yy-maintenance-choice-evidence.json', encoded),
]:
    with path.open('xb') as out:
        out.write(data)
failed = json.loads((d / 'failed-production-161000/production-receipt.json').read_bytes())
record = dict(choice,
    yyMaintenanceEvidenceSha256=hashlib.sha256(encoded).hexdigest(),
    originalStoppedBackupSha256=failed['stoppedBackupSha256'],
    originalContainerId=failed['preflight']['entryState']['containerId'],
    originalRawTripleSha256=hashlib.sha256(json.dumps(failed['originalDatabaseFiles'],
        sort_keys=True, separators=(',', ':'), ensure_ascii=False).encode()).hexdigest())
with (d / 'pr294-entry-choice-verified-6131752416.json').open('x', encoding='utf-8', newline='\n') as out:
    json.dump(record, out, ensure_ascii=False, indent=2)
print(json.dumps({key: record[key] for key in ['choice', 'observedUtc', 'yyMaintenanceEvidenceSha256',
    'entryScopeRawSha256', 'originalStoppedBackupSha256', 'originalContainerId', 'originalRawTripleSha256']}))
