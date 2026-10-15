"""One actual reviewed R2 launcher invocation; uncertain outcomes never redispatch."""
import datetime,hashlib,json,pathlib,subprocess,sys
R=pathlib.Path(__file__).resolve().parents[2];S=R/'WP/r2-cache-cap-acc15844-20261015';D=S/'execute-reviewed-launch6200950139-once'
assert not D.exists() and not (S/'launch-reviewed-r2-once').exists()
assert subprocess.check_output(['git','rev-parse','HEAD'],cwd=R).decode().strip()=='598bcb3d189d7934e88f4db1d9bcb2cb8c3948ab'
assert not subprocess.check_output(['git','diff','--cached','--name-only'],cwd=R).strip()
record=json.loads((S/'reviewed-package-and-native-agreement-publication-once/package-publication-validation.json').read_bytes())
assert record['status']=='APPROVED_R2_PACKAGE_RAW_BYTES_VERIFIED_NOT_LAUNCHED' and record['sourceReviewId']==6200950139
for n,h in record['packageFileHashes'].items():assert hashlib.sha256((S/'reviewed-r2-package-once'/n).read_bytes()).hexdigest()==h,n
D.mkdir()
def save(n,v):
    with (D/n).open('xb') as f:f.write(v)
args=[sys.executable,'-B',str(S/'launch_r2.py'),'--package',str(S/'reviewed-r2-package-once')]
save('intent-once.json',(json.dumps({'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'argv':args,'packagePublication':'598bcb3d189d7934e88f4db1d9bcb2cb8c3948ab','sourceReviewId':6200950139,'neverReplay':True},indent=2)+'\n').encode())
result=None;error=None
try:
    result=subprocess.run(args,cwd=R,capture_output=True,timeout=600)
    save('stdout-original.log',result.stdout);save('stderr-original.log',result.stderr)
except subprocess.TimeoutExpired as e:
    save('timeout-stdout-original.log',e.stdout or b'');save('timeout-stderr-original.log',e.stderr or b'');error='Launcher outcome uncertain; inspect same root/unit; never retry'
value={'closedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'status':'REVIEWED_R2_LAUNCHER_CLOSED_INSPECT_SAME_UNIT' if result is not None and result.returncode==0 else 'R2_LAUNCH_FAILED_OR_UNKNOWN_RETAIN_ALL_NO_REPLAY','exitCode':result.returncode if result else None,'error':error,'root':'/opt/lims/cleanup-receipts/r2-cache-acc15844-20261015T210000Z','unit':'lims-r2-cache-acc15844-20261015t210000z','operationComplete':False,'retryAllowed':False}
save('exit-original.json',(json.dumps(value,indent=2)+'\n').encode());print(json.dumps(value));raise SystemExit(0 if result is not None and result.returncode==0 else 1)
