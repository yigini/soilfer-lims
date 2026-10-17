"""Future backup snapshot observations and conditional MAIN+journal charges.

No owner uses this collector or plan. SQL entry, destination equality/freshness,
wrapper behavior and runtime binding remain separate admission requirements.
"""
import json,pathlib,re,stat
from kit_contract import canonical,require,sha
from retained_contract import exact_json
from kit_app_snapshots import regular
from kit_backup_main import backup_main_plan,declared_backup_main,PAGES,LIMIT
from kit_copy_admission import copy_layout,LIVE_BACKUP_JOURNAL_BYTES

PROOF='backup-source-binding-source.json'
ORIGINAL_LIMIT=1024*1024
FALSE_FIELDS=('newReaderCreationAndCallerBindingVerified','nativeReadonlySourceHandleVerified',
    'preObservationSqlCapacityAdmissionVerified','standardBuiltinsAndConnectionHooksVerified',
    'independentSnapshotToPrivateDbBytesProof','walToMainSemanticAssociationVerified',
    'kernelQuiescenceVerified','runtimeBinaryToSourceBindingVerified',
    'runtimeDefaultVfsVerified','writerGraphAdmissionImplemented','physicalFilesystemClosureClaimed')

def source_proof():
    here=pathlib.Path(__file__).resolve().parent;root=here.parents[1]
    raw=(here/PROOF).read_bytes();v=exact_json(raw)
    require(type(v.get('version')) is int and v['version']==1 and
        v.get('scope')=='FUTURE_BACKUP_SNAPSHOT_AND_CONDITIONAL_MAIN_JOURNAL_CHARGE' and
        v.get('actualOwnerIntegrationImplemented') is False and
        v.get('runtimeBinaryToSourceBindingVerified') is False,'Exact backup binding source proof required')
    for name,pin in v['files'].items():
        p=pathlib.PurePosixPath(name);require(p.as_posix()==name and not p.is_absolute() and '..' not in p.parts,'Canonical backup binding source path required')
        b=(root/name).read_bytes();require(type(pin) is dict and set(pin)=={'bytes','sha256'} and
            type(pin['bytes']) is int and len(b)==pin['bytes'] and sha(b)==pin['sha256'],'Backup binding source changed: '+name)
    return v,sha(raw)

def declared_observation_entry():
    return {'version':1,'alreadyOpenNativeReadonlyOwnedReader':True,'alreadyLoadedIntactMainSchema':True,
        'alreadyHeldReadTransactionAndEarlierSqlAdmittedSeparately':True,
        'noOtherHandlesSourceWritesOrCallbacksAndStateMutation':True,
        'ordinaryBuiltinPragmasAndFunctions':True,'noAttachedOrNamedTempSchemas':True}

def reader_path(value):
    require(type(value) is str,'Exact owned reader path string required')
    p=pathlib.Path(value);require(p.is_absolute() and p.name=='dev.db' and p.parent.name=='reader','Only declared owned reader/dev.db supported')
    return p

def observe_files(path):
    path=reader_path(str(path));require(path.resolve()==path,'Canonical owned reader required')
    require(not pathlib.Path(str(path)+'-journal').exists() and not pathlib.Path(str(path)+'-journal').is_symlink(),'Source rollback journal refused')
    info=path.parent.stat();require(stat.S_ISDIR(info.st_mode),'Owned reader directory required')
    files={s:regular(str(path)+s) for s in ('','-wal','-shm')}
    require(files[''] is not None and files['']['bytes']>=512 and
        all(r is None or r['device']==info.st_dev for r in files.values()) and
        len({(r['device'],r['inode']) for r in files.values() if r is not None})==sum(r is not None for r in files.values()),
        'Independent same-device source DB/WAL/SHM required')
    return files,[info.st_dev,info.st_ino,stat.S_IMODE(info.st_mode)]

def collect_backup_snapshot(db,entry):
    """Future invocation on an ALREADY open reader; never creates a connection."""
    _,digest=source_proof();require(canonical(entry)==canonical(declared_observation_entry()),'Exact future backup observer entry declaration required')
    require(db.in_transaction and db.execute('PRAGMA query_only').fetchone()==(1,) and
        db.execute('PRAGMA temp_store').fetchone()==(2,),'Existing query-only MEMORY read transaction required')
    rows=list(db.execute('PRAGMA database_list'));require(len(rows)==1 and rows[0][1]=='main','Single main without attached/TEMP schemas required')
    path=reader_path(rows[0][2])
    db.execute('SELECT count(*) FROM main.sqlite_schema').fetchone()
    before,directory=observe_files(path)
    n=db.execute('PRAGMA main.page_count').fetchone()[0];p=db.execute('PRAGMA main.page_size').fetchone()[0]
    version,source_id=db.execute('SELECT sqlite_version(),sqlite_source_id()').fetchone()
    after,end=observe_files(path)
    require(canonical(before)==canonical(after) and directory==end,'Backup source files or directory changed during snapshot observation')
    value={'version':1,'scope':'FUTURE_BACKUP_SOURCE_SNAPSHOT_OBSERVATION','sourceProofSha256':digest,
        'entryDeclaration':entry,'readerPath':str(path),'readerDirectoryIdentity':directory,'originalFiles':before,
        'observedPageCount':n,'observedPageSize':p,'collectorEngineVersion':version,'collectorEngineSourceId':source_id,
        'queryOnlyAndMemoryTempReadbackChecked':True,'snapshotQueryPrecedesPageMetadataAndDescriptorHashes':True,
        **{k:False for k in FALSE_FIELDS}}
    validate_snapshot(value);return value

def validate_snapshot(v):
    _,digest=source_proof()
    keys={'version','scope','sourceProofSha256','entryDeclaration','readerPath','readerDirectoryIdentity','originalFiles',
        'observedPageCount','observedPageSize','collectorEngineVersion','collectorEngineSourceId',
        'queryOnlyAndMemoryTempReadbackChecked','snapshotQueryPrecedesPageMetadataAndDescriptorHashes',*FALSE_FIELDS}
    require(type(v) is dict and set(v)==keys and type(v['version']) is int and v['version']==1 and
        v['scope']=='FUTURE_BACKUP_SOURCE_SNAPSHOT_OBSERVATION' and v['sourceProofSha256']==digest and
        canonical(v['entryDeclaration'])==canonical(declared_observation_entry()),'Exact complete future snapshot original required')
    reader_path(v['readerPath'])
    require(type(v['observedPageCount']) is int and 1<=v['observedPageCount']<=2147483647 and
        type(v['observedPageSize']) is int and v['observedPageSize'] in PAGES and
        v['observedPageCount']*v['observedPageSize']<=LIMIT,'Complete positive observed native page geometry required; never clip')
    require(type(v['readerDirectoryIdentity']) is list and len(v['readerDirectoryIdentity'])==3 and
        all(type(x) is int and x>=0 for x in v['readerDirectoryIdentity']),'Exact source directory identity required')
    files=v['originalFiles'];require(type(files) is dict and set(files)=={'','-wal','-shm'} and files[''] is not None,'Every source file observation required')
    for r in files.values():
        if r is not None:
            require(type(r) is dict and set(r)=={'sha256','bytes','device','inode','mtimeNs','mode','allocatedBytes'} and
                type(r['sha256']) is str and re.fullmatch('[a-f0-9]{64}',r['sha256']) and
                all(type(r[k]) is int and r[k]>=0 for k in r if k!='sha256') and r['bytes']<=LIMIT,'Exact complete source hash/identity required')
    require(files['']['bytes']>=512 and all(r is None or r['device']==v['readerDirectoryIdentity'][0] for r in files.values()) and
        len({(r['device'],r['inode']) for r in files.values() if r is not None})==sum(r is not None for r in files.values()),'Source identities must be independent and same-device')
    for k in ('collectorEngineVersion','collectorEngineSourceId'):
        require(type(v[k]) is str and 0<len(v[k])<300,'Observed engine strings required, never binary attestation')
    for k in ('queryOnlyAndMemoryTempReadbackChecked','snapshotQueryPrecedesPageMetadataAndDescriptorHashes'):require(v[k] is True,'Missing observer code-path check')
    for k in FALSE_FIELDS:require(v[k] is False,'Snapshot original cannot manufacture runtime/private-byte/admission authority')
    require(len(canonical(v))+1<=ORIGINAL_LIMIT,'Complete snapshot original exceeds proof envelope; never omit')
    return v

def original_snapshot(raw):
    require(type(raw) is bytes and 0<len(raw)<=ORIGINAL_LIMIT,'Complete bounded snapshot original bytes required')
    v=validate_snapshot(exact_json(raw));require(raw==canonical(v)+b'\n','Canonical whole snapshot original required');return v

def conditional_backup_charge(raw,profile,termination):
    """Pure whole-original replay, no target SQL/files and no later profile."""
    v=original_snapshot(raw);proof,digest=source_proof()
    main=backup_main_plan(v['observedPageCount'],v['observedPageSize'],declared_backup_main(profile,termination))
    maximum=main['maximumLogicalMainContentBytes'];journal=LIVE_BACKUP_JOURNAL_BYTES
    require(proof['journalProofMaximumBytes']==journal,'Exact full existing journal logical charge required')
    layout=copy_layout([maximum,journal],0)
    require(layout['roundedContentBytes']<=LIMIT,'Whole MAIN+journal rounded charge exceeds32GiB; never clip')
    return {'version':1,'scope':'SOURCE_BOUND_CONDITIONAL_BACKUP_MAIN_AND_JOURNAL_CHARGE',
        'sourceProofSha256':digest,'snapshotOriginal':json.loads(canonical(v)),
        'snapshotOriginalPin':{'bytes':len(raw),'sha256':sha(raw)},'mainPlan':main,
        'journalProofSha256':proof['journalProofSha256'],'fullJournalLogicalChargeBytes':journal,
        'completeMainAndJournalLayout':layout,'sourceSnapshotObservationBound':True,
        'nativeMainAndJournalLogicalChargesComposedConditionally':True,'fullChargeRetainedForEveryTermination':True,
        'destinationSuccessfullyCreatedWritableEmptyObserved':False,'destinationActualEqualPageSizeObserved':False,
        'actualNoRestartAndTerminationProfileObserved':False,'actualPythonWrapperToNativeBindingVerified':False,
        'actualOwnerIntegrationImplemented':False,'beforeDestinationCreateHeldAdmissionImplemented':False,
        'earlierReaderSqlAdmissionImplemented':False,'completeBackupCallerOrSourceCloseBounded':False,
        'mainFileLengthOrVfsPreallocationBounded':False,'completeDestinationDirtyCallOrCumulativeWriteCountDerived':False,
        **{k:False for k in FALSE_FIELDS}}

def replay_backup_charge(plan):
    require(type(plan) is dict and plan.get('scope')=='SOURCE_BOUND_CONDITIONAL_BACKUP_MAIN_AND_JOURNAL_CHARGE','Exact whole backup charge required')
    expected=conditional_backup_charge(canonical(plan['snapshotOriginal'])+b'\n',plan['mainPlan']['nativeDeclaration']['profile'],plan['mainPlan']['nativeDeclaration']['termination'])
    require(canonical(expected)==canonical(plan),'Snapshot/source/MAIN/journal/whole layout/authority changed')
    return plan

def recheck_backup_source(plan):
    replay_backup_charge(plan);v=plan['snapshotOriginal'];files,directory=observe_files(v['readerPath'])
    require(canonical(files)==canonical(v['originalFiles']) and directory==v['readerDirectoryIdentity'],'Original backup source bytes/inodes/directory changed')
    return plan

def check_unused_destination(plan,destination):
    """Read-only namespace precondition; creates/reserves/admits NOTHING."""
    recheck_backup_source(plan);require(type(destination) is str,'Exact destination path required');p=pathlib.Path(destination)
    require(p.is_absolute() and p.resolve()==p and p.parent.is_dir() and not p.parent.is_symlink(),'Canonical existing destination directory required')
    for q in (p,*p.parents):require(not q.is_symlink(),'Destination ancestor alias refused')
    source=pathlib.Path(plan['snapshotOriginal']['readerPath'])
    require(p.parent!=source.parent,'Destination must be separate from source reader directory')
    for suffix in ('','-journal','-wal','-shm'):
        q=pathlib.Path(str(p)+suffix);require(not q.exists() and not q.is_symlink(),'Destination namespace already consumed or has sidecars')
    return {'unusedNamesCheckedBeforeCreate':True,'sourceRecheckedThroughDescriptorsOnly':True,
        'destinationCreatedOrReserved':False,'heldCapacityOrAdmissionGranted':False,'physicalFilesystemClosureClaimed':False}
