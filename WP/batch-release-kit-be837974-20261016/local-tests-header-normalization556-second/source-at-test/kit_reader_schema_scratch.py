"""Conditional scratch inventory for three explicit owned-reader schema SELECTs.

No later schema/profile observation is needed to derive the MEMORY sorter
file-request result. This is not initial-reader admission: the Python engine
binding, implicit schema loader and other reader statements remain unclosed.
"""
import pathlib,sqlite3
from kit_contract import canonical,require,sha
from retained_contract import exact_json
import kit_fingerprint_sorter as fingerprint

PROOF='reader-schema-scratch-source.json'
QUERIES=(
    ('logical-objects',"SELECT type,name,tbl_name,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name",4,2),
    ('full-schema','SELECT type,name,tbl_name,rootpage,sql FROM sqlite_schema ORDER BY type,name',5,2),
    ('logical-tables',"SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",1,1))


def source_proof():
    here=pathlib.Path(__file__).resolve().parent;root=here.parents[1]
    raw=(here/PROOF).read_bytes();value=exact_json(raw)
    require(type(value.get('version')) is int and value['version']==1 and
        value.get('scope')=='CONDITIONAL_EXPLICIT_OWNED_READER_SCHEMA_SELECT_SCRATCH' and
        value.get('readerSqliteBinaryToPinnedNativeSourceVerified') is False and
        value.get('beforeInitialReaderSqlAdmissionImplemented') is False,'Exact reader schema source proof required')
    for name,pin in value['files'].items():
        p=pathlib.PurePosixPath(name)
        require(p.as_posix()==name and not p.is_absolute() and '..' not in p.parts,'Canonical reader schema source path required')
        actual=(root/name).read_bytes()
        require(type(pin) is dict and set(pin)=={'bytes','sha256'} and type(pin['bytes']) is int and
            len(actual)==pin['bytes'] and sha(actual)==pin['sha256'],'Reader schema source changed: '+name)
    return value,sha(raw)


def declared_schema_reader(compile_temp_store):
    value=fingerprint.declared_memory_reader(compile_temp_store)
    value['scope']='DECLARED_PINNED_NATIVE_MEMORY_SCHEMA_SELECT_READER'
    value.pop('settingHeldForEveryFingerprintStatement')
    value['settingHeldForEverySchemaSelect']=True
    return value


def validate_memory_declaration(declaration):
    require(type(declaration) is dict and type(declaration.get('compileTempStore')) is int and
        declaration['compileTempStore'] in (1,2,3) and
        canonical(declaration)==canonical(declared_schema_reader(declaration['compileTempStore'])),
        'Exact pinned native MEMORY declaration required; not Python binary attestation')


def schema_select_inventory(full_schema,declaration):
    """Source-only, no SQL and no later profile/schema/private DB input."""
    _,digest=source_proof();validate_memory_declaration(declaration)
    require(type(full_schema) is bool,'Exact full-schema caller branch required')
    rows=[]
    for label,sql,selected,ordered in QUERIES:
        if label=='full-schema' and not full_schema:continue
        rows.append({'label':label,'query':sql,'maximumExecutions':1,'maximumSorterInitCalls':1,
            'selectedColumnCount':selected,'orderColumnCount':ordered,
            'maximumSorterRecordFields':selected+ordered+1,
            'maximumOtherTemporaryBtreeHandles':0,'maximumPmaFileCreations':0,
            'maximumPmaWriteBytes':0,'maximumPmaSizeHintBytes':0,
            'sourceSchemaRowCountKnownBeforeSql':False,'nativeSorterWriteCountDerived':False,
            'fullSerializedRecordByteBoundDerived':False})
    return {'version':1,'scope':'CONDITIONAL_EXPLICIT_READER_SCHEMA_SELECT_SCRATCH_INVENTORY',
        'sourceProofSha256':digest,'fullSchemaRequested':full_schema,'nativeDeclaration':declaration,
        'queries':rows,'maximumSorterInitCalls':len(rows),'maximumOtherTemporaryBtreeHandles':0,
        'maximumPmaFileCreations':0,'maximumPmaWriteBytes':0,'maximumPmaSizeHintBytes':0,
        'possibleOverlapOrCleanupReuseCreditTaken':False,
        'conditionalExplicitSchemaSelectHandleInventoryDerived':True,
        'conditionalMemorySorterNoPmaSourceDerived':True,'laterProfileOrSchemaOriginalRequired':False,
        'sourceDeclarationIsRuntimeObservation':False,'collectorBindingImplemented':False,
        'nativeSorterWriteCountDerived':False,'fullSerializedRecordByteBoundDerived':False,
        'implicitSchemaInitializationScratchInventoryComplete':False,
        'integrityForeignKeyTableInfoProfileAndBackupScratchInventoryComplete':False,
        'wholeLogicalReaderSqlScratchInventoryComplete':False,'processHeapOrPhysicalMemoryBounded':False,
        'readerSqliteBinaryToPinnedNativeSourceVerified':False,'runtimeFreshUnshadowedConnectionVerified':False,
        'runtimeDefaultVfsVerified':False,'temporaryDirectoryRoutingVerified':False,
        'mainWalShmRecoveryOrCheckpointBounded':False,'callerReviewVerified':False,
        'beforeInitialReaderSqlAdmissionImplemented':False,'writerGraphAdmissionImplemented':False,
        'fullLifetimeOriginalsRetained':False,'continuousPeakMeasured':False,'physicalFilesystemClosureClaimed':False}


def replay_schema_selects(plan):
    require(type(plan) is dict and plan.get('scope')=='CONDITIONAL_EXPLICIT_READER_SCHEMA_SELECT_SCRATCH_INVENTORY',
        'Exact explicit schema SELECT source inventory required')
    expected=schema_select_inventory(plan['fullSchemaRequested'],plan['nativeDeclaration'])
    require(canonical(plan)==canonical(expected),'Reader schema query/source/count/authority changed')


def memory_engine_observation(version,source_id,options,temp_store):
    """Unsigned engine metadata only; never binary/source/build/DB binding."""
    require(type(version) is str and version and type(source_id) is str and source_id and
        type(options) is list and all(type(x) is str and x for x in options) and
        len(options)==len(set(options)) and type(temp_store) is int and temp_store==2,
        'Complete distinct engine options and accepted MEMORY setting required')
    modes=[x for x in options if x.startswith('TEMP_STORE=')]
    require(len(modes)==1 and modes[0] in ('TEMP_STORE=1','TEMP_STORE=2','TEMP_STORE=3'),
        'Supported explicit compile-time TEMP_STORE required')
    return {'version':1,'scope':'UNATTESTED_SQLITE_ENGINE_METADATA',
        'sqliteVersionObserved':version,'sqliteSourceIdObserved':source_id,
        'compileOptionsObserved':sorted(options),'tempStoreObserved':temp_store,
        'compileTempStoreObserved':int(modes[0].split('=')[1]),
        'loadedBinaryToSourceBuildBindingVerified':False,'runtimeDefaultVfsVerified':False,
        'targetDatabaseBytesOrOwnershipObserved':False,'initialReaderSqlAdmissionGranted':False}


def observe_new_python_memory_engine():
    """Preparation only. This API has no filename/target argument."""
    db=sqlite3.connect(':memory:')
    try:
        from retained_files import memory_temporaries
        memory_temporaries(db)
        version,source_id=db.execute('SELECT sqlite_version(),sqlite_source_id()').fetchone()
        options=[r[0] for r in db.execute('PRAGMA compile_options')]
        return memory_engine_observation(version,source_id,options,db.execute('PRAGMA temp_store').fetchone()[0])
    finally:db.close()


def necessary_pinned_engine_metadata(observation):
    """Refuse mismatches. Matching metadata still grants no admission/attestation."""
    require(type(observation) is dict,'Exact engine observation required')
    expected=memory_engine_observation(observation.get('sqliteVersionObserved'),
        observation.get('sqliteSourceIdObserved'),observation.get('compileOptionsObserved'),
        observation.get('tempStoreObserved'))
    require(canonical(observation)==canonical(expected),'Engine metadata/authority changed')
    require(observation['sqliteVersionObserved']=='3.51.2' and
        observation['sqliteSourceIdObserved']==fingerprint.SOURCE_ID and
        not any(x=='ENABLE_SORTER_REFERENCES' or x.startswith('ENABLE_SORTER_REFERENCES=') for x in observation['compileOptionsObserved']),
        'Pinned native metadata required; unmatched Python engine refuses')
    return {'necessaryVersionSourceIdMemoryOptionsMatch':True,'loadedBinaryToSourceBuildBindingVerified':False,
        'nativeDeclarationIsCollectorEngineAttestation':False,'runtimeDefaultVfsVerified':False,
        'initialReaderSqlAdmissionGranted':False,'writerGraphAdmissionImplemented':False,
        'physicalFilesystemClosureClaimed':False}
