"""Conditional pinned Unix sorter file LENGTH, never runtime or allocation proof.

Sorters explicitly request chunk4096 and may enable mmap. The declaration
requires successful fresh exclusive RW temp creation; Unix readonly fallback
is NOT evidence of an empty writable file. No writer calls this module.
"""
import pathlib
from kit_contract import canonical,require,sha
from retained_contract import exact_json
from kit_copy_admission import MAX_CONTENT_BYTES
from kit_linux_main_vfs import unix_request_high_water
from kit_sorter_scratch import sorter_scratch_bound,schema_bound_order_sorter_plan

PROOF='linux-sorter-vfs-source.json'
CHUNK_BYTES=4096
MAX_IO_BLOCK_BYTES=1<<30


def source_proof():
    here=pathlib.Path(__file__).resolve().parent;root=here.parents[1]
    raw=(here/PROOF).read_bytes();v=exact_json(raw)
    require(type(v.get('version')) is int and v['version']==1 and
        v.get('scope')=='CONDITIONAL_PINNED_LINUX_UNIX_SORTER_FILE_LENGTH' and
        v.get('sorterChunkBytes')==4096 and v.get('buildMayUsePrebuiltAddon') is True and
        v.get('runtimeBinaryToSourceBindingVerified') is False and v.get('runtimeDefaultVfsVerified') is False and
        v.get('writerGraphAdmissionImplemented') is False and v.get('physicalFilesystemClosureClaimed') is False,
        'Exact conditional Linux sorter VFS source proof required')
    for name,pin in v['files'].items():
        relative=pathlib.PurePosixPath(name)
        require(relative.as_posix()==name and not relative.is_absolute() and '..' not in relative.parts,
            'Canonical Linux sorter source path required')
        actual=(root/name).read_bytes()
        require(type(pin) is dict and set(pin)=={'bytes','sha256'} and type(pin['bytes']) is int and
            len(actual)==pin['bytes'] and sha(actual)==pin['sha256'],'Linux sorter VFS source changed: '+name)
    return v,sha(raw)


def integer(value,minimum=0,maximum=MAX_CONTENT_BYTES):
    require(type(value) is int and minimum<=value<=maximum,'Complete bounded nonboolean sorter VFS integer required')
    return value


def manual_size_hint_offsets(current,requested,block_bytes):
    """Pinned manual fallback offsets ONLY; ordinary syscalls remain declared.

    A proof-review utility, not a producer. Large loops refuse rather than
    returning a truncated offset inventory. Filesystem block size is an input,
    never an assumed sector size.
    """
    integer(current);integer(requested);integer(block_bytes,1,MAX_IO_BLOCK_BYTES)
    if requested<=current:return []
    first=(current//block_bytes)*block_bytes+block_bytes-1
    count=(max(0,requested+block_bytes-1-first)+block_bytes-1)//block_bytes
    require(count<=100000,'Complete manual hint offset inventory too large; never clip')
    offsets=[];offset=first
    while offset<requested+block_bytes-1:
        if offset>=requested:offset=requested-1
        offsets.append(offset);offset+=block_bytes
    return offsets


def declared_linux_sorter_profile():
    proof,digest=source_proof()
    return {'version':1,'scope':'DECLARED_DEFAULT_LINUX_UNIX_SORTER_PROFILE',
        'platform':'linux','vfs':'unix','initialChunkBytes':0,'sorterChunkBytes':4096,
        'temporaryExclusiveReadWriteCreateSucceeds':True,'newTempFilesInitiallyEmpty':True,
        'readonlyFallbackOrExistingFileReuse':False,'ordinaryUnmodifiedPrivateFiles':True,
        'customVfs':False,'customSystemCalls':False,'customFileControls':False,
        'uriFileNames':False,'automaticExtensions':False,'ordinarySyscallSemantics':True,
        'minimumReportedIoBlockBytes':1,'maximumReportedIoBlockBytes':MAX_IO_BLOCK_BYTES,
        'noContinuedWritingAfterSqlOrIoError':True,'sourceProofSha256':digest}


def default_linux_sorter_file_bound(native_bound,profile):
    expected=declared_linux_sorter_profile()
    require(type(profile) is dict and canonical(profile)==canonical(expected),
        'Exact declared successful-fresh-create Linux Unix sorter profile required')
    require(type(native_bound) is dict and native_bound.get('scope')=='CONDITIONAL_SINGLE_SORTER_LOGICAL_NATIVE_REQUEST_BOUND',
        'Complete original normal sorter native request bound required')
    rebuilt=sorter_scratch_bound(native_bound['pageSize'],native_bound['inventory'])
    require(canonical(rebuilt)==canonical(native_bound),'Sorter native records/requests/layout/authority changed')
    extent=native_bound['maximumAggregateNativeRequestedExtentBytes'];files=native_bound['maximumTemporaryFileCreations']
    # Each fresh file starts at0. Every write end and SIZE_HINT argument is
    # counted. Unix szChunk is0 or4096; both mmap states/fallocate branches
    # fit roundup(request,4096). Aggregate unknown partitions use one global
    # roundup plus up toF-1 further chunks, without multiplying E by F.
    maximum=((extent+4095)//4096)*4096+(files-1)*4096 if files else 0
    require(maximum==native_bound['declaredLayout']['roundedContentBytes'],
        'Complete aggregate per-file Unix chunk rounding differs from declared layout')
    require(maximum<=MAX_CONTENT_BYTES,'Complete Unix sorter file-length envelope exceeds32GiB; never clip')
    return {'version':1,'scope':'CONDITIONAL_DEFAULT_LINUX_UNIX_SORTER_FILE_LENGTH',
        'declaredProfile':expected,'nativeBound':native_bound,
        'conditionalMaximumAggregateSorterFileLengthBytes':maximum,
        'maximumAdditionalChunkRoundingBytes':maximum-extent,
        'declaredLayoutIncludingFullMetadataAllowances':native_bound['declaredLayout'],
        'conditionalUnixSorterFileLengthSourceProofImplemented':True,
        'sorterTempNoLockMethodsAndNoShmMapSourceDerived':True,
        'requiresSuccessfulFreshExclusiveWritableTempCreate':True,
        'requiresOrdinarySyscallSemanticsAndPositiveBoundedIoBlockSize':True,
        'mmapLimitDoesNotItselfSetFileLength':True,
        'sourceDeclarationIsRuntimeObservation':False,'runtimeBinaryToSourceBindingVerified':False,
        'runtimeDefaultVfsVerified':False,'runtimeSorterConfigurationVerified':False,
        'freshWritableEmptyTempFileCreationObserved':False,'ordinarySyscallSemanticsObserved':False,
        'temporaryDirectoryRoutingVerified':False,'sorterFileLengthOrVfsPreallocationBounded':False,
        'physicalPreallocationVerified':False,'wholeOwnerSqlScratchBounded':False,
        'callerReviewVerified':False,'writerGraphAdmissionImplemented':False,
        'beforeCreateHeldAdmissionImplemented':False,'fullLifetimeOriginalsRetained':False,
        'continuousPeakMeasured':False,'physicalFilesystemClosureClaimed':False}


def source_bound_order_linux_sorter_plan(observation,logical_original,target):
    source=schema_bound_order_sorter_plan(observation,logical_original,target)
    bound=default_linux_sorter_file_bound(source['bound'],declared_linux_sorter_profile())
    return {'version':1,'scope':'SOURCE_BOUND_COLLECTOR_PRE209_CONDITIONAL_UNIX_SORTER_PLAN',
        'sourceBinding':source,'conditionalUnixBound':bound,
        'collectorSourceByteBindingVerified':True,'independentSchemaToPrivateDbBytesProof':False,
        'runtimeBinaryToSourceBindingVerified':False,'runtimeDefaultVfsVerified':False,
        'freshWritableEmptyTempFileCreationObserved':False,'sorterFileLengthOrVfsPreallocationBounded':False,
        'writerGraphAdmissionImplemented':False,'beforeCreateHeldAdmissionImplemented':False,
        'physicalFilesystemClosureClaimed':False}


def recheck_order_linux_sorter(plan):
    require(type(plan) is dict and plan.get('scope')=='SOURCE_BOUND_COLLECTOR_PRE209_CONDITIONAL_UNIX_SORTER_PLAN',
        'Exact original collector-bound conditional Unix sorter record required')
    source=plan['sourceBinding']['sourceBinding']
    expected=source_bound_order_linux_sorter_plan(source['schemaObservation'],canonical(source['logicalState'])+b'\n',
        source['plan']['observation']['source'])
    require(canonical(expected)==canonical(plan),'Unix sorter source/declaration/request/authority record changed')
