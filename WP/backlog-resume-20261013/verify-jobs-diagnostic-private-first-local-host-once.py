"""One new local then Linux synthetic suite, retain all source/log/exit originals."""
import base64,datetime,hashlib,json,pathlib,subprocess,sys
R=pathlib.Path(__file__).resolve().parents[2];S=R/'WP/jobs-row-diagnostic-private-be837974-20261016';D=S/'guards-private-first-local-host-once'
assert not D.exists();D.mkdir();(D/'local-fixtures').mkdir()
names=['diagnostic_authority','diagnostic_contract','diagnostic_io','diagnostic_compare','prepare_diagnostic','launch_diagnostic','verify_diagnostic','run_diagnostic']
sources={n:(S/(n+'.py')).read_bytes() for n in names};pins={n:hashlib.sha256(b).hexdigest() for n,b in sources.items()}
for n,b in sources.items():compile(b,n,'exec');(D/(n+'-source-at-attempt.py')).write_bytes(b)
def write(n,v):(D/n).write_bytes(json.dumps(v,sort_keys=True).encode()+b'\n')
write('source-before.json',pins)
local_program='''import sys,os,unittest,subprocess,socket
sys.path.insert(0,sys.argv[1]);os.environ['DIAGNOSTIC_FIXTURE_ROOT']=sys.argv[2]
import verify_diagnostic
def blocked(*a,**kw):raise RuntimeError('Real subprocess/network blocked in new synthetic guards')
subprocess.run=blocked;subprocess.Popen=blocked;subprocess.check_output=blocked;socket.socket=blocked;socket.create_connection=blocked
r=unittest.TextTestRunner(verbosity=2).run(unittest.defaultTestLoader.loadTestsFromModule(verify_diagnostic))
sys.exit(0 if r.wasSuccessful() else 1)
'''
(D/'local-program.py').write_bytes(local_program.encode());r=subprocess.run([sys.executable,'-B',str(D/'local-program.py'),str(S),str(D/'local-fixtures')],cwd=R,capture_output=True,timeout=180)
(D/'local.stdout').write_bytes(r.stdout);(D/'local.stderr').write_bytes(r.stderr);write('local-exit.json',{'exitCode':r.returncode,'closedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat()})
assert all(hashlib.sha256((S/(n+'.py')).read_bytes()).hexdigest()==h for n,h in pins.items())
if r.returncode:
 write('exit-original.json',{'status':'LOCAL_SYNTHETIC_GUARD_FAILURE_HOST_NOT_STARTED','exitCode':1});print(r.stderr.decode(errors='replace'));sys.exit(1)
app_name='application-source-originals/server/services/sampleHoldService.js'
payload={'app':{app_name:base64.b64encode((S/app_name).read_bytes()).decode()},'sources':{n:base64.b64encode(b).decode() for n,b in sources.items()},'data':base64.b64encode((S/'diagnostic-pins.json').read_bytes()).decode()}
program="import json,base64\nP=json.loads(base64.b64decode('"+base64.b64encode(json.dumps(payload).encode()).decode()+"'))\n"+'''
import sys,os,pathlib,types,unittest,subprocess,socket
root=pathlib.Path('/tmp/lims-owned-row-diagnostic-private-guards-20261016T022000Z');assert not root.exists();root.mkdir(mode=0o700)
os.environ['DIAGNOSTIC_FIXTURE_ROOT']=str(root)
source={n:base64.b64decode(b) for n,b in P['sources'].items()};virtual=pathlib.Path('/__row_diagnostic_inmemory__/source');original_bytes=pathlib.Path.read_bytes;original_text=pathlib.Path.read_text
def read_bytes(p):
 try: relative=p.relative_to(virtual).as_posix()
 except ValueError: relative=None
 if relative in P['app']:return base64.b64decode(P['app'][relative])
 if p.parent==virtual:
  if p.name=='diagnostic-pins.json':return base64.b64decode(P['data'])
  if p.stem in source:return source[p.stem]
 return original_bytes(p)
def read_text(p,*a,**kw):
 if virtual in p.parents:return read_bytes(p).decode('utf-8')
 return original_text(p,*a,**kw)
pathlib.Path.read_bytes=read_bytes;pathlib.Path.read_text=read_text
for name in ['diagnostic_authority','diagnostic_contract','diagnostic_io','diagnostic_compare','prepare_diagnostic','launch_diagnostic','verify_diagnostic','run_diagnostic']:
 m=types.ModuleType(name);m.__file__=str(virtual/(name+'.py'));sys.modules[name]=m;exec(compile(source[name],m.__file__,'exec'),m.__dict__)
def blocked(*a,**kw):raise RuntimeError('Real subprocess/network blocked in new synthetic guards')
subprocess.run=blocked;subprocess.Popen=blocked;subprocess.check_output=blocked;socket.socket=blocked;socket.create_connection=blocked
r=unittest.TextTestRunner(verbosity=2).run(unittest.defaultTestLoader.loadTestsFromModule(sys.modules['verify_diagnostic']))
print('HOST_PYTHON='+sys.version.split()[0]+';SYNTHETIC_ROOT='+str(root)+';REAL_OPERATORS=0;PRODUCTION_SQL=0;SOURCE_FILES=0')
sys.exit(0 if r.wasSuccessful() else 1)
'''
compile(program,'actual-host-synthetic-program','exec');(D/'host-program.py').write_bytes(program.encode())
r=subprocess.run(['ssh','-o','BatchMode=yes','-o','ConnectTimeout=15','root@46.19.33.37','python3','-B','-'],input=program.encode(),cwd=R,capture_output=True,timeout=180)
(D/'host.stdout').write_bytes(r.stdout);(D/'host.stderr').write_bytes(r.stderr);write('host-exit.json',{'exitCode':r.returncode,'closedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat()})
after={n:hashlib.sha256((S/(n+'.py')).read_bytes()).hexdigest() for n in names};write('source-after.json',after);assert after==pins
write('exit-original.json',{'status':'NEW_DIAGNOSTIC_SYNTHETIC_GUARDS_PASS_BOTH' if r.returncode==0 else 'HOST_SYNTHETIC_GUARDS_FAILED','exitCode':r.returncode,'allSourcesUnchanged':True})
print(r.stderr.decode(errors='replace'));print(r.stdout.decode(errors='replace'));sys.exit(r.returncode)
