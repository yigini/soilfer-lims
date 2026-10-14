"""One narrow source-delta and actual-host data-only compatibility verification."""
import base64, datetime, hashlib, json, pathlib, subprocess, sys
REPO=pathlib.Path(__file__).resolve().parents[2]
SOURCE=REPO/'WP/batch-release-cde8-20261014'
DEST=SOURCE/'build-python39-source-host-verification-once'
assert not DEST.exists(), 'Consumed verification boundary'
DEST.mkdir();sys.path.insert(0,str(SOURCE))
from batch_build_contract import SOURCE_FILES
from prepare_batch_build import raw_git
raws={n:(SOURCE/n).read_bytes() for n in sorted(SOURCE_FILES)}
before={n:hashlib.sha256(raw).hexdigest() for n,raw in raws.items()}
old={n:raw_git('9ef893b38fe381061d4dc8aa90968d1d7a4f6fff','WP/batch-release-cde8-20261014/'+n)[0] for n in raws}
assert old['batch_build.py'].count(b'datetime.UTC')==2
assert raws['batch_build.py']==old['batch_build.py'].replace(b'datetime.UTC',b'datetime.timezone.utc')
assert all(raws[n]==old[n] for n in raws if n!='batch_build.py')
def save(name,raw):
    with (DEST/name).open('xb') as f:f.write(raw)
save('source-delta-original.diff',subprocess.check_output(['git','diff','--','WP/batch-release-cde8-20261014/batch_build.py'],cwd=REPO))
save('command-original.json',(json.dumps({'startedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'sourceSha256Before':before,'delta':'ONLY_TWO_BUILDER_UTC_REFERENCES_TO_TIMEZONE_UTC','remoteScope':'IN_MEMORY_SOURCE_COMPILE_AND_PURE_CONTRACT_GUARDS_NO_REMOTE_SOURCE_FILES_OR_BUILD','productionConnections':0,'buildsLaunched':0},indent=2)+'\n').encode())
local=subprocess.run([sys.executable,'-B','verify_build_guards.py'],cwd=SOURCE,capture_output=True)
save('local-stdout-original.log',local.stdout);save('local-stderr-original.log',local.stderr)
assert local.returncode==0 and b'Ran 14 tests' in local.stderr
encoded={n:base64.b64encode(raw).decode() for n,raw in raws.items()}
probe='''import base64,datetime,hashlib,inspect,json,pathlib,sys,tarfile,types,unittest
encoded=ENCODED
expected=EXPECTED
raws={n:base64.b64decode(v) for n,v in encoded.items()}
assert {n:hashlib.sha256(v).hexdigest() for n,v in raws.items()}==expected
for n,raw in raws.items():compile(raw,n,'exec')
assert hasattr(datetime,'timezone') and 'filter' in inspect.signature(tarfile.TarFile.extractall).parameters
assert datetime.datetime.now(datetime.timezone.utc).utcoffset().total_seconds()==0
root=pathlib.Path('/opt/lims/releases/workflow-batch-build-cde8c889-20261014T221500Z')
assert not root.exists() and not root.is_symlink()
contract=types.ModuleType('batch_build_contract');sys.modules['batch_build_contract']=contract
exec(compile(raws['batch_build_contract.py'],'batch_build_contract.py','exec'),contract.__dict__)
guards=types.ModuleType('batch_guard_test_memory');sys.modules[guards.__name__]=guards
exec(compile(raws['verify_build_guards.py'],'verify_build_guards.py','exec'),guards.__dict__)
suite=unittest.defaultTestLoader.loadTestsFromModule(guards)
assert suite.countTestCases()==14
result=unittest.TextTestRunner(verbosity=2).run(suite)
print(json.dumps({'status':'PASS' if result.wasSuccessful() else 'FAILED','pythonVersion':sys.version,'sourceSha256':expected,'compiledSourceCount':len(raws),'guardTestCount':result.testsRun,'timestampApi':'datetime.timezone.utc','tarExtractFilterSupported':True,'rootAbsent':True,'remoteSourceFilesWritten':0,'productionDatabasePathsOpened':0,'productionConnections':0,'dockerOperations':0,'buildsLaunched':0}))
assert result.wasSuccessful()
'''.replace('ENCODED',repr(encoded)).replace('EXPECTED',repr(before))
save('actual-host-inmemory-verification-source.py',probe.encode())
remote=subprocess.run(['ssh','-o','BatchMode=yes','-o','ConnectTimeout=15','root@46.19.33.37','python3','-B','-'],cwd=REPO,input=probe.encode(),capture_output=True,timeout=45)
save('host-stdout-original.json',remote.stdout);save('host-stderr-original.log',remote.stderr)
assert remote.returncode==0 and b'Ran 14 tests' in remote.stderr
host=json.loads(remote.stdout);after={n:hashlib.sha256((SOURCE/n).read_bytes()).hexdigest() for n in raws}
assert before==after and host['sourceSha256']==before and host['status']=='PASS' and host['compiledSourceCount']==5 and host['rootAbsent']
save('exit-original.json',(json.dumps({'status':'PASS','closedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'localExitCode':local.returncode,'hostExitCode':remote.returncode,'localGuardTests':14,'hostGuardTests':14,'sourceSha256Before':before,'sourceSha256After':after,'sourceUnchanged':True,'onlyDelta':'TWO_BUILDER_DATETIME_UTC_TO_TIMEZONE_UTC_REFERENCES','fourOtherFilesIdenticalTo9ef':True,'host':host,'productionConnections':0,'buildsLaunched':0},indent=2)+'\n').encode())
print(json.dumps({'status':'PASS','localGuardTests':14,'actualHostGuardTests':14,'actualHostPython':host['pythonVersion'],'sourceUnchanged':True,'onlyDelta':'TWO_BUILDER_UTC_REFERENCES','sourceSha256':before,'rootAbsent':True,'buildsLaunched':0,'productionConnections':0}))
