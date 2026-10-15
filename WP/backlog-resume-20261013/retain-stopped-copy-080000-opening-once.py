"""Retain one actual forward launch and OPEN observation without inferring PASS."""
import json,pathlib,subprocess,sys
REPO=pathlib.Path(__file__).resolve().parents[2];SOURCE=REPO/'WP/batch-proof-forward-resume-cde8-20261015';BASE='96c888b4646ba47fa3be5b5889b1878cfd04fb4c'
sys.path.insert(0,str(SOURCE))
from proof_contract import *
from proof_budget import capacity_gate
from prepare_proof import raw_git
def cmd(*a):return subprocess.check_output(a,cwd=REPO)
require(cmd('git','rev-parse','HEAD').decode().strip()==BASE and not cmd('git','diff','--cached','--name-only').strip(),'Writer/staging moved')
require(cmd('git','ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==BASE,'Remote moved')
observation=exact_json((SOURCE/'first-proof-080000-first-observation-once/stdout-original.json').read_bytes())
props=dict(l.split('=',1) for l in observation['systemctlOriginal'].splitlines() if '=' in l)
require(props['ActiveState']=='active' and props['SubState']=='running' and props['InvocationID']=='0cb103307f4240689a630b3666545772' and props['MemoryMax']=='805306368' and props['MemorySwapMax']=='0' and props['RuntimeMaxUSec']=='1h 30min','Actual opening differs')
require(observation['root']==str(ROOT) and not any(n in observation['closedImmutableSelectedJson'] for n in ['proof-receipt.json','proof-terminal-refusal.json']),'Wrong root or terminal evidence at opening')
capacities={}
for n in ['metadata-capacity-before-root','metadata-capacity-immediately-before-unit']:
    v=exact_json((SOURCE/('proof-launch-'+ROOT_NAME)/(n+'-stdout.log')).read_bytes());capacity_gate(v);capacities[n]=v
out=SOURCE/'first-proof-080000-opening-index.json';require(not out.exists(),'Opening retention consumed')
lead='## 2026-10-15 actual080000 forward proof launchedONCE / OPEN '+observation['observedUtc']+'\n\nActualb9afSourcePASS6185240820 retained8rawf12a51c5/one41fileimmutablepackage49raw96c888b4. ONEfresh080000unit started06:57:25UTC/invocation'+props['InvocationID']+'. Bothfreshmetadata-capacitygatesPASS BEFOREremoteROOT+immediatelybeforeunit; currentall12source/newPASS/mainCI3audits/nolaterfailure/unusedrootunit passed. ReadonlyOPEN active/running/MemoryMax805306368/Swap0/Runtime90min/Current'+props['MemoryCurrent']+'/Peak'+props['MemoryPeak']+' OPENONLY/'+str(len(observation['fileInventory']))+'files/no selectedterminalJSON. No proof PASS or actual214209counts/scientificlists/11242/startups inferred. ONEremotecontrolleractive/no localrunnerretainer. ObserveSAMEunitroot afterreasonableinterval withNEWuniqueobserver200000filebound/compactsummaryONLY. Neverreplayrootunitlaunchhelpers/stop/retry/sourceedit/cleanup/concurrentwriter. ClosedreceiptORfailure/fulljournal/systemctl/packagehashes/allrootJSONlogs/stablehashinventory/allhistorical+newownedstoppedcontainers/safeNORMALmetadata/actualexistingphysicalaccounting mustretainhonestly/newuniqueclosedhelper/no SQL/DBfetch/newdu/proofreplay.\n\nScopeUPSTREAMownedforward214209/jobsOFFONLY/NOT_RELEASE_QUALIFIED. Bound070000e283DBhandoff04:48:21.084110UTC+separateassets04:50:23.318865UTC/noatomicity/policy206carried/installed10840 onlyhistorical; inputinstalled206sealRAWTRIPLEcopyONCE/no oldSQL/newproductioncopy/policy206replay, corrected206afterclosureevaluationNOTunsealedoldtuples. N44/55/25percent/min64droppedperCl/3assetsreserve/floor10556150894/logs4GiB/500MB/remainingconsumption/physicaldu-xcaps/allretention. Futuremainexact/WALabsentemptyONLYequivalence/nonemptyexact/0400comparedstatesbeforeSTOP/NOOPinteger0backfill0/fullhistorypreservation/BOTHordinaryjobsOFFstarts. AllYYsciencepolicy/nonzeroYYapprovedSTOP/separateforwardremedy/primarysecondaryallocations/memoryreadiness/forwardonly/no103/humanhistoryguards hold. AfterANYinstallerentrypointattempt separatelyauditedforwardfixONLY/no retry. QualifiedB5c03B1/NORMALhealthy959d7a8109/cde8mainCI3audits remain; alloldfailedrootsrawscontainers immutable. JobsONnaturalintake+broadpostflights/exactkitfreshgate later.\n\n'
readme=REPO/'WP/audit-release-eb6de2e8/README.md';readme.write_bytes(lead.encode()+readme.read_bytes())
paths=[]
for name in ['first-proof-080000-launch-wrapper-once','proof-launch-'+ROOT_NAME,'first-proof-080000-first-observation-once']:
    paths.extend(sorted(p for p in (SOURCE/name).rglob('*') if p.is_file()))
paths += [pathlib.Path(__file__),REPO/'WP/backlog-resume-20261013/execute-reviewed-forward-resume-launch-once.py',REPO/'WP/backlog-resume-20261013/observe-stopped-copy-080000-first-boundary-readonly-once.py',readme]
record={'status':'ACTUAL_ONCE_LAUNCHED_OPEN_NOT_PROOF_COMPLETE','observedUtc':observation['observedUtc'],'sourceCommit':'b9af37993632ca10b56943ae894fc0a816b8efcc','actualSourcePass':6185240820,'unit':observation['unit'],'root':observation['root'],'invocation':props['InvocationID'],'actualExecutedLimitsAtOpening':{'memoryMax':805306368,'swapMax':0,'runtimeSeconds':5400},'memoryCurrentAtOpen':props['MemoryCurrent'],'memoryPeakAtOpenNotFinal':props['MemoryPeak'],'capacityChecks':capacities,'terminalProofStatus':None,'actual214209ScientificLists':None,'jobsOnQualificationStillRequired':True,'neverReplay':True,'files':[{'path':p.relative_to(REPO).as_posix(),'bytes':p.stat().st_size,'sha256':sha(p.read_bytes())} for p in paths]}
with out.open('xb') as f:f.write(canonical(record)+b'\n')
paths.append(out);rels=[p.relative_to(REPO).as_posix() for p in paths];require(len(rels)==len(set(rels)),'Duplicate owner')
for start in range(0,len(rels),15):cmd('git','-c','core.autocrlf=false','add','-f','--',*rels[start:start+15])
require(set(cmd('git','diff','--cached','--name-only').decode().splitlines())==set(rels),'Unowned staging');tree=cmd('git','write-tree').decode().strip()
for p,rel in zip(paths,rels):require(raw_git(tree,rel)[0]==p.read_bytes(),'Staged raw differs')
cmd('git','commit','-m','Retain one approved forward proof launch and actual open observation');head=cmd('git','rev-parse','HEAD').decode().strip()
for p,rel in zip(paths,rels):require(raw_git(head,rel)[0]==p.read_bytes(),'Committed raw differs')
cmd('git','push','origin','audit/release-eb6de2e8');require(cmd('git','ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head,'Remote differs')
print(json.dumps({'status':record['status'],'head':head,'verifiedOwnedBlobs':len(paths),'invocation':props['InvocationID'],'openingObservation':observation['observedUtc'],'capacityChecks':capacities,'memoryCurrent':props['MemoryCurrent'],'memoryPeakOpenOnly':props['MemoryPeak'],'fileCount':len(observation['fileInventory'])}))
