"""Observe the same new build unit once. Metadata/logs only; never launch or retry."""
import datetime,json,pathlib,subprocess
R=pathlib.Path(__file__).resolve().parents[2];S=R/'WP/batch-build-stable-accounting-be837974-20261015'
D=S/'first-build-190000-opening-observation-once'
assert not D.exists();D.mkdir()
probe=r'''import datetime,json,pathlib,subprocess
root=pathlib.Path('/opt/lims/releases/workflow-batch-build-be837974-20261015T190000Z');unit='lims-workflow-batch-build-be837974-20261015t190000z'
assert root.is_dir() and not root.is_symlink()
p=subprocess.run(['systemctl','show',unit,'--property=LoadState,ActiveState,SubState,Result,ExecMainStatus,MainPID,InvocationID,ExecMainStartTimestamp,ExecMainExitTimestamp,MemoryCurrent,MemoryPeak,MemoryMax,MemorySwapMax,RuntimeMaxUSec'],capture_output=True,timeout=15)
assert len(p.stdout)<=65536 and len(p.stderr)<=65536
props=dict(v.split('=',1) for v in p.stdout.decode().splitlines() if '=' in v)
closed=props.get('MainPID')=='0' and props.get('ActiveState') in ['inactive','failed']
files=sorted(p.name for p in root.iterdir());assert len(files)<=256
term={}
if closed:
 for n in ['build-receipt.json','build-preflight-refusal.json','build-terminal-failure.json']:
  f=root/n
  if f.exists():assert f.is_file() and not f.is_symlink() and f.stat().st_size<=2097152;term[n]=json.loads(f.read_bytes())
print(json.dumps({'observedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'root':str(root),'unit':unit,'closed':closed,'properties':props,'systemctlExitCode':p.returncode,'systemctlStderr':p.stderr.decode(),'ownedTopLevelNames':files,'terminalRecords':term,'activeLogsClaimedClosed':False,'buildsLaunchedByObserver':0,'databaseConnections':0,'proofs':0,'cleanup':0,'productionOperations':0}))
'''
def save(n,v):
 with (D/n).open('xb') as f:f.write(v)
save('readonly-observer-source.py',probe.encode())
argv=['ssh','-o','BatchMode=yes','-o','ConnectTimeout=15','root@46.19.33.37','python3','-B','-']
save('command-original.json',(json.dumps({'observedStartedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'argv':argv,'observerOnly':True,'neverReplay':True})+'\n').encode())
r=subprocess.run(argv,cwd=R,input=probe.encode(),capture_output=True,timeout=45)
save('stdout-original.json',r.stdout);save('stderr-original.log',r.stderr)
save('exit-original.json',(json.dumps({'exitCode':r.returncode,'closedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat()})+'\n').encode())
assert r.returncode==0,r.stderr.decode('utf-8','replace')
v=json.loads(r.stdout);print(json.dumps(v))
