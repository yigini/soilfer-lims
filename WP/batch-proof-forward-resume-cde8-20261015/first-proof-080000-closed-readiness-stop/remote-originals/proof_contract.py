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
ROOT_NAME='workflow-batch-stopped-copy-cde8c889-20261015T080000Z'
ROOT=pathlib.PurePosixPath('/opt/lims/releases')/ROOT_NAME
SCOPE='BOUND_070000_RAW206_FORWARD_214_209_JOBS_OFF_STARTUP_ONLY'
FILES=frozenset({'proof_budget.py','proof_contract.py','proof_files.py','proof_disk.py','proof_docker.py','proof_install.py','proof_startup.py','run_stopped_proof.py','prepare_proof.py','launch_proof.py','verify_proof_guards.py','proof_resume.py'})
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
CHAIN=[('214','install_control_charts.js',{'ControlLimitProposal','ControlLimitSet','QcReviewObligation','QcReviewResolution'},'214_control_charts'),('209','install_order_revisions.js',set(),'209_order_revision_contract')]

FORWARD_DIRECTION=6184928681
PRIOR_EVIDENCE='e283e6a8747598c1d5d447059c879042f5c3377e'
PRIOR_ROOT=pathlib.PurePosixPath('/opt/lims/releases/workflow-batch-stopped-copy-cde8c889-20261015T070000Z')
PRIOR_RAW_DATA=str(PRIOR_ROOT/'installed-206/raw')
PRIOR_RAW_ASSETS=str(PRIOR_ROOT/'raw-production-assets')
PRIOR_FILES={'prior-closed-retention.json': {'path': 'WP/batch-proof-snapshot-handoff-cde8-20261015/first-proof-070000-closed-repeat-identity-stop/closed-retention-record.json', 'bytes': 705544, 'sha256': '2d1367422b1c72021b87818b7bce10b19fc98d6bf37f3e5c35bb228c88d8a17f', 'blob': '8a7d14295c6d05f890bd4a62fcb8def0cc56f2ee'}, 'prior-proof-input.json': {'path': 'WP/batch-proof-snapshot-handoff-cde8-20261015/first-proof-070000-closed-repeat-identity-stop/remote-originals/proof-input.json', 'bytes': 3428, 'sha256': '9df45cb4f1985b90289f3347bfe65fd15ee461a8eaad2f72b1470f2d8bacc79c', 'blob': '77ddd5ee52d19117972ba89e012b17c51e761108'}, 'prior-source-review-original.json': {'path': 'WP/batch-proof-snapshot-handoff-cde8-20261015/first-proof-070000-closed-repeat-identity-stop/remote-originals/source-review-original.json', 'bytes': 11131, 'sha256': 'e8e3131c05f4f0510586ca812800551932a38cc350d440ec33d70f37ecca3170', 'blob': 'e16ebf5712e1a31a02ebcc98baecdcd319c3e5e3'}, 'prior-tooling-source-index.json': {'path': 'WP/batch-proof-snapshot-handoff-cde8-20261015/first-proof-070000-closed-repeat-identity-stop/remote-originals/tooling-source-index.json', 'bytes': 1830, 'sha256': 'fc96daa11615c9f0038bf91887aebdf6744489eee1c3bb6a01fb57504eea8f89', 'blob': '17d210527dd40c4d768ad0e6c7e46b3367884e0a'}, 'prior-proof-terminal-refusal.json': {'path': 'WP/batch-proof-snapshot-handoff-cde8-20261015/first-proof-070000-closed-repeat-identity-stop/remote-originals/proof-terminal-refusal.json', 'bytes': 409, 'sha256': '4601f42d33fe4cd6a7072b36aab39f362aeeabf8eef450a3f2fc3e86ad0cb12a', 'blob': 'e2efcb4b2581df960e9af0cef7d54a8469f07f0d'}, 'prior-fresh-actual-baseline.json': {'path': 'WP/batch-proof-snapshot-handoff-cde8-20261015/first-proof-070000-closed-repeat-identity-stop/remote-originals/fresh-actual-baseline.json', 'bytes': 436, 'sha256': 'f58a2bdaba6873dd7c8f214473e53453ea0fbe932d5a20864a2d456f9549fb02', 'blob': '41f64fce2ee3c7d046a6aa1afcd3bea5d5867b5e'}, 'prior-fresh-production-snapshot--seal.json': {'path': 'WP/batch-proof-snapshot-handoff-cde8-20261015/first-proof-070000-closed-repeat-identity-stop/remote-originals/fresh-production-snapshot/seal.json', 'bytes': 2894, 'sha256': '3a22e2a10c626bdd5fec32b27f210bc7e822e486d2721e1caa41d77dad647f0e', 'blob': 'cd0fcecbd57f26a09b75b33fb2924f4973be7d89'}, 'prior-fresh-production-snapshot--logical-state.json': {'path': 'WP/batch-proof-snapshot-handoff-cde8-20261015/first-proof-070000-closed-repeat-identity-stop/remote-originals/fresh-production-snapshot/logical-state.json', 'bytes': 317448, 'sha256': '0a8d72affc84abd6085a4ecd7ea7d38a93e13d328d80df5d2299be714aa23c7d', 'blob': 'ed34578f5670f4213650c95b2c0e032e473398b2'}, 'prior-fresh-production-snapshot--raw--snapshot-handoff.json': {'path': 'WP/batch-proof-snapshot-handoff-cde8-20261015/first-proof-070000-closed-repeat-identity-stop/remote-originals/fresh-production-snapshot/raw/snapshot-handoff.json', 'bytes': 1784, 'sha256': '8f09694705642d23fea511bfa701f1fe071b4d758c738d84a2cbd387478673f2', 'blob': '725b51701a78508b480cbba42a50df184dc98e76'}, 'prior-assets-snapshot-handoff.json': {'path': 'WP/batch-proof-snapshot-handoff-cde8-20261015/first-proof-070000-closed-repeat-identity-stop/remote-originals/assets-snapshot-handoff.json', 'bytes': 310931, 'sha256': '74dfd0c4536e9f5a8100d75087bcdf79c558ae17d516d729350708371b74da6d', 'blob': '9d0323f3cb7177adcfe42148ed44c029fd7491b6'}, 'prior-policy-result.json': {'path': 'WP/batch-proof-snapshot-handoff-cde8-20261015/first-proof-070000-closed-repeat-identity-stop/remote-originals/policy-result.json', 'bytes': 478, 'sha256': '826053a061d53db4d446205cd45f0670f266b009ef2b288e562d1fff23648f1d', 'blob': '81dba60f20e88ddeb421012fe207e88be4bfe576'}, 'prior-dry-206-byte-identity.json': {'path': 'WP/batch-proof-snapshot-handoff-cde8-20261015/first-proof-070000-closed-repeat-identity-stop/remote-originals/dry-206-byte-identity.json', 'bytes': 722, 'sha256': 'e950878e7a2ba8cd398f6c5800e882e324d1e22a6f95f2e70137c8383b1dec7d', 'blob': '24de3aa7a0a1dde75028f8174a13f16db6c49e86'}, 'prior-dry-206-run.stdout': {'path': 'WP/batch-proof-snapshot-handoff-cde8-20261015/first-proof-070000-closed-repeat-identity-stop/remote-originals/dry-206-run.stdout', 'bytes': 243, 'sha256': '6465c8c61eb85034df4d2f4a1432d7e1b23b6c9e01093896846b735c45414ce8', 'blob': 'ca0e4c6924feeac083a15a8ed4aa24953ea59165'}, 'prior-apply-206-run.stdout': {'path': 'WP/batch-proof-snapshot-handoff-cde8-20261015/first-proof-070000-closed-repeat-identity-stop/remote-originals/apply-206-run.stdout', 'bytes': 701, 'sha256': '1960e3c8e00da555e2d7a8ed8d633c22725377d5c5d85c8c657fe173659f7f5b', 'blob': '4c200125e09de781cbd5ea5d205bd711c5f07d42'}, 'prior-repeat-206-run.stdout': {'path': 'WP/batch-proof-snapshot-handoff-cde8-20261015/first-proof-070000-closed-repeat-identity-stop/remote-originals/repeat-206-run.stdout', 'bytes': 660, 'sha256': '3560fe69a742d0b8f5716d19a3f2f6c02964d38c7ebc44c08ae03b6def788b62', 'blob': 'f2ea5f72b8bf6f656e4a19356f6882164d495051'}, 'prior-preservation-206.json': {'path': 'WP/batch-proof-snapshot-handoff-cde8-20261015/first-proof-070000-closed-repeat-identity-stop/remote-originals/preservation-206.json', 'bytes': 219, 'sha256': '1c2643614a05173106ff3eeded1558ad45eedab2a2417aa568abe88fb8302370', 'blob': 'aac2d08d0947e62c41bcd462d1a6d68734300419'}, 'prior-installed-206--seal.json': {'path': 'WP/batch-proof-snapshot-handoff-cde8-20261015/first-proof-070000-closed-repeat-identity-stop/remote-originals/installed-206/seal.json', 'bytes': 724, 'sha256': 'afb9f084d5948976cb968998fc6bca172411fbfffe9da1c4e24cd3321a541cab', 'blob': '89b7194dab3730be6eb29ba0f90a198acebe5b88'}, 'prior-installed-206--logical-state.json': {'path': 'WP/batch-proof-snapshot-handoff-cde8-20261015/first-proof-070000-closed-repeat-identity-stop/remote-originals/installed-206/logical-state.json', 'bytes': 321307, 'sha256': '352f7f261ee4423b6fd3963f85714641e5ca18e1d5ef4664f322f4990233c481', 'blob': '32e2596834cf5e0eeca6095a6a8067a7e597faff'}, 'prior-installed-206--raw--copy-authority.json': {'path': 'WP/batch-proof-snapshot-handoff-cde8-20261015/first-proof-070000-closed-repeat-identity-stop/remote-originals/installed-206/raw/copy-authority.json', 'bytes': 307, 'sha256': 'f03c9cb5d22abba175a446b2d676ef0548429210e22135893f0fd8dc2ed16bb3', 'blob': 'f55cf7226f987b1353ed957e6c474b13bbbb4556'}, 'prior-dry-206-measurement.json': {'path': 'WP/batch-proof-snapshot-handoff-cde8-20261015/first-proof-070000-closed-repeat-identity-stop/remote-originals/dry-206-measurement.json', 'bytes': 231, 'sha256': '609d4ef60292b1b5d30191b0d02f8695ffbbc0cdcaabbd4d3df36b5725b97094', 'blob': '883e9a90b4a9eda1c6e5bd3cad41e9b2ded32b8a'}, 'prior-apply-206-measurement.json': {'path': 'WP/batch-proof-snapshot-handoff-cde8-20261015/first-proof-070000-closed-repeat-identity-stop/remote-originals/apply-206-measurement.json', 'bytes': 232, 'sha256': 'bd97f338be054fc9cb0c78f3952832fc669c2a82a818845ed6f513a3058aaac3', 'blob': '971c2cbd2a4450f6803f7d5e02c4f6a905673938'}, 'prior-repeat-206-measurement.json': {'path': 'WP/batch-proof-snapshot-handoff-cde8-20261015/first-proof-070000-closed-repeat-identity-stop/remote-originals/repeat-206-measurement.json', 'bytes': 231, 'sha256': 'abd2d8b19a7d9df42f5dd8cb57092b3913cd415ed1d4a689b465547dd54f5dad', 'blob': 'abe44b106a25d8159c27da2738fea11031dc4a88'}}
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
        'minimumDbBudgetEquivalents='+str(MINIMUM_DB_EQUIVALENTS),'forwardDirection='+str(FORWARD_DIRECTION),'priorEvidenceCommit='+PRIOR_EVIDENCE,'priorProofRoot='+str(PRIOR_ROOT),'priorEvidenceIndexSha256='+PRIOR_FILES_SHA,'forwardRaw206InputOnly=true','no206OrPolicyReplay=true','noNewProductionSnapshot=true','repeat206Evaluation=AFTER_CLOSURE_SEAL_AND_RETAINED_FILES_NOT_UNSEALED_TUPLES','repeatWalRule=ABSENT_AND_ZERO_EQUIVALENT_NONEMPTY_EXACT','allRepeatComparedStatesRetainedBeforeRefusal=true','inputLogicalStateFromBoundRecordsNoSql=true','budgetMinimum64DroppedForForwardGraph=true','budgetStageTableSha256='+TABLE_SHA,
        'budgetModel=DECLARED_STAGE_REMAINING_CONSUMPTION_AWARE','capacityDirection=6183215126','noopSealDirection=6183663456','dryRunMainWalCorrectedIdentity=true','repeatMainWalCorrectedIdentityNoOpZero=true','installedSealBecomesPrevious=true',
        'metadataCapacityBeforeRootAndBeforeUnit=true','allLocalExecutedSourceFilesBound=true','containerNameAbsenceProof=BOUNDED_COMPLETE_ID_AND_EXACT_NAME_INVENTORY','containerNameProbeRawIdsRetained=true','mandatoryKnownPredecessorInInventory=true','noErrorTextAbsenceInference=true',
        'snapshotBoundaryDirection=6184356993','productionSnapshotAuthority=STABLE_FILESYSTEM_COPY_WINDOW_HANDOFF','productionPostHandoffChecks=OWNED_RAW_BYTES_AND_READER_BACKUP_ONLY','liveEvolutionObservation=STAT_ONLY_NEVER_SNAPSHOT_AUTHORITY','liveInputEqualityRefusalComparedStatesRetained=true','databaseAssetsCrossFileAtomicityClaimed=false','budgetCheckpointCgroupAnonFileRecorded=true',
        'referenceDbReserveBytes='+str(REFERENCE_DB_BYTES),'referenceAssetReserveBytes='+str(REFERENCE_ASSET_BYTES),
        'retainedAssetReserveMultiplier=3','logReserveBytes='+str(LOG_RESERVE),
        'allocationMeasurementSeconds=120','allRetainedReleaseDockerContainerdAllocation=true',
        'policyPreflightMode=READONLY_DRY_RUN','ownedStopIndependentOfReserveHeadroom=true','allInputPathAncestorsRejectAliases=true',
        'diskMountPolicy=VERIFIED_DOCKER_OVERLAY_VIEWS_BACKED_BY_COUNTED_CONTAINERD',
        'physicalDuSingleFilesystem=true','containerMountComparison=EXACT_OBJECTS_UNORDERED_NO_DUPLICATES']+[n+'='+d for n,d in sorted(graph(index).items())]
def approval(review,index):
    require(review.get('id',0)>6184928681 and review.get('performed_via_github_app',{}).get('slug')=='claude','NEW actual Claudio source review required')
    require(review.get('html_url')=='https://github.com/yigini/soilfer-lims/issues/162#issuecomment-'+str(review['id']) and first_line(review.get('body',''))=='Source review: PASS','Final exact source PASS missing')
    require(review.get('created_at')==review.get('updated_at') and review['created_at']>'2026-10-15T05:11:07Z','Unedited fresh approval required')
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
