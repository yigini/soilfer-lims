"""Publish the same consumed jobs proof's fifth read-only observation."""
import datetime,pathlib,subprocess,sys
R=pathlib.Path(__file__).resolve().parents[2];REL='WP/batch-proof-jobs-intake-be837974-20261016/';S=R/REL
D=S/'fifth-jobs003000-opening-publication-once';O=S/'fifth-jobs003000-readonly-observation-once'
BASE='e24ba82e9dedbc60862df280827bb21412e60a6f'
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
prior=exact_json((S/'fourth-jobs003000-opening-publication-once/later-opening-complete-record.json').read_bytes())
for label,descriptor in previous.items():
    held=[v for n,v in prior['latestMemorySamples'].items() if n.startswith(label+'-memory-')]
    if held:require(all({'identity':v['identity'],'cgroup':v['cgroup']}==descriptor for v in held),'Identity changed since fourth observation')
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
require(attempts['startup-2']['id']=='7028fd18bebf1527b68d896d2a0130806ab83fe39666d00b5d7b01860c1ebd30','Exact second owned ID required')
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
require(ready['healthPollCount']==len(ready['healthPollEvidence'])==obs['healthPollCounts']['startup-1']==419 and len(off['memory']['hostMemorySamples'])==obs['memorySampleCounts']['startup-1']==434,'Recorded first evidence counts differ')
require(len(samples)==4 and len(retained)==32,'Latest two samples and16 raws EACH startup required')
require(all(s['phase']=='health-poll' for n,s in samples.items() if n.startswith('startup-2-')),'Second current samples phase differs')
first_record={'status':'FIRST_JOBS_OFF_PRODUCER_RESULT_RECORDED_FIELDS_VALIDATED_NOT_FULL_RAW_CLOSURE_VALIDATION','originalBytes':len(first_result_raw),'originalSha256':sha(first_result_raw),'entryNoOpIntegerZeroCount':27,'exactReadyIntegerZeroCount':26,'httpProbes':ready['httpProbes'],'readinessElapsedSeconds':ready['readinessElapsedSeconds'],'dockerHealthySeconds':ready['timeToFirstHealthySeconds'],'healthPolls':419,'memorySamples':434,'broadPostflights':broad,'recordedFullInstalledStatePreserved':True,'recordedStoppedContainerRetained':True,'producerMemorySummary':{k:v for k,v in off['memory'].items() if k!='hostMemorySamples'},'allCommandRawAndFullStoppedStateIndependentClosureValidationStillRequired':True,'wholeProofComplete':False}
evidence=prep.current_evidence(review,index)
D.mkdir()
def save(n,raw):
    with (D/n).open('xb') as f:f.write(raw)
for n,raw in retained.items():save(n,raw)
for n,raw in obs['selectedOriginalUtf8'].items():save(n,raw.encode('utf-8'))
save('fresh-current-authority-evidence.json',canonical(evidence)+b'\n')
record={'status':'SAME_JOBS_PROOF_ACTIVE_AT_FIFTH_OBSERVATION_FIRST_OFF_RESULT_SECOND_ON_STARTUP_NO_TERMINAL_CLAIM','observedUtc':obs['observedUtc'],'root':str(ROOT),'unit':obs['unit'],'invocationId':props['InvocationID'],'actualUnitProperties':props,'sourceCommit':index['head'],'sourceReviewId':review['id'],'fileCount':len(obs['fileMetadata']),'runtimeR4Original':runtime,'runtimeR4IsRetainedOriginalNotNewMeasurement':True,'attempts':attempts,'healthPollCounts':obs['healthPollCounts'],'memorySampleCounts':obs['memorySampleCounts'],'latestHealthObservations':health,'latestMemorySamples':samples,'latestSampleIndependentNonReclaimableBytes':totals,'rawKernelReadsIndependentlyVerified':len(retained),'all54PackageHashesAnd26Plus1333SourcesVerified':True,'onlyLatestSamplesValidatedHere':True,'continuousPeakClaimed':False,'newLiveMemoryCounterReads':0,'newOperatorCalls':0,'noTerminalAtObservation':True,'proofComplete':False,'firstJobsOffRecordedResultValidation':first_record,'retryAllowed':False,'noJobsOnDockerLogsSelectedOrPublished':True,'allJobsOnRawLogsContentReviewStillRequiredBeforePublicPublication':True}
save('later-opening-complete-record.json',canonical(record)+b'\n')
save('first-jobs-off-recorded-result-derived.json',canonical(first_record)+b'\n')
save('second-local-publisher-derivation-count-refusal-derived.json',canonical({'classification':'LOCAL_WRONG_DERIVATION_FIELD_EXPECTATION','actualExitCode':1,'actualError':'RuntimeError: 27 exact recorded NO_OP0 required','failedHelper':'WP/backlog-resume-20261013/publish-jobs-intake003000-fifth-opening-complete-once.py','cause':'Application copy derivation enumerates32 static shell node call sites including4 non-verifier migrations and2 mutually-exclusive qc-run branches. Reviewed uploaded proof-input expectedEntrypointVerifiers is27. Successor binds exact uploaded spec SHA and validates all27 recorded NO_OP exactinteger0; no operator or source assertion changed.','failureBeforeOutputReadmesStageCommitOrHostOperation':True,'proofReplay':False})+b'\n')
save('first-local-publisher-checkout-byte-refusal-derived.json',canonical({'classification':'LOCAL_RAW_GIT_VERSUS_CHECKOUT_LINE_ENDING_AUTHORITY_MISMATCH','failedHelper':'WP/backlog-resume-20261013/publish-jobs-intake003000-fifth-opening-once.py','actualExitCode':1,'actualError':'RuntimeError: Application source changed shared/delimitedText.js','failedBeforePublicationDirectoryReadmesStagingCommitOrHostOperation':True,'frozen1333LocalFilesRemainUnchanged':True,'successorVerifiesAllRawGitAppPinsOIDLengthSHAThenSameDerivation':True,'reviewedSourceChanged':False,'proofReplayed':False})+b'\n')
save('local-console-oversized-read-derived.json',canonical({'classification':'TOOL_OUTPUT_TRANSCRIPTION','note':'Two local diagnostic reads printed oversized recorded checks/application pin line and console output was truncated. Full observer original bytes retained unchanged. Subsequent compact independent checks validate all claimed recorded fields. No remote replay, no missing evidence inferred.'})+b'\n')
second_health=health[sorted(n for n in health if n.startswith('startup-2-'))[-1]]
second_sample=samples[sorted(n for n in samples if n.startswith('startup-2-'))[-1]]
i=second_sample['identity'];cg=second_sample['cgroup']
lead=f'''LATEST ACTUAL FIFTH JOBS003000 READONLY OBSERVATION / FIRST OFF RESULT AND SECOND ON STARTUP - {obs['observedUtc']}.
SAME ONE003000/exact04c99271/PASS6205111918 invocation{props['InvocationID']} ACTIVE/running/MainPID{props['MainPID']}/MemoryMax805306368Swap0/Runtime90min/current{props['MemoryCurrent']}/controllerpeak{props['MemoryPeak']} OPEN observations ONLY. Controller peak1048576B aboveMax is separate from app peak/OOM/closed result; no cause or OOM inferred. {len(obs['fileMetadata'])}rootfiles/all54uploaded0400package hashes match. No second startup result/proof receipt/terminal refusal at observation; activeResultsuccess/ExecMainStatus0 NOT closedPASS. No jobsON natural intake completion claimed.
FIRST jobsOFF startup FULL original result ACTUALLY OBSERVED {len(first_result_raw)}B/SHA{sha(first_result_raw)}. Recorded27entrypointNO_OP EXACTinteger0+26EXACTcurrentREADY EXACTinteger0, HTTP200200401/readiness515.1492121369993s within600, broad31/31API0failed+all6exactreadonlyprobe sourceSHA/exit0. FullInstalledStatePreservedtrue/stoppedContainerRetainedtrue recorded. These result fields independently checked against current source inventory; ALL raw command logs/full112tables42receipts stopped-state equality/ALL434memory still require independent closure validation, NOT wholeproof PASS. Firsthealthy513.8320998189993s/419FULLhealthpolls/434memory/final434before-stop, producermaxsampled274084176/maxREADYrss178102272/evidence27242496 insideexisting4GiBlogs. FirstCID4b3dd8f0f8439d1fd8eb7ef0e7a5ef73dc5cb263d2dc539f52865a4abf29457e unchanged.
SECOND independent ordinary jobsON startup ACTUALLYATTEMPTED {i['id']}/PID{i['pid']}/StartedAt{i['startedAt']}/ownerexact003000root:startup-2/memory=memory+swap805306368. {obs['healthPollCounts']['startup-2']}FULL0400healthpolls/{obs['memorySampleCounts']['startup-2']}memory. Latest2 polls165+166 unhealthy200.49462730199957s/201.70332805899852s/FailingStreak6/FULL5-entry Health.Log EACH, WITHIN600 deadline; transientunhealthy allowed/no failure or PASS inferred. Secondresult/natural2syncs/provenance/refusals/wholeproof pending.
LATEST TWO memory samples EACH startup independently rederived from ALL32 original0400kernelreads/SHA+length+readbounds/stat/events/scalars/procmembership/mountinfo: {json.dumps(totals,sort_keys=True)}. Stable exactidentity within and between each label; FIRST unchanged versus fourth observation. SECONDcgroupdevice{cg['device']}inode{cg['inode']}/exactfullIDLEAF; membership within equal/OOMfalse/restarts0/oom=oom_kill0/sevenfield samplednonreclaimable <=603979776B. Apppeak805306368/maxhigh observationsONLY/no continuouspeak/no all600samples or wholeproof claim. First433running-command434FINALbefore-stop; second165166health-poll.
SAME ACTUAL ORIGINAL runtime R4 BEFORE COPIES {runtime['observedUtc']}: required{runtime['requiredBytes']}/free{min(runtime['freeBytes'].values())} EACH3/canonical4096/device64769/SAMEFSnotadditive/ADDITIONAL10GB/packagefuture0 alreadyoccupied/db563326976/assets5787648. Retained ORIGINAL card NOT freshmeasurement. BeforeROOT required60932393070/free95826145280/exactfuturepackage10412032 and beforeUNIT required60921981038/free95817760768 remain bound. N25/MIN64/25percent/3assets/schema+markers/allstagecaps/floor+4GiBlogs+10GB unchanged. All26source+1333frozenapp reverified unchanged/freshauthority mainbe837974/mainCI38772398721attempt1pushCLOSEDSUCCESS/4appaudits6rules2postreboot memorydirection/jobsScope/R2accepted/nolaterfailure/#191CLOSED.
Full readonly originals/FULLfirstresult/latest2FULLhealth+memory EACH+32kernelraws/runtimeR4/independentrecord at {REL}fifth-jobs003000-opening-publication-once/publication-index.json/later-opening-complete-record.json. No rawjobsON dockerlogs selected/published; ALLrawjobsON logs contentreview still mandatory beforepublicpublication. NewCONSUMED NEVERreplay observe-jobs-intake003000-fifth-readonly-once.py and publish-jobs-intake003000-fifth-opening-once.py(LOCALrawGit-vs-checkoutCRLFrefusal BEFOREoutputstagecommithost) plus publish-jobs-intake003000-fifth-opening-complete-once.py(LOCALcopyderivation32sites-vs27verifiersrefusal BEFOREoutputstagecommithost) and publish-jobs-intake003000-fifth-opening-bound-spec-once.py. Successor binds exactuploadedproofinput27verifiercount and independently verifies ALL458 rawGit APPpins/OID+SHA+length;1333localfrozenhashes unchanged/unrelateddirt preserved. ALLolderhelpers/operators/root/unit remain consumed. No activeLOCALrunner/retainer afterpublication; ONEremoteproof ACTIVE AT OBSERVATION/no laterstateclaimed.
NEXT reasonableinterval NEWunique READONLYobserver SAMErootunitinvocation/latest2FULLhealth+memory ORIGINALS/status only; no redispatch/freshprod memorysampling/sourceedit/stop/retry/cleanup/concurrentwriter. On actualCLOSED retainALLoriginals/fulljournal/systemctl54package/EVERYhealth+ALLmemoryraws/fullstoppedstates/inputhashstat/accounting, independentlyvalidate fullOFF+broad31API6probes+2NATURALsync/provenance/science/refusal/full11242rowsreceipts/assets/memory/budgets; inspectALLrawjobsONlogs for Kobo submission content BEFOREpublicpublication(hashesacceptable/preserveoriginals), thenONE@claude162actualresult bundling620511PASSACK ONLYthere. Backup180s/escalation-row refusal=>separatelyauditedNEWforwardfixONLY/norerun. UnknowninspectSAMEconsumedrootunit. Futurekit/gate MUSTdisclose severalminute restartwindow(first514s/prior333392s). MainMERGEHOLD untilactualbeDEPLOYED+ClactualpostdeployPASS; SAMEheartbeatACTIVE2min/restore10ONLYthen. Qualificationonly/no kitgate deployapproval.233000latestpassingKEEPIT/R2COMPLETE/no moreprune/YY320GiBalreadyvisible/nohostgrowrestart/no103/noagentsnewchatworktreecheckout/humanfilesdraftcards preserved. Native0018followupanswered/NEVERduplicate nativeACKGHrequest. PreserveALLolderhistoryverbatimbelow.

'''
save('checkpoint-prefix.txt',lead.encode())
readmes=[R/'WP/audit-release-eb6de2e8/README.md',R/'WP/runtime-recovery-kobo/README.md']
for path in readmes:path.write_bytes(lead.encode()+path.read_bytes())
paths=sorted(O.iterdir())+sorted(D.iterdir())+[R/'WP/backlog-resume-20261013/observe-jobs-intake003000-fifth-readonly-once.py',pathlib.Path(__file__),R/'WP/backlog-resume-20261013/publish-jobs-intake003000-fifth-opening-once.py',R/'WP/backlog-resume-20261013/publish-jobs-intake003000-fifth-opening-complete-once.py',*readmes]
require(all(path.is_file() for path in paths),'Regular owned publication files required')
save('publication-index.json',canonical({'baseAudit':BASE,'files':[{'path':path.relative_to(R).as_posix(),'length':len(path.read_bytes()),'sha256':sha(path.read_bytes()),'gitBlobOid':oid(path.read_bytes())} for path in paths]})+b'\n')
paths.append(D/'publication-index.json');names=[path.relative_to(R).as_posix() for path in paths];require(len(names)==len(set(names)),'Duplicate publication path')
for i in range(0,len(names),15):git('-c','core.autocrlf=false','add','-f','--',*names[i:i+15])
require(set(git('diff','--cached','--name-only').decode().splitlines())==set(names),'Staged ownership differs');tree=git('write-tree').decode().strip()
for path,name in zip(paths,names):require(git('show',tree+':'+name)==path.read_bytes() and git('rev-parse',tree+':'+name).decode().strip()==oid(path.read_bytes()),'Staged raw identity differs')
git('commit','-m','Retain jobs OFF recorded postflights and independent jobs ON startup originals');head=git('rev-parse','HEAD').decode().strip()
for path,name in zip(paths,names):require(git('show',head+':'+name)==path.read_bytes(),'Committed raw identity differs')
git('push','origin','audit/release-eb6de2e8');require(git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head,'Published writer differs')
print(json.dumps({'audit':head,'rawOidShaVerifiedBlobs':len(paths),'observedUtc':obs['observedUtc'],'latestSampleNonReclaimableBytes':totals,'runtimeR4RequiredBytes':runtime['requiredBytes'],'runtimeFreeBytes':runtime['freeBytes'],'proofComplete':False,'newOperatorCalls':0}))
