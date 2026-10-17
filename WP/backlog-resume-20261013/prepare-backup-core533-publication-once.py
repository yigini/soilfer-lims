from pathlib import Path
import ast,json
w=Path(__file__).resolve().parents[2];h=w/'WP/backlog-resume-20261013';target=h/'publish-kit-backup-core533-once.py';assert not target.exists()
s=(h/'publish-kit-record-profile526-once.py').read_text(encoding='utf8')
def once(a,b):
 global s
 assert s.count(a)==1,(a,s.count(a));s=s.replace(a,b)
once("with_name('record-profile526-publication-notes-once.txt')","with_name('backup-core533-publication-notes-once.txt')")
once("D=K/'record-profile526-publication-once'","D=K/'backup-core533-publication-once'")
once("=='e11d60935a1780dd9667011bfbc4c50f57e8f135'","=='96d632efa7270f90f7f7d311beb26c33b4357d3b'")
once("runs=['record-profile526-first']","runs=['backup-core533-first']")
once("zip(runs,[0],[526],[228],['OK'])","zip(runs,[0],[533],[231],['OK'])")
once("assert len(prior_names)==44","prior_names.append('record-profile526-publication-once/new-local-fixtures-hash-inventory.json')\nassert len(prior_names)==45")
once('record_profile_cases={};python_profile_rows=[]','record_profile_cases={};python_profile_rows=[];backup_core_cases={};python_backup_rows=[]')
once("import sys\nsys.path.insert(0,str(K))","""   if relative.startswith('backup-core-local-retained-fixtures/'):
    if path.parent.name in ('setup','core') and path.name in ('stdout-original.json','exit-original.json'):
     case=backup_core_cases.setdefault(path.parent.parent.relative_to(K).as_posix(),{})
     case[path.parent.name+'/'+path.name]={'path':relative,'bytes':len(raw),'sha256':sha(raw),'value':json.loads(raw)}
    elif path.name=='plan-before-core.json':
     case=backup_core_cases.setdefault(path.parent.relative_to(K).as_posix(),{})
     case[path.name]={'path':relative,'bytes':len(raw),'sha256':sha(raw),'value':json.loads(raw)}
    elif path.name=='python-backup-original.json':
     python_backup_rows.append({'path':relative,'bytes':len(raw),'sha256':sha(raw),'value':json.loads(raw)})
import sys
sys.path.insert(0,str(K))""")
summary="""backup_rows=[]
for folder,case in sorted(backup_core_cases.items()):
 if 'core/stdout-original.json' not in case:continue
 out=case['core/stdout-original.json'];value=out['value'];initial=case['setup/stdout-original.json']['value'];original=case['plan-before-core.json'];plan=original['value']
 assert case['setup/exit-original.json']['value']['exitCode']==case['core/exit-original.json']['value']['exitCode']==0
 assert value['sourceId']=='2026-01-09 17:27:48 b270f8339eb13b504d0b2ba154ebca966b7dde08e40c3ed7d559749818cb2075' and value['sourceUnchanged'] and value['integrity']=='ok'
 assert initial['pages']==value['pages']==plan['declaredPinnedSourcePageCount'] and initial['page']==value['page']==plan['declaredEqualPageSize']
 assert value['zero']['remainingPages']==value['pages'] and len(value['steps'])+1==plan['maximumSuccessfulStepCalls'] and value['steps'][-1]['remainingPages']==0
 assert value['destinationBytes']==value['pages']*value['page'] and value['abandonedBytes']==0 and value['abandonZero']['remainingPages']==value['pages']
 assert value['result']=={'n':96,'bytes':96*8192} and not value['actualNativePagerCallsMeasured'] and value['windowsOnly']
 assert not plan['directCopyCountIsCompleteDirtyOrFileWriteInventory'] and not plan['beforeSqlHeldAdmissionImplemented']
 backup_rows.append({'folder':folder,'stdoutOriginal':original_pin(out),'planOriginal':original_pin(original),'pageSize':value['page'],'declaredSourcePages':value['pages'],'explicitNativeAddonTransferCalls':1+len(value['steps']),'independentAbandonedZeroStepBackupHandles':1,'zeroStepInitializesWriteTransactionSourceDerivedNotMeasured':True,'directPagerOrFileCallsMeasured':False,'sourceMainShaUnchanged':True,'destinationBytesObserved':value['destinationBytes'],'abandonedFinalBytesObserved':value['abandonedBytes'],'fullScientificCallerTested':False,'runtimeDefaultVfsVerified':False,'physicalFilesystemClosureClaimed':False})
assert len(backup_rows)==3*len(runs) and len(python_backup_rows)==3*len(runs)
python_backup_summary=[]
for original in python_backup_rows:
 value=original['value'];plan=value['plan'];assert value['sourceMainWalUnchanged'] and value['initialSetupAndSourceSqlOutsideCore'] and value['testOnlyProgressObserver'] and not value['pythonWrapperSourceBindingVerified'] and not value['nativePagerCallsMeasured']
 assert value['pageCount']==plan['declaredPinnedSourcePageCount'] and value['pageSize']==plan['declaredEqualPageSize']
 assert value['progress'][-1]==[101,0,value['pageCount']]
 python_backup_summary.append({'original':original_pin(original),'pythonEngineVersionObserved':value['versionObserved'],'pageSize':value['pageSize'],'declaredPinnedSourcePages':value['pageCount'],'progressCallbackObservations':len(value['progress']),'sourceMainWalShaUnchanged':True,'pagesArgument':256,'sleepArgument':0.05,'testOnlyProgressObserver':True,'nativePagerCallsMeasured':False,'pythonWrapperSourceBindingVerified':False,'beforeSqlHeldAdmissionImplemented':False})
save(D,'new-native-backup-core-summary.json',canonical({'nativeParameterCaseExecutions':len(backup_rows),'nativeLocalCommandsIncludingSetup':6*len(runs),'explicitNativeAddonTransferCalls':sum(r['explicitNativeAddonTransferCalls'] for r in backup_rows)+len(backup_rows),'independentAbandonedBackupHandles':len(backup_rows),'pythonParameterCaseExecutions':len(python_backup_summary),'nativeCases':backup_rows,'pythonCases':python_backup_summary,'sourceBytesReadOnlyFromNewFixtureDelta':True,'directCopyCountsAreCompletePagerInventory':False,'actualPythonWrapperToNativeBindingVerified':False,'wholeBackupCallerScratchInventoryComplete':False,'beforeSqlHeldAdmissionImplemented':False,'continuousPeakMeasured':False,'physicalFilesystemClosureClaimed':False})+b'\\n')
"""
once("save(D,'new-local-fixtures-hash-inventory.json'",summary+"save(D,'new-local-fixtures-hash-inventory.json'")
once("prior_external=K/'reader-checks519-readonly-successor-publication-once/new-external-runtime-hash-inventory.json'","prior_external=K/'record-profile526-publication-once/new-external-runtime-hash-inventory.json'")
once("'tests':526,'uniqueTests':526,'sourceFiles':228","'tests':533,'uniqueTests':533,'sourceFiles':231,'conditionalPinnedNativeBackupCoreInventoryDerived':True,'backupCoreSourceFiles':92,'backupCoreNativeExcerpts':103,'backupCoreCallerFunctions':6,'backupCoreSourceProofSha256':sha((K/'backup-core-source.json').read_bytes()),'nativeBackupCoreCases':len(backup_rows),'pythonBackupCases':len(python_backup_summary),'completeDestinationPagerDirtyInventoryDerived':False,'wholeBackupCallerScratchInventoryComplete':False")
once("'actualAutomaticWakeObservedUtc':'2026-10-17T11:39:16.794Z'","'actualAutomaticWakeObservedUtc':'2026-10-17T11:53:16.923Z'")
once("'sourceAggregateTruncationDisclosed':False","'sourceAggregateTruncationDisclosed':True")
once("'exploratoryMissingGuessedMetadataFilenameTranscribedOnly':False","'exploratoryMissingGuessedMetadataFilenameTranscribedOnly':True")
once("'exploratoryCp1252OutputRefusalTranscribedOnly':True","'exploratoryCp1252OutputRefusalTranscribedOnly':False")
once('WP/backlog-resume-20261013/reader-profile519-entry-1139-once','WP/backlog-resume-20261013/backup526-entry-1153-once')
once("for name in ['prepare-reader-profile519-entry-once.py','prepare-record-profile-scratch-source-once.py','prepare-record-profile526-publication-once.py','record-profile526-publication-notes-once.txt']:","for name in ['prepare-backup526-entry-once.py','prepare-backup-core-source-once.py','prepare-backup-core533-publication-once.py','backup-core533-publication-notes-once.txt']:")
once('feat(release): derive future record profile SQL scratch catalog','feat(release): derive conditional native backup core inventory')
ast.parse(s);target.open('x',encoding='utf8',newline='').write(s);print(json.dumps({'publisherPrepared':str(target),'executed':False,'expectedTests':533,'sources':231,'priorInventories':45}))
