"""Host-side exact-container cgroup reads; limits stay fixed, peak is observation only."""
import datetime,os,pathlib,re,stat
from retained_contract import MEMORY,ROOT,require,sha,canonical
from retained_files import write_new
from kit_evidence import admit_evidence
from kit_docker import inspect

NON_RECLAIMABLE_FIELDS=('anon','shmem','slab_unreclaimable','kernel_stack','pagetables','percpu','sock')
NON_RECLAIMABLE_MAX=MEMORY*3//4
STAT_REQUIRED=set(NON_RECLAIMABLE_FIELDS)|{'file','slab_reclaimable','pgscan','pgsteal'}
EVENT_REQUIRED={'oom','oom_kill','max','high'}
CGROUP_ROOT=pathlib.Path('/sys/fs/cgroup')
RAW_NAMES=('memory.stat','memory.events','memory.peak','memory.max','memory.swap.max')
READ_LIMITS={'memory.stat':16384,'memory.events':4096,'memory.peak':64,'memory.max':64,'memory.swap.max':64}
MAX_SAMPLES_PER_STARTUP=4096
MAX_EVIDENCE_ALLOCATED_PER_STARTUP=256*1024**2

def pairs(raw,required):
    require(isinstance(raw,bytes) and 0<len(raw)<=65536,'Missing or unbounded cgroup keyed file')
    out={}
    for line in raw.decode('ascii','strict').splitlines():
        parts=line.split();require(len(parts)==2 and re.fullmatch('[a-z_][a-z0-9_]*',parts[0]) and re.fullmatch('0|[1-9][0-9]*',parts[1]),'Malformed cgroup counter')
        require(parts[0] not in out,'Duplicate cgroup counter');out[parts[0]]=int(parts[1]);require(out[parts[0]]<2**64,'Counter overflow')
    require(set(required)<=set(out),'Required cgroup counters absent')
    return out

def scalar(raw):
    require(isinstance(raw,bytes) and re.fullmatch(rb'(0|[1-9][0-9]*)\n?',raw) is not None,'Exact numeric cgroup scalar required')
    value=int(raw);require(value<2**64,'Cgroup scalar overflow');return value

def container_identity(obj,container_id,owner):
    state=obj.get('State',{});host=obj.get('HostConfig',{})
    require(re.fullmatch('[a-f0-9]{64}',container_id) is not None and obj.get('Id')==container_id,'Exact full container ID required')
    require(owner.startswith(str(ROOT)+':') and obj.get('Config',{}).get('Labels',{}).get('io.soilfer.release-owned')==owner,'Only the new owned startup container may be sampled')
    require(state.get('Running') is True and not state.get('Restarting') and not state.get('Dead') and state.get('OOMKilled') is False and obj.get('RestartCount')==0,'Container OOM/restart/exit memory STOP')
    require(type(state.get('Pid')) is int and state['Pid']>0 and isinstance(state.get('StartedAt'),str) and state['StartedAt'],'Live exact host PID required')
    require(host.get('Memory')==MEMORY and host.get('MemorySwap')==MEMORY,'Exact fixed memory and memory+swap required')
    return {'id':container_id,'pid':state['Pid'],'startedAt':state['StartedAt'],'owner':owner,'oomKilled':False,'restarts':0,'memory':MEMORY,'memoryAndSwap':MEMORY}

def cgroup_path(container_id,membership,mountinfo):
    require(isinstance(membership,bytes) and len(membership)<=4096 and isinstance(mountinfo,bytes) and len(mountinfo)<=1024**2,'Bounded host proc metadata required')
    members=membership.decode('ascii','strict').splitlines();require(len(members)==1 and members[0].startswith('0::/'),'Exactly one unified host cgroup membership required')
    relative=members[0][3:];parts=pathlib.PurePosixPath(relative).parts
    require(relative.startswith('/') and not any(x in relative for x in ['..','\\','\x00']) and '//' not in relative and relative!='/' and re.fullmatch('/[a-zA-Z0-9_.:/@-]+',relative),'Canonical cgroup membership required')
    require(sum(x in (container_id,'docker-'+container_id+'.scope') for x in parts)==1,'Cgroup does not belong to exact full container ID')
    require(parts[-1] in (container_id,'docker-'+container_id+'.scope'),'Container cgroup must be the exact ID group, not a descendant subgroup')
    matches=[]
    for line in mountinfo.decode('ascii','strict').splitlines():
        fields=line.split();require(len(fields)>=10 and '-' in fields,'Malformed host mountinfo')
        at=fields.index('-')
        if fields[4]=='/sys/fs/cgroup':matches.append((fields,at))
    require(len(matches)==1,'Exactly one canonical host cgroup mount required')
    fields,at=matches[0];require(fields[3]=='/' and fields[at+1]=='cgroup2','Host unified cgroup root required')
    return pathlib.PurePosixPath(CGROUP_ROOT.as_posix())/relative.lstrip('/')

def bounded_read(path,limit=65536):
    p=pathlib.Path(path)
    for q in [p,*p.parents]:require(not q.is_symlink(),'Cgroup/proc alias refused')
    fd=os.open(str(p),os.O_RDONLY|getattr(os,'O_NOFOLLOW',0))
    try:
        require(stat.S_ISREG(os.fstat(fd).st_mode),'Regular kernel counter file required')
        chunks=[];total=0
        while True:
            b=os.read(fd,min(4096,limit+1-total))
            if not b:break
            chunks.append(b);total+=len(b);require(total<=limit,'Kernel counter output exceeds bound')
        return b''.join(chunks)
    finally:os.close(fd)

def canonical_cgroup(path):
    p=pathlib.Path(path);require(CGROUP_ROOT in p.parents and p!=CGROUP_ROOT,'Non-root container cgroup required')
    for q in [p,*p.parents]:require(not q.is_symlink(),'Cgroup ancestor alias refused')
    require(str(p.resolve(strict=True))==str(p) and p.is_dir(),'Canonical cgroup directory required')
    s=p.stat();return {'path':str(p),'device':s.st_dev,'inode':s.st_ino}

def host_sample(container_id,owner,reader=bounded_read,inspector=inspect,resolver=canonical_cgroup):
    identity=container_identity(inspector(container_id),container_id,owner);pid=identity['pid']
    member=reader('/proc/'+str(pid)+'/cgroup',4096)
    mount=reader('/proc/'+str(os.getpid())+'/mountinfo',256*1024)
    path=cgroup_path(container_id,member,mount);directory=resolver(path)
    raw={n:reader(path/n,READ_LIMITS[n]) for n in RAW_NAMES}
    require(reader('/proc/'+str(pid)+'/cgroup',4096)==member and resolver(path)==directory and container_identity(inspector(container_id),container_id,owner)==identity,'Container/PID/cgroup changed during read; STOP without retry')
    return {'identity':identity,'cgroup':directory,'memoryStat':pairs(raw['memory.stat'],STAT_REQUIRED),'memoryEvents':pairs(raw['memory.events'],EVENT_REQUIRED),'memoryPeakBytesObservation':scalar(raw['memory.peak']),'memoryMaxBytes':scalar(raw['memory.max']),'memorySwapMaxBytes':scalar(raw['memory.swap.max'])}

def gate(sample):
    events=sample['memoryEvents'];counters=sample['memoryStat']
    require(all(type(sample.get(n)) is int and sample[n]>=0 for n in ['memoryPeakBytesObservation','memoryMaxBytes','memorySwapMaxBytes']),'Exact integer cgroup scalar observations required')
    require(set(EVENT_REQUIRED)<=set(events) and all(type(x) is int and x>=0 for x in events.values()),'Complete exact memory.events counters required')
    require(events['oom']==events['oom_kill']==0,'Container cgroup oom/oom_kill memory STOP')
    require(set(STAT_REQUIRED)<=set(counters) and all(type(x) is int and x>=0 for x in counters.values()),'Complete exact memory.stat counters required')
    require(sample['memoryMaxBytes']==MEMORY and sample['memorySwapMaxBytes']==0,'Host cgroup memory/swap limits changed')
    total=sum(counters[n] for n in NON_RECLAIMABLE_FIELDS)
    require(total<=NON_RECLAIMABLE_MAX,'Sampled non-reclaimable memory exceeds75percent STOP')
    # memory.peak, max/high, pgscan/pgsteal and reclaimable fields are observations.
    return total

def ready_max_rss(events):
    require(events and all(type(v.get('rss_bytes')) is int and v['rss_bytes']>=0 for v in events),'Every READY RSS observation required')
    return max(v['rss_bytes'] for v in events)

class MemoryHistory:
    def __init__(self,root,label,container_id,owner,sampler=host_sample,reader=bounded_read):
        self.root=pathlib.Path(root);self.label=label;self.id=container_id;self.owner=owner;self.sampler=sampler;self.reader=reader;self.samples=[];self.descriptor=None;self.evidence_allocated=0
    def reserve_evidence(self,raw_bytes):
        require(type(raw_bytes) is int and raw_bytes>=0,'Exact memory evidence length required')
        future=((raw_bytes+4095)//4096)*4096
        require(self.evidence_allocated+future<=MAX_EVIDENCE_ALLOCATED_PER_STARTUP,'Memory evidence exceeds256MiB per-startup share of existing4GiB log reserve')
        self.evidence_allocated+=future
    def store_record(self,path,value):
        self.reserve_evidence(len(canonical(value))+1);write_new(path,value)
    def observe(self,phase='health-poll'):
        require(len(self.samples)<MAX_SAMPLES_PER_STARTUP,'Memory sample maximum exceeded')
        prefix=self.label+'-memory-'+str(len(self.samples)+1).zfill(6);raws=[]
        def retained_read(path,limit):
            try:raw=self.reader(path,limit)
            except BaseException as error:
                write_new(self.root/(prefix+'-read-refusal.json'),{'path':str(path),'error':type(error).__name__+': '+str(error),'neverRetry':True});raise
            name=prefix+'-raw-'+str(len(raws)).zfill(2)+'-'+pathlib.Path(path).name+'.stdout';p=self.root/name
            self.reserve_evidence(len(raw))
            admit_evidence(p,len(raw))
            with p.open('xb') as f:f.write(raw)
            p.chmod(0o400);raws.append({'path':name,'kernelPath':str(path),'bytes':len(raw),'sha256':sha(raw)})
            return raw
        try:
            sample=self.sampler(self.id,self.owner,reader=retained_read)
            record={**sample,'observedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'phase':phase,'originalKernelReads':raws,'nonReclaimableFields':list(NON_RECLAIMABLE_FIELDS),'nonReclaimableMaximumBytes':NON_RECLAIMABLE_MAX,'peakMaxHighPgscanPgstealAreObservationsOnly':True,'notYetValidated':True}
            self.store_record(self.root/(prefix+'.json'),record)
            descriptor={'identity':sample['identity'],'cgroup':sample['cgroup']}
            require(self.descriptor is None or self.descriptor==descriptor,'Container cgroup identity changed between memory polls')
            value=gate(sample);self.descriptor=descriptor;self.samples.append({'path':prefix+'.json','nonReclaimableBytes':value,'memoryPeakBytesObservation':sample['memoryPeakBytesObservation'],'memoryEvents':sample['memoryEvents'],'memoryStat':sample['memoryStat'],'phase':phase})
            return value
        except BaseException as error:
            write_new(self.root/(prefix+'-guard-refusal.json'),{'error':type(error).__name__+': '+str(error),'originalKernelReads':raws,'neverRetry':True});raise
    def summary(self,rss):
        require(self.samples and self.samples[-1]['phase']=='before-stop','Fresh final host memory.events check before stop required')
        result={'hostMemorySamples':self.samples,'sampledNonReclaimableMaxBytes':max(v['nonReclaimableBytes'] for v in self.samples),'nonReclaimableLimitBytes':NON_RECLAIMABLE_MAX,'maxReadyRssBytes':rss,'memoryPeakBytesObservation':max(v['memoryPeakBytesObservation'] for v in self.samples),'peakIsObservationNotGate':True,'oomAndOomKillZeroEverySample':True,'hostBeforeStopEventsChecked':True,'memoryMaxBytes':MEMORY,'memorySwapMaxBytes':0,'samplingIsNotContinuousPeakMeasurement':True,'memoryEvidenceMaximumBytesPerStartup':MAX_EVIDENCE_ALLOCATED_PER_STARTUP,'memoryEvidenceWithinExisting4GiBLogs':True}
        # The startup result stores this summary once, in addition to each raw sample.
        result['sampleAndSummaryAllocatedAllowanceBytes']=self.evidence_allocated
        # Include this allowance field before sizing.128 bytes conservatively cover
        # its final decimal-value growth; the existing268435456 bound is unchanged.
        self.reserve_evidence(len(canonical(result))+1+128);result['sampleAndSummaryAllocatedAllowanceBytes']=self.evidence_allocated
        return result
