"""Conditional forward statement-journal CONTENT, not SQL scratch closure.

Standalone declarations grant no writer admission. A separately bound capture
wrapper holds its own capacity and controls. A complete native inventory bounds
live logical pages; a separately complete SQL statement inventory bounds the
number of possible implicit statement savepoints. Neither count replaces the
other. Binary/VFS binding, held capacity and physical allocation remain open.
"""
import pathlib
from kit_contract import canonical,require,sha
from retained_contract import exact_json
from kit_copy_admission import MAX_CONTENT_BYTES,copy_layout
from kit_main_mutations import mutation_growth_bound

PROOF_NAME='statement-journal-source.json'
CAPTURE_STATEMENTS={'capture-206-prepare':10,'capture-214-prepare':24}


def source_proof():
    from retained_files import file_state
    here=pathlib.Path(__file__).resolve().parent;root=here.parents[1]
    raw=(here/PROOF_NAME).read_bytes();value=exact_json(raw)
    require(value.get('scope')=='CONDITIONAL_FORWARD_STATEMENT_JOURNAL_CONTENT' and
        type(value.get('version')) is int and value['version']==1 and
        canonical(value.get('captureStatementStarts'))==canonical(CAPTURE_STATEMENTS) and
        value.get('completeRestrictedCaptureStatementInventory') is True and
        value.get('runtimeBinaryToSourceBindingVerified') is False and
        value.get('writerGraphAdmissionImplemented') is False and
        value.get('sqlScratchSizeBounded') is False and
        value.get('physicalFilesystemClosureClaimed') is False,
        'Exact conditional forward statement-journal proof required')
    for name,pin in value['files'].items():
        path=pathlib.PurePosixPath(name)
        require(not path.is_absolute() and '..' not in path.parts and path.as_posix()==name,
            'Exact source-relative statement-journal proof paths required')
        state=file_state(root/name)
        require(state is not None and canonical({q:state[q] for q in ('bytes','sha256')})==canonical(pin),
            'Statement-journal native/caller/tooling source changed: '+name)
    return sha(raw)


def declared_statements(count):
    return {'version':1,'scope':'DECLARED_FORWARD_SQL_WRITE_STATEMENTS',
        'maximumStatementStarts':count,'maximumSimultaneousStatementSavepoints':1,
        'explicitSavepoints':False,'continuedWritingAfterRollbackOrSqlError':False}


def statement_journal_bound(header,main_bytes,operations,statements):
    require(type(statements) is dict and set(statements)=={'version','scope',
        'maximumStatementStarts','maximumSimultaneousStatementSavepoints',
        'explicitSavepoints','continuedWritingAfterRollbackOrSqlError'} and
        type(statements['version']) is int and statements['version']==1 and
        statements['scope']=='DECLARED_FORWARD_SQL_WRITE_STATEMENTS' and
        type(statements['maximumStatementStarts']) is int and 1<=statements['maximumStatementStarts']<=1000000 and
        type(statements['maximumSimultaneousStatementSavepoints']) is int and
        statements['maximumSimultaneousStatementSavepoints']==1 and
        statements['explicitSavepoints'] is False and
        statements['continuedWritingAfterRollbackOrSqlError'] is False,
        'Complete forward statement inventory with one implicit savepoint required')
    native=mutation_growth_bound(header,main_bytes,operations)
    count=statements['maximumStatementStarts'];pages=native['maximumLogicalMainPages'];size=native['pageSize']
    per_statement=pages*(size+4);records=count*pages;total=count*per_statement
    require(total<=MAX_CONTENT_BYTES,
        'Complete statement-journal content exceeds the planning envelope; never clip')
    # Files may be closed/recreated, truncated, overwritten at reused offsets,
    # or retained across statements. Charge ALL record writes cumulatively.
    # Partitioning into <=count physical files cannot exceed this sum of
    # individually rounded charges (ceil is subadditive). An accumulating
    # single file is therefore bounded by total, not per_statement.
    layout=copy_layout([per_statement]*count,0)
    return {'version':1,'scope':'CONDITIONAL_FORWARD_STATEMENT_JOURNAL_CONTENT',
        'sourceProofSha256':source_proof(),'declaredStatements':exact_json(canonical(statements)),
        'nativeMutationBound':native,'maximumStatementStarts':count,
        'maximumRecordsPerStatement':pages,'maximumCumulativePageRecords':records,
        'recordBytes':size+4,'recordHeaderBytes':4,'journalHeaderBytes':0,
        'maximumCumulativeLogicalContentBytes':total,
        'maximumSingleFileLogicalContentBytes':total,'maximumFileCreations':count,
        'aggregateAllocationCharges':layout,'memoryBufferCreditBytes':0,
        'truncateReuseDeleteRollbackCreditBytes':0,'statementJournalLogicalContentBounded':True,
        'requiresCompleteNativeAndStatementInventories':True,'requiresNoExplicitOrOverlappingSavepoints':True,
        'requiresNoContinuedWritingAfterRollbackOrSqlError':True,
        'callerReviewVerified':False,'collectorBindingImplemented':False,
        'runtimeBinaryToSourceBindingVerified':False,'runtimeDefaultVfsVerified':False,
        'writerGraphAdmissionImplemented':False,'statementJournalFileLengthOrVfsBounded':False,
        'sqlScratchSizeBounded':False,'walGrowthBounded':False,'fullLifetimeOriginalsRetained':False,
        'continuousPeakMeasured':False,'physicalFilesystemClosureClaimed':False}


def capture_statement_journal_bound(label,header,main_bytes,schema):
    from kit_capture_native_inventory import capture_native_inventory
    require(label in CAPTURE_STATEMENTS,'Only the two strict PRE capture statement inventories are supported')
    inventory=capture_native_inventory(label,schema)
    value=statement_journal_bound(header,main_bytes,inventory['operations'],declared_statements(CAPTURE_STATEMENTS[label]))
    value.update(label=label,restrictedStatementInventorySourceBound=True,
        nativeInventorySourceProofSha256=inventory['sourceProofSha256'])
    return value


def source_bound_statement_journal_plan(label,observation,target):
    from kit_schema_collection import schema_bound_native_plan
    source=schema_bound_native_plan(label,observation,target);profile=source['profile']
    value=capture_statement_journal_bound(label,bytes.fromhex(profile['headerHex']),
        profile['originalFiles']['']['bytes'],observation['schema'])
    value.update(scope='SOURCE_BOUND_CAPTURE_STATEMENT_JOURNAL_CONTENT',
        source=profile['source'],sourceDbWalShm=profile['sourceDbWalShm'],
        headerHex=profile['headerHex'],collectorProofSha256=source['collectorProofSha256'],
        schemaObservationSha256=source['schemaObservationSha256'],
        collectorSourceByteBindingVerified=True,independentSchemaToPrivateDbBytesProof=False)
    return value
