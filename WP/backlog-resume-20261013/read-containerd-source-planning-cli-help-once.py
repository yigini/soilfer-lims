"""Existing CLI interface help only for forward source planning; no attribution/adoption execution."""
import datetime,json,pathlib,subprocess
REPO=pathlib.Path(__file__).resolve().parents[2]
DEST=REPO/'WP/batch-release-cde8-20261014/forward-source-containerd-cli-interfaces-once'
assert not DEST.exists();DEST.mkdir()
probe="""import datetime,json,subprocess
rows=[]
for argv in [['ctr','--version'],['ctr','content','--help'],['ctr','snapshots','--help'],['ctr','images','list','--help'],['docker','buildx','du','--help']]:
 try:
  result=subprocess.run(argv,capture_output=True,text=True,timeout=10)
  rows.append({'argv':argv,'exitCode':result.returncode,'stdout':result.stdout,'stderr':result.stderr})
 except subprocess.TimeoutExpired as e:rows.append({'argv':argv,'status':'INTERFACE_HELP_TIMEOUT','timeoutSeconds':10})
print(json.dumps({'status':'EXISTING_CLI_INTERFACE_HELP_ONLY','observedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'commands':rows,'imageInspectCalls':0,'attributionCollectorsRun':0,'imageAdoptions':0,'newReceipts':0,'productionConnections':0,'remoteFilesWritten':0}))
"""
with (DEST/'interface-help-probe-source.py').open('x',encoding='utf-8') as f:f.write(probe)
result=subprocess.run(['ssh','-o','BatchMode=yes','-o','ConnectTimeout=15','root@46.19.33.37','python3','-B','-'],cwd=REPO,input=probe.encode(),capture_output=True,timeout=55)
for name,raw in [('stdout-original.json',result.stdout),('stderr-original.txt',result.stderr)]:
    with (DEST/name).open('xb') as f:f.write(raw)
with (DEST/'exit-original.json').open('x',encoding='utf-8') as f:json.dump({'exitCode':result.returncode,'closedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'sourcePlanningOnly':True},f)
assert result.returncode==0
v=json.loads(result.stdout);print(json.dumps(v,ensure_ascii=False))
