"""Pure authority for a NEW stopped-copy installation/startup proof. No import I/O."""
import hashlib, json, pathlib, re
from proof_budget import TABLE,TABLE_SHA,TOTAL_DB_COPIES,DB_EQUIVALENTS,MARGIN_PERCENT,MINIMUM_DB_EQUIVALENTS,REFERENCE_DB_BYTES,REFERENCE_ASSET_BYTES,declared_budget

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
ROOT_NAME='workflow-batch-startup-forward-cde8c889-20261015T100000Z'
ROOT=pathlib.PurePosixPath('/opt/lims/releases')/ROOT_NAME
SCOPE='BOUND_080000_INSTALLED209_TWO_NEW_JOBS_OFF_STARTUPS_ONLY'
FILES=frozenset({'proof_budget.py', 'proof_disk.py', 'launch_proof.py', 'proof_health.py', 'proof_startup.py', 'proof_inputs.py', 'run_stopped_proof.py', 'verify_proof_guards.py', 'prepare_proof.py', 'proof_files.py', 'proof_docker.py', 'proof_contract.py'})
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
ASSET_FACTOR=3
FILE_LIMIT=200000
BYTE_LIMIT=32*1024**3
OUTPUT_LIMIT=64*1024**2
MAIN_CI=38636615469
AUDITS=[(295,6146939836,'1a0702b3be410ac1dcdd9dc92f0f0c3dd2774a3a','6d750914d8565acdd496767a7dd935811b5a89b2'),(296,6163165778,'5e0b32830f961b3236c7cf8f74cf8f676e98fbaa','2242bcb4861a7085bb95e78e0e7b1e4edf11d1b8'),(297,6178123314,'6bd516c42a07332d0b0653ed150d1526bf7e424e',CANDIDATE)]
CHAIN=[]

FORWARD_DIRECTION=6188190365
PRIOR_EVIDENCE='dd496777400e9c2f4f0ace73009f8cf8c86022d0'
PRIOR_ROOT=pathlib.PurePosixPath('/opt/lims/releases/workflow-batch-stopped-copy-cde8c889-20261015T080000Z')
PRIOR_RAW_DATA=str(PRIOR_ROOT/'installed-209/raw')
PRIOR_BACKUP=str(PRIOR_ROOT/'installed-209/backup.db')
PRIOR_RAW_ASSETS='/opt/lims/releases/workflow-batch-stopped-copy-cde8c889-20261015T070000Z/raw-production-assets'
PRIOR_FILES={'prior-closed-retention.json': {'path': 'WP/batch-proof-forward-resume-cde8-20261015/first-proof-080000-closed-readiness-stop/closed-retention-record.json', 'bytes': 1835061, 'sha256': '6787b8fff691b49456d56a8ae821a6012e2405d954af50f8a605f43345e0e8f3', 'blob': 'feb11c705d5f679715df16d5a10d3f008130307c'}, 'prior-proof-terminal-refusal.json': {'path': 'WP/batch-proof-forward-resume-cde8-20261015/first-proof-080000-closed-readiness-stop/remote-originals/proof-terminal-refusal.json', 'bytes': 417, 'sha256': '0b1f42c3be281c72d49bc4fa253a1350c0209ef86402691f727b021f44e32ed7', 'blob': '32012a7c6e747f84ded9ff7f11c9a11ada03187c'}, 'prior-proof-input.json': {'path': 'WP/batch-proof-forward-resume-cde8-20261015/first-proof-080000-closed-readiness-stop/remote-originals/proof-input.json', 'bytes': 5962, 'sha256': '93cfc115a11664d59653c42aa8bd98bc5476a6ac056390a7c46bdba414476b77', 'blob': 'aed162b7302dee5ebaf1cb5c9fa953fc0a0c7c78'}, 'prior-tooling-source-index.json': {'path': 'WP/batch-proof-forward-resume-cde8-20261015/first-proof-080000-closed-readiness-stop/remote-originals/tooling-source-index.json', 'bytes': 1989, 'sha256': '5dc3a18ab29d38316ab9036e46ebbb000037a0a1762fd33201fed4eefa38bdae', 'blob': 'fcf2559447f1458ff232cb3ecaa6091b0f2c2ba5'}, 'prior-source-review-original.json': {'path': 'WP/batch-proof-forward-resume-cde8-20261015/first-proof-080000-closed-readiness-stop/remote-originals/source-review-original.json', 'bytes': 13071, 'sha256': '49aebd26e81b7efb61dc810b0db11cc043b3ad60b57ce9fc8385589eff8418ca', 'blob': 'f6e9505960936e43a6569f0717f02b34ff863034'}, 'prior-installed-209--seal.json': {'path': 'WP/batch-proof-forward-resume-cde8-20261015/first-proof-080000-closed-readiness-stop/remote-originals/installed-209/seal.json', 'bytes': 723, 'sha256': '596e52e63e7e6fd94f721ac98430e615bb5533890821ccb75c040a31db4721e0', 'blob': '56b92328a252577480724ae7f96ee49439df27eb'}, 'prior-installed-209--logical-state.json': {'path': 'WP/batch-proof-forward-resume-cde8-20261015/first-proof-080000-closed-readiness-stop/remote-originals/installed-209/logical-state.json', 'bytes': 336650, 'sha256': 'dc3ddf079eba24a49dcfd8e5d52bdf6332e13fb23db801a0446beb63547d0565', 'blob': '30f5a5dc7ccf5d10ed1043f82eb79ee5f621d028'}, 'prior-installed-209--raw--copy-authority.json': {'path': 'WP/batch-proof-forward-resume-cde8-20261015/first-proof-080000-closed-readiness-stop/remote-originals/installed-209/raw/copy-authority.json', 'bytes': 306, 'sha256': '620d42091c9aaba58fcb3f7f19db2d62b1f4822c8b9317224d81663403a68cab', 'blob': '4a58ddd009dfa31ef5fac0b2c6eabc0f76e5a30b'}, 'prior-installed-209--reader--copy-authority.json': {'path': 'WP/batch-proof-forward-resume-cde8-20261015/first-proof-080000-closed-readiness-stop/remote-originals/installed-209/reader/copy-authority.json', 'bytes': 306, 'sha256': '66f4ee6e0e0cedd7190231183e01748577696612c4684aad3f5a046f48e3a45d', 'blob': '66d5b60b3354d8d8faaf10e72b54b8286a0ef8c3'}, 'prior-preservation-214.json': {'path': 'WP/batch-proof-forward-resume-cde8-20261015/first-proof-080000-closed-readiness-stop/remote-originals/preservation-214.json', 'bytes': 299, 'sha256': 'f6876b66b608bdf17ce16f5bc7f590ebf14cc2e1f7d66aef89761732d1221776', 'blob': 'e5eb5711acbd1e4a389c4e2c241b136c70f06e3c'}, 'prior-preservation-209.json': {'path': 'WP/batch-proof-forward-resume-cde8-20261015/first-proof-080000-closed-readiness-stop/remote-originals/preservation-209.json', 'bytes': 226, 'sha256': 'aee36e8715cda6498af2fbe1b6f7f5a650d46bdbef2cfff30c2e47f7f5364956', 'blob': '6438398f0b67430ec439f761d620b04b91a647da'}, 'prior-stage-214.json': {'path': 'WP/batch-proof-forward-resume-cde8-20261015/first-proof-080000-closed-readiness-stop/remote-originals/stage-214.json', 'bytes': 3446, 'sha256': '21c0d8dcc5507416ffe89108d9b5bb3f2119d9a92706c4d0f1136625a12b927a', 'blob': 'e3890c1846bb022acf275bdfcf988f4804f37252'}, 'prior-stage-209.json': {'path': 'WP/batch-proof-forward-resume-cde8-20261015/first-proof-080000-closed-readiness-stop/remote-originals/stage-209.json', 'bytes': 6145, 'sha256': '0212cfdd6d835a91d1008b5ad68f13fdfec370aea0527305c2f9b4ab3d74e3fb', 'blob': '6c5ac4fad000a8fca1e5ceff82228a33ec4f156a'}, 'prior-installation-result.json': {'path': 'WP/batch-proof-forward-resume-cde8-20261015/first-proof-080000-closed-readiness-stop/remote-originals/installation-result.json', 'bytes': 9778, 'sha256': '3101a3c716bfb6f151aa25ada7bd0f2c28806075c65d8f0c3463e89168ae119e', 'blob': 'f5c8f71d4ec308efa2051885c05ee926c56c4b91'}, 'prior-actual-chart-impact.json': {'path': 'WP/batch-proof-forward-resume-cde8-20261015/first-proof-080000-closed-readiness-stop/remote-originals/actual-chart-impact.json', 'bytes': 1910004, 'sha256': '54a32e163f3d86e4866b81d149fe3d424d674ff2c47109e2b2075b4cd6965eed', 'blob': 'bd660134197b757335ab82ea935d9b0c7a737abb'}, 'prior-actual-order-impact.json': {'path': 'WP/batch-proof-forward-resume-cde8-20261015/first-proof-080000-closed-readiness-stop/remote-originals/actual-order-impact.json', 'bytes': 4039, 'sha256': '7d447330484a85158a3f7fadd984f6ed0b4af98c2717562233903f3e6710bcb2', 'blob': '7642f540d0f5ebec80075a9ea00200ec81f9fe36'}, 'prior-assets-snapshot-handoff.json': {'path': 'WP/batch-proof-forward-resume-cde8-20261015/first-proof-080000-closed-readiness-stop/remote-originals/prior-assets-snapshot-handoff.json', 'bytes': 310931, 'sha256': '74dfd0c4536e9f5a8100d75087bcdf79c558ae17d516d729350708371b74da6d', 'blob': '9d0323f3cb7177adcfe42148ed44c029fd7491b6'}, 'prior-fresh-actual-baseline.json': {'path': 'WP/batch-proof-forward-resume-cde8-20261015/first-proof-080000-closed-readiness-stop/remote-originals/prior-fresh-actual-baseline.json', 'bytes': 436, 'sha256': 'f58a2bdaba6873dd7c8f214473e53453ea0fbe932d5a20864a2d456f9549fb02', 'blob': '41f64fce2ee3c7d046a6aa1afcd3bea5d5867b5e'}, 'prior-carried-forward-inputs.json': {'path': 'WP/batch-proof-forward-resume-cde8-20261015/first-proof-080000-closed-readiness-stop/remote-originals/carried-forward-inputs.json', 'bytes': 1095, 'sha256': 'a83aaed18573d20b7aeb24c626b2b89b70fce35edab05a53146e7c17ce53e134', 'blob': 'd71fbf4d16c1d8eb67968f579d42505b14a016a6'}, 'prior-policy-result.json': {'path': 'WP/batch-proof-forward-resume-cde8-20261015/first-proof-080000-closed-readiness-stop/remote-originals/prior-policy-result.json', 'bytes': 478, 'sha256': '826053a061d53db4d446205cd45f0670f266b009ef2b288e562d1fff23648f1d', 'blob': '81dba60f20e88ddeb421012fe207e88be4bfe576'}}
COMPOSE_PIN={'path': 'docker-compose.yml', 'bytes': 1214, 'sha256': '2c540b13af52ada8cf475ad8aed19757deafd2997bf1e60fc63848d6e5153226', 'blob': '4e5bfd31f6c0bcc52419f0a55f7f6edbb8f85eec'}
PRIOR_FILES_SHA=hashlib.sha256(json.dumps(PRIOR_FILES,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode()).hexdigest()

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
        'declaredDbTripleCopies='+str(TOTAL_DB_COPIES),'dbBudgetEquivalents='+str(DB_EQUIVALENTS),'budgetMarginPercent='+str(MARGIN_PERCENT),
        'minimumDbBudgetEquivalents='+str(MINIMUM_DB_EQUIVALENTS),'forwardDirection='+str(FORWARD_DIRECTION),'priorEvidenceCommit='+PRIOR_EVIDENCE,'priorProofRoot='+str(PRIOR_ROOT),'priorEvidenceIndexSha256='+PRIOR_FILES_SHA,'startupOnlyInstalled209Inputs=true','noInstallerOrPolicyReplay=true','priorInstalled209Backup='+PRIOR_BACKUP,'deriveHealthcheckFromPinnedCompose=true','healthTestRepresentation=COMPOSE_EXEC_ARGV_DERIVED_DOCKER_CLI_CMD_SHELL_EXEC','ordinaryFullStartupVerifierChain=true','exactDerivedDockerHealthcheckBeforeStart=true','unhealthyIsRetainedObservation=true','healthEveryPollFullLog0400=true','healthTransitionTimingInResult=true','composeStartPeriodUnchanged=true','allHttpProbesWithinTotal600Seconds=true','composeSourceSha256='+COMPOSE_PIN['sha256'],'composeSourceBlob='+COMPOSE_PIN['blob'],'noNewProductionSnapshot=true','inputLogicalStateFromBoundRecordsNoSql=true','budgetMinimum64DroppedForStartupOnlyGraph=true','budgetStageTableSha256='+TABLE_SHA,
        'budgetModel=DECLARED_STAGE_REMAINING_CONSUMPTION_AWARE','capacityDirection=6183215126','noopSealDirection=6183663456',
        'metadataCapacityBeforeRootAndBeforeUnit=true','allLocalExecutedSourceFilesBound=true','containerNameAbsenceProof=BOUNDED_COMPLETE_ID_AND_EXACT_NAME_INVENTORY','containerNameProbeRawIdsRetained=true','mandatoryKnownPredecessorInInventory=true','noErrorTextAbsenceInference=true',
        'snapshotBoundaryDirection=6184356993','inputAuthority=BOUND_080000_INSTALLED209_RECORDED_SEAL_HASH_STAT_ONLY','inputRechecksAfterEachCopyAndAtClosure=true','liveEvolutionObservation=STAT_ONLY_NEVER_SNAPSHOT_AUTHORITY','databaseAssetsCrossFileAtomicityClaimed=false','budgetCheckpointCgroupAnonFileRecorded=true',
        'referenceDbReserveBytes='+str(REFERENCE_DB_BYTES),'referenceAssetReserveBytes='+str(REFERENCE_ASSET_BYTES),
        'retainedAssetReserveMultiplier=3','logReserveBytes='+str(LOG_RESERVE),
        'allocationMeasurementSeconds=120','allRetainedReleaseDockerContainerdAllocation=true',
        'ownedStopIndependentOfReserveHeadroom=true','allInputPathAncestorsRejectAliases=true',
        'diskMountPolicy=VERIFIED_DOCKER_OVERLAY_VIEWS_BACKED_BY_COUNTED_CONTAINERD',
        'physicalDuSingleFilesystem=true','containerMountComparison=EXACT_OBJECTS_UNORDERED_NO_DUPLICATES']+[n+'='+d for n,d in sorted(graph(index).items())]
def approval(review,index):
    require(review.get('id',0)>6188190365 and review.get('performed_via_github_app',{}).get('slug')=='claude','NEW actual Claudio source review required')
    require(review.get('html_url')=='https://github.com/yigini/soilfer-lims/issues/162#issuecomment-'+str(review['id']) and first_line(review.get('body',''))=='Source review: PASS','Final exact source PASS missing')
    require(review.get('created_at')==review.get('updated_at') and review['created_at']>'2026-10-15T08:47:44Z','Unedited fresh approval required')
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
    require(type(value.get('backfilledCount')) is int and value['backfilledCount']==0 and type(value.get('totalChanges')) is int and value['totalChanges']==(1 if mode=='APPLIED' else 0),'Installer wrote beyond one receipt or backfilled')
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
    return declared_budget(database_bytes,asset_bytes)
