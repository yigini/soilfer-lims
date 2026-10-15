"""YY disk question via6186928334: metadata/du only, no cleanup or DB connection."""
import datetime,json,pathlib,stat,subprocess,time
began=datetime.datetime.now(datetime.timezone.utc).isoformat();commands=[]
def run(label,args,timeout=300,limit=8*1024**2):
 start=time.monotonic()
 try:
  r=subprocess.run(args,capture_output=True,timeout=timeout);out,err,code=r.stdout,r.stderr,r.returncode;error=None
 except subprocess.TimeoutExpired as e:
  out,err,code,error=e.stdout or b'',e.stderr or b'',None,'TIMEOUT_NO_RETRY'
 assert len(out)<=limit and len(err)<=limit,'Output bound: preserve this failed capture, never replay'
 row={'label':label,'argv':args,'elapsedSeconds':time.monotonic()-start,'exitCode':code,'error':error,'stdoutOriginal':out.decode('utf-8','strict'),'stderrOriginal':err.decode('utf-8','strict')};commands.append(row);return row
root=pathlib.Path('/opt/lims/releases');assert root.is_dir() and not root.is_symlink()
dirs=sorted(p for p in root.iterdir() if p.is_dir() and not p.is_symlink());assert len(dirs)<=1000
metadata=[]
for p in dirs:
 receipts=[]
 for q in sorted(p.glob('*.json')):
  if q.stat().st_size>4*1024**2 or not any(t in q.name for t in ['receipt','refusal','result','terminal','failed','failure','stop']):continue
  try:v=json.loads(q.read_bytes())
  except (ValueError,UnicodeDecodeError):continue
  if isinstance(v,dict):receipts.append({'file':q.name,'selected':{k:v[k] for k in ['status','closedUtc','error','recovery','neverRetry','deployedUtc','completedUtc'] if k in v}})
 metadata.append({'root':str(p),'directoryMtimeNs':p.stat().st_mtime_ns,'directoryCtimeNsNotCreation':p.stat().st_ctime_ns,'selectedOutcomeMetadata':receipts})
run('df-byte-filesystems',['df','-B1','--output=source,fstype,size,used,avail,pcent,target','/','/opt/lims','/var/lib/docker','/var/lib/containerd'],30)
run('release-directory-birth-metadata',['stat','--printf=%n\t%W\t%w\t%y\n','--',*[str(p) for p in dirs]],30)
run('all-release-root-physical-du',['du','-x','-B1','-s','--',*[str(p) for p in dirs]],600)
run('docker-system-df-verbose',['docker','system','df','-v'],180)
run('docker-and-containerd-disjoint-physical-du',['du','-x','-B1','-s','--','/var/lib/docker','/var/lib/containerd'],300)
run('docker-image-tagged-and-dangling-metadata',['docker','image','ls','--all','--no-trunc','--format','{{json .}}'],30)
run('docker-container-state-metadata',['docker','ps','--all','--no-trunc','--format','{{json .}}'],30)
run('live-volume-selected-metadata',['docker','volume','inspect','lims_lims-data','lims_lims-assets'],30)
run('live-volumes-physical-du',['du','-x','-B1','-s','--','/var/lib/docker/volumes/lims_lims-data/_data','/var/lib/docker/volumes/lims_lims-assets/_data'],120)
run('root-depth-two-physical-du',['du','-x','-B1','--max-depth=2','--','/'],600)
run('journal-disk-usage',['journalctl','--disk-usage'],30)
search=[p for p in ['/opt/lims','/var/backups','/root','/home','/srv'] if pathlib.Path(p).is_dir()]
found=run('backup-directory-metadata-bounded-depth',['find',*search,'-xdev','-maxdepth','3','-type','d','-iname','*backup*'],30)
backups=sorted(set(found['stdoutOriginal'].splitlines())) if found['exitCode']==0 else []
assert len(backups)<=1000 and all(pathlib.Path(p).is_dir() and not pathlib.Path(p).is_symlink() for p in backups)
if backups:run('backup-directories-physical-du',['du','-x','-B1','-s','--',*backups],300)
print(json.dumps({'status':'YY_REQUESTED_READONLY_DISK_BREAKDOWN_NOT_CLEANUP_AUTHORITY','requestComment':6186928334,'beganUtc':began,'closedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'releaseRootMetadata':metadata,'commands':commands,'productionSqliteConnections':0,'productionContentHashes':0,'proofReplays':0,'filesDeleted':0,'filesMoved':0,'containersChanged':0,'settingsChanged':0,'databaseContentsFetched':0,'newPhysicalDuMeasurementsAreSeparateYYRequestNotProofRetainer':True,'dockerSystemDfSizesMayOverlapNotAdditivePhysicalUsage':True,'directoryCtimeIsNotCreationTime':True,'noDeletionEligibilityInferred':True}))
