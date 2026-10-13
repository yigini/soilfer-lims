"""One closed ordinary npm-test boundary; never rerun a consumed helper."""
import datetime, hashlib, json, os, subprocess, sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf-8')
root=Path(__file__).resolve().parents[2]
dest=Path(__file__).parent/'issue214-full-server-responsive'
assert not dest.exists() and not os.environ.get('NODE_OPTIONS')
dest.mkdir()
tests=['issue_214_control_chart_rules','issue_214_control_chart_integration','issue_214_control_chart_ui','audit_2_3_native_runs','audit_1_0_policy_components','audit_2_1_reference_ui','audit_1_2_guard_installer','deployment_readiness_bootstrap','audit_2_6_sql_scanner','audit_2_3_native_ui','audit_4_1_run_first_ui','audit_4_1_run_start_header']
paths=['server/services/'+p+'.js' for p in ['controlChartRules','controlChartService','controlChartMigrationSource','qcNativeRunService','qcNativeEvaluationService','qcNativeMeasurementService','qcRunReferenceService','policyService','workbenchRunService']]
paths+=['server/scripts/install_control_charts.js','server/scripts/control_chart_prebinding_impact.js','docs/audit/214-control-charts.md','.gitattributes','server/prisma/migrations/20261013000200_control_charts/migration.sql','server/prisma/schema.prisma','server/tests/globalSetup.js','server/tests/helpers/qcGateFixture.js','server/tests/helpers/legacyWorkflowDatabase.js','server/tests/helpers/workflowWriteScanner.js','server/tests/fixtures/pre214-native-run-source.cjs','server/config/policyRegistry.js','server/config/roles.js','server/controllers/controlChartController.js','server/routes/qcRoutes.js','server/index.js','Dockerfile','docker-entrypoint.sh','client/src/components/qc/ControlCharts.jsx','client/src/components/admin/ReferenceMaterials.jsx','client/src/components/qc/BatchInspectionModal.jsx','client/src/context/AuthContext.jsx','client/src/components/workbench/StartRunForm.jsx','client/src/components/workbench/NativeRunPanel.jsx']
paths+=['server/tests/contracts/'+name+'.test.js' for name in tests]
paths += ['client/src/components/lab/LabPolicies.jsx']
paths += [base+'/'+locale+'.json' for base in ['client/src/translations','server/locales'] for locale in ['en','es','es-419','fr','pt']]
hashes={p:hashlib.sha256((root/p).read_bytes()).hexdigest() for p in paths}
(dest/'source-before.json').write_bytes((json.dumps(hashes,indent=2)+'\n').encode())
env=dict(os.environ);env['LIMS_OWNED_TEST_TEMPLATE']=str(root/'server/tests/.owned-templates/test_template_33522c62-1788-4298-8db6-06a0d4e5ff38.db')
discovery=['node','node_modules/jest/bin/jest.js','--listTests','--json','--testMatch','**/tests/**/*.test.js']
with (dest/'inventory-original.json').open('wb') as out,(dest/'inventory-stderr-original.log').open('wb') as err:
 discoveryResult=subprocess.run(discovery,cwd=root/'server',env=env,stdout=out,stderr=err)
assert discoveryResult.returncode==0
inventory=json.loads((dest/'inventory-original.json').read_bytes())
assert len(inventory)==len(set(inventory))
command=['cmd.exe','/d','/c','npm.cmd','test','--','--testMatch','**/tests/**/*.test.js','--json','--outputFile',str(dest/'report-original.json')]
(dest/'command.json').write_bytes((json.dumps({'argv':command,'nodeOptions':'','ordinarySetupsAndAssertions':True,'localDiscoveryFixtureOnly':True},indent=2)+'\n').encode())
with (dest/'stdout-original.log').open('wb') as out,(dest/'stderr-original.log').open('wb') as err:
    result=subprocess.run(command,cwd=root/'server',env=env,stdout=out,stderr=err)
(dest/'exit-original.txt').write_bytes((str(result.returncode)+'\n').encode())
data=json.loads((dest/'report-original.json').read_bytes()) if (dest/'report-original.json').exists() else {}
after={p:hashlib.sha256((root/p).read_bytes()).hexdigest() for p in paths}
(dest/'source-after.json').write_bytes((json.dumps(after,indent=2)+'\n').encode())
inventoryEqual=set(inventory)=={row['name'] for row in data.get('testResults',[])} and len(inventory)==data.get('numTotalTestSuites')
summary={'observedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'exitCode':result.returncode,'status':'PASS' if result.returncode==0 and data.get('success') and hashes==after and inventoryEqual and data.get('numFailedTests')==0 and data.get('numPendingTests')==0 and data.get('numFailedTestSuites')==0 and data.get('numPendingTestSuites')==0 else 'FAILED_OR_INCOMPLETE','suites':data.get('numTotalTestSuites'),'tests':data.get('numTotalTests'),'failed':data.get('numFailedTests'),'pending':data.get('numPendingTests'),'sourceUnchanged':hashes==after,'inventoryEqual':inventoryEqual,'failedSuites':data.get('numFailedTestSuites'),'pendingSuites':data.get('numPendingTestSuites'),'productionOperations':0}
(dest/'summary.json').write_bytes((json.dumps(summary,indent=2)+'\n').encode())
print(json.dumps(summary),flush=True)
for suite in data.get('testResults',[]):
    for case in suite.get('assertionResults',[]):
        if case['status']=='failed':print(json.dumps({'test':case['fullName'],'failure':case['failureMessages'][:1]},ensure_ascii=False),flush=True)
assert summary['status']=='PASS' and summary['failed']==summary['pending']==0

assert set(inventory)=={row['name'] for row in data['testResults']} and len(inventory)==summary['suites']
