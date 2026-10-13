"""Retain this closed CI failure once; never retry or change application files."""
import datetime
import hashlib
import io
import json
import re
import subprocess
import zipfile
from pathlib import Path

root = Path(__file__).resolve().parents[2]
destination = Path(__file__).resolve().parent / 'ci-38393187129-completed-failure'
assert not destination.exists(), 'This closed boundary has already been retained.'

def gh(*args):
    return subprocess.check_output(['gh', *args], cwd=root)

run_bytes = gh('api', 'repos/yigini/soilfer-lims/actions/runs/38393187129')
jobs_bytes = gh('api', 'repos/yigini/soilfer-lims/actions/runs/38393187129/jobs?per_page=100')
pr_bytes = gh('pr', 'view', '295', '--repo', 'yigini/soilfer-lims', '--json',
              'number,url,state,headRefOid,baseRefOid,closingIssuesReferences,comments,labels')
run, jobs, pr = map(json.loads, (run_bytes, jobs_bytes, pr_bytes))
head = '9ae02f6ab7651d2ca887a98722f6a20ace3cc471'
assert run['status'] == 'completed' and run['conclusion'] == 'failure'
assert run['head_sha'] == pr['headRefOid'] == head
assert pr['state'] == 'OPEN' and pr['closingIssuesReferences'] == []
assert len(jobs['jobs']) == 1 and jobs['jobs'][0]['id'] == 115281767821
assert jobs['jobs'][0]['status'] == 'completed'
assert subprocess.check_output(['git', 'branch', '--show-current'], cwd=root).strip() == b'audit/release-eb6de2e8'
assert not subprocess.check_output(['git', 'diff', '--cached', '--name-only'], cwd=root).strip()

archive_bytes = gh('api', 'repos/yigini/soilfer-lims/actions/runs/38393187129/logs')
assert len(archive_bytes) < 64 * 1024 * 1024
archive = zipfile.ZipFile(io.BytesIO(archive_bytes))
entries = archive.infolist()
assert all(not entry.is_dir() for entry in entries)
server_entries = [entry for entry in entries if 'Run server test suite' in entry.filename]
assert len(server_entries) == 1, [entry.filename for entry in entries]
server_log = archive.read(server_entries[0])
server_text = server_log.decode('utf-8')
plain = re.sub(r'\x1b\[[0-9;]*m', '', server_text)
passed = re.findall(r'\bPASS (tests/[^\r\n]*?\.test\.js)\b', plain)
failed = re.findall(r'\bFAIL (tests/[^\r\n]*?\.test\.js)\b', plain)
assert 'JavaScript heap out of memory' in plain and 'exit code 134' in plain
record = dict(
    observedUtc=datetime.datetime.now(datetime.UTC).isoformat(),
    status='FAILED_INCOMPLETE_HEAP_EXHAUSTION', run=38393187129,
    runAttempt=run['run_attempt'], job=115281767821, reviewHead=head,
    base=pr['baseRefOid'], completedUtc=jobs['jobs'][0]['completed_at'],
    exitCode=134, passedSuites=len(set(passed)), failedSuiteHeaders=failed,
    fullSuitePass=False, localCoverageCommit='c56414a5148cb2b17547680a55550d66c9a1b013',
    requiredDockerSteps={step['name']: step['conclusion'] for step in jobs['jobs'][0]['steps']
                         if 'Docker' in step['name']},
    productionMutations=0, retryDispatches=0, readyForAudit=False,
    nativeFinalHandoff=False, actualClaudioFinalVerdict='NOT YET',
    archiveEntries=[dict(name=entry.filename, bytes=entry.file_size,
                         sha256=hashlib.sha256(archive.read(entry)).hexdigest()) for entry in entries],
    files={})
destination.mkdir()
for name, data in [('run-raw.json', run_bytes), ('jobs-raw.json', jobs_bytes),
                   ('pr-raw.json', pr_bytes), ('logs-original.zip', archive_bytes),
                   ('server-tests-original.log', server_log)]:
    (destination / name).write_bytes(data)
    record['files'][name] = dict(bytes=len(data), sha256=hashlib.sha256(data).hexdigest())
(destination / 'index.json').write_bytes((json.dumps(record, indent=2) + '\n').encode())
paths = [str(path.relative_to(root)).replace('\\', '/') for path in destination.iterdir()]
paths.append(str(Path(__file__).relative_to(root)).replace('\\', '/'))
subprocess.check_call(['git', 'add', '-f', '--', *paths], cwd=root)
for name, pin in record['files'].items():
    relative = str((destination / name).relative_to(root)).replace('\\', '/')
    blob = subprocess.check_output(['git', 'show', ':' + relative], cwd=root)
    assert hashlib.sha256(blob).hexdigest() == pin['sha256']
assert set(subprocess.check_output(['git', 'diff', '--cached', '--name-only'], cwd=root).decode().splitlines()) == set(paths)
print(json.dumps({key: value for key, value in record.items() if key not in ('files', 'archiveEntries')}, indent=2))
