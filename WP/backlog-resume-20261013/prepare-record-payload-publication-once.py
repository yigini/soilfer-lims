import ast,pathlib,json
h=pathlib.Path('WP/backlog-resume-20261013');s=(h/'publish-kit-ephemeral-btree477-group-once.py').read_text(encoding='utf8')
s=s.replace('ephemeral-btree477-group-publication-notes-once.txt','record-payload484-publication-notes-once.txt')
s=s.replace("D=K/'ephemeral-btree477-group-publication-once'","D=K/'record-payload484-publication-once'")
s=s.replace("=='e765e6c909fee012792bcfe5ee258b9265d46617'","=='63b18e005676f40df4e7d82346cace1f33f65f2e'")
s=s.replace("runs=['ephemeral-btree477-first','ephemeral-btree477-second']","runs=['record-payload484-first']")
s=s.replace("zip(runs,[1,0],[477]*2,[207]*2,['FAILED (failures=1)','OK'])","zip(runs,[0],[484],[210],['OK'])")
s=s.replace("assert len(prior_names)==37","prior_names.append('ephemeral-btree477-group-publication-once/new-local-fixtures-hash-inventory.json')\nassert len(prior_names)==38")
s=s.replace('unix_analogs=[];ephemeral_cases={}','unix_analogs=[];ephemeral_cases={};record_cases={}')
at=s.index('import sys\nsys.path.insert')
body="""   if relative.startswith('record-payload-local-retained-fixtures/'):
    if path.parent.name in ('setup','index') and path.name in ('stdout-original.json','exit-original.json'):
     case=record_cases.setdefault(path.parent.parent.relative_to(K).as_posix(),{})
     case[path.parent.name+'/'+path.name]={'path':relative,'bytes':len(raw),'sha256':sha(raw),'value':json.loads(raw)}
    elif path.name in ('record-profile-original.json','record-plan-before-index.json','source.db'):
     case=record_cases.setdefault(path.parent.relative_to(K).as_posix(),{})
     case[path.name]={'path':relative,'bytes':len(raw),'sha256':sha(raw),'value':json.loads(raw) if path.name.endswith('.json') else raw}
"""
s=s[:at]+body+s[at:]
s=s.replace("assert len(rows)==16 and sum(r['mode']=='rollback' for r in rows)==6","assert len(rows)==8 and sum(r['mode']=='rollback' for r in rows)==3")
s=s.replace("assert len(unix_rows)==len(unix_analogs)==2","assert len(unix_rows)==len(unix_analogs)==1")
s=s.replace("assert len(ephemeral_rows)==10 and sum(r['kind']=='RAW_ORDER_STATUS_RHS' for r in ephemeral_rows)==2","assert len(ephemeral_rows)==7 and sum(r['kind']=='RAW_ORDER_STATUS_RHS' for r in ephemeral_rows)==1")
s=s.replace("assert sum(r['undercountedOriginalPlanRejectedByFirstFullRun'] for r in ephemeral_rows)==1","assert sum(r['undercountedOriginalPlanRejectedByFirstFullRun'] for r in ephemeral_rows)==0")
s=s.replace("'materializationCaseExecutions':8,'rawOrderStatusQueryCaseExecutions':2,'firstFullRunUndercountedFixturePlansRejected':1","'materializationCaseExecutions':6,'rawOrderStatusQueryCaseExecutions':1,'firstFullRunUndercountedFixturePlansRejected':0")
at=s.index("save(D,'new-local-fixtures-hash-inventory.json'")
body="""record_rows=[]
for folder,case in sorted(record_cases.items()):
 if 'index/stdout-original.json' not in case:continue
 setup=case['setup/stdout-original.json']['value'];out=case['index/stdout-original.json'];value=out['value'];profile=case['record-profile-original.json']['value'];plan=case['record-plan-before-index.json']['value']
 assert case['setup/exit-original.json']['value']['exitCode']==case['index/exit-original.json']['value']['exitCode']==0
 assert setup['sourceId']==value['sourceId']=='2026-01-09 17:27:48 b270f8339eb13b504d0b2ba154ebca966b7dde08e40c3ed7d559749818cb2075'
 assert value['rows']==96 and value['platform']=='win32' and not value['linuxVfsTested'] and not value['actualNativeFileCallsMeasured']
 assert plan['bound']['sourceTableRowCount']==96 and plan['completeNativeRecordMappingVerified'] is False and plan['writerGraphAdmissionImplemented'] is False
 cells=payload_sizes(case['source.db']['value'],setup['page'],value['indexRoot']);assert len(cells)==96 and max(cells)<=plan['bound']['maximumFullSerializedRecordBytes']
 record_rows.append({'folder':folder,'stdoutOriginal':{q:out[q] for q in ('path','bytes','sha256')},
  'profileOriginal':{q:case['record-profile-original.json'][q] for q in ('path','bytes','sha256')},
  'planOriginal':{q:case['record-plan-before-index.json'][q] for q in ('path','bytes','sha256')},
  'pageSize':setup['page'],'collectorEngineVersionObserved':profile['collectorEngineVersion'],'collectorEngineSourceIdObserved':profile['collectorEngineSourceId'],
  'nativeVersionObserved':value['version'],'nativeSourceIdObserved':value['sourceId'],'rows':96,'parsedFullIndexPayloadCells':len(cells),
  'maximumObservedFullSerializedIndexPayloadBytes':max(cells),'maximumSourceBoundFullSerializedRecordBytes':plan['bound']['maximumFullSerializedRecordBytes'],
  'profileColumns':profile['tables']['mixed']['columns'],'profileMaximumNativeDataBytesByColumn':profile['tables']['mixed']['maximumNativeDataBytesByColumn'],
  'preSqlCapacityAdmissionVerified':False,'independentPrivateByteProofVerified':False,'captureCollectorIntegrationImplemented':False,
  'linuxVfsTested':False,'actualNativeFileCallsMeasured':False,'continuousPeakMeasured':False,'physicalFilesystemClosureClaimed':False})
assert len(record_rows)==3 and {r['pageSize'] for r in record_rows}=={512,4096,65536}
save(D,'new-native-record-payload-summary.json',canonical({'parameterCases':3,'nativeLocalCommandExecutions':6,'cases':record_rows,
 'parsedFullIndexPayloadCells':sum(r['parsedFullIndexPayloadCells'] for r in record_rows),
 'sourceBytesReadOnlyFromNewFixtureDelta':True,'captureCollectorIntegrationImplemented':False,
 'runtimeBinaryToSourceBindingVerified':False,'actualNativeFileCallsMeasured':False,'continuousPeakMeasured':False,'physicalFilesystemClosureClaimed':False})+b'\\n')
"""
s=s[:at]+body+s[at:]
s=s.replace("prior_external=K/'linux-sorter-vfs470-app-recovery-publication-once/new-external-runtime-hash-inventory.json'","prior_external=K/'ephemeral-btree477-group-publication-once/new-external-runtime-hash-inventory.json'")
s=s.replace("'tests':477,'uniqueTests':477,'sourceFiles':207","'tests':484,'uniqueTests':484,'sourceFiles':210")
s=s.replace("'conditionalEphemeralLogicalContentBoundImplemented':True,","'recordPayloadCollectorSourceImplemented':True,'recordPayloadSourceFiles':62,'recordPayloadNativeExcerpts':10,\n 'recordPayloadSourceProofSha256':sha((K/'record-payload-source.json').read_bytes()),'nativeRecordPayloadCases':len(record_rows),'recordPayloadCollectorCaptureIntegrationImplemented':False,\n 'conditionalEphemeralLogicalContentBoundImplemented':True,")
s=s.replace("'actualAutomaticWakeObservedUtc':'2026-10-17T08:45:15.194Z'","'actualAutomaticWakeObservedUtc':'2026-10-17T09:06:15.481Z'")
s=s.replace("'exploratoryProofFilesKeyAndPrewriteLiteralAssertionDiagnosticsTranscribedOnly':True,'sourcePreparationPolicyRefusedBeforeLaunch':True","'exploratoryMissingGuessedMetadataFilenameTranscribedOnly':True,'sourcePreparationPolicyRefusedBeforeLaunch':False")
start=s.index("extras|={p for p in (W/'WP/backlog-resume-20261013/temp-btree470-entry-0845-once')")
s=s[:start]+"""extras|={p for p in (W/'WP/backlog-resume-20261013/sql-record477-entry-0906-once').iterdir() if p.is_file()}
for name in ['prepare-record-payload-source-once.py','bind-record-profile-flag-before-tests-once.py','prepare-record-payload-publication-once.py','record-payload484-publication-notes-once.txt']:
 extras.add(W/'WP/backlog-resume-20261013'/name)
extras.add(pathlib.Path(__file__).resolve())
print(json.dumps(boundary_publish(D,extras,'feat(release): observe full native record payload bounds',notes)))
"""
ast.parse(s);p=h/'publish-kit-record-payload484-once.py';assert not p.exists();p.write_text(s,encoding='utf8')
p=h/'sql-record477-entry-0906-once/exploratory-read-transcription.json';p.write_text(json.dumps({'scope':'TOOL_OUTPUT_TRANSCRIPTION_ONLY','read':'H/record-payload-source-preparation-record.json','result':'MISSING_FILE','actualRecord':'H/sql-record477-entry-0906-once/source-preparation-record.json','originalDiagnosticFileRetained':False,'sourceOrHostMutation':False,'oldPrivatePayloadsRead':False},sort_keys=True,indent=2),encoding='utf8')
print('New record-payload publisher prepared/AST-checked; not executed. Frozen K unchanged.')