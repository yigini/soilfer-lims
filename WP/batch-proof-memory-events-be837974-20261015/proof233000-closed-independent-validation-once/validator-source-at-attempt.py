"""Independent validation of retained closed originals only. No SSH, SQL, du or operator."""
import collections,datetime,hashlib,json,math,pathlib,re,subprocess,sys
R=pathlib.Path(__file__).resolve().parents[2];S=R/'WP/batch-proof-memory-events-be837974-20261015';D=S/'proof233000-closed-memory-events-complete-originals-once';O=D/'remote-originals'
sys.path.insert(0,str(S))
from proof_contract import canonical,sha,approval,FILES,ROOT,IMAGE,MEMORY,CANDIDATE,TREE,BUILD_RECEIPT_SHA,qualified
from proof_budget import capacity_gate,Budget,TABLE,FLOOR_BYTES,LOG_BYTES,ADDITIONAL_BYTES,copy_site_guard,EXPECTED_SITES,package_allowance
from proof_disk import growth,ALLOCATION,BOUND
from proof_docker import mount_objects
from proof_health import load_health,assert_healthcheck
from proof_inputs import prior_records,validate_records
import proof_memory as mem
def j(p):return json.loads(pathlib.Path(p).read_bytes())
def git(*a):return subprocess.check_output(['git','-c','core.longpaths=true',*a],cwd=R)
def blob(raw):return hashlib.sha1(('blob '+str(len(raw))+'\0').encode()+raw).hexdigest()
def rounded(n):return ((n+4095)//4096)*4096
r=j(D/'closed-retention-record.json');rows={x['path']:x for x in r['rootFileInventoryWithStableHashes']}
assert len(rows)==r['rootFileCount'] and sum(x['allocatedBytes'] for x in rows.values())==r['rootPhysicalAllocatedBytes']
local=sorted(p for p in O.rglob('*') if p.is_file());held={p.relative_to(O).as_posix() for p in local}
for p in local:
 n=p.relative_to(O).as_posix();raw=p.read_bytes();assert len(raw)==rows[n]['bytes'] and sha(raw)==rows[n]['sha256']
omitted=set(rows)-held
assert all(any(part.endswith('-assets') for part in pathlib.PurePosixPath(n).parts) or n.endswith(('.db','.db-wal','.db-shm')) for n in omitted)
assert not any(p.name.endswith(('.db','.db-wal','.db-shm')) for p in local)
spec=j(O/'proof-input.json');index=j(O/'tooling-source-index.json');review=j(O/'source-review-original.json');approval(review,index)
assert index['head']=='dd14f90814b7994bf06598623dae095b29d04f0b' and review['id']==6203833517
assert spec['head']==CANDIDATE and spec['tree']==TREE and spec['image']==IMAGE and spec['retryAllowed'] is False
assert len(spec['packageHashes'])==42 and rows['proof-input.json']['mode']==0o400
for n,h in spec['packageHashes'].items():assert sha((O/n).read_bytes())==h and rows[n]['mode']==0o400
for n in FILES:assert sha((S/n).read_bytes())==sha((O/n).read_bytes())==index['files'][n]['sha256']
copy_site_guard({n:(O/n).read_bytes() for n in EXPECTED_SITES})
frozen=j(R/'WP/startup-order-readiness-20261015/full-pinned-copy-retention-bound-ordinary-once/source-before.json');assert len(frozen)==1333 and all(sha((R/n).read_bytes())==h for n,h in frozen.items())
# All 686 indexed source originals, their index, and the separate completion chain.
sourceindex=S/'source-publication-index270.json';sourcepub=j(sourceindex);completion=j(S/'source270-publication-completion-index.json')
assert len(sourcepub['files'])==686 and completion['sourceIndexSha256']==sha(sourceindex.read_bytes())
bindings=sourcepub['files']+completion['files']
for p in [sourceindex,S/'source270-publication-completion-index.json']:
 raw=p.read_bytes();bindings.append({'path':p.relative_to(R).as_posix(),'length':len(raw),'sha256':sha(raw),'gitBlobOid':blob(raw)})
assert len(bindings)==690
batch=subprocess.check_output(['git','cat-file','--batch'],cwd=R,input=('\n'.join(x['gitBlobOid'] for x in bindings)+'\n').encode())
at=0
for item in bindings:
 end=batch.index(b'\n',at);oid,kind,length=batch[at:end].decode().split();length=int(length);raw=batch[end+1:end+1+length];at=end+2+length
 assert oid==item['gitBlobOid'] and kind=='blob' and batch[at-1:at]==b'\n' and length==item['length'] and sha(raw)==item['sha256'] and blob(raw)==oid
assert at==len(batch) and git('show',index['head']+':'+sourceindex.relative_to(R).as_posix())==sourceindex.read_bytes()
props=dict(x.split('=',1) for x in r['systemctlOriginal'].splitlines() if '=' in x)
assert props['MainPID']=='0' and props['ActiveState']=='inactive' and props['Result']=='success' and props['ExecMainStatus']=='0'
assert props.get('InvocationID','') in ['', '3eb684645431481ea98912210f972d99']
receipt=j(O/'proof-receipt.json');assert r['originalTerminal']==receipt and r['producerRecordedSuccess'] and r['originalTerminalName']=='proof-receipt.json' and not (O/'proof-terminal-refusal.json').exists()
assert receipt['status']=='FORWARD_TWO_JOBS_OFF_STARTUPS_PASS_FROM_BOUND_INSTALLED209_NOT_RELEASE_QUALIFIED'
assert receipt['head']==CANDIDATE and receipt['tree']==TREE and receipt['image']==IMAGE and receipt['sourceReviewId']==review['id'] and receipt['toolingCommit']==index['head']
assert receipt['qualifiedBuildReceiptSha256']==BUILD_RECEIPT_SHA and receipt['newProductionSnapshots']==receipt['newInstallerOrPolicyCalls']==receipt['productionMutations']==receipt['productionSqliteConnections']==receipt['deployments']==0
for key in ['installed209InputsByHashStatOnly','allOwnedContainersStoppedRetained','allHistoricalStoppedContainersPreserved','rawMasterNeverOpenedSqlite','jobsOnQualificationStillRequired','nonzeroImpactListsNeedYYBeforeGate','exactKitReviewRequired','freshSingleUseGateRequired','neverReplay']:assert receipt[key] is True
assert receipt['releaseKit'] is receipt['gate'] is None and receipt['databaseAssetsCrossFileAtomicityClaimed'] is False
prior=prior_records(O);validate_records(prior);expected_state=prior['prior-installed-209--logical-state.json']
assert len(expected_state['tables'])==112 and expected_state['tables']['_schema_migrations']['count']==42
derived=load_health(O);assert receipt['derivedHealthcheck']==j(O/'derived-healthcheck.json')==derived
expected_events=re.findall(r"event\s*:\s*'([^']+_STARTUP_READY)'",(R/'server/index.js').read_text(encoding='utf-8'));assert len(set(expected_events))==len(expected_events)==26
assert spec['expectedEntrypointVerifiers']==27 and set(spec['expectedReadyEvents'])==set(expected_events)
def objects(text):
 out=[];offset=0;decoder=json.JSONDecoder()
 while offset<len(text):
  pos=text.find('{',offset)
  if pos<0:break
  try:value,end=decoder.raw_decode(text[pos:]);offset=pos+end
  except ValueError:offset=pos+1;continue
  if isinstance(value,dict):out.append(value)
 return out
def exit_ok(label):
 a=j(O/(label+'-exit.json'));assert a['exitCode']==0 and a['error'] is None
startups=[];all_raw_names=set();all_samples=[]
for number in [1,2]:
 label='startup-'+str(number);out=j(O/(label+'-result.json'));assert receipt['startups'][number-1]==out
 attempt=j(O/(label+'-default-entrypoint-attempt.json'));cid=out['id'];assert attempt['id']==cid and attempt['neverRetry'] is True and attempt['jobsEnabled'] is False
 assert out['readinessDeadlineSeconds']==600 and 0<out['timeToFirstHealthySeconds']<600
 assert out['fullInstalledStatePreserved'] is out['stoppedContainerRetained'] is out['jobsOnQualificationStillRequired'] is True
 for suffix in ['start','startup-logs','health','http-probes']:exit_ok(label+'-'+suffix)
 log=((O/(label+'-startup-logs.stdout')).read_bytes()+b'\n'+(O/(label+'-startup-logs.stderr')).read_bytes()).decode('utf-8')
 entry=[v for v in objects(log.split('Starting SoilFER-LIMS...')[0]) if 'totalChanges' in v]
 ready=[v for v in objects(log) if isinstance(v.get('event'),str) and v['event'].endswith('_STARTUP_READY')]
 assert len(entry)==27 and all(v.get('mode')=='NO_OP' and type(v.get('totalChanges')) is int and v['totalChanges']==0 for v in entry)
 assert len(ready)==26 and {v['event'] for v in ready}==set(expected_events) and all(type(v.get('totalChanges')) is int and v['totalChanges']==0 for v in ready)
 assert out['checks']['entrypointVerifiers']==entry and out['checks']['readyEvents']==ready and out['checks']['databaseChanges']==0 and out['checks']['jobsEnabled'] is False
 assert not any(t in log for t in ['FATAL ERROR','Halting startup','Seeding initial','Initializing database schema','[KOBO_SCHEDULER] Triggering'])
 probes=j(O/(label+'-http-probes.stdout'));assert probes==out['httpProbes']==[{'method':'GET','path':'/api/health','status':200},{'method':'GET','path':'/login','status':200},{'method':'POST','path':'/api/v2/sis/receipts','status':401}]
 assert j(O/(label+'-health.stdout'))==out['health'] and out['health']['status']=='ok'
 polls=sorted(O.glob(label+'-health-poll-*.json'));assert len(polls)==out['healthPollCount']==r['healthPollCounts'][str(number)] and [p.name for p in polls]==out['healthPollEvidence']
 previous=None;lastelapsed=0.0;unhealthy=0.0;transitions=[];firsthealthy=None
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
 assert previous=='healthy' and firsthealthy==out['timeToFirstHealthySeconds'] and transitions==out['healthTransitions'] and math.isclose(unhealthy,out['totalUnhealthySeconds'],abs_tol=1e-8)
 assert out['unhealthyTimeMeasurement']=='MONOTONIC_INTERVALS_BETWEEN_OBSERVED_POLLS_NOT_UNOBSERVED_EXACT_DOCKER_TRANSITION_TIME'
 samplepaths=sorted(p for p in O.glob(label+'-memory-*.json') if re.fullmatch(label+'-memory-[0-9]{6}[.]json',p.name))
 assert len(samplepaths)==len(polls)+1==r['memorySampleCounts'][str(number)]<=601
 summaries=[];descriptor=None;evidence=0;maxsum=0;maxpeak=0;sample_times=[]
 for i,p in enumerate(samplepaths,1):
  sample=j(p);assert p.name==label+'-memory-'+str(i).zfill(6)+'.json' and rows[p.name]['mode']==0o400
  identity=sample['identity'];assert identity['id']==cid and identity['owner']==str(ROOT)+':'+label and identity['memory']==identity['memoryAndSwap']==MEMORY and identity['oomKilled'] is False and identity['restarts']==0
  assert type(identity['pid']) is int and identity['pid']>0 and identity['startedAt'];desc={'identity':identity,'cgroup':sample['cgroup']}
  if descriptor is None:descriptor=desc
  assert descriptor==desc and type(sample['cgroup']['inode']) is int and type(sample['cgroup']['device']) is int
  phase='before-stop' if i==len(samplepaths) else 'health-poll';assert sample['phase']==phase
  rawrows=sample['originalKernelReads'];assert len(rawrows)==8
  rawvalues=[]
  for n,row in enumerate(rawrows):
   name=row['path'];assert name not in all_raw_names and pathlib.PurePosixPath(name).name==name and name.startswith(p.stem+'-raw-'+str(n).zfill(2)+'-');all_raw_names.add(name)
   raw=(O/name).read_bytes();assert len(raw)==row['bytes']==rows[name]['bytes'] and sha(raw)==row['sha256']==rows[name]['sha256'] and rows[name]['mode']==0o400
   assert len(raw)<=[4096,256*1024,16384,4096,64,64,64,4096][n];evidence+=rounded(len(raw));rawvalues.append(raw)
   expected_kernel=('/proc/'+str(identity['pid'])+'/cgroup') if n in [0,7] else ('/proc/89211/mountinfo' if n==1 else sample['cgroup']['path']+'/'+mem.RAW_NAMES[n-2])
   assert row['kernelPath']==expected_kernel
  assert rawvalues[0]==rawvalues[7] and mem.cgroup_path(cid,rawvalues[0],rawvalues[1]).as_posix()==sample['cgroup']['path']
  assert mem.pairs(rawvalues[2],mem.STAT_REQUIRED)==sample['memoryStat'] and mem.pairs(rawvalues[3],mem.EVENT_REQUIRED)==sample['memoryEvents']
  assert mem.scalar(rawvalues[4])==sample['memoryPeakBytesObservation'] and mem.scalar(rawvalues[5])==sample['memoryMaxBytes']==MEMORY and mem.scalar(rawvalues[6])==sample['memorySwapMaxBytes']==0
  total=sum(sample['memoryStat'][k] for k in mem.NON_RECLAIMABLE_FIELDS);assert total==mem.gate(sample)<=603979776 and sample['memoryEvents']['oom']==sample['memoryEvents']['oom_kill']==0
  assert sample['nonReclaimableFields']==list(mem.NON_RECLAIMABLE_FIELDS) and sample['nonReclaimableMaximumBytes']==603979776 and sample['peakMaxHighPgscanPgstealAreObservationsOnly'] is True
  evidence+=rounded(len(canonical(sample))+1);maxsum=max(maxsum,total);maxpeak=max(maxpeak,sample['memoryPeakBytesObservation'])
  summaries.append({'path':p.name,'nonReclaimableBytes':total,'memoryPeakBytesObservation':sample['memoryPeakBytesObservation'],'memoryEvents':sample['memoryEvents'],'memoryStat':sample['memoryStat'],'phase':phase});sample_times.append(datetime.datetime.fromisoformat(sample['observedUtc']))
  if i<=len(polls):assert sample_times[-1]>=datetime.datetime.fromisoformat(j(polls[i-1])['observedUtc'])
 assert sample_times==sorted(sample_times)
 m=out['memory'];assert m['hostMemorySamples']==summaries and m['sampledNonReclaimableMaxBytes']==maxsum and m['memoryPeakBytesObservation']==maxpeak and m['maxReadyRssBytes']==max(v['rss_bytes'] for v in ready)
 assert m['memoryMaxBytes']==MEMORY and m['memorySwapMaxBytes']==0 and m['nonReclaimableLimitBytes']==603979776
 for k in ['peakIsObservationNotGate','oomAndOomKillZeroEverySample','hostBeforeStopEventsChecked','samplingIsNotContinuousPeakMeasurement','memoryEvidenceWithinExisting4GiBLogs']:assert m[k] is True
 summary_initial={**m,'sampleAndSummaryAllocatedAllowanceBytes':evidence};evidence+=rounded(len(canonical(summary_initial))+1+128)
 assert evidence==m['sampleAndSummaryAllocatedAllowanceBytes']<=m['memoryEvidenceMaximumBytesPerStartup']==268435456
 seal_dir=label+'-stopped-seal';seal=j(O/seal_dir/'seal.json');state=j(O/seal_dir/'logical-state.json')
 assert state==expected_state and seal['logicalStateSha256']==sha(canonical(state)) and seal['backupSha256']==rows[seal_dir+'/backup.db']['sha256'] and seal['backup']==out['stoppedBackup']==str(ROOT/seal_dir/'backup.db')
 assert seal['rawMasterNeverOpenedSqlite'] and seal['countsIncludeWal'] and seal['productionSnapshotHandoff'] is None
 authority=j(O/seal_dir/'raw/copy-authority.json');assert authority['originalFiles']==seal['originalFiles'] and authority['originalFilesPreserved'] and authority['rawMasterNeverOpenedSqlite']
 for suffix,old in seal['originalFiles'].items():
  target=rows.get(label+'-database/dev.db'+suffix);rawrow=rows.get(seal_dir+'/raw/dev.db'+suffix)
  if old is None:assert target is rawrow is None
  else:assert {k:v for k,v in target.items() if k!='path'}==old and rawrow['sha256']==old['sha256'] and rawrow['bytes']==old['bytes'] and rawrow['mode']==0o400
 # Exact source timing guards ran before stop; UTC here is only an independent loose bound.
 assert (sample_times[-1]-datetime.datetime.fromisoformat(identity['startedAt'].replace('Z','+00:00'))).total_seconds()<600
 startups.append({'id':cid,'entrypointNoopIntegerZeroCount':27,'readyIntegerZeroCount':26,'healthPollCount':len(polls),'memorySampleCount':len(samplepaths),'kernelRawReadCount':len(samplepaths)*8,'firstHealthySeconds':firsthealthy,'observedUnhealthySeconds':unhealthy,'resultElapsedIncludingStoppedSealSeconds':out['elapsedSeconds'],'httpProbes':probes,'sampledNonReclaimableMaxBytes':maxsum,'maxReadyRssBytes':m['maxReadyRssBytes'],'memoryPeakBytesObservation':maxpeak,'evidenceAllowanceBytes':evidence,'cgroupIdentity':descriptor,'fullStopped112Tables42ReceiptsStatePreserved':True})
 all_samples+=samplepaths
assert len(all_raw_names)==sum(x['kernelRawReadCount'] for x in startups) and not list(O.glob('startup-*-memory-*-refusal.json'))
# Original allocation responses, growth and per-stage copy claims; no new measurement.
runtime=j(O/'fresh-r4-before-proof-copies.json');capacity_gate(runtime,'RUNTIME_BIND',0)
assert runtime['observedUtc']=='2026-10-15T22:52:06.299746+00:00' and runtime['requiredBytes']==41768863854
pkg=j(S/'reviewed-package6203833517-publication-once/package-publication-validation.json');assert pkg['futurePackageAllocationBytes']==package_allowance({n:rows[n]['bytes'] for n in list(spec['packageHashes'])+['proof-input.json']})==10219520
launch=S/'proof-launch-workflow-batch-startup-memory-be837974-20261015T233000Z'
for n,phase,future in [('metadata-capacity-before-root-stdout.log','BEFORE_ROOT',10219520),('metadata-capacity-immediately-before-unit-stdout.log','BEFORE_UNIT',0)]:capacity_gate(j(launch/n),phase,future)
measured=j(O/'measured-copy-reserve.json');budget=Budget(measured['databaseTripleAllocationBytes'],measured['assetAllocationBytes']);assert measured['stageTable']==TABLE
before=j(O/'allocation-before.json');previous=before;allocations=[]
for label in ['before','stage-startup-1','stage-startup-2','terminal']:
 value=j(O/('allocation-'+label+'.json'));lines=(O/('allocation-'+label+'-stdout.log')).read_text().splitlines();parsed={}
 for line in lines:size,path=line.split('\t',1);assert path not in parsed;parsed[path]=int(size)
 assert parsed=={p:x['bytes'] for p,x in value['allocations'].items()} and set(parsed)==set(ALLOCATION) and not (O/('allocation-'+label+'-stderr.log')).read_bytes()
 assert value['allRetainedReleaseRootsIncluded'] and value['hardlinksCountedOnce'] and value['duSingleFilesystem'] and value['overlayViewsCreditedBytes']==0 and value['realBackingCountedUnder']=='/var/lib/containerd'
 assert all(value['free'][p]>=value['requiredBytes'] for p in BOUND)
 if label!='before':assert growth(before,value)==value['growth']
 allocations.append(value)
 if label.startswith('stage-'):
  stage=label[6:];intent=j(O/('budget-'+stage+'-intent.json'))
  budget.begin(stage,min(previous['free'].values()))
  assert intent['remainingIncludingStageBytes']==budget.remaining() and intent['minimumDuringStageBytes']==budget.required()
  for site,count in TABLE[budget.completed]['sites'].items():
   for _ in range(count):budget.claim(site)
  physical=max(0,sum(value['allocations'][p]['bytes']-previous['allocations'][p]['bytes'] for p in ALLOCATION));assert budget.finish(stage,physical)==j(O/('budget-'+stage+'-closed.json'))
 previous=value
assert receipt['accounting']==allocations[-1] and budget.completed==2 and budget.remaining()==0 and allocations[-1]['requiredBytes']==FLOOR_BYTES+LOG_BYTES+ADDITIONAL_BYTES
assert j(O/'topology-before.json')==j(O/'topology-after.json')
telemetry=[j(p) for p in sorted(O.glob('memory-budget-check-*.json'))];assert [v['checkpoint'] for v in telemetry]==list(range(1,len(telemetry)+1)) and all(v['actualCountersNotPageCacheDiagnosis'] is True for v in telemetry)
before_cont=r['containerInventoryBeforeSafeSelected'];after=r['containerInventoryAfterSafeSelected'];owned=r['newOwnedContainersStoppedRetained'];assert len(owned)==2 and set(owned)=={x['id'] for x in startups} and set(after)-set(before_cont)==set(owned)
for cid,v in before_cont.items():assert all(v[k]==after[cid][k] for k in ['name','image','labels','running','startedAt']) and mount_objects(v['mounts'])==mount_objects(after[cid]['mounts'])
for cid,v in r['newOwnedRuntimeSafeSelected'].items():
 assert not v['state']['Running'] and not v['state']['OOMKilled'] and v['restartCount']==0 and v['hostConfig']['Memory']==v['hostConfig']['MemorySwap']==MEMORY and v['hostConfig']['NetworkMode']=='none'
 env=v['selectedEnvironment'];assert env['NODE_OPTIONS']=='' and env['DISABLE_BACKGROUND_JOBS']=='true' and env['ALLOW_PRISMA_DB_PUSH']==env['ALLOW_AUTO_SEED']=='false'
 assert all(m['Type']=='bind' and m['Source'].startswith(str(ROOT)+'/') for m in v['mounts']);assert_healthcheck(v['config']['Healthcheck'],derived)
journal=[json.loads(l) for l in r['journalOriginal'].splitlines()];inv='3eb684645431481ea98912210f972d99';assert any(any(x.get(k)==inv for k in ['INVOCATION_ID','_SYSTEMD_INVOCATION_ID']) for x in journal)
messages=[x.get('MESSAGE','') for x in journal];assert any(isinstance(x,str) and 'Deactivated successfully' in x for x in messages)
assert r['boundOldInputRawReaderBackupHashesStatsPreserved'] and r['qualifiedEntireImageUnchanged'] and r['normalPredecessorSelectedDerived']==j(O/'predecessor-before-selected.json')
diag=D/'fresh-closed-diagnostics';buildraw=(diag/'qualified-original-build-receipt.json').read_bytes();image=j(diag/'qualified-fresh-whole-image-inspect.json');qualified(json.loads(buildraw),buildraw,image[0]);assert image==j(O/'qualified-image-inspect-original.json')
result={'status':'CLOSED_TWO_JOBS_OFF_STARTUPS_PASS_INDEPENDENTLY_VALIDATED_NOT_RELEASE_QUALIFIED','validatedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sourceHead':index['head'],'sourceReviewId':review['id'],'root':str(ROOT),'invocation':inv,'terminalUtc':receipt['closedUtc'],'receiptSha256':sha((O/'proof-receipt.json').read_bytes()),'rootFilesHashed':len(rows),'rootFileAllocatedBytesNotWholeStoreAccounting':r['rootPhysicalAllocatedBytes'],'allSmallNonDatabaseNonAssetOriginalsRetained':len(local),'databaseAndAssetFilesRemainOnHostWithHashes':len(omitted),'all43PackageFilesUnchanged':True,'all690SourcePublicationOriginalBindingsVerified':True,'all15ReviewedSourcesAnd1333ApplicationInputsUnchanged':True,'startups':startups,'allMemorySamplesValidated':len(all_samples),'allOriginalKernelReadsValidated':len(all_raw_names),'memorySampledOnlyNotContinuousPeak':True,'controllerLastActivePeakBytesObservationOnly':805310464,'transientGcSystemctlDefaultsNotExecutedLimitsOrMeasuredPeak':props['LoadState']=='not-found','runtimeR4OriginalNotNewMeasurement':runtime,'physicalAccounting':allocations[-1],'historicalContainersPreserved':len(before_cont),'newOwnedStoppedContainersRetained':2,'controllerMemoryTelemetryOriginalCount':len(telemetry),'qualifiedOriginalReceiptAndEntireImageUnchanged':True,'boundOld11242InputsPreservedHashStatNoSql':True,'normalProductionHealthyUnchanged':True,'producerPassed':True,'wholeStartupOnlyProofPassed':True,'releaseQualified':False,'jobsOnQualificationStillRequired':True,'exactKitReviewAndFreshSingleUseGateStillRequired':True,'deployments':0,'retainerSqlConnections':0,'newDuMeasurements':0,'proofRetries':0,'allRawDatabaseWalShmAssetsRemainOnHost':True}
with (D/'independent-closed-validation.json').open('xb') as f:f.write(canonical(result)+b'\n')
print(json.dumps({k:result[k] for k in ['status','validatedUtc','rootFilesHashed','allSmallNonDatabaseNonAssetOriginalsRetained','allMemorySamplesValidated','allOriginalKernelReadsValidated','receiptSha256','historicalContainersPreserved']},ensure_ascii=True))
