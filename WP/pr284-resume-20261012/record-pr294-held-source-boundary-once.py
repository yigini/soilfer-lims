"""Retain posted request and actual held observation; no approval or execution."""
import datetime
import hashlib
import json
from pathlib import Path
import subprocess

d = Path(__file__).resolve().parent
source = 'a2a1694ef3956aea0fbe12d21dfaa8f5473ac947'
identifier = 6132063289
raw = subprocess.check_output(['gh', 'api', 'repos/yigini/soilfer-lims/issues/comments/' + str(identifier)])
comment = json.loads(raw)
assert comment['id'] == identifier and source in comment['body']
request = (d / 'production-source-a2a1694e-request.md').read_bytes()
assert comment['body'].rstrip() == request.decode().rstrip()
with (d / ('production-source-request-' + str(identifier) + '.json')).open('xb') as out: out.write(raw)
observed = json.loads((d / 'held-readonly-20261012T202706997016Z/stdout.json').read_bytes())
assert observed['status'] == 'FAILED_PRODUCTION_HELD_PHYSICAL_ORIGINALS_VERIFIED_NO_APPLY'
assert observed['originalPhysicalTripleUnchanged'] and observed['originalStoppedBackupHashUnchanged']
assert observed['all62FrozenFilesUnchanged'] and observed['originalProofReceiptUnchanged']
record = {'retainedUtc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'sourceCommit': source, 'requestId': identifier, 'requestUrl': comment['html_url'],
    'requestCreatedUtc': comment['created_at'], 'rawApiSha256': hashlib.sha256(raw).hexdigest(),
    'requestFileSha256': hashlib.sha256(request).hexdigest(), 'sourceApproved': False,
    'heldObservation': observed, 'nativeDelivery': 'PENDING_DIRECT_OBSERVATION',
    'productionMutations': 0}
with (d / 'pr294-held-source-6132063289-boundary.json').open('x', encoding='utf-8', newline='\n') as out:
    json.dump(record, out, indent=2)
print(json.dumps({key: value for key, value in record.items() if key != 'heldObservation'}))
