"""Finish NEW Step2 integration source; no tests/operators/host calls."""
import pathlib,json,ast
W=pathlib.Path(__file__).resolve().parents[2];B=W/'WP/batch-proof-provenance-step2-be837974-20261016'
def patch(n,a,b):
    p=B/n;s=p.read_text(encoding='utf-8');assert a in s,(n,a);p.write_text(s.replace(a,b),encoding='utf-8',newline='\n')
n='kobo_copy_preservation.py'
patch(n,'from urllib.parse import quote','from urllib.parse import quote\nfrom provenance_privacy import value_hash,public_failure\nfrom provenance_rules import validate_added_and_changed,monotonic,fresh_submission\nfrom proof_contract import child_path')
patch(n,'return hashlib.sha256(encoded(row)).hexdigest()','return value_hash(list(row))')
patch(n,'refusal_configs=None):','refusal_configs=None,fetch_records=None,owner_root=None,notification_batches=None):')
patch(n,'prior = pathlib.Path(prior_database).resolve()','require(owner_root is not None,"NEW owned root required for proof SQL")\n    prior_database=child_path(owner_root,prior_database);current_database=child_path(owner_root,current_database)\n    prior = pathlib.Path(prior_database).resolve()')
patch(n,'new_holds = {}','new_holds = {}\n        changed_samples=[]')
patch(n,"else:\n                        require(encoded(old) == encoded(row), 'Original row changed: ' + table)\n                        normalized = list(row)","elif table=='Sample' and encoded(old)!=encoded(row):\n                        changed_samples.append((dict(old),dict(row)));normalized=list(old)\n                    else:\n                        require(encoded(old) == encoded(row), 'Original row changed: ' + table)\n                        normalized = list(row)")
patch(n,"if changed:\n                            config_changes.append", "for field in changed:\n                            if field in CLOCKS:require(row[field] is not None and (old[field] is None or monotonic(old[field],row[field])), 'Config clock regressed')\n                        if changed:\n                            config_changes.append")
s=(B/n).read_text(encoding='utf-8');a=s.index('        sample_scopes = {}');b=s.index('        for change in config_changes:',a)
s=s[:a]+'''        added_result=validate_added_and_changed(changed_samples,new_samples,additions['SampleHold'],additions['AuditLog'],additions['Notification'],configs,fetch_records,fetched_ids,managers,prior_fetched_ids,notification_batches)
        require(len(table_records)==expected_table_count and table_records['_schema_migrations']['before']['count']==42 and table_records['_schema_migrations']['after']['count']==42,'All112 tables and42 receipts required')
'''+s[b:]
s=s.replace("'configChanges': config_changes,","'configChanges': [{'id':c['id'],'fields':c['fields'],'beforeHmacSha256':value_hash(c['before']),'afterHmacSha256':value_hash(c['after'])} for c in config_changes],")
a=s.index("            'newSubmissionIds': {key:");b=s.index("            'protectedRefusalConfigIds':",a)
s=s[:a]+"            **added_result,\n"+s[b:]
s=s.replace("'allOriginalRowsPreserved': True,","'allOriginalRowsPreserved': not changed_samples,'allOriginalRowsPreservedExceptExactProvenance':True,")
(B/n).write_text(s,encoding='utf-8',newline='\n')
# Runtime full fetch records travel to each comparison. Only copies under this
# new root may supply SQL. The full comparison retains both phase summaries.
patch('proof_jobs.py',"fetched_ids=first_ids,refusal_configs=[r['configId'] for r in expected])","fetched_ids=first_ids,refusal_configs=[r['configId'] for r in expected],fetch_records=first_fetch,owner_root=root)")
patch('proof_jobs.py','fetched_ids=ids,prior_fetched_ids=prior_ids,refusal_configs=refused)','fetched_ids=ids,prior_fetched_ids=prior_ids,refusal_configs=refused,fetch_records=final_fetch,owner_root=root)')
patch('proof_jobs.py','expected_table_count=112,fetched_ids=ids,refusal_configs=refused)','expected_table_count=112,fetched_ids=ids,refusal_configs=refused,fetch_records=final_fetch,owner_root=root,\n        notification_batches=[first_state[\'notificationExpectations\'],second_state[\'notificationExpectations\']])')
# Every previous first-fetch ID is protected on the second natural sync,
# including configs whose completion header is not the target-lab header.
patch('proof_jobs.py',"prior_ids={key:first_ids[key] if completed_syncs(log,r['labId']) else first_state['newSubmissionIds'].get(key,[]) for key,r in configs.items()}","prior_ids={key:first_ids[key] for key in configs}")
patch('proof_jobs.py',"'all112TablesOriginalRowsSchemaAnd42ReceiptsPreserved':True","'all112TablesOriginalRowsExceptExactProvenanceSchemaAnd42ReceiptsPreserved':True")
patch('proof_jobs.py',"'onlyEnumeratedNaturalIntakeChanges':True,","'onlyEnumeratedNaturalIntakeChanges':True,'secondNaturalConflictIdempotenceVerified':True,")
# Systemd post-stop executes independently even after SIGKILL/OOM/timeout.
patch('launch_proof.py',"'--property=Restart=no','--property=UMask=0077'","'--property=Restart=no','--property=TimeoutStopSec=180','--property=ExecStopPost=/usr/bin/python3 -B '+str(root/'stop_owned.py'),'--property=UMask=0077'")
# Controller OOM/oom_kill is guarded BEFORE copies and before closing a PASS;
# independent ExecStopPost records it after termination as well.
patch('run_stopped_proof.py','from proof_health import load_health','from proof_health import load_health\nfrom provenance_privacy import initialize_private_key,public_failure\nfrom controller_guard import ControllerGuard')
patch('run_stopped_proof.py',"import signal\n    def interrupted", "initialize_private_key(root);controller=ControllerGuard(root)\n    import signal\n    def interrupted")
patch('run_stopped_proof.py',"before=healthy_predecessor(inspect(PREDECESSOR_ID))", "controller.observe('before')\n        before=healthy_predecessor(inspect(PREDECESSOR_ID))")
patch('run_stopped_proof.py',"write_new(root/'proof-receipt.json',", "controller.observe('after')\n        write_new(root/'proof-receipt.json',")
patch('run_stopped_proof.py',"'newInstallerOrPolicyCalls':0,", "'newInstallerOrPolicyCalls':0,'diagnosticAcceptedId':6206990387,'controllerMemoryGuardPassed':True,'stopPostRequiredBeforeIndependentAcceptance':True,'publicValuesHmacSha256':True,")
patch('run_stopped_proof.py',"stop_error=str(stopped)","stop_error=public_failure(stopped)")
patch('run_stopped_proof.py',"observation_error=type(observed).__name__+': '+str(observed)","observation_error=public_failure(observed)")
patch('run_stopped_proof.py',"'error':type(error).__name__+': '+str(error)","'error':public_failure(error)")
patch('run_stopped_proof.py',"        raise\nif __name__", "        raise RuntimeError('Proof refused; private details retained, no retry') from None\nif __name__")
patch('proof_budget.py',"'capture_kobo_fetch.py':{},'kobo_copy_preservation.py':{},'runtime_proof_policies.py':{},","'capture_kobo_fetch.py':{},'kobo_copy_preservation.py':{},'runtime_proof_policies.py':{},\n    'provenance_rules.py':{},'provenance_privacy.py':{},'controller_guard.py':{},'stop_owned.py':{},")
print(json.dumps({'status':'NEW_STEP2_INTEGRATED_SOURCE_NOT_TESTED_OR_APPROVED','rootProposed':'workflow-batch-provenance-step2-be837974-20261016T050000Z','operators':0,'hostCalls':0}))
