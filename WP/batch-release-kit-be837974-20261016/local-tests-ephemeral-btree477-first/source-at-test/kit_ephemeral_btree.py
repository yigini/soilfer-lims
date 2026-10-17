"""Conditional ONE fresh ephemeral B-tree; never named TEMP schema or admission.

Native operation counts and FULL serialized payloads are declarations. A readonly
main connection can still materialize writable ephemeral files. No target SQL.
"""
import json,pathlib,re
from kit_contract import canonical,require,sha
from retained_contract import exact_json
from kit_copy_admission import MAX_CONTENT_BYTES,copy_layout
from kit_main_growth import main_growth_bound

PROOF='ephemeral-btree-source.json'
PAGE_SIZES=(512,1024,2048,4096,8192,16384,32768,65536)
STATUS_VALUES=('NOT_ASSIGNED','ASSIGNED','IN_PROGRESS','REPEAT_REQUIRED')
STATUS_SQL="SELECT id,sampleId,analysis FROM WorkItem WHERE status IN ('NOT_ASSIGNED','ASSIGNED','IN_PROGRESS','REPEAT_REQUIRED') ORDER BY id"


def source_proof():
    here=pathlib.Path(__file__).resolve().parent;root=here.parents[1]
    raw=(here/PROOF).read_bytes();v=exact_json(raw)
    require(type(v.get('version')) is int and v['version']==1 and v.get('scope')=='CONDITIONAL_ONE_FRESH_EPHEMERAL_BTREE' and
        v.get('runtimeBinaryToSourceBindingVerified') is False and v.get('writerGraphAdmissionImplemented') is False and
        v.get('physicalFilesystemClosureClaimed') is False,'Exact conditional ephemeral source proof required')
    for name,pin in v['files'].items():
        p=pathlib.PurePosixPath(name)
        require(p.as_posix()==name and not p.is_absolute() and '..' not in p.parts,'Canonical ephemeral source path required')
        b=(root/name).read_bytes()
        require(type(pin) is dict and set(pin)=={'bytes','sha256'} and type(pin['bytes']) is int and len(b)==pin['bytes'] and sha(b)==pin['sha256'],'Ephemeral source changed: '+name)
    container=json.loads((here/'readonly-target-wal-source.json').read_bytes())
    text=container['applicationSourceText']['server/scripts/install_order_revisions.js']
    require(STATUS_SQL in text and v['orderStatusSql']==STATUS_SQL and v['orderStatusValues']==list(STATUS_VALUES),
        'Exact raw-be order status set source required')
    return v,sha(raw)


def declared_ephemeral(kind,calls,payload,caller_sha):
    return {'version':1,'scope':'DECLARED_ONE_FRESH_EPHEMERAL_BTREE','kind':kind,
        'nativeInsertAttempts':calls,'maximumFullSerializedPayloadBytes':payload,'callerReviewSha256':caller_sha,
        'oneFreshHandleAndOneOpen':True,'freshKeysOnly':True,'zeroReservedBytes':True,'autoVacuum':False,
        'nativeSavepointCalls':0,'resetClearReuseOrOpenDup':False,'preformattedOrTransferredCells':False,
        'overwriteDeleteOrReplacement':False,'continuedWritingAfterSqlOrIoError':False,
        'customPagerOrPcache':False,'namedTempSchemaDatabase':False}


def ephemeral_btree_bound(page_size,inventory):
    proof,digest=source_proof()
    require(type(page_size) is int and page_size in PAGE_SIZES,'Declared EPHEMERAL page size required; never borrow main page size')
    require(type(inventory) is dict and inventory.get('kind') in ('ROWID_TABLE','INDEX') and
        type(inventory.get('nativeInsertAttempts')) is int and 0<=inventory['nativeInsertAttempts']<=1000000 and
        type(inventory.get('maximumFullSerializedPayloadBytes')) is int and 0<=inventory['maximumFullSerializedPayloadBytes']<=2147483647 and
        isinstance(inventory.get('callerReviewSha256'),str) and re.fullmatch('[a-f0-9]{64}',inventory['callerReviewSha256']),
        'Complete native ephemeral calls and FULL serialized payload declaration required')
    expected=declared_ephemeral(inventory['kind'],inventory['nativeInsertAttempts'],inventory['maximumFullSerializedPayloadBytes'],inventory['callerReviewSha256'])
    require(canonical(expected)==canonical(inventory),'Exact fresh ephemeral profile; named TEMP/reuse/savepoints/unknown fields refuse')
    # SYNTHETIC one-page NEW-DATABASE geometry for arithmetic only. This is
    # not a header observed on a target or a proof of a compiled page default.
    header=bytearray(100);header[:16]=b'SQLite format 3\0';header[16:18]=(1 if page_size==65536 else page_size).to_bytes(2,'big')
    header[18:24]=bytes([1,1,0,64,32,32]);header[28:32]=(1).to_bytes(4,'big')
    roots=int(inventory['kind']=='INDEX');calls=inventory['nativeInsertAttempts']
    operations={'version':1,'scope':'DECLARED_NATIVE_BTREE_INSERTIONS','callerReviewSha256':inventory['callerReviewSha256'],
        'createdRoots':roots,'insertions':([{'calls':calls,'maximumPayloadBytes':inventory['maximumFullSerializedPayloadBytes']}] if calls else [])}
    bound=main_growth_bound(bytes(header),page_size,operations)
    maximum=bound['maximumLogicalMainBytes']
    require(maximum<=MAX_CONTENT_BYTES,'Complete ephemeral logical envelope exceeds32GiB; never clip')
    return {'version':1,'scope':'CONDITIONAL_ONE_FRESH_EPHEMERAL_BTREE_LOGICAL_CONTENT',
        'sourceProofSha256':digest,'declaredInventory':expected,'ephemeralPageSize':page_size,
        'ephemeralPageSizeDerivedFromMainDatabase':False,'newDatabaseHeaderIsSyntheticArithmetic':True,
        'initialHeaderPages':1,'additionalIndexRoots':roots,'nativeBound':bound,
        'maximumLogicalEphemeralPages':bound['maximumLogicalMainPages'],'maximumLogicalEphemeralBytes':maximum,
        'maximumPagerWriteEndAndSizeHintBytes':maximum,'maximumTemporaryDatabaseFileCreations':1,
        'conditionalRollbackJournalFileCreations':0,'conditionalWalFileCreations':0,'conditionalStatementJournalFileCreations':0,
        'requiresBtreeOmitJournalAndNoNativeSavepoints':True,'requiresSuccessfulFreshWritableEmptyFileIfSpilled':True,
        'layout':copy_layout([maximum],0),'conditionalEphemeralLogicalContentBoundImplemented':True,
        'completeCallerNativeOperationInventoryVerified':False,'sourceDeclarationIsRuntimeObservation':False,
        'runtimeBinaryToSourceBindingVerified':False,'runtimeDefaultVfsVerified':False,'runtimeEphemeralPageSizeVerified':False,
        'temporaryDirectoryRoutingVerified':False,'ephemeralFileLengthOrVfsPreallocationBounded':False,
        'wholeSqlStatementScratchInventoryComplete':False,'wholeOwnerSqlScratchBounded':False,
        'callerReviewVerified':False,'writerGraphAdmissionImplemented':False,'beforeCreateHeldAdmissionImplemented':False,
        'fullLifetimeOriginalsRetained':False,'continuousPeakMeasured':False,'physicalFilesystemClosureClaimed':False}


def all_ephemeral_page_sizes(inventory):
    bounds=[ephemeral_btree_bound(p,inventory) for p in PAGE_SIZES]
    maximum=max(v['maximumLogicalEphemeralBytes'] for v in bounds)
    return {'version':1,'scope':'COMPLETE_EIGHT_EPHEMERAL_PAGE_SIZE_DECLARATIONS','bounds':bounds,
        'maximumLogicalEphemeralBytes':maximum,'layout':copy_layout([maximum],0),
        'actualEphemeralPageSizeObserved':False,'writerGraphAdmissionImplemented':False,'physicalFilesystemClosureClaimed':False}


def order_status_rhs_bound(page_size):
    proof,digest=source_proof()
    result=ephemeral_btree_bound(page_size,declared_ephemeral('INDEX',4,32,digest))
    return {'version':1,'scope':'RAW_BE_ORDER_STATUS_LITERAL_RHS_ONLY','sql':STATUS_SQL,
        'values':list(STATUS_VALUES),'maximumRhsMaterializations':1,'maximumRhsNativeIndexInsertAttempts':4,
        'maximumFullSerializedKeyBytes':32,'bound':result,'rawApplicationSourceBound':True,
        'completeWholeStatementScratchInventory':False,'callerSchemaCollationAndRuntimeVerified':False,
        'sorterOrderByAndOtherHandlesBounded':False,'writerGraphAdmissionImplemented':False,
        'physicalFilesystemClosureClaimed':False}


def replay_ephemeral_bound(record):
    require(type(record) is dict,'Exact original ephemeral arithmetic record required')
    if record.get('scope')=='RAW_BE_ORDER_STATUS_LITERAL_RHS_ONLY':
        expected=order_status_rhs_bound(record['bound']['ephemeralPageSize'])
    elif record.get('scope')=='COMPLETE_EIGHT_EPHEMERAL_PAGE_SIZE_DECLARATIONS':
        expected=all_ephemeral_page_sizes(record['bounds'][0]['declaredInventory'])
    else:expected=ephemeral_btree_bound(record['ephemeralPageSize'],record['declaredInventory'])
    require(canonical(expected)==canonical(record),'Ephemeral source/count/payload/geometry/authority record changed')