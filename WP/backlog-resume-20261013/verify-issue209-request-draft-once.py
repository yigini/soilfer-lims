"""Verify the first209 request draft once with both ordinary setups; retain all owned databases."""
import datetime,hashlib,json,os,subprocess,sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf8')
root=Path(__file__).resolve().parents[2];wp=Path(__file__).parent;server=root/'server';dest=wp/'issue209-request-draft-focused'
assert not dest.exists() and not os.environ.get('NODE_OPTIONS')
assert (wp/'issue209-actual-decisions-6163271808/index.json').exists()
paths=['server/services/orderRevisionContract.js','server/tests/contracts/issue_209_order_revision_request.test.js',
 'server/services/analysisCodesService.js','server/services/workflowStateRules.js','server/package.json','server/jest.config.js',
 'server/tests/ownedSuiteSetup.js','server/tests/setup.js','server/tests/globalSetup.js','server/tests/globalTeardown.js',
 'WP/backlog-resume-20261013/issue214-policy-owner-local-retention-teardown.cjs']
dest.mkdir();env=dict(os.environ)
env['LIMS_OWNED_TEST_TEMPLATE']=str(server/'tests/.owned-templates/test_template_33522c62-1788-4298-8db6-06a0d4e5ff38.db')
before={path:hashlib.sha256((root/path).read_bytes()).hexdigest() for path in paths}
(dest/'source-before.json').write_bytes((json.dumps(before,indent=2)+'\n').encode())
def run(command,stdout,stderr):
 with (dest/stdout).open('wb') as out,(dest/stderr).open('wb') as err:
  return subprocess.run(command,cwd=server,env=env,stdout=out,stderr=err)
discovery=['node','node_modules/jest/bin/jest.js','--listTests','--json','--testMatch','**/tests/**/*.test.js']
assert run(discovery,'inventory-original.json','inventory-stderr-original.log').returncode==0
inventory=json.loads((dest/'inventory-original.json').read_bytes())
previous=json.loads((wp/'issue214-policy-post-probe-focused/inventory-original.json').read_bytes())
target=str(server/'tests/contracts/issue_209_order_revision_request.test.js')
assert len(inventory)==len(set(inventory))==367 and set(inventory)==set(previous)|{target}
args=['--globalTeardown',str(wp/'issue214-policy-owner-local-retention-teardown.cjs'),'--testMatch','**/tests/**/*.test.js']
assert run(['cmd.exe','/d','/c','npm.cmd','test','--',*args,'--showConfig'],'config-original.json','config-stderr-original.log').returncode==0
cfgText=(dest/'config-original.json').read_text(encoding='utf8');cfg=json.loads(cfgText[cfgText.index('{'):])
assert cfg['globalConfig']['maxWorkers']==1 and cfg['globalConfig']['workerIdleMemoryLimit']==512000000
assert cfg['configs'][0]['setupFilesAfterEnv']==[str(server/'tests/ownedSuiteSetup.js'),str(server/'tests/setup.js')]
argv=['cmd.exe','/d','/c','npm.cmd','test','--',*args,'--runTestsByPath',target,'--json','--outputFile',str(dest/'report-original.json')]
(dest/'command.json').write_bytes((json.dumps({'argv':argv,'nodeOptions':'','bothOrdinarySetups':True,'stockAssertions':True,'localRetentionTeardownOnly':True,'productionOperations':0},indent=2)+'\n').encode())
result=run(argv,'stdout-original.log','stderr-original.log')
(dest/'exit-original.txt').write_bytes((str(result.returncode)+'\n').encode())
report=json.loads((dest/'report-original.json').read_bytes()) if (dest/'report-original.json').exists() else {}
after={path:hashlib.sha256((root/path).read_bytes()).hexdigest() for path in paths}
(dest/'source-after.json').write_bytes((json.dumps(after,indent=2)+'\n').encode())
summary={'closedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'exit':result.returncode,
 'suites':report.get('numTotalTestSuites'),'tests':report.get('numTotalTests'),'passedTests':report.get('numPassedTests'),
 'failed':report.get('numFailedTests'),'pending':report.get('numPendingTests'),'todo':report.get('numTodoTests'),
 'sourceUnchanged':before==after,'selectedInventoryEqual':[s['name'] for s in report.get('testResults',[])]==[target],
 'fullDiscovery':367,'ordinarySetups':True,'workerIdleMemoryLimit':512000000,'productionOperations':0}
summary['status']='PASS' if result.returncode==0 and report.get('success') and before==after and summary['selectedInventoryEqual'] and report.get('numTotalTests')==report.get('numPassedTests')==17 and all(report.get(k)==0 for k in ['numFailedTests','numPendingTests','numFailedTestSuites','numPendingTestSuites','numTodoTests']) else 'FAILED_OR_INCOMPLETE'
(dest/'summary.json').write_bytes((json.dumps(summary,indent=2)+'\n').encode());print(json.dumps(summary),flush=True)
assert summary['status']=='PASS'
