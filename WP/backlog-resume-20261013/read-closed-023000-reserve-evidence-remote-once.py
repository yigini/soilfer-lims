"""Read closed owned originals and current filesystem metadata only; no proof replay."""
import base64,datetime,hashlib,json,os,pathlib,shutil,stat,subprocess,sys
root=pathlib.Path('/opt/lims/releases/workflow-batch-stopped-copy-cde8c889-20261015T023000Z')
unit='lims-workflow-batch-stopped-copy-cde8c889-20261015t023000z'
sys.path.insert(0,str(root))
from proof_contract import healthy_predecessor,PREDECESSOR_ID,LIVE_DATA,LIVE_ASSETS,reserve
from proof_docker import all_containers,inspect,preserved_containers
state=subprocess.check_output(['systemctl','show',unit,'--property=LoadState,ActiveState,SubState,Result,ExecMainStatus,InvocationID,MemoryPeak,MemoryMax,MemorySwapMax,RuntimeMaxUSec,ExecMainStartTimestamp,ExecMainExitTimestamp'],timeout=15).decode()
props=dict(l.split('=',1) for l in state.splitlines() if '=' in l)
assert props['ActiveState']=='failed' and props['ExecMainStatus']=='1' and props['InvocationID']=='f65cb69ccc5542339f09fcab778bed23'
original=json.loads((root/'proof-terminal-refusal.json').read_bytes())
assert original['closedUtc']=='2026-10-15T02:37:54.846974+00:00' and original['error']=='RuntimeError: Measured/scaled reserve STOP'
assert not any((root/n).exists() for n in ['fresh-production-snapshot','installation-target','fresh-actual-baseline.json','measured-copy-reserve.json'])
rows=[];total=0
for p in sorted(root.rglob('*')):
    assert not p.is_symlink()
    if p.is_file():
        a=p.stat();assert stat.S_IMODE(a.st_mode)==0o400 and a.st_size<=33554432
        raw=p.read_bytes();b=p.stat();assert (a.st_size,a.st_mtime_ns,a.st_mode,a.st_ino)==(b.st_size,b.st_mtime_ns,b.st_mode,b.st_ino)
        total+=len(raw);assert total<=67108864
        rows.append({'path':p.relative_to(root).as_posix(),'bytes':len(raw),'mode':stat.S_IMODE(b.st_mode),'sha256':hashlib.sha256(raw).hexdigest(),'data':base64.b64encode(raw).decode()})
assert len(rows)==25
spec=json.loads((root/'proof-input.json').read_bytes());assert all(hashlib.sha256((root/n).read_bytes()).hexdigest()==h for n,h in spec['packageHashes'].items())
before=json.loads((root/'container-inventory-before.json').read_bytes());after=all_containers();preserved_containers(before,after)
assert all(before[id][k]==after[id][k] for id in before for k in ['name','image','labels','running','startedAt'])
assert not [v for v in after.values() if v['labels'].get('io.soilfer.release-owned','').startswith(str(root)+':')]
normal=healthy_predecessor(inspect(PREDECESSOR_ID))
def metadata(p):
    for a in [p,*p.parents]:assert not a.is_symlink()
    if not p.exists():return None
    s=p.stat();assert stat.S_ISREG(s.st_mode)
    return {'bytes':s.st_size,'allocatedBytes':s.st_blocks*512,'inode':s.st_ino,'device':s.st_dev,'mtimeNs':s.st_mtime_ns,'mode':stat.S_IMODE(s.st_mode)}
db={n:metadata(pathlib.Path(LIVE_DATA)/('dev.db'+n)) for n in ['','-wal','-shm']}
asset_rows=[];asset_root=pathlib.Path(LIVE_ASSETS)
for directory,children,files in os.walk(asset_root,followlinks=False):
    d=pathlib.Path(directory);assert not d.is_symlink()
    for n in children:assert not (d/n).is_symlink()
    for n in files:
        row=metadata(d/n);assert row and row['device']==asset_root.stat().st_dev
        asset_rows.append(row);assert len(asset_rows)<=200000
assert db=={n:metadata(pathlib.Path(LIVE_DATA)/('dev.db'+n)) for n in ['','-wal','-shm']},'Post-failure metadata changed; retain, never recollect'
allocation=lambda r:max(r['allocatedBytes'],((r['bytes']+4095)//4096)*4096)
db_bytes=sum(allocation(r) for r in db.values() if r);asset_bytes=sum(allocation(r) for r in asset_rows);required=reserve(db_bytes,asset_bytes)
free={p:shutil.disk_usage(p).free for p in ['/opt/lims','/var/lib/docker','/var/lib/containerd']}
journal=subprocess.check_output(['journalctl','-u',unit,'--no-pager','-o','json','-n','1000'],timeout=15).decode()
print(json.dumps({'status':'CLOSED_RESERVE_STOP_ALL_ORIGINALS_RETAINED_METADATA_ONLY_DIAGNOSTIC','observedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'root':str(root),'unit':unit,'files':rows,'originalRefusal':original,'packageUnchanged':True,'systemctlOriginal':state,'journalOriginal':journal,'normalPredecessorSelectedDerived':normal,'allHistoricalContainersPreserved':True,'allHistoricalStoppedContainersPreserved':True,'newOwnedContainers':0,'postFailureMetadataOnly':{'databaseFiles':db,'databaseReserveAllocationBytes':db_bytes,'assetReserveAllocationBytes':asset_bytes,'requiredReserveBytes':required,'currentFreeBytes':free,'shortfallBytes':{p:max(0,required-v) for p,v in free.items()},'productionFileContentsOpened':False,'sqlConnections':0,'notOriginalFailedBindInputs':True},'productionCopies':0,'productionSqliteConnections':0,'installerAttempts':0,'defaultEntrypointAttempts':0,'proofReplays':0,'allRootFilesUnchanged':True}))
