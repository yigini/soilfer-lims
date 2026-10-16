"""Before-create content/entry admissions for controller-owned file copies.

This is a declared allocation model. Host filesystem metadata, SQLite's own
temporary/journal files and application/daemon producers still require the
complete filesystem closure; none is inferred from a successful admission.
"""
import pathlib
from kit_contract import require

BLOCK=4096
MAX_FILES=200000
MAX_DIRECTORIES=200001
MAX_CONTENT_BYTES=32*1024**3
LIVE_BACKUP_JOURNAL_BYTES=2*65536


def copy_layout(sizes,directories):
    require(isinstance(sizes,(list,tuple)) and len(sizes)<=MAX_FILES and
        all(type(n) is int and 0<=n<=MAX_CONTENT_BYTES for n in sizes) and
        type(directories) is int and 0<=directories<=MAX_DIRECTORIES,
        'Complete bounded copy file/directory layout required')
    content=sum(((n+BLOCK-1)//BLOCK)*BLOCK for n in sizes)
    require(sum(sizes)<=MAX_CONTENT_BYTES,'Copy content total exceeds its source bound')
    # File entry plus one inode block, and two directory blocks plus its parent
    # entry. These charges are explicit allowances, not filesystem measurements.
    metadata=len(sizes)*2*BLOCK+directories*3*BLOCK
    return {'fileCount':len(sizes),'directoryCount':directories,'contentBytes':sum(sizes),
        'roundedContentBytes':content,'entryAndInodeAllowanceBytes':metadata,
        'declaredAllocationBytes':content+metadata,'physicalFilesystemClosureClaimed':False}


def live_backup_limit(database_allocated):
    """Empty-destination backup: main file plus two maximum journal headers.

    The exact dependency/source proof is live-backup-sqlite-source.json. This
    does not cover application/daemon producers or physical filesystem metadata.
    """
    require(type(database_allocated) is int and database_allocated>0,
        'Measured live-backup allocation required')
    ceiling=(database_allocated*125+99)//100
    maximum=min(MAX_CONTENT_BYTES-LIVE_BACKUP_JOURNAL_BYTES,
        ((ceiling-LIVE_BACKUP_JOURNAL_BYTES-4*BLOCK)//BLOCK)*BLOCK)
    require(maximum>=512,'Live-backup content and file entries do not fit')
    return {'version':2,'maximumMainBytes':maximum,'maximumJournalBytes':LIVE_BACKUP_JOURNAL_BYTES,
        'filesystemClosureClaimed':False},copy_layout([maximum,LIVE_BACKUP_JOURNAL_BYTES],0)


def admit_copy(check,site,destination,sizes,directories):
    plan=copy_layout(sizes,directories)
    destination=pathlib.Path(destination)
    require(destination.is_absolute() and not destination.exists() and not destination.is_symlink(),
        'Copy admission requires an unused absolute destination')
    for part in (destination,*destination.parents):
        require(not part.is_symlink(),'Copy admission destination ancestor alias refused')
    owner=getattr(check,'__self__',None)
    if owner is not None:
        require(callable(getattr(owner,'admit_copy',None)),
            'Owned copy requires a complete before-create allocation admission')
        owner.admit_copy(site,destination,plan)
    # Plain callbacks are used only by local fixtures/retained readers. They do
    # not manufacture a production allocation authority.
    check()
    return plan
