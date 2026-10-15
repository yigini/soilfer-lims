"""Retain the actual one-time startup launch and first OPEN observation."""
import json,pathlib,subprocess,sys
REPO=pathlib.Path(__file__).resolve().parents[2];S=REPO/'WP/batch-proof-startup-forward-cde8-20261015';BASE='7a6b27ac8f2d8e29eaa3cb49c7ffb16ecade8198'
sys.path.insert(0,str(S))
from proof_contract import *
from proof_budget import capacity_gate
from prepare_proof import raw_git
def cmd(*a):return subprocess.check_output(a,cwd=REPO)
require(cmd('git','rev-parse','HEAD').decode().strip()==BASE and not cmd('git','diff','--cached','--name-only').strip(),'Writer/staging moved')
require(cmd('git','ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==BASE,'Remote moved')
o=exact_json((S/'first-proof-090000-first-observation-once/stdout-original.json').read_bytes())
p=dict(l.split('=',1) for l in o['systemctlOriginal'].splitlines() if '=' in l)
require(p['ActiveState']=='active' and p['SubState']=='running' and p['InvocationID']=='8e25207352d1443fa86da77471b838e0' and p['MemoryMax']=='805306368' and p['MemorySwapMax']=='0' and p['RuntimeMaxUSec']=='1h 30min','Opening differs')
require(o['root']==str(ROOT) and not any(n in o['closedImmutableSelectedJson'] for n in ['proof-receipt.json','proof-terminal-refusal.json']),'Wrong root or terminal evidence')
capacities={}
for n in ['metadata-capacity-before-root','metadata-capacity-immediately-before-unit']:
 v=exact_json((S/('proof-launch-'+ROOT_NAME)/(n+'-stdout.log')).read_bytes());capacity_gate(v);capacities[n]=v
out=S/'first-proof-090000-opening-index.json';require(not out.exists(),'Consumed opening retainer')
lead='## 2026-10-15 actual090000 startup-only proof launched ONCE / OPEN '+o['observedUtc']+'\n\nActual0541865b SourcePASS6187743927 retained858efc75; one40filepackage retained7a6b27ac. ONE090000unit started08:28:22UTC/invocation'+p['InvocationID']+'. Both fresh metadata capacity gates passed08:27:59.049965UTC BEFOREroot/free33100660736 and08:28:21.819928UTC immediatelyBEFOREunit/free33093120000 versusrequired31768290414/T563326976/A5787648/30equiv/tablec74e17c1. Freshall12source/newPASS/currentmainCI3audits/nolaterfailure/unusedrootunit passed. ReadonlyOPEN08:30:04.841165UTC active/running/73files/Current805298176/Peak805306368 OPENONLY/MemoryMax805306368/Swap0/Runtime90min/no selectedterminalJSON. No startup result or wholeproofPASS inferred. SAMEremotecontrolleronly/no localrunnerretainer. Allrootunit/package/launch/firstobserverhelpers consumed NEVERreplay/retry/stop/sourceedit/cleanup/concurrentwriter. NEXTreasonableinterval NEWunique200000fileboundcompactobserver; actualclosedreceiptORfailure/fulljournal/systemctl/stablehashinventory/allJSONlogs/fullstoppedcontainers/safeNORMALmetadata/existingphysicalaccounting retain honestly viaNEWuniqueclosedretainer/noSQL/DBfetch/newdu/replay.\n\nScopeTWOnewordinaryjobsOFFstartsONLY/NOT_RELEASE_QUALIFIED. Bound080000dd496777 installed209rawreaderbackup+recorded11242/fullpreservation214209/zero209impacts/chart8060contexts10labs/070000assets retained; no oldSQL/newproductionsnapshot/installerpolicyimpactreplay. Inputrechecks/Compose-derivedexactHealthcheckprestart/unhealthyimmediateSTOP/27NOOP0+26READY0/HTTP200200401/fullstoppedequality mandatory. N24/30equiv/25percent/min64droppedexplicit6187223904/3assets/floor10556150894/logs4GiB/500MB/physicaldu-xcaps/memory805blankheapSwap0/readiness600unit5400headroom60+600/YYpins/science/history/forwardonlyno103 allhold. AfterANYentrypointattempt onlyseparatelyauditedforwardfix/no retry. QualifiedB5c03B1/NORMALhealthy959d7a8109/cde8mainCI3audits unchanged; alloldfailedrootsrawscontainers immutable. JobsONnaturalintake+broadpostflights/exactkitfreshsingleusegate later. IndependentYY6187300253 listONLY31failedcandidates captured08:23:13/no deletions; publication/dependencyreport pending/070000080000qualifiedbuild excluded. No duplicateACK/request/native/notice. Samewriterworktreebranch/noagents/newchat/checkout/broadstage/resetclean/unrelateddirt.\n\n'
readme=REPO/'WP/audit-release-eb6de2e8/README.md';readme.write_bytes(lead.encode()+readme.read_bytes())
paths=[]
for n in ['approved-launch-execution-once','proof-launch-'+ROOT_NAME,'first-proof-090000-first-observation-once']:
 paths.extend(sorted(x for x in (S/n).rglob('*') if x.is_file()))
paths += [S/'opening-retainer-initial-refusal-transcription.json', REPO/'WP/backlog-resume-20261013/retain-startup-forward-090000-opening-once.py',pathlib.Path(__file__),REPO/'WP/backlog-resume-20261013/execute-reviewed-startup-forward-launch-once.py',REPO/'WP/backlog-resume-20261013/observe-startup-forward-090000-first-boundary-readonly-once.py',readme]
record={'status':'ACTUAL_ONCE_STARTUP_FORWARD_LAUNCHED_OPEN_NOT_COMPLETE','observedUtc':o['observedUtc'],'sourceCommit':'0541865b67af0fbf3232d7cb077ab505896a2ced','actualSourcePass':6187743927,'root':o['root'],'unit':o['unit'],'invocation':p['InvocationID'],'limits':{'memoryMax':805306368,'swapMax':0,'runtimeSeconds':5400},'memoryCurrentAtOpen':p['MemoryCurrent'],'memoryPeakAtOpenNotFinal':p['MemoryPeak'],'capacityChecks':capacities,'selectedImmutableInputRecords':list(o['closedImmutableSelectedJson']),'startupResults':None,'terminalProofStatus':None,'jobsOnQualificationStillRequired':True,'neverReplay':True,'files':[{'path':x.relative_to(REPO).as_posix(),'bytes':x.stat().st_size,'sha256':sha(x.read_bytes())} for x in paths]}
with out.open('xb') as f:f.write(canonical(record)+b'\n')
paths.append(out);rels=[x.relative_to(REPO).as_posix() for x in paths];require(len(set(rels))==len(rels),'Duplicate paths')
for start in range(0,len(rels),15):cmd('git','-c','core.autocrlf=false','-c','core.longpaths=true','add','-f','--',*rels[start:start+15])
require(set(cmd('git','diff','--cached','--name-only').decode().splitlines())==set(rels),'Unowned staging');tree=cmd('git','write-tree').decode().strip()
for x,r in zip(paths,rels):require(raw_git(tree,r)[0]==x.read_bytes(),'Staged raw differs')
cmd('git','commit','-m','Retain one approved startup-only launch and actual090000 opening');head=cmd('git','rev-parse','HEAD').decode().strip()
for x,r in zip(paths,rels):require(raw_git(head,r)[0]==x.read_bytes(),'Committed raw differs')
cmd('git','push','origin','audit/release-eb6de2e8');require(cmd('git','ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head,'Remote differs')
print(json.dumps({'status':record['status'],'head':head,'verifiedOwnedBlobs':len(paths),'invocation':p['InvocationID'],'observedUtc':o['observedUtc'],'files':len(o['fileInventory'])}))
