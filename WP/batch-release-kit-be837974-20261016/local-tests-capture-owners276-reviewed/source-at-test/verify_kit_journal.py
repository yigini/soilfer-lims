"""Actual local filesystem fault checks; fixtures are retained, never removed."""
import json
import os
import pathlib
import tempfile
import unittest
from unittest import mock
from kit_contract import sha
from kit_journal import Journal,exclusive_record

FIXTURE_ROOT=pathlib.Path(__file__).parent/'journal-local-retained-fixtures'

class DurableEvidence(unittest.TestCase):
    def directory(self):
        FIXTURE_ROOT.mkdir(exist_ok=True)
        return pathlib.Path(tempfile.mkdtemp(prefix='owned-',dir=FIXTURE_ROOT)).resolve()

    def test_append_chain_and_terminal_are_real_exclusive_bytes(self):
        d=self.directory();j=Journal(d,str(d),'a'*64,require_directory_sync=os.name=='posix')
        a=j.append('stopIntent',{'notAResult':True});b=j.append('stopResult',{'exitCode':137})
        self.assertEqual(json.loads((d/b['file']).read_bytes())['previous'],a)
        self.assertEqual(sha((d/a['file']).read_bytes()),a['sha256'])
        final=j.seal({'status':'SYNTHETIC_TEST_ONLY'})
        self.assertEqual(json.loads((d/final['file']).read_bytes())['journalTail'],b)
        with self.assertRaises(RuntimeError):j.append('replay',{})
        with self.assertRaises(RuntimeError):j.seal({})
        with self.assertRaises(FileExistsError):Journal(d,str(d),'a'*64,require_directory_sync=False)

    def test_existing_record_is_never_overwritten(self):
        d=self.directory();original=exclusive_record(d,'one.json',{'original':True},False)
        with self.assertRaises(FileExistsError):exclusive_record(d,'one.json',{'replacement':True},False)
        self.assertEqual(sha((d/'one.json').read_bytes()),original['sha256'])

    def test_escape_and_aliased_record_cannot_redirect_writes(self):
        d=self.directory()
        for name in ('../escape.json','/absolute.json','sub/file.json','a\\b.json',''):
            with self.subTest(name=name),self.assertRaises(RuntimeError):exclusive_record(d,name,{},False)
        # Symlink privileges vary on Windows; basename containment is always
        # exercised above. The actual host is additionally required to fsync.
        if os.name=='posix':
            target=d/'original.json';target.write_bytes(b'original')
            (d/'alias.json').symlink_to(target)
            with self.assertRaises(FileExistsError):exclusive_record(d,'alias.json',{},True)
            self.assertEqual(target.read_bytes(),b'original')

    def test_failed_atomic_publish_never_exposes_a_partial_final_record(self):
        d=self.directory()
        with mock.patch('kit_journal.os.link',side_effect=OSError('SYNTHETIC_PUBLICATION_FAILURE')):
            with self.assertRaises(OSError):exclusive_record(d,'atomic.json',{'complete':'SYNTHETIC_ONLY'},False)
        self.assertFalse((d/'atomic.json').exists())
        self.assertEqual(json.loads((d/'atomic.json.pending').read_bytes()),{'complete':'SYNTHETIC_ONLY'})
        with self.assertRaises(FileExistsError):exclusive_record(d,'atomic.json',{'different':True},False)

if __name__=='__main__':unittest.main()
