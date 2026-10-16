"""Raw byte copies and WAL-aware detached seals; never connect to raw/live inputs."""
import base64, datetime, hashlib, os, pathlib, sqlite3, stat, time
from proof_contract import *

def claim_copy(check,site):
    owner=getattr(check,'__self__',None)
    if owner is not None:
        require(callable(getattr(owner,'claim',None)),'Owned operator requires declared-copy accounting')
        owner.claim(site)

def write_new(path,value):
    p=pathlib.Path(path)
    with p.open('xb') as f:f.write(canonical(value)+b'\n')
    p.chmod(0o400)
def utc_now():return datetime.datetime.now(datetime.timezone.utc).isoformat()

def stat_record(s):
    return {'device':s.st_dev,'inode':s.st_ino,'bytes':s.st_size,'mtimeNs':s.st_mtime_ns,'mode':stat.S_IMODE(s.st_mode)}

def compared_guard(ok,message,evidence_dir,label,before,after):
    if not ok and evidence_dir is not None:
        write_new(pathlib.Path(evidence_dir)/(label+'.json'),{'before':before,'after':after,'comparisonPassed':False,'error':message,'observedUtc':utc_now(),'neverRetry':True})
    require(ok,message)

def identity_record(rows):return {s:None if r is None else {'sha256':r['sha256'],'bytes':r['bytes']} for s,r in rows.items()}

def file_state(path,live_evidence=None):
    p=pathlib.Path(path)
    for ancestor in [p,*p.parents]:require(not ancestor.is_symlink(),'File or ancestor alias refused')
    if not p.exists():return None
    before=p.stat();require(stat.S_ISREG(before.st_mode) and before.st_size<=BYTE_LIMIT,'Regular bounded file required')
    h=hashlib.sha256()
    fd=os.open(str(p),os.O_RDONLY|getattr(os,'O_NOFOLLOW',0))
    try:
        opened=os.fstat(fd);compared_guard((opened.st_ino,opened.st_dev)==(before.st_ino,before.st_dev),'File replaced before open',live_evidence,'file-open-'+sha(str(p).encode())[:24],stat_record(before),stat_record(opened))
        with os.fdopen(fd,'rb',closefd=False) as f:
            while True:
                b=f.read(1024**2)
                if not b:break
                h.update(b)
        after=p.stat()
    finally:os.close(fd)
    keys=['st_dev','st_ino','st_size','st_mtime_ns','st_mode']
    compared_guard(all(getattr(before,k)==getattr(after,k) for k in keys),'File changed during sampling; no retry',live_evidence,'file-sampling-'+sha(str(p).encode())[:24],stat_record(before),stat_record(after))
    return {'sha256':h.hexdigest(),'bytes':after.st_size,'device':after.st_dev,'inode':after.st_ino,'mtimeNs':after.st_mtime_ns,'mode':stat.S_IMODE(after.st_mode),'allocatedBytes':getattr(after,'st_blocks',0)*512}
