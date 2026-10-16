"""One closed local+actual-host synthetic source verification. No proof operator."""
import pathlib,subprocess,json,hashlib,os,sys,tempfile,datetime,base64
W=pathlib.Path(__file__).resolve().parents[2];B=W/'WP/controller063000-prechecks-be837974-20261016';D=B/'source-local-host-first-once';assert not D.exists();D.mkdir();sys.dont_write_bytecode=True
sys.path.insert(0,str(B));import diagnostic_contract as c
names=c.SOURCE_NAMES+c.DATA_NAMES
blobs={n:(B/n).read_bytes() for n in names};before={n:hashlib.sha256(v).hexdigest() for n,v in blobs.items()}
for n,raw in blobs.items():
 if n.endswith('.py'):compile(raw,n,'exec')
 p=D/'source-at-attempt'/n;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(raw)
(D/'source-before.json').write_bytes(c.canonical(before)+b'\n')
root=pathlib.Path(tempfile.mkdtemp(prefix='lp063-'));(D/'local-fixture-path.json').write_bytes(c.canonical({'path':str(root),'retained':True}))
boot=r"""
import sys,os,pathlib,subprocess,sqlite3,json,unittest
sys.dont_write_bytecode=True
B=pathlib.Path(sys.argv[1]);fixture=pathlib.Path(sys.argv[2]);os.environ['LIMS_PROOF_GUARD_FIXTURE_DIR']=str(fixture);sys.path.insert(0,str(B))
real_run=subprocess.run
record=pathlib.Path(sys.argv[3])
def closed_run(args,*a,**k):
 if args==['node',str(B/'writer_fingerprint.cjs')]:
  result=real_run(args,*a,**k);record.write_bytes(result.stdout);return result
 raise AssertionError('Real subprocess forbidden in synthetic guard suite')
subprocess.run=closed_run;subprocess.check_output=lambda *a,**k:(_ for _ in ()).throw(AssertionError('Real subprocess forbidden'))
connect=sqlite3.connect
def sqlite_only_new(name,*a,**k):
 from urllib.parse import urlparse,unquote
 value=str(name)
 if value!=':memory:':
  path=pathlib.Path(unquote(urlparse(value).path)) if value.startswith('file:') else pathlib.Path(value)
  if os.name=='nt' and str(path).startswith('\\'):path=pathlib.Path(str(path).lstrip('\\'))
  assert fixture.parent.resolve() in path.resolve().parents and ('lp063-' in str(path) or 'step2-sql' in str(path)),'Only NEW retained synthetic SQLite allowed'
 return connect(name,*a,**k)
sqlite3.connect=sqlite_only_new
import verify_diagnostic as v
v.setUpModule();r=unittest.TextTestRunner(verbosity=2).run(v.suite());raise SystemExit(not r.wasSuccessful())
"""
(D/'local-closed-bootstrap.py').write_bytes(boot.encode())
env=dict(os.environ);env['PYTHONDONTWRITEBYTECODE']='1'
r=subprocess.run([sys.executable,'-B',str(D/'local-closed-bootstrap.py'),str(B),str(root),str(D/'actual-node-response.json')],capture_output=True,env=env,timeout=900)
for name,raw in [('local-stdout.log',r.stdout),('local-stderr.log',r.stderr)]: (D/name).write_bytes(raw)
(D/'local-exit.json').write_bytes(c.canonical({'exitCode':r.returncode,'closedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat()}))
assert before=={n:c.sha((B/n).read_bytes()) for n in names},'Source changed during local suite'
if r.returncode:print(r.stderr.decode('utf-8','replace'));raise SystemExit(r.returncode)
probe=json.loads((D/'actual-node-response.json').read_bytes());probe['producer']='ACTUAL_LOCAL_NODE_UNPATCHED_BOUND_CONTROLLER'
hostroot='/tmp/lims-prechecks-synthetic-20261016T070100Z'
host=r"""
import base64,pathlib,sys,os,json,importlib.abc,importlib.util,subprocess,sqlite3,unittest
sys.dont_write_bytecode=True
ROOT=pathlib.Path(HOSTROOT);assert not ROOT.exists();ROOT.mkdir(mode=0o700)
PAYLOAD=VALUES;PROBE=WRITER
os.environ['LIMS_PROOF_GUARD_FIXTURE_DIR']=str(ROOT);os.environ['LIMS_ACTUAL_WRITER_PROBE_JSON']=json.dumps(PROBE)
class Finder(importlib.abc.MetaPathFinder,importlib.abc.Loader):
 def find_spec(self,n,path=None,target=None):return importlib.util.spec_from_loader(n,self) if n+'.py' in PAYLOAD else None
 def create_module(self,s):return None
 def exec_module(self,m):
  m.__file__=str(ROOT/(m.__name__+'.py'));exec(compile(base64.b64decode(PAYLOAD[m.__name__+'.py']),m.__file__,'exec'),m.__dict__)
sys.meta_path.insert(0,Finder());readbytes=pathlib.Path.read_bytes;readtext=pathlib.Path.read_text
virtual={str(ROOT/n):base64.b64decode(raw) for n,raw in PAYLOAD.items()}
def read_bytes(p):return virtual[str(p)] if str(p) in virtual else readbytes(p)
def read_text(p,encoding=None,errors=None):return virtual[str(p)].decode(encoding or 'utf-8',errors or 'strict') if str(p) in virtual else readtext(p,encoding=encoding,errors=errors)
pathlib.Path.read_bytes=read_bytes;pathlib.Path.read_text=read_text
subprocess.run=lambda *a,**k:(_ for _ in ()).throw(AssertionError('Real host commands forbidden in synthetic suite'))
subprocess.check_output=subprocess.run
connect=sqlite3.connect
def synthetic_only(name,*a,**k):
 from urllib.parse import urlparse,unquote
 value=str(name)
 if value!=':memory:':
  p=pathlib.Path(unquote(urlparse(value).path)) if value.startswith('file:') else pathlib.Path(value)
  assert str(p.resolve()).startswith(str(ROOT)),'Only NEW retained host synthetic SQLite allowed'
 return connect(name,*a,**k)
sqlite3.connect=synthetic_only
import verify_diagnostic as v
v.setUpModule();r=unittest.TextTestRunner(verbosity=2).run(v.suite())
# Unpatched numeric current-process reader, not a production memory sample.
import controller_guard as cg,diagnostic_contract as c
p=cg.numeric_membership_path();assert cg.actual_reader(p)==open(p,'rb').read()
try:cg.own_snapshot(unit=c.UNITS['comparator'])
except RuntimeError as e:assert str(e)=='Exact controller unit membership required'
else:raise AssertionError('Guard unexpectedly running in proposed unit')
print(json.dumps({'python':sys.version,'testsRun':r.testsRun,'failures':len(r.failures),'errors':len(r.errors),'actualNumericReaderPlainBytesEqual':True,'outsideUnitRefusalExact':True,'writerFingerprintProducer':'ACTUAL_LOCAL_NODE_UNPATCHED_BOUND_CONTROLLER','pythonSourceFilesWritten':0,'realDockerCommands':0,'productionSqliteConnections':0}))
raise SystemExit(not r.wasSuccessful())
"""
host=host.replace('HOSTROOT',repr(hostroot)).replace('VALUES',repr({n:base64.b64encode(raw).decode() for n,raw in blobs.items()})).replace('WRITER',repr(probe));compile(host,'actual-host-inmemory-program','exec');(D/'actual-host-inmemory-program.py').write_bytes(host.encode())
r=subprocess.run(['ssh','-o','BatchMode=yes','-o','ConnectTimeout=15','root@46.19.33.37','python3','-B','-'],input=host.encode(),capture_output=True,timeout=900)
for name,raw in [('host-stdout.log',r.stdout),('host-stderr.log',r.stderr)]: (D/name).write_bytes(raw)
(D/'host-exit.json').write_bytes(c.canonical({'exitCode':r.returncode,'closedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat()}))
assert before=={n:c.sha((B/n).read_bytes()) for n in names},'Source changed during host suite'
(D/'exit-original.json').write_bytes(c.canonical({'exitCode':r.returncode,'closedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'allSourcesUnchanged':True,'actualNodeLocal':True,'hostWriterOutputInjectedFromRetainedActualNode':True,'hostSyntheticRoot':hostroot,'hostSourceInMemory':True})+b'\n')
print(r.stdout.decode('utf-8','replace'));print(r.stderr.decode('utf-8','replace')[-10000:]);raise SystemExit(r.returncode)
