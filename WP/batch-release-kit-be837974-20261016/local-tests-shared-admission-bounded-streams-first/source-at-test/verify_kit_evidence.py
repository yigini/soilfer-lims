"""Shared admission guards with NEW local retained files, never host evidence."""
import json
import os
import pathlib
import sys
import tempfile
import unittest
from unittest.mock import patch
import kit_evidence as evidence
from kit_io import CommandRunner
from kit_journal import exclusive_record
from retained_files import write_new

FIXTURES=pathlib.Path(__file__).parent/'evidence-local-retained-fixtures'

def directory():
    FIXTURES.mkdir(exist_ok=True)
    return pathlib.Path(tempfile.mkdtemp(prefix='owned-',dir=FIXTURES)).resolve()

def ledger(root,**shares):
    return evidence.EvidenceLedger(root,{**dict.fromkeys(evidence.SHARES,1024**2),**shares})

class SharedEvidence(unittest.TestCase):
    def test_each_covered_producer_has_one_share_across_all_owners(self):
        root=directory();book=ledger(root,memory=4*4096,controller=2*4096)
        with patch('kit_evidence._runtime',book):
            write_new(root/'206-apply-memory-000001.json',{'synthetic':True})
            write_new(root/'candidate-memory-000001.json',{'synthetic':True})
            with self.assertRaises(RuntimeError):write_new(root/'preapply-predecessor-memory-000001.json',{'synthetic':True})
            write_new(root/'controller-memory-before.json',{'synthetic':True})
            with self.assertRaises(RuntimeError):write_new(root/'controller-memory-watch-000001.json',{'synthetic':True})
        self.assertFalse((root/'preapply-predecessor-memory-000001.json').exists())
        self.assertFalse((root/'controller-memory-watch-000001.json').exists())
        self.assertEqual(book.summary()['chargedOrReservedBytes']['memory'],4*4096)
        self.assertEqual(book.summary()['openReservations'],0)
        self.assertFalse(book.summary()['fullGlobalEvidenceClosure'])

    def test_atomic_record_charges_data_once_and_both_retained_names(self):
        root=directory();book=ledger(root,journal=3*4096)
        with patch('kit_evidence._runtime',book):
            exclusive_record(root,'synthetic.json',{'synthetic':True},os.name=='posix')
            with self.assertRaises(RuntimeError):exclusive_record(root,'refused.json',{'synthetic':True},False)
        self.assertEqual(book.used['journal'],3*4096)
        self.assertTrue(os.path.samefile(root/'synthetic.json',root/'synthetic.json.pending'))
        self.assertFalse((root/'refused.json.pending').exists())
        self.assertEqual(book.summary()['directoryEntriesCounted'],2)

    def test_nested_metadata_counts_all_new_directories_and_entries_once(self):
        root=directory();nested=root/'seal'/'raw';nested.mkdir(parents=True);book=ledger(root)
        with patch('kit_evidence._runtime',book):
            write_new(nested/'copy-authority.json',{'synthetic':True})
            write_new(nested/'snapshot-handoff.json',{'synthetic':True})
        self.assertEqual(book.used['journal'],2*3*4096+2*2*4096)
        self.assertEqual(book.summary()['nestedDirectoriesCounted'],2)
        self.assertEqual(book.summary()['directoryEntriesCounted'],2)
        self.assertEqual(book.summary()['openReservations'],0)

    def test_failed_write_reservation_cannot_be_reused_and_unknown_root_refuses(self):
        root=directory();book=ledger(root);path=root/'memory-test.stdout'
        ticket=book.reserve((path,),100,'commands')
        with self.assertRaises(RuntimeError):book.reserve((path,),100,'commands')
        with self.assertRaises(RuntimeError):book.settle(ticket,101)
        self.assertIn(ticket,book.open)
        book.settle(ticket,0)
        with self.assertRaises(RuntimeError):book.settle(ticket,0)
        with self.assertRaises(RuntimeError):book.reserve((root.parent/'foreign.stdout',),100,'commands')
        self.assertEqual(book.used['commands'],4096)

    def test_real_command_reserves_complete_streams_before_launch_then_settles(self):
        root=directory();book=ledger(root,commands=8*4096)
        run=CommandRunner(root,lambda _:None,os.name=='posix',{sys.executable})
        with patch('kit_evidence._runtime',book),patch('kit_io.OUTPUT_LIMIT',8192),patch('kit_io.OUTPUT_RETAINED_LIMIT',8193):
            out,err,result=run.run([sys.executable,'-c',"print('SYNTHETIC_SHARED_ADMISSION')"],'admitted',5)
        self.assertTrue(result['streamCapture']['allOriginalBytesRetained'])
        self.assertEqual(book.used['commands'],3*4096)
        self.assertEqual(book.summary()['openReservations'],0)
        self.assertTrue(out.startswith(b'SYNTHETIC'));self.assertFalse(err)

    def test_insufficient_stream_admission_never_launches_child(self):
        root=directory();book=ledger(root,commands=4096)
        run=CommandRunner(root,lambda _:None,False,{sys.executable})
        with patch('kit_evidence._runtime',book),patch('kit_io.subprocess.Popen') as spawn:
            with self.assertRaises(RuntimeError):run.run([sys.executable,'-c','print(1)'],'no-room',5)
            self.assertFalse(spawn.called)
        self.assertTrue((root/'no-room-command-intent.json').exists())
        self.assertFalse((root/'no-room.stdout').exists())

    def test_existing_4gib_reserve_is_not_reinterpreted_as_covered_global_closure(self):
        root=directory();book=evidence.EvidenceLedger(root)
        summary=book.summary()
        self.assertEqual(summary['coveredProducerMaximumBytes'],3*1024**3)
        self.assertEqual(summary['unassignedWithinExisting4GiBBytes'],1024**3)
        self.assertFalse(summary['fullGlobalEvidenceClosure'])
        with patch('kit_evidence._runtime',None):
            self.assertIs(evidence.bind_runtime(root),evidence._runtime)
            with self.assertRaises(RuntimeError):evidence.bind_runtime(root)
        with self.assertRaises(RuntimeError):evidence.EvidenceLedger(root,dict.fromkeys(evidence.SHARES,1024**3))

if __name__=='__main__':unittest.main()
