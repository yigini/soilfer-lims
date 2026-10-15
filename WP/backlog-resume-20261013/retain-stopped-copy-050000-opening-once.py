"""Retain launch and actual OPEN observation; never infer proof completion or replay."""
import datetime,json,pathlib,subprocess,sys
REPO=pathlib.Path(__file__).resolve().parents[2];SOURCE=REPO/'WP/batch-proof-noop-identity-cde8-20261015';BASE='5f403beb6cb2b851902192e177ce5eb04ae6829a'
sys.path.insert(0,str(SOURCE))
from proof_contract import *
from prepare_proof import raw_git
def cmd(*a):return subprocess.check_output(a,cwd=REPO)
require(cmd('git','rev-parse','HEAD').decode().strip()==BASE and not cmd('git','diff','--cached','--name-only').strip(),'Writer/staging moved')
require(cmd('git','ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==BASE,'Remote moved')
observation=exact_json((SOURCE/'first-proof-050000-first-observation-once/stdout-original.json').read_bytes())
props=dict(l.split('=',1) for l in observation['systemctlOriginal'].splitlines() if '=' in l)
require(props['ActiveState']=='active' and props['SubState']=='running' and props['InvocationID']=='32655ea5cdff4634af2954acc8f6c679' and props['MemoryMax']=='805306368' and props['MemorySwapMax']=='0' and props['RuntimeMaxUSec']=='1h 30min','Actual opening differs')
require(not observation['closedImmutableSelectedJson'],'Opening already has terminal evidence; inspect')
out=SOURCE/'first-proof-050000-opening-index.json';require(not out.exists(),'Opening retention consumed')
lead='## 2026-10-15 actual050000 proof launchedONCE / OPEN03:46:39 observation\n\nActual09d7SourcePASS6183890910 retained788ff754/one18fileimmutablelocalpackage5f403beb. ONEfresh050000unit launched03:46:24UTC/invocation32655ea5cdff4634af2954acc8f6c679. Both reviewedmetadata-capacitychecks passed beforeROOTandimmediatelybeforeunit; freshallsource/app/mainCI/3audits/nolaterfailure guards passed. ReadonlyOPEN03:46:39.608304UTC confirms active/running/MemoryMax805306368/Swap0/Runtime90min/MemoryCurrent103084032/MemoryPeak103084032(OPENonly),22files/no terminalselectedJSON. Originalcapacity/launch/observerraws at first-proof-050000-opening-index.json. ONEremotecontrolleractive; observeSAMEunit/root, neverredispatch/retry/replay/helpers/sourceedit/cleanup/concurrentwriter. No terminalproof/counts observed atopening; scientificlistsUNKNOWN. ScopeUPSTREAMsnapshot/owned206214209install/jobsOFFONLY/notreleasequalified; jobsONnaturalintake+broadpostflights/exactkitfreshgate later. NewN52/65/25percent/identityguards/ALLretention/floorlogs500MBdu-x/memoryreadiness/sciencepolicy/YYnonzeroapprovedSTOP/primarysecondarysnapshots/forwardonly/103noapply/humanfileshistory hold. QualifiedB5c03/B1 complete; old020000/023000failed/040000nevercreated immutable.\n\n'
readme=REPO/'WP/audit-release-eb6de2e8/README.md';readme.write_bytes(lead.encode()+readme.read_bytes())
paths=[]
for name in ['first-proof-050000-launch-wrapper-once','proof-launch-'+ROOT_NAME,'first-proof-050000-first-observation-once']:
    paths.extend(sorted(p for p in (SOURCE/name).rglob('*') if p.is_file()))
paths += [pathlib.Path(__file__),REPO/'WP/backlog-resume-20261013/execute-reviewed-noop-identity-launch-once.py',REPO/'WP/backlog-resume-20261013/observe-stopped-copy-050000-first-boundary-readonly-once.py',readme]
record={'status':'ACTUAL_ONCE_LAUNCHED_OPEN_NOT_PROOF_COMPLETE','observedUtc':observation['observedUtc'],'sourceCommit':'09d7e537d90bc8ed17e9d162fd6868a7c34a8e15','actualSourcePass':6183890910,'unit':observation['unit'],'root':observation['root'],'invocation':props['InvocationID'],'actualExecutedLimitsAtOpening':{'memoryMax':805306368,'swapMax':0,'runtimeSeconds':5400},'terminalProofStatus':None,'actualProductionCounts':None,'jobsOnQualificationStillRequired':True,'neverReplay':True,'files':[{'path':p.relative_to(REPO).as_posix(),'bytes':p.stat().st_size,'sha256':sha(p.read_bytes())} for p in paths]}
with out.open('xb') as f:f.write(canonical(record)+b'\n')
paths.append(out);rels=[p.relative_to(REPO).as_posix() for p in paths];require(len(rels)==len(set(rels)),'Duplicate owner')
for start in range(0,len(rels),15):cmd('git','-c','core.autocrlf=false','add','-f','--',*rels[start:start+15])
require(set(cmd('git','diff','--cached','--name-only').decode().splitlines())==set(rels),'Unowned staging')
tree=cmd('git','write-tree').decode().strip()
for p,rel in zip(paths,rels):require(raw_git(tree,rel)[0]==p.read_bytes(),'Staged raw differs')
cmd('git','commit','-m','Retain one approved overlay stopped-copy launch and actual open unit observation')
head=cmd('git','rev-parse','HEAD').decode().strip()
for p,rel in zip(paths,rels):require(raw_git(head,rel)[0]==p.read_bytes(),'Committed raw differs')
cmd('git','push','origin','audit/release-eb6de2e8');require(cmd('git','ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head,'Remote differs')
print(json.dumps({'status':record['status'],'head':head,'verifiedOwnedBlobs':len(paths),'invocation':props['InvocationID']}))
