"""Real NEW LOCAL file copies exercise the pre-write byte refusal."""
import hashlib
import pathlib
import unittest
from verify_kit_apache_capture import local_directory
from retained_files import copy_file,file_state


class CopyWriteBound(unittest.TestCase):
    def test_growing_source_cannot_write_the_first_or_later_overflow_chunk(self):
        for size in (3,1024**2+3):
            root=local_directory();source=root/'new-source.bin';source.write_bytes(b'x'*(size+1));target=root/'retained-prefix.bin'
            expected={'bytes':size,'sha256':hashlib.sha256(b'x'*size).hexdigest()}
            with self.assertRaisesRegex(RuntimeError,'Source grew'):copy_file(source,target,expected,lambda:None)
            self.assertEqual(target.stat().st_size,0 if size<1024**2 else 1024**2)
            self.assertLessEqual(target.stat().st_size,expected['bytes'])

    def test_exact_empty_and_binary_copies_preserve_source_and_refuse_reused_paths(self):
        for raw in (b'',b'\x00\xff\r\n'*300000):
            root=local_directory();source=root/'new-source.bin';source.write_bytes(raw);before=file_state(source);target=root/'retained-copy.bin';calls=[]
            result=copy_file(source,target,before,lambda:calls.append(True))
            self.assertEqual(target.read_bytes(),raw);self.assertEqual(file_state(source),before)
            self.assertEqual(result['sha256'],before['sha256']);self.assertGreaterEqual(len(calls),2)
            with self.assertRaises(RuntimeError):copy_file(source,target,before,lambda:None)

    def test_missing_hash_bad_limit_or_precheck_failure_precedes_destination_creation(self):
        root=local_directory();source=root/'new-source.bin';source.write_bytes(b'x')
        for i,expected in enumerate(({}, {'bytes':True,'sha256':'a'*64},{'bytes':1,'sha256':'bad'})):
            target=root/('refused-'+str(i))
            with self.assertRaises(RuntimeError):copy_file(source,target,expected,lambda:None)
            self.assertFalse(target.exists())
        target=root/'refused-precheck'
        def refuse():raise RuntimeError('local precheck refusal')
        with self.assertRaisesRegex(RuntimeError,'precheck refusal'):copy_file(source,target,file_state(source),refuse)
        self.assertFalse(target.exists())


if __name__=='__main__':unittest.main()
