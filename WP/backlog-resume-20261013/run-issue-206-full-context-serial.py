"""Run every discovered Jest suite in bounded serial processes; never raise the heap."""
import datetime
import hashlib
import json
import os
import subprocess
import time
from pathlib import Path

root = Path(__file__).resolve().parents[2]
server = root / 'server'
evidence = Path(__file__).resolve().parent
destination = evidence / 'full-206-context-serial'
assert not destination.exists(), 'Preserve prior runs; do not overwrite or replay.'
destination.mkdir()
env = dict(os.environ)
env['LIMS_OWNED_TEST_TEMPLATE'] = str(server / 'tests/.owned-templates/test_template_33522c62-1788-4298-8db6-06a0d4e5ff38.db')
assert not env.get('NODE_OPTIONS'), 'Keep the existing default test heap; no override.'
source = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=root).decode().strip()
owned = json.loads((evidence / 'issue-206-context-review-ref.json').read_text())
hashes = {path: hashlib.sha256((root / path).read_bytes()).hexdigest() for path in owned['paths']}
command = ['node', '--expose-gc', 'node_modules/jest/bin/jest.js',
           '--testMatch', '**/tests/**/*.test.js', '--runInBand']
inventory = subprocess.run(command + ['--listTests', '--json'], cwd=server,
                           env=env, capture_output=True, check=True)
(destination / 'inventory.stdout.json').write_bytes(inventory.stdout)
(destination / 'inventory.stderr.log').write_bytes(inventory.stderr)
paths = sorted(json.loads(inventory.stdout))
assert paths and len(paths) == len(set(paths))
assert all(Path(path).is_relative_to(server / 'tests') and path.endswith('.test.js') for path in paths)
manifest = dict(source=source, reviewHead=owned['reviewHead'], startedUtc=datetime.datetime.now(datetime.UTC).isoformat(),
    suites=paths, suiteCount=len(paths), batchSize=12, sourceFileHashes=hashes,
    productionMutations=0, concurrentJestProcesses=1, nodeOptions=env.get('NODE_OPTIONS', ''))
(destination / 'manifest.json').write_bytes((json.dumps(manifest, indent=2) + '\n').encode())
print(f"Frozen inventory: {len(paths)} suites; one process at a time, 12 suites per batch.", flush=True)
results = []
executed = []
began = time.monotonic()
for index, offset in enumerate(range(0, len(paths), 12), 1):
    batch = paths[offset:offset + 12]
    report = destination / f'batch-{index:02}.json'
    log = destination / f'batch-{index:02}.log'
    started = time.monotonic()
    with log.open('xb') as stream:
        run = subprocess.run(command + ['--logHeapUsage', '--runTestsByPath', *batch,
            '--json', '--outputFile', str(report)], cwd=server, env=env, stdout=stream, stderr=subprocess.STDOUT)
    data = json.loads(report.read_bytes()) if report.exists() else {}
    actual = [item['name'] for item in data.get('testResults', [])]
    result = dict(batch=index, suites=batch, exitCode=run.returncode, elapsedSeconds=time.monotonic()-started,
        totalTests=data.get('numTotalTests'), passedTests=data.get('numPassedTests'), failedTests=data.get('numFailedTests'),
        pendingTests=data.get('numPendingTests'), success=data.get('success', False),
        inventoryEquality=sorted(actual) == sorted(batch), logSha256=hashlib.sha256(log.read_bytes()).hexdigest())
    results.append(result)
    (destination / 'progress.json').write_bytes((json.dumps(results, indent=2) + '\n').encode())
    print(json.dumps({key: result[key] for key in ['batch', 'exitCode', 'elapsedSeconds', 'passedTests', 'failedTests', 'pendingTests', 'inventoryEquality']}), flush=True)
    if run.returncode != 0 or not result['success'] or not result['inventoryEquality'] or result['failedTests']:
        raise SystemExit('Stopped at a failed/incomplete batch; preserve evidence and investigate.')
    executed.extend(actual)
    assert all(hashlib.sha256((root/path).read_bytes()).hexdigest() == digest for path,digest in hashes.items()), 'Source changed during the frozen run.'
assert sorted(executed) == paths and len(executed) == len(set(executed))
summary = dict(status='PASS', source=source, reviewHead=owned['reviewHead'], suiteCount=len(paths),
    totalTests=sum(item['totalTests'] for item in results), passedTests=sum(item['passedTests'] for item in results),
    failedTests=0, pendingTests=sum(item['pendingTests'] for item in results), batches=len(results),
    elapsedSeconds=time.monotonic()-began, finishedUtc=datetime.datetime.now(datetime.UTC).isoformat(),
    exactInventoryCoverage=True, frozenSourceUnchanged=True, productionMutations=0, nodeOptions='', batchesSerial=True)
(destination / 'summary.json').write_bytes((json.dumps(summary, indent=2) + '\n').encode())
print(json.dumps(summary, indent=2), flush=True)
