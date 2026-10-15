"""Publish the actual single launch and first opening state; never invoke the proof."""
import datetime,pathlib,subprocess,sys
R=pathlib.Path(__file__).resolve().parents[2];REL='WP/batch-proof-startup-be837974-20261015/';S=R/REL
sys.path.insert(0,str(S))
from proof_contract import *
from proof_budget import capacity_gate
import prepare_proof as prep
BASE='6e7036d06e94ab359bc2cf9653c980a673c0e816';D=S/'first-proof230000-opening-publication-once';L=S/('proof-launch-'+ROOT_NAME);W=S/'execute-reviewed-launch6203010192-once';O=S/'first-proof230000-readonly-observation-once'
def git(*a):return subprocess.check_output(['git','-c','core.longpaths=true',*a],cwd=R)
def oid(raw):return hashlib.sha1(('blob '+str(len(raw))+'\0').encode()+raw).hexdigest()
require(git('rev-parse','HEAD').decode().strip()==BASE and git('branch','--show-current').decode().strip()=='audit/release-eb6de2e8' and not git('diff','--cached','--name-only').strip() and not D.exists(),'Same writer/base/one publication required')
closed=exact_json((W/'exit-original.json').read_bytes());require(closed['status']=='REVIEWED_STARTUP_LAUNCHER_CLOSED_INSPECT_SAME_UNIT' and closed['exitCode']==0,'Actual launcher closure required')
before=exact_json((L/'metadata-capacity-before-root-stdout.log').read_bytes());after=exact_json((L/'metadata-capacity-immediately-before-unit-stdout.log').read_bytes());capacity_gate(before,'BEFORE_ROOT',10137600);capacity_gate(after,'BEFORE_UNIT',0)
require({p:v['device'] for p,v in before['hardware'].items()}=={p:v['device'] for p,v in after['hardware'].items()},'Hardware changed')
launch=exact_json((L/'launch-record.json').read_bytes());require(launch['launchExitCode']==0 and launch['root']==str(ROOT) and launch['unit']=='lims-'+ROOT_NAME.lower(),'Actual launch differs')
obs=exact_json((O/'stdout-original.json').read_bytes());props=dict(line.split('=',1) for line in obs['systemctl']['stdout'].splitlines() if '=' in line)
require(obs['systemctl']['exitCode']==0 and props['ActiveState']=='active' and props['SubState']=='running' and props['InvocationID']=='b962da09082d4fb49c8b9076181b7f4c' and props['MemoryMax']=='805306368' and props['MemorySwapMax']=='0' and props['RuntimeMaxUSec']=='1h 30min','Actual active opening and limits required')
package=exact_json((S/'reviewed-package6203010192-publication-once/package-publication-validation.json').read_bytes())
require({n:r['sha256'] for n,r in obs['packageHashes'].items()}==package['packageFileHashes'] and len(obs['packageHashes'])==42,'All uploaded package hashes differ')
require(not any(n in obs['selectedOriginalUtf8'] for n in ['proof-receipt.json','proof-terminal-refusal.json']),'Opening already has a terminal result; retain honestly in new successor')
index=exact_json((S/'actual-source-pass6203010192-once/tooling-source-index.json').read_bytes());review=exact_json((S/'actual-source-pass6203010192-once/actual-source-pass-original.json').read_bytes());approval(review,index)
for n,d in graph(index).items():require(sha((S/n).read_bytes())==d,'Source changed '+n)
frozen=exact_json((R/'WP/startup-order-readiness-20261015/full-pinned-copy-retention-bound-ordinary-once/source-before.json').read_bytes());require(len(frozen)==1333,'Frozen inventory differs')
for p,d in frozen.items():require(sha((R/p).read_bytes())==d,'Application input changed '+p)
evidence=prep.current_evidence(review,index)
D.mkdir()
def save(n,raw):
    with (D/n).open('xb') as f:f.write(raw)
save('fresh-current-authority-evidence.json',canonical(evidence)+b'\n')
record={'status':'ONE_REVIEWED_STARTUP_PROOF_ACTIVE_AT_FIRST_OBSERVATION_NO_TERMINAL_CLAIM','observedUtc':obs['observedUtc'],'publishedAtDraftUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sourceCommit':index['head'],'sourceReviewId':review['id'],'sourcePassPublication':'405025be0480c7ccabc78593071b1d42fc92f179','packagePublication':BASE,'root':str(ROOT),'unit':launch['unit'],'invocationId':props['InvocationID'],'actualUnitProperties':props,'launcherClosedUtc':closed['closedUtc'],'beforeRootR4':before,'immediatelyBeforeUnitR4':after,'all42RemotePackageHashesVerified':True,'fileCountAtObservation':len(obs['fileMetadata']),'noTerminalResultAtObservation':True,'all14And1333HashesUnchanged':True,'rootUnitPackageAndLauncherConsumedNeverReplay':True,'proofComplete':False,'scope':SCOPE,'retryAllowed':False,'jobsOnKitGateDeploymentStillRequired':True}
save('opening-record.json',canonical(record)+b'\n')
lead=f'''LATEST ACTUAL PROOF OPENING — {obs['observedUtc']}. ONE reviewed29fa/PASS6203010192/42-filepackage6e7036d0 launcher CLOSED{closed['closedUtc']}exit0. NEW230000root/unit CONSUMED NEVERretryreplay. Actualinvocation{props['InvocationID']} ACTIVE/running/MainPID{props['MainPID']}/MemoryMax805306368Swap0Runtime90min/current{props['MemoryCurrent']}peak{props['MemoryPeak']} OPENONLY;47files/all42remotepackagehashesmatch/no terminalreceipt orfailure atopening. ActualbeforeROOT{before['observedUtc']}required{before['requiredBytes']}free{min(before['freeBytes'].values())}; immediatelybeforeUNIT{after['observedUtc']}required{after['requiredBytes']}free{min(after['freeBytes'].values())};threepathsSAMEFS64769/notadditive/10GBincluded/exactpackage10137600chargedBEFOREROOTONLY. RuntimeR4 remainscontrollerobligation. All14+1333unchanged/freshmainCI4audits6rules2postrebootpins/R2accepted/nolaterfailure verified. Fullrawlaunch/opening/publication at {REL}first-proof230000-opening-publication-once/publication-index.json. NEXT reasonableintervalNEWuniqueREADONLYobserver SAMErootunit; unknowninspectNEVERredispatch. ActualCLOSEDretainALLoriginals/fulljournals/packagehashes/healthpolls/preservation/accounting thenpublishONE@claude162result/PASSACKONLYthere. No sourcechange/secondwriter/retry/cleanup/productionDB/settings/restart/kit/gate/deploy. Scope2jobsOFFstarts/notreleasequalified/jobsONlater/mainmergeHOLD/heartbeat2min/sciencehistoryR1-R5/humans held.

'''
readmes=[R/'WP/audit-release-eb6de2e8/README.md',R/'WP/runtime-recovery-kobo/README.md']
for p in readmes:p.write_bytes(lead.encode()+p.read_bytes())
paths=sorted(L.iterdir())+sorted(W.iterdir())+sorted(O.iterdir())+sorted(D.iterdir())+[R/'WP/backlog-resume-20261013/execute-startup-proof-reviewed-launch6203010192-once.py',R/'WP/backlog-resume-20261013/observe-startup-proof230000-first-readonly-once.py',pathlib.Path(__file__),*readmes]
require(all(p.is_file() for p in paths),'Regular owned files required')
save('publication-index.json',canonical({'baseAudit':BASE,'files':[{'path':p.relative_to(R).as_posix(),'length':len(p.read_bytes()),'sha256':sha(p.read_bytes()),'gitBlobOid':oid(p.read_bytes())} for p in paths]})+b'\n');paths.append(D/'publication-index.json');names=[p.relative_to(R).as_posix() for p in paths]
require(len(names)==len(set(names)),'Duplicate path')
for i in range(0,len(names),15):git('-c','core.autocrlf=false','add','-f','--',*names[i:i+15])
require(set(git('diff','--cached','--name-only').decode().splitlines())==set(names),'Staged ownership differs');tree=git('write-tree').decode().strip()
for p,n in zip(paths,names):require(git('show',tree+':'+n)==p.read_bytes() and git('rev-parse',tree+':'+n).decode().strip()==oid(p.read_bytes()),'Staged raw identity differs')
git('commit','-m','Retain approved startup proof launch and first opening');head=git('rev-parse','HEAD').decode().strip()
for p,n in zip(paths,names):require(git('show',head+':'+n)==p.read_bytes(),'Committed raw identity differs')
git('push','origin','audit/release-eb6de2e8');require(git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head,'Published writer differs')
print(json.dumps({'audit':head,'rawOidShaVerifiedBlobs':len(paths),'invocationId':props['InvocationID'],'observedUtc':obs['observedUtc'],'proofComplete':False,'newOperatorCalls':0}))
