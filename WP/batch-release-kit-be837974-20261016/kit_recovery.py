"""Readiness of the SAME retained predecessor after proven pre-APPLY abort.

This is not an older-image create, config change, DB restore, or candidate
Swap0 proof. The original predecessor's observed805MiB total-swap allowance
is preserved and stated explicitly. All raw numeric-PID/cgroup reads precede
predicates. No import action, restart, or source authority occurs here.
"""
import datetime
import os
import pathlib
import time
from kit_contract import MEMORY_MAX,READY_SECONDS,SAMPLED_NONRECLAIMABLE_MAX,canonical,require,sha
from retained_contract import exact_json
from retained_memory import (bounded_read,canonical_cgroup,cgroup_path,pairs,scalar,
    RAW_NAMES,READ_LIMITS,STAT_REQUIRED,EVENT_REQUIRED,NON_RECLAIMABLE_FIELDS)
from kit_journal import exclusive_record
from kit_evidence import admit_evidence
from kit_runtime import PREDECESSOR_ID,PREDECESSOR_HEAD
from kit_readiness import startup_log,HTTP_CODE,EXPECTED_HTTP

OLD_MEMORY_AND_SWAP=1610612736
OLD_SWAP_MAX=OLD_MEMORY_AND_SWAP-MEMORY_MAX


def recovery_identity(value,predecessor):
    projection=predecessor.exact(value);state=value['State'];host=value['HostConfig']
    require(predecessor.restarted and not predecessor.renamed and value['Id']==PREDECESSOR_ID,
        'Only the same pre-APPLY restarted predecessor is permitted')
    require(state['Running'] is True and state.get('OOMKilled') is False and
        not state.get('Dead') and not state.get('Restarting') and value.get('RestartCount')==0,
        'Retained predecessor exited/OOM/restarted')
    require(type(state.get('Pid')) is int and state['Pid']>0 and
        host.get('Memory')==MEMORY_MAX and host.get('MemorySwap')==OLD_MEMORY_AND_SWAP,
        'Existing predecessor numeric PID/unchanged limits required')
    return {'id':PREDECESSOR_ID,'pid':state['Pid'],'startedAt':state['StartedAt'],
        'projection':projection,'memoryBytes':MEMORY_MAX,'observedExistingMemoryAndSwap':OLD_MEMORY_AND_SWAP}


def recovery_gate(sample):
    events=sample['events'];counters=sample['stat']
    require(set(EVENT_REQUIRED)<=set(events) and all(type(x) is int and x>=0 for x in events.values()) and
        events['oom']==events['oom_kill']==0,'Same predecessor host OOM refusal')
    require(set(STAT_REQUIRED)<=set(counters) and all(type(x) is int and x>=0 for x in counters.values()),
        'Complete same-predecessor memory.stat required')
    require(sample['memoryMax']==MEMORY_MAX and sample['swapMax']==OLD_SWAP_MAX,
        'Original predecessor cgroup memory/swap configuration changed')
    total=sum(counters[k] for k in NON_RECLAIMABLE_FIELDS)
    require(total<=SAMPLED_NONRECLAIMABLE_MAX,'Same-predecessor nonreclaimable memory exceeds75percent')
    return total


class RecoveryMemory:
    def __init__(self,root,predecessor,read=bounded_read,resolver=canonical_cgroup):
        self.root=pathlib.Path(root);self.predecessor=predecessor;self.read=read;self.resolver=resolver
        self.samples=[];self.descriptor=None;self.allocated=0

    def observe(self,phase):
        require(len(self.samples)<4096,'Same-predecessor recovery memory inventory exceeded')
        prefix='preapply-predecessor-memory-'+str(len(self.samples)+1).zfill(6);raws=[]
        def retained(path,limit):
            raw=self.read(path,limit);future=((len(raw)+4095)//4096)*4096
            require(self.allocated+future<=256*1024**2,'Same-predecessor raw memory evidence share exceeded')
            self.allocated+=future;name=prefix+'-raw-'+str(len(raws)).zfill(2)+'.stdout'
            admit_evidence(self.root/name,len(raw))
            descriptor=os.open(str(self.root/name),os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
            with os.fdopen(descriptor,'wb') as stream:stream.write(raw);stream.flush();os.fsync(stream.fileno())
            (self.root/name).chmod(0o400)
            raws.append({'file':name,'kernelPath':str(path),'sha256':sha(raw),'bytes':len(raw)})
            return raw
        identity=recovery_identity(self.predecessor.reader.inspect(PREDECESSOR_ID),self.predecessor)
        membership='/proc/'+str(identity['pid'])+'/cgroup';member=retained(membership,4096)
        mounts=retained('/proc/'+str(os.getpid())+'/mountinfo',256*1024)
        group=cgroup_path(PREDECESSOR_ID,member,mounts);directory=self.resolver(group)
        raw={name:retained(group/name,READ_LIMITS[name]) for name in RAW_NAMES}
        member_after=retained(membership,4096);directory_after=self.resolver(group)
        identity_after=recovery_identity(self.predecessor.reader.inspect(PREDECESSOR_ID),self.predecessor)
        sample={'identity':identity,'cgroup':directory,'phase':phase,'events':pairs(raw['memory.events'],EVENT_REQUIRED),
            'stat':pairs(raw['memory.stat'],STAT_REQUIRED),'memoryMax':scalar(raw['memory.max']),
            'swapMax':scalar(raw['memory.swap.max']),'memoryPeakObservation':scalar(raw['memory.peak']),
            'raws':raws,'originalExistingSwapConfigurationPreserved':True,'newCandidateSwap0Proof':False}
        self.allocated+=((len(canonical(sample))+4095)//4096)*4096
        require(self.allocated<=256*1024**2,'Same-predecessor complete memory evidence share exceeded')
        exclusive_record(self.root,prefix+'.json',sample,os.name=='posix')
        require(member_after==member and directory_after==directory and identity_after==identity,
            'Same-predecessor PID/cgroup identity changed during recovery sampling')
        descriptor={'identity':identity,'cgroup':directory}
        require(self.descriptor is None or self.descriptor==descriptor,'Same predecessor cgroup changed between recovery polls')
        total=recovery_gate(sample);self.descriptor=descriptor
        self.samples.append({'record':prefix+'.json','phase':phase,'nonReclaimableBytes':total,
            'events':sample['events'],'memoryPeakObservation':sample['memoryPeakObservation']})
        return total


class RecoveryReadiness:
    def __init__(self,root,runner,expected,clock=time.monotonic,sleep=time.sleep,memory_factory=RecoveryMemory):
        require(expected.get('head')==PREDECESSOR_HEAD and expected.get('entrypointVerifiers')==23 and
            len(expected.get('events',[]))==len(set(expected['events']))==22,
            'Exact source-derived959d predecessor22 READY/23 verifiers required')
        self.root=root;self.runner=runner;self.expected=expected;self.clock=clock;self.sleep=sleep
        self.memory_factory=memory_factory;self.consumed=False

    def __call__(self,predecessor,deadline):
        require(not self.consumed and deadline==READY_SECONDS and predecessor.restart_began is not None,
            'One exact600 second same-predecessor restart clock required')
        self.consumed=True;memory=self.memory_factory(self.root,predecessor);identity=None;observations=0
        last_progress=None
        def progress():
            nonlocal last_progress
            if last_progress is None or self.clock()-last_progress>=1:
                memory.observe('preapply-recovery-http');last_progress=self.clock()
        while self.clock()-predecessor.restart_began<deadline:
            value=predecessor.reader.inspect(PREDECESSOR_ID);current=recovery_identity(value,predecessor)
            require(identity is None or current==identity,'Same-predecessor restarted identity changed')
            identity=current;memory.observe('preapply-recovery-health');observations+=1
            if value['State'].get('Health',{}).get('Status')=='healthy':
                raw,_,_=self.runner.run(['docker','exec',PREDECESSOR_ID,'node','-e',HTTP_CODE],
                    'preapply-predecessor-http',30,observer=progress)
                require(exact_json(raw)==EXPECTED_HTTP,'Same-predecessor exactHTTP200/200/401 required')
                raw,err,_=self.runner.run(['docker','logs','--since',identity['startedAt'],PREDECESSOR_ID],
                    'preapply-predecessor-startup-logs',30,allow_stderr=True)
                startup=startup_log((raw+b'\n'+err).decode('utf-8'),self.expected['events'],23,jobs=True)
                memory.observe('preapply-recovery-final');seconds=self.clock()-predecessor.restart_began
                require(0<=seconds<deadline,'Same predecessor600 second readiness deadline exceeded')
                return {'id':PREDECESSOR_ID,'sameRetainedPredecessor':True,'seconds':seconds,
                    'startedAt':identity['startedAt'],
                    'readyUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'http':EXPECTED_HTTP,
                    'startup':startup,'memorySamples':memory.samples,'observations':observations,
                    'existingMemoryAndSwapPreserved':OLD_MEMORY_AND_SWAP,'existingHostSwapMaxBytes':OLD_SWAP_MAX,
                    'noDatabaseRestore':True,'noNewOlderImageCreate':True,'configurationChanged':False,
                    'samplingIsNotContinuousPeakMeasurement':True}
            self.sleep(1)
        raise RuntimeError('Same retained predecessor recovery readiness refused; rehold and stop without retry')
