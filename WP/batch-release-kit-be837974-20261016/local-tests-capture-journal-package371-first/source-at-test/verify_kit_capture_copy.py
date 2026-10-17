"""New LOCAL WAL databases and original files; no host/durability/capacity claim."""
import contextlib
import copy
import json
import os
import pathlib
import shutil
import sqlite3
import tempfile
import types
import unittest
from unittest.mock import patch
import kit_capture_budget as budgets
import kit_capture_copy as capture
import kit_capture_owned as owned
import kit_evidence
import retained_files as retained
from kit_budget import Budget,TABLE_SHA
from kit_disk import BOUND
from kit_contract import IMAGE_BYTES
from kit_copy_admission import copy_layout
from verify_kit_frozen import index,source_pass
from verify_kit_runtime import old

HERE=pathlib.Path(__file__).resolve().parent
FIXTURES=HERE/'capture-copy-local-retained-fixtures'
MOUNT=b'23 0 0:1 / / rw - ext4 /dev/sda rw\n'


def directory():
    FIXTURES.mkdir(exist_ok=True)
    return pathlib.Path(tempfile.mkdtemp(prefix='owned-',dir=FIXTURES)).resolve()


@contextlib.contextmanager
def fixture():
    base=directory();root=base/'new-capture';root.mkdir();live=base/'new-live';live.mkdir()
    assets=base/'new-assets';assets.mkdir();(assets/'empty').write_bytes(b'');(assets/'nested').mkdir()
    (assets/'nested/binary').write_bytes(b'\x00\xffLOCAL ASSET')
    source=live/'dev.db';writer=sqlite3.connect(source)
    writer.execute('PRAGMA journal_mode=WAL');writer.execute('PRAGMA wal_autocheckpoint=0')
    writer.execute('CREATE TABLE _schema_migrations(id TEXT PRIMARY KEY)')
    writer.executemany('INSERT INTO _schema_migrations VALUES(?)',[(str(n),) for n in range(39)])
    for n in range(105):writer.execute('CREATE TABLE t'+str(n)+'(id INTEGER PRIMARY KEY,value TEXT)')
    writer.execute("INSERT INTO t0 VALUES(1,'ORIGINAL BEFORE WINDOW')");writer.commit()
    normal=old();normal['State']['Pid']=41234;observations=[]
    def inspect(identity):observations.append(identity);return copy.deepcopy(normal)
    def hardware():
        return {path:{'path':path,'device':7,'blockBytes':4096,'fragmentBytes':4096,
            'availableBlocks':10**12//4096,'freeBytes':10**12//4096*4096} for path in BOUND}
    with contextlib.ExitStack() as stack:
        for module in (capture,budgets,owned):stack.enter_context(patch.object(module,'CAPTURE_ROOT',root))
        stack.enter_context(patch.object(owned,'APACHE_CAPTURE_ROOT',root.as_posix()))
        for module in (capture,retained):
            stack.enter_context(patch.object(module,'LIVE_DATA',str(live)))
            stack.enter_context(patch.object(module,'LIVE_ASSETS',str(assets)))
        for module in (capture,owned):stack.enter_context(patch.object(module,'capture_mountinfo',lambda:MOUNT))
        stack.enter_context(patch.object(capture,'sync_capture_tree',lambda path:None))
        book=budgets.CaptureBudget(16*1024**2,1024**2,IMAGE_BYTES)
        disk=budgets.CaptureDisk(root,None,None,book,require_directory_sync=False,hardware_reader=hardware)
        value=index();review=source_pass(value)
        review['body']+='\n'+'\n'.join([root.as_posix(),owned.CAPTURE_UNIT,
            'captureTableSha256='+budgets.CAPTURE_TABLE_SHA,'captureFilesystemOnlyProductionCopy=true',
            'captureRawMastersNeverSqlite=true','capturePreparationIssues=206,214','capture209ApplyForbidden=true'])
        current=types.SimpleNamespace(base=base,root=root,live=live,source=source,assets=assets,writer=writer,
            reader=types.SimpleNamespace(inspect=inspect),normal=normal,observations=observations,
            disk=disk,budget=book,index=value,review=review)
        try:yield current
        finally:writer.close()


def snapshot(current):
    current.budget.begin('capture-filesystem-snapshot',10**12)
    value=capture.capture_snapshot(current.root,current.index,current.review,current.reader,current.disk)
    current.budget.finish('capture-filesystem-snapshot',0) # LOCAL physical-growth stand-in only.
    return value


class CaptureCopies(unittest.TestCase):
    def test_capture_copy_and_conditional_journal_ceiling_margin_and_separate_domain(self):
        self.assertEqual(budgets.CAPTURE_TOTAL_DB_COPIES,1605)
        self.assertEqual(budgets.CAPTURE_DB_EQUIVALENTS,2007)
        self.assertNotEqual(budgets.CAPTURE_TABLE_SHA,TABLE_SHA)
        self.assertEqual(sum(row['logGrowthShareBytes'] for row in budgets.CAPTURE_TABLE),4*1024**3)
        budget=budgets.CaptureBudget(600000000,6000000,IMAGE_BYTES);initial=budget.required()
        self.assertGreaterEqual(budget.remaining(),64*budget.db)
        for row in budgets.CAPTURE_TABLE:
            budget.begin(row['stage'],10**15)
            for site,count in row['sites'].items():
                for _ in range(count):budget.claim(site);budget.copy_ceiling(site)
            self.assertLessEqual(budget.required(),initial)
            result=budget.finish(row['stage'],0)
            self.assertEqual(result['stageTableSha256'],budgets.CAPTURE_TABLE_SHA)
            self.assertFalse(result['physicalFilesystemClosureClaimed'])
        self.assertEqual(budget.remaining(),0)
        for action in (lambda:budget.begin('capture-clone',10**12),lambda:budget.cli('209-apply'),
            lambda:budget.claim('startup-policy-chain')):
            with self.assertRaises(RuntimeError):action()
        with self.assertRaises(RuntimeError):budgets.CaptureDisk(owned.CAPTURE_ROOT,None,None,Budget(4096,0,1))
        with self.assertRaises(RuntimeError):budgets.CaptureDisk(pathlib.Path(str(capture.ROOT)),None,None,budget)

    def test_missing_admission_wrong_cli_replay_capacity_and_physical_overrun_refuse(self):
        budget=budgets.CaptureBudget(1000000,1000000,IMAGE_BYTES)
        with self.assertRaises(RuntimeError):budget.begin('capture-filesystem-snapshot',1)
        budget.begin('capture-filesystem-snapshot',10**12)
        with self.assertRaises(RuntimeError):budget.cli('capture-214-prepare')
        with self.assertRaises(RuntimeError):budget.claim('cli-orders')
        with self.assertRaises(RuntimeError):budget.copy_ceiling('triple')
        for site,count in budgets.CAPTURE_TABLE[0]['sites'].items():
            for _ in range(count):budget.claim(site)
        with self.assertRaises(RuntimeError):budget.finish('capture-filesystem-snapshot',0)
        for site,count in budgets.CAPTURE_TABLE[0]['sites'].items():
            for _ in range(count):budget.copy_ceiling(site)
        with self.assertRaises(RuntimeError):budget.copy_ceiling('backup')
        with self.assertRaises(RuntimeError):budget.finish('capture-filesystem-snapshot',10**12)

    def test_source_review_and_capture_tokens_precede_any_filesystem_kernel_or_docker_read(self):
        for failure in ('missing','foreign','omitted-capture','edited'):
            value=index();review=source_pass(value)
            if failure=='missing':review={}
            if failure=='foreign':review['performed_via_github_app']['id']=1
            if failure=='edited':review['updated_at']='2026-10-16T12:00:00Z'
            with patch.object(capture,'capture_root',side_effect=AssertionError('host read before authority')):
                with self.subTest(failure=failure),self.assertRaises(RuntimeError):
                    capture.capture_snapshot(owned.CAPTURE_ROOT,value,review,None,None)
                with self.assertRaises(RuntimeError):capture.capture_clone(owned.CAPTURE_ROOT,value,review,None)

    def test_real_wal_snapshot_backup_clone_and_every_sql_connection_avoid_live_and_raw_masters(self):
        with fixture() as current:
            original=retained.identity_record(retained.triple(current.source));connect=sqlite3.connect;connections=[]
            def watched(target,*args,**kwargs):
                text=str(target).replace('\\','/');connections.append(text)
                self.assertNotIn('/raw/',text);self.assertNotIn('/new-live/',text)
                return connect(target,*args,**kwargs)
            with patch.object(sqlite3,'connect',watched):
                value=snapshot(current)
                current.budget.begin('capture-clone',10**12)
                clone=capture.capture_clone(current.root,current.index,current.review,current.disk)
                with self.assertRaises(FileExistsError):capture.capture_clone(current.root,current.index,current.review,current.disk)
                current.budget.finish('capture-clone',0)
                capture.verify_capture_clone(current.root)
            self.assertGreater(len(connections),0);self.assertEqual(len(current.observations),2)
            self.assertEqual(retained.identity_record(retained.triple(current.source)),original)
            self.assertEqual(value['rawTripleByteIdentity'],original)
            self.assertEqual(clone['initialCloneByteIdentity'][''],value['backup'])
            self.assertEqual(clone['initialCloneByteIdentity']['-wal'],None)
            cloned=current.root/'scientific-database/dev.db'
            raw=current.root/'fresh-production-snapshot/raw/dev.db';backup=current.root/'fresh-production-snapshot/backup.db'
            self.assertEqual(len({path.stat().st_ino for path in (current.source,raw,backup,cloned)}),4)
            for receipt in current.root.glob('copy-admission-*.json'):
                self.assertEqual(json.loads(receipt.read_bytes())['stageTableSha256'],budgets.CAPTURE_TABLE_SHA)

    def test_production_can_evolve_after_closed_copy_window_without_reclassifying_snapshot(self):
        with fixture() as current:
            write=retained.write_new;evolved=[]
            def after_handoff(path,value):
                write(path,value)
                if path.name=='snapshot-handoff.json':
                    current.writer.execute("INSERT INTO t0 VALUES(2,'AFTER CLOSED WINDOW')");current.writer.commit();evolved.append(True)
            with patch.object(retained,'write_new',after_handoff):value=snapshot(current)
            self.assertEqual(evolved,[True])
            state=json.loads((current.root/'fresh-production-snapshot/logical-state.json').read_bytes())
            self.assertEqual(state['tables']['t0']['count'],1)
            self.assertNotEqual(value['rawTripleByteIdentity'],retained.identity_record(retained.triple(current.source)))
            capture.verify_capture_snapshot(current.root,value['sourceBinding'])

    def test_changed_source_inside_copy_retains_failed_window_and_consumes_attempt(self):
        with fixture() as current:
            current.budget.begin('capture-filesystem-snapshot',10**12)
            copy_file=retained.copy_file;changed=[]
            def change(src,dst,*args,**kwargs):
                result=copy_file(src,dst,*args,**kwargs)
                if pathlib.Path(src)==current.source and not changed:
                    current.writer.execute("INSERT INTO t0 VALUES(2,'DURING WINDOW')");current.writer.commit();changed.append(True)
                return result
            with patch.object(retained,'copy_file',change):
                with self.assertRaises(RuntimeError):capture.capture_snapshot(current.root,current.index,current.review,current.reader,current.disk)
            self.assertTrue((current.root/'capture-snapshot-intent.json').exists())
            self.assertFalse((current.root/'capture-snapshot-provenance.json').exists())
            self.assertFalse((current.root/'scientific-database').exists())
            before=list(current.observations)
            with self.assertRaises(FileExistsError):capture.capture_snapshot(current.root,current.index,current.review,current.reader,current.disk)
            self.assertEqual(current.observations,before)

    def test_live_hardlink_or_journal_refuses_before_raw_destination_or_sql(self):
        for failure in ('hardlink','journal'):
            with fixture() as current:
                if failure=='hardlink':os.link(current.source,current.base/'retained-live-link')
                else:(current.live/'dev.db-journal').write_bytes(b'')
                current.budget.begin('capture-filesystem-snapshot',10**12)
                with self.subTest(failure=failure),self.assertRaises(RuntimeError):
                    capture.capture_snapshot(current.root,current.index,current.review,current.reader,current.disk)
                self.assertFalse((current.root/'fresh-production-snapshot').exists())
                self.assertTrue((current.root/'capture-snapshot-intent.json.pending').exists())

    def test_unhealthy_before_or_identity_drift_after_copy_cannot_publish_provenance(self):
        for failure in ('unhealthy','drift'):
            with fixture() as current:
                def inspect(identity):
                    current.observations.append(identity);value=copy.deepcopy(current.normal)
                    if failure=='unhealthy':value['State']['Health']['Status']='unhealthy'
                    elif len(current.observations)==2:value['State']['Pid']+=1
                    return value
                current.reader.inspect=inspect;current.budget.begin('capture-filesystem-snapshot',10**12)
                with self.subTest(failure=failure),self.assertRaises(RuntimeError):
                    capture.capture_snapshot(current.root,current.index,current.review,current.reader,current.disk)
                self.assertFalse((current.root/'capture-snapshot-provenance.json').exists())
                self.assertEqual((current.root/'fresh-production-snapshot').exists(),failure=='drift')

    def test_mutated_raw_backup_or_foreign_hardlink_refuses_before_clone_creation(self):
        for failure in ('raw','backup','hardlink','control-pair','asset','asset-directory','normal-pair'):
            with fixture() as current:
                snapshot(current);current.budget.begin('capture-clone',10**12)
                raw=current.root/'fresh-production-snapshot/raw/dev.db';backup=current.root/'fresh-production-snapshot/backup.db'
                if failure=='hardlink':os.link(backup,current.root/'retained-backup-link')
                elif failure=='asset-directory':(current.root/'captured-assets/foreign-empty').mkdir()
                elif failure in ('control-pair','normal-pair'):
                    name='capture-snapshot-provenance.json' if failure=='control-pair' else 'capture-normal-after.json'
                    path=current.root/(name+'.pending');path.chmod(0o600)
                    path.rename(current.root/'retained-original-pending');path.write_bytes((current.root/name).read_bytes());path.chmod(0o400)
                else:
                    target=(current.root/'captured-assets/nested/binary') if failure=='asset' else raw if failure=='raw' else backup
                    target.chmod(0o600)
                    with target.open('r+b') as stream:stream.write(b'CHANGED')
                    target.chmod(0o400)
                with self.subTest(failure=failure),self.assertRaises(RuntimeError):
                    capture.capture_clone(current.root,current.index,current.review,current.disk)
                self.assertFalse((current.root/'scientific-database').exists())
                self.assertTrue((current.root/'capture-clone-intent.json').exists())

    def test_clone_admission_before_mkdir_and_same_byte_inode_substitution_refuse(self):
        with fixture() as current:
            snapshot(current);current.budget.begin('capture-clone',10**12)
            with patch.object(current.budget,'copy_ceiling',lambda site:1):
                with self.assertRaises(RuntimeError):capture.capture_clone(current.root,current.index,current.review,current.disk)
            self.assertFalse((current.root/'scientific-database').exists())
        with fixture() as current:
            snapshot(current);current.budget.begin('capture-clone',10**12)
            capture.capture_clone(current.root,current.index,current.review,current.disk)
            main=current.root/'scientific-database/dev.db';raw=main.read_bytes()
            main.rename(current.root/'retained-original-clone');main.write_bytes(raw)
            with self.assertRaises(RuntimeError):capture.verify_capture_clone(current.root)

    def test_cli_refuses_missing_or_changed_clone_provenance_before_any_temp_file(self):
        with fixture() as current:
            database=current.root/'scientific-database';database.mkdir();(database/'dev.db').write_bytes(b'new retained bytes')
            spec=owned.capture_spec('capture-206-prepare')
            prepare,_,_=owned.capture_filesystem_controls(current.root,False,current.disk,lambda:None)
            with self.assertRaises((RuntimeError,FileNotFoundError)):prepare(spec)
            self.assertFalse(pathlib.Path(spec['tmp']).exists())
        with fixture() as current:
            snapshot(current);current.budget.begin('capture-clone',10**12)
            capture.capture_clone(current.root,current.index,current.review,current.disk)
            backup=current.root/'fresh-production-snapshot/backup.db';backup.chmod(0o600)
            with backup.open('r+b') as stream:stream.write(b'CHANGED')
            backup.chmod(0o400);spec=owned.capture_spec('capture-206-prepare')
            prepare,_,_=owned.capture_filesystem_controls(current.root,False,current.disk,lambda:None)
            with self.assertRaises(RuntimeError):prepare(spec)
            self.assertFalse(pathlib.Path(spec['tmp']).exists())

    def test_actual_clone_provenance_brackets_real_precreate_cli_controls_and_raw_master_rehash(self):
        with fixture() as current:
            snapshot(current);current.budget.begin('capture-clone',10**12)
            capture.capture_clone(current.root,current.index,current.review,current.disk)
            current.budget.finish('capture-clone',0)
            # Earlier scientific CLI execution is a stand-in here; real source
            # claim accounting and the native retained copy are exercised.
            for row in budgets.CAPTURE_TABLE[2:4]:
                current.budget.begin(row['stage'],10**12);current.budget.cli(row['stage'])
                for site,count in row['sites'].items():
                    for _ in range(count):current.budget.copy_ceiling(site)
                current.budget.finish(row['stage'],0)
            current.budget.begin('capture-206-prepare',10**12)
            current.budget.cli('capture-206-prepare')
            spec=owned.capture_spec('capture-206-prepare');writers=[]
            before=retained.identity_record(retained.triple(current.root/'fresh-production-snapshot/raw/dev.db'))
            prepare,_,_=owned.capture_filesystem_controls(current.root,False,current.disk,lambda:writers.append(True))
            with patch.object(kit_evidence,'_runtime',kit_evidence.EvidenceLedger(current.root)):
                prepare(spec)
            self.assertEqual(writers,[True,True,True])
            self.assertTrue((pathlib.Path(spec['tmp'])/'cli-output-admission.json').exists())
            self.assertEqual(retained.identity_record(retained.triple(current.root/'fresh-production-snapshot/raw/dev.db')),before)
            with self.assertRaises(RuntimeError):prepare(spec)


if __name__=='__main__':unittest.main()
