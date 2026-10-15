"""Retain one actual active observation; never collect or modify the active proof."""
import json,pathlib,subprocess,sys
REPO=pathlib.Path(__file__).resolve().parents[2];SOURCE=REPO/'WP/batch-proof-name-inventory-cde8-20261015';BASE='28c94865ad93f03e515bcb48d356990f610c8507'
sys.path.insert(0,str(SOURCE))
from proof_contract import canonical,exact_json,require,sha
from prepare_proof import raw_git
def cmd(*a):return subprocess.check_output(a,cwd=REPO)
require(cmd('git','rev-parse','HEAD').decode().strip()==BASE and not cmd('git','diff','--cached','--name-only').strip(),'Writer/staging moved')
require(cmd('git','ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==BASE,'Remote moved')
dest=SOURCE/'first-proof-060000-second-observation-once';observation=exact_json((dest/'stdout-original.json').read_bytes())
props=dict(l.split('=',1) for l in observation['systemctlOriginal'].splitlines() if '=' in l)
require(props['ActiveState']=='active' and props['SubState']=='running' and props['InvocationID']=='6ebd4f87542c4c67ab90059e4e000eae','Actual observation differs')
require(not any(n in observation['closedImmutableSelectedJson'] for n in ['proof-receipt.json','proof-terminal-refusal.json']),'Already terminal: inspect originals')
bind=observation['closedImmutableSelectedJson']['measured-copy-reserve.json'];require(bind['declaredDbCopies']==52 and bind['dbBudgetEquivalents']==65 and bind['requiredBytes']==51759760494,'Actual bind differs')
out=SOURCE/'first-proof-060000-second-open-index.json';require(not out.exists(),'Retention consumed')
record={'status':'ACTUAL_OPEN_PAST_MEASURED_RESERVE_NOT_PROOF_COMPLETE','observedUtc':observation['observedUtc'],'invocation':props['InvocationID'],'root':observation['root'],'unit':observation['unit'],'fileCount':len(observation['fileInventory']),'observedMemoryCurrent':int(props['MemoryCurrent']),'observedMemoryPeak':int(props['MemoryPeak']),'actualMemoryMax':805306368,'actualSwapMax':0,'runtimeSeconds':5400,'measuredBind':bind,'actualProductionCounts':None,'terminalStatus':None,'neverReplay':True}
lead='## 2026-10-15 same060000 OPEN04:15:57 / reserve bound, snapshot in progress\n\nSame invocation6ebd4f87542c4c67ab90059e4e000eae active/running;35files. Actual measured-copy-reserve.json sealed: T567558144/A5787648/N52/equiv65/required51759760494. Reserve guard passed; no terminalreceipt/refusal/baselinecounts/scientificlists observed. ActualMemoryCurrent805105664/Peak805306368 at this OPEN observation, actual805306368limit/Swap0/90min unchanged; do notcallthis OOM or finalpeak/result. No source/limit/production change/stop/retry. Observe SAMEroot/unit afterreasonableinterval; allrawfiles/containers retained. No liveSQLite/secondwriter or collector replay. Allscope/guards/history remain; jobsOFFonly/notreleasequalified.\n\n'
readme=REPO/'WP/audit-release-eb6de2e8/README.md';readme.write_bytes(lead.encode()+readme.read_bytes())
paths=sorted(p for p in dest.iterdir() if p.is_file())+[pathlib.Path(__file__),REPO/'WP/backlog-resume-20261013/observe-stopped-copy-060000-second-boundary-readonly-once.py',readme]
with out.open('xb') as f:f.write(canonical({**record,'files':[{'path':p.relative_to(REPO).as_posix(),'bytes':p.stat().st_size,'sha256':sha(p.read_bytes())} for p in paths]})+b'\n')
paths.append(out);rels=[p.relative_to(REPO).as_posix() for p in paths]
for start in range(0,len(rels),15):cmd('git','-c','core.autocrlf=false','add','-f','--',*rels[start:start+15])
require(set(cmd('git','diff','--cached','--name-only').decode().splitlines())==set(rels),'Unowned staging');tree=cmd('git','write-tree').decode().strip()
for p,rel in zip(paths,rels):require(raw_git(tree,rel)[0]==p.read_bytes(),'Staged raw differs')
cmd('git','commit','-m','Retain same active proof measured-reserve boundary without replay');head=cmd('git','rev-parse','HEAD').decode().strip()
for p,rel in zip(paths,rels):require(raw_git(head,rel)[0]==p.read_bytes(),'Committed raw differs')
cmd('git','push','origin','audit/release-eb6de2e8');require(cmd('git','ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head,'Remote differs')
print(json.dumps({'status':record['status'],'head':head,'verifiedOwnedBlobs':len(paths),'terminalStatus':None}))
