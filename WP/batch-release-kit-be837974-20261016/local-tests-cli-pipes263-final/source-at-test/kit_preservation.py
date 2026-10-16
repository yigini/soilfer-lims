"""Whole container inventory and running-final memory receipt predicates.

The original memory reader and its before-stop summary remain unchanged.
Successful production leaves the qualified candidate serving, so its final
sample is explicitly before controller exit, never labelled before stop.
"""
from kit_contract import MEMORY_MAX,SAMPLED_NONRECLAIMABLE_MAX,canonical,require
from kit_owned import LABEL,ALLOWED,cli_spec
from kit_integrity import DATA_MOUNT
from kit_runtime import PREDECESSOR_ID,CANDIDATE_OWNER,RETAINED_PREDECESSOR_NAME,predecessor_projection,full_mounts


def inventory_projection(value):
    state=value.get('State',{})
    require(type(state.get('Running')) is bool and isinstance(state.get('StartedAt'),str),
        'Complete historical container runtime identity required')
    return {'id':value['Id'],'name':value['Name'],'image':value['Image'],
        'config':value['Config'],'hostConfig':value['HostConfig'],'mounts':full_mounts(value),
        'running':state['Running'],'startedAt':state['StartedAt'],
        'restarts':value.get('RestartCount'),'oomKilled':state.get('OOMKilled')}


def inventory_preserved(before,after,candidate_id,predecessor_renamed=True):
    require(isinstance(before,dict) and isinstance(after,dict) and PREDECESSOR_ID in before and
        set(before)<=set(after),'An original retained container is missing')
    allowed_owners={cli_spec(label,DATA_MOUNT)['owner'] for label in ALLOWED}|{CANDIDATE_OWNER}
    checked=[]
    for identity,old in before.items():
        a=inventory_projection(old);b=inventory_projection(after[identity])
        if identity==PREDECESSOR_ID:
            # Exactly the reviewed stop/retention rename is permitted. No new
            # StartedAt is accepted on the successful forward deployment path.
            a['running']=False
            if predecessor_renamed:a['name']='/'+RETAINED_PREDECESSOR_NAME
        require(a==b,'Historical identity/configuration/mounts/state changed')
        checked.append(identity)
    new=[]
    for identity in set(after)-set(before):
        row=after[identity];owner=row.get('Config',{}).get('Labels',{}).get(LABEL)
        require(owner in allowed_owners,'Unreviewed new container appeared')
        require(identity==candidate_id if owner==CANDIDATE_OWNER else row['State']['Running'] is False,
            'Unexpected candidate identity or retained CLI still running')
        new.append(identity)
    require(candidate_id in after and after[candidate_id]['State']['Running'] is True and
        after[candidate_id]['Config']['Labels'].get(LABEL)==CANDIDATE_OWNER,
        'Exact running production candidate required')
    return {'allOriginalContainersPreserved':True,'originalIds':sorted(checked),
        'newReviewedOwnedIds':sorted(new),'candidateRemainsServing':True,'noContainersRemoved':True}


def serving_memory_summary(history,rss):
    require(history.samples and history.samples[-1]['phase']=='before-controller-exit',
        'Fresh final memory.events before controller exit required')
    require(type(rss) is int and rss>=0 and history.descriptor is not None,
        'Exact READY RSS and stable candidate memory identity required')
    require(all(row['memoryEvents']['oom']==row['memoryEvents']['oom_kill']==0 and
        row['nonReclaimableBytes']<=SAMPLED_NONRECLAIMABLE_MAX for row in history.samples),
        'Candidate final memory summary contains a refused sample')
    result={'hostMemorySamples':history.samples,'stableIdentity':history.descriptor,
        'sampledNonReclaimableMaxBytes':max(row['nonReclaimableBytes'] for row in history.samples),
        'nonReclaimableLimitBytes':SAMPLED_NONRECLAIMABLE_MAX,'maxReadyRssBytes':rss,
        'memoryPeakBytesObservation':max(row['memoryPeakBytesObservation'] for row in history.samples),
        'peakIsObservationNotGate':True,'oomAndOomKillZeroEverySample':True,
        'hostBeforeControllerExitEventsChecked':True,'candidateStoppedForThisSummary':False,
        'memoryMaxBytes':MEMORY_MAX,'memorySwapMaxBytes':0,'samplingIsNotContinuousPeakMeasurement':True}
    history.reserve_evidence(len(canonical(result))+129)
    result['sampleAndSummaryAllocatedAllowanceBytes']=history.evidence_allocated
    return result
