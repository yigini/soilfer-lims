import datetime,json,pathlib,subprocess
def output(args):
 result=subprocess.run(args,capture_output=True,text=True)
 return {'argv':args,'exitCode':result.returncode,'stdout':result.stdout,'stderr':result.stderr}
root=pathlib.Path('/var/lib/containerd')
facts={'status':'READONLY_STORAGE_TOPOLOGY_AFTER_REFUSAL','observedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'driverStatus':output(['docker','info','--format','{{json .DriverStatus}}']),'dockerRoot':output(['docker','info','--format','{{.DockerRootDir}}']),'containerdUnit':output(['systemctl','show','containerd','--property=LoadState,ActiveState,MainPID,ExecStart,FragmentPath']),'candidateStoragePath':str(root),'candidatePathExists':root.is_dir(),'candidatePathSymlink':root.is_symlink(),'productionDatabasePathsOpened':0,'productionConnections':0,'buildsLaunched':0,'imagesRetagged':0,'cleanupOperations':0}
if root.is_dir() and not root.is_symlink():
 facts['candidateStorageDevice']=root.stat().st_dev
 facts['candidateStorageAllocation']=output(['du','-s','-B1','-x','--',str(root)])
 facts['topLevelStorageNames']=sorted(p.name for p in root.iterdir())
print(json.dumps(facts))
