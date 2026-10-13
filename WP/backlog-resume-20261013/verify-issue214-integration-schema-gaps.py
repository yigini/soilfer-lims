import datetime,hashlib,json,os,subprocess,sys
sys.stdout.reconfigure(encoding="utf-8")
from pathlib import Path
root=Path(__file__).resolve().parents[2]
dest=Path(__file__).resolve().parent/'issue214-integration-schema-gaps'
assert not dest.exists();assert not os.environ.get('NODE_OPTIONS');dest.mkdir()
paths=['server/services/controlChartRules.js','server/services/controlChartService.js','server/services/controlChartMigrationSource.js','server/scripts/install_control_charts.js','server/prisma/migrations/20261013000200_control_charts/migration.sql','server/tests/contracts/issue_214_control_chart_integration.test.js','server/tests/contracts/issue_214_control_chart_rules.test.js','server/services/qcNativeRunService.js','server/services/qcNativeEvaluationService.js','server/services/qcNativeMeasurementService.js','server/config/policyRegistry.js','server/services/policyService.js','server/config/roles.js','server/prisma/schema.prisma','server/tests/globalSetup.js','server/tests/helpers/qcGateFixture.js','server/tests/helpers/legacyWorkflowDatabase.js']
hashes={p:hashlib.sha256((root/p).read_bytes()).hexdigest() for p in paths}
env=dict(os.environ);env['LIMS_OWNED_TEST_TEMPLATE']=str(root/'server/tests/.owned-templates/test_template_33522c62-1788-4298-8db6-06a0d4e5ff38.db')
report=dest/'report-original.json'
with (dest/'stdout-original.log').open('wb') as stdout,(dest/'stderr-original.log').open('wb') as stderr:
 result=subprocess.run(['cmd.exe','/d','/c','npm.cmd','test','--','--testMatch','**/tests/**/*.test.js','--runTestsByPath',str(root/paths[5]),str(root/paths[6]),'--json','--outputFile',str(report)],cwd=root/'server',env=env,stdout=stdout,stderr=stderr)
(dest/'exit-original.txt').write_bytes((str(result.returncode)+'\n').encode())
data=json.loads(report.read_bytes()) if report.exists() else {}
summary={'observedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'exitCode':result.returncode,'status':'PASS' if result.returncode==0 and data.get('success') else 'FAILED_OR_INCOMPLETE','suites':data.get('numTotalTestSuites'),'tests':data.get('numTotalTests'),'failed':data.get('numFailedTests'),'pending':data.get('numPendingTests'),'sourceHashes':hashes,'ordinarySetupsAndAssertions':True,'nodeOptions':'','localDiscoveryFixtureOnly':True,'productionOperations':0}
(dest/'summary.json').write_bytes((json.dumps(summary,indent=2)+'\n').encode())
assert hashes=={p:hashlib.sha256((root/p).read_bytes()).hexdigest() for p in paths}
print(json.dumps({k:v for k,v in summary.items() if k!='sourceHashes'},indent=2),flush=True)
if result.returncode: print((dest/'stderr-original.log').read_text(encoding='utf-8',errors='replace')[-10000:],flush=True)
assert summary['status']=='PASS' and summary['failed']==summary['pending']==0
