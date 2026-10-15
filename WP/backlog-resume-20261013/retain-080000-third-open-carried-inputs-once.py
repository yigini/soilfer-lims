"""Retain the same OPEN proof's completed one-copy handoff, without running it."""
import json,pathlib,subprocess,sys
REPO=pathlib.Path(__file__).resolve().parents[2];SOURCE=REPO/'WP/batch-proof-forward-resume-cde8-20261015';BASE='a3f289ccbccaefb877ff623b809ec03d1e3400c1'
sys.path.insert(0,str(SOURCE))
from proof_contract import *
from prepare_proof import raw_git
def cmd(*a):return subprocess.check_output(a,cwd=REPO)
require(cmd('git','rev-parse','HEAD').decode().strip()==BASE and not cmd('git','diff','--cached','--name-only').strip(),'Writer/staging moved')
require(cmd('git','ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==BASE,'Remote moved')
dest=SOURCE/'first-proof-080000-third-observation-once';o=exact_json((dest/'stdout-original.json').read_bytes());p=dict(l.split('=',1) for l in o['systemctlOriginal'].splitlines() if '=' in l)
require(p['ActiveState']=='active' and p['SubState']=='running' and p['InvocationID']=='0cb103307f4240689a630b3666545772','Actual observation differs')
require(not any(n in o['closedImmutableSelectedJson'] for n in ['proof-receipt.json','proof-terminal-refusal.json']),'Terminal: retain honestly')
carried=o['closedImmutableSelectedJson']['carried-forward-inputs.json']
require(carried['inputCopies']==1 and carried['inputSqlConnections']==0 and carried['newPolicyOr206InstallerCalls']==0 and carried['newProductionSnapshots']==0 and carried['sourceKind']=='INSTALLED206_SEAL_RAW_TRIPLE_NOT_BACKUP','Actual carried boundary differs')
require(carried['priorBaseline']['tableCount']==106 and carried['priorBaseline']['schemaReceiptCount']==39 and carried['prior206Preservation']['totalTables']==108 and carried['prior206Preservation']['schemaReceiptCount']==40,'Bound prior counts differ')
out=SOURCE/'first-proof-080000-third-open-carried-inputs-index.json';require(not out.exists(),'Consumed retainer')
lead='## 2026-10-15 same080000 OPEN07:00:22 / actual RAW206 one-copy handoff\n\nSame0cb103307f4240689a630b3666545772 active/running/78files/Current805261312/Peak805306368 OPENONLY/Max805306368/Swap0/90min. Sealedcarried-forward-inputs.json nowobserved: installed206sealRAWTRIPLEnotbackup/inputCopies1/inputSqlConnections0/newProductionSnapshots0/newPolicyOr206InstallerCalls0/logicalstatevalidatedbyrecordedreaderbackuphashes. Bound070000DBhandoff04:48:21.084110UTC+separateasset04:50:23.318865UTC/noatomicity/10639baseline+10840installed206 remainprioractualfacts, notnewproductioncounts. Corrected206afterclosureevaluationpreviouslyobserved/NOToldunsealedtuples/no206replay. Forwardstagephysicalclosure notyetobserved;214209science/11242/startups/terminalresultUNKNOWN. Secondobservation8rawa3f289ccbccaefb877ff623b809ec03d1e3400c1 retained06:59:18/75files/boundT563326976A5787648required45851464814. NoOOM/finalpeak/resultclaim. SAMEremotecontroller/no localrunnerretainer. NextreasonableintervalNEWuniqueobserver200000files/compactsummaryONLY; neverreusefirstsecondthird/stop/retry/sourceedit/cleanup/concurrentwriter. ClosedreceiptORfailure/fulljournal/systemctl/packagehashes/rootstablehashinventory+JSONlogs/safeNORMALmetadata/existingphysicalaccounting/allhistorical+newownedstoppedcontainers retainhonestly/newuniqueclosedretainer/noSQL/DBfetch/newdu/replay. AllYYsciencepolicy/nonzeroYYapprovedSTOP/separateClforwardremedy/retentionfloorlogs500MBdu-x/memoryreadiness/forwardonlyno103humanhistoryguards hold. N44/55/25percent/min64droppedexplicitCl/3assetreserve unchanged. NOT_RELEASE_QUALIFIED/jobsOFFonly/jobsONnaturalintake+broadpostflights/exactkitfreshgate later.\n\n'
readme=REPO/'WP/audit-release-eb6de2e8/README.md';readme.write_bytes(lead.encode()+readme.read_bytes())
paths=sorted(q for q in dest.iterdir() if q.is_file())+[pathlib.Path(__file__),REPO/'WP/backlog-resume-20261013/observe-stopped-copy-080000-third-boundary-readonly-once.py',readme]
record={'status':'ACTUAL_OPEN_RAW206_ONE_COPY_HANDOFF_NOT_PROOF_COMPLETE','observedUtc':o['observedUtc'],'invocation':p['InvocationID'],'root':o['root'],'unit':o['unit'],'fileCount':len(o['fileInventory']),'memoryCurrentOpenOnly':int(p['MemoryCurrent']),'memoryPeakOpenOnly':int(p['MemoryPeak']),'carriedForwardInputs':carried,'actual214209ScientificLists':None,'terminalStatus':None,'neverReplay':True,'files':[{'path':q.relative_to(REPO).as_posix(),'bytes':q.stat().st_size,'sha256':sha(q.read_bytes())} for q in paths]}
with out.open('xb') as f:f.write(canonical(record)+b'\n')
paths.append(out);rels=[q.relative_to(REPO).as_posix() for q in paths]
cmd('git','-c','core.autocrlf=false','add','-f','--',*rels);require(set(cmd('git','diff','--cached','--name-only').decode().splitlines())==set(rels),'Unowned staging');tree=cmd('git','write-tree').decode().strip()
for q,rel in zip(paths,rels):require(raw_git(tree,rel)[0]==q.read_bytes(),'Staged raw differs')
cmd('git','commit','-m','Retain same forward proof raw206 one-copy handoff at open boundary');head=cmd('git','rev-parse','HEAD').decode().strip()
for q,rel in zip(paths,rels):require(raw_git(head,rel)[0]==q.read_bytes(),'Committed raw differs')
cmd('git','push','origin','audit/release-eb6de2e8');require(cmd('git','ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head,'Remote differs')
print(json.dumps({'status':record['status'],'head':head,'verifiedOwnedBlobs':len(paths),'observedUtc':o['observedUtc'],'terminalStatus':None}))
