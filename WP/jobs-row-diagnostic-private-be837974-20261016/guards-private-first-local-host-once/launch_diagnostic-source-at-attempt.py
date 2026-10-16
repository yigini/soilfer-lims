"""Single-use launch after exact diagnostic PASS; every remote program compiles first."""
import base64,datetime,pathlib,subprocess,sys
from diagnostic_contract import *
from prepare_diagnostic import REPO,REL,published,current_evidence
HOST='root@46.19.33.37'
PREFLIGHT='''
import os,pathlib,subprocess,json,stat
r=pathlib.Path(C['root'])
for p in ['/opt/lims/releases','/var/lib/docker','/var/lib/containerd']:
 q=pathlib.Path(p)
 assert str(q)==str(q.resolve()) and all(not x.is_symlink() for x in [q,*q.parents])
 v=os.statvfs(q);assert v.f_frsize==4096 and v.f_bsize==4096
 free=v.f_bavail*v.f_frsize;assert free>=C['required']
 assert q.stat().st_dev==64769
u=subprocess.run(['systemctl','show',C['unit'],'--property=LoadState','--value'],capture_output=True,check=False)
assert u.stdout.strip()==b'not-found' and not u.stderr
if C['phase']=='BEFORE_ROOT':
 assert not r.exists() and not r.is_symlink()
 root=pathlib.Path(C['oldRoot']);mains=C['mains'];pins=C['inputPins']
 expected={m+s for m in mains for s in ('','-wal','-shm')}
 assert len(mains)==2 and set(pins)==expected and len(expected)==6
 assert str(root)==str(root.resolve()) and all(not q.is_symlink() for q in [root,*root.parents])
 def snapshot():
  for m in mains:
   p=root/m
   assert {q.name for q in p.parent.glob(p.name+'*')}=={p.name,p.name+'-wal',p.name+'-shm'}
  values={};identities=set()
  for n in sorted(expected):
   p=root/n
   assert str(p)==str(p.resolve()) and all(not q.is_symlink() for q in [p,*p.parents])
   a=p.lstat();pin=pins[n]
   assert stat.S_ISREG(a.st_mode) and a.st_nlink==1 and (a.st_dev,a.st_ino) not in identities
   identities.add((a.st_dev,a.st_ino))
   v={'bytes':a.st_size,'allocatedBytes':a.st_blocks*512,'device':a.st_dev,'inode':a.st_ino,'mode':stat.S_IMODE(a.st_mode),'mtimeNs':a.st_mtime_ns}
   assert all(v[k]==pin[k] for k in v) and v['mode']==0o400
   if n.endswith('-wal'):assert v['bytes']==v['allocatedBytes']==0
   values[n]={**v,'nlink':a.st_nlink,'ctimeNs':a.st_ctime_ns}
  return values
 assert snapshot()==snapshot()

else:
 assert r.is_dir() and str(r)==str(r.resolve()) and not r.is_symlink()
 assert {p.name for p in r.iterdir()}==set(C['hashes'])
 import hashlib
 for n,h in C['hashes'].items():
  p=r/n;assert p.is_file() and not p.is_symlink() and p.stat().st_nlink==1
  assert hashlib.sha256(p.read_bytes()).hexdigest()==h and p.stat().st_mode&0o777==0o400
print(json.dumps({'phase':C['phase'],'requiredBytes':C['required'],'freeBytes':free,'device':64769,'sameFilesystemNonadditive':True,'unusedUnit':C['unit']}))
'''
CREATE='''
import pathlib,os,json
r=pathlib.Path(C['root']);assert str(r)==str(r.resolve()) and not r.exists() and not r.is_symlink()
assert r.parent==pathlib.Path('/opt/lims/releases')
r.mkdir(mode=0o700)
print(json.dumps({'newRoot':str(r)}))
'''
SEAL='''
import pathlib,hashlib,os,json
r=pathlib.Path(C['root']);assert str(r)==str(r.resolve()) and {p.name for p in r.iterdir()}==set(C['hashes'])
for n,h in C['hashes'].items():
 p=r/n;assert p.is_file() and not p.is_symlink() and p.stat().st_nlink==1 and hashlib.sha256(p.read_bytes()).hexdigest()==h
for n in C['hashes']:os.chmod(r/n,0o400)
print(json.dumps({'sealedFileCount':len(C['hashes'])}))
'''
UNIT_PROGRAM='''
import pathlib,subprocess,os,hashlib,json
r=pathlib.Path(C['root']);assert {p.name for p in r.iterdir()}==set(C['hashes'])
for n,h in C['hashes'].items():
 p=r/n;assert not p.is_symlink() and p.stat().st_nlink==1 and hashlib.sha256(p.read_bytes()).hexdigest()==h
 assert p.stat().st_mode&0o777==0o400
argv=['systemd-run','--unit='+C['unit'],'--service-type=exec','--property=Restart=no',
 '--property=RuntimeMaxSec=1800','--property=MemoryMax=805306368','--property=MemorySwapMax=0',
 '--property=UMask=0077','--property=PrivateNetwork=yes','--property=RestrictAddressFamilies=AF_UNIX',
 '--property=IPAddressDeny=any','--property=ProtectSystem=strict','--property=ProtectHome=yes',
 '--property=PrivateDevices=yes','--property=NoNewPrivileges=yes','--property=RestrictSUIDSGID=yes',
 '--property=ReadWritePaths='+str(r),'--property=ReadOnlyPaths='+C['oldRoot'],
 '--property=InaccessiblePaths=-/var/lib/docker/volumes -/opt/lims/backups',
 '--property=WorkingDirectory='+str(r),'--property=Environment=NODE_OPTIONS= PYTHONDONTWRITEBYTECODE=1',
 '--property=StandardOutput=append:'+str(r/'unit.stdout'),
 '--property=StandardError=append:'+str(r/'unit.stderr'),'/usr/bin/python3','-B',str(r/'run_diagnostic.py')]
intent=r/'unit-launch-intent.json'
with intent.open('x') as f:json.dump({'argv':argv,'oneAttempt':True},f);f.flush();os.fsync(f.fileno())
os.chmod(intent,0o400)
p=subprocess.run(argv,capture_output=True)
print(json.dumps({'argv':argv,'exitCode':p.returncode,'stdout':p.stdout.decode(),'stderr':p.stderr.decode()}))
assert p.returncode==0
'''
def programs(hashes,future):
    base={'root':str(ROOT),'oldRoot':str(OLD_ROOT),'unit':UNIT,'hashes':hashes,'mains':MAINS,'inputPins':strict(pathlib.Path(__file__).with_name('diagnostic-pins.json').read_bytes())['inputPins']}
    out={}
    for name,body,extra in [('beforeRoot',PREFLIGHT,{'phase':'BEFORE_ROOT','required':FLOOR+LOG_RESERVE+future}),('create',CREATE,{}),('seal',SEAL,{}),('beforeUnit',PREFLIGHT,{'phase':'BEFORE_UNIT','required':FLOOR+LOG_RESERVE}),('unit',UNIT_PROGRAM,{})]:
        encoded=base64.b64encode(canonical({**base,**extra})).decode()
        raw=("import json,base64\nC=json.loads(base64.b64decode('"+encoded+"'))\n"+body).encode();compile(raw,'actual-remote-'+name,'exec');out[name]=raw
    return out
def transport(argv,root,label,payload=None,timeout=90):
    try:p=subprocess.run(argv,cwd=REPO,input=payload,capture_output=True,timeout=timeout)
    except subprocess.TimeoutExpired as e:
        (root/(label+'-uncertain.json')).write_bytes(canonical({'neverReplay':True,'remoteOutcomeUnknown':True})+b'\n')
        for suffix,b in [('stdout',e.stdout or b''),('stderr',e.stderr or b'')]:(root/(label+'-partial-'+suffix)).write_bytes(b)
        raise RuntimeError('Unknown outcome; inspect same root/unit, never redispatch') from None
    for suffix,b in [('stdout',p.stdout),('stderr',p.stderr),('exit.json',canonical({'exitCode':p.returncode}))]:(root/(label+'-'+suffix)).write_bytes(b)
    require(p.returncode==0,'Launch transport refused; inspect same root/unit, never retry');return p.stdout
def launch(package):
    package=pathlib.Path(package).resolve();require(package==REPO/REL/('package-'+ROOT.name),'Exact prepared package required')
    idx=strict((package/'source-index.json').read_bytes());review=strict((package/'source-review.json').read_bytes());approval(review,idx);published(idx)
    names=FILES|DATA|{'source-index.json','source-review.json','current-evidence.json','diagnostic-spec.json'}
    require({p.name for p in package.iterdir()}==names,'Expanded package refused')
    for n,pin in {**idx['files'],**idx['data']}.items():require(sha((package/n).read_bytes())==pin['sha256'],'Prepared source changed')
    current_evidence(review,idx)
    hashes={n:sha((package/n).read_bytes()) for n in names};future=package_allowance([(package/n).stat().st_size for n in names]);program=programs(hashes,future)
    evidence=REPO/REL/'launch-once';require(not evidence.exists(),'Launch consumed/uncertain');evidence.mkdir()
    (evidence/'intent.json').write_bytes(canonical({'root':str(ROOT),'unit':UNIT,'futurePackageBytes':future,'neverReplay':True,'allRemoteProgramsCompiledBeforeFirstSsh':True})+b'\n')
    for name,raw in program.items():(evidence/(name+'-actual.py')).write_bytes(raw)
    ssh=['ssh','-o','BatchMode=yes','-o','ConnectTimeout=15',HOST,'python3','-B','-']
    transport(ssh,evidence,'beforeRoot',program['beforeRoot']);transport(ssh,evidence,'create',program['create'])
    transport(['scp','-p',*[str(package/n) for n in sorted(names)],HOST+':'+str(ROOT)+'/'],evidence,'upload',timeout=180)
    transport(ssh,evidence,'seal',program['seal'])
    # Package bytes are already occupied at the second capacity boundary.
    current_evidence(review,idx);transport(ssh,evidence,'beforeUnit',program['beforeUnit']);transport(ssh,evidence,'unit',program['unit'])
    print(canonical({'launchedRoot':str(ROOT),'unit':UNIT,'neverReplay':True}).decode())
if __name__=='__main__':launch(sys.argv[1])
