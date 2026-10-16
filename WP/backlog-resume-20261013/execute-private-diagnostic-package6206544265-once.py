"""Invoke the unchanged reviewed diagnostic preparer once, locally."""
import datetime,hashlib,json,pathlib,subprocess,sys
W=pathlib.Path(__file__).resolve().parents[2];B=W/'WP/jobs-row-diagnostic-private-be837974-20261016'
D=B/'execute-reviewed-package6206544265-once';P=B/'package-workflow-batch-row-diagnostic-be837974-20261016T023000Z';V=B/'actual-source-pass6206544265-once'
BASE='b5a6c3113459576a68177f2c1b31b97067357065'
def git(*a):return subprocess.check_output(['git','-c','core.longpaths=true',*a],cwd=W)
def sha(b):return hashlib.sha256(b).hexdigest()
assert git('rev-parse','HEAD').decode().strip()==BASE and git('branch','--show-current').decode().strip()=='audit/release-eb6de2e8' and not git('diff','--cached','--name-only').strip() and not D.exists() and not P.exists()
pub=json.loads((V/'publication-index.json').read_bytes())
for r in pub['bindings']:
    b=git('show',BASE+':'+r['path']);assert b==(W/r['path']).read_bytes() and len(b)==r['bytes'] and sha(b)==r['sha256'],r['path']
record=json.loads((V/'independent-pass-validation.json').read_bytes());assert record['status']=='ACTUAL_EXACT_PRIVATE_DIAGNOSTIC_SOURCE_PASS_VALIDATED_NOT_EXECUTED' and record['sourceReviewId']==6206544265
index=json.loads((V/'source-index.json').read_bytes());before={n:sha((B/n).read_bytes()) for n in index['files']};assert len(before)==8
D.mkdir()
def save(n,b):
    with (D/n).open('xb') as f:f.write(b)
args=[sys.executable,'-B',str(B/'prepare_diagnostic.py'),str(V/'source-index.json'),str(V/'actual-source-pass-original.json')]
save('intent-once.json',(json.dumps({'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'argv':args,'passPublication':BASE,'neverReplay':True,'sourceSha256':before,'hostConnections':0})+'\n').encode())
result=None;error=None
try:
    result=subprocess.run(args,cwd=W,capture_output=True,timeout=300);save('stdout-original.log',result.stdout);save('stderr-original.log',result.stderr)
except subprocess.TimeoutExpired as e:
    save('timeout-stdout-original.log',e.stdout or b'');save('timeout-stderr-original.log',e.stderr or b'');error='Unknown package outcome; inspect same package; never replay'
after={n:sha((B/n).read_bytes()) for n in before};ok=result is not None and result.returncode==0 and after==before
value={'closedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'status':'APPROVED_PRIVATE_DIAGNOSTIC_LOCAL_PACKAGE_PREPARED' if ok else 'FAILED_OR_UNKNOWN_PACKAGE_RETAIN_ALL_NO_REPLAY','exitCode':result.returncode if result else None,'error':error,'sourceBefore':before,'sourceAfter':after,'hostConnections':0,'actualDiagnosticSql':0}
save('exit-original.json',(json.dumps(value,indent=2)+'\n').encode());print(json.dumps(value));raise SystemExit(0 if ok else 1)
