"""Fresh nonadditive reserve and disjoint physical accounting for this kit.

All commands use private bounded originals before predicates. Every Docker
overlay view must be proven backed by the already counted containerd store.
No mount, daemon, capacity or infrastructure setting is changed.
"""
import os
import pathlib
import re
import time
from kit_contract import (UNIT_SECONDS,UNIT_HEADROOM,FLOOR,LOG_RESERVE,ADDITIONAL_HEADROOM,
    IMAGE_BYTES,canonical,require,sha,unexplained_drop)
from kit_budget import Budget,TABLE,TABLE_SHA,DB_EQUIVALENTS,TOTAL_DB_COPIES
from retained_accounting import mount_guard
from retained_contract import exact_json,LIVE_DATA,LIVE_ASSETS
from kit_journal import exclusive_record
from kit_copy_admission import copy_layout

BOUND=('/opt/lims','/var/lib/docker','/var/lib/containerd')
ALLOCATION=('/opt/lims/releases','/var/lib/docker','/var/lib/containerd')

def hardware():
    result={}
    for raw in BOUND:
        p=pathlib.Path(raw)
        for ancestor in (p,*p.parents):require(not ancestor.is_symlink(),'Hardware path/ancestor alias refused')
        require(p.is_dir() and p.resolve().as_posix()==raw,'Canonical existing hardware directory required')
        s=p.stat();v=os.statvfs(p)
        result[raw]={'path':raw,'device':s.st_dev,'blockBytes':v.f_bsize,'fragmentBytes':v.f_frsize,
            'availableBlocks':v.f_bavail,'freeBytes':v.f_bavail*v.f_frsize}
    return result

def free_gate(rows,required):
    require(isinstance(rows,dict) and set(rows)==set(BOUND),'Fresh all-three-path hardware evidence required')
    require(type(required) is int and required>=FLOOR+LOG_RESERVE+ADDITIONAL_HEADROOM,'Unchanged minimum reserve required')
    for path,row in rows.items():
        require(row.get('path')==path and row.get('blockBytes')==row.get('fragmentBytes')==4096 and
            type(row.get('device')) is int and type(row.get('availableBlocks')) is int and row['availableBlocks']>=0 and
            type(row.get('freeBytes')) is int and row['freeBytes']==row['availableBlocks']*4096 and row['freeBytes']>=required,
            'Exact nonadditive hardware/free-space reserve refused')
    return min(r['freeBytes'] for r in rows.values())

def disjoint_growth(before,after):
    require(set(before['allocations'])==set(after['allocations'])==set(ALLOCATION) and before['devices']==after['devices'],
        'Physical accounting topology changed')
    growth={}
    for path,old in before['allocations'].items():
        row=after['allocations'][path];require(row['device']==old['device'],'Allocation device changed')
        growth[row['device']]=growth.get(row['device'],0)+row['bytes']-old['bytes']
    result={}
    for path in BOUND:
        known=growth.get(before['devices'][path],0)
        # Negative allocated growth is not credited as positive new consumption.
        # It increases unexplained loss and cannot hide a deletion/missing store.
        unexplained=max(0,before['free'][path]-after['free'][path]-known)
        require(unexplained<=500000000,'Unexplained physical free-space loss exceeds500MB')
        result[path]={'freeByteDrop':before['free'][path]-after['free'][path],
            'knownDisjointGrowthBytes':known,'unexplainedGrowthBytes':unexplained}
    return result

def measure_inputs():
    """Stat-only conservative DB triple and asset allocation; no SQL/content."""
    database=pathlib.Path(LIVE_DATA)/'dev.db';assets=pathlib.Path(LIVE_ASSETS)
    require(assets.is_dir(),'Existing production asset directory required')
    for ancestor in (assets,*assets.parents):require(not ancestor.is_symlink(),'Measured asset root alias refused')
    def row(p):
        for ancestor in (p,*p.parents):require(not ancestor.is_symlink(),'Measured input alias refused')
        if not p.exists():return None
        s=p.stat();require(p.is_file(),'Regular measured input required')
        return (s.st_dev,s.st_ino,s.st_size,s.st_mtime_ns,s.st_blocks*512)
    before={suffix:row(pathlib.Path(str(database)+suffix)) for suffix in ('','-wal','-shm')}
    require(before[''] is not None,'Measured production DB missing')
    asset_rows=[];directories=0;started=time.monotonic()
    for directory,children,files in os.walk(assets,followlinks=False):
        directories+=1;require(directories<=7 and time.monotonic()-started<30,'Pinned asset directories/input deadline exceeded')
        p=pathlib.Path(directory)
        for name in children:require(not (p/name).is_symlink(),'Asset directory alias refused')
        for name in files:
            r=row(p/name);require(r is not None and r[0]==assets.stat().st_dev,'Asset vanished or crosses device')
            asset_rows.append(r);require(len(asset_rows)<=200000,'Asset metadata inventory incomplete')
    after={suffix:row(pathlib.Path(str(database)+suffix)) for suffix in before}
    require(before==after,'Stat-only input changed; no retry')
    allocation=lambda r:max(r[4],((r[2]+4095)//4096)*4096)
    db_rows=[r for r in before.values() if r is not None]
    db_layout=copy_layout([r[2] for r in db_rows],1)
    asset_layout=copy_layout([r[2] for r in asset_rows],directories)
    db_observed=sum(allocation(r) for r in db_rows);asset_observed=sum(allocation(r) for r in asset_rows)
    return {'databaseAllocatedBytes':db_observed+db_layout['entryAndInodeAllowanceBytes'],
        'assetsAllocatedBytes':asset_observed+asset_layout['entryAndInodeAllowanceBytes'],
        'databaseObservedFileAllocationBytes':db_observed,'assetsObservedFileAllocationBytes':asset_observed,
        'copyMetadataIsDeclaredAllowanceNotFilesystemMeasurement':True,
        'databaseContentAndEntries':db_layout,'assetContentAndEntries':asset_layout,'assetDirectoryCount':directories,
        'metadataOnly':True,'productionSqlConnections':0,'productionContentOpens':0}

class Disk:
    def __init__(self,root,reader,runner,budget,require_directory_sync=True,clock=time.monotonic,hardware_reader=hardware):
        self.root=pathlib.Path(root);self.reader=reader;self.runner=runner;self.budget=budget;self.sync=require_directory_sync
        self.clock=clock;self.began=clock();self.hardware=hardware_reader;self.devices=None;self.topology=None
        self.number=0;self.before=None;self.last=None;self.stage_before=None

    def check(self,needed=0):
        require(type(needed) in (int,float) and 0<=needed<=600,'Bounded operation headroom required')
        require(self.clock()-self.began+needed+60+UNIT_HEADROOM<UNIT_SECONDS,'Unchanged stage/unit headroom exhausted')
        rows=self.hardware();free=free_gate(rows,self.budget.required());devices={p:r['device'] for p,r in rows.items()}
        require(self.devices is None or devices==self.devices,'Hardware device topology changed');self.devices=devices
        return free

    def claim(self,site):self.budget.claim(site);self.check()

    def admit_copy(self,site,destination,plan):
        ceiling=self.budget.copy_ceiling(site)
        require(plan['declaredAllocationBytes']<=ceiling,
            'Copy content/entries exceed the held source-derived producer allowance')
        self.check()
        target_index=site=='target-reader-index'
        exclusive_record(self.root,'copy-admission-'+sha(str(destination).encode())[:32]+'.json',{
            'site':site,'destination':str(destination),'layout':plan,'maximumBytes':ceiling,
            'beforeDestinationCreation':not pathlib.Path(destination).exists() if target_index else True,
            **({'beforeReaderCanCreateOrExtendIndex':True} if target_index else {}),
            'stageTableSha256':TABLE_SHA,'neverRetry':True,
            'sqliteTemporaryFilesAndGlobalFilesystemClosureClaimed':False},self.sync)

    def read(self,argv,label,timeout=15):
        raw,err,_=self.runner.run(argv,label,timeout)
        require(not err and len(raw)<=2*1024**2,'Bounded storage metadata required');return raw

    def topology_check(self,label):
        driver=self.read(['docker','info','--format','{{.Driver}}'],label+'-driver').decode().strip()
        status=exact_json(self.read(['docker','info','--format','{{json .DriverStatus}}'],label+'-driver-status'))
        docker=self.read(['docker','info','--format','{{.DockerRootDir}}'],label+'-docker-root').decode().strip()
        service=self.read(['systemctl','show','containerd','--property=LoadState,ActiveState,MainPID,ExecStart'],label+'-containerd-service').decode()
        config=self.read(['containerd','config','dump'],label+'-containerd-config').decode()
        props=dict(line.split('=',1) for line in service.splitlines() if '=' in line);head={}
        for line in config.splitlines():
            if line.startswith('['):break
            match=re.fullmatch(r'(version|root|state)\s*=\s*(.+)',line.strip())
            if match:require(match[1] not in head,'Duplicate containerd config key');head[match[1]]=match[2].strip('\'"')
        require(driver=='overlayfs' and docker=='/var/lib/docker' and ['driver-type','io.containerd.snapshotter.v1'] in status and
            head=={'version':'3','root':'/var/lib/containerd','state':'/run/containerd'},'Actual storage topology differs')
        require(props.get('ActiveState')=='active' and props.get('LoadState')=='loaded' and
            'argv[]=/usr/bin/containerd ;' in props.get('ExecStart','') and int(props.get('MainPID','0'))>0,
            'Default containerd daemon differs')
        value={'driver':driver,'dockerRoot':docker,'containerdRoot':head['root'],'pid':int(props['MainPID']),
            'configurationSha256':sha(config.encode())}
        require(self.topology is None or value==self.topology,'Storage daemon/config changed during release')
        self.topology=value;exclusive_record(self.root,label+'.json',value,self.sync);return value

    def overlay_views(self):
        inventory=self.reader.inventory();known=set(inventory)
        path=pathlib.Path('/proc')/str(os.getpid())/'mountinfo'
        for ancestor in (path,*path.parents):require(not ancestor.is_symlink(),'Numeric mountinfo path alias refused')
        with path.open('rb') as stream:raw=stream.read(2*1024**2+1)
        require(len(raw)<=2*1024**2,'Full mount inventory exceeds bound')
        views=mount_guard(raw.decode('ascii'),ALLOCATION,known)
        for view in views:
            point=pathlib.Path(view['view'])
            require(point.is_dir() and point.stat().st_dev!=pathlib.Path('/var/lib/docker').stat().st_dev,'Overlay is not a distinct virtual view')
            for p in [point]+[pathlib.Path(v) for v in view['lowerdirs']+[view['upperdir'],view['workdir']]]:
                for ancestor in (p,*p.parents):require(not ancestor.is_symlink(),'Overlay backing/view alias refused')
                require(p.is_dir(),'Required overlay backing missing')
                if p!=point:require(p.stat().st_dev==pathlib.Path('/var/lib/containerd').stat().st_dev,'Overlay backing crosses counted containerd filesystem')
        return views

    def sample(self,label):
        self.check(120);before_views=self.overlay_views()
        for raw in ALLOCATION:
            p=pathlib.Path(raw)
            for ancestor in (p,*p.parents):require(not ancestor.is_symlink(),'Physical accounting alias refused')
        self.number+=1
        raw,err,metadata=self.runner.run(['du','-x','-s','-B1','--',*ALLOCATION],
            'physical-'+str(self.number).zfill(6),120)
        require(not err and len(raw)<=65536,'Bounded complete disjoint physical allocation required')
        rows={}
        for line in raw.decode('ascii').splitlines():
            size,path=line.split('\t',1)
            require(path in ALLOCATION and path not in rows and size.isdecimal(),'Malformed physical allocation response')
            rows[path]={'bytes':int(size),'device':pathlib.Path(path).stat().st_dev}
        require(set(rows)==set(ALLOCATION),'Missing releases/Docker/containerd allocation')
        after_views=self.overlay_views();hardware_rows=self.hardware();free_gate(hardware_rows,self.budget.required())
        value={'label':label,'allocations':rows,'devices':{p:r['device'] for p,r in hardware_rows.items()},
            'free':{p:r['freeBytes'] for p,r in hardware_rows.items()},'requiredBytes':self.budget.required(),
            'verifiedOverlayViewsBefore':before_views,'verifiedOverlayViewsAfter':after_views,'overlayViewsCreditedBytes':0,
            'singleFilesystemDu':True,'hardlinksCountedOnce':True,'allRetainedReleaseRootsIncluded':True,'command':metadata}
        if self.before is not None:value['growth']=disjoint_growth(self.before,value)
        exclusive_record(self.root,'physical-'+str(self.number).zfill(6)+'.json',value,self.sync)
        self.before=self.before or value;self.last=value;return value

    def begin(self,label):
        require(self.last is not None,'Physical baseline required before stage')
        self.budget.begin(label,self.check());self.stage_before=self.last
        exclusive_record(self.root,'budget-'+label+'-intent.json',{'stage':label,'tableSha256':TABLE_SHA,
            'remainingCopyBytes':self.budget.remaining(),'neverReplay':True},self.sync)

    def finish(self,label):
        require(self.stage_before is not None,'No active physical stage')
        after=self.sample('stage-'+label)
        measured=max(0,sum(after['allocations'][p]['bytes']-self.stage_before['allocations'][p]['bytes'] for p in ALLOCATION))
        result=self.budget.finish(label,measured)
        exclusive_record(self.root,'budget-'+label+'-complete.json',result,self.sync)
        self.stage_before=None;self.check();return result

    def begin_recovery(self):
        # Called only after sequence/raw-equality/no-writer checks, before the
        # sole same-old restart. No normal installer may resume this budget.
        self.budget.reserve_recovery()
        self.check(600)
        self.recovery_before=self.sample('before-preapply-recovery')
        self.budget.claim_recovery_start()
        exclusive_record(self.root,'budget-preapply-recovery-intent.json',{
            'branch':'sameRetained959d','neverRetry':True,'remainingCopyBytes':self.budget.remaining()},self.sync)

    def finish_recovery(self):
        after=self.sample('after-preapply-recovery')
        growth=max(0,sum(after['allocations'][p]['bytes']-self.recovery_before['allocations'][p]['bytes'] for p in ALLOCATION))
        result=self.budget.finish_recovery(growth)
        exclusive_record(self.root,'budget-preapply-recovery-complete.json',result,self.sync)
        self.check();return result
