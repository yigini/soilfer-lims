"""Publish the same consumed jobs proof's fourth read-only observation."""
import datetime,pathlib,subprocess,sys
R=pathlib.Path(__file__).resolve().parents[2];REL='WP/batch-proof-controller-forward-step2-be837974-20261016/';S=R/REL
D=S/'fourth-controller-forward-063000-opening-publication-once';O=S/'fourth-controller-forward-063000-readonly-observation-once'
BASE='a4b3dbef3f7865e66ef04acd7fcc14c2e3197598'
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
from proof_app_sources import APP_PINS,validate_sources
# APP_PINS bind raw Git blob bytes. The existing local checkout has protected
# unrelated CRLF dirt; its1333 frozen hashes were checked separately above.
names=list(APP_PINS);query=''.join(CANDIDATE+':'+n+'\n' for n in names).encode()
p=subprocess.run(['git','cat-file','--batch'],cwd=R,input=query,capture_output=True)
require(p.returncode==0 and not p.stderr,'Raw pinned Git source batch failed')
offset=0;raw_sources={}
for name in names:
    end=p.stdout.index(b'\n',offset);header=p.stdout[offset:end].split();require(len(header)==3 and header[1]==b'blob','Raw Git blob missing')
    length=int(header[2]);offset=end+1;raw_sources[name]=p.stdout[offset:offset+length];offset+=length
    require(p.stdout[offset:offset+1]==b'\n' and header[0].decode()==APP_PINS[name]['blob'],'Pinned blob identity differs');offset+=1
require(offset==len(p.stdout),'Extra raw Git bytes')
require((R/'shared/delimitedText.js').read_bytes().replace(b'\r\n',b'\n')==raw_sources['shared/delimitedText.js'],'Exact CRLF-only local mismatch must be proved')
app_derivation=validate_sources(raw_sources)
require(set(attempts)=={'startup-1','startup-2'} and attempts['startup-1']['jobsEnabled'] is False and attempts['startup-2']['jobsEnabled'] is True,'Actual independent OFF and ON attempts required')
require(attempts['startup-2']['id']=='1dd67eaafc9d19c5374b04b5a72f16439d05c97aa2c87abad0df09ed3ddf5aa4','Exact second owned ID required')
require('startup-1-result.json' in obs['selectedOriginalUtf8'] and 'startup-2-result.json' not in obs['selectedOriginalUtf8'],'Only first producer result observed')
first_result_raw=obs['selectedOriginalUtf8']['startup-1-result.json'].encode('utf-8');off=exact_json(first_result_raw)
ready=off['readiness'];checks=ready['checks'];broad=off['broadPostflights']
require(off['id']==attempts['startup-1']['id'] and off['fullInstalledStatePreserved'] is True and off['stoppedContainerRetained'] is True,'First recorded preservation flags differ')
require(checks['jobsEnabled'] is False and type(checks['databaseChanges']) is int and checks['databaseChanges']==0,'First recorded jobs/scope differs')
spec_raw=(S/('proof-package-'+ROOT_NAME)/'proof-input.json').read_bytes();require(sha(spec_raw)==obs['packageHashes']['proof-input.json']['sha256'],'Exact uploaded spec binding differs');spec=exact_json(spec_raw)
require(spec['expectedEntrypointVerifiers']==27 and spec['expectedReadyEvents']==app_derivation['readyEvents'],'Reviewed fixed verifier and raw READY inventory differs')
require(len(checks['entrypointVerifiers'])==spec['expectedEntrypointVerifiers']==27 and all(x.get('mode')=='NO_OP' and type(x.get('totalChanges')) is int and x['totalChanges']==0 for x in checks['entrypointVerifiers']),'27 exact recorded NO_OP0 required')
require(len(checks['readyEvents'])==26 and {x['event'] for x in checks['readyEvents']}==set(app_derivation['readyEvents']) and all(type(x.get('totalChanges')) is int and x['totalChanges']==0 for x in checks['readyEvents']),'All26 exact recorded READY0 required')
require(ready['httpProbes']==[{'path':'/api/health','method':'GET','status':200},{'path':'/login','method':'GET','status':200},{'path':'/api/v2/sis/receipts','method':'POST','status':401}] and 0<ready['readinessElapsedSeconds']<600,'Recorded HTTP/deadline differs')
require(broad['apiChecks']=={'failed':0,'passed':31,'total':31} and broad['fullStoppedEqualityRequiredAfterAllProbes'] is True,'Recorded broad API summary differs')
probes=['postflight-roles.cjs','postflight-auth.cjs','postflight-reference.cjs','postflight-qc-runs.cjs','postflight-policy.cjs','readonly-smoke.cjs']
require(len(broad['readOnlyProbes'])==6 and [r['source'] for r in broad['readOnlyProbes']]==probes,'Six exact probe inventory differs')
for row in broad['readOnlyProbes']:require(type(row['exitCode']) is int and row['exitCode']==0 and row['sha256']==sha((S/row['source']).read_bytes()),'Recorded probe source/exit differs')
require(ready['healthPollCount']==len(ready['healthPollEvidence'])==obs['healthPollCounts']['startup-1']==343 and len(off['memory']['hostMemorySamples'])==obs['memorySampleCounts']['startup-1']==364,'Recorded first evidence counts differ')
require(len(samples)==4 and len(retained)==32,'Latest two samples and16 raws EACH startup required')
require(all(s['phase']=='health-poll' for n,s in samples.items() if n.startswith('startup-2-')),'Second current samples phase differs')
first_record={'status':'FIRST_JOBS_OFF_PRODUCER_RESULT_RECORDED_FIELDS_VALIDATED_NOT_FULL_RAW_CLOSURE_VALIDATION','originalBytes':len(first_result_raw),'originalSha256':sha(first_result_raw),'entryNoOpIntegerZeroCount':27,'exactReadyIntegerZeroCount':26,'httpProbes':ready['httpProbes'],'readinessElapsedSeconds':ready['readinessElapsedSeconds'],'dockerHealthySeconds':ready['timeToFirstHealthySeconds'],'healthPolls':343,'memorySamples':364,'broadPostflights':broad,'recordedFullInstalledStatePreserved':True,'recordedStoppedContainerRetained':True,'producerMemorySummary':{k:v for k,v in off['memory'].items() if k!='hostMemorySamples'},'allCommandRawAndFullStoppedStateIndependentClosureValidationStillRequired':True,'wholeProofComplete':False}

prior=exact_json((S/'third-controller-forward-063000-opening-publication-once/later-opening-complete-record.json').read_bytes())
for label,descriptor in previous.items():
    held=[v for n,v in prior['latestMemorySamples'].items() if n.startswith(label+'-memory-')]
    if held:require(all({'identity':v['identity'],'cgroup':v['cgroup']}==descriptor for v in held),'Identity changed since third observation')
require(props['TimeoutStopUSec']=='5min' and str(ROOT)+'/stop_owned.py' in props['ExecStopPost'],'Exact stop-post configuration differs')
require(obs['healthPollCounts']=={'startup-1':343,'startup-2':103} and obs['memorySampleCounts']=={'startup-1':364,'startup-2':102},'Actual fourth observation counts differ')
for name,poll in health.items():
    label=name.split('-health-poll-')[0];ident=previous[label]['identity']
    require(poll['state']['Pid']==ident['pid'] and poll['state']['StartedAt']==ident['startedAt'] and len(poll['state']['Health']['Log'])==5,'Full health identity or log differs')
require(all(row['kernelPath']=='/proc/'+props['MainPID']+'/mountinfo' for sample in samples.values() for row in sample['originalKernelReads'][1:2]),'Controller mountinfo PID differs')
evidence=prep.current_evidence(review,index)
D.mkdir()
def save(n,raw):
    with (D/n).open('xb') as f:f.write(raw)
for n,raw in retained.items():save(n,raw)
for n,raw in obs['selectedOriginalUtf8'].items():save(n,raw.encode('utf-8'))
save('fresh-current-authority-evidence.json',canonical(evidence)+b'\n')
record={'status':'SAME_CONTROLLER_FORWARD063000_ACTIVE_FOURTH_OBSERVATION_FIRST_OFF_RESULT_SECOND_ON_STARTUP_NOT_CLOSED_PASS','observedUtc':obs['observedUtc'],'root':str(ROOT),'unit':obs['unit'],'invocationId':props['InvocationID'],'actualUnitProperties':props,'sourceCommit':index['head'],'sourceReviewId':review['id'],'fileCount':len(obs['fileMetadata']),'runtimeR4Original':runtime,'runtimeR4IsRetainedOriginalNotNewMeasurement':True,'attempts':attempts,'healthPollCounts':obs['healthPollCounts'],'memorySampleCounts':obs['memorySampleCounts'],'latestHealthObservations':health,'latestMemorySamples':samples,'latestSampleIndependentNonReclaimableBytes':totals,'rawKernelReadsIndependentlyVerified':len(retained),'all59PackageHashesAnd31Plus1333SourcesVerified':True,'onlyLatestSamplesValidatedHere':True,'continuousPeakClaimed':False,'newLiveMemoryCounterReads':0,'newOperatorCalls':0,'noTerminalAtObservation':True,'proofComplete':False,'firstJobsOffRecordedResultValidation':first_record,'retryAllowed':False,'noJobsOnDockerLogsSelectedOrPublished':True,'allJobsOnRawLogsContentReviewStillRequiredBeforePublicPublication':True,'controllerBeforeSevenRawReadsIndependentlyVerified':True,'controllerBeforeSnapshot':mem,'journalContentReviewed':'Two PID1 lifecycle start records only','sameFirstContainerIdentityAsThirdObservation':True,'allCommandRawsAndFullStoppedStateIndependentClosureValidationStillRequired':True}
save('later-opening-complete-record.json',canonical(record)+b'\n');save('first-jobs-off-recorded-result-derived.json',canonical(first_record)+b'\n')
save('inline-generator-syntax-refusal-derived.json',canonical({'classification':'LOCAL_GENERATOR_SYNTAX_REFUSAL_BEFORE_HELPER_CREATION','error':'SyntaxError invalid decimal literal from nested triple-single-quoted generator text','helperCreated':False,'publicationCreated':False,'hostCalls':0,'sourceChanged':False,'operatorReplay':False,'resolution':'Distinct corrected generator uses triple-double-quoted enclosing literal; exclusive new fourth helper compiled before saving.'})+b'\n')
second_health=health[sorted(n for n in health if n.startswith('startup-2-'))[-1]];second_sample=samples[sorted(n for n in samples if n.startswith('startup-2-'))[-1]];i=second_sample['identity'];cg=second_sample['cgroup']
lead=f'''LATEST ACTUAL FOURTH CONTROLLER-FORWARD063000 READONLY OBSERVATION / FIRST OFF RESULT AND SECOND ON STARTUP - {obs['observedUtc']}.
SAME ONE063000/exact572d8cc94ee5a98c29392f556a57133cedd13128/PASS6208186148/invocation{props['InvocationID']} ACTIVE/running/MainPID{props['MainPID']}/MemoryMax805306368Swap0/Runtime90min/TimeoutStop300/exactrootExecStopPost. Current{props['MemoryCurrent']}/controllerpeak{props['MemoryPeak']} OPENCONTROLLER observationsONLY/separatefromapppeak/closedresult. Controllerpeak352256B aboveMax is observationONLY/no OOM or cause inferred. {len(obs['fileMetadata'])}rootfiles/all59uploaded0400package hashes match. NOsecondresult/proofreceipt/terminalrefusal/controllerafter/stop-post observed; activeResultsuccessExecMainStatus0 NOTclosedPASS. No jobsON natural completion claimed.
FIRSTjobsOFF FULL original result ACTUALLYOBSERVED {len(first_result_raw)}B/SHA{sha(first_result_raw)}. Recorded27entrypointNO_OP EXACTinteger0+26EXACTcurrentREADY EXACTinteger0/HTTP200200401/readiness{ready['readinessElapsedSeconds']}s within600/broad31of31API0failed+6exactreadonlyprobeSHAexit0. FullInstalledStatePreservedtrue/stoppedContainerRetainedtrue recorded. Result fields independently checked against uploaded proof-input/all458rawGitAPPpins/currentREADY inventory. ALL raw command logs/full112tables42receipts stopped-state equality/ALL364memory still require independent closure validation, NOTwholeproofPASS. Firsthealthy423.6703404939981s/343FULLhealth/364memory/final364before-stop/producermaxsampled279720544/maxREADYrss173326336/evidence22847488B inside4GiBlogs. FirstCIDd28d6aaf62931146fc2bd6225af0301ab7b63345117d23bb01c3218f7fc1f592 unchanged. Observedunhealthy331.6326452289977s isMONOTONICobservedpollintervals/notexactunobservedDockertransitiontime.
SECONDordinaryjobsON ACTUALLYATTEMPTED {i['id']}/PID{i['pid']}/StartedAt{i['startedAt']}/ownerexact063000root:startup-2/805memory=swap. 103FULL0400healthpolls/102memory at asynchronousreadonlyobservation. Latest2health102+103 unhealthy123.87462126299943s/125.10467462999804s/FailingStreak4/FULL5Health.LogEACH/WITHIN600. Transientunhealthy allowed/no failure or PASS inferred. Secondresult/twoNATURALsyncs/provenance/refusals/wholeproof pending.
Latest2memoryEACHstartup independentlyrederived fromALL32original0400kernelreads/SHA+length/readbounds/stat/events/scalars/procmembership/mountinfo: {json.dumps(totals,sort_keys=True)} <=603979776B. Stableexactidentity within/betweenEACHlabel; FIRSTunchanged sinceTHIRD/dev24inode34833. SECONDdev{cg['device']}inode{cg['inode']}/exactfullCIDleaf/membershipwithinidentical/OOMfalse/restarts0/oom=oom_kill0. First363running-command364FINALbefore-stop; second101102health-poll. Apppeakfirst805351424/second805306368/maxhighreclaim OBSERVATIONS ONLY underapprovedmemory.events policy/no continuouspeak/no ALL466samples/wholeproofclaim. Initialcontroller7rawsdev24inode34168/OOM0 independentlyreverified/noafterstoppost. Fulljournalcontentreviewed:twoPID1startrecordsonly.
SAME ACTUAL ORIGINAL runtimeR4beforecopies04:46:07.300063UTC required60921981038/free86384013312EACH3/SAMEFS64769/canonical4096/nonadditive/ADDITIONAL10GB/futurepkg0alreadyoccupied/db563326976/assets5787648. RETAINED ORIGINAL/notnewmeasurement. BeforeROOT04:44:10req60932745326/free86393110528/future10764288 andbeforeUNIT04:44:49req60921981038/free86384353280 remainbound. N25MIN64/25percent/3assets/schema+markers/stagecaps/floor10556150894+4GiBlogs+10GB/500MB unchanged. All31+1333unchanged/freshmainbeCI38772398721attempt1pushCLOSEDSUCCESS/4audits6rules2postrebootmemoryjobsdiagnosticprivacyacceptancecontroller620791R2/#191CLOSED/nolaterfailure verified.
Fullreadonlyoriginals/FULLfirstresult/latest2FULLhealthmemoryEACH/32kernelraws/runtimeR4/independentrecord at {REL}fourth-controller-forward-063000-opening-publication-once/publication-index.json/later-opening-complete-record.json. NEWCONSUMEDNEVERREPLAY observe-controller-forward-step2-063000-fourth-readonly-once.py;publish-controller-forward-step2-063000-fourth-opening-once.py. InlinegeneratorSyntaxError BEFOREhelpercreation/host/source retainedDERIVED. NojobsONlogsselectedpublished/privatekeys+DBsHOST/no privatebytesfetched. ALL063000rootunit/PASS/package/operators/allolderhelpers consumedimmutable/no redispatchretryreplaycleanup.
NEXTreasonableinterval NEWuniqueREADONLYobserver SAMErootunitinvocation/latest2FULLhealthmemory originals/counts/status/actualsecondresultIFobserved; no newprodmemsampling/SQL/du/redispatch/sourceedit/stop/retry/cleanup/concurrentwriter. ActualCLOSED retainALLpublicraw/privatehashstatONLY/ALLhealthmemory/fulljournal+hookexit/59package/inputpreservation/accounting/independentOFF31API6probes11242+2NATURALsyncs strictpairingsecondidempotencerefusalsscienceEACH805600budgets/fullfirstsecondpreservation/reconstructedlabels. RequireBOTHownersstoppedAndRetained NOTVACUOUS/postStopErrorsEMPTY/controllerbeforeafterpoststopOOM0/samecgroup/journalExecStopPostexit0. RuntimeAWAITINGnotclosedPASS. ReviewALLjobsONrawlogs BEFOREpublicGit/privatekeys+DBsHOST. ONEeventualactualresult@claude162 bundles620818PASSACKONLYthere/no duplicates. Native04:50:39fallbackCANCELLED/answered/NEVERrepeat. FailurehonestNEWseparatelyauditedforwardfixONLY/no oldhelperreplay.
QualificationONLY/no kitgate deploy/MainMERGEHOLD/233000KEEPIT/R2COMPLETE/noprune/YY320GiBvisible/no growrestart/no103/noagentsnewchatworktreecheckout/humansheld. Futurekit174newEXPECTED22holds20existingZMB-LAB1/managerimpact/countsmaydiff+9to10minrestart/exact600failure. SAMEheartbeatACTIVE2min/restore10ONLYactualbeDEPLOYED+ClactualpostdeployPASS. PreserveALLolderhistoryverbatimbelow.

'''
save('checkpoint-prefix.txt',lead.encode())
readmes=[R/'WP/audit-release-eb6de2e8/README.md',R/'WP/runtime-recovery-kobo/README.md']
for path in readmes:path.write_bytes(lead.encode()+path.read_bytes())
paths=sorted(O.iterdir())+sorted(D.iterdir())+[R/'WP/backlog-resume-20261013/observe-controller-forward-step2-063000-fourth-readonly-once.py',pathlib.Path(__file__),*readmes]
require(all(path.is_file() for path in paths),'Regular owned publication files required')
save('publication-index.json',canonical({'baseAudit':BASE,'files':[{'path':path.relative_to(R).as_posix(),'length':len(path.read_bytes()),'sha256':sha(path.read_bytes()),'gitBlobOid':oid(path.read_bytes())} for path in paths]})+b'\n')
paths.append(D/'publication-index.json');names=[path.relative_to(R).as_posix() for path in paths];require(len(names)==len(set(names)),'Duplicate publication path')
for i in range(0,len(names),15):git('-c','core.autocrlf=false','add','-f','--',*names[i:i+15])
require(set(git('diff','--cached','--name-only').decode().splitlines())==set(names),'Staged ownership differs');tree=git('write-tree').decode().strip()
for path,name in zip(paths,names):require(git('show',tree+':'+name)==path.read_bytes() and git('rev-parse',tree+':'+name).decode().strip()==oid(path.read_bytes()),'Staged raw identity differs')
git('commit','-m','Retain controller proof OFF result and independent ON startup');head=git('rev-parse','HEAD').decode().strip()
for path,name in zip(paths,names):require(git('show',head+':'+name)==path.read_bytes(),'Committed raw identity differs')
git('push','origin','audit/release-eb6de2e8');require(git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head,'Published writer differs')
print(json.dumps({'audit':head,'rawOidShaVerifiedBlobs':len(paths),'observedUtc':obs['observedUtc'],'latestSampleNonReclaimableBytes':totals,'runtimeR4RequiredBytes':runtime['requiredBytes'],'runtimeFreeBytes':runtime['freeBytes'],'proofComplete':False,'newOperatorCalls':0}))
