"""Real local child-process calls, with retained synthetic output only."""
import json
import os
import pathlib
import sys
import tempfile
import unittest
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
        self.assertEqual(set(result),{'exitCode','errorType','elapsedSeconds','stdout','stderr','neverRetry'})

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

if __name__=='__main__':unittest.main()
