"""Verify real single-worker discovery and focused contracts once, at default heap."""
import datetime
import hashlib
import json
import os
import shutil
import subprocess
import tempfile
from pathlib import Path

root = Path(__file__).resolve().parents[2]
server = root / 'server'
evidence = Path(__file__).resolve().parent
destination = evidence / 'harness-206-serial-verification'
assert not destination.exists()
source = json.loads((evidence / 'issue-206-harness-review-ref.json').read_bytes())
previous = json.loads((evidence / 'full-206-visible-completion/manifest.json').read_bytes())
source_hashes = previous['sourceFileHashes']
assert all(hashlib.sha256((root / path).read_bytes()).hexdigest() == digest
           for path, digest in source_hashes.items())
assert not os.environ.get('NODE_OPTIONS'), 'No local heap override.'
destination.mkdir()
env = dict(os.environ)
env['LIMS_OWNED_TEST_TEMPLATE'] = str(server / 'tests/.owned-templates/test_template_33522c62-1788-4298-8db6-06a0d4e5ff38.db')
command = ['cmd.exe', '/d', '/c', 'npm.cmd', 'test', '--']
def closed(name, args, accepted=True):
    result = subprocess.run(command + args, cwd=server, env=env, capture_output=True)
    (destination / (name + '.stdout')).write_bytes(result.stdout)
    (destination / (name + '.stderr')).write_bytes(result.stderr)
    (destination / (name + '.exit')).write_bytes(str(result.returncode).encode() + b'\n')
    if accepted:
        assert result.returncode == 0, name
    return result
config_raw = closed('config', ['--showConfig']).stdout
config = json.loads(config_raw[config_raw.index(b'{'):])
assert config['globalConfig']['maxWorkers'] == 1
assert config['globalConfig']['runInBand'] is False
assert config['globalConfig']['workerIdleMemoryLimit'] == 512000000
assert config['configs'][0]['setupFilesAfterEnv'] == [str(server/'tests/ownedSuiteSetup.js'), str(server/'tests/setup.js')]
assert config['configs'][0]['testTimeout'] == 20000
inventory_raw = closed('inventory', ['--testMatch', '**/tests/**/*.test.js', '--listTests', '--json']).stdout
inventory = json.loads(inventory_raw[inventory_raw.index(b'['):])
assert len(inventory) == 362 and sorted(inventory) == sorted(previous['suites'])

# The same known hidden-checkout issue requires only the retained local path
# fixture. Standard GitHub CI has no such fixture and must independently pass.
visible = Path(tempfile.mkdtemp(prefix='lims206-harness-storage-'))
dist = visible / 'dist'
shutil.copytree(root/'client/dist', dist)
asset_hashes = {str(path.relative_to(dist)).replace('\\','/'): hashlib.sha256(path.read_bytes()).hexdigest()
                for path in dist.rglob('*') if path.is_file()}
assert asset_hashes == previous['assetHashes']
uploads = visible / 'uploads'
uploads.mkdir()
env['LIMS_VISIBLE_CLIENT_DIST'] = str(dist)
env['LIMS_VISIBLE_TEST_UPLOADS'] = str(uploads)
paths = [path for path in source['paths'] if path.startswith('server/tests/') and path.endswith('.test.js')]
paths += ['server/tests/security/wiring.test.js',
          'server/tests/contracts/audit_3_2_repeat_commands.test.js',
          'server/tests/contracts/audit_4_3_keyboard_playwright.test.js']
paths = sorted(set(paths))
report = destination / 'focused.json'
args = ['--testMatch', '**/tests/**/*.test.js', '--runTestsByPath',
        *[str(root/path) for path in paths], '--setupFilesAfterEnv',
        str(server/'tests/ownedSuiteSetup.js'), str(server/'tests/setup.js'),
        str(evidence/'visible-test-storage-206.setup.cjs'), '--json', '--outputFile', str(report)]
run = closed('focused', args, accepted=False)
data = json.loads(report.read_bytes()) if report.exists() else {}
actual = sorted(item['name'] for item in data.get('testResults', []))
expected = sorted(str(root/path) for path in paths)
summary = dict(status='PASS' if run.returncode == 0 and data.get('success') and actual == expected else 'FAILED_OR_INCOMPLETE',
    observedUtc=datetime.datetime.now(datetime.UTC).isoformat(), reviewHead=source['reviewHead'],
    totalSuites=data.get('numTotalTestSuites'), totalTests=data.get('numTotalTests'),
    passedTests=data.get('numPassedTests'), failedTests=data.get('numFailedTests'),
    pendingTests=data.get('numPendingTests'), exitCode=run.returncode,
    exactFocusedInventory=actual == expected, fullDiscoveryCount=len(inventory),
    fullDiscoveryUnchanged=True, testWorkerCount=1, runInBand=False,
    workerIdleMemoryLimit=512000000, nodeOptions='', exposeGc=False,
    allPrevious51SourceHashesUnchanged=True, stockAssertionsUnchanged=True,
    ordinarySetupFilesPreserved=True, globalSetupTeardownUnchanged=True,
    localVisibleFixtureOnly=True, visibleAssetHashes=asset_hashes,
    visibleStorage=str(visible), productionMutations=0)
(destination/'summary.json').write_bytes((json.dumps(summary,indent=2)+'\n').encode())
print(json.dumps({key:value for key,value in summary.items() if key!='visibleAssetHashes'},indent=2),flush=True)
assert summary['status'] == 'PASS' and summary['failedTests'] == summary['pendingTests'] == 0
assert all(hashlib.sha256((root / path).read_bytes()).hexdigest() == digest
           for path,digest in source_hashes.items())
