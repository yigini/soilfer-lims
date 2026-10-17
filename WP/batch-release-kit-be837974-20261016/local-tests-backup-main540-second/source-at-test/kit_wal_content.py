"""Conditional WAL content from COMPLETE DECLARED native frame requests.

SQL/B-tree/page counts are not native WAL frame inventories. No writer uses
this primitive. Main/checkpoint growth, SHM, runtime/VFS and physical blocks
remain separate obligations. Observations never open a target through SQL.
"""
import hashlib
import io
import os
import pathlib
import re
import stat
from kit_contract import canonical,require,sha
from retained_contract import exact_json
from kit_copy_admission import MAX_CONTENT_BYTES,copy_layout
from kit_app_snapshots import regular,unchanged_source,SUFFIXES
from retained_files import identity_record

PROOF_NAME='wal-content-source.json'
MAX_SECTOR_BYTES=65536
WAL_HEADER_BYTES=32
FRAME_HEADER_BYTES=24


def source_proof():
    here=pathlib.Path(__file__).resolve().parent;root=here.parents[1]
    raw=(here/PROOF_NAME).read_bytes();value=exact_json(raw)
    require(value.get('scope')=='CONDITIONAL_DECLARED_NATIVE_WAL_FRAME_CONTENT' and
        value.get('maximumSectorBytes')==MAX_SECTOR_BYTES and
        value.get('completeApplicationFrameInventory') is False and
        value.get('writerGraphAdmissionImplemented') is False and
        value.get('walFileLengthOrVfsPreallocationBounded') is False and
        value.get('physicalFilesystemClosureClaimed') is False,'Exact conditional WAL source proof required')
    for name,pin in value['files'].items():
        path=pathlib.PurePosixPath(name)
        require(not path.is_absolute() and '..' not in path.parts and path.as_posix()==name,
            'Exact source-relative WAL proof paths required')
        actual=regular(root/name)
        require(actual is not None and canonical({q:actual[q] for q in ('bytes','sha256')})==canonical(pin),
            'WAL native/tooling source changed: '+name)
    return sha(raw)


def page_size(value):
    require(type(value) is int and 512<=value<=65536 and value&(value-1)==0,
        'Exact power-of-two WAL page size required')
    return value


def declared_frames(entries,sets,commits,caller_sha):
    return {'version':1,'scope':'DECLARED_COMPLETE_NATIVE_WAL_FRAME_REQUESTS',
        'callerReviewSha256':caller_sha,'maximumPageFrameEntries':entries,
        'maximumFrameSets':sets,'maximumCommitFrameSets':commits,
        'oneWalWriterHandle':True,'oneForwardTransaction':True,
        'continuedWritingAfterRollbackOrSqlError':False}


def wal_content_bound(size,initial_wal_bytes,inventory):
    page_size(size)
    require(type(initial_wal_bytes) is int and 0<=initial_wal_bytes<=MAX_CONTENT_BYTES and
        (initial_wal_bytes==0 or initial_wal_bytes>=32 and (initial_wal_bytes-32)%(size+24)==0),
        'Complete initial WAL extent must contain whole frames, never clip a tail')
    require(type(inventory) is dict and set(inventory)=={'version','scope','callerReviewSha256',
        'maximumPageFrameEntries','maximumFrameSets','maximumCommitFrameSets','oneWalWriterHandle',
        'oneForwardTransaction','continuedWritingAfterRollbackOrSqlError'} and
        type(inventory['version']) is int and inventory['version']==1 and
        inventory['scope']=='DECLARED_COMPLETE_NATIVE_WAL_FRAME_REQUESTS' and
        isinstance(inventory['callerReviewSha256'],str) and re.fullmatch('[a-f0-9]{64}',inventory['callerReviewSha256']) and
        all(type(inventory[q]) is int for q in ('maximumPageFrameEntries','maximumFrameSets','maximumCommitFrameSets')) and
        0<=inventory['maximumCommitFrameSets']<=1 and
        0<=inventory['maximumCommitFrameSets']<=inventory['maximumFrameSets']<=inventory['maximumPageFrameEntries']<=1000000000 and
        (inventory['maximumFrameSets']>0 or inventory['maximumPageFrameEntries']==0) and
        inventory['oneWalWriterHandle'] is True and inventory['oneForwardTransaction'] is True and
        inventory['continuedWritingAfterRollbackOrSqlError'] is False,
        'Complete native WAL frame entries/sets required; SQL and B-tree counts are insufficient')
    frame=size+FRAME_HEADER_BYTES;initial=max(0,initial_wal_bytes-32)//frame
    # walFrames repeats its final commit frame until the sanitized sector
    # boundary is crossed. Charge the full maximum gap for every commit,
    # regardless of actual sync flags or powersafe-overwrite capability.
    padding=(MAX_SECTOR_BYTES-1+frame-1)//frame
    extra=inventory['maximumPageFrameEntries']+inventory['maximumCommitFrameSets']*padding
    maximum_frames=initial+extra
    end=32+maximum_frames*frame if initial_wal_bytes or inventory['maximumFrameSets'] else 0
    maximum=max(initial_wal_bytes,end)
    require(maximum_frames<=4294967294 and maximum<=MAX_CONTENT_BYTES,
        'Complete WAL content exceeds its planning envelope; never clip')
    return {'version':1,'scope':'CONDITIONAL_DECLARED_NATIVE_WAL_FRAME_CONTENT',
        'sourceProofSha256':source_proof(),'pageSize':size,'walHeaderBytes':32,'frameHeaderBytes':24,
        'frameBytes':frame,'initialWalBytes':initial_wal_bytes,'initialPhysicalFrameSlots':initial,
        'declaredFrameRequests':exact_json(canonical(inventory)),
        'maximumSectorBytes':MAX_SECTOR_BYTES,'maximumPaddingFramesPerCommit':padding,
        'maximumAdditionalFrameSlots':extra,'maximumPhysicalFrameSlots':maximum_frames,
        'maximumWalLogicalContentBytes':maximum,'maximumLogicalContentGrowthBytes':maximum-initial_wal_bytes,
        'layout':copy_layout([maximum],0),'overwriteRestartTruncateRollbackCreditBytes':0,
        'requiresCompleteNativeFrameInventory':True,'requiresIntactSourceAndRecoveredWalIndex':True,
        'requiresOneForwardWriterAndNoConcurrentWriters':True,'conditionalWalLogicalContentBounded':True,
        'callerReviewVerified':False,'completeApplicationFrameInventory':False,
        'collectorBindingImplemented':False,'runtimeBinaryToSourceBindingVerified':False,
        'runtimeDefaultVfsVerified':False,'writerGraphAdmissionImplemented':False,
        'walFileLengthOrVfsPreallocationBounded':False,'mainCheckpointGrowthBounded':False,
        'shmWriterGrowthBounded':False,'statementOrSqlScratchBounded':False,
        'fullLifetimeOriginalsRetained':False,'continuousPeakMeasured':False,
        'physicalFilesystemClosureClaimed':False}


def checksum(raw,big_endian,prior=(0,0)):
    require(type(raw) is bytes and len(raw)%8==0 and type(big_endian) is bool,
        'Complete eight-byte checksum words and explicit byte order required')
    first,second=prior;order='big' if big_endian else 'little'
    for offset in range(0,len(raw),8):
        first=(first+int.from_bytes(raw[offset:offset+4],order)+second)&0xffffffff
        second=(second+int.from_bytes(raw[offset+4:offset+8],order)+first)&0xffffffff
    return first,second


def scan_wal(stream,length,size):
    page_size(size)
    require(type(length) is int and 0<=length<=MAX_CONTENT_BYTES and
        (length==0 or length>=32 and (length-32)%(size+24)==0),
        'Full WAL extent with whole frames required')
    digest=hashlib.sha256()
    def read(count):
        raw=stream.read(count);require(type(raw) is bytes and len(raw)==count,'Short complete WAL read')
        digest.update(raw);return raw
    if length==0:
        require(stream.read(1)==b'','Extra WAL bytes beyond declared complete extent')
        return {'bytes':0,'sha256':digest.hexdigest(),'headerHex':None,'physicalFrames':0,
            'lastCommitFrame':0,'lastCommittedDatabasePages':None,'fullWalChecksumsObserved':True}
    header=read(32);magic=int.from_bytes(header[:4],'big')
    require(magic in (0x377f0682,0x377f0683) and int.from_bytes(header[4:8],'big')==3007000 and
        int.from_bytes(header[8:12],'big')==size,'Supported WAL magic/version/page size required')
    big=bool(magic&1);sums=checksum(header[:24],big)
    require(sums==(int.from_bytes(header[24:28],'big'),int.from_bytes(header[28:32],'big')),
        'WAL header checksum differs')
    frames=(length-32)//(size+24);last_commit=0;database_pages=None
    for ordinal in range(1,frames+1):
        raw=read(size+24);page=int.from_bytes(raw[:4],'big');commit=int.from_bytes(raw[4:8],'big')
        require(1<=page<=4294967294 and commit<=4294967294 and raw[8:16]==header[16:24],
            'WAL frame page/salt differs; no stale tail is silently omitted')
        sums=checksum(raw[:8],big,sums);sums=checksum(raw[24:],big,sums)
        require(sums==(int.from_bytes(raw[16:20],'big'),int.from_bytes(raw[20:24],'big')),
            'WAL frame checksum differs; no invalid tail is silently omitted')
        if commit:last_commit=ordinal;database_pages=commit
    require(not frames or last_commit==frames,'Uncommitted WAL tail is outside this initial profile')
    require(stream.read(1)==b'','Extra WAL bytes beyond declared complete extent')
    return {'bytes':length,'sha256':digest.hexdigest(),'headerHex':header.hex(),'physicalFrames':frames,
        'lastCommitFrame':last_commit,'lastCommittedDatabasePages':database_pages,'fullWalChecksumsObserved':True}


def wal_bytes_profile(raw,size):
    require(type(raw) is bytes,'Full WAL original bytes required')
    return scan_wal(io.BytesIO(raw),len(raw),size)


def wal_content_plan(target,inventory):
    target=pathlib.Path(target)
    require(target.is_absolute() and target.resolve()==target and target.is_file(),'Canonical WAL main file required')
    parent=target.parent;parent_before=parent.stat();device=parent_before.st_dev
    require(not pathlib.Path(str(target)+'-journal').exists() and not pathlib.Path(str(target)+'-journal').is_symlink(),
        'Rollback journal is outside the WAL profile')
    for suffix in SUFFIXES:
        path=pathlib.Path(str(target)+suffix)
        if path.exists():require(path.stat().st_size<=MAX_CONTENT_BYTES,'Complete WAL source too large; never clip')
    before={suffix:regular(str(target)+suffix) for suffix in SUFFIXES};identities=set()
    for suffix,row in before.items():
        if row is None:continue
        key=(row['device'],row['inode'])
        require(row['device']==device and key not in identities,'WAL source device/inode alias refused');identities.add(key)
        if suffix=='-shm':require(row['bytes']==0,'Existing nonempty WAL index needs separate native validation')
    require(before[''] is not None and before['']['bytes']>=512,'Complete existing main source required')
    flags=os.O_RDONLY|getattr(os,'O_NOFOLLOW',0)|getattr(os,'O_BINARY',0)
    def descriptor(path,row):
        fd=os.open(str(path),flags);info=os.fstat(fd)
        try:
            require(stat.S_ISREG(info.st_mode) and info.st_nlink==1 and
                (info.st_dev,info.st_ino,info.st_size)==(row['device'],row['inode'],row['bytes']),
                'WAL observation descriptor differs from full source hash')
        except BaseException:
            os.close(fd);raise
        return fd
    fd=descriptor(target,before[''])
    try:header=os.read(fd,100)
    finally:os.close(fd)
    require(len(header)==100 and header[:16]==b'SQLite format 3\0' and header[18:20]==b'\2\2',
        'Exact WAL main header required; rollback geometry is not reused')
    size=page_size(65536 if int.from_bytes(header[16:18],'big')==1 else int.from_bytes(header[16:18],'big'))
    require(before['']['bytes']%size==0,'Whole main pages required')
    wal=before['-wal']
    if wal is None:observation=wal_bytes_profile(b'',size)
    else:
        fd=descriptor(str(target)+'-wal',wal)
        with os.fdopen(fd,'rb') as stream:observation=scan_wal(stream,wal['bytes'],size)
        require(observation['sha256']==wal['sha256'],'WAL bytes changed during complete checksum observation')
    bound=wal_content_bound(size,observation['bytes'],inventory)
    result={'version':1,'scope':'OBSERVED_SOURCE_DECLARED_WAL_CONTENT_PLAN','source':str(target),
        'sourceDbWalShm':identity_record(before),'originalFiles':before,
        'directoryIdentity':[parent_before.st_dev,parent_before.st_ino,stat.S_IMODE(parent_before.st_mode)],
        'headerHex':header.hex(),'walObservation':observation,
        'mainPhysicalPages':before['']['bytes']//size,'bound':bound,
        'mainHeaderPageCountIsCurrentWalDatabaseSize':False,'sourceByteIdentityObserved':True,
        'nativeRecoveredWalIndexObserved':False,'sourceQuiescenceVerified':False,
        'independentHeaderToPrivateDbBytesProof':False,'mainDatabaseIntegrityVerified':False,
        'completeApplicationFrameInventory':False,'writerGraphAdmissionImplemented':False,
        'walFileLengthOrVfsPreallocationBounded':False,'physicalFilesystemClosureClaimed':False}
    unchanged_source(target,result)
    require(canonical({suffix:regular(str(target)+suffix) for suffix in SUFFIXES})==canonical(before),
        'WAL source descriptor identities or metadata changed during observation')
    parent_after=parent.stat()
    require(parent.resolve()==parent and [parent_after.st_dev,parent_after.st_ino,stat.S_IMODE(parent_after.st_mode)]==result['directoryIdentity'],
        'WAL source directory identity changed during observation')
    return result


def recheck_wal_content(plan):
    require(type(plan) is dict and plan.get('scope')=='OBSERVED_SOURCE_DECLARED_WAL_CONTENT_PLAN',
        'Exact original WAL observation required')
    expected=wal_content_plan(plan['source'],plan['bound']['declaredFrameRequests'])
    require(canonical(expected)==canonical(plan),'WAL source/profile/declaration changed; never retry')
    return plan
