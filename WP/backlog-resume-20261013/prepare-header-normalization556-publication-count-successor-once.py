from pathlib import Path
import ast,json,hashlib
h=Path(__file__).resolve().parent;w=h.parents[1];k=w/'WP/batch-release-kit-be837974-20261016'
entry=h/'header-normalization-tail-entry-1317-once';out=h/'publish-kit-header-normalization556-once.py';assert not out.exists()
assert 'First full556 FAILED with ONEERROR353.080s' in (h/'header-normalization556-publication-notes-once.txt').read_text(encoding='utf8')
s=(h/'publish-kit-backup-caller549-once.py').read_text(encoding='utf8')
def replace(a,b):
 global s
 assert s.count(a)==1,(a,s.count(a));s=s.replace(a,b)
replace("NOTES=pathlib.Path(__file__).with_name('backup-caller549-publication-notes-once.txt')","NOTES=pathlib.Path(__file__).with_name('header-normalization556-publication-notes-once.txt')")
replace("D=K/'backup-caller549-publication-once'","D=K/'header-normalization556-publication-once'")
replace("=='d5233af14d0969b5d2a5f9ccbed7273a51586300'","=='42c1fc422fc1ee28e725b5b9780fee6ccc60ab24'")
replace("runs=['backup-caller549-first']","runs=['header-normalization556-first','header-normalization556-second']")
replace("zip(runs,[0],[549],[237],['OK'])","zip(runs,[1,0],[556,556],[240,240],['FAILED (errors=1)','OK'])")
replace('assert len(prior_names)==48',"prior_names.append('backup-caller549-publication-once/new-local-fixtures-hash-inventory.json')\nassert len(prior_names)==49")
replace('backup_binding_cases={};backup_caller_cases={}','backup_binding_cases={};backup_caller_cases={};header_cases={}')
replace("import os\n", "import os\nLONG_PREFIX=chr(92)*2+'?'+chr(92)\ndef extended(path):return pathlib.Path(LONG_PREFIX+str(path)) if os.name=='nt' else path\n")
replace('os.walk(directory,followlinks=False)','os.walk(extended(directory),followlinks=False)')
replace('path=pathlib.Path(base)/filename;relative=path.relative_to(K).as_posix()',"ordinary=base[len(LONG_PREFIX):] if base.startswith(LONG_PREFIX) else base\n   path=pathlib.Path(ordinary)/filename;relative=path.relative_to(K).as_posix()")
replace('if relative in known or not path.is_file():continue','if relative in known or not extended(path).is_file():continue')
replace('raw=path.read_bytes();info=path.stat();fixtures.append','raw=extended(path).read_bytes();info=extended(path).stat();fixtures.append')
selector="""   if relative.startswith('header-normalization-local-retained-fixtures/'):
    if path.parent.name in ('setup','normalize') and path.name in ('stdout-original.json','exit-original.json','before-main-original.bin','after-main-original.bin'):
     case=header_cases.setdefault(path.parent.parent.relative_to(K).as_posix(),{})
     case[path.parent.name+'/'+path.name]={'path':relative,'bytes':len(raw),'sha256':sha(raw),'value':json.loads(raw) if path.name.endswith('.json') else raw}
    elif path.name=='plan-before-normalize.json':
     case=header_cases.setdefault(path.parent.relative_to(K).as_posix(),{})
     case[path.name]={'path':relative,'bytes':len(raw),'sha256':sha(raw),'value':json.loads(raw)}
"""
replace("   if relative.startswith('sorter-local-retained-fixtures/')",selector+"   if relative.startswith('sorter-local-retained-fixtures/')")
assert 'len(check_hazard_rows)==3*len(runs) and' in s
summary="""header_rows=[]
current_header_proof=sha((K/'header-normalization-source.json').read_bytes())
for folder,case in sorted(header_cases.items()):
 if 'normalize/stdout-original.json' not in case:continue
 initial=case['setup/stdout-original.json']['value'];out=case['normalize/stdout-original.json'];value=out['value'];original=case['plan-before-normalize.json'];plan=original['value']
 assert case['setup/exit-original.json']['value']['exitCode']==case['normalize/exit-original.json']['value']['exitCode']==0
 assert initial['headerVersions']==[2,2] and value['headerVersions']==[1,1] and value['mode']=='memory'
 assert value['sourceId']=='2026-01-09 17:27:48 b270f8339eb13b504d0b2ba154ebca966b7dde08e40c3ed7d559749818cb2075'
 assert value['data']=={'n':24,'bytes':196608} and value['integrity']=='ok'
 assert value['mainBytes']==value['finalBytes']==initial['pages']*initial['page']==plan['maximumMainLogicalAndWriteEndBytes']
 assert plan['declaredOriginalMainPages']==initial['pages'] and plan['declaredPageSize']==initial['page']
 assert not plan['actualEntryAndPriorCheckpointVerified'] and not plan['writerGraphAdmissionImplemented'] and value['earlierWalCloseOutsideConditionalPlan']
 assert not value['nativePhaseCallsMeasured'] and not value['fullLifetimeOriginalsRetained'] and not value['physicalFilesystemClosureClaimed']
 before=case['normalize/before-main-original.bin'];after=case['normalize/after-main-original.bin']
 assert before['bytes']==after['bytes']==value['mainBytes'] and list(before['value'][18:20])==[2,2] and list(after['value'][18:20])==[1,1]
 current_plan=plan['sourceProofSha256']==current_header_proof
 if current_plan:assert plan['nativeDeclaration']['stableNAndFullMainBytesNoOtherHandlesWritersSharedCacheOrExternalChanges'] is True
 else:assert 'stableNAndFullMainBytesNoOtherHandlesWritersSharedCacheOrExternalChanges' not in plan['nativeDeclaration']
 header_rows.append({'folder':folder,'stdoutOriginal':original_pin(out),'planOriginal':original_pin(original),'beforeMainOriginal':original_pin(before),'afterMainOriginal':original_pin(after),'pageSize':initial['page'],'originalMainPages':initial['pages'],'mainBytesObserved':value['mainBytes'],'fullJournalLogicalChargeBytes':plan['maximumLogicalJournalAndWriteEndBytes'],'planMatchesCurrentProof':current_plan,'headerVersionsBefore':[2,2],'headerVersionsAfter':[1,1],'rows':24,'payloadBytes':196608,'actualConditionalSubphaseEntryVerified':False,'nativePhaseCallsMeasured':False,'earlierWalCloseOutsideConditionalPlan':True,'fullLifetimeOriginalsRetained':False,'continuousPeakMeasured':False,'physicalFilesystemClosureClaimed':False})
assert len(header_rows)==3*len(runs) and sum(r['planMatchesCurrentProof'] for r in header_rows)==3 and {r['pageSize'] for r in header_rows}=={512,4096,65536}
save(D,'new-native-header-normalization-summary.json',canonical({'nativeParameterCaseExecutions':len(header_rows),'nativeLocalCommandsIncludingSetup':6*len(runs),'historicalCasesUsingEarlierWeakerDeclaration':3,'currentProofCases':3,'cases':header_rows,'sourceBytesReadOnlyFromNewFixtureDelta':True,'fullPragmaIncludesEarlierWalCloseOutsideConditionalProfile':True,'actualEntryAndPriorCheckpointVerified':False,'nativePhaseCallsMeasured':False,'mainOrJournalActualFileLengthOrPreallocationBounded':False,'actualPythonWrapperToNativeBindingVerified':False,'beforeSqlHeldAdmissionImplemented':False,'continuousPeakMeasured':False,'physicalFilesystemClosureClaimed':False})+b'\\n')
"""
replace("save(D,'new-local-fixtures-hash-inventory.json'",summary+"save(D,'new-local-fixtures-hash-inventory.json'")
replace("prior_external=K/'backup-binding547-delta-successor-publication-once/new-external-runtime-hash-inventory.json'","prior_external=K/'backup-caller549-publication-once/new-external-runtime-hash-inventory.json'")
replace("'tests':549,'uniqueTests':549,'sourceFiles':237,","'tests':556,'uniqueTests':556,'sourceFiles':240,'conditionalNonemptyHeaderMainAndJournalBoundImplemented':True,'headerNormalizationSourceFiles':100,'headerNormalizationNativeExcerpts':22,'headerNormalizationSourceProofSha256':current_header_proof,'headerNormalizationNativeCases':len(header_rows),'actualHeaderSubphaseEntryVerified':False,'earlierWalCheckpointOrSourceCloseBounded':False,'mainOrJournalActualFileLengthOrPreallocationBounded':False,'firstFullRunNewFixturePathErrorPreserved':True,'explicitStableMainExclusionConditionNowRequired':True,")
replace("'actualAutomaticWakeObservedUtc':'2026-10-17T12:54:17.438Z'","'actualAutomaticWakeObservedUtc':'2026-10-17T13:17:17.700Z'")
replace("(W/'WP/backlog-resume-20261013/backup-caller547-entry-1254-once').iterdir()","(W/'WP/backlog-resume-20261013/header-normalization-tail-entry-1317-once').iterdir()")
replace("for name in ('prepare-backup-caller547-entry-once.py','prepare-backup-caller-source-review-once.py','prepare-backup-caller549-publication-once.py','backup-caller549-publication-notes-once.txt'):","for name in ('prepare-header-normalization-entry-once.py','prepare-header-normalization-source-once.py','strengthen-header-normalization-stable-main-and-fixture-path-once.py','prepare-header-normalization556-publication-once.py','prepare-header-normalization556-publication-count-successor-once.py','header-normalization556-publication-notes-once.txt'):")
replace("'test(release): audit backup caller status and profile gaps'","'test(release): bound nonempty header normalization requests'")
ast.parse(s)
assert selector in s and 'len(check_hazard_rows)==3*len(runs)' in s
out.open('x',encoding='utf8',newline='').write(s)
record={'publisher':out.name,'bytes':len(s.encode()),'sha256':hashlib.sha256(s.encode()).hexdigest(),'priorPrivateInventories':49,'expectedClosedRunExitCodes':[1,0],'expectedUniqueTests':556,'expectedSources':240,'newSelectorIsSiblingPrefix':True,'completeNewLongPathInventorySupported':True,'publisherExecuted':False}
(entry/'publication-preparation-record.json').open('x',encoding='utf8').write(json.dumps(record,sort_keys=True)+'\n');print(json.dumps(record))
