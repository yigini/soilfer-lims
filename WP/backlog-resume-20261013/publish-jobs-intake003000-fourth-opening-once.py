"""Publish the same consumed jobs proof's fourth read-only observation."""
import datetime,pathlib,subprocess,sys
R=pathlib.Path(__file__).resolve().parents[2];REL='WP/batch-proof-jobs-intake-be837974-20261016/';S=R/REL
D=S/'fourth-jobs003000-opening-publication-once';O=S/'fourth-jobs003000-readonly-observation-once'
BASE='7f1e9129b863b7562cd9235605bc586f00672bb9'
sys.path.insert(0,str(S))
from proof_contract import *
from proof_budget import capacity_gate
import proof_memory as mem
import prepare_proof as prep

def git(*a):return subprocess.check_output(['git','-c','core.longpaths=true',*a],cwd=R)
def oid(raw):return hashlib.sha1(('blob '+str(len(raw))+'\0').encode()+raw).hexdigest()
require(git('rev-parse','HEAD').decode().strip()==BASE and git('branch','--show-current').decode().strip()=='audit/release-eb6de2e8' and not git('diff','--cached','--name-only').strip() and not D.exists(),'Same writer/base/unique publication required')
require(exact_json((O/'exit-original.json').read_bytes())['exitCode']==0,'Actual closed observer required')
obs=exact_json((O/'stdout-original.json').read_bytes());props=dict(line.split('=',1) for line in obs['systemctl']['stdout'].splitlines() if '=' in line)
require(obs['root']==str(ROOT) and obs['unit']=='lims-'+ROOT_NAME.lower(),'Wrong proof root/unit')
require(obs['systemctl']['exitCode']==0 and props['ActiveState']=='active' and props['SubState']=='running' and props['InvocationID']=='1316c26d1ef14f48b564b1e0cb7707a5' and props['MemoryMax']=='805306368' and props['MemorySwapMax']=='0' and props['RuntimeMaxUSec']=='1h 30min','Same active invocation and fixed limits required')
require(not any(n in obs['selectedOriginalUtf8'] for n in ['proof-receipt.json','proof-terminal-refusal.json']),'Terminal observed; use new honest closure successor')
runtime=exact_json(obs['selectedOriginalUtf8']['fresh-r4-before-proof-copies.json']);capacity_gate(runtime,'RUNTIME_BIND',0)
initial=exact_json((S/'first-jobs003000-opening-publication-once/opening-record.json').read_bytes())
require({p:v['device'] for p,v in runtime['hardware'].items()}=={p:v['device'] for p,v in initial['beforeRootR4']['hardware'].items()},'Runtime hardware changed')
package=exact_json((S/'reviewed-package6205111918-publication-once/package-publication-validation.json').read_bytes())
require(len(obs['packageHashes'])==54 and {n:v['sha256'] for n,v in obs['packageHashes'].items()}==package['packageFileHashes'] and all(v['mode']=='0o400' for v in obs['packageHashes'].values()),'54 uploaded package identities differ')
index=exact_json((S/'actual-source-pass6205111918-complete-once/tooling-source-index.json').read_bytes());review=exact_json((S/'actual-source-pass6205111918-complete-once/actual-source-pass-original.json').read_bytes());approval(review,index)
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
    totals[name]=mem.gate(sample);rows=sample['originalKernelReads'];require(len(rows)==8,'All eight original kernel reads required')
    values=[];bounds=[4096,256*1024,16384,4096,64,64,64,4096]
    for row,bound in zip(rows,bounds):
        held=obs['retainedMemoryOriginals'][row['path']];raw=held['originalRetainedUtf8'].encode('ascii')
        require(0<len(raw)<=bound and len(raw)==row['bytes']==held['bytes'] and sha(raw)==row['sha256']==held['sha256'] and row['kernelPath']==held['kernelPath'] and held['mode']=='0o400','Retained raw length/hash/mode/kernel path differs')
        require(pathlib.PurePosixPath(row['path']).name==row['path'] and row['path'].startswith(name[:-5]+'-raw-'),'Raw ownership differs')
        retained[row['path']]=raw;values.append(raw)
    require(values[0]==values[7] and mem.cgroup_path(identity['id'],values[0],values[1]).as_posix()==sample['cgroup']['path'],'Exact cgroup membership differs')
    require(rows[0]['kernelPath']==rows[7]['kernelPath']=='/proc/'+str(identity['pid'])+'/cgroup','Membership PID differs')
    require([row['kernelPath'] for row in rows[2:7]]==[sample['cgroup']['path']+'/'+n for n in mem.RAW_NAMES],'Counter cgroup differs')
    require(mem.pairs(values[2],mem.STAT_REQUIRED)==sample['memoryStat'] and mem.pairs(values[3],mem.EVENT_REQUIRED)==sample['memoryEvents'],'Raw counters differ')
    require(mem.scalar(values[4])==sample['memoryPeakBytesObservation'] and mem.scalar(values[5])==MEMORY and mem.scalar(values[6])==0,'Raw scalars differ')
for name,poll in health.items():
    label=name.split('-health-poll-')[0];require(label in attempts and poll['state']['Running'] is True and poll['state']['OOMKilled'] is False,'Health poll live state differs')
    require(type(poll['elapsedSeconds']) in [int,float] and 0<=poll['elapsedSeconds']<=600,'Observed startup exceeded readiness deadline')
prior=exact_json((S/'third-jobs003000-opening-publication-once/later-opening-complete-record.json').read_bytes())
for label,descriptor in previous.items():
    held=[v for n,v in prior['latestMemorySamples'].items() if n.startswith(label+'-memory-')]
    if held:require(all({'identity':v['identity'],'cgroup':v['cgroup']}==descriptor for v in held),'Identity changed since third observation')
evidence=prep.current_evidence(review,index)
D.mkdir()
def save(n,raw):
    with (D/n).open('xb') as f:f.write(raw)
for n,raw in retained.items():save(n,raw)
for n,raw in obs['selectedOriginalUtf8'].items():save(n,raw.encode('utf-8'))
save('fresh-current-authority-evidence.json',canonical(evidence)+b'\n')
record={'status':'SAME_JOBS_PROOF_ACTIVE_AT_FOURTH_OBSERVATION_NO_TERMINAL_CLAIM','observedUtc':obs['observedUtc'],'root':str(ROOT),'unit':obs['unit'],'invocationId':props['InvocationID'],'actualUnitProperties':props,'sourceCommit':index['head'],'sourceReviewId':review['id'],'fileCount':len(obs['fileMetadata']),'runtimeR4Original':runtime,'runtimeR4IsRetainedOriginalNotNewMeasurement':True,'attempts':attempts,'healthPollCounts':obs['healthPollCounts'],'memorySampleCounts':obs['memorySampleCounts'],'latestHealthObservations':health,'latestMemorySamples':samples,'latestSampleIndependentNonReclaimableBytes':totals,'rawKernelReadsIndependentlyVerified':len(retained),'all54PackageHashesAnd26Plus1333SourcesVerified':True,'onlyLatestSamplesValidatedHere':True,'continuousPeakClaimed':False,'newLiveMemoryCounterReads':0,'newOperatorCalls':0,'noTerminalAtObservation':True,'proofComplete':False,'retryAllowed':False,'noJobsOnDockerLogsSelectedOrPublished':True,'allJobsOnRawLogsContentReviewStillRequiredBeforePublicPublication':True}
save('later-opening-complete-record.json',canonical(record)+b'\n')
last_health=sorted(health)[-1];p=health[last_health];first=attempts['startup-1'];latest=sorted(samples)[-1];ident=samples[latest]['identity'];cg=samples[latest]['cgroup']
lead=f'''LATEST ACTUAL FOURTH JOBS003000 READONLY OBSERVATION - {obs['observedUtc']}.
SAME ONE003000/exact04c99271/PASS6205111918 invocation{props['InvocationID']} ACTIVE/running/MainPID{props['MainPID']}/MemoryMax805306368Swap0/Runtime90min/current{props['MemoryCurrent']}/controllerpeak{props['MemoryPeak']} OPEN observations ONLY, separate from app peak/OOM/closed result. {len(obs['fileMetadata'])}rootfiles; all54uploaded0400package hashes match. No startup result/proof receipt/terminal refusal at this observation; activeResultsuccess/ExecMainStatus0 NOT closedPASS. No completed jobsOFF broadpostflight or jobsON intake claimed.
FIRST ordinary jobsOFF startup ACTUALLYATTEMPTED {first['id']}/PID{ident['pid']}/StartedAt{ident['startedAt']}/ownerexact003000root:startup-1. {obs['healthPollCounts']['startup-1']}FULL0400healthpolls, latest {p['status']} {p['elapsedSeconds']}s WITHIN600 deadline; second {obs['healthPollCounts']['startup-2']}polls/{obs['memorySampleCounts']['startup-2']}memory/no attempt observed. Transient unhealthy allowed by reviewed graph; no failure or PASS inferred. Original FULLStateHealth.Log/FailingStreak/config/UTC/monotonic poll records retained.
First Docker healthy transition at513.8320998189993s; preceding418poll unhealthy512.6327584939991s/FailingStreak16,419healthy/FailingStreak0, both FULL5-entry Health.Log retained. Observed unhealthy421.65998555999977s is cumulative MONOTONIC OBSERVED poll intervals, NOT exact unobserved Docker transition time. This proves observed healthy transition only, not full startup HTTP/result/stoppedseal or wholeproof PASS.
LATEST TWO first memory samples {json.dumps(totals,sort_keys=True)} independently rederived from ALL16 original0400kernelreads/SHA+length+readbounds/stat/events/scalars/proc membership/mountinfo. SAME fullCID/PID/start/owner/limits/exactIDLEAF/cgroupdevice{cg['device']}inode{cg['inode']}; membership within equal/descriptor between equal/oom=oom_kill0/DockerOOMfalse/restarts0. Seven-field sampled nonreclaimable <=603979776B. Latest sample433 running-command and434 FINALbefore-stop independently verified;434samples versus419healthpolls reflects reviewed command sampling too, not missing closure evidence. App memory.peak805306368 and max/high counters OBSERVATION ONLY; no continuous peak or all{obs['memorySampleCounts']['startup-1']}samples/wholeproof claim.
SAME ACTUAL ORIGINAL runtime R4 BEFORE COPIES RETAINED {runtime['observedUtc']}: required{runtime['requiredBytes']}/free{min(runtime['freeBytes'].values())} EACH3/canonical4096/device64769/SAMEFSnotadditive/ADDITIONAL10GB/packagefuture0 already occupied/db563326976/assets5787648. This is retained ORIGINAL card, NOT fresh measurement. BeforeROOT required60932393070/free95826145280/exactfuturepackage10412032 and beforeUNIT required60921981038/free95817760768 remain bound. N25/MIN64/25percent/3assets/schema+markers/all remaining stagecaps/floor+4GiBlogs+10GB unchanged. All26source+1333frozenapp reverified unchanged/fresh currentauthority mainbe837974/mainCI38772398721attempt1pushCLOSEDSUCCESS/4appaudits6rules2postreboot memorydirection/jobsScope/R2accepted/nolaterfailure/#191CLOSED.
Full readonly originals/latest2FULLhealth+memory+16kernelraws/runtimeR4/independent record at {REL}fourth-jobs003000-opening-publication-once/publication-index.json/later-opening-complete-record.json. No localrunner/retainer after publication; ONE remoteproof ACTIVE AT OBSERVATION/no later state claimed. New CONSUMED NEVER replay observe-jobs-intake003000-fourth-readonly-once.py and publish-jobs-intake003000-fourth-opening-once.py; ALL older helpers/operators/root/unit remain consumed.
NEXT reasonableinterval NEWunique READONLY observer SAME root/unit/invocation/latest2FULLhealth+memory ORIGINALS/status only; no redispatch/fresh prod memory sampling/source edit/stop/retry/cleanup/concurrentwriter. On actualCLOSED retain ALL originals/fulljournal/systemctl54package/EVERYhealth+ALLmemoryraws/fullstoppedstates/inputhashstat/accounting, independently validate fullOFF+broad31API6probes+2NATURALsync/provenance/science/refusal/full11242rowsreceipts/assets/memory/budgets, inspect ALL raw jobsON logs for Kobo submission content BEFORE public publication (hashes acceptable/preserve originals), then ONE@claude162actualresult bundling620511PASSACK ONLY there. Backup180s or escalation-row refusal => separately audited NEW forward fix only/no rerun. Unknown outcome inspect SAME consumedrootunit. Futurekit/gate must disclose several-minute restart window (prior333392s). MainMERGEHOLD until actualbeDEPLOYED+ClactualpostdeployPASS; SAMEheartbeatACTIVE2min/restore10 ONLY then. Qualification only/no kit/gate/deploy approval.233000latestpassingKEEPIT/R2COMPLETE/no moreprune/YY320GiBalreadyvisible/nohostgrowrestart/no103/noagentsnewchatworktreecheckout/humanfilesdraftcards preserved. Native0018followup answered; NEVER duplicate native/ACK/GHrequest. Preserve ALL older history verbatim below.

'''
save('checkpoint-prefix.txt',lead.encode())
readmes=[R/'WP/audit-release-eb6de2e8/README.md',R/'WP/runtime-recovery-kobo/README.md']
for path in readmes:path.write_bytes(lead.encode()+path.read_bytes())
paths=sorted(O.iterdir())+sorted(D.iterdir())+[R/'WP/backlog-resume-20261013/observe-jobs-intake003000-fourth-readonly-once.py',pathlib.Path(__file__),*readmes]
require(all(path.is_file() for path in paths),'Regular owned publication files required')
save('publication-index.json',canonical({'baseAudit':BASE,'files':[{'path':path.relative_to(R).as_posix(),'length':len(path.read_bytes()),'sha256':sha(path.read_bytes()),'gitBlobOid':oid(path.read_bytes())} for path in paths]})+b'\n')
paths.append(D/'publication-index.json');names=[path.relative_to(R).as_posix() for path in paths];require(len(names)==len(set(names)),'Duplicate publication path')
for i in range(0,len(names),15):git('-c','core.autocrlf=false','add','-f','--',*names[i:i+15])
require(set(git('diff','--cached','--name-only').decode().splitlines())==set(names),'Staged ownership differs');tree=git('write-tree').decode().strip()
for path,name in zip(paths,names):require(git('show',tree+':'+name)==path.read_bytes() and git('rev-parse',tree+':'+name).decode().strip()==oid(path.read_bytes()),'Staged raw identity differs')
git('commit','-m','Retain jobs qualification first healthy transition and exact memory originals');head=git('rev-parse','HEAD').decode().strip()
for path,name in zip(paths,names):require(git('show',head+':'+name)==path.read_bytes(),'Committed raw identity differs')
git('push','origin','audit/release-eb6de2e8');require(git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head,'Published writer differs')
print(json.dumps({'audit':head,'rawOidShaVerifiedBlobs':len(paths),'observedUtc':obs['observedUtc'],'latestSampleNonReclaimableBytes':totals,'runtimeR4RequiredBytes':runtime['requiredBytes'],'runtimeFreeBytes':runtime['freeBytes'],'proofComplete':False,'newOperatorCalls':0}))
