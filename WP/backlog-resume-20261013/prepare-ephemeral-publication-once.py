import ast,json,pathlib
h=pathlib.Path('WP/backlog-resume-20261013');s=(h/'publish-kit-linux-sorter-vfs470-app-recovery-once.py').read_text(encoding='utf8')
s=s.replace('linux-sorter-vfs470-app-recovery-publication-notes-once.txt','ephemeral-btree477-publication-notes-once.txt')
s=s.replace("D=K/'linux-sorter-vfs470-app-recovery-publication-once'","D=K/'ephemeral-btree477-publication-once'")
s=s.replace("=='6e4d1d64813e79043c2bdf0326cfd077c6e06866'","=='e765e6c909fee012792bcfe5ee258b9265d46617'")
s=s.replace("runs=['linux-sorter-vfs470-app-recovery-second']","runs=['ephemeral-btree477-first']")
s=s.replace("zip(runs,[0],[470],[204],['OK'])","zip(runs,[0],[477],[207],['OK'])")
s=s.replace("assert len(prior_names)==36","prior_names.append('linux-sorter-vfs470-app-recovery-publication-once/new-local-fixtures-hash-inventory.json')\nassert len(prior_names)==37")
s=s.replace('fixtures=[];sorter_cases={};unix_cases={};unix_analogs=[]','fixtures=[];sorter_cases={};unix_cases={};unix_analogs=[];ephemeral_cases={}')
needle='import sys\nsys.path.insert'
at=s.index(needle)
collect="""   if relative.startswith('ephemeral-btree-local-retained-fixtures/') and path.name in ('stdout-original.json','conditional-ephemeral-plan.json','conditional-rhs-plan.json','exit-original.json'):
    case=ephemeral_cases.setdefault(path.parent.relative_to(K).as_posix(),{})
    case[path.name]={'path':relative,'bytes':len(raw),'sha256':sha(raw),'value':json.loads(raw)}
"""
s=s[:at]+collect+s[at:]
s=s.replace("assert 8<=len(rows)<=16 and 3<=sum(r['mode']=='rollback' for r in rows)<=6","assert len(rows)==8 and sum(r['mode']=='rollback' for r in rows)==3")
s=s.replace("'additionalCompletedFixturesMayComeFromCrashInterruptedPriorRun':True,'incompletePriorRunPassNotInferred':True,","")
s=s.replace("assert 1<=len(unix_rows)<=2 and 1<=len(unix_analogs)<=2","assert len(unix_rows)==len(unix_analogs)==1")
at=s.index("save(D,'new-local-fixtures-hash-inventory.json'")
body="""ephemeral_rows=[]
inventory_by_path={r['path']:r for r in fixtures}
for folder,case in sorted(ephemeral_cases.items()):
 if 'stdout-original.json' not in case:continue
 original=case['stdout-original.json'];vcase=original['value']
 assert case['exit-original.json']['value']['exitCode']==0
 assert vcase['version']=='3.51.2' and vcase['sourceId']=='2026-01-09 17:27:48 b270f8339eb13b504d0b2ba154ebca966b7dde08e40c3ed7d559749818cb2075'
 assert vcase['platform']=='win32' and vcase['mainUnchanged'] is True
 opens=[r for r in vcase['program'] if r['opcode']=='OpenEphemeral'];assert len(opens)==1
 status='conditional-rhs-plan.json' in case;plan_name='conditional-rhs-plan.json' if status else 'conditional-ephemeral-plan.json'
 assert vcase['rows']==([dict(id=str(n),sampleId='s',analysis='a') for n in range(4)] if status else 1024)
 snapshots=[]
 for snapshot in vcase.get('snapshots',[]):
  path=pathlib.Path(snapshot['original']).relative_to(K).as_posix();pin=inventory_by_path[path];assert pin['bytes']==snapshot['bytes']
  snapshots.append({'original':{q:pin[q] for q in ('path','bytes','sha256')},'observedPageSize':snapshot['pageSize'],'headerPagesField':snapshot['headerPages']})
 if not status:assert vcase['callbacks']==1024 and not vcase['linuxVfsTested'] and not vcase['actualNativeFileCallsMeasured']
 ephemeral_rows.append({'folder':folder,'stdoutOriginal':{q:original[q] for q in ('path','bytes','sha256')},
  'planOriginal':{q:case[plan_name][q] for q in ('path','bytes','sha256')},'kind':'RAW_ORDER_STATUS_RHS' if status else vcase['kind'],
  'requestedMainPageSize':vcase.get('requestedMainPageSize'),'rows':4 if status else 1024,
  'staticOpenEphemeralOpcodes':len(opens),'staticRhsIdxInsertOpcodes':sum(r['opcode']=='IdxInsert' and r['p1']==opens[0]['p1'] for r in vcase['program']),
  'samplePoints':len(vcase.get('samples',[])),'maximumSampledFileBytes':max((r['bytes'] for r in vcase.get('samples',[])),default=0),
  'temporaryFileSnapshots':snapshots,'mainBytesUnchanged':True,'runtimeEphemeralPageSizeVerified':False,
  'linuxVfsTested':False,'actualNativeFileCallsMeasured':False,'continuousPeakMeasured':False,'fullLifetimeOriginalsRetained':False,'physicalFilesystemClosureClaimed':False})
assert len(ephemeral_rows)==7 and sum(r['kind']=='RAW_ORDER_STATUS_RHS' for r in ephemeral_rows)==1
save(D,'new-native-ephemeral-case-summary.json',canonical({'caseExecutions':len(ephemeral_rows),'materializationCaseExecutions':6,'rawOrderStatusQueryCaseExecutions':1,'cases':ephemeral_rows,
 'samplePoints':sum(r['samplePoints'] for r in ephemeral_rows),'temporaryFileSnapshots':sum(len(r['temporaryFileSnapshots']) for r in ephemeral_rows),
 'snapshotPageSizes':sorted({s['observedPageSize'] for r in ephemeral_rows for s in r['temporaryFileSnapshots']}),
 'sourceBytesReadOnlyFromNewFixtureDelta':True,'wholeStatementScratchInventoryComplete':False,
 'actualNativeFileCallsMeasured':False,'continuousPeakMeasured':False,'physicalFilesystemClosureClaimed':False})+b'\\n')
"""
s=s[:at]+body+s[at:]
s=s.replace("prior_external=K/'sorter-scratch463-publication-once/new-external-runtime-hash-inventory.json'","prior_external=K/'linux-sorter-vfs470-app-recovery-publication-once/new-external-runtime-hash-inventory.json'")
s=s.replace("'tests':470,'uniqueTests':470,'sourceFiles':204","'tests':477,'uniqueTests':477,'sourceFiles':207")
s=s.replace(",'crashInterruptedPriorRunStatus':'INCOMPLETE_NO_CLOSED_RESULT','crashRecoveryRecord':'WP/backlog-resume-20261013/linux-sorter-vfs470-app-crash-recovery-once/incomplete-run-record.json'","")
s=s.replace("'conditionalUnixSorterFileLengthSourceProofImplemented':True,","'conditionalEphemeralLogicalContentBoundImplemented':True,'ephemeralSourceFiles':56,'ephemeralNativeExcerpts':20,\n 'ephemeralSourceProofSha256':sha((K/'ephemeral-btree-source.json').read_bytes()),'nativeEphemeralCaseExecutions':len(ephemeral_rows),\n 'wholeSqlStatementScratchInventoryComplete':False,'runtimeEphemeralPageSizeVerified':False,\n 'conditionalUnixSorterFileLengthSourceProofImplemented':True,")
s=s.replace("'actualAutomaticWakeObservedUtc':'2026-10-17T08:17:03.457Z'","'actualAutomaticWakeObservedUtc':'2026-10-17T08:45:15.194Z','actualPostCrashAutomaticWakeObserved':True")
s=s.replace("'exploratoryMissingMetadataFilenameAndExcerptKeyDiagnosticsTranscribedOnly':True","'exploratoryProofFilesKeyAndPrewriteLiteralAssertionDiagnosticsTranscribedOnly':True,'sourcePreparationPolicyRefusedBeforeLaunch':True")
s=s.replace("for folder in [K/('local-tests-'+run) for run in runs]+[K/'local-tests-linux-sorter-vfs470-first']:","for folder in [K/('local-tests-'+run) for run in runs]:")
start=s.index("extras|={p for p in (W/'WP/backlog-resume-20261013/sorter-vfs463-entry-0817-once')")
s=s[:start]+"""extras|={p for p in (W/'WP/backlog-resume-20261013/temp-btree470-entry-0845-once').iterdir() if p.is_file()}
for name in ['prepare-ephemeral-btree-source-text-successor-once.py','prepare-ephemeral-publication-once.py','ephemeral-btree477-publication-notes-once.txt']:
 extras.add(W/'WP/backlog-resume-20261013'/name)
extras.add(pathlib.Path(__file__).resolve())
print(json.dumps(boundary_publish(D,extras,'feat(release): bound fresh ephemeral B-tree logical growth',notes)))
"""
ast.parse(s);p=h/'publish-kit-ephemeral-btree477-once.py';assert not p.exists();p.write_text(s,encoding='utf8')
record={'scope':'DERIVED_TRANSCRIPTION_OF_TOOL_DIAGNOSTICS','sourcePreparationCommandPolicyRefusedBeforeLaunch':True,'policyReasonReported':'blocked by policy; no further reason supplied','refusedHelperOrProofExistsAfterCheck':False,'originalStderrOrPolicyDiagnosticFileRetained':False,'laterPrewriteLiteralAssertionRefusedBeforeSourceWrite':True,'exploratoryMissingProofFilesKey':'files','allTheseDiagnosticsToolOutputTranscriptionsOnly':True,'operatorExecuted':False,'oldPrivatePayloadsRead':False}
p=h/'temp-btree470-entry-0845-once/preparation-diagnostic-transcription.json';p.write_text(json.dumps(record,sort_keys=True,indent=2),encoding='utf8')
print('New unique ephemeral publisher prepared/AST-checked; not executed; frozen K unchanged.')