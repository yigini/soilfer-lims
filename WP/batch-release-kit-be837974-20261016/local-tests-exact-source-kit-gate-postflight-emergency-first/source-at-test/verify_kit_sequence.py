"""Fault injection for ordering and uncertain outcomes; fake operations only."""
import unittest
from kit_sequence import execute
from kit_contract import *

class Operations:
    def __init__(self,fail=None,ready=395):self.calls=[];self.clock=0;self.fail=fail;self.ready=ready;self.sealed=None;self.intents=[];self.start_intent=None;self.stop_intent=None
    def monotonic(self):return self.clock
    def utc(self):return 'SYNTHETIC_TIME_'+str(self.clock)
    def record_phase_intent(self,name,receipt):self.intents.append(name)
    def action(self,name,value=None,seconds=0):
        self.calls.append(name);self.clock+=seconds
        if name==self.fail:raise RuntimeError('SYNTHETIC_FAULT')
        return value
    def preflight(self,plan):return self.action('preflight')
    def consume_gate_exclusively(self):return self.action('gate')
    def quiesce_and_verify_503(self):return self.action('503')
    def stop_exact_predecessor(self,grace):return self.action('stop-old',{'stoppedAndRetained':True,'exitCode':137},grace)
    def assert_no_volume_writers(self):return self.action('no-writers')
    def check_stopped_live_volume_readonly(self):return self.action('integrity',{'integrity':'ok','foreignKeyViolations':0})
    def check_disk_before_backup(self):return self.action('disk-backup')
    def retain_raw_triple_and_consistent_backup(self):return self.action('backup',{'SYNTHETIC':True})
    def require_canonical_policy_noop(self):return self.action('policy-noop')
    def verify_reviewed_impact(self,issue):return self.action('impact-'+issue)
    def installer_dry(self,issue):return self.action('dry-'+issue,{'SYNTHETIC':True})
    def installer_apply_once(self,issue):return self.action('apply-'+issue,{'SYNTHETIC':True})
    def installer_repeat_noop(self,issue):return self.action('repeat-'+issue,{'SYNTHETIC':True})
    def preserve_installer_full_state(self,issue):return self.action('preserve-'+issue,{'SYNTHETIC':True})
    def retain_predecessor_under_reviewed_name(self):return self.action('retain-old')
    def record_exact_candidate_intent(self):return self.action('candidate-intent',{'exactOwner':'SYNTHETIC_OWNER','exactName':'SYNTHETIC_NAME'})
    def start_exact_candidate_jobs_on_once(self,intent):self.start_intent=intent;return self.action('start','SYNTHETIC_CANDIDATE')
    def wait_ready_and_memory(self,candidate,deadline):return self.action('ready',{'seconds':self.ready},self.ready)
    def first_natural_sync_with_full_preservation(self,candidate):
        before=dict.fromkeys(FIVE_COUNTS,10);delta=dict.fromkeys(FIVE_COUNTS,0);delta.update(Sample=193,AuditLog=239)
        return self.action('first',{'fiveCounts':{'before':before,'after':{k:before[k]+delta[k] for k in before},'intakeDelta':delta}})
    def broad_postflights(self,candidate):return self.action('postflights')
    def check_full_accounting_before_reopen(self):return self.action('disk-reopen')
    def reopen_and_verify_200_200_401(self):return self.action('reopen')
    def second_natural_sync_receipt(self,candidate):return self.action('second',{'SYNTHETIC':True})
    def stop_exact_candidate_for_intent(self,intent,candidate,grace):self.stop_intent=(intent,candidate,grace);return self.action('stop-candidate')
    def preapply_recovery_proof(self,receipt):
        require('backup' in receipt,'Synthetic raw backup not yet retained')
        triple={'':{'bytes':9,'sha256':sha(b'synthetic')},'-wal':None,'-shm':None}
        return self.action('recovery-proof',{'exactStoppedPredecessorAndNoWriters':True,'retainedRawBackup':triple,'currentStoppedTriple':triple})
    def restart_exact_retained_predecessor_once(self):return self.action('restart-predecessor')
    def verify_restarted_predecessor_ready(self,deadline):return self.action('ready-predecessor',{'seconds':5})
    def seal_terminal_receipt(self,receipt):self.calls.append('seal');self.sealed=receipt
    def enqueue_partial_receipt_for_issue162(self,receipt):self.calls.append('outbox162')

def plan():return {'completeReviewedOperationalGraph':True,'exactKitReviewPassed':True,'head':HEAD,'image':IMAGE,'postflightPolicy':POSTFLIGHT_POLICY,'wholeOutageSeconds':600}

class SequenceRefusals(unittest.TestCase):
    def test_full_order_and_counts_before_ingress_reopens(self):
        ops=Operations();r=execute(ops,plan())
        self.assertEqual(r['status'],'DEPLOYED_AWAITING_CLAUDIO_POSTCHECK')
        for first,second in [('503','stop-old'),('stop-old','integrity'),('integrity','backup'),('backup','dry-206'),('dry-206','apply-206'),('apply-206','preserve-206'),('preserve-206','repeat-206'),('repeat-209','start'),('first','postflights'),('postflights','reopen'),('reopen','second')]:
            self.assertLess(ops.calls.index(first),ops.calls.index(second))
        self.assertEqual(ops.calls.count('start'),1)

    def test_unreviewed_outage_budget_refuses_without_any_operation(self):
        for value in (None,0,True):
            ops=Operations()
            with self.assertRaises(RuntimeError):execute(ops,{**plan(),'wholeOutageSeconds':value})
            self.assertEqual(ops.calls,[])

    def test_600_second_failure_holds_stops_retains_and_reports(self):
        ops=Operations(ready=600.001);r=execute(ops,plan())
        self.assertEqual(r['status'],'FAILED_FORWARD_HOLD')
        self.assertNotIn('reopen',ops.calls);self.assertIn('stop-candidate',ops.calls);self.assertIn('outbox162',ops.calls)
        self.assertFalse(r['failurePolicy']['restartPredecessor']);self.assertFalse(r['failurePolicy']['restoreDatabase'])

    def test_every_uncertain_mutation_failure_stays_held_without_retry(self):
        for phase in ('503','stop-old','integrity','backup','dry-206','apply-206','repeat-206','preserve-206','dry-214','apply-214','dry-209','apply-209','start','ready','first','postflights','disk-reopen','reopen','second'):
            with self.subTest(phase=phase):
                ops=Operations(fail=phase);r=execute(ops,plan())
                self.assertIn(r['status'],('FAILED_FORWARD_HOLD','FAILED_PRE_APPLY_HOLD','REFUSED_BEFORE_QUIESCE','ABORTED_PRE_APPLY_PREDECESSOR_RECOVERED'))
                self.assertIn('outbox162',ops.calls)
                self.assertNotIn('restart-old',ops.calls);self.assertNotIn('restore',ops.calls)
                self.assertLessEqual(ops.calls.count('start'),1)
                self.assertEqual(ops.calls.count('dry-206'),1 if phase not in ('503','stop-old','integrity','backup') else 0)
                if r['anyApplyAttempted']:self.assertNotIn('restart-predecessor',ops.calls)

    def test_failed_candidate_stop_does_not_skip_sealed_partial_receipt(self):
        class BrokenStop(Operations):
            def stop_exact_candidate_for_intent(self,intent,candidate,grace):raise RuntimeError('SYNTHETIC_STOP_ERROR')
        ops=BrokenStop(fail='ready');r=execute(ops,plan())
        self.assertEqual(r['holdErrors'][0]['phase'],'stopRetainCandidate')
        self.assertEqual(ops.calls[-2:],['seal','outbox162'])

    def test_emergency_rehold_and_stop_do_not_depend_on_a_new_journal_write(self):
        class FailedEvidence(Operations):
            def record_phase_intent(self,name,receipt):
                if name in ('hold503','stopRetainCandidate'):raise OSError('SYNTHETIC_FULL_EVIDENCE_DISK')
                super().record_phase_intent(name,receipt)
        ops=FailedEvidence(fail='ready');result=execute(ops,plan())
        self.assertEqual(result['status'],'FAILED_FORWARD_HOLD')
        self.assertEqual(ops.calls.count('503'),2);self.assertIn('stop-candidate',ops.calls)
        self.assertFalse(result.get('holdErrors'))

    def test_lost_start_return_retains_exact_intent_for_cleanup(self):
        ops=Operations(fail='start');r=execute(ops,plan())
        self.assertIsNone(ops.stop_intent[1])
        self.assertEqual(ops.stop_intent[0],ops.start_intent)
        self.assertEqual(ops.stop_intent[0],r['candidateIntent'])
        self.assertLess(ops.intents.index('candidateIntent'),ops.intents.index('candidateStart'))
        self.assertNotIn('ready',ops.calls)

    def test_invalid_or_exact_deadline_readiness_never_reopens(self):
        for value in (-1,True,None,float('nan'),float('inf'),600):
            with self.subTest(value=value):
                # Keep the fake clock finite; only the evidence is malformed.
                class Invalid(Operations):
                    def wait_ready_and_memory(self,candidate,deadline):return self.action('ready',{'seconds':value})
                ops=Invalid();r=execute(ops,plan())
                self.assertEqual(r['status'],'FAILED_FORWARD_HOLD')
                self.assertNotIn('reopen',ops.calls)

    def test_phase_intent_failure_prevents_start(self):
        class BrokenIntent(Operations):
            def record_phase_intent(self,name,receipt):
                if name=='candidateStart':raise RuntimeError('SYNTHETIC_DURABILITY_FAILURE')
                super().record_phase_intent(name,receipt)
        ops=BrokenIntent();r=execute(ops,plan())
        self.assertNotIn('start',ops.calls)
        self.assertIn('stop-candidate',ops.calls)
        self.assertEqual(r['status'],'FAILED_FORWARD_HOLD')

    def test_dry_refusal_before_any_apply_recovers_exact_predecessor_once(self):
        ops=Operations(fail='dry-206');r=execute(ops,plan())
        self.assertEqual(r['status'],'ABORTED_PRE_APPLY_PREDECESSOR_RECOVERED')
        self.assertTrue(r['anyInstallerAttempted']);self.assertFalse(r['anyApplyAttempted'])
        self.assertNotIn('apply-206',ops.calls)
        self.assertEqual(ops.calls.count('restart-predecessor'),1)
        self.assertLess(ops.calls.index('recovery-proof'),ops.calls.index('restart-predecessor'))
        self.assertEqual(ops.calls[-2:],['seal','outbox162'])

    def test_missing_raw_backup_never_restarts_early(self):
        ops=Operations(fail='integrity');r=execute(ops,plan())
        self.assertEqual(r['status'],'FAILED_PRE_APPLY_HOLD')
        self.assertIn('preApplyRecoveryRefused',r)
        self.assertNotIn('restart-predecessor',ops.calls)

    def test_unknown_apply_result_never_uses_preapply_recovery(self):
        ops=Operations(fail='apply-206');r=execute(ops,plan())
        self.assertTrue(r['anyApplyAttempted'])
        self.assertNotIn('recovery-proof',ops.calls)
        self.assertNotIn('restart-predecessor',ops.calls)

    def test_failed_predecessor_recovery_holds_and_stops_it_without_retry(self):
        class BrokenRecovery(Operations):
            def verify_restarted_predecessor_ready(self,deadline):self.action('ready-predecessor');raise RuntimeError('SYNTHETIC_NOT_READY')
        ops=BrokenRecovery(fail='dry-206');r=execute(ops,plan())
        self.assertEqual(r['status'],'FAILED_PRE_APPLY_HOLD')
        self.assertEqual(ops.calls.count('restart-predecessor'),1)
        self.assertEqual(ops.calls.count('stop-old'),2)
        self.assertNotIn('reopen',ops.calls)

if __name__=='__main__':unittest.main()
