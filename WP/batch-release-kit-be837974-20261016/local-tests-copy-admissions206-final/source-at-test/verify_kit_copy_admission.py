"""New retained local copies/SQLite files only; no filesystem capacity verdict."""
import copy
import os
import pathlib
import sqlite3
import unittest
from unittest.mock import patch
from kit_copy_admission import copy_layout
from kit_budget import Budget
from kit_disk import Disk
from retained_files import clone_backup,copy_triple,copy_tree,file_state,seal
from verify_kit_apache_capture import local_directory


class Owner:
    def __init__(self,maximum):self.maximum=maximum;self.claims=[];self.plans=[];self.checks=0
    def check(self):self.checks+=1
    def claim(self,site):self.claims.append(site)
    def admit_copy(self,site,destination,plan):
        assert not destination.exists()
        self.plans.append((site,destination,plan))
        if plan['declaredAllocationBytes']>self.maximum:raise RuntimeError('LOCAL held copy allowance exhausted')


class CopyAdmissions(unittest.TestCase):
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
        self.assertEqual(owner.claims,['triple','triple','backup'])

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
