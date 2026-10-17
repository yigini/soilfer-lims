"""LOCAL native clone/Apache files; provider, host, physical and CLI stand-ins."""
import contextlib
import copy
import os
import types
import unittest
from unittest.mock import patch
import kit_capture_review as review
import kit_apache_capture as apache
import kit_capture_science as science
from kit_contract import canonical,sha,IMAGE_BYTES
from kit_capture_budget import CaptureBudget,CaptureDisk,CAPTURE_TABLE,CAPTURE_TABLE_SHA
from kit_capture_owned import CAPTURE_ROOT,CAPTURE_UNIT
from kit_frozen import source_review
from kit_provider import GitHubProvider
from kit_disk import ALLOCATION,BOUND
from kit_capture_journal import CAPTURE_JOURNAL_SITES,caller_proof,journal_disk_original,JOURNAL_DB_COST
from kit_capture_journal_package import journal_profile
from retained_contract import ROOT,exact_json
from verify_kit_capture_science import controller_fixture
from verify_kit_authority import provider_fixture
import verify_kit_consumers as consumers
import verify_kit_apache_capture as apache_fixtures


def physical(required,label='SYNTHETIC LOCAL PHYSICAL STAND-IN',number=0):
    return {'label':label,'allocations':{p:{'bytes':4096*number,'device':7} for p in ALLOCATION},
        'devices':{p:7 for p in BOUND},'free':{p:10**12-4096*number*3 for p in BOUND},
        'requiredBytes':required,'verifiedOverlayViewsBefore':[],'verifiedOverlayViewsAfter':[],
        'overlayViewsCreditedBytes':0,'singleFilesystemDu':True,'hardlinksCountedOnce':True,
        'allRetainedReleaseRootsIncluded':True,'command':{'SYNTHETIC_LOCAL_NOT_HOST':True}}


def synthetic_journal_originals(files,budget):
    """Explicit synthetic headers/identities for pure package negative tests."""
    import stat
    target=CAPTURE_ROOT/'scientific-database/dev.db';directory=[7,102];inode=103
    def profile(pages,digest):
        header=bytearray(100);header[:16]=b'SQLite format 3\0';header[16:18]=(4096).to_bytes(2,'big')
        header[18:20]=bytes([1,1]);header[21:24]=bytes([64,32,32]);header[56:60]=(1).to_bytes(4,'big');header[24:28]=(pages).to_bytes(4,'big')
        header[28:32]=(pages).to_bytes(4,'big');header[92:96]=header[24:28]
        row={'sha256':digest*64,'bytes':pages*4096,'device':7,'inode':inode,
            'mtimeNs':pages,'mode':0o600,'allocatedBytes':pages*4096}
        return journal_profile({'headerHex':header.hex(),'originalFiles':{'':row,'-wal':None,'-shm':None}},target)
    before=profile(128,'a');initial=exact_json(files['capture-clone-provenance.json'])
    initial['initialCloneIdentity']={'databaseDirectoryIdentity':directory,
        'files':{'dev.db':[7,inode,128*4096,128,128,stat.S_IFREG|0o600,1],'dev.db-wal':None,'dev.db-shm':None}}
    files['capture-clone-provenance.json']=canonical(initial)+b'\n'
    for ordinal,(label,site) in enumerate(CAPTURE_JOURNAL_SITES.items(),129):
        admission={**before,'version':2,'scope':'CAPTURE_MAIN_ROLLBACK_JOURNAL_ADMISSION','label':label,
            'callerProofSha256':caller_proof(),'directoryIdentity':directory,'containerSource':'/app/server/prisma/dev.db',
            'writerGraphAdmissionImplemented':True,'completeWriterFilesystemReview':False}
        name=label+'-retained-temp/writer-journal-admission.json';files[name]=canonical(admission)+b'\n'
        after=profile(ordinal,'b' if ordinal==129 else 'c')
        closed={'version':2,'label':label,'admissionSha256':sha(files[name]),'afterProfile':after,
            'maximumJournalBytes':admission['bound']['maximumJournalBytes'],'journalAbsentAfterChildClose':True,
            'mainInodePreserved':True,'journalOriginalBytesRetained':False,'continuousPeakMeasured':False,
            'mainDatabaseGrowthBounded':False,'statementOrSqlScratchBounded':False,
            'physicalFilesystemClosureClaimed':False,'completeWriterFilesystemReview':False}
        files[label+'-retained-temp/writer-journal-closure.json']=canonical(closed)+b'\n'
        reservation={'site':site,'destination':str(target)+'-journal','layout':admission['layout'],
            'maximumBytes':__import__('kit_capture_budget').capture_ceiling(budget.db,budget.assets,label,site),'beforeDestinationCreation':True,
            'stageTableSha256':CAPTURE_TABLE_SHA,'neverRetry':True,
            'sqliteTemporaryFilesAndGlobalFilesystemClosureClaimed':False}
        files[journal_disk_original(label)]=canonical(reservation)+b'\n';before=after
    impact=exact_json(files['actual-impact-209.json']);impact['originalDbWalShmSha256']=before['sourceDbWalShm']
    impact['readonlySnapshot']['originalDbWalShmSha256']=before['sourceDbWalShm']
    files['actual-impact-209.json']=canonical(impact)+b'\n'
    science_value=exact_json(files['actual-scientific-impact.json'])
    science_value['originalReferences']['209'].update(sha256=sha(files['actual-impact-209.json']),bytes=len(files['actual-impact-209.json']))
    files['actual-scientific-impact.json']=canonical(science_value)+b'\n'

    from kit_schema_collection import schema_observation
    snapshot=exact_json(files['capture-snapshot-provenance.json'])
    snapshot['backup']={'bytes':128*4096,'sha256':'a'*64}
    initial['initialCloneByteIdentity']={'':snapshot['backup'],'-wal':None,'-shm':None}
    triple={'':snapshot['backup'],'-wal':None,'-shm':None}
    snapshot['rawTripleByteIdentity']=triple
    observations={}
    for issue,label,source_bytes in [('initial','fresh-production-snapshot',triple),
        *[(i,'capture-prepared-'+i,exact_json(files['capture-'+i+'-prepare-retained-temp/writer-journal-closure.json'])['afterProfile']['sourceDbWalShm']) for i in ('206','214')]]:
        # This is deliberately synthetic package evidence, not a native collector run.
        from kit_capture_native_inventory import RECEIPT_SQL,RECEIPT_INDEX
        rows=[['table','_schema_migrations','_schema_migrations',2,RECEIPT_SQL],
            ['index',RECEIPT_INDEX,'_schema_migrations',3,None],
            ['table','WorkAttempt','WorkAttempt',4,'CREATE TABLE WorkAttempt(id TEXT)']]
        rows += [['table','t'+str(n),'t'+str(n),5+n,'CREATE TABLE t'+str(n)+'(id TEXT)'] for n in range(104)]
        if issue!='initial':
            rows += [['table',name,name,109+n,'CREATE TABLE '+name+'(id TEXT)'] for n,name in enumerate(('SampleContainer','ContainerSequence'))]
        if issue=='214':
            rows += [['table',name,name,111+n,'CREATE TABLE '+name+'(id TEXT)'] for n,name in enumerate(('ControlLimitProposal','ControlLimitSet','QcReviewObligation','QcReviewResolution'))]
        schema={'version':1,'scope':'DECLARED_COMPLETE_SQLITE_SCHEMA','encoding':1,'rows':rows}
        observed=schema_observation(label,schema,{'syntheticLogicalState':issue},
            source_bytes,source_bytes,source_bytes,source_bytes,source_bytes[''])
        name='capture-schema-'+issue+'.json';files[name]=canonical(observed)+b'\n'
        observations[issue]=observed
        pin={'bytes':len(files[name]),'sha256':sha(files[name])}
        if issue=='initial':snapshot.update(fullSchemaOriginal=pin,logicalState=observed['logicalStateOriginal'])
        else:
            preservation=exact_json(files['capture-'+issue+'-preservation.json'])
            preservation.update(fullSchemaOriginal=pin,logicalStateOriginal=observed['logicalStateOriginal'])
            files['capture-'+issue+'-preservation.json']=canonical(preservation)+b'\n'
            science_value['preparationReferences'][issue]['preservation'].update(
                bytes=len(files['capture-'+issue+'-preservation.json']),sha256=sha(files['capture-'+issue+'-preservation.json']))
    files['actual-scientific-impact.json']=canonical(science_value)+b'\n'
    files['capture-snapshot-provenance.json']=canonical(snapshot)+b'\n'
    initial['snapshotProvenance']={'bytes':len(files['capture-snapshot-provenance.json']),
        'sha256':sha(files['capture-snapshot-provenance.json'])}
    files['capture-clone-provenance.json']=canonical(initial)+b'\n'

    from kit_capture_main import MAIN_SITES,MAIN_SCHEMA,main_disk_original,main_plan_fields,main_closure_fields
    from kit_capture_budget import capture_ceiling
    for label,site in MAIN_SITES.items():
        original_name=MAIN_SCHEMA[label];observation=exact_json(files[original_name])
        original={'file':original_name,'bytes':len(files[original_name]),'sha256':sha(files[original_name])}
        journal=exact_json(files[label+'-retained-temp/writer-journal-admission.json'])
        main=main_plan_fields(label,observation,original,journal)
        files[label+'-retained-temp/writer-main-admission.json']=canonical(main)+b'\n'
        closed=main_closure_fields(main,exact_json(files[label+'-retained-temp/writer-journal-closure.json']))
        files[label+'-retained-temp/writer-main-closure.json']=canonical(closed)+b'\n'
        reservation={'site':site,'destination':str(target),'layout':main['layout'],
            'maximumBytes':capture_ceiling(budget.db,budget.assets,label,site),'beforeDestinationCreation':False,
            'beforeMainFileExtension':True,'stageTableSha256':CAPTURE_TABLE_SHA,'neverRetry':True,
            'sqliteTemporaryFilesAndGlobalFilesystemClosureClaimed':False,'mainFileLengthOrVfsPreallocationBounded':False}
        files[main_disk_original(label)]=canonical(reservation)+b'\n'
        from kit_capture_statement import statement_plan_fields,statement_closure_fields,statement_disk_fields,statement_disk_original,STATEMENT_SITES
        statement=statement_plan_fields(label,main,journal)
        files[label+'-retained-temp/writer-statement-admission.json']=canonical(statement)+b'\n'
        statement_closed=statement_closure_fields(statement,closed,exact_json(files[label+'-retained-temp/writer-journal-closure.json']))
        files[label+'-retained-temp/writer-statement-closure.json']=canonical(statement_closed)+b'\n'
        ceiling=capture_ceiling(budget.db,budget.assets,label,STATEMENT_SITES[label])
        files[statement_disk_original(label)]=canonical(statement_disk_fields(CAPTURE_ROOT,label,statement,ceiling,CAPTURE_TABLE_SHA))+b'\n'


def synthetic_capture_payload(files,index,source):
    """Explicit synthetic future receipt for package tests; never operational."""
    runner,_=provider_fixture();runner.records['issues/comments/'+str(source['id'])]=source
    runner.records['issues/162/comments?per_page=100']=[[source]]
    fresh=GitHubProvider(runner,'synthetic-review-package').source_snapshot(source['id'])
    files['capture-primary-snapshot.json']=canonical(fresh)+b'\n'
    binding=source_review(source,index)
    authority={'root':CAPTURE_ROOT.as_posix(),'unit':CAPTURE_UNIT,'sourceBinding':binding,
        'captureTableSha256':CAPTURE_TABLE_SHA,'freshProviderSnapshotSha256':sha(canonical(fresh)),
        'primarySnapshotOriginal':{'file':'capture-primary-snapshot.json','sha256':sha(files['capture-primary-snapshot.json']),
            'bytes':len(files['capture-primary-snapshot.json'])},'readOnlyFreshAuthority':True,
        'releaseGateConsumed':False,'neverRetry':True}
    files['capture-fresh-authority.json']=canonical(authority)+b'\n'
    snapshot={'root':CAPTURE_ROOT.as_posix(),'sourceBinding':binding,'captureTableSha256':CAPTURE_TABLE_SHA,
        'releaseRoot':str(ROOT),'unit':CAPTURE_UNIT,'head':review.HEAD,'image':review.IMAGE,
        'databaseAssetsCrossFileAtomicityClaimed':False,'physicalFilesystemClosureClaimed':False,
        'tableCount':106,'schemaReceiptCount':39,'productionSqliteConnections':0,
        'rawMasterNeverOpenedSqlite':True,'neverRetry':True,'backup':{'sha256':'a'*64,'bytes':4096}}
    files['capture-snapshot-provenance.json']=canonical(snapshot)+b'\n'
    clone={'root':CAPTURE_ROOT.as_posix(),'sourceBinding':binding,'captureTableSha256':CAPTURE_TABLE_SHA,
        'rawMastersNeverOpenedSqlite':True,'neverRetry':True,'createdFromDetachedBackup':True,
        'snapshotProvenance':{'sha256':sha(files['capture-snapshot-provenance.json']),
            'bytes':len(files['capture-snapshot-provenance.json'])},
        'initialCloneByteIdentity':{'':snapshot['backup'],'-wal':None,'-shm':None}}
    files['capture-clone-provenance.json']=canonical(clone)+b'\n'
    files['capture-integrity-original.json']=canonical(science.EXPECTED)+b'\n'
    files['capture-canonical-policy-original.json']=canonical({'classification':'PRESENT','shape':'CANONICAL',
        'mode':'NO_OP','totalChanges':0,'dataWrites':0,'readonlySnapshot':{'originalFilesPreserved':True}})+b'\n'
    budget=CaptureBudget(16*1024**2,1024**2,IMAGE_BYTES);rows=[];before=physical(budget.required())
    for n,declared in enumerate(CAPTURE_TABLE,1):
        budget.begin(declared['stage'],10**12)
        for site,count in declared['sites'].items():
            for _ in range(count):budget.claim(site);budget.copy_ceiling(site)
        after=physical(budget.required(),number=n)
        closure=budget.finish(declared['stage'],4096*3)
        rows.append({'closure':closure,'before':before,'after':after});before=after
    record={'root':CAPTURE_ROOT.as_posix(),'unit':CAPTURE_UNIT,'captureTableSha256':CAPTURE_TABLE_SHA,
        'budgetInputs':{'databaseAllocatedBytes':budget.db,'assetsAllocatedBytes':budget.assets,'imageBytes':budget.image},
        'stages':rows}
    files['capture-stage-closures.json']=canonical(record)+b'\n'
    files['capture-final-physical.json']=canonical(physical(budget.required(),'capture-review-complete',9))+b'\n'
    synthetic_journal_originals(files,budget)
    inventory=exact_json(files['consumer-inventory.json'])
    inventory.update(collectionIsNotAnAtomicHostSnapshot=True,noConsumerVerdict=None,
        passObservations=[{'compiledCaptureControllerObserved':True,'timerNames':inventory['activeTimerNames'],
            'commands':inventory['observedProcessCommandSha256']} for _ in range(2)])
    files['consumer-inventory.json']=canonical(inventory)+b'\n'
    pins={name:{'sha256':sha(files[name]),'bytes':len(files[name])} for name in review.CAPTURE_REVIEW_FILES}
    science_value=exact_json(files['actual-scientific-impact.json'])
    receipt={'version':2,'status':'REVIEW_CAPTURE_CONTENT_COMPLETE','root':CAPTURE_ROOT.as_posix(),'releaseRoot':str(ROOT),
        'unit':CAPTURE_UNIT,'head':review.HEAD,'image':review.IMAGE,'captureTableSha256':CAPTURE_TABLE_SHA,
        'sourceBinding':binding,'sourceReviewId':source['id'],'productionSqliteConnections':0,
        'releaseGateConsumed':False,'releaseAuthorityGranted':False,'physicalFilesystemClosureClaimed':False,
        'neverRetry':True,'files':pins,'scienceSha256':sha(canonical(science_value)),
        'apacheCaptureSha256':pins['apache-capture.json']['sha256'],
        'consumerConfigurationSha256':inventory['configurationSha256']}
    files['capture-receipt.json']=canonical(receipt)+b'\n'
    return receipt


class CaptureRunner(consumers.Runner):
    def __init__(self,root,drift=False):super().__init__();self.root=root;self.drift=drift
    def run(self,argv,label,timeout):
        raw,err,metadata=super().run(argv,label,timeout)
        if 'list-units' in argv:raw+=(CAPTURE_UNIT+' loaded active running LOCAL capture stand-in\n').encode()
        if 'show' in argv and argv[2]==CAPTURE_UNIT:
            value=consumers.behavior(CAPTURE_UNIT);value['Transient']='yes'
            value['ExecStart']=consumers.exec_record('/usr/bin/python3 -B '+str(self.root/'tooling/capture_controller_output.py')+' --root '+str(self.root))
            value['ExecStopPost']=consumers.exec_record('/usr/bin/python3 -B '+str(self.root/'tooling/capture_stop_post.py'))
            raw=consumers.show_bytes(value)
        if self.drift and 'pass-2-' in label and 'cat' in argv:raw+=b'# changed consumer definition\n'
        return raw,err,metadata


@contextlib.contextmanager
def review_fixture(drift=False):
    with controller_fixture() as current,contextlib.ExitStack() as stack:
        stack.enter_context(patch.object(review,'CAPTURE_ROOT',current.root))
        stack.enter_context(patch.object(review,'sync_capture_tree',lambda root:None))
        source=current.base/'new-synthetic-apache.conf';source.write_bytes(apache_fixtures.original())
        stack.enter_context(patch.object(apache,'CONF',source.as_posix()))
        stack.enter_context(patch.object(apache,'attributes',lambda *args:{}))
        if os.name!='posix':stack.enter_context(patch.object(apache,'metadata',apache_fixtures.local_metadata))
        current.reader.inventory=consumers.Reader().inventory
        current.disk.last=physical(current.budget.required())
        current.disk.number=0
        def sample(label):
            current.disk.number+=1
            result=physical(current.budget.required(),label,current.disk.number)
            current.disk.last=result;return result
        current.disk.sample=sample
        current.disk.finish=types.MethodType(CaptureDisk.finish,current.disk)
        runner=CaptureRunner(current.root,drift)
        current.review_controller=review.CaptureReview(current.root,current.index,current.review,current.authority,
            current.disk,current.reader,current.cli,current.controller.journal,current.writers,
            consumer_runner=runner,cron_reader=lambda **kwargs:{},apache_production=False,apache_source=source)
        current.apache_source=source;current.consumer_runner=runner
        yield current


class CaptureReviewIntegration(unittest.TestCase):
    def test_native_local_composition_closes_both_consumer_passes_and_all_bound_originals(self):
        with review_fixture() as current:
            original=current.apache_source.read_bytes();receipt=current.review_controller.execute()
            self.assertEqual(receipt['status'],'REVIEW_CAPTURE_CONTENT_COMPLETE')
            self.assertEqual(current.apache_source.read_bytes(),original)
            review.verify_capture_receipt(receipt,lambda n:(current.root/n).read_bytes(),current.index,current.review)
            self.assertEqual(set(receipt['files']),review.CAPTURE_REVIEW_FILES)
            self.assertGreater((current.root/'capture-primary-snapshot.json').stat().st_size,8192)
            self.assertEqual(current.budget.completed,8);self.assertEqual(current.disk.number,9)
            inventory=exact_json((current.root/'consumer-inventory.json').read_bytes())
            self.assertTrue(all(p['compiledCaptureControllerObserved'] for p in inventory['passObservations']))
            self.assertIsNone(inventory['noConsumerVerdict']);self.assertFalse(receipt['releaseAuthorityGranted'])
            with self.assertRaises(RuntimeError):current.review_controller.execute()

    def test_consumer_drift_retains_full_impact_and_consumed_last_stage_without_receipt(self):
        with review_fixture(True) as current:
            with self.assertRaisesRegex(RuntimeError,'configuration changed'):current.review_controller.execute()
            self.assertTrue((current.root/'actual-impact-209.json').exists())
            self.assertEqual(current.budget.completed,7);self.assertEqual(current.budget.active,'capture-order-impact')
            self.assertFalse((current.root/'capture-receipt.json').exists())
            with self.assertRaises(RuntimeError):current.review_controller.execute()

    def test_unknown_apache_refuses_before_production_snapshot_and_keeps_read_intent(self):
        with review_fixture() as current:
            current.apache_source.write_bytes(apache_fixtures.original()+b'Include /unknown\n')
            with self.assertRaises(RuntimeError):current.review_controller.execute()
            self.assertTrue((current.root/'apache-capture-intent.json').exists())
            self.assertEqual((current.root/'ingress-original.conf').read_bytes(),current.apache_source.read_bytes())
            self.assertFalse((current.root/'ingress-held.conf').exists())
            self.assertEqual(current.observations,[]);self.assertEqual(current.cli.labels,[])
            self.assertFalse((current.root/'capture-snapshot-intent.json').exists())

    def test_recomputed_hashes_cannot_hide_changed_primary_stage_consumer_or_provenance(self):
        with review_fixture() as current:
            receipt=current.review_controller.execute()
            baseline={n:(current.root/n).read_bytes() for n in receipt['files']}
            for name in ('capture-primary-snapshot.json','capture-stage-closures.json','consumer-inventory.json',
                'capture-clone-provenance.json','apache-capture.json','capture-integrity-original.json',
                'capture-canonical-policy-original.json'):
                with self.subTest(name=name):
                    files=dict(baseline);value=exact_json(files[name]);changed=copy.deepcopy(receipt)
                    if name=='capture-primary-snapshot.json':value['main']['object']['sha']='f'*40
                    elif name=='capture-stage-closures.json':value['stages'].pop()
                    elif name=='consumer-inventory.json':value['passObservations'][1]['compiledCaptureControllerObserved']=False
                    elif name=='capture-clone-provenance.json':value['createdFromDetachedBackup']=False
                    elif name=='capture-integrity-original.json':value['injectedUnexpected']=True
                    elif name=='capture-canonical-policy-original.json':value['totalChanges']=1
                    else:value['configurationInstalled']=True
                    files[name]=canonical(value)+b'\n';changed['files'][name]={'sha256':sha(files[name]),'bytes':len(files[name])}
                    with self.assertRaises((RuntimeError,KeyError)):
                        review.verify_capture_receipt(changed,lambda n:files[n],current.index,current.review)

    def test_missing_original_and_boolean_physical_growth_never_close_receipt(self):
        with review_fixture() as current:
            receipt=current.review_controller.execute();files={n:(current.root/n).read_bytes() for n in receipt['files']}
            changed=copy.deepcopy(receipt);del changed['files']['capture-206-preservation.json']
            with self.assertRaises(RuntimeError):review.verify_capture_receipt(changed,lambda n:files[n],current.index,current.review)
            original_files=dict(files)
            value=exact_json(files['capture-stage-closures.json']);value['stages'][0]['after']['allocations'][ALLOCATION[0]]['bytes']=True
            files['capture-stage-closures.json']=canonical(value)+b'\n';changed=copy.deepcopy(receipt)
            changed['files']['capture-stage-closures.json']={'sha256':sha(files['capture-stage-closures.json']),
                'bytes':len(files['capture-stage-closures.json'])}
            with self.assertRaises(RuntimeError):review.verify_capture_receipt(changed,lambda n:files[n],current.index,current.review)
            # Python equates True and1; exact canonical JSON must not equate
            # a boolean with an admitted source-copy claim count.
            files=original_files;value=exact_json(files['capture-stage-closures.json'])
            value['stages'][0]['closure']['claims']['backup']=True
            files['capture-stage-closures.json']=canonical(value)+b'\n';changed=copy.deepcopy(receipt)
            changed['files']['capture-stage-closures.json']={'sha256':sha(files['capture-stage-closures.json']),
                'bytes':len(files['capture-stage-closures.json'])}
            with self.assertRaises(RuntimeError):review.verify_capture_receipt(changed,lambda n:files[n],current.index,current.review)

    def test_lost_receipt_return_after_immutable_write_never_permits_resume(self):
        with review_fixture() as current:
            retain=review.retain_capture_original
            def lost(root,name,raw,sync):
                result=retain(root,name,raw,sync)
                if name=='capture-receipt.json':raise RuntimeError('LOCAL lost return after immutable receipt commit')
                return result
            with patch.object(review,'retain_capture_original',lost):
                with self.assertRaisesRegex(RuntimeError,'lost return'):current.review_controller.execute()
            self.assertTrue((current.root/'capture-receipt.json').exists())
            labels=list(current.cli.labels)
            with self.assertRaises(RuntimeError):current.review_controller.execute()
            self.assertEqual(current.cli.labels,labels)
            receipt=exact_json((current.root/'capture-receipt.json').read_bytes())
            self.assertFalse(receipt['releaseAuthorityGranted']);self.assertFalse(receipt['releaseGateConsumed'])


if __name__=='__main__':unittest.main()
