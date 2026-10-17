"""Conditional native checkpoint request arguments; no owner or held admission.

ONE checkpoint API or ONE WalClose only. Full lifecycle/physical scope is open.
"""
import pathlib
from kit_contract import canonical,require,sha
from retained_contract import exact_json
from kit_copy_admission import copy_layout
from kit_wal_source_binding import verify_fresh_index

PROOF='checkpoint-requests-source.json'
LIMIT=32*1024**3
MAX_ORIGINAL_BYTES=4*1024**2
PAGES=tuple(512*2**i for i in range(8))
MODES=('PASSIVE','FULL','RESTART','TRUNCATE','WAL_CLOSE')
CONDITIONS=('intactCorrectlyAssociatedMainWalAndIndexAtEntry',
    'fixedNativePageAndHeadGeometryFromExactFullOriginals',
    'nativeIndexAbiHeader136U32FourHtSlotTwoAndRegion32768',
    'noOtherWritersCompetingCheckpointOrExternalFileChanges',
    'onlyNativeHeadResetToZeroAllowedWithinThisOneInvocation',
    'ordinarySharedIndexAndNativeLockSemanticsNoHeapFallback',
    'nativeRecoveryIfNeededCannotExceedCompleteWalFrameExtent',
    'noWriteSqlFrameAppendBackupNormalizationOrOtherApiWrites',
    'noHooksBusyLogVfsPcacheOrFileControlReentrantSqlStateOrExtraProducers',
    'stopFirstErrorNoRetryResetOrSecondCheckpointInvocation',
    'oneCheckpointApiOrOneWalCloseOnlyOtherCallerPhasesExcluded')

def declaration(mode):
    require(type(mode) is str and mode in MODES,'One exact checkpoint/close mode required')
    return {'version':1,'scope':'DECLARED_ONE_NATIVE_CHECKPOINT_OR_WAL_CLOSE','nativeVersion':'3.51.2',
        'mode':mode,**{k:True for k in CONDITIONS}}

def source_proof():
    here=pathlib.Path(__file__).resolve().parent;root=here.parents[1];raw=(here/PROOF).read_bytes();v=exact_json(raw)
    require(type(v.get('version')) is int and v['version']==1 and v.get('scope')=='CONDITIONAL_ONE_NATIVE_CHECKPOINT_REQUESTS' and
        v.get('writerGraphAdmissionImplemented') is False and v.get('runtimeBinaryToSourceBindingVerified') is False,'Exact checkpoint source proof required')
    for name,pin in v['files'].items():
        p=pathlib.PurePosixPath(name);require(p.as_posix()==name and not p.is_absolute() and '..' not in p.parts,'Canonical checkpoint source path required')
        b=(root/name).read_bytes();require(type(pin) is dict and set(pin)=={'bytes','sha256'} and type(pin['bytes']) is int and
            len(b)==pin['bytes'] and sha(b)==pin['sha256'],'Checkpoint source changed: '+name)
    return v,sha(raw)

def checkpoint_plan(main_bytes,wal_bytes,index_bytes,p,d,f,entry):
    _,digest=source_proof()
    require(type(entry) is dict and type(entry.get('mode')) is str and canonical(entry)==canonical(declaration(entry['mode'])),
        'Complete exact one-invocation checkpoint entry required')
    require(all(type(n) is int and n>=0 for n in (main_bytes,wal_bytes,index_bytes)) and type(p) is int and p in PAGES and
        type(d) is int and 1<=d<=4294967294 and type(f) is int and 1<=f<=4294967294,'Complete extents/positive exact native head P/D/F required')
    require(main_bytes%p==0 and wal_bytes==32+f*(p+24) and index_bytes%32768==0,
        'Whole MAIN pages and complete committed WAL frame extent required')
    regions=1+max(0,f-4062+4095)//4096
    main=max(main_bytes,d*p);index=max(index_bytes,regions*32768)
    require(all(n<=LIMIT for n in (main,wal_bytes,index)),'Complete checkpoint file exceeds32GiB; never clip')
    layout=copy_layout([main,wal_bytes,index],0)
    require(layout['contentBytes']<=LIMIT and layout['roundedContentBytes']<=LIMIT,'Whole checkpoint content/rounding exceeds32GiB; never clip')
    calls=min(f,d)
    return {'version':1,'scope':'CONDITIONAL_ONE_NATIVE_CHECKPOINT_REQUESTS','sourceProofSha256':digest,'nativeDeclaration':entry,
        'completeInitialMainBytes':main_bytes,'completeInitialWalBytes':wal_bytes,'completeInitialIndexBytes':index_bytes,
        'declaredPageSize':p,'declaredCheckpointHeadPages':d,'declaredCheckpointHeadFrames':f,
        'maximumCheckpointApiInvocations':1,'maximumCheckpointCopyBodies':1,'maximumDirectMainPageWriteCalls':calls,
        'maximumDirectMainWriteBytes':calls*p,'maximumMainWriteEndArgumentBytes':d*p,'maximumMainSizeHintArgumentBytes':d*p,
        'maximumMainTruncateArgumentBytes':d*p,'maximumDistinctIndexRegionsRequested':regions,'maximumIndexRegionOrdinal':regions-1,
        'maximumRequestedIndexMappingExtentBytes':regions*32768,'fullMainWalIndexLayout':layout,
        'fullInitialExtentsRetainedAfterNativeResetTruncateCloseOrError':True,'conditionalCheckpointRequestArgumentsImplemented':True,
        'indexMapInvocationCountDerived':False,'directMainWriteCountIsWholeFilesystemWriteCount':False,'passiveOkIsCompleteBackfill':False,
        'earlierReaderPageCountIsCheckpointHead':False,'indexByteConsistencyIsNativeRecoveryExecution':False,
        'actualEntryAndHeadSourceAssociationVerified':False,'actualNativeCheckpointCallsOrReturnCodesMeasured':False,
        'kernelLocksOrQuiescenceVerified':False,'runtimeBinaryToSourceBindingVerified':False,'actualPythonWrapperToNativeBindingVerified':False,
        'runtimeDefaultVfsVerified':False,'actualVfsFileControlAndLoggingBehaviorVerified':False,'actualFileLengthOrPreallocationBounded':False,
        'completeNamespaceMetadataOrPhysicalMemoryBounded':False,'wholeCheckpointAndSourceCloseLifetimeBounded':False,
        'wholeBackupCallerBounded':False,'callerReviewVerified':False,'beforeSqlHeldAdmissionImplemented':False,
        'writerGraphAdmissionImplemented':False,'fullLifetimeOriginalsRetained':False,'continuousPeakMeasured':False,'physicalFilesystemClosureClaimed':False}

def replay_checkpoint(plan):
    require(type(plan) is dict and plan.get('scope')=='CONDITIONAL_ONE_NATIVE_CHECKPOINT_REQUESTS','Exact whole checkpoint plan required')
    expected=checkpoint_plan(plan['completeInitialMainBytes'],plan['completeInitialWalBytes'],plan['completeInitialIndexBytes'],
        plan['declaredPageSize'],plan['declaredCheckpointHeadPages'],plan['declaredCheckpointHeadFrames'],plan['nativeDeclaration'])
    require(canonical(expected)==canonical(plan),'Checkpoint source/head/count/extent/layout/authority changed')
    return plan

def original_plan(main_bytes,wal,index,p,order,entry):
    require(type(wal) is bytes and type(index) is bytes and len(wal)+len(index)<=MAX_ORIGINAL_BYTES,
        'Complete bounded WAL/index originals required; never clip')
    observed=verify_fresh_index(wal,index,p,order);head=observed['completeWalObservation']
    plan=checkpoint_plan(main_bytes,len(wal),len(index),p,head['lastCommittedDatabasePages'],head['physicalFrames'],entry)
    return {'version':1,'scope':'COMPLETE_FRESH_INDEX_BYTE_BOUND_CHECKPOINT_PLAN','walOriginalHex':wal.hex(),'indexOriginalHex':index.hex(),
        'declaredNativeIndexByteOrder':order,'completeInitialMainBytes':main_bytes,'nativeDeclaration':entry,
        'fullFreshIndexByteObservation':observed,'checkpointPlan':plan,'fullPrivateMainBytesPackaged':False,
        'walToMainSemanticAssociationVerified':False,'actualEntryAndHeadSourceAssociationVerified':False,
        'nativeRecoveryExecutionVerified':False,'writerGraphAdmissionImplemented':False,'physicalFilesystemClosureClaimed':False}

def replay_original(plan):
    require(type(plan) is dict and plan.get('scope')=='COMPLETE_FRESH_INDEX_BYTE_BOUND_CHECKPOINT_PLAN','Exact complete checkpoint original plan required')
    wh=plan.get('walOriginalHex');ih=plan.get('indexOriginalHex')
    require(type(wh) is str and type(ih) is str and len(wh)+len(ih)<=2*MAX_ORIGINAL_BYTES and len(wh)%2==len(ih)%2==0 and
        all(c in '0123456789abcdef' for c in wh+ih),'Whole canonical bounded original hex required')
    wal=bytes.fromhex(wh);index=bytes.fromhex(ih);p=plan['checkpointPlan']['declaredPageSize']
    expected=original_plan(plan['completeInitialMainBytes'],wal,index,p,plan['declaredNativeIndexByteOrder'],plan['nativeDeclaration'])
    require(canonical(expected)==canonical(plan),'Entire checkpoint original/byte observation/head/declaration/authority changed')
    return plan
