"""Complete unchanged-head regression coverage after a hidden-path asset refusal.

The original run stays FAILED. Reuse only its source-pinned PASS reports;
rerun the entire failed batch with stock assertions and identical visible assets,
then execute every remaining suite. Never change application source or old logs.
"""
import datetime
import hashlib
import json
import os
import shutil
import subprocess
import tempfile
import time
from pathlib import Path

root = Path(__file__).resolve().parents[2]
evidence = Path(__file__).resolve().parent
server = root/'server'
prior = evidence/'full-206-context-serial'
destination = evidence/'full-206-owned-completion'
assert not destination.exists(), 'Preserve consumed validation runs; no replay.'
assert (evidence/'full-206-context-serial-runner-exit.txt').read_text().strip() == '1'
assert not (prior/'summary.json').exists()
manifest = json.loads((prior/'manifest.json').read_bytes())
progress = json.loads((prior/'progress.json').read_bytes())
assert len(progress) == 26 and all(row['success'] and row['exitCode'] == 0 for row in progress[:25])
assert progress[-1]['failedTests'] == 2 and progress[-1]['exitCode'] == 1
failed = json.loads((prior/'batch-26.json').read_bytes())
assert [Path(row['name']).name for row in failed['testResults'] if row['status']=='failed'] == ['reception_route_smoke.test.js']
review = subprocess.check_output(['git','rev-parse','codex/issue-206-containers'], cwd=root).decode().strip()
assert review == manifest['reviewHead']
hash_file = lambda file: hashlib.sha256(file.read_bytes()).hexdigest()
assert all(hash_file(root/path)==digest for path,digest in manifest['sourceFileHashes'].items())
old_hashes={str(file.relative_to(root)).replace('\\','/'):hash_file(file) for file in prior.glob('*') if file.is_file()}
for name in ['full-206-context-serial-runner.log','full-206-context-serial-runner-exit.txt']:
    old_hashes[str((evidence/name).relative_to(root)).replace('\\','/')]=hash_file(evidence/name)
destination.mkdir()
dist = root/'client/dist'
visible = Path(tempfile.mkdtemp(prefix='lims206-static-assets-'))/'dist'
assert not any(part.startswith('.') for part in visible.parts)
shutil.copytree(dist, visible)
asset_hashes={str(file.relative_to(dist)).replace('\\','/'):hash_file(file) for file in dist.rglob('*') if file.is_file()}
assert asset_hashes and all(hash_file(visible/path)==digest for path,digest in asset_hashes.items())
assets = dict(source=str(dist), visibleFixture=str(visible), bytesIdentical=True,
    fileCount=len(asset_hashes), sha256ByPath=asset_hashes, productionCopies=0, databaseCopies=0,
    preserved=True, cleanupPerformed=False)
(destination/'asset-fixture.json').write_bytes((json.dumps(assets,indent=2)+'\n').encode())
env=dict(os.environ)
assert not env.get('NODE_OPTIONS')
env['LIMS_OWNED_TEST_TEMPLATE']=str(server/'tests/.owned-templates/test_template_33522c62-1788-4298-8db6-06a0d4e5ff38.db')
command=['node','--expose-gc','node_modules/jest/bin/jest.js','--testMatch','**/tests/**/*.test.js','--runInBand']
paths=manifest['suites']
executed=[]
reports=[]
for row in progress[:25]:
    report=prior/f"batch-{row['batch']:02}.json"
    data=json.loads(report.read_bytes())
    actual=[test['name'] for test in data['testResults']]
    assert data['success'] and data['numFailedTests']==0 and data['numPendingTests']==0
    assert sorted(actual)==sorted(row['suites']) and hash_file(prior/f"batch-{row['batch']:02}.log")==row['logSha256']
    executed.extend(actual)
    reports.append(dict(report=str(report.relative_to(root)).replace('\\','/'),sha256=hash_file(report),
        totalTests=data['numTotalTests'],passedTests=data['numPassedTests'],failedTests=0,pendingTests=0,
        source=manifest['source'],reviewHead=review,sourceHashesVerifiedAtOriginalBoundary=True))
new_manifest=dict(manifest, startedUtc=datetime.datetime.now(datetime.UTC).isoformat(),
    purpose='Full frozen-head regression coverage; original run remains FAILED',
    originalFailedRun=74560, reusedPassingBatches=25, rerunFailedBatch=26, remainingSuitesPerProcess=1, ordinarySetupFilesPreserved=True,
    unchangedStockAssertions=True, sourceChanged=False, assetFixture=assets,
    priorClosedFileHashes=old_hashes, priorPassingReports=reports)
(destination/'manifest.json').write_bytes((json.dumps(new_manifest,indent=2)+'\n').encode())
print('Frozen source unchanged. Original failed run retained; rerun batch26 and execute all remaining suites.',flush=True)
started=time.monotonic()
groups=[paths[300:312]]+[[path] for path in paths[312:]]
for batch_number,batch in enumerate(groups,26):
    report=destination/f'batch-{batch_number:02}.json'
    log=destination/f'batch-{batch_number:02}.log'
    batch_env=dict(env)
    arguments=command+['--logHeapUsage','--runTestsByPath',*batch,'--json','--outputFile',str(report)]
    if batch_number==26:
        batch_env['LIMS_VISIBLE_CLIENT_DIST']=str(visible)
        arguments += ['--setupFilesAfterEnv',str(server/'tests/ownedSuiteSetup.js'),str(server/'tests/setup.js'),str(evidence/'visible-client-assets-206.setup.cjs')]
    began=time.monotonic()
    with log.open('xb') as stream:
        run=subprocess.run(arguments,cwd=server,env=batch_env,stdout=stream,stderr=subprocess.STDOUT)
    data=json.loads(report.read_bytes()) if report.exists() else {}
    actual=[test['name'] for test in data.get('testResults',[])]
    row=dict(batch=batch_number,exitCode=run.returncode,totalTests=data.get('numTotalTests'),
        passedTests=data.get('numPassedTests'),failedTests=data.get('numFailedTests'),pendingTests=data.get('numPendingTests'),
        success=data.get('success',False),inventoryEquality=sorted(actual)==sorted(batch),
        visibleAssetOverride=batch_number==26,elapsedSeconds=time.monotonic()-began,
        report=str(report.relative_to(root)).replace('\\','/'),sha256=hash_file(report) if report.exists() else None,
        logSha256=hash_file(log),source=manifest['source'],reviewHead=review)
    reports.append(row)
    (destination/'progress.json').write_bytes((json.dumps(reports,indent=2)+'\n').encode())
    print(json.dumps({key:row[key] for key in ['batch','exitCode','passedTests','failedTests','inventoryEquality','visibleAssetOverride']}),flush=True)
    if run.returncode or not row['success'] or not row['inventoryEquality'] or row['failedTests'] or row['pendingTests']:
        raise SystemExit('Completion stopped; preserve failed evidence and investigate.')
    executed.extend(actual)
    assert all(hash_file(root/path)==digest for path,digest in manifest['sourceFileHashes'].items())
    assert all(hash_file(root/path)==digest for path,digest in old_hashes.items())
assert sorted(executed)==sorted(paths) and len(executed)==len(set(executed))
assert all(hash_file(dist/path)==hash_file(visible/path)==digest for path,digest in asset_hashes.items())
summary=dict(status='PASS',scope='ALL_FROZEN_SOURCE_REGRESSION_SUITE_COVERAGE',source=manifest['source'],
    reviewHead=review,suiteCount=len(paths),totalTests=sum(row['totalTests'] for row in reports),
    passedTests=sum(row['passedTests'] for row in reports),failedTests=0,pendingTests=0,batches=len(reports),
    elapsedCompletionSeconds=time.monotonic()-started,finishedUtc=datetime.datetime.now(datetime.UTC).isoformat(),
    originalRunStatus='FAILED',originalRun=74560, incompleteCompletionRun=26052, ordinarySetupFilesPreserved=True, remainingSuitesPerProcess=1,originalReportsUnchanged=True,reusedPassingBatches=25,
    exactInventoryCoverage=True,frozenSourceUnchanged=True,unchangedStockAssertions=True,
    visibleIdenticalAssetsOnlyForBatch26=True,productionMutations=0,nodeOptions='',batchesSerial=True)
(destination/'summary.json').write_bytes((json.dumps(summary,indent=2)+'\n').encode())
print(json.dumps(summary,indent=2),flush=True)
