"""Retain one closed main CI result. Never redispatch or replay this helper."""
import datetime
import hashlib
import io
import json
import re
import subprocess
import zipfile
from pathlib import Path

root = Path(__file__).resolve().parents[2]
work = Path(__file__).resolve().parent
dest = work / 'main-ci38409200015-completed-success'
head = '6d750914d8565acdd496767a7dd935811b5a89b2'
source = '1a0702b3be410ac1dcdd9dc92f0f0c3dd2774a3a'
base = '959d17e11c357266f7c2a41b0c84ab76914c591e'
tree = '85350d14bdff5a607a3d2edc9615785842c9c94b'

def command(*args):
    return subprocess.check_output(args, cwd=root)

assert not dest.exists(), 'Consumed boundary: do not replay.'
assert command('git', 'branch', '--show-current').strip() == b'audit/release-eb6de2e8'
assert not command('git', 'diff', '--cached', '--name-only').strip()
audit = command('git', 'rev-parse', 'HEAD').decode().strip()
assert audit == 'aa803b9efbfd7b5f2701446b0f8a3bf92d193da4'
assert command('git', 'ls-remote', 'origin', 'refs/heads/audit/release-eb6de2e8').decode().split()[0] == audit
dest.mkdir()

def retain(name, *args):
    raw = command('gh', *args)
    (dest / name).write_bytes(raw)
    return json.loads(raw)

run = retain('run-raw.json', 'api', 'repos/yigini/soilfer-lims/actions/runs/38409200015')
assert run['status'] == 'completed' and run['conclusion'] == 'success'
assert run['head_sha'] == head and run['run_attempt'] == 1 and run['event'] == 'push'
jobs = retain('jobs-raw.json', 'api', 'repos/yigini/soilfer-lims/actions/runs/38409200015/jobs?per_page=100')
assert len(jobs['jobs']) == 1
job = jobs['jobs'][0]
assert job['id'] == 115336904298 and job['status'] == 'completed' and job['conclusion'] == 'success'
assert all(s['status'] == 'completed' and s['conclusion'] == 'success' for s in job['steps'])
pr = retain('pr-raw.json', 'api', 'repos/yigini/soilfer-lims/pulls/295')
assert pr['merged'] is True and pr['merge_commit_sha'] == head and pr['head']['sha'] == source
commit = retain('actual-main-commit-raw.json', 'api', 'repos/yigini/soilfer-lims/git/commits/' + head)
assert commit['tree']['sha'] == tree and [p['sha'] for p in commit['parents']] == [base, source]
main = retain('main-current-raw.json', 'api', 'repos/yigini/soilfer-lims/git/ref/heads/main')
assert main['object']['sha'] == head
issue = retain('issue206-current-raw.json', 'api', 'repos/yigini/soilfer-lims/issues/206')
assert issue['state'] == 'open'
view = retain('closing-references-raw.json', 'pr', 'view', '295', '--repo', 'yigini/soilfer-lims', '--json', 'state,closingIssuesReferences,headRefOid')
assert view['state'] == 'MERGED' and view['closingIssuesReferences'] == [] and view['headRefOid'] == source
comments = retain('issue214-current-comments-raw.json', 'api', '--paginate', '--slurp', 'repos/yigini/soilfer-lims/issues/214/comments?per_page=100')
assert comments[-1][-1]['id'] == 6147255466, 'New scientific direction requires its own boundary.'
archive_bytes = command('gh', 'api', 'repos/yigini/soilfer-lims/actions/runs/38409200015/logs')
assert len(archive_bytes) < 64 * 1024 * 1024
(dest / 'logs-original.zip').write_bytes(archive_bytes)
archive = zipfile.ZipFile(io.BytesIO(archive_bytes))
entries = archive.infolist()
assert all(not e.is_dir() and e.file_size < 64 * 1024 * 1024 for e in entries)

def step_log(fragment):
    matches = [e for e in entries if fragment in e.filename]
    assert len(matches) == 1, [e.filename for e in matches]
    return archive.read(matches[0])

server = step_log('Run server test suite')
boundary = step_log('Run Real Disposable Docker Boundary Rehearsal')
readiness = step_log('Run Real Docker Deployment Readiness Acceptance')
for name, data in [('server-tests-original.log', server), ('docker-boundary-original.log', boundary), ('docker-readiness-original.log', readiness)]:
    (dest / name).write_bytes(data)
plain = re.sub(r'\x1b\[[0-9;]*m', '', server.decode('utf-8'))
suites = re.findall(r'Test Suites: [^\r\n]+', plain)
tests = re.findall(r'Tests: +[^\r\n]+', plain)
assert suites == ['Test Suites: 362 passed, 362 total'], suites
assert tests == ['Tests:       5508 passed, 5508 total'], tests
assert not re.search(r'\bFAIL tests/', plain)
passed = re.findall(r'\bPASS (tests/[^\r\n]*?\.test\.js)\b', plain)
manifest_bytes = command('git', 'show', audit + ':WP/backlog-resume-20261013/full-206-visible-completion/manifest.json')
inventory = json.loads(manifest_bytes)['suites']
expected = {p.replace('\\', '/').split('/server/', 1)[1] for p in inventory}
assert len(set(passed)) == 362 and set(passed) == expected
record = dict(observedUtc=datetime.datetime.now(datetime.UTC).isoformat(), status='COMPLETED_MAIN_CI_SUCCESS',
    run=38409200015, runAttempt=1, event='push', job=job['id'], actualMain=head, reviewedSource=source,
    tree=tree, completedUtc=job['completed_at'], exactJestSummary=suites + tests,
    passedSuites=362, passedTests=5508, failedOrSkippedOrPending=0, exactFullInventoryMatch=True,
    inventoryGitBlobSha256=hashlib.sha256(manifest_bytes).hexdigest(),
    requiredSteps={s['name']: s['conclusion'] for s in job['steps']},
    issue206State='open', closingIssuesReferences=[], issue214Questions=6147255466,
    actualIssue214Direction='PENDING', applicationChanges=0, productionOperations=0, retryDispatches=0,
    nativeBoundary='Fresh actual Claude LIMS Audit / Lab workflow audit and plan loaded; actual final PR295 PASS read. Both composers empty, human #103 See first / Approve now remains unanswered; no input to those cards.',
    nativeMergeAcknowledgementSent=False,
    archiveEntries=[dict(name=e.filename, bytes=e.file_size, sha256=hashlib.sha256(archive.read(e)).hexdigest()) for e in entries], files={})
for path in dest.iterdir():
    data = path.read_bytes()
    record['files'][path.name] = dict(bytes=len(data), sha256=hashlib.sha256(data).hexdigest())
(dest / 'index.json').write_bytes((json.dumps(record, indent=2) + '\n').encode('utf-8'))
checkpoint = ('## 2026-10-13 PR295 actual main CI completed PASS\n\n'
    'The one main push CI [38409200015](https://github.com/yigini/soilfer-lims/actions/runs/38409200015), attempt 1 at actual merged `' + head + '`, completed SUCCESS at ' + job['completed_at'] + '. '
    'Exact closed server summary: **Test Suites: 362 passed, 362 total** / **Tests:       5508 passed, 5508 total**. All 362 unique PASS paths equal the frozen inventory; zero failures/skips/pending. '
    'Client build, candidate and supported-baseline 48d0e52 actual Docker builds, and real disposable Docker boundary/readiness steps all succeeded. '
    'Closed originals, raw API/ZIP/server/boundary/readiness logs and every archive-entry hash are retained in `WP/backlog-resume-20261013/main-ci38409200015-completed-success/index.json`. '
    'Actual merged parents/tree remain equal to audited source; #206 stays OPEN for deployment and Claudio actual postcheck. No release/kit/gate or production operation. '
    '#214 questions6147255466 still await actual Claudio scientific/data-model direction; no application implementation. '
    'Fresh actual native LIMS Audit / Lab workflow audit and plan now loaded, with Claudio final PASS visible and both composers empty; human #103 clarification remains unanswered. Native merge/main-CI acknowledgement is not yet sent at retention time. '
    'Do not replay consumed CI, merge, notices, handoffs, release helpers or this new completed-result retainer.\n\n')
readmes = [root / 'WP/audit-release-eb6de2e8/README.md', root / 'WP/runtime-recovery-kobo/README.md']
for path in readmes:
    path.write_bytes(checkpoint.encode('utf-8') + path.read_bytes())
paths = [p.relative_to(root).as_posix() for p in dest.iterdir()] + [Path(__file__).relative_to(root).as_posix()] + [p.relative_to(root).as_posix() for p in readmes]
subprocess.check_call(['git', 'add', '-f', '--', *paths], cwd=root)
assert set(command('git', 'diff', '--cached', '--name-only').decode().splitlines()) == set(paths)
for name, detail in record['files'].items():
    assert hashlib.sha256(command('git', 'show', ':' + (dest / name).relative_to(root).as_posix())).hexdigest() == detail['sha256']
print(json.dumps({k:v for k,v in record.items() if k not in ('files', 'archiveEntries')}, indent=2))
