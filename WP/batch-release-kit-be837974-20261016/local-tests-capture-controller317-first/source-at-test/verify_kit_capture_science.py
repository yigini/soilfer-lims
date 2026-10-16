"""Native LOCAL SQLite preservation; scientific CLIs and host boundaries are stand-ins."""
import contextlib
import copy
import json
import pathlib
import shutil
import sqlite3
import types
import unittest
from unittest.mock import patch
import kit_capture_science as science
import kit_capture_authority as authority
import kit_capture_owned as owned
from kit_capture_owned import CaptureOwnedCli,CAPTURE_COPY_SITES,CAPTURE_SNAPSHOTS
from kit_capture_budget import CAPTURE_TABLE
from kit_contract import canonical,sha
from kit_install import CHAIN
from kit_journal import Journal
from kit_provider import GitHubProvider
from kit_science import verify_scientific_originals,validate_scientific_capture
from kit_app_snapshots import snapshot_plan
from retained_files import triple,identity_record,file_state
from verify_kit_capture_copy import fixture
from verify_kit_authority import provider_fixture
import verify_kit_authority as authority_fixtures


class NativeCloneStandIn(CaptureOwnedCli):
    """Real clone SQL/copies; never the application owner, Docker or kernel."""
    def __init__(self,current):self.current=current;self.labels=[];self.fail=None
    def run(self,spec):
        owned.validate_capture_spec(spec);label=spec['label'];self.labels.append(label)
        current=self.current;target=current.root/'scientific-database/dev.db';tmp=current.root/(label+'-retained-temp')
        self.current.writers() # no real /proc access on this Windows fixture
        if label in CAPTURE_SNAPSHOTS:
            admission=snapshot_plan(target,CAPTURE_SNAPSHOTS[label])
            current.disk.admit_copy(CAPTURE_COPY_SITES[label],tmp,admission['layout'])
            tmp.mkdir();copies=[]
            for n in range(CAPTURE_SNAPSHOTS[label]):
                directory=tmp/('lims-policy-schema-readonly-LOCAL'+str(n));directory.mkdir()
                destination=directory/'snapshot.db';shutil.copyfile(target,destination);copies.append(destination)
        if label in ('capture-206-prepare','capture-214-prepare'):
            issue=label.split('-')[1]
            with sqlite3.connect(target) as db:
                for table in sorted(CHAIN[issue][0]):db.execute('CREATE TABLE "'+table+'"(id TEXT PRIMARY KEY)')
                db.execute('INSERT INTO _schema_migrations VALUES(?)',(CHAIN[issue][1],))
                if self.fail=='old-row':db.execute("UPDATE t0 SET value='MUTATED OLD VALUE'")
                if self.fail=='nonempty':db.execute('INSERT INTO "'+sorted(CHAIN[issue][0])[0]+'" VALUES(?)',('new',))
                if self.fail=='foreign':db.execute('CREATE TABLE unexpected(id TEXT)')
            value={'classification':'COMPLETE_'+issue,'previousClassification':'PRE_'+issue,'mode':'APPLIED',
                'backfilledCount':1 if self.fail=='backfill' else 0,'totalChanges':1,'receipt':{'originalRowsPreserved':True}}
        elif label=='capture-integrity':value=science.EXPECTED
        elif label=='capture-canonical-policy':value={'classification':'PRESENT','shape':'CANONICAL','mode':'NO_OP',
            'totalChanges':0,'dataWrites':0,'readonlySnapshot':{'originalFilesPreserved':True}}
        elif label=='capture-chart-impact':value=authority_fixtures.Science().chart()
        elif label=='capture-order-impact':
            rows=[]
            for path in copies:
                state=file_state(path);relative=path.relative_to(tmp).as_posix()
                rows.append({'path':'/tmp/'+relative,**state})
            value={'access':'RETAINED_SNAPSHOT_ONLY','originalFilesPreserved':True,'productionMutations':0,
                'totalChanges':0,'backfilledCount':0,'sourceSha256':'a'*64,
                'originalDbWalShmSha256':identity_record(triple(target)),
                'readonlySnapshot':{'originalFilesPreserved':True,'path':rows[0]['path'],
                    'originalDbWalShmSha256':identity_record(triple(target))},
                'retainedAllocation':{'allocationMeasured':True,'conservativeAllocationBytes':sum(r['allocatedBytes'] for r in rows),
                    'files':rows,'logicalBytes':sum(r['bytes'] for r in rows),'root':'/tmp'},
                'impact':{'prospectiveApprovedAmendmentSampleCount':0,'invalidStoredAnalysisSampleCount':0,
                    'noActiveRevisionCount':0,'noMatchingLineCount':0,'invalidStoredAnalyses':[],
                    'approvedAmendmentSampleIds':[],'approvedAmendmentKitGate':'NO_APPROVED_AMENDMENT_REFUSALS',
                    'noActiveRevisionWorkItems':[],'noMatchingLineWorkItems':[],'refusedOpenWorkItems':[],
                    'refusalScope':['SYNTHETIC FULL FIELD RETAINED']}}
            if self.fail=='approved':
                value['impact'].update(prospectiveApprovedAmendmentSampleCount=1,approvedAmendmentSampleIds=['LOCAL_APPROVED'])
        else:raise AssertionError('Foreign scientific command')
        if self.fail=='readonly-change' and label=='capture-chart-impact':
            with sqlite3.connect(target) as db:db.execute("UPDATE t0 SET value='READONLY CHANGED'")
        return canonical(value)+b'\n',{'localNativeCloneStandIn':True,'actualScientificOwnerExecuted':False}


@contextlib.contextmanager
def controller_fixture():
    with fixture() as current,contextlib.ExitStack() as stack:
        for module in (science,authority):stack.enter_context(patch.object(module,'CAPTURE_ROOT',current.root))
        stack.enter_context(patch.object(science,'sync_capture_tree',lambda root:None))
        runner,_=provider_fixture();runner.records['issues/comments/'+str(current.review['id'])]=current.review
        runner.records['issues/162/comments?per_page=100']=[[current.review]]
        provider=GitHubProvider(runner,'capture-local')
        current.authority=authority.CaptureAuthority(current.root,current.index,current.review,provider,False)
        current.provider_runner=runner;current.writer_calls=[]
        def writers():
            current.writer_calls.append(True);science.verify_capture_clone(current.root)
            return {'localWriterInventoryStandIn':True}
        current.writers=writers
        # Real before-create copy admissions and native SQL seals, with explicit
        # stand-ins for ALL physical hardware/du/kernel/Docker observations.
        current.disk.last={'localPhysicalStandIn':True}
        def finish(label):return current.budget.finish(label,0)
        stack.enter_context(patch.object(current.disk,'finish',finish))
        journal=Journal(current.root,str(current.root),sha(canonical(current.index)),False)
        cli=NativeCloneStandIn(current)
        current.controller=science.CaptureScience(current.root,current.index,current.review,current.authority,
            current.disk,current.reader,cli,journal,writers)
        current.cli=cli
        yield current


class CaptureSequence(unittest.TestCase):
    def test_fresh_provider_full_standing_originals_then_native_preservation_and_full_science(self):
        with controller_fixture() as current:
            before=identity_record(triple(current.source));connections=[];connect=sqlite3.connect
            def watched(path,*args,**kwargs):
                text=str(path).replace('\\','/');connections.append(text)
                self.assertNotIn('/new-live/',text);self.assertNotIn('/raw/',text)
                return connect(path,*args,**kwargs)
            with patch.object(sqlite3,'connect',watched):result=current.controller.execute()
            self.assertEqual(result['version'],2);self.assertEqual(result['root'],current.root.as_posix())
            self.assertEqual(result['releaseRoot'],str(science.ROOT));self.assertGreater(len(connections),0)
            self.assertGreater(len(current.provider_runner.calls),35)
            self.assertEqual(current.cli.labels,[r['stage'] for r in CAPTURE_TABLE[2:]])
            self.assertEqual(current.budget.completed,8);self.assertIsNone(current.budget.active)
            verify_scientific_originals(result,lambda name:(current.root/name).read_bytes())
            self.assertEqual(identity_record(triple(current.source)),before)
            self.assertEqual(result['issues']['214']['affectedRuns'],authority_fixtures.Science().chart()['affectedRuns'])
            self.assertEqual(result['issues']['209']['impact']['refusalScope'],['SYNTHETIC FULL FIELD RETAINED'])
            self.assertEqual(set(result['preparationReferences']),{'206','214'})
            self.assertGreater(len(current.writer_calls),12)
            with self.assertRaises(RuntimeError):current.controller.execute()
            with self.assertRaises(RuntimeError):current.authority.authorize()

    def test_invalid_stored_pass_precedes_provider_root_and_host_reads(self):
        with controller_fixture() as current:
            current.review['body']='Source review: PASS\nINCOMPLETE'
            with patch.object(current.authority.provider,'source_snapshot',side_effect=AssertionError('provider before pure PASS')):
                with self.assertRaises(RuntimeError):current.controller.execute()
            self.assertFalse((current.root/'capture-fresh-authority.json').exists())
            self.assertFalse((current.root/'capture-science-intent.json').exists());self.assertEqual(current.observations,[])

    def test_fresh_edit_unknown_direction_failed_main_and_network_refuse_before_host_capture(self):
        for mode in ('edit','later','main','network'):
            with self.subTest(mode=mode),controller_fixture() as current:
                records=current.provider_runner.records
                if mode=='edit':
                    row=copy.deepcopy(current.review);row['body']+='\nEDITED';records['issues/comments/'+str(row['id'])]=row
                if mode=='later':
                    row=copy.deepcopy(current.review);row['id']+=100;row['created_at']=row['updated_at']='2026-10-16T12:00:00Z'
                    row['body']='Wait for a separately reviewed correction';records['issues/162/comments?per_page=100'][0].append(row)
                if mode=='main':records['git/ref/heads/main']={'object':{'sha':'f'*40}}
                if mode=='network':records['issues/comments/'+str(current.review['id'])]=RuntimeError('LOCAL network stand-in')
                with self.assertRaises(RuntimeError):current.controller.execute()
                self.assertFalse((current.root/'capture-snapshot-intent.json').exists())
                self.assertEqual(current.observations,[]);self.assertEqual(current.cli.labels,[])

    def test_original_row_evidence_backfill_and_foreign_table_mutations_stop_before_next_owner(self):
        for mode in ('old-row','nonempty','backfill','foreign'):
            with self.subTest(mode=mode),controller_fixture() as current:
                current.cli.fail=mode
                with self.assertRaises(RuntimeError):current.controller.execute()
                self.assertEqual(current.cli.labels[-1],'capture-206-prepare')
                self.assertTrue((current.root/'capture-206-prepare-original.json').exists())
                self.assertTrue((current.root/'capture-206-prepare-intent.json').exists())
                self.assertFalse((current.root/'capture-206-preservation.json').exists())
                self.assertFalse((current.root/'actual-scientific-impact.json').exists())
                with self.assertRaises(RuntimeError):current.controller.execute()

    def test_readonly_mutation_and_nonzero_approved_list_retain_full_original_but_no_science_success(self):
        for mode,label in (('readonly-change','capture-chart-impact'),('approved','capture-order-impact')):
            with self.subTest(mode=mode),controller_fixture() as current:
                current.cli.fail=mode
                with self.assertRaises(RuntimeError):current.controller.execute()
                self.assertEqual(current.cli.labels[-1],label)
                name='actual-impact-'+('214' if mode=='readonly-change' else '209')+'.json'
                original=json.loads((current.root/name).read_bytes())
                if mode=='approved':self.assertEqual(original['impact']['approvedAmendmentSampleIds'],['LOCAL_APPROVED'])
                self.assertFalse((current.root/'actual-scientific-impact.json').exists())

    def test_wrong_stage_missing_physical_closure_and_mutated_original_cannot_publish(self):
        with controller_fixture() as current:
            with self.assertRaises(RuntimeError):current.controller.run_stage('capture-order-impact',lambda:None)
            finish=current.disk.finish
            def fail(label):
                if label=='capture-214-prepare':raise RuntimeError('LOCAL missing physical closure')
                return finish(label)
            current.disk.finish=fail
            with self.assertRaises(RuntimeError):current.controller.execute()
            self.assertEqual(current.cli.labels[-1],'capture-214-prepare')
            self.assertFalse((current.root/'actual-impact-214.json').exists())
        with controller_fixture() as current:
            result=current.controller.execute();path=current.root/'capture-206-preservation.json'
            path.chmod(0o600);path.write_bytes(b'{}')
            with self.assertRaises(RuntimeError):verify_scientific_originals(result,lambda name:(current.root/name).read_bytes())

    def test_science_capture_requires_distinct_roots_table_and_complete_preparation_pairs(self):
        with controller_fixture() as current:
            result=current.controller.execute()
            for mode in ('oldversion','release-root','table','missing-prep','receipt-count'):
                value=copy.deepcopy(result)
                if mode=='oldversion':value['version']=1
                if mode=='release-root':value['root']=str(science.ROOT)
                if mode=='table':value['captureTableSha256']='f'*64
                if mode=='missing-prep':value['preparationReferences'].pop('206')
                if mode=='receipt-count':value['preparationReferences']['214']['preservation']['bytes']+=1
                with self.subTest(mode=mode),self.assertRaises(RuntimeError):
                    verify_scientific_originals(value,lambda name:(current.root/name).read_bytes())

    def test_first_stage_needs_authority_and_lost_preparation_return_never_retries_or_advances(self):
        with controller_fixture() as current:
            with self.assertRaises(RuntimeError):
                current.controller.run_stage('capture-filesystem-snapshot',lambda:None)
            self.assertIsNone(current.budget.active)
            original=current.cli.run
            def lost_return(spec):
                result=original(spec)
                if spec['label']=='capture-206-prepare':raise RuntimeError('LOCAL lost APPLY return after native clone commit')
                return result
            current.cli.run=lost_return
            with self.assertRaises(RuntimeError):current.controller.execute()
            self.assertEqual(current.cli.labels[-1],'capture-206-prepare')
            self.assertTrue((current.root/'capture-206-prepare-intent.json').exists())
            self.assertFalse((current.root/'capture-206-prepare-original.json').exists())
            self.assertFalse((current.root/'capture-206-preservation.json').exists())
            self.assertFalse((current.root/'actual-scientific-impact.json').exists())
            self.assertEqual(current.budget.active,'capture-206-prepare')
            count=len(current.cli.labels)
            with self.assertRaises(RuntimeError):current.controller.execute()
            self.assertEqual(len(current.cli.labels),count)

    def test_clone_writer_guard_checks_all_mounts_and_the_bound_descriptor_inode_set(self):
        from kit_no_writers import assert_no_volume_writers
        from verify_kit_capture_owned import capture_object
        with controller_fixture() as current:
            current.controller.execute()
            spec=owned.capture_spec('capture-206-prepare');row=capture_object(spec,True)
            reader=types.SimpleNamespace(inventory=lambda:{row['Id']:row})
            descriptor_sets=[]
            def descriptors(protected):
                descriptor_sets.append(protected)
                return {'complete':True,'writableProtectedDescriptors':0}
            def guard(reader,paths):return assert_no_volume_writers(reader,descriptors,paths)
            with patch.object(science,'assert_no_volume_writers',guard):
                with self.assertRaises(RuntimeError):science.capture_no_writers(current.root,reader)
                self.assertEqual(descriptor_sets,[])
                row['State']['Running']=False
                result=science.capture_no_writers(current.root,reader)
                self.assertTrue(result['noRunningProtectedVolumeWriter'])
                path=current.root/'scientific-database/dev.db';info=path.stat()
                self.assertIn((info.st_dev,info.st_ino),descriptor_sets[-1])
            with patch.object(science,'assert_no_volume_writers',lambda reader,paths:
                assert_no_volume_writers(reader,lambda protected:{'complete':False,'writableProtectedDescriptors':0},paths)):
                with self.assertRaises(RuntimeError):science.capture_no_writers(current.root,reader)


if __name__=='__main__':unittest.main()
