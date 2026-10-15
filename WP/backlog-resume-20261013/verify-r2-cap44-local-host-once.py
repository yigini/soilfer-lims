"""One frozen R2 source guard run locally and on actual host in memory; no operators."""
import ast,base64,datetime,hashlib,json,pathlib,subprocess,sys
R=pathlib.Path(__file__).resolve().parents[2];S=R/'WP/r2-cache-cap-acc15844-20261015';D=S/'source-local-host44-once'
assert not D.exists();D.mkdir()
names=['r2_contract.py','r2_cache.py','prepare_r2.py','launch_r2.py','verify_r2.py']
raws={n:(S/n).read_bytes() for n in names};before={n:hashlib.sha256(v).hexdigest() for n,v in raws.items()}
refs={n:(S/'authority-source-preparation-once'/n).read_bytes() for n in ['build-receipt.json','image-inspect-original.json']}
for n,v in raws.items():ast.parse(v,filename=n,feature_version=(3,9))
count=sum(isinstance(n,ast.FunctionDef) and n.name.startswith('test_') for n in ast.walk(ast.parse(raws['verify_r2.py'])))
assert count==44,count
def save(n,v):
    with (D/n).open('xb') as f:f.write(v)
def js(n,v):save(n,(json.dumps(v,indent=2)+'\n').encode())
js('command-original.json',{'startedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'expectedGuardTests':count,'sourceSha256':before,'operatorsExecuted':0})
for n,v in raws.items():save('frozen-'+n,v)
local=subprocess.run([sys.executable,'-B','verify_r2.py'],cwd=S,capture_output=True)
save('local-stdout-original.log',local.stdout);save('local-stderr-original.log',local.stderr)
remote=None;host=None;failure=None
if local.returncode==0 and b'Ran 44 tests' in local.stderr:
    probe='''import base64,hashlib,json,sys,types,unittest
raws={n:base64.b64decode(v) for n,v in ENCODED_VALUE.items()}
refs={n:base64.b64decode(v) for n,v in REFERENCES_VALUE.items()}
expected=EXPECTED_VALUE
assert {n:hashlib.sha256(v).hexdigest() for n,v in raws.items()}==expected
for n,v in raws.items():compile(v,n,'exec')
contract=types.ModuleType('r2_contract');sys.modules[contract.__name__]=contract
exec(compile(raws['r2_contract.py'],'r2_contract.py','exec'),contract.__dict__)
guards=types.ModuleType('r2_guards_inmemory');sys.modules[guards.__name__]=guards
guards.SOURCE_RAW_FILES=raws;guards.REFERENCE_RAW_FILES=refs
exec(compile(raws['verify_r2.py'],'verify_r2.py','exec'),guards.__dict__)
suite=unittest.defaultTestLoader.loadTestsFromModule(guards);assert suite.countTestCases()==44
result=unittest.TextTestRunner(verbosity=2).run(suite)
print(json.dumps({'status':'PASS' if result.wasSuccessful() else 'FAILED','pythonVersion':sys.version,'guardTestCount':result.testsRun,'sourceSha256':expected,'compiledSourceCount':len(raws),'remoteSourceFilesWritten':0,'realDockerCalls':0,'cacheOperations':0,'productionConnections':0}))
assert result.wasSuccessful()
'''.replace('ENCODED_VALUE',repr({n:base64.b64encode(v).decode() for n,v in raws.items()})).replace('REFERENCES_VALUE',repr({n:base64.b64encode(v).decode() for n,v in refs.items()})).replace('EXPECTED_VALUE',repr(before))
    save('host-inmemory-source.py',probe.encode())
    try:
        remote=subprocess.run(['ssh','-o','BatchMode=yes','-o','ConnectTimeout=15','root@46.19.33.37','python3','-B','-'],cwd=R,input=probe.encode(),capture_output=True,timeout=45)
        save('host-stdout-original.json',remote.stdout);save('host-stderr-original.log',remote.stderr)
        host=json.loads(remote.stdout)
    except subprocess.TimeoutExpired as e:
        save('host-timeout-stdout-original.log',e.stdout or b'');save('host-timeout-stderr-original.log',e.stderr or b'');failure='Timeout; never replay'
    except Exception as e:failure=type(e).__name__+': '+str(e)
else:failure='Local failure; host not started'
after={n:hashlib.sha256((S/n).read_bytes()).hexdigest() for n in names}
ok=local.returncode==0 and remote is not None and remote.returncode==0 and host is not None and host.get('status')=='PASS' and host.get('guardTestCount')==44 and host.get('sourceSha256')==before and after==before and failure is None
record={'status':'PASS_R2_SOURCE_GUARDS_NOT_CACHE_EXECUTION' if ok else 'FAILED_R2_SOURCE_GUARDS_RETAIN_ALL','closedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sourceSha256Before':before,'sourceSha256After':after,'sourceUnchanged':before==after,'localExitCode':local.returncode,'localTests':count,'hostExitCode':remote.returncode if remote else None,'host':host,'failure':failure,'operatorsExecuted':0,'cacheOperations':0,'productionConnections':0}
js('exit-original.json',record);print(json.dumps(record));raise SystemExit(0 if ok else 1)
