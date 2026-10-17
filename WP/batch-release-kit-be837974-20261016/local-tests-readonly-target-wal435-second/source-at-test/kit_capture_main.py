"""Held logical MAIN growth for the two strict PRE capture writers only.

The controls precede writer creation and main extension. VFS preallocation,
physical allocation and independent private-DB content proof remain unclosed.
"""
import pathlib
from kit_contract import canonical,require,sha
from retained_contract import exact_json
from kit_copy_admission import copy_layout

MAIN_SITES={'capture-206-prepare':'capture-206-native-main','capture-214-prepare':'capture-214-native-main'}
MAIN_SCHEMA={'capture-206-prepare':'capture-schema-initial.json','capture-214-prepare':'capture-schema-206.json'}
# Maxima over ALL8 supported page sizes; no freed-page or rollback credit.
MAIN_GROWTH_MAX={'capture-206-prepare':269352960,'capture-214-prepare':581304320}
JOURNAL_214_GROWTH_EXTRA=808091760
PROOF_NAME='capture-native-main-source.json'


def main_disk_original(label):
    require(label in MAIN_SITES,'Exact capture native MAIN writer required')
    return 'copy-admission-'+sha((MAIN_SITES[label]+'\0scientific-database/dev.db').encode())[:32]+'.json'


MAIN_ORIGINALS=frozenset(name for label in MAIN_SITES for name in (
    label+'-retained-temp/writer-main-admission.json',
    label+'-retained-temp/writer-main-closure.json',main_disk_original(label)))


def main_source_proof():
    from retained_files import file_state
    here=pathlib.Path(__file__).resolve().parent;raw=(here/PROOF_NAME).read_bytes();value=exact_json(raw)
    require(value.get('scope')=='CAPTURE_STRICT_PRE_NATIVE_MAIN_LOGICAL_GROWTH_ONLY' and
        value.get('completeRestrictedMainNativeCallerReview') is True and
        value.get('mainFileLengthOrVfsPreallocationBounded') is False and
        value.get('physicalFilesystemClosureClaimed') is False and
        canonical(value.get('maximumLogicalGrowthBytes'))==canonical(MAIN_GROWTH_MAX) and
        value.get('journal214AdditionalRecordBytes')==JOURNAL_214_GROWTH_EXTRA,
        'Exact restricted native MAIN source proof required')
    for name,pin in value['files'].items():
        state=file_state(here/name)
        require(state is not None and canonical({q:state[q] for q in ('bytes','sha256')})==canonical(pin),
            'Native MAIN tooling or proof source changed: '+name)
    return sha(raw)


def main_plan_fields(label,observation,original,journal):
    from kit_schema_collection import validate_observation,collection_proof
    from kit_capture_native_inventory import capture_native_inventory
    from kit_capture_journal import caller_proof
    from kit_capture_journal_package import journal_profile
    from kit_main_mutations import mutation_growth_bound
    validate_observation(observation)
    require(label in MAIN_SITES and original.get('file')==MAIN_SCHEMA[label] and
        canonical({q:original[q] for q in ('bytes','sha256')})==canonical({
            'bytes':len(canonical(observation))+1,'sha256':sha(canonical(observation)+b'\n')}),
        'Exact full schema original binding required')
    require(journal.get('label')==label and journal.get('callerProofSha256')==caller_proof(),
        'Native MAIN must share the exact admitted journal caller')
    profile=journal_profile(journal,pathlib.Path(journal['source']))
    prior=({'':observation['backup'],'-wal':None,'-shm':None} if label=='capture-206-prepare'
        else observation['copiedSourceDbWalShm'])
    expected='fresh-production-snapshot' if label=='capture-206-prepare' else 'capture-prepared-206'
    require(observation['sealLabel']==expected and canonical(profile['sourceDbWalShm'])==canonical(prior),
        'Native MAIN target does not bind its preceding full schema collector source')
    header=bytes.fromhex(profile['headerHex']);require(int.from_bytes(header[56:60],'big')==1,
        'Native MAIN full schema requires the exact UTF-8 file header')
    require(all(row[3]<=profile['bound']['originalPages'] for row in observation['schema']['rows']),
        'Schema root page exceeds the bound source database')
    inventory=capture_native_inventory(label,observation['schema'])
    bound=mutation_growth_bound(header,profile['originalFiles']['']['bytes'],inventory['operations'])
    require(bound['maximumLogicalGrowthBytes']<=MAIN_GROWTH_MAX[label],
        'Complete native growth exceeds its held static envelope; never clip')
    result={'version':1,'scope':'CAPTURE_NATIVE_MAIN_LOGICAL_GROWTH_ADMISSION','label':label,
        'schemaOriginal':original,'schemaSha256':observation['schemaSha256'],
        'collectorProofSha256':collection_proof(),'nativeMainProofSha256':main_source_proof(),
        'nativeInventoryProofSha256':inventory['sourceProofSha256'],
        'journalAdmissionSha256':sha(canonical(journal)+b'\n'),
        'directoryIdentity':journal['directoryIdentity'],'containerSource':'/app/server/prisma/dev.db',
        'operations':inventory['operations'],'bound':bound,
        'layout':copy_layout([bound['maximumLogicalGrowthBytes']],0),
        'collectorSourceByteBindingVerified':True,'restrictedMainNativeProfileVerified':True,
        'logicalMainGrowthWriterAdmissionImplemented':True,
        'independentSchemaToPrivateDbBytesProof':False,'mainFileLengthOrVfsPreallocationBounded':False,
        'statementOrSqlScratchBounded':False,'walGrowthBounded':False,
        'physicalFilesystemClosureClaimed':False,'completeWriterFilesystemReview':False}
    require(len(canonical(result))+1<=8192,'Complete native MAIN admission exceeds its immutable envelope')
    return result


def read_schema_original(root,label):
    from controller_output import output_pin
    name=MAIN_SCHEMA[label];path=pathlib.Path(root)/name;pin=output_pin(path,16*1024**2)
    with path.open('rb') as stream:raw=stream.read(16*1024**2+1)
    require(pin=={'bytes':len(raw),'sha256':sha(raw)} and output_pin(path,16*1024**2)==pin,
        'Full schema original changed while binding the writer')
    observation=exact_json(raw);require(raw==canonical(observation)+b'\n','Canonical full schema original required')
    return observation,{'file':name,**pin}


def capture_main_plan(spec,journal):
    from kit_capture_owned import validate_capture_spec,CAPTURE_ROOT
    from kit_capture_copy import verify_capture_clone
    from controller_output import output_read_record,output_pin
    validate_capture_spec(spec);label=spec['label'];require(label in MAIN_SITES and spec['dataWritable'] is True,
        'Only the two strict PRE capture writers have native MAIN admission')
    verify_capture_clone(CAPTURE_ROOT);observation,original=read_schema_original(CAPTURE_ROOT,label)
    if label=='capture-206-prepare':
        snapshot=output_read_record(CAPTURE_ROOT,'capture-snapshot-provenance.json')
        require(canonical(snapshot['fullSchemaOriginal'])==canonical({q:original[q] for q in ('bytes','sha256')}),
            'Initial full schema original differs from snapshot provenance')
    else:
        path=CAPTURE_ROOT/'capture-206-preservation.json';pin=output_pin(path,16*1024**2)
        raw=path.read_bytes();require(pin=={'bytes':len(raw),'sha256':sha(raw)},'Prior preservation original changed')
        prior=exact_json(raw)
        require(canonical(prior.get('fullSchemaOriginal'))==canonical({q:original[q] for q in ('bytes','sha256')}) and
            canonical(prior.get('logicalStateOriginal'))==canonical(observation['logicalStateOriginal']),
            'Post206 full schema is not bound by its preservation original')
    return main_plan_fields(label,observation,original,journal)


def recheck_capture_main(plan,spec,journal):
    from kit_capture_journal import recheck_capture_journal
    recheck_capture_journal(journal)
    require(canonical(capture_main_plan(spec,journal))==canonical(plan),
        'Native MAIN source/schema/profile changed before writer creation')


def main_closure_fields(plan,journal_closed):
    from kit_capture_journal_package import journal_profile
    require(plan.get('scope')=='CAPTURE_NATIVE_MAIN_LOGICAL_GROWTH_ADMISSION' and
        plan.get('nativeMainProofSha256')==main_source_proof(),
        'Exact original native MAIN admission required')
    require(journal_closed.get('label')==plan['label'] and journal_closed.get('admissionSha256')==plan['journalAdmissionSha256'],
        'Native MAIN closure must follow its exact journal transaction')
    after=journal_closed['afterProfile'];profile=journal_profile(after,pathlib.Path(after['source']))
    bound=plan['bound']
    require(profile['bound']['pageSize']==bound['pageSize'] and
        profile['bound']['originalPages']<=bound['maximumLogicalMainPages'] and
        profile['originalFiles']['']['bytes']<=bound['maximumLogicalMainBytes'],
        'Post-child MAIN exceeds its admitted logical page envelope')
    return {'version':1,'label':plan['label'],'admissionSha256':sha(canonical(plan)+b'\n'),
        'journalClosureSha256':sha(canonical(journal_closed)+b'\n'),
        'observedMainPages':profile['bound']['originalPages'],'observedMainBytes':profile['originalFiles']['']['bytes'],
        'maximumLogicalMainPages':bound['maximumLogicalMainPages'],'maximumLogicalMainBytes':bound['maximumLogicalMainBytes'],
        'logicalPageEnvelopeClosed':True,'mainFileLengthOrVfsPreallocationBounded':False,
        'continuousPeakMeasured':False,'statementOrSqlScratchBounded':False,'walGrowthBounded':False,
        'physicalFilesystemClosureClaimed':False,'completeWriterFilesystemReview':False}


def verify_capture_main(files,root):
    from kit_capture_budget import capture_ceiling
    require(MAIN_ORIGINALS<=set(files),'Every native MAIN control original is required')
    stages=exact_json(files['capture-stage-closures.json']);inputs=stages['budgetInputs']
    for label,site in MAIN_SITES.items():
        name=label+'-retained-temp/writer-main-admission.json';raw=files[name]
        schema_name=MAIN_SCHEMA[label];observation=exact_json(files[schema_name])
        original={'file':schema_name,'bytes':len(files[schema_name]),'sha256':sha(files[schema_name])}
        journal=exact_json(files[label+'-retained-temp/writer-journal-admission.json'])
        expected=main_plan_fields(label,observation,original,journal)
        require(raw==canonical(expected)+b'\n','Native MAIN full inventory/source/bound/control differs')
        closed=main_closure_fields(expected,exact_json(files[label+'-retained-temp/writer-journal-closure.json']))
        require(files[label+'-retained-temp/writer-main-closure.json']==canonical(closed)+b'\n',
            'Native MAIN closure or journal source chain differs')
        receipt={'site':site,'destination':str(pathlib.Path(root)/'scientific-database/dev.db'),
            'layout':expected['layout'],'maximumBytes':capture_ceiling(inputs['databaseAllocatedBytes'],inputs['assetsAllocatedBytes'],label,site),
            'beforeDestinationCreation':False,'beforeMainFileExtension':True,
            'stageTableSha256':stages['captureTableSha256'],'neverRetry':True,
            'sqliteTemporaryFilesAndGlobalFilesystemClosureClaimed':False,
            'mainFileLengthOrVfsPreallocationBounded':False}
        require(files[main_disk_original(label)]==canonical(receipt)+b'\n' and
            expected['layout']['declaredAllocationBytes']<=receipt['maximumBytes'],
            'Native MAIN separately held before-extension capacity differs')
    return {'allSixNativeMainOriginalsReplayed':True,'logicalGrowthEnvelopeOnly':True,
        'mainFileLengthOrVfsPreallocationBounded':False,'physicalFilesystemClosureClaimed':False}
