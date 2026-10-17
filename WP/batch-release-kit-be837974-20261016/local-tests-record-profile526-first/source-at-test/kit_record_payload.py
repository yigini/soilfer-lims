"""Observed UTF-8 column storage sizes on an already-open NEW owned reader.

No capture owner is wired to this collector. It creates no evidence files and
opens no target SQL connection. Projection/record mapping remains conditional.
"""
import json,pathlib,re,stat
from kit_contract import canonical,require,sha
from retained_contract import exact_json
from retained_files import triple,identity_record,quote
from kit_schema_collection import collect_full_schema,validate_observation
from kit_capture_native_inventory import declared_schema

PROOF='record-payload-source.json'
PROFILE_LIMIT=16*1024**2
MAX_RECORD_BYTES=2147483647

def source_proof():
    here=pathlib.Path(__file__).resolve().parent;root=here.parents[1]
    raw=(here/PROOF).read_bytes();v=exact_json(raw)
    require(type(v.get('version')) is int and v['version']==1 and v.get('scope')=='NEW_OWNED_READER_NATIVE_RECORD_PAYLOAD_OBSERVATIONS' and
        v.get('captureCollectorIntegrationImplemented') is False and v.get('runtimeBinaryToSourceBindingVerified') is False and
        v.get('writerGraphAdmissionImplemented') is False,'Exact record payload collector source proof required')
    for name,pin in v['files'].items():
        p=pathlib.PurePosixPath(name);require(p.as_posix()==name and not p.is_absolute() and '..' not in p.parts,'Canonical record source path required')
        b=(root/name).read_bytes()
        require(type(pin) is dict and set(pin)=={'bytes','sha256'} and type(pin['bytes']) is int and
            len(b)==pin['bytes'] and sha(b)==pin['sha256'],'Record payload source changed: '+name)
    return v,sha(raw)

def integer(value,maximum=MAX_RECORD_BYTES):
    require(type(value) is int and 0<=value<=maximum,'Exact bounded nonboolean record byte/count required')
    return value

def state_binding(schema,state):
    declared_schema(schema)
    require(type(state) is dict and set(state)=={'objects','tables','integrity','foreignKeyViolations'} and
        state['integrity']=='ok' and type(state['foreignKeyViolations']) is int and state['foreignKeyViolations']==0 and
        type(state['tables']) is dict,'Successful complete logical-state original required')
    rows=schema['rows'];objects=[[r[0],r[1],r[2],r[4]] for r in rows if not r[1].startswith('sqlite_')]
    require(canonical(objects)==canonical(state['objects']) and
        set(state['tables'])=={r[1] for r in rows if r[0]=='table' and not r[1].startswith('sqlite_')},
        'Exact complete schema/logical table inventory required')
    for name,table in state['tables'].items():
        require(type(table) is dict and set(table)=={'columns','count','sha256'} and
            type(table['columns']) is list and 1<=len(table['columns'])<=2000 and
            all(type(c) is str and c and '\0' not in c for c in table['columns']) and
            len(set(table['columns']))==len(table['columns']) and
            type(table['sha256']) is str and re.fullmatch('[a-f0-9]{64}',table['sha256']),'Exact ordinary logical table columns/fingerprint required')
        integer(table['count'],9223372036854775807)

def full_record_bound(data_bytes):
    require(type(data_bytes) is list and 1<=len(data_bytes)<=2000,'Complete supported native record field list required')
    for value in data_bytes:integer(value)
    size=9+9*len(data_bytes)+sum(data_bytes)
    require(size<=MAX_RECORD_BYTES,'Complete full serialized record bound too large; never clip')
    return size

def collect_record_profiles(db,schema,state):
    """Called only within an existing NEW owned-reader readonly transaction."""
    _,digest=source_proof();state_binding(schema,state)
    require(db.in_transaction and db.execute('PRAGMA query_only').fetchone()==(1,) and
        db.execute('PRAGMA encoding').fetchone()==('UTF-8',) and
        db.execute('PRAGMA temp_store').fetchone()==(2,),'Owned UTF8/query-only/memory-temp read transaction required')
    databases=list(db.execute('PRAGMA database_list'));main=[r for r in databases if r[1]=='main']
    require(len(main)==1 and all(r[1] in ('main','temp') for r in databases),'No attached database record profile supported')
    path=pathlib.Path(main[0][2]);require(path.is_absolute() and path.name=='dev.db' and path.parent.name=='reader' and
        path.resolve()==path,'Only canonical NEW owned reader/dev.db is supported')
    for suffix in ('','-wal','-shm'):
        p=pathlib.Path(str(path)+suffix)
        if p.exists():require(p.stat().st_nlink==1 and p.stat().st_dev==path.stat().st_dev,'Independent same-device owned reader files required')
    db.execute('SELECT count(*) FROM main.sqlite_schema').fetchone()  # establish THIS owned read snapshot before hashing
    before=triple(path);info=path.parent.stat();directory=[info.st_dev,info.st_ino,stat.S_IMODE(info.st_mode)]
    require(canonical(collect_full_schema(db))==canonical(schema),'Record scan schema changed within owned read transaction')
    tables={}
    for name,table in sorted(state['tables'].items()):
        actual=list(db.execute('PRAGMA main.table_xinfo('+quote(name)+')'))
        require([r[1] for r in actual]==table['columns'] and all(r[6]==0 for r in actual),
            'Generated/hidden/missing/changed projection columns refused')
        maxima=[]
        for column in table['columns']:
            c=quote(column)
            data="CASE typeof("+c+") WHEN 'null' THEN 0 WHEN 'integer' THEN 8 WHEN 'real' THEN 8 WHEN 'text' THEN length(CAST("+c+" AS BLOB)) WHEN 'blob' THEN length("+c+") ELSE -1 END"
            sql='SELECT count(*),max('+data+'),min('+data+') FROM main.'+quote(name)
            count,maximum,minimum=db.execute(sql).fetchone();integer(count,9223372036854775807)
            require(count==table['count'],'Complete table record scan count differs from logical original')
            if count==0:require(maximum is None and minimum is None,'Empty native aggregate profile differs');maximum=0
            else:integer(minimum);integer(maximum)
            maxima.append(maximum)
        tables[name]={'columns':list(table['columns']),'rowCount':table['count'],'maximumNativeDataBytesByColumn':maxima,
            'maximumFullSelectedRowRecordBytes':full_record_bound(maxima)}
    after=triple(path);end=path.parent.stat()
    require(canonical(before)==canonical(after) and directory==[end.st_dev,end.st_ino,stat.S_IMODE(end.st_mode)],
        'Owned reader bytes/file identities/directory changed during record observation')
    value={'version':1,'scope':'OWNED_READER_NATIVE_RECORD_PROFILE_OBSERVATION','sourceProofSha256':digest,
        'schemaSha256':sha(canonical(schema)),'logicalStateOriginal':{'bytes':len(canonical(state))+1,'sha256':sha(canonical(state)+b'\n')},
        'collectorEngineVersion':db.execute('SELECT sqlite_version()').fetchone()[0],
        'collectorEngineSourceId':db.execute('SELECT sqlite_source_id()').fetchone()[0],
        'readerPath':str(path),'readerDirectoryIdentity':directory,'originalFiles':before,'tables':tables,
        'readTransactionAndRestrictedReaderPathChecked':True,'queryOnlyUtf8AndMemoryTempChecked':True,
        'schemaAndRecordScanShareTransaction':True,'newReaderCreationAndCallerBindingVerified':False,
        'preSqlCapacityAdmissionVerified':False,'standardBuiltinFunctionsRuntimeVerified':False,
        'kernelQuiescenceVerified':False,'independentProfileToPrivateDbBytesProof':False,
        'captureCollectorIntegrationImplemented':False,'runtimeBinaryToSourceBindingVerified':False,
        'writerGraphAdmissionImplemented':False,'physicalFilesystemClosureClaimed':False}
    validate_profile(value,schema,state);return value

def validate_profile(value,schema,state):
    state_binding(schema,state);_,digest=source_proof()
    keys={'version','scope','sourceProofSha256','schemaSha256','logicalStateOriginal','readerPath','readerDirectoryIdentity','originalFiles','tables','collectorEngineVersion','collectorEngineSourceId',
        'readTransactionAndRestrictedReaderPathChecked','queryOnlyUtf8AndMemoryTempChecked','schemaAndRecordScanShareTransaction',
        'newReaderCreationAndCallerBindingVerified','preSqlCapacityAdmissionVerified','standardBuiltinFunctionsRuntimeVerified',
        'kernelQuiescenceVerified','independentProfileToPrivateDbBytesProof','captureCollectorIntegrationImplemented',
        'runtimeBinaryToSourceBindingVerified','writerGraphAdmissionImplemented','physicalFilesystemClosureClaimed'}
    require(type(value) is dict and set(value)==keys and type(value['version']) is int and value['version']==1 and
        value['scope']=='OWNED_READER_NATIVE_RECORD_PROFILE_OBSERVATION' and value['sourceProofSha256']==digest and
        value['schemaSha256']==sha(canonical(schema)) and canonical(value['logicalStateOriginal'])==
        canonical({'bytes':len(canonical(state))+1,'sha256':sha(canonical(state)+b'\n')}),'Exact complete record/schema/logical original commitment required')
    require(type(value['collectorEngineVersion']) is str and type(value['collectorEngineSourceId']) is str and
        0<len(value['collectorEngineVersion'])<64 and 0<len(value['collectorEngineSourceId'])<300,'Observed collector engine strings required; no binary attestation')
    require(type(value['readerPath']) is str,'Exact observed reader path string required')
    path=pathlib.Path(value['readerPath']);require(path.is_absolute() and path.name=='dev.db' and path.parent.name=='reader','Exact owned reader path required')
    require(type(value['readerDirectoryIdentity']) is list and len(value['readerDirectoryIdentity'])==3 and
        all(type(x) is int and x>=0 for x in value['readerDirectoryIdentity']),'Exact observed directory identity required')
    files=value['originalFiles'];require(type(files) is dict and set(files)=={'','-wal','-shm'} and files[''] is not None,'Complete observed original file triple required')
    for row in files.values():
        if row is not None:
            require(type(row) is dict and set(row)=={'sha256','bytes','device','inode','mtimeNs','mode','allocatedBytes'} and
                type(row['sha256']) is str and re.fullmatch('[a-f0-9]{64}',row['sha256']) and
                all(type(row[k]) is int and row[k]>=0 for k in row if k!='sha256'),'Exact full observed file hash/identity required')
    require(type(value['tables']) is dict and set(value['tables'])==set(state['tables']),'Every user table record profile required')
    for name,row in value['tables'].items():
        require(type(row) is dict and set(row)=={'columns','rowCount','maximumNativeDataBytesByColumn','maximumFullSelectedRowRecordBytes'} and
            row['columns']==state['tables'][name]['columns'] and type(row['rowCount']) is int and
            row['rowCount']==state['tables'][name]['count'] and type(row['maximumNativeDataBytesByColumn']) is list and
            len(row['columns'])==len(row['maximumNativeDataBytesByColumn']),'Exact complete table profile required')
        expected=full_record_bound(row['maximumNativeDataBytesByColumn'])
        require(type(row['maximumFullSelectedRowRecordBytes']) is int and row['maximumFullSelectedRowRecordBytes']==expected and
            (row['rowCount']>0 or all(x==0 for x in row['maximumNativeDataBytesByColumn'])),'Complete native record header/data arithmetic differs')
    for key in keys:
        if key in ('readTransactionAndRestrictedReaderPathChecked','queryOnlyUtf8AndMemoryTempChecked','schemaAndRecordScanShareTransaction'):
            require(value[key] is True,'Required collector observation missing')
        elif key.endswith('Verified') or key.endswith('Implemented') or key in ('physicalFilesystemClosureClaimed','independentProfileToPrivateDbBytesProof'):
            require(value[key] is False,'Record profile cannot invent runtime/caller/private-byte/admission authority')
    require(len(canonical(value))+1<=PROFILE_LIMIT,'Complete record profile exceeds16MiB original envelope; never clip')
    return value

def declared_projection(table,columns,extra_data):
    return {'version':1,'table':table,'columns':columns,'extraFieldsMaximumDataBytes':extra_data,
        'onlyCopiedColumnsAndDeclaredExtraFields':True,'noAffinityOrEncodingConversion':True}

def projected_record_bound(profile,schema,state,projection):
    validate_profile(profile,schema,state)
    require(type(projection) is dict and type(projection.get('table')) is str and projection['table'] in profile['tables'] and
        type(projection.get('columns')) is list and type(projection.get('extraFieldsMaximumDataBytes')) is list and
        all(type(x) is str for x in projection['columns']),'Exact copied-column projection and explicit extra fields required')
    expected=declared_projection(projection['table'],projection['columns'],projection['extraFieldsMaximumDataBytes'])
    require(canonical(expected)==canonical(projection),'Expressions/affinity/encoding conversions/foreign projection fields unsupported')
    table=profile['tables'][projection['table']];maximum=dict(zip(table['columns'],table['maximumNativeDataBytesByColumn']))
    require(all(c in maximum for c in projection['columns']),'Projection column absent')
    data=[maximum[c] for c in projection['columns']]+projection['extraFieldsMaximumDataBytes']
    bound=full_record_bound(data)
    return {'version':1,'scope':'COLLECTOR_BOUND_COPIED_FIELD_NATIVE_RECORD_UPPER_BOUND','profileSha256':sha(canonical(profile)+b'\n'),
        'projection':expected,'maximumFullSerializedRecordBytes':bound,'sourceTableRowCount':table['rowCount'],
        'includesEveryHeaderAndSerialTypeVarint':True,'independentColumnMaximaWithoutSameRowCredit':True,
        'completeNativeRecordMappingVerified':False,'nativeRecordCallCountDerived':False,
        'callerReviewVerified':False,'writerGraphAdmissionImplemented':False,'physicalFilesystemClosureClaimed':False}

def source_bound_record_plan(profile,observation,logical_original,target,projection):
    validate_observation(observation)
    require(type(logical_original) is bytes and 0<len(logical_original)<=32*1024**2,'Full canonical logical original required')
    state=exact_json(logical_original);require(logical_original==canonical(state)+b'\n' and
        canonical(observation['logicalStateOriginal'])==canonical({'bytes':len(logical_original),'sha256':sha(logical_original)}),
        'Exact entire logical original pin required')
    bound=projected_record_bound(profile,observation['schema'],state,projection)
    require(canonical(profile['logicalStateOriginal'])==canonical(observation['logicalStateOriginal']) and
        all(canonical(identity_record(profile['originalFiles'])[key])==canonical(observation['readerAfterDbWalShm'][key]) for key in ('','-wal')),
        'Record collector source does not match full schema owned-reader observation')
    target=pathlib.Path(target);require(target.is_absolute() and target.resolve()==target,'Canonical target descriptor path required')
    for suffix in ('','-wal','-shm'):
        p=pathlib.Path(str(target)+suffix)
        if p.exists():require(p.stat().st_nlink==1 and p.stat().st_dev==target.stat().st_dev,'Independent same-device target descriptors required')
    files=triple(target);expected=({'':observation['backup'],'-wal':None,'-shm':None} if observation['sealLabel']=='fresh-production-snapshot'
        else observation['copiedSourceDbWalShm'])
    require(canonical(identity_record(files))==canonical(expected),'Target full bytes differ from collector source chain')
    return {'version':1,'scope':'SOURCE_BOUND_NATIVE_RECORD_PROFILE_PLAN','profile':profile,'schemaObservation':observation,
        'logicalState':state,'target':str(target),'originalTargetFiles':files,'projection':projection,'bound':bound,
        'collectorSourceByteBindingVerified':True,'independentProfileToPrivateDbBytesProof':False,
        'completeNativeRecordMappingVerified':False,'nativeRecordCallCountDerived':False,
        'schemaToProfileMainAndWalObserved':True,'shmEqualityRequiredForSourceAssociation':False,
        'captureCollectorIntegrationImplemented':False,'writerGraphAdmissionImplemented':False,'physicalFilesystemClosureClaimed':False}

def replay_record_plan(plan):
    require(type(plan) is dict and plan.get('scope')=='SOURCE_BOUND_NATIVE_RECORD_PROFILE_PLAN','Exact original source-bound record plan required')
    expected=source_bound_record_plan(plan['profile'],plan['schemaObservation'],canonical(plan['logicalState'])+b'\n',plan['target'],plan['projection'])
    require(canonical(plan)==canonical(expected),'Record profile/source/target identities/projection/authority changed')