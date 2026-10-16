"""Concrete construction with NEW local files and stand-in Linux/Docker reads.

No production root, kernel counter, network, Docker CLI or release is used.
The real production classes are assembled; their actions remain uninvoked.
"""
import contextlib
import copy
import importlib
import os
import pathlib
import tempfile
import types
import unittest
from unittest.mock import patch
from kit_contract import canonical,sha
from kit_journal import Journal
from kit_disk import Disk,BOUND
from kit_construction import ResourceGuard,construction_inputs,construct,exact_candidate_tmp
from kit_ops import ProductionOps,BudgetedCli
from kit_owned import OwnedCli
from kit_runtime import Candidate,ExactPredecessor
from kit_authority import Authority
from kit_install import Installations
from kit_recovery import RecoveryReadiness
from verify_kit_runtime import old
from verify_kit_authority import synthetic_reviews

HERE=pathlib.Path(__file__).resolve().parent
FIXTURES=HERE/'construction-local-retained-fixtures'


def directory():
    FIXTURES.mkdir(exist_ok=True)
    return pathlib.Path(tempfile.mkdtemp(prefix='owned-',dir=FIXTURES)).resolve()


class Construction(unittest.TestCase):
    def test_non_linux_or_foreign_root_refuses_before_any_frozen_file_or_component(self):
        with patch('kit_construction.frozen_hook_authority') as read:
            with self.assertRaises(RuntimeError):construction_inputs('/tmp/SYNTHETIC_FOREIGN')
            self.assertFalse(read.called)

    def test_real_classes_wire_all_runtime_dependencies_before_any_application_mutation(self):
        root=directory();data=synthetic_reviews()
        idx,source,manifest,kit,human,confirmation,disclosure,result=data
        (root/'tooling').mkdir()
        for name in ('compose-source.yml','startup-expectations.json','predecessor-startup-expectations.json'):
            (root/'tooling'/name).write_bytes((HERE/name).read_bytes())
        (root/'ingress-original.conf').write_bytes(b'SYNTHETIC_APACHE_ORIGINAL')
        (root/'ingress-held.conf').write_bytes(b'SYNTHETIC_APACHE_503')
        manifest['originalIngressSha256']=sha(b'SYNTHETIC_APACHE_ORIGINAL')
        manifest['heldIngressSha256']=sha(b'SYNTHETIC_APACHE_503')
        calls=[]
        class Controller:
            def __init__(self,root):self.root=root;self.labels=[]
            def observe(self,label):self.labels.append(label);calls.append(('controller',label));return {'synthetic':True}
        class Runner:
            def __init__(self,root,check):self.root=root;self.check=check
            def run(self,argv,label,timeout,*args,**kwargs):
                self.check(timeout);calls.append(('command',argv))
                if argv==['docker','inspect',old()['Id']]:
                    raw=canonical([old()]);return raw,b'',{'stdout':{'bytes':len(raw)}}
                raise AssertionError('Construction dispatched an unexpected command: '+repr(argv))
        hardware=lambda:{p:{'path':p,'device':1,'blockBytes':4096,'fragmentBytes':4096,
            'availableBlocks':10**10,'freeBytes':4096*10**10} for p in BOUND}
        def disk(root,reader,runner,budget):return Disk(root,reader,runner,budget,False,hardware_reader=hardware)
        module=importlib.import_module('kit_construction')
        with contextlib.ExitStack() as stack:
            stack.enter_context(patch('kit_construction.construction_inputs',return_value=(root,manifest,idx,source,kit,confirmation,disclosure,{'SYNTHETIC_TEST_PLAN':True})))
            stack.enter_context(patch('kit_construction.ControllerGuard',Controller))
            stack.enter_context(patch('kit_construction.CommandRunner',Runner))
            stack.enter_context(patch('kit_construction.Disk',side_effect=disk))
            stack.enter_context(patch('kit_construction.measure_inputs',return_value={'databaseAllocatedBytes':4096,'assetsAllocatedBytes':4096}))
            stack.enter_context(patch('kit_construction.initialize_private_key',side_effect=lambda root:calls.append(('new-local-key-placeholder',))))
            stack.enter_context(patch('kit_construction.Journal',side_effect=lambda r,o,s:Journal(r,o,s,False)))
            stack.enter_context(patch('kit_construction.private_file',side_effect=lambda r,n:(pathlib.Path(r)/n).read_bytes()))
            for name in ('kit_authority.ROOT','kit_ops.ROOT','kit_owned.ROOT'):
                stack.enter_context(patch(name,root))
            stack.enter_context(patch('kit_docker._reader',None))
            ops,plan=construct(root)
        self.assertIsInstance(ops,ProductionOps);self.assertIsInstance(ops.authority,Authority)
        self.assertIsInstance(ops.cli,BudgetedCli);self.assertIsInstance(ops.cli.cli,OwnedCli)
        self.assertIsInstance(ops.candidate,Candidate);self.assertIsInstance(ops.predecessor,ExactPredecessor)
        self.assertIsInstance(ops.installs,Installations);self.assertIsInstance(ops.recovery_ready,RecoveryReadiness)
        self.assertIs(ops.installs.cli,ops.cli);self.assertIs(ops.cli.disk,ops.disk)
        self.assertIs(ops.installs.review_impact.__self__,ops.authority)
        self.assertEqual(calls[0],('controller','before'))
        self.assertEqual([row[1][1] for row in calls if row[0]=='command'],['inspect'])
        self.assertFalse(ops.candidate.consumed);self.assertFalse(ops.authority.started);self.assertIsNone(ops.gate)
        self.assertTrue((root/'execution-journal-owner.json').exists())
        self.assertTrue((root/'runtime-measured-inputs.json').exists())
        self.assertFalse((root/'production-gate-consumed.json').exists())

    def test_resource_guard_enforces_disk_and_periodic_controller_without_recursion(self):
        now=[0];labels=[];disk_calls=[]
        class Controller:
            def observe(self,label):
                labels.append(label)
                if now[0]>=2:raise RuntimeError('SYNTHETIC_CONTROLLER_OOM')
        guard=ResourceGuard(Controller(),clock=lambda:now[0])
        with self.assertRaises(RuntimeError):guard(0)
        guard.bind(types.SimpleNamespace(check=lambda needed:disk_calls.append(needed)))
        guard(15);guard(0);self.assertEqual(len(labels),1)
        now[0]=1;guard(0);self.assertEqual(len(labels),2)
        now[0]=2
        with self.assertRaises(RuntimeError):guard(0)
        self.assertEqual(disk_calls,[15,0,0,0])
        with self.assertRaises(RuntimeError):guard.bind(object())

    def test_candidate_temp_creation_is_exclusive_and_does_not_reuse_retained_bytes(self):
        root=directory();exact_candidate_tmp(root)
        path=root/'candidate-retained-temp';(path/'retained-evidence').write_bytes(b'SYNTHETIC')
        with self.assertRaises(FileExistsError):exact_candidate_tmp(root)
        self.assertEqual((path/'retained-evidence').read_bytes(),b'SYNTHETIC')


if __name__=='__main__':unittest.main()
