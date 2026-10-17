from pathlib import Path
import ast,json
w=Path(__file__).resolve().parents[2];h=w/'WP/backlog-resume-20261013';target=h/'publish-kit-backup-main540-once.py';assert not target.exists()
s=(h/'publish-kit-backup-core533-once.py').read_text(encoding='utf8')
def once(a,b):
 global s
 assert s.count(a)==1,(a,s.count(a));s=s.replace(a,b)
once("with_name('backup-core533-publication-notes-once.txt')","with_name('backup-main540-publication-notes-once.txt')")
once("D=K/'backup-core533-publication-once'","D=K/'backup-main540-publication-once'")
once("=='96d632efa7270f90f7f7d311beb26c33b4357d3b'","=='79e7a34ae37abfe2aa56f22596c1205e8d3c3e80'")
once("runs=['backup-core533-first']","runs=['backup-main540-first']")
once("zip(runs,[0],[533],[231],['OK'])","zip(runs,[0],[540],[234],['OK'])")
once("assert len(prior_names)==45","prior_names.append('backup-core533-publication-once/new-local-fixtures-hash-inventory.json')\nassert len(prior_names)==46")
once('backup_core_cases={};python_backup_rows=[]','backup_core_cases={};python_backup_rows=[];backup_main_cases={};backup_main_setups=[]')
once("import sys\nsys.path.insert(0,str(K))","""   if relative.startswith('backup-main-local-retained-fixtures/'):
    if path.parent.name in ('commit','abort') and path.name in ('stdout-original.json','exit-original.json','plan-before-backup.json','before-finish-main-original.bin'):
     case=backup_main_cases.setdefault(path.parent.relative_to(K).as_posix(),{})
     case[path.name]={'path':relative,'bytes':len(raw),'sha256':sha(raw),'value':json.loads(raw) if path.name.endswith('.json') else None}
    elif path.parent.name=='setup' and path.name=='stdout-original.json':
     backup_main_setups.append({'path':relative,'bytes':len(raw),'sha256':sha(raw),'value':json.loads(raw)})
import sys
sys.path.insert(0,str(K))""")
summary="""backup_main_rows=[]
for folder,case in sorted(backup_main_cases.items()):
 if 'stdout-original.json' not in case:continue
 out=case['stdout-original.json'];value=out['value'];original=case['plan-before-backup.json'];plan=original['value'];snapshot=case['before-finish-main-original.bin']
 assert case['exit-original.json']['value']['exitCode']==0 and value['sourceId']=='2026-01-09 17:27:48 b270f8339eb13b504d0b2ba154ebca966b7dde08e40c3ed7d559749818cb2075'
 assert value['sourceUnchanged'] and value['page']==plan['declaredEqualPageSize'] and value['pages']==plan['declaredPinnedSourcePageCount']
 maximum=value['page']*value['pages'];assert maximum==plan['conditionalMaximumMainWriteEndBytes']==plan['conditionalMaximumMainSizeHintArgumentBytes']==plan['maximumLogicalMainContentBytes']
 assert 0<snapshot['bytes']==value['beforeFinishBytes']<=maximum and max(r['bytes'] for r in value['samples'])<=maximum and value['zero']['remainingPages']==value['pages']
 assert not value['nativePagerOrFileRequestsMeasured'] and not value['ioFailureInjected'] and value['windowsOnly'] and not value['continuousPeakMeasured']
 if value['mode']=='commit':assert value['finalBytes']==maximum and value['result']=={'n':96,'bytes':96*256*1024} and value['integrity']=='ok' and value['samples'][-1]['remainingPages']==0
 else:assert value['mode']=='abort' and value['finalBytes']==0 and value['samples'][-1]['remainingPages']>0
 assert plan['sameFullMaximumChargedAfterAbandonmentOrRollback'] and not plan['completeDestinationPagerDirtyCallCountDerived'] and not plan['mainFileLengthOrVfsPreallocationBounded'] and not plan['beforeSqlHeldAdmissionImplemented']
 backup_main_rows.append({'folder':folder,'stdoutOriginal':original_pin(out),'planOriginal':original_pin(original),'beforeFinishMainOriginal':original_pin(snapshot),'pageSize':value['page'],'sourcePages':value['pages'],'termination':value['mode'],'fullLogicalAndRequestMaximumBytes':maximum,'beforeFinishBytesObserved':value['beforeFinishBytes'],'finalBytesObserved':value['finalBytes'],'samplePoints':len(value['samples']),'maximumSampledMainLength':max(r['bytes'] for r in value['samples']),'explicitNativeAddonTransferCalls':len(value['samples'])+1,'sourceMainShaUnchanged':True,'nativePagerOrFileRequestsMeasured':False,'nativeIoFailureInjected':False,'fullLifetimeOriginalsRetained':False,'continuousPeakMeasured':False,'physicalFilesystemClosureClaimed':False})
assert len(backup_main_rows)==6*len(runs) and len(backup_main_setups)==3*len(runs)
save(D,'new-native-backup-main-summary.json',canonical({'nativeParameterCaseExecutions':len(backup_main_rows),'nativeLocalCommandsIncludingSetup':9*len(runs),'samplePoints':sum(r['samplePoints'] for r in backup_main_rows),'parsedNativeTransferApiInvocations':sum(r['explicitNativeAddonTransferCalls'] for r in backup_main_rows),'nativeCases':backup_main_rows,'sourceBytesReadOnlyFromNewFixtureDelta':True,'conditionalBackupMainRequestProducerInventoryDerived':True,'completeDestinationPagerDirtyCallCountDerived':False,'nativePagerOrFileRequestsMeasured':False,'nativeIoFailureInjected':False,'memoryErrorClosePathTestedByFaultInjection':False,'runtimeDefaultVfsVerified':False,'mainFileLengthOrVfsPreallocationBounded':False,'beforeSqlHeldAdmissionImplemented':False,'continuousPeakMeasured':False,'physicalFilesystemClosureClaimed':False})+b'\\n')
"""
once("save(D,'new-local-fixtures-hash-inventory.json'",summary+"save(D,'new-local-fixtures-hash-inventory.json'")
once("prior_external=K/'record-profile526-publication-once/new-external-runtime-hash-inventory.json'","prior_external=K/'backup-core533-publication-once/new-external-runtime-hash-inventory.json'")
once("'tests':533,'uniqueTests':533,'sourceFiles':231","'tests':540,'uniqueTests':540,'sourceFiles':234,'conditionalBackupMainRequestProducerInventoryDerived':True,'backupMainSourceFiles':94,'backupMainNativeExcerpts':121,'backupMainRequestLedgerEntries':12,'backupMainSourceProofSha256':sha((K/'backup-main-source.json').read_bytes()),'nativeBackupMainCases':len(backup_main_rows),'completeDestinationPagerDirtyCallCountDerived':False,'mainFileLengthOrVfsPreallocationBounded':False")
once("'actualAutomaticWakeObservedUtc':'2026-10-17T11:53:16.923Z'","'actualAutomaticWakeObservedUtc':'2026-10-17T12:08:17.053Z'")
once("'sourceAggregateTruncationDisclosed':True","'sourceAggregateTruncationDisclosed':False")
once("'exploratoryMissingGuessedMetadataFilenameTranscribedOnly':True","'exploratoryMissingGuessedMetadataFilenameTranscribedOnly':False")
once('WP/backlog-resume-20261013/backup526-entry-1153-once','WP/backlog-resume-20261013/backup-main533-entry-1208-once')
once("for name in ['prepare-backup526-entry-once.py','prepare-backup-core-source-once.py','prepare-backup-core533-publication-once.py','backup-core533-publication-notes-once.txt']:","for name in ['prepare-backup-main533-entry-once.py','prepare-backup-main-source-once.py','prepare-backup-main540-publication-once.py','backup-main540-publication-notes-once.txt']:")
once('feat(release): derive conditional native backup core inventory','feat(release): derive conditional backup MAIN request extents')
ast.parse(s);target.open('x',encoding='utf8',newline='').write(s);print(json.dumps({'publisherPrepared':str(target),'executed':False,'expectedTests':540,'sources':234,'priorInventories':46}))
