"""Restore three original test lines from raw Git; no DDL/data/host operations."""
import datetime
import hashlib
import json
from pathlib import Path
import re
import subprocess

root = Path(__file__).resolve().parents[2]
relative = 'server/tests/contracts/audit_4_7_instrument_import_install.test.js'
path = root / relative
base = '5dd5488d138514351fffd54d0b0232ae19fcb64d'
original = subprocess.check_output(['git', 'show', base + ':' + relative], cwd=root)
before = path.read_bytes()
prefixes = [b'    mapping:', b'    sourceSha256:', b'        const rawValue =']
lines = before.splitlines()
for prefix in prefixes:
    previous = [line for line in original.splitlines() if line.startswith(prefix)]
    indexes = [index for index, line in enumerate(lines) if line.startswith(prefix)]
    assert len(previous) == len(indexes) == 1, prefix
    lines[indexes[0]] = previous[0]
after = b'\n'.join(lines) + b'\n'
path.write_bytes(after)
assert all([line for line in after.splitlines() if line.startswith(prefix)] ==
           [line for line in original.splitlines() if line.startswith(prefix)] for prefix in prefixes)
log = root / 'WP/pr284-resume-20261012/native-workbench-full-d1509feb-1130.log'
raw_log = log.read_bytes()
text = raw_log.decode('utf-16' if raw_log.startswith(b'\xff\xfe') else 'utf-8-sig', errors='replace')
record = {'observedUtc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'status': 'D150_FULL_VALIDATION_STOPPED_SUPERSEDED_TEST_ENCODING_NOT_A_PASS',
    'session': 59467, 'sessionExitCode': 1, 'head': 'd1509febd010a12f14adfef147aa7f88c369119a',
    'logSha256': hashlib.sha256(raw_log).hexdigest(),
    'completedPassingSuitesBeforeStop': len(re.findall(r'^PASS ', text, re.M)),
    'completedFailingSuitesBeforeStop': len(re.findall(r'^FAIL ', text, re.M)),
    'changedFile': relative, 'beforeSha256': hashlib.sha256(before).hexdigest(),
    'afterSha256': hashlib.sha256(after).hexdigest(), 'restoredRawGitBase': base,
    'restoredOriginalLineCount': 3, 'originalUnicodeLineBytesRestored': True,
    'productionMutations': 0}
output = root / 'WP/pr284-resume-20261012/native-workbench-encoding-correction-and-stopped-full.json'
with output.open('x', encoding='utf-8') as stream:
    json.dump(record, stream, indent=2)
print(json.dumps(record))
