"""One ordinary focused run: frozen context source, real owned fixtures only."""
import datetime,hashlib,json,os,pathlib,subprocess
R=pathlib.Path(__file__).resolve().parents[2];S=R/'server'
D=R/'WP/startup-order-readiness-20261015/managed-bootstrap-focused-once'
assert not D.exists() and not os.environ.get('NODE_OPTIONS');D.mkdir()
tracked=subprocess.check_output(['git','ls-files','server'],cwd=R).decode().splitlines()
paths=[n for n in tracked if '/node_modules/' not in n and '/prisma_client/' not in n and pathlib.Path(n).suffix in ['.js','.json','.txt','.sql','.prisma'] and (R/n).is_file()]
paths=sorted(set(paths+['server/utils/startupReadinessContext.js','server/tests/contracts/startup_readiness_context.test.js']))
before={n:hashlib.sha256((R/n).read_bytes()).hexdigest() for n in paths};(D/'source-before.json').write_text(json.dumps(before,indent=2),encoding='utf-8')
env=dict(os.environ);template=S/'tests/.owned-templates/test_template_33522c62-1788-4298-8db6-06a0d4e5ff38.db';assert template.is_file();env['LIMS_OWNED_TEST_TEMPLATE']=str(template)
targets=[str(S/'tests/contracts'/n) for n in ['startup_readiness_context.test.js','startup_readiness_telemetry.test.js','order_revision_impact_set_query.test.js']]
args=['--testMatch','**/tests/**/*.test.js','--runTestsByPath',*targets]
with (D/'config-original.json').open('xb') as out,(D/'config-stderr-original.log').open('xb') as err:p=subprocess.run(['cmd.exe','/d','/c','npm.cmd','test','--',*args,'--showConfig'],cwd=S,env=env,stdout=out,stderr=err)
assert p.returncode==0;txt=(D/'config-original.json').read_text(encoding='utf-8');c=json.loads(txt[txt.index('{'):]);assert c['globalConfig']['maxWorkers']==1 and c['globalConfig']['workerIdleMemoryLimit']==512000000 and not c['globalConfig']['runInBand'];assert c['configs'][0]['setupFilesAfterEnv']==[str(S/'tests/ownedSuiteSetup.js'),str(S/'tests/setup.js')]
command=['cmd.exe','/d','/c','npm.cmd','test','--',*args,'--json','--outputFile',str(D/'report-original.json')]
(D/'command.json').write_text(json.dumps({'argv':command,'nodeOptions':'','ordinarySetupsAndAssertions':True,'localHiddenPathTestMatchFixtureOnly':True,'productionOperations':0},indent=2),encoding='utf-8')
with (D/'stdout-original.log').open('xb') as out,(D/'stderr-original.log').open('xb') as err:p=subprocess.run(command,cwd=S,env=env,stdout=out,stderr=err)
report=json.loads((D/'report-original.json').read_bytes()) if (D/'report-original.json').is_file() else {}
after={n:hashlib.sha256((R/n).read_bytes()).hexdigest() for n in paths};(D/'source-after.json').write_text(json.dumps(after,indent=2),encoding='utf-8');inventory=[x['name'] for x in report.get('testResults',[])]
v={'status':'PASS' if p.returncode==0 and report.get('success') and before==after and set(inventory)==set(targets) and report.get('numTotalTests')==17 and report.get('numFailedTests')==report.get('numPendingTests')==0 else 'FAILED_OR_INCOMPLETE','closedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'exitCode':p.returncode,'suites':report.get('numTotalTestSuites'),'tests':report.get('numTotalTests'),'passed':report.get('numPassedTests'),'failed':report.get('numFailedTests'),'pending':report.get('numPendingTests'),'sourceUnchanged':before==after,'frozenPaths':len(paths),'exactInventory':set(inventory)==set(targets),'ordinarySetupsAndAssertions':True,'productionOperations':0,'notFullSuiteCiOrRuntimeStartupProof':True}
(D/'summary.json').write_text(json.dumps(v,indent=2),encoding='utf-8');print(json.dumps(v))
for suite in report.get('testResults',[]):
 for case in suite.get('assertionResults',[]):
  if case['status']=='failed':print(json.dumps({'test':case['fullName'],'failureMessages':case['failureMessages']}))
assert v['status']=='PASS'
