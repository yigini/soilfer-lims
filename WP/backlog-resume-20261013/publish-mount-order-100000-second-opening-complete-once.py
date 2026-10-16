"""Publish the second immutable observation of the same consumed mount-order attempt."""
import pathlib,re,sys
sys.dont_write_bytecode=True
W=pathlib.Path(__file__).resolve().parents[2];H=W/'WP/backlog-resume-20261013';sys.path.insert(0,str(H))
from prechecks6210209468_evidence import git,sha,oid,canonical,utc,save
from prechecks6210209468_boundary_publication import boundary_publish
REL='WP/batch-proof-mount-order-forward-be837974-20261016/';B=W/REL
D=B/'second-mount-order-100000-opening-publication-once';O=B/'second-mount-order-100000-readonly-observation-once'
BASE='801405df56d293d4e9135c931a62abafe47e7fcb'
sys.path.insert(0,str(B))
from proof_contract import *
from proof_budget import capacity_gate
from controller_guard import parse_events,UNIT as CGUNIT
import proof_memory as appmem
import prepare_proof as prep

require(git('rev-parse','HEAD').decode().strip()==BASE and git('branch','--show-current').decode().strip()=='audit/release-eb6de2e8' and not git('diff','--cached','--name-only').strip() and not D.exists(),'Same writer/new publication required')
require(exact_json((O/'exit-original.json').read_bytes())['exitCode']==0,'Closed read-only observer required')
obs=exact_json((O/'stdout-original.json').read_bytes());selected=obs['selectedOriginalUtf8']
props=dict(line.split('=',1) for line in obs['systemctl']['stdout'].splitlines() if '=' in line)
require(obs['root']==str(ROOT) and obs['unit']=='lims-'+ROOT_NAME.lower(),'Exact root/unit required')
require(obs['systemctl']['exitCode']==0 and not obs['systemctl']['stderr'] and props['ActiveState']=='active' and props['SubState']=='running' and props['InvocationID']=='119b9c19c39e46d8bb482c144bd432ea' and props['MainPID']=='668224','Same active invocation required; closure needs a distinct honest retainer')
require(props['MemoryMax']=='805306368' and props['MemorySwapMax']=='0' and props['RuntimeMaxUSec']=='1h 30min' and props['TimeoutStopUSec']=='5min' and str(ROOT/'stop_owned.py') in props['ExecStopPost'],'Exact fixed limits/hook required')
require(not any(n in selected for n in ['proof-receipt.json','proof-terminal-refusal.json','stop-post-result.json','startup-1-result.json','startup-2-result.json']),'Terminal/stage result observed; retain honestly in new successor')
initial=exact_json((B/'first-mount-order-100000-opening-publication-once/opening-record.json').read_bytes())
runtime=exact_json(selected['fresh-r4-before-proof-copies.json']);capacity_gate(runtime,'RUNTIME_BIND',0)
require({p:v['device'] for p,v in runtime['hardware'].items()}=={p:v['device'] for p,v in initial['beforeRootR4']['hardware'].items()},'Runtime topology changed')
package=exact_json((B/'reviewed-package6211327371-publication-once/package-publication-validation.json').read_bytes())
require(len(obs['packageHashes'])==65 and {n:v['sha256'] for n,v in obs['packageHashes'].items()}==package['packageFileHashes'] and all(v['mode']=='0o400' for v in obs['packageHashes'].values()),'65 uploaded package identities differ')
index=exact_json((B/'actual-source-pass6211327371-once/tooling-source-index.json').read_bytes());review=exact_json((B/'actual-source-pass6211327371-once/actual-source-pass-original.json').read_bytes());approval(review,index)
require(len(graph(index))==37 and index['head']=='187636984895aec44044635fb63498b0fcb3102e','Exact reviewed graph required')
for n,d in graph(index).items():require(sha((B/n).read_bytes())==d,'Reviewed source changed '+n)
frozen=exact_json((W/'WP/startup-order-readiness-20261015/full-pinned-copy-retention-bound-ordinary-once/source-before.json').read_bytes());require(len(frozen)==1333,'Frozen application inventory differs')
for p,d in frozen.items():require(sha((W/p).read_bytes())==d,'Frozen application changed '+p)
attempts={label:exact_json(selected[label+'-default-entrypoint-attempt.json']) for label in ['startup-1','startup-2'] if label+'-default-entrypoint-attempt.json' in selected}
samples={n:exact_json(raw) for n,raw in selected.items() if re.fullmatch('startup-[12]-memory-[0-9]{6}[.]json',n)}
health={n:exact_json(raw) for n,raw in selected.items() if re.fullmatch('startup-[12]-health-poll-[0-9]{6}[.]json',n)}
require(len(health)==len(samples)==2 and len(attempts)==1 and obs['healthPollCounts']['startup-2']==obs['memorySampleCounts']['startup-2']==0,'Observed first-startup scope differs')
totals={};previous={};retained={}
for name,sample in sorted(samples.items()):
    label=name.split('-memory-')[0];identity=sample['identity'];descriptor={'identity':identity,'cgroup':sample['cgroup']}
    require(label in attempts and identity['id']==attempts[label]['id'] and identity['owner']==str(ROOT)+':'+label,'Exact owned attempt identity differs')
    require(identity['oomKilled'] is False and identity['restarts']==0 and identity['memory']==identity['memoryAndSwap']==MEMORY and type(identity['pid']) is int and identity['pid']>0 and identity['startedAt'],'Fixed owned identity differs')
    require(label not in previous or previous[label]==descriptor,'Identity changed between retained samples');previous[label]=descriptor
    totals[name]=appmem.gate(sample);rows=sample['originalKernelReads'];require(len(rows)==8,'All eight kernel reads required')
    values=[];bounds=[4096,256*1024,16384,4096,64,64,64,4096]
    for row,bound in zip(rows,bounds):
        held=obs['retainedMemoryOriginals'][row['path']];raw=held['originalRetainedUtf8'].encode('ascii')
        require(0<len(raw)<=bound and len(raw)==row['bytes']==held['bytes'] and sha(raw)==row['sha256']==held['sha256'] and row['kernelPath']==held['kernelPath'] and held['mode']=='0o400','Raw length/hash/mode/kernel path differs')
        require(pathlib.PurePosixPath(row['path']).name==row['path'] and row['path'].startswith(name[:-5]+'-raw-'),'Raw ownership differs')
        retained[row['path']]=raw;values.append(raw)
    require(values[0]==values[7] and appmem.cgroup_path(identity['id'],values[0],values[1]).as_posix()==sample['cgroup']['path'],'Exact cgroup membership differs')
    require(rows[0]['kernelPath']==rows[7]['kernelPath']=='/proc/'+str(identity['pid'])+'/cgroup' and rows[1]['kernelPath']=='/proc/'+props['MainPID']+'/mountinfo','Raw PID paths differ')
    require([row['kernelPath'] for row in rows[2:7]]==[sample['cgroup']['path']+'/'+n for n in appmem.RAW_NAMES],'Counter cgroup differs')
    require(appmem.pairs(values[2],appmem.STAT_REQUIRED)==sample['memoryStat'] and appmem.pairs(values[3],appmem.EVENT_REQUIRED)==sample['memoryEvents'],'Raw counters differ')
    require(appmem.scalar(values[4])==sample['memoryPeakBytesObservation'] and appmem.scalar(values[5])==MEMORY and appmem.scalar(values[6])==0,'Raw scalars differ')
ident=samples[sorted(samples)[-1]]['identity'];cg=samples[sorted(samples)[-1]]['cgroup']
for name,poll in health.items():
    label=name.split('-health-poll-')[0]
    require(label in attempts and poll['state']['Running'] is True and poll['state']['OOMKilled'] is False and poll['state']['Pid']==ident['pid'] and poll['state']['StartedAt']==ident['startedAt'],'Full health identity differs')
    require(type(poll['elapsedSeconds']) in [int,float] and 0<=poll['elapsedSeconds']<=600 and poll['status']==poll['state']['Health']['Status']=='unhealthy' and len(poll['state']['Health']['Log'])==5,'Full original health/deadline differs')
    require(all(row['ExitCode']==1 and row['Output']=="wget: can't connect to remote host: Connection refused\n" for row in poll['state']['Health']['Log']),'Health output requires further public content review')
# Independently rederive the original controller eight reads; no new host counters.
mem=exact_json(selected['controller-memory-before.json']);raws=[exact_json(selected['controller-memory-before-raw-'+str(i).zfill(2)+'.json']) for i in range(1,9)]
expected=['/proc/'+props['MainPID']+'/cgroup']+['/sys/fs/cgroup/system.slice/'+CGUNIT+'/'+n for n in ['memory.events','memory.current','memory.peak','memory.max','memory.swap.max','memory.stat']]+['/proc/'+props['MainPID']+'/cgroup']
require([r['path'] for r in raws]==expected and raws[0]==raws[-1],'Exact controller paths/order/membership required')
for r in raws:
    data=r['rawAscii'].encode('ascii');require(len(data)==r['bytes'] and sha(data)==r['sha256'] and len(data)<=16384,'Controller raw identity/bound differs')
require(mem==initial['controllerBeforeSnapshot'] and mem['unit']==CGUNIT and mem['membershipRaw']==raws[0]['rawAscii']=='0::/system.slice/'+CGUNIT+'\n' and mem['cgroupDevice']==24 and mem['cgroupInode']==43231,'Initial controller snapshot/identity changed')
for r,n in zip(raws[1:7],['memory.events','memory.current','memory.peak','memory.max','memory.swap.max','memory.stat']):require(mem['raw'][n]==r['rawAscii'] and mem['sha256'][n]==r['sha256'],'Controller snapshot/raw mismatch '+n)
require(parse_events(raws[1]['rawAscii'].encode())==mem['events'] and mem['events']['oom']==mem['events']['oom_kill']==0,'Controller OOM guard differs')
for n,v in mem['scalars'].items():require(re.fullmatch('[0-9]+',mem['raw'][n].strip()) and int(mem['raw'][n].strip())==v,'Controller scalar differs')
require(mem['scalars']['memory.max']==805306368 and mem['scalars']['memory.swap.max']==0 and mem['peakMaxHighObservationOnly'] is True,'Controller scalar limits differ')
memory_stat={}
for line in raws[6]['rawAscii'].splitlines():
    bits=line.split();require(len(bits)==2 and bits[0] not in memory_stat and re.fullmatch('0|[1-9][0-9]*',bits[1]),'Controller memory.stat malformed');memory_stat[bits[0]]=int(bits[1]);require(memory_stat[bits[0]]<2**64,'Controller memory.stat overflow')
require({'anon','file'}<=set(memory_stat) and memory_stat==mem['memoryStat'],'Controller memory.stat differs')
metadata={r['path']:r for r in obs['fileMetadata']}
active_inventory_later_selected=sorted(n for n in selected if n not in metadata)
require(active_inventory_later_selected==['startup-1-memory-000272.json'] and 'startup-1-memory-000271.json' in metadata,'Actual asynchronous inventory difference changed')
for n,raw in selected.items():
    if n in metadata:require(metadata[n]['mode']=='0o400' and metadata[n]['bytes']==len(raw.encode()),'Selected original metadata differs '+n)
    else:require(n in samples and all(obs['retainedMemoryOriginals'][r['path']]['mode']=='0o400' for r in samples[n]['originalKernelReads']),'Later sealed sample/raw identity differs')
# The original observer sealed() checked both stats and mode0400 before returning the later sample.

journal=[exact_json(line.encode()) for line in obs['journal']['stdout'].splitlines() if line]
require(obs['journal']['exitCode']==0 and not obs['journal']['stderr'] and len(journal)==2 and all(r['_PID']=='1' and r['INVOCATION_ID']==props['InvocationID'] and r['MESSAGE'].startswith(('Starting /usr/bin/python3 -B ','Started /usr/bin/python3 -B ')) for r in journal),'Journal requires additional content review before publication')
evidence=prep.current_evidence(review,index)
D.mkdir()
for n,raw in retained.items():save(D,n,raw)
for n,raw in selected.items():save(D,n,raw.encode())
save(D,'first-publisher-active-inventory-refusal-derived.json',canonical({'provenance':'TOOL_OUTPUT_TRANSCRIPTION_NOT_ORIGINAL_PROCESS_LOG','helper':str(a.relative_to(W)) if False else 'WP/backlog-resume-20261013/publish-mount-order-100000-second-opening-once.py','exitCode':1,'exception':'KeyError: startup-1-memory-000272.json','failurePhase':'LOCAL_METADATA_VALIDATION_BEFORE_D_CREATE_CURRENT_AUTHORITY_OR_GIT','sameObservationReusedWithoutNewHostRead':True,'proofOperatorCalls':0})+b'\n')
save(D,'fresh-current-authority-evidence.json',canonical(evidence)+b'\n')
record={'status':'SAME_MOUNT_ORDER_PROOF_ACTIVE_AT_SECOND_OBSERVATION_NO_TERMINAL_CLAIM','observedUtc':obs['observedUtc'],'root':str(ROOT),'unit':obs['unit'],'invocationId':props['InvocationID'],'actualUnitProperties':props,'sourceCommit':index['head'],'sourceReviewId':review['id'],'fileCount':len(obs['fileMetadata']),'runtimeR4Original':runtime,'runtimeR4IsRetainedOriginalNotNewMeasurement':True,'attempts':attempts,'healthPollCounts':obs['healthPollCounts'],'memorySampleCounts':obs['memorySampleCounts'],'latestHealthObservations':health,'latestMemorySamples':samples,'latestSampleIndependentNonReclaimableBytes':totals,'rawKernelReadsIndependentlyVerified':len(retained),'all65PackageHashesAnd37Plus1333SourcesVerified':True,'onlyLatestSamplesValidatedHere':True,'continuousPeakClaimed':False,'newLiveMemoryCounterReads':0,'newOperatorCalls':0,'activeInventoryLaterSelectedSealedSampleNames':active_inventory_later_selected,'originalObserverSealedStatAndModeCheckedBeforeAndAfterRead':True,'proofComplete':False,'retryAllowed':False,'noJobsOnDockerLogsSelectedOrPublished':True,'allJobsOnRawLogsContentReviewStillRequiredBeforePublicPublication':True,'controllerBeforeEightRawReadsIndependentlyVerified':True,'controllerBeforeSnapshot':mem,'journalContentReviewed':'Two PID1 lifecycle start records only'}
save(D,'later-opening-complete-record.json',canonical(record)+b'\n')
p=health[sorted(health)[-1]];first=attempts['startup-1']
lead=f'''LATEST ACTUAL SECOND MOUNT-ORDER100000 READONLY OBSERVATION - {obs['observedUtc']}.
SAME ONE100000/source187636984895aec44044635fb63498b0fcb3102e/PASS6211327371/invocation{props['InvocationID']} ACTIVE/running/MainPID{props['MainPID']}/805306368Swap0/90min/TimeoutStop300/exactrootExecStopPost. Current{props['MemoryCurrent']}/controllerpeak{props['MemoryPeak']} OPEN observationsONLY/notapppeak/closedresult. {len(obs['fileMetadata'])}rootfiles/ALL65uploaded0400package hashes match/no startupresult/terminal/controllerafter/stop-post atobservation. ActiveResultsuccess/ExecMainStatus0 NOTclosedPASS.
FIRSTordinaryjobsOFF ACTUALLYATTEMPTED {first['id']}/PID{ident['pid']}/StartedAt{ident['startedAt']}/ownerexact100000root:startup-1. {obs['healthPollCounts']['startup-1']}FULLhealth/{obs['memorySampleCounts']['startup-1']}memory; latest2health {[v['elapsedSeconds'] for v in health.values()]}s unhealthy/WITHIN600/EACHfull5Health.Log/FailingStreak{p['state']['Health']['FailingStreak']}. Observedunhealthy{p['unhealthySecondsObservedSoFar']}s MONOTONICpollintervalONLY/notexactunobservedtransitiontime. SECOND0health0memory/noattemptobserved.
LATEST2memory {json.dumps(totals,sort_keys=True)} EACH<=603979776B independentlyrederivedfromALL16original0400kernelraws/SHA-length/readbounds/stat/events/scalars/membership/mountinfo. SAMEexactCID/PID/start/owner/805memory=swap/cgroupdev{cg['device']}inode{cg['inode']}/exactIDleaf/membershipwithinidentical/descriptorbetweenstable/OOM0/DockerOOMfalse/restarts0. Apppeak{samples[sorted(samples)[-1]]['memoryPeakBytesObservation']}/maxhighreclaim OBSERVATIONSONLY/notcontinuouspeak/notALLsamples/wholeproof. Initialcontroller8raws/dev24inode43231/memory.stat anon{memory_stat['anon']}file{memory_stat['file']}/OOM0 reverified/BEFOREONLY/noafterstoppostPASS. FulljournalreviewedtwoPID1startrecordsONLY.
ACTUALORIGINALruntimeR4BEFOREcopies NOWOBSERVED {runtime['observedUtc']} req{runtime['requiredBytes']}/free{min(runtime['freeBytes'].values())} EACH3/SAMEFS64769/4096/nonadditive/ADDITIONAL10GB/pkgfuture0alreadyoccupied/db563326976/assets5787648. RETAINEDoriginal/NOTfreshmeasurement. BeforeROOT08:31:39req60933277806free76026531840/future11296768;beforeUNIT08:32:23req60921981038free76017242112 remainbound. N25MIN64/25percent/3assets/schema+markers/stagecaps/floor10556150894+4GiBlogs+10GB/500MBunchanged. ALL37+1333unchanged/currentauthorityfresh/mainbeCI38772398721attempt1pushCLOSEDSUCCESS/#191CLOSED.
Fullreadonlyoriginals/latest2FULLhealthmemory/16kernelraws/runtimeR4/independentrecord at {REL}second-mount-order-100000-opening-publication-once/publication-index.json. NEWCONSUMEDNEVERREPLAY observe-mount-order-100000-second-readonly-once.py;publish-mount-order-100000-second-opening-once.py(localinventoryKeyErrorBEFOREDcreate/GH/stage);publish-mount-order-100000-second-opening-complete-once.py. Activeinventoryenumerationprecededsealedmemory272creation; originalobserver0400/stablebeforeafterstatchecked/laterselectedsampleandALL8rawsverified/noabsenceinferred/nohostreadreplay. ALL100000rootunit/PASS/package/operatorsCONSUMEDimmutable/NEVERredispatchretryreplaycleanup. NojobsONlogsselectedpublished/DBsBOTHprivatekeysHOST0400/no privatebytesfetched.
NEXTreasonableinterval NEWuniqueREADONLYobserver SAMErootunitinvocation/latest2FULLhealthmemory originals/counts/status. No freshproductionmemorysampling/SQL/du/redispatch/sourceedit/stop/retry/cleanup/concurrentwriter. OnactualCLOSED retainALLpublicraw/privatehashstatONLY/ALLhealthmemory/fullsameinvjournal+hookexit/65package/inputpreservation/accounting; independentlyvalidateOFF31API6probes11242+2NATURALsync strictpairingsecondidempotencerefusalsscience/EVERY805600/budgets/fullfirstsecondpreservation/reconstructedlabels. BOTHexactownersstoppedAndRetained NONVACUOUS/postStopErrorsEMPTY/controllerbeforeafterpoststop rawsamecgroupOOM0/journalhookexit0 mandatory; runtimeAWAITINGnotclosedPASS. ALLjobsONlogs contentreviewBEFOREpublicGit/privateDBkeysHOST. First-sync retriable stallcursor refusal reporthonestly/oneattempt no rerun. ONEeventualactualresult@claude162 bundles621132PASSACKONLYthere/no duplicates. Source621098ANSWERED/08:24:55nativefallbackCANCELLEDNEVERrepeat. Old063000080000operatorsCONSUMEDimmutable.
QualificationONLY/no kitgatedeploy/MainMERGEHOLD/233000KEEPIT/R2COMPLETE/noprune/nohostgrowrestart/no103/noagentsnewchatworktreecheckoutconcurrentwriter/humansheld/sevenstatusalreadyanswered/ClacceptsYYsinglewriter. Futurekit186new22holdsC1validated/countsmaydiff+stopgraceactualexitincluded9to10minrestart/exact600failure. SAMEheartbeatACTIVE2min restore10ONLYactualbeDEPLOYED+ClactualpostdeployPASS. Preserve ALL older history verbatim below.

'''
result=boundary_publish(D,[*O.iterdir(),H/'observe-mount-order-100000-second-readonly-once.py',H/'publish-mount-order-100000-second-opening-once.py',pathlib.Path(__file__)],'Retain mount-order second observation and runtime capacity originals',lead)
print(json.dumps({**result,'observedUtc':obs['observedUtc'],'latestSampleNonReclaimableBytes':totals,'runtimeRequiredBytes':runtime['requiredBytes'],'runtimeFreeBytes':runtime['freeBytes'],'proofComplete':False,'newOperatorCalls':0}))
