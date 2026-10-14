"""Bounded read-only topology classification; never repeat the refused recursive allocation probe."""
import datetime,json,pathlib,subprocess
REPO=pathlib.Path(__file__).resolve().parents[2]
DEST=REPO/'WP/batch-release-cde8-20261014/closed-build-bounded-topology-no-du-once'
assert not DEST.exists();DEST.mkdir()
probe="""import datetime,hashlib,json,pathlib,subprocess
def output(args):
 try:
  result=subprocess.run(args,capture_output=True,text=True,timeout=10)
  return {'argv':args,'exitCode':result.returncode,'stdout':result.stdout,'stderr':result.stderr}
 except subprocess.TimeoutExpired as e:
  return {'argv':args,'status':'READONLY_QUERY_TIMEOUT','timeoutSeconds':10,'stdout':(e.stdout or b'').decode(),'stderr':(e.stderr or b'').decode()}
root=pathlib.Path('/var/lib/containerd')
facts={'status':'READONLY_BOUNDED_TOPOLOGY_NO_ALLOCATION_REPLAY','observedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'driverStatus':output(['docker','info','--format','{{json .DriverStatus}}']),'dockerRoot':output(['docker','info','--format','{{.DockerRootDir}}']),'containerdUnit':output(['systemctl','show','containerd','--property=LoadState,ActiveState,MainPID,ExecStart,FragmentPath']),'candidateStoragePath':str(root),'candidatePathExists':root.is_dir(),'candidatePathSymlink':root.is_symlink(),'duProcessesReadOnly':output(['ps','-C','du','-o','pid=,ppid=,lstart=,args=']),'productionDatabasePathsOpened':0,'productionConnections':0,'buildsLaunched':0,'imagesRetagged':0,'cleanupOperations':0,'allocationMeasured':False}
config=output(['containerd','config','dump'])
if config.get('exitCode')==0:
 selected=[]
 for line in config['stdout'].splitlines():
  if line.strip().startswith('['):break
  if line.strip().startswith(('root =','state =','version =')):selected.append(line)
 facts['containerdTopLevelConfig']={'argv':config['argv'],'exitCode':0,'selectedTopLevelLines':selected,'fullConfigurationStored':False}
else:facts['containerdConfigQuery']={k:v for k,v in config.items() if k!='stdout'}
if root.is_dir() and not root.is_symlink():
 facts['candidateStorageDevice']=root.stat().st_dev
 facts['topLevelStorageNames']=sorted(p.name for p in root.iterdir())
print(json.dumps(facts))
"""
with (DEST/'readonly-probe-source.py').open('x',encoding='utf-8') as f:f.write(probe)
try:result=subprocess.run(['ssh','-o','BatchMode=yes','-o','ConnectTimeout=15','root@46.19.33.37','python3','-B','-'],cwd=REPO,input=probe.encode(),capture_output=True,timeout=55)
except subprocess.TimeoutExpired as e:
    for n,raw in [('stdout-partial.txt',e.stdout or b''),('stderr-partial.txt',e.stderr or b'')]:
        with (DEST/n).open('xb') as f:f.write(raw)
    raise
for n,raw in [('stdout-original.json',result.stdout),('stderr-original.txt',result.stderr)]:
    with (DEST/n).open('xb') as f:f.write(raw)
with (DEST/'exit-original.json').open('x',encoding='utf-8') as f:json.dump({'exitCode':result.returncode,'closedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'productionOperations':0},f)
assert result.returncode==0;print(result.stdout.decode())
