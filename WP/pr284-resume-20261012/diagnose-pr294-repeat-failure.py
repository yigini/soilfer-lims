"""Physical read-only diagnosis of the burned first proof; never open SQLite."""
import datetime
import hashlib
import json
from pathlib import Path
import subprocess

directory = Path(__file__).resolve().parent
code = r'''import datetime,hashlib,json,pathlib,stat,subprocess
r=pathlib.Path('/opt/lims/releases/instrument-import-proof-959d17e1-20261012T134000Z')
u='lims-owned-instrument-import-proof-959d17e1-20261012t134000z.service'
def sha(p):
 h=hashlib.sha256()
 with p.open('rb') as f:
  while block:=f.read(1024*1024):h.update(block)
 return h.hexdigest()
def physical(p):
 if not p.exists():return None
 assert p.is_file() and not p.is_symlink()
 before=p.stat();digest=sha(p);after=p.stat()
 keys=['st_dev','st_ino','st_size','st_mtime_ns','st_mode']
 assert all(getattr(before,k)==getattr(after,k) for k in keys)
 return {'sha256':digest,'bytes':after.st_size,'inode':after.st_ino,'device':after.st_dev,
  'mtimeNs':after.st_mtime_ns,'mode':stat.S_IMODE(after.st_mode)}
state=dict(x.split('=',1) for x in subprocess.check_output(['systemctl','show',u,
 '-p','ActiveState','-p','SubState','-p','ExecMainStatus','-p','Result'],text=True).splitlines())
assert state['ActiveState']=='failed' and state['ExecMainStatus']=='1'
receipt=json.loads((r/'rehearsal-receipt.json').read_bytes())
assert receipt['status']=='FAILED_NEW_IMPORT_NATURAL_KOBO_PROOF'
assert sha(r/'rehearsal-receipt.json')=='e85e14bbe1fd46f312027443c8911e5eb5807e14787d4641141ef60c310e4fa2'
assert (r/'rehearsal-receipt.json').stat().st_mode&0o777==0o400
containers=[]
all_ids=subprocess.check_output(['docker','ps','-a','-q'],text=True).split()
for a in json.loads(subprocess.check_output(['docker','inspect',*all_ids],text=True)):
 owner=a['Config'].get('Labels',{}).get('io.soilfer.release-owned','')
 if owner.startswith(str(r)+':') or a['Name']=='/soilfer-lims':
  env=dict(x.split('=',1) for x in a['Config']['Env'] if '=' in x)
  containers.append({'name':a['Name'],'owner':owner,'image':a['Image'],'restartCount':a['RestartCount'],
   'status':a['State']['Status'],'running':a['State']['Running'],'exitCode':a['State']['ExitCode'],
   'oomKilled':a['State']['OOMKilled'],'health':a['State'].get('Health',{}).get('Status'),
   'memory':a['HostConfig']['Memory'],'memorySwap':a['HostConfig']['MemorySwap'],
   'nodeOptions':env.get('NODE_OPTIONS'),'networkMode':a['HostConfig']['NetworkMode'],
   'mounts':[{k:m.get(k) for k in ['Type','Name','Source','Destination','RW']} for m in a['Mounts']]})
assert len([a for a in containers if a['owner']])==3
assert all(not a['running'] and a['exitCode']==0 and not a['oomKilled'] and a['restartCount']==0
 for a in containers if a['owner'])
seal=json.loads((r/'after-import-stopped/sealed-state.json').read_bytes())
current={s:physical(pathlib.Path(str(r/'database/dev.db')+s)) for s in ['', '-wal','-shm']}
raw={s:physical(pathlib.Path(str(r/'after-import-stopped/raw/dev.db')+s)) for s in ['', '-wal','-shm']}
comparison={}
for suffix in current:
 expected=seal['physical'][suffix];actual=current[suffix]
 comparison[suffix]={'expected':expected,'actual':actual,
  'bytesAndShaUnchanged':(expected is None and actual is None) or
   (expected is not None and actual is not None and all(actual[k]==expected[k] for k in ['bytes','sha256']))}
shm={}
old=r/'after-import-stopped/raw/dev.db-shm';new=r/'database/dev.db-shm'
if old.exists() and new.exists() and old.stat().st_size==new.stat().st_size<=32768:
 a,b=old.read_bytes(),new.read_bytes();offsets=[i for i,(x,y) in enumerate(zip(a,b)) if x!=y]
 words=sorted({i//4*4 for i in offsets})
 shm={'differentByteCount':len(offsets),'byteOffsets':offsets,
  'wordDifferences':[{'offset':i,'beforeHex':a[i:i+4].hex(),'afterHex':b[i:i+4].hex()} for i in words]}
records={}
for name in ['rehearsal-receipt.json','after-import-stopped/sealed-state.json',
 'after-import-stopped/raw/original-triple.json','import-install-preservation.json']:
 p=r/name;assert p.stat().st_mode&0o777==0o400
 records[name]={'sha256':sha(p),'value':json.loads(p.read_bytes())}
journal=subprocess.check_output(['journalctl','--no-pager','-u',u,'-o','short-iso-precise'],text=True)
result={'observedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'root':str(r),'unitState':state,
 'containers':containers,'physicalComparison':comparison,'rawSealPhysical':raw,'shmDiff':shm,
 'records':records,'unitJournal':journal,'sqliteConnections':0,'productionMutations':0}
print(json.dumps(result))
'''
finished = subprocess.run(['ssh', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=15',
    'root@46.19.33.37', 'python3', '-B', '-'], input=code, text=True, encoding='utf-8',
    capture_output=True, timeout=60)
assert finished.returncode == 0, finished.stderr
value = json.loads(finished.stdout)
stamp = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
path = directory / ('pr294-repeat-failure-physical-' + stamp + '.json')
with path.open('x', encoding='utf-8', newline='\n') as output:
    json.dump(value, output, ensure_ascii=False, indent=2)
print(json.dumps({'record': path.name, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
    'observedUtc': value['observedUtc'], 'unitState': value['unitState'],
    'physicalComparison': value['physicalComparison'], 'shmDiff': value['shmDiff'],
    'containers': value['containers']}))
