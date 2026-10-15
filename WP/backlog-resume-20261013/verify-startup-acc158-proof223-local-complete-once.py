"""Local223 actual-source guard tests only. Host tests held during YY reboot."""
import ast,datetime,hashlib,json,os,pathlib,subprocess,sys
repo=pathlib.Path(__file__).resolve().parents[2];source=repo/'WP/batch-proof-startup-be837974-20261015'
dest=source/'local-guard223-complete-attempt-once';assert not dest.exists();dest.mkdir();sys.path.insert(0,str(source))
from proof_contract import FILES
raws={n:(source/n).read_bytes() for n in sorted(FILES)}
before={n:hashlib.sha256(b).hexdigest() for n,b in raws.items()}
count=sum(isinstance(n,ast.FunctionDef) and n.name.startswith('test_') for n in ast.walk(ast.parse(raws['verify_proof_guards.py'])))
assert count==223
def save(n,b):
    with (dest/n).open('xb') as f:f.write(b)
snapshot=dest/'source-at-attempt';snapshot.mkdir()
for n,b in raws.items():ast.parse(b,filename=n,feature_version=(3,9));compile(b,n,'exec');(snapshot/n).write_bytes(b)
env={**os.environ,'LIMS_PROOF_GUARD_FIXTURE_DIR':str(pathlib.Path(os.environ['TEMP'])/'lims-acc158-guard223-20261015T214000Z')}
save('command-original.json',json.dumps({'startedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sourceHashes':before,'testCount':count,'scope':'LOCAL_SYNTHETIC_GUARDS_ONLY','serverHold6202483884':True,'hostSteps':0,'operatorsExecuted':0,'fixture':env['LIMS_PROOF_GUARD_FIXTURE_DIR']},indent=2).encode())
error=None
try:
    result=subprocess.run([sys.executable,'-X','utf8','-B','verify_proof_guards.py'],cwd=source,env=env,capture_output=True,timeout=180);code=result.returncode;out=result.stdout;err=result.stderr
except subprocess.TimeoutExpired as e:code=None;out=e.stdout or b'';err=e.stderr or b'';error='LOCAL_TEST_TIMEOUT_RETAIN_NO_REPLAY'
save('local-stdout-original.log',out);save('local-stderr-original.log',err)
after={n:hashlib.sha256((source/n).read_bytes()).hexdigest() for n in raws}
record={'status':'LOCAL_PASS_HOST_HELD_NOT_STARTED' if code==0 and before==after else 'LOCAL_FAILED_HOST_NOT_STARTED','closedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'exitCode':code,'error':error,'expectedTests':count,'sourceSha256Before':before,'sourceSha256After':after,'hostSteps':0,'operatorsExecuted':0,'productionConnections':0,'fixturesRetained':True}
save('exit-original.json',json.dumps(record,indent=2).encode());print(json.dumps({k:v for k,v in record.items() if not k.startswith('sourceSha')}));assert code==0 and before==after and ('Ran '+str(count)+' tests').encode() in err,'Retain full local failure; do not replay'

