import pathlib,sys,json,hashlib,struct,datetime,subprocess,shutil,os,sqlite3,contextlib
source=pathlib.Path('/var/lib/docker/volumes/lims_lims-data/_data/dev.db')
root=pathlib.Path('/opt/lims/releases/runtime-kobo-stopped-wal-e274-20261012T005800Z');assert not root.exists();assert root.parent==pathlib.Path('/opt/lims/releases')
sys.path.insert(0,'/opt/lims/releases/runtime-kobo-release-f830f900-20261012T004200Z')
import deploy_runtime as d,release_support as s
PIN={'': {'sha256': '44d174bdda174cc6fd81e6d0e958fd8bd48c8255e34cb9927bb562aa14cffd34', 'bytes': 563322880, 'inode': 1280648, 'device': 64769, 'mtimeNs': 1791758477795015270, 'mode': '0o666'}, '-wal': {'sha256': '9f0981c7b5adad656ff544890af68a211a6daf8a52360b5c5e6cb12ffe2bb2e0', 'bytes': 4190072, 'inode': 1191799, 'device': 64769, 'mtimeNs': 1791766145231682695, 'mode': '0o666'}, '-shm': {'sha256': '5ad9f8e2bdf448f719997dd8d28a3aee0351d7f86ac152df8c3d328755b0423d', 'bytes': 32768, 'inode': 1191838, 'device': 64769, 'mtimeNs': 1791766144752672822, 'mode': '0o666'}}

def physical():
 o={}
 for suffix in ['', '-wal','-shm']:
  f=pathlib.Path(str(source)+suffix)
  if not f.exists():o[suffix]=None;continue
  st=f.stat();o[suffix]={'sha256':s.sha(f),'bytes':st.st_size,'inode':st.st_ino,'device':st.st_dev,'mtimeNs':st.st_mtime_ns,'mode':oct(st.st_mode&0o777)}
 return o
before=physical();assert before==PIN,'Stopped triple changed before diagnosis';d.all_writers_stopped()
free=shutil.disk_usage(root.parent).free;reserve=10556150894;required=reserve+4*sum(x['bytes'] for x in before.values() if x)+268435456
assert free>=required,'Diagnosis reserve refused';root.mkdir(mode=0o700);raw=root/'raw';raw.mkdir(mode=0o700);working=root/'working';working.mkdir(mode=0o700)

def disk_check():
 allocated=sum(f.stat().st_blocks*512 for f in root.rglob('*') if f.is_file())
 current=shutil.disk_usage(root).free;assert current>=reserve,'Absolute diagnostic reserve refused';assert max(0,free-current-allocated)<=500000000,'Unexplained diagnostic growth refused'

def copy_exact(src,target):
 with src.open('rb') as a,target.open('xb') as b:
  while block:=a.read(1048576):b.write(block)
  b.flush();os.fsync(b.fileno())
 assert s.sha(src)==s.sha(target),'Byte copy differs';disk_check()
for suffix,meta in before.items():
 if meta:
  f=pathlib.Path(str(source)+suffix);t=raw/('dev.db'+suffix);copy_exact(f,t);t.chmod(0o400)
after=physical();assert before==after,'Original changed during triple copy';d.all_writers_stopped()
raw_hashes={f.name:{'sha256':s.sha(f),'bytes':f.stat().st_size,'mode':oct(f.stat().st_mode&0o777)} for f in raw.iterdir()}
# Only detached working files may be opened by SQLite. Immutable raw trio stays unchanged.
for f in raw.iterdir():copy_exact(f,working/f.name)
wal=raw/'dev.db-wal';header=wal.open('rb').read(32);hf=struct.unpack('>8I',header)
def ck(data,state,endian):
 words=struct.unpack(endian+str(len(data)//4)+'I',data);a,b=state
 for i in range(0,len(words),2):a=(a+words[i]+b)&0xffffffff;b=(b+words[i+1]+a)&0xffffffff
 return a,b
assert hf[0] in [0x377f0682,0x377f0683] and hf[1]==3007000;endian='<' if hf[0]==0x377f0682 else '>'
state=ck(header[:24],(0,0),endian);assert state==(hf[6],hf[7]),'WAL header checksum failed'
frames=0;commits=[];stop=None
with wal.open('rb') as f:
 f.seek(32)
 while h:=f.read(24):
  assert len(h)==24;fields=struct.unpack('>6I',h);data=f.read(hf[2]);assert len(data)==hf[2]
  if fields[2:4]!=hf[4:6]:stop={'frame':frames+1,'reason':'older salt trailing cycle'};break
  state=ck(h[:8]+data,state,endian);assert state==fields[4:6],'WAL frame checksum failed at '+str(frames+1)
  frames+=1
  if fields[1]:commits.append({'frame':frames,'databasePages':fields[1]})
assert commits and commits[-1]['frame']==725 and frames==725,'Diagnosed committed frame differs'
with contextlib.closing(sqlite3.connect((working/'dev.db').as_uri()+'?mode=ro',uri=True)) as db:
 with contextlib.closing(sqlite3.connect(root/'logical-backup.db')) as out:db.backup(out)
(root/'logical-backup.db').chmod(0o400);disk_check()
main=s.snapshot(raw/'dev.db',immutable=True);logical=s.snapshot(root/'logical-backup.db',immutable=True)
assert len(main['tables'])==len(logical['tables'])==104;assert logical['tables']['_schema_migrations']['count']==38
assert logical['integrity']=='ok' and logical['foreignKeyViolations']==0
assert all(logical['tables'][n]['count']>=v['count'] for n,v in main['tables'].items()),'Logical state row count fell below immutable main'
changes={n:{'mainCount':v['count'],'logicalCount':logical['tables'][n]['count'],'mainSha256':v['sha256'],'logicalSha256':logical['tables'][n]['sha256']} for n,v in main['tables'].items() if v!=logical['tables'][n]}
for n,obj in [('main-only-state.json',main),('wal-aware-logical-state.json',logical)]:
 with (root/n).open('x') as f:json.dump(obj,f,indent=2)
 (root/n).chmod(0o400)
assert raw_hashes=={f.name:{'sha256':s.sha(f),'bytes':f.stat().st_size,'mode':oct(f.stat().st_mode&0o777)} for f in raw.iterdir()}
final=physical();assert before==final,'Original changed during isolated SQLite diagnosis';d.all_writers_stopped();disk_check()
o={'status':'READONLY_ORIGINALS_WAL_DIAGNOSIS_COMPLETE_NOT_DEPLOYMENT','utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'root':str(root),'allWritersStopped':True,'originalBefore':before,'originalAfter':final,'originalFilesBytesAndMetadataUnchanged':True,'productionSQLiteConnectionsOpened':0,'productionMutations':0,'rawCopies':raw_hashes,'walHeaderChecksumValid':True,'walFrameChecksumsValidThrough':frames,'lastCommit':commits[-1],'trailingBoundary':stop,'logicalBackupSha256':s.sha(root/'logical-backup.db'),'logicalStateSha256':s.sha(root/'wal-aware-logical-state.json'),'mainStateSha256':s.sha(root/'main-only-state.json'),'protectedTableCount':104,'protectedReceiptCount':38,'integrity':'ok','foreignKeyViolations':0,'allLogicalCountsAtLeastMainCounts':True,'changedTablesComparedToMainOnly':changes,'freeBytes':shutil.disk_usage(root).free,'reservedBytes':reserve,'allocatedBytes':sum(f.stat().st_blocks*512 for f in root.rglob('*') if f.is_file()),'originalFailedReceiptUnchanged':s.sha(pathlib.Path('/opt/lims/releases/runtime-kobo-release-f830f900-20261012T004200Z/production-receipt.json'))=='e274d3b8cf6514e7fe878ad7d712caa6303d3f969fd49372f8bb0147efbb6588'}
with (root/'diagnosis.json').open('x') as f:json.dump(o,f,indent=2)
(root/'diagnosis.json').chmod(0o400)
print(json.dumps(o))
