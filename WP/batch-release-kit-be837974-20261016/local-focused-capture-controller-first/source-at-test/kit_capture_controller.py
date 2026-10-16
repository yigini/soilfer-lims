"""Exact numeric capture-unit cgroup guard, with every original read retained.

The existing805MiB/swap-zero/OOM-zero/75percent predicates apply to the whole
capture unit, including its transport. Peaks and reclaim counters are sampled
observations. Import and construction perform no kernel or filesystem reads.
"""
import os
import pathlib
import re
from kit_contract import canonical,require,sha
from kit_capture_owned import CAPTURE_ROOT,CAPTURE_UNIT
from retained_memory import (bounded_read,canonical_cgroup,pairs,scalar,gate,
    STAT_REQUIRED,EVENT_REQUIRED,NON_RECLAIMABLE_FIELDS,NON_RECLAIMABLE_MAX)
from kit_evidence import admit_evidence
from kit_journal import exclusive_record


def capture_controller_snapshot(reader=bounded_read,resolver=canonical_cgroup,evidence=None):
    pid=os.getpid();require(type(pid) is int and pid>0,'Numeric current capture PID required')
    proc='/proc/'+str(pid)
    def read(path,limit):
        raw=reader(path,limit)
        require(isinstance(raw,bytes) and 0<len(raw)<=limit,'Bounded capture kernel original required')
        if evidence is not None:evidence(path,raw)
        return raw
    member=read(proc+'/cgroup',4096)
    require(member==('0::/system.slice/'+CAPTURE_UNIT+'\n').encode(),
        'Exact separate capture unit membership required')
    mount=read(proc+'/mountinfo',256*1024);matches=[]
    for line in mount.decode('ascii').splitlines():
        fields=line.split();require(len(fields)>=10 and fields.count('-')==1,'Malformed capture cgroup mount inventory')
        at=fields.index('-');require(at>=6 and len(fields)>=at+4,'Incomplete capture cgroup mount inventory')
        if fields[4]=='/sys/fs/cgroup':matches.append((fields,at))
    require(len(matches)==1 and matches[0][0][3]=='/' and matches[0][0][matches[0][1]+1]=='cgroup2',
        'One canonical unified capture cgroup mount required')
    group=pathlib.Path('/sys/fs/cgroup/system.slice')/CAPTURE_UNIT
    before=resolver(group)
    require(isinstance(before,dict) and before.get('path')==str(group) and
        all(type(before.get(k)) is int and before[k]>=0 for k in ('device','inode')),
        'Exact capture cgroup directory identity required')
    raw={name:read(str(group/name),16384) for name in
        ('memory.events','memory.stat','memory.current','memory.peak','memory.max','memory.swap.max')}
    require(read(proc+'/cgroup',4096)==member and read(proc+'/mountinfo',256*1024)==mount and
        resolver(group)==before and os.getpid()==pid,'Capture PID, membership, mount or directory changed')
    sample={'memoryEvents':pairs(raw['memory.events'],EVENT_REQUIRED),
        'memoryStat':pairs(raw['memory.stat'],STAT_REQUIRED),
        'memoryPeakBytesObservation':scalar(raw['memory.peak']),'memoryMaxBytes':scalar(raw['memory.max']),
        'memorySwapMaxBytes':scalar(raw['memory.swap.max'])}
    current=scalar(raw['memory.current']);nonreclaimable=gate(sample)
    return {**sample,'unit':CAPTURE_UNIT,'pid':pid,'membershipRaw':member.decode('ascii'),
        'cgroup':before,'memoryCurrentBytesObservation':current,'nonReclaimableBytes':nonreclaimable,
        'nonReclaimableMaximumBytes':NON_RECLAIMABLE_MAX,'nonReclaimableFields':list(NON_RECLAIMABLE_FIELDS),
        'samplingIsNotContinuousPeakMeasurement':True,'peakMaxHighPgscanPgstealAreObservationsOnly':True}


def capture_controller_same_group(before,after):
    require(isinstance(before,dict) and isinstance(after,dict) and
        all(after.get(k)==before.get(k) for k in ('unit','membershipRaw','cgroup')) and
        before.get('unit')==CAPTURE_UNIT,'Capture controller cgroup differs from initial guard')


class CaptureControllerGuard:
    def __init__(self,root,reader=bounded_read,resolver=canonical_cgroup,sync=True):
        self.root=pathlib.Path(root)
        require(self.root.as_posix()==CAPTURE_ROOT.as_posix(),'Exact capture controller root required')
        self.reader=reader;self.resolver=resolver;self.sync=sync;self.before=None;self.last=None;self.labels=set()

    def observe(self,label):
        require(isinstance(label,str) and re.fullmatch('[a-z][a-z0-9-]{0,70}',label) and label not in self.labels and
            (self.before is not None or label=='before'),'Unique capture guard label and initial before required')
        self.labels.add(label);reads=[]
        def retain(path,raw):
            name='controller-memory-'+label+'-raw-'+str(len(reads)+1).zfill(2)+'.stdout'
            destination=self.root/name;admit_evidence(destination,len(raw))
            with destination.open('xb') as stream:stream.write(raw);stream.flush();os.fsync(stream.fileno())
            destination.chmod(0o400)
            reads.append({'path':path,'original':name,'sha256':sha(raw),'bytes':len(raw)})
        try:
            value=capture_controller_snapshot(self.reader,self.resolver,retain)
            if self.before is not None:capture_controller_same_group(self.before,value)
            exclusive_record(self.root,'controller-memory-'+label+'.json',
                {**value,'originalKernelReads':reads},self.sync)
            if self.before is None:self.before=value
            self.last=value;return value
        except BaseException as failure:
            exclusive_record(self.root,'controller-memory-'+label+'-refused.json',
                {'errorType':type(failure).__name__,'originalKernelReads':reads,'neverRetry':True},self.sync)
            raise
