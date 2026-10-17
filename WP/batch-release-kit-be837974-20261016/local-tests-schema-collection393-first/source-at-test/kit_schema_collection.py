"""Bounded full schema observations on NEW owned readers, never raw masters.

These are source-bound collector observations. A package without private DB
bytes cannot independently establish that a collector's rows describe those
bytes. Collection grants no writer admission, VFS bound or physical closure.
"""
import pathlib
import re
from kit_contract import canonical,require,sha
from retained_contract import exact_json
from kit_capture_native_inventory import declared_schema

FULL_SCHEMA_SQL='SELECT type,name,tbl_name,rootpage,sql FROM sqlite_schema ORDER BY type,name'
SCHEMA_LIMIT=16*1024**2
SCHEMA_ORIGINALS=frozenset(('capture-schema-initial.json','capture-schema-206.json','capture-schema-214.json'))
PROOF='schema-collection-source.json'


def collection_proof():
    from retained_files import file_state
    here=pathlib.Path(__file__).resolve().parent
    raw=(here/PROOF).read_bytes();value=exact_json(raw)
    require(value.get('scope')=='NEW_OWNED_READER_COMPLETE_SCHEMA_COLLECTION' and
        value.get('sql')==FULL_SCHEMA_SQL and value.get('rawMastersOpenedSqlite') is False and
        value.get('writerGraphAdmissionImplemented') is False and
        value.get('physicalFilesystemClosureClaimed') is False,'Exact schema collector source proof required')
    require(set(value.get('files',{}))=={'kit_schema_collection.py','retained_files.py',
        'kit_capture_native_inventory.py','kit_capture_copy.py','kit_capture_science.py',
        'kit_contract.py','retained_contract.py','kit_evidence.py','kit_copy_admission.py'},
        'Complete declared collector and capture caller source pins required')
    for name,pin in value['files'].items():
        observed=file_state(here/name)
        require(observed is not None and canonical({q:observed[q] for q in ('bytes','sha256')})==canonical(pin),
            'Schema collector or capture caller source changed: '+name)
    return sha(raw)


def collect_full_schema(db):
    collection_proof()
    require(db.in_transaction and db.execute('PRAGMA query_only').fetchone()==(1,),
        'Full schema must share the owned logical read transaction')
    require(db.execute('PRAGMA encoding').fetchone()==('UTF-8',),'Only explicit UTF-8 schema observations are supported')
    rows=[];total=0
    for row in db.execute(FULL_SCHEMA_SQL):
        item=list(row);size=len(canonical(item))+1
        require(len(rows)<100000 and total+size<=SCHEMA_LIMIT-512,
            'Complete schema exceeds its retained original envelope; no rows may be omitted')
        rows.append(item);total+=size
    value={'version':1,'scope':'DECLARED_COMPLETE_SQLITE_SCHEMA','encoding':1,'rows':rows}
    declared_schema(value)
    require(len(canonical(value))+1<=SCHEMA_LIMIT,'Complete schema original too large')
    return value


def schema_observation(label,schema,state,source,raw,reader_before,reader_after,backup):
    declared_schema(schema)
    expected={'version':1,'scope':'CAPTURE_FULL_SCHEMA_COLLECTOR_OBSERVATION','sealLabel':label,
        'collectorProofSha256':collection_proof(),'schema':schema,'schemaSha256':sha(canonical(schema)),
        'logicalStateOriginal':{'bytes':len(canonical(state))+1,'sha256':sha(canonical(state)+b'\n')},
        'copiedSourceDbWalShm':source,'rawDbWalShm':raw,
        'readerBeforeDbWalShm':reader_before,'readerAfterDbWalShm':reader_after,'backup':backup,
        'sameReadTransactionAsLogicalState':True,'completeUnfilteredSchema':True,
        'newOwnedReaderOnly':True,'backupSchemaExactlyMatched':True,'rawMastersNeverOpenedSqlite':True,
        'independentSchemaToPrivateDbBytesProof':False,'writerGraphAdmissionImplemented':False,
        'mainFileLengthOrVfsPreallocationBounded':False,'physicalFilesystemClosureClaimed':False}
    validate_observation(expected)
    require(len(canonical(expected))+1<=SCHEMA_LIMIT,'Complete schema observation too large; never truncate')
    return expected


def validate_observation(value):
    keys={'version','scope','sealLabel','collectorProofSha256','schema','schemaSha256','logicalStateOriginal',
        'copiedSourceDbWalShm','rawDbWalShm','readerBeforeDbWalShm','readerAfterDbWalShm','backup',
        'sameReadTransactionAsLogicalState','completeUnfilteredSchema','newOwnedReaderOnly',
        'backupSchemaExactlyMatched','rawMastersNeverOpenedSqlite','independentSchemaToPrivateDbBytesProof',
        'writerGraphAdmissionImplemented','mainFileLengthOrVfsPreallocationBounded','physicalFilesystemClosureClaimed'}
    require(type(value) is dict and set(value)==keys and type(value['version']) is int and value['version']==1 and
        value['scope']=='CAPTURE_FULL_SCHEMA_COLLECTOR_OBSERVATION' and
        value['sealLabel'] in ('fresh-production-snapshot','capture-prepared-206','capture-prepared-214') and
        value['collectorProofSha256']==collection_proof(),'Exact full schema observation and source pins required')
    declared_schema(value['schema'])
    require(value['schemaSha256']==sha(canonical(value['schema'])),'Full schema row commitment differs')
    def pin(row):
        require(type(row) is dict and set(row)=={'bytes','sha256'} and type(row['bytes']) is int and
            0<=row['bytes']<=32*1024**3 and type(row['sha256']) is str and
            re.fullmatch('[a-f0-9]{64}',row['sha256']),'Exact full byte identity required')
    pin(value['logicalStateOriginal']);pin(value['backup'])
    require(value['logicalStateOriginal']['bytes']>0 and value['backup']['bytes']>=512,
        'Nonempty logical state and detached database required')
    for key in ('copiedSourceDbWalShm','rawDbWalShm','readerBeforeDbWalShm','readerAfterDbWalShm'):
        triple=value[key]
        require(type(triple) is dict and set(triple)=={'','-wal','-shm'} and triple[''] is not None,
            'Full main/WAL/SHM byte identity required')
        for row in triple.values():
            if row is not None:pin(row)
    require(canonical(value['copiedSourceDbWalShm'])==canonical(value['rawDbWalShm']) and
        canonical(value['rawDbWalShm'])==canonical(value['readerBeforeDbWalShm']),
        'Source, untouched raw master and initial owned reader bytes differ')
    before=value['readerBeforeDbWalShm'];after=value['readerAfterDbWalShm']
    require(canonical(before[''])==canonical(after['']) and
        ((before['-wal'] is None and (after['-wal'] is None or after['-wal']['bytes']==0 and
            after['-wal']['sha256']==sha(b''))) or canonical(before['-wal'])==canonical(after['-wal'])),
        'Read-only schema collector changed main/WAL bytes')
    for key in ('sameReadTransactionAsLogicalState','completeUnfilteredSchema','newOwnedReaderOnly',
        'backupSchemaExactlyMatched','rawMastersNeverOpenedSqlite'):
        require(value[key] is True,'Required full collector observation missing')
    for key in ('independentSchemaToPrivateDbBytesProof','writerGraphAdmissionImplemented',
        'mainFileLengthOrVfsPreallocationBounded','physicalFilesystemClosureClaimed'):
        require(value[key] is False,'Schema collection cannot invent independent DB, writer or filesystem authority')
    return value


def verify_schema_originals(files):
    """Pure package replay; never open any retained target or master with SQL."""
    require(SCHEMA_ORIGINALS<=set(files),'Every complete schema original is required')
    values={}
    for name in sorted(SCHEMA_ORIGINALS):
        raw=files[name]
        require(type(raw) is bytes and 0<len(raw)<=SCHEMA_LIMIT,'Bounded complete schema original required')
        value=validate_observation(exact_json(raw))
        require(raw==canonical(value)+b'\n','Canonical complete schema original required')
        values[name]=value
    snapshot=exact_json(files['capture-snapshot-provenance.json'])
    initial=values['capture-schema-initial.json']
    require(initial['sealLabel']=='fresh-production-snapshot' and
        canonical(initial['backup'])==canonical(snapshot['backup']) and
        canonical(initial['rawDbWalShm'])==canonical(snapshot['rawTripleByteIdentity']) and
        canonical(initial['logicalStateOriginal'])==canonical(snapshot['logicalState']) and
        canonical(snapshot.get('fullSchemaOriginal'))==canonical({'bytes':len(files['capture-schema-initial.json']),
            'sha256':sha(files['capture-schema-initial.json'])}),'Initial schema original does not bind the captured backup/source')
    for issue in ('206','214'):
        name='capture-schema-'+issue+'.json';value=values[name]
        closed=exact_json(files['capture-'+issue+'-prepare-retained-temp/writer-journal-closure.json'])
        preservation=exact_json(files['capture-'+issue+'-preservation.json'])
        require(value['sealLabel']=='capture-prepared-'+issue and
            canonical(value['copiedSourceDbWalShm'])==canonical(closed['afterProfile']['sourceDbWalShm']) and
            canonical(preservation.get('fullSchemaOriginal'))==canonical({'bytes':len(files[name]),'sha256':sha(files[name])}) and
            canonical(preservation.get('logicalStateOriginal'))==canonical(value['logicalStateOriginal']),
            'Post-preparation schema source, closure or preservation binding differs')
    return {'completeSchemaOriginalsReplayed':3,'collectorSourcesVerified':True,
        'independentSchemaToPrivateDbBytesProof':False,'writerGraphAdmissionImplemented':False,
        'mainFileLengthOrVfsPreallocationBounded':False,'physicalFilesystemClosureClaimed':False}


def schema_bound_native_plan(label,observation,target):
    """Read/hash the target through descriptors only; no target SQL or admission."""
    from kit_rollback_journal import rollback_journal_plan
    from kit_capture_native_inventory import capture_native_inventory
    from kit_main_mutations import mutation_growth_bound
    validate_observation(observation)
    expected={'capture-206-prepare':'fresh-production-snapshot','capture-214-prepare':'capture-prepared-206'}
    require(label in expected and observation['sealLabel']==expected[label],
        'Exact preceding full schema observation required for the PRE writer')
    profile=rollback_journal_plan(target)
    prior=({'':observation['backup'],'-wal':None,'-shm':None} if label=='capture-206-prepare'
        else observation['copiedSourceDbWalShm'])
    require(canonical(profile['sourceDbWalShm'])==canonical(prior),
        'Target bytes differ from the full schema collector source binding')
    inventory=capture_native_inventory(label,observation['schema'])
    bound=mutation_growth_bound(bytes.fromhex(profile['headerHex']),profile['originalFiles']['']['bytes'],inventory['operations'])
    return {'version':1,'scope':'SOURCE_BOUND_CAPTURE_PRE_NATIVE_LOGICAL_GROWTH_PLAN','label':label,
        'collectorProofSha256':collection_proof(),'schemaObservationSha256':sha(canonical(observation)+b'\n'),
        'profile':profile,'inventory':inventory,'bound':bound,'collectorSourceByteBindingVerified':True,
        'independentSchemaToPrivateDbBytesProof':False,'callerReviewVerified':False,
        'writerGraphAdmissionImplemented':False,'mainFileLengthOrVfsPreallocationBounded':False,
        'walGrowthBounded':False,'statementOrSqlScratchBounded':False,'physicalFilesystemClosureClaimed':False}
