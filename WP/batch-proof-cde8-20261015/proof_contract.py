"""Pure authority for a NEW stopped-copy installation/startup proof. No import I/O."""
import hashlib, json, pathlib, re

CANDIDATE='cde8c8896f5f9d5f1ab07b0ae16b1a765e0a6367'
TREE='638580d50f61254609de3abd42d93afc676a5727'
IMAGE='sha256:b5ab0a0a57aeec4fe24dd8095126f3502cbc0c8629a7f4c1ef9e55034893c6fb'
BUILD_ROOT='/opt/lims/releases/workflow-batch-build-cde8c889-20261015T010000Z'
BUILD_RECEIPT_SHA='c03ca0cd16395a451a12f1606655166f0dfe0b3f78516212034b548888c7a3fd'
BUILD_SOURCE='6608548a58dd4bf581da4330f1cd7b0f68a86973'
BUILD_PASS=6181452519
BUILD_EVIDENCE='b1d68199ec356d744950f801515874e6a7096474'
PREDECESSOR='959d17e11c357266f7c2a41b0c84ab76914c591e'
PREDECESSOR_IMAGE='sha256:7aebc035254a61b0b4b8ecb59492d582af7f3769c147a35a7e92a43fb7a642d2'
PREDECESSOR_ID='8109d78e228573ead8aa243442192e54b8e1dc09101bc3fa23d03e5a29cbb66b'
LIVE_DATA='/var/lib/docker/volumes/lims_lims-data/_data'
LIVE_ASSETS='/var/lib/docker/volumes/lims_lims-assets/_data'
ROOT_NAME='workflow-batch-stopped-copy-cde8c889-20261015T023000Z'
ROOT=pathlib.PurePosixPath('/opt/lims/releases')/ROOT_NAME
SCOPE='RAW_SNAPSHOT_AND_OWNED_STOPPED_COPY_INSTALLATION_JOBS_OFF_STARTUP_ONLY'
FILES=frozenset({'proof_contract.py','proof_files.py','proof_disk.py','proof_docker.py','proof_install.py','proof_startup.py','run_stopped_proof.py','prepare_proof.py','launch_proof.py','verify_proof_guards.py'})
MEMORY=805306368
FLOOR=10556150894
GROWTH_ABORT=500000000
UNIT_SECONDS=5400
READY_SECONDS=600
HEADROOM=60
UNIT_HEADROOM=600
CLI_SECONDS=600
MEASURE_SECONDS=120
LOG_RESERVE=4*1024**3
COPY_FACTOR=128
ASSET_FACTOR=3
FILE_LIMIT=200000
BYTE_LIMIT=32*1024**3
OUTPUT_LIMIT=64*1024**2
MAIN_CI=38636615469
AUDITS=[(295,6146939836,'1a0702b3be410ac1dcdd9dc92f0f0c3dd2774a3a','6d750914d8565acdd496767a7dd935811b5a89b2'),(296,6163165778,'5e0b32830f961b3236c7cf8f74cf8f676e98fbaa','2242bcb4861a7085bb95e78e0e7b1e4edf11d1b8'),(297,6178123314,'6bd516c42a07332d0b0653ed150d1526bf7e424e',CANDIDATE)]
CHAIN=[('206','install_sample_containers.js',{'SampleContainer','ContainerSequence'},'206_sample_containers'),('214','install_control_charts.js',{'ControlLimitProposal','ControlLimitSet','QcReviewObligation','QcReviewResolution'},'214_control_charts'),('209','install_order_revisions.js',set(),'209_order_revision_contract')]

def require(ok,message):
    if not ok:raise RuntimeError(message)
def sha(raw):return hashlib.sha256(raw).hexdigest()
def canonical(value):return json.dumps(value,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode()
def exact_json(raw):
    def pairs(items):
        out={}
        for k,v in items:require(k not in out,'Duplicate JSON key');out[k]=v
        return out
    return json.loads(raw,object_pairs_hook=pairs)
def first_line(body):return next((v.strip().strip('*_# ').rstrip('.') for v in body.splitlines() if v.strip()),'')
def exact_root(value):require(str(value)==str(ROOT),'Only the new reviewed root is allowed');return ROOT
def child_path(root,value):
    r,p=pathlib.Path(root).resolve(),pathlib.Path(value).resolve()
    require(r in p.parents and p!=r and not pathlib.Path(value).is_symlink(),'Only a distinct owned child is allowed')
    for q in [pathlib.Path(value),*pathlib.Path(value).parents]:require(not q.is_symlink(),'Path aliases refused')
    return p
def graph(index):
    require(re.fullmatch('[a-f0-9]{40}',index.get('head','')) and set(index.get('files',{}))==FILES,'Complete exact new source graph required')
    for n,r in index['files'].items():require(r.get('bytes',0)>0 and re.fullmatch('[a-f0-9]{64}',r.get('sha256','')) and re.fullmatch('[a-f0-9]{40}',r.get('blob','')),'Invalid source blob '+n)
    return {n:r['sha256'] for n,r in index['files'].items()}
def tokens(index):
    return [index['head'],CANDIDATE,TREE,IMAGE,PREDECESSOR,PREDECESSOR_IMAGE,PREDECESSOR_ID,BUILD_RECEIPT_SHA,
        'proofScope='+SCOPE,'proofRoot='+str(ROOT),'qualifiedBuildSource='+BUILD_SOURCE,'qualifiedBuildPass='+str(BUILD_PASS),
        'mainCiRun='+str(MAIN_CI),'labAndHubBuildsOwnedByYY=true','releaseWindowControl=RELEASE_DAY_DISK_ABORTS_ACCEPTED',
        'reserveFloorBytes='+str(FLOOR),'unexplainedGrowthAbortBytes='+str(GROWTH_ABORT),'memoryLimitBytes='+str(MEMORY),
        'unitTimeoutSeconds=5400','readinessSeconds=600','stageHeadroomSeconds=60','unitHeadroomSeconds=600',
        'rawMasterNeverOpenedSqlite=true','productionSqliteConnections=0','preserveAllStoppedContainers=true',
        'policyPresentNoOpOrStop=true','approvedAmendmentNonzeroStop=true','jobsOnQualificationStillRequired=true',
        'retainedDatabaseReserveMultiplier=128','retainedAssetReserveMultiplier=3','logReserveBytes='+str(LOG_RESERVE),
        'allocationMeasurementSeconds=120','allRetainedReleaseDockerContainerdAllocation=true',
        'policyPreflightMode=READONLY_DRY_RUN','ownedStopIndependentOfReserveHeadroom=true','allInputPathAncestorsRejectAliases=true',
        'diskMountPolicy=VERIFIED_DOCKER_OVERLAY_VIEWS_BACKED_BY_COUNTED_CONTAINERD',
        'physicalDuSingleFilesystem=true','containerMountComparison=EXACT_OBJECTS_UNORDERED_NO_DUPLICATES']+[n+'='+d for n,d in sorted(graph(index).items())]
def approval(review,index):
    require(review.get('id',0)>6181815795 and review.get('performed_via_github_app',{}).get('slug')=='claude','NEW actual Claudio source review required')
    require(review.get('html_url')=='https://github.com/yigini/soilfer-lims/issues/162#issuecomment-'+str(review['id']) and first_line(review.get('body',''))=='Source review: PASS','Final exact source PASS missing')
    require(review.get('created_at')==review.get('updated_at') and review['created_at']>'2026-10-15T00:51:20Z','Unedited fresh approval required')
    require(all(t in review['body'] for t in tokens(index)),'Review omitted exact graph or scope')
def current(main,ci,prs,verdicts,comments):
    require(main.get('object',{}).get('sha')==CANDIDATE,'Main changed')
    require(ci.get('id')==MAIN_CI and ci.get('head_sha')==CANDIDATE and ci.get('event')=='push' and ci.get('run_attempt')==1 and ci.get('status')=='completed' and ci.get('conclusion')=='success','Exact completed main CI required')
    for pr,id,head,merge in AUDITS:
        p,v=prs[str(pr)],verdicts[str(pr)]
        require(p.get('merged') is True and p.get('head',{}).get('sha')==head and p.get('merge_commit_sha')==merge,'Application merge identity changed')
        require(v.get('id')==id and v.get('performed_via_github_app',{}).get('slug')=='claude' and first_line(v.get('body','')).startswith('Audit passed: OK to merge and deploy') and head in v['body'],'Application approval changed')
        require(not any(c.get('created_at','')>v['created_at'] and 'audit failed' in c.get('body','').lower() for c in comments[str(pr)]),'Later application failure')
def no_later_failure(comments,review,index):
    require(not any(c.get('created_at','')>review['created_at'] and index['head'] in c.get('body','') and any(t in c.get('body','').lower() for t in ['source review: failed','source review: changes required','audit failed']) for c in comments),'Later source rejection')
def healthy_predecessor(obj):
    env=dict(s.split('=',1) for s in obj['Config'].get('Env',[]) if '=' in s);state=obj['State'];mounts={m['Destination']:m for m in obj['Mounts']}
    require(obj['Id']==PREDECESSOR_ID and obj['Name']=='/soilfer-lims' and obj['Image']==PREDECESSOR_IMAGE and obj['Config']['Labels']['org.opencontainers.image.revision']==PREDECESSOR,'Normal healthy predecessor identity differs')
    require(state['Running'] is True and state['Health']['Status']=='healthy' and not state['OOMKilled'] and obj['RestartCount']==0,'Predecessor not healthy')
    require(obj['HostConfig']['Memory']==MEMORY and obj['HostConfig']['MemorySwap']==1610612736,'Predecessor limits changed')
    require(all(env.get(k)==v for k,v in {'NODE_OPTIONS':'','ALLOW_PRISMA_DB_PUSH':'false','ALLOW_AUTO_SEED':'false','DISABLE_BACKGROUND_JOBS':'false','DATABASE_PATH':'/app/server/prisma/dev.db','DATABASE_URL':'file:/app/server/prisma/dev.db'}.items()),'Predecessor flags changed')
    for dst,name,src in [('/app/server/prisma','lims_lims-data',LIVE_DATA),('/app/server/uploads','lims_lims-assets',LIVE_ASSETS)]:
        m=mounts.get(dst,{})
        require(m.get('Type')=='volume' and m.get('Name')==name and m.get('Source')==src and m.get('RW') is True,'Predecessor volume changed')
    return {'status':'SAFE_SELECTED_DERIVED_INSPECTION_NOT_FULL_RAW','id':obj['Id'],'image':obj['Image'],'name':obj['Name'],'state':{k:state[k] for k in ['Running','OOMKilled','StartedAt']},'health':state['Health']['Status'],'restarts':obj['RestartCount'],'flags':{k:env[k] for k in ['NODE_OPTIONS','ALLOW_PRISMA_DB_PUSH','ALLOW_AUTO_SEED','DISABLE_BACKGROUND_JOBS']},'mounts':[mounts[d] for d in ['/app/server/prisma','/app/server/uploads']]}
def qualified(receipt,raw,inspect):
    require(sha(raw)==BUILD_RECEIPT_SHA and receipt.get('status')=='BUILT_AFTER_EXCLUDED_ACCOUNTING_FAILURE_NOT_PROVED_OR_DEPLOYED','Original qualified receipt differs')
    require(receipt.get('head')==CANDIDATE and receipt.get('tree')==TREE and receipt.get('image')==IMAGE and receipt.get('toolingCommit')==BUILD_SOURCE and receipt.get('sourceReviewId')==BUILD_PASS and receipt.get('exitCode')==0 and receipt.get('error') is None and receipt.get('newBuildCount')==1,'Build qualification binding differs')
    require(inspect.get('Id')==IMAGE and inspect.get('Size')==receipt['imageBytes']==414679214 and inspect['Config']['Labels'].get('org.opencontainers.image.revision')==CANDIDATE and inspect.get('Os')=='linux' and inspect.get('Architecture')=='amd64','Qualified image differs')
    require(all(r['unexplainedGrowthBytes']==0 for r in receipt['diskGrowth']['filesystems'].values()),'Build residual is not zero')
def plan(value,issue,mode):
    require(value.get('classification')==('PRE_'+issue if mode=='DRY_RUN' else 'COMPLETE_'+issue) and value.get('mode')==mode,'Installer mode/classification differs')
    require(value.get('backfilledCount')==0 and value.get('totalChanges')==(1 if mode=='APPLIED' else 0),'Installer wrote beyond one receipt or backfilled')
    if mode=='APPLIED':require(value.get('previousClassification')=='PRE_'+issue and value.get('receipt',{}).get('originalRowsPreserved') is True,'Original-row receipt missing')
def policy_gate(value):
    require(value.get('classification')=='PRESENT' and value.get('shape')=='CANONICAL' and value.get('mode')=='NO_OP' and value.get('totalChanges')==0 and value.get('dataWrites')==0 and value.get('readonlySnapshot',{}).get('originalFilesPreserved') is True,'POLICY_PRESENT_CANONICAL_NO_OP_OR_STOP')
def impact_gate(value):
    impact=value.get('impact',{})
    for n in ['prospectiveApprovedAmendmentSampleCount','invalidStoredAnalysisSampleCount','noActiveRevisionCount','noMatchingLineCount']:
        require(type(impact.get(n)) is int and impact[n]>=0,'Complete scientific impact missing '+n)
    require(isinstance(impact.get('invalidStoredAnalyses'),list) and len(impact['invalidStoredAnalyses'])==impact['invalidStoredAnalysisSampleCount'],'Invalid stored-analysis ID list missing')
    require(all(isinstance(r.get('sampleId'),str) and r['sampleId'] and isinstance(r.get('workItemIds'),list) and all(isinstance(id,str) and id for id in r['workItemIds']) for r in impact['invalidStoredAnalyses']),'Malformed-analysis sample/owner IDs missing')
    require(len(impact.get('approvedAmendmentSampleIds',[]))==impact['prospectiveApprovedAmendmentSampleCount'],'Approved-amendment IDs missing')
    require(impact['prospectiveApprovedAmendmentSampleCount']==0 and impact.get('approvedAmendmentKitGate')=='NO_APPROVED_AMENDMENT_REFUSALS','STOP_APPROVED_AMENDMENT_REMEDIATION_REQUIRED: show actual list to YY; separately Claudio-reviewed forward remedy only')
def reserve(database_bytes,asset_bytes):
    require(type(database_bytes) is int and type(asset_bytes) is int and database_bytes>0 and asset_bytes>=0,'Measured input allocation required')
    return FLOOR+COPY_FACTOR*database_bytes+ASSET_FACTOR*asset_bytes+LOG_RESERVE
