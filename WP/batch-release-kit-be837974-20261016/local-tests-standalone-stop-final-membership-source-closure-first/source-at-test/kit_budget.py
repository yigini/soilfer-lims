"""Production copy maxima, 25% margin/min64 and consumption-aware stages.

The closed source/copy-site sweep and final Ops wiring remain required before
this table can become operational authority. No filesystem action on import.
"""
import collections
import math
from kit_contract import FLOOR,LOG_RESERVE,ADDITIONAL_HEADROOM,disk_required,canonical,require,sha

MARGIN_PERCENT=25
MINIMUM_DB_EQUIVALENTS=64
ASSET_COPIES=3
SCHEMA_BYTES=89556
FIXED_STARTUP=((SCHEMA_BYTES+4095)//4096)*4096+2*4096+32*4096
DB_COST={'triple':1,'backup':1,'clone':1,'assets':0,'cli-policy':1,'cli-charts':1,
         'cli-orders':2,'cli-order-impact':2,'startup-policy-chain':8,'cli-backup':1}
STAGES=(
    ('stopped-backup',{'triple':2,'backup':1,'assets':1},0),
    ('canonical-policy',{'cli-policy':1},0),
    ('issue-206',{'clone':1,'triple':2,'backup':1},0),
    ('chart-impact',{},0),
    ('issue-214',{'clone':1,'triple':2,'backup':1,'cli-charts':3},0),
    ('order-impact',{'cli-order-impact':1},0),
    ('issue-209',{'clone':1,'triple':2,'backup':1,'cli-orders':3},0),
    ('candidate-startup',{'startup-policy-chain':1},FIXED_STARTUP),
    ('first-sync',{'cli-backup':1},0),
    ('postflight',{'cli-backup':1},0),
    ('second-sync',{},0),
)
CLI_SITE={'canonical-policy':'cli-policy','order-impact':'cli-order-impact',
          'first-sync-backup':'cli-backup','postflight-backup':'cli-backup',
          **{'214-'+phase:'cli-charts' for phase in ('dry','apply','repeat')},
          **{'209-'+phase:'cli-orders' for phase in ('dry','apply','repeat')}}
# Log shares are physical-growth caps inside the unchanged global4GiB reserve.
# The long second normal observation has the remaining1.5GiB share. Actual free
# space always retains the floor, log reserve and extra10GB conservatively.
TABLE=[{'stage':name,'sites':sites,'dbTriples':sum(DB_COST[s]*n for s,n in sites.items()),
        'assetCopies':sites.get('assets',0),'fixedBytes':fixed,
        'logGrowthShareBytes':256*1024**2 if name!='second-sync' else 1536*1024**2}
       for name,sites,fixed in STAGES]
TOTAL_DB_COPIES=sum(r['dbTriples'] for r in TABLE)
DB_EQUIVALENTS=max(MINIMUM_DB_EQUIVALENTS,math.ceil(TOTAL_DB_COPIES*1.25))
TABLE_SHA=sha(canonical(TABLE))
require(sum(r['logGrowthShareBytes'] for r in TABLE)==LOG_RESERVE,'Physical evidence shares must equal unchanged4GiB reserve')

class Budget:
    def __init__(self,database_allocated,assets_allocated,image_bytes):
        require(all(type(v) is int and v>=0 for v in (database_allocated,assets_allocated,image_bytes)) and database_allocated>0,
            'Exact measured database/image/asset allocations required')
        self.db=database_allocated;self.assets=assets_allocated;self.image=image_bytes
        self.db_allowances=[(r['dbTriples']*self.db*125+99)//100 for r in TABLE]
        self.fixed=[(r['fixedBytes']*125+99)//100 for r in TABLE]
        self.padding=DB_EQUIVALENTS*self.db-sum(self.db_allowances)
        require(self.padding>=0,'Stage rounding exceeds minimum64/25percent copy allowance')
        self.completed=0;self.active=None;self.claims=collections.Counter()

    def remaining(self,include_active=True):
        if self.completed==len(TABLE):return 0
        first=self.completed+(1 if self.active is not None and not include_active else 0)
        return self.padding+sum(self.db_allowances[first:])+sum(self.fixed[first:])

    def required(self):return disk_required(self.db,self.image,self.assets,self.remaining(include_active=False))

    def begin(self,label,free):
        require(self.active is None and self.completed<len(TABLE) and TABLE[self.completed]['stage']==label,'Physical stage order/replay refused')
        require(type(free) is int and free>=disk_required(self.db,self.image,self.assets,self.remaining()),'Complete remaining-copy reserve unavailable')
        self.active=label;self.claims=collections.Counter()

    def claim(self,site):
        require(self.active is not None and site in TABLE[self.completed]['sites'],'Undeclared retained-copy producer')
        self.claims[site]+=1
        require(self.claims[site]<=TABLE[self.completed]['sites'][site],'Retained-copy producer exceeded its source maximum')

    def cli(self,label):
        site=CLI_SITE.get(label)
        if site is not None:self.claim(site)

    def finish(self,label,physical_growth):
        require(self.active==label and dict(self.claims)==TABLE[self.completed]['sites'],'Missing/changed source copy claims')
        allowance=self.db_allowances[self.completed]+self.fixed[self.completed]+TABLE[self.completed]['assetCopies']*self.assets+TABLE[self.completed]['logGrowthShareBytes']
        require(type(physical_growth) is int and 0<=physical_growth<=allowance,'Stage physical growth exceeds copy/fixed/evidence allowance')
        result={'stage':label,'declared':TABLE[self.completed],'claims':dict(self.claims),'measuredPhysicalGrowthBytes':physical_growth,
            'allowedPhysicalGrowthBytes':allowance,'stageTableSha256':TABLE_SHA}
        self.completed+=1;self.active=None;self.claims=collections.Counter()
        result.update(remainingCopyBytes=self.remaining(),minimumFreeBytes=self.required())
        return result
