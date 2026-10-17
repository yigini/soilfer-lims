"""New retained local copies/SQLite files only; no filesystem capacity verdict."""
import copy
import os
import pathlib
import sqlite3
import types
import unittest
from unittest.mock import patch
from kit_copy_admission import copy_layout
from kit_budget import Budget,SEAL_DIRECTORY_BYTES,TABLE
from kit_disk import Disk
import kit_disk
from retained_files import clone_backup,copy_triple,copy_tree,file_state,seal,memory_temporaries,reader_index_bound,verify_reader_index
from verify_kit_apache_capture import local_directory


class Owner:
    def __init__(self,maximum):self.maximum=maximum;self.claims=[];self.plans=[];self.checks=0
    def check(self):self.checks+=1
    def claim(self,site):self.claims.append(site)
    def admit_copy(self,site,destination,plan):
        assert site=='reader-index' or not destination.exists()
        self.plans.append((site,destination,plan))
        if plan['declaredAllocationBytes']>self.maximum:raise RuntimeError('LOCAL held copy allowance exhausted')


class CopyAdmissions(unittest.TestCase):
    def test_stat_only_capacity_input_includes_every_new_copy_entry_and_directory(self):
        root=local_directory();data=root/'new-data';data.mkdir();assets=root/'new-assets';assets.mkdir()
        (data/'dev.db').write_bytes(b'x'*4097);(data/'dev.db-wal').write_bytes(b'')
        (assets/'empty').write_bytes(b'');(assets/'nested').mkdir();(assets/'nested/value').write_bytes(b'v')
        actual_stat=pathlib.Path.stat
        def projected(path,*args,**kwargs):
            value=actual_stat(path,*args,**kwargs)
            if hasattr(value,'st_blocks'):return value
            # LOCAL Windows allocation projection only; no Linux/host claim.
            return types.SimpleNamespace(**{name:getattr(value,name) for name in dir(value) if name.startswith('st_')},
                st_blocks=((value.st_size+4095)//4096)*8)
        with patch.object(kit_disk,'LIVE_DATA',str(data)),patch.object(kit_disk,'LIVE_ASSETS',str(assets)),\
            patch.object(pathlib.Path,'stat',projected),patch.object(pathlib.Path,'read_bytes',side_effect=AssertionError('must not read content')):
            value=kit_disk.measure_inputs()
        self.assertEqual(value['databaseContentAndEntries']['fileCount'],2)
        self.assertEqual(value['assetContentAndEntries']['fileCount'],2)
        self.assertEqual(value['assetContentAndEntries']['directoryCount'],2)
        self.assertEqual(value['databaseAllocatedBytes'],8192+(2*2+3)*4096)
        self.assertEqual(value['assetsAllocatedBytes'],4096+(2*2+2*3)*4096)
        self.assertEqual(value['productionContentOpens'],0)

    def test_every_file_entry_inode_and_directory_is_charged_even_when_content_is_empty(self):
        value=copy_layout([0,1,4096,4097],3)
        self.assertEqual(value['roundedContentBytes'],4*4096)
        self.assertEqual(value['entryAndInodeAllowanceBytes'],(4*2+3*3)*4096)
        self.assertFalse(value['physicalFilesystemClosureClaimed'])
        for sizes,dirs in [([True],0),([-1],0),([1],True),([1],-1),([32*1024**3,1],0)]:
            with self.assertRaises(RuntimeError):copy_layout(sizes,dirs)

    def test_triple_clone_and_asset_refusals_precede_their_first_destination_directory(self):
        root=local_directory();source=root/'new-source.db';source.write_bytes(b'new bytes')
        (root/'new-source.db-wal').write_bytes(b'wal');(root/'new-source.db-shm').write_bytes(b'')
        assets=root/'new-assets';assets.mkdir();(assets/'empty').write_bytes(b'');(assets/'nested').mkdir()
        (assets/'nested/value').write_bytes(b'content')
        for operation,name,site in [
            (lambda target,owner:copy_triple(source,target,owner.check),'triple','triple'),
            (lambda target,owner:clone_backup(root,target.name,source,owner.check),'clone','clone'),
            (lambda target,owner:copy_tree(assets,target,owner.check),'assets','assets')]:
            owner=Owner(1);target=root/('refused-'+name)
            with self.assertRaisesRegex(RuntimeError,'allowance exhausted'):operation(target,owner)
            self.assertFalse(target.exists());self.assertEqual(owner.claims,[site]);self.assertEqual(len(owner.plans),1)
        self.assertEqual(source.read_bytes(),b'new bytes')

    def test_exact_layouts_are_admitted_once_and_all_new_original_bytes_are_preserved(self):
        root=local_directory();source=root/'new-source.db';source.write_bytes(b'new bytes')
        (root/'new-source.db-wal').write_bytes(b'wal');(root/'new-source.db-shm').write_bytes(b'')
        before={p.name:p.read_bytes() for p in root.iterdir()};owner=Owner(1024**2)
        target,_=copy_triple(source,root/'copied',owner.check)
        self.assertEqual(owner.plans[0][2]['fileCount'],3);self.assertEqual(owner.plans[0][2]['directoryCount'],1)
        for name,raw in before.items():self.assertEqual((root/name).read_bytes(),raw)
        for suffix in ('','-wal','-shm'):self.assertEqual(pathlib.Path(str(target)+suffix).read_bytes(),pathlib.Path(str(source)+suffix).read_bytes())
        with self.assertRaises(RuntimeError):copy_triple(source,root/'copied',owner.check)
        self.assertEqual(len(owner.plans),1)

    def test_owned_backup_pins_real_sqlite_pages_before_exclusive_destination_creation(self):
        root=local_directory();source=root/'new-source.db';db=sqlite3.connect(source)
        db.execute('CREATE TABLE retained_value(id INTEGER PRIMARY KEY,value BLOB)')
        db.execute('INSERT INTO retained_value(value) VALUES(?)',(b'x'*100000,));db.commit();db.close()
        before=file_state(source);owner=Owner(10*1024**2)
        backup,state=seal(root,'new-seal',source,owner.check)
        plans=[row for row in owner.plans if row[0]=='backup'];self.assertEqual(len(plans),1)
        self.assertEqual(plans[0][1],backup);self.assertEqual(plans[0][2]['contentBytes'],backup.stat().st_size)
        self.assertEqual(state['tables']['retained_value']['count'],1);self.assertEqual(file_state(source),before)
        self.assertEqual(owner.claims,['seal-directory','triple','triple','reader-index','backup'])

    def test_outer_seal_directory_is_admitted_before_any_destination_or_source_read(self):
        root=local_directory();owner=Owner(1)
        with patch('retained_files.file_state',side_effect=AssertionError('Source must not be read')),\
            self.assertRaisesRegex(RuntimeError,'allowance exhausted'):
            seal(root,'refused-outer',root/'not-read.db',owner.check)
        self.assertFalse((root/'refused-outer').exists())
        self.assertEqual(owner.claims,['seal-directory'])
        self.assertEqual(owner.plans[0][2]['declaredAllocationBytes'],SEAL_DIRECTORY_BYTES)

    def test_missing_or_reused_outer_directory_admission_refuses_stage_closure(self):
        budget=Budget(1024**2,1024**2,414683521);budget.begin('stopped-backup',10**12)
        for site,count in TABLE[0]['sites'].items():
            for _ in range(count):
                budget.claim(site)
                if site!='seal-directory':budget.copy_ceiling(site)
        with self.assertRaisesRegex(RuntimeError,'before-create'):budget.finish('stopped-backup',0)
        self.assertEqual(budget.copy_ceiling('seal-directory'),SEAL_DIRECTORY_BYTES)
        with self.assertRaisesRegex(RuntimeError,'reuse'):budget.copy_ceiling('seal-directory')
        budget.finish('stopped-backup',0)

    def test_wal_source_becomes_detached_backup_without_side_files_and_preserves_all_originals(self):
        root=local_directory();source=root/'new-wal-source.db';writer=sqlite3.connect(source)
        try:
            writer.execute('PRAGMA journal_mode=WAL');writer.execute('CREATE TABLE retained_value(value BLOB)')
            writer.execute('INSERT INTO retained_value VALUES(?)',(b'x'*100000,));writer.commit()
            before={suffix:pathlib.Path(str(source)+suffix).read_bytes() for suffix in ('','-wal','-shm')}
            backup,state=seal(root,'wal-seal',source,Owner(10*1024**2).check)
            self.assertEqual(state['tables']['retained_value']['count'],1)
            self.assertEqual({suffix:pathlib.Path(str(source)+suffix).read_bytes() for suffix in before},before)
            self.assertEqual(sorted(p.name for p in backup.parent.iterdir()),['backup.db','logical-state.json','raw','reader','reader-index-bound.json','seal.json'])
            with sqlite3.connect(backup.as_uri()+'?mode=ro',uri=True) as check:
                self.assertEqual(check.execute('PRAGMA journal_mode').fetchone(),('delete',))
                self.assertEqual(check.execute('SELECT length(value) FROM retained_value').fetchone(),(100000,))
        finally:writer.close()

    def test_reader_index_allocation_refusal_precedes_any_sqlite_connection(self):
        root=local_directory();source=root/'source.db';source.write_bytes(b'not opened as SQL')
        owner=Owner(10*1024**2);admit=owner.admit_copy
        def refuse(site,destination,plan):
            if site=='reader-index':raise RuntimeError('LOCAL reader index allowance refused')
            admit(site,destination,plan)
        owner.admit_copy=refuse
        with patch('retained_files.sqlite3.connect',side_effect=AssertionError('No SQL before index admission')),\
            self.assertRaisesRegex(RuntimeError,'index allowance refused'):
            seal(root,'refused-reader',source,owner.check)
        self.assertFalse((root/'refused-reader/reader-index-bound.json').exists())
        self.assertFalse((root/'refused-reader/backup.db').exists())

    def test_reader_index_formula_covers_first_and_later_units_and_existing_larger_index(self):
        for frames,expected,existing in [(0,32768,0),(4062,32768,0),(4063,65536,0),
            (8158,65536,0),(8159,98304,0),(1,131072,100000)]:
            root=local_directory();reader=root/'reader';reader.mkdir();database=reader/'dev.db';database.write_bytes(b'x')
            (reader/'dev.db-wal').write_bytes(b'w'*(32+frames*536))
            if existing:(reader/'dev.db-shm').write_bytes(b's'*existing)
            owner=Owner(10*1024**2);bound=reader_index_bound(database,owner.check)
            self.assertEqual(bound['maximumIndexBytes'],expected)
            self.assertEqual(bound['layout']['fileCount'],2)
            self.assertEqual(owner.claims,['reader-index'])
            self.assertEqual(len(owner.plans),1)
            verify_reader_index(database,bound)
            with self.assertRaises(FileExistsError):reader_index_bound(database,owner.check)

    def test_owned_wal_reader_can_create_missing_index_within_allowance_without_bypassing_wal(self):
        root=local_directory();source=root/'new-source.db';writer=sqlite3.connect(source)
        try:
            writer.execute('PRAGMA journal_mode=WAL');writer.execute('PRAGMA wal_autocheckpoint=0')
            writer.execute('CREATE TABLE only_in_wal(value)');writer.execute("INSERT INTO only_in_wal VALUES('retained')");writer.commit()
            reader=root/'reader';reader.mkdir();database=reader/'dev.db'
            for suffix in ('','-wal'):pathlib.Path(str(database)+suffix).write_bytes(pathlib.Path(str(source)+suffix).read_bytes())
            before={suffix:pathlib.Path(str(source)+suffix).read_bytes() for suffix in ('','-wal','-shm')}
            owner=Owner(10*1024**2);bound=reader_index_bound(database,owner.check)
            self.assertFalse(pathlib.Path(str(database)+'-shm').exists())
            db=sqlite3.connect(database.as_uri()+'?mode=ro',uri=True)
            try:
                memory_temporaries(db);db.execute('PRAGMA query_only=ON')
                self.assertEqual(db.execute('SELECT * FROM only_in_wal').fetchall(),[('retained',)])
                self.assertTrue(pathlib.Path(str(database)+'-shm').exists())
                verify_reader_index(database,bound)
            finally:db.close()
            self.assertEqual({suffix:pathlib.Path(str(source)+suffix).read_bytes() for suffix in before},before)
            verify_reader_index(database,bound)
        finally:writer.close()

    def test_reader_index_integrity_refuses_main_wal_index_or_journal_changes(self):
        for mutation in ('main','wal','index','journal'):
            root=local_directory();reader=root/'reader';reader.mkdir();database=reader/'dev.db';database.write_bytes(b'x')
            bound=reader_index_bound(database,Owner(10*1024**2).check)
            if mutation=='main':database.write_bytes(b'y')
            elif mutation=='wal':(reader/'dev.db-wal').write_bytes(b'changed')
            elif mutation=='index':(reader/'dev.db-shm').write_bytes(b'x'*(bound['maximumIndexBytes']+1))
            else:(reader/'dev.db-journal').write_bytes(b'')
            with self.assertRaises(RuntimeError):verify_reader_index(database,bound)

    def test_memory_temp_storage_refuses_compile_override_and_unaccepted_pragma(self):
        class Reply:
            def __init__(self,value):self.value=value
            def __iter__(self):return iter(self.value)
            def fetchone(self):return self.value
        class Connection:
            def __init__(self,options,mode=2):self.options=options;self.mode=mode;self.calls=[]
            def execute(self,sql):
                self.calls.append(sql)
                return Reply([(value,) for value in self.options] if sql=='PRAGMA compile_options' else (self.mode,))
        for options in ([],['TEMP_STORE=0'],['TEMP_STORE=1','TEMP_STORE=2']):
            db=Connection(options)
            with self.assertRaisesRegex(RuntimeError,'build'):memory_temporaries(db)
            self.assertEqual(db.calls,['PRAGMA compile_options'])
        with self.assertRaisesRegex(RuntimeError,'not accepted'):memory_temporaries(Connection(['TEMP_STORE=1'],1))
        for value in (1,2,3):memory_temporaries(Connection(['TEMP_STORE='+str(value)]))

    def test_owned_backup_admission_refusal_leaves_raw_readers_but_no_backup_destination(self):
        root=local_directory();source=root/'new-source.db';db=sqlite3.connect(source)
        db.execute('CREATE TABLE retained_value(id INTEGER)');db.commit();db.close()
        owner=Owner(10*1024**2);original=owner.admit_copy
        def refuse_backup(site,destination,plan):
            if site=='backup':raise RuntimeError('LOCAL backup pre-create refusal')
            original(site,destination,plan)
        owner.admit_copy=refuse_backup
        with self.assertRaisesRegex(RuntimeError,'backup pre-create refusal'):seal(root,'refused-seal',source,owner.check)
        self.assertTrue((root/'refused-seal/raw/dev.db').exists())
        self.assertTrue((root/'refused-seal/reader/dev.db').exists())
        self.assertFalse((root/'refused-seal/backup.db').exists())

    def test_disk_budget_rejects_missing_claim_or_oversize_plan_before_admission_record(self):
        root=local_directory();budget=Budget(1024**2,1024**2,414683521)
        disk=Disk(root,None,None,budget,False);disk.check=lambda *args:None
        plan=copy_layout([1024],1);target=root/'new-copy'
        with self.assertRaises(RuntimeError):disk.admit_copy('triple',target,plan)
        budget.begin('stopped-backup',10**12);budget.claim('triple')
        disk.admit_copy('triple',target,plan)
        self.assertEqual(len(list(root.glob('copy-admission-*.json'))),1)
        with self.assertRaisesRegex(RuntimeError,'reuse'):disk.admit_copy('triple',root/'reused-claim',plan)
        budget.claim('triple')
        with self.assertRaises(RuntimeError):disk.admit_copy('triple',root/'oversize',copy_layout([2*1024**2],1))
        self.assertFalse((root/'oversize').exists());self.assertEqual(len(list(root.glob('copy-admission-*.json'))),1)

    def test_file_hash_growth_is_bounded_to_initial_length_plus_one_original_byte(self):
        root=local_directory();source=root/'new-growing.bin';source.write_bytes(b'x');reads=[]
        actual_fdopen=os.fdopen
        class GrowingStream:
            def __init__(self,stream):self.stream=stream;self.first=True
            def __enter__(self):return self
            def __exit__(self,*args):self.stream.close()
            def read(self,count):
                reads.append(count)
                if self.first:
                    self.first=False
                    with source.open('ab') as output:output.write(b'y'*100000)
                return self.stream.read(count)
        def grow(fd,*args,**kwargs):return GrowingStream(actual_fdopen(fd,*args,**kwargs))
        with patch('retained_files.os.fdopen',side_effect=grow),self.assertRaisesRegex(RuntimeError,'grew during sampling'):
            file_state(source)
        self.assertEqual(reads,[2]);self.assertEqual(source.stat().st_size,100001)


if __name__=='__main__':unittest.main()
