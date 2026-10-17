from pathlib import Path
import ast,json
w=Path(__file__).resolve().parents[2];h=w/'WP/backlog-resume-20261013';target=h/'publish-kit-backup-binding547-once.py';assert not target.exists()
s=(h/'publish-kit-backup-main540-paired-count-successor-once.py').read_text(encoding='utf8')
def once(a,b):
 global s
 assert s.count(a)==1,(a,s.count(a));s=s.replace(a,b)
once("with_name('backup-main540-paired-count-successor-publication-notes-once.txt')","with_name('backup-binding547-publication-notes-once.txt')")
once("D=K/'backup-main540-paired-count-successor-publication-once'","D=K/'backup-binding547-publication-once'")
once("=='79e7a34ae37abfe2aa56f22596c1205e8d3c3e80'","=='acc235f7275046062a7b23d95439cc12aa55490c'")
once("runs=['backup-main540-first','backup-main540-second']","runs=['backup-binding547-first']")
once("zip(runs,[1,0],[540,540],[234,234],['FAILED (failures=1)','OK'])","zip(runs,[0],[547],[237],['OK'])")
once('assert len(prior_names)==46',"prior_names.append('backup-main540-paired-count-successor-publication-once/new-local-fixtures-hash-inventory.json')\nassert len(prior_names)==47")
once('backup_main_cases={};backup_main_setups=[]','backup_main_cases={};backup_main_setups=[];backup_binding_cases={}')
once("import sys\nsys.path.insert(0,str(K))", """    if relative.startswith('backup-binding-local-retained-fixtures/') and path.name in ('snapshot-original.json','plan-before-backup.json','python-case-result.json','destination.db'):
     case=backup_binding_cases.setdefault(path.parent.relative_to(K).as_posix(),{})
     case[path.name]={'path':relative,'bytes':len(raw),'sha256':sha(raw),'value':json.loads(raw) if path.name.endswith('.json') else None}
import sys
sys.path.insert(0,str(K))""")
once("assert len(backup_main_rows)==9 and len(backup_main_setups)==5 and len(failed_backup_main_commands)==1 and sum(r['planMatchesCurrentProof'] for r in backup_main_rows)==6",
 "assert len(backup_main_rows)==6*len(runs) and len(backup_main_setups)==3*len(runs) and not failed_backup_main_commands and all(r['planMatchesCurrentProof'] for r in backup_main_rows)")
once("'nativeLocalCommandsIncludingSetup':15,'failedNewFixtureAbortCommands':failed_backup_main_commands,'historicalCompletedCasesUsingEarlierProof':3,'currentProofCompletedCases':6",
 "'nativeLocalCommandsIncludingSetup':9*len(runs),'failedNewFixtureAbortCommands':failed_backup_main_commands,'historicalCompletedCasesUsingEarlierProof':0,'currentProofCompletedCases':len(backup_main_rows)")
once("save(D,'new-local-fixtures-hash-inventory.json'", """binding_rows=[]
from kit_backup_source_binding import replay_backup_charge
for folder,case in sorted(backup_binding_cases.items()):
 if 'python-case-result.json' not in case:continue
 out=case['python-case-result.json'];value=out['value'];observation=case['snapshot-original.json'];plan_original=case['plan-before-backup.json'];plan=plan_original['value']
 replay_backup_charge(plan)
 assert canonical(plan['snapshotOriginal'])==canonical(observation['value']) and plan['snapshotOriginalPin']==original_pin(observation) | {} if False else True
 assert plan['snapshotOriginalPin']=={q:observation[q] for q in ('bytes','sha256')}
 assert value['observedPageSize']==observation['value']['observedPageSize'] and value['observedPageCount']==observation['value']['observedPageCount']
 assert value['backupBytes']==case['destination.db']['bytes']==value['observedPageCount']*value['observedPageSize']
 assert value['sourceOriginalRechecked'] and value['planPrecedesDestinationCreate'] and value['rows']==24 and value['payloadBytes']==24*8192 and value['sourceWalBytes']>32
 assert not value['runtimeBinaryBindingVerified'] and not value['nativePagerOrFileRequestsMeasured'] and not value['physicalFilesystemClosureClaimed']
 assert plan['fullJournalLogicalChargeBytes']==131072 and plan['completeMainAndJournalLayout']['contentBytes']==value['backupBytes']+131072
 assert not plan['destinationActualEqualPageSizeObserved'] and not plan['beforeDestinationCreateHeldAdmissionImplemented']
 binding_rows.append({'folder':folder,'resultOriginal':original_pin(out),'snapshotOriginal':original_pin(observation),'planOriginal':original_pin(plan_original),'destinationOriginal':original_pin(case['destination.db']),
  'pageSizeObserved':value['observedPageSize'],'pageCountObserved':value['observedPageCount'],'pythonEngineVersionObserved':value['collectorEngineVersion'],'backupBytesObserved':value['backupBytes'],
  'combinedLogicalContentBytes':plan['completeMainAndJournalLayout']['contentBytes'],'sourceOriginalRechecked':True,'planPrecedesDestinationCreate':True,'nativePagerOrFileRequestsMeasured':False,
  'runtimeBinaryToSourceBindingVerified':False,'actualOwnerIntegrationImplemented':False,'beforeDestinationCreateHeldAdmissionImplemented':False,'physicalFilesystemClosureClaimed':False})
assert len(binding_rows)==3*len(runs) and {r['pageSizeObserved'] for r in binding_rows}=={512,4096,65536}
save(D,'new-python-backup-source-binding-summary.json',canonical({'pythonParameterCaseExecutions':len(binding_rows),'newNativeNodeFeatureCaseExecutions':0,'pythonEngineVersionsObserved':sorted({r['pythonEngineVersionObserved'] for r in binding_rows}),
 'cases':binding_rows,'sourceBytesReadOnlyFromNewFixtureDelta':True,'snapshotPageMetadataIsCollectorObservationOnly':True,'independentSnapshotToPrivateDbBytesProof':False,'actualPythonWrapperToNativeBindingVerified':False,
 'actualOwnerIntegrationImplemented':False,'beforeDestinationCreateHeldAdmissionImplemented':False,'continuousPeakMeasured':False,'physicalFilesystemClosureClaimed':False})+b'\\n')
save(D,'new-local-fixtures-hash-inventory.json'""")
once(" assert canonical(plan['snapshotOriginal'])==canonical(observation['value']) and plan['snapshotOriginalPin']==original_pin(observation) | {} if False else True",
 " assert canonical(plan['snapshotOriginal'])==canonical(observation['value'])")
once("prior_external=K/'backup-core533-publication-once/new-external-runtime-hash-inventory.json'","prior_external=K/'backup-main540-paired-count-successor-publication-once/new-external-runtime-hash-inventory.json'")
once("'tests':540,'uniqueTests':540,'sourceFiles':234,","'tests':547,'uniqueTests':547,'sourceFiles':237,'futureBackupSnapshotAndCombinedLogicalChargeImplemented':True,'backupBindingSourceFiles':96,'backupBindingNativeExcerpts':123,'backupBindingSourceProofSha256':sha((K/'backup-source-binding-source.json').read_bytes()),'pythonBackupBindingCases':len(binding_rows),'actualOwnerIntegrationImplemented':False,'beforeDestinationCreateHeldAdmissionImplemented':False,")
once("'actualAutomaticWakeObservedUtc':'2026-10-17T12:08:17.053Z'","'actualAutomaticWakeObservedUtc':'2026-10-17T12:36:17.279Z'")
once("'exploratoryMissingGuessedMetadataFilenameTranscribedOnly':False","'exploratoryMissingGuessedMetadataFilenameTranscribedOnly':True")
start=s.index("extras|={p for p in (W/'WP/backlog-resume-20261013/backup-main533-entry-1208-once')")
end=s.index('extras.add(pathlib.Path(__file__).resolve())',start)
s=s[:start]+"""extras|={p for p in (W/'WP/backlog-resume-20261013/backup-binding540-entry-1236-once').iterdir() if p.is_file()}
for name in ('prepare-backup-binding540-entry-once.py','prepare-backup-source-binding-once.py','prepare-backup-binding547-publication-once.py','backup-binding547-publication-notes-once.txt'):
 extras.add(W/'WP/backlog-resume-20261013'/name)
"""+s[end:]
once("'feat(release): derive conditional backup MAIN request extents'","'feat(release): bind future backup snapshot and logical charges'")
ast.parse(s);target.open('x',encoding='utf8',newline='').write(s)
record={'publisherPrepared':str(target),'executed':False,'expectedUniqueTests':547,'expectedSourceFiles':237,'priorInventoriesLoadedBeforePayloadRead':47,'newFeaturePythonCasesExpected':3,'newNativeNodeFeatureCasesExpected':0,'earlierHelpersReadAsPublicSourceOnly':True,'oldPrivatePayloadsRead':False}
(h/'backup-binding540-entry-1236-once/publication-preparation-record.json').open('x',encoding='utf8').write(json.dumps(record,sort_keys=True)+'\n');print(json.dumps(record))
