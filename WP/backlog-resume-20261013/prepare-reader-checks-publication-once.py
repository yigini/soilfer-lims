from pathlib import Path
import ast,json
w=Path(__file__).resolve().parents[2];h=w/'WP/backlog-resume-20261013';target=h/'publish-kit-reader-checks519-once.py';assert not target.exists()
s=(h/'publish-kit-reader-init512-pragma-state-once.py').read_text(encoding='utf8')
def once(a,b):
 global s
 assert s.count(a)==1,(a,s.count(a));s=s.replace(a,b)
once("reader-init512-pragma-state-publication-notes-once.txt","reader-checks519-publication-notes-once.txt")
once("D=K/'reader-init512-pragma-state-publication-once'","D=K/'reader-checks519-publication-once'")
once("=='584ef7f07070e03607adc06d7ef7739d529c590c'","=='1fc491225a78f8d10c61d801d28d159edbc9a99a'")
once("runs=['reader-init512-first','reader-init512-second']","runs=['reader-checks519-first']")
once("zip(runs,[0,0],[512,512],[222,222],['OK','OK'])","zip(runs,[0],[519],[225],['OK'])")
once("assert len(prior_names)==42","prior_names.append('reader-init512-pragma-state-publication-once/new-local-fixtures-hash-inventory.json')\nassert len(prior_names)==43")
once("reader_init_cases={}\n","reader_init_cases={};reader_checks_cases={}\n")
anchor="import sys\nsys.path.insert(0,str(K))"
scan="""   if relative.startswith('reader-check-local-retained-fixtures/'):
    if path.parent.name in ('setup','checks','hazard') and path.name in ('stdout-original.json','exit-original.json'):
     case=reader_checks_cases.setdefault(path.parent.parent.relative_to(K).as_posix(),{})
     case[path.parent.name+'/'+path.name]={'path':relative,'bytes':len(raw),'sha256':sha(raw),'value':json.loads(raw)}
    elif path.name in ('plain-pragma-plan-before-read.json','actual-python-logical-original.json'):
     case=reader_checks_cases.setdefault(path.parent.relative_to(K).as_posix(),{})
     case[path.name]={'path':relative,'bytes':len(raw),'sha256':sha(raw),'value':json.loads(raw)}
"""
once(anchor,scan+anchor)
summary="""plain_check_rows=[];check_hazard_rows=[]
def original_pin(row):return {q:row[q] for q in ('path','bytes','sha256')}
for folder,case in sorted(reader_checks_cases.items()):
 if 'checks/stdout-original.json' in case:
  initial=case['setup/stdout-original.json']['value'];out=case['checks/stdout-original.json'];value=out['value'];plan_original=case['plain-pragma-plan-before-read.json'];plan=plan_original['value']
  assert case['setup/exit-original.json']['value']['exitCode']==case['checks/exit-original.json']['value']['exitCode']==0
  assert initial['newFixtureOnly'] and value['sourceId']=='2026-01-09 17:27:48 b270f8339eb13b504d0b2ba154ebca966b7dde08e40c3ed7d559749818cb2075'
  assert value['version']=='3.51.2' and value['platform']=='win32' and value['tempStore']==2 and value['mainUnchanged']
  assert len(value['cases'])==6 and value['cases'][0]['rows']==[['ok']]
  bad=initial['fkViolationsIntentional'];assert bad==value['fkViolationsIntentional']
  assert len(value['cases'][1]['rows'])==(2 if bad else 0)
  if bad:assert any(x[1] is None for x in value['cases'][1]['rows'])
  assert plan['plainSchemaRestrictionsAreDeclarationsOnly'] and not plan['actualSchemaRestrictionsVerified'] and not plan['beforeInitialReaderSqlAdmissionImplemented']
  assert all(not any(r['opcode'] in ('SorterOpen','OpenEphemeral','OpenAutoindex','OpenWrite','VCheck','Function','PureFunc') for r in x['program']) for x in value['cases'])
  assert all(r['p2']==0 for x in value['cases'] for r in x['program'] if r['opcode']=='Transaction')
  py=case.get('actual-python-logical-original.json');assert bool(py)==(not bad)
  plain_check_rows.append({'folder':folder,'stdoutOriginal':original_pin(out),'planOriginal':original_pin(plan_original),'pythonOriginal':original_pin(py) if py else None,'pythonEngineVersionObserved':py['value']['versionObserved'] if py else None,'pageSize':initial['page'],'intentionalForeignKeyViolations':bad,'foreignKeyDiagnosticRows':len(value['cases'][1]['rows']),'directPragmaExecutions':6,'mainFullShaPreserved':True,'restrictedSchemaDeclarationsOnly':True,'actualSchemaRestrictionsVerified':False,'actualNativeTemporaryBtreeCallsMeasured':False,'readerSqliteBinaryToPinnedNativeSourceVerified':False,'beforeInitialReaderSqlAdmissionImplemented':False,'physicalFilesystemClosureClaimed':False})
 if 'hazard/stdout-original.json' in case:
  initial=case['setup/stdout-original.json']['value'];out=case['hazard/stdout-original.json'];value=out['value']
  assert case['setup/exit-original.json']['value']['exitCode']==case['hazard/exit-original.json']['value']['exitCode']==0
  assert initial['newFixtureOnly'] and initial['checkExpressionAndCallbackIntentional']
  assert value['sourceId']=='2026-01-09 17:27:48 b270f8339eb13b504d0b2ba154ebca966b7dde08e40c3ed7d559749818cb2075' and value['tempStore']==2 and value['mainUnchanged']
  opens=sum(r['opcode']=='OpenEphemeral' for r in value['program']);functions=sum(r['opcode'] in ('Function','PureFunc') for r in value['program'])
  assert opens>0 and functions>0 and value['callbacks']>=3 and value['integrity']==[{'integrity_check':'ok'}] and not value['sourcePlanApplicableToExpressionFixture']
  check_hazard_rows.append({'folder':folder,'stdoutOriginal':original_pin(out),'pageSize':initial['page'],'staticOpenEphemeralSites':opens,'staticScalarFunctionSites':functions,'actualTestUdfCallbackInvocations':value['callbacks'],'sourcePlanApplicableToExpressionFixture':False,'directPragmaExecutions':1,'mainFullShaPreserved':True,'actualNativeTemporaryBtreeCallsMeasured':False,'continuousPeakMeasured':False,'physicalFilesystemClosureClaimed':False})
assert len(plain_check_rows)==6*len(runs) and sum(r['intentionalForeignKeyViolations'] for r in plain_check_rows)==3*len(runs) and len(check_hazard_rows)==3*len(runs)
save(D,'new-native-reader-pragma-check-summary.json',canonical({'plainParameterCaseExecutions':len(plain_check_rows),'readonlyExpressionHazardCaseExecutions':len(check_hazard_rows),'nativeLocalCommandExecutions':18*len(runs),'rawPythonLogicalInvocations':3*len(runs),'directNativePragmaExecutions':sum(r['directPragmaExecutions'] for r in plain_check_rows+check_hazard_rows),'plainCases':plain_check_rows,'readonlyExpressionHazardCases':check_hazard_rows,'sourceBytesReadOnlyFromNewFixtureDelta':True,'restrictedSchemaDeclarationsOnly':True,'readonlyAloneImpliesNoScratch':False,'actualSchemaRestrictionsVerified':False,'collectorBindingImplemented':False,'actualNativeTemporaryBtreeCallsMeasured':False,'readerSqliteBinaryToPinnedNativeSourceVerified':False,'beforeInitialReaderSqlAdmissionImplemented':False,'wholeLogicalReaderSqlScratchInventoryComplete':False,'continuousPeakMeasured':False,'physicalFilesystemClosureClaimed':False})+b'\\n')
"""
once("save(D,'new-local-fixtures-hash-inventory.json'",summary+"save(D,'new-local-fixtures-hash-inventory.json'")
once("prior_external=K/'reader-schema505-constant-successor-publication-once/new-external-runtime-hash-inventory.json'","prior_external=K/'reader-init512-pragma-state-publication-once/new-external-runtime-hash-inventory.json'")
once("'tests':512,'uniqueTests':512,'sourceFiles':222","'tests':519,'uniqueTests':519,'sourceFiles':225")
once("'pragmaControlsSchemaStateSideEffectFreeNowRequired':True,'prior512PassSupersededByStrongerDeclaration':True,","'conditionalPlainSchemaReaderPragmaBodiesDerived':True,'readerPragmaChecksSourceFiles':87,'readerPragmaChecksNativeExcerpts':70,'readerPragmaChecksSourceProofSha256':sha((K/'reader-pragma-checks-source.json').read_bytes()),'plainPragmaNativeCases':len(plain_check_rows),'readonlyExpressionHazardNativeCases':len(check_hazard_rows),'actualSchemaRestrictionsVerified':False,'readonlyAloneImpliesNoScratch':False,'pragmaControlsSchemaStateSideEffectFreeNowRequired':True,")
once("'actualAutomaticWakeObservedUtc':'2026-10-17T10:38:46.295Z'","'actualAutomaticWakeObservedUtc':'2026-10-17T11:00:46.462Z'")
once("'sourceAggregateTruncationDisclosed':False","'sourceAggregateTruncationDisclosed':True")
once("WP/backlog-resume-20261013/reader-init505-entry-1038-once","WP/backlog-resume-20261013/reader-checks512-entry-1100-once")
start=s.index("for name in ['prepare-reader-initialization-source-once.py'");end=s.index("\n extras.add",start)
s=s[:start]+"for name in ['prepare-reader-pragma-checks-source-once.py','prepare-reader-checks-publication-once.py','reader-checks519-publication-notes-once.txt']:"+s[end:]
once("feat(release): derive conditional native reader initialization scratch","feat(release): derive restricted reader pragma scratch bodies")
ast.parse(s);target.write_text(s,encoding='utf8',newline='');print(json.dumps({'publisherPrepared':str(target),'executed':False,'expectedFullRunTests':519,'expectedSources':225,'priorInventories':43,'oldPrivatePayloadsRead':False}))
