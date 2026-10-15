"""Closed copy maxima, fixed startup files, phased package storage and fresh R4."""
import ast,collections,hashlib,json,os,pathlib,stat
from proof_app_sources import SCHEMA_BYTES,POLICY_MAX_PER_STARTUP
from proof_render import render
FLOOR_BYTES=10556150894
LOG_BYTES=4294967296
ADDITIONAL_BYTES=10000000000
MARGIN_PERCENT=25
# This graph contains only two startups from accepted installed209 inputs.
# The historical minimum64 was dropped for that scope; new review must affirm it.
MINIMUM_DB_EQUIVALENTS=0
ASSET_RESERVE_MULTIPLIER=3
REFERENCE_DB_BYTES=567558144
REFERENCE_ASSET_BYTES=5787648
BLOCK_BYTES=4096
BOUND=('/opt/lims','/var/lib/docker','/var/lib/containerd')
# Schema + seed marker + possible secret file (even though JWT is explicitly set),
# plus32 directory blocks, including the seven pinned asset directories and
# up to8 policy TMPDIRs. The25% margin applies to these fixed files too.
ASSET_DIRECTORY_MAX=7
FIXED_PER_STARTUP=((SCHEMA_BYTES+4095)//4096)*4096+2*4096+32*4096
STAGES=(
    ('startup-1',{'clone':1,'triple':2,'backup':1,'assets':1,'startup-policy-chain':1}),
    ('startup-2',{'clone':1,'triple':2,'backup':1,'assets':1,'startup-policy-chain':1}),
)
DB_COST={'triple':1,'backup':1,'clone':1,'assets':0,'cli-policy':1,'cli-charts':1,'cli-orders':2,'cli-order-impact':2,'startup-policy-chain':POLICY_MAX_PER_STARTUP}
CLI_SITE={}
TABLE=[{'stage':name,'sites':sites,'dbTriples':sum(DB_COST[s]*n for s,n in sites.items()),'assetCopies':sites.get('assets',0),'fixedBytes':FIXED_PER_STARTUP} for name,sites in STAGES]
TOTAL_DB_COPIES=sum(r['dbTriples'] for r in TABLE)
TOTAL_ASSET_COPIES=sum(r['assetCopies'] for r in TABLE)
DB_EQUIVALENTS=max(MINIMUM_DB_EQUIVALENTS,(TOTAL_DB_COPIES*125+99)//100)
FIXED_BYTES=sum((r['fixedBytes']*125+99)//100 for r in TABLE)
TABLE_SHA=hashlib.sha256(json.dumps(TABLE,sort_keys=True,separators=(',',':')).encode()).hexdigest()
COPY_CALLS={'copy_file','copy_triple','copy_tree','clone_backup','seal','backup','copyfile','copy2','copyfileobj','write_bytes','link','symlink'}
EXPECTED_SITES={
    'proof_files.py':{('copy_triple','copy_file'):1,('copy_tree','copy_file'):1,('seal','copy_triple'):2,('seal','backup'):1,('clone_backup','copy_file'):1},
    'proof_startup.py':{('startup','clone_backup'):1,('startup','copy_tree'):1,('startup','seal'):1},
    'run_stopped_proof.py':{},'proof_inputs.py':{},'proof_health.py':{},'proof_memory.py':{},
}
def need(ok,message):
    if not ok:raise RuntimeError(message)
def copy_site_guard(sources):
    need(set(sources)==set(EXPECTED_SITES),'Complete declared-copy source inventory required')
    for name,raw in sources.items():
        found=collections.Counter()
        class Sites(ast.NodeVisitor):
            function='module'
            def visit_FunctionDef(self,node):
                old=self.function;self.function=node.name;self.generic_visit(node);self.function=old
            def visit_Call(self,node):
                called=node.func.id if isinstance(node.func,ast.Name) else node.func.attr if isinstance(node.func,ast.Attribute) else ''
                if called in COPY_CALLS:found[(self.function,called)]+=1
                self.generic_visit(node)
        Sites().visit(ast.parse(raw))
        need(dict(found)==EXPECTED_SITES[name],'Undeclared or changed copy site: '+name)
def declared_budget(db,assets):
    need(type(db) is int and db>0 and db%512==0 and type(assets) is int and assets>=0 and assets%512==0,'Measured block-aligned conservative triple/asset allocations required')
    return FLOOR_BYTES+LOG_BYTES+ADDITIONAL_BYTES+DB_EQUIVALENTS*db+ASSET_RESERVE_MULTIPLIER*assets+FIXED_BYTES
def package_allowance(lengths):
    need(isinstance(lengths,dict) and 0<len(lengths)<=512,'Closed bounded package lengths required')
    need(all(isinstance(n,str) and pathlib.PurePosixPath(n).name==n and n not in ('.','..') and type(v) is int and 0<v<=64*1024**2 for n,v in lengths.items()),'Invalid package input length')
    need(sum(lengths.values())<=512*1024**2 and lengths.get('proof-input.json',0)<=1024**2,'Package/spec allocation bound')
    return sum(((v+4095)//4096)*4096 for v in lengths.values())+2*1024**2
def hardware_gate(rows):
    need(isinstance(rows,dict) and set(rows)==set(BOUND),'All three fresh hardware paths required')
    for p,r in rows.items():
        need(r.get('path')==p and r.get('realpath')==p and r.get('ancestorsChecked') is True and r.get('directory') is True and r.get('blockBytes')==4096 and r.get('fragmentBytes')==4096,'Alias, directory or block hardware guard refused')
        need(type(r.get('device')) is int and r['device']>=0 and type(r.get('availableBlocks')) is int and r['availableBlocks']>=0 and type(r.get('freeBytes')) is int and r['freeBytes']==r['availableBlocks']*4096,'Exact statvfs integer hardware evidence required')
    # Each path must pass independently; same-filesystem values are never added.
    return min(r['freeBytes'] for r in rows.values())
def capacity_gate(value,phase=None,package_bytes=None):
    need(value.get('metadataOnly') is True and value.get('dbEquivalents')==DB_EQUIVALENTS and value.get('stageTableSha256')==TABLE_SHA,'Exact metadata capacity graph required')
    need(value.get('phase') in ['BEFORE_ROOT','BEFORE_UNIT','RUNTIME_BIND'],'Unknown capacity phase')
    need(type(value.get('assetDirectoryCount')) is int and 0<value['assetDirectoryCount']<=ASSET_DIRECTORY_MAX,'Pinned asset directory maximum exceeded')
    if phase is not None:need(value['phase']==phase,'Capacity phase changed')
    future=value.get('futurePackageBytes')
    need(type(future) is int and future>=0 and (future==0 if value['phase']!='BEFORE_ROOT' else future>0),'Future package charged only before root')
    if package_bytes is not None:need(future==package_bytes,'Package allowance changed')
    required=declared_budget(value.get('databaseReserveBytes'),value.get('assetReserveBytes'))+future
    need(value.get('requiredBytes')==required and value.get('additionalHeadroomBytes')==ADDITIONAL_BYTES,'Exact R4 requirement plus10GB required')
    free=hardware_gate(value.get('hardware'))
    need(set(value.get('freeBytes',{}))==set(BOUND) and all(value['freeBytes'][p]==value['hardware'][p]['freeBytes'] for p in BOUND),'Complete nonadditive capacity evidence required')
    need(free>=required,'STOP_CAPACITY_BEFORE_ROOT_CREATION_OR_UNIT_LAUNCH')
    return required
# Exactly the same hardware implementation is used by the native controller and
# the in-memory SSH metadata template. Tests execute this actual template.
HARDWARE_SOURCE='''def collect_hardware():
 rows={}
 for raw in ['/opt/lims','/var/lib/docker','/var/lib/containerd']:
  p=pathlib.Path(raw)
  for a in [p,*p.parents]:
   if a.is_symlink():raise RuntimeError('Hardware ancestor alias')
  if str(p.resolve(strict=True))!=raw or not p.is_dir():raise RuntimeError('Hardware path is not its canonical directory')
  s=p.stat();v=os.statvfs(p)
  if type(s.st_dev) is not int or s.st_dev<0 or type(v.f_bavail) is not int or v.f_bavail<0 or v.f_bsize!=4096 or v.f_frsize!=4096:raise RuntimeError('Exact4096 statvfs hardware required')
  rows[raw]={'path':raw,'realpath':str(p.resolve(strict=True)),'ancestorsChecked':True,'directory':True,'device':s.st_dev,'blockBytes':v.f_bsize,'fragmentBytes':v.f_frsize,'availableBlocks':v.f_bavail,'freeBytes':v.f_bavail*v.f_frsize}
 return rows
'''
exec(compile(HARDWARE_SOURCE,'closed-hardware-source','exec'))
CAPACITY_METADATA_SOURCE='''import datetime,json,os,pathlib,stat
exec(HARDWARE_VALUE)
data=pathlib.Path(DATA_VALUE)/'dev.db';assets=pathlib.Path(ASSETS_VALUE)
def meta(p):
 for a in [p,*p.parents]:assert not a.is_symlink()
 if not p.exists():return None
 s=p.stat();assert stat.S_ISREG(s.st_mode)
 return (s.st_size,s.st_blocks*512,s.st_ino,s.st_mtime_ns,s.st_dev)
triple=lambda:[meta(pathlib.Path(str(data)+n)) for n in ['','-wal','-shm']]
before=triple();backupPath=pathlib.Path(BACKUP_VALUE);backupBefore=meta(backupPath);assert before[0] is not None and backupBefore is not None;rows=[];directoryCount=0
for a in [assets,*assets.parents]:assert not a.is_symlink()
assert assets.is_dir()
for directory,children,files in os.walk(assets,followlinks=False):
 p=pathlib.Path(directory);assert not p.is_symlink() and p.stat().st_dev==assets.stat().st_dev
 directoryCount+=1;assert directoryCount<=DIRECTORIES_VALUE,'Pinned asset directory maximum exceeded'
 for n in children:assert not (p/n).is_symlink()
 for n in files:
  row=meta(p/n);assert row and row[4]==assets.stat().st_dev;rows.append(row);assert len(rows)<=200000
assert triple()==before and meta(backupPath)==backupBefore,'Metadata changed: STOP, no retry'
allocation=lambda r:max(r[1],((r[0]+4095)//4096)*4096)
t=max(sum(allocation(r) for r in before if r),allocation(backupBefore));a=sum(allocation(r) for r in rows)
hardware=collect_hardware()
print(json.dumps({'metadataOnly':True,'observedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'phase':PHASE_VALUE,'futurePackageBytes':PACKAGE_VALUE,'databaseReserveBytes':t,'assetReserveBytes':a,'assetDirectoryCount':directoryCount,'requiredBytes':BASE_VALUE+DB_VALUE*t+3*a+PACKAGE_VALUE,'additionalHeadroomBytes':EXTRA_VALUE,'dbEquivalents':DB_VALUE,'stageTableSha256':TABLE_VALUE,'hardware':hardware,'freeBytes':{p:r['freeBytes'] for p,r in hardware.items()},'productionContentOpens':0,'productionCopies':0,'sqlConnections':0}))
'''
def capacity_probe_source(data,assets,backup,phase,package_bytes=0):
    need(phase in ['BEFORE_ROOT','BEFORE_UNIT','RUNTIME_BIND'] and type(package_bytes) is int and package_bytes>=0,'Exact capacity template phase required')
    need((package_bytes>0) if phase=='BEFORE_ROOT' else package_bytes==0,'Package phase double counting or omission')
    return render(CAPACITY_METADATA_SOURCE,{'HARDWARE_VALUE':HARDWARE_SOURCE,'DATA_VALUE':str(data),'ASSETS_VALUE':str(assets),'BACKUP_VALUE':str(backup),'PHASE_VALUE':phase,'PACKAGE_VALUE':package_bytes,'DIRECTORIES_VALUE':ASSET_DIRECTORY_MAX,'BASE_VALUE':FLOOR_BYTES+LOG_BYTES+ADDITIONAL_BYTES+FIXED_BYTES,'DB_VALUE':DB_EQUIVALENTS,'EXTRA_VALUE':ADDITIONAL_BYTES,'TABLE_VALUE':TABLE_SHA},'capacity-metadata')
class Budget:
    def __init__(self,db,assets):
        declared_budget(db,assets);self.db=db;self.assets=assets;self.completed=0;self.active=None;self.claims={}
        self.allowances=[(r['dbTriples']*db*125+99)//100+r['assetCopies']*assets+(r['fixedBytes']*125+99)//100 for r in TABLE]
        self.padding=DB_EQUIVALENTS*db-sum((r['dbTriples']*db*125+99)//100 for r in TABLE)+(ASSET_RESERVE_MULTIPLIER-TOTAL_ASSET_COPIES)*assets
        need(self.padding>=0,'Stage rounding exceeds the declared graph budget')
    def remaining(self,include_active=True):
        if self.completed==len(TABLE):return 0
        start=self.completed+(1 if self.active is not None and not include_active else 0)
        return self.padding+sum(self.allowances[start:])
    def required(self):return FLOOR_BYTES+LOG_BYTES+ADDITIONAL_BYTES+self.remaining(include_active=False)
    def begin(self,label,free):
        need(self.active is None and self.completed<len(TABLE) and TABLE[self.completed]['stage']==label,'Stage order/replay refused')
        need(type(free) is int and free>=FLOOR_BYTES+LOG_BYTES+ADDITIONAL_BYTES+self.remaining(),'Insufficient complete remaining-copy reserve')
        self.active=label;self.claims={}
    def claim(self,site):
        need(self.active is not None and site in TABLE[self.completed]['sites'],'Undeclared retained-copy producer')
        self.claims[site]=self.claims.get(site,0)+1
        need(self.claims[site]<=TABLE[self.completed]['sites'][site],'Retained-copy producer exceeded declared maximum')
    def finish(self,label,physical_growth):
        need(self.active==label and self.claims==TABLE[self.completed]['sites'],'Stage missing/changed declared copy sites')
        need(type(physical_growth) is int and 0<=physical_growth<=self.allowances[self.completed],'Stage physical growth exceeds its declared allocation and25percent margin')
        result={'stage':label,'declared':TABLE[self.completed],'claimedMaxima':dict(self.claims),'allowedGrowthBytes':self.allowances[self.completed],'measuredPhysicalGrowthBytes':physical_growth}
        self.completed+=1;self.active=None;self.claims={};result['remainingBudgetBytes']=self.remaining();result['minimumFreeBytes']=self.required()
        return result
