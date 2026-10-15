"""One approved corrected R2 local package preparation; no host connection."""
import datetime,hashlib,json,pathlib,subprocess,sys
R=pathlib.Path(__file__).resolve().parents[2];S=R/'WP/r2-cache-cap-render-acc15844-20261015';D=S/'execute-reviewed-package6201434518-once'
assert not D.exists() and not (S/'reviewed-r2-package-once').exists()
assert subprocess.check_output(['git','rev-parse','HEAD'],cwd=R).decode().strip()=='b899b8ef188a549f82a2da959712f4ddd898af8a'
assert not subprocess.check_output(['git','diff','--cached','--name-only'],cwd=R).strip()
record=json.loads((S/'actual-source-pass6201434518-once/independent-pass-validation.json').read_bytes())
assert record['status']=='ACTUAL_NEW_EXACT_R2_SOURCE_PASS_VALIDATED_NOT_EXECUTED' and record['allLiteralBindingsCount']==41
names=['r2_contract.py','r2_cache.py','prepare_r2.py','launch_r2.py','verify_r2.py'];before={n:hashlib.sha256((S/n).read_bytes()).hexdigest() for n in names}
assert before==record['allFiveSourceHashes'];D.mkdir()
def save(n,v):
    with (D/n).open('xb') as f:f.write(v)
args=[sys.executable,'-B',str(S/'prepare_r2.py'),'--source-head','4eccae1525af20b4d40c7b1cbfbf6c1b931e1e97','--source-review-id','6201434518']
save('intent-once.json',(json.dumps({'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'argv':args,'sourceSha256':before,'neverReplay':True,'hostConnections':0,'cacheOperations':0},indent=2)+'\n').encode())
result=None;error=None
try:
    result=subprocess.run(args,cwd=R,capture_output=True,timeout=300)
    save('stdout-original.log',result.stdout);save('stderr-original.log',result.stderr)
except subprocess.TimeoutExpired as e:
    save('timeout-stdout-original.log',e.stdout or b'');save('timeout-stderr-original.log',e.stderr or b'');error='Local package preparation outcome uncertain; inspect same package, never replay'
after={n:hashlib.sha256((S/n).read_bytes()).hexdigest() for n in names}
value={'closedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'status':'APPROVED_R2_LOCAL_PACKAGE_PREPARED' if result is not None and result.returncode==0 and after==before else 'FAILED_OR_UNKNOWN_PACKAGE_RETAIN_ALL_NO_REPLAY','exitCode':result.returncode if result is not None else None,'error':error,'sourceSha256Before':before,'sourceSha256After':after,'hostConnections':0,'cacheOperations':0}
save('exit-original.json',(json.dumps(value,indent=2)+'\n').encode());print(json.dumps(value));raise SystemExit(0 if value['status']=='APPROVED_R2_LOCAL_PACKAGE_PREPARED' else 1)
