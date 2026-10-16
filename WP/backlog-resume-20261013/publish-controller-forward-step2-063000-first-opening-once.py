"""Publish the actual single launch and first opening state; never invoke the proof."""
import datetime,pathlib,subprocess,sys
R=pathlib.Path(__file__).resolve().parents[2];REL='WP/batch-proof-controller-forward-step2-be837974-20261016/';S=R/REL
sys.path.insert(0,str(S))
from proof_contract import *
from proof_budget import capacity_gate
import prepare_proof as prep
BASE='d8c77aa1e002bc1ef77a04c943113c3d822dcb53';D=S/'first-controller-forward-063000-opening-publication-once';L=S/('proof-launch-'+ROOT_NAME);W=S/'execute-reviewed-launch6208186148-once';O=S/'first-controller-forward-063000-readonly-observation-once'
def git(*a):return subprocess.check_output(['git','-c','core.longpaths=true',*a],cwd=R)
def oid(raw):return hashlib.sha1(('blob '+str(len(raw))+'\0').encode()+raw).hexdigest()
require(git('rev-parse','HEAD').decode().strip()==BASE and git('branch','--show-current').decode().strip()=='audit/release-eb6de2e8' and not git('diff','--cached','--name-only').strip() and not D.exists(),'Same writer/base/one publication required')
closed=exact_json((W/'exit-original.json').read_bytes());require(closed['status']=='REVIEWED_JOBS_LAUNCHER_CLOSED_INSPECT_SAME_UNIT' and closed['exitCode']==0,'Actual launcher closure required')
before=exact_json((L/'metadata-capacity-before-root-stdout.log').read_bytes());after=exact_json((L/'metadata-capacity-immediately-before-unit-stdout.log').read_bytes());capacity_gate(before,'BEFORE_ROOT',10764288);capacity_gate(after,'BEFORE_UNIT',0)
require({p:v['device'] for p,v in before['hardware'].items()}=={p:v['device'] for p,v in after['hardware'].items()},'Hardware changed')
launch=exact_json((L/'launch-record.json').read_bytes());require(launch['launchExitCode']==0 and launch['root']==str(ROOT) and launch['unit']=='lims-'+ROOT_NAME.lower(),'Actual launch differs')
obs=exact_json((O/'stdout-original.json').read_bytes());props=dict(line.split('=',1) for line in obs['systemctl']['stdout'].splitlines() if '=' in line)
require(obs['systemctl']['exitCode']==0 and props['ActiveState']=='active' and props['SubState']=='running' and props['InvocationID']=='797d78bb476a4fff8b8ffce6c9445847' and props['MemoryMax']=='805306368' and props['MemorySwapMax']=='0' and props['RuntimeMaxUSec']=='1h 30min','Actual active opening and limits required')
package=exact_json((S/'reviewed-package6208186148-publication-once/package-publication-validation.json').read_bytes())
require({n:r['sha256'] for n,r in obs['packageHashes'].items()}==package['packageFileHashes'] and len(obs['packageHashes'])==59,'All uploaded package hashes differ')
require(not any(n in obs['selectedOriginalUtf8'] for n in ['proof-receipt.json','proof-terminal-refusal.json']),'Opening already has a terminal result; retain honestly in new successor')
index=exact_json((S/'actual-source-pass6208186148-once/tooling-source-index.json').read_bytes());review=exact_json((S/'actual-source-pass6208186148-once/actual-source-pass-original.json').read_bytes());approval(review,index)
for n,d in graph(index).items():require(sha((S/n).read_bytes())==d,'Source changed '+n)
frozen=exact_json((R/'WP/startup-order-readiness-20261015/full-pinned-copy-retention-bound-ordinary-once/source-before.json').read_bytes());require(len(frozen)==1333,'Frozen inventory differs')
for p,d in frozen.items():require(sha((R/p).read_bytes())==d,'Application input changed '+p)
# Independently rederive the retained seven raw reads, without a new host read.
from controller_guard import parse_events,UNIT as CGUNIT
mem=exact_json(obs['selectedOriginalUtf8']['controller-memory-before.json'])
raws=[exact_json(obs['selectedOriginalUtf8']['controller-memory-before-raw-'+str(i).zfill(2)+'.json']) for i in range(1,8)]
expected_paths=['/proc/'+props['MainPID']+'/cgroup']+['/sys/fs/cgroup/system.slice/'+CGUNIT+'/'+n for n in ['memory.events','memory.current','memory.peak','memory.max','memory.swap.max']]+['/proc/'+props['MainPID']+'/cgroup']
require([r['path'] for r in raws]==expected_paths and raws[0]==raws[-1],'Numeric exact controller raw paths differ')
for r in raws:
    data=r['rawAscii'].encode('ascii');require(len(data)==r['bytes'] and sha(data)==r['sha256'],'Controller raw identity differs')
require(mem['unit']==CGUNIT and mem['membershipRaw']==raws[0]['rawAscii']=='0::/system.slice/'+CGUNIT+'\n','Exact controller membership differs')
require(type(mem['cgroupDevice']) is int and type(mem['cgroupInode']) is int and mem['cgroupDevice']==24 and mem['cgroupInode']==34168,'Recorded cgroup identity differs')
for r,n in zip(raws[1:6],['memory.events','memory.current','memory.peak','memory.max','memory.swap.max']):require(mem['raw'][n]==r['rawAscii'] and mem['sha256'][n]==r['sha256'],'Snapshot/raw mismatch')
require(parse_events(raws[1]['rawAscii'].encode())==mem['events'] and mem['events']['oom']==mem['events']['oom_kill']==0,'Recorded controller OOM guard differs')
for n,value in mem['scalars'].items():require(int(mem['raw'][n].strip())==value,'Recorded controller scalar differs')
require(mem['scalars']['memory.max']==805306368 and mem['scalars']['memory.swap.max']==0 and mem['peakMaxHighObservationOnly'] is True,'Recorded controller limits differ')
journal=[exact_json(line.encode()) for line in obs['journal']['stdout'].splitlines() if line]
require(obs['journal']['exitCode']==0 and not obs['journal']['stderr'] and len(journal)==2 and all(r['_PID']=='1' and r['INVOCATION_ID']==props['InvocationID'] and r['MESSAGE'].startswith(('Starting /usr/bin/python3 -B ','Started /usr/bin/python3 -B ')) for r in journal),'Opening journal contains unexpected content; review before publication')
evidence=prep.current_evidence(review,index)
D.mkdir()
def save(n,raw):
    with (D/n).open('xb') as f:f.write(raw)
save('fresh-current-authority-evidence.json',canonical(evidence)+b'\n')
record={'status':'ONE_REVIEWED_JOBS_PROOF_ACTIVE_AT_FIRST_OBSERVATION_NO_TERMINAL_CLAIM','observedUtc':obs['observedUtc'],'publishedAtDraftUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sourceCommit':index['head'],'sourceReviewId':review['id'],'sourcePassPublication':'859239963c25393a2619a1d73795f33e020e94dd','packagePublication':BASE,'root':str(ROOT),'unit':launch['unit'],'invocationId':props['InvocationID'],'actualUnitProperties':props,'launcherClosedUtc':closed['closedUtc'],'beforeRootR4':before,'immediatelyBeforeUnitR4':after,'all59RemotePackageHashesVerified':True,'fileCountAtObservation':len(obs['fileMetadata']),'noTerminalResultAtObservation':True,'all31And1333HashesUnchanged':True,'rootUnitPackageAndLauncherConsumedNeverReplay':True,'proofComplete':False,'scope':SCOPE,'retryAllowed':False,'jobsOnKitGateDeploymentStillRequired':True}
record['controllerBeforeSevenRawReadsIndependentlyVerified']=True;record['controllerBeforeSnapshot']=mem;record['journalContentReviewed']='Two PID1 start lifecycle records only'
save('opening-record.json',canonical(record)+b'\n')
lead=f'''LATEST ACTUAL SINGLE CONTROLLER-FORWARD063000 LAUNCH + ACTIVE OPENING - {obs['observedUtc']}.
Actual exact source572d8cc94ee5a98c29392f556a57133cedd13128/PASS6208186148/ALL31SHA+179tokens approved ONE new063000 qualification attempt. Full approval/currentauthority/all659source+57handoff/rawGitOID-SHA-length verification published85923996/48raw. ONE59-file approvedpackage prepared04:42:53.078066UTC/publishedd8c77aa1/70raw/futureallocation10764288B. ONE unchanged reviewedlauncher CLOSED{closed['closedUtc']}/exit0; root {ROOT}/unit{launch['unit']} NOWCONSUMED NEVERredispatchretryreplaycleanup.
Actual start04:44:50UTC/invocation{props['InvocationID']}/MainPID{props['MainPID']} ACTIVE/running/MemoryMax805306368Swap0/Runtime90min/TimeoutStop300/exactroot ExecStopPost. Opening Current{props['MemoryCurrent']}/Peak{props['MemoryPeak']} CONTROLLER OBSERVATIONS ONLY/notapppeak/closedresult. All59 uploaded0400package SHA match/{len(obs['fileMetadata'])}rootfiles. NO startupresult/proofreceipt/terminalrefusal observed; activeResultsuccess/ExecMainStatus0 NOTclosedPASS. Bothkeys privateHOST/no privatebytesfetched. Openingjournal fullyreviewed:two PID1 start records only.
ACTUAL numeric /proc/{props['MainPID']}/cgroup controller before guard PASSED with exact newunitmembership, cgroupdevice24inode34168, memorymax805306368/swap0/eventsOOM0. ALL7 original rawreadfiles SHA+length/path/order/identicalmembershipreads/scalars/events independentlyrederived against controller-memory-before.json; this is initialguard ONLY/no after/stop-post/closedPASS inferred. Rawreads preserved BEFORE predicates by reviewedruntime. Runtime freshR4-beforecopies notyetobserved atopening.
Fresh R4 BEFORE ROOT {before['observedUtc']} required{before['requiredBytes']}/free{min(before['freeBytes'].values())} EACH3; immediately BEFORE UNIT {after['observedUtc']} required{after['requiredBytes']}/free{min(after['freeBytes'].values())} EACH3. SAMEFS64769/4096/nonadditive/ADDITIONAL10GB/exact10764288futurepackage chargedbeforeROOTONLY/alreadyoccupied beforeUNIT-runtime. All4 actualremoteprograms compiledBEFOREfirstSSH/freshsourcePASSauthoritiesunusedrootunit verified. All31+1333 unchanged/currentmainbeCI38772398721attempt1pushCLOSEDSUCCESS/4audits6rules2postrebootmemoryjobsdiagnosticprivacyacceptancecontroller620791R2/#191CLOSED/no laterfailure verified.
NEXTreasonableinterval NEWunique READONLYobserver SAMErootunitinvocation/latest2FULLhealth+memory ORIGINALS/counts/runtimeR4/status; no freshproduction-memory sampling/SQL/du/redispatch/sourceedit/stop/retry/cleanup/concurrentwriter. OnACTUALCLOSED retainALLpublicraws/privatehashstatONLY/ALLhealthmemory/fulljournal+ExecStopPoststatus/59package/inputpreservation/accounting. IndependentlyvalidateOFF31API6probes+full11242,2NATURALsyncs strictprovenance/secondidempotence/refusals/science/container805600/budgets. Closedacceptance requires controllerbeforeafterraws samecgroupOOM0, stop-postBOTHowners stoppedAndRetained NOTVACUOUS/postStopErrorsEMPTY/controllerOOM0/journalhookexit0; runtimeAWAITING_EXEC_STOP_POST isNOTclosedPASS. Review ALLjobsONrawlogs beforepublicGit; bothprivatekeys+DBs HOST withheld. ONEeventualactualresult@claude162 bundles620818PASS ACK ONLYthere/no duplicateGH/native/ACK. Newsource04:50:39nativefallbackCANCELLED/answered. UnknowninspectSAMEconsumedrootunit neverredispatch; failurehonest/newseparatelyauditedforwardfixONLY/no oldhelperreplay.
Scope qualificationONLY/no kitgate deploy/MainMERGEHOLD. Strictpairing/orphans/fullpreservation/EVERYcontainer805600/N25MIN64/floor4GiBlogs10GB/500MB unchanged. Futurekit174newEXPECTED22holds20existingZMB-LAB1/managerimpact/countsmaydiff +9to10minrestart/exact600failure. 233000KEEPIT/R2COMPLETE/noprune/YY320GiBvisible/no growrestart/no103/noagentsnewchatworktreecheckoutconcurrentwriter/humansheld. SAMEheartbeatACTIVE2min/restore10ONLYactualbeDEPLOYED+ClactualpostdeployPASS. Full launch/opening/currentauthority at {REL}first-controller-forward-063000-opening-publication-once/publication-index.json. All063000PASS/package/operators/helpers NOWCONSUMED. Preserve ALL older history verbatim below.

'''
save('checkpoint-prefix.txt',lead.encode())
readmes=[R/'WP/audit-release-eb6de2e8/README.md',R/'WP/runtime-recovery-kobo/README.md']
for p in readmes:p.write_bytes(lead.encode()+p.read_bytes())
paths=sorted(L.iterdir())+sorted(W.iterdir())+sorted(O.iterdir())+sorted(D.iterdir())+[R/'WP/backlog-resume-20261013/execute-controller-forward-reviewed-launch6208186148-once.py',R/'WP/backlog-resume-20261013/observe-controller-forward-step2-063000-first-readonly-once.py',pathlib.Path(__file__),*readmes]
require(all(p.is_file() for p in paths),'Regular owned files required')
save('publication-index.json',canonical({'baseAudit':BASE,'files':[{'path':p.relative_to(R).as_posix(),'length':len(p.read_bytes()),'sha256':sha(p.read_bytes()),'gitBlobOid':oid(p.read_bytes())} for p in paths]})+b'\n');paths.append(D/'publication-index.json');names=[p.relative_to(R).as_posix() for p in paths]
require(len(names)==len(set(names)),'Duplicate path')
for i in range(0,len(names),15):git('-c','core.autocrlf=false','add','-f','--',*names[i:i+15])
require(set(git('diff','--cached','--name-only').decode().splitlines())==set(names),'Staged ownership differs');tree=git('write-tree').decode().strip()
for p,n in zip(paths,names):require(git('show',tree+':'+n)==p.read_bytes() and git('rev-parse',tree+':'+n).decode().strip()==oid(p.read_bytes()),'Staged raw identity differs')
git('commit','-m','Retain approved jobs proof launch and first opening');head=git('rev-parse','HEAD').decode().strip()
for p,n in zip(paths,names):require(git('show',head+':'+n)==p.read_bytes(),'Committed raw identity differs')
git('push','origin','audit/release-eb6de2e8');require(git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head,'Published writer differs')
print(json.dumps({'audit':head,'rawOidShaVerifiedBlobs':len(paths),'invocationId':props['InvocationID'],'observedUtc':obs['observedUtc'],'proofComplete':False,'newOperatorCalls':0}))
