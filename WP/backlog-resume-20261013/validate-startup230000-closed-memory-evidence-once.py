"""Independently validate closed retained bytes, health, startup signals and limits. No host calls."""
import collections,datetime,hashlib,json,pathlib,subprocess,sys
REPO=pathlib.Path(__file__).resolve().parents[2];SOURCE=REPO/'WP/batch-proof-startup-be837974-20261015'
DEST=SOURCE/'proof230000-closed-memory-originals-once';ORIG=DEST/'remote-originals'
sys.path.insert(0,str(SOURCE))
from proof_contract import canonical,sha,approval,FILES,ROOT,IMAGE,MEMORY
from proof_budget import capacity_gate,Budget,TABLE
from proof_docker import mount_objects
r=json.loads((DEST/'closed-retention-record.json').read_bytes());rows={x['path']:x for x in r['rootFileInventoryWithStableHashes']}
assert len(rows)==r['rootFileCount']==1867 and sum(x['allocatedBytes'] for x in rows.values())==r['rootPhysicalAllocatedBytes']==3399839744
local=list(p for p in ORIG.rglob('*') if p.is_file())
for p in local:
 n=p.relative_to(ORIG).as_posix();raw=p.read_bytes();assert len(raw)==rows[n]['bytes'] and sha(raw)==rows[n]['sha256']
omitted=set(rows)-{p.relative_to(ORIG).as_posix() for p in local}
assert all(any(part.endswith('-assets') for part in pathlib.PurePosixPath(n).parts) or n.endswith(('.db','.db-wal','.db-shm')) for n in omitted)
assert not any(p.name.endswith(('.db','.db-wal','.db-shm')) for p in local)
spec=json.loads((ORIG/'proof-input.json').read_bytes());index=json.loads((ORIG/'tooling-source-index.json').read_bytes());review=json.loads((ORIG/'source-review-original.json').read_bytes())
approval(review,index);assert index['head']=='29fa000751f25447f1ff8c129b0dfcc5d2b67445' and review['id']==6203010192
assert len(spec['packageHashes'])==41
for n,h in spec['packageHashes'].items():assert sha((ORIG/n).read_bytes())==h and rows[n]['mode']==0o400
assert rows['proof-input.json']['mode']==0o400
for n in FILES:assert sha((SOURCE/n).read_bytes())==sha((ORIG/n).read_bytes())==index['files'][n]['sha256']
frozen=json.loads((REPO/'WP/startup-order-readiness-20261015/full-pinned-copy-retention-bound-ordinary-once/source-before.json').read_bytes());assert len(frozen)==1333
assert all(sha((REPO/n).read_bytes())==h for n,h in frozen.items())
sourcepub=json.loads((SOURCE/'source-publication-index.json').read_bytes());bindings=sourcepub['files'];assert len(bindings)==629
oids=[x['gitBlobOid'] for x in bindings]
batch=subprocess.check_output(['git','cat-file','--batch'],cwd=REPO,input=('\n'.join(oids)+'\n').encode());at=0
for item,oid in zip(bindings,oids):
 end=batch.index(b'\n',at);got,kind,length=batch[at:end].decode().split();length=int(length);raw=batch[end+1:end+1+length];at=end+2+length
 assert got==oid and kind=='blob' and batch[at-1:at]==b'\n' and length==item['length'] and sha(raw)==item['sha256'] and hashlib.sha1(('blob '+str(length)+'\0').encode()+raw).hexdigest()==oid
assert at==len(batch)
pubraw=subprocess.check_output(['git','show',index['head']+':WP/batch-proof-startup-be837974-20261015/source-publication-index.json'],cwd=REPO);assert pubraw==(SOURCE/'source-publication-index.json').read_bytes()
props=dict(x.split('=',1) for x in r['systemctlOriginal'].splitlines());assert props['ActiveState']=='failed' and props['Result']=='exit-code' and props['ExecMainStatus']=='1' and props['MainPID']=='0' and props['InvocationID']=='b962da09082d4fb49c8b9076181b7f4c'
assert props['MemoryMax']==str(MEMORY) and props['MemorySwapMax']=='0' and props['RuntimeMaxUSec']=='1h 30min'
assert r['originalRefusal']['error']=='RuntimeError: Startup memory STOP' and r['originalRefusal']['ownedStopError'] is None
peakraw=(ORIG/'startup-1-peak.stdout').read_bytes();assert peakraw==b'805314560\n';peak=int(peakraw);assert peak-MEMORY==8192
for label in ['startup-1-start','startup-1-startup-logs','startup-1-health','startup-1-http-probes','startup-1-peak']:
 result=json.loads((ORIG/(label+'-exit.json')).read_bytes());assert result['exitCode']==0 and result['error'] is None
assert not (ORIG/'startup-1-peak.stderr').read_bytes()
probes=json.loads((ORIG/'startup-1-http-probes.stdout').read_bytes());assert probes==[{'path':'/api/health','method':'GET','status':200},{'path':'/login','method':'GET','status':200},{'path':'/api/v2/sis/receipts','method':'POST','status':401}]
log=(ORIG/'startup-1-startup-logs.stdout').read_text(encoding='utf-8');decoder=json.JSONDecoder()
def objects(text):
 out=[];offset=0
 while offset<len(text):
  pos=text.find('{',offset)
  if pos<0:break
  try:value,end=decoder.raw_decode(text[pos:]);offset=pos+end
  except ValueError:offset=pos+1;continue
  if isinstance(value,dict):out.append(value)
 return out
entry=[v for v in objects(log.split('Starting SoilFER-LIMS...')[0]) if 'totalChanges' in v];ready=[v for v in objects(log) if isinstance(v.get('event'),str) and v['event'].endswith('_STARTUP_READY')]
assert len(entry)==spec['expectedEntrypointVerifiers']==27 and all(v.get('mode')=='NO_OP' and type(v.get('totalChanges')) is int and v['totalChanges']==0 for v in entry)
assert len(ready)==26 and {v['event'] for v in ready}==set(spec['expectedReadyEvents']) and all(type(v.get('totalChanges')) is int and v['totalChanges']==0 for v in ready)
assert not any(t in log for t in ['FATAL ERROR','Halting startup','Seeding initial','Initializing database schema','[KOBO_SCHEDULER] Triggering'])
pollpaths=sorted(ORIG.glob('startup-1-health-poll-*.json'));assert len(pollpaths)==372 and not list(ORIG.glob('startup-2-health-poll-*.json'))
polls=[json.loads(p.read_bytes()) for p in pollpaths];derived=json.loads((ORIG/'derived-healthcheck.json').read_bytes())
previous=None;lastelapsed=-1;transitions=[]
for number,(p,v) in enumerate(zip(pollpaths,polls),1):
 assert p.name=='startup-1-health-poll-'+str(number).zfill(6)+'.json' and rows[p.name]['mode']==0o400
 assert v['elapsedSeconds']>=lastelapsed and v['elapsedSeconds']<=600 and v['previousStatus']==previous and v['transition']==(previous!=v['status']) and v['healthcheck']==polls[0]['healthcheck']
 assert v['state']['Health']['Status']==v['status']
 if v['transition']:transitions.append({k:v[k] for k in ['observedUtc','elapsedSeconds','previousStatus','status','unhealthySecondsObservedSoFar']})
 previous=v['status'];lastelapsed=v['elapsedSeconds']
assert [v['status'] for v in transitions]==['starting','unhealthy','healthy'] and polls[-1]['status']=='healthy'
assert polls[-1]['elapsedSeconds']==392.9904243249998
budget=json.loads((ORIG/'measured-copy-reserve.json').read_bytes());runtime=json.loads((ORIG/'fresh-r4-before-proof-copies.json').read_bytes());capacity_gate(runtime,'RUNTIME_BIND',0)
assert runtime['requiredBytes']==41768863854 and runtime['observedUtc']=='2026-10-15T21:56:06.227379+00:00'
for n,phase,future in [('metadata-capacity-before-root-stdout.log','BEFORE_ROOT',10137600),('metadata-capacity-immediately-before-unit-stdout.log','BEFORE_UNIT',0)]:
 p=SOURCE/'proof-launch-workflow-batch-startup-be837974-20261015T230000Z'/n
 assert p.exists();capacity_gate(json.loads(p.read_bytes()),phase,future)
telemetry=[json.loads(p.read_bytes()) for p in sorted(ORIG.glob('memory-budget-check-*.json'))];assert len(telemetry)==905
assert [v['checkpoint'] for v in telemetry]==list(range(1,906))
assert all(v['actualCountersNotPageCacheDiagnosis'] is True for v in telemetry)
before=r['containerInventoryBeforeSafeSelected'];after=r['containerInventoryAfterSafeSelected'];owned=r['newOwnedContainersStoppedRetained'];assert len(before)==76 and len(owned)==1 and set(after)-set(before)==set(owned)
for id,v in before.items():assert all(v[k]==after[id][k] for k in ['name','image','labels','running','startedAt']) and mount_objects(v['mounts'])==mount_objects(after[id]['mounts'])
v=next(iter(r['newOwnedRuntimeSafeSelected'].values()));assert not v['state']['Running'] and not v['state']['OOMKilled'] and v['state']['ExitCode']==137 and v['restartCount']==0
assert v['hostConfig']['Memory']==v['hostConfig']['MemorySwap']==MEMORY and v['hostConfig']['NetworkMode']=='none' and v['selectedEnvironment']['NODE_OPTIONS']=='' and v['selectedEnvironment']['DISABLE_BACKGROUND_JOBS']=='true'
assert all(m['Source'].startswith(str(ROOT)+'/') and m['Type']=='bind' for m in v['mounts'])
assert all(not (ORIG/n).exists() for n in ['proof-receipt.json','startup-1-result.json','startup-2-result.json','budget-startup-1-closed.json','budget-startup-2-closed.json','startup-2-default-entrypoint-attempt.json'])
journal=[json.loads(l) for l in r['journalOriginal'].splitlines()];messages=[x.get('MESSAGE') for x in journal];assert any(isinstance(x,str) and 'RuntimeError: Startup memory STOP' in x for x in messages)
assert any(x.get('_SYSTEMD_INVOCATION_ID')==props['InvocationID'] for x in journal)
assert r['boundOldInputRawReaderBackupHashesStatsPreserved'] and r['qualifiedEntireImageUnchanged'] and r['normalPredecessorSelectedDerived']['health']=='healthy'
allocations=collections.Counter()
for n,x in rows.items():allocations[n.split('/')[0]]+=x['allocatedBytes']
result={'status':'CLOSED_FAILED_STARTUP_MEMORY_GUARD_INDEPENDENTLY_VALIDATED_NOT_RELEASE_QUALIFIED','validatedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sourceHead':index['head'],'sourceReviewId':review['id'],'root':str(ROOT),'invocation':props['InvocationID'],'terminalUtc':r['originalRefusal']['closedUtc'],'rootFilesHashed':len(rows),'all42PackageFilesUnchanged':True,'all629SourcePublicationOriginalsPlusIndexVerified':True,'all14ReviewedSourcesAnd1333ApplicationInputsUnchanged':True,'allSmallNonDatabaseNonAssetOriginalsRetained':len(local),'excludedDatabaseAndAssetFilesRetainedOnHostWithHashes':len(omitted),'firstStartupEntrypointNoOpZeroCount':len(entry),'firstStartupReadyZeroCount':len(ready),'httpProbes':probes,'startup1HealthPolls':len(polls),'startup2HealthPolls':0,'fullHealthTransitions':transitions,'lastHealthyElapsedSeconds':polls[-1]['elapsedSeconds'],'observedUnhealthyIntervalSeconds':polls[-1]['unhealthySecondsObservedSoFar'],'unhealthyIntervalInterpretation':'MONOTONIC_OBSERVED_POLL_INTERVALS_NOT_EXACT_UNOBSERVED_TRANSITION_TIME','appOriginalCgroupPeakBytes':peak,'appMemoryLimitBytes':MEMORY,'exactLimitExcessBytes':peak-MEMORY,'controllerPeakBytesSeparatelyObserved':int(props['MemoryPeak']),'oomKilled':False,'ownedStoppedContainerExitCode':137,'ownedStopError':None,'historicalContainersPreserved':len(before),'ownedStoppedContainersRetained':len(owned),'newStartup1FullStoppedLogicalSealObserved':False,'newWholeProofTerminalAccountingObserved':False,'secondStartupAttempted':False,'wholeProofPassed':False,'runtimeR4OriginalNotNewMeasurement':runtime,'rootFileAllocatedBytes':r['rootPhysicalAllocatedBytes'],'largestRootFileAllocationGroups':allocations.most_common(6),'freshClosedFreeBytesObservationOnlyNotFutureFit':r['currentFreeBytes'],'controllerMemoryTelemetryOriginalCount':len(telemetry),'terminalJournalEntryCount':len(journal),'boundOld11242InputsPreservedHashStatNoSql':True,'qualifiedBuildOriginalReceiptAndEntireImageUnchanged':True,'normalProductionHealthyUnchanged':True,'allRawDatabaseWalShmAssetsRemainOnHost':True,'retainerSqlConnections':0,'newDuMeasurements':0,'proofRetries':0,'forwardRecovery':'SEPARATELY_AUDITED_FORWARD_FIX_ONLY','memoryOrDeadlineRelaxationAuthorized':False}
with (DEST/'independent-closed-validation.json').open('xb') as f:f.write(canonical(result)+b'\n')
print(json.dumps({k:result[k] for k in ['status','rootFilesHashed','allSmallNonDatabaseNonAssetOriginalsRetained','firstStartupEntrypointNoOpZeroCount','firstStartupReadyZeroCount','appOriginalCgroupPeakBytes','exactLimitExcessBytes','lastHealthyElapsedSeconds','largestRootFileAllocationGroups']},ensure_ascii=True))
