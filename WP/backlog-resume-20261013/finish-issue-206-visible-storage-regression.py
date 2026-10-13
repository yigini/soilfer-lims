"""Complete stock regression coverage on the unchanged head with visible test storage."""
import datetime, hashlib, json, os, shutil, subprocess, tempfile, time
from pathlib import Path
root=Path(__file__).resolve().parents[2]
evidence=Path(__file__).resolve().parent
server=root/'server'
old=evidence/'full-206-context-serial'
owned=evidence/'full-206-owned-completion'
destination=evidence/'full-206-visible-completion'
assert not destination.exists()
assert (evidence/'full-206-owned-completion-runner-exit.txt').read_text().strip()=='1'
manifest=json.loads((old/'manifest.json').read_bytes())
owned_manifest=json.loads((owned/'manifest.json').read_bytes())
assert owned_manifest['ordinarySetupFilesPreserved']
progress=json.loads((owned/'progress.json').read_bytes())
assert len(progress)==39 and progress[-1]['failedTests']==1
failed=json.loads((owned/'batch-39.json').read_bytes())
assert [Path(row['name']).name for row in failed['testResults'] if row['status']=='failed']==['spectral_multipart_upload.test.js']
digest=lambda file:hashlib.sha256(file.read_bytes()).hexdigest()
source=manifest['source']; review=manifest['reviewHead']
assert subprocess.check_output(['git','rev-parse','codex/issue-206-containers'],cwd=root).decode().strip()==review
assert all(digest(root/path)==value for path,value in manifest['sourceFileHashes'].items())
reports=progress[:38]
executed=[]
for row in reports:
    report=root/row['report']; data=json.loads(report.read_bytes())
    assert digest(report)==row['sha256'] and data['success'] and data['numFailedTests']==data['numPendingTests']==0
    assert row['source']==source and row['reviewHead']==review
    executed.extend(test['name'] for test in data['testResults'])
assert len(executed)==len(set(executed))==324
remaining=[path for path in manifest['suites'] if path not in set(executed)]
assert len(remaining)==38 and Path(remaining[0]).name=='spectral_multipart_upload.test.js'
closed=[]
for folder in ['full-206-context-serial','full-206-context-completion','full-206-owned-completion']:
    closed.extend(file for file in (evidence/folder).glob('*') if file.is_file())
for stem in ['full-206-context-serial','full-206-context-completion','full-206-owned-completion']:
    closed.extend(evidence/(stem+suffix) for suffix in ['-runner.log','-runner-exit.txt'])
preserved={str(file.relative_to(root)).replace('\\','/'):digest(file) for file in closed}
destination.mkdir()
fixture=Path(tempfile.mkdtemp(prefix='lims206-visible-storage-'))
assert not any(part.startswith('.') for part in fixture.parts)
visible=fixture/'dist'; uploads=fixture/'uploads'
shutil.copytree(root/'client/dist',visible); uploads.mkdir()
assets={str(file.relative_to(visible)).replace('\\','/'):digest(file) for file in visible.rglob('*') if file.is_file()}
assert assets and all(digest(root/'client/dist'/path)==value for path,value in assets.items())
new_manifest=dict(manifest,purpose='Complete all unchanged-head regression coverage; original attempts stay failed/incomplete',
    startedUtc=datetime.datetime.now(datetime.UTC).isoformat(),priorPassingReports=reports,
    priorClosedFileHashes=preserved,ordinarySetupFilesPreserved=True,remainingSuitesPerProcess=1,
    visibleFixture=str(fixture),assetHashes=assets,initialVisibleUploadsFiles=0,
    productionMutations=0,sourceChanged=False,stockAssertionsChanged=False)
(destination/'manifest.json').write_bytes((json.dumps(new_manifest,indent=2)+'\n').encode())
env=dict(os.environ); assert not env.get('NODE_OPTIONS')
env['LIMS_OWNED_TEST_TEMPLATE']=str(server/'tests/.owned-templates/test_template_33522c62-1788-4298-8db6-06a0d4e5ff38.db')
env['LIMS_VISIBLE_CLIENT_DIST']=str(visible); env['LIMS_VISIBLE_TEST_UPLOADS']=str(uploads)
command=['node','--expose-gc','node_modules/jest/bin/jest.js','--testMatch','**/tests/**/*.test.js','--runInBand']
setup=['--setupFilesAfterEnv',str(server/'tests/ownedSuiteSetup.js'),str(server/'tests/setup.js'),str(evidence/'visible-test-storage-206.setup.cjs')]
print('324 stock suites PASS on frozen source; completing remaining38 with full owned setup and visible test storage.',flush=True)
began=time.monotonic()
for group,path in enumerate(remaining,39):
    report=destination/f'group-{group:02}.json'; log=destination/f'group-{group:02}.log'
    with log.open('xb') as stream:
        run=subprocess.run(command+['--logHeapUsage','--runTestsByPath',path,'--json','--outputFile',str(report)]+setup,
            cwd=server,env=env,stdout=stream,stderr=subprocess.STDOUT)
    data=json.loads(report.read_bytes()) if report.exists() else {}
    actual=[test['name'] for test in data.get('testResults',[])]
    row=dict(batch=group,exitCode=run.returncode,totalTests=data.get('numTotalTests'),passedTests=data.get('numPassedTests'),
        failedTests=data.get('numFailedTests'),pendingTests=data.get('numPendingTests'),success=data.get('success',False),
        inventoryEquality=actual==[path],report=str(report.relative_to(root)).replace('\\','/'),
        sha256=digest(report) if report.exists() else None,logSha256=digest(log),source=source,reviewHead=review,
        ordinarySetupFilesPreserved=True,visibleTestStorage=True)
    reports.append(row)
    (destination/'progress.json').write_bytes((json.dumps(reports,indent=2)+'\n').encode())
    print(json.dumps({key:row[key] for key in ['batch','exitCode','passedTests','failedTests','inventoryEquality']}),flush=True)
    if run.returncode or not row['success'] or not row['inventoryEquality'] or row['failedTests'] or row['pendingTests']:
        raise SystemExit('Coverage completion stopped; preserve evidence and investigate.')
    executed.extend(actual)
    assert all(digest(root/path)==value for path,value in manifest['sourceFileHashes'].items())
    assert all(digest(root/path)==value for path,value in preserved.items())
assert sorted(executed)==sorted(manifest['suites']) and len(executed)==len(set(executed))
assert all(digest(root/'client/dist'/path)==digest(visible/path)==value for path,value in assets.items())
summary=dict(status='PASS',scope='ALL_FROZEN_SOURCE_REGRESSION_SUITE_COVERAGE',source=source,reviewHead=review,
    suiteCount=len(executed),totalTests=sum(row['totalTests'] for row in reports),passedTests=sum(row['passedTests'] for row in reports),
    failedTests=0,pendingTests=0,batches=len(reports),elapsedFinalCompletionSeconds=time.monotonic()-began,
    finishedUtc=datetime.datetime.now(datetime.UTC).isoformat(),priorRunStatuses={74560:'FAILED',26052:'INCOMPLETE',87152:'FAILED'},
    originalReportsUnchanged=True,reusedPassingSuites=324,exactInventoryCoverage=True,frozenSourceUnchanged=True,
    unchangedStockAssertions=True,ordinarySetupFilesPreserved=True,visibleByteIdenticalAssets=True,
    visibleDisposableUploads=True,productionMutations=0,nodeOptions='',batchesSerial=True)
(destination/'summary.json').write_bytes((json.dumps(summary,indent=2)+'\n').encode())
print(json.dumps(summary,indent=2),flush=True)
