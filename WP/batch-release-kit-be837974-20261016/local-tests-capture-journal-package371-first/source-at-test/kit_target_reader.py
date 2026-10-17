"""Before-create WAL-index admission for the two writable-clone DRY readers.

No SQL, settings change or transaction interception. Only206/214 --dry-run
reach these target readers without opening a writer. APPLY/repeat and all
SQLite scratch, writer growth and physical metadata remain separate work.
"""
import pathlib
import stat
from kit_contract import require
from kit_copy_admission import copy_layout
from kit_app_snapshots import regular,index_bytes,SUFFIXES
from retained_files import identity_record,reader_mapping_precondition

TARGET_READER_SITES={'206-dry':'target-reader-index','214-dry':'target-reader-index'}
TARGET_READER_SCRIPTS={'206-dry':'install_sample_containers.js','214-dry':'install_control_charts.js'}


def target_reader_plan(spec):
    label=spec.get('label')
    require(label in TARGET_READER_SITES and spec.get('child')==[
        '/app/server/scripts/'+TARGET_READER_SCRIPTS[label],'--db','/app/server/prisma/dev.db','--dry-run'],
        'Only the two pinned DRY readers have this target-index admission')
    mount=spec['mounts'][0]
    require(mount.get('Type')=='bind' and mount.get('RW') is True and
        mount.get('Destination')=='/app/server/prisma' and spec.get('dataWritable') is True,
        'Exact independently retained writable DRY clone required')
    directory=pathlib.Path(mount['Source'])
    require(directory.is_absolute() and directory.resolve()==directory and directory.is_dir(),
        'Canonical existing target-reader directory required')
    for part in (directory,*directory.parents):require(not part.is_symlink(),'Target-reader ancestor alias refused')
    require({p.name for p in directory.iterdir()}<={'dev.db'+s for s in SUFFIXES},
        'Target reader has a journal or unreviewed directory entry')
    mapping=reader_mapping_precondition()
    target=directory/'dev.db';before={s:regular(str(target)+s) for s in SUFFIXES}
    require(before[''] is not None and before['']['bytes']>=512,'Bounded existing target-reader main required')
    device=directory.stat().st_dev;inodes=set()
    for row in before.values():
        if row is None:continue
        key=(row['device'],row['inode'])
        require(row['device']==device and key not in inodes,'Target-reader device or inode alias refused')
        inodes.add(key)
    wal=0 if before['-wal'] is None else before['-wal']['bytes']
    shm=0 if before['-shm'] is None else before['-shm']['bytes']
    maximum=index_bytes(wal,shm)
    return {'version':1,'label':label,'source':str(target),
        'directoryIdentity':[device,directory.stat().st_ino],
        'sourceDbWalShm':identity_record(before),'originalFiles':before,
        'maximumIndexBytes':maximum,'layout':copy_layout([maximum,0],0),
        'mappingPrecondition':mapping,'beforeContainerCreation':True,
        'sourceQuiescenceRequired':True,'reviewedCommandOpensWriter':False,
        'sqlTemporaryFilesBounded':False,'writerGrowthBounded':False,
        'physicalFilesystemClosureClaimed':False}


def close_target_reader(plan):
    target=pathlib.Path(plan['source']);directory=target.parent
    for part in (target,*target.parents):require(not part.is_symlink(),'Target-reader closure alias refused')
    require(directory.is_dir() and [directory.stat().st_dev,directory.stat().st_ino]==plan['directoryIdentity'],
        'Target-reader directory identity changed')
    require({p.name for p in directory.iterdir()}<={'dev.db'+s for s in SUFFIXES},
        'Target reader created a journal or unreviewed entry')
    # Refuse an oversized SHM BEFORE reading/hashing its content.
    shm=pathlib.Path(str(target)+'-shm')
    if shm.exists():
        s=shm.lstat()
        require(stat.S_ISREG(s.st_mode) and s.st_nlink==1 and s.st_size<=plan['maximumIndexBytes'],
            'Target-reader index exceeds its before-create allowance or aliases another file')
    current={s:regular(str(target)+s) for s in SUFFIXES};original=plan['originalFiles']
    for suffix in ('','-wal'):
        before=original[suffix];after=current[suffix]
        if suffix=='-wal' and before is None:
            require(after is None or after['bytes']==0,'Absent target WAL acquired content')
        else:
            require(before is not None and after is not None and all(before[k]==after[k]
                for k in ('device','inode','bytes','sha256','mode')),
                'Target-reader main or WAL changed')
    for row in current.values():
        require(row is None or row['device']==plan['directoryIdentity'][0],
            'Target-reader file moved to another device')
    return {'version':1,'label':plan['label'],'source':plan['source'],'files':current,
        'mainAndWalUnchanged':True,'targetReaderIndexWithinBeforeCreateAllowance':True,
        'maximumIndexBytes':plan['maximumIndexBytes'],'reviewedCommandOpensWriter':False,
        'sqlTemporaryFilesBounded':False,'writerGrowthBounded':False,
        'physicalFilesystemClosureClaimed':False}
