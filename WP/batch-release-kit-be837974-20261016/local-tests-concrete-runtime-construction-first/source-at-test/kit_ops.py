"""Production sequence adapters, with every retained copy phase budgeted.

Construction performs no I/O. The separate frozen authority/launcher must
construct these real components after exact source and kit reviews. This file
has no CLI and cannot confer authority through a caller's review booleans.
"""
import datetime
import pathlib
import time
from kit_contract import HEAD,IMAGE,READY_SECONDS,STOP_GRACE_SECONDS,canonical,require,sha
from retained_contract import ROOT,LIVE_DATA,LIVE_ASSETS
from retained_files import triple,identity_record,copy_tree,tree_state
from kit_owned import validate_spec
from kit_integrity import stopped_integrity
from kit_no_writers import assert_no_volume_writers
from kit_runtime import PREDECESSOR_ID,CANDIDATE_OWNER,candidate_projection
from kit_journal import exclusive_record
from kit_preservation import inventory_preserved,serving_memory_summary
from kit_budget import TABLE


class BudgetedCli:
    def __init__(self,cli,disk):self.cli=cli;self.disk=disk
    def run(self,spec):
        validate_spec(spec)
        self.disk.check(600);self.disk.budget.cli(spec['label'])
        return self.cli.run(spec)


class ProductionOps:
    def __init__(self,authority,root,journal,runner,reader,disk,controller,cli,ingress,
                 emergency_ingress,predecessor,candidate,installations,natural_factory,
                 monitor_factory,probes_factory,stop_clis,recovery_ready,clock=time.monotonic):
        require(pathlib.Path(root)==ROOT,'Production operations require the exact new release root')
        self.authority=authority;self.root=pathlib.Path(root);self.journal=journal
        self.runner=runner;self.reader=reader;self.disk=disk;self.controller=controller;self.cli=cli
        self.ingress=ingress;self.emergency_ingress=emergency_ingress;self.predecessor=predecessor
        self.candidate=candidate;self.installs=installations;self.natural_factory=natural_factory
        self.monitor_factory=monitor_factory;self.probes_factory=probes_factory;self.stop_clis=stop_clis
        self.recovery_ready=recovery_ready
        self.clock=clock;self.preflight_result=None;self.gate=None;self.original_inventory=None
        self.intent=None;self.monitor=None;self.natural=None;self.readiness=None;self.assets=None
        self.quiesce_calls=0;self.controller_sequence=0;self.terminal_reference=None

    def monotonic(self):return self.clock()
    def utc(self):return datetime.datetime.now(datetime.timezone.utc).isoformat()
    def record_phase_intent(self,name,receipt):return self.journal.phase_intent(name,receipt)

    def boundary_check(self,needed=0):
        self.disk.check(needed)
        self.controller_sequence+=1
        return self.controller.observe('boundary-'+str(self.controller_sequence).zfill(6))

    def preflight(self,reviewed_plan):
        require(self.preflight_result is None,'Production preflight consumed')
        # This method must re-fetch current provider authority and human gate;
        # frozen source bytes and copied historical authority are insufficient.
        self.preflight_result=self.authority.preflight(reviewed_plan)
        self.boundary_check(120)
        self.original_inventory=self.reader.inventory()
        require(PREDECESSOR_ID in self.original_inventory,'Exact normal predecessor absent')
        self.predecessor.exact(self.original_inventory[PREDECESSOR_ID])
        self.disk.topology_check('runtime-before-quiesce')
        self.disk.sample('before-quiesce')
        self.journal.append('freshProductionPreflight',self.preflight_result)
        return self.preflight_result

    def consume_gate_exclusively(self):
        require(self.preflight_result is not None and self.gate is None,'Fresh preflight before single-use gate required')
        self.gate=self.authority.consume_gate()
        return self.gate

    def quiesce_and_verify_503(self):
        self.quiesce_calls+=1
        require(self.quiesce_calls==1,'Normal initial quiesce is consumed')
        return self.ingress.transition(True)

    def emergency_quiesce_and_verify_503(self):
        # Also works if a failed initial phase-intent write prevented the first
        # normal transition from ever being called.
        return self.emergency_ingress()

    def stop_exact_predecessor(self,grace):return self.predecessor.stop(grace)
    def assert_no_volume_writers(self):return assert_no_volume_writers(self.reader)
    def check_stopped_live_volume_readonly(self):
        return stopped_integrity(self.cli,self.journal,self.assert_no_volume_writers)

    def check_disk_before_backup(self):
        self.boundary_check(120);self.disk.begin('stopped-backup')

    def retain_raw_triple_and_consistent_backup(self):
        result=self.installs.retain_stopped_backup()
        self.assets=tree_state(LIVE_ASSETS)
        copy_tree(LIVE_ASSETS,self.root/'stopped-assets',self.disk.check)
        require(tree_state(LIVE_ASSETS)==self.assets,'Stopped original assets changed during retention')
        self.disk.finish('stopped-backup');return result

    def require_canonical_policy_noop(self):
        self.disk.begin('canonical-policy');value=self.installs.canonical_policy()
        self.disk.finish('canonical-policy');return value

    def verify_reviewed_impact(self,issue):
        require(issue in ('206','214','209'),'Only the reviewed installer chain permitted')
        if issue in ('214','209'):
            label='chart-impact' if issue=='214' else 'order-impact'
            self.disk.begin(label);value=self.installs.impact(issue);self.disk.finish(label)
            self.disk.begin('issue-'+issue)
        else:
            self.disk.begin('issue-206');value=self.installs.impact(issue)
        return value

    def installer_dry(self,issue):return self.installs.dry(issue)
    def installer_apply_once(self,issue):return self.installs.apply_once(issue)
    def preserve_installer_full_state(self,issue):return self.installs.preserve(issue)
    def installer_repeat_noop(self,issue):
        result=self.installs.repeat(issue);self.disk.finish('issue-'+issue);return result

    def retain_predecessor_under_reviewed_name(self):return self.predecessor.retain_name()

    def record_exact_candidate_intent(self):
        require(self.intent is None and self.installs.index==3 and self.installs.pending is None,
            'Complete preserved 206/214/209 chain required before candidate intent')
        self.intent={'owner':CANDIDATE_OWNER,'name':'soilfer-lims','head':HEAD,'image':IMAGE,
            'specificationSha256':sha(canonical(self.candidate.spec)),'neverRetry':True}
        # This full private specification survives a lost create/start return.
        exclusive_record(self.root,'candidate-stop-intent.json',{
            'intent':self.intent,'privateSpecification':self.candidate.spec},self.journal.sync)
        self.journal.append('exactCandidateIntent',self.intent)
        return self.intent

    def start_exact_candidate_jobs_on_once(self,intent):
        require(intent==self.intent and self.intent is not None,'Exact durable candidate intent required')
        self.disk.begin('candidate-startup')
        self.natural=self.natural_factory(self.installs.previous,self.installs.previous_state,self.inspect_candidate)
        self.natural.capture_before_start()
        self.disk.claim('startup-policy-chain')
        identity=self.candidate.start_once()
        exclusive_record(self.root,'candidate-started-identity.json',self.candidate.started,self.journal.sync)
        return identity

    def inspect_candidate(self):
        require(self.candidate.id is not None,'Candidate identity not yet returned; emergency owner lookup required')
        value=self.reader.inspect(self.candidate.id)
        projection=candidate_projection(value,self.candidate.spec,True)
        require(self.candidate.started is not None and projection==self.candidate.started,
            'Candidate identity/start/configuration changed while serving')
        return value

    def wait_ready_and_memory(self,identity,deadline):
        require(identity==self.candidate.id and deadline==READY_SECONDS and self.candidate.start_began is not None,
            'Exact one600 second Docker-start clock required')
        self.monitor=self.monitor_factory(identity,self.candidate.start_began,self.inspect_candidate)
        self.natural.monitor=self.monitor
        self.readiness=self.monitor.wait(identity)
        self.disk.finish('candidate-startup');return self.readiness

    def first_natural_sync_with_full_preservation(self,identity):
        require(identity==self.candidate.id and self.readiness is not None,'Ready exact candidate required')
        self.disk.begin('first-sync');value=self.natural.first_full_preservation(self.readiness)
        self.disk.finish('first-sync');return value

    def broad_postflights(self,identity):
        require(identity==self.candidate.id and self.natural.first_backup is not None,
            'First full natural backup must precede readonly postflights')
        self.disk.begin('postflight')
        value=self.probes_factory(self.monitor).run(identity,self.natural.first_backup)
        self.disk.finish('postflight');return value

    def check_full_accounting_before_reopen(self):
        require(self.disk.budget.active is None and self.disk.budget.completed==len(TABLE)-1,
            'All retained copy stages must close before reopening')
        require(tree_state(LIVE_ASSETS)==self.assets,'Original assets changed before reopening')
        self.inspect_candidate()
        self.journal.append('beforeReopenContainerPreservation',inventory_preserved(
            self.original_inventory,self.reader.inventory(),self.candidate.id))
        self.disk.topology_check('before-reopen');return self.disk.sample('before-reopen')

    def reopen_and_verify_200_200_401(self):return self.ingress.transition(False)

    def second_natural_sync_receipt(self,identity):
        require(identity==self.candidate.id,'Exact serving candidate required')
        self.disk.begin('second-sync');value=self.natural.second_receipt_after_reopen()
        self.disk.finish('second-sync');return value

    def stop_exact_candidate_for_intent(self,intent,identity,grace):
        require(grace==STOP_GRACE_SECONDS,'Exact candidate stop grace required')
        errors=[];cli_result=None;candidate_result=None
        # Every compiled CLI is attempted even when the sequence failed before
        # returning any command/candidate ID. Failure of one cannot skip another.
        try:cli_result=self.stop_clis()
        except BaseException as error:errors.append({'phase':'cliOwners','errorType':type(error).__name__})
        try:candidate_result=self.candidate.stop_for_intent(self.predecessor.emergency)
        except BaseException as error:errors.append({'phase':'candidateOwner','errorType':type(error).__name__})
        require(not errors and cli_result.get('allObservedExactCliOwnersStopped') is True,
            'Independent exact owner stops incomplete; retain all and forward-hold')
        return {'cliOwners':cli_result,'candidate':candidate_result}

    def preapply_recovery_proof(self,receipt):
        require(not receipt['anyApplyAttempted'] and not receipt['anyEntrypointAttempted'] and
            self.installs.original_raw is not None and self.installs.previous is not None and
            not self.predecessor.renamed and not self.predecessor.restarted,
            'Early recovery requires an actual retained raw backup before every APPLY intent')
        self.assert_no_volume_writers()
        observed=self.reader.inspect(PREDECESSOR_ID);self.predecessor.exact(observed)
        require(observed['State']['Running'] is False,'Exact original predecessor must remain stopped')
        raw=self.root/'stopped-predecessor/raw/dev.db'
        result={'exactStoppedPredecessorAndNoWriters':True,
            'retainedRawBackup':identity_record(triple(raw)),
            'currentStoppedTriple':identity_record(triple(pathlib.Path(LIVE_DATA)/'dev.db'))}
        self.journal.append('preApplyRawRecoveryProof',result);return result

    def restart_exact_retained_predecessor_once(self):return self.predecessor.restart_preapply_once()
    def verify_restarted_predecessor_ready(self,deadline):
        # Separate exact-old reader preserves its existing swap allowance and
        # original configuration. The new candidate's Swap0 reader is not used.
        return self.recovery_ready(self.predecessor,deadline)

    def seal_terminal_receipt(self,receipt):
        if receipt['status']=='DEPLOYED_AWAITING_CLAUDIO_POSTCHECK':
            self.inspect_candidate();self.monitor.observe('before-controller-exit',True)
            receipt['candidateMemory']=serving_memory_summary(self.monitor.memory,self.readiness['maxReadyRssBytes'])
            receipt['allContainerPreservation']=inventory_preserved(
                self.original_inventory,self.reader.inventory(),self.candidate.id)
            receipt['controllerAfter']=self.controller.observe('after')
            require(self.disk.budget.completed==len(TABLE) and self.disk.budget.active is None,
                'All physical copy/accounting stages must be completed')
            receipt['candidateId']=self.candidate.id
            receipt['candidateStartedIdentity']=self.candidate.started
        receipt['root']=str(self.root);receipt['sourceManifestSha256']=self.authority.manifest_sha
        self.terminal_reference=self.journal.seal(receipt)
        if receipt['status'] in ('DEPLOYED_AWAITING_CLAUDIO_POSTCHECK','ABORTED_PRE_APPLY_PREDECESSOR_RECOVERED'):
            # The independent hook still checks this complete record, frozen
            # source, all eligible CLI owners and its own final controller OOM.
            exclusive_record(self.root,'controller-completion-permit.json',{
                'root':str(self.root),'status':receipt['status'],'receipt':self.terminal_reference,
                'manifestSha256':self.authority.manifest_sha,'candidateIntent':self.intent,
                'candidateId':self.candidate.id,'actualStopPostStillRequired':True},self.journal.sync)

    def enqueue_partial_receipt_for_issue162(self,receipt):
        return exclusive_record(self.root,'partial-receipt-issue162-outbox.json',{
            'issue':162,'root':str(self.root),'head':HEAD,'image':IMAGE,'status':receipt['status'],
            'sourceManifestSha256':self.authority.manifest_sha,
            'receipt':self.terminal_reference,'errorType':receipt.get('errorType'),
            'holdErrors':receipt.get('holdErrors',[]),'automaticPostedClaim':False,
            'noRawEnvironmentKeysOrScientificPayload':True,'needsActualParentDelivery':True},self.journal.sync)
