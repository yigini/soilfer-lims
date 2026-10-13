"""Retain the completed exact-head CI once, without dispatching or replaying it."""
import datetime
import hashlib
import io
import json
import re
import subprocess
import zipfile
from pathlib import Path

root = Path(__file__).resolve().parents[2]
destination = Path(__file__).resolve().parent / 'ci-38400174689-completed-success'
head = '1a0702b3be410ac1dcdd9dc92f0f0c3dd2774a3a'
prior = '9ae02f6ab7651d2ca887a98722f6a20ace3cc471'
base = '959d17e11c357266f7c2a41b0c84ab76914c591e'
assert not destination.exists(), 'Completed boundary already retained; never replay.'

def command(*args):
    return subprocess.check_output(args, cwd=root)

def gh(*args):
    return command('gh', *args)

assert command('git', 'branch', '--show-current').strip() == b'audit/release-eb6de2e8'
assert not command('git', 'diff', '--cached', '--name-only').strip()
assert command('git', 'diff', '--name-only', prior, head).decode().splitlines() == ['server/package.json']
changed_paths = command('git', 'diff', '--name-only', base, head).decode().splitlines()
assert len(changed_paths) == 52 and not any(p.startswith('WP/') for p in changed_paths)
prior_paths = command('git', 'diff', '--name-only', base, prior).decode().splitlines()
assert len(prior_paths) == 51
assert all(command('git', 'show', prior + ':' + p) == command('git', 'show', head + ':' + p) for p in prior_paths)
assert command('git', 'show', head + ':server/app.js') == command('git', 'show', base + ':server/app.js')
run_bytes = gh('api', 'repos/yigini/soilfer-lims/actions/runs/38400174689')
jobs_bytes = gh('api', 'repos/yigini/soilfer-lims/actions/runs/38400174689/jobs?per_page=100')
pr_bytes = gh('pr', 'view', '295', '--repo', 'yigini/soilfer-lims', '--json',
              'number,url,state,headRefOid,baseRefOid,closingIssuesReferences,comments,labels,body')
run, jobs, pr = map(json.loads, (run_bytes, jobs_bytes, pr_bytes))
assert run['status'] == 'completed' and run['conclusion'] == 'success' and run['run_attempt'] == 1
assert run['head_sha'] == pr['headRefOid'] == head
assert pr['baseRefOid'] == base and pr['state'] == 'OPEN' and pr['closingIssuesReferences'] == []
assert len(jobs['jobs']) == 1
job = jobs['jobs'][0]
assert job['id'] == 115305465789 and job['status'] == 'completed' and job['conclusion'] == 'success'
assert all(s['status'] == 'completed' and s['conclusion'] == 'success' for s in job['steps'])
archive_bytes = gh('api', 'repos/yigini/soilfer-lims/actions/runs/38400174689/logs')
assert len(archive_bytes) < 64 * 1024 * 1024
archive = zipfile.ZipFile(io.BytesIO(archive_bytes))
entries = archive.infolist()
assert all(not e.is_dir() and e.file_size < 64 * 1024 * 1024 for e in entries)

def step_log(fragment):
    matching = [e for e in entries if fragment in e.filename]
    assert len(matching) == 1, [e.filename for e in matching]
    return archive.read(matching[0])

server_log = step_log('Run server test suite')
plain = re.sub(r'\x1b\[[0-9;]*m', '', server_log.decode('utf-8'))
suite_summary = re.findall(r'Test Suites: [^\r\n]+', plain)
test_summary = re.findall(r'Tests: +[^\r\n]+', plain)
assert suite_summary == ['Test Suites: 362 passed, 362 total'], suite_summary
assert test_summary == ['Tests:       5508 passed, 5508 total'], test_summary
assert not re.search(r'\bFAIL tests/', plain)
passed = re.findall(r'\bPASS (tests/[^\r\n]*?\.test\.js)\b', plain)
inventory = json.loads((destination.parent / 'full-206-visible-completion/manifest.json').read_text(encoding='utf-8'))['suites']
expected = {p.replace('\\', '/').split('/server/', 1)[1] for p in inventory}
assert len(set(passed)) == 362 and set(passed) == expected
boundary = step_log('Run Real Disposable Docker Boundary Rehearsal')
readiness = step_log('Run Real Docker Deployment Readiness Acceptance')
record = dict(
    observedUtc=datetime.datetime.now(datetime.UTC).isoformat(), status='COMPLETED_SUCCESS',
    run=38400174689, runAttempt=1, job=job['id'], reviewHead=head, base=base,
    completedUtc=job['completed_at'], exactJestSummary=suite_summary + test_summary,
    passedSuites=362, passedTests=5508, failedOrSkippedOrPending=0,
    exactFullInventoryMatch=True, sourcePaths=changed_paths, prior51SourcePathsUnchanged=True,
    sourceOnlySuccessorDelta=['server/package.json'], appJsEqualsMain=True,
    requiredSteps={s['name']: s['conclusion'] for s in job['steps']},
    localCoverageCommit='c56414a5148cb2b17547680a55550d66c9a1b013',
    actualScopeComment=6145765510, failedPriorRun=38393187129,
    productionMutations=0, retryDispatches=0, readyForAudit=False,
    nativeFinalHandoff=False, actualClaudioFinalVerdict='NOT YET',
    archiveEntries=[dict(name=e.filename, bytes=e.file_size,
                         sha256=hashlib.sha256(archive.read(e)).hexdigest()) for e in entries], files={})
destination.mkdir()
files = [('run-raw.json', run_bytes), ('jobs-raw.json', jobs_bytes), ('pr-raw.json', pr_bytes),
         ('logs-original.zip', archive_bytes), ('server-tests-original.log', server_log),
         ('docker-boundary-original.log', boundary), ('docker-readiness-original.log', readiness)]
for name, data in files:
    (destination / name).write_bytes(data)
    record['files'][name] = dict(bytes=len(data), sha256=hashlib.sha256(data).hexdigest())
(destination / 'index.json').write_bytes((json.dumps(record, indent=2) + '\n').encode('utf-8'))
paths = [str(p.relative_to(root)).replace('\\', '/') for p in destination.iterdir()]
paths.append(str(Path(__file__).relative_to(root)).replace('\\', '/'))
subprocess.check_call(['git', 'add', '-f', '--', *paths], cwd=root)
for name, pin in record['files'].items():
    relative = str((destination / name).relative_to(root)).replace('\\', '/')
    assert hashlib.sha256(command('git', 'show', ':' + relative)).hexdigest() == pin['sha256']
assert set(command('git', 'diff', '--cached', '--name-only').decode().splitlines()) == set(paths)
print(json.dumps({k:v for k,v in record.items() if k not in ('files','archiveEntries','sourcePaths')}, indent=2))
