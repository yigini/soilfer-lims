"""Real LOCAL pipe/files; cgroup, provider and application command stand-ins.

The generated hook is checked as source only and is never executed.
"""
import ast
import builtins
import contextlib
import copy
import os
import pathlib
import subprocess
import sys
import symtable
import tempfile
import types
import unittest
from unittest.mock import patch
import controller_output as common
import capture_controller_output as transport
import kit_capture_controller as memory
import kit_capture_outcome as outcome
import kit_capture_review as review
import verify_kit_capture_review as review_fixtures
import verify_kit_capture_owned as owner_fixtures
import kit_capture_owned as owners
from kit_contract import canonical,sha
from kit_capture_owned import CAPTURE_UNIT
from kit_journal import exclusive_record
from retained_contract import ROOT
from retained_memory import NON_RECLAIMABLE_FIELDS,NON_RECLAIMABLE_MAX

HERE=pathlib.Path(__file__).resolve().parent
FIXTURES=HERE/'capture-controller-local-retained-fixtures'


def directory():
    FIXTURES.mkdir(exist_ok=True)
    return pathlib.Path(tempfile.mkdtemp(prefix='owned-',dir=FIXTURES)).resolve()


def kernel():
    counters={key:1 for key in NON_RECLAIMABLE_FIELDS}
    counters.update(file=10,slab_reclaimable=1,pgscan=0,pgsteal=0)
    raws={'memory.stat':''.join(k+' '+str(v)+'\n' for k,v in counters.items()).encode(),
        'memory.events':b'oom 0\noom_kill 0\nmax 999\nhigh 123\n','memory.current':b'805306368\n',
        'memory.peak':b'805306368\n','memory.max':b'805306368\n','memory.swap.max':b'0\n',
        'cgroup':('0::/system.slice/'+CAPTURE_UNIT+'\n').encode(),
        'mountinfo':b'29 23 0:26 / /sys/fs/cgroup rw - cgroup2 cgroup rw\n'}
    reads=[]
    def reader(path,limit):reads.append(str(path));return raws[pathlib.Path(path).name]
    def resolver(path):return {'path':path.as_posix(),'device':7,'inode':8}
    return raws,reads,reader,resolver


@contextlib.contextmanager
def projected(root):
    with contextlib.ExitStack() as stack:
        for module in (transport,memory,outcome):stack.enter_context(patch.object(module,'CAPTURE_ROOT',root))
        yield


def closed(root,status=0,raw=b'LOCAL_CAPTURE_CONTROLLER\x00\xff'):
    def spawn(argv,**kwargs):
        if argv!=transport.capture_controller_argv(root):raise AssertionError('Exact capture argv differs')
        return subprocess.Popen([sys.executable,'-B','-c',
            'import os,sys;os.write(1,'+repr(raw)+');sys.exit('+str(status)+')'],**kwargs)
    # Source binding here is a synthetic LOCAL stand-in. Real stored-source
    # predicates are covered separately, and fresh provider belongs to child.
    with patch.object(transport,'capture_source_review',return_value={'LOCAL_SOURCE_STANDIN':True}):
        return transport.capture_controller_transport(root,{}, {},False,spawn)


class CaptureController(unittest.TestCase):
    def test_pure_source_refusal_precedes_root_stat_or_spawn_and_foreign_root_refuses(self):
        with patch.object(transport,'output_root') as stat_root,patch.object(transport,'capture_controller') as spawn:
            with self.assertRaises(RuntimeError):transport.capture_controller_transport(transport.CAPTURE_ROOT,{}, {})
            self.assertFalse(stat_root.called);self.assertFalse(spawn.called)
        with self.assertRaises(RuntimeError):transport.capture_controller_argv(ROOT)
        with self.assertRaises(RuntimeError):memory.CaptureControllerGuard(ROOT)

    def test_real_capture_binary_pipes_close_and_release_closure_rejects_capture_argv(self):
        root=directory()
        with projected(root):
            result=closed(root);self.assertEqual(transport.capture_controller_closure(root),result)
            self.assertEqual((root/'controller-original.stdout').read_bytes(),b'LOCAL_CAPTURE_CONTROLLER\x00\xff')
            with self.assertRaises(RuntimeError):common.controller_output_closure(root,0)
            with self.assertRaises(RuntimeError):closed(root)
        root=directory()
        common.capture_controller(root,common.controller_argv(root),False,
            spawn=lambda argv,**kw:subprocess.Popen([sys.executable,'-B','-c','pass'],**kw))
        with projected(root),self.assertRaises(RuntimeError):transport.capture_controller_closure(root)

    def test_nonzero_boolean_status_bootstrap_and_changed_original_refuse_capture_closure(self):
        for mutation in ('nonzero','boolstatus','boolintent','bootstrap','original'):
            root=directory()
            with projected(root):
                value=closed(root,1 if mutation=='nonzero' else 0)
                path=root/'controller-output-closed.json'
                if mutation=='boolstatus':value['status']=False
                if mutation=='boolintent':
                    path=root/'controller-output-intent.json';value=common.output_read_record(root,path.name);value['version']=True
                if mutation in ('boolstatus','boolintent'):
                    path.chmod(0o600);path.write_bytes(common.output_canonical(value));path.chmod(0o400)
                if mutation=='bootstrap':common.output_record(root,'controller-output-bootstrap-failure.json',{'neverRetry':True},False)
                if mutation=='original':
                    path=root/'controller-original.stdout';path.chmod(0o600);path.write_bytes(b'ALTERED');path.chmod(0o400)
                with self.subTest(mutation=mutation),self.assertRaises(RuntimeError):transport.capture_controller_closure(root)

    def test_bootstrap_consumed_namespace_never_writes_new_failure(self):
        root=directory();(root/'controller-original.stderr').write_bytes(b'PRESERVE')
        with projected(root),patch.object(transport,'os',types.SimpleNamespace(name='posix')),\
             patch.object(transport.sys,'argv',['capture_controller_output.py','--root',str(root)]),\
             patch.object(transport,'capture_controller_inputs',return_value=({},{})),\
             patch.object(transport,'capture_controller_transport') as spawn:
            self.assertEqual(transport.main(),1);self.assertFalse(spawn.called)
        self.assertEqual([p.name for p in root.iterdir()],['controller-original.stderr'])

    def test_lost_return_after_real_closed_transport_cannot_resume_or_become_success(self):
        root=directory()
        with projected(root):
            real_transport=transport.capture_controller_transport
            def spawn(argv,**kwargs):return subprocess.Popen([sys.executable,'-B','-c','pass'],**kwargs)
            def lost(*args):
                with patch.object(transport,'capture_source_review',return_value={'LOCAL_SOURCE_STANDIN':True}):
                    real_transport(root,{}, {},False,spawn)
                raise OSError('LOCAL lost closed return')
            with patch.object(transport,'os',types.SimpleNamespace(name='posix')),\
                 patch.object(transport.sys,'argv',['capture_controller_output.py','--root',str(root)]),\
                 patch.object(transport,'capture_controller_inputs',return_value=({},{})),\
                 patch.object(transport,'capture_controller_transport',side_effect=lost) as dispatch,\
                 patch.object(transport,'output_record',side_effect=lambda *a,**k:common.output_record(*a[:3],sync=False)):
                self.assertEqual(transport.main(),1);self.assertEqual(dispatch.call_count,1)
                self.assertEqual(transport.main(),1);self.assertEqual(dispatch.call_count,1)
            with self.assertRaises(RuntimeError):transport.capture_controller_closure(root)
            with self.assertRaises(RuntimeError):closed(root)

    def test_numeric_full_unit_snapshot_applies_unchanged_memory_gate_and_rereads_identity(self):
        raws,reads,reader,resolver=kernel();kept=[]
        value=memory.capture_controller_snapshot(reader,resolver,lambda p,b:kept.append((p,b)))
        self.assertEqual(len(reads),10);self.assertEqual(len(kept),10)
        self.assertTrue(all('/self/' not in p for p in reads))
        self.assertEqual(value['nonReclaimableBytes'],len(NON_RECLAIMABLE_FIELDS))
        self.assertEqual(value['memoryPeakBytesObservation'],805306368)
        self.assertTrue(value['samplingIsNotContinuousPeakMeasurement'])
        self.assertEqual(value['unit'],CAPTURE_UNIT)

    def test_memory_refuses_release_membership_oom_limit_counter_overflow_and_excess_nonreclaimable(self):
        for mutation in ('release','oom','swap','max','duplicate','u64','nonreclaimable','mount'):
            raws,reads,reader,resolver=kernel()
            if mutation=='release':raws['cgroup']=b'0::/system.slice/release.service\n'
            elif mutation=='oom':raws['memory.events']=b'oom 1\noom_kill 0\nmax 0\nhigh 0\n'
            elif mutation=='swap':raws['memory.swap.max']=b'1\n'
            elif mutation=='max':raws['memory.max']=b'999\n'
            elif mutation=='duplicate':raws['memory.stat']+=b'anon 1\n'
            elif mutation=='u64':raws['memory.current']=str(2**64).encode()
            elif mutation=='nonreclaimable':raws['memory.stat']=raws['memory.stat'].replace(b'anon 1\n',b'anon '+str(NON_RECLAIMABLE_MAX+1).encode()+b'\n')
            else:raws['mountinfo']+=raws['mountinfo']
            with self.subTest(mutation=mutation),self.assertRaises(RuntimeError):memory.capture_controller_snapshot(reader,resolver)

    def test_changed_membership_mount_or_directory_refuses_after_full_original_reads(self):
        for mutation in ('member','mount','directory'):
            raws,reads,reader,resolver=kernel();counts={}
            def changing(path,limit):
                key=pathlib.Path(path).name;counts[key]=counts.get(key,0)+1
                raw=reader(path,limit)
                return raw+b'CHANGED' if counts[key]==2 and key==('cgroup' if mutation=='member' else 'mountinfo') and mutation!='directory' else raw
            seen=[]
            def resolve(path):seen.append(path);return {**resolver(path),'inode':8+int(len(seen)>1 and mutation=='directory')}
            with self.subTest(mutation=mutation),self.assertRaises(RuntimeError):memory.capture_controller_snapshot(changing,resolve)

    def test_guard_retains_refused_full_raws_and_label_is_consumed_without_new_kernel_read(self):
        root=directory();raws,reads,reader,resolver=kernel()
        raws['memory.events']=b'oom 1\noom_kill 0\nmax 0\nhigh 0\n'
        with projected(root):
            guard=memory.CaptureControllerGuard(root,reader,resolver,False)
            with self.assertRaises(RuntimeError):guard.observe('before')
            self.assertTrue((root/'controller-memory-before-refused.json').exists());self.assertEqual(len(reads),10)
            with self.assertRaises(RuntimeError):guard.observe('before')
            self.assertEqual(len(reads),10)
            raw_files=list(root.glob('controller-memory-before-raw-*.stdout'))
            self.assertEqual(len(raw_files),10)
            self.assertEqual(raw_files[2].read_bytes(),raws['memory.events'])

    def test_stop_outcome_attempts_all_six_stops_before_any_evidence_and_keeps_independent_errors(self):
        events=[]
        class Calls:
            retention_errors=[]
            def __call__(self,argv):events.append(argv);raise OSError('LOCAL inventory failure')
        root=directory();stored=[]
        def probe():self.assertEqual(len(events),6);raise RuntimeError('LOCAL cgroup failure')
        with projected(root):result=outcome.capture_stop_outcome(root,Calls(),probe,stored.append)
        self.assertEqual(len(events),6);self.assertEqual(len(result['stops']['errors']),6)
        self.assertEqual([r['phase'] for r in result['errors']],['controller','transport','content'])
        self.assertFalse(result['allChecksComplete']);self.assertEqual(stored,[result])

    def test_actual_local_content_and_transport_seal_require_same_cgroup_and_all_originals(self):
        with review_fixtures.review_fixture() as current,projected(current.root):
            current.review_controller.execute();closed(current.root)
            raws,reads,reader,resolver=kernel();guard=memory.CaptureControllerGuard(current.root,reader,resolver,False)
            before=guard.observe('before');sample=guard.observe('before-stop')
            class Calls:
                retention_errors=[]
                def __init__(self):
                    self.values={sha(label.encode()):owner_fixtures.capture_object(owners.capture_spec(label)) for label in owners.CAPTURE_COMMANDS}
                    for identity,value in self.values.items():value['Id']=identity
                def __call__(self,argv):
                    if argv[1]=='ps':return next(identity.encode() for identity,value in self.values.items()
                        if value['Config']['Labels'][owners.CAPTURE_LABEL]==argv[-1].split('=',2)[-1])
                    if argv[1]=='inspect':return canonical([self.values[argv[2]]])
                    if argv[1]=='stop':self.values[argv[-1]]['State']['Running']=False;return argv[-1].encode()
                    raise AssertionError('No other host command permitted')
            stored=[];result=outcome.capture_stop_outcome(current.root,Calls(),lambda:sample,stored.append)
            self.assertTrue(result['allChecksComplete']);self.assertEqual(result['contentCommitment']['originalFileCount'],19)
            self.assertFalse(result['fullContentSemanticsRechecked']);self.assertFalse(result['releaseAuthorityGranted'])
            self.assertEqual(len(result['stops']['observedAbsentOwners']),0)
            self.assertEqual(result['stops']['nonvacuousStoppedOwnerCount'],6)
            changed=copy.deepcopy(sample);changed['cgroup']['inode']+=1
            self.assertFalse(outcome.capture_stop_outcome(current.root,Calls(),lambda:changed,stored.append)['allChecksComplete'])
            original=current.root/'capture-integrity-original.json';original.chmod(0o600);original.write_bytes(b'ALTERED');original.chmod(0o400)
            with self.assertRaises(RuntimeError):outcome.capture_content_commitment(current.root)

    def test_cgroup_boolean_identity_and_absent_owner_success_are_refused(self):
        raws,reads,reader,resolver=kernel();sample=memory.capture_controller_snapshot(reader,resolver)
        changed=copy.deepcopy(sample);changed['cgroup']['inode']=True
        with self.assertRaises(RuntimeError):memory.capture_controller_same_group(changed,sample)
        root=directory();exclusive_record(root,'controller-memory-before.json',sample,False)
        class Calls:
            retention_errors=[]
            def __call__(self,argv):return b''
        with projected(root),patch.object(outcome,'capture_controller_closure',return_value={'LOCAL_TRANSPORT_STANDIN':True}),\
             patch.object(outcome,'capture_content_commitment',return_value={'LOCAL_CONTENT_STANDIN':True}):
            result=outcome.capture_stop_outcome(root,Calls(),lambda:sample,lambda value:None)
        self.assertFalse(result['allChecksComplete'])
        self.assertEqual(result['errors'],[{'phase':'retainedOwners','errorType':'IncompleteRetainedCaptureOwnerSet'}])

    def test_generated_capture_hook_remains_self_contained_silent_and_source_only(self):
        import build_capture_stop_post
        generated=build_capture_stop_post.render();tree=ast.parse(generated)
        self.assertEqual(generated,(HERE/'capture_stop_post.py').read_text(encoding='utf-8'))
        self.assertFalse(any(isinstance(n,ast.ImportFrom) for n in ast.walk(tree)))
        self.assertFalse(any(isinstance(n,ast.Call) and isinstance(n.func,ast.Name) and n.func.id=='print' for n in ast.walk(tree)))
        symbols=symtable.symtable(generated,'capture_stop_post.py','exec')
        declared={s.get_name() for s in symbols.get_symbols() if s.is_assigned() or s.is_imported() or s.is_namespace()}
        def references(scope):
            result={s.get_name() for s in scope.get_symbols() if s.is_referenced() and s.is_global()}
            for child in scope.get_children():result|=references(child)
            return result
        self.assertEqual(references(symbols)-declared-set(dir(builtins))-{'__name__'},set())
        # Compile and structural analysis only; never execute generated hook.
        self.assertIn('CAPTURE_CONTROLLER_CLOSED_CONTENT_SEALED_PENDING_PACKAGE_REVIEW',generated)


if __name__=='__main__':unittest.main()
