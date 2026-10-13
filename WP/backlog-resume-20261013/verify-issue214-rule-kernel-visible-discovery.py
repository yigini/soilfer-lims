"""New rule-kernel verification after closed hidden-path discovery refusal."""
import datetime,hashlib,json,os,subprocess
from pathlib import Path
root=Path(__file__).resolve().parents[2]
dest=Path(__file__).resolve().parent/'issue214-rule-kernel-visible-discovery'
assert not dest.exists()
assert not os.environ.get('NODE_OPTIONS')
dest.mkdir()
paths=['server/services/controlChartRules.js','server/config/policyRegistry.js','server/services/policyService.js','server/config/roles.js','server/tests/contracts/issue_214_control_chart_rules.test.js']
hashes={p:hashlib.sha256((root/p).read_bytes()).hexdigest() for p in paths}
env=dict(os.environ)
env['LIMS_OWNED_TEST_TEMPLATE']=str(root/'server/tests/.owned-templates/test_template_33522c62-1788-4298-8db6-06a0d4e5ff38.db')
report=dest/'report-original.json'
result=subprocess.run(['cmd.exe','/d','/c','npm.cmd','test','--','--testMatch','**/tests/**/*.test.js','--runTestsByPath',str(root/paths[-1]),'--json','--outputFile',str(report)],cwd=root/'server',env=env,capture_output=True)
for name,data in [('stdout-original.log',result.stdout),('stderr-original.log',result.stderr),('exit-original.txt',str(result.returncode).encode()+b'\n')]: (dest/name).write_bytes(data)
data=json.loads(report.read_bytes()) if report.exists() else {}
summary=dict(observedUtc=datetime.datetime.now(datetime.UTC).isoformat(),exitCode=result.returncode,status='PASS' if result.returncode==0 and data.get('success') else 'FAILED_OR_INCOMPLETE',
    suites=data.get('numTotalTestSuites'),tests=data.get('numTotalTests'),passed=data.get('numPassedTests'),failed=data.get('numFailedTests'),pending=data.get('numPendingTests'),
    sourceHashes=hashes,stockAssertions=True,ordinarySetupFiles=True,defaultHeap=True,nodeOptions='',localDiscoveryFixtureOnly=True,productionOperations=0)
(dest/'summary.json').write_bytes((json.dumps(summary,indent=2)+'\n').encode())
assert hashes=={p:hashlib.sha256((root/p).read_bytes()).hexdigest() for p in paths}
print(json.dumps(summary,indent=2),flush=True)
assert summary['status']=='PASS' and summary['failed']==summary['pending']==0
