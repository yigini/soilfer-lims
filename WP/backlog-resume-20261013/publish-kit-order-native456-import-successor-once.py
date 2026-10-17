import pathlib
endpoints={'main': 'repos/yigini/soilfer-lims/git/ref/heads/main', 'main-ci': 'repos/yigini/soilfer-lims/actions/runs/38772398721', 'issue191': 'repos/yigini/soilfer-lims/issues/191', 'pr207': 'repos/yigini/soilfer-lims/pulls/300', 'pr208': 'repos/yigini/soilfer-lims/pulls/299', 'ci207': 'repos/yigini/soilfer-lims/actions/runs/38956418902', 'ci208': 'repos/yigini/soilfer-lims/actions/runs/38953786365', 'release-comments': 'repos/yigini/soilfer-lims/issues/162/comments?since=2026-10-17T04:00:22Z&per_page=100', 'audit207-comments': 'repos/yigini/soilfer-lims/issues/300/comments?since=2026-10-16T20%3A23%3A55Z&per_page=100', 'audit208-comments': 'repos/yigini/soilfer-lims/issues/299/comments?since=2026-10-16T20%3A03%3A51Z&per_page=100'}
prior_names=['shared-evidence161-publication-once/all-local-fixtures-hash-inventory.json', 'emergency-http176-inventory-successor-publication-once/new-local-fixtures-hash-inventory.json', 'prestart188-fixed-envelopes-publication-once/new-local-fixtures-hash-inventory.json', 'apache199-copy-prewrite-publication-once/new-local-fixtures-hash-inventory.json', 'copy-admissions208-publication-once/new-local-fixtures-hash-inventory.json', 'seal-sqlite212-exact-verdict-successor-publication-once/new-local-fixtures-hash-inventory.json', 'reader-live-backup221-publication-once/new-local-fixtures-hash-inventory.json', 'live-backup-journal225-publication-once/new-local-fixtures-hash-inventory.json', 'application-snapshots234-publication-once/new-local-fixtures-hash-inventory.json', 'order-output242-publication-once/new-local-fixtures-hash-inventory.json', 'controller-output253-publication-once/new-local-fixtures-hash-inventory.json', 'cli-pipes263-publication-once/new-local-fixtures-hash-inventory.json', 'capture-owners276-publication-once/new-local-fixtures-hash-inventory.json', 'capture-copy288-actual-audits-successor-publication-once/new-local-fixtures-hash-inventory.json', 'capture-science297-publication-once/new-local-fixtures-hash-inventory.json', 'capture-review304-crlf-successor-publication-once/new-local-fixtures-hash-inventory.json', 'capture-controller317-publication-once/new-local-fixtures-hash-inventory.json', 'capture-launch333-publication-once/new-local-fixtures-hash-inventory.json', 'target-reader340-publication-once/new-local-fixtures-hash-inventory.json', 'sqlite-temp347-publication-once/new-local-fixtures-hash-inventory.json', 'rollback355-publication-once/new-local-fixtures-hash-inventory.json', 'capture-journal364-publication-once/new-local-fixtures-hash-inventory.json', 'capture-journal-package371-publication-once/new-local-fixtures-hash-inventory.json', 'main-growth378-publication-once/new-local-fixtures-hash-inventory.json', 'capture-native386-publication-once/new-local-fixtures-hash-inventory.json', 'schema-collection393-publication-once/new-local-fixtures-hash-inventory.json', 'capture-main400-publication-once/new-local-fixtures-hash-inventory.json', 'linux-main-vfs407-publication-once/new-local-fixtures-hash-inventory.json', 'statement-journal414-direction-successor-publication-once/new-local-fixtures-hash-inventory.json', 'capture-statement421-publication-once/new-local-fixtures-hash-inventory.json', 'wal-content428-publication-once/new-local-fixtures-hash-inventory.json','readonly-target-wal435-publication-once/new-local-fixtures-hash-inventory.json','wal-dirty442-publication-once/new-local-fixtures-hash-inventory.json','wal-binding449-publication-once/new-local-fixtures-hash-inventory.json']
NOTES=pathlib.Path(__file__).with_name('order-native456-publication-notes-once.txt').read_text(encoding='utf-8')
from concurrent.futures import ThreadPoolExecutor
from prechecks6210209468_boundary_publication import *
K=W/'WP/batch-release-kit-be837974-20261016'
D=K/'order-native456-import-successor-publication-once'
R=W/'WP/backlog-resume-20261013/actual207208-source-passes6224662770-6224793665-once'
review=json.loads((R/'independent-verdict-and-deferral-review.json').read_bytes())
assert review['mainMergeHold'] and review['commentsLabelsReadyMergesCreated']==0
assert not D.exists() and git('rev-parse','HEAD').decode().strip()=='86675b5f8659e6c6533b2ab7ffae9441749ebae2'
assert not git('diff','--cached','--name-only').strip()
runs=['order-native456-first','order-native456-second']
closed=[]
for label,exit_code,count,sources,ending in zip(runs,[0,0],[456]*2,[198]*2,['OK','OK']):
 folder=K/('local-tests-'+label);value=json.loads((folder/'verification.json').read_bytes());log=(folder/'stderr-original.txt').read_text(encoding='utf-8')
 assert value['exitCode']==exit_code and value['sourceBefore']==value['sourceAfter'] and len(value['sourceBefore'])==sources
 assert 'Ran '+str(count)+' tests in ' in log and log.rstrip().endswith(ending)
 rows=[line.split(' ... ')[0] for line in log.splitlines() if line.startswith('test_') and ' ... ' in line]
 assert len(rows)==len(set(rows))==count;closed.append(value)
v=closed[-1]
log=(K/('local-tests-'+runs[-1])/'stderr-original.txt').read_text(encoding='utf-8')
test_summary=[line for line in log.splitlines() if line.startswith('Ran ')]
assert len(test_summary)==1
assert all(sha((K/name).read_bytes())==digest for name,digest in v['sourceBefore'].items())
assert not (K/'copy-site-closure.json').exists() and not list(K.glob('release-package-*'))
whitespace=subprocess.run(['git','-c','core.whitespace=blank-at-eol,blank-at-eof,space-before-tab,cr-at-eol','diff','--check','--',str(K.relative_to(W))],cwd=W,capture_output=True);assert whitespace.returncode==0
D.mkdir();save(D,'fresh-whitespace-stdout-original.txt',whitespace.stdout);save(D,'fresh-whitespace-stderr-original.txt',whitespace.stderr)
def fetch(item):
 name,endpoint=item;raw=subprocess.check_output(['gh','api',endpoint],cwd=W);save(D,'api-'+name+'-original.json',raw);return name,raw
with ThreadPoolExecutor(max_workers=4) as pool:raws=dict(pool.map(fetch,endpoints.items()))
current={name:json.loads(raw) for name,raw in raws.items()}
assert current['main']['object']['sha']==current['main-ci']['head_sha']=='be8379745bdfae52ce46496ff26514dc7d729640'
assert current['main-ci']['status']=='completed' and current['main-ci']['conclusion']=='success' and current['issue191']['state']=='closed'
for label,head in [('207','f83f3cddfee97f9115737ae85a07650c83cef885'),('208','153f10e6bac02b1a962213431141fd1c54906e99')]:
 assert current['pr'+label]['head']['sha']==current['ci'+label]['head_sha']==head
 assert current['ci'+label]['run_attempt']==1 and current['ci'+label]['event']=='pull_request'
 assert current['ci'+label]['status']=='completed' and current['ci'+label]['conclusion']=='success'
for name in ('release-comments','audit207-comments','audit208-comments'):
 assert len(current[name])<100
 actual=[row for row in current[name] if (row.get('performed_via_github_app') or {}).get('id')==1236702]
 if name=='release-comments':
  original=json.loads((K/'statement-journal414-publication-once/api-release-comments-original.json').read_bytes())
  expected={row['id']:row for row in original}
  assert set(expected)=={6229374245,6229865723}
  assert {row['id'] for row in current[name]}==set(expected) and len(actual)==2
  for row in actual:
   prior=expected[row['id']]
   timestamp={6229374245:'2026-10-17T04:00:23Z',6229865723:'2026-10-17T04:54:29Z'}[row['id']]
   assert row['created_at']==row['updated_at']==prior['created_at']==prior['updated_at']==timestamp
   assert row['body']==prior['body'] and row['performed_via_github_app']['id']==1236702
 else:
  label='207' if name=='audit207-comments' else '208';expected=review['results'][label]
  assert len(actual)==1 and actual[0]['id']==expected['sourceAuditId']
  assert actual[0]['created_at']==actual[0]['updated_at']==expected['createdAt']
  assert sha(actual[0]['body'].encode())==expected['verdictBodySha256']
  assert sha(current['pr'+label]['body'].encode())==expected['updatedDescriptionSha256']
known=set();refs=[]
for name in prior_names:
 path=K/name;raw=path.read_bytes();known.update(row['path'] for row in json.loads(raw)['fixtures'])
 refs.append({'path':path.relative_to(W).as_posix(),'sha256':sha(raw),'gitBlobOid':oid(raw)})
fixtures=[];wal_cases={};dirty_cases={};index_cases={};order_cases={};order_bodies=[]
for directory in sorted(K.glob('*-local-retained-fixtures')):
 for path in sorted(directory.rglob('*')):
  if not path.is_file() or path.relative_to(K).as_posix() in known:continue
  raw=path.read_bytes();info=path.stat();fixtures.append({'path':path.relative_to(K).as_posix(),'bytes':len(raw),'sha256':sha(raw),'localModeObserved':info.st_mode&511,'localLinksObserved':info.st_nlink})
  if path.relative_to(K).as_posix().startswith('wal-content-local-retained-fixtures/') and path.name in ('stdout-original.jsonl','conditional-plan.json'):
   case=wal_cases.setdefault(path.parent.relative_to(K).as_posix(),{})
   case[path.name]={'path':path.relative_to(K).as_posix(),'bytes':len(raw),'sha256':sha(raw),
       'value':[json.loads(line) for line in raw.splitlines()] if path.name=='stdout-original.jsonl' else json.loads(raw)}

  if path.relative_to(K).as_posix().startswith('wal-dirty-inventory-local-retained-fixtures/') and path.name in ('stdout-original.jsonl','source-derived-plan.json'):
   case=dirty_cases.setdefault(path.parent.relative_to(K).as_posix(),{})
   case[path.name]={'path':path.relative_to(K).as_posix(),'bytes':len(raw),'sha256':sha(raw),
       'value':[json.loads(line) for line in raw.splitlines()] if path.name=='stdout-original.jsonl' else json.loads(raw)}
  if path.relative_to(K).as_posix().startswith('wal-binding-local-retained-fixtures/') and path.name in ('stdout-original.json','index-pair-observation.json'):
   case=index_cases.setdefault(path.parent.relative_to(K).as_posix(),{})
   case[path.name]={'path':path.relative_to(K).as_posix(),'bytes':len(raw),'sha256':sha(raw),'value':json.loads(raw)}
  if path.relative_to(K).as_posix().startswith('order-native-local-retained-fixtures/'):
   if path.name in ('stdout-original.jsonl','conditional-order-plan.json','main-after-close-original'):
    case=order_cases.setdefault(path.parent.relative_to(K).as_posix(),{})
    case[path.name]={'path':path.relative_to(K).as_posix(),'bytes':len(raw),'sha256':sha(raw),
        'value':([json.loads(line) for line in raw.splitlines()] if path.name=='stdout-original.jsonl' else json.loads(raw)) if path.name!='main-after-close-original' else raw}
   elif path.name=='stdout-original.json':
    value=json.loads(raw);assert value['unmodified209RawBodyExecuted'] is True and value['prerequisiteApprovalsExplicitStandins'] is True
    assert value['result']['mode']=='APPLIED' and value['result']['classification']=='COMPLETE_209' and value['result']['originalRowsPreserved'] is True
    assert len(value['rows'])==12 and all(row['workItemId'] is None for row in value['rows'])
    order_bodies.append({'path':path.relative_to(K).as_posix(),'bytes':len(raw),'sha256':sha(raw),
      'previousClassification':value['result']['previousClassification'],'classification':value['result']['classification'],
      'oldRows':len(value['rows']),'allNewLinksNull':True,'originalRowsPreserved':True,
      'prerequisiteApprovalsExplicitStandins':True,'rawDdlFilesystemPathExplicitStandin':True,
      'fullPredecessorInstallerChainExecuted':False,'actualNativeFrameRequestsMeasured':False})
import sys
sys.path.insert(0,str(K))
from verify_kit_capture_native_inventory import payload_sizes
order_rows=[]
for folder,case in sorted(order_cases.items()):
 assert set(case)=={'stdout-original.jsonl','conditional-order-plan.json','main-after-close-original'}
 initial,after=case['stdout-original.jsonl']['value'];plan=case['conditional-order-plan.json']['value'];inv=plan['inventory'];native=inv['nativeInventory'];size=inv['pageSize']
 assert after['oldRowsPreserved'] and after['mainBeforeCloseUnchanged'] and after['initialPrefixPreserved'] and after['integrity']=='ok'
 sizes=[] if after['rolled'] else payload_sizes(case['main-after-close-original']['value'],size,after['indexRoot'])
 assert after['rolled'] or len(sizes)==native['declaredOrderLineRows']==96 and max(sizes)<=32
 if 'schemaAfter' in after and after['rolled']:assert after['schemaAfter']==initial['schema']['rows'] and after['receiptRows']==0
 order_rows.append({'folder':folder,'stdoutOriginal':{q:case['stdout-original.jsonl'][q] for q in ('path','bytes','sha256')},
   'planOriginal':{q:case['conditional-order-plan.json'][q] for q in ('path','bytes','sha256')},
   'mainAfterCloseOriginal':{q:case['main-after-close-original'][q] for q in ('path','bytes','sha256')},
   'pageSize':size,'mode':'rollback' if after['rolled'] else 'commit','sourceProofSha256':inv['sourceProofSha256'],
   'declaredOrderLineRows':native['declaredOrderLineRows'],'normalNativeMutations':sum(r['calls'] for r in native['operations']['normalInsertions']),
   'maximumPagerWriteCalls':inv['maximumPagerWriteCalls'],'derivedMaximumPageFrameEntries':inv['targetFrameInventory']['maximumPageFrameEntries'],
   'conditionalMaximumWalContentBytes':plan['observation']['bound']['maximumWalLogicalContentBytes'],
   'samplePoints':len(after['samples']),'maximumSampledWalBytes':max(after['samples']),
   'actualIndexCellsParsed':len(sizes) if sizes else None,'maximumActualSerializedIndexPayloadBytes':max(sizes) if sizes else None,
   'oldRowsPreserved':True,'newLinksAllNull':after['nullLinks']==96 if not after['rolled'] else None,
   'exactRollbackSchemaAndReceiptExplicitlyAsserted':'schemaAfter' in after and after['rolled'],
   'mainBeforeCloseUnchanged':True,'initialCommittedWalPrefixPreserved':True,
   'actualNativeFrameRequestsMeasured':False,'continuousPeakMeasured':False,'fullInstallerChainExecuted':False,
   'physicalFilesystemClosureClaimed':False})
assert len(order_rows)==12 and sum(r['mode']=='rollback' for r in order_rows)==6 and len(order_bodies)==2
save(D,'new-native-order-case-summary.json',canonical({'parameterCasesPerRun':6,'closedRuns':2,'caseExecutions':12,
 'samplePoints':sum(r['samplePoints'] for r in order_rows),'cases':order_rows,'unmodifiedBodyFixtureExecutions':order_bodies,
 'actualNativeFrameRequestsMeasured':False,'wholeOwnerFrameInventoryVerified':False,'runtimeLinuxBuildAttested':False,
 'onlyNewFixtureDeltaPayloadsRead':True,'physicalFilesystemClosureClaimed':False})+b'\n')
index_rows=[]
for folder,case in sorted(index_cases.items()):
 assert set(case)=={'stdout-original.json','index-pair-observation.json'}
 native=case['stdout-original.json']['value'];record=case['index-pair-observation.json']['value'];check=record['indexCheck']
 assert native['before']==native['after'] and native['integrity']=='ok' and native['runtimeLinuxBuildAttested'] is False
 assert check['walIndexByteConsistencyVerified'] is True and record['nativeRecoveryExecutionVerified'] is False
 index_rows.append({'folder':folder,'stdoutOriginal':{q:case['stdout-original.json'][q] for q in ('path','bytes','sha256')},
  'pairObservationOriginal':{q:case['index-pair-observation.json'][q] for q in ('path','bytes','sha256')},
  'pageSize':check['pageSize'],'declaredNativeByteOrder':check['declaredNativeByteOrder'],
  'mappedFrameEntries':check['mappedFrameEntries'],'regions':check['regions'],'walOriginal':check['walOriginal'],
  'indexOriginal':check['indexOriginal'],'mainAndWalUnchangedBeforeClose':True,'fullIndexBytesVerified':True,
  'nativeRecoveryExecutionVerified':False,'kernelLocksOrQuiescenceVerified':False,'runtimeLinuxBuildAttested':False,
  'scientificOwnerExecuted':False,'physicalFilesystemClosureClaimed':False})
assert len(index_rows)==6 and {r['pageSize'] for r in index_rows}=={512,4096,65536}
assert next(r for r in index_rows if r['pageSize']==512)['regions']>1
save(D,'new-native-recovered-index-summary.json',canonical({'parameterCasesPerRun':3,'closedRuns':2,'caseExecutions':6,
 'cases':index_rows,'onlyNewFixtureDeltaPayloadsRead':True,'nativeRecoveryExecutionVerified':False,
 'kernelLocksOrQuiescenceVerified':False,'runtimeLinuxBuildAttested':False,'physicalFilesystemClosureClaimed':False})+b'\n')
dirty_rows=[]
for folder,case in sorted(dirty_cases.items()):
 assert set(case)=={'stdout-original.jsonl','source-derived-plan.json'}
 original=case['stdout-original.jsonl'];initial,after=original['value'];record=case['source-derived-plan.json']['value']
 inv=record['inventory'];plan=record['observation'];frames=inv['targetFrameInventory']
 assert after['actualNativeFrameRequestsMeasured'] is False and after['mainUnchanged'] is True and initial['freePages']>0
 dirty_rows.append({'folder':folder,'stdoutOriginal':{q:original[q] for q in ('path','bytes','sha256')},
  'planOriginal':{q:case['source-derived-plan.json'][q] for q in ('path','bytes','sha256')},
  'label':inv['label'],'pageSize':inv['pageSize'],'mode':'rollback' if after['rolled'] else 'commit',
  'initialFreelistPages':initial['freePages'],'initialWalBytes':initial['initialWalBytes'],
  'samplePoints':len(after['samples']),'maximumSampledWalBytes':max(after['samples']+[after['walBytes']]),
  'conditionalMaximumWalContentBytes':plan['bound']['maximumWalLogicalContentBytes'],
  'maximumPagerWriteCalls':inv['maximumPagerWriteCalls'],'maximumDirtyMarksPerPagerWrite':inv['maximumDirtyMarksPerPagerWrite'],
  'derivedMaximumPageFrameEntries':frames['maximumPageFrameEntries'],'sourceProofSha256':inv['sourceProofSha256'],
  'actualNativeFrameRequestsMeasured':False,'fullApplicationInstallerChainExecuted':False,
  'continuousPeakMeasured':False,'fullLifetimeOriginalsRetained':False,'physicalFilesystemClosureClaimed':False})
assert len(dirty_rows)==24 and sum(row['mode']=='rollback' for row in dirty_rows)==12
save(D,'new-native-dirty-case-summary.json',canonical({'parameterCasesPerRun':12,'closedRuns':2,'caseExecutions':24,
 'samplePoints':sum(row['samplePoints'] for row in dirty_rows),'cases':dirty_rows,
 'actualNativeFrameRequestsMeasured':False,'wholeOwnerFrameInventoryVerified':False,
 'sourceBytesReadOnlyFromNewFixtureDelta':True,'continuousPeakMeasured':False,'physicalFilesystemClosureClaimed':False})+b'\n')
case_rows=[]
for folder,case in sorted(wal_cases.items()):
 assert set(case)=={'stdout-original.jsonl','conditional-plan.json'}
 original=case['stdout-original.jsonl'];initial,after=original['value'];plan=case['conditional-plan.json']['value']
 assert len(after['samples'])==192 and after['nativeFrameRequestInventoryMeasured'] is False and after['mainBytesUnchanged'] is True
 case_rows.append({'folder':folder,'stdoutOriginal':{q:original[q] for q in ('path','bytes','sha256')},
  'planOriginal':{q:case['conditional-plan.json'][q] for q in ('path','bytes','sha256')},
  'pageSize':plan['bound']['pageSize'],'mode':'rollback' if after['rolled'] else 'commit',
  'initialWalBytes':initial['walBytes'],'samplePoints':len(after['samples']),'maximumSampledWalBytes':max(after['samples']),
  'finalBeforeCloseWalBytes':after['walBytes'],'conditionalMaximumWalContentBytes':plan['bound']['maximumWalLogicalContentBytes'],
  'initialWalPhysicalFrames':plan['walObservation']['physicalFrames'],'initialCommittedDatabasePages':plan['walObservation']['lastCommittedDatabasePages'],
  'initialMainPhysicalPages':plan['mainPhysicalPages'],'mainBytesUnchangedBeforeClose':after['mainBytesUnchanged'],
  'committedPrefixPreserved':after['committedPrefixPreserved'],'nativeFrameRequestInventoryMeasured':False,
  'continuousPeakMeasured':False,'fullLifetimeOriginalsRetained':False,'physicalFilesystemClosureClaimed':False})
assert len(case_rows)==12 and sum(row['mode']=='rollback' for row in case_rows)==6
save(D,'new-native-wal-case-summary.json',canonical({'parameterCasesPerRun':6,'closedRuns':2,'caseExecutions':12,
 'samplePoints':sum(row['samplePoints'] for row in case_rows),'cases':case_rows,
 'completeNativeFrameInventoryVerified':False,'sourceBytesReadOnlyFromNewFixtureDelta':True,
 'continuousPeakMeasured':False,'physicalFilesystemClosureClaimed':False})+b'\n')
save(D,'new-local-fixtures-hash-inventory.json',canonical({'fixtures':fixtures,'priorInventories':refs,'priorFixtureFilesNotReread':True,'newFixtureBytesPublic':False,'privateHostBytesFetched':0,'productionBytes':0})+b'\n')
external=[]
for reference in sorted(K/row['path'] for row in fixtures if row['path'].endswith('/runtime-reference.json')):
 runtime=pathlib.Path(json.loads(reference.read_bytes())['newRetainedRuntime'])
 assert runtime.is_dir() and runtime.name.startswith('cj-native-')
 rows=[]
 for path in sorted(runtime.rglob('*')):
  if path.is_file():
   raw=path.read_bytes();info=path.stat();rows.append({'path':path.relative_to(runtime).as_posix(),'bytes':len(raw),'sha256':sha(raw),'modeObserved':info.st_mode&511,'linksObserved':info.st_nlink})
 external.append({'reference':reference.relative_to(K).as_posix(),'referenceSha256':sha(reference.read_bytes()),'root':str(runtime),'files':rows})
prior_external=K/'wal-binding449-publication-once/new-external-runtime-hash-inventory.json'
prior_external_raw=prior_external.read_bytes()
save(D,'new-external-runtime-hash-inventory.json',canonical({'newRetainedRuntimes':external,'priorRuntimeFilesReread':False,'privateBytesPublished':False,'priorInventories':[{'path':prior_external.relative_to(W).as_posix(),'sha256':sha(prior_external_raw),'gitBlobOid':oid(prior_external_raw)}]})+b'\n')
when=utc();notes=NOTES.format(when=when,summary=test_summary[0],started=v['startedUtc'],closed=v['closedUtc'])
prior=(K/'README.md').read_bytes();(K/'README.md').write_bytes(notes.encode()+prior)
assert {name for name,digest in v['sourceBefore'].items() if sha((K/name).read_bytes())!=digest}=={'README.md'}
save(D,'boundary-record.json',canonical({'publishedUtc':when,'tests':456,'uniqueTests':456,'sourceFiles':198,
 'finalRun':v,'priorClosedRuns':closed[:-1],'releaseCopyEquivalents':43,'releaseDatabaseEquivalents':64,
 'captureCopyEquivalents':1641,'captureDatabaseEquivalents':2052,'captureFixedBytesBeforeMargin':31408324608,
 'captureFixedBytesAfterMargin':39260405760,'captureRootCreated':False,'releaseRootCreated':False,
 'hostCalls':0,'productionSql':0,'globalFilesystemClosure':False,'captureContentOriginals':40,
 'journalMainStatementControlOriginals':18,'conditionalDeclaredWalContentBoundImplemented':True,
 'walSourceProofSha256':sha((K/'wal-content-source.json').read_bytes()),'walSourceFiles':19,'walNativeExcerpts':20,
 'completeApplicationFrameInventory':False,'walWriterAdmissionImplemented':False,'walHeldCapacityImplemented':False,
 'walFileLengthOrVfsPreallocationBounded':False,'mainCheckpointGrowthBounded':False,'shmWriterGrowthBounded':False,
 'walNativeParameterCasesPerRun':6,'walNativeCaseExecutions':12,'walNativeSamplePoints':2304,
 'walNativeFrameRequestInventoryMeasured':False,'fullTransientOriginalsRetained':False,
 'runtimeBinaryToSourceBindingVerified':False,'runtimeDefaultVfsVerified':False,'continuousPeakMeasured':False,
 'sameByteSourceInodeSubstitutionRefused':True,'sourceDirectoryAndFileIdentitiesRetained':True,
 'sourceReviewRequested':False,'completeFilesystemQualification':False,'mainMergeHold':True,
 'actualSourceAuditResults':review['results'],'actualClaudioStatusId':6229374245,
 'actualClaudioCoordinationId':6229865723,'coordinationIsSourcePass':False,'externalAcknowledgementsSent':0,
 'actualAutomaticWakeObservedUtc':'2026-10-17T07:16:54.540Z','sameHeartbeatIntervalMinutes':2,
 'activePromptMustStayBelowCharactersAndUtf16Units':20000,'heartbeatInputGuardPassed':True,
 'dryOriginalTargetFrameInventoryDerived':True,'dryOriginalTargetProfiles':['206-dry','214-dry','209-dry'],
 'dryProofSourceFiles':62,'dryApplicationRawGitFiles':42,'dryNativeExcerpts':12,
 'dryProofSha256':sha((K/'readonly-target-wal-source.json').read_bytes()),
 'dryWholeOwnerFrameInventoryVerified':False,'applyNativeFrameInventoryCompleted':False,'restrictedPreTargetConditionalDirtyInventoryDerived':True,
 'restrictedApplyProfiles':['206-apply','214-apply'],'apply209WriterAdmissionSupported':False,'strictPre209ConditionalInventorySupported':True,
 'dirtyProofSourceFiles':31,'dirtyNativeExcerpts':38,'dirtyStaticPagerWriteOccurrences':52,
 'dirtyProofSha256':sha((K/'wal-dirty-inventory-source.json').read_bytes()),'dirtyNativeParameterCaseExecutions':24,
 'schemaToSourceCollectorBindingVerified':False,'nativeRecoveredWalIndexObserved':False,
 'sourceBoundSchemaCollectorWrapperImplemented':True,'strictFreshWalIndexByteCheckerImplemented':True,
 'walSourceBindingProofSha256':sha((K/'wal-source-binding-source.json').read_bytes()),
 'walSourceBindingSourceFiles':40,'walSourceBindingNativeExcerpts':15,'nativeRecoveryExecutionVerified':False,
 'existingWriterNonemptyShmRefusalUnchanged':True,
 'strictPre209ConditionalNativeInventoryImplemented':True,'orderNativeSourceFiles':41,'orderNativeExcerpts':13,
 'orderNativeSourceProofSha256':sha((K/'order-revision-native-source.json').read_bytes()),
 'orderNativeParameterCasesPerRun':6,'orderNativeCaseExecutions':12,'raw209BodyFixtureExecutions':2,
 'orderNativeWalAdmissionImplemented':False,'orderSorterOrSqlScratchBounded':False,
 'oldPrivateFixturePayloadsReadThisBoundary':False,'captureStatementProofSha256':sha((K/'capture-statement-journal-source.json').read_bytes())})+b'\n')
extras={path for path in K.iterdir() if path.is_file()}
for folder in [K/('local-tests-'+run) for run in runs]:extras|={path for path in folder.rglob('*') if path.is_file()}
extras.add(pathlib.Path(__file__).resolve())
extras.add(W/'WP/backlog-resume-20261013/publish-kit-order-native456-once.py')
extras|={p for p in (K/'order-native456-publication-once').iterdir() if p.is_file()}
extras|={p for p in (W/'WP/backlog-resume-20261013/order-native449-entry-0716-once').iterdir() if p.is_file()}
for path in (W/'WP/backlog-resume-20261013').iterdir():
 if path.is_file() and (path.name.startswith('prepare-order-revision-native-') or path.name=='tighten-order-native-declaration-once.py' or path.name=='order-native456-publication-notes-once.txt'):
  extras.add(path)
# All new source helpers are retained; no old publisher is executed.
print(json.dumps(boundary_publish(D,extras,'feat(release): derive strict PRE209 populated index native inventory',notes)))
