"""New strict-source-form and browser-event209 focused successor, once; retain failures and every owned fixture."""
import datetime,hashlib,json,os,subprocess,sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf8')
root=Path(__file__).resolve().parents[2];wp=Path(__file__).parent;server=root/'server';dest=wp/'issue209-attempt-noncompanion-order-context-focused'
assert not dest.exists() and not os.environ.get('NODE_OPTIONS')
assert (wp/'issue209-actual-decisions-6163271808/index.json').exists()
directories=['server/services','server/scripts','server/controllers','server/tests/contracts','server/tests/security','server/tests/helpers','server/prisma/migrations','client/src/components/sample','client/src/translations','server/locales']
paths=sorted({p.relative_to(root).as_posix() for directory in directories for p in (root/directory).rglob('*') if p.is_file() and p.suffix in ['.js','.cjs','.jsx','.sql','.json']})
paths+=['server/index.js','server/tests/globalSetup.js','server/prisma/schema.prisma','.gitattributes','Dockerfile','docker-entrypoint.sh','docs/audit/209-order-revisions.md']
dest.mkdir();env=dict(os.environ)
env['LIMS_OWNED_TEST_TEMPLATE']=str(server/'tests/.owned-templates/test_template_33522c62-1788-4298-8db6-06a0d4e5ff38.db')
paths.append('WP/backlog-resume-20261013/issue209-local-owned-physical-retention.cjs')
env['LIMS_OWNED_RETENTION_LEDGER']=str(dest/'physical-retention-original.jsonl')
before={path:hashlib.sha256((root/path).read_bytes()).hexdigest() for path in paths}
(dest/'source-before.json').write_bytes((json.dumps(before,indent=2)+'\n').encode())
def run(command,stdout,stderr):
 with (dest/stdout).open('wb') as out,(dest/stderr).open('wb') as err:
  return subprocess.run(command,cwd=server,env=env,stdout=out,stderr=err)
assert run(['node','node_modules/jest/bin/jest.js','--listTests','--json','--testMatch','**/tests/**/*.test.js'],'inventory-original.json','inventory-stderr-original.log').returncode==0
inventory=json.loads((dest/'inventory-original.json').read_bytes());assert len(inventory)==len(set(inventory))==370
selected=[str(server/'tests/contracts/audit_3_1_attempt_execution.test.js'),str(server/'tests/security/audit_1_2_state_writes.test.js')]
args=['--setupFilesAfterEnv',str(server/'tests/ownedSuiteSetup.js'),str(server/'tests/setup.js'),str(wp/'issue209-local-owned-physical-retention.cjs'),'--globalTeardown',str(wp/'issue214-policy-owner-local-retention-teardown.cjs'),'--testMatch','**/tests/**/*.test.js']
assert run(['cmd.exe','/d','/c','npm.cmd','test','--',*args,'--showConfig'],'config-original.json','config-stderr-original.log').returncode==0
cfgText=(dest/'config-original.json').read_text(encoding='utf8');cfg=json.loads(cfgText[cfgText.index('{'):])
assert cfg['globalConfig']['maxWorkers']==1 and cfg['globalConfig']['workerIdleMemoryLimit']==512000000
assert cfg['configs'][0]['setupFilesAfterEnv']==[str(server/'tests/ownedSuiteSetup.js'),str(server/'tests/setup.js'),str(wp/'issue209-local-owned-physical-retention.cjs')]
argv=['cmd.exe','/d','/c','npm.cmd','test','--',*args,'--runTestsByPath',*selected,'--json','--outputFile',str(dest/'report-original.json')]
(dest/'command.json').write_bytes((json.dumps({'argv':argv,'nodeOptions':'','bothOrdinarySetups':True,'stockAssertions':True,'localRetentionTeardownOnly':True,'productionOperations':0},indent=2)+'\n').encode())
result=run(argv,'stdout-original.log','stderr-original.log');(dest/'exit-original.txt').write_bytes((str(result.returncode)+'\n').encode())
report=json.loads((dest/'report-original.json').read_bytes()) if (dest/'report-original.json').exists() else {}
after={path:hashlib.sha256((root/path).read_bytes()).hexdigest() for path in paths};(dest/'source-after.json').write_bytes((json.dumps(after,indent=2)+'\n').encode())
summary={'closedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'exit':result.returncode,'suites':report.get('numTotalTestSuites'),
 'tests':report.get('numTotalTests'),'passedTests':report.get('numPassedTests'),'failed':report.get('numFailedTests'),'pending':report.get('numPendingTests'),
 'todo':report.get('numTodoTests'),'sourceUnchanged':before==after,'selectedInventoryEqual':set(s['name'] for s in report.get('testResults',[]))==set(selected),
 'fullDiscovery':370,'ordinarySetups':True,'workerIdleMemoryLimit':512000000,'productionOperations':0}
summary['status']='PASS' if result.returncode==0 and report.get('success') and before==after and summary['selectedInventoryEqual'] and report.get('numTotalTests')==report.get('numPassedTests') and report.get('numTotalTests',0)>=40 and all(report.get(k)==0 for k in ['numFailedTests','numPendingTests','numFailedTestSuites','numPendingTestSuites','numTodoTests']) else 'FAILED_OR_INCOMPLETE'
(dest/'summary.json').write_bytes((json.dumps(summary,indent=2)+'\n').encode());print(json.dumps(summary),flush=True)
for suite in report.get('testResults',[]):
 for case in suite.get('assertionResults',[]):
  if case['status']=='failed':print(json.dumps({'suite':suite['name'],'test':case['fullName'],'failure':[m[:600]+' ... '+m[-600:] for m in case['failureMessages'][:1]]}),flush=True)
assert summary['status']=='PASS'
