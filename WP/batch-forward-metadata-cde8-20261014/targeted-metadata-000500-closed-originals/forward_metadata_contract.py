"""Pure authority for one bounded read-only forensic metadata capture, with no image adoption."""
import hashlib,json,pathlib,re
CANDIDATE='cde8c8896f5f9d5f1ab07b0ae16b1a765e0a6367'
TREE='638580d50f61254609de3abd42d93afc676a5727'
IMAGE='sha256:1d4882f49f351a08549c79c0409f7848dbb205feef314b33432aae63ed11217b'
OLD_ROOT='/opt/lims/releases/workflow-batch-build-cde8c889-20261014T221500Z'
ROOT_NAME='workflow-batch-forward-metadata-cde8c889-20261015T000500Z'
SCOPE='READONLY_FORWARD_METADATA_EVIDENCE_ONLY_NO_ADOPTION'
SOURCE_FILES=frozenset({'forward_metadata_contract.py','collect_forward_metadata.py','prepare_forward_metadata.py','launch_forward_metadata.py','verify_forward_metadata_guards.py'})
REFS={'candidate-image.id':{'bytes':71,'sha256':'6bb4227f82debcf97845874330ae261d044b749819d2f2193a0fc0c3935967e3','mode':0o600},'docker-build.log':{'bytes':28713,'sha256':'5a7736d9d36aaccafa9d98d84c3d1a537af4ee29b5255022d2565d78792db0f4','mode':0o400},'candidate-image-fresh-inspect-original.json':{'bytes':7229,'sha256':'c4b4d2fabe2783adf0eb6f842bb424982fcb6a7d53753b3dde2c79800f821c14','mode':None}}
REFERENCE_AUDIT='a514c0a49a7487f44b33e27a7390972926a56307'
REFERENCE_PREFIX='WP/batch-release-cde8-20261014/first-build-221500-closed-terminal/'
FLOOR=10556150894
RESIDUAL=3609116672
ABORT=500000000
CALL_TIMEOUT=10
COLLECTION_TIMEOUT=600
UNIT_TIMEOUT=900
MEMORY=805306368
MAX_OUTPUT=2*1024**2
MAX_COMMANDS=256
SOCKET='/run/containerd/containerd.sock'
NAMESPACES=('moby','buildkit')
UNIT_LOGS=frozenset({'unit-stdout-original.log','unit-stderr-original.log'})
REQUIRED=SOURCE_FILES|{'metadata-input.json','tooling-source-index.json','source-review-original.json','scope-direction-original.json','reference-direction-original.json','candidate-image.id','docker-build.log','candidate-image-fresh-inspect-original.json','original-closed-index.json','original-failure.json','original-build-intent.json','current-main-original.json','main-ci-original.json'}
def require(v,m):
    if not v:raise RuntimeError(m)
def sha(raw):return hashlib.sha256(raw).hexdigest()
def canonical(v):return json.dumps(v,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode()
def exact_json(raw):
    def pairs(items):
        out={}
        for k,v in items:require(k not in out,'Duplicate JSON key');out[k]=v
        return out
    return json.loads(raw,object_pairs_hook=pairs,parse_constant=lambda _:require(False,'Nonfinite JSON value'))
def safe_root(name):
    require(name==ROOT_NAME,'Only the exact first metadata root is allowed')
    p=pathlib.PurePosixPath('/opt/lims/releases')/name
    require(str(p)!=OLD_ROOT,'Original failed root cannot be a metadata output root');return p
def graph(index):
    require(re.fullmatch('[a-f0-9]{40}',index.get('head','')) is not None,'Exact tooling commit required')
    require(set(index.get('files',{}))==SOURCE_FILES,'Complete closed metadata graph required')
    for n,v in index['files'].items():require(type(v.get('bytes')) is int and v['bytes']>0 and re.fullmatch('[a-f0-9]{64}',v.get('sha256','')) and re.fullmatch('[a-f0-9]{40}',v.get('blob','')),'Invalid source identity '+n)
    return {n:v['sha256'] for n,v in index['files'].items()}
def tokens(index):
    files=graph(index)
    return [index['head'],CANDIDATE,TREE,IMAGE,'metadataScope='+SCOPE,'originalFailedBuildRoot='+OLD_ROOT,'originalMetadataRoot='+str(safe_root(ROOT_NAME)),
        'scopeDirectionId=6180234041','referenceDirectionId=6180335648','reserveFloorBytes='+str(FLOOR),'originalResidualBytes='+str(RESIDUAL),
        'unexplainedAbortBytes='+str(ABORT),'metadataCallTimeoutSeconds='+str(CALL_TIMEOUT),'metadataCollectionTimeoutSeconds='+str(COLLECTION_TIMEOUT),
        'metadataUnitTimeoutSeconds='+str(UNIT_TIMEOUT),'metadataMemoryLimitBytes='+str(MEMORY),'metadataMaxOutputBytes='+str(MAX_OUTPUT),'metadataMaxCommands='+str(MAX_COMMANDS),
        'snapshotSelection=EXACT_CANDIDATE_ROOTFS_CHAIN_AND_PARENTS','catalogueTruncation=false','imageEligibility=false','imageAdoptionReceipts=0','filesystemDuCalls=0','labAndHubBuildsOwnedByYY=true','releaseWindowControl=RELEASE_DAY_DISK_ABORTS_ACCEPTED']+[n+'='+d for n,d in sorted(files.items())]
def source_review(v,index):
    require(type(v.get('id')) is int and v['id']>6180335648 and v.get('html_url')=='https://github.com/yigini/soilfer-lims/issues/162#issuecomment-'+str(v['id']),'New exact-source review required')
    require((v.get('performed_via_github_app') or {}).get('slug')=='claude' and v.get('created_at')==v.get('updated_at') and v.get('created_at','')>'2026-10-14T22:57:41Z','Actual unedited new Claude source verdict required')
    first=next((s.strip().strip('*_# ').rstrip('.') for s in v.get('body','').splitlines() if s.strip()),'')
    require(first=='Source review: PASS' and all(t in v['body'] for t in tokens(index)),'Exact metadata-only source PASS/bindings missing')
def directions(scope,reference):
    for v,identity in [(scope,6180234041),(reference,6180335648)]:require(v.get('id')==identity and (v.get('performed_via_github_app') or {}).get('slug')=='claude' and v.get('created_at')==v.get('updated_at'),'Actual scope/reference direction required')
    require('This is direction only.' in scope['body'] and '3,609,116,672' in scope['body'] and 'This is still direction only.' in reference['body'] and 'candidate-image-fresh-inspect-original.json' in reference['body'],'Full directions changed')
def validate_spec(spec,index,review,scope,reference):
    graph(index);source_review(review,index);directions(scope,reference);safe_root(spec.get('rootName'))
    require(spec.get('status')=='PREPARED_READONLY_METADATA_NOT_LAUNCHED' and spec.get('scope')==SCOPE and spec.get('candidate')==CANDIDATE and spec.get('tree')==TREE and spec.get('image')==IMAGE,'Metadata candidate/scope differs')
    require(spec.get('toolingCommit')==index['head'] and spec.get('toolingIndexSha256')==sha(canonical(index)) and spec.get('sourceReviewId')==review['id'] and spec.get('sourceReviewSha256')==sha(canonical(review)),'Metadata source/review binding changed')
    require(spec.get('scopeDirectionSha256')==sha(canonical(scope)) and spec.get('referenceDirectionSha256')==sha(canonical(reference)),'Direction raw bindings changed')
    require(spec.get('originalRefs')==REFS and spec.get('originalFailedRoot')==OLD_ROOT and spec.get('originalInspectAbsent') is True,'Forensic reference roles changed')
    require(spec.get('imageEligibility') is False and all(type(spec.get(k)) is int and spec[k]==0 for k in ['imageAdoptionReceipts','newBuilds','retags','containerStarts','databaseConnections','volumeMounts','filesystemDuCalls']),'Metadata source expanded into adoption/operations')
    require(spec.get('labAndHubBuildsOwnedByYY') is True and spec.get('releaseWindowControl')=='RELEASE_DAY_DISK_ABORTS_ACCEPTED','Both YY pins required')
def safe_key(key):
    require(isinstance(key,str) and re.fullmatch('[A-Za-z0-9][A-Za-z0-9_.:/-]{0,250}',key),'Unsafe metadata key');return key
def digest(value):require(isinstance(value,str) and re.fullmatch('sha256:[a-f0-9]{64}',value),'Invalid immutable content digest');return value
def allowed_command(argv):
    a=tuple(argv)
    fixed={('docker','image','inspect',IMAGE),('docker','info','--format','{{.DockerRootDir}}'),('docker','info','--format','{{.Driver}}'),('docker','info','--format','{{json .DriverStatus}}'),('docker','buildx','du','--format','json'),('ctr','--address',SOCKET,'namespaces','list')}
    if a in fixed:return True
    for ns in NAMESPACES:
        prefix=('ctr','--address',SOCKET,'--namespace',ns)
        if a in {prefix+('images','list'),prefix+('content','list'),prefix+('snapshots','--snapshotter','overlayfs','list')}:return True
        if len(a)==len(prefix)+3 and a[:len(prefix)]==prefix and a[len(prefix):len(prefix)+2]==('content','get'):digest(a[-1]);return True
        if len(a)==len(prefix)+5 and a[:len(prefix)]==prefix and a[len(prefix):len(prefix)+4] in {('snapshots','--snapshotter','overlayfs','info'),('snapshots','--snapshotter','overlayfs','usage')}:safe_key(a[-1]);return True
    raise RuntimeError('Command is not a permitted read-only metadata interface')
def compare_image(reference,current):
    require(reference.get('Id')==current.get('Id')==IMAGE,'Image ID differs')
    require(reference.get('Architecture')==current.get('Architecture')=='amd64' and reference.get('Os')==current.get('Os')=='linux','Exact runtime image platform required')
    require(reference.get('RootFS')==current.get('RootFS') and reference.get('Config')==current.get('Config'),'Image RootFS or Config changed')
    require(current.get('Config',{}).get('Labels',{}).get('org.opencontainers.image.revision')==CANDIDATE,'Image revision differs')
def exported_image(log):
    rows=re.findall(r'(?m)^#\d+ (?:exporting manifest list|writing image) (sha256:[a-f0-9]{64})(?: .*|$)',log)
    require(rows and rows[-1]==IMAGE,'Original successful exported image differs');return rows[-1]
def evidence_only(record):
    require(record.get('imageEligibility') is False and all(type(record.get(k)) is int and record[k]==0 for k in ['imageAdoptionReceipts','proofLaunches','productionDeployments']),'Evidence cannot confer image or deploy authority')
    return record
def initial_inventory(rows):
    require(set(rows)==REQUIRED|UNIT_LOGS,'Unused metadata package/unit-output inventory required')
    for n,v in rows.items():
        require(v.get('regular') is True and v.get('symlink') is False and type(v.get('bytes')) is int,'Regular unaliased metadata package required')
        if n in UNIT_LOGS:require(v['bytes']==0 and v.get('mode',0)&0o022==0,'Unit outputs must be empty and not writable by other users')
        else:require(v['bytes']>0 and v.get('mode')==0o400,'Immutable input mode/bytes differ')
def snapshot_keys(text):
    lines=text.splitlines();require(lines and 'KEY' in lines[0] and 'KIND' in lines[0],'Snapshot catalogue interface changed')
    keys=[line.split()[0] for line in lines[1:] if line.split()]
    require(len(keys)<=80 and len(keys)==len(set(keys)),'Snapshot inventory duplicate or exceeds bound; no truncation')
    for key in keys:safe_key(key)
    return keys
def selected_snapshot_keys(text,layers):
    lines=text.splitlines();require(lines and 'KEY' in lines[0] and 'PARENT' in lines[0] and 'KIND' in lines[0],'Complete snapshot catalogue interface required')
    catalogue={}
    for line in lines[1:]:
        if not line.split():continue
        fields=line.split();require(len(fields) in [2,3],'Snapshot catalogue row shape changed')
        key=fields[0];safe_key(key);require(key not in catalogue,'Duplicate complete catalogue key')
        parent=fields[1] if len(fields)==3 else None
        if parent is not None:safe_key(parent)
        require(fields[-1] in ['Active','View','Committed'],'Snapshot catalogue kind changed')
        catalogue[key]={'parent':parent,'kind':fields[-1]}
    require(isinstance(layers,list) and 0<len(layers)<=80,'Exact candidate layer-chain bound required')
    selected=[];parent=None
    for diff in layers:
        digest(diff);key=diff if parent is None else 'sha256:'+hashlib.sha256((parent+' '+diff).encode()).hexdigest()
        require(key in catalogue and catalogue[key]['kind']=='Committed' and catalogue[key]['parent']==parent,'Exact candidate chain/parent missing or uncommitted')
        selected.append(key);parent=key
    return selected
def oci_children(obj):
    require(isinstance(obj,dict),'OCI metadata object required');out=[]
    entries=obj.get('manifests',[]);require(isinstance(entries,list),'OCI manifest list shape differs')
    for entry in entries:
        require(isinstance(entry,dict),'OCI descriptor shape differs');platform=entry.get('platform',{})
        require(isinstance(platform,dict),'OCI platform shape differs')
        if platform.get('os')=='linux' and platform.get('architecture')=='amd64':out.append(digest(entry['digest']))
    config=obj.get('config')
    if isinstance(config,dict) and 'digest' in config:
        require(type(config.get('size')) is int and 0<config['size']<=MAX_OUTPUT,'OCI config size bound refused');out.append(digest(config['digest']))
    return out
