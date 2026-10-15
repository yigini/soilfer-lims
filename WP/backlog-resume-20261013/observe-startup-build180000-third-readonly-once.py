"""Third same-unit metadata observation; preserve bounded active log tail honestly."""
import datetime,json,pathlib,subprocess
R=pathlib.Path(__file__).resolve().parents[2];D=R/'WP/batch-build-startup-be837974-20261015/third-build-180000-readonly-observation-once'
assert not D.exists();D.mkdir()
probe=r'''import datetime,json,pathlib,subprocess
root=pathlib.Path('/opt/lims/releases/workflow-batch-build-be837974-20261015T180000Z');unit='lims-workflow-batch-build-be837974-20261015t180000z'
assert root.is_dir() and not root.is_symlink()
r=subprocess.run(['systemctl','show',unit,'--property=LoadState,ActiveState,SubState,Result,ExecMainStatus,MainPID,InvocationID,MemoryCurrent,MemoryPeak,MemoryMax,MemorySwapMax,RuntimeMaxUSec'],capture_output=True,timeout=15);assert len(r.stdout)<=65536 and len(r.stderr)<=65536
props=dict(s.split('=',1) for s in r.stdout.decode().splitlines() if '=' in s);closed=props.get('MainPID')=='0' and props.get('ActiveState') in ['inactive','failed']
records={}
if closed:
 for n in ['build-receipt.json','build-preflight-refusal.json','build-terminal-failure.json']:
  p=root/n
  if p.exists():assert p.is_file() and not p.is_symlink() and p.stat().st_size<=2097152;records[n]=json.loads(p.read_bytes())
tail=None;p=root/'docker-build.log'
if p.exists():
 assert p.is_file() and not p.is_symlink()
 with p.open('rb') as f:f.seek(max(0,p.stat().st_size-4096));tail=f.read(4096).decode('utf-8','replace')
print(json.dumps({'observedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'closed':closed,'properties':props,'systemctlExitCode':r.returncode,'systemctlStderr':r.stderr.decode(),'records':records,'boundedBuildLogTail':tail,'logTailRole':'FRESH_BOUNDED_OBSERVATION_NOT_ORIGINAL_CLOSED_LOG','rootFileCount':len(list(root.iterdir())),'buildsProofsCleanupProductionOperationsByObserver':0}))
'''
def save(n,v):
 with (D/n).open('xb') as f:f.write(v)
save('readonly-observer-source.py',probe.encode())
r=subprocess.run(['ssh','-o','BatchMode=yes','-o','ConnectTimeout=15','root@46.19.33.37','python3','-B','-'],cwd=R,input=probe.encode(),capture_output=True,timeout=45)
save('stdout-original.json',r.stdout);save('stderr-original.log',r.stderr);save('exit-original.json',(json.dumps({'exitCode':r.returncode,'closedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat()})+'\n').encode())
assert r.returncode==0,r.stderr.decode('utf-8','replace')
v=json.loads(r.stdout);print(json.dumps(v))
