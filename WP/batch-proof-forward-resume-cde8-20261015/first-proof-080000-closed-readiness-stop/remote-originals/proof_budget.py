"""Declared retained-copy graph and consumption-aware stage reservation. No import I/O."""
import ast,collections,hashlib,json
FLOOR_BYTES=10556150894
LOG_BYTES=4294967296
MARGIN_PERCENT=25
MINIMUM_DB_EQUIVALENTS=0
ASSET_RESERVE_MULTIPLIER=3
REFERENCE_DB_BYTES=567558144
REFERENCE_ASSET_BYTES=5787648
STAGES=(
    ('forward-input',{'triple':1}),
    ('issue-214',{'clone':1,'triple':2,'backup':1,'cli-charts':3}),
    ('order-impact',{'cli-order-impact':1}),
    ('issue-209',{'clone':1,'triple':2,'backup':1,'cli-orders':3}),
    ('startup-1',{'clone':1,'triple':2,'backup':1,'assets':1,'startup-policy-chain':1}),
    ('startup-2',{'clone':1,'triple':2,'backup':1,'assets':1,'startup-policy-chain':1}),
)
# A count is one maximum retained DB/WAL/SHM triple equivalent, not a model-row count.
DB_COST={'triple':1,'backup':1,'clone':1,'assets':0,'cli-policy':1,'cli-charts':1,'cli-orders':2,'cli-order-impact':2,'startup-policy-chain':8}
CLI_SITE={'install_lab_policy_schema.js':'cli-policy','install_control_charts.js':'cli-charts','install_order_revisions.js':'cli-orders','order_revision_impact.js':'cli-order-impact'}
TABLE=[{'stage':name,'sites':sites,'dbTriples':sum(DB_COST[s]*n for s,n in sites.items()),'assetCopies':sites.get('assets',0)} for name,sites in STAGES]
TOTAL_DB_COPIES=sum(r['dbTriples'] for r in TABLE)
TOTAL_ASSET_COPIES=sum(r['assetCopies'] for r in TABLE)
DB_EQUIVALENTS=max(MINIMUM_DB_EQUIVALENTS,(TOTAL_DB_COPIES*(100+MARGIN_PERCENT)+99)//100)
TABLE_SHA=hashlib.sha256(json.dumps(TABLE,sort_keys=True,separators=(',',':')).encode()).hexdigest()
COPY_CALLS={'copy_file','copy_triple','copy_tree','clone_backup','seal','backup','copyfile','copy2','copyfileobj','write_bytes','link','symlink'}
EXPECTED_SITES={
    'proof_files.py':{('copy_triple','copy_file'):1,('copy_tree','copy_file'):1,('seal','copy_triple'):2,('seal','backup'):1,('clone_backup','copy_file'):1},
    'proof_install.py':{('install','clone_backup'):1,('install','seal'):1},
    'proof_startup.py':{('startup','clone_backup'):1,('startup','copy_tree'):1,('startup','seal'):1},
    'run_stopped_proof.py':{},
    'proof_resume.py':{('prepare_resume','copy_triple'):1},
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
    return FLOOR_BYTES+LOG_BYTES+DB_EQUIVALENTS*db+ASSET_RESERVE_MULTIPLIER*assets
def capacity_gate(value):
    need(value.get('metadataOnly') is True and value.get('dbEquivalents')==DB_EQUIVALENTS and value.get('stageTableSha256')==TABLE_SHA,'Exact metadata capacity graph required')
    required=declared_budget(value.get('databaseReserveBytes'),value.get('assetReserveBytes'))
    need(value.get('requiredBytes')==required and set(value.get('freeBytes',{}))=={'/opt/lims','/var/lib/docker','/var/lib/containerd'},'Complete capacity evidence required')
    need(all(type(v) is int and v>=required for v in value['freeBytes'].values()),'STOP_CAPACITY_BEFORE_ROOT_CREATION_OR_UNIT_LAUNCH')
CAPACITY_METADATA_SOURCE='''import datetime,json,os,pathlib,shutil,stat
data=pathlib.Path(LIVE_DATA_VALUE)/'dev.db';assets=pathlib.Path(LIVE_ASSETS_VALUE)
def meta(p):
 for a in [p,*p.parents]:assert not a.is_symlink()
 if not p.exists():return None
 s=p.stat();assert stat.S_ISREG(s.st_mode)
 return (s.st_size,s.st_blocks*512,s.st_ino,s.st_mtime_ns,s.st_dev)
triple=lambda:[meta(pathlib.Path(str(data)+n)) for n in ['','-wal','-shm']]
before=triple();assert before[0] is not None;rows=[]
for directory,children,files in os.walk(assets,followlinks=False):
 p=pathlib.Path(directory);assert not p.is_symlink()
 for n in children:assert not (p/n).is_symlink()
 for n in files:
  row=meta(p/n);assert row and row[4]==assets.stat().st_dev;rows.append(row);assert len(rows)<=200000
assert triple()==before,'Metadata changed: STOP, no retry'
allocation=lambda r:max(r[1],((r[0]+4095)//4096)*4096)
t=sum(allocation(r) for r in before if r);a=sum(allocation(r) for r in rows)
print(json.dumps({'metadataOnly':True,'observedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'databaseReserveBytes':t,'assetReserveBytes':a,'requiredBytes':FLOOR_VALUE+LOG_VALUE+DB_VALUE*t+3*a,'dbEquivalents':DB_VALUE,'stageTableSha256':TABLE_VALUE,'freeBytes':{p:shutil.disk_usage(p).free for p in ['/opt/lims','/var/lib/docker','/var/lib/containerd']},'productionContentOpens':0,'productionCopies':0,'sqlConnections':0}))
'''
def capacity_probe_source(data,assets):
    return CAPACITY_METADATA_SOURCE.replace('LIVE_DATA_VALUE',repr(data)).replace('LIVE_ASSETS_VALUE',repr(assets)).replace('FLOOR_VALUE',str(FLOOR_BYTES)).replace('LOG_VALUE',str(LOG_BYTES)).replace('DB_VALUE',str(DB_EQUIVALENTS)).replace('TABLE_VALUE',repr(TABLE_SHA)).encode()
class Budget:
    def __init__(self,db,assets):
        declared_budget(db,assets);self.db=db;self.assets=assets;self.completed=0;self.active=None;self.claims={}
        self.allowances=[((r['dbTriples']*db*(100+MARGIN_PERCENT)+99)//100)+r['assetCopies']*assets for r in TABLE]
        self.padding=DB_EQUIVALENTS*db-sum(v-r['assetCopies']*assets for v,r in zip(self.allowances,TABLE))+(ASSET_RESERVE_MULTIPLIER-TOTAL_ASSET_COPIES)*assets
        need(self.padding>=0,'Stage rounding exceeds the declared graph budget')
    def remaining(self,include_active=True):
        if self.completed==len(TABLE):return 0
        start=self.completed+(1 if self.active is not None and not include_active else 0)
        return self.padding+sum(self.allowances[start:])
    def required(self):return FLOOR_BYTES+LOG_BYTES+self.remaining(include_active=False)
    def begin(self,label,free):
        need(self.active is None and self.completed<len(TABLE) and TABLE[self.completed]['stage']==label,'Stage order/replay refused')
        need(free>=FLOOR_BYTES+LOG_BYTES+self.remaining(),'Insufficient complete remaining-copy reserve')
        self.active=label;self.claims={}
    def claim(self,site):
        need(self.active is not None and site in TABLE[self.completed]['sites'],'Undeclared retained-copy producer')
        self.claims[site]=self.claims.get(site,0)+1
        need(self.claims[site]<=TABLE[self.completed]['sites'][site],'Retained-copy producer exceeded declared maximum')
    def finish(self,label,physical_growth):
        need(self.active==label and self.claims==TABLE[self.completed]['sites'],'Stage missing/changed declared copy sites')
        need(type(physical_growth) is int and physical_growth>=0 and physical_growth<=self.allowances[self.completed],'Stage physical growth exceeds its declared allocation and 25percent margin')
        result={'stage':label,'declared':TABLE[self.completed],'claimedMaxima':dict(self.claims),'allowedGrowthBytes':self.allowances[self.completed],'measuredPhysicalGrowthBytes':physical_growth}
        self.completed+=1;self.active=None;self.claims={};result['remainingBudgetBytes']=self.remaining();result['minimumFreeBytes']=self.required()
        return result
