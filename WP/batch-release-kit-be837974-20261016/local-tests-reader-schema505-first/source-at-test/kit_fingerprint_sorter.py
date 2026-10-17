"""Conditional source inventory for the owned reader's fingerprint SELECTs.

The existing reader already requests MEMORY temporaries. Under the exact
pinned native semantics this prevents fingerprint sorter PMAs, including
block-sort resets. It does not bound heap use, WAL/SHM, or other reader SQL.
"""
import pathlib,re
from kit_contract import canonical,require,sha
from retained_contract import exact_json
from retained_files import quote
import kit_record_payload as record

PROOF='fingerprint-sorter-source.json'
SOURCE_ID='2026-01-09 17:27:48 b270f8339eb13b504d0b2ba154ebca966b7dde08e40c3ed7d559749818cb2075'


def source_proof():
    here=pathlib.Path(__file__).resolve().parent;root=here.parents[1]
    raw=(here/PROOF).read_bytes();value=exact_json(raw)
    require(type(value.get('version')) is int and value['version']==1 and
        value.get('scope')=='CONDITIONAL_OWNED_READER_FINGERPRINT_SORTER_SOURCE_INVENTORY' and
        value.get('readerSqliteBinaryToPinnedNativeSourceVerified') is False and
        value.get('writerGraphAdmissionImplemented') is False,'Exact fingerprint source proof required')
    for name,pin in value['files'].items():
        p=pathlib.PurePosixPath(name)
        require(p.as_posix()==name and not p.is_absolute() and '..' not in p.parts,'Canonical fingerprint source path required')
        actual=(root/name).read_bytes()
        require(type(pin) is dict and set(pin)=={'bytes','sha256'} and type(pin['bytes']) is int and
            len(actual)==pin['bytes'] and sha(actual)==pin['sha256'],'Fingerprint source changed: '+name)
    return value,sha(raw)


def declared_memory_reader(compile_temp_store):
    return {'version':1,'scope':'DECLARED_PINNED_NATIVE_MEMORY_FINGERPRINT_READER',
        'nativeVersion':'3.51.2','nativeSourceId':SOURCE_ID,'compileTempStore':compile_temp_store,
        'tempStorePragma':2,'settingHeldForEveryFingerprintStatement':True,
        'freshUnshadowedConnection':True,'noAttachedOrNamedTempSchemas':True,
        'ordinaryIntactStableSource':True,'noCustomFunctionsCollationsConvertersOrAutoExtensions':True,
        'sorterReferencesEnabled':False,'continuedSqlAfterError':False}


def fingerprint_sql(table,columns):
    require(type(table) is str and table and '\0' not in table and type(columns) is list and columns and
        all(type(c) is str and c and '\0' not in c for c in columns) and
        len({c.casefold() for c in columns})==len(columns),
        'Exact ordinary table and complete distinct column list required')
    cols=','.join(quote(c) for c in columns)
    return 'SELECT '+cols+' FROM '+quote(table)+' ORDER BY '+cols


def fingerprint_inventory(profile,schema,state,declaration):
    proof,digest=source_proof();record.validate_profile(profile,schema,state)
    require(type(declaration) is dict and type(declaration.get('compileTempStore')) is int and
        declaration['compileTempStore'] in (1,2,3) and
        canonical(declaration)==canonical(declared_memory_reader(declaration['compileTempStore'])),
        'Only exact pinned native MEMORY-reader declaration supported; no default/disk fallback')
    sql_by_name={r[1]:r[4] for r in schema['rows'] if r[0]=='table'}
    tables=[]
    for name,row in sorted(profile['tables'].items()):
        sql=sql_by_name[name]
        require(type(sql) is str and not re.search(r'\bCOLLATE\b',sql,re.I),
            'Declared column collations/custom comparator profile unsupported')
        columns=row['columns'];data=row['maximumNativeDataBytesByColumn']
        # SRT_Output, no LIMIT/DISTINCT/expressions/joins/subqueries/window:
        # nExpr=C, nData<=C, nBase=nExpr+bSeq+nData <=2C+1. OMITREF and
        # partial-order prefix removal only shrink this complete upper bound.
        # Disabled SORTER_REFERENCES excludes extra deferred PK columns.
        bound=record.full_record_bound(data+data+[8])
        count=row['rowCount']
        tables.append({'table':name,'columns':columns,'query':fingerprint_sql(name,columns),
            'sourceRows':count,'maximumSorterInitCalls':1,'maximumSorterWriteCalls':count,
            'maximumSqlBlockResetSorterOpcodes':count,'maximumSorterRewindCalls':count+1,
            'maximumSorterRecordFields':2*len(columns)+1,'maximumFullSerializedSorterRecordBytes':bound,
            'oneOrdinarySourceTableNoLimitDistinctJoinOrExpressions':True,
            'orderedIndexMayElideSorter':True,'partialOrderMayResetSameSorter':True,
            'maximumOtherTemporaryBtreeHandles':0,'maximumPmaFileCreations':0,
            'maximumPmaWriteBytes':0,'maximumPmaSizeHintBytes':0})
    value={'version':1,'scope':'CONDITIONAL_COMPLETE_FINGERPRINT_QUERIES_SORTER_INVENTORY',
        'sourceProofSha256':digest,'profileSha256':sha(canonical(profile)+b'\n'),
        'fullSchemaSha256':sha(canonical(schema)+b'\n'),'logicalStateOriginal':profile['logicalStateOriginal'],
        'collectorEngineVersionObserved':profile['collectorEngineVersion'],
        'collectorEngineSourceIdObserved':profile['collectorEngineSourceId'],
        'nativeDeclarationIsCollectorEngineAttestation':False,
        'nativeDeclaration':declaration,'tables':tables,'maximumSorterInitCalls':len(tables),
        'maximumSorterWriteCalls':sum(r['maximumSorterWriteCalls'] for r in tables),
        'maximumOtherTemporaryBtreeHandles':0,'maximumPmaFileCreations':0,'maximumPmaWriteBytes':0,
        'maximumPmaSizeHintBytes':0,'memoryTempImpliesZeroMxPmaAndWorkersSourceDerived':True,
        'conditionalFingerprintSorterRecordMappingAndCountDerived':True,
        'conditionalFingerprintQueryScratchHandleInventoryDerived':True,
        'unqualifiedSqlRequiresFreshUnshadowedConnection':True,
        'initialEarlierFingerprintAdmissionImplemented':False,'collectorBindingImplemented':False,
        'sourceDeclarationIsRuntimeObservation':False,'readerSqliteBinaryToPinnedNativeSourceVerified':False,
        'runtimeDefaultVfsVerified':False,'temporaryDirectoryRoutingVerified':False,
        'runtimeFreshUnshadowedConnectionVerified':False,'actualNativeSorterCallsMeasured':False,
        'processHeapOrPhysicalMemoryBounded':False,'wholeLogicalReaderSqlScratchInventoryComplete':False,
        'walShmOrCheckpointBounded':False,'callerReviewVerified':False,
        'writerGraphAdmissionImplemented':False,'beforeSqlHeldAdmissionImplemented':False,
        'fullLifetimeOriginalsRetained':False,'continuousPeakMeasured':False,'physicalFilesystemClosureClaimed':False}
    require(len(canonical(value))+1<=16*1024**2,'Complete fingerprint inventory exceeds16MiB; never omit tables')
    return value


def source_bound_fingerprints(record_plan,declaration):
    record.replay_record_plan(record_plan)
    inventory=fingerprint_inventory(record_plan['profile'],record_plan['schemaObservation']['schema'],
        record_plan['logicalState'],declaration)
    return {'version':1,'scope':'SOURCE_BOUND_FUTURE_FINGERPRINT_INVOCATION_SORTER_PLAN',
        'recordPlan':record_plan,'inventory':inventory,'collectorSourceByteBindingVerified':True,
        'independentProfileToPrivateDbBytesProof':False,'futureInvocationOnly':True,
        'initialEarlierFingerprintAdmissionImplemented':False,'readerSqliteBinaryToPinnedNativeSourceVerified':False,
        'wholeLogicalReaderSqlScratchInventoryComplete':False,'processHeapOrPhysicalMemoryBounded':False,
        'callerReviewVerified':False,'writerGraphAdmissionImplemented':False,'beforeSqlHeldAdmissionImplemented':False,
        'physicalFilesystemClosureClaimed':False}


def replay_fingerprints(plan):
    require(type(plan) is dict and plan.get('scope')=='SOURCE_BOUND_FUTURE_FINGERPRINT_INVOCATION_SORTER_PLAN',
        'Exact future fingerprint source plan required')
    expected=source_bound_fingerprints(plan['recordPlan'],plan['inventory']['nativeDeclaration'])
    require(canonical(expected)==canonical(plan),'Fingerprint source/count/fields/setting/authority changed')
