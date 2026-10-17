"""Conditional native setup ordering and one main-schema/analysis load.

The declared entry is a fresh, schema-unloaded native connection. This does
not attest Python/driver constructor behavior, its binary, or any file I/O.
"""
import pathlib
from kit_contract import canonical,require,sha
from retained_contract import exact_json
import kit_reader_schema_scratch as schema

PROOF='reader-initialization-source.json'
SETUP=('PRAGMA compile_options','PRAGMA temp_store=MEMORY','PRAGMA temp_store',
    'PRAGMA query_only=ON','BEGIN')
INITIAL_SQL=(
    ('schema-loader','SELECT*FROM"main".sqlite_master ORDER BY rowid',1),
    ('stat1','SELECT tbl,idx,stat FROM \'main\'.sqlite_stat1',0),
    ('stat4-groups','SELECT idx,count(*) FROM \'main\'.sqlite_stat4 GROUP BY idx COLLATE nocase',1),
    ('stat4-data','SELECT idx,neq,nlt,ndlt,sample FROM \'main\'.sqlite_stat4',0))


def source_proof():
    here=pathlib.Path(__file__).resolve().parent;root=here.parents[1]
    raw=(here/PROOF).read_bytes();value=exact_json(raw)
    require(type(value.get('version')) is int and value['version']==1 and
        value.get('scope')=='CONDITIONAL_FRESH_NATIVE_READER_INITIALIZATION_AND_ANALYSIS' and
        value.get('readerSqliteBinaryToPinnedNativeSourceVerified') is False and
        value.get('beforeInitialReaderSqlAdmissionImplemented') is False,'Exact reader initialization source proof required')
    for name,pin in value['files'].items():
        p=pathlib.PurePosixPath(name)
        require(p.as_posix()==name and not p.is_absolute() and '..' not in p.parts,'Canonical initialization source path required')
        raw_file=(root/name).read_bytes()
        require(type(pin) is dict and set(pin)=={'bytes','sha256'} and type(pin['bytes']) is int and
            len(raw_file)==pin['bytes'] and sha(raw_file)==pin['sha256'],'Reader initialization source changed: '+name)
    return value,sha(raw)


def declared_initialization_reader(compile_temp_store):
    value=schema.declared_schema_reader(compile_temp_store)
    value['scope']='DECLARED_FRESH_SCHEMA_UNLOADED_NATIVE_INITIALIZATION_READER'
    value['schemaUnloadedAtFirstListedPragma']=True
    value['noPriorSqlOrSchemaUsingApiCalls']=True
    value['pragmaFileControlsReturnNotFoundWithoutSql']=True
    value['noSchemaResetReprepareRetryOrErrorContinuation']=True
    value['mainOnlyWithUnopenedTempBackend']=True
    value['ordinaryBuiltinCountAndNoCase']=True
    return value


def initialization_inventory(declaration):
    """No SQL, path, future profile, schema row or later observation input."""
    _,digest=source_proof()
    require(type(declaration) is dict and type(declaration.get('compileTempStore')) is int and
        declaration['compileTempStore'] in (1,2,3) and
        canonical(declaration)==canonical(declared_initialization_reader(declaration['compileTempStore'])),
        'Exact schema-unloaded native entry and unintercepted setup declaration required')
    setup=[{'sql':sql,'maximumExecutions':1,'nativeHandlerRequiresSchema':False} for sql in SETUP]
    queries=[{'label':label,'sql':sql,'maximumExecutions':1,'maximumPossibleSorterInitCalls':sorters,
        'maximumOtherTemporaryBtreeHandles':0,'nativeSorterWriteCountDerived':False,
        'fullSerializedRecordByteBoundDerived':False,'mayBeAbsentOrElidedButNoCreditTaken':True}
        for label,sql,sorters in INITIAL_SQL]
    return {'version':1,'scope':'CONDITIONAL_FRESH_NATIVE_INITIAL_SCHEMA_AND_ANALYSIS_SCRATCH_INVENTORY',
        'sourceProofSha256':digest,'nativeDeclaration':declaration,'setup':setup,
        'firstSchemaRequiringCallerStatement':'PRAGMA integrity_check',
        'firstSchemaLoadPhase':'preparing the first schema-requiring statement',
        'maximumMainSchemaInitializationCalls':1,'maximumImplicitSqlExecutions':4,'queries':queries,
        'maximumPossibleSorterInitCalls':2,'maximumOtherTemporaryBtreeHandles':0,
        'maximumPmaFileCreations':0,'maximumPmaWriteBytes':0,'maximumPmaSizeHintBytes':0,
        'stat4GroupingCoveredEvenWhenCompiledAndPresent':True,
        'schemaCallbackParsesCreateWithoutExecutingDdlSourceDerived':True,
        'unopenedTempBackendPerformsNoSchemaSqlSourceDerived':True,
        'conditionalSetupDefersSchemaReadUntilAfterMemorySettingDerived':True,
        'conditionalOneMainInitializationAndAnalysisSqlCatalogComplete':True,
        'laterProfileOrSchemaOriginalRequired':False,'possibleReuseOrAbsenceCreditTaken':False,
        'sourceDeclarationIsRuntimeObservation':False,'collectorBindingImplemented':False,
        'constructorAndExtensionSchemaAccessReviewed':False,'runtimeSchemaUnloadedAtEntryVerified':False,
        'actualInternalStatementExecutionsMeasured':False,'runtimePragmaFileControlBehaviorVerified':False,
        'readerSqliteBinaryToPinnedNativeSourceVerified':False,'runtimeDefaultVfsVerified':False,
        'temporaryDirectoryRoutingVerified':False,'kernelLocksOrQuiescenceVerified':False,
        'nativeSorterWriteCountDerived':False,'fullSerializedRecordByteBoundDerived':False,
        'processHeapOrPhysicalMemoryBounded':False,'statisticalSampleHeapBounded':False,
        'integrityForeignKeyTableInfoProfileAndBackupScratchInventoryComplete':False,
        'wholeLogicalReaderSqlScratchInventoryComplete':False,'mainWalShmRecoveryOrCheckpointBounded':False,
        'callerReviewVerified':False,'beforeInitialReaderSqlAdmissionImplemented':False,
        'writerGraphAdmissionImplemented':False,'fullLifetimeOriginalsRetained':False,
        'continuousPeakMeasured':False,'physicalFilesystemClosureClaimed':False}


def replay_initialization(plan):
    require(type(plan) is dict and plan.get('scope')=='CONDITIONAL_FRESH_NATIVE_INITIAL_SCHEMA_AND_ANALYSIS_SCRATCH_INVENTORY',
        'Exact conditional initialization source inventory required')
    expected=initialization_inventory(plan['nativeDeclaration'])
    require(canonical(plan)==canonical(expected),'Initialization SQL/setup/source/count/authority changed')
