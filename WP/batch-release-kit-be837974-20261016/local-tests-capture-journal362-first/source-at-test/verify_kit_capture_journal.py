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
        self.assertEqual(budgets.CAPTURE_TOTAL_DB_COPIES,1605)
        self.assertEqual(budgets.CAPTURE_DB_EQUIVALENTS,2007)

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
        root=directory();target=database(root);runtime=root/'runtime';runtime.mkdir()
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
        code="const v=require(process.argv[1]);v.verifyCaptureWriter(process.argv[2],'capture-206-prepare',{platform:'linux',appRoot:process.argv[3],target:process.argv[4]});process.stdout.write('SCIENTIFIC_SPAWN_ALLOWED');"
        command=[shutil.which('node'),'-e',code,str(HERE/'capture_writer_journal.cjs'),str(temp),str(runtime),str(target)]
        env={**os.environ,'NODE_OPTIONS':''}
        def run(label):
            result=subprocess.run(command,capture_output=True,env=env,cwd=WORK/'server')
            (root/(label+'.stdout-original')).write_bytes(result.stdout);(root/(label+'.stderr-original')).write_bytes(result.stderr)
            return result
        result=run('native-preflight');self.assertEqual(result.returncode,0,result.stderr.decode())
        self.assertEqual(result.stdout,b'SCIENTIFIC_SPAWN_ALLOWED')
        source=runtime/'server/scripts/install_sample_containers.js';old=source.read_bytes();source.write_bytes(old+b'\n// changed\n')
        result=run('changed-caller');self.assertNotEqual(result.returncode,0);self.assertEqual(result.stdout,b'')
        source.write_bytes(old);pathlib.Path(str(target)+'-wal').write_bytes(b'not rollback')
        result=run('wal-content');self.assertNotEqual(result.returncode,0);self.assertEqual(result.stdout,b'')
        (root/'projection-disclosure.json').write_bytes(canonical({'actualPlatform':os.name,
            'linuxPlatformExplicitStandIn':True,'nativeSqliteEngineReal':True,'scientificChildWasNotSpawned':True,
            'dockerKernelAndLinuxDirectoryDurabilityStandIns':True})+b'\n')
