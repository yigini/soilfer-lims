"""Production copy maxima, 25% margin/min64 and consumption-aware stages.

The closed source/copy-site sweep and final Ops wiring remain required before
this table can become operational authority. No filesystem action on import.
"""
import collections
import math
from kit_target_reader import TARGET_READER_SITES
from kit_contract import FLOOR,LOG_RESERVE,ADDITIONAL_HEADROOM,disk_required,canonical,require,sha

MARGIN_PERCENT=25
MINIMUM_DB_EQUIVALENTS=64
ASSET_COPIES=3
SCHEMA_BYTES=89556
FIXED_STARTUP=((SCHEMA_BYTES+4095)//4096)*4096+2*4096+32*4096
# The alternative pre-APPLY branch retains at most stopped3+policy1+206dry1
# copies. Exact160-file959d source derivation has ZERO startup DB producers;
# its schema copy, two possible markers and32 directories remain reserved.
RECOVERY_SCHEMA_BYTES=86118
RECOVERY_FIXED=((RECOVERY_SCHEMA_BYTES+4095)//4096)*4096+2*4096+32*4096
RECOVERY_DB_COPIES=0
EARLY_PREFIX_MAX_DB_COPIES=5
RECOVERY_EVIDENCE_SHARE=LOG_RESERVE-3*256*1024**2
DB_COST={'triple':1,'backup':1,'clone':1,'assets':0,'cli-policy':1,'cli-charts':1,
         'cli-orders':2,'cli-order-impact':2,'startup-policy-chain':8,'cli-backup':1,'seal-directory':0,'reader-index':1,
         'target-reader-index':1}
STAGES=(
    ('stopped-backup',{'triple':2,'backup':1,'assets':1},0),
    ('canonical-policy',{'cli-policy':1},0),
    ('issue-206',{'clone':1,'triple':2,'backup':1,'target-reader-index':1},0),
    ('chart-impact',{},0),
    ('issue-214',{'clone':1,'triple':2,'backup':1,'cli-charts':3,'target-reader-index':1},0),
    ('order-impact',{'cli-order-impact':1},0),
    ('issue-209',{'clone':1,'triple':2,'backup':1,'cli-orders':3},0),
    ('candidate-startup',{'startup-policy-chain':1},FIXED_STARTUP),
    ('first-sync',{'cli-backup':1},0),
    ('postflight',{'cli-backup':1},0),
    ('second-sync',{},0),
)
# Each controller seal owns one outer directory in addition to its two triple
# directories. Charge that entry before mkdir, independently of later DB size.
SEAL_DIRECTORY_BYTES=3*4096
STAGES=tuple((name,{**sites,**({'seal-directory':sites['backup'],'reader-index':sites['backup']} if 'backup' in sites else {})},
    fixed+sites.get('backup',0)*SEAL_DIRECTORY_BYTES) for name,sites,fixed in STAGES)
CONTROLLER_COPY_SITES=('triple','backup','clone','assets','seal-directory','reader-index')
COPY_ADMISSION_SITES=CONTROLLER_COPY_SITES+('cli-backup','cli-policy','cli-charts','cli-orders','cli-order-impact','target-reader-index')
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
TABLE_SHA=sha(canonical({'normal':TABLE,'preApplyRecovery':{
    'maximumRetainedPrefixDatabaseCopies':EARLY_PREFIX_MAX_DB_COPIES,
    'startupDatabaseCopies':RECOVERY_DB_COPIES,'fixedBytes':RECOVERY_FIXED,
    'evidenceShareBytes':RECOVERY_EVIDENCE_SHARE,'sameRetained959dOnly':True}}))
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
        self.copy_admissions=collections.Counter()
        self.recovery=None
        self.recovery_allowance=(RECOVERY_FIXED*125+99)//100

    def remaining(self,include_active=True):
        if self.recovery is not None:
            return self.recovery_allowance if self.recovery=='reserved' or self.recovery=='active' and include_active else 0
        if self.completed==len(TABLE):return 0
        first=self.completed+(1 if self.active is not None and not include_active else 0)
        return self.padding+sum(self.db_allowances[first:])+sum(self.fixed[first:])+self.recovery_allowance

    def required(self):return disk_required(self.db,self.image,self.assets,self.remaining(include_active=False))

    def begin(self,label,free):
        require(self.recovery is None and self.active is None and self.completed<len(TABLE) and TABLE[self.completed]['stage']==label,'Physical stage order/replay refused')
        require(type(free) is int and free>=disk_required(self.db,self.image,self.assets,self.remaining()),'Complete remaining-copy reserve unavailable')
        self.active=label;self.claims=collections.Counter();self.copy_admissions=collections.Counter()

    def claim(self,site):
        require(self.recovery is None and self.active is not None and site in TABLE[self.completed]['sites'],'Undeclared retained-copy producer')
        self.claims[site]+=1
        require(self.claims[site]<=TABLE[self.completed]['sites'][site],'Retained-copy producer exceeded its source maximum')

    def cli(self,label):
        site=CLI_SITE.get(label)
        if site is not None:self.claim(site)
        if label in TARGET_READER_SITES:self.claim(TARGET_READER_SITES[label])

    def copy_ceiling(self,site):
        require(self.recovery is None and self.active is not None and site in
            TABLE[self.completed]['sites'] and self.claims.get(site,0)>0,
            'Copy admission requires its consumed active-stage source claim')
        require(site in COPY_ADMISSION_SITES,'Only explicitly bounded file-copy producers use this admission')
        require(self.copy_admissions[site]<self.claims[site],'Copy admission cannot reuse an earlier producer claim')
        self.copy_admissions[site]+=1
        if site=='seal-directory':return SEAL_DIRECTORY_BYTES
        return self.assets if site=='assets' else (self.db*DB_COST[site]*125+99)//100

    def finish(self,label,physical_growth):
        require(self.recovery is None and self.active==label and dict(self.claims)==TABLE[self.completed]['sites'],'Missing/changed source copy claims')
        require(dict(self.copy_admissions)=={site:n for site,n in self.claims.items() if site in
            COPY_ADMISSION_SITES},'Missing before-create content/entry admissions')
        allowance=self.db_allowances[self.completed]+self.fixed[self.completed]+TABLE[self.completed]['assetCopies']*self.assets+TABLE[self.completed]['logGrowthShareBytes']
        require(type(physical_growth) is int and 0<=physical_growth<=allowance,'Stage physical growth exceeds copy/fixed/evidence allowance')
        result={'stage':label,'declared':TABLE[self.completed],'claims':dict(self.claims),'measuredPhysicalGrowthBytes':physical_growth,
            'allowedPhysicalGrowthBytes':allowance,'stageTableSha256':TABLE_SHA}
        self.completed+=1;self.active=None;self.claims=collections.Counter()
        result.update(remainingCopyBytes=self.remaining(),minimumFreeBytes=self.required())
        return result

    def reserve_recovery(self):
        require(self.recovery is None and self.completed<=2 and self.active in
            (None,'stopped-backup','canonical-policy','issue-206'),
            'Only the pre-first-APPLY branch has a same-predecessor copy allowance')
        self.recovery='reserved'

    def claim_recovery_start(self):
        require(self.recovery=='reserved','Same-predecessor startup copy allowance is consumed')
        self.recovery='active'

    def finish_recovery(self,physical_growth):
        require(self.recovery=='active' and type(physical_growth) is int and physical_growth>=0,
            'Exact one recovery physical stage required')
        allowance=self.recovery_allowance+RECOVERY_EVIDENCE_SHARE
        require(physical_growth<=allowance,'Recovery copy/fixed/evidence growth exceeds alternative branch allowance')
        self.recovery='complete'
        return {'branch':'preApplySameRetained959d','maximumRetainedPrefixDatabaseCopies':EARLY_PREFIX_MAX_DB_COPIES,
            'startupDatabaseCopies':RECOVERY_DB_COPIES,'fixedBytes':RECOVERY_FIXED,
            'measuredPhysicalGrowthBytes':physical_growth,'allowedPhysicalGrowthBytes':allowance,
            'samePredecessorOnly':True,'noDatabaseRestore':True,'oldSwapConfigurationUnchanged':True,
            'normalSequenceCannotResume':True,'remainingCopyBytes':0,'minimumFreeBytes':self.required()}
