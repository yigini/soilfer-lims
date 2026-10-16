"""Publish original launch/opening evidence and independently validate its eight reads."""
import pathlib,re,sys
sys.dont_write_bytecode=True
W=pathlib.Path(__file__).resolve().parents[2];H=W/'WP/backlog-resume-20261013';sys.path.insert(0,str(H))
from prechecks6210209468_evidence import git,sha,oid,canonical,utc,save
from prechecks6210209468_boundary_publication import boundary_publish
REL='WP/batch-proof-mount-order-forward-be837974-20261016/';B=W/REL;D=B/'first-mount-order-100000-opening-publication-once'
BASE='e131ec4e4dc883ba4563bc60c0fbfc679d2d932c'
sys.path.insert(0,str(B))
from proof_contract import *
from proof_budget import capacity_gate
from controller_guard import parse_events,UNIT as CGUNIT
import prepare_proof as prep
L=B/('proof-launch-'+ROOT_NAME);E=B/'execute-reviewed-launch6211327371-once';O=B/'first-mount-order-100000-readonly-observation-once'
require(git('rev-parse','HEAD').decode().strip()==BASE and git('branch','--show-current').decode().strip()=='audit/release-eb6de2e8' and not git('diff','--cached','--name-only').strip() and not D.exists(),'Same writer/new publication required')
closed=exact_json((E/'exit-original.json').read_bytes());require(closed['status']=='REVIEWED_JOBS_LAUNCHER_CLOSED_INSPECT_SAME_UNIT' and closed['exitCode']==0,'Actual launcher closure required')
package=exact_json((B/'reviewed-package6211327371-publication-once/package-publication-validation.json').read_bytes());allowance=package['futurePackageAllocationBytes'];require(allowance==11296768 and package['packageFileCount']==65,'Exact prepared package required')
before=exact_json((L/'metadata-capacity-before-root-stdout.log').read_bytes());immediate=exact_json((L/'metadata-capacity-immediately-before-unit-stdout.log').read_bytes());capacity_gate(before,'BEFORE_ROOT',allowance);capacity_gate(immediate,'BEFORE_UNIT',0)
require({p:r['device'] for p,r in before['hardware'].items()}=={p:r['device'] for p,r in immediate['hardware'].items()},'Capacity topology changed')
launch=exact_json((L/'launch-record.json').read_bytes());require(launch['launchExitCode']==0 and launch['root']==str(ROOT) and launch['unit']=='lims-'+ROOT_NAME.lower(),'Actual exact launch differs')
obs=exact_json((O/'stdout-original.json').read_bytes());require(exact_json((O/'exit-original.json').read_bytes())['exitCode']==0 and obs['root']==str(ROOT) and obs['unit']==launch['unit'],'Same observed unit/root required')
props=dict(line.split('=',1) for line in obs['systemctl']['stdout'].splitlines() if '=' in line)
require(obs['systemctl']['exitCode']==0 and not obs['systemctl']['stderr'] and props['ActiveState']=='active' and props['SubState']=='running' and re.fullmatch('[a-f0-9]{32}',props['InvocationID']) and re.fullmatch('[1-9][0-9]*',props['MainPID']),'Actual active opening required; closed result needs a distinct honest retainer')
require(props['MemoryMax']=='805306368' and props['MemorySwapMax']=='0' and props['RuntimeMaxUSec']=='1h 30min' and props['TimeoutStopUSec']=='5min' and str(ROOT/'stop_owned.py') in props['ExecStopPost'],'Exact active limits/hook required')
require(len(obs['packageHashes'])==65 and {n:r['sha256'] for n,r in obs['packageHashes'].items()}==package['packageFileHashes'] and all(r['mode']=='0o400' for r in obs['packageHashes'].values()),'All uploaded65 hashes/modes required')
selected=obs['selectedOriginalUtf8'];require(not any(n in selected for n in ['proof-receipt.json','proof-terminal-refusal.json','stop-post-result.json']),'Opening already has terminal/hook result; report in distinct successor')
mem=exact_json(selected['controller-memory-before.json']);raws=[exact_json(selected['controller-memory-before-raw-'+str(i).zfill(2)+'.json']) for i in range(1,9)]
expected=['/proc/'+props['MainPID']+'/cgroup']+['/sys/fs/cgroup/system.slice/'+CGUNIT+'/'+n for n in ['memory.events','memory.current','memory.peak','memory.max','memory.swap.max','memory.stat']]+['/proc/'+props['MainPID']+'/cgroup']
require([r['path'] for r in raws]==expected and raws[0]==raws[-1],'Exact numeric controller paths/order/membership required')
for r in raws:
 data=r['rawAscii'].encode('ascii');require(len(data)==r['bytes'] and sha(data)==r['sha256'] and len(data)<=16384,'Controller raw identity/bound differs')
require(mem['unit']==CGUNIT and mem['membershipRaw']==raws[0]['rawAscii']=='0::/system.slice/'+CGUNIT+'\n','Exact controller membership differs')
require(type(mem['cgroupDevice']) is int and type(mem['cgroupInode']) is int and mem['cgroupDevice']>0 and mem['cgroupInode']>0,'Original cgroup identity missing')
for r,n in zip(raws[1:7],['memory.events','memory.current','memory.peak','memory.max','memory.swap.max','memory.stat']):require(mem['raw'][n]==r['rawAscii'] and mem['sha256'][n]==r['sha256'],'Snapshot/raw mismatch '+n)
require(parse_events(raws[1]['rawAscii'].encode())==mem['events'] and mem['events']['oom']==mem['events']['oom_kill']==0,'Controller OOM guard differs')
for n,v in mem['scalars'].items():require(re.fullmatch('[0-9]+',mem['raw'][n].strip()) and int(mem['raw'][n].strip())==v,'Controller scalar differs')
require(mem['scalars']['memory.max']==805306368 and mem['scalars']['memory.swap.max']==0 and mem['peakMaxHighObservationOnly'] is True,'Controller scalar limits differ')
memory_stat={}
for line in raws[6]['rawAscii'].splitlines():
 bits=line.split();require(len(bits)==2 and bits[0] not in memory_stat and re.fullmatch('0|[1-9][0-9]*',bits[1]),'Raw memory.stat malformed');memory_stat[bits[0]]=int(bits[1]);require(memory_stat[bits[0]]<2**64,'Raw memory.stat overflow')
require({'anon','file'}<=set(memory_stat) and memory_stat==mem['memoryStat'],'Actual HOST memory.stat anon/file differs')
metadata={r['path']:r for r in obs['fileMetadata']}
for n in ['controller-memory-before.json']+['controller-memory-before-raw-'+str(i).zfill(2)+'.json' for i in range(1,9)]:require(metadata[n]['mode']=='0o400' and metadata[n]['bytes']==len(selected[n].encode()),'Raw controller file metadata differs')
journal=[exact_json(line.encode()) for line in obs['journal']['stdout'].splitlines() if line]
require(obs['journal']['exitCode']==0 and not obs['journal']['stderr'] and len(journal)==2 and all(r['_PID']=='1' and r['INVOCATION_ID']==props['InvocationID'] and r['MESSAGE'].startswith(('Starting /usr/bin/python3 -B ','Started /usr/bin/python3 -B ')) for r in journal),'Journal needs content review before publication')
index=exact_json((B/'actual-source-pass6211327371-once/tooling-source-index.json').read_bytes());review=exact_json((B/'actual-source-pass6211327371-once/actual-source-pass-original.json').read_bytes());approval(review,index)
for n,h in graph(index).items():require(sha((B/n).read_bytes())==h,'Reviewed source changed '+n)
frozen=exact_json((W/'WP/startup-order-readiness-20261015/full-pinned-copy-retention-bound-ordinary-once/source-before.json').read_bytes());require(len(frozen)==1333,'Application inventory differs')
for n,h in frozen.items():require(sha((W/n).read_bytes())==h,'Application input changed '+n)
evidence=prep.current_evidence(review,index);D.mkdir();save(D,'fresh-current-authority-evidence.json',canonical(evidence)+b'\n')
record={'status':'ONE_REVIEWED_MOUNT_ORDER_PROOF_ACTIVE_AT_FIRST_OBSERVATION_NO_TERMINAL_CLAIM','observedUtc':obs['observedUtc'],'sourceHead':index['head'],'sourceReviewId':review['id'],'sourcePassPublication':'96fe4cd136654aff042bdb720330badcefbe729f','packagePublication':BASE,'launcherClosedUtc':closed['closedUtc'],'root':str(ROOT),'unit':launch['unit'],'invocationId':props['InvocationID'],'actualUnitProperties':props,'beforeRootR4':before,'immediatelyBeforeUnitR4':immediate,'packageFilesVerified':65,'fileCountAtObservation':len(obs['fileMetadata']),'all37And1333HashesUnchanged':True,'controllerEightRawReadsIndependentlyVerified':True,'controllerBeforeSnapshot':mem,'actualHostMemoryStatAnonFileThroughUnpatchedOwnSnapshot':True,'journalContentReviewed':'Two PID1 lifecycle start records only','rootUnitPackagePassAndLauncherConsumedNeverReplay':True,'proofComplete':False,'scope':SCOPE,'retryAllowed':False}
save(D,'opening-record.json',canonical(record)+b'\n')
lead=f'''LATEST ACTUAL ONE MOUNT-ORDER100000 LAUNCH + ACTIVE OPENING - {obs['observedUtc']}.
Exact source187636984895aec44044635fb63498b0fcb3102e/PASS6211327371/37SHA193tokens; approval96fe4cd1/48raw; ONE65-file packagee131ec4e/78raw/future11296768. ONE unchanged reviewedlauncher CLOSED{closed['closedUtc']}/exit0; root{ROOT}/unit{launch['unit']} NOWCONSUMED NEVERredispatchretryreplaycleanup. Actualstart{props['ExecMainStartTimestamp']}/invocation{props['InvocationID']}/MainPID{props['MainPID']} ACTIVE/running/805306368Swap0/90min/TimeoutStop300/exactrootExecStopPost. OpeningCurrent{props['MemoryCurrent']}/Peak{props['MemoryPeak']} CONTROLLER observationsONLY/notapppeak/closedresult. ALL65uploaded0400packageSHAverified/{len(obs['fileMetadata'])}rootfiles/no terminalresult; activeResultsuccess/ExecMainStatus0 NOTclosedPASS.
Actualnumericcontrollerbeforeguard PASSED exactunit/dev{mem['cgroupDevice']}inode{mem['cgroupInode']}/ALL8raws SHA-length-path-order-membership/events/scalars/memory.stat independently rederived/0400/OOM0. ACTUALHOSTunpatchedown_snapshot memory.stat anon{memory_stat['anon']}/file{memory_stat['file']} read through THIScontroller; beforeONLY/no afterstop-postPASS. Values/peakmaxhighOBSERVATIONSONLY. Journal fullyreviewed twoPID1startrecordsONLY.
FreshR4BEFORE_ROOT {before['observedUtc']} req{before['requiredBytes']}/free{min(before['freeBytes'].values())};immediatelyBEFORE_UNIT {immediate['observedUtc']} req{immediate['requiredBytes']}/free{min(immediate['freeBytes'].values())} EACH3sameFS/nonadditive4096/10GB/exactfuturepackageROOTONLY. ALL4actualremoteprogramscompiledBEFOREfirstSSH/currentauthorityfresh/all37+1333unchanged. RuntimeR4beforecopies notyetobserved. Full evidence at {REL}first-mount-order-100000-opening-publication-once/publication-index.json.
NEXTreasonableinterval NEWuniqueREADONLYobserver SAMErootunitinvocation/latest2FULLhealthmemory originals/counts/runtimeR4/status; no freshproductionmemorysampling/SQL/du/redispatch/sourceedit/stop/retry/cleanup/concurrentwriter. OnactualCLOSED retainALLpublicraw/privatehashstatONLY/ALLhealthmemory/fullsameinvjournal+hookexit/65package/inputpreservation/accounting; independentlyvalidateOFF31API6probes11242+2NATURALsync strictpairingsecondidempotencerefusalsscience/EVERY805600/budgets/fullfirstsecondpreservation/reconstructedlabels. BOTHexactownersstoppedAndRetained NONVACUOUS/postStopErrorsEMPTY/controllerbeforeafterpoststop rawsamecgroupOOM0/journalhookexit0 mandatory; runtimeAWAITINGnotclosedPASS. ALLjobsONlogs contentreviewBEFOREpublicGit/DBsBOTHprivatekeysHOST0400/no privatebytesfetched. First-sync retriable stallcursor refusal reporthonestly/oneattempt no rerun. ONEeventualactualresult@claude162 bundles621132PASSACKONLYthere/no duplicates. Source621098ANSWERED/08:24:55nativefallbackCANCELLEDNEVERrepeat. Old063000080000operatorsCONSUMEDimmutable. QualificationONLY/no kitgatedeploy/MainMERGEHOLD/233000KEEPIT/R2COMPLETE/noprune/nohostgrowrestart/no103/noagentsnewchatworktreecheckoutconcurrentwriter/humansheld/sevenstatusalreadyanswered. Futurekit186new22holdsC1validated/countsmaydiff+stopgraceactualexitincluded9to10minrestart/exact600failure. SAMEheartbeatACTIVE2min restore10ONLYactualbeDEPLOYED+ClactualpostdeployPASS. Preserve ALL older history verbatim below.

'''
extras=[*L.iterdir(),*E.iterdir(),*O.iterdir(),H/'execute-mount-order-reviewed-launch6211327371-once.py',H/'observe-mount-order-100000-first-readonly-once.py',pathlib.Path(__file__)]
result=boundary_publish(D,extras,'Retain single mount-order qualification launch and initial controller guard',lead)
print(json.dumps({**result,'invocationId':props['InvocationID'],'observedUtc':obs['observedUtc'],'controllerMemoryStatActualHostVerified':True,'proofComplete':False,'newOperatorCalls':0}))
