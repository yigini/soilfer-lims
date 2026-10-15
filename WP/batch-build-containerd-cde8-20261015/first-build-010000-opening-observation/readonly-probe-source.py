import pathlib,subprocess,json,datetime
r=pathlib.Path('/opt/lims/releases/workflow-batch-build-cde8c889-20261015T010000Z');u='lims-workflow-batch-build-cde8c889-20261015t010000z'
raw=subprocess.check_output(['systemctl','show',u,'--property=LoadState,ActiveState,SubState,Result,ExecMainStatus,MainPID,InvocationID,ExecMainStartTimestamp,ExecMainExitTimestamp,MemoryMax,MemorySwapMax,RuntimeMaxUSec']).decode();props=dict(v.split('=',1) for v in raw.splitlines() if '=' in v)
closed=props['MainPID']=='0' and props['ActiveState'] in ['inactive','failed']
files=sorted(v.name for v in r.iterdir())
terminalNames=[n for n in ['build-preflight-refusal.json','build-terminal-failure.json','build-receipt.json'] if (r/n).is_file()]
print(json.dumps({'observedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'root':str(r),'unit':u,'properties':props,'closed':closed,'ownedFileNames':files,'terminalRecords':{n:json.loads((r/n).read_bytes()) for n in terminalNames} if closed else {},'activeLogsCapturedAsClosed':False,'newLaunches':0,'newBuildsDispatched':0,'databaseConnections':0}))
