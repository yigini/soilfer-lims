"""Conditional integrity/FK/table_info bodies for a declared plain schema.

Readonly integrity_check can evaluate schema expressions and callbacks.
Those profiles are deliberately unsupported; no schema restriction is
observed or collector-bound by this declaration-only source inventory.
"""
import pathlib
from kit_contract import canonical,require,sha
from retained_contract import exact_json
from retained_files import quote
import kit_reader_initialization as initialization

PROOF='reader-pragma-checks-source.json'
RESTRICTIONS=('noCheckConstraints','noGeneratedOrHiddenColumns','noExpressionOrPartialIndexes',
    'literalOrNullDefaultsOnly','noVirtualTablesAndTableInfoTargetsAreOrdinary',
    'ordinaryNamedColumnForeignKeysAndParentKeys','noCustomScalarOrCollationCallbacks',
    'completeMainSchemaProfileDeclared','noApplicationConnectionCallbacksOrHooks',
    'noReentrantSqlOrConnectionStateMutation','ordinaryVfsAndPcacheCallbacksNoSqlOrStateMutation')


def source_proof():
    here=pathlib.Path(__file__).resolve().parent;root=here.parents[1]
    raw=(here/PROOF).read_bytes();value=exact_json(raw)
    require(type(value.get('version')) is int and value['version']==1 and
        value.get('scope')=='CONDITIONAL_PLAIN_SCHEMA_READER_PRAGMA_BODIES' and
        value.get('actualSchemaRestrictionsVerified') is False and
        value.get('beforeInitialReaderSqlAdmissionImplemented') is False,'Exact restricted pragma source proof required')
    for name,pin in value['files'].items():
        p=pathlib.PurePosixPath(name)
        require(p.as_posix()==name and not p.is_absolute() and '..' not in p.parts,'Canonical pragma source path required')
        actual=(root/name).read_bytes()
        require(type(pin) is dict and set(pin)=={'bytes','sha256'} and type(pin['bytes']) is int and
            len(actual)==pin['bytes'] and sha(actual)==pin['sha256'],'Reader pragma source changed: '+name)
    return value,sha(raw)


def declared_plain_pragma_reader(compile_temp_store):
    value=initialization.declared_initialization_reader(compile_temp_store)
    value['scope']='DECLARED_PLAIN_SCHEMA_NATIVE_READER_PRAGMA_BODIES'
    value.update({name:True for name in RESTRICTIONS})
    return value


def table_info_sql(table):
    require(type(table) is str and table and '\0' not in table,'Ordinary complete table name required')
    return 'PRAGMA table_info('+quote(table)+')'


def pragma_body_inventory(declaration):
    """No target SQL or later schema/profile/fingerprint input."""
    _,digest=source_proof()
    require(type(declaration) is dict and type(declaration.get('compileTempStore')) is int and
        declaration['compileTempStore'] in (1,2,3) and
        canonical(declaration)==canonical(declared_plain_pragma_reader(declaration['compileTempStore'])),
        'Exact plain schema declaration required; CHECK/generated/index expressions/virtual/callback profiles unsupported')
    init=initialization.initialization_inventory(initialization.declared_initialization_reader(declaration['compileTempStore']))
    bodies=[{'query':'PRAGMA integrity_check','invocationScope':'once in logical()'},
        {'query':'PRAGMA foreign_key_check','invocationScope':'once in logical()'},
        {'queryTemplate':'PRAGMA table_info(<exact quoted ordinary table>)',
            'invocationScope':'once for every enumerated ordinary user table; total count not derived before SQL'}]
    for row in bodies:
        row.update({'maximumBodySorterInitCalls':0,'maximumBodyTemporaryBtreeOpenCalls':0,
            'maximumBodyStatementJournalOpenCalls':0,'maximumBodyNativeWriteTransactionStarts':0,
            'mainTableAndIndexCursorCountDerived':False,'heapOrRecordPayloadBytesBounded':False})
    return {'version':1,'scope':'CONDITIONAL_PLAIN_SCHEMA_READER_PRAGMA_BODY_SCRATCH_INVENTORY',
        'sourceProofSha256':digest,'nativeDeclaration':declaration,'initialization':init,'bodies':bodies,
        'conditionalPlainPragmaBodyScratchInventoryDerived':True,
        'maximumBodySorterInitCalls':0,'maximumBodyTemporaryBtreeOpenCalls':0,
        'maximumBodyStatementJournalOpenCalls':0,'maximumBodyNativeWriteTransactionStarts':0,
        'maximumPmaFileCreationsIncludingConditionalInitialization':0,
        'maximumPmaWriteBytesIncludingConditionalInitialization':0,
        'completeTableInfoInvocationCountDerived':False,'plainSchemaRestrictionsAreDeclarationsOnly':True,
        'actualSchemaRestrictionsVerified':False,'collectorBindingImplemented':False,
        'readonlyAloneImpliesNoScratch':False,'generalIntegrityExpressionsOrCallbacksSupported':False,
        'laterProfileOrSchemaOriginalRequired':False,'sourceDeclarationIsRuntimeObservation':False,
        'readerSqliteBinaryToPinnedNativeSourceVerified':False,'constructorAndExtensionSchemaAccessReviewed':False,
        'runtimePragmaFileControlBehaviorVerified':False,'runtimeConnectionHooksAndVfsPcacheBehaviorVerified':False,
        'actualNativeTemporaryBtreeCallsMeasured':False,
        'processHeapOrPhysicalMemoryBounded':False,'pageReferenceBitmapAndCheckerHeapBounded':False,
        'mainWalShmRecoveryOrCheckpointBounded':False,'runtimeDefaultVfsVerified':False,
        'temporaryDirectoryRoutingVerified':False,'kernelLocksOrQuiescenceVerified':False,
        'independentSchemaToPrivateDbBytesProof':False,'wholeLogicalReaderSqlScratchInventoryComplete':False,
        'profileAndBackupQueryScratchInventoriesComplete':False,'callerReviewVerified':False,
        'beforeInitialReaderSqlAdmissionImplemented':False,'writerGraphAdmissionImplemented':False,
        'fullLifetimeOriginalsRetained':False,'continuousPeakMeasured':False,'physicalFilesystemClosureClaimed':False}


def replay_pragma_bodies(plan):
    require(type(plan) is dict and plan.get('scope')=='CONDITIONAL_PLAIN_SCHEMA_READER_PRAGMA_BODY_SCRATCH_INVENTORY',
        'Exact conditional pragma body inventory required')
    expected=pragma_body_inventory(plan['nativeDeclaration'])
    require(canonical(plan)==canonical(expected),'Pragma schema restriction/source/query/count/authority changed')
