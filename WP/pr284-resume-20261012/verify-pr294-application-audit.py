"""Read-only exact-head formal audit and CI evidence before the authorized merge."""
import datetime
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys

repo = Path(__file__).resolve().parents[2]
head = '5e65fe5b587747efc717f167f9b61469effa9afe'
base = '5dd5488d138514351fffd54d0b0232ae19fcb64d'
tree = '336223df0161caeae4eb7db1e40df748d8ba110f'
review_id, destination = sys.argv[1:]
output = Path(destination)
assert review_id.isdigit() and int(review_id) > 0 and int(review_id) != 6121933894
assert not output.exists(), 'Never overwrite original audit evidence'

def github(endpoint):
    return json.loads(subprocess.check_output(['gh', 'api', 'repos/yigini/soilfer-lims/' + endpoint], cwd=repo))

pr = github('pulls/294')
assert not pr['merged'] and pr['state'] == 'open' and not pr['draft']
assert pr['head']['ref'] == 'codex/native-workbench-import-forward-fix' and pr['head']['sha'] == head
assert pr['base']['sha'] == base and pr['base']['ref'] == 'main'
assert 'Refs #200' in pr['body'] and not re.search(r'(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s+#200', pr['body'], re.I)
review = github('issues/comments/' + review_id)
first = next(line.strip().strip('*_# ') for line in review['body'].splitlines() if line.strip())
assert first == 'Audit passed: OK to merge and deploy' and head in review['body']
assert review['id'] == int(review_id) and review['html_url'] == pr['html_url'] + '#issuecomment-' + review_id
pages = json.loads(subprocess.check_output(['gh', 'api', 'repos/yigini/soilfer-lims/issues/294/comments?per_page=100',
    '--paginate', '--slurp'], cwd=repo))
assert not any('audit failed' in row['body'].lower() and row['created_at'] >= review['created_at']
    for page in pages for row in page)
check_runs = github('commits/' + head + '/check-runs')['check_runs']
assert check_runs and all(row['head_sha'] == head and row['status'] == 'completed'
    and row['conclusion'] == 'success' for row in check_runs)
ci = github('actions/runs/38247731718')
assert ci['name'] == 'CI' and ci['event'] == 'pull_request' and ci['head_sha'] == head
assert ci['status'] == 'completed' and ci['conclusion'] == 'success'
jobs = github('actions/runs/38247731718/jobs')['jobs']
assert jobs and all(job['status'] == 'completed' and job['conclusion'] == 'success' for job in jobs)
required = {'Build client production bundle', 'Run server test suite', 'Build Docker image',
    'Build Supported Baseline Docker Image (v3.5.30 / 48d0e52)',
    'Run Real Disposable Docker Boundary Rehearsal', 'Run Real Docker Deployment Readiness Acceptance'}
passed = {step['name'] for job in jobs for step in job['steps']
    if step['status'] == 'completed' and step['conclusion'] == 'success'}
assert required <= passed, sorted(required - passed)
audited = github('git/commits/' + head)
assert audited['tree']['sha'] == tree
local_tree = subprocess.check_output(['git', 'rev-parse', head + '^{tree}'], cwd=repo).decode().strip()
union = subprocess.check_output(['git', 'merge-tree', '--write-tree', base, head], cwd=repo).decode().strip()
assert local_tree == union == tree
expected_files = set(subprocess.check_output(['git', 'diff', '--name-only', base, head], cwd=repo).decode().splitlines())
actual_files = github('pulls/294/files?per_page=100')
assert len(expected_files) == 5 and expected_files == {row['filename'] for row in actual_files}
assert github('git/ref/heads/main')['object']['sha'] == base
assert github('pulls/294')['head']['sha'] == head
record = {'observedUtc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'status': 'EXACT_PR294_FORMAL_AUDIT_CI_UNION_TREE_VERIFIED_NOT_YET_MERGED',
    'pr': pr, 'review': review, 'allPrComments': pages, 'checks': check_runs, 'ci': ci,
    'jobs': jobs, 'auditedCommit': audited, 'unionTree': union, 'approvedFileSet': sorted(expected_files),
    'localFullPassEvidenceSha256': hashlib.sha256((repo / 'WP/pr284-resume-20261012/pr294-full-pass-1224.json').read_bytes()).hexdigest(),
    'productionOperations': 0, 'mergePerformed': False, 'sourceExecutionApprovalClaimed': False}
with output.open('x', encoding='utf-8', newline='\n') as stream:
    json.dump(record, stream, indent=2)
print(json.dumps({'status': record['status'], 'pr': 294, 'head': head, 'base': base,
    'tree': tree, 'auditReviewId': int(review_id), 'ci': ci['id'], 'requiredGatesPassed': sorted(required)}))
