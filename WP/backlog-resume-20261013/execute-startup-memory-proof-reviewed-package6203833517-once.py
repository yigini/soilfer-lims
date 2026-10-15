"""One approved startup proof package preparation; no host connection."""
import datetime,hashlib,json,pathlib,subprocess,sys
R=pathlib.Path(__file__).resolve().parents[2];S=R/'WP/batch-proof-memory-events-be837974-20261015';D=S/'execute-reviewed-package6203833517-once'
assert not D.exists() and not (S/'proof-package-workflow-batch-startup-memory-be837974-20261015T233000Z').exists()
assert subprocess.check_output(['git','rev-parse','HEAD'],cwd=R).decode().strip()=='1cef228d8d4c53b6ffa4ccaed5aa4366919d529d'
assert subprocess.check_output(['git','branch','--show-current'],cwd=R).decode().strip()=='audit/release-eb6de2e8'
assert not subprocess.check_output(['git','diff','--cached','--name-only'],cwd=R).strip()
record=json.loads((S/'actual-source-pass6203833517-once/independent-pass-validation.json').read_bytes())
assert record['status']=='ACTUAL_NEW_EXACT_STARTUP_SOURCE_PASS_VALIDATED_NOT_EXECUTED' and record['literalBindings']==125
before={n:hashlib.sha256((S/n).read_bytes()).hexdigest() for n in record['all15SourceHashes']}
assert before==record['all15SourceHashes'];D.mkdir()
def save(n,raw):
    with (D/n).open('xb') as f:f.write(raw)
args=[sys.executable,'-B',str(S/'prepare_proof.py'),'--tooling-commit','dd14f90814b7994bf06598623dae095b29d04f0b','--source-review-id','6203833517']
save('intent-once.json',(json.dumps({'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'argv':args,'sourceSha256':before,'neverReplay':True,'hostConnections':0,'operationalExecutions':0},indent=2)+'\n').encode())
result=None;error=None
try:
    result=subprocess.run(args,cwd=R,capture_output=True,timeout=300)
    save('stdout-original.log',result.stdout);save('stderr-original.log',result.stderr)
except subprocess.TimeoutExpired as e:
    save('timeout-stdout-original.log',e.stdout or b'');save('timeout-stderr-original.log',e.stderr or b'');error='Local package outcome uncertain; inspect same package, never replay'
after={n:hashlib.sha256((S/n).read_bytes()).hexdigest() for n in before}
value={'closedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'status':'APPROVED_STARTUP_PROOF_LOCAL_PACKAGE_PREPARED' if result is not None and result.returncode==0 and after==before else 'FAILED_OR_UNKNOWN_PACKAGE_RETAIN_ALL_NO_REPLAY','exitCode':result.returncode if result is not None else None,'error':error,'sourceSha256Before':before,'sourceSha256After':after,'hostConnections':0,'operationalExecutions':0}
save('exit-original.json',(json.dumps(value,indent=2)+'\n').encode());print(json.dumps(value));raise SystemExit(0 if value['status']=='APPROVED_STARTUP_PROOF_LOCAL_PACKAGE_PREPARED' else 1)
