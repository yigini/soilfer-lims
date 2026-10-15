import pathlib,subprocess,json,datetime
root=pathlib.Path('/opt/lims/releases/workflow-batch-forward-metadata-cde8c889-20261015T000500Z')
unit='lims-workflow-batch-forward-metadata-cde8c889-20261015t000500z'
raw=subprocess.check_output(['systemctl','show',unit,'--property=LoadState,ActiveState,SubState,Result,ExecMainStatus,MainPID,InvocationID,ExecMainStartTimestamp,ExecMainExitTimestamp,MemoryMax,MemorySwapMax,RuntimeMaxUSec']).decode()
props=dict(v.split('=',1) for v in raw.splitlines() if '=' in v)
closed=props['MainPID']=='0' and props['ActiveState'] in ['failed','inactive']
p=root/'metadata-evidence-terminal.json'
print(json.dumps({'observedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'root':str(root),'unit':unit,'properties':props,'closed':closed,'terminal':json.loads(p.read_bytes()) if closed and p.is_file() else None,'metadataOperatorsDispatched':0,'imageAdoptions':0}))
