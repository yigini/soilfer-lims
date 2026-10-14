"""One fresh ordinary focused run for actual PR297 audit corrections; never replay."""
import datetime,hashlib,json,os,shutil,subprocess,sys,tempfile
from pathlib import Path
sys.stdout.reconfigure(encoding='utf8')
root=Path(__file__).resolve().parents[2];wp=Path(__file__).parent;server=root/'server';dest=wp/'issue209-pr297-impact-audit-correction-focused-spelling'
assert not dest.exists() and not os.environ.get('NODE_OPTIONS')
ledger=json.loads((wp/'issue209-original-case-reconciliation-650/case-ledger.json').read_bytes())
assert ledger['originalFailedAssertions']==ledger['resolvedAssertionOccurrences']==650 and ledger['unresolvedAssertionOccurrences']==0
focused=json.loads((wp/'issue209-exchange-spectral-context-singles/index.json').read_bytes())
assert focused['summary']['status']=='PASS' and focused['summary']['closedTests']==353 and len(focused['sourceDraftPaths'])==122
for decision in ['issue209-actual-decisions-6163271808','issue209-fraction-decisions-6166518424','issue209-approved-orphan-decisions-6167740581','issue209-keyed-receipt-decisions-6169628053']:
 assert (wp/decision/'index.json').exists()
tracked=subprocess.run(['git','ls-files','server','client','shared'],cwd=root,capture_output=True,check=True).stdout.decode().splitlines()
paths={p for p in tracked if (root/p).is_file() and Path(p).suffix in ['.js','.cjs','.jsx','.json','.css','.sql','.prisma'] and not any(part in ['node_modules','dist','uploads','.tmp'] for part in Path(p).parts)}
paths.update(p.relative_to(root).as_posix() for d in ['shared','server/prisma_client'] for p in (root/d).rglob('*') if p.is_file() and p.suffix in ['.js','.cjs','.json','.prisma'])
paths.update(focused['sourceDraftPaths'])
paths.update(['.gitattributes','Dockerfile','docker-entrypoint.sh','docs/audit/209-order-revisions.md',
 'WP/backlog-resume-20261013/issue209-local-owned-physical-retention-spectral-finalizer.cjs',
 'WP/backlog-resume-20261013/visible-test-storage-206.setup.cjs',
 'WP/backlog-resume-20261013/issue214-policy-owner-local-retention-teardown.cjs',
 'server/tests/.owned-templates/test_template_33522c62-1788-4298-8db6-06a0d4e5ff38.db'])
mutable='server/data/help/RELEASE_MANIFEST_v1.json';assert mutable in paths;paths.remove(mutable)
dest.mkdir();env=dict(os.environ)
env['LIMS_OWNED_TEST_TEMPLATE']=str(server/'tests/.owned-templates/test_template_33522c62-1788-4298-8db6-06a0d4e5ff38.db')
env['LIMS_OWNED_RETENTION_LEDGER']=str(dest/'physical-retention-original.jsonl')
def run(command,stdout,stderr):
 with (dest/stdout).open('wb') as out,(dest/stderr).open('wb') as err:return subprocess.run(command,cwd=server,env=env,stdout=out,stderr=err)
assert run(['node','node_modules/jest/bin/jest.js','--listTests','--json','--testMatch','**/tests/**/*.test.js'],'inventory-original.json','inventory-stderr-original.log').returncode==0
inventory=json.loads((dest/'inventory-original.json').read_bytes());assert len(inventory)==len(set(inventory))==370
assert set(inventory)==set(json.loads((wp/'issue209-full-ordinary-companion/inventory-original.json').read_bytes()))
paths.update(Path(p).relative_to(root).as_posix() for p in inventory);paths=sorted(paths);assert mutable not in paths
before={p:hashlib.sha256((root/p).read_bytes()).hexdigest() for p in paths}
(dest/'source-before.json').write_bytes((json.dumps(before,indent=2)+'\n').encode())
mutableBefore=(root/mutable).read_bytes();(dest/'derived-help-manifest-before-original.json').write_bytes(mutableBefore)
outputPolicy={'onlyDeclaredMutableOutput':mutable,'beforeBytes':len(mutableBefore),'beforeSha256':hashlib.sha256(mutableBefore).hexdigest(),'beforeOriginalCaptured':True,'sourceFrozenSeparately':True,'stockHelpAssertionsUnchanged':True,'oldFailedRunSummaryUnchanged':True}
(dest/'derived-output-policy-open.json').write_bytes((json.dumps(outputPolicy,indent=2)+'\n').encode())
visible=Path(tempfile.mkdtemp(prefix='lims297-impact-owned-visible-'));dist=visible/'dist';uploads=visible/'uploads';shutil.copytree(root/'client/dist',dist);uploads.mkdir()
def assets(d):return {p.relative_to(d).as_posix():hashlib.sha256(p.read_bytes()).hexdigest() for p in d.rglob('*') if p.is_file()}
originalAssets=assets(root/'client/dist');assert originalAssets==assets(dist)
env['LIMS_VISIBLE_CLIENT_DIST']=str(dist);env['LIMS_VISIBLE_TEST_UPLOADS']=str(uploads)
(dest/'visible-local-storage.json').write_bytes((json.dumps({'root':str(visible),'assetHashes':originalAssets,'disposableUploads':str(uploads),'ordinaryAssertionsUnchanged':True,'localHiddenCheckoutFixtureOnly':True,'productionOperations':0},indent=2)+'\n').encode())
setups=[str(server/'tests/ownedSuiteSetup.js'),str(server/'tests/setup.js'),str(wp/'issue209-local-owned-physical-retention-spectral-finalizer.cjs'),str(wp/'visible-test-storage-206.setup.cjs')]
args=['--testMatch','**/tests/**/*.test.js','--setupFilesAfterEnv',*setups,'--globalTeardown',str(wp/'issue214-policy-owner-local-retention-teardown.cjs')]
assert run(['cmd.exe','/d','/c','npm.cmd','test','--',*args,'--showConfig'],'config-original.json','config-stderr-original.log').returncode==0
cfgText=(dest/'config-original.json').read_text(encoding='utf8');cfg=json.loads(cfgText[cfgText.index('{'):])
assert cfg['globalConfig']['maxWorkers']==1 and not cfg['globalConfig']['runInBand'] and cfg['globalConfig']['workerIdleMemoryLimit']==512000000
assert cfg['configs'][0]['setupFilesAfterEnv']==setups
selected=[str(server/p) for p in ['tests/contracts/issue_209_order_revision_integration.test.js','tests/contracts/deployment_readiness_bootstrap.test.js','tests/contracts/audit_1_2_state_authority.test.js','tests/security/audit_1_2_state_writes.test.js','tests/security/audit_1_2_migration_sources.test.js']]
assert set(selected)<=set(inventory)
(dest/'selected-inventory-original.json').write_bytes((json.dumps(selected,indent=2)+'\n').encode())
argv=['cmd.exe','/d','/c','npm.cmd','test','--',*args,'--runTestsByPath',*selected,'--json','--outputFile',str(dest/'report-original.json')]
(dest/'command.json').write_bytes((json.dumps({'argv':argv,'nodeOptions':'','bothOrdinarySetups':True,'stockAssertions':True,'maxWorkers':1,'workerIdleMemoryLimit':512000000,'localRetentionTeardownOnly':True,'localByteIdenticalVisibleAssets':True,'onlyMutableOutput':mutable,'productionOperations':0},indent=2)+'\n').encode())
(dest/'open-metadata.json').write_bytes((json.dumps({'startedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'status':'RUNNING_METADATA_ONLY','inventory':370,'frozenInputCount':len(paths),'sourceAudit':subprocess.run(['git','rev-parse','HEAD'],cwd=root,capture_output=True,check=True).stdout.decode().strip(),'expectedTests':333,'original650Reconciled':True,'onlyMutableOutput':mutable,'closedLogsExist':False,'productionOperations':0},indent=2)+'\n').encode())
print(json.dumps({'status':'RUNNING_METADATA_ONLY','inventory':5,'fullDiscovery':370,'frozenInputs':len(paths),'expectedTests':333,'onlyMutableOutput':mutable}),flush=True)
result=run(argv,'stdout-original.log','stderr-original.log');(dest/'exit-original.txt').write_bytes((str(result.returncode)+'\n').encode())
report=json.loads((dest/'report-original.json').read_bytes()) if (dest/'report-original.json').exists() else {}
after={p:hashlib.sha256((root/p).read_bytes()).hexdigest() for p in paths};(dest/'source-after.json').write_bytes((json.dumps(after,indent=2)+'\n').encode())
mutableAfter=(root/mutable).read_bytes();(dest/'derived-help-manifest-after-original.json').write_bytes(mutableAfter)
outputPolicy.update({'afterBytes':len(mutableAfter),'afterSha256':hashlib.sha256(mutableAfter).hexdigest(),'afterOriginalCaptured':True,'changed':mutableBefore!=mutableAfter,'closedUtc':datetime.datetime.now(datetime.UTC).isoformat()})
(dest/'derived-output-policy-closed.json').write_bytes((json.dumps(outputPolicy,indent=2)+'\n').encode())
exactInventory=set(s['name'] for s in report.get('testResults',[]))==set(selected) and report.get('numTotalTestSuites')==5
summary={'closedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'exit':result.returncode,'suites':report.get('numTotalTestSuites'),'tests':report.get('numTotalTests'),'passedSuites':report.get('numPassedTestSuites'),'passedTests':report.get('numPassedTests'),'failed':report.get('numFailedTests'),'failedSuites':report.get('numFailedTestSuites'),'pending':report.get('numPendingTests'),'todo':report.get('numTodoTests'),'sourceUnchanged':before==after,'selectedInventoryEqual':exactInventory,'fullDiscovery':370,'ordinarySetups':True,'workerIdleMemoryLimit':512000000,'nodeOptions':'','visibleAssetsUnchanged':originalAssets==assets(root/'client/dist')==assets(dist),'declaredMutableOutputCapturedBeforeAndAfter':True,'onlyMutableOutput':mutable,'productionOperations':0}
summary['status']='PASS' if result.returncode==0 and report.get('success') and before==after and exactInventory and summary['visibleAssetsUnchanged'] and report.get('numTotalTests')==report.get('numPassedTests')==333 and all(report.get(k)==0 for k in ['numFailedTests','numPendingTests','numFailedTestSuites','numPendingTestSuites','numTodoTests']) else 'FAILED_OR_INCOMPLETE'
(dest/'summary.json').write_bytes((json.dumps(summary,indent=2)+'\n').encode());print(json.dumps(summary),flush=True)
for suite in report.get('testResults',[]):
 failed=[c['fullName'] for c in suite.get('assertionResults',[]) if c['status']=='failed']
 if failed:print(json.dumps({'suite':suite['name'],'failedTests':failed}),flush=True)
assert summary['status']=='PASS'
