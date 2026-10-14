"""One full frozen ordinary verification after the actual focused companion pass."""
import datetime,hashlib,json,os,shutil,subprocess,sys,tempfile
from pathlib import Path
sys.stdout.reconfigure(encoding='utf8')
root=Path(__file__).resolve().parents[2];wp=Path(__file__).parent;server=root/'server'
dest=wp/'issue209-full-ordinary-companion'
assert not dest.exists() and not os.environ.get('NODE_OPTIONS')
focused=json.loads((wp/'issue209-texture-current-context-regression/index.json').read_bytes())
assert focused['summary']['status']=='PASS' and focused['summary']['tests']==248 and focused['summary']['failed']==0
assert (wp/'issue209-fraction-decisions-6166518424/index.json').exists()
tracked=subprocess.run(['git','ls-files','server','client'],cwd=root,capture_output=True,check=True).stdout.decode().splitlines()
paths={path for path in tracked if (root/path).is_file() and Path(path).suffix in ['.js','.cjs','.jsx','.json','.css','.sql','.prisma']
       and not any(part in ['node_modules','prisma_client','dist','uploads','.tmp'] for part in Path(path).parts)}
paths.update(focused['sourceDraftPaths'])
paths.update(['.gitattributes','Dockerfile','docker-entrypoint.sh','docs/audit/209-order-revisions.md',
 'WP/backlog-resume-20261013/issue209-local-owned-physical-retention.cjs',
 'WP/backlog-resume-20261013/visible-test-storage-206.setup.cjs',
 'WP/backlog-resume-20261013/issue214-policy-owner-local-retention-teardown.cjs',
 'server/tests/.owned-templates/test_template_33522c62-1788-4298-8db6-06a0d4e5ff38.db'])
dest.mkdir();env=dict(os.environ)
env['LIMS_OWNED_TEST_TEMPLATE']=str(server/'tests/.owned-templates/test_template_33522c62-1788-4298-8db6-06a0d4e5ff38.db')
env['LIMS_OWNED_RETENTION_LEDGER']=str(dest/'physical-retention-original.jsonl')
def run(command,stdout,stderr):
 with (dest/stdout).open('wb') as out,(dest/stderr).open('wb') as err:
  return subprocess.run(command,cwd=server,env=env,stdout=out,stderr=err)
assert run(['node','node_modules/jest/bin/jest.js','--listTests','--json','--testMatch','**/tests/**/*.test.js'],'inventory-original.json','inventory-stderr-original.log').returncode==0
inventory=json.loads((dest/'inventory-original.json').read_bytes())
assert len(inventory)==len(set(inventory))==370
assert set(inventory)==set(json.loads((wp/'issue209-texture-current-context-regression/inventory-original.json').read_bytes()))
paths.update(Path(path).relative_to(root).as_posix() for path in inventory)
paths=sorted(paths)
before={path:hashlib.sha256((root/path).read_bytes()).hexdigest() for path in paths}
(dest/'source-before.json').write_bytes((json.dumps(before,indent=2)+'\n').encode())
visible=Path(tempfile.mkdtemp(prefix='lims209-full-owned-visible-'));dist=visible/'dist';uploads=visible/'uploads'
shutil.copytree(root/'client/dist',dist);uploads.mkdir()
def assets(directory):return {p.relative_to(directory).as_posix():hashlib.sha256(p.read_bytes()).hexdigest() for p in directory.rglob('*') if p.is_file()}
original_assets=assets(root/'client/dist');assert original_assets==assets(dist)
env['LIMS_VISIBLE_CLIENT_DIST']=str(dist);env['LIMS_VISIBLE_TEST_UPLOADS']=str(uploads)
(dest/'visible-local-storage.json').write_bytes((json.dumps({'root':str(visible),'assetHashes':original_assets,'disposableUploads':str(uploads),
 'ordinaryAssertionsUnchanged':True,'localHiddenCheckoutFixtureOnly':True,'productionOperations':0},indent=2)+'\n').encode())
setups=[str(server/'tests/ownedSuiteSetup.js'),str(server/'tests/setup.js'),str(wp/'issue209-local-owned-physical-retention.cjs'),str(wp/'visible-test-storage-206.setup.cjs')]
args=['--testMatch','**/tests/**/*.test.js','--setupFilesAfterEnv',*setups,'--globalTeardown',str(wp/'issue214-policy-owner-local-retention-teardown.cjs')]
assert run(['cmd.exe','/d','/c','npm.cmd','test','--',*args,'--showConfig'],'config-original.json','config-stderr-original.log').returncode==0
cfg_text=(dest/'config-original.json').read_text(encoding='utf8');cfg=json.loads(cfg_text[cfg_text.index('{'):])
assert cfg['globalConfig']['maxWorkers']==1 and not cfg['globalConfig']['runInBand'] and cfg['globalConfig']['workerIdleMemoryLimit']==512000000
assert cfg['configs'][0]['setupFilesAfterEnv']==setups
argv=['cmd.exe','/d','/c','npm.cmd','test','--',*args,'--json','--outputFile',str(dest/'report-original.json')]
(dest/'command.json').write_bytes((json.dumps({'argv':argv,'nodeOptions':'','bothOrdinarySetups':True,'stockAssertions':True,
 'localRetentionTeardownOnly':True,'localByteIdenticalVisibleAssets':True,'productionOperations':0},indent=2)+'\n').encode())
(dest/'open-metadata.json').write_bytes((json.dumps({'startedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'status':'RUNNING_METADATA_ONLY',
 'inventory':370,'frozenInputCount':len(paths),'sourceAudit':subprocess.run(['git','rev-parse','HEAD'],cwd=root,capture_output=True,check=True).stdout.decode().strip(),
 'expectedTests':5630,'closedLogsExist':False,'productionOperations':0},indent=2)+'\n').encode())
print(json.dumps({'status':'RUNNING_METADATA_ONLY','inventory':370,'frozenInputs':len(paths),'expectedTests':5630}),flush=True)
result=run(argv,'stdout-original.log','stderr-original.log');(dest/'exit-original.txt').write_bytes((str(result.returncode)+'\n').encode())
report=json.loads((dest/'report-original.json').read_bytes()) if (dest/'report-original.json').exists() else {}
after={path:hashlib.sha256((root/path).read_bytes()).hexdigest() for path in paths};(dest/'source-after.json').write_bytes((json.dumps(after,indent=2)+'\n').encode())
exact_inventory=set(s['name'] for s in report.get('testResults',[]))==set(inventory) and report.get('numTotalTestSuites')==370
summary={'closedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'exit':result.returncode,'suites':report.get('numTotalTestSuites'),
 'tests':report.get('numTotalTests'),'passedSuites':report.get('numPassedTestSuites'),'passedTests':report.get('numPassedTests'),
 'failed':report.get('numFailedTests'),'failedSuites':report.get('numFailedTestSuites'),'pending':report.get('numPendingTests'),'todo':report.get('numTodoTests'),
 'sourceUnchanged':before==after,'selectedInventoryEqual':exact_inventory,'fullDiscovery':370,'ordinarySetups':True,
 'workerIdleMemoryLimit':512000000,'visibleAssetsUnchanged':original_assets==assets(root/'client/dist')==assets(dist),'productionOperations':0}
summary['status']=('PASS' if result.returncode==0 and report.get('success') and before==after and exact_inventory and summary['visibleAssetsUnchanged']
 and report.get('numTotalTests')==report.get('numPassedTests')==5630
 and all(report.get(k)==0 for k in ['numFailedTests','numPendingTests','numFailedTestSuites','numPendingTestSuites','numTodoTests']) else 'FAILED_OR_INCOMPLETE')
(dest/'summary.json').write_bytes((json.dumps(summary,indent=2)+'\n').encode());print(json.dumps(summary),flush=True)
for suite in report.get('testResults',[]):
 failed=[case['fullName'] for case in suite.get('assertionResults',[]) if case['status']=='failed']
 if failed:print(json.dumps({'suite':suite['name'],'failedTests':failed}),flush=True)
assert summary['status']=='PASS'
