import datetime,json,pathlib,subprocess
root=pathlib.Path('/opt/lims/releases/workflow-batch-build-cde8c889-20261014T221500Z')
unit='lims-workflow-batch-build-cde8c889-20261014t221500z'
result=subprocess.run(['systemctl','show',unit,'--property=LoadState,ActiveState,SubState,Result,ExecMainStatus,ExecMainStartTimestamp,ExecMainExitTimestamp,MainPID,InvocationID,RuntimeMaxUSec'],capture_output=True,text=True,check=True)
properties=dict(line.split('=',1) for line in result.stdout.splitlines() if '=' in line)
print(json.dumps({'status':'READONLY_SAME_BUILD_UNIT_OBSERVATION','observedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'root':str(root),'unit':unit,'properties':properties,'ownedInventory':sorted(p.name for p in root.iterdir()),'buildReceiptExists':(root/'build-receipt.json').is_file(),'terminalFailureExists':(root/'build-terminal-failure.json').is_file(),'activeBuildLogsRead':False,'databasePathsOpened':0,'databaseConnections':0,'newUnitsLaunched':0,'newBuildsDispatched':0}))
