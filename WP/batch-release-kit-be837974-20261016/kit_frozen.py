"""Exact source/kit review bindings and exclusive fresh human gate consumption.

This module accepts original review records only. It never creates an approval
or treats a caller's boolean as review authority. Packaging/launcher wiring is
still separate required work. No I/O occurs at import.
"""
import datetime
import os
import pathlib
import re
import stat
from kit_contract import (HEAD,TREE,IMAGE,BUILD_RECEIPT_SHA,ACCEPTANCE_ID,TIMING_DIRECTION_ID,
    POSTFLIGHT_POLICY,canonical,require,sha,validate_fresh_yy_confirmation)
from retained_contract import ROOT,exact_json
from kit_journal import exclusive_record

SOURCE_SCOPE='PRODUCTION_FORWARD_206_214_209_QUALIFIED_ACC158_REVIEWED_WHOLE_OUTAGE'
REQUIRED_SOURCE={
    'kit_contract.py','kit_sequence.py','kit_journal.py','kit_io.py','kit_evidence.py','controller_output.py','kit_docker.py','kit_consumer_inventory.py',
    'kit_owned.py','kit_cli_evidence.py','kit_cli_output.py','cli_output.cjs','kit_integrity.py','stopped_integrity.cjs','cli_guard.cjs','live_backup.cjs',
    'live-backup-sqlite-source.json','sqlite_temp_directory.cjs','sqlite-temp-directory-source.json',
    'kit_capture_main.py','capture-native-main-source.json',
    'kit_linux_main_vfs.py','linux-main-vfs-source.json',
    'kit_statement_journal.py','statement-journal-source.json',
    'kit_wal_content.py','wal-content-source.json',
    'kit_readonly_target_wal.py','readonly-target-wal-source.json',
    'kit_wal_dirty_inventory.py','wal-dirty-inventory-source.json',
    'kit_wal_source_binding.py','wal-source-binding-source.json',
    'kit_order_revision_native.py','order-revision-native-source.json',
    'kit_sorter_scratch.py','sorter-scratch-source.json',
    'kit_linux_sorter_vfs.py','linux-sorter-vfs-source.json',
    'kit_ephemeral_btree.py','ephemeral-btree-source.json',
    'kit_record_payload.py','record-payload-source.json',
    'kit_general_sorter.py','general-sorter-source.json',
    'kit_fingerprint_sorter.py','fingerprint-sorter-source.json',
    'kit_reader_schema_scratch.py','reader-schema-scratch-source.json',
    'kit_reader_initialization.py','reader-initialization-source.json',
    'kit_reader_pragma_checks.py','reader-pragma-checks-source.json',
    'kit_record_profile_scratch.py','record-profile-scratch-source.json',
    'kit_backup_core.py','backup-core-source.json',
    'kit_backup_main.py','backup-main-source.json',
    'kit_backup_source_binding.py','backup-source-binding-source.json',
    'kit_header_normalization.py','header-normalization-source.json',
    'kit_capture_statement.py','capture-statement-journal-source.json',
    'kit_schema_collection.py','schema-collection-source.json',
    'kit_main_mutations.py','kit_capture_native_inventory.py','capture-native-inventory-source.json',
    'order_impact.cjs','kit_order_output.py','order-impact-transport-source.json',
    'kit_install.py','kit_runtime.py','kit_readiness.py','kit_natural.py','kit_no_writers.py','kit_ingress.py',
    'kit_budget.py','kit_disk.py','kit_copy_admission.py','kit_app_snapshots.py','application-snapshot-source.json',
    'kit_target_reader.py','target-reader-index-source.json','kit_rollback_journal.py','rollback-journal-source.json','kit_main_growth.py','main-growth-source.json','kit_probes.py','kit_frozen.py',
    'kit_preservation.py','kit_recovery.py','kit_emergency_ingress.py','kit_stop.py','kit_stop_lifecycle.py',
    'build_stop_post.py','predecessor-startup-expectations.json',
    'retained_app_copy.py','kit_recovery_copy.py','predecessor-copy-source-binding.json',
    'retained_authority.py','kit_provider.py','kit_authority.py','kit_science.py','kit_construction.py','kit_outage.py','timing-evidence.json',
    'kit_package.py','kit_launch_programs.py','kit_apache_capture.py',
    'kit_capture_owned.py','kit_capture_memory.py','capture_cli_guard.cjs','build_capture_stop_post.py','capture_stop_post.py',
    'kit_capture_budget.py','kit_capture_copy.py','kit_capture_authority.py','kit_capture_science.py','kit_capture_review.py',
    'kit_capture_journal.py','kit_capture_journal_package.py','capture_writer_journal.cjs','capture-writer-journal-source.json',
    'capture_controller_output.py','kit_capture_controller.py','kit_capture_outcome.py',
    'kit_capture_construction.py','kit_capture_package.py','run_capture.py',
    'kit_capture_inputs.py','kit_capture_launch.py','prepare_capture.py','launch_capture.py',
    'kit_ops.py','run_release.py','stop_post.py','prepare_release.py','launch_release.py',
    'application-source-binding.json','copy-site-closure.json','whole-outage-disclosure.json',
    'startup-expectations.json','probe-source-map.json','compose-source.yml',
    'retained_accounting.py','retained_files.py','retained_contract.py','retained_health.py','retained_memory.py',
    'retained_controller.py','retained_intake.py','retained_fetch.py','retained_provenance.py','retained_privacy.py',
    'retained_runtime_policy.py','postflight-roles.cjs','postflight-auth.cjs','postflight-reference.cjs',
    'postflight-qc-runs.cjs','postflight-policy.cjs','readonly-smoke.cjs',
}

def source_index(value):
    require(isinstance(value,dict) and value.get('version')==1 and value.get('scope')==SOURCE_SCOPE and
        value.get('root')==str(ROOT) and value.get('head')==HEAD and value.get('tree')==TREE and
        value.get('image')==IMAGE and value.get('buildReceiptSha256')==BUILD_RECEIPT_SHA,
        'Exact new production source-index target required')
    require(re.fullmatch('[a-f0-9]{40}',value.get('sourceCommit','')),'Published exact source commit required')
    files=value.get('files')
    require(isinstance(files,dict) and REQUIRED_SOURCE<=set(files) and len(files)<=256,'Complete production graph required before source review')
    for name,row in files.items():
        require(isinstance(name,str) and re.fullmatch('[A-Za-z0-9][A-Za-z0-9_.-]{0,150}',name) and
            isinstance(row,dict) and set(row)=={'sha256','bytes','gitBlob'} and
            re.fullmatch('[a-f0-9]{64}',row.get('sha256','')) and re.fullmatch('[a-f0-9]{40}',row.get('gitBlob','')) and
            type(row.get('bytes')) is int and 0<row['bytes']<=16*1024**2,'Invalid exact frozen source record')
    return value

def actual_claude(review,after_id):
    require(isinstance(review,dict),'Original actual review required')
    app=review.get('performed_via_github_app') or {}
    require(app.get('id')==1236702 and app.get('slug')=='claude' and
        type(review.get('id')) is int and review['id']>after_id,'New actual Claude GitHub-app review required')
    require(review.get('created_at')==review.get('updated_at') and isinstance(review.get('body'),str),
        'Edited or missing review body refused')
    created=datetime.datetime.fromisoformat(review['created_at'].replace('Z','+00:00'))
    require(created.tzinfo is not None,'Review UTC timestamp required')
    require(review.get('issue_url')=='https://api.github.com/repos/yigini/soilfer-lims/issues/162' and
        review.get('html_url')=='https://github.com/yigini/soilfer-lims/issues/162#issuecomment-'+str(review['id']),
        'Review is not the exact release issue comment')
    return created.timestamp()

def require_tokens(body,tokens):
    for token in tokens:require(token in body,'Actual exact review omitted a required source/kit binding')

def source_review(review,index):
    source_index(index);actual_claude(review,TIMING_DIRECTION_ID)
    body=review['body'];require(body.splitlines()[0].strip()=='Source review: PASS','Actual exact source PASS first line required')
    require_tokens(body,[SOURCE_SCOPE,'sourceIndexSha256='+sha(canonical(index)),index['sourceCommit'],str(ROOT),HEAD,TREE,IMAGE,
        BUILD_RECEIPT_SHA,'acceptedQualificationId='+str(ACCEPTANCE_ID),'timingDirectionId='+str(TIMING_DIRECTION_ID),
        'preApplyExactRawDbWalShmRecoveryOnly=true','anyApplyIntentOrUnknownOutcomeForwardOnly=true',
        'readinessSeconds=600','wholeOutageDisclosureRequired=true','singleHostWriter=true',
        'postflightPolicy='+POSTFLIGHT_POLICY,*[r['sha256'] for r in index['files'].values()]])
    return {'id':review['id'],'bodySha256':sha(body.encode()),'sourceIndexSha256':sha(canonical(index))}

def kit_review(review,manifest,index,source_pass):
    source=source_review(source_pass,index);created=actual_claude(review,source_pass['id'])
    require(isinstance(manifest,dict) and manifest.get('version')==1 and manifest.get('scope')==SOURCE_SCOPE and
        manifest.get('root')==str(ROOT) and manifest.get('head')==HEAD and manifest.get('image')==IMAGE and
        manifest.get('sourceIndexSha256')==source['sourceIndexSha256'] and
        manifest.get('sourceReviewBodySha256')==source['bodySha256'],'Frozen kit does not bind exact source PASS')
    for name in ('consumerConfigurationSha256','originalIngressSha256','heldIngressSha256',
                 'wholeOutageDisclosureSha256','actualScientificImpactSha256','packageFilesSha256'):
        require(re.fullmatch('[a-f0-9]{64}',manifest.get(name,'')),'Incomplete exact frozen kit metadata')
    body=review['body'];require(body.splitlines()[0].strip()=='Exact-kit review: PASS','Actual exact-kit PASS first line required')
    require_tokens(body,[SOURCE_SCOPE,'manifestSha256='+sha(canonical(manifest)),str(ROOT),HEAD,IMAGE,
        'sourceReviewId='+str(source_pass['id']),'noHostConsumerActsOnUnhealthyWindow=true',
        'freshYYWholeOutageIntakeAndWorkloadGateRequired=true',
        *[manifest[n] for n in ('consumerConfigurationSha256','originalIngressSha256','heldIngressSha256',
            'wholeOutageDisclosureSha256','actualScientificImpactSha256','packageFilesSha256')]])
    return {'id':review['id'],'bodySha256':sha(body.encode()),'createdEpoch':created,'manifestSha256':sha(canonical(manifest))}

def frozen_source_bytes(tooling,index):
    source_index(index);tooling=pathlib.Path(tooling)
    require(tooling.is_absolute() and tooling.is_dir(),'Exact existing frozen tooling directory required')
    for p in (tooling,*tooling.parents):require(not p.is_symlink(),'Frozen source directory alias refused')
    require({p.name for p in tooling.iterdir()}==set(index['files']),'Missing or extra frozen source entry')
    for name,row in index['files'].items():
        path=tooling/name;s=path.lstat()
        require(stat.S_ISREG(s.st_mode) and not path.is_symlink() and stat.S_IMODE(s.st_mode)==0o400 and s.st_nlink==1,
            'Frozen source must be an independent immutable regular file')
        raw=path.read_bytes()
        require(len(raw)==row['bytes'] and sha(raw)==row['sha256'] and
            __import__('hashlib').sha1(('blob '+str(len(raw))+'\0').encode()+raw).hexdigest()==row['gitBlob'],
            'Frozen source bytes differ from exact source review')
    return True

def human_gate_comment(comment,confirmation,now,disclosure,manifest_sha,kit_pass):
    require(isinstance(comment,dict) and (comment.get('performed_via_github_app') is None) and
        comment.get('user',{}).get('login')=='yigini','Original fresh human YY comment required; bot/model messages are not human confirmation')
    require(comment.get('created_at')==comment.get('updated_at') and comment.get('id')==confirmation.get('commentId') and
        comment.get('html_url')==confirmation.get('url') and
        comment.get('issue_url')=='https://api.github.com/repos/yigini/soilfer-lims/issues/162','Actual unedited human gate identity differs')
    created=datetime.datetime.fromisoformat(comment['created_at'].replace('Z','+00:00')).timestamp()
    require(created==confirmation.get('createdEpoch') and created>=kit_pass['createdEpoch'],
        'Human gate must follow exact kit PASS')
    # Human-visible acceptance text, not merely an agent-created JSON object.
    require_tokens(comment.get('body',''),[HEAD,manifest_sha,'I accept the disclosed whole outage',
        '193 samples','23 holds','20 existing','one notification','ZMB','Other labs unchanged',
        'production may have more','I accept the scientific impact lists',
        'I control lab and hub builds/imports',confirmation.get('releaseWindowControl','MISSING')])
    require(confirmation.get('manifestSha256')==manifest_sha and confirmation.get('exactKitReviewId')==kit_pass['id'],
        'Human confirmation belongs to another exact kit')
    validate_fresh_yy_confirmation(confirmation,now,disclosure)
    return {'humanCommentId':comment['id'],'humanBodySha256':sha(comment['body'].encode()),
        'manifestSha256':manifest_sha,'exactKitReviewId':kit_pass['id'],'createdEpoch':created}

def consume_gate(root,gate,manifest_sha,now,require_directory_sync=True):
    """One atomic exclusive consumption; no replacement, deletion or retry."""
    require(gate.get('manifestSha256')==manifest_sha and gate.get('root')==str(ROOT) and
        gate.get('status')=='FRESH_SINGLE_USE_AUTHORIZED' and gate.get('humanConfirmed') is True,
        'Exact authenticated gate required')
    require(type(gate.get('createdEpoch')) in (int,float) and 0<=now-gate['createdEpoch']<=600,
        'Single-use gate expired')
    require(type(gate.get('humanCreatedEpoch')) in (int,float) and 0<=now-gate['humanCreatedEpoch']<=600 and
        gate['humanCreatedEpoch']<=gate['createdEpoch'],'Fresh gate creation cannot refresh an expired human acknowledgement')
    require(re.fullmatch('[a-f0-9]{64}',gate.get('humanBodySha256','')) and type(gate.get('humanCommentId')) is int,
        'Original authenticated human gate binding absent')
    return exclusive_record(root,'production-gate-consumed.json',{'gateSha256':sha(canonical(gate)),
        'manifestSha256':manifest_sha,'humanCommentId':gate['humanCommentId'],'consumedEpoch':now,
        'neverRetry':True,'exclusive':True},require_directory_sync)
