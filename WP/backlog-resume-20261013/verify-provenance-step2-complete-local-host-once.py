"""NEW Step2 local and actual-host guards. In-memory host sources, closed fake interfaces only."""
import ast,base64,datetime,hashlib,json,os,pathlib,subprocess,sys
repo=pathlib.Path(__file__).resolve().parents[2];source=repo/'WP/batch-proof-provenance-step2-be837974-20261016';dest=source/'source-local-host-step2-complete-once';assert not dest.exists();dest.mkdir();sys.path.insert(0,str(source))
from proof_contract import FILES
from proof_render import render
from proof_app_sources import APP_PINS
raws={n:(source/n).read_bytes() for n in sorted(FILES)};before={n:hashlib.sha256(b).hexdigest() for n,b in raws.items()}
count=sum(isinstance(n,ast.FunctionDef) and n.name.startswith('test_') for f in ['verify_proof_guards.py','verify_jobs_guards.py','verify_provenance_guards.py'] for n in ast.walk(ast.parse(raws[f])));assert count>300
def save(n,b):
    with (dest/n).open('xb') as f:f.write(b)
snapshot=dest/'source-at-attempt';snapshot.mkdir()
for n,b in raws.items():
 if n.endswith('.py'):ast.parse(b,filename=n,feature_version=(3,9));compile(b,n,'exec')
 (snapshot/n).write_bytes(b)
env={**os.environ,'LIMS_PROOF_GUARD_FIXTURE_DIR':str(pathlib.Path(os.environ['TEMP'])/'lims-provenance-step2-guards-complete-20261016T032000Z')}
save('command-original.json',json.dumps({'startedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sourceHashes':before,'staticallyDefinedTestCount':count,'scope':'LOCAL_AND_HOST_SYNTHETIC_GUARDS_ONLY','actualResumption6202595120':True,'operatorsExecuted':0,'fixture':env['LIMS_PROOF_GUARD_FIXTURE_DIR']},indent=2).encode())
local_program=r"""import unittest,subprocess,sys,sqlite3,os;from unittest import mock
from urllib.parse import unquote
real_connect=sqlite3.connect
def connect(path,*a,**kw):
 value=unquote(str(path)).replace('file:///','').replace('file:','').split('?')[0]
 base=os.environ['LIMS_PROOF_GUARD_FIXTURE_DIR'].replace('\\','/')
 if str(path)!=':memory:' and not value.replace('\\','/').startswith(base):raise AssertionError('SQLite outside NEW retained synthetic fixtures forbidden: '+value)
 return real_connect(path,*a,**kw)
blocked=lambda *a,**k:(_ for _ in ()).throw(AssertionError('Real process forbidden in LOCAL guard tests'))
import provenance_privacy as privacy
privacy.install_value_key(bytes(range(32)))
suite=unittest.TestSuite([unittest.defaultTestLoader.loadTestsFromName(n) for n in ['verify_proof_guards','verify_jobs_guards','verify_provenance_guards']])
print(__import__('json').dumps({'testsExpected':suite.countTestCases()}))
with mock.patch.object(subprocess,'run',blocked),mock.patch.object(subprocess,'check_output',blocked),mock.patch.object(subprocess,'Popen',blocked),mock.patch.object(sqlite3,'connect',connect):result=unittest.TextTestRunner(verbosity=2).run(suite)
sys.exit(not result.wasSuccessful())
""".replace('\n+','\n')
save('local-inmemory-verification-source.py',local_program.encode())
local=subprocess.run([sys.executable,'-X','utf8','-B','-c',local_program],cwd=source,env=env,capture_output=True,timeout=240)
save('local-stdout-original.log',local.stdout);save('local-stderr-original.log',local.stderr)
if local.returncode:
    save('exit-original.json',json.dumps({'status':'LOCAL_FAILED_HOST_NOT_STARTED','closedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'localExitCode':local.returncode,'sourceHashes':before,'hostStarted':False}).encode());raise RuntimeError('Local failure retained; do not replay')
count=json.loads(local.stdout)['testsExpected'];assert ('Ran '+str(count)+' tests').encode() in local.stderr
payload={**raws,'compose-source.yml':(source/'compose-source.yml').read_bytes()}
for sub in ['bound-input-records','new-authority-fixtures']:
    payload.update({sub+'/'+p.name:p.read_bytes() for p in (source/sub).iterdir() if p.is_file()})
payload.update({'application-source-fixtures/'+n:(source/'application-source-fixtures'/n).read_bytes() for n in APP_PINS})
encoded={n:base64.b64encode(b).decode() for n,b in payload.items()}
template=r'''import base64,hashlib,json,os,pathlib,subprocess,sys,types,unittest,datetime,sqlite3
from urllib.parse import unquote
from unittest import mock
encoded=ENCODED_VALUE;expected=EXPECTED_VALUE
payload={n:base64.b64decode(v) for n,v in encoded.items()}
assert {n:hashlib.sha256(payload[n]).hexdigest() for n in expected}==expected
virtual='/in-memory/owned-guard/WP/batch-proof-provenance-step2-be837974-20261016/'
read_bytes=pathlib.Path.read_bytes;read_text=pathlib.Path.read_text
def virtual_bytes(p):
 key=str(p)
 return payload[key[len(virtual):]] if key.startswith(virtual) and key[len(virtual):] in payload else read_bytes(p)
def virtual_text(p,encoding=None,errors=None):
 key=str(p)
 return virtual_bytes(p).decode(encoding or 'utf-8',errors or 'strict') if key.startswith(virtual) and key[len(virtual):] in payload else read_text(p,encoding=encoding,errors=errors)
for n in ['proof_render.py','proof_app_sources.py','proof_budget.py','proof_contract.py','proof_files.py','proof_health.py','proof_inputs.py','proof_disk.py','proof_docker.py','proof_memory.py','proof_startup.py','runtime_proof_policies.py','capture_kobo_fetch.py','provenance_privacy.py','provenance_rules.py','kobo_copy_preservation.py','proof_jobs.py','controller_guard.py','stop_owned.py','prepare_proof.py','launch_proof.py','run_stopped_proof.py','verify_proof_guards.py','verify_jobs_guards.py','verify_provenance_guards.py']:
 m=types.ModuleType(n[:-3]);m.__file__=virtual+n;sys.modules[n[:-3]]=m;exec(compile(payload[n],n,'exec'),m.__dict__)
os.environ['LIMS_PROOF_COPY_SITE_SOURCES']=json.dumps({n:encoded[n] for n in sys.modules['proof_budget'].EXPECTED_SITES})
os.environ['LIMS_PROOF_GUARD_FIXTURE_DIR']=FIXTURE_VALUE
real_connect=sqlite3.connect
def only_synthetic(path,*a,**kw):
 value=unquote(str(path)).replace('file:///','').replace('file:','').split('?')[0]
 if str(path)!=':memory:' and not value.startswith(os.environ['LIMS_PROOF_GUARD_FIXTURE_DIR']):raise AssertionError('SQLite outside NEW synthetic host fixtures')
 return real_connect(path,*a,**kw)

def blocked(*args,**kwargs):raise AssertionError('Real process/Docker/cache/operator forbidden in host guard tests')
import provenance_privacy as privacy
privacy.install_value_key(bytes(range(32)))
suite=unittest.TestSuite([unittest.defaultTestLoader.loadTestsFromModule(sys.modules[n]) for n in ['verify_proof_guards','verify_jobs_guards','verify_provenance_guards']]);assert suite.countTestCases()==COUNT_VALUE
with mock.patch.object(sqlite3,'connect',only_synthetic),mock.patch.object(pathlib.Path,'read_bytes',virtual_bytes),mock.patch.object(pathlib.Path,'read_text',virtual_text),mock.patch.object(subprocess,'run',blocked),mock.patch.object(subprocess,'check_output',blocked),mock.patch.object(subprocess,'Popen',blocked):
 result=unittest.TextTestRunner(verbosity=2).run(suite)
print(json.dumps({'status':'PASS' if result.wasSuccessful() else 'FAILED','testsRun':result.testsRun,'pythonVersion':sys.version,'sourceSha256':expected,'compiledSources':len(expected),'syntheticFixtureRoot':os.environ['LIMS_PROOF_GUARD_FIXTURE_DIR'],'sourceFilesWritten':0,'actualDockerCalls':0,'cacheCalls':0,'productionSqliteConnections':0,'proofOperatorsExecuted':0,'syntheticFixturesRetained':True,'closedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat()}))
assert result.wasSuccessful()
'''
program=render(template,{'ENCODED_VALUE':encoded,'EXPECTED_VALUE':before,'FIXTURE_VALUE':'/tmp/lims-provenance-step2-guards-complete-20261016T032000Z','COUNT_VALUE':count},'actual-host-guard270')
save('host-inmemory-verification-source.py',program)
host=subprocess.run(['ssh','-o','BatchMode=yes','-o','ConnectTimeout=15','root@46.19.33.37','python3','-B','-'],cwd=repo,input=program,capture_output=True,timeout=180)
save('host-stdout-original.json',host.stdout);save('host-stderr-original.log',host.stderr)
after={n:hashlib.sha256((source/n).read_bytes()).hexdigest() for n in raws}
record={'status':'PASS' if host.returncode==0 and before==after else 'HOST_FAILED_OR_SOURCE_CHANGED','closedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'localExitCode':local.returncode,'hostExitCode':host.returncode,'expectedTests':count,'sourceSha256Before':before,'sourceSha256After':after,'sourceUnchanged':before==after,'proofOperatorsExecuted':0,'productionSqliteConnections':0,'hostSourceFilesWritten':0}
save('exit-original.json',json.dumps(record,indent=2).encode())
print(json.dumps({k:v for k,v in record.items() if not k.startswith('sourceSha')}));assert host.returncode==0 and before==after and ('Ran '+str(count)+' tests').encode() in host.stderr,'Host result retained; never replay'
v=json.loads(host.stdout);assert v['status']=='PASS' and v['testsRun']==count and v['sourceSha256']==before and '3.9.23' in v['pythonVersion']

