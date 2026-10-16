"""Publish the same consumed jobs proof's second read-only observation."""
import datetime,pathlib,subprocess,sys
R=pathlib.Path(__file__).resolve().parents[2];REL='WP/batch-proof-controller-forward-step2-be837974-20261016/';S=R/REL
D=S/'third-controller-forward-063000-opening-publication-once';O=S/'third-controller-forward-063000-readonly-observation-once'
BASE='50942915011c3ddb6ca9048aee83e849d92ab7d0'
sys.path.insert(0,str(S))
from proof_contract import *
from proof_budget import capacity_gate
import proof_memory as appmem
import prepare_proof as prep

def git(*a):return subprocess.check_output(['git','-c','core.longpaths=true',*a],cwd=R)
def oid(raw):return hashlib.sha1(('blob '+str(len(raw))+'\0').encode()+raw).hexdigest()
require(git('rev-parse','HEAD').decode().strip()==BASE and git('branch','--show-current').decode().strip()=='audit/release-eb6de2e8' and not git('diff','--cached','--name-only').strip() and not D.exists(),'Same writer/base/unique publication required')
require(exact_json((O/'exit-original.json').read_bytes())['exitCode']==0,'Actual closed observer required')
obs=exact_json((O/'stdout-original.json').read_bytes());props=dict(line.split('=',1) for line in obs['systemctl']['stdout'].splitlines() if '=' in line)
require(obs['root']==str(ROOT) and obs['unit']=='lims-'+ROOT_NAME.lower(),'Wrong proof root/unit')
require(obs['systemctl']['exitCode']==0 and props['ActiveState']=='active' and props['SubState']=='running' and props['InvocationID']=='797d78bb476a4fff8b8ffce6c9445847' and props['MemoryMax']=='805306368' and props['MemorySwapMax']=='0' and props['RuntimeMaxUSec']=='1h 30min','Same active invocation and fixed limits required')
require(not any(n in obs['selectedOriginalUtf8'] for n in ['proof-receipt.json','proof-terminal-refusal.json']),'Terminal observed; use new honest closure successor')
runtime=exact_json(obs['selectedOriginalUtf8']['fresh-r4-before-proof-copies.json']);capacity_gate(runtime,'RUNTIME_BIND',0)
initial=exact_json((S/'first-controller-forward-063000-opening-publication-once/opening-record.json').read_bytes())
require({p:v['device'] for p,v in runtime['hardware'].items()}=={p:v['device'] for p,v in initial['beforeRootR4']['hardware'].items()},'Runtime hardware changed')
package=exact_json((S/'reviewed-package6208186148-publication-once/package-publication-validation.json').read_bytes())
require(len(obs['packageHashes'])==59 and {n:v['sha256'] for n,v in obs['packageHashes'].items()}==package['packageFileHashes'] and all(v['mode']=='0o400' for v in obs['packageHashes'].values()),'59 uploaded package identities differ')
index=exact_json((S/'actual-source-pass6208186148-once/tooling-source-index.json').read_bytes());review=exact_json((S/'actual-source-pass6208186148-once/actual-source-pass-original.json').read_bytes());approval(review,index)
for n,d in graph(index).items():require(sha((S/n).read_bytes())==d,'Reviewed source changed '+n)
frozen=exact_json((R/'WP/startup-order-readiness-20261015/full-pinned-copy-retention-bound-ordinary-once/source-before.json').read_bytes());require(len(frozen)==1333,'Frozen application inventory differs')
for p,d in frozen.items():require(sha((R/p).read_bytes())==d,'Frozen application changed '+p)
attempts={label:exact_json(obs['selectedOriginalUtf8'][label+'-default-entrypoint-attempt.json']) for label in ['startup-1','startup-2'] if label+'-default-entrypoint-attempt.json' in obs['selectedOriginalUtf8']}
samples={n:exact_json(raw) for n,raw in obs['selectedOriginalUtf8'].items() if re.fullmatch('startup-[12]-memory-[0-9]{6}[.]json',n)}
health={n:exact_json(raw) for n,raw in obs['selectedOriginalUtf8'].items() if re.fullmatch('startup-[12]-health-poll-[0-9]{6}[.]json',n)}
totals={};previous={};retained={}
for name,sample in sorted(samples.items()):
    label=name.split('-memory-')[0];identity=sample['identity'];descriptor={'identity':identity,'cgroup':sample['cgroup']}
    require(label in attempts and identity['id']==attempts[label]['id'] and identity['owner']==str(ROOT)+':'+label,'Exact owned attempt identity differs')
    require(identity['oomKilled'] is False and identity['restarts']==0 and identity['memory']==identity['memoryAndSwap']==MEMORY and type(identity['pid']) is int and identity['pid']>0 and identity['startedAt'],'Fixed owned identity differs')
    require(label not in previous or previous[label]==descriptor,'Identity changed between retained samples');previous[label]=descriptor
    totals[name]=appmem.gate(sample);rows=sample['originalKernelReads'];require(len(rows)==8,'All eight original kernel reads required')
    values=[];bounds=[4096,256*1024,16384,4096,64,64,64,4096]
    for row,bound in zip(rows,bounds):
        held=obs['retainedMemoryOriginals'][row['path']];raw=held['originalRetainedUtf8'].encode('ascii')
        require(0<len(raw)<=bound and len(raw)==row['bytes']==held['bytes'] and sha(raw)==row['sha256']==held['sha256'] and row['kernelPath']==held['kernelPath'] and held['mode']=='0o400','Retained raw length/hash/mode/kernel path differs')
        require(pathlib.PurePosixPath(row['path']).name==row['path'] and row['path'].startswith(name[:-5]+'-raw-'),'Raw ownership differs')
        retained[row['path']]=raw;values.append(raw)
    require(values[0]==values[7] and appmem.cgroup_path(identity['id'],values[0],values[1]).as_posix()==sample['cgroup']['path'],'Exact cgroup membership differs')
    require(rows[0]['kernelPath']==rows[7]['kernelPath']=='/proc/'+str(identity['pid'])+'/cgroup','Membership PID differs')
    require([row['kernelPath'] for row in rows[2:7]]==[sample['cgroup']['path']+'/'+n for n in appmem.RAW_NAMES],'Counter cgroup differs')
    require(appmem.pairs(values[2],appmem.STAT_REQUIRED)==sample['memoryStat'] and appmem.pairs(values[3],appmem.EVENT_REQUIRED)==sample['memoryEvents'],'Raw counters differ')
    require(appmem.scalar(values[4])==sample['memoryPeakBytesObservation'] and appmem.scalar(values[5])==MEMORY and appmem.scalar(values[6])==0,'Raw scalars differ')
for name,poll in health.items():
    label=name.split('-health-poll-')[0];require(label in attempts and poll['state']['Running'] is True and poll['state']['OOMKilled'] is False,'Health poll live state differs')
    require(type(poll['elapsedSeconds']) in [int,float] and 0<=poll['elapsedSeconds']<=600,'Observed startup exceeded readiness deadline')
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
for n,raw in retained.items():save(n,raw)
for n,raw in obs['selectedOriginalUtf8'].items():save(n,raw.encode('utf-8'))
save('fresh-current-authority-evidence.json',canonical(evidence)+b'\n')
record={'status':'SAME_CONTROLLER_FORWARD_STEP2_PROOF_ACTIVE_AT_THIRD_OBSERVATION_NO_TERMINAL_CLAIM','observedUtc':obs['observedUtc'],'root':str(ROOT),'unit':obs['unit'],'invocationId':props['InvocationID'],'actualUnitProperties':props,'sourceCommit':index['head'],'sourceReviewId':review['id'],'fileCount':len(obs['fileMetadata']),'runtimeR4Original':runtime,'runtimeR4IsRetainedOriginalNotNewMeasurement':True,'attempts':attempts,'healthPollCounts':obs['healthPollCounts'],'memorySampleCounts':obs['memorySampleCounts'],'latestHealthObservations':health,'latestMemorySamples':samples,'latestSampleIndependentNonReclaimableBytes':totals,'rawKernelReadsIndependentlyVerified':len(retained),'all59PackageHashesAnd31Plus1333SourcesVerified':True,'onlyLatestSamplesValidatedHere':True,'continuousPeakClaimed':False,'newLiveMemoryCounterReads':0,'newOperatorCalls':0,'noTerminalAtObservation':True,'proofComplete':False,'retryAllowed':False,'noJobsOnDockerLogsSelectedOrPublished':True,'allJobsOnRawLogsContentReviewStillRequiredBeforePublicPublication':True}
record['controllerBeforeSevenRawReadsIndependentlyVerified']=True;record['controllerBeforeSnapshot']=mem;record['journalContentReviewed']='Two PID1 lifecycle start records only'

last_health=sorted(health)[-1];p=health[last_health];first=attempts['startup-1'];latest=sorted(samples)[-1];ident=samples[latest]['identity'];cg=samples[latest]['cgroup']
require(len(health)==len(samples)==2 and obs['healthPollCounts']=={'startup-1':343,'startup-2':0} and obs['memorySampleCounts']=={'startup-1':364,'startup-2':0} and len(attempts)==1,'Third observation scope differs')
ordered_health=[health[n] for n in sorted(health)];ordered_samples=[samples[n] for n in sorted(samples)]
require([v['status'] for v in ordered_health]==['unhealthy','healthy'] and [v['state']['Health']['FailingStreak'] for v in ordered_health]==[13,0] and all(len(v['state']['Health']['Log'])==5 for v in ordered_health),'Full actual health transition differs')
require(all(v['state']['Pid']==ident['pid'] and v['state']['StartedAt']==ident['startedAt'] for v in ordered_health),'Health identity changed')
require([v['phase'] for v in ordered_samples]==['running-command','before-stop'] and all(row['kernelPath']=='/proc/'+props['MainPID']+'/mountinfo' for sample in samples.values() for row in sample['originalKernelReads'][1:2]),'Final memory phase or controller PID differs')
prior=exact_json((S/'second-controller-forward-063000-opening-publication-once/later-opening-complete-record.json').read_bytes())
prior_sample=prior['latestMemorySamples'][sorted(prior['latestMemorySamples'])[-1]]
require(all(v['identity']==prior_sample['identity'] and v['cgroup']==prior_sample['cgroup'] for v in samples.values()),'Identity changed since second observation')
require(props['TimeoutStopUSec']=='5min' and str(ROOT)+'/stop_owned.py' in props['ExecStopPost'],'Exact stop-post configuration differs')
record['firstStartupObservedHealthyWithin600']=True;record['firstStartupLatestMemoryBeforeStop']=True;record['sameFirstContainerIdentityAsSecondObservation']=True
record['fullStartupResultNotYetObserved']=True;record['allSamplesAndCommandLogsRequireIndependentClosureValidation']=True
save('later-opening-complete-record.json',canonical(record)+b'\n')
lead=f'''LATEST ACTUAL THIRD CONTROLLER-FORWARD063000 READONLY OBSERVATION / FIRST STARTUP HEALTHY - {obs['observedUtc']}.
SAME ONE063000/exact572d8cc94ee5a98c29392f556a57133cedd13128/PASS6208186148/invocation{props['InvocationID']} ACTIVE/running/MainPID{props['MainPID']}/MemoryMax805306368Swap0/Runtime90min/TimeoutStop300/exactrootExecStopPost. Current{props['MemoryCurrent']}/controllerpeak{props['MemoryPeak']} OPENCONTROLLER observationsONLY/separatefromapppeak/closedresult. {len(obs['fileMetadata'])}rootfiles/all59uploaded0400package hashes match. NOstartupresult/proofreceipt/terminalrefusal/controllerafter/stop-post yet/activeResultsuccessExecMainStatus0 NOTclosedPASS.
FIRSTjobsOFF SAMEd28d6aaf62931146fc2bd6225af0301ab7b63345117d23bb01c3218f7fc1f592/PID449381/start04:46:57.172480172Z/ownerexact063000root:startup-1 NOWDOCKERHEALTHY at343poll elapsed423.6703404939981s WITHIN600. Preceding342unhealthy422.48735267200027s/FailingStreak13 thenhealthyFailingStreak0; latest2EACHfull5Health.Log/config/state/UTC/monotonic retained. Observedunhealthy331.6326452289977s isMONOTONICOBSERVEDpollintervals/notexactunobservedDockertransitiontime. HealthtransitionONLY/notfullHTTP/broad31API6probes/fullstoppedseal/result/wholeproofPASS. SECOND0health0memory/no attempt observed.
First343FULL0400healthpolls/364memoryrecords. Latest363running-command and364FINALbefore-stop independentlyrederived fromALL16originalkernelraws/SHA+length/readbounds/stat/events/scalars/procmembership/mountinfo: {json.dumps(totals,sort_keys=True)} <=603979776B. SAMEfullCID/PID/start/owner/805memory=swap/cgroupdevice24inode34833/exactIDLEAF unchangedSINCEsecondobservation; membershipwithinidentical/betweendescriptorstable/oom=oom_kill0/DockerOOMfalse/restarts0. Appmemory.peak805306368then805351424 (45056aboveMax) andmax/high/reclaim areOBSERVATIONS ONLY underapprovedmemory.events policy/no continuouspeak/ALL364samples/wholeproofclaim. Counts364memory343health include reviewedcommand+finalsampling/notmissingclosureevidence. Initialcontroller7rawsdev24inode34168/OOM0 reverified/noafter/stop-post claim. Fulljournalcontentreviewed:twoPID1startrecordsonly.
SAME ACTUAL ORIGINAL runtimeR4beforecopies04:46:07.300063UTC required60921981038/free86384013312 EACH3/sameFS64769/canonical4096/nonadditive/ADDITIONAL10GB/futurepackage0alreadyoccupied/db563326976/assets5787648. RETAINED ORIGINAL/notnewmeasurement. BeforeROOT04:44:10req60932745326/free86393110528/future10764288 andbeforeUNIT04:44:49req60921981038/free86384353280 remainbound. N25MIN64/25percent/3assets/schema+markers/stagecaps/floor10556150894+4GiBlogs+10GB/500MB unchanged. All31+1333frozenappunchanged/currentmainbeCI38772398721attempt1pushCLOSEDSUCCESS/4audits6rules2postrebootmemoryjobsdiagnosticprivacyacceptancecontroller620791R2/#191CLOSED/nolaterfailure freshlyverified.
Fullreadonlyoriginals/latest2FULLhealthmemory/16kernelraws/runtimeR4/independentrecord at {REL}third-controller-forward-063000-opening-publication-once/publication-index.json/later-opening-complete-record.json. NEWCONSUMEDNEVERREPLAY observe-controller-forward-step2-063000-third-readonly-once.py;publish-controller-forward-step2-063000-third-opening-once.py. NojobsONlogsselectedpublished/privatekeys+DBsHOST/no privatebytesfetched. ALL063000rootunit/PASS/package/operators/allolderhelpers consumedimmutable/no redispatchretryreplaycleanup.
NEXTreasonableinterval NEWuniqueREADONLYobserver SAMErootunitinvocation/latest2FULLhealthmemory originals/counts/status/actualstartupresultIFobserved; no newprodmemsampling/SQL/du/redispatch/sourceedit/stop/retry/cleanup/concurrentwriter. ActualCLOSED retainALLpublicraw/privatehashstatONLY/ALLhealthmemory/fulljournal+hookexit/59package/inputpreservation/accounting/independentOFF31API6probes11242+2NATURALsyncs strictpairingsecondidempotencerefusalsscienceEACH805600budgets/fullfirstsecondpreservation/reconstructedlabels. RequirebothownersstoppedAndRetained NOTVACUOUS/postStopErrorsEMPTY/controllerbeforeafterpoststopOOM0/samecgroup/journalExecStopPostexit0. RuntimeAWAITINGnotclosedPASS. ReviewALLjobsONrawlogs BEFOREpublicGit/privatekeys+DBsHOST. ONEeventualactualresult@claude162 bundles620818PASSACKONLYthere/no duplicates. Native04:50:39fallbackCANCELLED/answered/NEVERrepeat. FailurehonestNEWseparatelyauditedforwardfixONLY/no oldhelperreplay.
QualificationONLY/no kitgate deploy/MainMERGEHOLD/233000KEEPIT/R2COMPLETE/noprune/YY320GiBvisible/no growrestart/no103/noagentsnewchatworktreecheckout/humansheld. Futurekit174newEXPECTED22holds20existingZMB-LAB1/managerimpact/countsmaydiff+9to10minrestart/exact600failure. SAMEheartbeatACTIVE2min/restore10ONLYactualbeDEPLOYED+ClactualpostdeployPASS. PreserveALLolderhistoryverbatimbelow.

'''
save('checkpoint-prefix.txt',lead.encode())
readmes=[R/'WP/audit-release-eb6de2e8/README.md',R/'WP/runtime-recovery-kobo/README.md']
for path in readmes:path.write_bytes(lead.encode()+path.read_bytes())
paths=sorted(O.iterdir())+sorted(D.iterdir())+[R/'WP/backlog-resume-20261013/observe-controller-forward-step2-063000-third-readonly-once.py',pathlib.Path(__file__),*readmes]
require(all(path.is_file() for path in paths),'Regular owned publication files required')
save('publication-index.json',canonical({'baseAudit':BASE,'files':[{'path':path.relative_to(R).as_posix(),'length':len(path.read_bytes()),'sha256':sha(path.read_bytes()),'gitBlobOid':oid(path.read_bytes())} for path in paths]})+b'\n')
paths.append(D/'publication-index.json');names=[path.relative_to(R).as_posix() for path in paths];require(len(names)==len(set(names)),'Duplicate publication path')
for i in range(0,len(names),15):git('-c','core.autocrlf=false','add','-f','--',*names[i:i+15])
require(set(git('diff','--cached','--name-only').decode().splitlines())==set(names),'Staged ownership differs');tree=git('write-tree').decode().strip()
for path,name in zip(paths,names):require(git('show',tree+':'+name)==path.read_bytes() and git('rev-parse',tree+':'+name).decode().strip()==oid(path.read_bytes()),'Staged raw identity differs')
git('commit','-m','Retain jobs qualification second observation and runtime capacity');head=git('rev-parse','HEAD').decode().strip()
for path,name in zip(paths,names):require(git('show',head+':'+name)==path.read_bytes(),'Committed raw identity differs')
git('push','origin','audit/release-eb6de2e8');require(git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head,'Published writer differs')
print(json.dumps({'audit':head,'rawOidShaVerifiedBlobs':len(paths),'observedUtc':obs['observedUtc'],'latestSampleNonReclaimableBytes':totals,'runtimeR4RequiredBytes':runtime['requiredBytes'],'runtimeFreeBytes':runtime['freeBytes'],'proofComplete':False,'newOperatorCalls':0}))
