"""Post one investigated CI boundary and concrete harness-scope question."""
import datetime
import hashlib
import json
import subprocess
from pathlib import Path

root = Path(__file__).resolve().parents[2]
evidence = Path(__file__).resolve().parent
record_path = evidence / 'issue-206-ci-failure-scope-question.json'
assert not record_path.exists()
marker = 'CI failure investigated: run 38393187129'
comments = json.loads(subprocess.check_output(['gh', 'issue', 'view', '206', '--repo',
    'yigini/soilfer-lims', '--json', 'comments'], cwd=root))['comments']
assert not any(marker in comment['body'] for comment in comments), 'Already posted; inspect instead.'
head = '9ae02f6ab7651d2ca887a98722f6a20ace3cc471'
pr = json.loads(subprocess.check_output(['gh', 'pr', 'view', '295', '--repo', 'yigini/soilfer-lims',
    '--json', 'headRefOid,state,closingIssuesReferences'], cwd=root))
assert pr['headRefOid'] == head and pr['state'] == 'OPEN' and pr['closingIssuesReferences'] == []
commit = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=root).decode().strip()
body = f'''**{marker}** — PR #295, exact head `{head}`.

The actual CI process completed FAILURE at 2026-10-13T12:31:44Z: 350 unique suites reported PASS, no FAIL suite header, then the single `jest --runInBand` process exhausted its existing 8 GB CI heap and exited 134. Full coverage is incomplete. Candidate and supported-baseline Docker builds, real Docker boundary rehearsal and deployment-readiness acceptance were skipped. No retry, replacement run, ready-for-audit notice, final handoff, merge or production operation was dispatched.

Original closed logs, ZIP, run/jobs/PR API records and hashes are [retained at audit commit `{commit[:8]}`](https://github.com/yigini/soilfer-lims/blob/{commit}/WP/backlog-resume-20261013/ci-38393187129-completed-failure/index.json). The separate complete local result remains 362 unique suites / 5,508 tests at `c56414a`, with its combined-report provenance and all earlier failed/incomplete attempts preserved.

**Claudio scope question:** may this PR carry the narrowly scoped test-harness correction to make ordinary `npm test` use `jest --maxWorkers=1 --workerIdleMemoryLimit=512MB`? The installed Jest scheduler uses a worker even at maxWorkers=1 when an idle memory limit is configured; recycling occurs between suites. This keeps one sequential suite process, stock discovery/assertions, both ordinary setup files, owned database isolation and normal failure propagation. It changes no application guard, migration, test expectation or production memory setting and proposes no heap increase. If a separate harness PR is required, please state that boundary before I change this PR head. Any changed head will require complete real CI, both Docker checks and your fresh exact-head audit PASS.
'''
body_path = evidence / 'issue-206-ci-failure-scope-question.md'
assert not body_path.exists()
body_path.write_bytes(body.encode())
request_path = evidence / 'issue-206-ci-failure-scope-question-request.json'
assert not request_path.exists()
request_path.write_bytes(json.dumps({'body': body}).encode())
raw = subprocess.check_output(['gh', 'api', '--method', 'POST',
    'repos/yigini/soilfer-lims/issues/206/comments', '--input', str(request_path)], cwd=root)
comment = json.loads(raw)
assert comment['body'] == body
raw_path = evidence / 'issue-206-ci-failure-scope-question-raw.json'
assert not raw_path.exists()
raw_path.write_bytes(raw)
record = dict(observedUtc=datetime.datetime.now(datetime.UTC).isoformat(), issue=206,
    pr=295, reviewHead=head, failedRun=38393187129, commentId=comment['id'],
    url=comment['html_url'], createdUtc=comment['created_at'],
    readyForAudit=False, finalNativeHandoff=False, productionMutations=0,
    scopeQuestion='One serial recyclable Jest worker; no application changes yet',
    files={path.name: dict(bytes=path.stat().st_size,
        sha256=hashlib.sha256(path.read_bytes()).hexdigest())
        for path in (body_path, request_path, raw_path)})
record_path.write_bytes((json.dumps(record, indent=2) + '\n').encode())
paths = [str(path.relative_to(root)).replace('\\', '/') for path in
    (body_path, request_path, raw_path, record_path, Path(__file__))]
assert not subprocess.check_output(['git', 'diff', '--cached', '--name-only'], cwd=root).strip()
subprocess.check_call(['git', 'add', '-f', '--', *paths], cwd=root)
for name, pin in record['files'].items():
    raw_blob = subprocess.check_output(['git', 'show', ':WP/backlog-resume-20261013/' + name], cwd=root)
    assert hashlib.sha256(raw_blob).hexdigest() == pin['sha256']
print(json.dumps({key: value for key, value in record.items() if key != 'files'}, indent=2))
