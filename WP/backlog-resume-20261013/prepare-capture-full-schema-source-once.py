from pathlib import Path
import hashlib,json,subprocess
w=Path(r'C:/Users/yigin/.codex/worktrees/audit-qc-integration/soilfer-lims');k=w/'WP/batch-release-kit-be837974-20261016'
assert subprocess.check_output(['git','rev-parse','HEAD'],cwd=w,text=True).strip()=='9d943dbcc980984eb1c09fdeb0649830dbce18ab'
assert not (k/'kit_schema_collection.py').exists()
def replace(name,old,new):
 p=k/name;s=p.read_text(encoding='utf8');assert s.count(old)==1,(name,old[:100]);p.write_text(s.replace(old,new),encoding='utf8',newline='')
(k/'kit_schema_collection.py').write_text("""\"\"\"Bounded full schema observations on NEW owned readers, never raw masters.

These are source-bound collector observations. A package without private DB
bytes cannot independently establish that a collector's rows describe those
bytes. Collection grants no writer admission, VFS bound or physical closure.
\"\"\"
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
        'logicalStateOriginal':{'bytes':len(canonical(state))+1,'sha256':sha(canonical(state)+b'\\n')},
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
    \"\"\"Pure package replay; never open any retained target or master with SQL.\"\"\"
    require(SCHEMA_ORIGINALS<=set(files),'Every complete schema original is required')
    values={}
    for name in sorted(SCHEMA_ORIGINALS):
        raw=files[name]
        require(type(raw) is bytes and 0<len(raw)<=SCHEMA_LIMIT,'Bounded complete schema original required')
        value=validate_observation(exact_json(raw))
        require(raw==canonical(value)+b'\\n','Canonical complete schema original required')
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
""",encoding='utf8',newline='')
replace('retained_files.py','def logical(path):','def logical(path,full_schema=False):')
replace('retained_files.py','        tables={}\n','        schema=None\n        if full_schema:\n            from kit_schema_collection import collect_full_schema\n            schema=collect_full_schema(db)\n        tables={}\n')
replace('retained_files.py',"        db.rollback();return {'objects':objects,'tables':tables,'integrity':'ok','foreignKeyViolations':0}","        state={'objects':objects,'tables':tables,'integrity':'ok','foreignKeyViolations':0}\n        db.rollback();return (state,schema) if full_schema else state")
replace('retained_files.py','def seal(root,label,source,check,live_source=False):','def seal(root,label,source,check,live_source=False,schema_original=None):')
replace('retained_files.py',"    state=logical(reader);verify_reader_index(reader,index_bound);backup=d/'backup.db'", "    reader_before=identity_record(triple(reader))\n    observed=logical(reader,full_schema=schema_original is not None)\n    state,schema=observed if schema_original is not None else (observed,None)\n    verify_reader_index(reader,index_bound);backup=d/'backup.db'")
replace('retained_files.py',"    backup.chmod(0o400);require(logical(backup)==state,'Detached WAL-aware backup differs')", "    backup.chmod(0o400)\n    detached=logical(backup,full_schema=schema_original is not None)\n    require(detached==((state,schema) if schema_original is not None else state),'Detached WAL-aware backup or full schema differs')")
replace('retained_files.py',"    write_new(d/'logical-state.json',state);write_new(d/'seal.json',", "    if schema_original is not None:\n        from kit_schema_collection import SCHEMA_ORIGINALS,schema_observation\n        require(schema_original in SCHEMA_ORIGINALS,'Only the three declared capture schema original names are supported')\n        observation=schema_observation(label,schema,state,identity_record(original),identity_record(triple(raw)),\n            reader_before,identity_record(triple(reader)),identity_record({'':file_state(backup)})[''])\n        write_new(pathlib.Path(root)/schema_original,observation)\n    write_new(d/'logical-state.json',state);write_new(d/'seal.json',")
replace('kit_capture_copy.py',"disk.check,True)\n    # Count", "disk.check,True,schema_original='capture-schema-initial.json')\n    # Count")
replace('kit_capture_copy.py',"        'logicalState':capture_reference(snapshot/'logical-state.json'),'handoff':", "        'fullSchemaOriginal':capture_reference(root/'capture-schema-initial.json'),\n        'logicalState':capture_reference(snapshot/'logical-state.json'),'handoff':")
replace('kit_capture_copy.py',"    for path,key in [(backup,'backup'),(snapshot/'logical-state.json','logicalState'),", "    for path,key in [(backup,'backup'),(snapshot/'logical-state.json','logicalState'),\n        (root/'capture-schema-initial.json','fullSchemaOriginal'),")
replace('kit_capture_science.py',"installed,state=seal(self.root,'capture-prepared-'+issue,self.target,self.disk.check)", "installed,state=seal(self.root,'capture-prepared-'+issue,self.target,self.disk.check,\n            schema_original='capture-schema-'+issue+'.json')")
replace('kit_capture_science.py',"        preservation=delta_from_state(self.previous_state,state,installed,tables,marker)", "        preservation=delta_from_state(self.previous_state,state,installed,tables,marker)\n        preservation['fullSchemaOriginal']=capture_reference(self.root/('capture-schema-'+issue+'.json'))\n        preservation['logicalStateOriginal']=capture_reference(self.root/('capture-prepared-'+issue)/'logical-state.json')")
replace('kit_capture_review.py','from kit_capture_journal import JOURNAL_ORIGINALS','from kit_capture_journal import JOURNAL_ORIGINALS\nfrom kit_schema_collection import SCHEMA_ORIGINALS')
replace('kit_capture_review.py',"'ingress-held.conf'))|JOURNAL_ORIGINALS", "'ingress-held.conf'))|JOURNAL_ORIGINALS|SCHEMA_ORIGINALS")
replace('kit_capture_review.py','    verify_capture_journals(files,CAPTURE_ROOT)\n', '    verify_capture_journals(files,CAPTURE_ROOT)\n    from kit_schema_collection import verify_schema_originals\n    verify_schema_originals(files)\n')
replace('kit_frozen.py',"    'kit_main_mutations.py'", "    'kit_schema_collection.py','schema-collection-source.json',\n    'kit_main_mutations.py'")
replace('build_capture_stop_post.py',"    'kit_capture_review.py':", "    'kit_schema_collection.py':('SCHEMA_ORIGINALS',),\n    'kit_capture_review.py':")
print('Prepared source-bound full schema collector and three capture originals; no operators executed')
