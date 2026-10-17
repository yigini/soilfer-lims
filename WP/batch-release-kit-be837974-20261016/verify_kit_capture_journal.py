"""Capture main-journal admission, with real LOCAL files/native preflight.

Docker/kernel/Linux durability and scientific installer execution are stand-ins.
The native preflight's Linux platform is explicitly projected on Windows.
"""
import hashlib
import json
import os
import pathlib
import shutil
import sqlite3
import subprocess
import tempfile
import unittest
from unittest.mock import patch
import kit_capture_journal as journal
import kit_capture_owned as owned
import kit_capture_budget as budgets
import kit_evidence as evidence
from kit_contract import canonical
from kit_copy_admission import copy_layout
from kit_owned import control_callbacks
from kit_journal import exclusive_record
from kit_rollback_journal import rollback_journal_bound

HERE=pathlib.Path(__file__).resolve().parent
WORK=HERE.parents[1]
FIXTURES=HERE/'capture-journal-local-retained-fixtures'


def directory():
    FIXTURES.mkdir(exist_ok=True)
    return pathlib.Path(tempfile.mkdtemp(prefix='capture-journal-',dir=FIXTURES)).resolve()


def database(root):
    parent=root/'scientific-database';parent.mkdir();target=parent/'dev.db'
    db=sqlite3.connect(target);db.execute('CREATE TABLE retained(id INTEGER PRIMARY KEY,value TEXT)')
    db.execute("INSERT INTO retained(value) VALUES('old')");db.commit();db.close();return target


class HeldDisk:
    """Explicit hardware/Docker stand-in, real source budget/admission semantics."""
    def __init__(self,root,capacity=True):
        self.root=root;self.capacity=capacity;self.calls=[]
        self.budget=budgets.CaptureBudget(1024**2,0,0);self.budget.completed=4
        self.budget.begin('capture-206-prepare',10**20);self.budget.cli('capture-206-prepare')
    def admit_copy(self,site,destination,layout):
        if (self.root/'capture-206-prepare-retained-temp').exists():raise AssertionError('Admission after mkdir')
        maximum=self.budget.copy_ceiling(site);self.calls.append((site,str(destination),layout))
        if not self.capacity or layout['declaredAllocationBytes']>maximum:raise RuntimeError('LOCAL capacity refusal')


class CaptureJournal(unittest.TestCase):
    def context(self,root):
        return patch.multiple(owned,CAPTURE_ROOT=pathlib.Path(root),APACHE_CAPTURE_ROOT=root.as_posix())

    def test_extreme_geometry_fits_the_explicit_additional_ceiling(self):
        for page in (512,1024,4096,65536):
            for pages in (1,2,17,1024,100000):
                bound=rollback_journal_bound(pages,page)
                if bound['maximumJournalBytes']>32*1024**3:continue
                self.assertLessEqual(copy_layout([bound['maximumJournalBytes']],0)['declaredAllocationBytes'],
                    journal.JOURNAL_DB_COST*pages*page)
        self.assertEqual(budgets.CAPTURE_TOTAL_DB_COPIES,1641)
        self.assertEqual(budgets.CAPTURE_DB_EQUIVALENTS,2052)

    def test_two_forward_transactions_hold_distinct_receipts_for_same_journal_name(self):
        root=directory();target=database(root)
        budget=budgets.CaptureBudget(1024**2,0,0)
        disk=budgets.CaptureDisk.__new__(budgets.CaptureDisk);disk.root=root;disk.budget=budget;disk.sync=False
        disk.check=lambda:10**20 # explicit physical free-space stand-in
        with self.context(root):
            for number,label in enumerate(('capture-206-prepare','capture-214-prepare'),4):
                budget.completed=number;budget.active=None;budget.begin(label,10**20);budget.cli(label)
                plan=journal.capture_journal_plan(owned.capture_spec(label))
                disk.admit_copy(journal.CAPTURE_JOURNAL_SITES[label],pathlib.Path(plan['journal']),plan['layout'])
                with self.assertRaises(RuntimeError):disk.admit_copy(journal.CAPTURE_JOURNAL_SITES[label],pathlib.Path(plan['journal']),plan['layout'])
        rows=[json.loads(p.read_bytes()) for p in root.glob('copy-admission-*.json')]
        self.assertEqual(len(rows),2);self.assertEqual({r['site'] for r in rows},set(journal.CAPTURE_JOURNAL_SITES.values()))
        self.assertEqual({r['destination'] for r in rows},{str(target)+'-journal'})

    def test_real_before_mkdir_admission_and_single_spend_are_required(self):
        root=directory();target=database(root);disk=HeldDisk(root);events=[]
        with self.context(root),patch.object(evidence,'_runtime',evidence.EvidenceLedger(root)):
            spec=owned.capture_spec('capture-206-prepare');temp=pathlib.Path(spec['tmp'])
            prepare,read,_=control_callbacks(root,lambda s:temp,False,disk,lambda:events.append('writers'),
                {},{},None,(),writer_journal_sites=journal.CAPTURE_JOURNAL_SITES)
            before=target.read_bytes();prepare(spec)
            self.assertEqual(events,['writers','writers']);self.assertEqual(len(disk.calls),1)
            self.assertEqual(disk.calls[0][0],'capture-206-main-journal')
            plan=json.loads((temp/'writer-journal-admission.json').read_bytes())
            self.assertEqual(plan['callerProofSha256'],journal.caller_proof())
            self.assertTrue(os.path.samefile(temp/'writer-journal-admission.json',temp/'writer-journal-admission.json.pending'))
            self.assertIsNone(read(spec));self.assertEqual(before,target.read_bytes())
            with self.assertRaises(RuntimeError):prepare(spec)
            with self.assertRaises(RuntimeError):disk.budget.finish('capture-206-prepare',0)
            db=sqlite3.connect(target);db.execute("UPDATE retained SET value='committed'");db.commit();db.close()
            # Only the completion signal is a stand-in; the transaction,
            # journal postcondition and immutable closure publication are real.
            (temp/'cli-child-complete.json').write_bytes(b'{}\n')
            self.assertEqual(read(spec),b'{}\n');self.assertEqual(read(spec),b'{}\n')
            self.assertTrue(os.path.samefile(temp/'writer-journal-closure.json',temp/'writer-journal-closure.json.pending'))
            closure=json.loads((temp/'writer-journal-closure.json').read_bytes())
            self.assertTrue(closure['journalAbsentAfterChildClose']);self.assertFalse(closure['continuousPeakMeasured'])

    def test_capacity_profile_and_fresh_writer_refusals_precede_mkdir(self):
        for fault in ('capacity','wal','journal','changed','writers','missing-disk'):
            root=directory();target=database(root);disk=HeldDisk(root,fault!='capacity');calls=[]
            if fault=='wal':pathlib.Path(str(target)+'-wal').write_bytes(b'content')
            if fault=='journal':pathlib.Path(str(target)+'-journal').touch()
            def writers():
                calls.append(1)
                if fault=='writers':raise RuntimeError('LOCAL writer observed')
                if fault=='changed' and len(calls)==2:
                    with target.open('r+b') as stream:stream.seek(120);stream.write(b'changed')
            with self.context(root),patch.object(evidence,'_runtime',evidence.EvidenceLedger(root)):
                spec=owned.capture_spec('capture-206-prepare');temp=pathlib.Path(spec['tmp'])
                prepare,_,_=control_callbacks(root,lambda s:temp,False,None if fault=='missing-disk' else disk,
                    writers,{}, {},None,(),writer_journal_sites=journal.CAPTURE_JOURNAL_SITES)
                with self.subTest(fault=fault),self.assertRaises(RuntimeError):prepare(spec)
                self.assertFalse(temp.exists());self.assertFalse((temp/'cli-original.stdout').exists())

    def test_post_child_journal_failure_is_consumed_before_exit_permission(self):
        root=directory();target=database(root);disk=HeldDisk(root)
        with self.context(root),patch.object(evidence,'_runtime',evidence.EvidenceLedger(root)):
            spec=owned.capture_spec('capture-206-prepare');temp=pathlib.Path(spec['tmp'])
            prepare,read,_=control_callbacks(root,lambda s:temp,False,disk,lambda:None,{}, {},None,(),
                writer_journal_sites=journal.CAPTURE_JOURNAL_SITES)
            prepare(spec)
            # Explicit child-completion stand-in; no scientific CLI is run.
            (temp/'cli-child-complete.json').write_bytes(b'{}\n')
            pathlib.Path(str(target)+'-journal').write_bytes(b'retained failure')
            with self.assertRaises(RuntimeError):read(spec)
            with self.assertRaisesRegex(RuntimeError,'consumed'):read(spec)
            self.assertFalse((temp/'writer-journal-closure.json').exists())
            self.assertFalse((temp/'cli-exit-permit.json').exists())
            self.assertEqual(pathlib.Path(str(target)+'-journal').read_bytes(),b'retained failure')

    def test_real_local_commit_closes_only_the_main_journal_obligation(self):
        root=directory();target=database(root)
        with self.context(root):
            plan=journal.capture_journal_plan(owned.capture_spec('capture-206-prepare'))
            db=sqlite3.connect(target);db.execute("UPDATE retained SET value='new'");db.commit();db.close()
            result=journal.close_capture_journal(plan)
        self.assertTrue(result['mainInodePreserved']);self.assertTrue(result['journalAbsentAfterChildClose'])
        for key in ('continuousPeakMeasured','journalOriginalBytesRetained','mainDatabaseGrowthBounded',
            'statementOrSqlScratchBounded','physicalFilesystemClosureClaimed','completeWriterFilesystemReview'):
            self.assertIs(result[key],False)

    def test_held_record_ticket_cannot_be_swapped_or_reused(self):
        root=directory();temp=root/'controls';book=evidence.EvidenceLedger(root)
        with patch.object(evidence,'_runtime',book):
            first=evidence.admit_evidence(temp/'first.json',8192,pending=True,reservation=True,future_directory=temp)
            second=evidence.admit_evidence(temp/'second.json',8192,pending=True,reservation=True,future_directory=temp)
            temp.mkdir()
            with self.assertRaises(RuntimeError):exclusive_record(temp,'first.json',{'value':1},False,held_admission=second)
            self.assertFalse((temp/'first.json').exists());self.assertFalse((temp/'first.json.pending').exists())
            exclusive_record(temp,'first.json',{'value':1},False,held_admission=first)
            self.assertNotIn(first[1],book.open)
            with self.assertRaises(RuntimeError):exclusive_record(temp,'second.json',{'value':2},False,held_admission=first)
            self.assertFalse((temp/'second.json').exists())
            exclusive_record(temp,'second.json',{'value':2},False,held_admission=second)

    def test_full_source_git_native_excerpts_and_no_seed_branch_are_pinned(self):
        proof=json.loads((HERE/journal.PROOF_NAME).read_bytes());self.assertEqual(len(proof['files']),40)
        for name,row in proof['files'].items():
            if 'gitBlob' in row:raw=subprocess.check_output(['git','cat-file','blob',row['gitBlob']],cwd=WORK)
            else:raw=(WORK/name).read_bytes()
            self.assertEqual({'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest()},
                {key:row[key] for key in ('bytes','sha256')},name)
        native=(WORK/'server/node_modules/better-sqlite3/deps/sqlite3/sqlite3.c').read_bytes().splitlines(keepends=True)
        for name,row in proof['nativeExcerpts'].items():
            raw=b''.join(native[row['firstLine']-1:row['lastLine']])
            self.assertEqual(raw.decode(),row['text'],name);self.assertEqual(hashlib.sha256(raw).hexdigest(),row['sha256'])
        self.assertTrue(proof['completeMainJournalCallerReview']);self.assertFalse(proof['completeWriterFilesystemReview'])
        guard=(HERE/'capture_cli_guard.cjs').read_text()
        self.assertLess(guard.index('verifyCaptureWriter(value.directory'),guard.index('await runChild(value.directory'))

    def test_real_native_guard_checks_source_and_admitted_bytes_before_scientific_spawn(self):
        root=directory();setup=root/'new-source';setup.mkdir();source=database(setup)
        from kit_capture_native_inventory import RECEIPT_SQL
        from retained_files import seal
        with sqlite3.connect(source) as db:
            db.execute(RECEIPT_SQL);db.execute('CREATE TABLE WorkAttempt(id TEXT)')
        backup,_=seal(root,'fresh-production-snapshot',source,lambda:None,schema_original='capture-schema-initial.json')
        parent=root/'scientific-database';parent.mkdir();target=parent/'dev.db';shutil.copyfile(backup,target);target.chmod(0o600)
        # A short NEW retained runtime avoids Windows MAX_PATH; the source
        # fixture keeps its full reference. No existing private tree is read.
        runtime=pathlib.Path(tempfile.mkdtemp(prefix='cj-native-')).resolve()
        (root/'runtime-reference.json').write_bytes(canonical({'newRetainedRuntime':str(runtime)})+b'\n')
        proof=json.loads((HERE/journal.PROOF_NAME).read_bytes())
        package=WORK/'server/node_modules/better-sqlite3'
        shutil.copytree(package,runtime/'server/node_modules/better-sqlite3')
        for dependency in ('bindings','file-uri-to-path'):
            shutil.copytree(WORK/'server/node_modules'/dependency,runtime/'server/node_modules'/dependency)
        for name,row in proof['files'].items():
            destination=runtime/(row.get('runtimePath') or name);destination.parent.mkdir(parents=True,exist_ok=True)
            raw=subprocess.check_output(['git','cat-file','blob',row['gitBlob']],cwd=WORK) if 'gitBlob' in row else (WORK/name).read_bytes()
            destination.write_bytes(raw)
        with self.context(root):plan=journal.capture_journal_plan(owned.capture_spec('capture-206-prepare'))
        temp=root/'control';temp.mkdir();admission=temp/'writer-journal-admission.json'
        admission.write_bytes(canonical(plan)+b'\n');admission.chmod(0o400);os.link(admission,str(admission)+'.pending')
        from kit_capture_main import main_plan_fields
        from kit_contract import sha
        raw=(root/'capture-schema-initial.json').read_bytes();observation=json.loads(raw)
        main=main_plan_fields('capture-206-prepare',observation,{'file':'capture-schema-initial.json','bytes':len(raw),'sha256':sha(raw)},plan)
        main_path=temp/'writer-main-admission.json';main_path.write_bytes(canonical(main)+b'\n')
        main_path.chmod(0o400);os.link(main_path,str(main_path)+'.pending')
        from kit_capture_statement import statement_plan_fields
        statement=statement_plan_fields('capture-206-prepare',main,plan)
        statement_path=temp/'writer-statement-admission.json'
        statement_path.write_bytes(canonical(statement)+b'\n');statement_path.chmod(0o400)
        os.link(statement_path,str(statement_path)+'.pending')
        code="const v=require(process.argv[1]);v.verifyCaptureWriter(process.argv[2],'capture-206-prepare',{platform:'linux',appRoot:process.argv[3],target:process.argv[4]});process.stdout.write('SCIENTIFIC_SPAWN_ALLOWED');"
        command=[shutil.which('node'),'-e',code,str(HERE/'capture_writer_journal.cjs'),str(temp),str(runtime),str(target)]
        env={**os.environ,'NODE_OPTIONS':''}
        def run(label):
            result=subprocess.run(command,capture_output=True,env=env,cwd=WORK/'server')
            (root/(label+'.stdout-original')).write_bytes(result.stdout);(root/(label+'.stderr-original')).write_bytes(result.stderr)
            return result
        result=run('native-preflight');self.assertEqual(result.returncode,0,result.stderr.decode())
        self.assertEqual(result.stdout,b'SCIENTIFIC_SPAWN_ALLOWED')
        for fault in ('missing-statement','boolean-statement','count-statement','pair-statement'):
            controls=root/fault;controls.mkdir()
            for kind in ('journal','main','statement'):
                if kind=='statement' and fault=='missing-statement':continue
                source=temp/('writer-'+kind+'-admission.json');raw=source.read_bytes()
                if kind=='statement' and fault in ('boolean-statement','count-statement'):
                    altered=json.loads(raw)
                    if fault=='boolean-statement':altered['collectorSourceByteBindingVerified']=1
                    else:altered['bound']['maximumStatementStarts']=9
                    raw=canonical(altered)+b'\n'
                destination=controls/source.name;destination.write_bytes(raw);destination.chmod(0o400)
                if not(kind=='statement' and fault=='pair-statement'):os.link(destination,str(destination)+'.pending')
            modified=list(command);modified[4]=str(controls)
            refused=subprocess.run(modified,capture_output=True,env=env,cwd=WORK/'server')
            (root/(fault+'.stdout-original')).write_bytes(refused.stdout)
            (root/(fault+'.stderr-original')).write_bytes(refused.stderr)
            self.assertNotEqual(refused.returncode,0);self.assertEqual(refused.stdout,b'')
        source=runtime/'server/scripts/install_sample_containers.js';old=source.read_bytes();source.write_bytes(old+b'\n// changed\n')
        result=run('changed-caller');self.assertNotEqual(result.returncode,0);self.assertEqual(result.stdout,b'')
        source.write_bytes(old);pathlib.Path(str(target)+'-wal').write_bytes(b'not rollback')
        result=run('wal-content');self.assertNotEqual(result.returncode,0);self.assertEqual(result.stdout,b'')
        (root/'projection-disclosure.json').write_bytes(canonical({'actualPlatform':os.name,
            'linuxPlatformExplicitStandIn':True,'nativeSqliteEngineReal':True,'scientificChildWasNotSpawned':True,
            'dockerKernelAndLinuxDirectoryDurabilityStandIns':True})+b'\n')
