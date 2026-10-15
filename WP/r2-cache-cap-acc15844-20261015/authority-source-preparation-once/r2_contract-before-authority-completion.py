"""Closed R2 authority and selection predicates. Import has no side effects."""
import datetime, hashlib, json, pathlib, re

CANDIDATE='be8379745bdfae52ce46496ff26514dc7d729640'
TREE='676b01e71211786d1aeace50f19a0b2c9f9c482e'
MAIN_CI=38772398721
MAIN_CI_COMPLETED='2026-10-15T17:30:10Z'
IMAGE='sha256:acc158447f5571068bf150fc0e8fa6f0889aeb38f9aec8be08978d903bd5be6a'
BUILD_ROOT='/opt/lims/releases/workflow-batch-build-be837974-20261015T190000Z'
BUILD_RECEIPT_SHA='cd3a2757d8ecb0bf933f49231031eb7fb61eb5abaac17d05f3585c1baaf89f0a'
BUILD_AUDIT='5f86a1966af536f83a345ebdb02983bbe2a166ad'
BUILD_REL='WP/batch-build-stable-accounting-be837974-20261015/first-build-190000-closed-originals-once/'
ROOT='/opt/lims/cleanup-receipts/r2-cache-acc15844-20261015T210000Z'
UNIT='lims-r2-cache-acc15844-20261015t210000z'
SCOPE='R2_EXACT_CACHE_IDS_ONLY_AFTER_QUALIFIED190000_BUILD'
SOURCE_FILES=frozenset({'r2_contract.py','r2_cache.py','prepare_r2.py','launch_r2.py','verify_r2.py'})
CAP=5000000000
FLOOR=10556150894
LOG_RESERVE=1073741824
MEMORY=805306368
RUN_SECONDS=1800
UNIT_SECONDS=2400
MAX_ITEMS=32
MAX_RECORDS=4096
MAX_CONTAINERS=256
MAX_IMAGES=1024
API_CALL_LIMIT=12000
RAW_LIMIT=32*1024**2
TOTAL_LOG_LIMIT=512*1024**2
AUDITS=[] # Populated from the unchanged, previously published authority below.
RULE_AUTHORITY_PINS={}

def require(ok,message):
    if not ok:raise RuntimeError(message)
def canonical(v):return json.dumps(v,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode()
def sha(v):return hashlib.sha256(v).hexdigest()
def oid(v):return hashlib.sha1(('blob '+str(len(v))+'\0').encode()+v).hexdigest()
def json_exact(raw):
    def pairs(items):
        d={}
        for k,v in items:require(k not in d,'Duplicate JSON key');d[k]=v
        return d
    return json.loads(raw,object_pairs_hook=pairs)
def first_line(body):return next((v.strip().strip('*_# ').rstrip('.') for v in body.splitlines() if v.strip()),'')
def cache_id(value):
    require(type(value) is str and re.fullmatch('[a-z0-9]{25}',value) is not None,'Malformed full cache ID')
    return value
def integer(value):
    require(type(value) is int and 0<=value<2**63,'Exact nonnegative integer required');return value
def graph(index):
    require(re.fullmatch('[a-f0-9]{40}',index.get('head','')) is not None,'Exact source commit required')
    require(set(index.get('files',{}))==SOURCE_FILES,'Incomplete closed R2 source graph')
    for n,r in index['files'].items():
        require(type(r.get('bytes')) is int and r['bytes']>0 and re.fullmatch('[a-f0-9]{64}',r.get('sha256','')) and re.fullmatch('[a-f0-9]{40}',r.get('blob','')),'Invalid source identity '+n)
    return {n:r['sha256'] for n,r in index['files'].items()}
def review_tokens(head,index):
    files=graph(index);require(head==index['head'],'Source head differs')
    return [head,CANDIDATE,TREE,IMAGE,'qualifiedBuildReceiptSha256='+BUILD_RECEIPT_SHA,'qualifiedBuildAudit='+BUILD_AUDIT,
        'r2Scope='+SCOPE,'r2Root='+ROOT,'r2Unit='+UNIT,'actualMaxUsedSpaceBytes='+str(CAP),'reservedSpaceIsNotACap=true',
        'inUseAndImageSharedAlwaysProtectedEvenAboveCap=true','exactAnchoredIdAndSharedFalseAndInuseFalseFilters=true',
        'maximumPruneInvocations='+str(MAX_ITEMS),'controllerSeconds='+str(RUN_SECONDS),'unitSeconds='+str(UNIT_SECONDS),
        'memoryMaxBytes='+str(MEMORY),'memorySwapMaxBytes=0','noDaemonConfigOrRestart=true','noBlanketPrune=true',
        'noImageContainerVolumeBackupProofFileRemoval=true','immutablePerItemReceiptAndDfBeforeAfter=true',
        'unknownOutcomeNeverRetry=true','sameBuilderDockerDriverDefaultUnixEndpoint=true','logicalCacheBytesNotPhysicalReclaim=true',
        'allChangedOrProtectedItemsSkipNoSubstitution=true','labAndHubBuildsOwnedByYY=true','releaseWindowControl=RELEASE_DAY_DISK_ABORTS_ACCEPTED']+[
        'authority'+i+'='+pin for i,pin in sorted(RULE_AUTHORITY_PINS.items())]+[n+'='+d for n,d in sorted(files.items())]
def validate_source_review(v,head,index):
    require(type(v.get('id')) is int and v['id']>6200455534 and v.get('html_url')=='https://github.com/yigini/soilfer-lims/issues/162#issuecomment-'+str(v['id']),'NEW R2 source review required')
    app=v.get('performed_via_github_app') or {}
    require(app.get('id')==1236702 and app.get('slug')=='claude' and v.get('created_at')==v.get('updated_at'),'Unedited actual Claude-app review required')
    require(first_line(v.get('body',''))=='Source review: PASS' and all(t in v['body'] for t in review_tokens(head,index)),'Incomplete exact R2 source PASS')
def no_later_source_failure(comments,review,head):
    for c in comments:
        if c.get('created_at','')>review['created_at'] and head in c.get('body','') and any(t in c['body'].lower() for t in ['source review: failed','source review: changes required','audit failed']):raise RuntimeError('Later source findings require inspection')
def validate_build(raw,inspection):
    require(sha(raw)==BUILD_RECEIPT_SHA,'Only actual successful190000 build receipt accepted')
    v=json_exact(raw)
    require(v.get('status')=='NEW_STARTUP_APP_IMAGE_BUILT_NOT_PROVED_OR_DEPLOYED' and v.get('image')==IMAGE and v.get('head')==CANDIDATE and v.get('tree')==TREE and v.get('exitCode')==0 and v.get('error') is None and v.get('newBuildCount')==1,'Qualified build binding differs')
    require(v.get('imageInspectSha256')==sha(inspection),'Original entire image inspection differs')
    rows=json_exact(inspection);require(type(rows) is list and len(rows)==1 and rows[0].get('Id')==IMAGE and rows[0].get('Size')==414683521,'Qualified image differs')
    return rows[0]
def cache_rows(raw):
    require(type(raw) is list and len(raw)<=MAX_RECORDS,'Bounded complete cache array required')
    result={}
    for row in raw:
        require(type(row) is dict,'Malformed cache row');ident=cache_id(row.get('ID'))
        require(ident not in result,'Duplicate cache ID')
        require(type(row.get('InUse')) is bool and type(row.get('Shared')) is bool,'Exact protection booleans required')
        require(not ('Parents' in row and ' Parents' in row),'Ambiguous parent aliases')
        p=row.get('Parents',row.get(' Parents',[]));require(type(p) is list and len(p)<=MAX_RECORDS,'Parent array required')
        for parent in p:cache_id(parent)
        require(len(p)==len(set(p)) and ident not in p,'Duplicate/self parent refused')
        for field in ['CreatedAt','LastUsedAt']:
            require(type(row.get(field)) is str and re.fullmatch(r'\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,9})?Z',row[field]),'Exact cache timestamp required')
        result[ident]={'ID':ident,'InUse':row['InUse'],'Shared':row['Shared'],'Size':integer(row.get('Size')),'Parents':sorted(p),
            'CreatedAt':row['CreatedAt'],'LastUsedAt':row['LastUsedAt'],'Type':row.get('Type'),'UsageCount':integer(row.get('UsageCount'))}
    # Iterative topological elimination: reject cycles without recursive stack risk.
    pending=set(result)
    while pending:
        leaves={i for i in pending if not any(i in result[c]['Parents'] for c in pending)}
        require(leaves,'Cyclic cache graph');pending-=leaves
    return result
def protected(row):return row['InUse'] or row['Shared']
def logical_bytes(rows):return sum(r['Size'] for r in rows.values())
def plan(rows):
    pending={i for i,r in rows.items() if not protected(r)};chosen=[]
    while pending and len(chosen)<MAX_ITEMS:
        leaves=[i for i in pending if not any(i in r['Parents'] for c,r in rows.items() if c not in chosen)]
        if not leaves:break # A protected/outside child keeps its ancestors, too.
        ident=min(leaves,key=lambda i:(rows[i]['LastUsedAt'],i));chosen.append(ident);pending.remove(ident)
    return [dict(rows[i]) for i in chosen]
def eligible(wanted,rows):
    ident=wanted['ID'];current=rows.get(ident)
    if current is None:return 'ID absent'
    if protected(current):return 'In-use or image-shared'
    if current!=wanted:return 'Cache identity/usage/size/parents changed'
    if any(ident in r['Parents'] for r in rows.values()):return 'Child still references this record'
    return None
def du_guard(rows,wanted):
    require(type(rows) is list and len(rows)==1 and rows[0].get('ID')==wanted['ID'],'Exact one-ID du required')
    r=rows[0];require(r.get('Shared') is False and r.get('Reclaimable') is True,'Buildx protection differs')
    require(str(r.get('Size'))==str(wanted['Size']) and sorted(r.get('Parents',[]))==wanted['Parents'] and r.get('CreatedAt')==wanted['CreatedAt'] and r.get('LastUsedAt')==wanted['LastUsedAt'],'Buildx/API identity differs')
def prune_argv(ident):
    cache_id(ident)
    return ['docker','buildx','--builder','default','prune','--force','--all','--verbose','--max-used-space='+str(CAP),
        '--filter','id=^'+ident+'$','--filter','shared=false','--filter','inuse=false']
def removal_guard(before,after,ident,stdout):
    removed=set(before)-set(after);reported=re.findall(r'^ID:\s+(\S+)\s*$',stdout,re.M)
    require(len(reported)==len(set(reported)) and set(reported)<=set([ident]) and removed<=set([ident]),'Outside-ID removal or report; STOP')
    for i,r in before.items():
        if protected(r):require(i in after and after[i]['Size']==r['Size'],'Protected cache vanished/changed during operation')
    require(set(reported)==removed,'Prune report and actual inventory disagree')
    return sorted(removed)
def validate_df(rows):
    require(set(rows)=={'/opt/lims','/var/lib/docker','/var/lib/containerd'},'Complete filesystem checks required')
    require(len({r['device'] for r in rows.values()})==1,'Unexpected filesystem topology')
    for p,r in rows.items():require(r['realpath']==p and r['block']==4096 and integer(r['available'])>=FLOOR+LOG_RESERVE,'Aliased path/block/space floor refused')
    return rows

def validate_package(spec,index,review,files):
    validate_source_review(review,index['head'],index)
    require(spec.get('scope')==SCOPE and spec.get('root')==ROOT and spec.get('unit')==UNIT and spec.get('sourceHead')==index['head'] and spec.get('sourceReviewId')==review['id'],'Exact reviewed R2 package binding required')
    require(spec.get('maxUsedSpaceBytes')==CAP and spec.get('maximumPruneInvocations')==MAX_ITEMS and spec.get('buildImage')==IMAGE and spec.get('qualifiedBuildReceiptSha256')==BUILD_RECEIPT_SHA and spec.get('retryAllowed') is False,'R2 bounds changed')
    require(spec.get('labAndHubBuildsOwnedByYY') is True and spec.get('releaseWindowControl')=='RELEASE_DAY_DISK_ABORTS_ACCEPTED','Both YY pins required')
    expected=SOURCE_FILES|{'qualified-build-receipt.json','qualified-image-inspect.json','source-index.json','source-review.json','main-original.json','main-ci-original.json','coordination-history.json'}|{'authority-'+i+'-original.json' for i in RULE_AUTHORITY_PINS}|{'pr'+str(a['pr'])+'-'+suffix+'.json' for a in AUDITS for suffix in ['original','actual-pass','comments']}
    require(set(spec.get('files',{}))==expected and set(files)==expected|{'package-input.json'},'Exact complete package inventory required')
    for n,r in spec['files'].items():require(len(files[n])==r['bytes'] and sha(files[n])==r['sha256'],'Package byte binding differs '+n)
    for n,r in index['files'].items():require(len(files[n])==r['bytes'] and sha(files[n])==r['sha256'] and oid(files[n])==r['blob'],'Raw source identity differs '+n)
    validate_build(files['qualified-build-receipt.json'],files['qualified-image-inspect.json']);validate_rule_authorities(files)
    validate_current(json_exact(files['main-original.json']),json_exact(files['main-ci-original.json']),
        {str(a['pr']):json_exact(files['pr'+str(a['pr'])+'-original.json']) for a in AUDITS},
        {str(a['pr']):json_exact(files['pr'+str(a['pr'])+'-actual-pass.json']) for a in AUDITS},
        {str(a['pr']):json_exact(files['pr'+str(a['pr'])+'-comments.json']) for a in AUDITS})
    no_later_source_failure(json_exact(files['coordination-history.json']),review,index['head'])
