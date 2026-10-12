"""Retain completed exact PR CI, full summary and actual Docker gate evidence."""
import datetime
import hashlib
import json
from pathlib import Path
import re
import subprocess

REPO = Path(__file__).resolve().parents[2]
DIRECTORY = Path(__file__).resolve().parent
HEAD = '5e65fe5b587747efc717f167f9b61469effa9afe'
BASE = '5dd5488d138514351fffd54d0b0232ae19fcb64d'
RUN = 38247731718


def api(endpoint):
    return json.loads(subprocess.check_output(
        ['gh', 'api', 'repos/yigini/soilfer-lims/' + endpoint], cwd=REPO))


def main():
    output = DIRECTORY / 'pr294-ci-completed-38247731718.json'
    log_path = DIRECTORY / 'pr294-ci-completed-38247731718.log'
    assert not output.exists() and not log_path.exists(), 'Never replace original CI evidence'
    run = api('actions/runs/' + str(RUN))
    assert run['head_sha'] == HEAD and run['event'] == 'pull_request' and run['name'] == 'CI'
    assert run['status'] == 'completed' and run['conclusion'] == 'success', 'CI is not complete and green'
    jobs = api('actions/runs/' + str(RUN) + '/jobs')['jobs']
    assert jobs and all(job['status'] == 'completed' and job['conclusion'] == 'success' for job in jobs)
    required = {'Build client production bundle', 'Run server test suite', 'Build Docker image',
        'Build Supported Baseline Docker Image (v3.5.30 / 48d0e52)',
        'Run Real Disposable Docker Boundary Rehearsal', 'Run Real Docker Deployment Readiness Acceptance'}
    passed = {step['name'] for job in jobs for step in job['steps']
        if step['status'] == 'completed' and step['conclusion'] == 'success'}
    assert required <= passed, sorted(required - passed)
    checks = api('commits/' + HEAD + '/check-runs')['check_runs']
    assert checks and all(row['head_sha'] == HEAD and row['status'] == 'completed'
        and row['conclusion'] == 'success' for row in checks)
    pr = api('pulls/294')
    assert pr['head']['sha'] == HEAD and pr['base']['sha'] == BASE and not pr['merged']
    assert api('git/ref/heads/main')['object']['sha'] == BASE
    raw = subprocess.check_output(['gh', 'run', 'view', str(RUN), '--repo', 'yigini/soilfer-lims', '--log'], cwd=REPO)
    plain = re.sub(r'\x1b\[[0-9;]*[A-Za-z]', '', raw.decode('utf-8'))
    summaries = [line for line in plain.splitlines() if 'Test Suites:' in line or re.search(r'\bTests:', line)]
    assert any(re.search(r'Test Suites:\s+360 passed, 360 total', line) for line in summaries), summaries
    assert any(re.search(r'Tests:\s+5478 passed, 5478 total', line) for line in summaries), summaries
    record = {'observedUtc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'status': 'EXACT_PR294_CI_FULL_AND_ALL_DOCKER_GATES_PASS', 'run': run, 'jobs': jobs,
        'checkRuns': checks, 'pr': pr, 'requiredPassedSteps': sorted(required),
        'fullSuiteSummaryLines': summaries, 'logSha256': hashlib.sha256(raw).hexdigest(),
        'productionOperations': 0, 'formalAuditClaimed': False, 'mergePerformed': False}
    with log_path.open('xb') as stream:
        stream.write(raw)
    with output.open('x', encoding='utf-8', newline='\n') as stream:
        json.dump(record, stream, indent=2)
    print(json.dumps({'status': record['status'], 'head': HEAD, 'run': RUN,
        'completedUtc': max(job['completed_at'] for job in jobs),
        'fullSummary': summaries, 'logSha256': record['logSha256']}))


if __name__ == '__main__':
    main()
