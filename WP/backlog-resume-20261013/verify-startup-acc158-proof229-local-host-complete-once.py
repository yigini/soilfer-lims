"""229 local and actual-host guards. In-memory host sources, closed fake interfaces only."""
import ast,base64,datetime,hashlib,json,os,pathlib,subprocess,sys
repo=pathlib.Path(__file__).resolve().parents[2];source=repo/'WP/batch-proof-startup-be837974-20261015';dest=source/'source-local-host229-complete-once';assert not dest.exists();dest.mkdir();sys.path.insert(0,str(source))
from proof_contract import FILES
from proof_render import render
from proof_app_sources import APP_PINS
raws={n:(source/n).read_bytes() for n in sorted(FILES)};before={n:hashlib.sha256(b).hexdigest() for n,b in raws.items()}
count=sum(isinstance(n,ast.FunctionDef) and n.name.startswith('test_') for n in ast.walk(ast.parse(raws['verify_proof_guards.py'])));assert count==229
def save(n,b):
    with (dest/n).open('xb') as f:f.write(b)
snapshot=dest/'source-at-attempt';snapshot.mkdir()
for n,b in raws.items():ast.parse(b,filename=n,feature_version=(3,9));compile(b,n,'exec');(snapshot/n).write_bytes(b)
env={**os.environ,'LIMS_PROOF_GUARD_FIXTURE_DIR':str(pathlib.Path(os.environ['TEMP'])/'lims-acc158-guard229-20261015T215000Z')}
save('command-original.json',json.dumps({'startedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sourceHashes':before,'testCount':count,'scope':'LOCAL_AND_HOST_SYNTHETIC_GUARDS_ONLY','actualResumption6202595120':True,'operatorsExecuted':0,'fixture':env['LIMS_PROOF_GUARD_FIXTURE_DIR']},indent=2).encode())
local=subprocess.run([sys.executable,'-X','utf8','-B','verify_proof_guards.py'],cwd=source,env=env,capture_output=True,timeout=180)
save('local-stdout-original.log',local.stdout);save('local-stderr-original.log',local.stderr)
if local.returncode:
    save('exit-original.json',json.dumps({'status':'LOCAL_FAILED_HOST_NOT_STARTED','closedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'localExitCode':local.returncode,'sourceHashes':before,'hostStarted':False}).encode());raise RuntimeError('Local failure retained; do not replay')
assert b'Ran 229 tests' in local.stderr
payload={**raws,'compose-source.yml':(source/'compose-source.yml').read_bytes()}
for sub in ['bound-input-records','new-authority-fixtures']:
    payload.update({sub+'/'+p.name:p.read_bytes() for p in (source/sub).iterdir() if p.is_file()})
payload.update({'application-source-fixtures/'+n:(source/'application-source-fixtures'/n).read_bytes() for n in APP_PINS})
encoded={n:base64.b64encode(b).decode() for n,b in payload.items()}
template=r'''import base64,hashlib,json,os,pathlib,subprocess,sys,types,unittest,datetime
from unittest import mock
encoded=ENCODED_VALUE;expected=EXPECTED_VALUE
payload={n:base64.b64decode(v) for n,v in encoded.items()}
assert {n:hashlib.sha256(payload[n]).hexdigest() for n in expected}==expected
virtual='/in-memory/owned-guard/WP/batch-proof-startup-be837974-20261015/'
read_bytes=pathlib.Path.read_bytes;read_text=pathlib.Path.read_text
def virtual_bytes(p):
 key=str(p)
 return payload[key[len(virtual):]] if key.startswith(virtual) and key[len(virtual):] in payload else read_bytes(p)
def virtual_text(p,encoding=None,errors=None):
 key=str(p)
 return virtual_bytes(p).decode(encoding or 'utf-8',errors or 'strict') if key.startswith(virtual) and key[len(virtual):] in payload else read_text(p,encoding=encoding,errors=errors)
for n in ['proof_render.py','proof_app_sources.py','proof_budget.py','proof_contract.py','proof_files.py','proof_health.py','proof_inputs.py','proof_disk.py','proof_docker.py','proof_startup.py','prepare_proof.py','launch_proof.py','run_stopped_proof.py','verify_proof_guards.py']:
 m=types.ModuleType(n[:-3]);m.__file__=virtual+n;sys.modules[n[:-3]]=m;exec(compile(payload[n],n,'exec'),m.__dict__)
os.environ['LIMS_PROOF_COPY_SITE_SOURCES']=json.dumps({n:encoded[n] for n in sys.modules['proof_budget'].EXPECTED_SITES})
os.environ['LIMS_PROOF_GUARD_FIXTURE_DIR']=FIXTURE_VALUE
def blocked(*args,**kwargs):raise AssertionError('Real process/Docker/cache/operator forbidden in host guard tests')
suite=unittest.defaultTestLoader.loadTestsFromModule(sys.modules['verify_proof_guards']);assert suite.countTestCases()==COUNT_VALUE
with mock.patch.object(pathlib.Path,'read_bytes',virtual_bytes),mock.patch.object(pathlib.Path,'read_text',virtual_text),mock.patch.object(subprocess,'run',blocked),mock.patch.object(subprocess,'check_output',blocked),mock.patch.object(subprocess,'Popen',blocked):
 result=unittest.TextTestRunner(verbosity=2).run(suite)
print(json.dumps({'status':'PASS' if result.wasSuccessful() else 'FAILED','testsRun':result.testsRun,'pythonVersion':sys.version,'sourceSha256':expected,'compiledSources':len(expected),'syntheticFixtureRoot':os.environ['LIMS_PROOF_GUARD_FIXTURE_DIR'],'sourceFilesWritten':0,'actualDockerCalls':0,'cacheCalls':0,'productionSqliteConnections':0,'proofOperatorsExecuted':0,'syntheticFixturesRetained':True,'closedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat()}))
assert result.wasSuccessful()
'''
program=render(template,{'ENCODED_VALUE':encoded,'EXPECTED_VALUE':before,'FIXTURE_VALUE':'/tmp/lims-acc158-guard229-20261015T215000Z','COUNT_VALUE':count},'actual-host-guard229')
save('host-inmemory-verification-source.py',program)
host=subprocess.run(['ssh','-o','BatchMode=yes','-o','ConnectTimeout=15','root@46.19.33.37','python3','-B','-'],cwd=repo,input=program,capture_output=True,timeout=180)
save('host-stdout-original.json',host.stdout);save('host-stderr-original.log',host.stderr)
after={n:hashlib.sha256((source/n).read_bytes()).hexdigest() for n in raws}
record={'status':'PASS' if host.returncode==0 and before==after else 'HOST_FAILED_OR_SOURCE_CHANGED','closedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'localExitCode':local.returncode,'hostExitCode':host.returncode,'expectedTests':count,'sourceSha256Before':before,'sourceSha256After':after,'sourceUnchanged':before==after,'proofOperatorsExecuted':0,'productionSqliteConnections':0,'hostSourceFilesWritten':0}
save('exit-original.json',json.dumps(record,indent=2).encode())
print(json.dumps({k:v for k,v in record.items() if not k.startswith('sourceSha')}));assert host.returncode==0 and before==after and b'Ran 229 tests' in host.stderr,'Host result retained; never replay'
v=json.loads(host.stdout);assert v['status']=='PASS' and v['testsRun']==229 and v['sourceSha256']==before and '3.9.23' in v['pythonVersion']

