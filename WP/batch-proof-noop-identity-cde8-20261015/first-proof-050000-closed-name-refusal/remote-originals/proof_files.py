"""Raw byte copies and WAL-aware detached seals; never connect to raw/live inputs."""
import base64, hashlib, os, pathlib, sqlite3, stat, time
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
def file_state(path):
    p=pathlib.Path(path)
    for ancestor in [p,*p.parents]:require(not ancestor.is_symlink(),'File or ancestor alias refused')
    if not p.exists():return None
    before=p.stat();require(stat.S_ISREG(before.st_mode) and before.st_size<=BYTE_LIMIT,'Regular bounded file required')
    h=hashlib.sha256()
    fd=os.open(str(p),os.O_RDONLY|getattr(os,'O_NOFOLLOW',0))
    try:
        opened=os.fstat(fd);require((opened.st_ino,opened.st_dev)==(before.st_ino,before.st_dev),'File replaced before open')
        with os.fdopen(fd,'rb',closefd=False) as f:
            while True:
                b=f.read(1024**2)
                if not b:break
                h.update(b)
        after=p.stat()
    finally:os.close(fd)
    keys=['st_dev','st_ino','st_size','st_mtime_ns','st_mode']
    require(all(getattr(before,k)==getattr(after,k) for k in keys),'File changed during sampling; no retry')
    return {'sha256':h.hexdigest(),'bytes':after.st_size,'device':after.st_dev,'inode':after.st_ino,'mtimeNs':after.st_mtime_ns,'mode':stat.S_IMODE(after.st_mode),'allocatedBytes':getattr(after,'st_blocks',0)*512}
def triple(path):
    result={s:file_state(str(path)+s) for s in ['', '-wal','-shm']}
    require(result[''] is not None,'Main database missing');return result
def byte_identity(rows):return {k:None if r is None else (r['sha256'],r['bytes']) for k,r in rows.items()}
def dry_identity(before,after):
    require(byte_identity(before)['']==byte_identity(after)[''],'Dry-run changed main SHA-256 or length')
    wal=after['-wal']
    require(wal is None or wal['bytes']==0,'Dry-run left a non-empty WAL')
    return {'mainBefore':before[''],'mainAfter':after[''],'walAfter':wal,'mainSha256AndLengthEqual':True,'walAbsentOrEmpty':True,'shmExcluded':True,'sqlConnections':0,'copiesCreated':0}

def repeat_identity(before,after,result,issue):
    plan(result,issue,'NO_OP')
    require(type(result.get('totalChanges')) is int and result['totalChanges']==0,'Repeat must return exact NO_OP/0')
    a,b=byte_identity(before),byte_identity(after)
    require(all(a[s]==b[s] for s in ['', '-wal']),'Repeat changed main or WAL SHA-256 or length')
    return {'mainBefore':before[''],'mainAfter':after[''],'walBefore':before['-wal'],'walAfter':after['-wal'],'mainAndWalByteIdentity':True,'mode':'NO_OP','totalChanges':0,'shmExcluded':True,'sqlConnections':0,'copiesCreated':0}

def copy_file(src,dst,expected,check):
    require(not pathlib.Path(src).is_symlink() and not pathlib.Path(dst).exists() and not pathlib.Path(dst).is_symlink(),'Copy alias or reused destination')
    count=0
    with pathlib.Path(src).open('rb') as f,pathlib.Path(dst).open('xb') as out:
        while True:
            b=f.read(1024**2)
            if not b:break
            out.write(b);count+=len(b);require(count<=expected['bytes'],'Source grew during copy')
            if count%(32*1024**2)==0:out.flush();check()
    pathlib.Path(dst).chmod(0o400)
    actual=file_state(dst);require(actual['sha256']==expected['sha256'] and actual['bytes']==expected['bytes'],'Copy differs; no retry');check()
def copy_triple(src,directory,check):
    claim_copy(check,'triple')
    before=triple(src);d=pathlib.Path(directory);require(not d.exists() and not d.is_symlink(),'Triple destination consumed')
    d.mkdir(mode=0o700);target=d/'dev.db'
    for s,row in before.items():
        if row is not None:copy_file(str(src)+s,str(target)+s,row,check)
    require(triple(src)==before,'Original DB/WAL/SHM changed during copy; STOP, no retry')
    write_new(d/'copy-authority.json',{'originalFiles':before,'originalFilesPreserved':True,'rawMasterNeverOpenedSqlite':True})
    return target,before
def tree_state(directory):
    root=pathlib.Path(directory);require(root.is_dir() and not root.is_symlink(),'Real asset tree required')
    device=root.stat().st_dev;rows={};directories={};total=0
    for d,children,files in os.walk(root,followlinks=False):
        children.sort();files.sort();p=pathlib.Path(d);s=p.stat()
        require(not p.is_symlink() and s.st_dev==device,'Tree aliases or cross-device paths refused')
        directories[str(p.relative_to(root))]={'mode':stat.S_IMODE(s.st_mode),'inode':s.st_ino,'mtimeNs':s.st_mtime_ns}
        for n in children:require(not (p/n).is_symlink(),'Asset directory link refused')
        for n in files:
            q=p/n;r=file_state(q);require(r is not None and r['device']==device,'Asset vanished or crossed device')
            rows[str(q.relative_to(root))]=r;total+=r['bytes']
            require(len(rows)<=FILE_LIMIT and total<=BYTE_LIMIT,'Asset inventory bound exceeded')
    return {'files':rows,'directories':directories,'bytes':total,'allocatedBytes':sum(max(r['allocatedBytes'],((r['bytes']+4095)//4096)*4096) for r in rows.values())}
def copy_tree(src,dst,check):
    claim_copy(check,'assets')
    before=tree_state(src);dst=pathlib.Path(dst);require(not dst.exists() and not dst.is_symlink(),'Asset destination consumed');dst.mkdir(mode=0o700)
    for n in sorted(before['directories'],key=lambda v:(len(pathlib.Path(v).parts),v)):
        if n!='.':(dst/n).mkdir(mode=0o700)
    for n,row in before['files'].items():copy_file(pathlib.Path(src)/n,dst/n,row,check)
    require(tree_state(src)==before,'Asset source changed; no retry')
    require({n:(r['sha256'],r['bytes']) for n,r in tree_state(dst)['files'].items()}=={n:(r['sha256'],r['bytes']) for n,r in before['files'].items()},'Asset copy differs')
    return before
def quote(name):return '"'+name.replace('"','""')+'"'
def atom(v):
    if isinstance(v,bytes):return {'blob':base64.b64encode(v).decode()}
    if isinstance(v,float):return {'float':v.hex()}
    return v
def table_fingerprint(db,name,columns):
    # SQL orders values by SQLite types and the full selected tuple. No rowid assumptions.
    cols=','.join(quote(c) for c in columns);h=hashlib.sha256();count=0
    for row in db.execute('SELECT '+cols+' FROM '+quote(name)+' ORDER BY '+cols):
        data=canonical([atom(v) for v in row]);h.update(len(data).to_bytes(8,'big'));h.update(data);count+=1
    return {'count':count,'sha256':h.hexdigest()}
def logical(path):
    db=sqlite3.connect(pathlib.Path(path).as_uri()+'?mode=ro',uri=True,timeout=10)
    try:
        db.execute('PRAGMA query_only=ON');db.execute('BEGIN')
        integrity=[r[0] for r in db.execute('PRAGMA integrity_check')];foreign=list(db.execute('PRAGMA foreign_key_check'))
        require(integrity==['ok'] and not foreign,'Copied database integrity/FK refused')
        objects=[list(r) for r in db.execute("SELECT type,name,tbl_name,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name")]
        tables={}
        for name, in db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"):
            cols=[r[1] for r in db.execute('PRAGMA table_info('+quote(name)+')')]
            tables[name]={'columns':cols,**table_fingerprint(db,name,cols)}
        db.rollback();return {'objects':objects,'tables':tables,'integrity':'ok','foreignKeyViolations':0}
    finally:db.close()
def seal(root,label,source,check):
    d=child_path(root,pathlib.Path(root)/label);require(not d.exists(),'Seal consumed');d.mkdir(mode=0o700)
    raw,original=copy_triple(source,d/'raw',check);reader,_=copy_triple(raw,d/'reader',check)
    for s,r in triple(reader).items():
        if r is not None:pathlib.Path(str(reader)+s).chmod(0o600)
    state=logical(reader);backup=d/'backup.db'
    # WAL is read by a normal read-only connection to the OWNED reader. immutable=1 is never used here.
    claim_copy(check,'backup')
    before=sqlite3.connect(reader.as_uri()+'?mode=ro',uri=True,timeout=10);after=sqlite3.connect(str(backup))
    try:before.backup(after,pages=256,sleep=0.05)
    finally:after.close();before.close()
    backup.chmod(0o400);require(logical(backup)==state,'Detached WAL-aware backup differs')
    require(triple(source)==original and byte_identity(triple(raw))==byte_identity(original),'Original or raw master changed while reading owned copy')
    write_new(d/'logical-state.json',state);write_new(d/'seal.json',{'rawMaster':str(raw),'rawMasterNeverOpenedSqlite':True,'backup':str(backup),'backupSha256':file_state(backup)['sha256'],'logicalStateSha256':sha(canonical(state)),'originalFiles':original,'countsIncludeWal':True})
    check();return backup,state
def clone_backup(root,label,backup,check):
    claim_copy(check,'clone')
    d=child_path(root,pathlib.Path(root)/label);require(not d.exists(),'Database clone consumed');d.mkdir(mode=0o700)
    copy_file(backup,d/'dev.db',file_state(backup),check);(d/'dev.db').chmod(0o600);return d
def delta(before_backup,after_backup,new_tables,marker,order_column=False):
    before,after=logical(before_backup),logical(after_backup)
    require(set(after['tables'])-set(before['tables'])==new_tables and set(before['tables'])<=set(after['tables']),'Unexpected table delta')
    a=sqlite3.connect(pathlib.Path(before_backup).as_uri()+'?mode=ro',uri=True);b=sqlite3.connect(pathlib.Path(after_backup).as_uri()+'?mode=ro',uri=True)
    try:
        for name,info in before['tables'].items():
            expected=info['columns']+(['workItemId'] if order_column and name=='OrderLine' else [])
            require(after['tables'][name]['columns']==expected,'Unexpected column delta '+name)
            if name=='_schema_migrations':
                cols=','.join(quote(c) for c in info['columns']);old=list(a.execute('SELECT '+cols+' FROM "_schema_migrations" ORDER BY '+cols));current_rows=list(b.execute('SELECT '+cols+' FROM "_schema_migrations" WHERE id != ? ORDER BY '+cols,(marker,)))
                require(old==current_rows and after['tables'][name]['count']==info['count']+1,'Original migration receipt changed')
            else:require(table_fingerprint(b,name,info['columns'])=={'count':info['count'],'sha256':info['sha256']},'Original rows changed '+name)
            if order_column and name=='OrderLine':require(b.execute('SELECT count(*) FROM "OrderLine" WHERE "workItemId" IS NOT NULL').fetchone()[0]==0,'OrderLine backfill refused')
        require(all(after['tables'][n]['count']==0 for n in new_tables),'New evidence tables must be empty')
        prior={(r[0],r[1]):r for r in before['objects']};current_objects={(r[0],r[1]):r for r in after['objects']}
        for k,row in prior.items():
            require(k in current_objects and (current_objects[k]==row or order_column and k==('table','OrderLine')),'Original schema object changed '+k[1])
    finally:a.close();b.close()
    return {'allOriginalRowsAndReceiptsPreserved':True,'newTables':sorted(new_tables),'emptyEvidenceTables':True,'backfilledCount':0,'marker':marker,'totalTables':len(after['tables']),'schemaReceiptCount':after['tables']['_schema_migrations']['count']}
