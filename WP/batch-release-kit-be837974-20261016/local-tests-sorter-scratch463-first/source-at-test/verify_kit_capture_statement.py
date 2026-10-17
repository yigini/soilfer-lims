"""NEW LOCAL fixtures only; no scientific app owner, Docker or host action."""
import copy
import os
import pathlib
import shutil
import sqlite3
import tempfile
import unittest
from unittest.mock import patch
import kit_capture_statement as statement
import kit_capture_main as main
import kit_capture_budget as budget
import kit_capture_owned as owned
import kit_capture_review as review
import verify_kit_capture_main as main_fixtures
import verify_kit_capture_review as review_fixtures
from kit_capture_native_inventory import capture_native_inventory,RECEIPT_SQL,RECEIPT_INDEX
from kit_statement_journal import statement_journal_bound,declared_statements
from kit_main_mutations import mutation_growth_bound
from kit_contract import canonical,sha
from retained_contract import exact_json

HERE=pathlib.Path(__file__).resolve().parent
FIXTURES=HERE/'capture-statement-local-retained-fixtures'


def directory():
    FIXTURES.mkdir(exist_ok=True)
    return pathlib.Path(tempfile.mkdtemp(prefix='new-',dir=FIXTURES)).resolve()


def header(size,pages):
    value=bytearray(100);value[:16]=b'SQLite format 3\0'
    value[16:18]=(1 if size==65536 else size).to_bytes(2,'big');value[18:20]=b'\1\1'
    value[21:24]=bytes([64,32,32]);value[24:28]=(1).to_bytes(4,'big')
    value[28:32]=pages.to_bytes(4,'big');value[56:60]=(1).to_bytes(4,'big');value[92:96]=value[24:28]
    return bytes(value)


class CaptureStatementContent(unittest.TestCase):
    def test_all_eight_pages_charge_base_prior_growth_and_every_statement_without_reuse_credit(self):
        schema={'version':1,'scope':'DECLARED_COMPLETE_SQLITE_SCHEMA','encoding':1,'rows':[
            ['table','_schema_migrations','_schema_migrations',2,RECEIPT_SQL],
            ['index',RECEIPT_INDEX,'_schema_migrations',3,None],
            ['table','WorkAttempt','WorkAttempt',4,'CREATE TABLE WorkAttempt(id TEXT)']]}
        for size in (512,1024,2048,4096,8192,16384,32768,65536):
            prior_growth=0
            for label,site in statement.STATEMENT_SITES.items():
                operations=capture_native_inventory(label,schema)['operations']
                for original in (1,1234):
                    pages=original+prior_growth//size;raw=header(size,pages)
                    bound=statement_journal_bound(raw,pages*size,operations,declared_statements(statement.CAPTURE_STATEMENTS[label]))
                    unmargined=statement.STATEMENT_DB_COST[label]*original*size+statement.STATEMENT_FIXED[label]
                    self.assertLessEqual(bound['aggregateAllocationCharges']['declaredAllocationBytes'],unmargined)
                    self.assertLessEqual(bound['aggregateAllocationCharges']['declaredAllocationBytes'],
                        budget.capture_ceiling(original*size,0,label,site))
                    self.assertEqual(bound['maximumSingleFileLogicalContentBytes'],bound['maximumCumulativeLogicalContentBytes'])
                    self.assertEqual(bound['truncateReuseDeleteRollbackCreditBytes'],0)
                if label=='capture-206-prepare':
                    prior_growth=mutation_growth_bound(header(size,1),size,operations)['maximumLogicalGrowthBytes']
        self.assertEqual(statement.STATEMENT_DB_COST,{'capture-206-prepare':11,'capture-214-prepare':25})
        self.assertEqual(budget.CAPTURE_TOTAL_DB_COPIES,1641);self.assertEqual(budget.CAPTURE_DB_EQUIVALENTS,2052)

    def test_actual_controls_hold_statement_capacity_and_both_tickets_before_mkdir_without_target_sql(self):
        with main_fixtures.ready() as current:
            calls=[];admit=current.disk.admit_copy
            def held(site,destination,layout):
                self.assertFalse(current.temp.exists());calls.append(site);return admit(site,destination,layout)
            with patch.object(sqlite3,'connect',side_effect=AssertionError('No admission target SQL')):
                with patch.object(current.disk,'admit_copy',held):current.prepare(current.spec)
            self.assertIn('capture-206-statement-journal',calls);self.assertGreaterEqual(len(current.events),7)
            p=current.temp/'writer-statement-admission.json';plan=exact_json(p.read_bytes())
            self.assertTrue(os.path.samefile(p,str(p)+'.pending'));self.assertEqual(p.stat().st_nlink,2)
            self.assertLessEqual(p.stat().st_size,8192);self.assertIsNone(current.read(current.spec))
            self.assertTrue(plan['conditionalStatementContentWriterAdmissionImplemented'])
            self.assertFalse(plan['statementJournalFileLengthOrVfsBounded'])
            receipt=exact_json((current.root/statement.statement_disk_original('capture-206-prepare')).read_bytes())
            self.assertTrue(receipt['beforeDestinationCreation']);self.assertFalse(receipt['temporaryDirectoryRoutingVerified'])

    def test_statement_capacity_and_last_writer_change_refuse_before_temporary_directory(self):
        for fault in ('capacity','late-writer'):
            with self.subTest(fault=fault),main_fixtures.ready() as current:
                if fault=='capacity':
                    original=current.budget.copy_ceiling
                    current.budget.copy_ceiling=lambda site:1 if site in statement.STATEMENT_SITES.values() else original(site)
                else:
                    calls=[]
                    def writers():
                        calls.append(1)
                        if len(calls)==7:raise RuntimeError('LOCAL late writer')
                    current.prepare,_,_=owned.capture_filesystem_controls(current.root,False,current.disk,writers)
                with self.assertRaises(RuntimeError):current.prepare(current.spec)
                self.assertFalse(current.temp.exists())

    def test_statement_failure_after_real_child_close_is_consumed_before_exit_permission(self):
        with main_fixtures.ready() as current:
            current.prepare(current.spec)
            with sqlite3.connect(current.root/'scientific-database/dev.db') as db:
                db.execute("UPDATE t0 SET value='LOCAL NATIVE CLOSED COMMIT'")
            (current.temp/'cli-child-complete.json').write_bytes(b'{}\n')
            with patch.object(statement,'statement_closure_fields',side_effect=RuntimeError('LOCAL refused closure')):
                with self.assertRaisesRegex(RuntimeError,'refused closure'):current.read(current.spec)
            self.assertTrue((current.temp/'writer-main-closure.json').exists())
            self.assertTrue((current.temp/'writer-journal-closure.json').exists())
            self.assertFalse((current.temp/'writer-statement-closure.json').exists())
            self.assertFalse((current.temp/'cli-exit-permit.json').exists())
            with self.assertRaisesRegex(RuntimeError,'consumed'):current.read(current.spec)

    def test_independent_package_replays_all_six_originals_and_rejects_rebound_bounds_types_authority(self):
        with review_fixtures.review_fixture() as current:
            receipt=current.review_controller.execute();self.assertEqual(len(receipt['files']),40)
            baseline={n:(current.root/n).read_bytes() for n in receipt['files']}
            with patch.object(sqlite3,'connect',side_effect=AssertionError('No package target SQL')):
                self.assertTrue(statement.verify_capture_statements(baseline,current.root)['allSixStatementOriginalsReplayed'])
            for name in statement.STATEMENT_ORIGINALS:
                files=dict(baseline);del files[name]
                with self.subTest(missing=name),self.assertRaises(RuntimeError):statement.verify_capture_statements(files,current.root)
            name='capture-206-prepare-retained-temp/writer-statement-admission.json'
            for fault in ('count','bound','layout','main','boolean','physical','foreign'):
                files=dict(baseline);value=exact_json(files[name])
                if fault=='count':value['bound']['maximumStatementStarts']=9
                if fault=='bound':value['bound']['maximumCumulativeLogicalContentBytes']-=1
                if fault=='layout':value['layout']['declaredAllocationBytes']-=4096
                if fault=='main':value['mainAdmissionSha256']='f'*64
                if fault=='boolean':value['collectorSourceByteBindingVerified']=1
                if fault=='physical':value['statementJournalFileLengthOrVfsBounded']=True
                if fault=='foreign':value['unreviewed']=True
                files[name]=canonical(value)+b'\n';rebound=copy.deepcopy(receipt)
                rebound['files']={n:{'bytes':len(raw),'sha256':sha(raw)} for n,raw in files.items()}
                with self.subTest(fault=fault),self.assertRaises(RuntimeError):
                    review.verify_capture_receipt(rebound,lambda n:files[n],current.index,current.review)

    def test_full_new_source_copy_detects_same_length_mutation_and_grants_no_runtime_authority(self):
        proof=exact_json((HERE/statement.PROOF_NAME).read_bytes());root=directory()
        self.assertFalse(proof['statementJournalFileLengthOrVfsBounded'])
        for name in (*proof['files'],statement.PROOF_NAME):shutil.copyfile(HERE/name,root/name)
        with patch.object(statement,'__file__',str(root/'kit_capture_statement.py')):
            self.assertEqual(statement.statement_source_proof(),sha((root/statement.PROOF_NAME).read_bytes()))
            p=root/'kit_owned.py';raw=p.read_bytes();p.write_bytes(b'#'+raw[1:])
            with self.assertRaisesRegex(RuntimeError,'source changed'):statement.statement_source_proof()

    def test_disk_and_closure_originals_reject_invented_observation_and_swapped_source_chains(self):
        with review_fixtures.review_fixture() as current:
            receipt=current.review_controller.execute();baseline={n:(current.root/n).read_bytes() for n in receipt['files']}
            for label in statement.STATEMENT_SITES:
                for kind in ('capacity','closure','chain'):
                    files=dict(baseline)
                    name=statement.statement_disk_original(label) if kind=='capacity' else label+'-retained-temp/writer-statement-closure.json'
                    value=exact_json(files[name])
                    if kind=='capacity':value['temporaryDirectoryRoutingVerified']=True
                    if kind=='closure':value['statementJournalBytesObserved']=True
                    if kind=='chain':value['mainClosureSha256']='f'*64
                    files[name]=canonical(value)+b'\n'
                    with self.subTest(label=label,kind=kind),self.assertRaises(RuntimeError):
                        statement.verify_capture_statements(files,current.root)
