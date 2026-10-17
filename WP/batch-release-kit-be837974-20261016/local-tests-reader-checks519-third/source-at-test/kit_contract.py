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
TIMING_DIRECTION_ID=6213266959
TIMING_DIRECTION_BODY_SHA='0afe213f777d2adafd7ade6e7b3eb880fe2b64a12735e6a793779d2275de8087'
TIMING_DIRECTION_SEMANTIC_SHA='e3171a28a04fe8326fc3fed6f641b3ea2e9a724ddf97a55ca7f79e9b9ba28443'
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
POSTFLIGHT_POLICY='AFTER_FIRST_NATURAL_SYNC_BEFORE_INGRESS_REOPEN_ENUMERATED_INTAKE_DELTA'
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
UNIT_SECONDS=5400
UNIT_HEADROOM=600
PHASES=('quiesce503','predecessorStop','noLiveVolumeWriters','stoppedIntegrityFk',
        'freshDiskBeforeBackup','stoppedBackup','canonicalPolicyNoOp',
        *(name+issue for issue in ('206','214','209') for name in ('impactBefore','dry','apply','preserve','repeat')),
        'retainStoppedPredecessorName','candidateIntent','candidateStart','candidateReady',
        'firstNaturalSync','apiAndReadOnlyPostflights','freshDiskBeforeReopen','reopen')

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

def validate_fresh_yy_confirmation(value,now_epoch,outage_disclosure):
    """Explicit fields must come from a fresh actual human #162 gate answer."""
    require(type(now_epoch) in (int,float) and math.isfinite(now_epoch),'Invalid confirmation clock')
    require(value.get('confirmedByYY') is True and value.get('issue')==162,'Fresh YY confirmation required')
    require(type(value.get('commentId')) is int and value['commentId']>TIMING_DIRECTION_ID,'Old workload confirmation refused')
    require(value.get('url')=='https://github.com/yigini/soilfer-lims/issues/162#issuecomment-'+str(value['commentId']),'Confirmation URL differs')
    require(value.get('head')==HEAD and value.get('image')==IMAGE,'Confirmation targets another release')
    at=value.get('createdEpoch')
    require(type(at) in (int,float) and math.isfinite(at) and 0<=now_epoch-at<=GATE_SECONDS,'YY confirmation is not fresh')
    require(value.get('impactSha256')==impact_sha() and value.get('acceptsFirstSyncImpact') is True,'YY has not accepted the intake list')
    require(value.get('outageDisclosureSha256')==sha(canonical(outage_disclosure)) and value.get('acceptsWholeOutage') is True,'YY has not accepted the expected and longest outage disclosure')
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

def timing_direction(review):
    app=review.get('performed_via_github_app') or {}
    require(review.get('id')==TIMING_DIRECTION_ID and app.get('id')==1236702 and app.get('slug')=='claude','Actual timing direction required')
    require(review.get('created_at')==review.get('updated_at')=='2026-10-16T10:15:47Z','Timing direction edited')
    require(sha(review.get('body','').encode())==TIMING_DIRECTION_BODY_SHA,'Timing direction body differs')
    projection={k:review[k] for k in ('id','body','created_at','updated_at')};projection['app']={k:app[k] for k in ('id','slug')}
    require(sha(canonical(projection))==TIMING_DIRECTION_SEMANTIC_SHA,'Timing direction semantic binding differs')

def failure_policy(apply_attempted,entrypoint_attempted):
    """6213266959 permits proven early recovery before ANY APPLY dispatch.

    The intent flag precedes the call. A missing result or COMMIT receipt is
    never evidence that APPLY did not start. Recovery also requires the full
    retained raw triple and the exact predecessor's independent checks.
    """
    require(type(apply_attempted) is bool and type(entrypoint_attempted) is bool,'Invalid phase flags')
    return {'ingressStatus':503,'stopCandidate':True,'retainCandidate':True,
            'restoreDatabase':False,'restartPredecessor':False,
            'preApplyRecoveryMayBeAttempted':not apply_attempted and not entrypoint_attempted,
            'reviewedForwardRecoveryRequired':apply_attempted or entrypoint_attempted,
            'postPartialReceiptToIssue162':True,'retry':False}

def verify_preapply_raw_triple(backup,current,apply_attempted,entrypoint_attempted):
    require(type(apply_attempted) is bool and type(entrypoint_attempted) is bool and not apply_attempted and not entrypoint_attempted,'APPLY or entrypoint may have started; early recovery refused')
    require(isinstance(backup,dict) and isinstance(current,dict) and set(backup)==set(current)=={'','-wal','-shm'},'Exact retained raw triple required for early recovery')
    def identity(row):
        if row is None:return None
        require(isinstance(row,dict) and type(row.get('bytes')) is int and row['bytes']>=0 and isinstance(row.get('sha256'),str) and len(row['sha256'])==64 and all(x in '0123456789abcdef' for x in row['sha256']),'Malformed raw triple identity')
        require(row['bytes']!=0 or row['sha256']==sha(b''),'Empty file digest differs')
        return row['bytes'],row['sha256']
    a={k:identity(v) for k,v in backup.items()};b={k:identity(v) for k,v in current.items()}
    require(a[''] is not None and a==b,'Stopped DB/WAL/SHM differ from retained raw backup; no restart')
    return {'mainWalShmHashAndLengthExact':True,'absentAndEmptyNotEquivalent':True,'databaseRestore':False}

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
            'phaseSumIncludesAllDeclaredQuiesceThroughReopenPhases':True,
            'actualWholeOutageRequiresMonotonicQuiesceToReopenMeasurement':True,
            'prospectiveProductionGuarantee':False}

def whole_outage_disclosure(phase_estimates):
    """Disclose measured components and honest allowances, not a new proof.

    Unit RuntimeMaxSec and existing operation deadlines remain unchanged.
    A failed post-APPLY release can remain at503 beyond the controller's life.
    That indefinite forward-recovery time must not be sold as a90-minute SLA.
    """
    require(isinstance(phase_estimates,dict) and set(phase_estimates)==set(PHASES),'Every outage component needs an explicit estimate')
    values={}
    for phase,row in phase_estimates.items():
        require(isinstance(row,dict) and row.get('kind') in ('RETAINED_MEASUREMENT_OTHER_CONTEXT','REVIEWED_ALLOWANCE'),'Measurement context or explicit allowance required')
        value=row.get('seconds');require(type(value) in (int,float) and math.isfinite(value) and value>=0,'Invalid outage component')
        require(isinstance(row.get('basis'),str) and bool(row['basis'].strip()),'Outage estimate basis missing')
        values[phase]=value
    seconds=sum(values.values())
    require(0<seconds<UNIT_SECONDS-UNIT_HEADROOM,'Expected outage leaves no unit headroom')
    minutes=math.ceil(seconds/60)
    text=('Expected maintenance outage: about '+str(minutes)+' minutes, based on the listed earlier measurements and explicit allowances. '
          'The release controller can run for at most 90 minutes, with the existing individual operation deadlines and a 10-minute candidate readiness deadline. '
          'If an abort occurs after any APPLY starts, the site remains at503 until a separately reviewed forward fix; reopening within90 minutes is not promised. '
          'Before any APPLY, only a proven unchanged DB/WAL/SHM raw backup permits the retained predecessor to restart without restoring data.')
    return {'phaseEstimates':phase_estimates,'expectedOutageSeconds':seconds,'expectedMinutesRoundedUp':minutes,
            'controllerMaximumSeconds':UNIT_SECONDS,'candidateReadinessSeconds':READY_SECONDS,
            'failureMaintenanceCanContinueBeyondController':True,'noNewInstallerTransactionKillPoints':True,'plainGateText':text}
