"""Fixed independent names and frozen action graph; no Apache/host operation."""
import ast
import hashlib
import os
import pathlib
import unittest
from unittest.mock import patch
import kit_evidence as evidence
from kit_journal import exclusive_record
from verify_kit_cli_evidence import directory

HERE=pathlib.Path(__file__).resolve().parent


def tree(name):return ast.parse((HERE/name).read_bytes())


class FixedEnvelopes(unittest.TestCase):
    def test_declared_partition_assigns_the_existing_four_gib_without_filesystem_pass(self):
        result=evidence.fixed_envelope_bounds()
        total=sum(evidence.SHARES.values())+evidence.INDEPENDENT_EMERGENCY_BYTES+evidence.HOOK_NAMESPACE_BYTES+evidence.APACHE_NAMESPACE_BYTES
        self.assertEqual(total,4*1024**3)
        self.assertLessEqual(result['hookRecordAllocationBytes'],64*1024**2)
        self.assertLessEqual(result['apacheDeclaredAllocationBytes'],32*1024**2)
        self.assertFalse(result['physicalFilesystemClosureClaimed'])
        self.assertFalse(evidence.EvidenceLedger(directory()).summary()['fullGlobalEvidenceClosure'])

    def test_only_three_exact_hook_names_can_use_the_independent_record_allowance(self):
        root=directory();book=evidence.EvidenceLedger(root,dict.fromkeys(evidence.SHARES,4096))
        with patch('kit_evidence._runtime',book):
            for name in sorted(evidence.HOOK_RESULT_NAMES):
                exclusive_record(root,name,{'synthetic':'complete original'},False,independent_namespace='hook-results')
                self.assertTrue(os.path.samefile(root/name,root/(name+'.pending')))
            for name in ['stop-post-controller-3.json','unrelated.json','emergency-stop-post-000001.json']:
                with self.assertRaises(RuntimeError):exclusive_record(root,name,{},False,independent_namespace='hook-results')
                self.assertFalse((root/(name+'.pending')).exists())
            with self.assertRaises(FileExistsError):exclusive_record(root,'stop-post-result.json',{},False,independent_namespace='hook-results')
        self.assertEqual(sum(book.used.values()),0)
        # The generated hook, built only, opts in at exactly its two writer sites.
        source=(HERE/'build_stop_post.py').read_text(encoding='utf-8')
        self.assertEqual(source.count("independent_namespace='hook-results'"),2)

    def test_hook_fixed_limit_refuses_before_pending_creation(self):
        root=directory()
        with patch('kit_journal.HOOK_RECORD_LIMIT',128):
            with self.assertRaises(RuntimeError):exclusive_record(root,'stop-post-result.json',{'value':'X'*129},False,
                independent_namespace='hook-results')
        self.assertFalse(list(root.iterdir()))

    def test_six_static_apache_sites_and_two_hook_observations_leave_actions_unchanged(self):
        sequence=tree('kit_sequence.py')
        selected={'quiesce_and_verify_503','reopen_and_verify_200_200_401','emergency_quiesce_and_verify_503'}
        sites=[n for n in ast.walk(sequence) if isinstance(n,ast.Attribute) and n.attr in selected]
        self.assertEqual(len(sites),5)
        import build_stop_post
        main=ast.parse(build_stop_post.MAIN)
        self.assertEqual(sum(isinstance(n,ast.Call) and isinstance(n.func,ast.Name) and n.func.id=='EmergencyIngress'
            for n in ast.walk(main)),1)
        lifecycle=next(n for n in tree('kit_stop_lifecycle.py').body if isinstance(n,ast.FunctionDef) and n.name=='stop_post_lifecycle')
        observations=[n for n in ast.walk(lifecycle) if isinstance(n,ast.Call) and isinstance(n.func,ast.Name) and
            n.func.id=='attempt' and len(n.args)>1 and isinstance(n.args[1],ast.Name) and n.args[1].id=='controller']
        self.assertEqual(len(observations),2)
        node=next(n for n in tree('kit_emergency_ingress.py').body if isinstance(n,ast.FunctionDef) and n.name=='atomic_config')
        self.assertEqual(hashlib.sha256(ast.dump(node,include_attributes=False).encode()).hexdigest(),
            '881aae724566587e1427149b5047d73701c5151413706d2654f0e444d2131a59')
        self.assertFalse(any(isinstance(n,ast.Name) and n.id in ('admit_evidence','begin_cli_evidence') for n in ast.walk(node)))

if __name__=='__main__':unittest.main()
