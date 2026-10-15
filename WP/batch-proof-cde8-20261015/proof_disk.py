"""Disjoint physical accounting including every retained release, Docker and containerd."""
import os, pathlib, shutil, subprocess, time
from proof_contract import *
from proof_files import write_new

BOUND=['/opt/lims','/var/lib/docker','/var/lib/containerd']
ALLOCATION=['/opt/lims/releases','/var/lib/docker','/var/lib/containerd']
def mount_guard(text,paths):
    require(text.strip() and len(text.encode())<2*1024**2,'Bounded full mount inventory required')
    for line in text.splitlines():
        fields=line.split();require(len(fields)>=10 and '-' in fields,'Mount inventory malformed')
        m=pathlib.PurePosixPath(re.sub(r'\\([0-7]{3})',lambda x:chr(int(x[1],8)),fields[4]))
        for r in paths:require(not pathlib.PurePosixPath(r) in m.parents,'Descendant mount makes accounting incomplete')
def growth(before,after):
    require(set(before['allocations'])==set(after['allocations'])==set(ALLOCATION) and before['devices']==after['devices'],'Physical accounting topology changed')
    known={}
    for p,old in before['allocations'].items():
        row=after['allocations'][p];require(row['device']==old['device'],'Allocation device changed')
        known[row['device']]=known.get(row['device'],0)+row['bytes']-old['bytes']
    result={}
    for p in BOUND:
        loss=before['free'][p]-after['free'][p];credit=known.get(before['devices'][p],0);unexplained=max(0,loss-credit)
        require(unexplained<GROWTH_ABORT,'500MB unexplained disk-growth STOP')
        result[p]={'freeByteDrop':loss,'knownAllocatedGrowthBytes':credit,'unexplainedGrowthBytes':unexplained}
    return result
class Disk:
    def __init__(self,root):self.root=pathlib.Path(root);self.required=FLOOR+LOG_RESERVE;self.started=time.monotonic();self.number=0;self.before=None;self.topology=None
    def time_guard(self,seconds):require(time.monotonic()-self.started+seconds+HEADROOM+UNIT_HEADROOM<UNIT_SECONDS,'Insufficient stage/unit headroom')
    def check(self):
        self.time_guard(1)
        require(all(pathlib.Path(p).is_dir() and not pathlib.Path(p).is_symlink() and shutil.disk_usage(p).free>=self.required for p in BOUND),'Measured/scaled reserve STOP')
    def bind(self,db,assets):self.required=reserve(db,assets);self.check()
    def sample(self,label):
        self.time_guard(MEASURE_SECONDS);self.check();mount_guard(pathlib.Path('/proc/self/mountinfo').read_text(),ALLOCATION)
        for p in ALLOCATION:
            for q in [pathlib.Path(p),*pathlib.Path(p).parents]:require(not q.is_symlink(),'Physical accounting alias')
        r=subprocess.run(['du','-s','-B1','--',*ALLOCATION],capture_output=True,timeout=MEASURE_SECONDS)
        for n,b in [('stdout',r.stdout),('stderr',r.stderr)]:
            require(len(b)<65536,'Allocation output bound');p=self.root/('allocation-'+label+'-'+n+'.log')
            with p.open('xb') as f:f.write(b)
            p.chmod(0o400)
        require(r.returncode==0,'Physical allocation measurement failed; retain, never replay')
        rows={}
        for l in r.stdout.decode().splitlines():
            size,p=l.split('\t',1);require(p in ALLOCATION and p not in rows and int(size)>=0,'Allocation response malformed');rows[p]={'bytes':int(size),'device':os.stat(p).st_dev}
        require(set(rows)==set(ALLOCATION),'Missing Docker/containerd/release allocation')
        value={'allocations':rows,'devices':{p:os.stat(p).st_dev for p in BOUND},'free':{p:shutil.disk_usage(p).free for p in BOUND},'requiredBytes':self.required,'allRetainedReleaseRootsIncluded':True,'hardlinksCountedOnce':True}
        if self.before is not None:value['growth']=growth(self.before,value)
        write_new(self.root/('allocation-'+label+'.json'),value);self.check()
        if self.before is None:self.before=value
        return value
    def topology_check(self,label):
        def read(args):
            r=subprocess.run(args,capture_output=True,timeout=15);require(r.returncode==0 and len(r.stdout)<2*1024**2 and len(r.stderr)<65536,'Topology interface refused');return r.stdout.decode()
        driver=read(['docker','info','--format','{{.Driver}}']).strip();status=exact_json(read(['docker','info','--format','{{json .DriverStatus}}']));docker=read(['docker','info','--format','{{.DockerRootDir}}']).strip()
        service=read(['systemctl','show','containerd','--property=LoadState,ActiveState,MainPID,ExecStart']);config=read(['containerd','config','dump'])
        props=dict(l.split('=',1) for l in service.splitlines() if '=' in l);head={}
        for l in config.splitlines():
            if l.startswith('['):break
            m=re.fullmatch(r'(version|root|state)\s*=\s*(.+)',l.strip())
            if m:require(m[1] not in head,'Duplicate containerd key');head[m[1]]=m[2].strip('\'"')
        require(driver=='overlayfs' and docker=='/var/lib/docker' and ['driver-type','io.containerd.snapshotter.v1'] in status and head=={'version':'3','root':'/var/lib/containerd','state':'/run/containerd'},'Actual storage topology changed')
        require(props.get('ActiveState')=='active' and props.get('LoadState')=='loaded' and 'argv[]=/usr/bin/containerd ;' in props.get('ExecStart','') and int(props.get('MainPID','0'))>0,'Default containerd daemon changed')
        value={'driver':driver,'dockerRoot':docker,'containerdRoot':head['root'],'pid':int(props['MainPID']),'configurationSha256':sha(config.encode())}
        if self.topology is None:self.topology=value
        require(value==self.topology,'Storage daemon/configuration changed during proof')
        write_new(self.root/('topology-'+label+'.json'),value)
