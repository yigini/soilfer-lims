"""Raw byte copies and WAL-aware detached seals; never connect to raw/live inputs."""
import base64, datetime, hashlib, os, pathlib, sqlite3, stat, time
from retained_contract import *
from kit_evidence import admit_evidence

def claim_copy(check,site):
    owner=getattr(check,'__self__',None)
    if owner is not None:
        require(callable(getattr(owner,'claim',None)),'Owned operator requires declared-copy accounting')
        owner.claim(site)

def write_new(path,value):
    p=pathlib.Path(path);raw=canonical(value)+b'\n'
    admit_evidence(p,len(raw))
    with p.open('xb') as f:f.write(raw)
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
def triple(path,live_evidence=None):
    result={s:file_state(str(path)+s,live_evidence) for s in ['', '-wal','-shm']}
    require(result[''] is not None,'Main database missing');return result
def byte_identity(rows):return {k:None if r is None else (r['sha256'],r['bytes']) for k,r in rows.items()}
def compared_identity(before,after,evidence_dir=None,label='byte-identity'):
    if evidence_dir is not None:
        write_new(pathlib.Path(evidence_dir)/(label+'-compared-states.json'),{'before':before,'after':after,'observedUtc':utc_now(),'rule':'MAIN_EXACT_WAL_ABSENT_EMPTY_EQUIVALENT_NONEMPTY_EXACT','notYetValidated':True})
    def identity(row):
        if row is None:return None
        require(isinstance(row,dict) and type(row.get('bytes')) is int and row['bytes']>=0 and re.fullmatch('[a-f0-9]{64}',row.get('sha256','')),'Malformed byte identity')
        require(row['bytes']!=0 or row['sha256']==sha(b''),'Zero-byte file hash differs')
        return (row['sha256'],row['bytes'])
    require(isinstance(before,dict) and isinstance(after,dict) and set(before)==set(after)=={'','-wal','-shm'},'Full triple comparison required')
    main_a,main_b=identity(before['']),identity(after['']);require(main_a is not None and main_a==main_b,'Main SHA-256 or length changed')
    wal_a,wal_b=identity(before['-wal']),identity(after['-wal'])
    empty=lambda value:value is None or value[1]==0
    require((empty(wal_a) and empty(wal_b)) or wal_a==wal_b,'Non-empty WAL SHA-256 or length changed')
    return {'mainBefore':before[''],'mainAfter':after[''],'walBefore':before['-wal'],'walAfter':after['-wal'],'mainSha256AndLengthEqual':True,'walAbsentEmptyEquivalentOrNonemptyExact':True,'shmExcluded':True,'sqlConnections':0,'copiesCreated':0}
def dry_identity(before,after,evidence_dir=None,label='dry-byte-identity'):
    return compared_identity(before,after,evidence_dir,label)
def repeat_identity(before,after,result,issue,evidence_dir=None,label='repeat-byte-identity'):
    value=compared_identity(before,after,evidence_dir,label)
    plan(result,issue,'NO_OP')
    return {**value,'mode':'NO_OP','totalChanges':0,'backfilledCount':0}

def copy_file(src,dst,expected,check,live_evidence=None):
    require(not pathlib.Path(src).is_symlink() and not pathlib.Path(dst).exists() and not pathlib.Path(dst).is_symlink(),'Copy alias or reused destination')
    require(isinstance(expected,dict) and type(expected.get('bytes')) is int and 0<=expected['bytes']<=BYTE_LIMIT and
        isinstance(expected.get('sha256'),str) and re.fullmatch('[a-f0-9]{64}',expected['sha256']),
        'Exact bounded source length/hash required before copy creation')
    check()
    count=0
    with pathlib.Path(src).open('rb') as f,pathlib.Path(dst).open('xb') as out:
        while True:
            b=f.read(1024**2)
            if not b:break
            # Refuse BEFORE the next write. A growing source must never spend
            # even one unreserved chunk beyond its original byte allowance.
            compared_guard(count+len(b)<=expected['bytes'],'Source grew during copy',live_evidence,'copy-size-'+sha(str(src).encode())[:24],expected,{'copiedBytes':count,'nextChunkBytes':len(b),'sourceFdMetadata':stat_record(os.fstat(f.fileno()))})
            out.write(b);count+=len(b)
            if count%(32*1024**2)==0:out.flush();check()
    pathlib.Path(dst).chmod(0o400)
    actual=file_state(dst);compared_guard(actual['sha256']==expected['sha256'] and actual['bytes']==expected['bytes'],'Copy differs; no retry',live_evidence,'copy-bytes-'+sha(str(src).encode())[:24],expected,actual);check();return actual
def copy_triple(src,directory,check,live_source=False):
    claim_copy(check,'triple')
    require(type(live_source) is bool and (not live_source or pathlib.Path(src)==pathlib.Path(LIVE_DATA)/'dev.db'),'Production handoff only for the pinned live DB')
    d=pathlib.Path(directory);require(not d.exists() and not d.is_symlink(),'Triple destination consumed');d.mkdir(mode=0o700)
    evidence=d if live_source else None;started=utc_now();before=triple(src,evidence);target=d/'dev.db';copied={s:None for s in before}
    for s,row in before.items():
        if row is not None:copied[s]=copy_file(str(src)+s,str(target)+s,row,check,evidence)
    after=triple(src,evidence)
    if live_source:write_new(d/'copy-window-comparison.json',{'before':before,'after':after,'comparisonPassed':before==after,'observedUtc':utc_now(),'neverRetry':True})
    require(after==before,'Original DB/WAL/SHM changed during copy; STOP, no retry')
    if live_source:write_new(d/'snapshot-handoff.json',{'status':'FILESYSTEM_ONLY_STABLE_COPY_WINDOW_HANDOFF','windowStartedUtc':started,'handoffUtc':utc_now(),'beforeLiveTriple':before,'afterLiveTriple':after,'rawCopyByteIdentity':identity_record(copied),'rawMasterNeverOpenedSqlite':True,'databaseAssetsCrossFileAtomicityClaimed':False})
    write_new(d/'copy-authority.json',{'originalFiles':before,'originalFilesPreserved':True,'rawMasterNeverOpenedSqlite':True})
    return target,before
def tree_state(directory,live_evidence=None):
    root=pathlib.Path(directory);require(root.is_dir() and not root.is_symlink(),'Real asset tree required')
    device=root.stat().st_dev;rows={};directories={};total=0
    for d,children,files in os.walk(root,followlinks=False):
        children.sort();files.sort();p=pathlib.Path(d);s=p.stat()
        require(not p.is_symlink() and s.st_dev==device,'Tree aliases or cross-device paths refused')
        directories[str(p.relative_to(root))]={'mode':stat.S_IMODE(s.st_mode),'inode':s.st_ino,'mtimeNs':s.st_mtime_ns}
        for n in children:require(not (p/n).is_symlink(),'Asset directory link refused')
        for n in files:
            q=p/n;r=file_state(q,live_evidence);compared_guard(r is not None and r['device']==device,'Asset vanished or crossed device',live_evidence,'asset-file-presence-'+sha(str(q).encode())[:24],{'device':device,'file':str(q)},r)
            rows[str(q.relative_to(root))]=r;total+=r['bytes']
            require(len(rows)<=FILE_LIMIT and total<=BYTE_LIMIT,'Asset inventory bound exceeded')
    return {'files':rows,'directories':directories,'bytes':total,'allocatedBytes':sum(max(r['allocatedBytes'],((r['bytes']+4095)//4096)*4096) for r in rows.values())}
def copy_tree(src,dst,check,live_source=False,handoff_path=None):
    claim_copy(check,'assets')
    require(type(live_source) is bool and (not live_source or pathlib.Path(src)==pathlib.Path(LIVE_ASSETS) and handoff_path is not None),'Production asset handoff only for pinned live assets')
    evidence=pathlib.Path(handoff_path).parent if live_source else None
    if live_source:require(pathlib.Path(handoff_path)==pathlib.Path(dst).parent/'assets-snapshot-handoff.json','Asset handoff must remain outside runtime asset tree')
    started=utc_now();before=tree_state(src,evidence);dst=pathlib.Path(dst);require(not dst.exists() and not dst.is_symlink(),'Asset destination consumed');dst.mkdir(mode=0o700)
    for n in sorted(before['directories'],key=lambda v:(len(pathlib.Path(v).parts),v)):
        if n!='.':(dst/n).mkdir(mode=0o700)
    for n,row in before['files'].items():copy_file(pathlib.Path(src)/n,dst/n,row,check,evidence)
    after=tree_state(src,evidence)
    if live_source:write_new(evidence/'asset-copy-window-comparison.json',{'before':before,'after':after,'comparisonPassed':before==after,'observedUtc':utc_now(),'neverRetry':True})
    require(after==before,'Asset source changed; no retry')
    copied=identity_record(tree_state(dst)['files']);expected=identity_record(before['files'])
    compared_guard(copied==expected,'Asset copy differs',evidence,'asset-copy-bytes',expected,copied)
    if live_source:write_new(handoff_path,{'status':'FILESYSTEM_ONLY_STABLE_ASSET_COPY_WINDOW_HANDOFF','windowStartedUtc':started,'handoffUtc':utc_now(),'beforeLiveTree':before,'afterLiveTree':after,'rawCopyByteIdentity':copied,'databaseAssetsCrossFileAtomicityClaimed':False,'runtimeInputsOnlyNotScientificEvidence':True})
    return before

def live_metadata_observation():
    # A bounded stat-only observation is never a snapshot validity predicate.
    started=time.monotonic();out={'status':'STAT_ONLY_LIVE_EVOLUTION_OBSERVATION','observedUtc':utc_now(),'contentHashesTaken':0,'sqlConnections':0,'snapshotAuthority':False,'changesAreNotStopConditions':True}
    def meta(p):
        try:
            s=pathlib.Path(p).lstat();return {**stat_record(s),'allocatedBytes':getattr(s,'st_blocks',0)*512,'symlink':stat.S_ISLNK(s.st_mode)}
        except OSError as e:return {'unavailable':type(e).__name__}
    out['databaseTriple']={s:meta(str(pathlib.Path(LIVE_DATA)/'dev.db')+s) for s in ['', '-wal','-shm']};out['assetRoot']=meta(LIVE_ASSETS);rows={};dirs={}
    try:
        for directory,children,files in os.walk(LIVE_ASSETS,followlinks=False):
            p=pathlib.Path(directory);rel=p.relative_to(LIVE_ASSETS).as_posix();dirs[rel]=meta(p)
            for n in children:dirs[(p/n).relative_to(LIVE_ASSETS).as_posix()]=meta(p/n)
            if len(rows)+len(dirs)>FILE_LIMIT or time.monotonic()-started>15:
                out['status']='STAT_ONLY_OBSERVATION_BOUNDED_INCOMPLETE';out['assetFiles']=rows;out['assetDirectories']=dirs;return out
            for n in files:
                rows[(p/n).relative_to(LIVE_ASSETS).as_posix()]=meta(p/n)
                if len(rows)>FILE_LIMIT or time.monotonic()-started>15:
                    out['status']='STAT_ONLY_OBSERVATION_BOUNDED_INCOMPLETE';out['assetFiles']=rows;out['assetDirectories']=dirs;return out
    except OSError as e:out['assetObservationError']=type(e).__name__
    out['assetFiles']=rows;out['assetDirectories']=dirs;return out
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
def seal(root,label,source,check,live_source=False):
    d=child_path(root,pathlib.Path(root)/label);require(not d.exists(),'Seal consumed');d.mkdir(mode=0o700)
    require(not live_source or label=='fresh-production-snapshot','Only the production seal uses a live handoff')
    raw,original=copy_triple(source,d/'raw',check,live_source);reader,_=copy_triple(raw,d/'reader',check)
    for s,r in triple(reader).items():
        if r is not None:pathlib.Path(str(reader)+s).chmod(0o600)
    state=logical(reader);backup=d/'backup.db'
    # WAL is read by a normal read-only connection to the OWNED reader. immutable=1 is never used here.
    claim_copy(check,'backup')
    before=sqlite3.connect(reader.as_uri()+'?mode=ro',uri=True,timeout=10);after=sqlite3.connect(str(backup))
    try:before.backup(after,pages=256,sleep=0.05)
    finally:after.close();before.close()
    backup.chmod(0o400);require(logical(backup)==state,'Detached WAL-aware backup differs')
    handoff=exact_json((d/'raw/snapshot-handoff.json').read_bytes()) if live_source else None
    require((live_source or triple(source)==original) and identity_record(triple(raw))==(handoff['rawCopyByteIdentity'] if live_source else identity_record(original)),'Original or raw master changed while reading owned copy')
    write_new(d/'logical-state.json',state);write_new(d/'seal.json',{'rawMaster':str(raw),'rawMasterNeverOpenedSqlite':True,'backup':str(backup),'backupSha256':file_state(backup)['sha256'],'logicalStateSha256':sha(canonical(state)),'originalFiles':original,'countsIncludeWal':True,'productionSnapshotHandoff':handoff})
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

def delta_from_state(before,after,after_backup,new_tables,marker,order_column=False):
    # The old bound backup/reader are hash-validated, never opened in SQLite.
    require(set(after['tables'])-set(before['tables'])==new_tables and set(before['tables'])<=set(after['tables']),'Unexpected table delta')
    b=sqlite3.connect(pathlib.Path(after_backup).as_uri()+'?mode=ro',uri=True)
    try:
        for name,info in before['tables'].items():
            expected=info['columns']+(['workItemId'] if order_column and name=='OrderLine' else [])
            require(after['tables'][name]['columns']==expected,'Unexpected column delta '+name)
            if name=='_schema_migrations':
                cols=','.join(quote(c) for c in info['columns']);h=hashlib.sha256();count=0
                for row in b.execute('SELECT '+cols+' FROM "_schema_migrations" WHERE id != ? ORDER BY '+cols,(marker,)):
                    data=canonical([atom(v) for v in row]);h.update(len(data).to_bytes(8,'big'));h.update(data);count+=1
                require({'count':count,'sha256':h.hexdigest()}=={k:info[k] for k in ['count','sha256']} and after['tables'][name]['count']==info['count']+1,'Original migration receipt changed')
            else:require(table_fingerprint(b,name,info['columns'])=={k:info[k] for k in ['count','sha256']},'Original rows changed '+name)
            if order_column and name=='OrderLine':require(b.execute('SELECT count(*) FROM "OrderLine" WHERE "workItemId" IS NOT NULL').fetchone()[0]==0,'OrderLine backfill refused')
        require(all(after['tables'][n]['count']==0 for n in new_tables),'New evidence tables must be empty')
        prior={(r[0],r[1]):r for r in before['objects']};current_objects={(r[0],r[1]):r for r in after['objects']}
        for k,row in prior.items():require(k in current_objects and (current_objects[k]==row or order_column and k==('table','OrderLine')),'Original schema object changed '+k[1])
    finally:b.close()
    return {'allOriginalRowsAndReceiptsPreserved':True,'priorStateFromBoundRecordNoSql':True,'newTables':sorted(new_tables),'emptyEvidenceTables':True,'backfilledCount':0,'marker':marker,'totalTables':len(after['tables']),'schemaReceiptCount':after['tables']['_schema_migrations']['count']}
