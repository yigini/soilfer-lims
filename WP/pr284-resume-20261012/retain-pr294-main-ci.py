"""Retain exact completed main CI once; never rerun or trigger a workflow."""
import datetime
import hashlib
import json
from pathlib import Path
import re
import subprocess

directory = Path(__file__).resolve().parent
record_path = directory / 'pr294-main-ci-38256676268.json'
log_path = directory / 'pr294-main-ci-38256676268.log'
assert not record_path.exists() and not log_path.exists(), 'Never replace original CI evidence'
def github(endpoint):
    return json.loads(subprocess.check_output(['gh', 'api', endpoint]))
run = github('repos/yigini/soilfer-lims/actions/runs/38256676268')
assert run['head_sha'] == '959d17e11c357266f7c2a41b0c84ab76914c591e'
assert run['name'] == 'CI' and run['event'] == 'push' and run['status'] == 'completed' and run['conclusion'] == 'success'
jobs = github('repos/yigini/soilfer-lims/actions/runs/38256676268/jobs?per_page=100')
assert jobs['jobs'] and all(row['status'] == 'completed' and row['conclusion'] == 'success' for row in jobs['jobs'])
steps = {step['name']: step for job in jobs['jobs'] for step in job['steps']}
for name in ['Run server test suite', 'Build client production bundle', 'Build Docker image',
    'Build Supported Baseline Docker Image (v3.5.30 / 48d0e52)',
    'Run Real Disposable Docker Boundary Rehearsal', 'Run Real Docker Deployment Readiness Acceptance']:
    assert steps[name]['status'] == 'completed' and steps[name]['conclusion'] == 'success', name
checks = github('repos/yigini/soilfer-lims/commits/' + run['head_sha'] + '/check-runs')
assert checks['check_runs'] and all(row['status'] == 'completed' and row['conclusion'] == 'success' for row in checks['check_runs'])
data = subprocess.check_output(['gh', 'run', 'view', '38256676268', '--log'], timeout=120)
text = data.decode('utf-8')
assert re.search(r'Test Suites:\s+360 passed, 360 total', text)
assert re.search(r'Tests:\s+5478 passed, 5478 total', text)
with log_path.open('xb') as stream:
    stream.write(data)
record = {'observedUtc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'status': 'EXACT_PR294_MERGED_MAIN_CI_FULL_SUCCESS', 'run': run, 'jobs': jobs,
    'checks': checks, 'serverSuites': 360, 'serverTests': 5478,
    'rawLogSha256': hashlib.sha256(data).hexdigest(), 'productionMutations': 0}
with record_path.open('x', encoding='utf-8', newline='\n') as stream:
    json.dump(record, stream, indent=2)
print(json.dumps({'status': record['status'], 'head': run['head_sha'],
    'completedUtc': max(job['completed_at'] for job in jobs['jobs']),
    'suites': 360, 'tests': 5478, 'rawLogSha256': record['rawLogSha256']}))
