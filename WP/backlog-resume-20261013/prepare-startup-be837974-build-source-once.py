"""Prepare NEW build-source draft only. No operator, SSH, Docker or application edit."""
import ast, datetime, hashlib, json, pathlib
R=pathlib.Path(__file__).resolve().parents[2]
OLD=R/'WP/batch-build-containerd-cde8-20261015'
NEW=R/'WP/batch-build-startup-be837974-20261015'
assert not NEW.exists(), 'Consumed source preparation; never replay.'
names=['batch_build_contract.py','batch_build.py','prepare_batch_build.py','launch_batch_build.py','verify_build_guards.py']
sources={n:(OLD/n).read_text(encoding='utf-8') for n in names}
basis={n:{'sha256':hashlib.sha256((OLD/n).read_bytes()).hexdigest(),'bytes':(OLD/n).stat().st_size} for n in names}
def replace(n,a,b):
    assert sources[n].count(a)==1,(n,a[:100],sources[n].count(a))
    sources[n]=sources[n].replace(a,b)
for n in names:
    sources[n]=sources[n].replace('WP/batch-build-containerd-cde8-20261015','WP/batch-build-startup-be837974-20261015')
replace('batch_build_contract.py',"CANDIDATE='cde8c8896f5f9d5f1ab07b0ae16b1a765e0a6367'","CANDIDATE='be8379745bdfae52ce46496ff26514dc7d729640'")
replace('batch_build_contract.py',"TREE='638580d50f61254609de3abd42d93afc676a5727'","TREE='676b01e71211786d1aeace50f19a0b2c9f9c482e'")
replace('batch_build_contract.py',"MAIN_CI=38636615469","MAIN_CI=38772398721")
replace('batch_build_contract.py',"MAIN_CI_COMPLETED='2026-10-14T21:34:24Z'","MAIN_CI_COMPLETED='2026-10-15T17:30:10Z'")
replace('batch_build_contract.py',"SCOPE='BUILD_ONLY_NO_DATABASE_CONNECTION_OR_VOLUME'","SCOPE='STARTUP_PERFORMANCE_NEW_APP_BUILD_ONLY_NO_DATABASE_CONNECTION_OR_VOLUME'")
replace('batch_build_contract.py',"FIRST_BUILD_ROOT_NAME='workflow-batch-build-cde8c889-20261015T010000Z'","FIRST_BUILD_ROOT_NAME='workflow-batch-build-be837974-20261015T180000Z'")
replace('batch_build_contract.py',r"r'workflow-batch-build-cde8c889-\d{8}T\d{6}Z'",r"r'workflow-batch-build-be837974-\d{8}T\d{6}Z'")
replace('batch_build_contract.py',"'merge':CANDIDATE,'comment':6178123314}]", "'merge':'cde8c8896f5f9d5f1ab07b0ae16b1a765e0a6367','comment':6178123314},\n    {'issue':'startup-performance','pr':298,'source':'eba02837eaa2ab797cad0572fecada686f660346','merge':CANDIDATE,'comment':6195167175}]")
replace('batch_build_contract.py',"value['id']>6178123314","value['id']>6195167175")
replace('batch_build_contract.py',"'batchBuildMemoryLimitBytes='+str(MEMORY),'preflightFailureBuildCount=0'", "'batchBuildMemoryLimitBytes='+str(MEMORY),'preflightFailureBuildCount=0',\n        'r4ComputedRequirementPlusHeadroomBytes='+str(R4_HEADROOM),'r4CapacityBeforeRootAndUnitAndBuild=true',\n        'r4CapacityModel='+CAPACITY_MODEL,'startupSourceAuditId=6195167175',\n        'standingCapacityRuleId=6189658753','standingCapacityActivationId=6189669837',\n        'cleanupRuleReviewId=6191219093','noProofDatabaseRemovalPendingYY=true','cachePruningByThisBuilder=false'")
# Source-only capacity budget: exact package inputs and raw-source lengths plus conservative physical margins.
sources['batch_build_contract.py'] += r'''
R4_HEADROOM=10_000_000_000
CAPACITY_BLOCK=4096
CAPACITY_SPEC_LIMIT=1024**2
CAPACITY_MODEL='RAW_GIT_SOURCE_BLOCKS_PLUS25PCT_PACKAGE_4GIB_BUILD_PLUS_FIXED_FLOOR_PLUS10GB'
def capacity_plan(application,lengths):
    require(application.get('head')==CANDIDATE and application.get('tree')==TREE,'Capacity application identity differs')
    require(set(lengths)==REQUIRED_ARTIFACTS-{'build-input.json'},'Capacity package inventory differs')
    require(all(type(v) is int and 0<=v<=128*1024**2 for v in lengths.values()),'Bounded exact package input lengths required')
    entries=application.get('entries',[]);require(entries and len({r['path'] for r in entries})==len(entries),'Capacity source inventory incomplete')
    blocks=0;directories=set();files=0
    def rounded(v):return ((v+CAPACITY_BLOCK-1)//CAPACITY_BLOCK)*CAPACITY_BLOCK
    for row in entries:
        path=member_path(row['path'])
        require(type(row['bytes']) is int and row['bytes']>=0 and row['mode'] in ['100644','100755','120000'],'Capacity source metadata differs')
        if 'node_modules' in path.parts:continue
        require(row['mode']!='120000','Only skipped dependency symlinks allowed')
        blocks+=rounded(row['bytes']);files+=1
        directories.update(str(v) for v in path.parents if str(v)!='.')
    source_base=blocks+len(directories)*2*CAPACITY_BLOCK+CAPACITY_SPEC_LIMIT
    source_allowance=rounded((source_base*5+3)//4)
    package_allowance=sum(rounded(v) for v in lengths.values())+2*CAPACITY_SPEC_LIMIT
    return {'model':CAPACITY_MODEL,'blockBytes':CAPACITY_BLOCK,'packageInputLengths':lengths,
        'packageAllocationAllowanceBytes':package_allowance,'sourceFileCount':files,'sourceDirectoryCount':len(directories),
        'sourceRoundedFileBytes':blocks,'sourceExtractionAllowanceBytes':source_allowance,
        'sourceMarginNumerator':5,'sourceMarginDenominator':4,'specLengthLimitBytes':CAPACITY_SPEC_LIMIT,
        'buildAllocationReserveBytes':BUILD_ALLOCATION,'reserveFloorBytes':FLOOR,'additionalHeadroomBytes':R4_HEADROOM}
def capacity_requirement(plan,phase):
    require(plan.get('model')==CAPACITY_MODEL and plan.get('additionalHeadroomBytes')==R4_HEADROOM and
        plan.get('reserveFloorBytes')==FLOOR and plan.get('buildAllocationReserveBytes')==BUILD_ALLOCATION,'Capacity bounds changed')
    require(phase in ['before-root','before-unit','before-build'],'Unknown capacity phase')
    for k in ['sourceExtractionAllowanceBytes','packageAllocationAllowanceBytes']:
        require(type(plan.get(k)) is int and plan[k]>0,'Capacity allocation missing')
    future=plan['sourceExtractionAllowanceBytes'] if phase!='before-build' else 0
    if phase=='before-root':future+=plan['packageAllocationAllowanceBytes']
    return FLOOR+BUILD_ALLOCATION+R4_HEADROOM+future
def validate_capacity_files(spec,application,actual_lengths):
    plan=capacity_plan(application,actual_lengths)
    require(spec.get('capacityPlan')==plan and spec.get('capacityPlanSha256')==sha(canonical(plan)),'Capacity plan or exact lengths changed')
    return plan
def validate_capacity_observation(plan,phase,rows):
    require(set(rows)=={'/opt/lims','/var/lib/docker','/var/lib/containerd'},'All three capacity paths required')
    required=capacity_requirement(plan,phase)
    for row in rows.values():
        require(type(row.get('freeBytes')) is int and row['freeBytes']>=required,'R4 computed requirement PLUS10GB does not fit')
        require(type(row.get('device')) is int and row['device']>0 and row.get('blockBytes')==CAPACITY_BLOCK and
            row.get('symlink') is False and row.get('directory') is True,'Capacity topology differs')
    return {'phase':phase,'requiredFreeBytes':required,'additionalHeadroomBytes':R4_HEADROOM,'paths':rows,
        'sameFilesystemValuesNotAdditive':True,'capacityPlanSha256':sha(canonical(plan))}
'''
replace('batch_build_contract.py',"    validate_source_review(review,index['head'],index)", "    require(isinstance(spec.get('capacityPlan'),dict) and spec.get('capacityPlanSha256')==sha(canonical(spec['capacityPlan'])),'R4 capacity plan binding missing')\n    capacity_requirement(spec['capacityPlan'],'before-root')\n    validate_source_review(review,index['head'],index)")
# Preparation still requires NEW exact five-file source PASS before generating any operational package.
replace('prepare_batch_build.py',"    validate_spec(spec,index,review);save('build-input.json'", "    lengths={p.name:p.stat().st_size for p in dest.iterdir()}\n    spec['capacityPlan']=capacity_plan(source_index,lengths);spec['capacityPlanSha256']=sha(canonical(spec['capacityPlan']))\n    validate_spec(spec,index,review);validate_capacity_files(spec,source_index,lengths);save('build-input.json'")
replace('prepare_batch_build.py',"    require({p.name for p in dest.iterdir()}==REQUIRED_ARTIFACTS,'Prepared package inventory differs')", "    require((dest/'build-input.json').stat().st_size<=CAPACITY_SPEC_LIMIT,'Capacity spec length exceeded')\n    require({p.name for p in dest.iterdir()}==REQUIRED_ARTIFACTS,'Prepared package inventory differs')")
# Source-only launcher gate executes reviewed pure contract in memory, then STAT/statvfs only, before root creation and again before unit launch.
replace('launch_batch_build.py',"def main(package):",r'''def fresh_capacity(package,spec,phase,evidence,label):
    contract=(package/'batch_build_contract.py').read_bytes()
    program="""import datetime,hashlib,json,os,pathlib
source=SOURCE_VALUE
assert hashlib.sha256(source).hexdigest()==SHA_VALUE
namespace={'__name__':'capacity_contract_only'}
exec(compile(source,'reviewed-capacity-contract.py','exec'),namespace)
plan=PLAN_VALUE
phase=PHASE_VALUE
rows={}
for p in ['/opt/lims','/var/lib/docker','/var/lib/containerd']:
 path=pathlib.Path(p)
 assert path.is_dir() and not path.is_symlink()
 assert str(path.resolve())==p
 stat=os.stat(path);fs=os.statvfs(path)
 rows[p]={'freeBytes':fs.f_bavail*fs.f_frsize,'device':stat.st_dev,'blockBytes':fs.f_frsize,'symlink':False,'directory':True}
result=namespace['validate_capacity_observation'](plan,phase,rows)
result['observedUtc']=datetime.datetime.now(datetime.timezone.utc).isoformat()
print(json.dumps(result))
""".replace('SOURCE_VALUE',repr(contract)).replace('SHA_VALUE',repr(sha(contract))).replace('PLAN_VALUE',repr(spec['capacityPlan'])).replace('PHASE_VALUE',repr(phase))
    response=run(['ssh','-o','BatchMode=yes','-o','ConnectTimeout=15',HOST,'python3','-B','-'],evidence,label,input=program.encode(),timeout=30)
    value=json_exact(response)
    validate_capacity_observation(spec['capacityPlan'],phase,value['paths'])
    require(value['requiredFreeBytes']==capacity_requirement(spec['capacityPlan'],phase),'Remote capacity formula differs')
    return value

def main(package):''')
replace('launch_batch_build.py',"    validate_spec(spec,index,review)", "    validate_spec(spec,index,review)\n    require((package/'build-input.json').stat().st_size<=CAPACITY_SPEC_LIMIT,'Capacity spec oversized')\n    validate_capacity_files(spec,json_exact((package/'source-index.json').read_bytes()),{p.name:p.stat().st_size for p in package.iterdir() if p.name!='build-input.json'})")
replace('launch_batch_build.py',"    create=\"import pathlib,json;", "    fresh_capacity(package,spec,'before-root',evidence,'capacity-before-root-original')\n    create=\"import pathlib,json;")
replace('launch_batch_build.py',"    result=run(['ssh','-o','BatchMode=yes','-o','ConnectTimeout=15',HOST,'python3','-B','-'],evidence,'verify-and-launch-once'", "    fresh_capacity(package,spec,'before-unit',evidence,'capacity-before-unit-original')\n    result=run(['ssh','-o','BatchMode=yes','-o','ConnectTimeout=15',HOST,'python3','-B','-'],evidence,'verify-and-launch-once'")
# Runtime repeats exact byte-bound plan checks and fresh full computed requirement before any extraction/build.
replace('batch_build.py',"    before=None;allocation_before=None", "    application_index=json_exact((ROOT/'source-index.json').read_bytes())\n    require((ROOT/'build-input.json').stat().st_size<=CAPACITY_SPEC_LIMIT,'Capacity spec oversized')\n    plan=validate_capacity_files(spec,application_index,{n:(ROOT/n).stat().st_size for n in REQUIRED_ARTIFACTS if n!='build-input.json'})\n    before=None;allocation_before=None")
replace('batch_build.py',"        require(min(before.values())>=FLOOR+BUILD_ALLOCATION,'Build allocation and fixed floor reserve refused')", "        require(min(before.values())>=capacity_requirement(plan,'before-unit'),'R4 before-controller computed requirement PLUS10GB refused')")
replace('batch_build.py',"        require(min(shutil.disk_usage(p).free for p in bound)>=FLOOR+BUILD_ALLOCATION,'Accounting preflight consumed build reserve')", "        require(min(shutil.disk_usage(p).free for p in bound)>=capacity_requirement(plan,'before-unit'),'R4 accounting preflight consumed computed requirement PLUS10GB')")
replace('batch_build.py',"        require(min(after_unpack.values())>=FLOOR+BUILD_ALLOCATION,'Source extraction consumed build reserve')", "        require(min(after_unpack.values())>=capacity_requirement(plan,'before-build'),'R4 before-build computed requirement PLUS10GB refused')\n        write_new('capacity-before-build-original.json',{'observedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'phase':'before-build','requiredFreeBytes':capacity_requirement(plan,'before-build'),'freeBytes':after_unpack,'capacityPlan':plan})")
replace('batch_build.py',"'status':'BUILT_AFTER_EXCLUDED_ACCOUNTING_FAILURE_NOT_PROVED_OR_DEPLOYED'", "'status':'NEW_STARTUP_APP_IMAGE_BUILT_NOT_PROVED_OR_DEPLOYED'")
replace('batch_build.py',"'newBuildCount':1,'retainedOwnedSourceAndLogs':True", "'capacityPlan':plan,'r4AdditionalHeadroomBytes':R4_HEADROOM,'cachePruningPerformed':False,'proofDatabaseRemovalPerformed':False,\n        'newBuildCount':1,'retainedOwnedSourceAndLogs':True")
# Updated pure fixtures retain every predecessor guard; no app tests/scanner assertions change.
s=sources['verify_build_guards.py']
s=s.replace('6179000001','6199000001').replace('2026-10-14T21:40:00Z','2026-10-15T18:00:00Z').replace('2026-10-14T21:41:00Z','2026-10-15T18:01:00Z')
s=s.replace("FIRST_BUILD_ROOT_NAME.replace('010000','011000')","FIRST_BUILD_ROOT_NAME.replace('180000','181000')")
sources['verify_build_guards.py']=s
replace('verify_build_guards.py',"    return spec,index,review", "    app={'head':CANDIDATE,'tree':TREE,'entries':[{'path':'Dockerfile','mode':'100644','bytes':10}]}\n    plan=capacity_plan(app,{n:10 for n in REQUIRED_ARTIFACTS if n!='build-input.json'})\n    spec.update(capacityPlan=plan,capacityPlanSha256=sha(canonical(plan)))\n    return spec,index,review")
extra=r'''
class FreshCapacityGuards(unittest.TestCase):
    def plan(self):
        return capacity_plan({'head':CANDIDATE,'tree':TREE,'entries':[{'path':'server/index.js','mode':'100644','bytes':4097}]},{n:12 for n in REQUIRED_ARTIFACTS if n!='build-input.json'})
    def test_exact_computed_requirement_plus_ten_gb_and_consumption_phases(self):
        p=self.plan()
        self.assertEqual(p['sourceRoundedFileBytes'],8192)
        self.assertEqual(capacity_requirement(p,'before-build'),FLOOR+BUILD_ALLOCATION+10_000_000_000)
        self.assertEqual(capacity_requirement(p,'before-root')-capacity_requirement(p,'before-unit'),p['packageAllocationAllowanceBytes'])
        self.assertEqual(capacity_requirement(p,'before-unit')-capacity_requirement(p,'before-build'),p['sourceExtractionAllowanceBytes'])
    def test_one_byte_short_refuses_each_phase_without_cleanup_or_root(self):
        p=self.plan()
        for phase in ['before-root','before-unit','before-build']:
            rows={n:{'freeBytes':capacity_requirement(p,phase),'device':1,'blockBytes':4096,'symlink':False,'directory':True} for n in ['/opt/lims','/var/lib/docker','/var/lib/containerd']}
            validate_capacity_observation(p,phase,rows)
            rows['/opt/lims']['freeBytes']-=1
            with self.assertRaises(RuntimeError):validate_capacity_observation(p,phase,rows)
    def test_missing_path_alias_changed_block_boolean_free_and_headroom_refuse(self):
        p=self.plan();phase='before-root'
        initial={n:{'freeBytes':capacity_requirement(p,phase),'device':1,'blockBytes':4096,'symlink':False,'directory':True} for n in ['/opt/lims','/var/lib/docker','/var/lib/containerd']}
        for kind in ['missing','alias','block','bool','directory']:
            rows=copy.deepcopy(initial)
            if kind=='missing':del rows['/var/lib/containerd']
            else:
                key,value={'alias':('symlink',True),'block':('blockBytes',512),'bool':('freeBytes',True),'directory':('directory',False)}[kind]
                rows['/opt/lims'][key]=value
            with self.assertRaises(RuntimeError):validate_capacity_observation(p,phase,rows)
        p['additionalHeadroomBytes']-=1
        with self.assertRaises(RuntimeError):capacity_requirement(p,phase)
    def test_changed_package_source_or_budget_refuses(self):
        p=self.plan()
        for key,value in [('capacityPlan',{}),('capacityPlanSha256','bad')]:
            spec,index,review=fixture();spec[key]=value
            with self.assertRaises(RuntimeError):validate_spec(spec,index,review)
        with self.assertRaises(RuntimeError):capacity_plan({'head':PREDECESSOR,'tree':TREE,'entries':[]},{})
    def test_launcher_and_builder_gate_order_is_structural(self):
        here=pathlib.Path(__file__).resolve().parent
        launch=(here/'launch_batch_build.py').read_text()
        build=(here/'batch_build.py').read_text()
        self.assertLess(launch.index("fresh_capacity(package,spec,'before-root'"),launch.index("create="))
        self.assertLess(launch.index("fresh_capacity(package,spec,'before-unit'"),launch.index("result=run(['ssh'",launch.index("launch='''")))
        self.assertLess(build.index("write_new('capacity-before-build-original.json'"),build.index("result=subprocess.run(['docker','build'"))
        self.assertNotIn("buildx','prune",build)
'''
replace('verify_build_guards.py',"if __name__=='__main__':unittest.main(verbosity=2)",extra+"\nif __name__=='__main__':unittest.main(verbosity=2)")
# Compile only: no importer, preparer, launcher, builder or probe executed by preparation.
for n,s in sources.items():ast.parse(s,filename=n)
NEW.mkdir()
for n,s in sources.items():
    with (NEW/n).open('x',encoding='utf-8',newline='\n') as f:f.write(s)
record={'preparedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'status':'NEW_COMPLETE_FIVE_FILE_BUILD_SOURCE_DRAFT_UNTESTED_NOT_APPROVED','basis':basis,
    'candidate':'be8379745bdfae52ce46496ff26514dc7d729640','tree':'676b01e71211786d1aeace50f19a0b2c9f9c482e','mainCiRun':38772398721,
    'mainCiEvidenceAudit':'3167ea258780a8590337e89e233083a8ef272695','root':'/opt/lims/releases/workflow-batch-build-be837974-20261015T180000Z',
    'packagePrepared':False,'rootCreated':False,'operatorExecuted':False,'testsExecuted':False,'productionOperations':0,'noOldHelperReplayed':True,
    'sourceHashes':{n:hashlib.sha256((NEW/n).read_bytes()).hexdigest() for n in names}}
with (NEW/'source-preparation-original.json').open('x',encoding='utf-8') as f:json.dump(record,f,indent=2)
print(json.dumps(record))

