"""Actual local Node children; synthetic outputs only, never an application CLI."""
import hashlib
import json
import pathlib
import shutil
import subprocess
import tempfile
import time
import unittest
import os
from kit_journal import exclusive_record

ROOT=pathlib.Path(__file__).resolve().parent
FIXTURES=ROOT/'cli-local-retained-fixtures'

class CliSupervisor(unittest.TestCase):
    def test_main_rejects_old_installer_or_policy_apply_before_any_child(self):
        node=shutil.which('node');self.assertIsNotNone(node)
        for script,mode in [('restore_db.js','--apply'),('install_lab_policy_schema.js','--apply'),('install_sample_containers.js','--unknown')]:
            result=subprocess.run([node,str(ROOT/'cli_guard.cjs'),'/tmp','/app/server/scripts/'+script,'--db','/app/server/prisma/dev.db',mode],capture_output=True)
            self.assertEqual(result.returncode,1);self.assertIn(b'invocation refused',result.stderr)

    def test_actual_child_completion_stays_alive_until_final_memory_permission(self):
        self.exercise('console.log("SYNTHETIC_CHILD_ONLY")',0,False)

    def test_failed_child_is_retained_and_cannot_be_reported_as_success(self):
        self.exercise('process.exitCode=3',1,False)

    def test_wrong_completion_permission_refuses_exit(self):
        self.exercise('console.log("SYNTHETIC_CHILD_ONLY")',1,True)

    def exercise(self,child_code,want,wrong):
        node=shutil.which('node');self.assertIsNotNone(node);FIXTURES.mkdir(exist_ok=True)
        d=pathlib.Path(tempfile.mkdtemp(prefix='owned-',dir=FIXTURES)).resolve()
        bootstrap='require('+json.dumps(str(ROOT/'cli_guard.cjs'))+').runChild('+json.dumps(str(d))+',["-e",'+json.dumps(child_code)+'])'
        with (d/'stdout-original.txt').open('xb') as out,(d/'stderr-original.txt').open('xb') as err:
            process=subprocess.Popen([node,'-e',bootstrap],stdout=out,stderr=err)
            try:
                deadline=time.monotonic()+10
                while not (d/'cli-child-complete.json').exists():
                    if process.poll() is not None or time.monotonic()>deadline:self.fail('Synthetic child did not reach retained completion')
                    time.sleep(0.02)
                raw=(d/'cli-child-complete.json').read_bytes()
                self.assertIsNone(process.poll(),'Wrapper exited before final memory permission')
                completion=json.loads(raw);self.assertEqual(completion['childStatus'],3 if want and not wrong else 0)
                exclusive_record(d,'cli-exit-permit.json',{'childCompletionSha256':'0'*64 if wrong else hashlib.sha256(raw).hexdigest(),'finalHostMemoryEventsCaptured':True},require_directory_sync=os.name=='posix')
                self.assertEqual(process.wait(timeout=10),want)
            finally:
                if process.poll() is None:process.terminate();process.wait(timeout=5)

if __name__=='__main__':unittest.main()
