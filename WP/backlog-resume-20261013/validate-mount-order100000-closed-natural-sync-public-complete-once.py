"""Validate retained natural scheduler observations and public preservation evidence only; no SQL/network."""
import pathlib,sys,json,re,datetime,collections,hashlib
w=pathlib.Path(__file__).resolve().parents[2];b=w/'WP/batch-proof-mount-order-forward-be837974-20261016';d=b/'mount-order100000-closed-originals-once';o=d/'remote-originals';sys.path.insert(0,str(b))
from proof_contract import canonical,sha
from runtime_proof_policies import TARGET_CONFIG,TARGET_LAB,TARGET_PROJECT,completed_syncs,scheduler_refusals,intake_summary,require_final_observation,utc_seconds

def j(n):return json.loads((o/n).read_bytes())
def exit_ok(n):
 v=j(n+'-exit.json');assert type(v['exitCode']) is int and v['exitCode']==0 and v['error'] is None
core=json.loads((d/'independent-startup-memory-accounting-validation.json').read_bytes());assert core['allHealthPollsValidated']==668 and core['allMemorySamplesValidated']==810 and core['allOriginalKernelReadsValidated']==6480
ret=json.loads((d/'closed-retention-record.json').read_bytes());rows={r['path']:r for r in ret['rootFileInventoryWithStableHashes']};on=j('startup-2-result.json');off=j('startup-1-result.json');bound=j('scheduler-bound-configs.json');configs=bound['activeConfigsWithoutSecrets'];expected=bound['expectedRefusals'];interval=bound['copySyncIntervalMins']
assert bound['cursorIntervalTimestampOverrides']==0 and len(expected)==4 and len(configs)==11 and configs[TARGET_CONFIG]['labId']==TARGET_LAB and configs[TARGET_CONFIG]['projectCode']==TARGET_PROJECT and interval==15
observations=[j(p.name) for p in sorted(o.glob('natural-observation-*.json'))];assert len(observations)==on['observationCount']==76
all_log_files=[]
for number,v in enumerate(observations,1):
 label='startup-2-watch-logs-'+str(number);stdout=(o/(label+'.stdout')).read_bytes();stderr=(o/(label+'.stderr')).read_bytes();exit_ok(label);exit_ok('startup-2-watch-http-'+str(number));assert j('startup-2-watch-http-'+str(number)+'.stdout')==off['readiness']['httpProbes'];assert b'[KOBO_SCHEDULER] Initial sync error' not in stdout+stderr
 completions=completed_syncs(stdout.decode('utf-8'));refusals=scheduler_refusals(stdout.decode('utf-8'),stderr.decode('utf-8'),expected)
 assert v['healthy'] is True and v['observedCompletions']==completions and v['observedRefusals']==refusals
 assert all(c['labId']==TARGET_LAB and type(c['newSamples']) is int and type(c['skipped']) is int for c in completions)
 assert len(completions)<=2 and v['monotonicElapsedSeconds']>=on['readiness']['readinessElapsedSeconds']
 all_log_files += [label+'.stdout',label+'.stderr']
assert all(utc_seconds(a['utc'])<=utc_seconds(z['utc']) and a['monotonicElapsedSeconds']<=z['monotonicElapsedSeconds'] for a,z in zip(observations,observations[1:]))
last=observations[-1];assert len(last['observedCompletions'])==2 and last['observedCompletions']==[on['firstScheduledSync'],on['secondScheduledSync']]
first,second=last['observedCompletions'];assert first['newSamples']==193 and first['skipped']==23 and second['newSamples']==second['skipped']==0
require_final_observation(first,second,on['readiness']['readyUtc'],on['naturalObservationEndUtc'],interval,0,None,utc_seconds(on['naturalObservationEndUtc'])-utc_seconds(on['readiness']['readyUtc']))
assert first['epochSeconds']-utc_seconds(on['readiness']['readyUtc'])<600
refused_counts=collections.Counter(v['configId'] for v in last['observedRefusals']);assert set(refused_counts)=={v['configId'] for v in expected} and all(n==2 for n in refused_counts.values())
fetches=[j(n) for n in ['upstream-before-start.json','upstream-first-completion.json','upstream-second-completion.json']]
for fetch in fetches:
 assert set(fetch)==set(configs)
 for cid,v in fetch.items():
  assert v['configId']==cid and v['labId']==configs[cid]['labId'] and v['projectCode']==configs[cid]['projectCode'] and v['since']==configs[cid]['lastSubmissionId'] and re.fullmatch('[a-f0-9]{64}',v['sourceIdentitySha256']) and 0<len(v['pages'])<=100
  ids=[]
  for index,page in enumerate(v['pages']):
   assert page['start']==index*1000 and type(page['count']) is int and page['count']==len(page['submissionIds'])<=1000 and 0<page['bytes']<=33554432 and re.fullmatch('[a-f0-9]{64}',page['payloadSha256']);ids+=page['submissionIds']
  assert len(ids)==len(set(ids)) and sorted(ids,key=int)==v['submissionIds'] and all(x.isdigit() and int(x)>int(v['since'] or 0) for x in ids) and utc_seconds(v['completedUtc'])>=utc_seconds(v['startedUtc'])
for cid in configs:assert len({f[cid]['sourceIdentitySha256'] for f in fetches})==1
states=[j(n) for n in ['first-sync-preservation.json','second-sync-preservation.json','full-intake-preservation.json']];baseline=j('startup-1-stopped-seal/logical-state.json');final=j('jobs-on-stopped-seal/logical-state.json');changed_tables={'Sample','SampleHold','AuditLog','Notification','KoboConfig'}
for index,state in enumerate(states):
 assert state['protectedTableCount']==112 and state['schemaPreserved'] is True and state['allOriginalRowsPreservedExceptExactProvenance'] is True and state['integrity']=='ok' and state['foreignKeyViolations']==0 and state['allAddedHoldAuditRowsExactlyConsumed'] is True and set(state['tables'])==set(baseline['tables'])
 assert state['scopeCommentIds']==[6112209155,6112305172] and state['protectedRefusalConfigIds']==sorted(refused_counts) and state['copySyncIntervalMins']=={cid:15 for cid in configs}
 wanted_fetch=fetches[1 if index==0 else 2];assert state['retainedUpstreamFetchIds']=={cid:v['submissionIds'] for cid,v in wanted_fetch.items()}
 for table,record in state['tables'].items():
  if table not in changed_tables:
   assert record['before']==record['after'] and record['before']=={k:v for k,v in baseline['tables'][table].items() if k!='columns'} and final['tables'][table]==baseline['tables'][table]
  else:
   assert record['preserved'] is True and re.fullmatch('[a-f0-9]{64}',record['originalSha256'])
   assert record['originalCount']==(baseline['tables'][table]['count']+(len(states[0]['additions'].get(table,[])) if index==1 else 0))
   if index!=1:assert record['originalSha256']==baseline['tables'][table]['sha256']
 for table,added in state['additions'].items():assert len({v['id'] for v in added})==len(added) and all(set(v)=={'id','sha256'} and re.fullmatch('[a-f0-9]{64}',v['sha256']) for v in added)
 for change in state['configChanges']:assert change['id'] in configs and change['id'] not in refused_counts and set(change['fields'])<={'lastSyncAt','updatedAt','lastSubmissionId'} and re.fullmatch('[a-f0-9]{64}',change['beforeHmacSha256']) and re.fullmatch('[a-f0-9]{64}',change['afterHmacSha256'])
 counts=state['newSampleCount'];assert set(counts)==set(configs)-set(refused_counts) and sum(counts.values())==len(state['additions']['Sample'])
 for cid,n in counts.items():
  pairs=state['newSamplePairs'][cid];assert n==len(pairs)==sum(state['newSampleDepthSplit'][cid].values()) and len({(p['kobo_id'],p['depth']) for p in pairs})==n
  assert set(state['newSubmissionIds'][cid])=={str(p['kobo_id']) for p in pairs} and all(str(p['kobo_id']) in wanted_fetch[cid]['submissionIds'] for p in pairs)
  if index==1:assert all(str(p['kobo_id']) not in fetches[1][cid]['submissionIds'] and int(p['kobo_id'])>max(map(int,fetches[1][cid]['submissionIds']),default=0) for p in pairs)
 for report in state['changedSamples']+state['sameSyncNewSampleConflictReports']:
  assert report['classification']=='CROSS_SUBMISSION_DUPLICATE' and report['columns']==['metadata','rejectionReason','updatedAt'] and report['statusBeforeExpectedCount']==report['statusAfterExpectedCount']==1 and report['statusBeforeSha256']==report['statusAfterSha256']
  assert report['fieldMetadataDiff']=={'arrays':[],'changes':[],'everyOldValueRetained':True} and report['metadataDiff']['everyOldValueRetained'] is True and report['oldValuesOutsideWriterRetainedCount']==1 and report['appendedCount']==report['rejectionAfterExactCount']==1
  pair=report['pairing'];assert pair['classification']=='EXACT_PROVENANCE_PAIRS' and pair['conflictAuditCount']==pair['holdAuditCount']==pair['holdCount']==1
  assert set(pair['holdIds'])<={v['id'] for v in state['additions']['SampleHold']} and set(pair['conflictAuditIds']+pair['holdAuditIds'])<={v['id'] for v in state['additions']['AuditLog']}
  assert report['configIds']==[TARGET_CONFIG] and set(report['conflictSubmissionIds'])<=set(wanted_fetch[TARGET_CONFIG]['submissionIds'])
a,z,full=states;assert {t:len(v) for t,v in a['additions'].items()}=={'Sample':193,'SampleHold':23,'AuditLog':239,'Notification':1} and all(not v for v in z['additions'].values()) and a['additions']==full['additions'] and len(a['changedSamples'])==len(full['changedSamples'])==20 and a['changedSamples']==full['changedSamples'] and not z['changedSamples']
assert not any(v['sameSyncNewSampleConflictReports'] for v in states) and z['allOriginalRowsPreserved'] is True
for table in ['Sample','SampleHold','AuditLog','Notification']:assert final['tables'][table]['count']==baseline['tables'][table]['count']+len(full['additions'][table]) and a['tables'][table]['originalCount']==baseline['tables'][table]['count'] and z['tables'][table]['originalSha256']==final['tables'][table]['sha256']
assert final['tables']['KoboConfig']['count']==baseline['tables']['KoboConfig']['count']
assert a['notificationExpectations']==full['notificationExpectations']==[{'configId':TARGET_CONFIG,'count':193,'userId':'user-mgr-zmb'}] and z['notificationExpectations']==[]
assert len(a['additions']['AuditLog'])==193+2*23 and len({i for q in a['changedSamples'] for i in q['pairing']['holdIds']})==20
assert intake_summary(a,first)==on['firstIntake'] and intake_summary(z,second)==on['secondIntake']
for k in ['originalConfigsCursorsIntervalsAndClocksNotOverridden','all112TablesOriginalRowsExceptExactProvenanceSchemaAnd42ReceiptsPreserved','onlyEnumeratedNaturalIntakeChanges','secondNaturalConflictIdempotenceVerified','stoppedContainerRetained','exactKitAndFreshSingleUseGateStillRequired']:assert on[k] is True
hook=json.loads((b/'closed-hook-streams-host-only-analysis-once/stdout-original.json').read_bytes());assert hook['allExactTwoOwnersStoppedRetained'] is True and hook['newDockerCalls']==hook['sqlConnections']==hook['privateHmacKeysRead']==hook['privateStreamBytesFetched']==0
result={'status':'CLOSED_MOUNT_ORDER100000_NATURAL_SYNC_PUBLIC_EVIDENCE_INDEPENDENTLY_VALIDATED','validatedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'firstScheduledSync':first,'secondScheduledSync':second,'firstIntake':on['firstIntake'],'secondIntake':on['secondIntake'],'observationsValidated':len(observations),'originalIntervalMinutes':interval,'observedHealthySeconds':utc_seconds(on['naturalObservationEndUtc'])-utc_seconds(on['readiness']['readyUtc']),'naturalObservationEndUtc':on['naturalObservationEndUtc'],'allFourRefusalPairsEachTwice':dict(refused_counts),'firstAddedRows':{k:len(v) for k,v in a['additions'].items()},'secondAddedRows':{k:len(v) for k,v in z['additions'].items()},'oldChangedSampleExactProvenancePairs':20,'newSameSyncCrossConflictReports':0,'reportedSkippedIsLogDescriptionNotAllHoldCount':True,'finalTableCount':112,'schemaReceiptCount':42,'all107OtherTablesExactFullStatePreserved':True,'allAddedIdsHashesConservedFirstToFull':True,'secondAllRowsPreservedNoAddedRows':True,'retainedFetchRecordsValidated':3,'rowValueAndNewHoldAuditPredicatesComputedByFrozenReviewedRuntime':True,'privateRowHmacNotIndependentlyRecomputedByRetainer':True,'noSqlReplay':True,'privateKeysNeverReadOrFetched':True,'sixOriginalHookCallsHostOnlyIndependentlyVerified':True,'coreValidationSha256':sha((d/'independent-startup-memory-accounting-validation.json').read_bytes()),'wholeProofClosureValidated':True,'exactKitReviewAndFreshSingleUseGateStillRequired':True,'releaseQualified':False,'deployments':0}
with (d/'independent-natural-sync-validation.json').open('xb') as f:f.write(canonical(result)+b'\n')
print(json.dumps(result))
