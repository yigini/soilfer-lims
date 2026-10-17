"""Conditional default-Unix MAIN file-length proof, never runtime authority.

A C source hash and sqlite_source_id do not bind the loaded native binary to
that source/build. The existing capture writer's VFS flag stays false until
that independent obligation and the actual Linux VFS identity are closed.
"""
import pathlib
from kit_contract import canonical,require,sha
from retained_contract import exact_json
from kit_main_mutations import mutation_growth_bound

PROOF_NAME='linux-main-vfs-source.json'
NATIVE_SHA='2bbdd0eff3f46852e954d7881b7945990bf78c1421f806cf7978bc22e187100a'
SOURCE_ID='2026-01-09 17:27:48 b270f8339eb13b504d0b2ba154ebca966b7dde08e40c3ed7d559749818cb2075'
MAX_BYTES=32*1024**3


def source_proof():
    from retained_files import file_state
    here=pathlib.Path(__file__).resolve().parent;root=here.parents[1]
    raw=(here/PROOF_NAME).read_bytes();value=exact_json(raw)
    require(value.get('version')==1 and type(value['version']) is int and
        value.get('scope')=='CONDITIONAL_PINNED_DEFAULT_LINUX_UNIX_MAIN_FILE_LENGTH' and
        value.get('nativeSourceSha256')==NATIVE_SHA and value.get('sourceId')==SOURCE_ID and
        value.get('applicationHead')=='be8379745bdfae52ce46496ff26514dc7d729640' and
        value.get('buildMayUsePrebuiltAddon') is True and
        value.get('runtimeBinaryToSourceBindingVerified') is False and
        value.get('runtimeDefaultVfsVerified') is False and
        value.get('writerGraphAdmissionImplemented') is False and
        value.get('physicalFilesystemClosureClaimed') is False,
        'Exact conditional Linux MAIN VFS source proof required')
    for name,pin in value['files'].items():
        relative=pathlib.PurePosixPath(name)
        require(not relative.is_absolute() and '..' not in relative.parts and relative.as_posix()==name,
            'Canonical source-relative VFS proof path required')
        state=file_state(root/name)
        require(state is not None and canonical({q:state[q] for q in ('bytes','sha256')})==canonical(pin),
            'Pinned Linux VFS/native/build/tooling source changed: '+name)
    return sha(raw)


def integer(value,minimum=0,maximum=MAX_BYTES):
    require(type(value) is int and minimum<=value<=maximum,'Complete bounded nonboolean VFS integer required')
    return value


def unix_request_high_water(current,request):
    """Pinned native request semantics; no reuse, shrink or allocation credit.

    This is file LENGTH only under ordinary syscall semantics. It deliberately
    models nondefault chunk/mmap counterexamples, too; those are refused by the
    separate default-profile planner. It neither issues nor simulates syscalls.
    """
    integer(current);require(type(request) is dict,'Exact native VFS request required')
    kind=request.get('kind')
    fields={'write':{'kind','offset','bytes'},'truncate':{'kind','bytes','chunkBytes'},
        'size-hint':{'kind','bytes','chunkBytes','mmapBytes'}}
    require(kind in fields and set(request)==fields[kind],'Complete native VFS request fields required')
    amount=integer(request['bytes'],1 if kind=='write' else 0,65536 if kind=='write' else MAX_BYTES)
    if kind=='write':end=integer(request['offset'])+amount
    else:
        chunk=integer(request['chunkBytes'],0,2147483647)
        end=((amount+chunk-1)//chunk)*chunk if chunk else amount
        if kind=='size-hint':
            mmap=integer(request['mmapBytes'])
            if not chunk and not mmap:end=current
    require(end<=MAX_BYTES,'Complete VFS request exceeds planning envelope; never clip')
    return max(current,end)


def declared_default_linux_profile():
    """A declaration, explicitly not an observation of a compiled runtime."""
    return {'version':1,'scope':'DECLARED_DEFAULT_LINUX_UNIX_MAIN_PROFILE','platform':'linux',
        'vfs':'unix','chunkBytes':0,'defaultMmapBytes':0,'uriFileName':False,
        'customVfs':False,'customSystemCalls':False,'automaticExtensions':False,
        'sourceProofSha256':source_proof()}


def default_linux_main_file_bound(header,main_bytes,operations,profile):
    expected=declared_default_linux_profile()
    require(type(profile) is dict and canonical(profile)==canonical(expected),
        'Only the complete declared pinned default Linux Unix profile is supported')
    bound=mutation_growth_bound(header,main_bytes,operations)
    maximum=bound['maximumLogicalMainBytes'];page=bound['pageSize']
    # Pager normal writes end at pgno*P with pgno<=dbSize. All normal size
    # hints and commit padding use dbSize*P; playback/truncation uses a prior
    # intact transaction/savepoint size. Both are <= the counted high water.
    # Default unixOpen zeroes szChunk; no MAIN caller sets CHUNK_SIZE. The only
    # internal CHUNK_SIZE caller belongs to the separate sorter temp file.
    requests=[{'kind':'write','offset':maximum-page,'bytes':page},
        {'kind':'truncate','bytes':maximum,'chunkBytes':0},
        {'kind':'size-hint','bytes':maximum,'chunkBytes':0,'mmapBytes':0}]
    require(max(unix_request_high_water(main_bytes,row) for row in requests)==maximum,
        'Pinned default Unix MAIN request envelope differs')
    return {'version':1,'scope':'CONDITIONAL_DEFAULT_LINUX_MAIN_FILE_LENGTH',
        'declaredProfile':expected,'nativeMutationBound':bound,
        'conditionalMaximumMainFileLengthBytes':maximum,
        'conditionalMaximumMainGrowthBytes':maximum-main_bytes,
        'conditionalDefaultUnixFileLengthBoundImplemented':True,
        'requiresCompleteNativeOperationInventory':True,'requiresOrdinarySyscallSemantics':True,
        'requiresNoContinuedWritingAfterRollbackOrSqlError':True,
        'sourceDeclarationIsRuntimeObservation':False,'runtimeBinaryToSourceBindingVerified':False,
        'runtimeDefaultVfsVerified':False,'callerReviewVerified':False,
        'writerGraphAdmissionImplemented':False,'mainFileLengthOrVfsPreallocationBounded':False,
        'walGrowthBounded':False,'statementOrSqlScratchBounded':False,
        'continuousPeakMeasured':False,'physicalFilesystemClosureClaimed':False}


def runtime_option_preconditions(platform,version,source_id,options):
    """Necessary checks only: compile_options is not a complete build receipt."""
    require(platform=='linux' and version=='3.51.2' and source_id==SOURCE_ID,
        'Actual pinned Linux engine observation required; no platform projection')
    require(type(options) is list and len(options)<=256 and
        all(type(row) is str and row.isascii() and 0<len(row)<=256 for row in options) and
        len(set(options))==len(options),'Complete bounded unique compile-option observation required')
    required={'DEFAULT_MMAP_SIZE=0','ENABLE_LOCKING_STYLE=0','MUTEX_PTHREADS',
        'THREADSAFE=2','USE_URI=0','OMIT_SHARED_CACHE','TEMP_STORE=1'}
    require(required<=set(options),'Pinned default Linux compile-option preconditions absent')
    forbidden=('OS_OTHER','OS_KV','DEFAULT_UNIX_VFS','MMAP_READWRITE','TEST','DEBUG','OMIT_DISKIO')
    require(not any(row==key or row.startswith(key+'=') for row in options for key in forbidden),
        'Custom or test native build profile refused')
    return {'necessaryCompileOptionPreconditionsMet':True,'runtimeBinaryToSourceBindingVerified':False,
        'runtimeDefaultVfsVerified':False,'mainFileLengthOrVfsPreallocationBounded':False,
        'writerGraphAdmissionImplemented':False,'physicalFilesystemClosureClaimed':False}
