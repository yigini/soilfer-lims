"""One frozen NEW stable-accounting source guard run, local and actual host in memory. No operator."""
import ast,base64,datetime,hashlib,json,pathlib,subprocess,sys
R=pathlib.Path(__file__).resolve().parents[2]
S=R/'WP/batch-build-stable-accounting-be837974-20261015'
D=S/'source-local-host-verification39-once'
assert not D.exists();D.mkdir()
names=['batch_build_contract.py','batch_build.py','prepare_batch_build.py','launch_batch_build.py','verify_build_guards.py']
raws={n:(S/n).read_bytes() for n in names}
before={n:hashlib.sha256(v).hexdigest() for n,v in raws.items()}
for n,v in raws.items():ast.parse(v,filename=n,feature_version=(3,9))
count=sum(isinstance(node,ast.FunctionDef) and node.name.startswith('test_') for node in ast.walk(ast.parse(raws['verify_build_guards.py'])))
assert count==39,count
def save(n,value):
    with (D/n).open('xb') as f:f.write(value)
def js(n,value):save(n,(json.dumps(value,indent=2)+'\n').encode())
js('command-original.json',{'startedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sourceSha256Before':before,'expectedTests':count,'operatorsExecuted':0,'productionConnections':0})
for n,v in raws.items():save('frozen-'+n,v)
local=subprocess.run([sys.executable,'-B','verify_build_guards.py'],cwd=S,capture_output=True)
save('local-stdout-original.log',local.stdout);save('local-stderr-original.log',local.stderr)
host=None;remote=None;failure=None
if local.returncode==0 and ('Ran '+str(count)+' tests').encode() in local.stderr:
    encoded={n:base64.b64encode(v).decode() for n,v in raws.items()}
    probe="""import base64,hashlib,json,sys,types,unittest
encoded=ENCODED_VALUE
expected=EXPECTED_VALUE
raws={n:base64.b64decode(v) for n,v in encoded.items()}
assert {n:hashlib.sha256(v).hexdigest() for n,v in raws.items()}==expected
for n,raw in raws.items():compile(raw,n,'exec')
contract=types.ModuleType('batch_build_contract');sys.modules[contract.__name__]=contract
exec(compile(raws['batch_build_contract.py'],'batch_build_contract.py','exec'),contract.__dict__)
guards=types.ModuleType('startup_build_guard_memory');sys.modules[guards.__name__]=guards
guards.SOURCE_RAW_FILES=raws
exec(compile(raws['verify_build_guards.py'],'verify_build_guards.py','exec'),guards.__dict__)
suite=unittest.defaultTestLoader.loadTestsFromModule(guards);assert suite.countTestCases()==COUNT_VALUE
result=unittest.TextTestRunner(verbosity=2).run(suite)
print(json.dumps({'status':'PASS' if result.wasSuccessful() else 'FAILED','pythonVersion':sys.version,'sourceSha256':expected,'compiledSourceCount':len(raws),'guardTestCount':result.testsRun,'sourceFilesWrittenOnHost':0,'operatorsExecuted':0,'productionConnections':0}))
assert result.wasSuccessful()
""".replace('ENCODED_VALUE',repr(encoded)).replace('EXPECTED_VALUE',repr(before)).replace('COUNT_VALUE',str(count))
    save('host-inmemory-verification-source.py',probe.encode())
    try:
        remote=subprocess.run(['ssh','-o','BatchMode=yes','-o','ConnectTimeout=15','root@46.19.33.37','python3','-B','-'],cwd=R,input=probe.encode(),capture_output=True,timeout=45)
        save('host-stdout-original.json',remote.stdout);save('host-stderr-original.log',remote.stderr)
        try:host=json.loads(remote.stdout)
        except Exception as e:failure=type(e).__name__+': '+str(e)
    except subprocess.TimeoutExpired as e:
        save('host-timeout-stdout-original.log',e.stdout or b'');save('host-timeout-stderr-original.log',e.stderr or b'')
        failure='Host verification timeout; never replay'
else:failure='Local guard tests failed; host not started'
after={n:hashlib.sha256((S/n).read_bytes()).hexdigest() for n in names}
ok=local.returncode==0 and remote is not None and remote.returncode==0 and host is not None and host.get('status')=='PASS' and host.get('sourceSha256')==before and before==after and failure is None
record={'status':'PASS_NEW_BUILD_SOURCE_GUARDS_NOT_EXECUTION' if ok else 'FAILED_NEW_BUILD_SOURCE_GUARDS_RETAIN_ALL','closedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'localExitCode':local.returncode,'hostExitCode':remote.returncode if remote else None,'localGuardTests':count,'actualHostGuardTests':host.get('guardTestCount') if host else None,'sourceSha256Before':before,'sourceSha256After':after,'sourceUnchanged':before==after,'host':host,'failure':failure,'operatorsExecuted':0,'productionConnections':0}
js('exit-original.json',record)
print(json.dumps({k:v for k,v in record.items() if k not in ['host','sourceSha256Before','sourceSha256After']}))
raise SystemExit(0 if ok else 1)

