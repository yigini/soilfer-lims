"""Pure release-kit policy. Importing performs no I/O or production actions.

This is the kit foundation, not an executable release or a source approval.
The complete coordinator and exact review are required before packaging.
"""
import hashlib
import json
import math

HEAD='be8379745bdfae52ce46496ff26514dc7d729640'
TREE='676b01e71211786d1aeace50f19a0b2c9f9c482e'
IMAGE='sha256:acc158447f5571068bf150fc0e8fa6f0889aeb38f9aec8be08978d903bd5be6a'
IMAGE_BYTES=414683521
BUILD_RECEIPT_SHA='cd3a2757d8ecb0bf933f49231031eb7fb61eb5abaac17d05f3585c1baaf89f0a'
ACCEPTANCE_ID=6212990400
ACCEPTANCE_BODY_SHA='6ea2ee1f1ec0b3eeec455ebab5b8d1cbadd17e93d2741eefdc501070fad3fb26'
ACCEPTANCE_SEMANTIC_SHA='011617a88b042b71842fe317e796f298fd6d91ccd6ea355e99f9e80225ff97d3'
QUALIFICATION_PUBLICATION='e5689d026138f5ecef76ade70ac6d3ee58518a95'
QUALIFICATION_SOURCE='187636984895aec44044635fb63498b0fcb3102e'
QUALIFICATION_RECEIPT_SHA='a82a8f5312086920c1c008785193068b70172e6ce71ddb7711c05897d4c8cd63'
STOP_POST_SHA='36516567a7f07a80209d8195c4ebbaa06baac42b4da83950a4e47c69ae770532'
MEMORY_MAX=805306368
SAMPLED_NONRECLAIMABLE_MAX=603979776
READY_SECONDS=600
GATE_SECONDS=600
STOP_GRACE_SECONDS=10
FLOOR=10556150894
LOG_RESERVE=4*1024**3
ADDITIONAL_HEADROOM=10000000000
UNEXPLAINED_ABORT=500000000
POSTFLIGHT_POLICY='AFTER_NATURAL_SYNC_ENUMERATED_INTAKE_DELTA'
FIVE_COUNTS=('Sample','Result','Batch','BatchQcResult','AuditLog')
EXPECTED_QUALIFICATION_DELTAS={'Sample':193,'SampleHold':23,'AuditLog':239,'Notification':1}
OBSERVED_IMPACT={
    'lab':'ZMB-LAB1','newSamples':193,'newHolds':23,
    'changedOldCrossSubmissionDuplicates':20,'managerNotifications':1,
    'otherLabsChanges':0,'productionMayHaveMoreSubmissions':True,
}
IMPACT_TEXT=(
    'The qualification run added 193 samples and 23 holds for ZMB-LAB1. '
    'It marked 20 existing samples as cross-submission duplicates and sent '
    'one notification to the ZMB manager. Other labs were unchanged. '
    'Production may see more if new Kobo submissions arrive before release.'
)
PHASES=('quiesce503','predecessorStop','stoppedIntegrityFk','stoppedBackup',
        'install206','install214','install209','candidateStart','candidateReady','reopen')

def require(value,message):
    if not value:raise RuntimeError(message)

def canonical(value):
    return json.dumps(value,sort_keys=True,separators=(',',':'),ensure_ascii=True).encode()

def sha(raw):return hashlib.sha256(raw).hexdigest()

def acceptance(review):
    app=review.get('performed_via_github_app') or {}
    require(review.get('id')==ACCEPTANCE_ID and app.get('id')==1236702 and app.get('slug')=='claude','Actual kit scope required')
    require(review.get('created_at')==review.get('updated_at')=='2026-10-16T09:59:11Z','Kit scope edited')
    require(sha(review.get('body','').encode())==ACCEPTANCE_BODY_SHA,'Kit scope body differs')
    projection={k:review[k] for k in ('id','body','created_at','updated_at')}
    projection['app']={'id':app['id'],'slug':app['slug']}
    require(sha(canonical(projection))==ACCEPTANCE_SEMANTIC_SHA,'Kit scope semantic binding differs')

def impact_sha():return sha(canonical({'observed':OBSERVED_IMPACT,'text':IMPACT_TEXT}))

def validate_fresh_yy_confirmation(value,now_epoch):
    """Explicit fields must come from a fresh actual human #162 gate answer."""
    require(type(now_epoch) in (int,float) and math.isfinite(now_epoch),'Invalid confirmation clock')
    require(value.get('confirmedByYY') is True and value.get('issue')==162,'Fresh YY confirmation required')
    require(type(value.get('commentId')) is int and value['commentId']>ACCEPTANCE_ID,'Old workload confirmation refused')
    require(value.get('url')=='https://github.com/yigini/soilfer-lims/issues/162#issuecomment-'+str(value['commentId']),'Confirmation URL differs')
    require(value.get('head')==HEAD and value.get('image')==IMAGE,'Confirmation targets another release')
    at=value.get('createdEpoch')
    require(type(at) in (int,float) and math.isfinite(at) and 0<=now_epoch-at<=GATE_SECONDS,'YY confirmation is not fresh')
    require(value.get('impactSha256')==impact_sha() and value.get('acceptsFirstSyncImpact') is True,'YY has not accepted the intake list')
    require(value.get('labAndHubBuildsOwnedByYY') is True and value.get('controlled') is True,'Lab/hub workload control missing')
    require(value.get('releaseWindowControl') in ('NO_LAB_HUB_BUILDS_OR_IMPORTS','RELEASE_DAY_DISK_ABORTS_ACCEPTED'),'Release-day abort acceptance missing')
    return value

def disk_required(database_allocated,image_bytes,assets_allocated,remaining_allocations=0):
    values=(database_allocated,image_bytes,assets_allocated,remaining_allocations)
    require(all(type(x) is int and x>=0 for x in values),'Invalid exact disk inputs')
    return max(3*(database_allocated+image_bytes),5000000000,
               FLOOR+LOG_RESERVE+ADDITIONAL_HEADROOM+remaining_allocations+3*assets_allocated)

def unexplained_drop(before,after,known_disjoint_growth):
    require(all(type(x) is int and x>=0 for x in (before,after,known_disjoint_growth)),'Invalid disk accounting')
    value=max(0,before-after-known_disjoint_growth)
    require(value<=UNEXPLAINED_ABORT,'Unexplained disk drop exceeds 500 MB')
    return value

def failure_policy(installer_attempted,entrypoint_attempted):
    """No automatic predecessor restart, even if a COMMIT is unobserved.

    #187/6033653468 permits a proven unchanged pre-COMMIT predecessor.
    This release's later standing rule is stricter: any installer or default
    entrypoint attempt, including dry/NO_OP/failure, requires reviewed forward
    recovery. Absence of a success receipt never proves no COMMIT.
    """
    require(type(installer_attempted) is bool and type(entrypoint_attempted) is bool,'Invalid phase flags')
    return {'ingressStatus':503,'stopCandidate':True,'retainCandidate':True,
            'restoreDatabase':False,'restartPredecessor':False,
            'reviewedForwardRecoveryRequired':installer_attempted or entrypoint_attempted,
            'postPartialReceiptToIssue162':True,'retry':False}

def validate_postflight_counts(before,after,intake_delta):
    """Counts are after intake; the full row/provenance comparator is also required."""
    require(set(before)==set(after)==set(intake_delta)==set(FIVE_COUNTS),'Five postflight counts required')
    require(all(type(x) is int and x>=0 for group in (before,after,intake_delta) for x in group.values()),'Invalid postflight count')
    require(all(after[t]==before[t]+intake_delta[t] for t in FIVE_COUNTS),'Postflight intake delta differs')
    require(all(intake_delta[t]==0 for t in ('Result','Batch','BatchQcResult')),'Protected scientific count changed')
    return {'policy':POSTFLIGHT_POLICY,'before':before,'after':after,'intakeDelta':intake_delta}

def validate_memory_events(before,after):
    for value in (before,after):
        require(all(type(value.get(k)) is int and value[k]>=0 for k in ('oom','oom_kill')),'Memory OOM counters missing')
        require(value['oom']==value['oom_kill']==0,'OOM or oom_kill observed')
    return {'before':before,'after':after,'peakIsObservationOnly':True}

def downtime_assessment(phase_seconds):
    require(set(phase_seconds)==set(PHASES),'Every outage phase needs a measured duration')
    require(all(type(x) in (int,float) and math.isfinite(x) and x>=0 for x in phase_seconds.values()),'Invalid phase duration')
    total=sum(phase_seconds.values())
    return {'seconds':total,'fitsTenMinutes':total<=600,
            'includesStopGraceActualExitIntegrityBackupInstallStartReadyReopen':True,
            'prospectiveProductionGuarantee':False}
