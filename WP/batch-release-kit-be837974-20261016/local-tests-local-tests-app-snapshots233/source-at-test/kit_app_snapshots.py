"""Scoped admission for the pinned installers' retained policy copies.

The child remains the unmodified application CLI. Its source-derived copy
bound requires the separately verified absence of other writers. This is not
a filesystem quota: SQL scratch files, writer journals and daemon output are
explicitly outside this admission. No SQLite connection is opened here.
"""
import pathlib
import re
import stat
from kit_contract import require
from kit_copy_admission import copy_layout
from retained_files import file_state,identity_record

# Each order owner retains the primary policy copy, then the chart
# prerequisite's secondary policy copy. The impact CLI calls that same owner.
CLI_SNAPSHOTS={'canonical-policy':1,'order-impact':2,
    **{'214-'+phase:1 for phase in ('dry','apply','repeat')},
    **{'209-'+phase:2 for phase in ('dry','apply','repeat')}}
SUFFIXES=('','-wal','-shm')


def regular(path):
    path=pathlib.Path(path)
    for p in (path,*path.parents):require(not p.is_symlink(),'Snapshot file or ancestor alias refused')
    if not path.exists():return None
    s=path.lstat()
    require(stat.S_ISREG(s.st_mode) and s.st_nlink==1,'Independent regular snapshot file required')
    return file_state(path)


def index_bytes(wal_bytes,existing_bytes):
    require(all(type(n) is int and n>=0 for n in (wal_bytes,existing_bytes)),
        'Exact nonnegative snapshot side-file lengths required')
    # Same ordinary-reader bound as retained_files.reader_index_bound: a
    # minimum512-byte database page plus24-byte frame; first4062 frames then
    #4096 per additional32KiB index unit. Preserve any larger existing index.
    frames=max(0,wal_bytes-32)//(512+24)
    units=1+(max(0,frames-4062)+4095)//4096
    return max(units*32768,((existing_bytes+32767)//32768)*32768)


def snapshot_plan(target,count):
    require(type(count) is int and count in (1,2),'Only the compiled CLI snapshot maxima are admitted')
    target=pathlib.Path(target)
    require(target.is_absolute(),'Absolute source database required')
    require(not pathlib.Path(str(target)+'-journal').exists(),'Source rollback journal makes snapshot admission uncertain')
    before={suffix:regular(str(target)+suffix) for suffix in SUFFIXES}
    require(before[''] is not None and before['']['bytes']>=512,'Existing bounded SQLite main file required')
    wal=0 if before['-wal'] is None else before['-wal']['bytes']
    shm=0 if before['-shm'] is None else before['-shm']['bytes']
    maximum_index=index_bytes(wal,shm)
    # Charge all three entries even if WAL/SHM is initially absent. Native
    # ordinary read-only SQLite may create those two side-file names.
    layout=copy_layout([before['']['bytes'],wal,maximum_index]*count,count)
    return {'version':1,'source':str(target),'maximumSnapshots':count,
        'sourceDbWalShm':identity_record(before),'maximumIndexBytes':maximum_index,
        'layout':layout,'sourceQuiescenceRequired':True,
        'sourceDerivedCopyAndReaderIndexAdmission':True,
        'contentHardLimitEnforced':False,'sqlTemporaryFilesBounded':False,
        'writerJournalsAndWalGrowthBounded':False,'filesystemClosureClaimed':False}


def unchanged_source(target,admission):
    actual={suffix:regular(str(target)+suffix) for suffix in SUFFIXES}
    require(identity_record(actual)==admission['sourceDbWalShm'],
        'Source triple changed during pre-create snapshot admission; never retry')


def verify_snapshots(directory,admission):
    """Audit stopped-child originals before granting its wrapper exit permit.

    This audit does not turn an after-write observation into a hard quota.
    The before-create source/call-graph bound remains a separate precondition.
    """
    directory=pathlib.Path(directory)
    require(directory.is_dir() and not directory.is_symlink(),'Real retained CLI temporary directory required')
    snapshots=[]
    def scan(root,outer=False):
        for p in root.iterdir():
            require(not p.is_symlink(),'Retained snapshot alias refused')
            if p.is_dir():
                if re.fullmatch(r'lims-policy-schema-readonly-[A-Za-z0-9_-]+',p.name):
                    names={f.name for f in p.iterdir()}
                    require('snapshot.db' in names and names<={'snapshot.db'+s for s in SUFFIXES},
                        'Unexpected file or journal in retained policy snapshot')
                    snapshots.append(p/'snapshot.db')
                else:
                    require(not outer and re.fullmatch(r'lims-order-impact-[A-Za-z0-9_-]+',p.name),
                        'Unreviewed application temporary directory')
                    scan(p,True)
            else:require(p.is_file(),'Unexpected application temporary file type')
    scan(directory)
    require(len(snapshots)==admission['maximumSnapshots'],'Missing or extra retained policy snapshot')
    records=[]
    for database in sorted(snapshots):
        rows={s:regular(str(database)+s) for s in SUFFIXES}
        for suffix in ('','-wal'):
            expected=admission['sourceDbWalShm'][suffix]
            actual=identity_record(rows)[suffix]
            if suffix=='-wal' and expected is None:
                require(actual is None or actual['bytes']==0,'Previously absent WAL acquired data')
            else:require(actual==expected,'Retained policy main/WAL differs from admitted source')
        require(rows['-shm'] is None or rows['-shm']['bytes']<=admission['maximumIndexBytes'],
            'Retained policy reader index exceeds its before-create allowance')
        records.append({'database':str(database),'files':rows})
    return {'snapshots':records,'maximumSnapshots':admission['maximumSnapshots'],
        'mainWalSourceIdentityEqual':True,'readerIndexesWithinAdmission':True,
        'filesystemClosureClaimed':False,'sqlTemporaryFilesBounded':False}
