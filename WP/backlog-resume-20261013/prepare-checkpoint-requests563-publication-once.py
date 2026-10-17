from pathlib import Path
import ast,hashlib,json
h=Path(__file__).resolve().parent;out=h/'publish-kit-checkpoint-requests563-once.py';assert not out.exists()
s=(h/'publish-kit-header-normalization556-once.py').read_text(encoding='utf8')
def replace(a,b):
 global s
 assert s.count(a)==1,(a,s.count(a));s=s.replace(a,b)
replace("NOTES=pathlib.Path(__file__).with_name('header-normalization556-publication-notes-once.txt')","NOTES=pathlib.Path(__file__).with_name('checkpoint-requests563-publication-notes-once.txt')")
replace("D=K/'header-normalization556-publication-once'","D=K/'checkpoint-requests563-publication-once'")
replace("=='42c1fc422fc1ee28e725b5b9780fee6ccc60ab24'","=='f11766da5436b0bfe31008cffede07f9313986b3'")
replace("runs=['header-normalization556-first','header-normalization556-second']","runs=['checkpoint-requests563-first']")
replace("zip(runs,[1,0],[556,556],[240,240],['FAILED (errors=1)','OK'])","zip(runs,[0],[563],[243],['OK'])")
replace('assert len(prior_names)==49',"prior_names.append('header-normalization556-publication-once/new-local-fixtures-hash-inventory.json')\nassert len(prior_names)==50")
replace('backup_caller_cases={};header_cases={}','backup_caller_cases={};header_cases={};checkpoint_synthetic=[]')
selector="""   if relative.startswith('checkpoint-requests-local-retained-fixtures/') and path.name=='synthetic-original-replay-cases.json':
    checkpoint_synthetic.append({'path':relative,'bytes':len(raw),'sha256':sha(raw),'value':json.loads(raw)})
"""
replace("   if relative.startswith('header-normalization-local-retained-fixtures/')",selector+"   if relative.startswith('header-normalization-local-retained-fixtures/')")
replace("'historicalCasesUsingEarlierWeakerDeclaration':3,'currentProofCases':3","'historicalCasesUsingEarlierWeakerDeclaration':0,'currentProofCases':len(header_rows)")
summary="""assert len(checkpoint_synthetic)==len(runs)
synthetic_rows=[]
for original in checkpoint_synthetic:
 value=original['value'];assert value['syntheticArithmeticAndByteReplayOnly'] and value['newNativeFeatureCases']==0 and not value['nativeRecoveryExecuted'] and not value['targetSqlOpened'] and len(value['cases'])==4
 assert {r['page'] for r in value['cases']}=={512,4096,65536} and all(r['headPages']==20000 and r['earlierDeclaredMainPages']==2 for r in value['cases'])
 synthetic_rows.append({'original':original_pin(original),'cases':value['cases'],'completeSyntheticOriginalsIndependentlyRetained':False,'completeOriginalReplayExercisedInMemory':True,'syntheticArithmeticAndByteReplayOnly':True,'nativeRecoveryExecuted':False,'targetSqlOpened':False})
save(D,'new-synthetic-checkpoint-request-summary.json',canonical({'syntheticParameterCases':4*len(runs),'newNativeFeatureCases':0,'newFeatureNodeCommands':0,'cases':synthetic_rows,'sourceBytesReadOnlyFromNewFixtureDelta':True,'conditionalCheckpointRequestArgumentsImplemented':True,'indexMapInvocationCountDerived':False,'actualEntryAndHeadSourceAssociationVerified':False,'actualNativeCheckpointCallsOrReturnCodesMeasured':False,'nativeRecoveryExecutionVerified':False,'completeSyntheticOriginalsIndependentlyRetained':False,'completeOriginalReplayExercisedInMemory':True,'fullPrivateMainBytesPackaged':False,'beforeSqlHeldAdmissionImplemented':False,'writerGraphAdmissionImplemented':False,'continuousPeakMeasured':False,'physicalFilesystemClosureClaimed':False})+b'\\n')
"""
replace("save(D,'new-local-fixtures-hash-inventory.json'",summary+"save(D,'new-local-fixtures-hash-inventory.json'")
replace("prior_external=K/'backup-caller549-publication-once/new-external-runtime-hash-inventory.json'","prior_external=K/'header-normalization556-publication-once/new-external-runtime-hash-inventory.json'")
replace("'tests':556,'uniqueTests':556,'sourceFiles':240,","'tests':563,'uniqueTests':563,'sourceFiles':243,'conditionalCheckpointRequestArgumentsImplemented':True,'checkpointRequestSourceFiles':104,'checkpointRequestNativeExcerpts':28,'checkpointRequestSourceProofSha256':sha((K/'checkpoint-requests-source.json').read_bytes()),'checkpointRequestSyntheticCases':4*len(runs),'checkpointRequestNewNativeFeatureCases':0,'checkpointRequestOriginalReplayIsInMemoryOnly':True,'actualCheckpointEntryOrHeadAssociationVerified':False,'indexMapInvocationCountDerived':False,")
replace("'firstFullRunNewFixturePathErrorPreserved':True","'prior556FirstFullRunPathErrorRemainsPreserved':True")
replace("'actualAutomaticWakeObservedUtc':'2026-10-17T13:17:17.700Z'","'actualAutomaticWakeObservedUtc':'2026-10-17T13:48:17.987Z'")
replace("(W/'WP/backlog-resume-20261013/header-normalization-tail-entry-1317-once').iterdir()","(W/'WP/backlog-resume-20261013/checkpoint-requests556-entry-1348-once').iterdir()")
replace("for name in ('prepare-header-normalization-entry-once.py','prepare-header-normalization-source-once.py','strengthen-header-normalization-stable-main-and-fixture-path-once.py','prepare-header-normalization556-publication-once.py','prepare-header-normalization556-publication-count-successor-once.py','header-normalization556-publication-notes-once.txt'):","for name in ('prepare-checkpoint-requests556-entry-once.py','prepare-checkpoint-requests-source-once.py','prepare-checkpoint-requests563-publication-once.py','checkpoint-requests563-publication-notes-once.txt'):")
replace("'test(release): bound nonempty header normalization requests'","'test(release): bound one native checkpoint request profile'")
ast.parse(s);assert selector in s and 'len(check_hazard_rows)==3*len(runs)' in s
out.open('x',encoding='utf8',newline='').write(s)
record={'publisher':out.name,'bytes':len(s.encode()),'sha256':hashlib.sha256(s.encode()).hexdigest(),'priorPrivateInventories':50,'expectedClosedRunExitCodes':[0],'expectedUniqueTests':563,'expectedSources':243,'newSelectorIsSiblingPrefix':True,'newNativeFeatureCases':0,'syntheticOriginalReplayInMemoryOnly':True,'publisherExecuted':False}
(h/'checkpoint-requests556-entry-1348-once/publication-preparation-record.json').open('x',encoding='utf8').write(json.dumps(record,sort_keys=True)+'\n');print(json.dumps(record))
