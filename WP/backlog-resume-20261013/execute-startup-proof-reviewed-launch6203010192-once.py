"""Invoke the reviewed startup launcher exactly once; unknown means inspect same unit."""
import datetime,hashlib,json,pathlib,subprocess,sys
R=pathlib.Path(__file__).resolve().parents[2];S=R/'WP/batch-proof-startup-be837974-20261015';D=S/'execute-reviewed-launch6203010192-once'
P=S/'proof-package-workflow-batch-startup-be837974-20261015T230000Z';L=S/'proof-launch-workflow-batch-startup-be837974-20261015T230000Z'
BASE='6e7036d06e94ab359bc2cf9653c980a673c0e816'
def git(*a):return subprocess.check_output(['git','-c','core.longpaths=true',*a],cwd=R)
assert not D.exists() and not L.exists()
assert git('rev-parse','HEAD').decode().strip()==BASE and git('branch','--show-current').decode().strip()=='audit/release-eb6de2e8' and not git('diff','--cached','--name-only').strip()
record=json.loads((S/'reviewed-package6203010192-publication-once/package-publication-validation.json').read_bytes())
assert record['status']=='APPROVED_STARTUP_PACKAGE_RAW_BYTES_VERIFIED_NOT_LAUNCHED' and record['sourceReviewId']==6203010192 and record['packageFileCount']==42
pub=json.loads((S/'reviewed-package6203010192-publication-once/publication-index.json').read_bytes())
for row in pub['files']:
    raw=git('show',BASE+':'+row['path'])
    assert raw==(R/row['path']).read_bytes() and len(raw)==row['length'] and hashlib.sha256(raw).hexdigest()==row['sha256'] and hashlib.sha1(('blob '+str(len(raw))+'\0').encode()+raw).hexdigest()==row['gitBlobOid'],row['path']
for n,h in record['packageFileHashes'].items():assert hashlib.sha256((P/n).read_bytes()).hexdigest()==h,n
validation=json.loads((S/'actual-source-pass6203010192-once/independent-pass-validation.json').read_bytes())
for n,h in validation['all14SourceHashes'].items():assert (S/n).read_bytes()==(P/n).read_bytes() and hashlib.sha256((S/n).read_bytes()).hexdigest()==h,n
frozen=json.loads((R/'WP/startup-order-readiness-20261015/full-pinned-copy-retention-bound-ordinary-once/source-before.json').read_bytes());assert len(frozen)==1333
for p,h in frozen.items():assert hashlib.sha256((R/p).read_bytes()).hexdigest()==h,p
D.mkdir()
def save(n,raw):
    with (D/n).open('xb') as f:f.write(raw)
args=[sys.executable,'-B',str(S/'launch_proof.py'),'--package',str(P)]
save('intent-once.json',(json.dumps({'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'argv':args,'packagePublication':BASE,'sourceReviewId':6203010192,'futurePackageAllocationBytes':10137600,'oneAttempt':True,'neverReplay':True},indent=2)+'\n').encode())
result=None;error=None
try:
    result=subprocess.run(args,cwd=R,capture_output=True,timeout=600)
    save('stdout-original.log',result.stdout);save('stderr-original.log',result.stderr)
except subprocess.TimeoutExpired as e:
    save('timeout-stdout-original.log',e.stdout or b'');save('timeout-stderr-original.log',e.stderr or b'');error='Launcher outcome uncertain; inspect same root/unit; never replay'
value={'closedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'status':'REVIEWED_STARTUP_LAUNCHER_CLOSED_INSPECT_SAME_UNIT' if result is not None and result.returncode==0 else 'STARTUP_LAUNCH_FAILED_OR_UNKNOWN_RETAIN_ALL_NO_REPLAY','exitCode':result.returncode if result is not None else None,'error':error,'root':'/opt/lims/releases/workflow-batch-startup-be837974-20261015T230000Z','unit':'lims-workflow-batch-startup-be837974-20261015t230000z','proofComplete':False,'retryAllowed':False}
save('exit-original.json',(json.dumps(value,indent=2)+'\n').encode());print(json.dumps(value));raise SystemExit(0 if result is not None and result.returncode==0 else 1)
