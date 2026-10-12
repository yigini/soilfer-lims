"""Retain the exact merged application and reserve a name by read-only checks."""
import datetime
import hashlib
import json
from pathlib import Path
import subprocess

repo = Path(__file__).resolve().parents[2]
directory = Path(__file__).resolve().parent
destination = directory / 'pr294-verified-merge-1340.json'
assert not destination.exists(), 'Never replace original evidence'
head = '5e65fe5b587747efc717f167f9b61469effa9afe'
base = '5dd5488d138514351fffd54d0b0232ae19fcb64d'
merged = '959d17e11c357266f7c2a41b0c84ab76914c591e'
tree = '336223df0161caeae4eb7db1e40df748d8ba110f'
first_root = '/opt/lims/releases/instrument-import-proof-959d17e1-20261012T134000Z'

def api(endpoint):
    return json.loads(subprocess.check_output(['gh', 'api', 'repos/yigini/soilfer-lims/' + endpoint], cwd=repo))

pr = api('pulls/294')
commit = api('git/commits/' + merged)
audit = api('issues/comments/6125341751')
ci = api('actions/runs/38256676268')
assert pr['merged'] and pr['head']['sha'] == head and pr['merge_commit_sha'] == merged
assert api('git/ref/heads/main')['object']['sha'] == merged
assert commit['tree']['sha'] == tree and [row['sha'] for row in commit['parents']] == [base, head]
assert subprocess.check_output(['git', 'rev-parse', merged + '^{tree}'], cwd=repo).decode().strip() == tree
assert subprocess.check_output(['git', 'merge-tree', '--write-tree', base, head], cwd=repo).decode().strip() == tree
assert audit['body'].splitlines()[0] == 'Audit passed: OK to merge and deploy' and head in audit['body']
assert ci['head_sha'] == merged and ci['name'] == 'CI' and ci['event'] == 'push'
assert ci['status'] != 'completed' or ci['conclusion'] == 'success'
remote_code = "import json,os; p=" + repr(first_root) + "; assert not os.path.lexists(p), 'First root already exists'; print(json.dumps({'path':p,'exists':False,'operation':'READ_ONLY_LEXISTS_NO_CREATION'}))"
result = subprocess.run(['ssh', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=15', 'root@46.19.33.37', 'python3', '-B', '-'],
    input=remote_code, text=True, encoding='utf-8', capture_output=True, check=True, timeout=30)
availability = json.loads(result.stdout)
assert availability['path'] == first_root and availability['exists'] is False
before = (directory / 'pr294-application-audit-1334.json').read_bytes()
record = {'observedUtc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'status': 'EXACT_PR294_MERGE_AND_AUDITED_TREE_VERIFIED_SOURCE_REVIEW_PENDING',
    'pr': pr, 'mergedCommit': commit, 'audit': audit, 'mainCi': ci,
    'preMergeVerificationSha256': hashlib.sha256(before).hexdigest(),
    'proposedOriginalFirstProofRoot': first_root, 'firstRootAvailabilityReadOnly': availability,
    'nativeMergeBoundarySentAndVisuallyVerified': True,
    'productionOperations': 0, 'newBuildsOrProofs': 0, 'sourceApprovalClaimed': False}
with destination.open('x', encoding='utf-8', newline='\n') as stream:
    json.dump(record, stream, indent=2)
print(json.dumps({'head': merged, 'tree': tree, 'parents': [base, head], 'firstRoot': first_root,
    'recordSha256': hashlib.sha256(destination.read_bytes()).hexdigest()}))
