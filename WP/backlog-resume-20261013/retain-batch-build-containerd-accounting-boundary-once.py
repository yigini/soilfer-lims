"""Retain actual closed-failure storage diagnosis and a non-executable forward-remedy proposal."""
import datetime,hashlib,json,pathlib,subprocess
REPO=pathlib.Path(__file__).resolve().parents[2]
SOURCE=REPO/'WP/batch-release-cde8-20261014'
DEST=SOURCE/'closed-build-accounting-forward-boundary'
def cmd(*args):return subprocess.check_output(args,cwd=REPO)
assert cmd('git','rev-parse','HEAD').decode().strip()=='a514c0a49a7487f44b33e27a7390972926a56307'
assert not cmd('git','diff','--cached','--name-only').strip() and not DEST.exists()
closed=SOURCE/'first-build-221500-closed-terminal'
failure=json.loads((closed/'build-terminal-failure.json').read_bytes())
image=json.loads((closed/'candidate-image-fresh-inspect-original.json').read_bytes())[0]
facts=json.loads((SOURCE/'closed-build-bounded-topology-no-du-once/stdout-original.json').read_bytes())
assert failure['status']=='FAILED_OR_RESERVE_REFUSED_BUILD_ONLY_RETAIN_ALL' and failure['exitCode']==0 and failure['error']=='Unexplained disk growth reached the 500MB abort boundary'
assert image['Id']=='sha256:1d4882f49f351a08549c79c0409f7848dbb205feef314b33432aae63ed11217b'
assert facts['driverStatus']['exitCode']==0 and json.loads(facts['driverStatus']['stdout'])==[['driver-type','io.containerd.snapshotter.v1']]
assert facts['dockerRoot']['stdout'].strip()=='/var/lib/docker' and facts['candidatePathExists'] and not facts['candidatePathSymlink'] and facts['candidateStorageDevice']==64769
assert "root = '/var/lib/containerd'" in facts['containerdTopLevelConfig']['selectedTopLevelLines'] and facts['allocationMeasured'] is False and facts['duProcessesReadOnly']['stdout']==''
DEST.mkdir()
def save(n,v):
    with (DEST/n).open('x',encoding='utf-8') as f:json.dump(v,f,indent=2)
drop=failure['freeBytesBefore']['/opt/lims']-failure['freeBytesAfter']['/opt/lims']
known=sum(v['bytes']-failure['diskGrowth']['beforeAllocations'][p]['bytes'] for p,v in failure['diskGrowth']['afterAllocations'].items())
analysis={'status':'ACTUAL_CONTAINERD_STORAGE_OMITTED_ORIGINAL_GATE_REMAINS_FAILED','preparedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'candidate':failure['head'],'originalSourceReviewId':6179940139,'originalRoot':'/opt/lims/releases/workflow-batch-build-cde8c889-20261014T221500Z','originalUnit':'lims-workflow-batch-build-cde8c889-20261014t221500z','originalInvocationId':'2da8e4edfe95494c8c60263ae1b1578b','originalFailureSha256':hashlib.sha256((closed/'build-terminal-failure.json').read_bytes()).hexdigest(),'dockerBuildExitCode':0,'unitExitCode':1,'imageForensicsOnly':image['Id'],'imageBytes':image['Size'],'freeDropBytes':drop,'knownAllocatedNetGrowthBytes':known,'originalUnexplainedGrowthBytes':drop-known,'originalAbortBytes':500000000,'actualDriverType':'io.containerd.snapshotter.v1','actualDockerRoot':'/var/lib/docker','actualContainerdRoot':'/var/lib/containerd','actualStorageDevice':64769,'containerdRootOmittedFromOriginalBeforeAfter':True,'preBuildContainerdAllocationAvailable':False,'postBuildRecursiveAllocationMeasured':False,'completeGrowthReconciliationClaimed':False,'failedImageApprovedForProofOrDeploy':False,'productionConnections':0,'buildsRetried':0,'imagesRetagged':0,'cleanupOperations':0}
save('storage-boundary-analysis.json',analysis)
save('recursive-topology-timeout-transcription.json',{'status':'READONLY_TOPOLOGY_COLLECTOR_TIMED_OUT','evidenceKind':'TOOL_OUTPUT_TRANSCRIPTION','consumedHelper':'inspect-closed-batch-build-storage-topology-once.py','localExitCode':1,'literalError':"subprocess.TimeoutExpired: Command '['ssh', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=15', 'root@46.19.33.37', 'python3', '-B', '-']' timed out after 60 seconds",'originalScriptRetained':True,'completedAllocationResultAvailable':False,'followupBoundedMetadataOnly':True,'laterDuProcessInventoryEmpty':True,'processesStoppedByPip':0,'productionOperations':0})
proposal={'status':'PROPOSED_SCOPE_REQUIRES_ACTUAL_CLAUDIO_DIRECTION_THEN_CONCRETE_NEW_SOURCE_REVIEW','candidate':failure['head'],'imageForensicBinding':image['Id'],'originalFailureSha256':analysis['originalFailureSha256'],'scope':'READONLY_VALIDATION_EXISTING_ONCE_BUILT_IMAGE_NEW_FORWARD_RECEIPT_ONLY','newDockerBuilds':0,'existingImagesRetagged':0,'containerStarts':0,'databaseConnections':0,'volumeMounts':0,'originalRootWrites':0,'originalFailureReclassified':False,'originalGateOverridden':False,'newReceiptRoot':None,'newToolingSource':None,'newSourceReview':None,'newReceipt':None,'proofOrProductionAuthority':None,'requirements':['Keep original failed gate/root/unit/image/inputs/logs unchanged; never replay or cleanup','Independent original21input/raw1560application source/closedDockerlog/exit0/imageID+revision+size validation','Discover and bind actual Docker and containerd storage roots without changing daemon configuration','Complete bounded physical accounting on disjoint roots and all retained release allocations with no DB/volume connection','Retain original missing pre-build containerd allocation explicitly; never invent it or retroactively pass the old500MBgate','Unchanged reserve floor/scaled reserve/unexplained growth limit/workload pins','Only after exact new source review, potentially create a new distinct receipt for the same once-built image; no proof/deploy authority inferred','Future stopped-copy proof/actual214209impact/policyNOOP/YYnonzero/approvedSTOP/finalkit/freshgate reviews remain required'],'question':'Is this separately reviewed, read-only forward receipt route in scope, or must the retained once-built image stay excluded? No rebuild, retag, original receipt fabrication or old-gate override is proposed.'}
save('forward-remedy-scope-proposal.json',proposal)
paths=[]
for folder in [SOURCE/'closed-build-storage-topology-once',SOURCE/'closed-build-bounded-topology-no-du-once',DEST]:paths.extend(sorted(p for p in folder.iterdir() if p.is_file()))
paths.extend([REPO/'WP/backlog-resume-20261013/inspect-closed-batch-build-storage-topology-once.py',REPO/'WP/backlog-resume-20261013/inspect-closed-build-bounded-topology-no-du-once.py',pathlib.Path(__file__)])
readme=REPO/'WP/audit-release-eb6de2e8/README.md'
readme.write_bytes(('## 2026-10-14 actual containerd accounting mismatch; failed build remains HELD\n\nClosedDockerbuildexit0 but originalgate500MB REFUSED3,609,116,672B unexplained/sourceunitfailed/no successfulreceipt/a514. Actualbounded metadata confirms driverio.containerd.snapshotter.v1, DockerRoot/var/lib/docker, activecontainerd defaultconfigroot/var/lib/containerd/device64769 absentfromoriginalbefore/aftercategories. Missing prebuild containerd allocation means NO complete growthreconciliation/retroactivePASS. A separate recursive topologycollector timedout60s/no completedallocation result; originalsource/refusaltranscription preserved; laterpsduempty/no processstopped. Bounded noDU metadata/analysis/PROPOSED read-only existing-image forwardreceipt scope at closed-build-accounting-forward-boundary/index.json; no execution authority/new receipt/source/review. Need actualCl scope direction then concrete NEWsource review; no rebuild/retag/cleanup/rootwrite/gateoverride/failedimageproof or deploy. Scientificproof/impact/finalkit/freshgate remain empty; humanDraft/cards untouched.\n\n').encode()+readme.read_bytes());paths.append(readme)
index_path=DEST/'index.json'
with index_path.open('x',encoding='utf-8') as f:json.dump({'status':analysis['status'],'files':[{'path':p.relative_to(REPO).as_posix(),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in paths],'newForwardAuthority':None},f,indent=2)
paths.append(index_path);rels=[p.relative_to(REPO).as_posix() for p in paths]
cmd('git','-c','core.autocrlf=false','add','-f','--',*rels)
assert set(cmd('git','diff','--cached','--name-only').decode().splitlines())==set(rels)
for p,rel in zip(paths,rels):assert cmd('git','show',':'+rel)==p.read_bytes()
cmd('git','commit','-m','Retain refused build containerd storage boundary and forward scope proposal')
head=cmd('git','rev-parse','HEAD').decode().strip()
for p,rel in zip(paths,rels):assert cmd('git','show',head+':'+rel)==p.read_bytes()
cmd('git','push','origin','audit/release-eb6de2e8')
assert cmd('git','ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head
print(json.dumps({'status':analysis['status'],'head':head,'verifiedBlobs':len(paths),'unexplainedGrowthBytes':drop-known,'actualContainerdRoot':'/var/lib/containerd','imageForensicsOnly':image['Id'],'newForwardAuthority':None,'productionOperations':0}))
