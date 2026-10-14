"""One read-only observation of the same first build unit; never read active build logs as closed."""
import datetime,json,pathlib,subprocess
REPO=pathlib.Path(__file__).resolve().parents[2]
DEST=REPO/'WP/batch-release-cde8-20261014/first-build-221500-opening-observation'
assert not DEST.exists();DEST.mkdir()
probe="""import datetime,json,pathlib,subprocess
root=pathlib.Path('/opt/lims/releases/workflow-batch-build-cde8c889-20261014T221500Z')
unit='lims-workflow-batch-build-cde8c889-20261014t221500z'
result=subprocess.run(['systemctl','show',unit,'--property=LoadState,ActiveState,SubState,Result,ExecMainStatus,ExecMainStartTimestamp,ExecMainExitTimestamp,MainPID,InvocationID,RuntimeMaxUSec'],capture_output=True,text=True,check=True)
properties=dict(line.split('=',1) for line in result.stdout.splitlines() if '=' in line)
print(json.dumps({'status':'READONLY_SAME_BUILD_UNIT_OBSERVATION','observedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'root':str(root),'unit':unit,'properties':properties,'ownedInventory':sorted(p.name for p in root.iterdir()),'buildReceiptExists':(root/'build-receipt.json').is_file(),'terminalFailureExists':(root/'build-terminal-failure.json').is_file(),'activeBuildLogsRead':False,'databasePathsOpened':0,'databaseConnections':0,'newUnitsLaunched':0,'newBuildsDispatched':0}))
"""
with (DEST/'readonly-probe-source.py').open('x',encoding='utf-8') as f:f.write(probe)
result=subprocess.run(['ssh','-o','BatchMode=yes','-o','ConnectTimeout=15','root@46.19.33.37','python3','-B','-'],cwd=REPO,input=probe.encode(),capture_output=True,timeout=40)
for name,raw in [('stdout-original.json',result.stdout),('stderr-original.txt',result.stderr)]:
    with (DEST/name).open('xb') as f:f.write(raw)
with (DEST/'exit-original.json').open('x',encoding='utf-8') as f:json.dump({'exitCode':result.returncode,'observedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'readOnly':True,'newBuildsDispatched':0},f)
assert result.returncode==0
observed=json.loads(result.stdout);print(json.dumps(observed))
