"""Verify only the new telemetry source with ordinary setup and frozen inputs."""
import datetime,hashlib,json,os,pathlib,subprocess
R=pathlib.Path(__file__).resolve().parents[2];S=R/'server';D=R/'WP/startup-order-readiness-20261015/ready-telemetry-focused-once';assert not D.exists() and not os.environ.get('NODE_OPTIONS');D.mkdir()
paths=['server/index.js','server/utils/startupReadinessTelemetry.js','server/tests/contracts/startup_readiness_telemetry.test.js','server/package.json','server/jest.config.js','server/tests/ownedSuiteSetup.js','server/tests/setup.js','server/tests/globalTeardown.js']
before={n:hashlib.sha256((R/n).read_bytes()).hexdigest() for n in paths};(D/'source-before.json').write_text(json.dumps(before,indent=2),encoding='utf-8')
env=dict(os.environ);template=S/'tests/.owned-templates/test_template_33522c62-1788-4298-8db6-06a0d4e5ff38.db';assert template.is_file();env['LIMS_OWNED_TEST_TEMPLATE']=str(template)
target=str(S/'tests/contracts/startup_readiness_telemetry.test.js');args=['--testMatch','**/tests/**/*.test.js','--runTestsByPath',target]
configcmd=['cmd.exe','/d','/c','npm.cmd','test','--',*args,'--showConfig']
with (D/'config-original.json').open('xb') as out,(D/'config-stderr-original.log').open('xb') as err:r=subprocess.run(configcmd,cwd=S,env=env,stdout=out,stderr=err)
assert r.returncode==0
text=(D/'config-original.json').read_text(encoding='utf-8');c=json.loads(text[text.index('{'):]);assert c['globalConfig']['maxWorkers']==1 and c['globalConfig']['workerIdleMemoryLimit']==512000000 and not c['globalConfig']['runInBand']
assert c['configs'][0]['setupFilesAfterEnv']==[str(S/'tests/ownedSuiteSetup.js'),str(S/'tests/setup.js')]
command=['cmd.exe','/d','/c','npm.cmd','test','--',*args,'--json','--outputFile',str(D/'report-original.json')]
(D/'command.json').write_text(json.dumps({'argv':command,'nodeOptions':'','ordinarySetupsAndAssertions':True,'workerIdleMemoryLimit':512000000,'localHiddenPathTestMatchFixtureOnly':True,'ownedTemplate':str(template),'productionOperations':0},indent=2),encoding='utf-8')
with (D/'stdout-original.log').open('xb') as out,(D/'stderr-original.log').open('xb') as err:r=subprocess.run(command,cwd=S,env=env,stdout=out,stderr=err)
report=json.loads((D/'report-original.json').read_bytes()) if (D/'report-original.json').is_file() else {}
after={n:hashlib.sha256((R/n).read_bytes()).hexdigest() for n in paths};(D/'source-after.json').write_text(json.dumps(after,indent=2),encoding='utf-8')
inventory=[v['name'] for v in report.get('testResults',[])]
v={'status':'PASS' if r.returncode==0 and report.get('success') and before==after and inventory==[target] and report.get('numTotalTests')==4 and report.get('numFailedTests')==report.get('numPendingTests')==0 else 'FAILED_OR_INCOMPLETE','closedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'exitCode':r.returncode,'suites':report.get('numTotalTestSuites'),'tests':report.get('numTotalTests'),'passed':report.get('numPassedTests'),'failed':report.get('numFailedTests'),'pending':report.get('numPendingTests'),'sourceUnchanged':before==after,'exactInventory':inventory==[target],'ordinarySetupsAndAssertions':True,'productionOperations':0,'noRuntimeProof':True,'notFullSuiteOrCi':True}
(D/'summary.json').write_text(json.dumps(v,indent=2),encoding='utf-8');print(json.dumps(v))
for suite in report.get('testResults',[]):
 for case in suite.get('assertionResults',[]):
  if case['status']=='failed':print(json.dumps({'test':case['fullName'],'failureMessages':case['failureMessages']}))
assert v['status']=='PASS'
