"""Controller unit memory evidence, numeric current PID and no path aliases."""
import os,pathlib,re,stat
from retained_contract import ROOT,ROOT_NAME,MEMORY,require,sha,canonical
from retained_files import write_new
from kit_evidence import admit_evidence
UNIT='lims-'+ROOT_NAME.lower()+'.service'
MAX_BYTES=16384

def parse_events(raw):
    out={}
    for line in raw.decode('ascii').splitlines():
        bits=line.split()
        require(len(bits)==2 and bits[0] not in out and re.fullmatch('0|[1-9][0-9]*',bits[1]),'Controller memory events malformed')
        out[bits[0]]=int(bits[1]);require(out[bits[0]]<2**64,'Controller counter overflow')
    require({'oom','oom_kill','max','high'}<=set(out),'Controller memory counters missing');return out

def numeric_membership_path():return '/proc/'+str(os.getpid())+'/cgroup'

def actual_reader(path):
    p=pathlib.Path(path)
    for a in [p,*p.parents]:require(not a.is_symlink(),'Controller cgroup alias')
    with p.open('rb') as f:b=f.read(MAX_BYTES+1)
    require(len(b)<=MAX_BYTES,'Controller memory raw bound');return b

def own_snapshot(read=None,evidence=None):
    read=read or actual_reader
    def recorded(path):
        raw=read(path)
        if evidence is not None:evidence(path,raw)
        return raw
    member=recorded(numeric_membership_path());text=member.decode('ascii').strip()
    require(text=='0::/system.slice/'+UNIT,'Exact controller unit membership required')
    group='/sys/fs/cgroup/system.slice/'+UNIT
    before=pathlib.Path(group).stat() if read is actual_reader else None
    raws={n:recorded(group+'/'+n) for n in ['memory.events','memory.current','memory.peak','memory.max','memory.swap.max','memory.stat']}
    require(recorded(numeric_membership_path())==member,'Controller membership changed')
    if before is not None:
        after=pathlib.Path(group).stat();require((before.st_dev,before.st_ino)==(after.st_dev,after.st_ino),'Controller cgroup identity changed')
    memory_stat={}
    for line in raws['memory.stat'].decode('ascii').splitlines():
        bits=line.split();require(len(bits)==2 and bits[0] not in memory_stat and re.fullmatch('0|[1-9][0-9]*',bits[1]),'Controller memory.stat malformed')
        memory_stat[bits[0]]=int(bits[1]);require(memory_stat[bits[0]]<2**64,'Controller memory.stat overflow')
    require({'anon','file'}<=set(memory_stat),'Controller memory.stat anon/file missing')
    events=parse_events(raws['memory.events']);scalars={}
    for n in ['memory.current','memory.peak','memory.max','memory.swap.max']:
        value=raws[n].decode('ascii').strip();require(re.fullmatch('[0-9]+',value),'Controller memory scalar malformed');scalars[n]=int(value)
    require(scalars['memory.max']==MEMORY and scalars['memory.swap.max']==0,'Controller memory limits differ')
    require(events['oom']==events['oom_kill']==0,'Controller memory OOM guard refused')
    return {'unit':UNIT,'membershipRaw':member.decode(),'raw':{k:v.decode('ascii') for k,v in raws.items()},'sha256':{k:sha(v) for k,v in raws.items()},'events':events,'scalars':scalars,'memoryStat':memory_stat,'cgroupDevice':before.st_dev if before else None,'cgroupInode':before.st_ino if before else None,'peakMaxHighObservationOnly':True}

class ControllerGuard:
    def __init__(self,root):self.root=pathlib.Path(root);self.before=None;self.last=None
    def observe(self,label):
        reads=[]
        def retain(path,raw):
            name='controller-memory-'+label+'-raw-'+str(len(reads)+1).zfill(2)+'.stdout'
            destination=self.root/name;admit_evidence(destination,len(raw))
            with destination.open('xb') as stream:
                stream.write(raw);stream.flush();os.fsync(stream.fileno())
            destination.chmod(0o400)
            reads.append({'path':path,'original':name,'sha256':sha(raw),'bytes':len(raw)})
        value=own_snapshot(evidence=retain)
        if self.before is None:self.before=value
        else:require((value['unit'],value['membershipRaw'],value['cgroupDevice'],value['cgroupInode'])==(self.before['unit'],self.before['membershipRaw'],self.before['cgroupDevice'],self.before['cgroupInode']),'Controller cgroup identity changed between guards')
        self.last=value
        # Keep the full BEFORE shape used by the independent hook. Periodic
        # records bind the unchanged complete predicate result and every raw
        # byte without repeatedly JSON-escaping/copying the kernel strings.
        stored=value if label=='before' else {
            'unit':value['unit'],'cgroupDevice':value['cgroupDevice'],'cgroupInode':value['cgroupInode'],
            'validatedSnapshotSha256':sha(canonical(value)),
            'originalKernelReads':reads,'unchangedOwnSnapshotPredicatesApplied':True,
            'peakMaxHighObservationOnly':True}
        if label!='before':require(len(canonical(stored))+1<=8192,
            'Fixed controller reference metadata exceeded its source envelope')
        write_new(self.root/('controller-memory-'+label+'.json'),stored);return value
