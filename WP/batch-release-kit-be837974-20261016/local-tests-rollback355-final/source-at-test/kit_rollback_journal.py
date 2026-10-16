"""Conditional main rollback-journal sizing; no SQL, operator or settings write.

This component is not wired to the release/capture writer graph. Its supported
profile deliberately excludes WAL, auto-vacuum, existing journals, page moves,
ATTACH/VACUUM, custom VFS, continued writes after rollback/error, and settings changes. The caller still needs a
complete reviewed call graph and a separately held before-create admission.
A final absent journal is never evidence of its peak size or original bytes.
"""
import os
import pathlib
import stat
from kit_contract import require
from kit_copy_admission import copy_layout
from kit_app_snapshots import regular,unchanged_source,SUFFIXES
from retained_files import identity_record

MAX_SECTOR_BYTES=65536


def rollback_journal_bound(original_pages,page_size):
    require(type(original_pages) is int and 1<=original_pages<=4294967294 and
        type(page_size) is int and 512<=page_size<=65536 and page_size&(page_size-1)==0,
        'Exact bounded original page count and power-of-two SQLite page size required')
    # With no page moves or continued writes after a rollback/error, pInJournal
    # and NEED_SYNC follow the single forward transaction used by this bound.
    # Each original page contributes one (page number, content, checksum) record.
    records=original_pages*(page_size+8)
    # One initial header, at most one initial CACHEMOD spill, and at most one
    # later new-header sync per newly journalled original page. Each header is
    # charged its full maximum sector AND a full preceding alignment sector.
    headers=original_pages+2
    overhead=headers*2*MAX_SECTOR_BYTES
    return {'originalPages':original_pages,'pageSize':page_size,
        'maximumPageRecords':original_pages,'maximumJournalHeaders':headers,
        'maximumSectorBytes':MAX_SECTOR_BYTES,'pageRecordBytes':records,
        'headerAndAlignmentBytes':overhead,'maximumJournalBytes':records+overhead}


def rollback_journal_plan(target):
    target=pathlib.Path(target)
    require(target.is_absolute() and target.resolve()==target and target.is_file(),
        'Canonical existing rollback database required')
    for part in (target,*target.parents):require(not part.is_symlink(),'Rollback database ancestor alias refused')
    journal=pathlib.Path(str(target)+'-journal')
    require(not journal.exists() and not journal.is_symlink(),'Existing or aliased rollback journal refused')
    before={suffix:regular(str(target)+suffix) for suffix in SUFFIXES}
    require(before[''] is not None and before['']['bytes']>=512,'Existing SQLite main file required')
    identities=set();device=target.parent.stat().st_dev
    for suffix,row in before.items():
        if row is None:continue
        key=(row['device'],row['inode'])
        require(row['device']==device and key not in identities,'Rollback source device or inode alias refused')
        identities.add(key)
        if suffix:require(row['bytes']==0,'WAL or shared-memory content is outside this rollback profile')
    flags=os.O_RDONLY|getattr(os,'O_NOFOLLOW',0)|getattr(os,'O_BINARY',0)
    fd=os.open(str(target),flags)
    try:
        opened=os.fstat(fd)
        require(stat.S_ISREG(opened.st_mode) and opened.st_nlink==1 and
            (opened.st_dev,opened.st_ino,opened.st_size)==
            (before['']['device'],before['']['inode'],before['']['bytes']),
            'Rollback header descriptor does not match the independently hashed main file')
        header=os.read(fd,100)
        require(len(header)==100 and header[:16]==b'SQLite format 3\x00',
            'Complete native SQLite header required')
    finally:os.close(fd)
    page_size=int.from_bytes(header[16:18],'big');page_size=65536 if page_size==1 else page_size
    require(512<=page_size<=65536 and page_size&(page_size-1)==0 and
        before['']['bytes']%page_size==0,'Whole SQLite pages required')
    pages=before['']['bytes']//page_size
    require(header[18:20]==bytes([1,1]),'WAL or unknown database format is outside this rollback profile')
    require(int.from_bytes(header[28:32],'big')==pages and
        header[24:28]==header[92:96],'Current exact SQLite header page count required')
    require(header[52:56]==bytes(4) and header[64:68]==bytes(4),
        'Auto-vacuum/page-moving databases are outside this rollback proof')
    bound=rollback_journal_bound(pages,page_size)
    # This uses the existing bounded content/entry model. A calculation which
    # exceeds that model refuses; it never silently caps the native allowance.
    layout=copy_layout([bound['maximumJournalBytes']],0)
    plan={'version':1,'scope':'CONDITIONAL_SINGLE_MAIN_ROLLBACK_TRANSACTION',
        'source':str(target),'sourceDbWalShm':identity_record(before),'originalFiles':before,
        'journal':str(journal),'bound':bound,'layout':layout,
        'requiredBeforeWriterCreation':True,'sourceQuiescenceRequired':True,
        'requiresNoPageMoves':True,'requiresNoAttachVacuumOrJournalSettingChange':True,
        'requiresNoContinuingWritesAfterRollbackOrSqliteError':True,
        'requiresPinnedNativeVfsAndCompleteCallerReview':True,
        'maximumIsSourceDerivedNotSampledPeak':True,
        'writerGraphAdmissionImplemented':False,'walGrowthBounded':False,
        'mainDatabaseGrowthBounded':False,'statementOrSqlScratchBounded':False,
        'journalOriginalBytesRetained':False,'physicalFilesystemClosureClaimed':False}
    unchanged_source(target,plan)
    require(not journal.exists() and not journal.is_symlink(),'Journal appeared while planning')
    return plan
