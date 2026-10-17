"""Conditional strict PRE209 native mutations/dirty frames, never admission.

Unlike new-table indexes, the new OrderLine index refills one NULL+rowid key
for EVERY existing row. Its count must come from the full source-bound state.
"""
import json
import pathlib
import re
from kit_contract import canonical,require,sha
from retained_contract import exact_json
from kit_capture_native_inventory import declared_schema,normalized,RECEIPT_SQL,RECEIPT_INDEX
from kit_wal_dirty_inventory import COEFFICIENTS,effective_header
from kit_wal_content import page_size,declared_frames,wal_content_plan
from kit_schema_collection import validate_observation

PROOF='order-revision-native-source.json'
MARKER='209_order_revision_contract'
MAX_ROWS=1000000


def source_proof():
    here=pathlib.Path(__file__).resolve().parent;root=here.parents[1]
    raw=(here/PROOF).read_bytes();v=exact_json(raw)
    require(type(v.get('version')) is int and v['version']==1 and
        v.get('scope')=='CONDITIONAL_STRICT_PRE209_ALTER_AND_EXISTING_ROW_INDEX_NATIVE_WRITES' and
        v.get('collectorBindingImplemented') is False and v.get('writerGraphAdmissionImplemented') is False and
        v.get('runtimeBinaryToSourceBindingVerified') is False,'Exact PRE209 native source proof required')
    for name,pin in v['files'].items():
        p=pathlib.PurePosixPath(name)
        require(not p.is_absolute() and '..' not in p.parts and p.as_posix()==name,'Canonical PRE209 source path required')
        raw=(root/name).read_bytes()
        require(type(pin) is dict and set(pin)=={'bytes','sha256'} and type(pin['bytes']) is int and
            len(raw)==pin['bytes'] and sha(raw)==pin['sha256'],'PRE209 native source changed: '+name)
    return v,sha((here/PROOF).read_bytes())


def order_native_inventory(label,schema,state):
    require(type(label) is str and label=='209-apply','Only strict PRE209 APPLY is inventoried')
    declared_schema(schema);proof,proof_sha=source_proof();rows=schema['rows']
    require(type(state) is dict and set(state)=={'objects','tables','integrity','foreignKeyViolations'} and
        state['integrity']=='ok' and type(state['foreignKeyViolations']) is int and state['foreignKeyViolations']==0 and
        type(state['tables']) is dict,'Full successful declared logical-state inventory required')
    objects=[[r[0],r[1],r[2],r[4]] for r in rows if not r[1].startswith('sqlite_')]
    require(canonical(state['objects'])==canonical(objects) and set(state['tables'])==
        {r[1] for r in rows if r[0]=='table' and not r[1].startswith('sqlite_')},
        'Declared logical objects/tables differ from complete schema')
    receipt=[r for r in rows if r[2].casefold()=='_schema_migrations']
    table=next((r for r in receipt if r[0]=='table' and r[1]=='_schema_migrations'),None)
    index=next((r for r in receipt if r[0]=='index' and r[1]==RECEIPT_INDEX),None)
    require(len(receipt)==2 and table is not None and normalized(table[4])==normalized(RECEIPT_SQL) and
        index is not None and index[4] is None,'Exact receipt table/default/sole PK index and no extra receipt writes required')
    require(not any(r[2].casefold() in ('sqlite_schema','sqlite_master') for r in rows),
        'Custom schema-table objects are outside the PRE209 profile')
    names={o['name'].casefold() for o in proof['releaseObjects']}
    require(not names.intersection(r[1].casefold() for r in rows),'Only fully absent PRE209 release objects supported')
    line=next((r for r in rows if r[0]=='table' and r[1]=='OrderLine'),None)
    require(line is not None and line[2]=='OrderLine','Exact ordinary OrderLine table and stored owner name required')
    sql=line[4]
    require('--' not in sql and '/*' not in sql and not re.search(r'\bWITHOUT\s+ROWID\b',sql,re.I) and
        not re.search(r'\bworkItemId\b',sql,re.I),
        'Strict ordinary rowid OrderLine without the new column or SQL comments required')
    for name in ('SampleOrderRevision','OrderLine','WorkItem','WorkAttempt'):
        require(any(r[0]=='table' and r[1]==name for r in rows),'Declared PRE209 trigger-owner table required: '+name)
    info=state['tables']['OrderLine']
    require(type(info) is dict and set(info)=={'columns','count','sha256'} and type(info['count']) is int and
        0<=info['count']<=MAX_ROWS and type(info['columns']) is list and len(info['columns'])>0 and
        all(type(n) is str and n and n.casefold()!='workitemid' for n in info['columns']) and
        len({n.casefold() for n in info['columns']})==len(info['columns']) and type(info['sha256']) is str and
        re.fullmatch('[a-f0-9]{64}',info['sha256']),'Exact full OrderLine count/column/fingerprint declaration required')
    count=info['count'];old_payload=len(sql.encode())+512
    new_payload=max(len(sql.encode())+len(proof['appendedColumnSql'].encode())+2,
        len(proof['ddlSql'].encode()))+512
    groups=[{'category':'existing_orderline_schema_overwrite','calls':1,'maximumPayloadBytes':new_payload},
        {'category':'new_index_and_trigger_schema_records','calls':6,'maximumPayloadBytes':new_payload},
        {'category':'existing_orderline_index_refill_keys','calls':count,'maximumPayloadBytes':32},
        {'category':'receipt_table_row','calls':1,'maximumPayloadBytes':proof['maximumReceiptTablePayloadBytes']},
        {'category':'receipt_pk_index_key','calls':1,'maximumPayloadBytes':proof['maximumReceiptIndexPayloadBytes']}]
    operations={'version':1,'scope':'DECLARED_NATIVE_NORMAL_BTREE_MUTATIONS','callerReviewSha256':proof_sha,
        'createdRoots':1,'normalInsertions':[{k:r[k] for k in ('calls','maximumPayloadBytes')} for r in groups if r['calls']],
        'deletions':1}
    return {'version':1,'scope':'CONDITIONAL_STRICT_PRE209_NATIVE_MUTATION_INVENTORY','label':label,
        'sourceProofSha256':proof_sha,'declaredFullSchemaSha256':sha(canonical(schema)),
        'declaredFullLogicalStateSha256':sha(canonical(state)),'declaredOrderLineRows':count,
        'maximumOldSchemaPayloadBytes':old_payload,'maximumNewSchemaPayloadBytes':new_payload,
        'mutationGroups':groups,'operations':operations,'maximumDdlStatements':7,'maximumSqlWriteStatements':8,
        'newRootCount':1,'existingApplicationRowsUpdated':0,'indexKeysPerExistingRow':1,
        'indexPayloadIsNewNullAndBuiltinRowid':True,'indexRefillUsesNormalNotPreformattedInsert':True,
        'receiptMarkerAbsenceStillRequiresActualClassifier':True,
        'collectorBindingImplemented':False,'callerReviewVerified':False,'writerGraphAdmissionImplemented':False,
        'wholeOwnerFrameInventoryVerified':False,'runtimeBinaryToSourceBindingVerified':False,
        'runtimeDefaultVfsVerified':False,'physicalFilesystemClosureClaimed':False}


def order_dirty_inventory(size,schema,state):
    page_size(size);native=order_native_inventory('209-apply',schema,state);c=COEFFICIENTS
    per_level=c['parentWritePerLevel']+5*c['allocationPagerWrites']+5+4+4*c['freePagerWritesIncludingSecureDelete']
    balance=c['balanceLevels']*per_level+c['rootDeeperWrites']+c['quickBalanceWrites']
    old=(native['maximumOldSchemaPayloadBytes']+size-5)//(size-4);normal=0;groups=[]
    for row in native['mutationGroups']:
        new=(row['maximumPayloadBytes']+size-5)//(size-4)
        writes=2+new*3+old*3+2*(1+new)+balance
        groups.append(dict(row,pagerWritesPerCall=writes));normal+=row['calls']*writes
    delete=3+old*3+2*balance
    categories={'normalMutations':normal,'conservativeSchemaDelete':delete,
        'indexRootAllocation':3,'schemaMetadataCookies':7*3,'extraEmptyNewRootClear':1,'beginPageCountRepair':1}
    writes=sum(categories.values());marks=max(1,65536//size);entries=writes*marks+1
    require(entries<=1000000000,'Complete PRE209 frame inventory too large; never clip')
    return {'version':1,'scope':'CONDITIONAL_STRICT_PRE209_PAGER_DIRTY_FRAME_INVENTORY',
        'sourceProofSha256':native['sourceProofSha256'],'pageSize':size,'nativeInventory':native,
        'mutationExpansion':groups,'pagerWriteCategories':categories,'maximumPagerWriteCalls':writes,
        'maximumDirtyMarksPerPagerWrite':marks,'maximumSyntheticCommitPageOneFrames':1,
        'targetFrameInventory':declared_frames(entries,entries,1,native['sourceProofSha256']),
        'completeConditionalTargetDirtyInventoryDerived':True,'actualNativeFrameRequestsMeasured':False,
        'collectorBindingImplemented':False,'writerGraphAdmissionImplemented':False,
        'mainCheckpointGrowthBounded':False,'shmWriterGrowthBounded':False,'sorterOrSqlScratchBounded':False,
        'runtimeBinaryToSourceBindingVerified':False,'runtimeDefaultVfsVerified':False,
        'physicalFilesystemClosureClaimed':False}


def order_wal_plan(target,schema,state):
    native=order_native_inventory('209-apply',schema,state)
    initial=wal_content_plan(target,declared_frames(0,0,0,native['sourceProofSha256']))
    current=effective_header(initial);inventory=order_dirty_inventory(initial['bound']['pageSize'],schema,state)
    require(all(r[3]<=current['logicalPages'] for r in schema['rows']),'Declared PRE209 root exceeds current logical database')
    observed=wal_content_plan(target,inventory['targetFrameInventory'])
    require(canonical(observed['originalFiles'])==canonical(initial['originalFiles']) and
        observed['directoryIdentity']==initial['directoryIdentity'],'PRE209 source changed while planning')
    return {'version':1,'scope':'DECLARED_SCHEMA_STRICT_PRE209_WAL_CONTENT_PLAN',
        'declaredSchema':schema,'declaredLogicalState':state,'inventory':inventory,'effectivePageOne':current,
        'observation':observed,'schemaToSourceCollectorBindingVerified':False,
        'intactSourceAndNativeRecoveredIndexVerified':False,'writerGraphAdmissionImplemented':False,
        'beforeCreateHeldAdmissionImplemented':False,'mainFileGrowthOrCheckpointBounded':False,
        'sorterOrSqlScratchBounded':False,'physicalFilesystemClosureClaimed':False}


def schema_bound_order_wal_plan(observation,logical_original,target):
    validate_observation(observation)
    require(observation['sealLabel']=='capture-prepared-214','Exact preceding post214 full schema observation required')
    require(type(logical_original) is bytes and 0<len(logical_original)<=32*1024**2,'Complete logical state original required')
    state=exact_json(logical_original)
    require(logical_original==canonical(state)+b'\n' and
        canonical(observation['logicalStateOriginal'])==canonical({'bytes':len(logical_original),'sha256':sha(logical_original)}),
        'Exact source-bound logical state commitment required')
    plan=order_wal_plan(target,observation['schema'],state)
    require(canonical(plan['observation']['sourceDbWalShm'])==canonical(observation['copiedSourceDbWalShm']),
        'PRE209 target bytes differ from source-bound full schema original')
    return {'version':1,'scope':'SOURCE_BOUND_COLLECTOR_PRE209_WAL_PLAN','schemaObservation':observation,
        'logicalState':state,'plan':plan,'collectorSourceByteBindingVerified':True,
        'independentSchemaToPrivateDbBytesProof':False,'intactSourceAndNativeRecoveredIndexVerified':False,
        'wholeOwnerFrameInventoryVerified':False,'writerGraphAdmissionImplemented':False,
        'runtimeBinaryToSourceBindingVerified':False,'runtimeDefaultVfsVerified':False,
        'physicalFilesystemClosureClaimed':False}


def recheck_order_wal(plan):
    require(type(plan) is dict and plan.get('scope')=='SOURCE_BOUND_COLLECTOR_PRE209_WAL_PLAN',
        'Exact original source-bound PRE209 WAL record required')
    expected=schema_bound_order_wal_plan(plan['schemaObservation'],canonical(plan['logicalState'])+b'\n',
        plan['plan']['observation']['source'])
    require(canonical(expected)==canonical(plan),'PRE209 source/schema/state/native/authority record changed')
    return plan
