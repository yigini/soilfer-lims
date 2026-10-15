"""Pure build-only authority. Importing performs no filesystem, network or Docker I/O."""
import datetime, hashlib, json, pathlib, re

CANDIDATE='be8379745bdfae52ce46496ff26514dc7d729640'
TREE='676b01e71211786d1aeace50f19a0b2c9f9c482e'
MAIN_CI=38772398721
MAIN_CI_COMPLETED='2026-10-15T17:30:10Z'
SOURCE_FILES=frozenset({'batch_build_contract.py','batch_build.py','prepare_batch_build.py','launch_batch_build.py','verify_build_guards.py'})
SCOPE='STARTUP_PERFORMANCE_NEW_APP_BUILD_ONLY_NO_DATABASE_CONNECTION_OR_VOLUME'
FLOOR=10556150894
BUILD_ALLOCATION=4*1024**3
BUILD_TIMEOUT=1800
UNIT_TIMEOUT=2700
MEASUREMENT_TIMEOUT=120
MEMORY=805306368
UNEXPLAINED_GROWTH_ABORT=500000000
GROWTH_POLICY='OWNED_BUILD_ROOT_AND_DISJOINT_DOCKER_AND_CONTAINERD_ALLOCATIONS'
FIRST_BUILD_ROOT_NAME='workflow-batch-build-be837974-20261015T190000Z'
ORIGINAL_FAILED_ROOT='/opt/lims/releases/workflow-batch-build-cde8c889-20261014T221500Z'
FALLBACK_DIRECTION_ID=6180234041
ANALYSIS_AUDIT='850cc7670aceaa4fc2823aa3e0b5b5cf58c347da'
REFERENCE_FILES={'original-build-failure.json':{'audit':'a514c0a49a7487f44b33e27a7390972926a56307','path':'WP/batch-release-cde8-20261014/first-build-221500-closed-terminal/build-terminal-failure.json','sha256':'4474dcd30269c0710e17723e2f702114f09d48129ccc070b499aa65a69ab30c2'},'metadata-analysis-original.json':{'audit':ANALYSIS_AUDIT,'path':'WP/batch-forward-metadata-cde8-20261014/retained-targeted-analysis-no-adoption-once/analysis-original.json','sha256':'c2f4fc6d15d064f4e4a08255edbfd450494adb3f3625224ce7267550f66e6d25'}}
AUDITS=[{'issue':206,'pr':295,'source':'1a0702b3be410ac1dcdd9dc92f0f0c3dd2774a3a','merge':'6d750914d8565acdd496767a7dd935811b5a89b2','comment':6146939836},
    {'issue':214,'pr':296,'source':'5e0b32830f961b3236c7cf8f74cf8f676e98fbaa','merge':'2242bcb4861a7085bb95e78e0e7b1e4edf11d1b8','comment':6163165778},
    {'issue':209,'pr':297,'source':'6bd516c42a07332d0b0653ed150d1526bf7e424e','merge':'cde8c8896f5f9d5f1ab07b0ae16b1a765e0a6367','comment':6178123314},
    {'issue':'startup-performance','pr':298,'source':'eba02837eaa2ab797cad0572fecada686f660346','merge':CANDIDATE,'comment':6195167175}]
PREDECESSOR='959d17e11c357266f7c2a41b0c84ab76914c591e'
PREDECESSOR_IMAGE='sha256:7aebc035254a61b0b4b8ecb59492d582af7f3769c147a35a7e92a43fb7a642d2'
PREDECESSOR_RECEIPT='03e3309714cadd956e13e9b34576ed774f1e56c482fdc2b07a828a52c1fcb953'
REQUIRED_ARTIFACTS=SOURCE_FILES|{'build-input.json','tooling-source-index.json','source-review-original.json','source.tar.gz','source-index.json','main-original.json','main-ci-original.json'}|{f'pr{a["pr"]}-{k}.json' for a in AUDITS for k in ['original','actual-pass-original','comments-original']}
REQUIRED_ARTIFACTS=REQUIRED_ARTIFACTS|set(REFERENCE_FILES)|{'fallback-direction-original.json'}

REFERENCE_FILES['startup-180000-build-failure.json']={'audit':'23e8dad8d6442321586b7d0bf4920c48a8681054','path':'WP/batch-build-startup-be837974-20261015/first-build-180000-closed-originals-once/build-terminal-failure.json','sha256':'46d6cfa5b9214c3ecca68d293086f4b97dd3d00840378a17261738cf696d0217'}
REQUIRED_ARTIFACTS=REQUIRED_ARTIFACTS|{'startup-180000-build-failure.json'}

def require(value,reason):
    if not value:raise RuntimeError(reason)
def sha(data):return hashlib.sha256(data).hexdigest()
def canonical(value):return json.dumps(value,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode()
def json_exact(raw):
    def pairs(items):
        result={}
        for k,v in items:require(k not in result,'Duplicate JSON key');result[k]=v
        return result
    return json.loads(raw,object_pairs_hook=pairs)
def first_line(text):return next((s.strip().strip('*_# ').rstrip('.') for s in text.splitlines() if s.strip()),'')
def safe_build_root(name):
    require(isinstance(name,str) and re.fullmatch(r'workflow-batch-build-be837974-\d{8}T\d{6}Z',name),'Wrong new build namespace')
    require(name==FIRST_BUILD_ROOT_NAME,'Only the exact first reviewed build root is allowed')
    return pathlib.PurePosixPath('/opt/lims/releases')/name
def graph(index):
    require(re.fullmatch('[a-f0-9]{40}',index.get('head','')) is not None,'Exact tooling commit required')
    files=index.get('files',{})
    require(set(files)==SOURCE_FILES,'Complete closed build source graph required')
    for n,row in files.items():
        require(type(row.get('bytes')) is int and row['bytes']>0 and re.fullmatch('[a-f0-9]{64}',row.get('sha256','')) is not None and re.fullmatch('[a-f0-9]{40}',row.get('blob','')) is not None,'Invalid tooling source identity '+n)
    return {n:row['sha256'] for n,row in files.items()}
def review_tokens(tooling,index):
    files=graph(index);require(tooling==index['head'],'Tooling head differs')
    return [tooling,CANDIDATE,TREE,f'mainCiRun={MAIN_CI}','batchBuildScope='+SCOPE,'reserveFloorBytes='+str(FLOOR),
        'buildAllocationReserveBytes='+str(BUILD_ALLOCATION),'buildTimeoutSeconds='+str(BUILD_TIMEOUT),
        'buildUnitTimeoutSeconds='+str(UNIT_TIMEOUT),'unexplainedGrowthAbortBytes='+str(UNEXPLAINED_GROWTH_ABORT),'diskGrowthPolicy='+GROWTH_POLICY,
        'labAndHubBuildsOwnedByYY=true','releaseWindowControl=RELEASE_DAY_DISK_ABORTS_ACCEPTED',
        'originalBatchBuildRoot='+str(safe_build_root(FIRST_BUILD_ROOT_NAME)),
        'originalFailedBuildRoot='+ORIGINAL_FAILED_ROOT,'metadataAnalysisAudit='+ANALYSIS_AUDIT,'fallbackDirectionId='+str(FALLBACK_DIRECTION_ID),
        'originalImageStillExcluded=true','allocationIncludesContainerdRoot=/var/lib/containerd','allocationMeasurementTimeoutSeconds='+str(MEASUREMENT_TIMEOUT),
        'batchBuildMemoryLimitBytes='+str(MEMORY),'preflightFailureBuildCount=0',
        'r4ComputedRequirementPlusHeadroomBytes='+str(R4_HEADROOM),'r4CapacityBeforeRootAndUnitAndBuild=true',
        'r4CapacityModel='+CAPACITY_MODEL,'startupSourceAuditId=6195167175',
        'standingCapacityRuleId=6189658753','standingCapacityActivationId=6189669837',
        'cleanupRuleReviewId=6191219093','noProofDatabaseRemovalPendingYY=true','cachePruningByThisBuilder=false',
        'priorFailedStartupBuildRoot=/opt/lims/releases/workflow-batch-build-be837974-20261015T180000Z',
        'priorFailedStartupBuildRecordSha256='+REFERENCE_FILES['startup-180000-build-failure.json']['sha256'],
        'postBuildWholeMeasurementMaxAttempts=2','postBuildMeasurementAttemptTimeoutSeconds=120',
        'additionalMeasurementOnlyForExactMissingNumericContainerdSnapshotDirectory=true',
        'allPartialMeasurementOutputsRetainedNeverCredited=true','noMeasurementOfFailed180000Root=true']+['authority'+i+'='+pin for i,pin in sorted(RULE_AUTHORITY_PINS.items())]+[n+'='+d for n,d in sorted(files.items())]
def validate_source_review(value,tooling,index):
    require(type(value.get('id')) is int and value['id']>6195167175,'A NEW build-source approval is required')
    require(value.get('html_url')=='https://github.com/yigini/soilfer-lims/issues/162#issuecomment-'+str(value['id']),'Wrong source-review destination')
    require(value.get('performed_via_github_app',{}).get('slug')=='claude','Actual Claude review required')
    body=value.get('body','');require(first_line(body)=='Source review: PASS','Build source has no final PASS')
    require(all(token in body for token in review_tokens(tooling,index)),'Source review omits exact graph/bindings')
    require(value.get('created_at')==value.get('updated_at') and value['created_at']>=MAIN_CI_COMPLETED,'Source approval is edited or predates main completion')
def no_later_source_failure(comments,review,tooling):
    for c in comments:
        body=c.get('body','')
        if c.get('created_at','')>review['created_at'] and tooling in body and any(t in body.lower() for t in ['source review: failed','source review: changes required','audit failed']):raise RuntimeError('Later source failure requires inspection')
def validate_current(main,ci,prs,verdicts,comments):
    require(main.get('object',{}).get('sha')==CANDIDATE,'Current main moved; build refuses')
    require(ci.get('id')==MAIN_CI and ci.get('head_sha')==CANDIDATE and ci.get('event')=='push' and type(ci.get('run_attempt')) is int and ci['run_attempt']==1 and ci.get('status')=='completed' and ci.get('conclusion')=='success','Exact main CI required')
    for a in AUDITS:
        pr=prs[str(a['pr'])];v=verdicts[str(a['pr'])]
        require(pr.get('merged') is True and pr.get('merge_commit_sha')==a['merge'] and pr.get('head',{}).get('sha')==a['source'],'Merged batch PR changed')
        require(v.get('id')==a['comment'] and first_line(v.get('body','')).startswith('Audit passed: OK to merge and deploy') and a['source'] in v['body'] and v.get('performed_via_github_app',{}).get('slug')=='claude','Actual per-issue exact-head PASS missing')
        for c in comments[str(a['pr'])]:
            if c.get('created_at','')>v['created_at'] and 'audit failed' in c.get('body','').lower():raise RuntimeError('Later audit failure requires inspection')
def validate_spec(spec,index,review):
    require(spec.get('status')=='PREPARED_BATCH_BUILD_ONLY_NOT_LAUNCHED' and spec.get('head')==CANDIDATE and spec.get('tree')==TREE,'Build-only candidate binding differs')
    require(spec.get('scope')==SCOPE and spec.get('audits')==AUDITS and spec.get('mainCiRun')==MAIN_CI,'Build scope/individual approvals differ')
    require(spec.get('labAndHubBuildsOwnedByYY') is True and spec.get('releaseWindowControl')=='RELEASE_DAY_DISK_ABORTS_ACCEPTED','Both YY workload pins required')
    require(all(type(spec.get(k)) is int and spec[k]==0 for k in ['productionDatabaseMounts','productionDatabaseConnections','proofLaunches','productionDeployments']),'Build package expanded its scope')
    safe_build_root(spec.get('rootName'))
    require(spec.get('toolingCommit')==index['head'] and spec.get('toolingSourceIndexSha256')==sha(canonical(index)),'Tooling source binding changed')
    require(spec.get('sourceReviewId')==review['id'] and spec.get('sourceReviewRawSha256')==sha(canonical(review)),'Source-review binding changed')
    require(spec.get('reserveFloorBytes')==FLOOR and spec.get('buildAllocationReserveBytes')==BUILD_ALLOCATION and spec.get('buildTimeoutSeconds')==BUILD_TIMEOUT and spec.get('buildUnitTimeoutSeconds')==UNIT_TIMEOUT and spec.get('unexplainedGrowthAbortBytes')==UNEXPLAINED_GROWTH_ABORT and spec.get('diskGrowthPolicy')==GROWTH_POLICY,'Disk or lifetime bounds changed')
    require(spec.get('allocationMeasurementTimeoutSeconds')==MEASUREMENT_TIMEOUT and spec.get('batchBuildMemoryLimitBytes')==MEMORY and spec.get('originalFailedRoot')==ORIGINAL_FAILED_ROOT and spec.get('metadataAnalysisAudit')==ANALYSIS_AUDIT and spec.get('referenceFiles')==REFERENCE_FILES and spec.get('fallbackDirectionId')==FALLBACK_DIRECTION_ID and re.fullmatch('[a-f0-9]{64}',spec.get('fallbackDirectionRawSha256','')),'Corrected accounting/reference bindings missing')
    require(isinstance(spec.get('capacityPlan'),dict) and spec.get('capacityPlanSha256')==sha(canonical(spec['capacityPlan'])),'R4 capacity plan binding missing')
    capacity_requirement(spec['capacityPlan'],'before-root')
    validate_source_review(review,index['head'],index)

def allocation_paths(root):
    require(str(root)==str(safe_build_root(FIRST_BUILD_ROOT_NAME)),'Only new owned root may be measured')
    return [str(root)]+['/var/lib/docker/'+n for n in ['buildkit','overlay2','image','containerd']]+['/var/lib/containerd']

def validate_allocation_inventory(root,rows):
    require(set(rows)==set(allocation_paths(root)),'Complete disjoint Docker+containerd allocation inventory required')
    for path,row in rows.items():
        require(type(row.get('bytes')) is int and row['bytes']>=0 and type(row.get('device')) is int and row['device']>0,'Exact physical integer allocation required')
        require(row.get('symlink') is False and type(row.get('exists')) is bool,'Aliases or unknown existence refused')
        if path in [str(root),'/var/lib/containerd']:require(row['exists'] is True,'Required new root/containerd store missing')
        if not row['exists']:require(row['bytes']==0,'Absent legacy path must have measured zero')

def no_descendant_mounts(text,roots):
    def unescape(v):return re.sub(r'\\([0-7]{3})',lambda m:chr(int(m[1],8)),v)
    roots=tuple(roots)
    require(text.strip() and len(text.encode())<=2*1024**2,'Bounded actual mount inventory required')
    for line in text.splitlines():
        fields=line.split();require(len(fields)>=10 and '-' in fields,'Mount inventory shape changed')
        mount=pathlib.PurePosixPath(unescape(fields[4]));require(mount.is_absolute(),'Absolute mount required')
        for root in roots:
            p=pathlib.PurePosixPath(root)
            require(not (mount!=p and p in mount.parents),'Descendant mount would make physical accounting incomplete or aliased')

def storage_topology(driver,driver_status,docker_root,service,config):
    require(driver.strip()=='overlayfs' and docker_root.strip()=='/var/lib/docker' and ['driver-type','io.containerd.snapshotter.v1'] in json_exact(driver_status),'Exact actual Docker containerd topology required')
    props=dict(v.split('=',1) for v in service.splitlines() if '=' in v)
    require(props.get('LoadState')=='loaded' and props.get('ActiveState')=='active' and props.get('MainPID','').isdigit() and int(props['MainPID'])>0 and 'argv[]=/usr/bin/containerd ;' in props.get('ExecStart',''),'Actual default-config containerd daemon required')
    top={}
    for line in config.splitlines():
        if line.startswith('['):break
        m=re.fullmatch(r'(version|root|state)\s*=\s*(.+)',line.strip())
        if m:require(m[1] not in top,'Duplicate containerd top-level key');top[m[1]]=m[2].strip("'\"")
    require(top=={'version':'3','root':'/var/lib/containerd','state':'/run/containerd'},'Actual containerd storage root/state differs')
    return {'driver':'overlayfs','dockerRoot':'/var/lib/docker','containerdRoot':top['root'],'containerdState':top['state'],'containerdVersion':top['version'],'daemonMainPid':int(props['MainPID']),'fullConfigRawSha256':sha(config.encode()),'fullConfigStored':False,'selectedTopLevelOnly':True}

def fallback_evidence(direction,failed,analysis):
    require(direction.get('id')==FALLBACK_DIRECTION_ID and (direction.get('performed_via_github_app') or {}).get('slug')=='claude' and direction.get('created_at')==direction.get('updated_at'),'Actual unedited fallback direction required')
    require('This is direction only.' in direction['body'] and 'send a new build source with corrected Docker+containerd accounting for review instead.' in direction['body'],'Full source-only fallback direction changed')
    require(failed.get('status')=='FAILED_OR_RESERVE_REFUSED_BUILD_ONLY_RETAIN_ALL' and failed.get('error')=='Unexplained disk growth reached the 500MB abort boundary','Original failed status must remain')
    require(analysis.get('status')=='RETAINED_METADATA_INSUFFICIENT_FOR_IMAGE_ADOPTION' and analysis.get('adoptionMustStop') is True and analysis.get('imageEligibility') is False and analysis.get('growthBytesCreditedByThisAnalysis')==0,'Image adoption refusal must remain')
def build_disk_growth(before,after,devices,allocated_before,allocated_after):
    require(set(before)==set(after)==set(devices) and set(allocated_before)==set(allocated_after),'Disk observation inventory changed')
    growth={}
    for path,prior in allocated_before.items():
        current=allocated_after[path]
        require(prior['device']==current['device'] and type(prior['bytes']) is int and type(current['bytes']) is int and min(prior['bytes'],current['bytes'])>=0,'Allocation filesystem/length changed')
        growth[prior['device']]=growth.get(prior['device'],0)+current['bytes']-prior['bytes']
    rows={}
    for path in before:
        require(type(before[path]) is int and type(after[path]) is int,'Invalid free-space measurement')
        loss=before[path]-after[path];known=growth.get(devices[path],0);unexplained=max(0,loss-known)
        require(unexplained<UNEXPLAINED_GROWTH_ABORT,'Unexplained disk growth reached the 500MB abort boundary')
        rows[path]={'freeByteDrop':loss,'knownAllocatedGrowthBytes':known,'unexplainedGrowthBytes':unexplained}
    return {'policy':GROWTH_POLICY,'abortBytes':UNEXPLAINED_GROWTH_ABORT,'filesystems':rows,'beforeAllocations':allocated_before,'afterAllocations':allocated_after}
def member_path(name):
    require(isinstance(name,str) and name and '\\' not in name,'Unsafe archive spelling')
    p=pathlib.PurePosixPath(name)
    require(not p.is_absolute() and '..' not in p.parts and str(p)==name.rstrip('/'),'Unsafe archive path')
    require(p.parts[0]!='WP','Audit tooling must not enter application image')
    return p
def verify_archive_members(bundle,index):
    require(index.get('head')==CANDIDATE and index.get('tree')==TREE and index.get('status')=='COMMITTED_APPLICATION_GIT_BLOB_INDEX','Archive source identity differs')
    rows=index.get('entries',[]);expected={v['path']:v for v in rows};require(len(rows)==len(expected) and rows,'Missing or duplicate source inventory')
    members=bundle.getmembers();files=[m for m in members if not m.isdir()]
    require(len(files)==len(expected) and {m.name for m in files}==set(expected),'Archive is incomplete or duplicated')
    allowed_directories={str(p) for name in expected for p in pathlib.PurePosixPath(name).parents if str(p)!='.'}
    kept=[];seen_directories=set()
    for m in members:
        p=member_path(m.name)
        if m.isdir():
            require(str(p) in allowed_directories and str(p) not in seen_directories,'Unexpected or duplicate source directory')
            seen_directories.add(str(p))
            if 'node_modules' not in p.parts:kept.append(m)
            continue
        row=expected[m.name];require(type(row.get('bytes')) is int and row['bytes']>=0,'Invalid source length')
        if m.issym():
            require(row['mode']=='120000' and 'node_modules' in p.parts,'Unreviewed source symlink')
            data=m.linkname.encode()
        else:
            require(m.isfile() and row['mode'] in ['100644','100755'],'Unreviewed archive member type')
            require(m.mode&0o777==(0o755 if row['mode']=='100755' else 0o644),'Archive executable mode differs from Git')
            data=bundle.extractfile(m).read()
        require(len(data)==row['bytes'] and sha(data)==row['sha256'],'Archive byte mismatch '+m.name)
        require(hashlib.sha1(('blob '+str(len(data))+'\0').encode()+data).hexdigest()==row['blob'],'Archive Git blob mismatch '+m.name)
        if 'node_modules' not in p.parts:kept.append(m)
    return kept

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

RULE_AUTHORITY_PINS={'6189025975': '071b37b60b7489fc47f53aee5d5a91726e967730ebdf40adbc22aef4b047ee7e', '6189658753': '1b293cf3d6b7108293599ffabfc1273ebd5f158f69a6e11f58e467d7ffa42708', '6189669837': '2821ccc164bbf344201e6569f707314a168ae6f308cbece73cc5065d9ad3ac7e', '6191219093': '84289b1c85e65973f26d52199f539e13423d5803c83c38be34a515b089505f8f'}
REQUIRED_ARTIFACTS=REQUIRED_ARTIFACTS|{'authority-'+i+'-original.json' for i in RULE_AUTHORITY_PINS}
def validate_rule_authorities(raw):
    for i,pin in RULE_AUTHORITY_PINS.items():
        value=json_exact(raw['authority-'+i+'-original.json'])
        projection={k:value[k] for k in ['id','body','created_at','updated_at']}
        app=value.get('performed_via_github_app') or {}
        projection['app']={'id':app.get('id'),'slug':app.get('slug')}
        require(value['id']==int(i) and sha(canonical(projection))==pin,'Actual performance/capacity authority changed')


def validate_prior_startup_failure(value):
    require(value.get('status')=='FAILED_OR_RESERVE_REFUSED_BUILD_ONLY_RETAIN_ALL' and value.get('head')==CANDIDATE and value.get('exitCode')==0 and value.get('error')=='Physical measurement failed; no estimate or replay' and value.get('diskGrowth',{}).get('afterAllocations') is None and value.get('neverRetry') is True,'Prior 180000 failure must remain failed and unqualified')

def missing_snapshot_measurement_paths(stage,attempt,exit_code,stderr):
    require(stage=='after' and type(attempt) is int and attempt==1 and type(exit_code) is int and exit_code==1,'Only one prospective additional post-build measurement is allowed')
    require(isinstance(stderr,str) and 0<len(stderr.encode())<=65536,'Complete bounded measurement error required')
    lines=stderr.splitlines();require(1<=len(lines)<=32,'Missing snapshot diagnostics incomplete or excessive')
    paths=[]
    for line in lines:
        match=re.fullmatch(r"du: cannot access '(/var/lib/containerd/io\.containerd\.snapshotter\.v1\.overlayfs/snapshots/[1-9][0-9]{0,15})': No such file or directory",line)
        require(match is not None,'Foreign or ambiguous measurement failure remains fatal')
        paths.append(match[1])
    require(len(paths)==len(set(paths)),'Duplicate missing snapshot diagnostic refuses')
    return paths

def parse_complete_allocation_rows(text,present,rows):
    require(isinstance(text,str) and len(text.encode())<=65536 and text.endswith('\n'),'Complete bounded allocation output required')
    seen=set();result={p:dict(v) for p,v in rows.items()}
    for line in text.splitlines():
        fields=line.split('\t');require(len(fields)==2 and re.fullmatch(r'0|[1-9][0-9]*',fields[0]) is not None,'Exact integer allocation row required')
        count,path=fields;require(path in present and path not in seen,'Unknown or duplicate allocation row')
        seen.add(path);result[path]['bytes']=int(count)
    require(seen==set(present),'Missing physical allocation row')
    return result
