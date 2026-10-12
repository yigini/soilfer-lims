"""Verify the completed unfiltered run, application bytes and protected originals."""
import datetime
import hashlib
import json
from pathlib import Path
import re
import subprocess

repo = Path(__file__).resolve().parents[2]
here = Path(__file__).resolve().parent
head = '5e65fe5b587747efc717f167f9b61469effa9afe'
base = '5dd5488d138514351fffd54d0b0232ae19fcb64d'

def git(*args):
    return subprocess.check_output(['git', *args], cwd=repo)

def digest(path):
    result = hashlib.sha256()
    with path.open('rb') as stream:
        while data := stream.read(1024 * 1024):
            result.update(data)
    return result.hexdigest()

def decoded(path):
    raw = path.read_bytes()
    return raw.decode('utf-16' if raw.startswith(b'\xff\xfe') else 'utf-8-sig')

log = here / 'native-workbench-full-5e65fe5b-sequential-1157.log'
result = log.with_name('native-workbench-full-5e65fe5b-sequential-1157.result.json')
value = json.loads(decoded(result))
assert value['success'] and value['numTotalTestSuites'] == value['numPassedTestSuites'] == 360
assert value['numTotalTests'] == value['numPassedTests'] == 5478
assert value['numFailedTestSuites'] == value['numFailedTests'] == value['numPendingTests'] == value['numTodoTests'] == 0
text = decoded(log)
assert len(re.findall(r'^PASS ', text, re.M)) == 360 and not re.findall(r'^FAIL ', text, re.M)
assert 'Test Suites: 360 passed, 360 total' in text and 'Tests:       5478 passed, 5478 total' in text
assert 'Time:        1522.451 s' in text and 'heap out of memory' not in text
actual = {str(repo / relative.replace('\\', '/')).casefold() for relative in
    subprocess.check_output(['rg', '--files', 'server/tests'], cwd=repo).decode().splitlines()
    if relative.endswith('.test.js')}
observed = {str(Path(row['name'])).casefold() for row in value['testResults']}
assert len(actual) == 360 and observed == actual
files = {}
for relative in git('diff', '--name-only', base, head).decode().splitlines():
    raw = git('show', head + ':' + relative)
    blob = git('hash-object', '--path=' + relative, relative).decode().strip()
    assert git('cat-file', 'blob', blob) == raw, relative
    files[relative] = hashlib.sha256(raw).hexdigest()
assert len(files) == 5
protected = []
for row in json.loads((here / 'before-protected-local-databases.json').read_bytes())['files']:
    path = Path(row['path'])
    item = {'path': str(path), 'bytes': path.stat().st_size, 'sha256': digest(path)}
    assert item['bytes'] == row['bytes'] and item['sha256'] == row['sha256'], str(path)
    protected.append(item)
assert len(protected) == 6
build = here / 'native-workbench-client-build-1223.log'
build_text = decoded(build)
assert 'built in' in build_text and 'error during build' not in build_text
record = {
    'verifiedUtc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'applicationHead': head, 'applicationTree': git('rev-parse', head + '^{tree}').decode().strip(),
    'applicationFiles': files, 'pr': 294, 'localSession': 38507, 'localSessionExitCode': 0,
    'status': 'FULL_LOCAL_UNFILTERED_360_SUITE_PASS',
    'passingSuites': 360, 'passingTests': 5478, 'failingSuites': 0, 'failingTests': 0,
    'pendingTests': 0, 'todoTests': 0, 'elapsedSeconds': 1522.451,
    'inventoryEqualsAllActualTestFiles': True,
    'normalHooksRetained': True, 'singleSequentialTestChild': True,
    'maxWorkers': 1, 'workerIdleMemoryLimitBytes': 512000000, 'heapLimitRaised': False,
    'applicationEditsDuringValidation': 0, 'concurrentJestOrSetup': False,
    'resultSha256': digest(result), 'logSha256': digest(log),
    'clientBuildSession': 54479, 'clientBuildExitCode': 0, 'clientBuildLogSha256': digest(build),
    'originalLocalDatabaseFilesUnchanged': protected,
    'earlierPartialRunsAggregated': False,
    'githubCiStatus': 'IN_PROGRESS', 'githubCiRunId': 38247731718,
    'formalApplicationAuditClaimed': False, 'productionMutations': 0,
}
with (here / 'pr294-full-pass-1224.json').open('x', encoding='utf-8', newline='\n') as stream:
    json.dump(record, stream, indent=2)
summary = (
    'PR294 full local validation checkpoint ' + record['verifiedUtc'] + ': unchanged application ' + head + '/tree ' + record['applicationTree'] + ', ONE authorized DRAFT PR294/five files/base5dd. SAME full session38507 completed exit0: ALL360/360 suites5478/5478tests0failure/pending/todo,1522.451s; saved result and actual executed file set equal all360 repository tests, normal hooks/single sequential child/maxWorkers1/512MB idle recycling/no heap raise/no application edits/concurrent Jest. Earlier partial runs were not aggregated; original79434 default-heap OOM remains INCOMPLETE/FAILED evidence. Client build session54479 completed exit0. All six original human/managed DB/WAL/SHM raw hashes and exact five application blobs remain unchanged. Raw full result/log/build and independently verified summary retained. Exact GitHub PR CI38247731718 remains IN_PROGRESS; DRAFT not ready/formally audited/merged until actual CI/Docker green and ready notice. Actual delegated one-time PR exception6124009441 retained; no further PR authorization. Proposed new forward source175Win/Linux remains unreviewed/unbound; no #200 build/proof/kit/gate/production action. Original FAILED105200/receipt511c and original5dd build92be/image5757 never replayed/retried; healthyold51f and all completedPR293 artifacts retained. Same writer continues exactCI/formalClaudit/new reviewed source/first proof/frozenkit/forwarddeploy chain.\n\nPrevious checkpoint follows:\n\n'
)
for relative in ['WP/audit-release-eb6de2e8/README.md', 'WP/runtime-recovery-kobo/README.md']:
    path = repo / relative
    path.write_text(summary + path.read_text(encoding='utf-8'), encoding='utf-8', newline='\n')
print(json.dumps({key: record[key] for key in ['verifiedUtc', 'status', 'passingSuites', 'passingTests',
    'elapsedSeconds', 'logSha256', 'resultSha256', 'clientBuildLogSha256']}))
