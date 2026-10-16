"""Single-use filesystem snapshot and detached-clone provenance for capture.

Inert component, not a launcher. The complete launcher must independently
refresh primary provider authority before calling this source-gated component.
Raw production/master files are never connected to SQLite. Normal production
may evolve after the one before/copy/after handoff; no atomic absence, cross-file
DB/assets snapshot, physical quota or global filesystem closure is claimed.
"""
import os
import pathlib
import stat
from kit_contract import HEAD,IMAGE,MEMORY_MAX,canonical,require,sha
from retained_contract import ROOT,LIVE_DATA,LIVE_ASSETS,exact_json
from retained_files import (seal,copy_tree,clone_backup,triple,tree_state,file_state,identity_record,utc_now)
from kit_capture_owned import CAPTURE_ROOT,CAPTURE_UNIT,capture_mountinfo,capture_mount_guard,capture_clone_state
from kit_capture_budget import CaptureBudget,CaptureDisk,CAPTURE_TABLE_SHA
from kit_frozen import source_review,require_tokens
from kit_journal import exclusive_record
from kit_runtime import PREDECESSOR_ID,PREDECESSOR_HEAD,VOLUMES,predecessor_projection,environment
from controller_output import output_read_record


def capture_source_review(index,review):
    # This pure review predicate MUST precede even root/mount/kernel reads.
    binding=source_review(review,index)
    require_tokens(review['body'],[CAPTURE_ROOT.as_posix(),CAPTURE_UNIT,
        'captureTableSha256='+CAPTURE_TABLE_SHA,'captureFilesystemOnlyProductionCopy=true',
        'captureRawMastersNeverSqlite=true','capturePreparationIssues=206,214','capture209ApplyForbidden=true'])
    return binding


def capture_root(root):
    root=pathlib.Path(root)
    require(root.as_posix()==CAPTURE_ROOT.as_posix(),'Only the typed capture root is permitted')
    for part in (root,*root.parents):require(not part.is_symlink(),'Capture copy root ancestor alias refused')
    require(root.is_dir() and root.resolve()==root,'Existing canonical capture root required')
    capture_mount_guard(capture_mountinfo(),root)
    return root


def capture_stage(root,disk,label):
    require(type(disk) is CaptureDisk and type(disk.budget) is CaptureBudget and disk.root==root and
        disk.budget.active==label,'Exact separate capture disk/active stage required')
    disk.check()


def capture_predecessor(value):
    selected=predecessor_projection(value)
    state=value['State'];host=value['HostConfig'];config=value['Config'];env=environment(config)
    require(state.get('Running') is True and state.get('Health',{}).get('Status')=='healthy' and
        state.get('OOMKilled') is False and not state.get('Restarting') and not state.get('Dead') and
        type(value.get('RestartCount')) is int and value['RestartCount']==0 and
        type(state.get('Pid')) is int and state['Pid']>0,'Capture requires the healthy normal predecessor')
    require(host.get('Memory')==MEMORY_MAX and host.get('MemorySwap')==1610612736 and
        config.get('Labels',{}).get('org.opencontainers.image.revision')==PREDECESSOR_HEAD and
        env.get('NODE_OPTIONS','')=='' and env.get('ALLOW_PRISMA_DB_PUSH')=='false' and
        env.get('ALLOW_AUTO_SEED')=='false' and env.get('DISABLE_BACKGROUND_JOBS','false')!='true',
        'Normal predecessor limits/revision/heap/jobs flags differ')
    mounts=selected['mounts'];names={mount.get('Name') for mount in mounts}
    require(names in ({'lims_lims-data','lims_lims-assets'},set(VOLUMES)) and len(mounts)==len(names),
        'Capture normal predecessor named volumes differ')
    for mount in mounts:
        destination,source=VOLUMES[mount['Name']]
        require(mount.get('Type')=='volume' and mount.get('Source')==source and
            mount.get('Destination')==destination and mount.get('RW') is True,
            'Capture normal predecessor mount identity differs')
    return {**selected,'pid':state['Pid'],'runningHealthy':True,'restartCount':0,'oomKilled':False,
        'existingMemorySwap':1610612736}


def capture_live_directory():
    directory=pathlib.Path(LIVE_DATA)
    for part in (directory,*directory.parents):require(not part.is_symlink(),'Live source directory ancestor alias refused')
    require(directory.is_dir() and directory.resolve()==directory,'Exact canonical production data directory required')
    before=directory.stat();inodes=set()
    for suffix in ('','-wal','-shm','-journal'):
        path=directory/('dev.db'+suffix)
        require(not path.is_symlink(),'Live triple or dangling sidecar alias refused')
        if suffix=='-journal':require(not path.exists(),'Live rollback journal requires a separate reviewed copy protocol');continue
        if not path.exists():require(suffix!='','Production source main missing');continue
        value=path.lstat();identity=(value.st_dev,value.st_ino)
        require(stat.S_ISREG(value.st_mode) and value.st_nlink==1 and value.st_dev==before.st_dev and identity not in inodes,
            'Independent regular live triple on one filesystem required')
        inodes.add(identity)
    after=directory.stat();require((after.st_dev,after.st_ino)==(before.st_dev,before.st_ino),'Live source directory replaced')
    return [before.st_dev,before.st_ino]


def sync_capture_tree(directory):
    # Directory fsync is an operational requirement. LOCAL tests substitute
    # only this Linux durability boundary and never claim it was exercised.
    require(os.name=='posix','Linux capture file and directory fsync required')
    directory=pathlib.Path(directory);directories=[]
    for current,children,files in os.walk(directory,followlinks=False):
        path=pathlib.Path(current);directories.append(path)
        require(not path.is_symlink() and all(not (path/name).is_symlink() for name in children),
            'Capture fsync directory alias refused')
        for name in files:
            file=path/name;before=file_state(file)
            require(before is not None,'Capture file vanished before fsync')
            descriptor=os.open(str(file),os.O_RDONLY|getattr(os,'O_NOFOLLOW',0))
            try:
                held=os.fstat(descriptor)
                require((held.st_dev,held.st_ino)==(before['device'],before['inode']),'Capture fsync descriptor replaced')
                os.fsync(descriptor)
            finally:os.close(descriptor)
            require(file_state(file)==before,'Capture file changed during fsync')
    for path in reversed(directories):
        descriptor=os.open(str(path),os.O_RDONLY|getattr(os,'O_DIRECTORY',0)|getattr(os,'O_NOFOLLOW',0))
        try:os.fsync(descriptor)
        finally:os.close(descriptor)


def capture_reference(path):
    value=file_state(path);require(value is not None,'Capture reference missing')
    return {key:value[key] for key in ('bytes','sha256')}


def capture_snapshot(root,index,review,reader,disk):
    binding=capture_source_review(index,review)
    root=capture_root(root);capture_stage(root,disk,'capture-filesystem-snapshot')
    # Persist before the first live file stat/content open or Docker read.
    # A failure leaves this consumed pair and all partial output in place.
    exclusive_record(root,'capture-snapshot-intent.json',{'sourceBinding':binding,
        'captureTableSha256':CAPTURE_TABLE_SHA,'neverRetry':True,'productionSqliteConnections':0},disk.sync)
    started=utc_now();normal_before=capture_predecessor(reader.inspect(PREDECESSOR_ID))
    exclusive_record(root,'capture-normal-before.json',normal_before,disk.sync)
    source_directory=capture_live_directory()
    backup,state=seal(root,'fresh-production-snapshot',pathlib.Path(LIVE_DATA)/'dev.db',disk.check,True)
    # Count the owned WAL-aware backup, not a live connection or raw master.
    require(len(state['tables'])==106 and state['tables'].get('_schema_migrations',{}).get('count')==39,
        'Fresh owned production copy is not the expected106-table39-receipt predecessor')
    assets=copy_tree(LIVE_ASSETS,root/'captured-assets',disk.check,True,root/'assets-snapshot-handoff.json')
    require(capture_live_directory()==source_directory,'Live source directory identity changed after the handoff')
    normal_after=capture_predecessor(reader.inspect(PREDECESSOR_ID))
    exclusive_record(root,'capture-normal-after.json',normal_after,disk.sync)
    require(normal_before==normal_after,'Normal production identity/configuration changed during capture')
    snapshot=root/'fresh-production-snapshot';raw=snapshot/'raw/dev.db'
    handoff_path=snapshot/'raw/snapshot-handoff.json';handoff=exact_json(handoff_path.read_bytes())
    require(handoff['status']=='FILESYSTEM_ONLY_STABLE_COPY_WINDOW_HANDOFF' and
        handoff['beforeLiveTriple']==handoff['afterLiveTriple'] and
        identity_record(triple(raw))==handoff['rawCopyByteIdentity'],
        'Complete one stable production copy window required')
    # Includes the outer asset handoff and its parent-directory entry, as well
    # as raw/reader/backup files. All producer files must already be closed.
    sync_capture_tree(root)
    capture_root(root)
    result={'version':1,'root':root.as_posix(),'releaseRoot':str(ROOT),'unit':CAPTURE_UNIT,'head':HEAD,'image':IMAGE,
        'sourceBinding':binding,'captureTableSha256':CAPTURE_TABLE_SHA,'startedUtc':started,'closedUtc':utc_now(),
        'normalPredecessorProjectionSha256':sha(canonical(normal_before)),
        'normalBefore':capture_reference(root/'capture-normal-before.json'),
        'normalAfter':capture_reference(root/'capture-normal-after.json'),
        'rawTripleByteIdentity':identity_record(triple(raw)),'backup':capture_reference(backup),
        'logicalState':capture_reference(snapshot/'logical-state.json'),'handoff':capture_reference(handoff_path),
        'copyWindow':capture_reference(snapshot/'raw/copy-window-comparison.json'),
        'assetsHandoff':capture_reference(root/'assets-snapshot-handoff.json'),
        'assetsIdentitySha256':sha(canonical(identity_record(assets['files']))),
        'assetsDirectoryNames':sorted(assets['directories']),
        'tableCount':106,'schemaReceiptCount':39,'productionSqliteConnections':0,'rawMasterNeverOpenedSqlite':True,
        'databaseAssetsCrossFileAtomicityClaimed':False,'physicalFilesystemClosureClaimed':False,'neverRetry':True}
    require(len(canonical(result))+1<=8192,'Capture provenance exceeds its bounded immutable control')
    exclusive_record(root,'capture-snapshot-provenance.json',result,disk.sync)
    return result


def verify_capture_snapshot(root,binding):
    root=capture_root(root);value=output_read_record(root,'capture-snapshot-provenance.json')
    require(type(value.get('version')) is int and value['version']==1 and
        value.get('root')==root.as_posix() and value.get('releaseRoot')==str(ROOT) and
        value.get('unit')==CAPTURE_UNIT and value.get('head')==HEAD and value.get('image')==IMAGE and
        value.get('sourceBinding')==binding and value.get('captureTableSha256')==CAPTURE_TABLE_SHA and
        type(value.get('tableCount')) is int and value['tableCount']==106 and
        type(value.get('schemaReceiptCount')) is int and value['schemaReceiptCount']==39 and
        type(value.get('productionSqliteConnections')) is int and value['productionSqliteConnections']==0 and
        value.get('rawMasterNeverOpenedSqlite') is True and
        value.get('neverRetry') is True,'Exact reviewed capture snapshot provenance required')
    snapshot=root/'fresh-production-snapshot';raw=snapshot/'raw/dev.db';backup=snapshot/'backup.db'
    require({path.name for path in raw.parent.iterdir()}=={
        'dev.db','copy-authority.json','copy-window-comparison.json','snapshot-handoff.json',
        *('dev.db'+suffix for suffix in ('-wal','-shm') if value['rawTripleByteIdentity'][suffix] is not None)},
        'Raw capture directory contains missing or foreign evidence')
    require(identity_record(triple(raw))==value['rawTripleByteIdentity'],'Raw capture master changed')
    for path,key in [(backup,'backup'),(snapshot/'logical-state.json','logicalState'),
        (snapshot/'raw/snapshot-handoff.json','handoff'),(snapshot/'raw/copy-window-comparison.json','copyWindow'),
        (root/'assets-snapshot-handoff.json','assetsHandoff'),(root/'capture-normal-before.json','normalBefore'),
        (root/'capture-normal-after.json','normalAfter')]:
        require(capture_reference(path)==value[key],'Retained capture provenance reference changed')
    normal_before=output_read_record(root,'capture-normal-before.json')
    normal_after=output_read_record(root,'capture-normal-after.json')
    require(normal_before==normal_after and sha(canonical(normal_before))==value['normalPredecessorProjectionSha256'],
        'Full retained normal predecessor projection differs')
    assets=tree_state(root/'captured-assets')
    require(sorted(assets['directories'])==value['assetsDirectoryNames'] and
        sha(canonical(identity_record(assets['files'])))==value['assetsIdentitySha256'] and
        all((root/'captured-assets'/name).stat().st_nlink==1 for name in assets['files']),
        'Retained asset bytes or independent inodes changed')
    inodes=set()
    for main in (raw,backup):
        for suffix in ('','-wal','-shm'):
            path=pathlib.Path(str(main)+suffix)
            require(not path.is_symlink(),'Retained capture master dangling alias refused')
            if not path.exists():continue
            current=path.stat();identity=(current.st_dev,current.st_ino)
            require(stat.S_ISREG(current.st_mode) and current.st_nlink==1 and identity not in inodes and
                stat.S_IMODE(current.st_mode) in ((0o400,) if os.name=='posix' else (0o400,0o444)),
                'Retained raw master and detached backup must have independent inodes')
            inodes.add(identity)
    require(not any(pathlib.Path(str(backup)+suffix).exists() or pathlib.Path(str(backup)+suffix).is_symlink()
        for suffix in ('-journal','-wal','-shm')),'Detached capture backup has a SQLite sidecar')
    return value


def capture_clone(root,index,review,disk):
    binding=capture_source_review(index,review)
    root=capture_root(root);capture_stage(root,disk,'capture-clone')
    exclusive_record(root,'capture-clone-intent.json',{'sourceBinding':binding,
        'captureTableSha256':CAPTURE_TABLE_SHA,'neverRetry':True},disk.sync)
    snapshot=verify_capture_snapshot(root,binding)
    source=root/'fresh-production-snapshot/backup.db'
    database=clone_backup(root,'scientific-database',source,disk.check)
    sync_capture_tree(database)
    current=capture_clone_state(root)
    require(identity_record(triple(database/'dev.db'))=={'':snapshot['backup'],'-wal':None,'-shm':None},
        'New scientific clone differs from the reviewed detached backup')
    require(capture_reference(source)==snapshot['backup'],'Detached source backup changed during clone')
    result={'version':1,'root':root.as_posix(),'sourceBinding':binding,'captureTableSha256':CAPTURE_TABLE_SHA,
        'snapshotProvenance':capture_reference(root/'capture-snapshot-provenance.json'),
        'initialCloneIdentity':current,'initialCloneByteIdentity':identity_record(triple(database/'dev.db')),
        'createdFromDetachedBackup':True,'rawMastersNeverOpenedSqlite':True,'neverRetry':True}
    exclusive_record(root,'capture-clone-provenance.json',result,disk.sync)
    return result


def verify_capture_clone(root):
    # Called before EVERY capture CLI. Preparation may change clone contents;
    # complete stage/order/preservation checks still belong to the controller.
    root=capture_root(root);value=output_read_record(root,'capture-clone-provenance.json')
    require(type(value.get('version')) is int and value['version']==1 and value.get('root')==root.as_posix() and
        value.get('captureTableSha256')==CAPTURE_TABLE_SHA and value.get('createdFromDetachedBackup') is True and
        value.get('rawMastersNeverOpenedSqlite') is True and value.get('neverRetry') is True,
        'Retained capture clone provenance missing or foreign')
    snapshot=verify_capture_snapshot(root,value['sourceBinding'])
    require(value.get('initialCloneByteIdentity')=={'':snapshot['backup'],'-wal':None,'-shm':None},
        'Initial clone byte provenance does not bind the detached backup')
    require(capture_reference(root/'capture-snapshot-provenance.json')==value['snapshotProvenance'],
        'Snapshot authority changed after clone creation')
    current=capture_clone_state(root);original=value['initialCloneIdentity']
    require(current['databaseDirectoryIdentity']==original['databaseDirectoryIdentity'] and
        current['files']['dev.db'][:2]==original['files']['dev.db'][:2],
        'Scientific clone directory or main inode was replaced')
    return value
