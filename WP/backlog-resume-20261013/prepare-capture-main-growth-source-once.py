from pathlib import Path
import subprocess
w=Path(r'C:/Users/yigin/.codex/worktrees/audit-qc-integration/soilfer-lims');k=w/'WP/batch-release-kit-be837974-20261016'
assert subprocess.check_output(['git','rev-parse','HEAD'],cwd=w,text=True).strip()=='eb533383d367a77b96f2b09b59deb1e6c286799e'
assert not (k/'kit_capture_main.py').exists()
def replace(name,old,new):
 p=k/name;s=p.read_text(encoding='utf8');assert s.count(old)==1,(name,old[:100]);p.write_text(s.replace(old,new),encoding='utf8',newline='')
(k/'kit_capture_main.py').write_text('''"""Held logical MAIN growth for the two strict PRE capture writers only.

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
    return 'copy-admission-'+sha((MAIN_SITES[label]+'\\0scientific-database/dev.db').encode())[:32]+'.json'


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
            'bytes':len(canonical(observation))+1,'sha256':sha(canonical(observation)+b'\\n')}),
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
    inventory=capture_native_inventory(label,observation['schema'])
    bound=mutation_growth_bound(header,profile['originalFiles']['']['bytes'],inventory['operations'])
    require(bound['maximumLogicalGrowthBytes']<=MAIN_GROWTH_MAX[label],
        'Complete native growth exceeds its held static envelope; never clip')
    result={'version':1,'scope':'CAPTURE_NATIVE_MAIN_LOGICAL_GROWTH_ADMISSION','label':label,
        'schemaOriginal':original,'schemaSha256':observation['schemaSha256'],
        'collectorProofSha256':collection_proof(),'nativeMainProofSha256':main_source_proof(),
        'nativeInventoryProofSha256':inventory['sourceProofSha256'],
        'journalAdmissionSha256':sha(canonical(journal)+b'\\n'),
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
    observation=exact_json(raw);require(raw==canonical(observation)+b'\\n','Canonical full schema original required')
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
    after=journal_closed['afterProfile'];profile=journal_profile(after,pathlib.Path(after['source']))
    bound=plan['bound']
    require(profile['bound']['pageSize']==bound['pageSize'] and
        profile['bound']['originalPages']<=bound['maximumLogicalMainPages'] and
        profile['originalFiles']['']['bytes']<=bound['maximumLogicalMainBytes'],
        'Post-child MAIN exceeds its admitted logical page envelope')
    return {'version':1,'label':plan['label'],'admissionSha256':sha(canonical(plan)+b'\\n'),
        'journalClosureSha256':sha(canonical(journal_closed)+b'\\n'),
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
        require(raw==canonical(expected)+b'\\n','Native MAIN full inventory/source/bound/control differs')
        closed=main_closure_fields(expected,exact_json(files[label+'-retained-temp/writer-journal-closure.json']))
        require(files[label+'-retained-temp/writer-main-closure.json']==canonical(closed)+b'\\n',
            'Native MAIN closure or journal source chain differs')
        receipt={'site':site,'destination':str(pathlib.Path(root)/'scientific-database/dev.db'),
            'layout':expected['layout'],'maximumBytes':capture_ceiling(inputs['databaseAllocatedBytes'],inputs['assetsAllocatedBytes'],label,site),
            'beforeDestinationCreation':False,'beforeMainFileExtension':True,
            'stageTableSha256':stages['captureTableSha256'],'neverRetry':True,
            'sqliteTemporaryFilesAndGlobalFilesystemClosureClaimed':False,
            'mainFileLengthOrVfsPreallocationBounded':False}
        require(files[main_disk_original(label)]==canonical(receipt)+b'\\n' and
            expected['layout']['declaredAllocationBytes']<=receipt['maximumBytes'],
            'Native MAIN separately held before-extension capacity differs')
    return {'allSixNativeMainOriginalsReplayed':True,'logicalGrowthEnvelopeOnly':True,
        'mainFileLengthOrVfsPreallocationBounded':False,'physicalFilesystemClosureClaimed':False}
''',encoding='utf8',newline='')
replace('kit_owned.py','writer_journal_sites=None):','writer_journal_sites=None,writer_main_sites=None):')
replace('kit_owned.py','    writer_admissions={};writer_closed=set();writer_attempted=set();writer_controls={}',
 '    writer_admissions={};writer_closed=set();writer_attempted=set();writer_controls={}\n    main_admissions={};main_attempted=set();main_controls={};journal_results={}')
replace('kit_owned.py','        p.mkdir(mode=0o700)\n        require(not list(p.iterdir())', '''        main_plan=None
        if writer_main_sites and spec['label'] in writer_main_sites:
            from kit_capture_main import capture_main_plan,recheck_capture_main
            require(writer_plan is not None and disk is not None and callable(no_writers),
                'Native MAIN requires its exact journal source and held capacity')
            main_controls[spec['label']]={}
            for name in ('writer-main-admission.json','writer-main-closure.json'):
                held=admit_evidence(p/name,8192,pending=True,reservation=True,future_directory=p)
                require(held is not None,'Native MAIN controls require held ledger tickets before mkdir')
                main_controls[spec['label']][name]=held
            no_writers();main_plan=capture_main_plan(spec,writer_plan)
            disk.admit_copy(writer_main_sites[spec['label']],pathlib.Path(writer_plan['source']),main_plan['layout'])
            no_writers();recheck_capture_main(main_plan,spec,writer_plan)
        p.mkdir(mode=0o700)
        require(not list(p.iterdir())''')
replace('kit_owned.py',"            writer_admissions[spec['label']]=writer_plan", "            writer_admissions[spec['label']]=writer_plan\n        if main_plan is not None:\n            exclusive_record(p,'writer-main-admission.json',main_plan,require_directory_sync,\n                held_admission=main_controls[spec['label']]['writer-main-admission.json'])\n            main_admissions[spec['label']]=main_plan")
replace('kit_owned.py','            writer_closed.add(label)\n', '''            writer_closed.add(label);journal_results[label]=result
        if label in main_admissions:
            from kit_capture_main import main_closure_fields
            require(label not in main_attempted,'Native MAIN closure is consumed')
            main_attempted.add(label)
            result=main_closure_fields(main_admissions[label],journal_results[label])
            exclusive_record(directory(spec),'writer-main-closure.json',result,require_directory_sync,
                held_admission=main_controls[label]['writer-main-closure.json'])
            del main_admissions[label]
''')
replace('kit_capture_owned.py',"    prepare,read,permit=control_callbacks(root,directory", "    from kit_capture_main import MAIN_SITES\n    prepare,read,permit=control_callbacks(root,directory")
replace('kit_capture_owned.py',"writer_journal_sites=CAPTURE_JOURNAL_SITES)","writer_journal_sites=CAPTURE_JOURNAL_SITES,writer_main_sites=MAIN_SITES)")
replace('kit_capture_budget.py','from kit_journal import exclusive_record','from kit_journal import exclusive_record\nfrom kit_capture_main import MAIN_SITES,MAIN_GROWTH_MAX,JOURNAL_214_GROWTH_EXTRA,main_disk_original\nfrom kit_copy_admission import copy_layout')
replace('kit_capture_budget.py',"'capture-214-main-journal':JOURNAL_DB_COST}","'capture-214-main-journal':JOURNAL_DB_COST,\n    'capture-206-native-main':0,'capture-214-native-main':0}")
replace('kit_capture_budget.py','CAPTURE_STAGES=(\n','''G206=MAIN_GROWTH_MAX['capture-206-prepare']
G214=MAIN_GROWTH_MAX['capture-214-prepare']
CAPTURE_EXTRA={
    'capture-206-prepare':{'triple':copy_layout([G206],0)['declaredAllocationBytes'],
        'backup':copy_layout([G206],0)['declaredAllocationBytes'],'reader-index':copy_layout([G206],0)['declaredAllocationBytes'],
        'capture-206-native-main':copy_layout([G206],0)['declaredAllocationBytes']},
    'capture-214-prepare':{'capture-214-snapshot':copy_layout([G206],0)['declaredAllocationBytes'],
        'triple':copy_layout([G206+G214],0)['declaredAllocationBytes'],
        'backup':copy_layout([G206+G214],0)['declaredAllocationBytes'],
        'reader-index':copy_layout([G206+G214],0)['declaredAllocationBytes'],
        'capture-214-native-main':copy_layout([G214],0)['declaredAllocationBytes'],
        'capture-214-main-journal':copy_layout([JOURNAL_214_GROWTH_EXTRA],0)['declaredAllocationBytes']},
    'capture-order-impact':{'capture-order-snapshots':2*copy_layout([G206+G214],0)['declaredAllocationBytes']}}


def capture_ceiling(database,assets,stage,site):
    if site=='seal-directory':return SEAL_DIRECTORY_BYTES
    base=assets if site=='assets' else (database*CAPTURE_DB_COST[site]*125+99)//100
    extra=CAPTURE_EXTRA.get(stage,{}).get(site,0)
    return base+(extra*125+99)//100


CAPTURE_STAGES=(
''')
replace('kit_capture_budget.py',"'capture-206-main-journal':1},SEAL_DIRECTORY_BYTES)","'capture-206-main-journal':1,'capture-206-native-main':1},SEAL_DIRECTORY_BYTES)")
replace('kit_capture_budget.py',"'capture-214-main-journal':1},SEAL_DIRECTORY_BYTES)","'capture-214-main-journal':1,'capture-214-native-main':1},SEAL_DIRECTORY_BYTES)")
replace('kit_capture_budget.py',"'assetCopies':sites.get('assets',0),'fixedBytes':fixed,", "'assetCopies':sites.get('assets',0),'fixedBytes':fixed+sum(count*CAPTURE_EXTRA.get(name,{}).get(site,0) for site,count in sites.items()),")
replace('kit_capture_budget.py',"        site=CAPTURE_JOURNAL_SITES.get(label)\n        if site is not None:self.claim(site)", "        site=CAPTURE_JOURNAL_SITES.get(label)\n        if site is not None:self.claim(site)\n        site=MAIN_SITES.get(label)\n        if site is not None:self.claim(site)")
replace('kit_capture_budget.py',"        if site=='seal-directory':return SEAL_DIRECTORY_BYTES\n        return self.assets if site=='assets' else (self.db*CAPTURE_DB_COST[site]*125+99)//100", "        return capture_ceiling(self.db,self.assets,self.active,site)")
replace('kit_capture_budget.py',"        if site in CAPTURE_JOURNAL_SITES.values():", "        if site in MAIN_SITES.values():\n            require(pathlib.Path(destination)==self.root/'scientific-database/dev.db','Native MAIN destination differs')\n            label=next(label for label,value in MAIN_SITES.items() if value==site)\n            exclusive_record(self.root,main_disk_original(label),{\n                'site':site,'destination':str(destination),'layout':plan,'maximumBytes':ceiling,\n                'beforeDestinationCreation':False,'beforeMainFileExtension':True,\n                'stageTableSha256':CAPTURE_TABLE_SHA,'neverRetry':True,\n                'sqliteTemporaryFilesAndGlobalFilesystemClosureClaimed':False,\n                'mainFileLengthOrVfsPreallocationBounded':False},self.sync)\n            return\n        if site in CAPTURE_JOURNAL_SITES.values():")
replace('kit_capture_review.py','from kit_schema_collection import SCHEMA_ORIGINALS','from kit_schema_collection import SCHEMA_ORIGINALS\nfrom kit_capture_main import MAIN_ORIGINALS')
replace('kit_capture_review.py','|JOURNAL_ORIGINALS|SCHEMA_ORIGINALS','|JOURNAL_ORIGINALS|SCHEMA_ORIGINALS|MAIN_ORIGINALS')
replace('kit_capture_review.py',"'capture-snapshot-provenance.json','capture-clone-provenance.json'))|JOURNAL_ORIGINALS", "'capture-snapshot-provenance.json','capture-clone-provenance.json'))|JOURNAL_ORIGINALS|MAIN_ORIGINALS")
replace('kit_capture_review.py','    verify_schema_originals(files)\n','    verify_schema_originals(files)\n    from kit_capture_main import verify_capture_main\n    verify_capture_main(files,CAPTURE_ROOT)\n')
replace('kit_capture_journal_package.py','        ceiling=(budget.db*794*125+99)//100',"        from kit_capture_budget import capture_ceiling\n        ceiling=capture_ceiling(budget.db,budget.assets,label,site)")
replace('kit_capture_launch.py',"        ('kit_capture_journal.py',['CAPTURE_JOURNAL_SITES','JOURNAL_DB_COST']),", "        ('kit_capture_journal.py',['CAPTURE_JOURNAL_SITES','JOURNAL_DB_COST']),\n        ('kit_capture_main.py',['MAIN_SITES','MAIN_GROWTH_MAX','JOURNAL_214_GROWTH_EXTRA']),")
replace('kit_capture_launch.py',"['CAPTURE_DB_COST','CAPTURE_APACHE_BYTES','CAPTURE_STAGES','CAPTURE_TABLE',", "['CAPTURE_DB_COST','CAPTURE_APACHE_BYTES','G206','G214','CAPTURE_EXTRA','capture_ceiling','CAPTURE_STAGES','CAPTURE_TABLE',")
replace('build_capture_stop_post.py',"    'kit_capture_budget.py':('CAPTURE_DB_COST','CAPTURE_APACHE_BYTES','CAPTURE_STAGES','CAPTURE_TABLE','CAPTURE_TABLE_SHA'),", "    'kit_copy_admission.py':('BLOCK','MAX_FILES','MAX_DIRECTORIES','MAX_CONTENT_BYTES','copy_layout'),\n    'kit_capture_main.py':('MAIN_SITES','MAIN_GROWTH_MAX','JOURNAL_214_GROWTH_EXTRA','main_disk_original','MAIN_ORIGINALS'),\n    'kit_capture_budget.py':('CAPTURE_DB_COST','CAPTURE_APACHE_BYTES','G206','G214','CAPTURE_EXTRA','CAPTURE_STAGES','CAPTURE_TABLE','CAPTURE_TABLE_SHA'),")
replace('kit_frozen.py',"    'kit_schema_collection.py'", "    'kit_capture_main.py','capture-native-main-source.json',\n    'kit_schema_collection.py'")
print('Prepared native MAIN source, controls, propagated budgets and package graph; no operators executed')