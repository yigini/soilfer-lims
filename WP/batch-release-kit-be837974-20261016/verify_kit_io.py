"""Real local child-process calls, with retained synthetic output only."""
import json
import os
import pathlib
import sys
import tempfile
import unittest
from unittest.mock import patch
from kit_io import CommandRunner

FIXTURES=pathlib.Path(__file__).parent/'transport-local-retained-fixtures'
class PrivateTransport(unittest.TestCase):
    def runner(self):
        FIXTURES.mkdir(exist_ok=True);root=pathlib.Path(tempfile.mkdtemp(prefix='owned-',dir=FIXTURES)).resolve()
        return root,CommandRunner(root,lambda _:None,require_directory_sync=os.name=='posix',programs={sys.executable})

    def test_failure_streams_and_metadata_precede_exit_predicate(self):
        root,run=self.runner()
        with self.assertRaises(RuntimeError):run.run([sys.executable,'-c',"import sys;print('SYNTHETIC_STDOUT');print('SYNTHETIC_STDERR',file=sys.stderr);sys.exit(3)"],'fail',5)
        result=json.loads((root/'fail-command-result.json').read_bytes())
        self.assertEqual(result['exitCode'],3)
        self.assertIn(b'SYNTHETIC_STDOUT',(root/'fail.stdout').read_bytes())
        self.assertIn(b'SYNTHETIC_STDERR',(root/'fail.stderr').read_bytes())
        self.assertTrue(result['stderr']['rawHostOnly'])
        self.assertEqual(set(result),{'exitCode','errorType','elapsedSeconds','stdout','stderr','neverRetry','streamCapture'})
        self.assertTrue(result['streamCapture']['allOriginalBytesRetained'])

    def test_stderr_on_success_still_refuses_after_retaining_bytes(self):
        root,run=self.runner()
        with self.assertRaises(RuntimeError):run.run([sys.executable,'-c',"import sys;print('SYNTHETIC_STDERR',file=sys.stderr)"],'stderr',5)
        self.assertEqual(json.loads((root/'stderr-command-result.json').read_bytes())['exitCode'],0)

    def test_labels_are_single_use_and_no_shell_or_container_removal(self):
        root,run=self.runner();argv=[sys.executable,'-c',"print('SYNTHETIC_OK')"]
        out,err,_=run.run(argv,'once',5);self.assertIn(b'SYNTHETIC_OK',out);self.assertEqual(err,b'')
        with self.assertRaises(FileExistsError):run.run(argv,'once',5)
        for changed in (['cmd','/c','echo no'],[sys.executable,'--rm']):
            with self.assertRaises(RuntimeError):run.run(changed,'forbidden',5)
        self.assertFalse((root/'forbidden-command-intent.json').exists())

    def test_timeout_retains_partial_output_and_never_retries(self):
        root,run=self.runner()
        with self.assertRaises(RuntimeError):run.run([sys.executable,'-u','-c',"import time;print('SYNTHETIC_PARTIAL');time.sleep(10)"],'timeout',1)
        result=json.loads((root/'timeout-command-result.json').read_bytes())
        self.assertEqual(result['errorType'],'RuntimeError')
        self.assertIn(b'SYNTHETIC_PARTIAL',(root/'timeout.stdout').read_bytes())
        self.assertIsNone(result['exitCode'])
        self.assertFalse(result['streamCapture']['allOriginalBytesRetained'])

    def test_fast_child_exact_limit_preserves_binary_originals_through_eof(self):
        root,run=self.runner();raw=bytes(range(256))*32
        with patch('kit_io.OUTPUT_LIMIT',8192),patch('kit_io.OUTPUT_RETAINED_LIMIT',8193):
            out,err,result=run.run([sys.executable,'-c',
                "import os;raw=bytes(range(256))*32;os.write(1,raw);os.write(2,raw[::-1])"],
                'exact-bound',5,allow_stderr=True)
        self.assertEqual(out,raw);self.assertEqual(err,raw[::-1])
        self.assertTrue(result['streamCapture']['allOriginalBytesRetained'])
        self.assertEqual(result['streamCapture']['eofObserved'],{'stdout':True,'stderr':True})

    def test_burst_between_polls_cannot_write_beyond_one_sentinel_byte(self):
        root,run=self.runner()
        with patch('kit_io.OUTPUT_LIMIT',8192),patch('kit_io.OUTPUT_RETAINED_LIMIT',8193):
            with self.assertRaises(RuntimeError):run.run([sys.executable,'-c',
                "import os;os.write(1,b'A'*262144);os.write(2,b'B'*262144)"],
                'burst-bound',5,allow_stderr=True)
        result=json.loads((root/'burst-bound-command-result.json').read_bytes())
        self.assertEqual(result['errorType'],'CommandOutputLimitError')
        self.assertFalse(result['streamCapture']['allOriginalBytesRetained'])
        self.assertTrue(any(result['streamCapture']['outputLimitExceeded'].values()))
        for name,letter in [('stdout',b'A'),('stderr',b'B')]:
            original=(root/('burst-bound.'+name)).read_bytes()
            self.assertLessEqual(len(original),8193)
            self.assertEqual(original,letter*len(original))
            self.assertEqual(result[name]['bytes'],len(original))

    def test_child_exit_does_not_bypass_final_output_bound(self):
        root,run=self.runner()
        with patch('kit_io.OUTPUT_LIMIT',8192),patch('kit_io.OUTPUT_RETAINED_LIMIT',8193):
            with self.assertRaises(RuntimeError):run.run([sys.executable,'-c',
                "import os;os.write(1,b'X'*8193)"],'exit-bound',5)
        result=json.loads((root/'exit-bound-command-result.json').read_bytes())
        self.assertEqual(result['stdout']['bytes'],8193)
        self.assertEqual(result['errorType'],'CommandOutputLimitError')
        self.assertFalse(result['streamCapture']['allOriginalBytesRetained'])

    def test_stdin_and_two_full_pipes_do_not_deadlock(self):
        root,run=self.runner();raw=b'SYNTHETIC_INPUT'*1000
        out,err,result=run.run([sys.executable,'-c',
            "import os,sys;os.write(1,b'O'*262144);os.write(2,b'E'*262144);raw=sys.stdin.buffer.read();os.write(1,raw)"],
            'stdin-pipes',5,input_bytes=raw,allow_stderr=True)
        self.assertEqual(out,b'O'*262144+raw);self.assertEqual(err,b'E'*262144)
        self.assertTrue(result['streamCapture']['allOriginalBytesRetained'])

if __name__=='__main__':unittest.main()
