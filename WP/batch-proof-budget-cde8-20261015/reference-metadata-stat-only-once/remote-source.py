import datetime,json,os,pathlib,shutil,stat
data=pathlib.Path('/var/lib/docker/volumes/lims_lims-data/_data/dev.db');assets=pathlib.Path('/var/lib/docker/volumes/lims_lims-assets/_data')
def meta(p):
 for a in [p,*p.parents]:assert not a.is_symlink()
 if not p.exists():return None
 s=p.stat();assert stat.S_ISREG(s.st_mode)
 return {'bytes':s.st_size,'allocatedBytes':s.st_blocks*512,'inode':s.st_ino,'mtimeNs':s.st_mtime_ns,'device':s.st_dev}
triple=lambda:{n:meta(pathlib.Path(str(data)+n)) for n in ['','-wal','-shm']}
before=triple();rows=[]
for directory,children,files in os.walk(assets,followlinks=False):
 p=pathlib.Path(directory);assert not p.is_symlink()
 for n in children:assert not (p/n).is_symlink()
 for n in files:
  r=meta(p/n);assert r and r['device']==assets.stat().st_dev;rows.append(r);assert len(rows)<=200000
assert triple()==before,'Input metadata changed; retain refuse, never recollect'
allocation=lambda r:max(r['allocatedBytes'],((r['bytes']+4095)//4096)*4096)
print(json.dumps({'status':'FRESH_FILESYSTEM_METADATA_ONLY_REFERENCE_NOT_PROOF_INPUTS','observedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'databaseTripleMetadata':before,'databaseReserveBytes':sum(allocation(r) for r in before.values() if r),'assetReserveBytes':sum(allocation(r) for r in rows),'freeBytes':{p:shutil.disk_usage(p).free for p in ['/opt/lims','/var/lib/docker','/var/lib/containerd']},'productionFileContentOpens':0,'productionCopies':0,'sqlConnections':0,'scientificCounts':None,'settingChanges':0}))
