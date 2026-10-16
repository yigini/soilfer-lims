"""Cold boundary: complete Docker RW mounts and writable host file descriptors.

Only stopped predecessor phases call this guard. Explicit kernel FD links are
followed to their device/inode; spelling a DB path differently earns no credit.
"""
import os
import pathlib
import re
import time
from kit_contract import require
from retained_contract import LIVE_DATA,LIVE_ASSETS

def access_flags(raw):
    require(isinstance(raw,bytes) and len(raw)<=8192,'Bounded descriptor flags required')
    rows=[line.split(b':',1)[1].strip() for line in raw.splitlines() if line.startswith(b'flags:')]
    require(len(rows)==1 and re.fullmatch(rb'[0-7]+',rows[0]),'Exact octal writable descriptor classification required')
    return int(rows[0],8)&os.O_ACCMODE

def host_descriptors(protected,proc='/proc',clock=time.monotonic):
    deadline=clock()+60;root=pathlib.Path(proc);count=0
    for process in root.iterdir():
        if not process.name.isdigit():continue
        require(clock()<deadline,'Complete writable-descriptor inventory deadline reached')
        try:
            for fd in (process/'fd').iterdir():
                count+=1;require(count<=262144 and clock()<deadline,'Descriptor inventory incomplete or too large')
                try:
                    row=fd.stat()
                    if (row.st_dev,row.st_ino) not in protected:continue
                    raw=(process/'fdinfo'/fd.name).read_bytes()
                    require(access_flags(raw)==os.O_RDONLY,'A writable original SQLite descriptor remains')
                except (FileNotFoundError,ProcessLookupError):continue
        except (FileNotFoundError,ProcessLookupError):continue
    return {'descriptorsInspected':count,'writableProtectedDescriptors':0,'complete':True}

def assert_no_volume_writers(reader,descriptor_reader=host_descriptors,paths=(LIVE_DATA,LIVE_ASSETS)):
    protected_paths=[pathlib.Path(p) for p in paths]
    for path in protected_paths:
        require(path.is_absolute() and path.is_dir(),'Existing absolute protected volume directory required')
        for ancestor in (path,*path.parents):require(not ancestor.is_symlink(),'Protected volume alias refused')
    inventory=reader.inventory()
    for identity,obj in inventory.items():
        require(obj.get('Id')==identity and type(obj.get('State',{}).get('Running')) is bool,
            'Complete container writer state required')
        mounts=obj.get('Mounts')
        require(isinstance(mounts,list) and all(isinstance(m,dict) and isinstance(m.get('Source'),str) and
            type(m.get('RW')) is bool for m in mounts),'Complete container mount writer classification required')
        for mount in mounts:
            source=pathlib.Path(mount['Source'])
            require(source.is_absolute(),'Canonical absolute mount source required')
            for ancestor in (source,*source.parents):require(not ancestor.is_symlink(),'Mount source alias refused')
            if obj['State']['Running'] and mount['RW']:
                require(not any(source==p or source in p.parents or p in source.parents for p in protected_paths),
                    'A running container still writes a protected volume')
    before={}
    for suffix in ('','-wal','-shm'):
        path=protected_paths[0]/('dev.db'+suffix)
        before[suffix]=None if not path.exists() else (path.stat().st_dev,path.stat().st_ino)
    require(before[''] is not None,'Protected stopped database missing')
    descriptors=descriptor_reader({row for row in before.values() if row is not None})
    require(descriptors.get('complete') is True and descriptors.get('writableProtectedDescriptors')==0,
        'Complete writable host descriptor refusal required')
    after={}
    for suffix in before:
        path=protected_paths[0]/('dev.db'+suffix)
        after[suffix]=None if not path.exists() else (path.stat().st_dev,path.stat().st_ino)
    require(before==after,'Protected file inode set changed during writer inventory')
    return {'noRunningProtectedVolumeWriter':True,'protectedInodes':before,'hostDescriptorInventory':descriptors,
        'completeContainerCount':len(inventory),'originalFilesOpenedSqlite':0}
