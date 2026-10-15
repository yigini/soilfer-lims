"""Retain actual single launch/capacity/open observation; never infer completion."""
import json,pathlib,subprocess,sys
REPO=pathlib.Path(__file__).resolve().parents[2];SOURCE=REPO/'WP/batch-proof-name-inventory-cde8-20261015';BASE='bbacad7e2438bdcd1865cd68acc1832d6a2c5f43'
sys.path.insert(0,str(SOURCE))
from proof_contract import *
from proof_budget import capacity_gate
from prepare_proof import raw_git
def cmd(*a):return subprocess.check_output(a,cwd=REPO)
require(cmd('git','rev-parse','HEAD').decode().strip()==BASE and not cmd('git','diff','--cached','--name-only').strip(),'Writer/staging moved')
require(cmd('git','ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==BASE,'Remote moved')
observation=exact_json((SOURCE/'first-proof-060000-first-observation-once/stdout-original.json').read_bytes())
props=dict(l.split('=',1) for l in observation['systemctlOriginal'].splitlines() if '=' in l)
require(props['ActiveState']=='active' and props['SubState']=='running' and re.fullmatch('[a-f0-9]{32}',props['InvocationID']) and props['MemoryMax']=='805306368' and props['MemorySwapMax']=='0' and props['RuntimeMaxUSec']=='1h 30min','Actual opening differs; inspect honestly')
require(observation['root']==str(ROOT) and not any(n in observation['closedImmutableSelectedJson'] for n in ['proof-receipt.json','proof-terminal-refusal.json']),'Wrong root or terminal evidence at opening')
capacities={}
for n in ['metadata-capacity-before-root','metadata-capacity-immediately-before-unit']:
    v=exact_json((SOURCE/('proof-launch-'+ROOT_NAME)/(n+'-stdout.log')).read_bytes());capacity_gate(v);capacities[n]=v
out=SOURCE/'first-proof-060000-opening-index.json';require(not out.exists(),'Opening retention consumed')
lead='## 2026-10-15 actual060000 proof launchedONCE / OPEN '+observation['observedUtc']+'\n\nActual624aSourcePASS6184203154 retainede064ad82/one18fileimmutablelocalpackagebbacad7e. ONEfresh060000unit launched/invocation'+props['InvocationID']+'. Both reviewedmetadata-capacitychecks passed beforeROOTandimmediatelybeforeunit; freshallsource/app/mainCI/3audits/nolaterfailure guards passed. ReadonlyOPEN confirms active/running/MemoryMax805306368/Swap0/Runtime90min/MemoryCurrent'+props['MemoryCurrent']+'/MemoryPeak'+props['MemoryPeak']+'(OPENonly),'+str(len(observation['fileInventory']))+'files; sealedselectedJSON='+','.join(observation['closedImmutableSelectedJson'])+'. No terminalreceipt/refusal at observation. Originalcapacity/launch/observerraws at first-proof-060000-opening-index.json. ONEremotecontrolleractive; observeSAMEunit/root, neverredispatch/retry/replay/helpers/sourceedit/cleanup/concurrentwriter. No terminalproof/scientificlists/installed11242/startupPASS inferred. ScopeUPSTREAMsnapshot/owned206214209install/jobsOFFONLY/notreleasequalified; jobsONnaturalintake+broadpostflights/exactkitfreshgate later. Structuralnameinventory/rawIDretention/N52/65/25percent/identityguards/ALLretention/floorlogs500MBdu-x/memoryreadiness/sciencepolicy/YYnonzeroapprovedSTOP/primarysecondarysnapshots/forwardonly/103noapply/humanfileshistory hold. QualifiedB5c03/B1 complete; prior050000FAILEDnameguard/actualretainedbaseline10639onlythere/020000023000failed/040000nevercreated immutable.\n\n'
readme=REPO/'WP/audit-release-eb6de2e8/README.md';readme.write_bytes(lead.encode()+readme.read_bytes())
paths=[]
for name in ['first-proof-060000-launch-wrapper-once','proof-launch-'+ROOT_NAME,'first-proof-060000-first-observation-once']:
    paths.extend(sorted(p for p in (SOURCE/name).rglob('*') if p.is_file()))
paths += [pathlib.Path(__file__),REPO/'WP/backlog-resume-20261013/execute-reviewed-name-inventory-launch-once.py',REPO/'WP/backlog-resume-20261013/observe-stopped-copy-060000-first-boundary-readonly-once.py',readme]
record={'status':'ACTUAL_ONCE_LAUNCHED_OPEN_NOT_PROOF_COMPLETE','observedUtc':observation['observedUtc'],'sourceCommit':'624aab7b9219bc7b9986396ce63915c91ad80502','actualSourcePass':6184203154,'unit':observation['unit'],'root':observation['root'],'invocation':props['InvocationID'],'actualExecutedLimitsAtOpening':{'memoryMax':805306368,'swapMax':0,'runtimeSeconds':5400},'memoryCurrentAtOpen':props['MemoryCurrent'],'memoryPeakAtOpenNotFinal':props['MemoryPeak'],'capacityChecks':capacities,'terminalProofStatus':None,'newActualProductionCounts':observation['closedImmutableSelectedJson'].get('fresh-actual-baseline.json'),'jobsOnQualificationStillRequired':True,'neverReplay':True,'files':[{'path':p.relative_to(REPO).as_posix(),'bytes':p.stat().st_size,'sha256':sha(p.read_bytes())} for p in paths]}
with out.open('xb') as f:f.write(canonical(record)+b'\n')
paths.append(out);rels=[p.relative_to(REPO).as_posix() for p in paths];require(len(rels)==len(set(rels)),'Duplicate owner')
for start in range(0,len(rels),15):cmd('git','-c','core.autocrlf=false','add','-f','--',*rels[start:start+15])
require(set(cmd('git','diff','--cached','--name-only').decode().splitlines())==set(rels),'Unowned staging');tree=cmd('git','write-tree').decode().strip()
for p,rel in zip(paths,rels):require(raw_git(tree,rel)[0]==p.read_bytes(),'Staged raw differs')
cmd('git','commit','-m','Retain one approved structural-name proof launch and actual open observation');head=cmd('git','rev-parse','HEAD').decode().strip()
for p,rel in zip(paths,rels):require(raw_git(head,rel)[0]==p.read_bytes(),'Committed raw differs')
cmd('git','push','origin','audit/release-eb6de2e8');require(cmd('git','ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head,'Remote differs')
print(json.dumps({'status':record['status'],'head':head,'verifiedOwnedBlobs':len(paths),'invocation':props['InvocationID'],'openingObservation':observation['observedUtc'],'memoryCurrent':props['MemoryCurrent'],'memoryPeakOpenOnly':props['MemoryPeak'],'fileCount':len(observation['fileInventory'])}))
