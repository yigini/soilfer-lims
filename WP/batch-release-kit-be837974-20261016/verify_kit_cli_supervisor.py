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
            self.assertEqual(result.returncode,1);self.assertEqual(result.stderr,b'')

    def test_actual_child_completion_stays_alive_until_final_memory_permission(self):
        self.exercise('console.log("SYNTHETIC_CHILD_ONLY")',0,False)

    def test_stopped_integrity_command_is_exact_and_uses_only_readonly_sql(self):
        node=shutil.which('node');self.assertIsNotNone(node)
        bootstrap='''const assert=require('node:assert/strict');
const guard=require(process.argv[1]);const integrity=require(process.argv[2]);
assert.deepEqual(guard.validateMain(['/tmp','/release/stopped_integrity.cjs','--db','/app/server/prisma/dev.db']).child,
 ['/release/stopped_integrity.cjs','--db','/app/server/prisma/dev.db']);
assert.throws(()=>guard.validateMain(['/tmp','/release/stopped_integrity.cjs','--db','/other.db']));
for (const failure of ['none','integrity','fk']) {
 const calls=[];
 class Database {
  constructor(filename,options) {assert.equal(filename,'SYNTHETIC_ONLY');assert.deepEqual(options,{readonly:true,fileMustExist:true});}
  pragma(sql) {calls.push(sql);if(sql==='query_only = ON')return [];
   if(sql==='integrity_check')return [{integrity_check:failure==='integrity'?'SYNTHETIC_BAD':'ok'}];
   if(sql==='foreign_key_check')return failure==='fk'?[{table:'SYNTHETIC_ONLY'}]:[];
   throw new Error('UNREVIEWED_SQL');}
  close(){calls.push('close');}
 }
 if(failure==='none')assert.equal(integrity.check('SYNTHETIC_ONLY',Database).integrity,'ok');
 else assert.throws(()=>integrity.check('SYNTHETIC_ONLY',Database));
 assert.deepEqual(calls,['query_only = ON','integrity_check','foreign_key_check','close']);
}'''
        FIXTURES.mkdir(exist_ok=True);d=pathlib.Path(tempfile.mkdtemp(prefix='integrity-',dir=FIXTURES))
        result=subprocess.run([node,'-e',bootstrap,str(ROOT/'cli_guard.cjs'),str(ROOT/'stopped_integrity.cjs')],capture_output=True)
        (d/'stdout-original.txt').write_bytes(result.stdout);(d/'stderr-original.txt').write_bytes(result.stderr)
        self.assertEqual(result.returncode,0,result.stderr.decode())

    def test_failed_child_is_retained_and_cannot_be_reported_as_success(self):
        self.exercise('process.exitCode=3',1,False)

    def test_wrong_completion_permission_refuses_exit(self):
        self.exercise('console.log("SYNTHETIC_CHILD_ONLY")',1,True)

    def exercise(self,child_code,want,wrong):
        node=shutil.which('node');self.assertIsNotNone(node);FIXTURES.mkdir(exist_ok=True)
        d=pathlib.Path(tempfile.mkdtemp(prefix='owned-',dir=FIXTURES)).resolve()
        from kit_cli_output import admission
        exclusive_record(d,'cli-output-admission.json',admission(['-e',child_code]),require_directory_sync=os.name=='posix')
        bootstrap='require('+json.dumps(str(ROOT/'cli_guard.cjs'))+').runChild('+json.dumps(str(d))+',["-e",'+json.dumps(child_code)+'],()=>({check(){},close(){}})).catch(()=>process.exitCode=1)' # Explicit LOCAL Linux-directory stand-in.
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
