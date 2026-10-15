import datetime,json,os,pathlib,shutil,stat
data=pathlib.Path('/opt/lims/releases/workflow-batch-stopped-copy-cde8c889-20261015T080000Z/installed-209/raw')/'dev.db';assets=pathlib.Path('/opt/lims/releases/workflow-batch-stopped-copy-cde8c889-20261015T070000Z/raw-production-assets')
def meta(p):
 for a in [p,*p.parents]:assert not a.is_symlink()
 if not p.exists():return None
 s=p.stat();assert stat.S_ISREG(s.st_mode)
 return (s.st_size,s.st_blocks*512,s.st_ino,s.st_mtime_ns,s.st_dev)
triple=lambda:[meta(pathlib.Path(str(data)+n)) for n in ['','-wal','-shm']]
before=triple();backupPath=pathlib.Path('/opt/lims/releases/workflow-batch-stopped-copy-cde8c889-20261015T080000Z/installed-209/backup.db');backupBefore=meta(backupPath);assert before[0] is not None and backupBefore is not None;rows=[]
for directory,children,files in os.walk(assets,followlinks=False):
 p=pathlib.Path(directory);assert not p.is_symlink()
 for n in children:assert not (p/n).is_symlink()
 for n in files:
  row=meta(p/n);assert row and row[4]==assets.stat().st_dev;rows.append(row);assert len(rows)<=200000
assert triple()==before and meta(backupPath)==backupBefore,'Metadata changed: STOP, no retry'
allocation=lambda r:max(r[1],((r[0]+4095)//4096)*4096)
t=max(sum(allocation(r) for r in before if r),allocation(backupBefore));a=sum(allocation(r) for r in rows)
print(json.dumps({'metadataOnly':True,'observedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'databaseReserveBytes':t,'assetReserveBytes':a,'requiredBytes':10556150894+4294967296+30*t+3*a,'dbEquivalents':30,'stageTableSha256':'c74e17c1f2e155673f3d91426086e0f96515e161442165c099c7c99269b9c5dc','freeBytes':{p:shutil.disk_usage(p).free for p in ['/opt/lims','/var/lib/docker','/var/lib/containerd']},'productionContentOpens':0,'productionCopies':0,'sqlConnections':0}))
