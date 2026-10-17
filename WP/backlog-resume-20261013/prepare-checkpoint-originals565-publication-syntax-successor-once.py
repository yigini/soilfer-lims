from pathlib import Path
import ast,json,hashlib
h=Path(__file__).resolve().parent;out=h/'publish-kit-checkpoint-originals565-once.py';assert not out.exists()
s=(h/'publish-kit-checkpoint-requests563-once.py').read_text(encoding='utf8')
def replace(a,b):
 global s
 assert s.count(a)==1,(a,s.count(a));s=s.replace(a,b)
replace("NOTES=pathlib.Path(__file__).with_name('checkpoint-requests563-publication-notes-once.txt')","NOTES=pathlib.Path(__file__).with_name('checkpoint-originals565-publication-notes-once.txt')")
replace("D=K/'checkpoint-requests563-publication-once'","D=K/'checkpoint-originals565-publication-once'")
replace("=='f11766da5436b0bfe31008cffede07f9313986b3'","=='0817c479c4ac3b94b41192b8736b2fd4e136e0cd'")
replace("runs=['checkpoint-requests563-first']","runs=['checkpoint-originals565-first']")
replace("zip(runs,[0],[563],[243],['OK'])","zip(runs,[0],[565],[243],['OK'])")
replace('assert len(prior_names)==50',"prior_names.append('checkpoint-requests563-publication-once/new-local-fixtures-hash-inventory.json')\nassert len(prior_names)==51")
replace('header_cases={};checkpoint_synthetic=[]','header_cases={};checkpoint_synthetic=[];checkpoint_native_cases={};checkpoint_package_cases={}')
selector="""   if relative.startswith('checkpoint-requests-local-retained-fixtures/'):
    if path.parent.name in ('native-setup','native-checkpoint') and path.name in ('stdout-original.json','exit-original.json','stderr-original.txt','program-original.cjs.txt','argv-original.json','main-before-checkpoint-original.bin','main-after-checkpoint-original.bin'):
     case=checkpoint_native_cases.setdefault(path.parent.parent.relative_to(K).as_posix(),{})
     case[path.parent.name+'/'+path.name]={'path':relative,'bytes':len(raw),'sha256':sha(raw),'value':json.loads(raw) if path.name.endswith('.json') else raw}
    elif path.parent.name=='originals' and path.name in ('dev.db','dev.db-wal','dev.db-shm'):
     case=checkpoint_native_cases.setdefault(path.parent.parent.relative_to(K).as_posix(),{})
     case['originals/'+path.name]={'path':relative,'bytes':len(raw),'sha256':sha(raw),'value':raw}
    elif path.name in ('native-checkpoint-case.json','complete-plan-before-native-checkpoint.json'):
     case=checkpoint_native_cases.setdefault(path.parent.relative_to(K).as_posix(),{})
     case[path.name]={'path':relative,'bytes':len(raw),'sha256':sha(raw),'value':json.loads(raw)}
    elif path.name in ('retained-package-result.json','complete-original-plan.json','wal-original.bin','index-original.bin'):
     case=checkpoint_package_cases.setdefault(path.parent.relative_to(K).as_posix(),{})
     case[path.name]={'path':relative,'bytes':len(raw),'sha256':sha(raw),'value':json.loads(raw) if path.name.endswith('.json') else raw}
"""
replace("   if relative.startswith('checkpoint-requests-local-retained-fixtures/') and path.name=='synthetic-original-replay-cases.json':",selector+"   if relative.startswith('checkpoint-requests-local-retained-fixtures/') and path.name=='synthetic-original-replay-cases.json':")
summary="""from kit_checkpoint_requests import replay_original
checkpoint_native_rows=[];checkpoint_package_rows=[]
for folder,case in sorted(checkpoint_native_cases.items()):
 if 'native-checkpoint-case.json' not in case:continue
 out=case['native-checkpoint-case.json'];value=out['value'];setup=case['native-setup/stdout-original.json']['value'];result=case['native-checkpoint/stdout-original.json']['value'];original=case['complete-plan-before-native-checkpoint.json'];plan=original['value'];replay_original(plan)
 assert case['native-setup/exit-original.json']['value']['exitCode']==case['native-checkpoint/exit-original.json']['value']['exitCode']==0 and case['native-setup/stderr-original.txt']['bytes']==case['native-checkpoint/stderr-original.txt']['bytes']==0
 assert setup['sourceId']==result['sourceId']=='2026-01-09 17:27:48 b270f8339eb13b504d0b2ba154ebca966b7dde08e40c3ed7d559749818cb2075' and setup['integrity']==result['integrity']=='ok'
 p=value['page'];d=value['headPages'];f=value['headFrames'];rows=256 if p==512 else 64
 assert setup['page']==p and setup['pages']==d and setup['rows']==value['rows']==rows and setup['data']==result['data']=={'n':rows,'bytes':rows*8192}
 assert plan['checkpointPlan']['declaredCheckpointHeadPages']==d and plan['checkpointPlan']['declaredCheckpointHeadFrames']==f and plan['checkpointPlan']['nativeDeclaration']['mode']=='PASSIVE'
 assert result['before']==setup['pins']==value['sourceOriginalPins'] and result['result']==value['checkpointSqlResult']==[{'busy':0,'log':f,'checkpointed':f}]
 for suffix in ('','-wal','-shm'):
  pin=case['originals/dev.db'+suffix];assert {q:pin[q] for q in ('bytes','sha256')}==setup['pins'][suffix]
 assert bytes.fromhex(plan['walOriginalHex'])==case['originals/dev.db-wal']['value'] and bytes.fromhex(plan['indexOriginalHex'])==case['originals/dev.db-shm']['value']
 assert case['native-checkpoint/main-before-checkpoint-original.bin']['value']==case['originals/dev.db']['value']
 assert result['afterCheckpointMainBytes']==result['finalMainBytes']==value['afterCheckpointMainBytes']==value['finalMainBytes']==d*p==case['native-checkpoint/main-after-checkpoint-original.bin']['bytes']
 assert case['originals/dev.db']['bytes']+65536+f*p>=d*p and original['sha256']==value['planSha256']
 assert value['fullMainWalIndexOriginalsRetained'] and value['fullPlanPrecedesCandidateWriter'] and value['wholeOriginalPackageReplayWithoutSql'] and value['constructorVerificationSqlAndFinalCloseOutsideOneApiPlan']
 assert not value['actualEntryAndHeadSourceAssociationVerified'] and not value['nativeCheckpointCallsOrReturnCodesMeasured'] and not value['nativeFileCallsMeasured'] and not value['runtimeBinaryToSourceBindingVerified'] and not value['continuousPeakMeasured'] and not value['physicalFilesystemClosureClaimed']
 if p==512:assert plan['fullFreshIndexByteObservation']['regions']>1
 checkpoint_native_rows.append({'folder':folder,'resultOriginal':original_pin(out),'setupStdoutOriginal':original_pin(case['native-setup/stdout-original.json']),'checkpointStdoutOriginal':original_pin(case['native-checkpoint/stdout-original.json']),'planOriginal':original_pin(original),'fullMainOriginal':original_pin(case['originals/dev.db']),'fullWalOriginal':original_pin(case['originals/dev.db-wal']),'fullIndexOriginal':original_pin(case['originals/dev.db-shm']),'beforeMainOriginal':original_pin(case['native-checkpoint/main-before-checkpoint-original.bin']),'afterMainOriginal':original_pin(case['native-checkpoint/main-after-checkpoint-original.bin']),'pageSize':p,'headPages':d,'headFrames':f,'indexRegions':plan['fullFreshIndexByteObservation']['regions'],'rows':rows,'payloadBytes':rows*8192,'checkpointPragmaResultObserved':result['result'],'completeOriginalsAndPlanIndependentlyRetained':True,'planPrecedesCandidateWriter':True,'wholePackageReplayWithoutSql':True,'constructorAndFinalCloseOutsideOneApiPlan':True,'internalRecoveryPathSourceDerivedNotInstrumented':True,'actualEntryAndHeadSourceAssociationVerified':False,'nativeCheckpointCallsOrReturnCodesMeasured':False,'runtimeBinaryToSourceBindingVerified':False,'continuousPeakMeasured':False,'physicalFilesystemClosureClaimed':False})
for folder,case in sorted(checkpoint_package_cases.items()):
 if 'retained-package-result.json' not in case:continue
 out=case['retained-package-result.json'];value=out['value'];original=case['complete-original-plan.json'];plan=original['value'];replay_original(plan)
 assert original['bytes']==value['planBytes'] and original['sha256']==value['planSha256'] and value['kind']=='NEW_RETAINED_SYNTHETIC_ORIGINAL_PACKAGE'
 assert bytes.fromhex(plan['walOriginalHex'])==case['wal-original.bin']['value'] and bytes.fromhex(plan['indexOriginalHex'])==case['index-original.bin']['value']
 assert value['completeWalIndexPlanFilesRetained'] and value['wholeOriginalReplayWithoutSql'] and not value['actualMainSourceAssociationVerified'] and not value['nativeCheckpointExecuted'] and not value['physicalFilesystemClosureClaimed']
 checkpoint_package_rows.append({'folder':folder,'resultOriginal':original_pin(out),'planOriginal':original_pin(original),'walOriginal':original_pin(case['wal-original.bin']),'indexOriginal':original_pin(case['index-original.bin']),'syntheticOnly':True,'wholeOriginalReplayWithoutSql':True,'actualMainSourceAssociationVerified':False,'nativeCheckpointExecuted':False,'physicalFilesystemClosureClaimed':False})
assert len(checkpoint_native_rows)==3*len(runs) and len(checkpoint_package_rows)==len(runs) and {r['pageSize'] for r in checkpoint_native_rows}=={512,4096,65536}
save(D,'new-local-checkpoint-originals-summary.json',canonical({'newNativeParameterCases':len(checkpoint_native_rows),'newFeatureNodeCommandsIncludingSetup':6*len(runs),'newRetainedSyntheticPackageCases':len(checkpoint_package_rows),'newTestMethods':2,'nativeCases':checkpoint_native_rows,'retainedSyntheticPackages':checkpoint_package_rows,'sourceBytesReadOnlyFromNewFixtureDelta':True,'previousFourSyntheticCasesNotRelabeledAsRetainedNativeOriginals':True,'actualNativeCheckpointCallsOrReturnCodesMeasured':False,'nativeFileCallsMeasured':False,'internalRecoveryPathSourceDerivedNotInstrumented':True,'actualEntryAndHeadSourceAssociationVerified':False,'runtimeBinaryToSourceBindingVerified':False,'beforeSqlHeldAdmissionImplemented':False,'writerGraphAdmissionImplemented':False,'continuousPeakMeasured':False,'physicalFilesystemClosureClaimed':False})+b'\\n')
"""
replace("save(D,'new-local-fixtures-hash-inventory.json'",summary+"save(D,'new-local-fixtures-hash-inventory.json'")
replace("prior_external=K/'header-normalization556-publication-once/new-external-runtime-hash-inventory.json'","prior_external=K/'checkpoint-requests563-publication-once/new-external-runtime-hash-inventory.json'")
replace("'tests':563,'uniqueTests':563,'sourceFiles':243,","'tests':565,'uniqueTests':565,'sourceFiles':243,'checkpointOriginalRetentionNativeFixtureTestMethodsAdded':2,'newLocalCheckpointOriginalNativeCases':len(checkpoint_native_rows),'newLocalCheckpointOriginalNodeCommandsIncludingSetup':6*len(runs),'newRetainedSyntheticPackageCases':len(checkpoint_package_rows),'operationalModulesProofsAndGeneratedHooksUnchanged':True,'hooksRebuiltOrExecutedThisBoundary':False,")
replace("'checkpointRequestOriginalReplayIsInMemoryOnly':True","'fourBaselineSyntheticCasesOriginalReplayIsInMemoryOnly':True")
replace("'actualAutomaticWakeObservedUtc':'2026-10-17T13:48:17.987Z'","'actualAutomaticWakeObservedUtc':'2026-10-17T14:03:48.149Z'")
replace("(W/'WP/backlog-resume-20261013/checkpoint-requests556-entry-1348-once').iterdir()","(W/'WP/backlog-resume-20261013/checkpoint-originals563-entry-1403-once').iterdir()")
replace("for name in ('prepare-checkpoint-requests556-entry-once.py','prepare-checkpoint-requests-source-once.py','prepare-checkpoint-requests563-publication-once.py','checkpoint-requests563-publication-notes-once.txt'):","for name in ('prepare-checkpoint-originals563-entry-once.py','prepare-checkpoint-originals-test-source-review-once.py','prepare-checkpoint-originals565-publication-once.py','prepare-checkpoint-originals565-publication-syntax-successor-once.py','checkpoint-originals565-publication-notes-once.txt'):")
replace("'test(release): bound one native checkpoint request profile'","'test(release): retain checkpoint head originals and package replay'")
ast.parse(s);assert selector in s
out.open('x',encoding='utf8',newline='').write(s)
record={'publisher':out.name,'bytes':len(s.encode()),'sha256':hashlib.sha256(s.encode()).hexdigest(),'priorPrivateInventories':51,'expectedClosedRunExitCodes':[0],'expectedUniqueTests':565,'expectedSources':243,'newNativeCases':3,'newNodeCommandsIncludingSetup':6,'newRetainedSyntheticPackageCases':1,'newSelectorsAreSiblingPrefixes':True,'publisherExecuted':False}
(h/'checkpoint-originals563-entry-1403-once/publication-preparation-record.json').open('x',encoding='utf8').write(json.dumps(record,sort_keys=True)+'\n');print(json.dumps(record))
