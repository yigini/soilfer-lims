"""Read-only Docker driver/storage metadata after the closed first-build refusal."""
import datetime,json,pathlib,subprocess
REPO=pathlib.Path(__file__).resolve().parents[2]
DEST=REPO/'WP/batch-release-cde8-20261014/closed-build-storage-topology-once'
assert not DEST.exists();DEST.mkdir()
probe="""import datetime,json,pathlib,subprocess
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
"""
with (DEST/'readonly-probe-source.py').open('x',encoding='utf-8') as f:f.write(probe)
result=subprocess.run(['ssh','-o','BatchMode=yes','-o','ConnectTimeout=15','root@46.19.33.37','python3','-B','-'],cwd=REPO,input=probe.encode(),capture_output=True,timeout=60)
for n,raw in [('stdout-original.json',result.stdout),('stderr-original.txt',result.stderr)]:
    with (DEST/n).open('xb') as f:f.write(raw)
with (DEST/'exit-original.json').open('x',encoding='utf-8') as f:json.dump({'exitCode':result.returncode,'closedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'productionOperations':0},f)
assert result.returncode==0
print(result.stdout.decode())
