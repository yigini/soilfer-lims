import datetime,json,pathlib,subprocess
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
