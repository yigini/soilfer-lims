"""Source-bound schema observations and strict fresh WAL-index byte checks.

No SQL target opens, owner admission or native recovery/runtime attestation.
The existing WAL planner still refuses every nonempty SHM source.
"""
import json
import os
import pathlib
import stat
from kit_contract import canonical,require,sha
from retained_contract import exact_json
from kit_app_snapshots import regular
from kit_schema_collection import validate_observation
from kit_wal_dirty_inventory import dirty_wal_plan,LABELS
from kit_wal_content import checksum,page_size,wal_bytes_profile

PROOF='wal-source-binding-source.json'
MAX_WAL_PROOF_BYTES=64*1024**2
MAX_INDEX_BYTES=16*1024**2
MAX_LOGICAL_STATE_BYTES=32*1024**2
REGION_BYTES=32768
FIRST_REGION_FRAMES=4062
LATER_REGION_FRAMES=4096
HASH_SLOTS=8192


def source_proof():
    here=pathlib.Path(__file__).resolve().parent;root=here.parents[1]
    raw=(here/PROOF).read_bytes();v=exact_json(raw)
    require(type(v.get('version')) is int and v['version']==1 and
        v.get('scope')=='SOURCE_BOUND_SCHEMA_AND_STRICT_FRESH_WAL_INDEX_BYTES' and
        v.get('writerGraphAdmissionImplemented') is False and
        v.get('nativeRecoveryExecutionVerified') is False and
        v.get('runtimeBinaryToSourceBindingVerified') is False,'Exact WAL schema/index source proof required')
    for name,pin in v['files'].items():
        p=pathlib.PurePosixPath(name)
        require(not p.is_absolute() and '..' not in p.parts and p.as_posix()==name,'Canonical source proof path required')
        b=(root/name).read_bytes()
        require(type(pin) is dict and set(pin)=={'bytes','sha256'} and type(pin['bytes']) is int and
            len(b)==pin['bytes'] and sha(b)==pin['sha256'],'WAL binding source changed: '+name)
    return sha(raw)


def verify_fresh_index(wal,index,size,byte_order):
    """Complete fresh-recovery byte profile, never a kernel-lock observation."""
    page_size(size)
    require(type(byte_order) is str and byte_order in ('little','big'),'Explicit native index byte order required')
    require(type(wal) is bytes and 32<len(wal)<=MAX_WAL_PROOF_BYTES and
        type(index) is bytes and REGION_BYTES<=len(index)<=MAX_INDEX_BYTES and len(index)%REGION_BYTES==0,
        'Complete bounded nonempty WAL/index originals required; never clip')
    profile=wal_bytes_profile(wal,size);frames=profile['physicalFrames']
    require(frames>0,'Fresh nonempty committed WAL index profile required')
    regions=1+max(0,frames-FIRST_REGION_FRAMES+LATER_REGION_FRAMES-1)//LATER_REGION_FRAMES
    require(len(index)==regions*REGION_BYTES,'Exact complete index region count required; no omitted or surplus regions')
    header=index[:48]
    require(header==index[48:96],'Both complete WAL-index header copies must match')
    u=lambda offset,count=4:int.from_bytes(header[offset:offset+count],byte_order)
    require(u(0)==3007000 and u(4)==0 and u(8)==0 and header[12]==1 and
        header[13]==(int.from_bytes(wal[:4],'big')&1) and u(14,2)==(1 if size==65536 else size) and
        u(16)==frames and u(20)==profile['lastCommittedDatabasePages'],
        'Exact fresh recovered index version/change/init/endian/page/commit fields required')
    final=32+(frames-1)*(size+24)
    require((u(24),u(28))==(int.from_bytes(wal[final+16:final+20],'big'),int.from_bytes(wal[final+20:final+24],'big')) and
        header[32:40]==wal[16:24],'Index final checksum or raw salts differ from complete WAL')
    require(checksum(header[:40],byte_order=='big')==(u(40),u(44)),'Index header checksum differs')
    field=lambda offset:int.from_bytes(index[offset:offset+4],byte_order)
    require(field(96)==0 and field(128)==frames and index[120:128]==b'\0'*8 and field(132)==0 and
        [field(100+4*i) for i in range(5)]==[0,frames,0xffffffff,0xffffffff,0xffffffff],
        'Only fresh zero-backfill/no-writer/checkpointer/read-mark byte profile is supported')
    for region in range(regions):
        zero=0 if region==0 else FIRST_REGION_FRAMES+(region-1)*LATER_REGION_FRAMES
        count=min(frames-zero,FIRST_REGION_FRAMES if region==0 else LATER_REGION_FRAMES)
        expected=bytearray(REGION_BYTES);begin=136 if region==0 else 0;slots=[0]*HASH_SLOTS
        for ordinal in range(1,count+1):
            offset=32+(zero+ordinal-1)*(size+24);page=int.from_bytes(wal[offset:offset+4],'big')
            expected[begin+(ordinal-1)*4:begin+ordinal*4]=page.to_bytes(4,byte_order)
            slot=(page*383)&(HASH_SLOTS-1)
            while slots[slot]:slot=(slot+1)&(HASH_SLOTS-1)
            slots[slot]=ordinal
        for slot,value in enumerate(slots):expected[16384+slot*2:16386+slot*2]=value.to_bytes(2,byte_order)
        actual=index[region*REGION_BYTES:(region+1)*REGION_BYTES]
        require(actual[begin:]==expected[begin:],
            'Full index page-map/hash/unused bytes differ from complete WAL reconstruction')
    return {'version':1,'scope':'STRICT_FRESH_RECOVERED_WAL_INDEX_BYTE_CONSISTENCY',
        'sourceProofSha256':source_proof(),'pageSize':size,'declaredNativeByteOrder':byte_order,
        'walOriginal':{'bytes':len(wal),'sha256':sha(wal)},'indexOriginal':{'bytes':len(index),'sha256':sha(index)},
        'completeWalObservation':profile,'regions':regions,'mappedFrameEntries':frames,
        'bothHeaderCopiesVerified':True,'fullMapsHashesAndUnusedBytesVerified':True,
        'walIndexByteConsistencyVerified':True,'nativeRecoveryExecutionVerified':False,
        'nativeKernelLocksOrQuiescenceVerified':False,'walToMainSemanticAssociationVerified':False,
        'writerGraphAdmissionImplemented':False,'runtimeBinaryToSourceBindingVerified':False,
        'runtimeDefaultVfsVerified':False,'physicalFilesystemClosureClaimed':False}


def observe_index_pair(wal_path,index_path,size,byte_order):
    """Read/hash independent original pair through descriptors only; no main SQL."""
    wal_path=pathlib.Path(wal_path);index_path=pathlib.Path(index_path)
    require(wal_path.is_absolute() and index_path==pathlib.Path(str(wal_path)[:-4]+'-shm') and
        str(wal_path).endswith('-wal') and wal_path.resolve()==wal_path and index_path.resolve()==index_path,
        'Exact canonical independent WAL/SHM names required')
    parent=wal_path.parent;info=parent.stat();parent_id=[info.st_dev,info.st_ino,stat.S_IMODE(info.st_mode)]
    for path,limit in ((wal_path,MAX_WAL_PROOF_BYTES),(index_path,MAX_INDEX_BYTES)):
        require(path.stat().st_size<=limit,'Complete pair exceeds proof envelope; never clip')
    before={name:regular(path) for name,path in (('wal',wal_path),('index',index_path))}
    require(all(row is not None and row['device']==info.st_dev for row in before.values()) and
        before['wal']['inode']!=before['index']['inode'],'Independent same-device WAL/index originals required')
    values={}
    for name,path in (('wal',wal_path),('index',index_path)):
        flags=os.O_RDONLY|getattr(os,'O_NOFOLLOW',0)|getattr(os,'O_BINARY',0);fd=os.open(path,flags)
        with os.fdopen(fd,'rb') as stream:
            actual=os.fstat(stream.fileno());row=before[name]
            require(stat.S_ISREG(actual.st_mode) and actual.st_nlink==1 and
                (actual.st_dev,actual.st_ino,actual.st_size)==(row['device'],row['inode'],row['bytes']),
                'WAL/index descriptor identity differs')
            values[name]=stream.read(row['bytes']+1)
            require(len(values[name])==row['bytes'] and sha(values[name])==row['sha256'],'WAL/index original bytes changed')
    result=verify_fresh_index(values['wal'],values['index'],size,byte_order)
    after={name:regular(path) for name,path in (('wal',wal_path),('index',index_path))};info=parent.stat()
    require(canonical(before)==canonical(after) and parent.resolve()==parent and
        [info.st_dev,info.st_ino,stat.S_IMODE(info.st_mode)]==parent_id,'WAL/index source identity or directory changed')
    return {'version':1,'scope':'DESCRIPTOR_ONLY_WAL_INDEX_PAIR_OBSERVATION','walPath':str(wal_path),
        'indexPath':str(index_path),'originalFiles':before,'directoryIdentity':parent_id,'indexCheck':result,
        'mainFileObserved':False,'nativeRecoveryExecutionVerified':False,'writerGraphAdmissionImplemented':False}


def recheck_index_pair(observation):
    require(type(observation) is dict and observation.get('scope')=='DESCRIPTOR_ONLY_WAL_INDEX_PAIR_OBSERVATION',
        'Exact original index-pair observation required')
    check=observation['indexCheck']
    expected=observe_index_pair(observation['walPath'],observation['indexPath'],check['pageSize'],check['declaredNativeByteOrder'])
    require(canonical(expected)==canonical(observation),'Original index-pair record changed')
    return observation


def schema_bound_dirty_plan(label,observation,logical_original,target):
    require(type(label) is str and label in LABELS,'Only strict PRE206/214 source-bound dirty profiles supported')
    validate_observation(observation)
    expected={'206-apply':'fresh-production-snapshot','214-apply':'capture-prepared-206'}
    require(observation['sealLabel']==expected[label],'Exact preceding schema collector label required')
    require(type(logical_original) is bytes and 0<len(logical_original)<=MAX_LOGICAL_STATE_BYTES,
        'Complete bounded logical-state original required')
    state=exact_json(logical_original)
    require(logical_original==canonical(state)+b'\n' and
        canonical(observation['logicalStateOriginal'])==canonical({'bytes':len(logical_original),'sha256':sha(logical_original)}),
        'Logical-state original does not match schema collector commitment')
    require(type(state) is dict and set(state)=={'objects','tables','integrity','foreignKeyViolations'} and
        state['integrity']=='ok' and type(state['foreignKeyViolations']) is int and state['foreignKeyViolations']==0 and
        type(state['tables']) is dict,'Exact successful collector integrity/FK observation required')
    rows=observation['schema']['rows'];objects=[[r[0],r[1],r[2],r[4]] for r in rows if not r[1].startswith('sqlite_')]
    require(canonical(state['objects'])==canonical(objects) and
        set(state['tables'])=={r[1] for r in rows if r[0]=='table' and not r[1].startswith('sqlite_')},
        'Logical objects/tables differ from complete schema observation')
    plan=dirty_wal_plan(label,target,observation['schema'])
    require(canonical(plan['observation']['sourceDbWalShm'])==canonical(observation['copiedSourceDbWalShm']),
        'Target bytes differ from complete schema collector source binding')
    return {'version':1,'scope':'SOURCE_BOUND_COLLECTOR_SCHEMA_TARGET_DIRTY_WAL_PLAN','label':label,
        'sourceProofSha256':source_proof(),'schemaObservation':json.loads(canonical(observation)),
        'logicalState':state,'dirtyPlan':plan,'collectorSourceByteBindingVerified':True,
        'collectorIntegrityAndFkObservationBound':True,'independentSchemaToPrivateDbBytesProof':False,
        'intactSourceAndNativeRecoveredIndexVerified':False,'wholeOwnerFrameInventoryVerified':False,
        'writerGraphAdmissionImplemented':False,'beforeCreateHeldAdmissionImplemented':False,
        'runtimeBinaryToSourceBindingVerified':False,'runtimeDefaultVfsVerified':False,
        'physicalFilesystemClosureClaimed':False}


def recheck_schema_bound_dirty(plan):
    require(type(plan) is dict and plan.get('scope')=='SOURCE_BOUND_COLLECTOR_SCHEMA_TARGET_DIRTY_WAL_PLAN',
        'Exact original source-bound WAL schema plan required')
    expected=schema_bound_dirty_plan(plan['label'],plan['schemaObservation'],canonical(plan['logicalState'])+b'\n',
        plan['dirtyPlan']['observation']['source'])
    require(canonical(expected)==canonical(plan),'Source-bound schema/WAL/native/authority record changed')
    return plan
