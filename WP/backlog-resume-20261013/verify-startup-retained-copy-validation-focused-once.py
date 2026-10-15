"""One ordinary frozen successor: both actual full failures + new WAL/race cases."""
import datetime,hashlib,json,os,pathlib,subprocess
R=pathlib.Path(__file__).resolve().parents[2];S=R/'server'
D=R/'WP/startup-order-readiness-20261015/retained-copy-validation-focused-once'
assert not D.exists() and not os.environ.get('NODE_OPTIONS');D.mkdir()
tracked=subprocess.check_output(['git','ls-files','server'],cwd=R).decode().splitlines()
paths=[n for n in tracked if '/node_modules/' not in n and '/prisma_client/' not in n and pathlib.Path(n).suffix in ['.js','.json','.txt','.sql','.prisma'] and (R/n).is_file()]
paths=sorted(set(paths+['server/utils/startupReadinessContext.js','server/tests/contracts/startup_readiness_context.test.js','server/tests/helpers/startupImpactFixture.js']))
before={n:hashlib.sha256((R/n).read_bytes()).hexdigest() for n in paths};(D/'source-before.json').write_text(json.dumps(before,indent=2),encoding='utf-8')
old=json.loads((R/'WP/startup-order-readiness-20261015/full-ordinary-once/report-original.json').read_bytes())
names=['tests/contracts/startup_readiness_context.test.js','tests/contracts/startup_readiness_telemetry.test.js',
    'tests/contracts/order_revision_impact_set_query.test.js','tests/contracts/audit_1_2_guard_installer.test.js','tests/security/audit_1_2_state_writes.test.js']
targets=[str(S/n) for n in names]
expected=sum(len(row['assertionResults']) for row in old['testResults'] if row['name'] in targets)+7
assert expected>29
for name in ['server/tests/contracts/audit_1_2_guard_installer.test.js','server/tests/security/audit_1_2_state_writes.test.js']:
    assert before[name]==json.loads((R/'WP/startup-order-readiness-20261015/full-ordinary-once/source-before.json').read_bytes())[name]
env=dict(os.environ);env['LIMS_OWNED_TEST_TEMPLATE']=str(S/'tests/.owned-templates/test_template_33522c62-1788-4298-8db6-06a0d4e5ff38.db')
args=['--testMatch','**/tests/**/*.test.js','--runTestsByPath',*targets]
def run(argv,out,err):
    with (D/out).open('xb') as stdout,(D/err).open('xb') as stderr:return subprocess.run(argv,cwd=S,env=env,stdout=stdout,stderr=stderr)
for name in paths:
    if name.endswith('.js') and name in ['server/utils/startupReadinessContext.js','server/tests/helpers/startupImpactFixture.js','server/tests/helpers/workflowWriteScanner.js','server/tests/contracts/startup_readiness_context.test.js','server/tests/contracts/order_revision_impact_set_query.test.js']:
        subprocess.run(['node','--check',str(R/name)],cwd=S,env=env,check=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
assert run(['cmd.exe','/d','/c','npm.cmd','test','--',*args,'--showConfig'],'config-original.json','config-stderr-original.log').returncode==0
text=(D/'config-original.json').read_text(encoding='utf-8');c=json.loads(text[text.index('{'):]);assert c['globalConfig']['maxWorkers']==1 and c['globalConfig']['workerIdleMemoryLimit']==512000000 and not c['globalConfig']['runInBand'];assert c['configs'][0]['setupFilesAfterEnv']==[str(S/'tests/ownedSuiteSetup.js'),str(S/'tests/setup.js')]
command=['cmd.exe','/d','/c','npm.cmd','test','--',*args,'--json','--outputFile',str(D/'report-original.json')]
(D/'command.json').write_text(json.dumps({'argv':command,'nodeOptions':'','bothOrdinarySetupsAndStockAssertions':True,'expectedTests':expected,'localHiddenCheckoutTestMatchOnly':True,'productionOperations':0},indent=2),encoding='utf-8')
print(json.dumps({'status':'RUNNING_METADATA_ONLY','suites':len(targets),'expectedTests':expected,'frozenPaths':len(paths)}),flush=True)
p=run(command,'stdout-original.log','stderr-original.log');(D/'exit-original.txt').write_text(str(p.returncode)+'\n',encoding='utf-8')
report=json.loads((D/'report-original.json').read_bytes()) if (D/'report-original.json').is_file() else {}
after={n:hashlib.sha256((R/n).read_bytes()).hexdigest() for n in paths};(D/'source-after.json').write_text(json.dumps(after,indent=2),encoding='utf-8');inventory=[row['name'] for row in report.get('testResults',[])]
v={'status':'PASS' if p.returncode==0 and report.get('success') and before==after and set(inventory)==set(targets) and report.get('numTotalTests')==expected and report.get('numFailedTests')==report.get('numPendingTests')==0 else 'FAILED_OR_INCOMPLETE',
    'closedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'exitCode':p.returncode,'suites':report.get('numTotalTestSuites'),'tests':report.get('numTotalTests'),'passed':report.get('numPassedTests'),'failed':report.get('numFailedTests'),'pending':report.get('numPendingTests'),
    'sourceUnchanged':before==after,'exactInventory':set(inventory)==set(targets),'ordinarySetupsAndAssertions':True,'productionOperations':0,'notFullSuiteCiOrRuntimeQualification':True}
(D/'summary.json').write_text(json.dumps(v,indent=2),encoding='utf-8');print(json.dumps(v),flush=True)
for row in report.get('testResults',[]):
    for case in row.get('assertionResults',[]):
        if case['status']=='failed':print(json.dumps({'test':case['fullName'],'failureMessages':['\n'.join(m.splitlines()[:30]) for m in case['failureMessages']]}),flush=True)
assert v['status']=='PASS'
