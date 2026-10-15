import datetime,json,pathlib,subprocess
root=pathlib.Path('/opt/lims/releases/workflow-batch-build-be837974-20261015T180000Z');unit='lims-workflow-batch-build-be837974-20261015t180000z'
r=subprocess.run(['systemctl','show',unit,'--property=LoadState,ActiveState,SubState,Result,ExecMainStatus,MainPID,InvocationID,MemoryPeak,MemoryMax,MemorySwapMax,RuntimeMaxUSec'],capture_output=True,timeout=15);assert len(r.stdout)<=65536
p=dict(v.split('=',1) for v in r.stdout.decode().splitlines() if '=' in v);closed=p.get('MainPID')=='0' and p.get('ActiveState') in ['inactive','failed'];records={}
if closed:
 for n in ['build-receipt.json','build-preflight-refusal.json','build-terminal-failure.json']:
  f=root/n
  if f.exists():assert f.is_file() and not f.is_symlink() and f.stat().st_size<=2097152;records[n]=json.loads(f.read_bytes())
print(json.dumps({'observedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'closed':closed,'properties':p,'terminalRecords':records,'topLevelNames':sorted(v.name for v in root.iterdir()),'observerBuildsProofsCleanupProductionOperations':0}))
