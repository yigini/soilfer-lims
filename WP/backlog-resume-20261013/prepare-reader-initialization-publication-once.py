from pathlib import Path
import ast
h=Path(__file__).resolve().parent;p=h/'publish-kit-reader-init512-once.py';assert not p.exists()
s=(h/'publish-kit-reader-schema505-constant-successor-once.py').read_text(encoding='utf8')
changes=[('reader-schema505-constant-successor-publication-notes-once.txt','reader-init512-publication-notes-once.txt'),("D=K/'reader-schema505-constant-successor-publication-once'","D=K/'reader-init512-publication-once'"),('aaf2de9370b300095a5c41e2f3d30fe9c9d43acf','584ef7f07070e03607adc06d7ef7739d529c590c'),("runs=['reader-schema505-first','reader-schema505-second']","runs=['reader-init512-first']"),("zip(runs,[1,0],[505,505],[219,219],['FAILED (failures=1)','OK'])","zip(runs,[0],[512],[222],['OK'])"),("assert len(prior_names)==41","prior_names.append('reader-schema505-constant-successor-publication-once/new-local-fixtures-hash-inventory.json')\nassert len(prior_names)==42"),("reader_schema_cases={};memory_probes=[]","reader_schema_cases={};memory_probes=[];reader_init_cases={}"),("prior_external=K/'fingerprint-sorter498-publication-once/new-external-runtime-hash-inventory.json'","prior_external=K/'reader-schema505-constant-successor-publication-once/new-external-runtime-hash-inventory.json'"),("'tests':505,'uniqueTests':505,'sourceFiles':219","'tests':512,'uniqueTests':512,'sourceFiles':222"),("'actualAutomaticWakeObservedUtc':'2026-10-17T10:19:16.209Z'","'actualAutomaticWakeObservedUtc':'2026-10-17T10:38:46.295Z'"),('reader-schema498-entry-1019-once','reader-init505-entry-1038-once'),('feat(release): inventory explicit reader schema sorter requests','feat(release): derive conditional native reader initialization scratch')]
for a,b in changes:
 assert a in s,a;s=s.replace(a,b)
needle='import sys\nsys.path.insert(0,str(K))';assert s.count(needle)==1
scan="""   if relative.startswith('reader-init-local-retained-fixtures/'):
    if path.parent.name in ('setup','load','malformed') and path.name in ('stdout-original.json','exit-original.json'):
     case=reader_init_cases.setdefault(path.parent.parent.relative_to(K).as_posix(),{})
     case[path.parent.name+'/'+path.name]={'path':relative,'bytes':len(raw),'sha256':sha(raw),'value':json.loads(raw)}
    elif path.name in ('initialization-plan-before-read.json','actual-python-logical-original.json'):
     case=reader_init_cases.setdefault(path.parent.relative_to(K).as_posix(),{})
     case[path.name]={'path':relative,'bytes':len(raw),'sha256':sha(raw),'value':json.loads(raw)}
"""
s=s.replace(needle,scan+needle);index=s.index("save(D,'new-local-fixtures-hash-inventory.json'")
summary="""reader_init_rows=[];malformed_rows=[]
for folder,case in sorted(reader_init_cases.items()):
 if 'load/stdout-original.json' in case:
  initial=case['setup/stdout-original.json']['value'];out=case['load/stdout-original.json'];value=out['value'];plan=case['initialization-plan-before-read.json']['value'];py=case['actual-python-logical-original.json']['value']
  assert case['setup/exit-original.json']['value']['exitCode']==case['load/exit-original.json']['value']['exitCode']==0
  assert value['sourceId']=='2026-01-09 17:27:48 b270f8339eb13b504d0b2ba154ebca966b7dde08e40c3ed7d559749818cb2075' and value['version']=='3.51.2' and value['platform']=='win32'
  assert value['tempStore']==2 and value['mainUnchanged'] and initial['stat4Rows']>0 and 'ENABLE_STAT4' in value['options']
  assert value['steps']==[x['sql'] for x in plan['setup']] and [x['sql'] for x in value['cases']]==[x['sql'] for x in plan['queries']]
  assert plan['maximumImplicitSqlExecutions']==4 and plan['maximumPossibleSorterInitCalls']==2
  assert not plan['actualInternalStatementExecutionsMeasured'] and not plan['constructorAndExtensionSchemaAccessReviewed'] and not plan['beforeInitialReaderSqlAdmissionImplemented']
  assert plan['maximumPmaFileCreations']==plan['maximumPmaWriteBytes']==plan['maximumPmaSizeHintBytes']==0
  grouped=next(x for x in value['cases'] if 'GROUP BY' in x['sql']);assert sum(x[1] for x in grouped['rows'])==initial['stat4Rows']
  assert sum(x['opcode']=='SorterOpen' for x in grouped['program'])==1
  reader_init_rows.append({'folder':folder,'stdoutOriginal':{q:out[q] for q in ('path','bytes','sha256')},'planOriginal':{q:case['initialization-plan-before-read.json'][q] for q in ('path','bytes','sha256')},'pythonOriginal':{q:case['actual-python-logical-original.json'][q] for q in ('path','bytes','sha256')},'pageSize':initial['page'],'stat4RowsObserved':initial['stat4Rows'],'directCatalogQueryExecutions':len(value['cases']),'pythonEngineVersionObserved':py['versionObserved'],'nodeSourceIdObserved':value['sourceId'],'staticStat4GroupSorterOpenSites':1,'mainFullShaPreserved':True,'actualInternalStatementExecutionsMeasured':False,'readerSqliteBinaryToPinnedNativeSourceVerified':False,'beforeInitialReaderSqlAdmissionImplemented':False,'continuousPeakMeasured':False,'physicalFilesystemClosureClaimed':False})
 if 'malformed/stdout-original.json' in case:
  initial=case['setup/stdout-original.json']['value'];out=case['malformed/stdout-original.json'];value=out['value']
  assert case['setup/exit-original.json']['value']['exitCode']==case['malformed/exit-original.json']['value']['exitCode']==0
  assert initial['newFixtureOnly'] and initial['testOnlyUnsafeModeUsedToCreateMalformedFixture'] and initial['malformedSchemaIntentional']
  assert len(value['steps'])==5 and value['steps']==['PRAGMA compile_options','PRAGMA temp_store=MEMORY','PRAGMA temp_store','PRAGMA query_only=ON','BEGIN']
  assert value['tempStore']==2 and value['mainUnchanged'] and value['error'] and not value['sourcePlanApplicableToMalformedFixture']
  malformed_rows.append({'folder':folder,'stdoutOriginal':{q:out[q] for q in ('path','bytes','sha256')},'pageSize':initial['page'],'setupStatementsSucceeded':5,'firstSchemaRequiringStatementRefused':True,'errorOriginal':value['error'],'testOnlyUnsafeModeUsedToCreateNewMalformedFixture':True,'sourcePlanApplicableToMalformedFixture':False,'mainFullShaPreserved':True,'actualInternalStatementExecutionsMeasured':False,'physicalFilesystemClosureClaimed':False})
assert len(reader_init_rows)==len(malformed_rows)==3 and {x['pageSize'] for x in reader_init_rows}=={512,4096,65536}
save(D,'new-native-reader-initialization-summary.json',canonical({'positiveParameterCaseExecutions':len(reader_init_rows),'negativeMalformedParameterCaseExecutions':len(malformed_rows),'nativeLocalCommandExecutions':12,'rawPythonLogicalInvocations':3,'directCatalogQueryExecutions':sum(x['directCatalogQueryExecutions'] for x in reader_init_rows),'positiveCases':reader_init_rows,'negativeMalformedCases':malformed_rows,'sourceBytesReadOnlyFromNewFixtureDelta':True,'actualInternalStatementExecutionsMeasured':False,'readerSqliteBinaryToPinnedNativeSourceVerified':False,'beforeInitialReaderSqlAdmissionImplemented':False,'wholeLogicalReaderSqlScratchInventoryComplete':False,'continuousPeakMeasured':False,'physicalFilesystemClosureClaimed':False})+b'\\n')
"""
s=s[:index]+summary+s[index:]
needle=" 'conditionalExplicitReaderSchemaSelectScratchInventoryDerived':True,"
assert s.count(needle)==1;s=s.replace(needle," 'conditionalNativeSetupAndInitializationSourceInventoryDerived':True,'readerInitializationSourceFiles':85,'readerInitializationNativeExcerpts':57,\n 'readerInitializationSourceProofSha256':sha((K/'reader-initialization-source.json').read_bytes()),'nativeReaderInitializationPositiveCases':len(reader_init_rows),'nativeReaderInitializationMalformedCases':len(malformed_rows),\n 'constructorAndExtensionSchemaAccessReviewed':False,'actualInternalStatementExecutionsMeasured':False,'statisticalSampleHeapBounded':False,\n"+needle)
a=s.index('for name in [',s.index('extras|={p for p in (W/'));b=s.index('\n extras.add(',a)
s=s[:a]+"for name in ['prepare-reader-initialization-source-once.py','prepare-reader-initialization-publication-once.py','reader-init512-publication-notes-once.txt']:"+s[b:]
s=s.replace("'sourceAggregateTruncationDisclosed':True","'sourceAggregateTruncationDisclosed':False")
ast.parse(s);p.write_text(s,encoding='utf8',newline='');print('Prepared new one-run initialization publisher; not executed')
