"""Retain the same proof's later active observation and runtime R4, no operator."""
import datetime,pathlib,subprocess,sys
R=pathlib.Path(__file__).resolve().parents[2];REL='WP/batch-proof-memory-events-be837974-20261015/';S=R/REL;D=S/'seventh-proof233000-opening-publication-once';O=S/'seventh-proof233000-readonly-observation-once'
BASE='f76dccca5269321fdd0dd42b3d6157b8bcb34c91'
sys.path.insert(0,str(S))
from proof_contract import *
from proof_budget import capacity_gate
import proof_memory as mem
def git(*a):return subprocess.check_output(['git','-c','core.longpaths=true',*a],cwd=R)
def oid(raw):return hashlib.sha1(('blob '+str(len(raw))+'\0').encode()+raw).hexdigest()
require(git('rev-parse','HEAD').decode().strip()==BASE and git('branch','--show-current').decode().strip()=='audit/release-eb6de2e8' and not git('diff','--cached','--name-only').strip() and not D.exists(),'Same writer/base/one publication required')
obs=exact_json((O/'stdout-original.json').read_bytes());props=dict(line.split('=',1) for line in obs['systemctl']['stdout'].splitlines() if '=' in line)
require(obs['systemctl']['exitCode']==0 and props['ActiveState']=='active' and props['SubState']=='running' and props['InvocationID']=='3eb684645431481ea98912210f972d99' and props['MemoryMax']=='805306368' and props['MemorySwapMax']=='0','Same active invocation required')
require(not any(n in obs['selectedOriginalUtf8'] for n in ['proof-receipt.json','proof-terminal-refusal.json']),'Terminal at this observation; retain in honest successor')
runtime=exact_json(obs['selectedOriginalUtf8']['fresh-r4-before-proof-copies.json']);capacity_gate(runtime,'RUNTIME_BIND',0)
initial=exact_json((S/'first-proof233000-opening-publication-once/opening-record.json').read_bytes())
require({p:v['device'] for p,v in runtime['hardware'].items()}=={p:v['device'] for p,v in initial['beforeRootR4']['hardware'].items()},'Runtime hardware changed')
package=exact_json((S/'reviewed-package6203833517-publication-once/package-publication-validation.json').read_bytes());require({n:r['sha256'] for n,r in obs['packageHashes'].items()}==package['packageFileHashes'],'43 package hashes differ')
index=exact_json((S/'actual-source-pass6203833517-once/tooling-source-index.json').read_bytes())
for n,d in graph(index).items():require(sha((S/n).read_bytes())==d,'Reviewed source changed '+n)
frozen=exact_json((R/'WP/startup-order-readiness-20261015/full-pinned-copy-retention-bound-ordinary-once/source-before.json').read_bytes());require(len(frozen)==1333,'Frozen inventory differs')
for p,d in frozen.items():require(sha((R/p).read_bytes())==d,'Application input changed '+p)
D.mkdir()
def save(n,raw):
    with (D/n).open('xb') as f:f.write(raw)
record={'status':'SAME_STARTUP_PROOF_ACTIVE_AT_SEVENTH_OBSERVATION_BOTH_STARTUP_RESULTS_RECORDED_NO_WHOLE_PROOF_CLAIM','observedUtc':obs['observedUtc'],'invocationId':props['InvocationID'],'root':str(ROOT),'unit':obs['unit'],'actualUnitProperties':props,'runtimeR4':runtime,'fileCount':len(obs['fileMetadata']),'selectedOriginalNames':sorted(obs['selectedOriginalUtf8']),'startup1Attempt':exact_json(obs['selectedOriginalUtf8']['startup-1-default-entrypoint-attempt.json']),'all43PackageHashesAnd15Plus1333SourcesVerified':True,'newOperatorCalls':0,'proofComplete':False,'retryAllowed':False}
record['healthPollCounts']=obs['healthPollCounts']
record['startup2Attempt']=exact_json(obs['selectedOriginalUtf8']['startup-2-default-entrypoint-attempt.json'])
expected_events=re.findall(r"event\s*:\s*'([^']+_STARTUP_READY)'",(R/'server/index.js').read_text(encoding='utf-8'))
for number in [1,2]:
    label='startup-'+str(number);first=exact_json(obs['selectedOriginalUtf8'][label+'-result.json']);checks=first['checks']
    require(first['id']==record['startup'+str(number)+'Attempt']['id'] and first['readinessDeadlineSeconds']==600 and first['timeToFirstHealthySeconds']<600,'Recorded startup result identity/deadline differs')
    require(len(checks['entrypointVerifiers'])==27 and all(v['mode']=='NO_OP' and type(v['totalChanges']) is int and v['totalChanges']==0 for v in checks['entrypointVerifiers']),'Recorded startup27 exactinteger NO_OP0 required')
    require(len(expected_events)==len(set(expected_events))==len(checks['readyEvents'])==26 and {v['event'] for v in checks['readyEvents']}==set(expected_events) and all(type(v['totalChanges']) is int and v['totalChanges']==0 for v in checks['readyEvents']),'Recorded startup26 exactinteger READY0 required')
    require(first['httpProbes']==[{'method':'GET','path':'/api/health','status':200},{'method':'GET','path':'/login','status':200},{'method':'POST','path':'/api/v2/sis/receipts','status':401}] and checks['jobsEnabled'] is False and first['health']['status']=='ok','Recorded startup HTTP/jobs differ')
    require(first['fullInstalledStatePreserved'] is True and first['stoppedContainerRetained'] is True and first['jobsOnQualificationStillRequired'] is True,'Recorded stopped-state result differs')
    require(first['healthPollCount']==len(first['healthPollEvidence'])==obs['healthPollCounts'][label] and len(first['memory']['hostMemorySamples'])==first['healthPollCount']+1==obs['memorySampleCounts'][label],'Recorded health/memory evidence counts differ')
    record['startup'+str(number)+'ResultSummary']={k:first[k] for k in ['id','elapsedSeconds','timeToFirstHealthySeconds','totalUnhealthySeconds','unhealthyTimeMeasurement','healthPollCount','httpProbes','fullInstalledStatePreserved','stoppedContainerRetained','jobsOnQualificationStillRequired']}
    record['startup'+str(number)+'ResultSummary'].update({'entrypointNoopIntegerZeroCount':27,'readyIntegerZeroCount':26,'producerReportedMemorySummary':{k:v for k,v in first['memory'].items() if k!='hostMemorySamples'},'producerReportedMemorySamples':len(first['memory']['hostMemorySamples']),'allOriginalLogsSamplesAndFullStoppedStateIndependentClosureValidationStillRequired':True})
record['latestHealthObservations']={n:exact_json(raw) for n,raw in obs['selectedOriginalUtf8'].items() if '-health-poll-' in n}
save('later-opening-record.json',canonical(record)+b'\n')
record['memorySampleCounts']=obs['memorySampleCounts']
record['latestMemorySamples']={n:exact_json(raw) for n,raw in obs['selectedOriginalUtf8'].items() if re.fullmatch('startup-[12]-memory-[0-9]{6}[.]json',n)}
record['latestSampleIndependentNonReclaimableBytes']={}
previous={}
for name,sample in record['latestMemorySamples'].items():
    total=mem.gate(sample);label=name.split('-memory-')[0];identity=sample['identity'];descriptor={'identity':identity,'cgroup':sample['cgroup']}
    require(identity['id']==record['startup1Attempt' if label=='startup-1' else 'startup2Attempt']['id'],'Exact owned startup identity differs')
    require(identity['owner']==str(ROOT)+':'+label and identity['oomKilled'] is False and identity['restarts']==0 and identity['memory']==identity['memoryAndSwap']==MEMORY,'Owned fixed limits differ')
    require(label not in previous or previous[label]==descriptor,'Latest retained sample identity changed');previous[label]=descriptor
    rawrows=sample['originalKernelReads'];require(len(rawrows)==8,'All8originalkernelreads required')
    rawvalues=[]
    for row in rawrows:
        held=obs['retainedMemoryOriginals'][row['path']];raw=held['originalRetainedUtf8'].encode('ascii')
        require(len(raw)==row['bytes']==held['bytes'] and sha(raw)==row['sha256']==held['sha256'] and row['kernelPath']==held['kernelPath'] and held['mode']=='0o400','Retained kernel raw identity differs')
        save(row['path'],raw);rawvalues.append(raw)
    require(rawvalues[0]==rawvalues[7] and mem.cgroup_path(identity['id'],rawvalues[0],rawvalues[1]).as_posix()==sample['cgroup']['path'],'Retained exact cgroup membership changed')
    require(mem.pairs(rawvalues[2],mem.STAT_REQUIRED)==sample['memoryStat'] and mem.pairs(rawvalues[3],mem.EVENT_REQUIRED)==sample['memoryEvents'],'Retained stat/events differ')
    require(mem.scalar(rawvalues[4])==sample['memoryPeakBytesObservation'] and mem.scalar(rawvalues[5])==MEMORY and mem.scalar(rawvalues[6])==0,'Retained scalars differ')
    record['latestSampleIndependentNonReclaimableBytes'][name]=total
for name,raw in obs['selectedOriginalUtf8'].items():
    if name in ['fresh-r4-before-proof-copies.json','startup-1-result.json','startup-2-result.json','startup-2-default-entrypoint-attempt.json'] or '-health-poll-' in name or name in record['latestMemorySamples']:save(name,raw.encode('utf-8'))
record['latestTwoSamplesEachStartupOnlyNotContinuousOrWholeProofClaim']=True
save('latest-memory-independent-derived.json',canonical({'sampleCountsAtObservation':obs['memorySampleCounts'],'latestRetainedNonReclaimableBytes':record['latestSampleIndependentNonReclaimableBytes'],'limitBytes':mem.NON_RECLAIMABLE_MAX,'onlyLatestRetainedSamplesValidatedHere':True,'allRawReadsVerified':True,'newLiveCounterReads':0})+b'\n')
# The initial derived opening record is retained; the complete successor record includes memory validation.
save('later-opening-complete-record.json',canonical(record)+b'\n')
latest_health={label:next((value for name,value in sorted(record['latestHealthObservations'].items(),reverse=True) if name.startswith(label+'-health-poll-')),None) for label in ['startup-1','startup-2']}
latest_memory={name:{'nonReclaimableBytes':record['latestSampleIndependentNonReclaimableBytes'][name],'memoryPeakBytesObservation':value['memoryPeakBytesObservation'],'memoryEvents':value['memoryEvents']} for name,value in record['latestMemorySamples'].items()}
for number in [1,2]:save('startup-'+str(number)+'-recorded-result-derived.json',canonical(record['startup'+str(number)+'ResultSummary'])+b'\n')
lead=f'''LATEST ACTUAL SEVENTH MEMORY PROOF OBSERVATION - {obs['observedUtc']}. SAME233000/exactdd14/PASS6203833517 invocation{props['InvocationID']} ACTIVE/running/MainPID{props['MainPID']}/MemoryMax805306368Swap0/90min/current{props['MemoryCurrent']}peak{props['MemoryPeak']} OPENONLY/{len(obs['fileMetadata'])}files. BOTHstartup-results recorded: first {canonical(record['startup1ResultSummary']).decode()}; second {canonical(record['startup2ResultSummary']).decode()}. Each27NOOPinteger0+26exactREADYinteger0/HTTP200200401/jobsOFF/fullInstalledStatePreservedtrue/stoppedContainerRetainedtrue. Resultelapsed includesstoppedseal/notHTTPdowntime. Firsthealthy332.77019714499966s/secondhealthy392.4748328019996s WITHIN600; no wholeproofreceipt/refusal atobservation. Countshealth287+338/memory288+339. Latestmemorysamples {canonical(latest_memory).decode()}; full32originalkernelraws0400/SHA+len/stat/events/scalars/exactmembershipleaf/identitystable independentlyverified; latestTWOEACHONLY/notall627/notcontinuouspeak/wholeproofclaim. Apppeak/eventsmaxhigh/controllerpeakOBSERVATIONSONLY/separate/noOOMdiagnosis. RuntimeR4 ORIGINAL{runtime['observedUtc']}required{runtime['requiredBytes']}free{min(runtime['freeBytes'].values())}/10GBincluded/packagealreadyoccupied/3SAMEFS64769notadditive; notfreshmeasurement. All43packagehashes/15source/1333appunchanged. Full57plusnewsecond-resultderived rawGitOID/SHA/lenpublication at {REL}seventh-proof233000-opening-publication-once/publication-index.json/later-opening-complete-record.json. ALLoriginals/stopped11242state/memorysummaries/fullaccounting stillneedindependentclosurevalidation. OnACTUALCLOSED NEWstatusawarereadonlyretainer/noSQL/DBfetch/newdu/replay; publishONE@claude162actualresult/PASS6203833517ACKONLYthere. Neverredispatch/stop/retry/sourcechange/cleanup/concurrentwriter. JobsOFFONLY/notreleasequalified/jobsONkitgatedeploylater/mainmergeHOLD/heartbeat2min/sciencehistoryR1-R5/humansheld.

'''
readmes=[R/'WP/audit-release-eb6de2e8/README.md',R/'WP/runtime-recovery-kobo/README.md']
for p in readmes:p.write_bytes(lead.encode()+p.read_bytes())
paths=sorted(O.iterdir())+sorted(D.iterdir())+[R/'WP/backlog-resume-20261013/observe-startup-memory-proof233000-seventh-readonly-once.py',pathlib.Path(__file__),*readmes]
save('publication-index.json',canonical({'baseAudit':BASE,'files':[{'path':p.relative_to(R).as_posix(),'length':len(p.read_bytes()),'sha256':sha(p.read_bytes()),'gitBlobOid':oid(p.read_bytes())} for p in paths]})+b'\n');paths.append(D/'publication-index.json');names=[p.relative_to(R).as_posix() for p in paths]
for i in range(0,len(names),15):git('-c','core.autocrlf=false','add','-f','--',*names[i:i+15])
require(set(git('diff','--cached','--name-only').decode().splitlines())==set(names),'Staged ownership differs');tree=git('write-tree').decode().strip()
for p,n in zip(paths,names):require(git('show',tree+':'+n)==p.read_bytes() and git('rev-parse',tree+':'+n).decode().strip()==oid(p.read_bytes()),'Staged raw identity differs')
git('commit','-m','Retain both startup results at seventh active proof observation');head=git('rev-parse','HEAD').decode().strip()
for p,n in zip(paths,names):require(git('show',head+':'+n)==p.read_bytes(),'Committed raw identity differs')
git('push','origin','audit/release-eb6de2e8');require(git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head,'Published writer differs')
print(json.dumps({'audit':head,'rawOidShaVerifiedBlobs':len(paths),'observedUtc':obs['observedUtc'],'runtimeR4RequiredBytes':runtime['requiredBytes'],'runtimeFreeBytes':runtime['freeBytes'],'latestSampleNonReclaimableBytes':record['latestSampleIndependentNonReclaimableBytes'],'proofComplete':False}))


