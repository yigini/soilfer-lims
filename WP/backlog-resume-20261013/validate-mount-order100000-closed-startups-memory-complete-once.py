"""Validate all captured closed mount-order100000 startup/memory originals, without host, SQLite or proof calls."""
import collections,datetime,hashlib,json,math,pathlib,re,subprocess,sys
R=pathlib.Path(__file__).resolve().parents[2];S=R/'WP/batch-proof-mount-order-forward-be837974-20261016';D=S/'mount-order100000-closed-originals-once';O=D/'remote-originals'
sys.path.insert(0,str(S))
from proof_contract import *
from proof_budget import capacity_gate,Budget,TABLE,copy_site_guard,EXPECTED_SITES,package_allowance
from proof_disk import growth,ALLOCATION,BOUND
from proof_docker import mount_objects
from proof_health import load_health,assert_healthcheck
from proof_inputs import prior_records,validate_records
from proof_app_sources import APP_PINS,validate_sources
from proof_startup import startup_log
from proof_jobs import PROBES,probe_results
from runtime_proof_policies import completed_syncs,scheduler_refusals,TARGET_CONFIG
import proof_memory as mem

def j(p):return json.loads(pathlib.Path(p).read_bytes())
def git(*a,payload=None):return subprocess.check_output(['git','-c','core.longpaths=true',*a],cwd=R,input=payload)
def oid(b):return hashlib.sha1(('blob '+str(len(b))+'\0').encode()+b).hexdigest()
def rounded(n):return ((n+4095)//4096)*4096
def exit_ok(label):
 v=j(O/(label+'-exit.json'));assert type(v['exitCode']) is int and v['exitCode']==0 and v['error'] is None,label

r=j(D/'closed-retention-record.json');rows={x['path']:x for x in r['rootFileInventoryWithStableHashes']}
assert len(rows)==r['rootFileCount']==12787 and sum(x['allocatedBytes'] for x in rows.values())==r['rootPhysicalAllocatedBytes']
local=sorted(p for p in O.rglob('*') if p.is_file());held={p.relative_to(O).as_posix() for p in local}
for p in local:
 n=p.relative_to(O).as_posix();raw=p.read_bytes();assert len(raw)==rows[n]['bytes'] and sha(raw)==rows[n]['sha256']
omitted=set(rows)-held
assert len(local)==len(rows)-len(omitted) and all(any(v.startswith('private-') for v in pathlib.PurePosixPath(n).parts) or any(v.endswith('-assets') for v in pathlib.PurePosixPath(n).parts) or n.endswith(('.db','.db-wal','.db-shm')) for n in omitted)
assert not any(p.name.endswith(('.db','.db-wal','.db-shm')) or p.name.startswith('private-') for p in local) and r['privateFileBytesFetched']==0
spec=j(O/'proof-input.json');index=j(O/'tooling-source-index.json');review=j(O/'source-review-original.json');approval(review,index)
assert index['head']=='187636984895aec44044635fb63498b0fcb3102e' and review['id']==6211327371
assert spec['head']==CANDIDATE and spec['tree']==TREE and spec['image']==IMAGE and spec['retryAllowed'] is False
assert len(spec['packageHashes'])==64 and rows['proof-input.json']['mode']==0o400
for n,h in spec['packageHashes'].items():assert sha((O/n).read_bytes())==h and rows[n]['mode']==0o400
for n in FILES:assert sha((S/n).read_bytes())==sha((O/n).read_bytes())==index['files'][n]['sha256']
copy_site_guard({n:(O/n).read_bytes() for n in EXPECTED_SITES})
frozen=j(R/'WP/startup-order-readiness-20261015/full-pinned-copy-retention-bound-ordinary-once/source-before.json')
assert len(frozen)==1333 and all(sha((R/n).read_bytes())==h for n,h in frozen.items())
sourceindex=S/'source568-publication-once/publication-index.json';pub=j(sourceindex);bindings=[{**x,'length':x.get('length',x.get('bytes'))} for x in pub['bindings']]
assert len(bindings)==731
raw=sourceindex.read_bytes();bindings.append({'path':sourceindex.relative_to(R).as_posix(),'length':len(raw),'sha256':sha(raw),'gitBlobOid':oid(raw)})
assert len(bindings)==732
batch=git('cat-file','--batch',payload=('\n'.join(x['gitBlobOid'] for x in bindings)+'\n').encode());at=0
for item in bindings:
 end=batch.index(b'\n',at);obj,kind,length=batch[at:end].decode().split();length=int(length);raw=batch[end+1:end+1+length];at=end+2+length
 assert obj==item['gitBlobOid'] and kind=='blob' and batch[at-1:at]==b'\n' and length==item['length'] and sha(raw)==item['sha256'] and oid(raw)==obj
assert at==len(batch) and git('show',index['head']+':'+sourceindex.relative_to(R).as_posix())==sourceindex.read_bytes()
names=list(APP_PINS);batch=git('cat-file','--batch',payload=('\n'.join(APP_PINS[n]['blob'] for n in names)+'\n').encode());at=0;raws={}
for n in names:
 end=batch.index(b'\n',at);obj,kind,length=batch[at:end].decode().split();length=int(length);raw=batch[end+1:end+1+length];at=end+2+length
 assert kind=='blob' and obj==APP_PINS[n]['blob'] and batch[at-1:at]==b'\n' and length==APP_PINS[n]['bytes'] and sha(raw)==APP_PINS[n]['sha256'] and oid(raw)==obj;raws[n]=raw
assert at==len(batch) and len(raws)==458
manifest={x['path']:x for x in j(O/'source-index.json')['entries']};derivation=validate_sources(raws,manifest);assert derivation==spec['applicationCopyDerivation']
events=spec['expectedReadyEvents'];assert events==derivation['readyEvents'] and len(events)==26 and spec['expectedEntrypointVerifiers']==27
props=dict(x.split('=',1) for x in r['systemctlOriginal'].splitlines() if '=' in x);inv='119b9c19c39e46d8bb482c144bd432ea'
assert props['MainPID']=='0' and props['ActiveState']=='inactive' and props['Result']=='success'
active=j(S/'ninth-mount-order-100000-opening-publication-once/later-opening-complete-record.json')['actualUnitProperties']
assert active['InvocationID']==inv and active['MemoryMax']=='805306368' and active['MemorySwapMax']=='0' and active['RuntimeMaxUSec']=='1h 30min' and active['TimeoutStopUSec']=='5min' and str(ROOT)+'/stop_owned.py' in active['ExecStopPost'] and 'ignore_errors=no' in active['ExecStopPost']
terminal=j(O/'proof-receipt.json');assert terminal==r['originalTerminal'] and r['producerRecordedSuccess'] is True and r['originalTerminalName']=='proof-receipt.json'
assert terminal['status']=='STEP2_RUNTIME_CHECKS_COMPLETE_AWAITING_EXEC_STOP_POST_NOT_DEPLOYED' and terminal['qualificationPendingExecStopPost'] is True and terminal['stopPostRequiredBeforeIndependentAcceptance'] is True and terminal['neverReplay'] is True
assert terminal['head']==CANDIDATE and terminal['tree']==TREE and terminal['image']==IMAGE and terminal['toolingCommit']==index['head'] and terminal['sourceReviewId']==review['id']
assert terminal['productionMutations']==terminal['productionSqliteConnections']==terminal['newProductionSnapshots']==terminal['deployments']==terminal['newInstallerOrPolicyCalls']==0 and terminal['releaseKit'] is terminal['gate'] is None
assert terminal['jobsOnQualificationStillRequired'] is False and not (O/'proof-terminal-refusal.json').exists()
prior=prior_records(O);validate_records(prior);expected=prior['prior-installed-209--logical-state.json'];assert len(expected['tables'])==112 and expected['tables']['_schema_migrations']['count']==42
derived=load_health(O);assert derived==j(O/'derived-healthcheck.json')
off=j(O/'startup-1-result.json');on=j(O/'startup-2-result.json');all_raw_names=set();startups=[];all_sample_paths=[]
for number in [1,2]:
 label='startup-'+str(number);jobs=number==2;attempt=j(O/(label+'-default-entrypoint-attempt.json'));cid=attempt['id'];assert attempt['neverRetry'] is True and attempt['jobsEnabled'] is jobs
 for suffix in ['create','start','startup-logs','http-probes']:exit_ok(label+'-'+suffix)
 log=((O/(label+'-startup-logs.stdout')).read_bytes()+b'\n'+(O/(label+'-startup-logs.stderr')).read_bytes()).decode('utf-8')
 checks=startup_log(log,events,27,jobs=jobs)
 assert len(checks['entrypointVerifiers'])==27 and len(checks['readyEvents'])==26 and type(checks['databaseChanges']) is int and checks['databaseChanges']==0
 probes=j(O/(label+'-http-probes.stdout'));assert probes==[{'method':'GET','path':'/api/health','status':200},{'method':'GET','path':'/login','status':200},{'method':'POST','path':'/api/v2/sis/receipts','status':401}]
 polls=sorted(O.glob(label+'-health-poll-*.json'));assert len(polls)==r['healthPollCounts'][str(number)]==[349,319][number-1]
 previous=None;lastelapsed=0.;unhealthy=0.;transitions=[];firsthealthy=None
 for i,p in enumerate(polls,1):
  v=j(p);assert p.name==label+'-health-poll-'+str(i).zfill(6)+'.json' and rows[p.name]['mode']==0o400
  elapsed=v['elapsedSeconds'];assert lastelapsed<=elapsed<600 and v['previousStatus']==previous and v['transition']==(previous!=v['status'])
  if previous=='unhealthy':unhealthy+=elapsed-lastelapsed
  assert math.isclose(v['unhealthySecondsObservedSoFar'],unhealthy,rel_tol=0,abs_tol=1e-8)
  state=v['state'];assert state['Running'] is True and state['OOMKilled'] is False and not state.get('Restarting') and not state.get('Dead') and state['Health']['Status']==v['status']
  assert type(state['Health']['FailingStreak']) is int and isinstance(state['Health']['Log'],list);assert_healthcheck(v['healthcheck'],derived)
  if v['transition']:transitions.append({'path':p.name,**v})
  if v['status']=='healthy' and firsthealthy is None:firsthealthy=elapsed
  previous=v['status'];lastelapsed=elapsed
 assert previous=='healthy' and firsthealthy==[423.1075271220034,393.53061386999616][number-1]
 samplepaths=sorted(p for p in O.glob(label+'-memory-*.json') if re.fullmatch(label+'-memory-[0-9]{6}[.]json',p.name))
 assert len(samplepaths)==r['memorySampleCounts'][str(number)]==[389,421][number-1] and len(samplepaths)<=4096
 summaries=[];descriptor=None;evidence=0;maxsum=0;maxpeak=0;sample_times=[];phase_counts=collections.Counter();poll_samples=[]
 for i,p in enumerate(samplepaths,1):
  sample=j(p);assert p.name==label+'-memory-'+str(i).zfill(6)+'.json' and rows[p.name]['mode']==0o400
  identity=sample['identity'];assert identity['id']==cid and identity['owner']==str(ROOT)+':'+label and identity['memory']==identity['memoryAndSwap']==MEMORY and identity['oomKilled'] is False and identity['restarts']==0
  assert type(identity['pid']) is int and identity['pid']>0 and identity['startedAt'];desc={'identity':identity,'cgroup':sample['cgroup']}
  if descriptor is None:descriptor=desc
  assert descriptor==desc and type(sample['cgroup']['inode']) is int and type(sample['cgroup']['device']) is int
  phase=sample['phase'];assert phase in ['health-poll','ready-final','running-command','before-stop','natural-intake','consistent-backup'];phase_counts[phase]+=1
  rawrows=sample['originalKernelReads'];assert len(rawrows)==8;rawvalues=[]
  for n,row in enumerate(rawrows):
   name=row['path'];assert name not in all_raw_names and pathlib.PurePosixPath(name).name==name and name.startswith(p.stem+'-raw-'+str(n).zfill(2)+'-');all_raw_names.add(name)
   raw=(O/name).read_bytes();assert len(raw)==row['bytes']==rows[name]['bytes'] and sha(raw)==row['sha256']==rows[name]['sha256'] and rows[name]['mode']==0o400
   assert 0<len(raw)<=[4096,256*1024,16384,4096,64,64,64,4096][n];evidence+=rounded(len(raw));rawvalues.append(raw)
   expected_kernel=('/proc/'+str(identity['pid'])+'/cgroup') if n in [0,7] else ('/proc/668224/mountinfo' if n==1 else sample['cgroup']['path']+'/'+mem.RAW_NAMES[n-2])
   assert row['kernelPath']==expected_kernel
  assert rawvalues[0]==rawvalues[7] and mem.cgroup_path(cid,rawvalues[0],rawvalues[1]).as_posix()==sample['cgroup']['path']
  assert mem.pairs(rawvalues[2],mem.STAT_REQUIRED)==sample['memoryStat'] and mem.pairs(rawvalues[3],mem.EVENT_REQUIRED)==sample['memoryEvents']
  assert mem.scalar(rawvalues[4])==sample['memoryPeakBytesObservation'] and mem.scalar(rawvalues[5])==sample['memoryMaxBytes']==MEMORY and mem.scalar(rawvalues[6])==sample['memorySwapMaxBytes']==0
  total=sum(sample['memoryStat'][k] for k in mem.NON_RECLAIMABLE_FIELDS);assert total==mem.gate(sample)<=603979776 and sample['memoryEvents']['oom']==sample['memoryEvents']['oom_kill']==0
  assert sample['nonReclaimableFields']==list(mem.NON_RECLAIMABLE_FIELDS) and sample['nonReclaimableMaximumBytes']==603979776 and sample['peakMaxHighPgscanPgstealAreObservationsOnly'] is True
  evidence+=rounded(len(canonical(sample))+1);maxsum=max(maxsum,total);maxpeak=max(maxpeak,sample['memoryPeakBytesObservation'])
  summaries.append({'path':p.name,'nonReclaimableBytes':total,'memoryPeakBytesObservation':sample['memoryPeakBytesObservation'],'memoryEvents':sample['memoryEvents'],'memoryStat':sample['memoryStat'],'phase':phase});when=datetime.datetime.fromisoformat(sample['observedUtc']);sample_times.append(when)
  if phase=='health-poll':poll_samples.append(when)
 assert sample_times==sorted(sample_times) and len(poll_samples)==len(polls) and phase_counts['ready-final']==1 and evidence<=268435456
 assert all(t>=datetime.datetime.fromisoformat(j(p)['observedUtc']) for t,p in zip(poll_samples,polls))
 ready_sample=next(j(p) for p in samplepaths if j(p)['phase']=='ready-final')
 assert (datetime.datetime.fromisoformat(ready_sample['observedUtc'])-datetime.datetime.fromisoformat(identity['startedAt'].replace('Z','+00:00'))).total_seconds()<600
 result=on if jobs else off;rd=result['readiness'];assert result['id']==cid and result['stoppedContainerRetained'] is True
 if not jobs:assert result['fullInstalledStatePreserved'] is True
 assert rd['checks']==checks and rd['httpProbes']==probes and rd['healthPollCount']==len(polls) and rd['healthPollEvidence']==[p.name for p in polls] and rd['healthTransitions']==transitions
 assert rd['timeToFirstHealthySeconds']==firsthealthy and math.isclose(rd['totalUnhealthySeconds'],unhealthy,abs_tol=1e-8) and rd['readinessElapsedSeconds']<600
 m=result['memory'];assert m['hostMemorySamples']==summaries and m['sampledNonReclaimableMaxBytes']==maxsum and m['memoryPeakBytesObservation']==maxpeak and m['maxReadyRssBytes']==max(v['rss_bytes'] for v in checks['readyEvents'])
 assert summaries[-1]['phase']=='before-stop' and phase_counts['before-stop']==1
 initial={**m,'sampleAndSummaryAllocatedAllowanceBytes':evidence};evidence+=rounded(len(canonical(initial))+1+128)
 assert evidence==m['sampleAndSummaryAllocatedAllowanceBytes']<=m['memoryEvidenceMaximumBytesPerStartup']==268435456
 seal_dir='jobs-on-stopped-seal' if jobs else label+'-stopped-seal';seal=j(O/seal_dir/'seal.json');state=j(O/seal_dir/'logical-state.json')
 assert seal['logicalStateSha256']==sha(canonical(state)) and seal['backupSha256']==rows[seal_dir+'/backup.db']['sha256'] and seal['backup']==result['stoppedBackup']==str(ROOT/seal_dir/'backup.db')
 if not jobs:assert state==expected
 assert len(state['tables'])==112 and state['tables']['_schema_migrations']==expected['tables']['_schema_migrations'] and state['objects']==expected['objects'] and state['integrity']=='ok' and state['foreignKeyViolations']==0
 assert seal['rawMasterNeverOpenedSqlite'] and seal['countsIncludeWal'] and seal['productionSnapshotHandoff'] is None
 authority=j(O/seal_dir/'raw/copy-authority.json');assert authority['originalFiles']==seal['originalFiles'] and authority['originalFilesPreserved'] and authority['rawMasterNeverOpenedSqlite']
 for suffix,old in seal['originalFiles'].items():
  target=rows.get(label+'-database/dev.db'+suffix);rawrow=rows.get(seal_dir+'/raw/dev.db'+suffix)
  if old is None:assert target is rawrow is None
  else:assert {k:v for k,v in target.items() if k!='path'}==old and rawrow['sha256']==old['sha256'] and rawrow['bytes']==old['bytes'] and rawrow['mode']==0o400
 assets=prior['prior-assets-snapshot-handoff.json']['rawCopyByteIdentity'];prefix=label+'-assets/'
 actual={n[len(prefix):]:{'bytes':x['bytes'],'sha256':x['sha256']} for n,x in rows.items() if n.startswith(prefix)};assert actual==assets
 assert (O/(label+'-database/schema.prisma')).read_bytes()==raws['server/prisma/schema.prisma'] and (O/(label+'-database/.seed_complete')).read_bytes()==b''
 memory_allocated=sum(rows[n]['allocatedBytes'] for n in rows if re.fullmatch(label+'-memory-[0-9]{6}(?:-raw-[^/]+[.]stdout|[.]json)',n));assert memory_allocated<=evidence
 startups.append({'id':cid,'jobsEnabled':jobs,'entrypointNoopIntegerZeroCount':27,'readyIntegerZeroCount':26,'httpProbes':probes,'healthPollCount':len(polls),'firstHealthySeconds':firsthealthy,'observedUnhealthyPollIntervalSeconds':unhealthy,'fullHealthTransitions':transitions,'memorySampleCount':len(samplepaths),'kernelRawReadCount':8*len(samplepaths),'memoryPhases':dict(phase_counts),'sampledNonReclaimableMaxBytes':maxsum,'maxReadyRssBytes':max(v['rss_bytes'] for v in checks['readyEvents']),'memoryPeakBytesObservation':maxpeak,'evidenceAllowanceBytes':evidence,'memoryFilesPhysicalAllocatedBytes':memory_allocated,'cgroupIdentity':descriptor,'finalBeforeStopSamplePresent':True,'fullStopped112Tables42ReceiptsStatePreserved':True if not jobs else None,'copiedAssetsHashLengthEqualFiles':len(actual),'copiedAssetAllocatedBytes':sum(x['allocatedBytes'] for n,x in rows.items() if n.startswith(prefix))})
 all_sample_paths+=samplepaths
assert len(all_raw_names)==6480 and len(all_sample_paths)==810 and not list(O.glob('startup-*-memory-*-refusal.json'))
broad=off['broadPostflights'];exit_ok('api-postflight');assert probe_results((O/'api-postflight.stdout').read_bytes())==broad['apiChecks']=={'passed':31,'total':31,'failed':0}
assert broad['fullStoppedEqualityRequiredAfterAllProbes'] is True and [v['source'] for v in broad['readOnlyProbes']]==list(PROBES)
for value in broad['readOnlyProbes']:
 assert value['sha256']==sha((O/value['source']).read_bytes()) and value['exitCode']==0;exit_ok('broad-'+value['source'][:-4])

from controller_guard import parse_events,UNIT
hook=j(O/'stop-post-result.json');assert hook['allExactOwnedStopped'] is True and hook['errors']==[] and hook['postStopErrors']==[] and hook['controllerMemoryErrorType'] is None and hook['execStopPost'] is True and hook['productionActions']==hook['foreignContainersStopped']==0
assert len(hook['stoppedAndRetained'])==2 and {v['after']['id'] for v in hook['stoppedAndRetained']}=={v['id'] for v in startups}
for item in hook['stoppedAndRetained']:
 assert item['retained'] is True and item['after']['running'] is False and item['before']['running'] is False
 assert item['before']==item['after'] and item['after']['owner'] in {str(ROOT)+':startup-1',str(ROOT)+':startup-2'}
 assert item['after']['mounts']==sorted(item['after']['mounts'],key=lambda v:v['Destination'])
controller=[]
for phase,snapshot in [('before',j(O/'controller-memory-before.json')),('after',j(O/'controller-memory-after.json')),('stop-post',hook['controllerMemory'])]:
 rr=[j(O/('controller-memory-'+phase+'-raw-'+str(i).zfill(2)+'.json')) for i in range(1,9)];first=rr[0]['path'];assert re.fullmatch('/proc/[1-9][0-9]*/cgroup',first)
 paths=[first]+['/sys/fs/cgroup/system.slice/'+UNIT+'/'+n for n in ['memory.events','memory.current','memory.peak','memory.max','memory.swap.max','memory.stat']]+[first]
 assert [x['path'] for x in rr]==paths and rr[0]==rr[7]
 for x in rr:assert 0<len(x['rawAscii'].encode('ascii'))==x['bytes']<=16384 and sha(x['rawAscii'].encode('ascii'))==x['sha256']
 assert snapshot['unit']==UNIT and snapshot['membershipRaw']==rr[0]['rawAscii']=='0::/system.slice/'+UNIT+'\n' and snapshot['cgroupDevice']==24 and snapshot['cgroupInode']==43231
 for x,n in zip(rr[1:7],['memory.events','memory.current','memory.peak','memory.max','memory.swap.max','memory.stat']):assert snapshot['raw'][n]==x['rawAscii'] and snapshot['sha256'][n]==x['sha256']
 assert parse_events(rr[1]['rawAscii'].encode())==snapshot['events'] and snapshot['events']['oom']==snapshot['events']['oom_kill']==0
 assert all(re.fullmatch('0|[1-9][0-9]*',snapshot['raw'][n].strip()) and int(snapshot['raw'][n].strip())==value for n,value in snapshot['scalars'].items()) and snapshot['scalars']['memory.max']==805306368 and snapshot['scalars']['memory.swap.max']==0
 st={}
 for line in rr[6]['rawAscii'].splitlines():
  k,v=line.split();assert k not in st and re.fullmatch('0|[1-9][0-9]*',v);st[k]=int(v);assert st[k]<2**64
 assert st==snapshot['memoryStat'] and {'anon','file'}<=set(st) and snapshot['peakMaxHighObservationOnly'] is True
 controller.append({'phase':phase,'snapshot':snapshot,'rawCount':8,'numericPid':int(first.split('/')[2])})
assert controller[0]['numericPid']==controller[1]['numericPid']==668224
journal=[json.loads(l) for l in r['journalOriginal'].splitlines() if l];assert len(journal)==4 and all(v['_PID']=='1' and v['INVOCATION_ID']==inv and v['UNIT']==UNIT for v in journal)
messages=[v['MESSAGE'] for v in journal];assert any('Deactivated successfully.' in v for v in messages) and not any('FAILURE' in v or 'Failed' in v for v in messages)
# Post-stop command exit0 follows successful systemd deactivation with ignore_errors=no;
# unloaded-unit default ExecMainStatus/limits are not execution evidence.
runtime=j(O/'fresh-r4-before-proof-copies.json');capacity_gate(runtime,'RUNTIME_BIND',0);assert runtime['requiredBytes']==60921981038 and runtime['observedUtc']=='2026-10-16T08:33:39.193844+00:00'
assert package_allowance({n:rows[n]['bytes'] for n in [*spec['packageHashes'],'proof-input.json']})==11296768
launch=S/'proof-launch-workflow-batch-mount-order-forward-be837974-20261016T100000Z'
for n,phase,future in [('metadata-capacity-before-root-stdout.log','BEFORE_ROOT',11296768),('metadata-capacity-immediately-before-unit-stdout.log','BEFORE_UNIT',0)]:capacity_gate(j(launch/n),phase,future)
measured=j(O/'measured-copy-reserve.json');budget=Budget(measured['databaseTripleAllocationBytes'],measured['assetAllocationBytes']);assert measured['stageTable']==TABLE
allocations=[];before=j(O/'allocation-before.json')
for label in ['before','stage-startup-1','stage-startup-2','terminal']:
 value=j(O/('allocation-'+label+'.json'));parsed={}
 for line in (O/('allocation-'+label+'-stdout.log')).read_text().splitlines():
  size,path=line.split('\t',1);assert path not in parsed and re.fullmatch('[0-9]+',size);parsed[path]=int(size)
 assert parsed=={p:x['bytes'] for p,x in value['allocations'].items()} and set(parsed)==set(ALLOCATION) and not (O/('allocation-'+label+'-stderr.log')).read_bytes()
 assert value['allRetainedReleaseRootsIncluded'] and value['hardlinksCountedOnce'] and value['duSingleFilesystem'] and value['overlayViewsCreditedBytes']==0 and value['realBackingCountedUnder']=='/var/lib/containerd'
 assert all(value['free'][p]>=value['requiredBytes'] for p in BOUND)
 if label!='before':assert growth(before,value)==value['growth']
 allocations.append(value)
for number in [1,2]:
 label='startup-'+str(number);budget.begin(label,min(allocations[number-1]['free'].values()));intent=j(O/('budget-'+label+'-intent.json'));assert intent['remainingIncludingStageBytes']==budget.remaining() and intent['minimumDuringStageBytes']==budget.required()
 for site,count in TABLE[number-1]['sites'].items():
  for _ in range(count):budget.claim(site)
 physical=max(0,sum(allocations[number]['allocations'][p]['bytes']-allocations[number-1]['allocations'][p]['bytes'] for p in ALLOCATION));assert budget.finish(label,physical)==j(O/('budget-'+label+'-closed.json'))
assert budget.remaining()==0 and allocations[-1]['requiredBytes']==24851118190
telemetry=[j(p) for p in sorted(O.glob('memory-budget-check-*.json'))];assert [v['checkpoint'] for v in telemetry]==list(range(1,len(telemetry)+1)) and all(v['actualCountersNotPageCacheDiagnosis'] is True for v in telemetry)
bc=r['containerInventoryBeforeSafeSelected'];ac=r['containerInventoryAfterSafeSelected'];owned=r['newOwnedContainersStoppedRetained'];assert len(owned)==2 and set(owned)=={x['id'] for x in startups} and set(ac)-set(bc)==set(owned)
for cid,v in bc.items():assert all(v[k]==ac[cid][k] for k in ['name','image','labels','running','startedAt']) and mount_objects(v['mounts'])==mount_objects(ac[cid]['mounts'])
for number,start in enumerate(startups,1):
 v=r['newOwnedRuntimeSafeSelected'][start['id']];assert not v['state']['Running'] and not v['state']['OOMKilled'] and v['state']['ExitCode']==137 and v['restartCount']==0 and v['hostConfig']['Memory']==v['hostConfig']['MemorySwap']==MEMORY and v['hostConfig']['NetworkMode']==('none' if number==1 else 'bridge')
 env=v['selectedEnvironment'];assert env['NODE_OPTIONS']=='' and env['DISABLE_BACKGROUND_JOBS']==('true' if number==1 else 'false') and env['ALLOW_PRISMA_DB_PUSH']==env['ALLOW_AUTO_SEED']=='false';assert_healthcheck(v['config']['Healthcheck'],derived)
 assert all(m['Type']=='bind' and m['Source'].startswith(str(ROOT)+'/') for m in v['mounts'])
assert r['bothOwnedActuallyStopped'] is True and r['boundOldInputRawReaderBackupHashesStatsPreserved'] and r['qualifiedEntireImageUnchanged'] and r['normalPredecessorSelectedDerived']==j(O/'predecessor-before-selected.json')
diag=D/'fresh-closed-diagnostics';buildraw=(diag/'qualified-original-build-receipt.json').read_bytes();image=j(diag/'qualified-fresh-whole-image-inspect.json');qualified(json.loads(buildraw),buildraw,image[0]);assert image==j(O/'qualified-image-inspect-original.json')
result={'status':'CLOSED_MOUNT_ORDER100000_STARTUP_MEMORY_CONTROLLER_ACCOUNTING_ORIGINALS_INDEPENDENTLY_VALIDATED_NATURAL_DETAIL_VALIDATION_SEPARATE','validatedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'root':str(ROOT),'invocation':inv,'sourceHead':index['head'],'sourceReviewId':review['id'],'terminalUtc':terminal['closedUtc'],'terminalSha256':sha((O/'proof-receipt.json').read_bytes()),'stopPostSha256':sha((O/'stop-post-result.json').read_bytes()),'rootFilesHashed':len(rows),'allSmallPublicOriginalsRetainedLocally':len(local),'hostOnlyHashStatFiles':len(omitted),'privateFileBytesFetched':0,'rootFileAllocatedBytesNotWholeStoreAccounting':r['rootPhysicalAllocatedBytes'],'all65PackageFilesUnchanged':True,'all732SourceRawGitOidShaLengthBindingsVerified':True,'all37SourcesAnd1333AppInputsUnchanged':True,'all458RawGitAppPinsVerified':True,'startups':startups,'allHealthPollsValidated':sum(v['healthPollCount'] for v in startups),'allMemorySamplesValidated':len(all_sample_paths),'allOriginalKernelReadsValidated':len(all_raw_names),'sampledOnlyNotContinuousPeak':True,'controllerBeforeAfterPostStopValidated':controller,'controllerCgroupSameDeviceInode':True,'controllerOomZeroEveryPhase':True,'stopPostNonVacuousTwoOwners':True,'stopPostErrorsEmpty':True,'systemdSuccessfulDeactivationAfterNonIgnoredStopPost':True,'hookExitZeroDerivedFromJournalLifecycleNotUnloadedDefaults':True,'unloadedDefaultSystemctlNotExecutedLimits':True,'fullJournalRecords':len(journal),'jobsOff31ApiSixProbesAndFull11242StoppedState':True,'jobsOffBroadPostflights':broad,'originalRuntimeR4NotNewMeasurement':runtime,'originalPhysicalAccounting':allocations,'remainingBudgetBytes':budget.remaining(),'controllerTelemetryRecords':len(telemetry),'allHistoricalContainersPreserved':len(bc),'twoOwnedStoppedRetained':True,'qualifiedImageReceiptPreserved':True,'oldInputsHashStatPreservedNoSql':True,'normalPredecessorHealthyUnchanged':True,'naturalSyncDetailValidationRequiredSeparately':True,'wholeProofPassed':False,'releaseQualified':False,'deployments':0,'retainerSqlConnections':0,'newDuMeasurements':0,'proofRetries':0}
with (D/'independent-startup-memory-accounting-validation.json').open('xb') as f:f.write(canonical(result)+b'\n')
print(json.dumps({k:result[k] for k in ['status','validatedUtc','rootFilesHashed','allHealthPollsValidated','allMemorySamplesValidated','allOriginalKernelReadsValidated','controllerTelemetryRecords']},ensure_ascii=True))
