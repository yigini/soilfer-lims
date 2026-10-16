"""Exact retained raw Git derivation and alternative-branch admission negatives."""
import copy
import json
import os
import pathlib
import tempfile
import unittest
from unittest.mock import patch
from prepare_release import raw_git
from kit_recovery_copy import HEAD,derive,validate,FIXED_BYTES
from kit_budget import Budget,RECOVERY_FIXED,RECOVERY_EVIDENCE_SHARE,TABLE
from kit_natural import admit_natural_transcript,NATURAL_COMMAND_RESERVATION,NaturalIntake

HERE=pathlib.Path(__file__).resolve().parent
FIXTURES=HERE/'recovery-copy-local-retained-fixtures'


class RecoveryCopy(unittest.TestCase):
    def test_all160_actual_old_head_git_blobs_bind29_startup_roots_and156_dependencies(self):
        profile=json.loads((HERE/'predecessor-copy-source-binding.json').read_bytes())
        raws={n:r[0] for n,r in raw_git(HEAD,list(profile['files'])).items()}
        validate(raws,profile)
        self.assertEqual(len(profile['startupRoots']),29)
        self.assertEqual(len(profile['localRequireEdges']),156)
        self.assertEqual(profile['maximumStartupDatabaseCopies'],0)
        self.assertEqual(FIXED_BYTES,RECOVERY_FIXED)
        for key in ('extra','missing','producer','dynamic'):
            changed=copy.deepcopy(raws)
            if key=='extra':changed['server/UNDECLARED.js']=b''
            elif key=='missing':del changed[profile['startupRoots'][0]]
            elif key=='producer':changed[profile['startupRoots'][0]]+=b'\nfs.copyFileSync(a,b);\n'
            else:changed[profile['startupRoots'][0]]+=b'\nrequire(chosenAtRuntime);\n'
            with self.assertRaises(RuntimeError):validate(changed,profile)

    def test_recovery_alternative_is_reserved_from_initial_capacity_and_cannot_resume_or_repeat(self):
        budget=Budget(600000000,6000000,414683521)
        self.assertGreaterEqual(budget.remaining(),64*budget.db+RECOVERY_FIXED)
        for row in TABLE[:2]:
            budget.begin(row['stage'],10**12)
            for name,count in row['sites'].items():
                for _ in range(count):budget.claim(name)
            budget.finish(row['stage'],0)
        budget.begin('issue-206',10**12);budget.claim('clone')
        budget.reserve_recovery()
        self.assertEqual(budget.remaining(),budget.recovery_allowance)
        budget.claim_recovery_start()
        self.assertEqual(budget.remaining(False),0)
        with self.assertRaises(RuntimeError):budget.claim_recovery_start()
        with self.assertRaises(RuntimeError):budget.finish_recovery(budget.recovery_allowance+RECOVERY_EVIDENCE_SHARE+1)
        record=budget.finish_recovery(0)
        self.assertEqual(record['startupDatabaseCopies'],0)
        self.assertEqual(budget.remaining(),0)
        for action in (lambda:budget.reserve_recovery(),lambda:budget.claim('triple'),
            lambda:budget.begin('candidate-startup',10**12),lambda:budget.finish('issue-206',0)):
            with self.assertRaises(RuntimeError):action()

    def test_later_installer_stage_cannot_acquire_early_recovery_branch(self):
        budget=Budget(4096,4096,1);budget.completed=3
        with self.assertRaises(RuntimeError):budget.reserve_recovery()

    def test_ops_reserves_before_old_restart_and_closes_physical_branch_before_reopen(self):
        import types
        from kit_ops import ProductionOps
        calls=[];ops=ProductionOps.__new__(ProductionOps)
        ops.disk=types.SimpleNamespace(begin_recovery=lambda:calls.append('reserve'),
            finish_recovery=lambda:calls.append('physical-close') or {'samePredecessorOnly':True})
        ops.predecessor=types.SimpleNamespace(restart_preapply_once=lambda:calls.append('restart'))
        ops.recovery_ready=lambda predecessor,deadline:calls.append('ready') or {'sameRetainedPredecessor':True}
        ops.restart_exact_retained_predecessor_once()
        value=ops.verify_restarted_predecessor_ready(600)
        self.assertEqual(calls,['reserve','restart','ready','physical-close'])
        self.assertTrue(value['physicalRecoveryBranch']['samePredecessorOnly'])
        def refuse():raise RuntimeError('SYNTHETIC_NO_CAPACITY')
        ops.disk.begin_recovery=refuse
        with self.assertRaises(RuntimeError):ops.restart_exact_retained_predecessor_once()
        self.assertEqual(calls.count('restart'),1)

    def test_transcript_quota_refuses_before_any_docker_or_memory_capture_and_keeps_original_bytes(self):
        FIXTURES.mkdir(exist_ok=True);root=pathlib.Path(tempfile.mkdtemp(prefix='owned-',dir=FIXTURES))
        path=root/'natural-logs-000001.stdout';raw=b'SYNTHETIC ORIGINAL';path.write_bytes(raw)
        value=admit_natural_transcript(root)
        self.assertGreaterEqual(value['retainedAllocatedBytes'],8192)
        with patch('kit_natural.NATURAL_TRANSCRIPT_LIMIT',NATURAL_COMMAND_RESERVATION):
            with self.assertRaises(RuntimeError):admit_natural_transcript(root)
            obj=NaturalIntake.__new__(NaturalIntake);obj.root=root;obj.observations=[]
            with self.assertRaises(RuntimeError):obj.observation()
        self.assertEqual(path.read_bytes(),raw)
        obj=NaturalIntake.__new__(NaturalIntake);obj.observations=[None]*256
        with self.assertRaises(RuntimeError):obj.observation() # No root/runner even accessed.

    def test_transcript_metadata_hardlinks_count_data_once_but_both_directory_entries(self):
        FIXTURES.mkdir(exist_ok=True);root=pathlib.Path(tempfile.mkdtemp(prefix='owned-',dir=FIXTURES))
        first=root/'natural-logs-000001-command-intent.json.pending';first.write_bytes(b'SYNTHETIC')
        os.link(first,root/'natural-logs-000001-command-intent.json')
        result=admit_natural_transcript(root)
        self.assertEqual(result['retainedAllocatedBytes'],3*4096)
        (root/'natural-logs-UNDECLARED').write_bytes(b'UNKNOWN')
        with self.assertRaises(RuntimeError):admit_natural_transcript(root)


if __name__=='__main__':unittest.main()
