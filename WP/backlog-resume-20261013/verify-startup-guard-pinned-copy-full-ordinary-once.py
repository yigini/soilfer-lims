"""One frozen full ordinary server suite; no production operation or proof."""
import datetime,hashlib,json,os,pathlib,shutil,subprocess,tempfile
R=pathlib.Path(__file__).resolve().parents[2];S=R/'server';W=R/'WP/backlog-resume-20261013';D=R/'WP/startup-order-readiness-20261015/full-guard-pinned-copy-ordinary-once'
assert not D.exists() and not os.environ.get('NODE_OPTIONS')
focused=json.loads((R/'WP/startup-order-readiness-20261015/retained-copy-validation-focused-once/summary.json').read_bytes());assert focused['status']=='PASS' and focused['passed']==focused['tests']==167
frozen=json.loads((R/'WP/startup-order-readiness-20261015/retained-copy-validation-focused-once/source-after.json').read_bytes());assert all(hashlib.sha256((R/n).read_bytes()).hexdigest()==v for n,v in frozen.items())
D.mkdir();env=dict(os.environ);env['LIMS_OWNED_TEST_TEMPLATE']=str(S/'tests/.owned-templates/test_template_33522c62-1788-4298-8db6-06a0d4e5ff38.db');env['LIMS_OWNED_RETENTION_LEDGER']=str(D/'physical-retention-original.jsonl')
def run(argv,out,err):
 with (D/out).open('xb') as stdout,(D/err).open('xb') as stderr:return subprocess.run(argv,cwd=S,env=env,stdout=stdout,stderr=stderr)
assert run(['node','node_modules/jest/bin/jest.js','--listTests','--json','--testMatch','**/tests/**/*.test.js'],'inventory-original.json','inventory-stderr-original.log').returncode==0
inventory=json.loads((D/'inventory-original.json').read_bytes());assert len(inventory)==len(set(inventory))==373
oldInventory=json.loads((W/'issue209-full-classified-ordinary/inventory-original.json').read_bytes());newExpected={str(S/'tests/contracts'/n) for n in ['startup_readiness_context.test.js','startup_readiness_telemetry.test.js','order_revision_impact_set_query.test.js']};assert set(inventory)==set(oldInventory)|newExpected
tracked=subprocess.check_output(['git','ls-files','server','client','shared'],cwd=R).decode().splitlines()
paths={n for n in tracked if (R/n).is_file() and pathlib.Path(n).suffix in ['.js','.cjs','.jsx','.json','.css','.sql','.prisma','.txt'] and not any(p in ['node_modules','dist','uploads','.tmp'] for p in pathlib.Path(n).parts)}
paths.update(n for n in frozen if '/node_modules/' not in n)
paths.update(p.relative_to(R).as_posix() for folder in ['shared','server/prisma_client'] for p in (R/folder).rglob('*') if p.is_file() and p.suffix in ['.js','.cjs','.json','.prisma'])
paths.update(['.gitattributes','Dockerfile','docker-entrypoint.sh','server/utils/startupReadinessContext.js','WP/startup-order-readiness-20261015/local-owned-physical-retention.setup.cjs','WP/backlog-resume-20261013/visible-test-storage-206.setup.cjs','WP/backlog-resume-20261013/issue214-policy-owner-local-retention-teardown.cjs','server/tests/.owned-templates/test_template_33522c62-1788-4298-8db6-06a0d4e5ff38.db'])
mutable='server/data/help/RELEASE_MANIFEST_v1.json';assert mutable in paths;paths.remove(mutable);paths=sorted(paths)
before={n:hashlib.sha256((R/n).read_bytes()).hexdigest() for n in paths};(D/'source-before.json').write_text(json.dumps(before,indent=2),encoding='utf-8')
unchangedTests=json.loads((R/'WP/startup-order-readiness-20261015/closed-successor-original-test-hashes-unchanged.json').read_bytes());assert len(unchangedTests)==371 and all(before[n]==v for n,v in unchangedTests.items());(D/'existing-policy-chart-order-tests-unchanged.json').write_text(json.dumps(unchangedTests,indent=2),encoding='utf-8')
(D/'derived-help-manifest-before-original.json').write_bytes((R/mutable).read_bytes())
visible=pathlib.Path(tempfile.mkdtemp(prefix='lims-startup-context-full-owned-visible-'));dist=visible/'dist';uploads=visible/'uploads';shutil.copytree(R/'client/dist',dist);uploads.mkdir()
def assets(directory):return {p.relative_to(directory).as_posix():hashlib.sha256(p.read_bytes()).hexdigest() for p in directory.rglob('*') if p.is_file()}
assetHashes=assets(R/'client/dist');assert assetHashes==assets(dist);env['LIMS_VISIBLE_CLIENT_DIST']=str(dist);env['LIMS_VISIBLE_TEST_UPLOADS']=str(uploads)
(D/'visible-local-storage.json').write_text(json.dumps({'root':str(visible),'assetHashes':assetHashes,'disposableUploads':str(uploads),'byteIdenticalAssets':True,'ordinaryAssertionsUnchanged':True,'localHiddenCheckoutFixtureOnly':True,'productionOperations':0},indent=2),encoding='utf-8')
setups=[str(S/'tests/ownedSuiteSetup.js'),str(S/'tests/setup.js'),str(R/'WP/startup-order-readiness-20261015/local-owned-physical-retention.setup.cjs'),str(W/'visible-test-storage-206.setup.cjs')]
args=['--testMatch','**/tests/**/*.test.js','--setupFilesAfterEnv',*setups,'--globalTeardown',str(W/'issue214-policy-owner-local-retention-teardown.cjs')]
assert run(['cmd.exe','/d','/c','npm.cmd','test','--',*args,'--showConfig'],'config-original.json','config-stderr-original.log').returncode==0
txt=(D/'config-original.json').read_text(encoding='utf-8');cfg=json.loads(txt[txt.index('{'):]);assert cfg['globalConfig']['maxWorkers']==1 and cfg['globalConfig']['workerIdleMemoryLimit']==512000000 and not cfg['globalConfig']['runInBand'];assert cfg['configs'][0]['setupFilesAfterEnv']==setups
argv=['cmd.exe','/d','/c','npm.cmd','test','--',*args,'--json','--outputFile',str(D/'report-original.json')]
(D/'command.json').write_text(json.dumps({'argv':argv,'nodeOptions':'','bothOrdinarySetups':True,'stockAssertions':True,'localRetentionAndByteIdenticalVisiblePathFixturesOnly':True,'onlyDeclaredMutableOutput':mutable,'productionOperations':0},indent=2),encoding='utf-8')
(D/'open-metadata.json').write_text(json.dumps({'status':'RUNNING_METADATA_ONLY','startedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'inventory':373,'expectedTests':5679,'frozenPaths':len(paths),'sourceAudit':subprocess.check_output(['git','rev-parse','HEAD'],cwd=R).decode().strip(),'notCiOrRuntimeStartupQualification':True,'closedLogsExist':False,'productionOperations':0},indent=2),encoding='utf-8')
print(json.dumps({'status':'RUNNING_METADATA_ONLY','inventory':373,'expectedTests':5679,'frozenPaths':len(paths)}),flush=True)
result=run(argv,'stdout-original.log','stderr-original.log');(D/'exit-original.txt').write_text(str(result.returncode)+'\n',encoding='utf-8')
report=json.loads((D/'report-original.json').read_bytes()) if (D/'report-original.json').is_file() else {};after={n:hashlib.sha256((R/n).read_bytes()).hexdigest() for n in paths};(D/'source-after.json').write_text(json.dumps(after,indent=2),encoding='utf-8');(D/'derived-help-manifest-after-original.json').write_bytes((R/mutable).read_bytes())
actualInventory=[x['name'] for x in report.get('testResults',[])];exact=set(actualInventory)==set(inventory) and len(actualInventory)==len(inventory)
summary={'closedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'exitCode':result.returncode,'suites':report.get('numTotalTestSuites'),'tests':report.get('numTotalTests'),'passedSuites':report.get('numPassedTestSuites'),'passedTests':report.get('numPassedTests'),'failed':report.get('numFailedTests'),'pending':report.get('numPendingTests'),'sourceUnchanged':before==after,'exactInventory':exact,'visibleAssetsUnchanged':assetHashes==assets(R/'client/dist')==assets(dist),'expectedTests':5679,'bothOrdinarySetups':True,'onlyDeclaredMutableOutput':mutable,'declaredOutputCapturedBeforeAfter':True,'productionOperations':0}
summary['status']='PASS' if result.returncode==0 and report.get('success') and before==after and exact and summary['visibleAssetsUnchanged'] and report.get('numTotalTestSuites')==373 and report.get('numTotalTests')==report.get('numPassedTests')==5679 and all(report.get(k)==0 for k in ['numFailedTests','numPendingTests','numFailedTestSuites','numPendingTestSuites','numTodoTests']) else 'FAILED_OR_INCOMPLETE'
(D/'summary.json').write_text(json.dumps(summary,indent=2),encoding='utf-8');print(json.dumps(summary),flush=True)
for suite in report.get('testResults',[]):
 failed=[c['fullName'] for c in suite.get('assertionResults',[]) if c['status']=='failed']
 if failed:print(json.dumps({'suite':suite['name'],'failedTests':failed}),flush=True)
assert summary['status']=='PASS'
