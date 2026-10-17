"""Conditional normal-sorter request bounds for complete serialized records.

Record sizes and record counts are distinct inputs. No caller, runtime,
VFS, file creation, admission, or physical authority is inferred here.
"""
import pathlib
from kit_contract import canonical,require,sha
from retained_contract import exact_json
from kit_wal_content import page_size
from kit_copy_admission import MAX_CONTENT_BYTES,copy_layout
import kit_sorter_scratch as strict
import kit_record_payload as record

PROOF='general-sorter-source.json'
MAX_KEY_BYTES=16*1024**2
PAGES=(512,1024,2048,4096,8192,16384,32768,65536)


def source_proof():
    here=pathlib.Path(__file__).resolve().parent;root=here.parents[1]
    raw=(here/PROOF).read_bytes();value=exact_json(raw)
    require(type(value.get('version')) is int and value['version']==1 and
        value.get('scope')=='CONDITIONAL_NORMAL_SORTER_FULL_SERIALIZED_RECORD_REQUESTS' and
        value.get('maximumDeclaredSerializedKeyBytes')==MAX_KEY_BYTES and
        value.get('runtimeSorterConfigurationVerified') is False and
        value.get('writerGraphAdmissionImplemented') is False,'Exact general sorter source proof required')
    for name,pin in value['files'].items():
        p=pathlib.PurePosixPath(name)
        require(p.as_posix()==name and not p.is_absolute() and '..' not in p.parts,'Canonical general sorter source path required')
        actual=(root/name).read_bytes()
        require(type(pin) is dict and set(pin)=={'bytes','sha256'} and type(pin['bytes']) is int and
            len(actual)==pin['bytes'] and sha(actual)==pin['sha256'],'General sorter source changed: '+name)
    return value,sha(raw)


def declared_sorter(records,full_key_bytes,caller_sha):
    return {'version':1,'scope':'DECLARED_COMPLETE_NORMAL_SORTER_FULL_RECORDS',
        'callerReviewSha256':caller_sha,'maximumSorterWriteRecords':records,
        'maximumFullSerializedKeyBytes':full_key_bytes,'oneInitAndOneRewind':True,
        'resetReuseOrRepeatedRewind':False,'continuedWritingAfterSqlOrIoError':False,
        'defaultPmaPages':250,'maximumSorterRecordHeaderBytes':16,
        'customSorterOrGlobalPmaOverride':False,'ordinaryUnmodifiedSorterFiles':True}


def sorter_bound(size,inventory):
    page_size(size)
    require(type(inventory) is dict and set(inventory)==set(declared_sorter(0,1,'0'*64)),
        'Exact complete normal-sorter declaration required')
    count=inventory['maximumSorterWriteRecords'];key=inventory['maximumFullSerializedKeyBytes']
    caller=inventory['callerReviewSha256']
    require(type(count) is int and 0<=count<=1000000000 and type(key) is int and 1<=key<=MAX_KEY_BYTES and
        type(caller) is str and len(caller)==64 and all(c in '0123456789abcdef' for c in caller) and
        canonical(inventory)==canonical(declared_sorter(count,key,caller)),
        'Only exact complete normal-sorter records/configuration supported; never clip large records')
    # ROUND8(nVal+sizeof(SorterRecord)) is an upper bound for either
    # allocation mode. A pre-insert flush implies (k+1)*memory>mnPmaSize;
    # every nonfinal PMA therefore has >=max(1,floor(mn/memory)) records.
    # For separate allocations szPMA>mn is even stronger. An oversized
    # single record still has one record; floor(mn/memory)==0 is not valid.
    memory=(key+16+7)//8*8;minimum=250*size
    minimum_rows=max(1,minimum//memory)
    runs=(count+minimum_rows-1)//minimum_rows if count else 0
    tasks=min(16,runs);depth=0;div=16
    while div<runs:depth+=1;div*=16
    nodes=(sum((runs+16**level-1)//16**level+tasks-1 for level in range(1,depth+1))+tasks+1) if runs else 0
    threaded=min(16,nodes,tasks+1)
    # nPMA=nVal+varint(nVal), mxKeysize=max(nPMA), mxSz=max(mxKeysize+9,
    # mxPmaSize/2). Charge nine bytes for each record-length varint.
    stored=key+9;region=max(key+18,(1<<29)//2)
    initial=stored*count+9*runs
    shared=nodes*region;thread_pairs=2*threaded*region
    extent=initial+shared+thread_pairs
    writes=stored*count*(depth+3)+9*runs
    files=2*tasks+2*threaded
    sizes=([extent]+[4095]*(files-1)) if files else []
    require(extent<=MAX_CONTENT_BYTES and writes<=MAX_CONTENT_BYTES and sum(sizes)<=MAX_CONTENT_BYTES,
        'Complete general sorter content/request plan exceeds32GiB; never clip')
    layout=copy_layout(sizes,0)
    require(layout['roundedContentBytes']<=MAX_CONTENT_BYTES,'Complete rounded sorter content exceeds32GiB; never clip')
    return {'version':1,'scope':'CONDITIONAL_NORMAL_SORTER_FULL_RECORD_REQUEST_BOUND','pageSize':size,
        'inventory':inventory,'maximumRoundedMemoryRecordBytes':memory,'minimumPmaBytes':minimum,
        'minimumRecordsInEveryNonfinalPma':minimum_rows,'maximumInitialPmas':runs,
        'maximumNonemptyTasks':tasks,'maximumPerTaskMergeDepth':depth,
        'maximumIncrementalMergerObjects':nodes,'maximumThreadedMergers':threaded,
        'maximumIncrementalRegionBytes':region,'maximumStoredKeyAndLengthBytes':stored,
        'maximumInitialPmaBytesIncludingHeaders':initial,'maximumSharedMergeReservationsBytes':shared,
        'maximumThreadPairReservationsBytes':thread_pairs,'maximumCumulativeNativeWriteBytes':writes,
        'maximumAggregateNativeRequestedExtentBytes':extent,'maximumTemporaryFileCreations':files,
        'declaredLayout':layout,'nativeRequestScope':'XWRITE_ENDS_AND_SIZE_HINT_BYTE_ARGUMENTS_ONLY',
        'mmapSizeControlIsMappingLimitNotFileExtent':True,'generalSerializedSorterRequestBoundImplemented':True,
        'sourceDeclarationIsRuntimeObservation':False,'completeNativeRecordMappingVerified':False,
        'completeCallerRecordCountAndHandleInventoryVerified':False,'runtimeBinaryToSourceBindingVerified':False,
        'runtimeSorterConfigurationVerified':False,'runtimeDefaultVfsVerified':False,
        'temporaryDirectoryRoutingVerified':False,'freshWritableEmptyTempFileCreationObserved':False,
        'sorterFileLengthOrVfsPreallocationBounded':False,'wholeOwnerSqlScratchBounded':False,
        'callerReviewVerified':False,'writerGraphAdmissionImplemented':False,'beforeCreateHeldAdmissionImplemented':False,
        'fullLifetimeOriginalsRetained':False,'continuousPeakMeasured':False,'physicalFilesystemClosureClaimed':False}


def all_page_sizes(inventory):
    bounds=[sorter_bound(p,inventory) for p in PAGES]
    return {'version':1,'scope':'COMPLETE_ALL_SUPPORTED_PAGE_SIZES_NORMAL_SORTER_BOUND',
        'bounds':bounds,'maximumAggregateNativeRequestedExtentBytes':max(x['maximumAggregateNativeRequestedExtentBytes'] for x in bounds),
        'maximumCumulativeNativeWriteBytes':max(x['maximumCumulativeNativeWriteBytes'] for x in bounds),
        'maximumDeclaredLayoutBytes':max(x['declaredLayout']['declaredAllocationBytes'] for x in bounds),
        'runtimeSorterPageSizeVerified':False,'writerGraphAdmissionImplemented':False,'physicalFilesystemClosureClaimed':False}


def source_bound_sorter(record_plan,inventory):
    proof,digest=source_proof();record.replay_record_plan(record_plan)
    bounds=all_page_sizes(inventory)
    require(inventory['maximumFullSerializedKeyBytes']==record_plan['bound']['maximumFullSerializedRecordBytes'],
        'Entire full serialized record bound required; never clip to smaller sorter key')
    return {'version':1,'scope':'SOURCE_BOUND_RECORD_OBSERVATION_CONDITIONAL_NORMAL_SORTER_PLAN',
        'sourceProofSha256':digest,'recordPlan':record_plan,'sorterDeclaration':inventory,'bounds':bounds,
        'collectorSourceByteBindingVerified':True,'independentProfileToPrivateDbBytesProof':False,
        'completeNativeRecordMappingVerified':False,'completeCallerRecordCountAndHandleInventoryVerified':False,
        'runtimeSorterConfigurationVerified':False,'captureCollectorIntegrationImplemented':False,
        'sorterFileLengthOrVfsPreallocationBounded':False,'callerReviewVerified':False,
        'writerGraphAdmissionImplemented':False,'beforeCreateHeldAdmissionImplemented':False,'physicalFilesystemClosureClaimed':False}


def replay_sorter(plan):
    require(type(plan) is dict and plan.get('scope')=='SOURCE_BOUND_RECORD_OBSERVATION_CONDITIONAL_NORMAL_SORTER_PLAN',
        'Exact original source-bound general sorter record required')
    expected=source_bound_sorter(plan['recordPlan'],plan['sorterDeclaration'])
    require(canonical(expected)==canonical(plan),'General sorter source/records/count/configuration/authority changed')
