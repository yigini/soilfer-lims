from pathlib import Path
import ast,json,hashlib,subprocess
w=Path(__file__).resolve().parents[2];k=w/'WP/batch-release-kit-be837974-20261016';h=w/'WP/backlog-resume-20261013';entry=h/'backup-caller547-entry-1254-once'
assert subprocess.check_output(['git','rev-parse','HEAD'],cwd=w,text=True).strip()=='d5233af14d0969b5d2a5f9ccbed7273a51586300'
sha=lambda b:hashlib.sha256(b).hexdigest()
base=json.loads((k/'backup-source-binding-source.json').read_bytes());files=dict(base['files'])
for n in ('backup-source-binding-source.json','verify_kit_live_backup.py'):
 p=k/n;b=p.read_bytes();files[p.relative_to(w).as_posix()]={'bytes':len(b),'sha256':sha(b)}
for n,pin in files.items():
 b=(w/n).read_bytes();assert len(b)==pin['bytes'] and sha(b)==pin['sha256']
raw=(w/base['nativeSource']['path']).read_bytes();assert sha(raw)==base['nativeSource']['sha256'];lines=raw.splitlines(keepends=True);off=[0]
for line in lines:off.append(off[-1]+len(line))
ranges=[]
for label,first,last in [('destination_page_size_attempt',84092,84100),('zeroed_backup_counters',84124,84194),('busy_and_destination_lock_before_progress',84298,84388),('progress_update_only_ok',84384,84404),('finish_rollback_and_return_status',84555,84602)]:
 b=raw[off[first-1]:off[last]];ranges.append({'label':label,'firstLine':first,'lastLine':last,'startByte':off[first-1],'endByte':off[last],'bytes':len(b),'sha256':sha(b),'text':b.decode()})
callers=[]
for name in ('live_backup.cjs','retained_files.py'):
 p=k/name;b=p.read_bytes()
 if name.endswith('.py'):
  n=next(n for n in ast.parse(b).body if isinstance(n,ast.FunctionDef) and n.name=='seal');ls=b.splitlines(keepends=True);a=sum(map(len,ls[:n.lineno-1]));z=sum(map(len,ls[:n.end_lineno]));part=b[a:z]
 else:a=0;z=len(b);part=b
 callers.append({'path':p.relative_to(w).as_posix(),'startByte':a,'endByte':z,'bytes':len(part),'sha256':sha(part),'text':part.decode()})
for name in ('lib/methods/backup.js','src/objects/backup.cpp'):
 p=w/'server/node_modules/better-sqlite3'/name;b=p.read_bytes();callers.append({'path':p.relative_to(w).as_posix(),'startByte':0,'endByte':len(b),'bytes':len(b),'sha256':sha(b),'text':b.decode()})
review={'version':1,'scope':'ACTUAL_BACKUP_CALLER_SOURCE_PROFILE_COMPATIBILITY_REVIEW_ONLY','files':files,'priorSnapshotSourceProofSha256':sha((k/'backup-source-binding-source.json').read_bytes()),'nativeSource':base['nativeSource'],'nativeExcerpts':ranges,'completeCallerExcerpts':callers,
 'orderingSourceFacts':[
  'Node validates whole MAIN+131072 journal admission before source open, and native N*P<=held MAIN before exclusive empty destination creation. Descriptor is held through await backup. Source BEGIN/schema COUNT precedes sizing and backup; source ROLLBACK/close follows in finally. This is conditional SOURCE ordering, not observed held physical capacity or initial-reader admission.',
  'Python seal pins page_count/page_size before exclusive output creation. Current admit_copy sizes list is ONLY[N*P], not the future547 combined MAIN+131072 plan. Destination MEMORY request occurs before and after before.backup(pages256,sleep0.05), followed by destination/source closes and later detached logical SQL. Full source pins do not turn that current call into combined admission or close post-backup normalization/reader SQL.'
 ],
 'incompatibleOrUnobservedConditions':[
  {'condition':'onlyOkThenDoneNoBusyLockedRetryOrErrorContinuation','nodeSourceMatch':False,'reason':'Pinned addon transfer returns identical status-free progress objects for OK/DONE/BUSY. Actual JS reschedules nonzero remaining progress, without observing native rc. Initial zero counters can be returned after pre-copy BUSY; JS treats remainingPages0 as completion, closes and resolves before callback. Final owned exact-length guard remains required and refuses incomplete zero output.'},
  {'condition':'noSourceBackupUpdateOrRestartCallbacks','nodeSourceActuallyEnforcesFromProgress':False,'reason':'JS does not require monotonic remainingPages or stable totalPages; equal/increasing counters are accepted. A held source read transaction and native conditions may exclude updates/restarts, but progress object alone is not that proof.'},
  {'condition':'sourceAndDestinationPageSizesActuallyEqual','nodeSourceAttemptIsObservation':False,'reason':'setDestPgsz attempts BtreeSetPageSize. backup_step only propagates SQLITE_NOMEM from this call, then separately reads actual source/destination sizes and contains mismatched-page handling. A setter attempt is not actual equal-page-size attestation.'},
  {'condition':'successfulFinishAndCloseStatusObserved','nodeSourceMatch':False,'reason':'CloseHandles ignores sqlite3_backup_finish return. sqlite3_close status is asserted/discarded, not returned in progress. Retained final output checks do not constitute independently measured native finish/rollback status.'},
  {'condition':'completeMainAndJournalChargeBeforeDestinationCreate','pythonSourceMatch':False,'reason':'Actual Python seal currently admits only N*P in its backup copy layout. Future547 combined charge is not called by this owner.'},
  {'condition':'exactPythonWrapperAndNativeBinarySourceBuildBinding','pythonSourceMatch':False,'reason':'Python backup wrapper/source/build and production loaded SQLite binary are not pinned/attested; local Python3.49.1 observations do not bind C3.51.2b270 semantics.'}
 ],
 'fixturePlan':{'newUniqueMethods':2,'newLocalChildCommandsExpected':2,'scriptedActualJsBoundaryTranscripts':4,'actualForeignDestinationLockParameterCases':3,'pages':[512,4096,65536],'foreignLockIntentionallyViolatesNoOtherUsersProfile':True,'nativeReturnCodesMeasured':False,'noActualOwnerOrOperationalSourceChange':True},
 'nativeBusyZeroCounterPathSourceDerived':True,'actualOwnerStrictNoBusyOrRestartProfileVerified':False,'actualOwnerCombinedAdmissionIntegrated':False,'sourceSnapshotAndEqualPageSizeRuntimeVerified':False,'actualNativeReturnCodesMeasured':False,'actualPythonWrapperToNativeBindingVerified':False,'beforeInitialReaderSqlAdmissionImplemented':False,'writerGraphAdmissionImplemented':False,'physicalFilesystemClosureClaimed':False}
assert len(files)==98 and len(ranges)==5 and len(callers)==4
(entry/'caller-source-profile-review.json').open('x',encoding='utf8').write(json.dumps(review,sort_keys=True,separators=(',',':'))+'\n')
record={'sourceReviewSha256':sha((entry/'caller-source-profile-review.json').read_bytes()),'fullSourceFiles':len(files),'exactNativeExcerpts':len(ranges),'completeCallerExcerpts':len(callers),'productionSourcesChanged':False,'newTestMethods':2,'uniqueFullSuiteExpected':549,'topLevelSourcesExpected':237,'testSourceTokenSpacingCorrectedBeforeFreeze':True,'hooksUnchangedAndNotExecuted':True}
(entry/'source-preparation-record.json').open('x',encoding='utf8').write(json.dumps(record,sort_keys=True)+'\n');print(json.dumps(record))
