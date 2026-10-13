"""A new frozen full successor after closed fixture corrections; never replay."""
import datetime, hashlib, json, os, shutil, subprocess, sys, tempfile
from pathlib import Path
sys.stdout.reconfigure(encoding='utf-8')
root = Path(__file__).resolve().parents[2]
wp = Path(__file__).parent
server = root / 'server'
dest = wp / 'issue214-scanner-call-form-full'
assert (wp / 'issue214-scanner-caller-focused-failure/index.json').is_file()
assert not dest.exists() and not os.environ.get('NODE_OPTIONS')
paths = list(json.loads((wp / 'issue214-full-server-responsive/source-before.json').read_bytes()))
paths += ['server/tests/contracts/audit_2_3_compatibility_runs.test.js',
          'server/jest.config.js', 'server/package.json', 'server/tests/ownedSuiteSetup.js',
          'server/tests/setup.js', 'server/tests/globalTeardown.js',
          'WP/backlog-resume-20261013/visible-test-storage-206.setup.cjs']
env = dict(os.environ)
env['LIMS_OWNED_TEST_TEMPLATE'] = str(server / 'tests/.owned-templates/test_template_33522c62-1788-4298-8db6-06a0d4e5ff38.db')
dest.mkdir()
discovery = ['node', 'node_modules/jest/bin/jest.js', '--listTests', '--json', '--testMatch', '**/tests/**/*.test.js']
with (dest / 'inventory-original.json').open('wb') as out, (dest / 'inventory-stderr-original.log').open('wb') as err:
    discovered = subprocess.run(discovery, cwd=server, env=env, stdout=out, stderr=err)
assert discovered.returncode == 0
inventory = json.loads((dest / 'inventory-original.json').read_bytes())
previous = json.loads((wp / 'issue214-full-server-responsive/inventory-original.json').read_bytes())
assert len(inventory) == len(set(inventory)) == 365 and set(inventory) == set(previous)
paths += [Path(path).relative_to(root).as_posix() for path in inventory]
paths = sorted(set(paths))
before = {path: hashlib.sha256((root / path).read_bytes()).hexdigest() for path in paths}
(dest / 'source-before.json').write_bytes((json.dumps(before, indent=2) + '\n').encode())
visible = Path(tempfile.mkdtemp(prefix='lims214-full-owned-visible-'))
dist = visible / 'dist'
shutil.copytree(root / 'client/dist', dist)
originalAssets = {path.relative_to(root / 'client/dist').as_posix(): hashlib.sha256(path.read_bytes()).hexdigest()
                  for path in (root / 'client/dist').rglob('*') if path.is_file()}
visibleAssets = {path.relative_to(dist).as_posix(): hashlib.sha256(path.read_bytes()).hexdigest()
                 for path in dist.rglob('*') if path.is_file()}
assert originalAssets == visibleAssets
uploads = visible / 'uploads'
uploads.mkdir()
env['LIMS_VISIBLE_CLIENT_DIST'] = str(dist)
env['LIMS_VISIBLE_TEST_UPLOADS'] = str(uploads)
(dest / 'visible-local-storage.json').write_bytes((json.dumps({'root': str(visible), 'assetHashes': originalAssets,
    'disposableUploads': str(uploads), 'ordinaryAssertionsUnchanged': True,
    'localHiddenCheckoutFixtureOnly': True, 'productionOperations': 0}, indent=2) + '\n').encode())
args = ['--testMatch', '**/tests/**/*.test.js', '--setupFilesAfterEnv', str(server / 'tests/ownedSuiteSetup.js'),
        str(server / 'tests/setup.js'), str(wp / 'visible-test-storage-206.setup.cjs')]
configCommand = ['cmd.exe', '/d', '/c', 'npm.cmd', 'test', '--', *args, '--showConfig']
with (dest / 'config-original.json').open('wb') as out, (dest / 'config-stderr-original.log').open('wb') as err:
    configured = subprocess.run(configCommand, cwd=server, env=env, stdout=out, stderr=err)
assert configured.returncode == 0
configText = (dest / 'config-original.json').read_text(encoding='utf-8')
config = json.loads(configText[configText.index('{'):])
assert config['globalConfig']['maxWorkers'] == 1 and not config['globalConfig']['runInBand']
assert config['globalConfig']['workerIdleMemoryLimit'] == 512000000
assert config['configs'][0]['setupFilesAfterEnv'] == [str(server / 'tests/ownedSuiteSetup.js'), str(server / 'tests/setup.js'), str(wp / 'visible-test-storage-206.setup.cjs')]
command = ['cmd.exe', '/d', '/c', 'npm.cmd', 'test', '--', *args, '--json', '--outputFile', str(dest / 'report-original.json')]
(dest / 'command.json').write_bytes((json.dumps({'argv': command, 'nodeOptions': '',
    'ordinarySetupsAndAssertions': True, 'localVisiblePathFixtureOnly': True}, indent=2) + '\n').encode())
with (dest / 'stdout-original.log').open('wb') as out, (dest / 'stderr-original.log').open('wb') as err:
    result = subprocess.run(command, cwd=server, env=env, stdout=out, stderr=err)
(dest / 'exit-original.txt').write_bytes((str(result.returncode) + '\n').encode())
report = json.loads((dest / 'report-original.json').read_bytes()) if (dest / 'report-original.json').is_file() else {}
after = {path: hashlib.sha256((root / path).read_bytes()).hexdigest() for path in paths}
(dest / 'source-after.json').write_bytes((json.dumps(after, indent=2) + '\n').encode())
exactInventory = set(inventory) == {suite['name'] for suite in report.get('testResults', [])} and report.get('numTotalTestSuites') == len(inventory)
summary = {'observedUtc': datetime.datetime.now(datetime.UTC).isoformat(), 'exitCode': result.returncode,
    'status': 'PASS' if result.returncode == 0 and report.get('success') and before == after and exactInventory
        and report.get('numFailedTests') == report.get('numPendingTests') == report.get('numFailedTestSuites') == report.get('numPendingTestSuites') == 0 else 'FAILED_OR_INCOMPLETE',
    'suites': report.get('numTotalTestSuites'), 'tests': report.get('numTotalTests'),
    'passedSuites': report.get('numPassedTestSuites'), 'passedTests': report.get('numPassedTests'),
    'failed': report.get('numFailedTests'), 'pending': report.get('numPendingTests'),
    'failedSuites': report.get('numFailedTestSuites'), 'sourceUnchanged': before == after,
    'inventoryEqual': exactInventory, 'testWorkerCount': 1, 'workerIdleMemoryLimit': 512000000,
    'nodeOptions': '', 'ordinarySetupsAndAssertions': True, 'localVisiblePathFixtureOnly': True,
    'productionOperations': 0}
(dest / 'summary.json').write_bytes((json.dumps(summary, indent=2) + '\n').encode())
print(json.dumps(summary), flush=True)
for suite in report.get('testResults', []):
    for case in suite.get('assertionResults', []):
        if case['status'] == 'failed':
            print(json.dumps({'suite': suite['name'], 'test': case['fullName'], 'failure': case['failureMessages'][:1]}, ensure_ascii=False), flush=True)
assert summary['status'] == 'PASS'
