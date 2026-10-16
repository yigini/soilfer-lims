"""Bounded immutable inputs and exclusive, withheld output. Never copy a DB."""
import os,stat,hashlib,pathlib,sqlite3,time
from diagnostic_contract import *
FIELDS=('bytes','allocatedBytes','device','inode','mode','mtimeNs','sha256')
PRAGMAS={'page_count','page_size','quick_check','table_xinfo'}
def no_alias(p):
    p=pathlib.Path(p)
    require(p.is_absolute() and str(p)==str(p.resolve()),'Noncanonical input path')
    for q in [p,*p.parents]:require(not q.is_symlink(),'Symlink input refused')
    return p
def file_state(p):
    p=no_alias(p);a=p.stat();require(stat.S_ISREG(a.st_mode) and a.st_nlink==1,'Regular single-link file required')
    fd=os.open(str(p),os.O_RDONLY|getattr(os,'O_NOFOLLOW',0));h=hashlib.sha256()
    try:
        require(os.fstat(fd)==a,'Input changed before hashing')
        while True:
            b=os.read(fd,1024**2)
            if not b:break
            h.update(b)
        b=os.fstat(fd)
    finally:os.close(fd)
    c=p.stat();keys=lambda s:(s.st_dev,s.st_ino,s.st_size,s.st_mode,s.st_mtime_ns,s.st_ctime_ns,s.st_nlink,getattr(s,'st_blocks',None))
    require(keys(a)==keys(b)==keys(c),'Input changed during hashing')
    return {'bytes':a.st_size,'allocatedBytes':getattr(a,'st_blocks',0)*512,'device':a.st_dev,'inode':a.st_ino,'mode':stat.S_IMODE(a.st_mode),'mtimeNs':a.st_mtime_ns,'ctimeNs':a.st_ctime_ns,'nlink':a.st_nlink,'sha256':h.hexdigest()}
def check_inputs(pins,root=OLD_ROOT,previous=None):
    root=no_alias(pathlib.Path(root));expected={m+x for m in MAINS for x in ('','-wal','-shm')}
    require(set(pins)==expected,'Exact six input pins required')
    # Main 1 lives in its own stopped-seal directory. Other evidence in the
    # consumed root is untouched; reject ALL unexpected sidecar names for
    # either selected database, including journals and alternate WAL files.
    for m in MAINS:
        p=root/m;observed={x.name for x in p.parent.glob(p.name+'*')}
        require(observed=={p.name,p.name+'-wal',p.name+'-shm'},'Missing or extra selected database file')
    out={};identities=set()
    for n in sorted(expected):
        p=root/n;v=file_state(p);pin=pins[n]
        require(all(v[k]==pin[k] for k in FIELDS),'Retained input pin mismatch')
        require(v['mode']==0o400 and (v['device'],v['inode']) not in identities,'Input mode or alias refused');identities.add((v['device'],v['inode']))
        if n.endswith('-wal'):require(v['bytes']==v['allocatedBytes']==0 and v['sha256']==sha(b''),'Only exact empty WAL allowed')
        if previous is not None:require(v==previous[n],'After-read input changed; result void')
        out[n]=v
    return out
def authorizer(action,arg1,arg2,db,trigger):
    if action in (sqlite3.SQLITE_SELECT,sqlite3.SQLITE_READ,sqlite3.SQLITE_FUNCTION):return sqlite3.SQLITE_OK
    if action==sqlite3.SQLITE_PRAGMA and arg1.lower() in PRAGMAS and (arg1.lower()=='table_xinfo' or arg2 is None):return sqlite3.SQLITE_OK
    if action==sqlite3.SQLITE_TRANSACTION and arg1 in ('BEGIN','ROLLBACK'):return sqlite3.SQLITE_OK
    return sqlite3.SQLITE_DENY
def open_main(p,expected_bytes=563322880):
    # No ATTACH, query_only/temp_store/journal pragmas, extension, backup,
    # deserialize, writable connection or temporary database is used.
    p=no_alias(pathlib.Path(p));uri=p.as_uri()+'?mode=ro&immutable=1'
    db=sqlite3.connect(uri,uri=True,isolation_level=None);db.row_factory=sqlite3.Row;db.set_authorizer(authorizer)
    try:
        page_count=db.execute('PRAGMA page_count').fetchone()[0];page_size=db.execute('PRAGMA page_size').fetchone()[0]
        require(type(page_count) is int and type(page_size) is int and page_count*page_size==expected_bytes,'Main page extent mismatch')
        require([r[0] for r in db.execute('PRAGMA quick_check')]==['ok'],'Main quick_check refused')
        with p.open('rb') as f:header=f.read(20)
        require(header[:16]==b'SQLite format 3\x00','SQLite header required')
        db.execute('BEGIN')
        return db,{'pageCount':page_count,'pageSize':page_size,'pageBytes':page_count*page_size,'quickCheck':'ok','header18':header[18],'header19':header[19]}
    except BaseException:db.close();raise
class Sink:
    def __init__(self,root,cap=MAX_OUTPUT):self.root=pathlib.Path(root);self.cap=cap;self.bytes=0;self.files=[]
    def write(self,name,value):
        require('/' not in name and '\\' not in name and name not in ('','.','..'),'Output basename required')
        raw=canonical(projection(value))+b'\n';self.bytes+=len(raw);require(self.bytes<=self.cap,'Output cap exceeded')
        p=self.root/name
        with p.open('xb') as f:f.write(raw);f.flush();os.fsync(f.fileno())
        os.chmod(p,0o400);self.files.append({'file':name,'bytes':len(raw),'sha256':sha(raw),'withheld':name.startswith('private-')})
        return self.files[-1]
