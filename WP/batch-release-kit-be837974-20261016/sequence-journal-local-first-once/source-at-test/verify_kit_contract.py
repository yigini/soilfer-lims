"""Critical refusal cases for the new kit foundation; no operator calls."""
import copy
import unittest
from kit_contract import *
from derive_timing_evidence import derive

class KitRefusals(unittest.TestCase):
    def confirmation(self):
        return {'confirmedByYY':True,'issue':162,'commentId':6213000000,
                'url':'https://github.com/yigini/soilfer-lims/issues/162#issuecomment-6213000000',
                'head':HEAD,'image':IMAGE,'createdEpoch':1000,'impactSha256':impact_sha(),
                'acceptsFirstSyncImpact':True,'labAndHubBuildsOwnedByYY':True,'controlled':True,
                'releaseWindowControl':'RELEASE_DAY_DISK_ABORTS_ACCEPTED'}

    def test_fresh_gate_binds_release_impact_and_human_workload(self):
        good=self.confirmation();validate_fresh_yy_confirmation(good,1600)
        mutations={'head':'a'*40,'image':'sha256:'+'b'*64,'impactSha256':'c'*64,
                   'confirmedByYY':False,'acceptsFirstSyncImpact':False,'controlled':False,
                   'labAndHubBuildsOwnedByYY':False,'commentId':ACCEPTANCE_ID,
                   'releaseWindowControl':'AN_OLD_CHOICE','createdEpoch':999}
        for key,value in mutations.items():
            with self.subTest(key=key),self.assertRaises(RuntimeError):
                validate_fresh_yy_confirmation({**good,key:value},1600)
        with self.assertRaises(RuntimeError):validate_fresh_yy_confirmation(good,999)

    def test_failure_never_restarts_or_restores_even_without_commit_receipt(self):
        for install in (False,True):
            for entry in (False,True):
                result=failure_policy(install,entry)
                self.assertEqual(result['ingressStatus'],503)
                self.assertFalse(result['restartPredecessor']);self.assertFalse(result['restoreDatabase'])
                self.assertTrue(result['stopCandidate'] and result['retainCandidate'] and result['postPartialReceiptToIssue162'])
                self.assertEqual(result['reviewedForwardRecoveryRequired'],install or entry)

    def test_postflight_permits_only_exact_intake_count_deltas(self):
        before=dict(zip(FIVE_COUNTS,(39280,19,6,18,13209)))
        delta=dict(zip(FIVE_COUNTS,(193,0,0,0,239)))
        after={k:before[k]+delta[k] for k in before}
        validate_postflight_counts(before,after,delta)
        with self.assertRaises(RuntimeError):validate_postflight_counts(before,after,{**delta,'AuditLog':238})
        for scientific in ('Result','Batch','BatchQcResult'):
            with self.subTest(table=scientific),self.assertRaises(RuntimeError):
                validate_postflight_counts(before,{**after,scientific:after[scientific]+1},{**delta,scientific:1})
        with self.assertRaises(RuntimeError):validate_postflight_counts(before,after,{**delta,'SampleHold':23})

    def test_exact_disk_floor_and_unexplained_boundary(self):
        minimum=FLOOR+LOG_RESERVE+ADDITIONAL_HEADROOM+3*5787648
        self.assertEqual(disk_required(563326976,IMAGE_BYTES,5787648),minimum)
        self.assertEqual(disk_required(563326976,IMAGE_BYTES,5787648,1234),minimum+1234)
        self.assertEqual(unexplained_drop(1000000000,400000000,100000000),500000000)
        with self.assertRaises(RuntimeError):unexplained_drop(1000000001,400000000,100000000)
        with self.assertRaises(RuntimeError):disk_required(True,IMAGE_BYTES,5787648)

    def test_any_oom_refuses_and_peak_does_not_override_counters(self):
        good={'oom':0,'oom_kill':0,'max':199547}
        validate_memory_events(good,good)
        for key in ('oom','oom_kill'):
            with self.subTest(counter=key),self.assertRaises(RuntimeError):validate_memory_events(good,{**good,key:1})
        with self.assertRaises(RuntimeError):validate_memory_events(good,{'oom':0})

    def test_missing_outage_phase_cannot_imply_fit(self):
        value={k:0 for k in PHASES};value['candidateReady']=590;value['predecessorStop']=10
        self.assertTrue(downtime_assessment(value)['fitsTenMinutes'])
        value['stoppedBackup']=0.001
        self.assertFalse(downtime_assessment(value)['fitsTenMinutes'])
        del value['stoppedIntegrityFk']
        with self.assertRaises(RuntimeError):downtime_assessment(value)

    def test_actual_retained_timings_do_not_prove_nine_to_ten_minutes(self):
        evidence=derive()
        self.assertGreater(evidence['threeApplyCallsSeconds'],410)
        self.assertGreater(evidence['comparisonApplyPlusFastestAcceptedReadinessPlusTenSecondGrace'],814)
        self.assertFalse(evidence['wholeSequenceUnder600SecondsProved'])
        self.assertTrue(evidence['233000IsStartupOnlyNotAThreeInstallerProductionPath'])
        self.assertEqual(len(evidence['references']),13)

if __name__=='__main__':unittest.main()
