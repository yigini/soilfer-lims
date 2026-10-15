"""Retain launch and actual OPEN observation; never infer proof completion or replay."""
import datetime,json,pathlib,subprocess,sys
REPO=pathlib.Path(__file__).resolve().parents[2];SOURCE=REPO/'WP/batch-proof-cde8-20261015';BASE='106c73d58d4ad64cd72cde46a9a9f5d8dd763574'
sys.path.insert(0,str(SOURCE))
from proof_contract import *
from prepare_proof import raw_git
def cmd(*a):return subprocess.check_output(a,cwd=REPO)
require(cmd('git','rev-parse','HEAD').decode().strip()==BASE and not cmd('git','diff','--cached','--name-only').strip(),'Writer/staging moved')
require(cmd('git','ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==BASE,'Remote moved')
observation=exact_json((SOURCE/'first-proof-023000-first-observation-once/stdout-original.json').read_bytes())
props=dict(l.split('=',1) for l in observation['systemctlOriginal'].splitlines() if '=' in l)
require(props['ActiveState']=='active' and props['SubState']=='running' and props['InvocationID']=='f65cb69ccc5542339f09fcab778bed23' and props['MemoryMax']=='805306368' and props['MemorySwapMax']=='0' and props['RuntimeMaxUSec']=='1h 30min','Actual opening differs')
require(not observation['closedImmutableSelectedJson'],'Opening already has terminal evidence; inspect')
out=SOURCE/'first-proof-023000-opening-index.json';require(not out.exists(),'Opening retention consumed')
lead=('## 2026-10-15 actual023000 proof launched ONCE / OPEN observation\n\n'
      'Exactea9SourcePASS6183081827 retainede7d8a965; one17fileimmutablelocalpackage retained106c73d5. ONEfresh023000unit launched02:36:49UTC, actual invocationf65cb69ccc5542339f09fcab778bed23. Readonly OPEN observation02:36:56.593687UTC confirms active/running/MemoryMax805306368/Swap0/Runtime90min, observedMemoryCurrent84373504/MemoryPeak84631552 (OPEN only),21files/no terminal receipt. Original launch/observer raws at first-proof-023000-opening-index.json. Observe SAMEunit/root, NEVERredispatch/retry/replay/helpers/sourcechanges/cleanup. No terminal proof or counts observed at this opening boundary. Current scope UPSTREAM snapshot/owned206214209install/jobsOFFstartup ONLY, notreleasequalified; jobsONnaturalintake+broadpostflight/exactkitfreshgate later. Productionstop/restart/settingschange/103 remain forbidden. Old020000FAILEDroot immutable; all original source/mount/refusal/build/approval/human/scientific/policy/YY/reserve/memory/containers/forwardonlyhistory hold.\n\n')
readme=REPO/'WP/audit-release-eb6de2e8/README.md';readme.write_bytes(lead.encode()+readme.read_bytes())
paths=[]
for name in ['first-proof-023000-launch-wrapper-once','proof-launch-'+ROOT_NAME,'first-proof-023000-first-observation-once']:
    paths.extend(sorted(p for p in (SOURCE/name).rglob('*') if p.is_file()))
paths += [pathlib.Path(__file__),REPO/'WP/backlog-resume-20261013/execute-reviewed-overlay-stopped-copy-launch-once.py',REPO/'WP/backlog-resume-20261013/observe-stopped-copy-023000-first-boundary-readonly-once.py',readme]
record={'status':'ACTUAL_ONCE_LAUNCHED_OPEN_NOT_PROOF_COMPLETE','observedUtc':observation['observedUtc'],'sourceCommit':'ea9ce209d85305f863378d689b443d3134cbb4cf','actualSourcePass':6183081827,'unit':observation['unit'],'root':observation['root'],'invocation':props['InvocationID'],'actualExecutedLimitsAtOpening':{'memoryMax':805306368,'swapMax':0,'runtimeSeconds':5400},'terminalProofStatus':None,'actualProductionCounts':None,'jobsOnQualificationStillRequired':True,'neverReplay':True,'files':[{'path':p.relative_to(REPO).as_posix(),'bytes':p.stat().st_size,'sha256':sha(p.read_bytes())} for p in paths]}
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
