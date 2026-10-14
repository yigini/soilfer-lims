"""Retain immutable prepared package, actual launch and OPEN unit metadata only."""
import datetime,json,pathlib,subprocess,sys
REPO=pathlib.Path(__file__).resolve().parents[2]
SOURCE=REPO/'WP/batch-release-cde8-20261014'
PACKAGE=SOURCE/'build-package-workflow-batch-build-cde8c889-20261014T221500Z'
DEST=SOURCE/'first-build-221500-opening-retention'
def cmd(*args):return subprocess.check_output(args,cwd=REPO)
assert cmd('git','rev-parse','HEAD').decode().strip()=='2dfa190d66b00f5378a18d25473fc706e5d5bb1c'
assert not cmd('git','diff','--cached','--name-only').strip() and not DEST.exists()
sys.path.insert(0,str(SOURCE))
from batch_build_contract import *
spec=json_exact((PACKAGE/'build-input.json').read_bytes());graph_index=json_exact((PACKAGE/'tooling-source-index.json').read_bytes());review=json_exact((PACKAGE/'source-review-original.json').read_bytes())
validate_spec(spec,graph_index,review)
require(review['id']==6179940139 and graph_index['head']=='2afd192872ce38bfabbaf5c69404d0aa7e679123','Actual source PASS differs')
validation=json_exact((SOURCE/'reviewed-python39-package-preparation-once/prepared-package-validation.json').read_bytes())
require({p.name for p in PACKAGE.iterdir()}==REQUIRED_ARTIFACTS,'Package inventory changed')
for row in validation['packageFiles']:require(sha((PACKAGE/row['name']).read_bytes())==row['sha256'],'Original prepared bytes changed')
launch=json_exact((SOURCE/(PACKAGE.name+'-launch')/'launch-record.json').read_bytes());require(launch['status']=='BUILD_UNIT_LAUNCHED_OBSERVE_SAME_UNIT','Actual launch missing')
observed=json_exact((SOURCE/'first-build-221500-opening-observation/stdout-original.json').read_bytes())
require(observed['properties']['ActiveState']=='active' and observed['properties']['SubState']=='running' and not observed['buildReceiptExists'] and not observed['terminalFailureExists'] and observed['activeBuildLogsRead'] is False,'Opening observation is not the exact OPEN boundary')
folders=[PACKAGE,SOURCE/(PACKAGE.name+'-launch'),SOURCE/'reviewed-python39-package-preparation-once',SOURCE/'reviewed-python39-build-launch-execution-once',SOURCE/'first-build-221500-opening-observation']
paths=[]
for folder in folders:
    for p in sorted(folder.iterdir()):require(p.is_file() and not p.is_symlink(),'Unexpected local evidence object');paths.append(p)
helpers=['execute-reviewed-python39-build-package-once.py','execute-reviewed-python39-build-launch-once.py','observe-batch-first-build-221500-opening-once.py']
paths.extend([REPO/'WP/backlog-resume-20261013'/n for n in helpers]);paths.append(pathlib.Path(__file__))
readme=REPO/'WP/audit-release-eb6de2e8/README.md'
readme.write_bytes(('## 2026-10-14 first reviewed batch build221500 unit ACTIVE — observe SAME unit\n\nActual2afd SourcePASS6179940139/22:29:31UTC retained2dfa. One immutable21filepackage prepared22:31:53UTC; reviewedlauncher created/uploaded/verified/started exactunitONCE22:33:22.871452UTC. Root /opt/lims/releases/workflow-batch-build-cde8c889-20261014T221500Z / unitlims-workflow-batch-build-cde8c889-20261014t221500z / invocation2da8e4edfe95494c8c60263ae1b1578b. Actualreadonly22:34:19UTC observation ACTIVE/running/receiptabsent/failurefileabsent; buildintent/log present, no active logs capturedasCLOSED. Observe sameunit, NEVERprepare/relaunch/build/retry/retag/rebuild/cleanup. Originalpackage/launch/prep/output/OPENmetadata retained at first-build-221500-opening-retention/index.json. All local wrappers/observer/retainer consumed; no localrunner remains. Build-only zeroDBconnections/volumemount/proof/deploy; no finalbuildreceipt/PASS/image yet. Terminal outcome requires originalunit/journal/buildlog/inputhashes/receipt orfailurefile, allretained; missingterminalfile means uncertaininspectNEVERreplay. Futureproof/impact/finalkit/gate/deploy remain unapproved. HumanDraft/cards/history untouched.\n\n').encode()+readme.read_bytes());paths.append(readme)
DEST.mkdir();index_path=DEST/'index.json'
index={'status':'FIRST_APPROVED_BUILD_UNIT_OPEN_ORIGINALS_RETAINED','retainedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'toolingCommit':graph_index['head'],'sourceReviewId':6179940139,'root':launch['root'],'unit':launch['unit'],'invocationId':observed['properties']['InvocationID'],'buildReceipt':None,'activeBuildLogsCapturedAsClosed':False,'productionConnections':0,'proofsLaunched':0,'productionDeployments':0,'files':[{'path':p.relative_to(REPO).as_posix(),'bytes':p.stat().st_size,'sha256':sha(p.read_bytes())} for p in paths]}
with index_path.open('x',encoding='utf-8') as f:json.dump(index,f,indent=2)
paths.append(index_path);rels=[p.relative_to(REPO).as_posix() for p in paths]
cmd('git','-c','core.autocrlf=false','add','-f','--',*rels)
require(set(cmd('git','diff','--cached','--name-only').decode().splitlines())==set(rels),'Staged owner differs')
for p,rel in zip(paths,rels):require(cmd('git','show',':'+rel)==p.read_bytes(),'Raw staged bytes differ')
cmd('git','commit','-m','Retain first reviewed batch build launch and OPEN unit evidence')
head=cmd('git','rev-parse','HEAD').decode().strip()
for p,rel in zip(paths,rels):require(cmd('git','show',head+':'+rel)==p.read_bytes(),'Raw Git bytes differ')
cmd('git','push','origin','audit/release-eb6de2e8')
require(cmd('git','ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head,'Pushed audit differs')
print(json.dumps({'status':index['status'],'head':head,'verifiedBlobs':len(paths),'root':index['root'],'unit':index['unit'],'buildComplete':False,'productionConnections':0,'proofsLaunched':0,'productionDeployments':0}))
