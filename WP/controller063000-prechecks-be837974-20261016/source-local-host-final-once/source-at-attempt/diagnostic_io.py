"""Bounded original hash/stat, two retained copies, and nonadditive R4 checks."""
import os,pathlib,stat,time,hashlib,json
from diagnostic_contract import *
from proof_files import write_new,file_state
PATHS=('/opt/lims/releases','/var/lib/docker','/var/lib/containerd')
def no_alias(p):
    p=pathlib.Path(p)
    for a in [p,*p.parents]:require(not a.is_symlink(),'Diagnostic path or ancestor alias refused')
    return p
def snapshot(p,content=True):
    p=no_alias(p)
    if not p.exists():return None
    s=p.lstat();require(stat.S_ISREG(s.st_mode) and s.st_nlink==1,'Regular unique diagnostic input required')
    out={**{k:getattr(s,k) for k in ['st_dev','st_ino','st_size','st_mtime_ns','st_ctime_ns','st_nlink']},'mode':stat.S_IMODE(s.st_mode),'allocatedBytes':getattr(s,'st_blocks',0)*512}
    if content:
        out['sha256']=file_state(p)['sha256'];require(snapshot(p,False)=={k:v for k,v in out.items() if k!='sha256'},'Diagnostic input changed during hashing')
    return out
def originals(pins,content=True):
    out={}
    for name,pin in pins['files'].items():
        value=snapshot(name,content);out[name]=value
        if pin is None:require(value is None,'Unexpected diagnostic original sibling')
        else:
            require(value is not None and value['mode']==0o400 and value['st_dev']==pin['device'] and value['st_ino']==pin['inode'] and value['st_size']==pin['bytes'] and value['st_mtime_ns']==pin['mtimeNs'] and value['allocatedBytes']==pin['allocatedBytes'],'Diagnostic original metadata differs')
            if content:require(value['sha256']==pin['sha256'],'Diagnostic original SHA differs')
        require(not pathlib.Path(name+'-journal').exists(),'Unexpected diagnostic journal')
    identities=[(v['st_dev'],v['st_ino']) for v in out.values() if v]
    require(len(identities)==len(set(identities)),'Diagnostic originals alias each other')
    return out
def copy_mains(pins,dest):
    dest=no_alias(dest);require(dest.is_dir(),'New diagnostic copy directory required')
    names=['startup-1-stopped-seal/backup.db','first-sync.db'];outputs=[]
    for i,name in enumerate(names):
        source=pathlib.Path(pins['consumedRoot'])/name;target=dest/('baseline.db' if i==0 else 'current.db')
        require(not target.exists(),'Diagnostic copy consumed')
        fd=os.open(str(source),os.O_RDONLY|getattr(os,'O_NOFOLLOW',0));outfd=os.open(str(target),os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o400)
        try:
            with os.fdopen(fd,'rb',closefd=False) as incoming,os.fdopen(outfd,'wb',closefd=False) as outgoing:
                for chunk in iter(lambda:incoming.read(1024**2),b''):outgoing.write(chunk)
                outgoing.flush();os.fsync(outgoing.fileno())
        finally:os.close(fd);os.close(outfd)
        actual=snapshot(target);pin=pins['files'][str(source)]
        require(actual['sha256']==pin['sha256'] and actual['st_size']==pin['bytes'] and actual['mode']==0o400,'Copied diagnostic main differs')
        outputs.append(target)
    return outputs
def required(pins,future_package=0,copies_pending=True):
    copy_bytes=sum(max(v['allocatedBytes'],((v['bytes']+4095)//4096)*4096) for n,v in pins['files'].items() if v and n.endswith('.db')) if copies_pending else 0
    return FLOOR+HEADROOM+LOG_RESERVE+copy_bytes+future_package
def capacity(pins,future_package=0,copies_pending=True):
    rows={}
    for name in PATHS:
        p=no_alias(name);s=p.stat();v=os.statvfs(p)
        require(p.is_dir() and str(p.resolve())==name and v.f_frsize==4096 and v.f_bsize==4096,'Canonical4096 diagnostic R4 paths required')
        free=v.f_bavail*v.f_frsize;require(type(free) is int and free>=required(pins,future_package,copies_pending),'Diagnostic R4 floor plus10GB copies logs refused')
        rows[name]={'device':s.st_dev,'freeBytes':free,'blockBytes':v.f_frsize}
    require(len({x['device'] for x in rows.values()})==1,'Diagnostic R4 requires same nonadditive filesystem')
    return {'paths':rows,'requiredBytes':required(pins,future_package,copies_pending),'additionalHeadroomBytes':HEADROOM,'sameFilesystemNonadditive':True,'copiesPending':copies_pending,'futurePackageBytes':future_package}
def allocated(root):
    total=0
    for parent,dirs,files in os.walk(root,followlinks=False):
        require(len(files)<20000,'Diagnostic evidence file bound')
        for n in dirs+files:
            p=no_alias(pathlib.Path(parent)/n);total+=getattr(p.lstat(),'st_blocks',0)*512
    return total
def growth(before,after,known):
    drops=[max(0,before['paths'][p]['freeBytes']-after['paths'][p]['freeBytes']) for p in PATHS]
    unexplained=max(0,max(drops)-known)
    require(unexplained<GROWTH_ABORT,'Diagnostic500MB unexplained disk-growth abort')
    return {'freeDropBytes':max(drops),'knownNewRootAllocatedBytes':known,'unexplainedBytes':unexplained,'wholeStorePhysicalMeasurementClaimed':False}
