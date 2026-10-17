"""Separate source-derived copy allowances for the proposed review capture.

No import I/O or operational approval. These declared allowances do not close
SQLite writer scratch/WAL growth, daemon storage or physical metadata. The
complete source/launcher review remains mandatory before a real host read.
"""
import collections
import math
import pathlib
from kit_contract import LOG_RESERVE,canonical,disk_required,require,sha
from kit_budget import MINIMUM_DB_EQUIVALENTS,MARGIN_PERCENT,SEAL_DIRECTORY_BYTES
from kit_capture_owned import CAPTURE_ROOT,CAPTURE_UNIT,CAPTURE_COPY_SITES
from kit_capture_journal import CAPTURE_JOURNAL_SITES,JOURNAL_DB_COST,journal_disk_original
from kit_disk import Disk
from kit_journal import exclusive_record

CAPTURE_DB_COST={'triple':1,'backup':1,'reader-index':1,'clone':1,'assets':0,'seal-directory':0,
    'capture-policy-snapshot':1,'capture-214-snapshot':1,'capture-order-snapshots':2,
    'capture-206-main-journal':JOURNAL_DB_COST,'capture-214-main-journal':JOURNAL_DB_COST}
CAPTURE_APACHE_BYTES=8*1024**2
CAPTURE_STAGES=(
    ('capture-filesystem-snapshot',{'triple':2,'backup':1,'reader-index':1,'seal-directory':1,'assets':1},
        SEAL_DIRECTORY_BYTES+CAPTURE_APACHE_BYTES),
    ('capture-clone',{'clone':1},0),
    ('capture-integrity',{},0),
    ('capture-canonical-policy',{'capture-policy-snapshot':1},0),
    ('capture-206-prepare',{'triple':2,'backup':1,'reader-index':1,'seal-directory':1,'capture-206-main-journal':1},SEAL_DIRECTORY_BYTES),
    ('capture-214-prepare',{'capture-214-snapshot':1,'triple':2,'backup':1,'reader-index':1,'seal-directory':1,'capture-214-main-journal':1},SEAL_DIRECTORY_BYTES),
    ('capture-chart-impact',{},0),
    ('capture-order-impact',{'capture-order-snapshots':1},0),
)
CAPTURE_TABLE=[{'stage':name,'sites':sites,
    'dbTriples':sum(CAPTURE_DB_COST[site]*count for site,count in sites.items()),
    'assetCopies':sites.get('assets',0),'fixedBytes':fixed,'logGrowthShareBytes':LOG_RESERVE//8}
    for name,sites,fixed in CAPTURE_STAGES]
CAPTURE_TOTAL_DB_COPIES=sum(row['dbTriples'] for row in CAPTURE_TABLE)
CAPTURE_DB_EQUIVALENTS=max(MINIMUM_DB_EQUIVALENTS,math.ceil(CAPTURE_TOTAL_DB_COPIES*1.25))
CAPTURE_TABLE_SHA=sha(canonical({'root':CAPTURE_ROOT.as_posix(),'unit':CAPTURE_UNIT,'stages':CAPTURE_TABLE,
    'marginPercent':MARGIN_PERCENT,'minimumDatabaseEquivalents':MINIMUM_DB_EQUIVALENTS,
    'productionSqliteConnections':0,'preparationIssues':[206,214],'issue209ApplyPermitted':False,
    'physicalFilesystemClosureClaimed':False}))
require(sum(row['logGrowthShareBytes'] for row in CAPTURE_TABLE)==LOG_RESERVE,'Capture shares must retain the same4GiB reserve')


class CaptureBudget:
    def __init__(self,database_allocated,assets_allocated,image_bytes):
        require(all(type(value) is int and value>=0 for value in (database_allocated,assets_allocated,image_bytes))
            and database_allocated>0,'Exact capture DB/image/asset allocations required')
        self.db=database_allocated;self.assets=assets_allocated;self.image=image_bytes
        self.db_allowances=[(row['dbTriples']*self.db*125+99)//100 for row in CAPTURE_TABLE]
        self.fixed=[(row['fixedBytes']*125+99)//100 for row in CAPTURE_TABLE]
        self.padding=CAPTURE_DB_EQUIVALENTS*self.db-sum(self.db_allowances)
        require(self.padding>=0,'Capture stage rounding exceeds its full copy reserve')
        self.completed=0;self.active=None;self.claims=collections.Counter();self.copy_admissions=collections.Counter()

    def remaining(self,include_active=True):
        if self.completed==len(CAPTURE_TABLE):return 0
        first=self.completed+(1 if self.active is not None and not include_active else 0)
        return self.padding+sum(self.db_allowances[first:])+sum(self.fixed[first:])

    def required(self):return disk_required(self.db,self.image,self.assets,self.remaining(False))

    def begin(self,label,free):
        require(self.active is None and self.completed<len(CAPTURE_TABLE) and
            CAPTURE_TABLE[self.completed]['stage']==label,'Capture stage order/replay refused')
        require(type(free) is int and free>=disk_required(self.db,self.image,self.assets,self.remaining()),
            'Complete remaining capture allowance unavailable')
        self.active=label;self.claims=collections.Counter();self.copy_admissions=collections.Counter()

    def claim(self,site):
        require(self.active is not None and site in CAPTURE_TABLE[self.completed]['sites'],
            'Undeclared capture copy producer')
        self.claims[site]+=1
        require(self.claims[site]<=CAPTURE_TABLE[self.completed]['sites'][site],
            'Capture producer exceeded its source maximum')

    def cli(self,label):
        require(self.active==label and label in {row['stage'] for row in CAPTURE_TABLE[2:]},
            'Capture CLI does not match its active stage')
        site=CAPTURE_COPY_SITES.get(label)
        if site is not None:self.claim(site)
        site=CAPTURE_JOURNAL_SITES.get(label)
        if site is not None:self.claim(site)

    def copy_ceiling(self,site):
        require(self.active is not None and site in CAPTURE_TABLE[self.completed]['sites'] and
            self.claims.get(site,0)>self.copy_admissions[site],
            'Capture copy requires an unused consumed active-stage claim')
        self.copy_admissions[site]+=1
        if site=='seal-directory':return SEAL_DIRECTORY_BYTES
        return self.assets if site=='assets' else (self.db*CAPTURE_DB_COST[site]*125+99)//100

    def finish(self,label,physical_growth):
        require(self.active==label and dict(self.claims)==CAPTURE_TABLE[self.completed]['sites'],
            'Capture source copy claims missing or changed')
        require(dict(self.copy_admissions)==dict(self.claims),'Capture before-create admissions missing')
        row=CAPTURE_TABLE[self.completed]
        allowance=self.db_allowances[self.completed]+self.fixed[self.completed]+row['assetCopies']*self.assets+row['logGrowthShareBytes']
        require(type(physical_growth) is int and 0<=physical_growth<=allowance,
            'Capture physical growth exceeds declared stage allowance')
        result={'stage':label,'declared':row,'claims':dict(self.claims),'measuredPhysicalGrowthBytes':physical_growth,
            'allowedPhysicalGrowthBytes':allowance,'stageTableSha256':CAPTURE_TABLE_SHA,
            'physicalFilesystemClosureClaimed':False}
        self.completed+=1;self.active=None;self.claims=collections.Counter();self.copy_admissions=collections.Counter()
        result.update(remainingCopyBytes=self.remaining(),minimumFreeBytes=self.required())
        return result


class CaptureDisk(Disk):
    """Shared unchanged storage measurements, with a distinct typed table/root."""
    def __init__(self,root,reader,runner,budget,**kwargs):
        require(pathlib.Path(root).as_posix()==CAPTURE_ROOT.as_posix() and type(budget) is CaptureBudget,
            'Capture disk cannot accept release root or budget')
        super().__init__(root,reader,runner,budget,**kwargs)

    def admit_copy(self,site,destination,plan):
        ceiling=self.budget.copy_ceiling(site)
        require(plan['declaredAllocationBytes']<=ceiling,'Capture copy content/entries exceed its held producer allowance')
        self.check()
        # The physical journal name is reused by two distinct forward
        # transactions. Their source claims and immutable receipts must differ.
        if site in CAPTURE_JOURNAL_SITES.values():
            require(pathlib.Path(destination)==self.root/'scientific-database/dev.db-journal',
                'Capture main-journal admission destination differs')
            label=next(label for label,value in CAPTURE_JOURNAL_SITES.items() if value==site)
            name=journal_disk_original(label)
        else:name='copy-admission-'+sha(str(destination).encode())[:32]+'.json'
        exclusive_record(self.root,name,{
            'site':site,'destination':str(destination),'layout':plan,'maximumBytes':ceiling,
            'beforeDestinationCreation':True,'stageTableSha256':CAPTURE_TABLE_SHA,'neverRetry':True,
            'sqliteTemporaryFilesAndGlobalFilesystemClosureClaimed':False},self.sync)

    def begin(self,label):
        require(self.last is not None,'Capture physical baseline required before stage')
        self.budget.begin(label,self.check());self.stage_before=self.last
        exclusive_record(self.root,'budget-'+label+'-intent.json',{'stage':label,'tableSha256':CAPTURE_TABLE_SHA,
            'remainingCopyBytes':self.budget.remaining(),'neverReplay':True},self.sync)

    def begin_recovery(self):raise RuntimeError('Capture has no predecessor restart branch')
    def finish_recovery(self):raise RuntimeError('Capture has no predecessor recovery branch')
