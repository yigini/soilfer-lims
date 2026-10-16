"""Publish the sixth immutable observation of the same consumed mount-order attempt."""
import pathlib,re,sys
sys.dont_write_bytecode=True
W=pathlib.Path(__file__).resolve().parents[2];H=W/'WP/backlog-resume-20261013';sys.path.insert(0,str(H))
from prechecks6210209468_evidence import git,sha,oid,canonical,utc,save
from prechecks6210209468_boundary_publication import boundary_publish
REL='WP/batch-proof-mount-order-forward-be837974-20261016/';B=W/REL
D=B/'sixth-mount-order-100000-opening-publication-once';O=B/'sixth-mount-order-100000-readonly-observation-once'
BASE='5d1049fb7a9b74905aecaed3f83b0310a5e94fb0'
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
require(not any(n in selected for n in ['proof-receipt.json','proof-terminal-refusal.json','stop-post-result.json','startup-2-result.json']),'Terminal/stage result observed; retain honestly in new successor')
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
require(len(health)==len(samples)==4 and len(attempts)==2 and obs['healthPollCounts']=={'startup-1':349,'startup-2':319} and obs['memorySampleCounts']=={'startup-1':389,'startup-2':377},'Observed two-startup scope differs')
require(all(attempts[label]['jobsEnabled'] is enabled and attempts[label]['neverRetry'] is True and re.fullmatch('[0-9a-f]{64}',attempts[label]['id']) for label,enabled in [('startup-1',False),('startup-2',True)]),'Exact two ordinary attempts required')
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
ident=previous['startup-1']['identity'];cg=previous['startup-1']['cgroup']
require(previous['startup-2']['identity']['id']=='0d7d839ec65f177ff5270ec86b4a13c6492a23d639469eacae1d99b2cb76468f' and previous['startup-2']['identity']['pid']==697711 and previous['startup-2']['identity']['startedAt']=='2026-10-16T08:46:32.632928099Z' and previous['startup-2']['cgroup']['device']==24 and previous['startup-2']['cgroup']['inode']==44613,'New second exact observed owner differs')
for name,poll in health.items():
    label=name.split('-health-poll-')[0];health_ident=previous[label]['identity']
    require(label in attempts and poll['state']['Running'] is True and poll['state']['OOMKilled'] is False and poll['state']['Pid']==health_ident['pid'] and poll['state']['StartedAt']==health_ident['startedAt'],'Full health identity differs')
    require(type(poll['elapsedSeconds']) in [int,float] and 0<=poll['elapsedSeconds']<=600 and poll['status']==poll['state']['Health']['Status'] and poll['status'] in ['healthy','unhealthy'] and len(poll['state']['Health']['Log'])==5,'Full original health/deadline differs')
    require(all((row['ExitCode']==1 and row['Output']=="wget: can't connect to remote host: Connection refused\n") or (row['ExitCode']==0 and row['Output']=='') for row in poll['state']['Health']['Log']),'Health output requires further public content review')
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
later_selected=sorted(n for n in selected if n not in metadata)
for n,raw in selected.items():
    if n in metadata:require(metadata[n]['mode']=='0o400' and metadata[n]['bytes']==len(raw.encode()),'Selected original metadata differs '+n)
    if n in obs['sealedOriginalStats']:
        st=obs['sealedOriginalStats'][n];require(st['beforeAfterStatEqual'] is True and st['mode']=='0o400' and st['bytes']==len(raw.encode()),'Sealed sample stat differs '+n)
    else:require(n in metadata,'Selected original missing both inventory and sealed stat '+n)

journal=[exact_json(line.encode()) for line in obs['journal']['stdout'].splitlines() if line]
require(obs['journal']['exitCode']==0 and not obs['journal']['stderr'] and len(journal)==2 and all(r['_PID']=='1' and r['INVOCATION_ID']==props['InvocationID'] and r['MESSAGE'].startswith(('Starting /usr/bin/python3 -B ','Started /usr/bin/python3 -B ')) for r in journal),'Journal requires additional content review before publication')
prior=exact_json((B/'fifth-mount-order-100000-opening-publication-once/later-opening-complete-record.json').read_bytes())
for label,descriptor in previous.items():
    held=[v for n,v in prior['latestMemorySamples'].items() if n.startswith(label+'-memory-')]
    require(held and all({'identity':v['identity'],'cgroup':v['cgroup']}==descriptor for v in held),'Owned identity changed since fifth observation')
from proof_app_sources import APP_PINS,validate_sources
appraw=prep.raw_git_many(CANDIDATE,sorted(APP_PINS));app_derivation=validate_sources(appraw)
require(len(appraw)==458,'All458 raw Git APP pins required')
require('startup-1-result.json' in selected and 'startup-2-result.json' not in selected,'First result only required')
first_result_raw=selected['startup-1-result.json'].encode();off=exact_json(first_result_raw)
ready=off['readiness'];checks=ready['checks'];broad=off['broadPostflights']
require(off['id']==attempts['startup-1']['id'] and off['fullInstalledStatePreserved'] is True and off['stoppedContainerRetained'] is True,'First recorded preservation flags differ')
require(checks['jobsEnabled'] is False and type(checks['databaseChanges']) is int and checks['databaseChanges']==0,'First recorded jobs/scope differs')
spec_raw=(B/('proof-package-'+ROOT_NAME)/'proof-input.json').read_bytes();require(sha(spec_raw)==obs['packageHashes']['proof-input.json']['sha256'],'Uploaded spec differs');spec=exact_json(spec_raw)
require(spec['expectedEntrypointVerifiers']==27 and spec['expectedReadyEvents']==app_derivation['readyEvents'],'Exact27verifiers/26READY inventory differs')
require(len(checks['entrypointVerifiers'])==27 and all(x.get('mode')=='NO_OP' and type(x.get('totalChanges')) is int and x['totalChanges']==0 for x in checks['entrypointVerifiers']),'27 exact recorded NO_OP0 required')
require(len(checks['readyEvents'])==26 and {x['event'] for x in checks['readyEvents']}==set(app_derivation['readyEvents']) and all(type(x.get('totalChanges')) is int and x['totalChanges']==0 for x in checks['readyEvents']),'26 exact recorded READY0 required')
require(ready['httpProbes']==[{'path':'/api/health','method':'GET','status':200},{'path':'/login','method':'GET','status':200},{'path':'/api/v2/sis/receipts','method':'POST','status':401}] and 0<ready['readinessElapsedSeconds']<600,'Recorded HTTP/deadline differs')
require(broad['apiChecks']=={'failed':0,'passed':31,'total':31} and broad['fullStoppedEqualityRequiredAfterAllProbes'] is True,'Recorded broad API summary differs')
probes=['postflight-roles.cjs','postflight-auth.cjs','postflight-reference.cjs','postflight-qc-runs.cjs','postflight-policy.cjs','readonly-smoke.cjs']
require(len(broad['readOnlyProbes'])==6 and [r['source'] for r in broad['readOnlyProbes']]==probes,'Six probe inventory differs')
for row in broad['readOnlyProbes']:require(type(row['exitCode']) is int and row['exitCode']==0 and row['sha256']==sha((B/row['source']).read_bytes()),'Probe source/exit differs')
require(ready['healthPollCount']==len(ready['healthPollEvidence'])==obs['healthPollCounts']['startup-1']==349 and len(off['memory']['hostMemorySamples'])==obs['memorySampleCounts']['startup-1']==389,'First evidence counts differ')
require(len(retained)==32 and samples['startup-1-memory-000389.json']['phase']=='before-stop' and [samples[n]['phase'] for n in sorted(samples) if n.startswith('startup-2-')]==['natural-intake','natural-intake'],'First final plus second two natural-intake memory required')
require(len(first_result_raw)==615264 and sha(first_result_raw)=='9ed3451f789cf10e3b6a2267ad6e0f0a51380ceae168e6d90fe3c94550a9e622' and first_result_raw==(B/'third-mount-order-100000-opening-publication-once/startup-1-result.json').read_bytes(),'Full first original result changed')
first_record={'status':'FIRST_JOBS_OFF_PRODUCER_RESULT_RECORDED_FIELDS_VALIDATED_NOT_FULL_RAW_CLOSURE_VALIDATION','originalBytes':len(first_result_raw),'originalSha256':sha(first_result_raw),'entryNoOpIntegerZeroCount':27,'exactReadyIntegerZeroCount':26,'httpProbes':ready['httpProbes'],'readinessElapsedSeconds':ready['readinessElapsedSeconds'],'dockerHealthySeconds':ready['timeToFirstHealthySeconds'],'healthPolls':349,'memorySamples':389,'broadPostflights':broad,'recordedFullInstalledStatePreserved':True,'recordedStoppedContainerRetained':True,'producerMemorySummary':{k:v for k,v in off['memory'].items() if k!='hostMemorySamples'},'allCommandRawAndFullStoppedStateIndependentClosureValidationStillRequired':True,'wholeProofComplete':False}
evidence=prep.current_evidence(review,index)
D.mkdir()
for n,raw in retained.items():save(D,n,raw)
for n,raw in selected.items():save(D,n,raw.encode())
save(D,'fresh-current-authority-evidence.json',canonical(evidence)+b'\n')
record={'status':'SAME_MOUNT_ORDER_PROOF_ACTIVE_AT_SIXTH_OBSERVATION_FIRST_RECORDED_RESULT_NOT_WHOLE_PASS','observedUtc':obs['observedUtc'],'root':str(ROOT),'unit':obs['unit'],'invocationId':props['InvocationID'],'actualUnitProperties':props,'sourceCommit':index['head'],'sourceReviewId':review['id'],'fileCount':len(obs['fileMetadata']),'runtimeR4Original':runtime,'runtimeR4IsRetainedOriginalNotNewMeasurement':True,'attempts':attempts,'healthPollCounts':obs['healthPollCounts'],'memorySampleCounts':obs['memorySampleCounts'],'latestHealthObservations':health,'latestMemorySamples':samples,'latestSampleIndependentNonReclaimableBytes':totals,'rawKernelReadsIndependentlyVerified':len(retained),'all65PackageHashesAnd37Plus1333SourcesVerified':True,'onlyLatestSamplesValidatedHere':True,'continuousPeakClaimed':False,'newLiveMemoryCounterReads':0,'newOperatorCalls':0,'proofComplete':False,'retryAllowed':False,'noJobsOnDockerLogsSelectedOrPublished':True,'allJobsOnRawLogsContentReviewStillRequiredBeforePublicPublication':True,'controllerBeforeEightRawReadsIndependentlyVerified':True,'controllerBeforeSnapshot':mem,'journalContentReviewed':'Two PID1 lifecycle start records only'}
save(D,'first-startup-recorded-result-derived.json',canonical(first_record)+b'\n')
record['firstProducerResultRecordedFields']=first_record;record['all458RawGitAppPinsIndependentlyVerified']=True;record['sameOwnedIdentitySinceFifthObservationLabels']=['startup-1','startup-2'];record['secondStartupObservedEarlierAndStable']=True;record['laterSelectedBeyondEarlierInventory']=later_selected
save(D,'later-opening-complete-record.json',canonical(record)+b'\n')
lead=f'''LATEST ACTUAL SIXTH MOUNT-ORDER100000 READONLY OBSERVATION / SAME JOBS-ON NATURAL-INTAKE PHASE - {obs['observedUtc']}.
SAME ONE100000/source187636984895aec44044635fb63498b0fcb3102e/PASS6211327371/invocation{props['InvocationID']} ACTIVE/running/MainPID{props['MainPID']}/805306368Swap0/90min/TimeoutStop300/exactrootExecStopPost. Current{props['MemoryCurrent']}/controllerpeak{props['MemoryPeak']} OPENCONTROLLER observationsONLY/separatefromapppeak/closedresult. Controllerpeak1253376B aboveMax observationONLY/no OOMorchargecauseinferred. {len(obs['fileMetadata'])}rootfiles/ALL65uploaded0400packageSHAequal. No secondresult/proofreceipt/refusal/controllerafter/stop-post atobservation; activeResultsuccess/ExecMainStatus0 NOTclosedPASS.
FIRSTjobsOFF FULL615264B originalresult unchangedSHA{sha(first_result_raw)}. Recorded27entrypointNO_OP EXACTinteger0+26exactREADY EXACTinteger0/HTTP200200401/readiness{ready['readinessElapsedSeconds']}s<600/broad31API0failed+6exactreadonlyprobeSHAexit0. FullInstalledStatePreservedtrue/stoppedContainerRetainedtrue RECORDED; fields rechecked against uploadedproofinput/ALL458rawGitAPPpins/currentREADYinventory. ALLcommandraws/full112tables42receipts stoppedstate/ALL389memory stillrequireindependentclosurevalidation/NOTwholeproofPASS. SAME75e64220094ff8b6a2e7ec2f811107b94ebaac2eeb808222361ac932fcb265dc/PID671623/start08:34:27.38615017Z/dev24inode43746/349FULLhealth389memory/final389before-stop/healthy423.1075271220034sWITHIN600.
SECONDordinaryjobsON SAME0d7d839ec65f177ff5270ec86b4a13c6492a23d639469eacae1d99b2cb76468f/PID697711/start2026-10-16T08:46:32.632928099Z/ownerexact100000root:startup-2/dev24inode44613/805memory=swap. 319FULLhealth377memory at readonlyobservation. Latest318unhealthy392.34420983799646s/FailingStreak12 then319healthy393.53061386999616s/FailingStreak0 WITHIN600/FULL5Health.LogEACH unchangedSINCEfifth. Observedunhealthy300.15377947699744s then301.34018350899714s MONOTONICobservedpollintervals/notexactunobservedtransitiontime. DockerhealthtransitionONLY; secondHTTP/fullresult/twoNATURALsyncs/provenance/refusals/wholeproofPENDING. first-sync-preservation.json NAME observedinfileinventoryONLY/no result-content or successful-syncclaim here.
LATEST2memoryEACHstartup {json.dumps(totals,sort_keys=True)} EACH<=603979776/ALL32original0400kernelraws independentlyrederived/SHA-length/readbounds/stat/events/scalars/membership/mountinfo/exactCIDPIDstartownerlimitscgroupIDleaf stablewithinbetweenEACHlabel AND unchangedSINCEfifth/OOM0/DockerOOMfalse/restarts0. FIRST388running-command389FINALbefore-stop. SECOND376377BOTHnatural-intake. Appfirstpeak805322752/second805306368/maxhighreclaim OBSERVATIONSONLY/notcontinuouspeak/notALL766samples/wholePASS. Initialcontroller8raws/dev24inode43231/memory.stat anon32972800file6443008/OOM0 reverified/BEFOREONLY/noafterstoppost. FulljournalreviewedtwoPID1startrecordsONLY.
SAMEORIGINALruntimeR4beforecopies08:33:39.193844UTC req60921981038/free76016742400EACH3/SAMEFS64769/4096/nonadditive/ADDITIONAL10GB/pkgfuture0alreadyoccupied/NOTfreshmeasurement. BeforeROOT08:31:39req60933277806free76026531840future11296768/UNIT08:32:23req60921981038free76017242112 remainbound. N25MIN64/25percent/3assets/schema+markers/stagecaps/floor10556150894+4GiBlogs+10GB/500MBunchanged. All37+1333unchanged/currentauthorityfresh/mainbeCI38772398721attempt1pushCLOSEDSUCCESS/#191CLOSED.
Fullreadonlyoriginals/FULLfirstresult/latest2FULLhealthmemoryEACH/32kernelraws/runtimeR4/independentrecord at {REL}sixth-mount-order-100000-opening-publication-once/publication-index.json. NEWCONSUMEDNEVERREPLAY observe-mount-order-100000-sixth-readonly-once.py;publish-mount-order-100000-sixth-opening-once.py. NojobsONlogsselectedpublished/privateDBBOTHkeysHOST0400/no privatebytesfetched. ALL100000rootunit/PASS/package/operatorsCONSUMEDimmutable/NEVERredispatchretryreplaycleanup.
NEXTreasonableinterval NEWuniqueREADONLYobserver SAMErootunitinvocation/latest2FULLhealthmemory originals/counts/status/actualsecondresultIFobserved. No freshproductionmemorysampling/SQL/du/redispatch/sourceedit/stop/retry/cleanup/concurrentwriter. OnactualCLOSED retainALLpublicraw/privatehashstatONLY/ALLhealthmemory/fullsameinvjournal+hookexit/65package/inputpreservation/accounting; independentlyvalidateOFF31API6probes11242+2NATURALsync strictpairingsecondidempotencerefusalsscience/EVERY805600/budgets/fullfirstsecondpreservation/reconstructedlabels. BOTHexactownersstoppedAndRetained NONVACUOUS/postStopErrorsEMPTY/controllerbeforeafterpoststop rawsamecgroupOOM0/journalhookexit0 mandatory; runtimeAWAITINGnotclosedPASS. ALLjobsONlogs contentreviewBEFOREpublicGit/privateDBkeysHOST. First-sync retriable stallcursor refusal reporthonestly/no rerun. ONEeventualactualresult@claude162 bundles621132PASSACKONLYthere/no duplicates. Source621098ANSWERED/08:24:55nativefallbackCANCELLEDNEVERrepeat. Old063000080000operatorsCONSUMEDimmutable.
QualificationONLY/no kitgatedeploy/MainMERGEHOLD/233000KEEPIT/R2COMPLETE/noprune/nohostgrowrestart/no103/noagentsnewchatworktreecheckoutconcurrentwriter/humansheld/sevenstatusalreadyanswered/ClacceptsYYsinglewriter. Futurekit186new22holdsC1validated/countsmaydiff+stopgraceactualexitincluded9to10minrestart/exact600failure. SAMEheartbeatACTIVE2min restore10ONLYactualbeDEPLOYED+ClactualpostdeployPASS. Preserve ALL older history verbatim below.

'''
result=boundary_publish(D,[*O.iterdir(),H/'observe-mount-order-100000-sixth-readonly-once.py',pathlib.Path(__file__)],'Retain sixth same-invocation mount-order natural-intake observation',lead)
print(json.dumps({**result,'observedUtc':obs['observedUtc'],'latestSampleNonReclaimableBytes':totals,'runtimeRequiredBytes':runtime['requiredBytes'],'runtimeFreeBytes':runtime['freeBytes'],'proofComplete':False,'newOperatorCalls':0}))
