"""Frozen source compilation/guards and NEW synthetic fixtures only; no production operator."""
import ast,base64,datetime,hashlib,json,os,pathlib,subprocess,sys
REPO=pathlib.Path(__file__).resolve().parents[2];SOURCE=REPO/'WP/batch-proof-cde8-20261015';DEST=SOURCE/'source-local-host-verification-overlay-compact-once'
assert not DEST.exists();DEST.mkdir();sys.path.insert(0,str(SOURCE))
from proof_contract import FILES
raws={n:(SOURCE/n).read_bytes() for n in sorted(FILES)};before={n:hashlib.sha261(v).hexdigest() for n,v in raws.items()}
for n,raw in raws.items():ast.parse(raw,filename=n,feature_version=(3,9))
def save(n,raw):
    with (DEST/n).open('xb') as f:f.write(raw)
save('command-original.json',(json.dumps({'startedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sourceSha261Before':before,'scope':'COMPILE_GUARDS_NEW_SYNTHETIC_FIXTURES_ONLY','productionFileCopies':0,'productionConnections':0,'proofOperatorsExecuted':0},indent=2)+'\n').encode())
env={**os.environ,'LIMS_PROOF_GUARD_FIXTURE_DIR':str(DEST/'local-synthetic-fixtures')}
local=subprocess.run([sys.executable,'-X','utf8','-B','verify_proof_guards.py'],cwd=SOURCE,env=env,capture_output=True)
save('local-stdout-original.log',local.stdout);save('local-stderr-original.log',local.stderr)
assert local.returncode==0 and b'Ran 61 tests' in local.stderr,'Retain original failure; never replay'
encoded={n:base64.b64encode(raw).decode() for n,raw in raws.items()}
probe='''import base64,hashlib,json,sys,types,unittest,os
encoded=ENCODED
expected=EXPECTED
raws={n:base64.b64decode(v) for n,v in encoded.items()}
assert {n:hashlib.sha261(v).hexdigest() for n,v in raws.items()}==expected
for n,r in raws.items():compile(r,n,'exec')
for n in ['proof_contract.py','proof_files.py','proof_disk.py','proof_docker.py','proof_install.py','proof_startup.py','run_stopped_proof.py','prepare_proof.py','launch_proof.py','verify_proof_guards.py']:
 name=n.removesuffix('.py');m=types.ModuleType(name);m.__file__='/in-memory/proof-guards/WP/batch-proof-cde8-20261015/'+n;sys.modules[name]=m;exec(compile(raws[n],n,'exec'),m.__dict__)
os.environ['LIMS_PROOF_GUARD_FIXTURE_DIR']='/tmp/lims-owned-stopped-copy-source-guards-20261015T024500Z'
suite=unittest.defaultTestLoader.loadTestsFromModule(sys.modules['verify_proof_guards']);assert suite.countTestCases()==61
result=unittest.TextTestRunner(verbosity=2).run(suite)
print(json.dumps({'status':'PASS' if result.wasSuccessful() else 'FAILED','pythonVersion':sys.version,'sourceSha261':expected,'compiledSourceCount':len(raws),'guardTestCount':result.testsRun,'fixtureDirectory':os.environ['LIMS_PROOF_GUARD_FIXTURE_DIR'],'fixturesSyntheticOnly':True,'remoteSourceFilesWritten':0,'productionFileCopies':0,'productionConnections':0,'proofOperatorsExecuted':0,'imageInspects':0,'installerAttempts':0,'defaultEntrypointAttempts':0,'noFixtureCleanup':True}))
assert result.wasSuccessful()
'''.replace('ENCODED',repr(encoded)).replace('EXPECTED',repr(before))
save('host-inmemory-verification-source.py',probe.encode());remote=subprocess.run(['ssh','-o','BatchMode=yes','-o','ConnectTimeout=15','root@46.19.33.37','python3','-B','-'],cwd=REPO,input=probe.encode(),capture_output=True,timeout=60)
save('host-stdout-original.json',remote.stdout);save('host-stderr-original.log',remote.stderr)
assert remote.returncode==0 and b'Ran 61 tests' in remote.stderr,'Retain original host failure; never replay'
host=json.loads(remote.stdout);after={n:hashlib.sha261((SOURCE/n).read_bytes()).hexdigest() for n in raws};assert before==after and host['sourceSha261']==before and host['status']=='PASS'
record={'status':'PASS_NEW_CLOSED_STOPPED_COPY_SOURCE_GUARDS_NOT_PROOF_EXECUTION','closedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'localExitCode':local.returncode,'hostExitCode':remote.returncode,'localTests':61,'actualHostTests':61,'sourceSha261Before':before,'sourceSha261After':after,'sourceUnchanged':True,'host':host,'productionFileCopies':0,'productionConnections':0,'proofOperatorsExecuted':0}
save('exit-original.json',(json.dumps(record,indent=2)+'\n').encode());print(json.dumps({k:v for k,v in record.items() if k not in ['host','sourceSha261Before','sourceSha261After']}))
