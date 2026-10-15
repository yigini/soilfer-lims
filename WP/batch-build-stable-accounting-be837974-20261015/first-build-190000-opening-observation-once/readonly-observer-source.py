import datetime,json,pathlib,subprocess
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
