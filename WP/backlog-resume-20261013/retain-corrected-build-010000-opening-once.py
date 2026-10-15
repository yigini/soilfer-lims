"""Retain honest OPEN same-unit/accounting-preflight state and immutable package/launch evidence."""
import datetime,hashlib,json,pathlib,subprocess,sys
REPO=pathlib.Path(__file__).resolve().parents[2]
SOURCE=REPO/'WP/batch-build-containerd-cde8-20261015'
PACKAGE=SOURCE/'build-package-workflow-batch-build-cde8c889-20261015T010000Z'
DEST=SOURCE/'first-build-010000-open-boundary'
def cmd(*a):return subprocess.check_output(a,cwd=REPO)
assert cmd('git','rev-parse','HEAD').decode().strip()=='9fc181ca6cd0c29bcdc78067af4a8d432154fe94' and not cmd('git','diff','--cached','--name-only').strip() and not DEST.exists()
sys.path.insert(0,str(SOURCE))
from batch_build_contract import *
from prepare_batch_build import raw_git
load=lambda p:json_exact(p.read_bytes())
launch=load(SOURCE/(PACKAGE.name+'-launch')/'launch-record.json');observation=load(SOURCE/'first-build-010000-opening-observation/stdout-original.json')
require(launch['sourceReviewId']==6181452519 and launch['toolingCommit']=='6608548a58dd4bf581da4330f1cd7b0f68a86973','Actual approved launch binding missing')
require(observation['closed'] is False and observation['properties']['InvocationID']=='a856dfdc5dcf401698724f7ef9459933' and observation['properties']['MemoryMax']==str(MEMORY) and observation['properties']['MemorySwapMax']=='0' and observation['terminalRecords']=={},'Actual open same-unit state differs')
require('build-intent.json' not in observation['ownedFileNames'] and 'docker-build.log' not in observation['ownedFileNames'],'Observed preflight already entered build')
require({p.name for p in PACKAGE.iterdir()}==REQUIRED_ARTIFACTS and {n:sha((PACKAGE/n).read_bytes()) for n in REQUIRED_ARTIFACTS}==launch['packageFileHashes'],'Actual package/upload binding differs')
DEST.mkdir();record={'status':'ACTUAL_CORRECTED_BUILD_UNIT_OPEN_ACCOUNTING_PREFLIGHT','observedUtc':observation['observedUtc'],'sourceReviewId':6181452519,'toolingCommit':launch['toolingCommit'],'root':launch['root'],'unit':launch['unit'],'actualInvocationId':observation['properties']['InvocationID'],'actualMemoryMax':MEMORY,'actualMemorySwapMax':0,'actualRuntimeMax':'45min','newBuildStartedAtObservation':False,'terminalResult':None,'activeLogsCapturedAsClosed':False,'originalFailureAndExcludedImageUnchanged':True,'noProductionDatabaseConnection':True,'neverReplay':True}
with (DEST/'open-original-validation.json').open('x',encoding='utf-8') as f:json.dump(record,f,indent=2)
paths=sorted(p for p in DEST.iterdir() if p.is_file())
for folder in [PACKAGE,SOURCE/(PACKAGE.name+'-launch'),SOURCE/'reviewed-package-preparation-once',SOURCE/'reviewed-launch-execution-once',SOURCE/'first-build-010000-opening-observation']:paths.extend(sorted(p for p in folder.iterdir() if p.is_file()))
paths.extend([REPO/'WP/backlog-resume-20261013/execute-reviewed-corrected-build-package-once.py',REPO/'WP/backlog-resume-20261013/execute-reviewed-corrected-build-launch-once.py',pathlib.Path(__file__)])
readme=REPO/'WP/audit-release-eb6de2e8/README.md'
readme.write_bytes(('## 2026-10-15 approved corrected build010000 SAMEUNIT OPEN/preflight\n\nActualSourcePASS6181452519/6608548a retained9fc. One24filepackage00:25:19.788UTC/oneunitlaunch00:26:24.842UTC; sameunitlims-workflow-batch-build-cde8c889-20261015t010000z/actualinvocationa856dfdc5dcf401698724f7ef9459933 ACTIVE00:27:09.761UTC/MemoryMax805306368/Swap0/Runtime45min. Observed26files=24inputs+preflightintent+beforetopology; no build-intent/log or terminal exists. This is OPEN accountingpreflight, not a complete build or finalPASS. Exact package/launch/OPENobservation at first-build-010000-open-boundary/index.json. ObserveSAMEunit; neverreplaypreparer/launcher/builder/current120smeasurement. Ifpreflighttimeoutrefusal preserveoriginals/newBuildCount0/consumedroot; actualCl pre-agrees300smeasurement successorSCOPE ONLY, stillneedsownexactPASS/freshroot/neverreplaythisroot. Source frozenwhileactive. No productionDB103/proofkitgatedeploy/sourcechange/cleanup/historicalreplay/humandraftchange.\n\n').encode()+readme.read_bytes());paths.append(readme)
idx=DEST/'index.json'
with idx.open('x',encoding='utf-8') as f:json.dump({'status':record['status'],'validation':record,'files':[{'path':p.relative_to(REPO).as_posix(),'bytes':p.stat().st_size,'sha256':sha(p.read_bytes())} for p in paths]},f,indent=2)
paths.append(idx);rels=[p.relative_to(REPO).as_posix() for p in paths];require(len(rels)==len(set(rels)),'Duplicate owner')
for i in range(0,len(rels),15):cmd('git','-c','core.autocrlf=false','add','-f','--',*rels[i:i+15])
require(set(cmd('git','diff','--cached','--name-only').decode().splitlines())==set(rels),'Staged owner differs')
tree=cmd('git','write-tree').decode().strip()
for p,rel in zip(paths,rels):require(raw_git(tree,rel)[0]==p.read_bytes(),'Raw staged bytes differ')
cmd('git','commit','-m','Retain single corrected build launch and honest open accounting preflight')
head=cmd('git','rev-parse','HEAD').decode().strip()
for p,rel in zip(paths,rels):require(raw_git(head,rel)[0]==p.read_bytes(),'Raw OID bytes differ')
cmd('git','push','origin','audit/release-eb6de2e8');require(cmd('git','ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head,'Pushed audit differs')
print(json.dumps({'status':record['status'],'head':head,'verifiedBlobs':len(paths),'actualInvocationId':record['actualInvocationId'],'terminalResult':None,'newBuildStartedAtObservation':False}))
