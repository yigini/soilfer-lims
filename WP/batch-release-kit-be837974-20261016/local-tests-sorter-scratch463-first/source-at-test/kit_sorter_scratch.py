"""Conditional one-sorter logical writes/requests; no VFS or physical authority.

The strict PRE209 populated index supplies N complete NULL+rowid records.
All workers, initial PMAs and incremental merge regions are charged. This
is a source declaration, never evidence of the loaded build/configuration.
"""
import pathlib
from kit_contract import canonical,require,sha
from retained_contract import exact_json
from kit_wal_content import page_size
from kit_copy_admission import MAX_CONTENT_BYTES,copy_layout
from kit_order_revision_native import order_native_inventory,schema_bound_order_wal_plan

PROOF='sorter-scratch-source.json'
PMA_PAGES=250
MAX_PMA_BYTES=1<<29
MAX_WORKERS=15
MAX_KEY_BYTES=32
MAX_MEMORY_RECORD_BYTES=48


def source_proof():
    here=pathlib.Path(__file__).resolve().parent;root=here.parents[1]
    raw=(here/PROOF).read_bytes();value=exact_json(raw)
    require(type(value.get('version')) is int and value['version']==1 and
        value.get('scope')=='CONDITIONAL_SINGLE_NORMAL_SORTER_NATIVE_REQUESTS' and
        value.get('defaultPmaPages')==PMA_PAGES and value.get('maximumMemoryRecordBytes')==MAX_MEMORY_RECORD_BYTES and
        value.get('runtimeSorterConfigurationVerified') is False and
        value.get('writerGraphAdmissionImplemented') is False and
        value.get('sorterFileLengthOrVfsPreallocationBounded') is False,
        'Exact conditional sorter source proof required')
    for name,pin in value['files'].items():
        p=pathlib.PurePosixPath(name)
        require(p.as_posix()==name and not p.is_absolute() and '..' not in p.parts,
            'Canonical sorter source path required')
        actual=(root/name).read_bytes()
        require(type(pin) is dict and set(pin)=={'bytes','sha256'} and type(pin['bytes']) is int and
            len(actual)==pin['bytes'] and sha(actual)==pin['sha256'],'Sorter native/tooling source changed: '+name)
    return value,sha(raw)


def declared_sorter(records,caller_sha):
    return {'version':1,'scope':'DECLARED_COMPLETE_SINGLE_SORTER_RECORDS',
        'callerReviewSha256':caller_sha,'maximumSorterWriteRecords':records,
        'maximumSerializedKeyBytes':32,'oneInitAndOneRewind':True,
        'resetReuseOrRepeatedRewind':False,'continuedWritingAfterSqlError':False,
        'defaultPmaPages':250,'maximumSorterRecordHeaderBytes':16,
        'customSorterOrGlobalPmaOverride':False}


def sorter_scratch_bound(size,inventory):
    page_size(size)
    require(type(inventory) is dict and set(inventory)==set(declared_sorter(0,'0'*64)),
        'Complete exact single-sorter inventory required')
    require(type(inventory['version']) is int and inventory['version']==1 and
        inventory['scope']=='DECLARED_COMPLETE_SINGLE_SORTER_RECORDS' and
        type(inventory['callerReviewSha256']) is str and len(inventory['callerReviewSha256'])==64 and
        all(c in '0123456789abcdef' for c in inventory['callerReviewSha256']) and
        type(inventory['maximumSorterWriteRecords']) is int and 0<=inventory['maximumSorterWriteRecords']<=1000000000 and
        type(inventory['maximumSerializedKeyBytes']) is int and inventory['maximumSerializedKeyBytes']==32 and
        inventory['oneInitAndOneRewind'] is True and inventory['resetReuseOrRepeatedRewind'] is False and
        inventory['continuedWritingAfterSqlError'] is False and type(inventory['defaultPmaPages']) is int and
        inventory['defaultPmaPages']==250 and type(inventory['maximumSorterRecordHeaderBytes']) is int and
        inventory['maximumSorterRecordHeaderBytes']==16 and inventory['customSorterOrGlobalPmaOverride'] is False,
        'Only complete normal one-pass sorter records under exact declared source/configuration conditions supported')
    count=inventory['maximumSorterWriteRecords'];minimum=PMA_PAGES*size
    # With nVal<=32, sizeof(SorterRecord)<=16, ROUND8(nReq)<=48. A
    # non-final flushed list needs >=floor(mnPmaSize/48) records in either
    # allocation mode, including the heap-nearly-full branch. No RAM credit.
    minimum_rows=minimum//MAX_MEMORY_RECORD_BYTES
    runs=(count+minimum_rows-1)//minimum_rows if count else 0
    tasks=min(MAX_WORKERS+1,runs);depth=0;div=16
    while div<runs:depth+=1;div*=16
    # Sum ceil(r_i/16**level) <= ceil(R/16**level)+(T-1).
    # Include every per-task root wrapper and the final threaded root.
    merge_nodes=(sum((runs+16**level-1)//16**level+tasks-1 for level in range(1,depth+1))+
        tasks+1) if runs else 0
    threaded_nodes=min(16,merge_nodes,tasks+1)
    region=max(MAX_KEY_BYTES+1+9,MAX_PMA_BYTES//2)
    initial=33*count+9*runs
    shared=merge_nodes*region;threaded=2*threaded_nodes*region
    extent=initial+shared+threaded
    cumulative=33*count*(depth+3)+9*runs
    files=2*tasks+2*threaded_nodes
    require(extent<=MAX_CONTENT_BYTES and cumulative<=MAX_CONTENT_BYTES,
        'Complete sorter native request/content plan exceeds 32GiB; never clip')
    # One aggregate extent plus per-file rounding slack is a conservative
    # layout declaration. It is NOT a physical allocation measurement.
    sizes=([extent]+[4095]*(files-1)) if files else []
    require(sum(sizes)<=MAX_CONTENT_BYTES,'Complete rounded sorter plan exceeds 32GiB; never clip')
    return {'version':1,'scope':'CONDITIONAL_SINGLE_SORTER_LOGICAL_NATIVE_REQUEST_BOUND',
        'pageSize':size,'inventory':inventory,'minimumPmaBytes':minimum,
        'minimumRecordsInEveryNonfinalPma':minimum_rows,'maximumInitialPmas':runs,
        'maximumNonemptyTasks':tasks,'maximumPerTaskMergeDepth':depth,
        'maximumIncrementalMergerObjects':merge_nodes,'maximumThreadedMergers':threaded_nodes,
        'maximumIncrementalRegionBytes':region,'maximumInitialPmaBytesIncludingHeaders':initial,
        'maximumSharedMergeReservationsBytes':shared,'maximumThreadPairReservationsBytes':threaded,
        'maximumCumulativeNativeWriteBytes':cumulative,'maximumAggregateNativeRequestedExtentBytes':extent,
        'maximumTemporaryFileCreations':files,'declaredLayout':copy_layout(sizes,0),
        'sorterLogicalContentAndNativeRequestBoundImplemented':True,
        'sourceDeclarationIsRuntimeObservation':False,'runtimeBinaryToSourceBindingVerified':False,
        'runtimeSorterConfigurationVerified':False,'runtimeDefaultVfsVerified':False,
        'temporaryDirectoryRoutingVerified':False,'sorterFileLengthOrVfsPreallocationBounded':False,
        'wholeOwnerSqlScratchBounded':False,'writerGraphAdmissionImplemented':False,
        'beforeCreateHeldAdmissionImplemented':False,'fullLifetimeOriginalsRetained':False,
        'continuousPeakMeasured':False,'physicalFilesystemClosureClaimed':False}


def order_sorter_inventory(label,schema,state):
    proof,digest=source_proof();native=order_native_inventory(label,schema,state)
    return {'version':1,'scope':'CONDITIONAL_PRE209_POPULATED_INDEX_SORTER_INVENTORY',
        'sourceProofSha256':digest,'orderNativeSourceProofSha256':native['sourceProofSha256'],
        'declaredFullSchemaSha256':native['declaredFullSchemaSha256'],
        'declaredFullLogicalStateSha256':native['declaredFullLogicalStateSha256'],
        'declaredOrderLineRows':native['declaredOrderLineRows'],
        'sorter':declared_sorter(native['declaredOrderLineRows'],digest),
        'oneIndexRecordPerOldRow':True,'serializedKeyIsNullAndBuiltinRowid':True,
        'collectorBindingImplemented':False,'runtimeSorterConfigurationVerified':False,
        'wholeOwnerSqlScratchBounded':False,'writerGraphAdmissionImplemented':False}


def schema_bound_order_sorter_plan(observation,logical_original,target):
    source=schema_bound_order_wal_plan(observation,logical_original,target)
    native=order_sorter_inventory('209-apply',observation['schema'],source['logicalState'])
    size=source['plan']['observation']['bound']['pageSize']
    bound=sorter_scratch_bound(size,native['sorter'])
    return {'version':1,'scope':'SOURCE_BOUND_COLLECTOR_PRE209_SORTER_PLAN',
        'sourceBinding':source,'sorterInventory':native,'bound':bound,
        'collectorSourceByteBindingVerified':True,'independentSchemaToPrivateDbBytesProof':False,
        'runtimeSorterConfigurationVerified':False,'intactSourceAndNativeRecoveredIndexVerified':False,
        'wholeOwnerSqlScratchBounded':False,'writerGraphAdmissionImplemented':False,
        'sorterFileLengthOrVfsPreallocationBounded':False,'physicalFilesystemClosureClaimed':False}


def recheck_order_sorter(plan):
    require(type(plan) is dict and plan.get('scope')=='SOURCE_BOUND_COLLECTOR_PRE209_SORTER_PLAN',
        'Exact original source-bound sorter record required')
    source=plan['sourceBinding']
    expected=schema_bound_order_sorter_plan(source['schemaObservation'],canonical(source['logicalState'])+b'\n',
        source['plan']['observation']['source'])
    require(canonical(expected)==canonical(plan),'Sorter source/count/configuration/bound/authority record changed')
