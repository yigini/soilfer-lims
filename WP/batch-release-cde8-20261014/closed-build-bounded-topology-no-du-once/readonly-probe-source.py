import datetime,hashlib,json,pathlib,subprocess
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
