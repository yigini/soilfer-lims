"""Frozen source compilation/guards and NEW synthetic fixtures only; no production operator."""
import ast,base64,datetime,hashlib,json,os,pathlib,subprocess,sys
REPO=pathlib.Path(__file__).resolve().parents[2];SOURCE=REPO/'WP/batch-proof-forward-resume-cde8-20261015';DEST=SOURCE/'source-local-host-verification-forward-resume-render-successor-once'
assert not DEST.exists();DEST.mkdir();sys.path.insert(0,str(SOURCE))
from proof_contract import FILES
EXPECTED_TESTS=sum(1 for node in ast.walk(ast.parse((SOURCE/'verify_proof_guards.py').read_bytes())) if isinstance(node,ast.FunctionDef) and node.name.startswith('test_'))
raws={n:(SOURCE/n).read_bytes() for n in sorted(FILES)};before={n:hashlib.sha256(v).hexdigest() for n,v in raws.items()}
for n,raw in raws.items():ast.parse(raw,filename=n,feature_version=(3,9))
def save(n,raw):
    with (DEST/n).open('xb') as f:f.write(raw)
save('command-original.json',(json.dumps({'startedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sourceSha256Before':before,'scope':'COMPILE_GUARDS_NEW_SYNTHETIC_FIXTURES_ONLY','productionFileCopies':0,'productionConnections':0,'proofOperatorsExecuted':0},indent=2)+'\n').encode())
env={**os.environ,'LIMS_PROOF_GUARD_FIXTURE_DIR':str(SOURCE/'r3')}
local=subprocess.run([sys.executable,'-X','utf8','-B','verify_proof_guards.py'],cwd=SOURCE,env=env,capture_output=True)
save('local-stdout-original.log',local.stdout);save('local-stderr-original.log',local.stderr)
if local.returncode!=0:
    save('exit-original.json',(json.dumps({'status':'LOCAL_FAILED_HOST_NOT_STARTED','localExitCode':local.returncode,'hostStarted':False,'expectedTests':EXPECTED_TESTS,'closedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sourceSha256Before':before,'sourceSha256After':{n:hashlib.sha256((SOURCE/n).read_bytes()).hexdigest() for n in raws},'newOperations':0},indent=2)+'\n').encode());raise RuntimeError('Retain initial source/test failure; host NOT started; never replay')
assert ('Ran '+str(EXPECTED_TESTS)+' tests').encode() in local.stderr,'Unexpected test inventory'
from prepare_proof import raw_git
from proof_contract import PRIOR_FILES,PRIOR_EVIDENCE,exact_json
from proof_resume import validate_records
actual_prior={n:exact_json(raw_git(PRIOR_EVIDENCE,pin['path'])[0]) for n,pin in PRIOR_FILES.items()};validate_records(actual_prior)
save('actual-bound-prior-metadata-validation.json',(json.dumps({'status':'PURE_BOUND_RECORD_VALIDATION_PASS','actualPriorBlobs':len(actual_prior),'sqlConnections':0,'productionCopies':0,'proofOperatorsExecuted':0})+'\n').encode())
encoded={n:base64.b64encode(raw).decode() for n,raw in raws.items()}
probe='''import base64,hashlib,json,sys,types,unittest,os
encoded=ENCODED
expected=EXPECTED
raws={n:base64.b64decode(v) for n,v in encoded.items()}
assert {n:hashlib.sha256(v).hexdigest() for n,v in raws.items()}==expected
for n,r in raws.items():compile(r,n,'exec')
for n in ['proof_budget.py','proof_contract.py','proof_files.py','proof_disk.py','proof_docker.py','proof_resume.py','proof_install.py','proof_startup.py','run_stopped_proof.py','prepare_proof.py','launch_proof.py','verify_proof_guards.py']:
 name=n.removesuffix('.py');m=types.ModuleType(name);m.__file__='/in-memory/proof-guards/WP/batch-proof-forward-resume-cde8-20261015/'+n;sys.modules[name]=m;exec(compile(raws[n],n,'exec'),m.__dict__)
os.environ['LIMS_PROOF_COPY_SITE_SOURCES']=json.dumps({n:encoded[n] for n in sys.modules['proof_budget'].EXPECTED_SITES})
os.environ['LIMS_PROOF_GUARD_FIXTURE_DIR']='/tmp/lims-owned-forward-resume-source-guards-20261015T053600Z'
suite=unittest.defaultTestLoader.loadTestsFromModule(sys.modules['verify_proof_guards']);assert suite.countTestCases()==TEST_COUNT
result=unittest.TextTestRunner(verbosity=2).run(suite)
print(json.dumps({'status':'PASS' if result.wasSuccessful() else 'FAILED','pythonVersion':sys.version,'sourceSha256':expected,'compiledSourceCount':len(raws),'guardTestCount':result.testsRun,'fixtureDirectory':os.environ['LIMS_PROOF_GUARD_FIXTURE_DIR'],'fixturesSyntheticOnly':True,'remoteSourceFilesWritten':0,'productionFileCopies':0,'productionConnections':0,'proofOperatorsExecuted':0,'imageInspects':0,'installerAttempts':0,'defaultEntrypointAttempts':0,'noFixtureCleanup':True}))
assert result.wasSuccessful()
inventory=sys.modules['proof_docker'].all_containers();contract=sys.modules['proof_contract'];name='lims-owned-batch-'+contract.sha((str(contract.ROOT)+':actual-chart-prebinding-impact').encode())[:24];absence=sys.modules['proof_docker'].unused_name(name,inventory)
print(json.dumps({'actualHostMetadataNameProof':absence,'metadataOnly':True,'containerCreates':0,'installerAttempts':0,'productionSqliteConnections':0,'actualHostCgroupMemoryStat':sys.modules['proof_disk'].cgroup_memory()}))
'''.replace('encoded=ENCODED','encoded='+repr(encoded)).replace('expected=EXPECTED','expected='+repr(before)).replace('TEST_COUNT',str(EXPECTED_TESTS))
save('host-inmemory-verification-source.py',probe.encode());remote=subprocess.run(['ssh','-o','BatchMode=yes','-o','ConnectTimeout=15','root@46.19.33.37','python3','-B','-'],cwd=REPO,input=probe.encode(),capture_output=True,timeout=60)
save('host-stdout-original.json',remote.stdout);save('host-stderr-original.log',remote.stderr)
assert remote.returncode==0 and ('Ran '+str(EXPECTED_TESTS)+' tests').encode() in remote.stderr,'Retain original host failure; never replay'
host_rows=[json.loads(line) for line in remote.stdout.splitlines() if line.strip()];assert len(host_rows)==2;host=host_rows[0];assert host_rows[1]['actualHostMetadataNameProof']['exactNameAbsent'] and host_rows[1]['containerCreates']==0;after={n:hashlib.sha256((SOURCE/n).read_bytes()).hexdigest() for n in raws};assert before==after and host['sourceSha256']==before and host['status']=='PASS'
record={'status':'PASS_NEW_CLOSED_STOPPED_COPY_SOURCE_GUARDS_NOT_PROOF_EXECUTION','closedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'localExitCode':local.returncode,'hostExitCode':remote.returncode,'localTests':EXPECTED_TESTS,'actualHostTests':EXPECTED_TESTS,'sourceSha256Before':before,'sourceSha256After':after,'sourceUnchanged':True,'host':host,'actualHostMetadataNameProof':host_rows[1],'productionFileCopies':0,'productionConnections':0,'proofOperatorsExecuted':0}
save('exit-original.json',(json.dumps(record,indent=2)+'\n').encode());print(json.dumps({k:v for k,v in record.items() if k not in ['host','sourceSha256Before','sourceSha256After']}))
