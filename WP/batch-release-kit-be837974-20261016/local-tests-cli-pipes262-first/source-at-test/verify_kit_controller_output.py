"""Real LOCAL binary pipes and independent closure, never a host controller."""
import ast
import copy
import os
import pathlib
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch
import controller_output as output
import kit_evidence as evidence

HERE=pathlib.Path(__file__).resolve().parent
FIXTURES=HERE/'controller-output-local-retained-fixtures'


def directory():
    FIXTURES.mkdir(exist_ok=True)
    return pathlib.Path(tempfile.mkdtemp(prefix='owned-',dir=FIXTURES)).resolve()


def closed_controller(root,code=0):
    # The real pipe transport runs a new LOCAL child. The application's
    # argv is a tested stand-in, explicitly NOT a production controller run.
    def spawn(argv,**kwargs):
        if argv!=output.controller_argv(root):raise AssertionError('Exact intended controller argv differs')
        return subprocess.Popen([sys.executable,'-B','-c',
            "import os,sys;os.write(1,b'LOCAL_CONTROLLER_CLOSED\\n');sys.exit("+str(code)+")"],**kwargs)
    return output.capture_controller(root,output.controller_argv(root),False,spawn=spawn)


class ControllerOutput(unittest.TestCase):
    def test_binary_simultaneous_fast_exit_exact_and_empty_full_originals(self):
        for size in (0,4096,262144):
            with self.subTest(size=size):
                root=directory();raw=bytes(range(256))*(size//256)
                program="import os,threading;raw=bytes(range(256))*"+str(size//256)+";t=threading.Thread(target=lambda:os.write(2,raw));t.start();os.write(1,raw);t.join()"
                result=output.capture_controller(root,[sys.executable,'-B','-c',program],False,max(size,4096))
                self.assertTrue(result['completeOriginals']);self.assertEqual(result['status'],0)
                for name in ('stdout','stderr'):
                    self.assertEqual((root/('controller-original.'+name)).read_bytes(),raw)
                    self.assertTrue(result['streams'][name]['eof']);self.assertFalse(result['streams'][name]['overflow'])

    def test_burst_overflow_retains_strict_sentinel_and_never_kills_child_or_adds_deadline(self):
        for stream in (1,2):
            with self.subTest(stream=stream):
                root=directory();finished=root/'LOCAL_CHILD_COMPLETED_AFTER_OVERFLOW'
                program="import os,pathlib;os.write("+str(stream)+",b'X'*(8*1024**2));pathlib.Path("+repr(str(finished))+").write_bytes(b'FINISHED')"
                def spawn(argv,**kwargs):
                    self.assertNotIn('timeout',kwargs)
                    process=subprocess.Popen(argv,**kwargs)
                    for name in ('terminate','kill','send_signal'):
                        setattr(process,name,lambda *a:(_ for _ in ()).throw(AssertionError('Capture must never signal controller')))
                    return process
                result=output.capture_controller(root,[sys.executable,'-B','-c',program],False,4096,spawn)
                self.assertEqual(finished.read_bytes(),b'FINISHED');self.assertEqual(result['status'],0)
                self.assertFalse(result['completeOriginals']);self.assertFalse(result['controllerSignalledByCapture'])
                name='stdout' if stream==1 else 'stderr'
                self.assertEqual((root/('controller-original.'+name)).stat().st_size,4097)
                self.assertTrue(result['streams'][name]['overflow']);self.assertTrue(result['streams'][name]['unretainedBytesObserved'])
                with self.assertRaises(RuntimeError):output.controller_output_closure(root,0)

    def test_prelaunch_namespace_admission_refuses_existing_alias_and_impossible_limit(self):
        root=directory();(root/'controller-original.stderr').write_bytes(b'PRESERVE')
        with patch('controller_output.subprocess.Popen') as spawn:
            with self.assertRaises(RuntimeError):output.capture_controller(root,['LOCAL_UNUSED'],False)
            with self.assertRaises(RuntimeError):output.capture_controller(directory(),['LOCAL_UNUSED'],False,output.CONTROLLER_STREAM_LIMIT+1)
            self.assertFalse(spawn.called)
        self.assertFalse((root/'controller-output-intent.json.pending').exists())
        self.assertEqual((root/'controller-original.stderr').read_bytes(),b'PRESERVE')

    def test_nonzero_and_spawn_failure_keep_full_original_outcome_without_retry(self):
        root=directory();result=output.capture_controller(root,[sys.executable,'-B','-c',"import os,sys;os.write(2,b'ORIGINAL\\n');sys.exit(7)"],False)
        self.assertTrue(result['completeOriginals']);self.assertEqual(result['status'],7)
        self.assertEqual((root/'controller-original.stderr').read_bytes(),b'ORIGINAL\n')
        with self.assertRaises(RuntimeError):output.capture_controller(root,['UNUSED'],False)
        root=directory();result=output.capture_controller(root,['LOCAL_NONEXISTENT_CONTROLLER_EXECUTABLE'],False)
        self.assertFalse(result['completeOriginals']);self.assertEqual(result['errorType'],'FileNotFoundError')
        self.assertEqual((root/'controller-original.stdout').stat().st_size,0)

    def test_actual_independent_closure_requires_status_originals_and_exact_control_pairs(self):
        for status in (0,1):
            root=directory();closed_controller(root,status)
            self.assertEqual(output.controller_output_closure(root,status)['status'],status)
            with self.assertRaises(RuntimeError):output.controller_output_closure(root,1-status)
            original=root/'controller-original.stdout';original.chmod(0o600);original.write_bytes(b'MUTATED');original.chmod(0o400)
            with self.assertRaises(RuntimeError):output.controller_output_closure(root,status)
        root=directory()
        for name in ('controller-output-closed.json','controller-output-closed.json.pending'):
            (root/name).write_bytes(output.output_canonical({'LOCAL_FOREIGN_PAIR':True}));(root/name).chmod(0o400)
        with self.assertRaises(RuntimeError):output.output_read_record(root,'controller-output-closed.json')

    def test_missing_partial_oversized_and_falsified_closure_cannot_allow_serving(self):
        with self.assertRaises((RuntimeError,FileNotFoundError)):output.controller_output_closure(directory(),0)
        for mutation in ('eof','overflow','bytes','status','argv','complete','unretained','extra'):
            with self.subTest(mutation=mutation):
                root=directory();closed=closed_controller(root)
                value=copy.deepcopy(closed)
                if mutation=='eof':value['streams']['stdout']['eof']=False
                elif mutation=='overflow':value['streams']['stdout']['overflow']=True
                elif mutation=='bytes':value['streams']['stdout']['bytes']+=1
                elif mutation=='status':value['status']=False
                elif mutation=='argv':value['childArgv'].append('--UNREVIEWED')
                elif mutation=='complete':value['completeOriginals']=False
                elif mutation=='unretained':value['streams']['stderr']['unretainedBytesObserved']=True
                else:value['extra']=True
                path=root/'controller-output-closed.json';path.chmod(0o600);path.write_bytes(output.output_canonical(value));path.chmod(0o400)
                with self.assertRaises(RuntimeError):output.controller_output_closure(root,0)
        root=directory();closed_controller(root)
        path=root/'controller-output-intent.json';path.chmod(0o600);path.write_bytes(b'X'*8193);path.chmod(0o400)
        with self.assertRaises(RuntimeError):output.controller_output_closure(root,0)

    def test_new_namespace_is_partitioned_inside_existing_pool_and_cannot_be_double_spent(self):
        self.assertEqual(sum(evidence.SHARES.values())+output.CONTROLLER_OUTPUT_BYTES,3200*1024**2)
        book=evidence.EvidenceLedger(directory())
        for name in output.CONTROLLER_NAMES:
            with self.assertRaises(RuntimeError):book.reserve((book.root/name,),1,'journal')
        from kit_cli_evidence import CLI_ENVELOPE
        self.assertEqual(sum(CLI_ENVELOPE.values()),3044*1024**2)
        self.assertLess(sum(CLI_ENVELOPE.values())+2*(64*1024**2+8192),sum(evidence.SHARES.values()))
        self.assertFalse(book.summary()['fullGlobalEvidenceClosure'])
        with self.assertRaises(RuntimeError):evidence.EvidenceLedger(directory(),{**evidence.SHARES,'journal':640*1024**2})

    def test_stream_write_failure_does_not_signal_or_interrupt_the_child(self):
        root=directory();finished=root/'LOCAL_CHILD_COMPLETED_AFTER_WRITE_FAILURE'
        command=[sys.executable,'-B','-c',"import os,pathlib;os.write(1,b'LOCAL_STREAM_WRITE_FAILURE');os.write(2,b'ORIGINAL_STDERR');pathlib.Path("+repr(str(finished))+").write_bytes(b'FINISHED')"]
        def spawn(argv,**kwargs):return subprocess.Popen(command,**kwargs)
        real_write=os.write
        def write(descriptor,data):
            if bytes(data)==b'LOCAL_STREAM_WRITE_FAILURE':raise OSError('LOCAL_ENOSPC_STANDIN')
            return real_write(descriptor,data)
        with patch('controller_output.os.write',side_effect=write):
            result=output.capture_controller(root,['LOCAL_STANDIN_INTENT_ONLY'],False,spawn=spawn)
        self.assertEqual(finished.read_bytes(),b'FINISHED');self.assertEqual(result['status'],0)
        self.assertFalse(result['completeOriginals']);self.assertFalse(result['controllerSignalledByCapture'])
        self.assertEqual(result['errorType'],'OSError')

    def test_bootstrap_refuses_consumed_namespace_without_adding_any_failure_record(self):
        root=directory();path=root/'controller-original.stdout';path.write_bytes(b'RETAIN_THIS_OLD_ORIGINAL')
        from retained_contract import ROOT
        with patch('controller_output.os.name','posix'),patch('controller_output.output_root',return_value=root),\
             patch('controller_output.sys.argv',['controller_output.py','--root',str(ROOT)]),\
             patch('controller_output.capture_controller') as capture:
            self.assertEqual(output.main(),1);self.assertFalse(capture.called)
        self.assertEqual([p.name for p in root.iterdir()],['controller-original.stdout'])
        self.assertEqual(path.read_bytes(),b'RETAIN_THIS_OLD_ORIGINAL')

    def test_hook_refuses_missing_transport_closure_before_any_serving_container_query(self):
        import kit_stop_lifecycle as hook
        from kit_contract import HEAD,IMAGE,canonical,sha
        root=directory();manifest={'LOCAL_ONLY':True};receipt_raw=canonical({'root':str(hook.ROOT),
            'sourceManifestSha256':sha(canonical(manifest)),'head':HEAD,'image':IMAGE,
            'status':'DEPLOYED_AWAITING_CLAUDIO_POSTCHECK','ingressReopened':True})
        values={'production-receipt.json':receipt_raw,'controller-completion-permit.json':canonical({
            'root':str(hook.ROOT),'manifestSha256':sha(canonical(manifest)),
            'status':'DEPLOYED_AWAITING_CLAUDIO_POSTCHECK',
            'receipt':{'file':'production-receipt.json','sha256':sha(receipt_raw),'bytes':len(receipt_raw)}}),
            'production-gate-consumed.json':canonical({'manifestSha256':sha(canonical(manifest)),'exclusive':True})}
        with patch('kit_stop_lifecycle.private_file',side_effect=lambda _,name:values[name]),\
             patch('kit_stop_lifecycle.controller_output_closure',wraps=output.controller_output_closure) as closure,\
             patch('kit_stop_lifecycle.candidate_projection') as inspect:
            with self.assertRaises(FileNotFoundError):hook.serving_permit(root,manifest,lambda argv:None)
            closure.assert_called_once_with(root,0);self.assertFalse(inspect.called)

    def test_pinned_controller_and_hook_produce_no_inherited_child_or_unbounded_journal_output(self):
        tree=ast.parse((HERE/'controller_output.py').read_bytes())
        forbidden={'kill','terminate','send_signal'}
        self.assertFalse(any(isinstance(n,ast.Attribute) and n.attr in forbidden for n in ast.walk(tree)))
        self.assertFalse(any(isinstance(n,ast.Call) and isinstance(n.func,ast.Name) and n.func.id=='print' for n in ast.walk(tree)))
        import build_stop_post
        hook=ast.parse(build_stop_post.MAIN)
        self.assertFalse(any(isinstance(n,ast.Call) and isinstance(n.func,ast.Name) and n.func.id=='print' for n in ast.walk(hook)))
        from kit_launch_programs import LAUNCH
        self.assertIn('--property=StandardOutput=null',LAUNCH);self.assertIn('--property=StandardError=null',LAUNCH)
        self.assertIn('tooling/controller_output.py',LAUNCH)
        self.assertIn("controller_output_closure(root,0 if receipt['status']",(HERE/'kit_stop_lifecycle.py').read_text())


if __name__=='__main__':unittest.main()
