from pathlib import Path
import ast
h=Path(__file__).resolve().parent
p=h/'publish-kit-reader-schema505-once.py';assert not p.exists()
s=(h/'publish-kit-fingerprint-sorter498-once.py').read_text(encoding='utf8')
for a,b in [('fingerprint-sorter498-publication-notes-once.txt','reader-schema505-publication-notes-once.txt'),("D=K/'fingerprint-sorter498-publication-once'","D=K/'reader-schema505-publication-once'"),('b720cc1ab40b6a0c65fb44bb83b7104f5df71348','aaf2de9370b300095a5c41e2f3d30fe9c9d43acf'),("runs=['fingerprint-sorter498-first']","runs=['reader-schema505-first']"),('zip(runs,[0],[498],[216]','zip(runs,[0],[505],[219]'),("assert len(prior_names)==40","prior_names.append('fingerprint-sorter498-publication-once/new-local-fixtures-hash-inventory.json')\nassert len(prior_names)==41"),('fingerprint_cases={}\n','fingerprint_cases={};reader_schema_cases={};memory_probes=[]\n'),("prior_external=K/'general-sorter491-rounded-publication-once/new-external-runtime-hash-inventory.json'","prior_external=K/'fingerprint-sorter498-publication-once/new-external-runtime-hash-inventory.json'"),("'tests':498,'uniqueTests':498,'sourceFiles':216","'tests':505,'uniqueTests':505,'sourceFiles':219"),("'actualAutomaticWakeObservedUtc':'2026-10-17T09:56:46.106Z'","'actualAutomaticWakeObservedUtc':'2026-10-17T10:19:16.209Z'"),("fingerprint491-entry-0956-once","reader-schema498-entry-1019-once"),("['prepare-fingerprint-sorter-source-once.py','prepare-fingerprint-sorter-publication-once.py','fingerprint-sorter498-publication-notes-once.txt']","['prepare-reader-schema-scratch-source-once.py','prepare-reader-schema-publication-once.py','reader-schema505-publication-notes-once.txt']"),("feat(release): derive owned-reader fingerprint sorter source inventory","feat(release): inventory explicit reader schema sorter requests")]:
 assert s.count(a)==1,(a,s.count(a));s=s.replace(a,b)
needle="import sys\nsys.path.insert(0,str(K))"
assert s.count(needle)==1
scan="""   if relative.startswith('reader-schema-scratch-local-retained-fixtures/'):
    if path.parent.name in ('full','filtered') and path.name in ('stdout-original.json','exit-original.json','source-plan-before-native-read.json','actual-python-logical-original.json'):
     case=reader_schema_cases.setdefault(path.parent.relative_to(K).as_posix(),{})
     case[path.name]={'path':relative,'bytes':len(raw),'sha256':sha(raw),'value':json.loads(raw)}
    elif path.name=='actual-python-memory-engine-original.json':
     memory_probes.append({'path':relative,'bytes':len(raw),'sha256':sha(raw),'value':json.loads(raw)})
"""
s=s.replace(needle,scan+needle)
needle="save(D,'new-local-fixtures-hash-inventory.json'"
index=s.index(needle)
summary="""reader_schema_rows=[]
for folder,case in sorted(reader_schema_cases.items()):
 if 'stdout-original.json' not in case:continue
 out=case['stdout-original.json'];value=out['value'];plan=case['source-plan-before-native-read.json']['value'];py=case['actual-python-logical-original.json']['value']
 assert case['exit-original.json']['value']['exitCode']==0
 assert value['sourceId']=='2026-01-09 17:27:48 b270f8339eb13b504d0b2ba154ebca966b7dde08e40c3ed7d559749818cb2075'
 assert value['version']=='3.51.2' and value['tempStore']==2 and value['mainUnchanged']
 assert not value['actualNativeCallsMeasured'] and not value['continuousPeakMeasured'] and not value['linuxVfsTested']
 assert [x['sql'] for x in value['cases']]==[x['query'] for x in plan['queries']]
 assert plan['maximumPmaFileCreations']==plan['maximumPmaWriteBytes']==plan['maximumPmaSizeHintBytes']==0
 assert not plan['laterProfileOrSchemaOriginalRequired'] and not plan['beforeInitialReaderSqlAdmissionImplemented']
 assert not plan['nativeSorterWriteCountDerived'] and not plan['wholeLogicalReaderSqlScratchInventoryComplete']
 assert all(sum(r['opcode']=='SorterOpen' for r in x['program'])<=1 and sum(r['opcode']=='OpenEphemeral' for r in x['program'])==0 for x in value['cases'])
 reader_schema_rows.append({'folder':folder,'stdoutOriginal':{q:out[q] for q in ('path','bytes','sha256')},
  'planOriginal':{q:case['source-plan-before-native-read.json'][q] for q in ('path','bytes','sha256')},
  'pythonOriginal':{q:case['actual-python-logical-original.json'][q] for q in ('path','bytes','sha256')},
  'fullSchemaRequested':plan['fullSchemaRequested'],'explicitQueriesExecuted':len(value['cases']),
  'schemaRowsReturnedAcrossQueries':sum(len(x['rows']) for x in value['cases']),
  'pythonEngineVersionObserved':py['collectorVersion'],'nodeVersionObserved':value['version'],
  'nodeSourceIdObserved':value['sourceId'],'observedTempStore':2,'mainFullShaPreserved':True,
  'staticSorterOpenSites':sum(r['opcode']=='SorterOpen' for x in value['cases'] for r in x['program']),
  'conditionalMaximumPmaFileCreations':0,'initialReaderSqlAdmissionImplemented':False,
  'loadedBinaryToSourceBuildBindingVerified':False,'actualNativeCallsMeasured':False,'continuousPeakMeasured':False,'physicalFilesystemClosureClaimed':False})
assert len(reader_schema_rows)==6 and sum(r['fullSchemaRequested'] for r in reader_schema_rows)==3
assert len(memory_probes)==1
save(D,'new-native-reader-schema-summary.json',canonical({'parameterCaseExecutions':len(reader_schema_rows),'nativeLocalCommandExecutions':9,
 'rawPythonLogicalInvocations':6,'explicitNativeSchemaSelectExecutions':sum(r['explicitQueriesExecuted'] for r in reader_schema_rows),
 'cases':reader_schema_rows,'pythonNewMemoryEngineProbes':[{'original':{q:r[q] for q in ('path','bytes','sha256')},'versionObserved':r['value']['sqliteVersionObserved'],'sourceIdObserved':r['value']['sqliteSourceIdObserved'],'binarySourceBindingVerified':False} for r in memory_probes],
 'sourceBytesReadOnlyFromNewFixtureDelta':True,'loadedBinaryToSourceBuildBindingVerified':False,'beforeInitialReaderSqlAdmissionImplemented':False,
 'wholeLogicalReaderSqlScratchInventoryComplete':False,'actualNativeCallsMeasured':False,'continuousPeakMeasured':False,'physicalFilesystemClosureClaimed':False})+b'\\n')
"""
s=s[:index]+summary+s[index:]
needle=" 'conditionalFingerprintSorterSourceInventoryDerived':True,"
assert s.count(needle)==1
s=s.replace(needle," 'conditionalExplicitReaderSchemaSelectScratchInventoryDerived':True,'readerSchemaSourceFiles':83,'readerSchemaNativeExcerpts':22,'readerSchemaCallerFunctions':3,\n 'readerSchemaSourceProofSha256':sha((K/'reader-schema-scratch-source.json').read_bytes()),'nativeReaderSchemaCases':len(reader_schema_rows),\n 'laterProfileRequiredForConditionalSchemaPmaBound':False,'beforeInitialReaderSqlAdmissionImplemented':False,'wholeLogicalReaderSqlScratchInventoryComplete':False,\n"+needle)
ast.parse(s);p.write_text(s,encoding='utf8',newline='');print('Prepared new publisher; not executed')
