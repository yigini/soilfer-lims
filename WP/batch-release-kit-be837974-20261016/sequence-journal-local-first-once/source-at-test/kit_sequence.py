"""Release sequence with injected operations; no real production adapter exists yet.

This module fixes ordering and failure behavior while the whole-outage budget
is being clarified. It cannot be invoked as an operational release script.
"""
from kit_contract import *

def execute(ops,reviewed_plan):
    require(reviewed_plan.get('completeReviewedOperationalGraph') is True,'Complete reviewed operational graph required')
    require(reviewed_plan.get('exactKitReviewPassed') is True,'Exact kit review required')
    require(reviewed_plan.get('head')==HEAD and reviewed_plan.get('image')==IMAGE,'Reviewed release target differs')
    require(reviewed_plan.get('postflightPolicy')==POSTFLIGHT_POLICY,'Postflight moment is not bound')
    outage_limit=reviewed_plan.get('wholeOutageSeconds')
    require(type(outage_limit) is int and outage_limit>0,'Actual reviewed whole-outage boundary required')
    receipt={'status':'PREFLIGHT','head':HEAD,'image':IMAGE,'events':[],
             'anyInstallerAttempted':False,'anyEntrypointAttempted':False,
             'postflightPolicy':POSTFLIGHT_POLICY,'ingressReopened':False}
    held=False;candidate=None;candidate_intent=None;outage_start=None
    def stage(name,call):
        began=ops.monotonic();utc=ops.utc()
        # The durable append-only intent precedes the call, including calls
        # whose return value may be lost after a real Docker mutation.
        ops.record_phase_intent(name,receipt)
        try:
            value=call()
        except BaseException as error:
            receipt['events'].append({'phase':name,'startUtc':utc,'endUtc':ops.utc(),
                                      'seconds':ops.monotonic()-began,'completed':False,
                                      'errorType':type(error).__name__})
            raise
        receipt['events'].append({'phase':name,'startUtc':utc,'endUtc':ops.utc(),
                                  'seconds':ops.monotonic()-began,'completed':True})
        return value
    def outage_guard():
        require(outage_start is not None and ops.monotonic()-outage_start<=outage_limit,'Reviewed whole-outage deadline exceeded')
    try:
        # These adapters must fail before mutation on stale human evidence,
        # missing unhealthy-consumer inventory, changed authority or low space.
        stage('freshAuthorityGateAndWorkload',lambda:ops.preflight(reviewed_plan))
        stage('exclusiveSingleUseGate',ops.consume_gate_exclusively)
        # Treat an uncertain quiesce as held before making its first mutation.
        held=True;outage_start=ops.monotonic()
        stage('quiesce503',ops.quiesce_and_verify_503)
        stopped=stage('predecessorStop',lambda:ops.stop_exact_predecessor(STOP_GRACE_SECONDS))
        receipt['predecessorStop']=stopped
        require(stopped.get('stoppedAndRetained') is True and type(stopped.get('exitCode')) is int,'Exact predecessor stop/exit evidence required')
        stage('noLiveVolumeWriters',ops.assert_no_volume_writers)
        state=stage('stoppedIntegrityFk',ops.check_stopped_live_volume_readonly)
        require(state.get('integrity')=='ok' and state.get('foreignKeyViolations')==0,'Stopped integrity/FK refused')
        receipt['stoppedIntegrityFk']=state
        stage('freshDiskBeforeBackup',ops.check_disk_before_backup)
        receipt['backup']=stage('stoppedBackup',ops.retain_raw_triple_and_consistent_backup)
        stage('canonicalPolicyNoOp',ops.require_canonical_policy_noop)
        for issue in ('206','214','209'):
            outage_guard()
            stage('impactBefore'+issue,lambda issue=issue:ops.verify_reviewed_impact(issue))
            # This intent precedes DRY, not only APPLY/COMMIT.
            receipt['anyInstallerAttempted']=True
            receipt.setdefault('installers',{})[issue]=stage('install'+issue,lambda issue=issue:ops.install_dry_apply_repeat_and_preserve(issue))
        outage_guard()
        stage('retainStoppedPredecessorName',ops.retain_predecessor_under_reviewed_name)
        candidate_intent=stage('candidateIntent',ops.record_exact_candidate_intent)
        receipt['candidateIntent']=candidate_intent
        receipt['anyEntrypointAttempted']=True
        candidate=stage('candidateStart',lambda:ops.start_exact_candidate_jobs_on_once(candidate_intent))
        # Adapter must enforce one total600s clock from docker start, including
        # all entrypoint/READY/HTTP and final memory.events observations.
        receipt['readiness']=stage('candidateReady',lambda:ops.wait_ready_and_memory(candidate,READY_SECONDS))
        seconds=receipt['readiness'].get('seconds')
        require(type(seconds) in (int,float) and math.isfinite(seconds) and 0<=seconds<READY_SECONDS,'600 second readiness deadline exceeded')
        outage_guard()
        # Ingress remains503 until first scheduled completion + postflights.
        # This avoids racing new human analytical writes in the five counts.
        receipt['firstSync']=stage('firstNaturalSync',lambda:ops.first_natural_sync_with_full_preservation(candidate))
        counts=receipt['firstSync']['fiveCounts']
        receipt['fiveCounts']=validate_postflight_counts(counts['before'],counts['after'],counts['intakeDelta'])
        receipt['postflights']=stage('apiAndReadOnlyPostflights',lambda:ops.broad_postflights(candidate))
        stage('freshDiskBeforeReopen',ops.check_full_accounting_before_reopen)
        outage_guard()
        stage('reopen',ops.reopen_and_verify_200_200_401)
        receipt['ingressReopened']=True;held=False
        receipt['outageSeconds']=ops.monotonic()-outage_start
        receipt['status']='INGRESS_REOPENED_SECOND_NATURAL_SYNC_PENDING'
        # Later normal user activity is reported separately. The protected
        # five-count comparison was sealed before reopening ingress.
        receipt['secondSync']=stage('secondNaturalSync',lambda:ops.second_natural_sync_receipt(candidate))
        receipt['status']='DEPLOYED_AWAITING_CLAUDIO_POSTCHECK'
        ops.seal_terminal_receipt(receipt)
        return receipt
    except BaseException as error:
        receipt['status']='FAILED_FORWARD_HOLD' if held or receipt['anyEntrypointAttempted'] else 'REFUSED_BEFORE_QUIESCE'
        receipt['errorType']=type(error).__name__
        receipt['failurePolicy']=failure_policy(receipt['anyInstallerAttempted'],receipt['anyEntrypointAttempted'])
        if held or receipt['anyEntrypointAttempted']:
            for name,action in [('hold503',ops.quiesce_and_verify_503),
                                # A missing returned CID is UNKNOWN, never
                                # evidence that creation/start did not happen.
                                ('stopRetainCandidate',lambda:ops.stop_exact_candidate_for_intent(candidate_intent,candidate,STOP_GRACE_SECONDS))]:
                try:stage(name,action)
                except BaseException as hold_error:receipt.setdefault('holdErrors',[]).append({'phase':name,'errorType':type(hold_error).__name__})
        ops.seal_terminal_receipt(receipt)
        ops.enqueue_partial_receipt_for_issue162(receipt)
        return receipt
