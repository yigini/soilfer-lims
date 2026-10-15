"""Retain one OPEN forward observation and real corrected206 evaluation; no replay."""
import json,pathlib,subprocess,sys
REPO=pathlib.Path(__file__).resolve().parents[2];SOURCE=REPO/'WP/batch-proof-forward-resume-cde8-20261015';BASE='787a7bdc2cee080a32b8cccc33155896218a1e75'
sys.path.insert(0,str(SOURCE))
from proof_contract import *
from prepare_proof import raw_git
def cmd(*a):return subprocess.check_output(a,cwd=REPO)
require(cmd('git','rev-parse','HEAD').decode().strip()==BASE and not cmd('git','diff','--cached','--name-only').strip(),'Writer/staging moved')
require(cmd('git','ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==BASE,'Remote moved')
dest=SOURCE/'first-proof-080000-second-observation-once';o=exact_json((dest/'stdout-original.json').read_bytes());p=dict(l.split('=',1) for l in o['systemctlOriginal'].splitlines() if '=' in l)
require(p['ActiveState']=='active' and p['SubState']=='running' and p['InvocationID']=='0cb103307f4240689a630b3666545772','Actual observation differs')
require(not any(n in o['closedImmutableSelectedJson'] for n in ['proof-receipt.json','proof-terminal-refusal.json']),'Terminal: retain honestly')
bind=o['closedImmutableSelectedJson']['measured-copy-reserve.json'];require(bind['declaredDbCopies']==44 and bind['dbBudgetEquivalents']==55 and bind['requiredBytes']==45851464814,'Actual bind differs')
evaluation=o['closedImmutableSelectedJson']['accepted-206-repeat-evaluation-after-closure.json']
require(evaluation['notOriginalControllerUnsealedTuples'] is True and evaluation['no206InstallerReplay'] is True and evaluation['evaluation']['mainSha256AndLengthEqual'] is True and evaluation['evaluation']['walAbsentEmptyEquivalentOrNonemptyExact'] is True and evaluation['sqlConnections']==0,'Corrected evaluation differs')
out=SOURCE/'first-proof-080000-second-open-index.json';require(not out.exists(),'Consumed retainer')
lead='## 2026-10-15 same080000 OPEN06:59:18 / actual corrected206 evaluation retained\n\nSame0cb103307f4240689a630b3666545772 active/running/75files. Actualsealed accepted-206-repeat-evaluation-after-closure.json nowobserved: main9abe179b563322880Bunchanged/WALabsent-to0BemptySHAequivalent/NOOPinteger0backfill0/noSQL/no206replay/labelNOToriginalunsealedtuples. This is NEWafterclosureevaluation, neverretroPASS070000. Inputcopy stage stillactive/no closedforwardstage or214209science/11242/startups/terminalresult observed. ActualboundT563326976/A5787648/N44/55/required45851464814 PASS. MemoryCurrent805257216/Peak805306368 OPENONLY/Max805306368/Swap0/90min; noOOM/finalpeak/resultclaim. No source/limit/settings/productionchange/stop/retry/cleanup. ObserveSAMErootunitafterreasonableinterval withNEWuniqueobserver200000files/compactsummaryONLY; closedreceiptORfailure/fulloriginals mustretainhonestly/noSQL/DBfetch/newdu/replay. AllYYsciencepolicy/nonzeroYYapprovedSTOP/separateforwardremedy/retentionfloorlogs500MBdu-x/memoryreadiness/forwardonlyno103humanhistoryguards hold. NOT_RELEASE_QUALIFIED/jobsOFFonly/jobsONnaturalintake+broadpostflights/exactkitfreshgate later.\n\n'
readme=REPO/'WP/audit-release-eb6de2e8/README.md';readme.write_bytes(lead.encode()+readme.read_bytes())
paths=sorted(q for q in dest.iterdir() if q.is_file())+[pathlib.Path(__file__),REPO/'WP/backlog-resume-20261013/observe-stopped-copy-080000-second-boundary-readonly-once.py',readme]
record={'status':'ACTUAL_OPEN_CORRECTED206_AFTER_CLOSURE_EVALUATION_NOT_PROOF_COMPLETE','observedUtc':o['observedUtc'],'invocation':p['InvocationID'],'root':o['root'],'unit':o['unit'],'fileCount':len(o['fileInventory']),'memoryCurrentOpenOnly':int(p['MemoryCurrent']),'memoryPeakOpenOnly':int(p['MemoryPeak']),'measuredBind':bind,'accepted206AfterClosureEvaluationNotOriginalTuples':evaluation,'actual214209ScientificLists':None,'terminalStatus':None,'neverReplay':True,'files':[{'path':q.relative_to(REPO).as_posix(),'bytes':q.stat().st_size,'sha256':sha(q.read_bytes())} for q in paths]}
with out.open('xb') as f:f.write(canonical(record)+b'\n')
paths.append(out);rels=[q.relative_to(REPO).as_posix() for q in paths]
cmd('git','-c','core.autocrlf=false','add','-f','--',*rels);require(set(cmd('git','diff','--cached','--name-only').decode().splitlines())==set(rels),'Unowned staging');tree=cmd('git','write-tree').decode().strip()
for q,rel in zip(paths,rels):require(raw_git(tree,rel)[0]==q.read_bytes(),'Staged raw differs')
cmd('git','commit','-m','Retain same forward proof corrected206 evaluation at open boundary');head=cmd('git','rev-parse','HEAD').decode().strip()
for q,rel in zip(paths,rels):require(raw_git(head,rel)[0]==q.read_bytes(),'Committed raw differs')
cmd('git','push','origin','audit/release-eb6de2e8');require(cmd('git','ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head,'Remote differs')
print(json.dumps({'status':record['status'],'head':head,'verifiedOwnedBlobs':len(paths),'observedUtc':o['observedUtc'],'terminalStatus':None}))
