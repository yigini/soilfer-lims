import ast,pathlib
w=pathlib.Path(__file__).resolve().parents[2];h=w/'WP/backlog-resume-20261013'
# Read superseded prepared source as a template ONLY. Never execute it.
source=(h/'publish-kit-general-sorter491-once.py').read_text(encoding='utf8')
def replace(old,new):
 global source
 assert source.count(old)==1,(old[:100],source.count(old))
 source=source.replace(old,new)
replace("with_name('general-sorter491-publication-notes-once.txt')","with_name('fingerprint-sorter498-publication-notes-once.txt')")
replace("D=K/'general-sorter491-publication-once'","D=K/'fingerprint-sorter498-publication-once'")
replace("=='36d1aff914ff18b92db1672c8f5b494f163c355f'","=='b720cc1ab40b6a0c65fb44bb83b7104f5df71348'")
replace("runs=['general-sorter491-first']","runs=['fingerprint-sorter498-first']")
replace("zip(runs,[0],[491],[213],['OK'])","zip(runs,[0],[498],[216],['OK'])")
replace("assert len(prior_names)==39","prior_names.append('general-sorter491-rounded-publication-once/new-local-fixtures-hash-inventory.json')\nassert len(prior_names)==40")
replace("general_cases={}","general_cases={};fingerprint_cases={}")
needle="import sys\nsys.path.insert(0,str(K))"
insert="""   if relative.startswith('fingerprint-sorter-local-retained-fixtures/'):
    if path.parent.name in ('setup','fingerprint') and path.name in ('stdout-original.json','exit-original.json'):
     case=fingerprint_cases.setdefault(path.parent.parent.relative_to(K).as_posix(),{})
     case[path.parent.name+'/'+path.name]={'path':relative,'bytes':len(raw),'sha256':sha(raw),'value':json.loads(raw)}
    elif path.name in ('fingerprint-plan-before-read.json','actual-python-fingerprint-original.json'):
     case=fingerprint_cases.setdefault(path.parent.relative_to(K).as_posix(),{})
     case[path.name]={'path':relative,'bytes':len(raw),'sha256':sha(raw),'value':json.loads(raw)}
    elif path.parent.name=='input' and path.name=='dev.db':
     case=fingerprint_cases.setdefault(path.parent.parent.relative_to(K).as_posix(),{})
     case['input/dev.db']={'path':relative,'bytes':len(raw),'sha256':sha(raw)}
"""
replace(needle,insert+needle)
marker="save(D,'new-local-fixtures-hash-inventory.json',";assert source.count(marker)==1
extra="""fingerprint_rows=[]
for folder,case in sorted(fingerprint_cases.items()):
 if 'fingerprint/stdout-original.json' not in case:continue
 setup=case['setup/stdout-original.json']['value'];out=case['fingerprint/stdout-original.json'];vcase=out['value'];original=case['fingerprint-plan-before-read.json'];plan=original['value'];py=case['actual-python-fingerprint-original.json']['value']
 assert case['setup/exit-original.json']['value']['exitCode']==case['fingerprint/exit-original.json']['value']['exitCode']==0
 assert setup['sourceId']==vcase['sourceId']=='2026-01-09 17:27:48 b270f8339eb13b504d0b2ba154ebca966b7dde08e40c3ed7d559749818cb2075'
 assert vcase['version']=='3.51.2' and vcase['rows']==256 and vcase['blobBytes']==256*8192 and vcase['tempStoreObserved']==2 and vcase['mainUnchanged']
 assert vcase['platform']=='win32' and not vcase['actualNativeSorterCallsMeasured'] and not vcase['linuxVfsTested']
 inv=plan['inventory'];table=next(x for x in inv['tables'] if x['table']=='finger');rp=plan['recordPlan']
 assert inv['maximumPmaFileCreations']==inv['maximumPmaWriteBytes']==inv['maximumPmaSizeHintBytes']==0
 assert table['maximumSorterWriteCalls']==256 and table['query']==py['query']
 assert py['result']['count']==256 and py['result']['sha256']==rp['logicalState']['tables']['finger']['sha256']
 assert rp['originalTargetFiles']['']['sha256']==case['input/dev.db']['sha256']
 assert plan['futureInvocationOnly'] and not plan['initialEarlierFingerprintAdmissionImplemented'] and not plan['readerSqliteBinaryToPinnedNativeSourceVerified']
 assert not plan['beforeSqlHeldAdmissionImplemented'] and not plan['independentProfileToPrivateDbBytesProof']
 opens=sum(x['opcode']=='SorterOpen' for x in vcase['program']);inserts=sum(x['opcode']=='SorterInsert' for x in vcase['program']);resets=sum(x['opcode']=='ResetSorter' for x in vcase['program'])
 assert opens==inserts==1 and bool(resets)==setup['partial']
 fingerprint_rows.append({'folder':folder,'stdoutOriginal':{q:out[q] for q in ('path','bytes','sha256')},'planOriginal':{q:original[q] for q in ('path','bytes','sha256')},
  'pythonOriginal':{q:case['actual-python-fingerprint-original.json'][q] for q in ('path','bytes','sha256')},
  'pageSize':setup['page'],'partialOrder':setup['partial'],'rows':256,'blobBytes':vcase['blobBytes'],
  'pythonCollectorVersionObserved':rp['profile']['collectorEngineVersion'],'nodeVersionObserved':vcase['version'],'nodeSourceIdObserved':vcase['sourceId'],
  'observedTempStorePragma':vcase['tempStoreObserved'],'observedWorkerLimit':vcase['requestedWorkerLimit'],
  'staticSorterOpenSites':opens,'staticSorterInsertSites':inserts,'staticBlockResetSites':resets,
  'maximumFullSerializedSorterRecordBytes':table['maximumFullSerializedSorterRecordBytes'],
  'conditionalMaximumPmaFileCreations':0,'conditionalMaximumPmaWriteBytes':0,'conditionalMaximumPmaSizeHintBytes':0,
  'observedTempNames':vcase['observedTempNames'],'mainFullShaPreserved':True,
  'readerSqliteBinaryToPinnedNativeSourceVerified':False,'initialEarlierFingerprintAdmissionImplemented':False,
  'actualNativeSorterCallsMeasured':False,'continuousPeakMeasured':False,'physicalFilesystemClosureClaimed':False})
assert len(fingerprint_rows)==6 and {r['pageSize'] for r in fingerprint_rows}=={512,4096,65536} and sum(r['partialOrder'] for r in fingerprint_rows)==3
save(D,'new-native-fingerprint-sorter-summary.json',canonical({'parameterCases':6,'nativeLocalCommandExecutions':12,'pythonFutureFingerprintInvocations':6,
 'rowsReadPerEngine':sum(r['rows'] for r in fingerprint_rows),'nativeBlobBytesRead':sum(r['blobBytes'] for r in fingerprint_rows),'cases':fingerprint_rows,
 'sourceBytesReadOnlyFromNewFixtureDelta':True,'sampleAbsenceIsNotNoSpillProof':True,'readerSqliteBinaryToPinnedNativeSourceVerified':False,
 'initialEarlierFingerprintAdmissionImplemented':False,'actualNativeSorterCallsMeasured':False,'continuousPeakMeasured':False,'physicalFilesystemClosureClaimed':False})+b'\\n')
"""
source=source.replace(marker,extra+marker)
replace("prior_external=K/'record-payload484-publication-once/new-external-runtime-hash-inventory.json'","prior_external=K/'general-sorter491-rounded-publication-once/new-external-runtime-hash-inventory.json'")
replace("'tests':491,'uniqueTests':491,'sourceFiles':213","'tests':498,'uniqueTests':498,'sourceFiles':216")
replace("'conditionalGeneralSerializedSorterRequestBoundImplemented':True,","'conditionalFingerprintSorterSourceInventoryDerived':True,'fingerprintSourceFiles':81,'fingerprintNativeExcerpts':20,'fingerprintCallerFunctions':4,\n 'fingerprintSourceProofSha256':sha((K/'fingerprint-sorter-source.json').read_bytes()),'nativeFingerprintCases':len(fingerprint_rows),\n 'readerSqliteBinaryToPinnedNativeSourceVerified':False,'initialEarlierFingerprintAdmissionImplemented':False,'processHeapOrPhysicalMemoryBounded':False,\n 'conditionalGeneralSerializedSorterRequestBoundImplemented':True,")
replace("'actualAutomaticWakeObservedUtc':'2026-10-17T09:30:45.840Z'","'actualAutomaticWakeObservedUtc':'2026-10-17T09:56:46.106Z'")
replace("'sourceAggregateTruncationDisclosed':False","'sourceAggregateTruncationDisclosed':True")
replace("'exploratoryCp1252OutputRefusalTranscribedOnly':True","'exploratoryCp1252OutputRefusalTranscribedOnly':False")
replace("general-sorter484-entry-0930-once","fingerprint491-entry-0956-once")
replace("['prepare-general-sorter-source-once.py','prepare-general-sorter-publication-once.py','general-sorter491-publication-notes-once.txt']","['prepare-fingerprint-sorter-source-once.py','prepare-fingerprint-sorter-publication-once.py','fingerprint-sorter498-publication-notes-once.txt']")
replace("'feat(release): bound normal sorter requests for full serialized records'","'feat(release): derive owned-reader fingerprint sorter source inventory'")
ast.parse(source);p=h/'publish-kit-fingerprint-sorter498-once.py';assert not p.exists();p.write_text(source,encoding='utf8',newline='')
notes=(h/'fingerprint-sorter498-publication-notes-once.txt').read_text(encoding='utf8');notes.format(when='x',summary='x',started='x',closed='x')
print('Prepared unique fingerprint-sorter498 source publisher; not executed.')
