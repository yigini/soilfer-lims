"""Pure build-only authority. Importing performs no filesystem, network or Docker I/O."""
import datetime, hashlib, json, pathlib, re

CANDIDATE='cde8c8896f5f9d5f1ab07b0ae16b1a765e0a6367'
TREE='638580d50f61254609de3abd42d93afc676a5727'
MAIN_CI=38636615469
MAIN_CI_COMPLETED='2026-10-14T21:34:24Z'
SOURCE_FILES=frozenset({'batch_build_contract.py','batch_build.py','prepare_batch_build.py','launch_batch_build.py','verify_build_guards.py'})
SCOPE='BUILD_ONLY_NO_DATABASE_CONNECTION_OR_VOLUME'
FLOOR=10556150894
BUILD_ALLOCATION=4*1024**3
BUILD_TIMEOUT=2400
UNIT_TIMEOUT=2700
UNEXPLAINED_GROWTH_ABORT=500000000
GROWTH_POLICY='OWNED_BUILD_ROOT_AND_DISJOINT_DOCKER_ALLOCATIONS'
FIRST_BUILD_ROOT_NAME='workflow-batch-build-cde8c889-20261014T221500Z'
AUDITS=[{'issue':206,'pr':295,'source':'1a0702b3be410ac1dcdd9dc92f0f0c3dd2774a3a','merge':'6d750914d8565acdd496767a7dd935811b5a89b2','comment':6146939836},
    {'issue':214,'pr':296,'source':'5e0b32830f961b3236c7cf8f74cf8f676e98fbaa','merge':'2242bcb4861a7085bb95e78e0e7b1e4edf11d1b8','comment':6163165778},
    {'issue':209,'pr':297,'source':'6bd516c42a07332d0b0653ed150d1526bf7e424e','merge':CANDIDATE,'comment':6178123314}]
PREDECESSOR='959d17e11c357266f7c2a41b0c84ab76914c591e'
PREDECESSOR_IMAGE='sha256:7aebc035254a61b0b4b8ecb59492d582af7f3769c147a35a7e92a43fb7a642d2'
PREDECESSOR_RECEIPT='03e3309714cadd956e13e9b34576ed774f1e56c482fdc2b07a828a52c1fcb953'
REQUIRED_ARTIFACTS=SOURCE_FILES|{'build-input.json','tooling-source-index.json','source-review-original.json','source.tar.gz','source-index.json','main-original.json','main-ci-original.json'}|{f'pr{a["pr"]}-{k}.json' for a in AUDITS for k in ['original','actual-pass-original','comments-original']}

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
    require(isinstance(name,str) and re.fullmatch(r'workflow-batch-build-cde8c889-\d{8}T\d{6}Z',name),'Wrong new build namespace')
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
        'originalBatchBuildRoot='+str(safe_build_root(FIRST_BUILD_ROOT_NAME))]+[n+'='+d for n,d in sorted(files.items())]
def validate_source_review(value,tooling,index):
    require(type(value.get('id')) is int and value['id']>6178123314,'A NEW build-source approval is required')
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
    validate_source_review(review,index['head'],index)
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
