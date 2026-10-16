"""Invoke the unchanged reviewed privacy diagnostic launcher exactly once."""
import datetime,hashlib,json,pathlib,subprocess,sys
sys.dont_write_bytecode=True
W=pathlib.Path(__file__).resolve().parents[2];B=W/'WP/jobs-row-diagnostic-private-be837974-20261016'
D=B/'execute-reviewed-launch6206544265-once';P=B/'package-workflow-batch-row-diagnostic-be837974-20261016T023000Z';V=B/'reviewed-package6206544265-publication-once'
BASE='b8073dccf52848841295245383397cb4d5fbe4f2'
def git(*a):return subprocess.check_output(['git','-c','core.longpaths=true',*a],cwd=W)
def sha(b):return hashlib.sha256(b).hexdigest()
def oid(b):return hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()
assert git('rev-parse','HEAD').decode().strip()==BASE and git('branch','--show-current').decode().strip()=='audit/release-eb6de2e8' and not git('diff','--cached','--name-only').strip()
assert not D.exists() and not (B/'launch-once').exists()
pub=json.loads((V/'publication-index.json').read_bytes())
for r in pub['bindings']:
    b=git('show',BASE+':'+r['path']);assert b==(W/r['path']).read_bytes() and len(b)==r['bytes'] and sha(b)==r['sha256'] and oid(b)==r['gitBlobOid'],r['path']
assert git('show',BASE+':'+str((V/'publication-index.json').relative_to(W)).replace('\\','/'))==(V/'publication-index.json').read_bytes()
record=json.loads((V/'package-publication-validation.json').read_bytes())
assert record['status']=='APPROVED_PRIVATE_DIAGNOSTIC_PACKAGE_VERIFIED_NOT_LAUNCHED' and record['sourceReviewId']==6206544265 and record['futurePackageAllocationBytes']==5586944
assert {p.name for p in P.iterdir()}==set(record['packageFileHashes']) and len(record['packageFileHashes'])==15
for n,h in record['packageFileHashes'].items():assert sha((P/n).read_bytes())==h,n
index=json.loads((P/'source-index.json').read_bytes());before={n:sha((B/n).read_bytes()) for n in index['files']};assert len(before)==8
sys.path.insert(0,str(B));import diagnostic_contract as c,prepare_diagnostic as prep
c.approval(json.loads((P/'source-review.json').read_bytes()),index);prep.published(index)
D.mkdir()
def save(n,b):
    with (D/n).open('xb') as f:f.write(b)
args=[sys.executable,'-B',str(B/'launch_diagnostic.py'),str(P)]
save('intent-once.json',(json.dumps({'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'argv':args,'packagePublication':BASE,'sourceReviewId':6206544265,'neverReplay':True,'unknownOutcomeInspectSameRootUnit':True,'sourceSha256':before})+'\n').encode())
result=None;error=None
try:
    result=subprocess.run(args,cwd=W,capture_output=True,timeout=900);save('stdout-original.log',result.stdout);save('stderr-original.log',result.stderr)
except subprocess.TimeoutExpired as e:
    save('timeout-stdout-original.log',e.stdout or b'');save('timeout-stderr-original.log',e.stderr or b'');error='Unknown launch outcome; inspect SAME root/unit; never redispatch'
after={n:sha((B/n).read_bytes()) for n in before};ok=result is not None and result.returncode==0 and after==before
value={'closedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'status':'PRIVATE_DIAGNOSTIC_LAUNCHER_CLOSED_INSPECT_SAME_ROOT_UNIT' if ok else 'FAILED_OR_UNKNOWN_LAUNCH_RETAIN_ALL_INSPECT_SAME_ROOT_UNIT_NO_REPLAY','exitCode':result.returncode if result is not None else None,'error':error,'sourceBefore':before,'sourceAfter':after,'neverReplay':True,'actualDiagnosticResultNotYetObserved':True}
save('exit-original.json',(json.dumps(value,indent=2)+'\n').encode());print(json.dumps(value));raise SystemExit(0 if ok else 1)
