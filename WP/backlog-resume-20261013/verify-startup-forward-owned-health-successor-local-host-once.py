"""New frozen-source tests only, with new local/host synthetic fixtures retained."""
import ast,base64,datetime,hashlib,json,os,pathlib,subprocess,sys
REPO=pathlib.Path(__file__).resolve().parents[2];S=REPO/'WP/batch-proof-startup-forward-cde8-20261015';D=S/'source-local-host-verification-owned-health-successor-once';assert not D.exists();D.mkdir();sys.path.insert(0,str(S))
from proof_contract import FILES
raws={n:(S/n).read_bytes() for n in sorted(FILES)};before={n:hashlib.sha256(b).hexdigest() for n,b in raws.items()};expected=sum(isinstance(n,ast.FunctionDef) and n.name.startswith('test_') for n in ast.walk(ast.parse(raws['verify_proof_guards.py'])))
def save(n,b):
 with (D/n).open('xb') as f:f.write(b)
(D/'source-at-attempt').mkdir()
for n,b in raws.items():ast.parse(b,filename=n,feature_version=(3,9));(D/'source-at-attempt'/n).write_bytes(b)
save('command-original.json',json.dumps({'startedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sourceHashes':before,'expectedTests':expected,'scope':'PURE_GUARDS_NEW_SYNTHETIC_FIXTURES_ONLY','operators':0}).encode())
env={**os.environ,'LIMS_PROOF_GUARD_FIXTURE_DIR':str(pathlib.Path(os.environ['TEMP'])/'lsf2-20261015')}
local=subprocess.run([sys.executable,'-X','utf8','-B','verify_proof_guards.py'],cwd=S,env=env,capture_output=True,timeout=120)
save('local-stdout-original.log',local.stdout);save('local-stderr-original.log',local.stderr)
if local.returncode!=0:
 save('exit-original.json',json.dumps({'status':'LOCAL_FAILED_HOST_NOT_STARTED','localExitCode':local.returncode,'hostStarted':False,'expectedTests':expected,'sourceSha256Before':before,'sourceSha256After':{n:hashlib.sha256((S/n).read_bytes()).hexdigest() for n in raws},'closedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'operators':0},indent=2).encode());raise RuntimeError('Retain initial failure; no replay')
assert ('Ran '+str(expected)+' tests').encode() in local.stderr
payload={**raws,'compose-source.yml':(S/'compose-source.yml').read_bytes(),**{'bound-input-records/'+p.name:p.read_bytes() for p in (S/'bound-input-records').iterdir() if p.is_file()}}
encoded={n:base64.b64encode(b).decode() for n,b in payload.items()}
probe='''import base64,hashlib,json,os,pathlib,subprocess,sys,datetime
encoded=ENCODED_VALUE
expected=HASH_VALUE
root=pathlib.Path('/tmp/lims-startup-forward-guard-source-20261015T081500Z');assert not root.exists();root.mkdir(mode=0o700)
for n,v in encoded.items():
 rel=pathlib.PurePosixPath(n);assert not rel.is_absolute() and '..' not in rel.parts;p=root/n;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(base64.b64decode(v))
assert {n:hashlib.sha256((root/n).read_bytes()).hexdigest() for n in expected}==expected
for n in expected:compile((root/n).read_bytes(),n,'exec')
env={**os.environ,'LIMS_PROOF_GUARD_FIXTURE_DIR':'/tmp/lims-startup-forward-guard-fixture-20261015T081500Z'}
r=subprocess.run([sys.executable,'-B',str(root/'verify_proof_guards.py')],cwd=root,env=env,capture_output=True,timeout=90)
sys.stderr.buffer.write(r.stderr);sys.stdout.buffer.write(r.stdout)
print(json.dumps({'status':'PASS' if r.returncode==0 else 'FAILED','exitCode':r.returncode,'pythonVersion':sys.version,'sourceSha256Before':expected,'sourceSha256After':{n:hashlib.sha256((root/n).read_bytes()).hexdigest() for n in expected},'expectedTests':TEST_COUNT_VALUE,'sourceRoot':str(root),'newFixtureRoot':env['LIMS_PROOF_GUARD_FIXTURE_DIR'],'productionConnections':0,'operatorsExecuted':0,'dockerCreates':0,'fixturesRetained':True,'closedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat()}))
assert r.returncode==0
'''.replace('ENCODED_VALUE',repr(encoded)).replace('HASH_VALUE',repr(before)).replace('TEST_COUNT_VALUE',str(expected))
save('host-verification-source.py',probe.encode());host=subprocess.run(['ssh','-o','BatchMode=yes','-o','ConnectTimeout=15','root@46.19.33.37','python3','-B','-'],cwd=REPO,input=probe.encode(),capture_output=True,timeout=120)
save('host-stdout-original.json',host.stdout);save('host-stderr-original.log',host.stderr)
after={n:hashlib.sha256((S/n).read_bytes()).hexdigest() for n in raws};status='PASS' if host.returncode==0 and before==after else 'HOST_FAILED_OR_SOURCE_CHANGED'
record={'status':status,'localExitCode':local.returncode,'hostExitCode':host.returncode,'expectedTests':expected,'sourceSha256Before':before,'sourceSha256After':after,'sourceUnchanged':before==after,'closedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'operators':0,'productionConnections':0,'hostFixturesRetained':True};save('exit-original.json',json.dumps(record,indent=2).encode());assert status=='PASS' and ('Ran '+str(expected)+' tests').encode() in host.stderr,'Retain host failure; never replay'
rows=[json.loads(l) for l in host.stdout.splitlines() if l.startswith(b'{')];assert rows[-1]['sourceSha256Before']==rows[-1]['sourceSha256After']==before
print(json.dumps({'status':status,'localTests':expected,'actualHostTests':expected,'pythonHost':rows[-1]['pythonVersion'],'sourceUnchanged':True,'operators':0}))
