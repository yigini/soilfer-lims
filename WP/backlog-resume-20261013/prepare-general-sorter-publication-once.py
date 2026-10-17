import ast,pathlib
w=pathlib.Path(__file__).resolve().parents[2];h=w/'WP/backlog-resume-20261013'
source=(h/'publish-kit-record-payload484-once.py').read_text(encoding='utf8')
def replace(old,new):
 global source
 assert source.count(old)==1,(old[:100],source.count(old))
 source=source.replace(old,new)
replace("with_name('record-payload484-publication-notes-once.txt')","with_name('general-sorter491-publication-notes-once.txt')")
replace("D=K/'record-payload484-publication-once'","D=K/'general-sorter491-publication-once'")
replace("=='63b18e005676f40df4e7d82346cace1f33f65f2e'","=='36d1aff914ff18b92db1672c8f5b494f163c355f'")
replace("runs=['record-payload484-first']","runs=['general-sorter491-first']")
replace("zip(runs,[0],[484],[210],['OK'])","zip(runs,[0],[491],[213],['OK'])")
replace("assert len(prior_names)==38","prior_names.append('record-payload484-publication-once/new-local-fixtures-hash-inventory.json')\nassert len(prior_names)==39")
replace("record_cases={}","record_cases={};general_cases={}")
needle="import sys\nsys.path.insert(0,str(K))"
insert="""   if relative.startswith('general-sorter-local-retained-fixtures/'):
    if path.parent.name in ('setup','index') and path.name in ('stdout-original.json','exit-original.json'):
     case=general_cases.setdefault(path.parent.parent.relative_to(K).as_posix(),{})
     case[path.parent.name+'/'+path.name]={'path':relative,'bytes':len(raw),'sha256':sha(raw),'value':json.loads(raw)}
    elif path.name in ('general-sorter-plan-before-index.json','source.db'):
     case=general_cases.setdefault(path.parent.relative_to(K).as_posix(),{})
     case[path.name]={'path':relative,'bytes':len(raw),'sha256':sha(raw),'value':json.loads(raw) if path.name.endswith('.json') else raw}
"""
replace(needle,insert+needle)
marker="save(D,'new-local-fixtures-hash-inventory.json',"
assert source.count(marker)==1
general="""general_rows=[]
for folder,case in sorted(general_cases.items()):
 if 'index/stdout-original.json' not in case:continue
 setup=case['setup/stdout-original.json']['value'];out=case['index/stdout-original.json'];value=out['value'];original=case['general-sorter-plan-before-index.json'];plan=original['value']
 assert case['setup/exit-original.json']['value']['exitCode']==case['index/exit-original.json']['value']['exitCode']==0
 assert setup['sourceId']==value['sourceId']=='2026-01-09 17:27:48 b270f8339eb13b504d0b2ba154ebca966b7dde08e40c3ed7d559749818cb2075'
 assert value['rows']==256 and value['platform']=='win32' and value['threads'] in (0,2)
 assert not value['linuxVfsTested'] and not value['actualNativeFileCallsMeasured'] and not value['continuousPeakMeasured']
 inv=plan['sorterDeclaration'];record_plan=plan['recordPlan'];profile=record_plan['profile']
 assert inv['maximumSorterWriteRecords']==256 and inv['maximumFullSerializedKeyBytes']==record_plan['bound']['maximumFullSerializedRecordBytes']
 assert not plan['completeCallerRecordCountAndHandleInventoryVerified'] and not plan['writerGraphAdmissionImplemented'] and not plan['independentProfileToPrivateDbBytesProof']
 assert len(plan['bounds']['bounds'])==8 and sum(x['opcode']=='SorterOpen' for x in value['program'])==sum(x['opcode']=='SorterInsert' for x in value['program'])==1
 cells=payload_sizes(case['source.db']['value'],setup['page'],value['indexRoot']);assert len(cells)==256 and 32<max(cells)<=inv['maximumFullSerializedKeyBytes']
 general_rows.append({'folder':folder,'stdoutOriginal':{q:out[q] for q in ('path','bytes','sha256')},
  'planOriginal':{q:original[q] for q in ('path','bytes','sha256')},'pageSize':setup['page'],'rows':256,'observedWorkerLimit':value['threads'],
  'collectorEngineVersionObserved':profile['collectorEngineVersion'],'nativeSourceIdObserved':value['sourceId'],
  'maximumFullSerializedKeyBoundBytes':inv['maximumFullSerializedKeyBytes'],'maximumObservedFullSerializedIndexPayloadBytes':max(cells),
  'parsedFullIndexPayloadCells':len(cells),'declaredSorterWriteRecords':256,'staticSorterOpenSites':1,'staticSorterInsertSites':1,
  'maximumAggregateNativeRequestedExtentBytesAllPageSizes':plan['bounds']['maximumAggregateNativeRequestedExtentBytes'],
  'maximumCumulativeNativeWriteBytesAllPageSizes':plan['bounds']['maximumCumulativeNativeWriteBytes'],
  'completeCallerRecordCountAndHandleInventoryVerified':False,'completeNativeRecordMappingVerified':False,
  'linuxVfsTested':False,'actualNativeFileCallsMeasured':False,'continuousPeakMeasured':False,'physicalFilesystemClosureClaimed':False})
assert len(general_rows)==3 and {r['pageSize'] for r in general_rows}=={512,4096,65536}
save(D,'new-native-general-sorter-summary.json',canonical({'parameterCases':3,'nativeLocalCommandExecutions':6,'cases':general_rows,
 'parsedFullIndexPayloadCells':sum(r['parsedFullIndexPayloadCells'] for r in general_rows),'sourceBytesReadOnlyFromNewFixtureDelta':True,
 'completeCallerRecordCountAndHandleInventoryVerified':False,'runtimeSorterConfigurationVerified':False,
 'actualNativeFileCallsMeasured':False,'continuousPeakMeasured':False,'physicalFilesystemClosureClaimed':False})+b'\\n')
"""
source=source.replace(marker,general+marker)
replace("prior_external=K/'ephemeral-btree477-group-publication-once/new-external-runtime-hash-inventory.json'","prior_external=K/'record-payload484-publication-once/new-external-runtime-hash-inventory.json'")
replace("'tests':484,'uniqueTests':484,'sourceFiles':210","'tests':491,'uniqueTests':491,'sourceFiles':213")
replace("'recordPayloadCollectorSourceImplemented':True,","'conditionalGeneralSerializedSorterRequestBoundImplemented':True,'generalSorterSourceFiles':79,'generalSorterNativeExcerpts':38,\n 'generalSorterSourceProofSha256':sha((K/'general-sorter-source.json').read_bytes()),'nativeGeneralSorterCases':len(general_rows),\n 'generalSorterWriterAdmissionImplemented':False,'completeCallerRecordCountAndHandleInventoryVerified':False,\n 'recordPayloadCollectorSourceImplemented':True,")
replace("'actualAutomaticWakeObservedUtc':'2026-10-17T09:06:15.481Z'","'actualAutomaticWakeObservedUtc':'2026-10-17T09:30:45.840Z'")
replace("'exploratoryMissingGuessedMetadataFilenameTranscribedOnly':True","'exploratoryMissingGuessedMetadataFilenameTranscribedOnly':False,'exploratoryCp1252OutputRefusalTranscribedOnly':True")
replace("sql-record477-entry-0906-once","general-sorter484-entry-0930-once")
replace("['prepare-record-payload-source-once.py','bind-record-profile-flag-before-tests-once.py','prepare-record-payload-publication-once.py','record-payload484-publication-notes-once.txt']","['prepare-general-sorter-source-once.py','prepare-general-sorter-publication-once.py','general-sorter491-publication-notes-once.txt']")
replace("'feat(release): observe full native record payload bounds'","'feat(release): bound normal sorter requests for full serialized records'")
ast.parse(source);p=h/'publish-kit-general-sorter491-once.py';assert not p.exists();p.write_text(source,encoding='utf8',newline='')
notes=(h/'general-sorter491-publication-notes-once.txt').read_text(encoding='utf8');notes.format(when='x',summary='x',started='x',closed='x')
print('Prepared unique general-sorter491 publisher; not executed.')
