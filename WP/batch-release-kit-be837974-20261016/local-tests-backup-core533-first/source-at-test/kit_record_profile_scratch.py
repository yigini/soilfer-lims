"""Conditional FUTURE already-open reader record-profile SQL inventory.

No earlier logical/schema scan is authorized by a later profile. Declarations
are not observations of schema, builtins, hooks, binary, VFS or ownership.
"""
import pathlib
from kit_contract import canonical,require,sha
from retained_contract import exact_json
from retained_files import quote
from kit_schema_collection import FULL_SCHEMA_SQL
from kit_fingerprint_sorter import declared_memory_reader

PROOF='record-profile-scratch-source.json'
LIMIT=16*1024**2
CONDITIONS=('alreadyOpenOwnedReadonlyQueryOnlyUtf8Transaction','mainSchemaAlreadyLoadedAndStable',
    'allDeclaredTablesOrdinaryWithOnlyNonhiddenNongeneratedColumns',
    'completeTableAndColumnInventoryDeclared','standardBuiltinCountMinMaxTypeofLengthAndEngineFunctions',
    'noApplicationConnectionCallbacksOrHooks','noReentrantSqlOrConnectionStateMutation',
    'ordinaryVfsAndPcacheCallbacksNoSqlOrStateMutation','noSchemaReloadReprepareRetryOrErrorContinuation')

def source_proof():
    here=pathlib.Path(__file__).resolve().parent;root=here.parents[1]
    raw=(here/PROOF).read_bytes();v=exact_json(raw)
    require(type(v.get('version')) is int and v['version']==1 and
        v.get('scope')=='CONDITIONAL_FUTURE_RECORD_PROFILE_SQL_SCRATCH' and
        v.get('beforeInitialReaderSqlAdmissionImplemented') is False and
        v.get('actualBuiltinAndTableInventoryVerified') is False,'Exact future profile source proof required')
    for name,pin in v['files'].items():
        p=pathlib.PurePosixPath(name);require(p.as_posix()==name and not p.is_absolute() and '..' not in p.parts,'Canonical profile source path required')
        b=(root/name).read_bytes();require(type(pin) is dict and set(pin)=={'bytes','sha256'} and
            type(pin['bytes']) is int and len(b)==pin['bytes'] and sha(b)==pin['sha256'],'Profile scratch source changed: '+name)
    return v,sha(raw)

def declared_profile_reader(mode):
    v=declared_memory_reader(mode);v['scope']='DECLARED_ALREADY_PREPARED_NATIVE_RECORD_PROFILE_READER'
    v.pop('settingHeldForEveryFingerprintStatement');v['settingHeldForEntireProfileInvocation']=True
    v.update({k:True for k in CONDITIONS});return v

def name(value):
    require(type(value) is str and value and '\0' not in value,'Exact nonempty ordinary identifier required');return value

def column_query(table,column):
    table=name(table);c=quote(name(column))
    data="CASE typeof("+c+") WHEN 'null' THEN 0 WHEN 'integer' THEN 8 WHEN 'real' THEN 8 WHEN 'text' THEN length(CAST("+c+" AS BLOB)) WHEN 'blob' THEN length("+c+") ELSE -1 END"
    return 'SELECT count(*),max('+data+'),min('+data+') FROM main.'+quote(table)

def profile_inventory(tables,declaration):
    """Pure declared catalog, no path/SQL/later record profile or maxima input."""
    _,digest=source_proof()
    require(type(declaration) is dict and type(declaration.get('compileTempStore')) is int and
        declaration['compileTempStore'] in (1,2,3) and
        canonical(declaration)==canonical(declared_profile_reader(declaration['compileTempStore'])),
        'Exact prepared-reader/source/builtin/no-hook declaration required')
    require(type(tables) is dict and len(canonical(tables))+1<=LIMIT,'Complete declared table-column input exceeds proof envelope; never clip')
    require(all(type(t) is str and t and '\0' not in t for t in tables) and
        len({t.casefold() for t in tables})==len(tables),'Distinct ordinary complete table names required')
    for cols in tables.values():
        require(type(cols) is list and 1<=len(cols)<=2000 and all(type(c) is str and c and '\0' not in c for c in cols) and
            len({c.casefold() for c in cols})==len(cols),'Complete distinct ordinary column lists required')
    queries=[{'sql':sql,'family':'metadata'} for sql in
        ('PRAGMA query_only','PRAGMA encoding','PRAGMA temp_store','PRAGMA database_list')]
    queries.append({'sql':'SELECT count(*) FROM main.sqlite_schema','family':'snapshot-count'})
    queries.extend({'sql':sql,'family':'metadata'} for sql in ('PRAGMA query_only','PRAGMA encoding'))
    queries.append({'sql':FULL_SCHEMA_SQL,'family':'full-schema'})
    for table,columns in sorted(tables.items()):
        queries.append({'sql':'PRAGMA main.table_xinfo('+quote(table)+')','family':'table-metadata'})
        queries.extend({'sql':column_query(table,c),'family':'column-aggregate'} for c in columns)
    queries.extend({'sql':sql,'family':'engine-metadata'} for sql in ('SELECT sqlite_version()','SELECT sqlite_source_id()'))
    for row in queries:
        row.update({'maximumPossibleSorterInitCalls':1 if row['family']=='full-schema' else 0,
            'maximumTemporaryBtreeOpenCalls':0,'maximumNativeWriteTransactionStarts':0})
    columns=sum(map(len,tables.values()))
    plan={'version':1,'scope':'CONDITIONAL_FUTURE_RECORD_PROFILE_SQL_SCRATCH_INVENTORY',
        'sourceProofSha256':digest,'nativeDeclaration':declaration,'declaredTables':tables,'queries':queries,
        'sqlInvocationCount':10+len(tables)+columns,'columnAggregateInvocations':columns,'tableXinfoInvocations':len(tables),
        'maximumPossibleSorterInitCalls':1,'maximumTemporaryBtreeOpenCalls':0,
        'maximumNativeWriteTransactionStarts':0,'maximumStatementJournalOpenCalls':0,
        'conditionalMaximumPmaFileCreations':0,'conditionalMaximumPmaWriteBytes':0,'conditionalMaximumPmaSizeHintBytes':0,
        'conditionalExactProfileQueryCatalogDerived':True,'conditionalUngroupedAggregateNoTempBtreeSourceDerived':True,
        'futureAlreadyPreparedInvocationOnly':True,'declaredSqlInvocationCountsAreNativeRecordCounts':False,
        'actualBuiltinAndTableInventoryVerified':False,'collectorIntegrationImplemented':False,
        'readerSqliteBinaryToPinnedNativeSourceVerified':False,'runtimeSchemaAndTransactionEntryVerified':False,
        'runtimeConnectionHooksAndVfsPcacheBehaviorVerified':False,'runtimeDefaultVfsVerified':False,
        'temporaryDirectoryRoutingVerified':False,'actualNativeTemporaryBtreeCallsMeasured':False,
        'processHeapOrPhysicalMemoryBounded':False,'profileEnvelopeIsPreSqlPhysicalCapacity':False,
        'earlierLogicalOrFingerprintSqlAdmissionImplemented':False,'beforeInitialReaderSqlAdmissionImplemented':False,
        'independentProfileToPrivateDbBytesProof':False,'mainWalShmRecoveryOrCheckpointBounded':False,
        'backupQueryScratchInventoryComplete':False,'wholeLogicalReaderSqlScratchInventoryComplete':False,
        'callerReviewVerified':False,'writerGraphAdmissionImplemented':False,'beforeSqlHeldAdmissionImplemented':False,
        'fullLifetimeOriginalsRetained':False,'continuousPeakMeasured':False,'physicalFilesystemClosureClaimed':False}
    require(len(queries)==plan['sqlInvocationCount'] and len(canonical(plan))+1<=LIMIT,
        'Complete profile SQL catalog exceeds16MiB proof envelope; never clip')
    return plan

def replay_profile_inventory(plan):
    require(type(plan) is dict and plan.get('scope')=='CONDITIONAL_FUTURE_RECORD_PROFILE_SQL_SCRATCH_INVENTORY','Exact profile inventory required')
    expected=profile_inventory(plan['declaredTables'],plan['nativeDeclaration'])
    require(canonical(expected)==canonical(plan),'Profile query/source/count/declaration/authority changed')
