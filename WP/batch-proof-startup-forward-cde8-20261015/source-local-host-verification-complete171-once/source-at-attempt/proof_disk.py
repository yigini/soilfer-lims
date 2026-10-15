"""Disjoint physical accounting including every retained release, Docker and containerd."""
import os, pathlib, shutil, subprocess, time
from proof_contract import *
from proof_files import write_new
from proof_budget import Budget,TABLE,DB_EQUIVALENTS,TOTAL_DB_COPIES

BOUND=['/opt/lims','/var/lib/docker','/var/lib/containerd']
ALLOCATION=['/opt/lims/releases','/var/lib/docker','/var/lib/containerd']
def mount_guard(text,paths,known_container_ids=()):
    require(text.strip() and len(text.encode())<2*1024**2,'Bounded full mount inventory required')
    known=set(known_container_ids);paths=tuple(paths);views=[];seen=set()
    for line in text.splitlines():
        fields=line.split();require(len(fields)>=10 and '-' in fields,'Mount inventory malformed')
        unescape=lambda v:re.sub(r'\\([0-7]{3})',lambda x:chr(int(x[1],8)),v)
        m=pathlib.PurePosixPath(unescape(fields[4]));separator=fields.index('-')
        require(len(fields)>separator+3,'Mount inventory suffix malformed')
        for r in paths:
            if pathlib.PurePosixPath(r) not in m.parents:continue
            match=re.fullmatch('/var/lib/docker/rootfs/overlayfs/([a-f0-9]{64})',str(m))
            require(r=='/var/lib/docker' and match and match[1] in known and fields[3]=='/' and fields[separator+1:separator+3]==['overlay','overlay'],'Unknown descendant mount makes accounting incomplete')
            require(str(m) not in seen,'Duplicate overlay view mount refused');seen.add(str(m))
            options={};flags=[]
            for item in unescape(fields[separator+3]).split(','):
                if '=' in item:
                    k,v=item.split('=',1);require(k not in options,'Duplicate overlay option');options[k]=v
                else:flags.append(item)
            require(set(options)=={'lowerdir','upperdir','workdir'} and flags==['rw'],'Unknown overlay backing/options refused')
            raw_lower=options['lowerdir'].split(':');upper=options['upperdir'];work=options['workdir']
            # containerd compactLowerdirOption uses snapshot-root as mount cwd.
            # Accept only its complete numeric relative form, never generic paths.
            base='/var/lib/containerd/io.containerd.snapshotter.v1.overlayfs/snapshots/'
            relative=all(re.fullmatch('[1-9][0-9]*/fs',p) for p in raw_lower)
            lower=[base+p for p in raw_lower] if relative else raw_lower
            require(lower and len(lower)==len(set(lower)) and all(re.fullmatch('/var/lib/containerd/io.containerd.snapshotter.v1.overlayfs/snapshots/[1-9][0-9]*/fs',p) for p in lower+[upper]),'Overlay data must be backed ONLY by the counted containerd store')
            require(re.fullmatch('/var/lib/containerd/io.containerd.snapshotter.v1.overlayfs/snapshots/[1-9][0-9]*/work',work) and pathlib.PurePosixPath(upper).parent==pathlib.PurePosixPath(work).parent and upper not in lower,'Overlay upper/work ownership differs')
            views.append({'containerId':match[1],'view':str(m),'mountDevice':fields[2],'lowerdirs':lower,'lowerdirEncoding':'CONTAINERD_COMPACT_NUMERIC_RELATIVE' if relative else 'ABSOLUTE_CANONICAL','lowerdirBase':base if relative else None,'upperdir':upper,'workdir':work,'rawLineSha256':sha(line.encode()),'accounting':'VIRTUAL_VIEW_EXCLUDED_BY_DU_X_BACKING_COUNTED_UNDER_CONTAINERD'})
    return views
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

def parse_memory_stat(raw):
    require(isinstance(raw,bytes) and 0<len(raw)<=65536,'Bounded cgroup memory.stat required')
    values={}
    for line in raw.decode('ascii').splitlines():
        key,value=line.split();require(re.fullmatch('[a-z0-9_]+',key) and key not in values and value.isdecimal(),'Malformed cgroup memory.stat');values[key]=int(value)
    require('anon' in values and 'file' in values,'Cgroup anon/file memory counters missing')
    return {'anonBytes':values['anon'],'fileBytes':values['file'],'allCounters':values,'source':'CGROUP_V2_MEMORY_STAT','actualCountersNotPageCacheDiagnosis':True}

def cgroup_memory():
    raw=pathlib.Path('/proc/self/cgroup').read_bytes();require(len(raw)<=65536,'Bounded cgroup identity required')
    rows=[line[3:] for line in raw.decode('ascii').splitlines() if line.startswith('0::')];require(len(rows)==1,'One unified controller cgroup required')
    relative=pathlib.PurePosixPath(rows[0]);require(relative.is_absolute() and '..' not in relative.parts,'Cgroup path escape')
    root=pathlib.Path('/sys/fs/cgroup');target=root/pathlib.Path(*relative.parts[1:])/'memory.stat'
    require(root.resolve() in target.resolve().parents and not target.is_symlink(),'Cgroup memory counter alias')
    result=parse_memory_stat(target.read_bytes());result['cgroup']=str(relative);return result

class Disk:
    def __init__(self,root):self.root=pathlib.Path(root);self.required=FLOOR+LOG_RESERVE;self.started=time.monotonic();self.number=0;self.before=None;self.topology=None;self.budget=None;self.last_sample=None;self.memory_number=0
    def time_guard(self,seconds):require(time.monotonic()-self.started+seconds+HEADROOM+UNIT_HEADROOM<UNIT_SECONDS,'Insufficient stage/unit headroom')
    def check(self):
        self.time_guard(1)
        if self.budget is not None:self.required=self.budget.required()
        self.memory_number+=1
        write_new(self.root/('memory-budget-check-'+str(self.memory_number).zfill(6)+'.json'),{'checkpoint':self.memory_number,'requiredFreeBytes':self.required,'activeStage':None if self.budget is None else self.budget.active,'observedMonotonic':time.monotonic(),**cgroup_memory()})
        require(all(pathlib.Path(p).is_dir() and not pathlib.Path(p).is_symlink() and shutil.disk_usage(p).free>=self.required for p in BOUND),'Measured/scaled reserve STOP')
    def bind(self,db,assets):
        require(self.budget is None,'Budget bind consumed');self.budget=Budget(db,assets);self.required=self.budget.required()
        # Persist measured inputs BEFORE the guard, including an honest refused bind.
        write_new(self.root/'measured-copy-reserve.json',{'databaseTripleAllocationBytes':db,'assetAllocationBytes':assets,'requiredBytes':self.required,'declaredDbCopies':TOTAL_DB_COPIES,'dbBudgetEquivalents':DB_EQUIVALENTS,'marginPercent':25,'stageTable':TABLE,'logReserveBytes':LOG_RESERVE,'remainingScientificCountsStillUnknown':True,'prior206CountsBoundNotNewProductionCounts':True,'status':'MEASURED_BIND_INPUTS_NOT_COPY_AUTHORITY'})
        self.check()
    def begin_stage(self,label):
        require(self.budget is not None and self.last_sample is not None,'Budget and physical baseline required');self.check()
        self.budget.begin(label,min(shutil.disk_usage(p).free for p in BOUND))
        write_new(self.root/('budget-'+label+'-intent.json'),{'stage':label,'remainingIncludingStageBytes':self.budget.remaining(),'minimumDuringStageBytes':self.budget.required(),'neverReplay':True})
    def claim(self,site):
        require(self.budget is not None,'Undeclared copy before budget binding');self.budget.claim(site);self.check()
    def finish_stage(self,label):
        old=self.last_sample;new=self.sample('stage-'+label)
        measured=max(0,sum(new['allocations'][p]['bytes']-old['allocations'][p]['bytes'] for p in ALLOCATION))
        result=self.budget.finish(label,measured);write_new(self.root/('budget-'+label+'-closed.json'),result);self.check()
    def sample(self,label):
        self.time_guard(MEASURE_SECONDS);self.check()
        def views():
            ids=subprocess.run(['docker','ps','-aq','--no-trunc'],capture_output=True,timeout=15)
            require(ids.returncode==0 and len(ids.stdout)<512*1024 and len(ids.stderr)<65536,'Container mount-owner inventory refused')
            known=ids.stdout.decode().splitlines();require(len(known)==len(set(known)) and len(known)<=4096 and all(re.fullmatch('[a-f0-9]{64}',id) for id in known),'Exact existing container ids required')
            current=mount_guard(pathlib.Path('/proc/self/mountinfo').read_text(),ALLOCATION,known)
            device=os.stat('/var/lib/containerd').st_dev
            for row in current:
                point=pathlib.Path(row['view'])
                require(point.is_dir() and os.stat(point).st_dev!=os.stat('/var/lib/docker').st_dev,'Virtual overlay view is not on a distinct device')
                backing=[pathlib.Path(v) for v in row['lowerdirs']+[row['upperdir'],row['workdir']]]
                for p in [point]+backing:
                    for ancestor in [p,*p.parents]:require(not ancestor.is_symlink(),'Overlay view/backing path alias refused')
                    require(p.is_dir(),'Overlay backing directory is missing')
                    if p!=point:require(os.stat(p).st_dev==device,'Overlay backing crosses the counted containerd filesystem')
            return current
        before_views=views()
        for p in ALLOCATION:
            for q in [pathlib.Path(p),*pathlib.Path(p).parents]:require(not q.is_symlink(),'Physical accounting alias')
        # -x excludes virtual mounted unions. Every such view was explicitly bound
        # to real lower/upper/work directories already counted in containerd.
        # No mounted view size is credited a second time or estimated.
        r=subprocess.run(['du','-x','-s','-B1','--',*ALLOCATION],capture_output=True,timeout=MEASURE_SECONDS)
        for n,b in [('stdout',r.stdout),('stderr',r.stderr)]:
            require(len(b)<65536,'Allocation output bound');p=self.root/('allocation-'+label+'-'+n+'.log')
            with p.open('xb') as f:f.write(b)
            p.chmod(0o400)
        require(r.returncode==0,'Physical allocation measurement failed; retain, never replay')
        rows={}
        for l in r.stdout.decode().splitlines():
            size,p=l.split('\t',1);require(p in ALLOCATION and p not in rows and int(size)>=0,'Allocation response malformed');rows[p]={'bytes':int(size),'device':os.stat(p).st_dev}
        require(set(rows)==set(ALLOCATION),'Missing Docker/containerd/release allocation')
        after_views=views()
        value={'allocations':rows,'devices':{p:os.stat(p).st_dev for p in BOUND},'free':{p:shutil.disk_usage(p).free for p in BOUND},'requiredBytes':self.required,'allRetainedReleaseRootsIncluded':True,'hardlinksCountedOnce':True,'duSingleFilesystem':True,'verifiedOverlayViewsBefore':before_views,'verifiedOverlayViewsAfter':after_views,'overlayViewsCreditedBytes':0,'realBackingCountedUnder':'/var/lib/containerd'}
        if self.before is not None:value['growth']=growth(self.before,value)
        write_new(self.root/('allocation-'+label+'.json'),value);self.check()
        if self.before is None:self.before=value
        self.last_sample=value
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
