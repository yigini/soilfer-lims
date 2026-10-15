"""One frozen-source local and actual Python3.9 data-only verification; no metadata operator runs."""
import ast,base64,datetime,hashlib,json,pathlib,subprocess,sys
REPO=pathlib.Path(__file__).resolve().parents[2]
SOURCE=REPO/'WP/batch-build-containerd-cde8-20261015'
DEST=SOURCE/'source-local-host-verification-once'
assert not DEST.exists();DEST.mkdir();sys.path.insert(0,str(SOURCE))
from batch_build_contract import SOURCE_FILES
raws={n:(SOURCE/n).read_bytes() for n in sorted(SOURCE_FILES)}
before={n:hashlib.sha256(v).hexdigest() for n,v in raws.items()}
for n,raw in raws.items():ast.parse(raw,filename=n,feature_version=(3,9))
def save(n,raw):
    with (DEST/n).open('xb') as f:f.write(raw)
save('command-original.json',(json.dumps({'startedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sourceSha256Before':before,'scope':'IN_MEMORY_COMPILATION_PURE_GUARD_TESTS_ONLY','imageInspects':0,'attributionCollectorsRun':0,'imageAdoptions':0,'newReceipts':0,'productionConnections':0},indent=2)+'\n').encode())
local=subprocess.run([sys.executable,'-B','verify_build_guards.py'],cwd=SOURCE,capture_output=True)
save('local-stdout-original.log',local.stdout);save('local-stderr-original.log',local.stderr)
assert local.returncode==0 and b'Ran 20 tests' in local.stderr
encoded={n:base64.b64encode(raw).decode() for n,raw in raws.items()}
probe='''import base64,hashlib,json,sys,types,unittest
encoded=ENCODED
expected=EXPECTED
raws={n:base64.b64decode(v) for n,v in encoded.items()}
assert {n:hashlib.sha256(v).hexdigest() for n,v in raws.items()}==expected
for n,raw in raws.items():compile(raw,n,'exec')
contract=types.ModuleType('batch_build_contract');sys.modules[contract.__name__]=contract
exec(compile(raws['batch_build_contract.py'],'batch_build_contract.py','exec'),contract.__dict__)
guards=types.ModuleType('accounted_build_guard_memory');sys.modules[guards.__name__]=guards
exec(compile(raws['verify_build_guards.py'],'verify_build_guards.py','exec'),guards.__dict__)
suite=unittest.defaultTestLoader.loadTestsFromModule(guards);assert suite.countTestCases()==20
result=unittest.TextTestRunner(verbosity=2).run(suite)
print(json.dumps({'status':'PASS' if result.wasSuccessful() else 'FAILED','pythonVersion':sys.version,'sourceSha256':expected,'compiledSourceCount':len(raws),'guardTestCount':result.testsRun,'remoteSourceFilesWritten':0,'metadataOperatorsExecuted':0,'imageInspectCalls':0,'imageAdoptions':0,'newReceipts':0,'productionConnections':0}))
assert result.wasSuccessful()
'''.replace('ENCODED',repr(encoded)).replace('EXPECTED',repr(before))
save('host-inmemory-verification-source.py',probe.encode())
remote=subprocess.run(['ssh','-o','BatchMode=yes','-o','ConnectTimeout=15','root@46.19.33.37','python3','-B','-'],cwd=REPO,input=probe.encode(),capture_output=True,timeout=45)
save('host-stdout-original.json',remote.stdout);save('host-stderr-original.log',remote.stderr)
assert remote.returncode==0 and b'Ran 20 tests' in remote.stderr
host=json.loads(remote.stdout);after={n:hashlib.sha256((SOURCE/n).read_bytes()).hexdigest() for n in raws}
assert before==after and host['sourceSha256']==before and host['status']=='PASS' and host['metadataOperatorsExecuted']==0
record={'status':'PASS_ACCOUNTED_BUILD_SOURCE_GUARDS_NOT_EXECUTION','closedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'localExitCode':local.returncode,'hostExitCode':remote.returncode,'localGuardTests':20,'actualHostGuardTests':20,'sourceSha256Before':before,'sourceSha256After':after,'sourceUnchanged':True,'host':host,'metadataCollectorsRun':0,'imageAdoptions':0,'newReceipts':0,'productionConnections':0}
save('exit-original.json',(json.dumps(record,indent=2)+'\n').encode());print(json.dumps({k:v for k,v in record.items() if k not in ['host','sourceSha256Before','sourceSha256After']}))
