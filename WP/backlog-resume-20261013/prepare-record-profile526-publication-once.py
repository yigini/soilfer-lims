from pathlib import Path
import ast,json
w=Path(__file__).resolve().parents[2];h=w/'WP/backlog-resume-20261013';target=h/'publish-kit-record-profile526-once.py';assert not target.exists()
s=(h/'publish-kit-reader-checks519-readonly-successor-once.py').read_text(encoding='utf8')
def once(a,b):
 global s
 assert s.count(a)==1,(a,s.count(a));s=s.replace(a,b)
once("with_name('reader-checks519-readonly-successor-publication-notes-once.txt')","with_name('record-profile526-publication-notes-once.txt')")
once("D=K/'reader-checks519-readonly-successor-publication-once'","D=K/'record-profile526-publication-once'")
once("=='1fc491225a78f8d10c61d801d28d159edbc9a99a'","=='e11d60935a1780dd9667011bfbc4c50f57e8f135'")
once("runs=['reader-checks519-first','reader-checks519-second','reader-checks519-third','reader-checks519-fourth']","runs=['record-profile526-first']")
once("zip(runs,[1,1,1,0],[519]*4,[225]*4,['FAILED (failures=1)']*3+['OK'])","zip(runs,[0],[526],[228],['OK'])")
once("assert len(prior_names)==43","prior_names.append('reader-checks519-readonly-successor-publication-once/new-local-fixtures-hash-inventory.json')\nassert len(prior_names)==44")
once("reader_checks_cases={};check_diagnostics=[]\n","reader_checks_cases={};check_diagnostics=[];record_profile_cases={};python_profile_rows=[]\n")
once("import sys\nsys.path.insert(0,str(K))","""   if relative.startswith('profile-local-retained-fixtures/'):
    if path.parent.name in ('setup','profile') and path.name in ('stdout-original.json','exit-original.json'):
     case=record_profile_cases.setdefault(path.parent.parent.relative_to(K).as_posix(),{})
     case[path.parent.name+'/'+path.name]={'path':relative,'bytes':len(raw),'sha256':sha(raw),'value':json.loads(raw)}
    elif path.name=='profile-plan-before-native-invocation.json':
     case=record_profile_cases.setdefault(path.parent.relative_to(K).as_posix(),{})
     case[path.name]={'path':relative,'bytes':len(raw),'sha256':sha(raw),'value':json.loads(raw)}
    elif path.name=='actual-python-future-profile-original.json':
     python_profile_rows.append({'path':relative,'bytes':len(raw),'sha256':sha(raw),'value':json.loads(raw)})
import sys
sys.path.insert(0,str(K))""")
once("len(check_hazard_rows)==5 and len(failed_check_setups)==1 and len(check_diagnostics)==2","len(check_hazard_rows)==3*len(runs) and len(failed_check_setups)==0 and len(check_diagnostics)==0")
once("'separateNewLocalDiagnosticCommands':2","'separateNewLocalDiagnosticCommands':0")
summary="""record_profile_rows=[]
for folder,case in sorted(record_profile_cases.items()):
 if 'profile/stdout-original.json' not in case:continue
 initial=case['setup/stdout-original.json']['value'];out=case['profile/stdout-original.json'];value=out['value'];original=case['profile-plan-before-native-invocation.json'];plan=original['value']
 assert case['setup/exit-original.json']['value']['exitCode']==case['profile/exit-original.json']['value']['exitCode']==0
 assert initial['newFixtureOnly'] and value['sourceId']=='2026-01-09 17:27:48 b270f8339eb13b504d0b2ba154ebca966b7dde08e40c3ed7d559749818cb2075' and value['tempStore']==2 and value['mainUnchanged']
 assert len(value['cases'])==plan['sqlInvocationCount']==19 and plan['columnAggregateInvocations']==7 and plan['tableXinfoInvocations']==2
 assert [r['sql'] for r in value['cases']]==[r['sql'] for r in plan['queries']]
 assert plan['futureAlreadyPreparedInvocationOnly'] and not plan['beforeInitialReaderSqlAdmissionImplemented'] and not plan['actualBuiltinAndTableInventoryVerified'] and not plan['profileEnvelopeIsPreSqlPhysicalCapacity']
 for row in value['cases']:
  ops=[r['opcode'] for r in row['program']];assert not any(x in ops for x in ('OpenEphemeral','OpenAutoindex','OpenWrite'));assert ops.count('SorterOpen')<=(1 if row['family']=='full-schema' else 0)
  if row['family']=='column-aggregate':assert ops.count('AggStep')==ops.count('AggFinal')==3 and row['rows'][0][0] in (0,4)
 version=next(r['rows'][0][0] for r in value['cases'] if r['sql']=='SELECT sqlite_version()');assert version=='3.51.2'
 record_profile_rows.append({'folder':folder,'stdoutOriginal':original_pin(out),'planOriginal':original_pin(original),'pageSize':initial['page'],'catalogSqlExecutions':19,'columnAggregateSqlExecutions':7,'tableXinfoSqlExecutions':2,'staticAggregateStepSites':sum(r['opcode']=='AggStep' for q in value['cases'] for r in q['program']),'nativeVersionObserved':version,'nativeSourceIdObserved':value['sourceId'],'mainFullShaPreserved':True,'earlierWarmupAndSetupSqlNotAdmitted':True,'actualNativeCallsMeasured':False,'readerSqliteBinaryToPinnedNativeSourceVerified':False,'beforeInitialReaderSqlAdmissionImplemented':False,'continuousPeakMeasured':False,'physicalFilesystemClosureClaimed':False})
assert len(record_profile_rows)==3*len(runs) and len(python_profile_rows)==len(runs)
pyrows=[]
for original in python_profile_rows:
 value=original['value'];plan=value['plan'];assert value['trace']==[r['sql'] for r in plan['queries']] and value['earlierLogicalAndSchemaPrerequisitesNotAdmitted'] and value['traceObserverIsTestOnly'] and not value['actualNoHookProfileVerified'] and not value['readerBinarySourceBindingVerified']
 pyrows.append({'original':original_pin(original),'pythonEngineVersionObserved':value['versionObserved'],'futureProfileCatalogSqlExecutions':len(value['trace']),'declaredTables':len(plan['declaredTables']),'declaredColumnAggregateInvocations':plan['columnAggregateInvocations'],'earlierPrerequisitesNotAdmitted':True,'traceObserverIsTestOnly':True,'actualNoHookProfileVerified':False,'readerBinarySourceBindingVerified':False})
save(D,'new-native-record-profile-scratch-summary.json',canonical({'parameterCaseExecutions':len(record_profile_rows),'nativeLocalCommandExecutions':6*len(runs),'nativeCatalogSqlExecutions':sum(r['catalogSqlExecutions'] for r in record_profile_rows),'nativeColumnAggregateSqlExecutions':sum(r['columnAggregateSqlExecutions'] for r in record_profile_rows),'nativeCases':record_profile_rows,'actualPythonFutureProfileInvocations':len(pyrows),'pythonFutureProfiles':pyrows,'sourceBytesReadOnlyFromNewFixtureDelta':True,'actualBuiltinAndTableInventoryVerified':False,'beforeInitialReaderSqlAdmissionImplemented':False,'backupQueryScratchInventoryComplete':False,'wholeLogicalReaderSqlScratchInventoryComplete':False,'actualNativeCallsMeasured':False,'continuousPeakMeasured':False,'physicalFilesystemClosureClaimed':False})+b'\\n')
"""
once("save(D,'new-local-fixtures-hash-inventory.json'",summary+"save(D,'new-local-fixtures-hash-inventory.json'")
once("prior_external=K/'reader-init512-pragma-state-publication-once/new-external-runtime-hash-inventory.json'","prior_external=K/'reader-checks519-readonly-successor-publication-once/new-external-runtime-hash-inventory.json'")
once("'tests':519,'uniqueTests':519,'sourceFiles':225","'tests':526,'uniqueTests':526,'sourceFiles':228,'conditionalFutureRecordProfileSqlCatalogDerived':True,'recordProfileScratchSourceFiles':89,'recordProfileScratchNativeExcerpts':87,'recordProfileScratchCallerFunctions':5,'recordProfileScratchSourceProofSha256':sha((K/'record-profile-scratch-source.json').read_bytes()),'nativeRecordProfileCatalogCases':len(record_profile_rows),'actualBuiltinAndTableInventoryVerified':False,'initialReaderSqlAdmissionImplemented':False")
once("'actualAutomaticWakeObservedUtc':'2026-10-17T11:00:46.462Z'","'actualAutomaticWakeObservedUtc':'2026-10-17T11:39:16.794Z'")
once("'sourceAggregateTruncationDisclosed':True","'sourceAggregateTruncationDisclosed':False")
once("'exploratoryCp1252OutputRefusalTranscribedOnly':False","'exploratoryCp1252OutputRefusalTranscribedOnly':True")
once("WP/backlog-resume-20261013/reader-checks512-entry-1100-once","WP/backlog-resume-20261013/reader-profile519-entry-1139-once")
start=s.index("for name in ['prepare-reader-pragma-checks-source-once.py'");end=s.index('\n extras.add',start)
s=s[:start]+"for name in ['prepare-reader-profile519-entry-once.py','prepare-record-profile-scratch-source-once.py','prepare-record-profile526-publication-once.py','record-profile526-publication-notes-once.txt']:"+s[end:]
once('feat(release): derive restricted reader pragma scratch bodies','feat(release): derive future record profile SQL scratch catalog')
ast.parse(s);target.write_text(s,encoding='utf8',newline='');print(json.dumps({'publisherPrepared':str(target),'executed':False,'expectedTests':526,'sources':228,'priorInventories':44}))
