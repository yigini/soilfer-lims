"""Validate captured closed jobs003000 failure, without host, SQLite or proof calls."""
import collections,datetime,hashlib,json,math,pathlib,re,subprocess,sys
R=pathlib.Path(__file__).resolve().parents[2];S=R/'WP/batch-proof-controller-forward-step2-be837974-20261016';D=S/'controller-forward063000-closed-exact-status-originals-once';O=D/'remote-originals'
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
assert len(rows)==r['rootFileCount']==10568 and sum(x['allocatedBytes'] for x in rows.values())==r['rootPhysicalAllocatedBytes']
local=sorted(p for p in O.rglob('*') if p.is_file());held={p.relative_to(O).as_posix() for p in local}
for p in local:
 n=p.relative_to(O).as_posix();raw=p.read_bytes();assert len(raw)==rows[n]['bytes'] and sha(raw)==rows[n]['sha256']
omitted=set(rows)-held
assert len(local)==len(rows)-len(omitted) and all(any(v.startswith('private-') for v in pathlib.PurePosixPath(n).parts) or any(v.endswith('-assets') for v in pathlib.PurePosixPath(n).parts) or n.endswith(('.db','.db-wal','.db-shm')) for n in omitted)
assert not any(p.name.endswith(('.db','.db-wal','.db-shm')) or p.name.startswith('private-') for p in local) and r['privateFileBytesFetched']==0
spec=j(O/'proof-input.json');index=j(O/'tooling-source-index.json');review=j(O/'source-review-original.json');approval(review,index)
assert index['head']=='572d8cc94ee5a98c29392f556a57133cedd13128' and review['id']==6208186148
assert spec['head']==CANDIDATE and spec['tree']==TREE and spec['image']==IMAGE and spec['retryAllowed'] is False
assert len(spec['packageHashes'])==58 and rows['proof-input.json']['mode']==0o400
for n,h in spec['packageHashes'].items():assert sha((O/n).read_bytes())==h and rows[n]['mode']==0o400
for n in FILES:assert sha((S/n).read_bytes())==sha((O/n).read_bytes())==index['files'][n]['sha256']
copy_site_guard({n:(O/n).read_bytes() for n in EXPECTED_SITES})
frozen=j(R/'WP/startup-order-readiness-20261015/full-pinned-copy-retention-bound-ordinary-once/source-before.json')
assert len(frozen)==1333 and all(sha((R/n).read_bytes())==h for n,h in frozen.items())
sourceindex=S/'source420-publication-once/publication-index.json';pub=j(sourceindex);bindings=[{**x,'length':x['bytes']} for x in pub['bindings']]
assert len(bindings)==658
raw=sourceindex.read_bytes();bindings.append({'path':sourceindex.relative_to(R).as_posix(),'length':len(raw),'sha256':sha(raw),'gitBlobOid':oid(raw)})
assert len(bindings)==659
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
props=dict(x.split('=',1) for x in r['systemctlOriginal'].splitlines() if '=' in x);inv='797d78bb476a4fff8b8ffce6c9445847'
assert props['MainPID']=='0' and props['ActiveState']=='failed' and props['Result']=='exit-code' and props['ExecMainStatus']=='1' and props['InvocationID']==inv
assert props['MemoryMax']=='805306368' and props['MemorySwapMax']=='0' and props['RuntimeMaxUSec']=='1h 30min'
terminal=j(O/'proof-terminal-refusal.json');assert terminal==r['originalTerminal'] and r['producerRecordedSuccess'] is False and r['originalTerminalName']=='proof-terminal-refusal.json'
assert terminal['status']=='FAILED_OR_REFUSED_RETAIN_ALL_FORWARD_FIX_ONLY' and terminal['error']=={'errorType':'RuntimeError','literalRequire':'Conflict evidence identity/time malformed'} and terminal['neverRetry'] is True and terminal['ownedStopError'] is None
assert terminal['productionMutations']==terminal['productionSqliteConnections']==terminal['newProductionSnapshots']==0
absent=['proof-receipt.json','startup-2-result.json','first-sync-preservation.json','second-sync-preservation.json','full-intake-preservation.json','budget-startup-2-closed.json','allocation-terminal.json','allocation-stage-startup-2.json']
assert all(not (O/n).exists() for n in absent) and 'first-sync.db' in rows and rows['first-sync.db']['mode']==0o400
prior=prior_records(O);validate_records(prior);expected=prior['prior-installed-209--logical-state.json'];assert len(expected['tables'])==112 and expected['tables']['_schema_migrations']['count']==42
derived=load_health(O);assert derived==j(O/'derived-healthcheck.json')
off=j(O/'startup-1-result.json');all_raw_names=set();startups=[];all_sample_paths=[]
for number in [1,2]:
 label='startup-'+str(number);jobs=number==2;attempt=j(O/(label+'-default-entrypoint-attempt.json'));cid=attempt['id'];assert attempt['neverRetry'] is True and attempt['jobsEnabled'] is jobs
 for suffix in ['create','start','startup-logs','http-probes']:exit_ok(label+'-'+suffix)
 log=((O/(label+'-startup-logs.stdout')).read_bytes()+b'\n'+(O/(label+'-startup-logs.stderr')).read_bytes()).decode('utf-8')
 checks=startup_log(log,events,27,jobs=jobs)
 assert len(checks['entrypointVerifiers'])==27 and len(checks['readyEvents'])==26 and type(checks['databaseChanges']) is int and checks['databaseChanges']==0
 probes=j(O/(label+'-http-probes.stdout'));assert probes==[{'method':'GET','path':'/api/health','status':200},{'method':'GET','path':'/login','status':200},{'method':'POST','path':'/api/v2/sis/receipts','status':401}]
 polls=sorted(O.glob(label+'-health-poll-*.json'));assert len(polls)==r['healthPollCounts'][str(number)]==[343,322][number-1]
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
 assert previous=='healthy' and firsthealthy==[423.6703404939981,392.62230764099877][number-1]
 samplepaths=sorted(p for p in O.glob(label+'-memory-*.json') if re.fullmatch(label+'-memory-[0-9]{6}[.]json',p.name))
 assert len(samplepaths)==r['memorySampleCounts'][str(number)]==[364,337][number-1] and len(samplepaths)<=4096
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
   expected_kernel=('/proc/'+str(identity['pid'])+'/cgroup') if n in [0,7] else ('/proc/445781/mountinfo' if n==1 else sample['cgroup']['path']+'/'+mem.RAW_NAMES[n-2])
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
 if not jobs:
  rd=off['readiness'];assert off['id']==cid and off['fullInstalledStatePreserved'] is off['stoppedContainerRetained'] is True
  assert rd['checks']==checks and rd['httpProbes']==probes and rd['healthPollCount']==len(polls) and rd['healthPollEvidence']==[p.name for p in polls] and rd['healthTransitions']==transitions
  assert rd['timeToFirstHealthySeconds']==firsthealthy and math.isclose(rd['totalUnhealthySeconds'],unhealthy,abs_tol=1e-8) and rd['readinessElapsedSeconds']<600
  m=off['memory'];assert m['hostMemorySamples']==summaries and m['sampledNonReclaimableMaxBytes']==maxsum and m['memoryPeakBytesObservation']==maxpeak and m['maxReadyRssBytes']==max(v['rss_bytes'] for v in checks['readyEvents'])
  assert summaries[-1]['phase']=='before-stop' and phase_counts['before-stop']==1
  initial={**m,'sampleAndSummaryAllocatedAllowanceBytes':evidence};evidence+=rounded(len(canonical(initial))+1+128)
  assert evidence==m['sampleAndSummaryAllocatedAllowanceBytes']<=m['memoryEvidenceMaximumBytesPerStartup']==268435456
  seal_dir=label+'-stopped-seal';seal=j(O/seal_dir/'seal.json');state=j(O/seal_dir/'logical-state.json')
  assert state==expected and seal['logicalStateSha256']==sha(canonical(state)) and seal['backupSha256']==rows[seal_dir+'/backup.db']['sha256'] and seal['backup']==off['stoppedBackup']==str(ROOT/seal_dir/'backup.db')
  assert seal['rawMasterNeverOpenedSqlite'] and seal['countsIncludeWal'] and seal['productionSnapshotHandoff'] is None
  authority=j(O/seal_dir/'raw/copy-authority.json');assert authority['originalFiles']==seal['originalFiles'] and authority['originalFilesPreserved'] and authority['rawMasterNeverOpenedSqlite']
  for suffix,old in seal['originalFiles'].items():
   target=rows.get(label+'-database/dev.db'+suffix);rawrow=rows.get(seal_dir+'/raw/dev.db'+suffix)
   if old is None:assert target is rawrow is None
   else:assert {k:v for k,v in target.items() if k!='path'}==old and rawrow['sha256']==old['sha256'] and rawrow['bytes']==old['bytes'] and rawrow['mode']==0o400
 else:
  assert summaries[-1]['phase']=='consistent-backup' and not phase_counts['before-stop'] and not (O/'jobs-on-stopped-seal/seal.json').exists()
 assets=prior['prior-assets-snapshot-handoff.json']['rawCopyByteIdentity'];prefix=label+'-assets/'
 actual={n[len(prefix):]:{'bytes':x['bytes'],'sha256':x['sha256']} for n,x in rows.items() if n.startswith(prefix)};assert actual==assets
 assert (O/(label+'-database/schema.prisma')).read_bytes()==raws['server/prisma/schema.prisma'] and (O/(label+'-database/.seed_complete')).read_bytes()==b''
 memory_allocated=sum(rows[n]['allocatedBytes'] for n in rows if re.fullmatch(label+'-memory-[0-9]{6}(?:-raw-[^/]+[.]stdout|[.]json)',n));assert memory_allocated<=evidence
 startups.append({'id':cid,'jobsEnabled':jobs,'entrypointNoopIntegerZeroCount':27,'readyIntegerZeroCount':26,'httpProbes':probes,'healthPollCount':len(polls),'firstHealthySeconds':firsthealthy,'observedUnhealthyPollIntervalSeconds':unhealthy,'fullHealthTransitions':transitions,'memorySampleCount':len(samplepaths),'kernelRawReadCount':8*len(samplepaths),'memoryPhases':dict(phase_counts),'sampledNonReclaimableMaxBytes':maxsum,'maxReadyRssBytes':max(v['rss_bytes'] for v in checks['readyEvents']),'memoryPeakBytesObservation':maxpeak,'evidenceAllowanceBytes':evidence,'memoryFilesPhysicalAllocatedBytes':memory_allocated,'cgroupIdentity':descriptor,'finalBeforeStopSamplePresent':not jobs,'fullStopped112Tables42ReceiptsStatePreserved':True if not jobs else None,'copiedAssetsHashLengthEqualFiles':len(actual),'copiedAssetAllocatedBytes':sum(x['allocatedBytes'] for n,x in rows.items() if n.startswith(prefix))})
 all_sample_paths+=samplepaths
assert len(all_raw_names)==5608 and len(all_sample_paths)==701 and not list(O.glob('startup-*-memory-*-refusal.json'))
broad=off['broadPostflights'];exit_ok('api-postflight');assert probe_results((O/'api-postflight.stdout').read_bytes())==broad['apiChecks']=={'passed':31,'total':31,'failed':0}
assert broad['fullStoppedEqualityRequiredAfterAllProbes'] is True and [v['source'] for v in broad['readOnlyProbes']]==list(PROBES)
for value in broad['readOnlyProbes']:
 assert value['sha256']==sha((O/value['source']).read_bytes()) and value['exitCode']==0;exit_ok('broad-'+value['source'][:-4])
bound=j(O/'scheduler-bound-configs.json');assert bound['cursorIntervalTimestampOverrides']==0 and TARGET_CONFIG in bound['activeConfigsWithoutSecrets'] and len(bound['expectedRefusals'])==4
observations=[j(p) for p in sorted(O.glob('natural-observation-*.json'))];assert len(observations)==1
log=(O/'startup-2-watch-logs-1.stdout').read_text(encoding='utf-8');err=(O/'startup-2-watch-logs-1.stderr').read_text(encoding='utf-8')
exit_ok('startup-2-watch-logs-1');exit_ok('startup-2-watch-http-1');assert j(O/'startup-2-watch-http-1.stdout')==startups[1]['httpProbes']
completions=completed_syncs(log);refusals=scheduler_refusals(log,err,bound['expectedRefusals'])
assert observations[0]['healthy'] is True and observations[0]['observedCompletions']==completions and observations[0]['observedRefusals']==refusals and len(completions)==1 and len(refusals)==4
assert type(completions[0]['newSamples']) is int and type(completions[0]['skipped']) is int and completions[0]['labId']=='ZMB-LAB1'
runtime=j(O/'fresh-r4-before-proof-copies.json');capacity_gate(runtime,'RUNTIME_BIND',0);assert runtime['requiredBytes']==60921981038 and runtime['observedUtc']=='2026-10-16T04:46:07.300063+00:00'
assert package_allowance({n:rows[n]['bytes'] for n in [*spec['packageHashes'],'proof-input.json']})==10764288
launch=S/'proof-launch-workflow-batch-controller-forward-step2-be837974-20261016T063000Z'
for n,phase,future in [('metadata-capacity-before-root-stdout.log','BEFORE_ROOT',10764288),('metadata-capacity-immediately-before-unit-stdout.log','BEFORE_UNIT',0)]:capacity_gate(j(launch/n),phase,future)
measured=j(O/'measured-copy-reserve.json');budget=Budget(measured['databaseTripleAllocationBytes'],measured['assetAllocationBytes']);assert measured['stageTable']==TABLE
allocations=[];before=j(O/'allocation-before.json')
for label in ['before','stage-startup-1']:
 value=j(O/('allocation-'+label+'.json'));parsed={}
 for line in (O/('allocation-'+label+'-stdout.log')).read_text().splitlines():
  size,path=line.split('\t',1);assert path not in parsed;parsed[path]=int(size)
 assert parsed=={p:x['bytes'] for p,x in value['allocations'].items()} and set(parsed)==set(ALLOCATION) and not (O/('allocation-'+label+'-stderr.log')).read_bytes()
 assert value['allRetainedReleaseRootsIncluded'] and value['hardlinksCountedOnce'] and value['duSingleFilesystem'] and value['overlayViewsCreditedBytes']==0 and value['realBackingCountedUnder']=='/var/lib/containerd'
 assert all(value['free'][p]>=value['requiredBytes'] for p in BOUND)
 if label!='before':assert growth(before,value)==value['growth']
 allocations.append(value)
budget.begin('startup-1',min(before['free'].values()));intent=j(O/'budget-startup-1-intent.json');assert intent['remainingIncludingStageBytes']==budget.remaining() and intent['minimumDuringStageBytes']==budget.required()
for site,count in TABLE[0]['sites'].items():
 for _ in range(count):budget.claim(site)
physical=max(0,sum(allocations[1]['allocations'][p]['bytes']-before['allocations'][p]['bytes'] for p in ALLOCATION));assert budget.finish('startup-1',physical)==j(O/'budget-startup-1-closed.json')
budget.begin('startup-2',min(allocations[1]['free'].values()));intent=j(O/'budget-startup-2-intent.json');assert intent['remainingIncludingStageBytes']==budget.remaining() and intent['minimumDuringStageBytes']==budget.required()
telemetry=[j(p) for p in sorted(O.glob('memory-budget-check-*.json'))];assert [v['checkpoint'] for v in telemetry]==list(range(1,len(telemetry)+1)) and all(v['actualCountersNotPageCacheDiagnosis'] is True for v in telemetry)
bc=r['containerInventoryBeforeSafeSelected'];ac=r['containerInventoryAfterSafeSelected'];owned=r['newOwnedContainersStoppedRetained'];assert len(owned)==2 and set(owned)=={x['id'] for x in startups} and set(ac)-set(bc)==set(owned)
for cid,v in bc.items():assert all(v[k]==ac[cid][k] for k in ['name','image','labels','running','startedAt']) and mount_objects(v['mounts'])==mount_objects(ac[cid]['mounts'])
for number,start in enumerate(startups,1):
 v=r['newOwnedRuntimeSafeSelected'][start['id']];assert not v['state']['Running'] and not v['state']['OOMKilled'] and v['state']['ExitCode']==137 and v['restartCount']==0 and v['hostConfig']['Memory']==v['hostConfig']['MemorySwap']==MEMORY and v['hostConfig']['NetworkMode']==('none' if number==1 else 'bridge')
 env=v['selectedEnvironment'];assert env['NODE_OPTIONS']=='' and env['DISABLE_BACKGROUND_JOBS']==('true' if number==1 else 'false') and env['ALLOW_PRISMA_DB_PUSH']==env['ALLOW_AUTO_SEED']=='false';assert_healthcheck(v['config']['Healthcheck'],derived)
 assert all(m['Type']=='bind' and m['Source'].startswith(str(ROOT)+'/') for m in v['mounts'])
journal=[json.loads(l) for l in r['journalOriginal'].splitlines()];assert any(any(x.get(k)==inv for k in ['INVOCATION_ID','_SYSTEMD_INVOCATION_ID']) for x in journal)
messages=[x.get('MESSAGE','') for x in journal];assert all(any(x.get(k)==inv for k in ['INVOCATION_ID','_SYSTEMD_INVOCATION_ID']) for x in journal)
assert any('Main process exited, code=exited, status=1/FAILURE' in x for x in messages) and any('Control process exited, code=exited, status=1/FAILURE' in x for x in messages)
assert any('Stop-post or controller memory refused' in x for x in messages)
from controller_guard import parse_events,UNIT
hook=j(O/'stop-post-result.json');assert hook['allExactOwnedStopped'] is False and hook['stoppedAndRetained']==[] and hook['postStopErrors']==[] and hook['controllerMemoryErrorType'] is None
assert sorted(hook['errors'],key=lambda x:x['owner'])==[{'owner':str(ROOT)+':'+label,'errorType':'RuntimeError'} for label in ['startup-1','startup-2']]
assert r['bothOwnedActuallyStopped'] is True and len(owned)==2
controller=[]
for phase,pid,snapshot in [('before',445781,j(O/'controller-memory-before.json')),('stop-post',494887,hook['controllerMemory'])]:
 rr=[j(O/('controller-memory-'+phase+'-raw-'+str(i).zfill(2)+'.json')) for i in range(1,8)]
 paths=['/proc/'+str(pid)+'/cgroup']+['/sys/fs/cgroup/system.slice/'+UNIT+'/'+n for n in ['memory.events','memory.current','memory.peak','memory.max','memory.swap.max']]+['/proc/'+str(pid)+'/cgroup']
 assert [x['path'] for x in rr]==paths and rr[0]==rr[6]
 for x in rr:assert len(x['rawAscii'].encode('ascii'))==x['bytes'] and sha(x['rawAscii'].encode('ascii'))==x['sha256']
 assert snapshot['unit']==UNIT and snapshot['membershipRaw']==rr[0]['rawAscii']=='0::/system.slice/'+UNIT+'\n' and snapshot['cgroupDevice']==24 and snapshot['cgroupInode']==34168
 for x,n in zip(rr[1:6],['memory.events','memory.current','memory.peak','memory.max','memory.swap.max']):assert snapshot['raw'][n]==x['rawAscii'] and snapshot['sha256'][n]==x['sha256']
 assert parse_events(rr[1]['rawAscii'].encode())==snapshot['events'] and snapshot['events']['oom']==snapshot['events']['oom_kill']==0
 assert all(int(snapshot['raw'][n].strip())==value for n,value in snapshot['scalars'].items()) and snapshot['scalars']['memory.max']==805306368 and snapshot['scalars']['memory.swap.max']==0
 controller.append({'phase':phase,'snapshot':snapshot,'rawCount':7})
assert not (O/'controller-memory-after.json').exists() and props['TimeoutStopUSec']=='5min' and str(ROOT)+'/stop_owned.py' in props['ExecStopPost'] and 'status=1' in props['ExecStopPost']
assert r['boundOldInputRawReaderBackupHashesStatsPreserved'] and r['qualifiedEntireImageUnchanged'] and r['normalPredecessorSelectedDerived']==j(O/'predecessor-before-selected.json')
diag=D/'fresh-closed-diagnostics';buildraw=(diag/'qualified-original-build-receipt.json').read_bytes();image=j(diag/'qualified-fresh-whole-image-inspect.json');qualified(json.loads(buildraw),buildraw,image[0]);assert image==j(O/'qualified-image-inspect-original.json')
result={'status':'CLOSED_CONTROLLER_FORWARD063000_REFUSAL_AND_STOP_HOOK_FAILURE_INDEPENDENTLY_VALIDATED_NOT_RELEASE_QUALIFIED','validatedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sourceHead':index['head'],'sourceReviewId':review['id'],'root':str(ROOT),'invocation':inv,'terminalUtc':terminal['closedUtc'],'terminalSha256':sha((O/'proof-terminal-refusal.json').read_bytes()),'error':terminal['error'],'failureLocation':'First natural sync preservation refused at provenance_rules.checked_cross static identity/time conjunction; actual rejected row/value or which conjunct failed not independently located','controllerRawValidation':controller,'stopHookOriginal':hook,'stopHookExitStatus':1,'actualOwnedStoppedDespiteHookRefusal':True,'closedAcceptancePassed':False,'rootFilesHashed':len(rows),'rootFileAllocatedBytesNotWholeStoreAccounting':r['rootPhysicalAllocatedBytes'],'allSmallNonDatabaseNonAssetOriginalsRetainedLocally':len(local),'databaseAndAssetFilesRemainOnHostWithHashes':len(omitted),'all59PackageFilesUnchanged':True,'all659SourcePublicationBindingsVerified':True,'all31ReviewedSourcesAnd1333ApplicationInputsUnchanged':True,'all458ApplicationRawGitOidShaLengthBindingsVerified':True,'startups':startups,'jobsOffBroadPostflights':broad,'jobsOffFullStopped112Tables42ReceiptsStateEqual':True,'allMemorySamplesValidated':len(all_sample_paths),'allOriginalKernelReadsValidated':len(all_raw_names),'memorySampledOnlyNotContinuousPeak':True,'controllerPeakBytesSeparateObservationOnly':int(props['MemoryPeak']),'runtimeR4OriginalNotNewMeasurement':runtime,'originalPhysicalAccountingReached':allocations,'terminalFullStoreAccountingReached':False,'controllerMemoryTelemetryOriginalCount':len(telemetry),'naturalObservations':observations,'naturalCompletionReportedCountsAreNotValidatedIntakeCounts':True,'secondNaturalSyncQualificationCompleted':False,'fullJobsOnPreservationValidated':False,'rejectedConflictIdentityOrTimeIndependentlyLocated':False,'firstSyncBackupRetainedHashStatOnly':rows['first-sync.db'],'absentUnreachedArtifacts':absent,'historicalContainersPreserved':len(bc),'newOwnedStoppedContainersRetained':2,'boundOld11242InputsPreservedHashStatNoSql':True,'qualifiedOriginalReceiptAndEntireImageUnchanged':True,'normalProductionHealthyUnchanged':True,'freshClosedFreeBytesObservationOnlyNotFutureFit':r['currentFreeBytes'],'producerPassed':False,'wholeProofPassed':False,'releaseQualified':False,'deployments':0,'retainerSqlConnections':0,'newDuMeasurements':0,'proofRetries':0,'allRawDatabaseWalShmAssetsRemainOnHost':True,'forwardRecovery':'SEPARATELY_AUDITED_FORWARD_FIX_ONLY','memoryOrPreservationGuardRelaxationAuthorized':False}
with (D/'independent-closed-validation.json').open('xb') as f:f.write(canonical(result)+b'\n')
print(json.dumps({k:result[k] for k in ['status','validatedUtc','terminalSha256','rootFilesHashed','allMemorySamplesValidated','allOriginalKernelReadsValidated','historicalContainersPreserved','controllerMemoryTelemetryOriginalCount']},ensure_ascii=True))
