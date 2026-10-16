"""Bounded raw evidence for THIS systemd unit, independent of container memory."""
import os,pathlib,re,stat
from proof_contract import ROOT,ROOT_NAME,MEMORY,require,sha
from proof_files import write_new
UNIT='lims-'+ROOT_NAME.lower()+'.service'
MAX_BYTES=16384
def parse_events(raw):
    out={}
    for line in raw.decode('ascii').splitlines():
        bits=line.split();require(len(bits)==2 and bits[0] not in out and re.fullmatch('0|[1-9][0-9]*',bits[1]),'Controller memory events malformed');out[bits[0]]=int(bits[1]);require(out[bits[0]]<2**64,'Controller counter overflow')
    require({'oom','oom_kill','max','high'}<=set(out),'Controller memory counters missing');return out
def own_snapshot(read=None):
    def actual(path):
        p=pathlib.Path(path)
        for a in [p,*p.parents]:require(not a.is_symlink(),'Controller cgroup alias')
        with p.open('rb') as f:b=f.read(MAX_BYTES+1)
        require(len(b)<=MAX_BYTES,'Controller memory raw bound');return b
    read=read or actual;member=read('/proc/self/cgroup');text=member.decode('ascii').strip()
    require(text=='0::/system.slice/'+UNIT,'Exact controller unit membership required')
    group='/sys/fs/cgroup/system.slice/'+UNIT
    before=pathlib.Path(group).stat() if read is actual else None
    raws={n:read(group+'/'+n) for n in ['memory.events','memory.current','memory.peak','memory.max','memory.swap.max']}
    require(read('/proc/self/cgroup')==member,'Controller membership changed')
    if before is not None:
        after=pathlib.Path(group).stat();require((before.st_dev,before.st_ino)==(after.st_dev,after.st_ino),'Controller cgroup identity changed')
    events=parse_events(raws['memory.events']);scalars={}
    for n in ['memory.current','memory.peak','memory.max','memory.swap.max']:
        v=raws[n].decode('ascii').strip();require(re.fullmatch('[0-9]+',v),'Controller memory scalar malformed');scalars[n]=int(v)
    require(scalars['memory.max']==MEMORY and scalars['memory.swap.max']==0,'Controller memory limits differ')
    require(events['oom']==events['oom_kill']==0,'Controller memory OOM guard refused')
    return {'unit':UNIT,'membershipRaw':member.decode(),'raw':{k:v.decode('ascii') for k,v in raws.items()},'sha256':{k:sha(v) for k,v in raws.items()},'events':events,'scalars':scalars,'cgroupDevice':before.st_dev if before else None,'cgroupInode':before.st_ino if before else None,'peakMaxHighObservationOnly':True}
class ControllerGuard:
    def __init__(self,root):self.root=pathlib.Path(root);self.before=None;self.last=None
    def observe(self,label):
        value=own_snapshot()
        if self.before is None:self.before=value
        else:require((value['unit'],value['membershipRaw'],value['cgroupDevice'],value['cgroupInode'])==(self.before['unit'],self.before['membershipRaw'],self.before['cgroupDevice'],self.before['cgroupInode']),'Controller cgroup identity changed between guards')
        self.last=value;write_new(self.root/('controller-memory-'+label+'.json'),value);return value
