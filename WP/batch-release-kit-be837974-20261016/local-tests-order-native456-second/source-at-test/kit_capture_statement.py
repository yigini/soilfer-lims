"""Held conditional statement-journal CONTENT for strict PRE capture writers.

No transient journal bytes or peaks are observed here. Runtime routing, VFS,
physical allocation and full writer/filesystem qualification remain unclosed.
"""
import pathlib
from kit_contract import canonical,require,sha
from retained_contract import exact_json
from kit_copy_admission import copy_layout
from kit_statement_journal import CAPTURE_STATEMENTS,declared_statements,statement_journal_bound
from kit_capture_main import MAIN_GROWTH_MAX

STATEMENT_SITES={'capture-206-prepare':'capture-206-statement-journal',
    'capture-214-prepare':'capture-214-statement-journal'}
# P>=512: S*M*(1+4/P)<=ceil(S*129/128)*M. Extra prior/current
# growth is charged separately. Each file also gets a full extra 4096 for
# splitting base/extra rounding, in addition to copy_layout's entry allowance.
STATEMENT_DB_COST={label:(count*129+127)//128 for label,count in CAPTURE_STATEMENTS.items()}
STATEMENT_GROWTH={'capture-206-prepare':MAIN_GROWTH_MAX['capture-206-prepare'],
    'capture-214-prepare':sum(MAIN_GROWTH_MAX.values())}
STATEMENT_FIXED={label:copy_layout([((STATEMENT_GROWTH[label]*129+127)//128)]*count,0)
    ['declaredAllocationBytes']+count*4096 for label,count in CAPTURE_STATEMENTS.items()}
PROOF_NAME='capture-statement-journal-source.json'


def statement_disk_original(label):
    require(label in STATEMENT_SITES,'Exact capture statement writer required')
    return 'copy-admission-'+sha((STATEMENT_SITES[label]+'\0'+label+'-retained-temp').encode())[:32]+'.json'


STATEMENT_ORIGINALS=frozenset(name for label in STATEMENT_SITES for name in (
    label+'-retained-temp/writer-statement-admission.json',
    label+'-retained-temp/writer-statement-closure.json',statement_disk_original(label)))


def statement_source_proof():
    from retained_files import file_state
    here=pathlib.Path(__file__).resolve().parent;raw=(here/PROOF_NAME).read_bytes();value=exact_json(raw)
    require(value.get('scope')=='CAPTURE_STRICT_PRE_STATEMENT_JOURNAL_CONTENT_ADMISSION' and
        value.get('restrictedStatementSourceInventoryVerified') is True and
        value.get('statementJournalFileLengthOrVfsBounded') is False and
        value.get('physicalFilesystemClosureClaimed') is False and
        canonical(value.get('databaseCosts'))==canonical(STATEMENT_DB_COST) and
        canonical(value.get('fixedBytes'))==canonical(STATEMENT_FIXED),
        'Exact restricted statement content source proof required')
    for name,pin in value['files'].items():
        state=file_state(here/name)
        require(state is not None and canonical({q:state[q] for q in ('bytes','sha256')})==canonical(pin),
            'Statement content tooling/proof source changed: '+name)
    return sha(raw)


def statement_plan_fields(label,main,journal):
    from kit_capture_main import main_source_proof
    from kit_capture_journal_package import journal_profile
    require(label in STATEMENT_SITES and main.get('label')==journal.get('label')==label and
        main.get('scope')=='CAPTURE_NATIVE_MAIN_LOGICAL_GROWTH_ADMISSION' and
        main.get('nativeMainProofSha256')==main_source_proof() and
        main.get('journalAdmissionSha256')==sha(canonical(journal)+b'\n'),
        'Statement content requires its exact preceding MAIN and journal admissions')
    profile=journal_profile(journal,pathlib.Path(journal['source']))
    bound=statement_journal_bound(bytes.fromhex(profile['headerHex']),profile['originalFiles']['']['bytes'],
        main['operations'],declared_statements(CAPTURE_STATEMENTS[label]))
    require(canonical(bound['nativeMutationBound'])==canonical(main['bound']),
        'Statement and MAIN complete native page inventories differ')
    result={'version':1,'scope':'CAPTURE_STATEMENT_JOURNAL_CONTENT_ADMISSION','label':label,
        'statementAdmissionProofSha256':statement_source_proof(),
        'mainAdmissionSha256':sha(canonical(main)+b'\n'),
        'journalAdmissionSha256':sha(canonical(journal)+b'\n'),
        'schemaOriginal':main['schemaOriginal'],'collectorProofSha256':main['collectorProofSha256'],
        'bound':bound,'layout':bound['aggregateAllocationCharges'],
        'collectorSourceByteBindingVerified':True,'restrictedStatementSourceInventoryVerified':True,
        'conditionalStatementContentWriterAdmissionImplemented':True,
        'independentSchemaToPrivateDbBytesProof':False,'runtimeBinaryToSourceBindingVerified':False,
        'runtimeDefaultVfsVerified':False,'temporaryDirectoryRoutingVerified':False,
        'statementJournalFileLengthOrVfsBounded':False,'sqlScratchSizeBounded':False,
        'walGrowthBounded':False,'fullLifetimeOriginalsRetained':False,'continuousPeakMeasured':False,
        'physicalFilesystemClosureClaimed':False,'completeWriterFilesystemReview':False}
    require(len(canonical(result))+1<=8192,'Complete statement admission exceeds immutable envelope')
    return result


def capture_statement_plan(spec,journal,main):
    from kit_capture_main import capture_main_plan
    require(canonical(capture_main_plan(spec,journal))==canonical(main),
        'Statement content requires the current exact source-bound MAIN inventory')
    return statement_plan_fields(spec['label'],main,journal)


def recheck_capture_statement(plan,spec,journal,main):
    from kit_capture_main import recheck_capture_main
    recheck_capture_main(main,spec,journal)
    require(canonical(capture_statement_plan(spec,journal,main))==canonical(plan),
        'Statement source/native inventory changed before writer creation')


def statement_closure_fields(plan,main_closed,journal_closed):
    require(plan.get('scope')=='CAPTURE_STATEMENT_JOURNAL_CONTENT_ADMISSION' and
        plan.get('statementAdmissionProofSha256')==statement_source_proof() and
        main_closed.get('label')==journal_closed.get('label')==plan['label'] and
        main_closed.get('admissionSha256')==plan['mainAdmissionSha256'] and
        journal_closed.get('admissionSha256')==plan['journalAdmissionSha256'] and
        main_closed.get('journalClosureSha256')==sha(canonical(journal_closed)+b'\n') and
        main_closed.get('logicalPageEnvelopeClosed') is True,
        'Statement closure must follow BOTH exact journal and MAIN child closures')
    return {'version':1,'label':plan['label'],'admissionSha256':sha(canonical(plan)+b'\n'),
        'mainClosureSha256':sha(canonical(main_closed)+b'\n'),
        'journalClosureSha256':sha(canonical(journal_closed)+b'\n'),
        'maximumCumulativeLogicalContentBytes':plan['bound']['maximumCumulativeLogicalContentBytes'],
        'nativeChildClosed':True,'conditionalContentAdmissionClosed':True,
        'statementJournalBytesObserved':False,'temporaryDirectoryRoutingVerified':False,
        'statementJournalFileLengthOrVfsBounded':False,'sqlScratchSizeBounded':False,
        'fullLifetimeOriginalsRetained':False,'continuousPeakMeasured':False,
        'physicalFilesystemClosureClaimed':False,'completeWriterFilesystemReview':False}


def statement_disk_fields(root,label,plan,ceiling,table_sha):
    return {'site':STATEMENT_SITES[label],'destination':str(pathlib.Path(root)/(label+'-retained-temp')),
        'layout':plan['layout'],'maximumBytes':ceiling,'beforeDestinationCreation':True,
        'stageTableSha256':table_sha,'neverRetry':True,'conditionalContentAllowanceOnly':True,
        'temporaryDirectoryRoutingVerified':False,'statementJournalFileLengthOrVfsBounded':False,
        'sqliteTemporaryFilesAndGlobalFilesystemClosureClaimed':False}


def verify_capture_statements(files,root):
    from kit_capture_main import verify_capture_main
    from kit_capture_budget import capture_ceiling
    verify_capture_main(files,root)
    require(STATEMENT_ORIGINALS<=set(files),'Every statement content original required')
    stages=exact_json(files['capture-stage-closures.json']);inputs=stages['budgetInputs']
    for label,site in STATEMENT_SITES.items():
        prefix=label+'-retained-temp/'
        main=exact_json(files[prefix+'writer-main-admission.json'])
        journal=exact_json(files[prefix+'writer-journal-admission.json'])
        expected=statement_plan_fields(label,main,journal)
        require(files[prefix+'writer-statement-admission.json']==canonical(expected)+b'\n',
            'Statement full source/native/SQL bound differs')
        closed=statement_closure_fields(expected,exact_json(files[prefix+'writer-main-closure.json']),
            exact_json(files[prefix+'writer-journal-closure.json']))
        require(files[prefix+'writer-statement-closure.json']==canonical(closed)+b'\n',
            'Statement child closure/source chain differs')
        ceiling=capture_ceiling(inputs['databaseAllocatedBytes'],inputs['assetsAllocatedBytes'],label,site)
        receipt=statement_disk_fields(root,label,expected,ceiling,stages['captureTableSha256'])
        require(files[statement_disk_original(label)]==canonical(receipt)+b'\n' and
            expected['layout']['declaredAllocationBytes']<=ceiling,'Statement separately held capacity differs')
    return {'allSixStatementOriginalsReplayed':True,'conditionalLogicalContentOnly':True,
        'statementJournalFileLengthOrVfsBounded':False,'fullLifetimeOriginalsRetained':False,
        'physicalFilesystemClosureClaimed':False}
