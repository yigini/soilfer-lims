"""NEW LOCAL native files/controls; source-only, no Docker/host/production."""
import contextlib
import copy
import json
import os
import pathlib
import shutil
import sqlite3
import tempfile
import unittest
from unittest.mock import patch
import kit_capture_main as main
import kit_capture_owned as owned
import kit_capture_copy as capture
import kit_capture_budget as budgets
import kit_capture_journal as journal
import kit_evidence as evidence
import verify_kit_capture_copy as copy_fixtures
import verify_kit_capture_review as review_fixtures
import kit_capture_review as review
from kit_contract import canonical,sha
from kit_capture_native_inventory import capture_native_inventory,RECEIPT_SQL,RECEIPT_INDEX
from kit_main_mutations import mutation_growth_bound
from retained_contract import exact_json

HERE=pathlib.Path(__file__).resolve().parent
FIXTURES=HERE/'capture-main-local-retained-fixtures'


def directory():
    FIXTURES.mkdir(exist_ok=True)
    return pathlib.Path(tempfile.mkdtemp(prefix='new-',dir=FIXTURES)).resolve()


@contextlib.contextmanager
def ready(extra=''):
    with copy_fixtures.fixture() as current:
        if extra:
            current.writer.executescript(extra);current.writer.commit()
        copy_fixtures.snapshot(current)
        current.budget.begin('capture-clone',10**12)
        capture.capture_clone(current.root,current.index,current.review,current.disk)
        current.budget.finish('capture-clone',0)
        # Only the two unrelated readonly stages are projected for this LOCAL
        # controls test; no complete scientific/physical qualification claim.
        current.budget.completed=4
        current.budget.begin('capture-206-prepare',10**12);current.budget.cli('capture-206-prepare')
        current.events=[]
        def writers():current.events.append('writers')
        with patch.object(evidence,'_runtime',evidence.EvidenceLedger(current.root)):
            current.spec=owned.capture_spec('capture-206-prepare');current.temp=pathlib.Path(current.spec['tmp'])
            current.prepare,current.read,current.permit=owned.capture_filesystem_controls(
                current.root,False,current.disk,writers)
            yield current


class CaptureNativeMain(unittest.TestCase):
    def test_all_eight_page_sizes_prove_fixed_main_journal_and_downstream_allowances(self):
        schema={'version':1,'scope':'DECLARED_COMPLETE_SQLITE_SCHEMA','encoding':1,'rows':[
            ['table','_schema_migrations','_schema_migrations',2,RECEIPT_SQL],
            ['index',RECEIPT_INDEX,'_schema_migrations',3,None],
            ['table','WorkAttempt','WorkAttempt',4,'CREATE TABLE WorkAttempt(id TEXT)']]}
        maxima={};journal_extra=[]
        for label in main.MAIN_SITES:
            operations=capture_native_inventory(label,schema)['operations'];values=[]
            for size in (512,1024,2048,4096,8192,16384,32768,65536):
                header=bytearray(100);header[:16]=b'SQLite format 3\0'
                header[16:18]=(1 if size==65536 else size).to_bytes(2,'big');header[18:20]=b'\1\1'
                header[21:24]=bytes([64,32,32]);header[24:28]=(1).to_bytes(4,'big')
                header[28:32]=(1).to_bytes(4,'big');header[92:96]=header[24:28]
                bound=mutation_growth_bound(bytes(header),size,operations);values.append(bound['maximumLogicalGrowthBytes'])
                if label=='capture-206-prepare':journal_extra.append(bound['maximumAdditionalPages']*(size+8+2*65536))
            maxima[label]=max(values)
        self.assertEqual(maxima,main.MAIN_GROWTH_MAX);self.assertEqual(max(journal_extra),main.JOURNAL_214_GROWTH_EXTRA)
        self.assertEqual(budgets.CAPTURE_TOTAL_DB_COPIES,1641);self.assertEqual(budgets.CAPTURE_DB_EQUIVALENTS,2052)
        for label,site in main.MAIN_SITES.items():
            self.assertGreaterEqual(budgets.capture_ceiling(512,0,label,site),main.MAIN_GROWTH_MAX[label])
        self.assertGreaterEqual(budgets.CAPTURE_EXTRA['capture-214-prepare']['triple'],sum(main.MAIN_GROWTH_MAX.values()))
        self.assertGreaterEqual(budgets.CAPTURE_EXTRA['capture-order-impact']['capture-order-snapshots'],2*sum(main.MAIN_GROWTH_MAX.values()))
        self.assertEqual(sum(row['fixedBytes'] for row in budgets.CAPTURE_TABLE),8118001664+sum(__import__('kit_capture_statement').STATEMENT_FIXED.values()))

    def test_actual_capture_callbacks_hold_both_controls_before_mkdir_then_close_native_commit(self):
        with ready() as current:
            target=current.root/'scientific-database/dev.db';before=target.read_bytes();calls=[]
            admit=current.disk.admit_copy
            def held(site,destination,layout):
                self.assertFalse(current.temp.exists());calls.append(site);return admit(site,destination,layout)
            with patch.object(current.disk,'admit_copy',held):current.prepare(current.spec)
            self.assertEqual(set(calls),{'capture-206-main-journal','capture-206-native-main','capture-206-statement-journal'})
            self.assertGreaterEqual(len(current.events),5);self.assertEqual(target.read_bytes(),before)
            self.assertIsNone(current.read(current.spec))
            for kind in ('journal','main'):
                p=current.temp/('writer-'+kind+'-admission.json');self.assertTrue(os.path.samefile(p,str(p)+'.pending'))
                self.assertLessEqual(p.stat().st_size,8192)
            with sqlite3.connect(target) as db:db.execute("UPDATE t0 SET value='LOCAL CLOSED COMMIT'")
            (current.temp/'cli-child-complete.json').write_bytes(b'{}\n')
            self.assertEqual(current.read(current.spec),b'{}\n');self.assertEqual(current.read(current.spec),b'{}\n')
            p=current.temp/'writer-main-closure.json';self.assertTrue(os.path.samefile(p,str(p)+'.pending'))
            value=exact_json(p.read_bytes());self.assertTrue(value['logicalPageEnvelopeClosed'])
            self.assertFalse(value['mainFileLengthOrVfsPreallocationBounded']);self.assertFalse(value['continuousPeakMeasured'])
            receipt=exact_json((current.root/main.main_disk_original('capture-206-prepare')).read_bytes())
            self.assertIs(receipt['beforeDestinationCreation'],False);self.assertIs(receipt['beforeMainFileExtension'],True)
            with self.assertRaises(RuntimeError):current.prepare(current.spec)

    def test_capacity_writer_source_and_real_receipt_trigger_refuse_before_control_mkdir(self):
        for fault in ('capacity','writers','source','receipt-trigger'):
            extra="CREATE TRIGGER extra_receipt AFTER INSERT ON _schema_migrations BEGIN DELETE FROM t0; END;" if fault=='receipt-trigger' else ''
            with self.subTest(fault=fault),ready(extra) as current:
                target=current.root/'scientific-database/dev.db';before=target.read_bytes()
                if fault=='capacity':
                    original=current.budget.copy_ceiling
                    current.budget.copy_ceiling=lambda site:1 if site in main.MAIN_SITES.values() else original(site)
                elif fault=='writers':
                    current.prepare,_,_=owned.capture_filesystem_controls(current.root,False,current.disk,
                        lambda:(_ for _ in ()).throw(RuntimeError('LOCAL writer refusal')))
                elif fault=='source':
                    with sqlite3.connect(target) as db:db.execute("UPDATE t0 SET value='CHANGED BEFORE CREATE'")
                with self.assertRaises(RuntimeError):current.prepare(current.spec)
                self.assertFalse(current.temp.exists())
                if fault!='source':self.assertEqual(before,target.read_bytes())

    def test_actual_oversized_post_child_growth_is_consumed_before_exit_permission(self):
        with ready() as current:
            current.prepare(current.spec);admitted=exact_json((current.temp/'writer-main-admission.json').read_bytes())
            target=current.root/'scientific-database/dev.db'
            length=admitted['bound']['maximumLogicalMainBytes']+4096
            with sqlite3.connect(target) as db:db.execute('INSERT INTO t0(id,value) VALUES(?,zeroblob(?))',(999,length))
            (current.temp/'cli-child-complete.json').write_bytes(b'{}\n')
            with self.assertRaisesRegex(RuntimeError,'exceeds its admitted logical'):current.read(current.spec)
            with self.assertRaisesRegex(RuntimeError,'consumed'):current.read(current.spec)
            self.assertTrue((current.temp/'writer-journal-closure.json').exists())
            self.assertFalse((current.temp/'writer-main-closure.json').exists())
            self.assertFalse((current.temp/'cli-exit-permit.json').exists())

    def test_independent_package_replays_all_six_main_controls_and_refuses_rebound_substitution(self):
        with review_fixtures.review_fixture() as current:
            receipt=current.review_controller.execute();self.assertEqual(len(receipt['files']),40)
            baseline={n:(current.root/n).read_bytes() for n in receipt['files']}
            with patch.object(sqlite3,'connect',side_effect=AssertionError('No package target SQL')):
                self.assertTrue(main.verify_capture_main(baseline,current.root)['allSixNativeMainOriginalsReplayed'])
            for name in main.MAIN_ORIGINALS:
                files=dict(baseline);del files[name]
                with self.subTest(missing=name),self.assertRaises(RuntimeError):main.verify_capture_main(files,current.root)
            name='capture-206-prepare-retained-temp/writer-main-admission.json'
            for fault in ('operations','bound','journal','schema','physical','foreign'):
                files=dict(baseline);value=exact_json(files[name])
                if fault=='operations':value['operations']['deletions']=True
                if fault=='bound':value['bound']['maximumLogicalMainBytes']+=4096
                if fault=='journal':value['journalAdmissionSha256']='f'*64
                if fault=='schema':value['schemaOriginal']['sha256']='f'*64
                if fault=='physical':value['mainFileLengthOrVfsPreallocationBounded']=True
                if fault=='foreign':value['unreviewed']=True
                files[name]=canonical(value)+b'\n';rebound=copy.deepcopy(receipt)
                rebound['files']={n:{'bytes':len(raw),'sha256':sha(raw)} for n,raw in files.items()}
                with self.subTest(fault=fault),self.assertRaises(RuntimeError):
                    review.verify_capture_receipt(rebound,lambda n:files[n],current.index,current.review)

    def test_source_manifest_pins_complete_native_and_collector_paths_without_invented_vfs_authority(self):
        proof=exact_json((HERE/main.PROOF_NAME).read_bytes());self.assertTrue(proof['completeRestrictedMainNativeCallerReview'])
        self.assertFalse(proof['mainFileLengthOrVfsPreallocationBounded'])
        self.assertEqual(proof['nativeInventoryProofSha256'],sha((HERE/'capture-native-inventory-source.json').read_bytes()))
        self.assertEqual(proof['collectorProofSha256'],sha((HERE/'schema-collection-source.json').read_bytes()))
        root=directory()
        for name in (*proof['files'],main.PROOF_NAME):shutil.copyfile(HERE/name,root/name)
        with patch.object(main,'__file__',str(root/'kit_capture_main.py')):
            self.assertEqual(main.main_source_proof(),sha((root/main.PROOF_NAME).read_bytes()))
            source=root/'kit_owned.py';data=source.read_bytes();source.write_bytes(b'#'+data[1:])
            with self.assertRaisesRegex(RuntimeError,'source changed'):main.main_source_proof()

    def test_original_main_capacity_and_closure_fields_are_strict_even_with_recomputed_outer_hashes(self):
        with review_fixtures.review_fixture() as current:
            receipt=current.review_controller.execute();baseline={n:(current.root/n).read_bytes() for n in receipt['files']}
            for label in main.MAIN_SITES:
                for name in (main.main_disk_original(label),label+'-retained-temp/writer-main-closure.json'):
                    files=dict(baseline);value=exact_json(files[name])
                    if 'maximumBytes' in value:value['beforeMainFileExtension']=False
                    else:value['logicalPageEnvelopeClosed']=1
                    files[name]=canonical(value)+b'\n'
                    with self.subTest(name=name),self.assertRaises(RuntimeError):main.verify_capture_main(files,current.root)