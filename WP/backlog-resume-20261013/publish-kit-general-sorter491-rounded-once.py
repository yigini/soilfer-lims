import pathlib
endpoints={'main': 'repos/yigini/soilfer-lims/git/ref/heads/main', 'main-ci': 'repos/yigini/soilfer-lims/actions/runs/38772398721', 'issue191': 'repos/yigini/soilfer-lims/issues/191', 'pr207': 'repos/yigini/soilfer-lims/pulls/300', 'pr208': 'repos/yigini/soilfer-lims/pulls/299', 'ci207': 'repos/yigini/soilfer-lims/actions/runs/38956418902', 'ci208': 'repos/yigini/soilfer-lims/actions/runs/38953786365', 'release-comments': 'repos/yigini/soilfer-lims/issues/162/comments?since=2026-10-17T04:00:22Z&per_page=100', 'audit207-comments': 'repos/yigini/soilfer-lims/issues/300/comments?since=2026-10-16T20%3A23%3A55Z&per_page=100', 'audit208-comments': 'repos/yigini/soilfer-lims/issues/299/comments?since=2026-10-16T20%3A03%3A51Z&per_page=100'}
prior_names=['shared-evidence161-publication-once/all-local-fixtures-hash-inventory.json', 'emergency-http176-inventory-successor-publication-once/new-local-fixtures-hash-inventory.json', 'prestart188-fixed-envelopes-publication-once/new-local-fixtures-hash-inventory.json', 'apache199-copy-prewrite-publication-once/new-local-fixtures-hash-inventory.json', 'copy-admissions208-publication-once/new-local-fixtures-hash-inventory.json', 'seal-sqlite212-exact-verdict-successor-publication-once/new-local-fixtures-hash-inventory.json', 'reader-live-backup221-publication-once/new-local-fixtures-hash-inventory.json', 'live-backup-journal225-publication-once/new-local-fixtures-hash-inventory.json', 'application-snapshots234-publication-once/new-local-fixtures-hash-inventory.json', 'order-output242-publication-once/new-local-fixtures-hash-inventory.json', 'controller-output253-publication-once/new-local-fixtures-hash-inventory.json', 'cli-pipes263-publication-once/new-local-fixtures-hash-inventory.json', 'capture-owners276-publication-once/new-local-fixtures-hash-inventory.json', 'capture-copy288-actual-audits-successor-publication-once/new-local-fixtures-hash-inventory.json', 'capture-science297-publication-once/new-local-fixtures-hash-inventory.json', 'capture-review304-crlf-successor-publication-once/new-local-fixtures-hash-inventory.json', 'capture-controller317-publication-once/new-local-fixtures-hash-inventory.json', 'capture-launch333-publication-once/new-local-fixtures-hash-inventory.json', 'target-reader340-publication-once/new-local-fixtures-hash-inventory.json', 'sqlite-temp347-publication-once/new-local-fixtures-hash-inventory.json', 'rollback355-publication-once/new-local-fixtures-hash-inventory.json', 'capture-journal364-publication-once/new-local-fixtures-hash-inventory.json', 'capture-journal-package371-publication-once/new-local-fixtures-hash-inventory.json', 'main-growth378-publication-once/new-local-fixtures-hash-inventory.json', 'capture-native386-publication-once/new-local-fixtures-hash-inventory.json', 'schema-collection393-publication-once/new-local-fixtures-hash-inventory.json', 'capture-main400-publication-once/new-local-fixtures-hash-inventory.json', 'linux-main-vfs407-publication-once/new-local-fixtures-hash-inventory.json', 'statement-journal414-direction-successor-publication-once/new-local-fixtures-hash-inventory.json', 'capture-statement421-publication-once/new-local-fixtures-hash-inventory.json', 'wal-content428-publication-once/new-local-fixtures-hash-inventory.json','readonly-target-wal435-publication-once/new-local-fixtures-hash-inventory.json','wal-dirty442-publication-once/new-local-fixtures-hash-inventory.json','wal-binding449-publication-once/new-local-fixtures-hash-inventory.json']
NOTES=pathlib.Path(__file__).with_name('general-sorter491-rounded-publication-notes-once.txt').read_text(encoding='utf-8')
from concurrent.futures import ThreadPoolExecutor
from prechecks6210209468_boundary_publication import *
K=W/'WP/batch-release-kit-be837974-20261016'
D=K/'general-sorter491-rounded-publication-once'
R=W/'WP/backlog-resume-20261013/actual207208-source-passes6224662770-6224793665-once'
review=json.loads((R/'independent-verdict-and-deferral-review.json').read_bytes())
assert review['mainMergeHold'] and review['commentsLabelsReadyMergesCreated']==0
assert not D.exists() and git('rev-parse','HEAD').decode().strip()=='36d1aff914ff18b92db1672c8f5b494f163c355f'
assert not git('diff','--cached','--name-only').strip()
runs=['general-sorter491-first','general-sorter491-second']
closed=[]
for label,exit_code,count,sources,ending in zip(runs,[0,0],[491,491],[213,213],['OK','OK']):
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
prior_names.append('order-native456-import-successor-publication-once/new-local-fixtures-hash-inventory.json')
prior_names.append('sorter-scratch463-publication-once/new-local-fixtures-hash-inventory.json')
prior_names.append('linux-sorter-vfs470-app-recovery-publication-once/new-local-fixtures-hash-inventory.json')
prior_names.append('ephemeral-btree477-group-publication-once/new-local-fixtures-hash-inventory.json')
prior_names.append('record-payload484-publication-once/new-local-fixtures-hash-inventory.json')
assert len(prior_names)==39
known=set();refs=[]
for name in prior_names:
 path=K/name;raw=path.read_bytes();known.update(row['path'] for row in json.loads(raw)['fixtures'])
 refs.append({'path':path.relative_to(W).as_posix(),'sha256':sha(raw),'gitBlobOid':oid(raw)})
import os
fixtures=[];sorter_cases={};unix_cases={};unix_analogs=[];ephemeral_cases={};record_cases={};general_cases={}
for directory in sorted(K.glob('*-local-retained-fixtures')):
 for base,directories,filenames in os.walk(directory,followlinks=False):
  directories.sort()
  for filename in sorted(filenames):
   path=pathlib.Path(base)/filename;relative=path.relative_to(K).as_posix()
   if relative in known or not path.is_file():continue
   raw=path.read_bytes();info=path.stat();fixtures.append({'path':relative,'bytes':len(raw),'sha256':sha(raw),'localModeObserved':info.st_mode&511,'localLinksObserved':info.st_nlink})
   if relative.startswith('sorter-local-retained-fixtures/') and path.name in ('stdout-original.json','conditional-plan.json','dev.db','initial-pma-snapshot-original.bin','exit-original.json'):
    case=sorter_cases.setdefault(path.parent.relative_to(K).as_posix(),{})
    case[path.name]={'path':relative,'bytes':len(raw),'sha256':sha(raw),'value':json.loads(raw) if path.name.endswith('.json') else raw}
   if relative.startswith('sorter-unix-vfs-local-retained-fixtures/'):
    if path.name in ('stdout-original.json','conditional-unix-source-plan.json','dev.db','exit-original.json'):
     case=unix_cases.setdefault(path.parent.relative_to(K).as_posix(),{})
     case[path.name]={'path':relative,'bytes':len(raw),'sha256':sha(raw),'value':json.loads(raw) if path.name.endswith('.json') else raw}
    if path.name=='local-file-length-analogs.json':
     unix_analogs.append({'path':relative,'bytes':len(raw),'sha256':sha(raw),'value':json.loads(raw)})
   if relative.startswith('ephemeral-btree-local-retained-fixtures/') and path.name in ('stdout-original.json','conditional-ephemeral-plan.json','conditional-rhs-plan.json','exit-original.json'):
    case=ephemeral_cases.setdefault(path.parent.relative_to(K).as_posix(),{})
    case[path.name]={'path':relative,'bytes':len(raw),'sha256':sha(raw),'value':json.loads(raw)}
   if relative.startswith('record-payload-local-retained-fixtures/'):
    if path.parent.name in ('setup','index') and path.name in ('stdout-original.json','exit-original.json'):
     case=record_cases.setdefault(path.parent.parent.relative_to(K).as_posix(),{})
     case[path.parent.name+'/'+path.name]={'path':relative,'bytes':len(raw),'sha256':sha(raw),'value':json.loads(raw)}
    elif path.name in ('record-profile-original.json','record-plan-before-index.json','source.db'):
     case=record_cases.setdefault(path.parent.relative_to(K).as_posix(),{})
     case[path.name]={'path':relative,'bytes':len(raw),'sha256':sha(raw),'value':json.loads(raw) if path.name.endswith('.json') else raw}
   if relative.startswith('general-sorter-local-retained-fixtures/'):
    if path.parent.name in ('setup','index') and path.name in ('stdout-original.json','exit-original.json'):
     case=general_cases.setdefault(path.parent.parent.relative_to(K).as_posix(),{})
     case[path.parent.name+'/'+path.name]={'path':relative,'bytes':len(raw),'sha256':sha(raw),'value':json.loads(raw)}
    elif path.name in ('general-sorter-plan-before-index.json','source.db'):
     case=general_cases.setdefault(path.parent.relative_to(K).as_posix(),{})
     case[path.name]={'path':relative,'bytes':len(raw),'sha256':sha(raw),'value':json.loads(raw) if path.name.endswith('.json') else raw}
import sys
sys.path.insert(0,str(K))
from verify_kit_capture_native_inventory import payload_sizes
from verify_kit_sorter_scratch import complete_pma_payloads
rows=[]
for folder,case in sorted(sorter_cases.items()):
 if 'stdout-original.json' not in case:continue
 assert case['exit-original.json']['value']['exitCode']==0
 original=case['stdout-original.json'];value=original['value'];plan=case['conditional-plan.json']['value']
 assert value['version']=='3.51.2' and value['sourceId']=='2026-01-09 17:27:48 b270f8339eb13b504d0b2ba154ebca966b7dde08e40c3ed7d559749818cb2075'
 assert value['platform']=='win32' and value['linuxVfsTested'] is False and value['continuousPeakMeasured'] is False
 cells=[]
 if value.get('indexRoot') is not None:
  cells=payload_sizes(case['dev.db']['value'],plan['pageSize'],value['indexRoot']);assert len(cells)==value['rows'] and max(cells)<=32
 sample_summary=None
 if 'initial-pma-snapshot-original.bin' in case:
  snapshot=case['initial-pma-snapshot-original.bin'];parts=complete_pma_payloads(snapshot['value'])
  sample_summary={'original':{q:snapshot[q] for q in ('path','bytes','sha256')},'completeNonemptyPmas':parts[0],'parsedSerializedKeys':len(parts[1]),'maximumSerializedKeyBytes':max(parts[1]),'trailingZeroBytesObserved':parts[2]}
 if 'mode' in value:
  assert value['rows']==12000 and value['rolled']==(value['mode']=='rollback')
  if value['rolled']:assert value['before']==value['after'] and value['indexRoot'] is None
  else:assert value['nullLinks']==12000
 else:
  assert value['rows']==value['callbacks']==150000 and value['workers'] in (0,2)
 rows.append({'folder':folder,'stdoutOriginal':{q:original[q] for q in ('path','bytes','sha256')},
  'planOriginal':{q:case['conditional-plan.json'][q] for q in ('path','bytes','sha256')},
  'pageSize':plan['pageSize'],'mode':value.get('mode'),'requestedWorkers':value.get('workers'),'observedWorkerLimit':value.get('threads'),
  'rows':value['rows'],'parsedPersistedIndexCells':len(cells),'maximumPersistedSerializedKeyBytes':max(cells) if cells else None,
  'samplePoints':len(value.get('samples',[])),'distinctSampledFileNames':len({r['name'] for r in value.get('samples',[])}),
  'maximumSampledFileBytes':max((r['bytes'] for r in value.get('samples',[])),default=0),'initialPmaSnapshot':sample_summary,
  'maximumCumulativeNativeWriteBytes':plan['maximumCumulativeNativeWriteBytes'],
  'maximumAggregateNativeRequestedExtentBytes':plan['maximumAggregateNativeRequestedExtentBytes'],
  'actualNativeFileCallsMeasured':False,'continuousPeakMeasured':False,'fullLifetimeOriginalsRetained':False,'physicalFilesystemClosureClaimed':False})
assert len(rows)==16 and sum(r['mode']=='rollback' for r in rows)==6
save(D,'new-native-sorter-case-summary.json',canonical({'parameterCasesPerRun':8,'closedRuns':len(runs),'caseExecutions':len(rows),
 'completedFullRunExactAlterIndexCases':6,'completedFullRunExpressionUdfSorterCases':2,'cases':rows,
 'parsedPersistedIndexCells':sum(r['parsedPersistedIndexCells'] for r in rows),'samplePoints':sum(r['samplePoints'] for r in rows),
 'sourceBytesReadOnlyFromNewFixtureDelta':True,'actualNativeFileCallsMeasured':False,
 'runtimeSorterConfigurationVerified':False,'continuousPeakMeasured':False,'physicalFilesystemClosureClaimed':False})+b'\n')
unix_rows=[]
for folder,case in sorted(unix_cases.items()):
 if 'stdout-original.json' not in case:continue
 assert case['exit-original.json']['value']['exitCode']==0
 original=case['stdout-original.json'];value=original['value'];plan=case['conditional-unix-source-plan.json']['value']
 assert value['version']=='3.51.2' and value['sourceId']=='2026-01-09 17:27:48 b270f8339eb13b504d0b2ba154ebca966b7dde08e40c3ed7d559749818cb2075'
 assert value['platform']=='win32' and value['linuxUnixVfsExecuted'] is False and value['actualNativeFileCallsMeasured'] is False
 assert value['runtimeDefaultVfsVerified'] is False and value['physicalAllocationMeasured'] is False and value['continuousPeakMeasured'] is False
 assert value['rows']==value['callbacks']==90000 and value['threads']==2
 cells=payload_sizes(case['dev.db']['value'],512,value['indexRoot']);assert len(cells)==90000 and max(cells)<=32
 unix_rows.append({'folder':folder,'stdoutOriginal':{q:original[q] for q in ('path','bytes','sha256')},
  'planOriginal':{q:case['conditional-unix-source-plan.json'][q] for q in ('path','bytes','sha256')},
  'pageSize':512,'rows':90000,'observedWorkerLimit':value['threads'],'parsedPersistedIndexCells':len(cells),
  'maximumPersistedSerializedKeyBytes':max(cells),'samplePoints':len(value['samples']),
  'maximumSampledFileBytes':max((r['bytes'] for r in value['samples']),default=0),
  'conditionalMaximumAggregateSorterFileLengthBytes':plan['conditionalMaximumAggregateSorterFileLengthBytes'],
  'linuxUnixVfsExecuted':False,'actualNativeFileCallsMeasured':False,'runtimeDefaultVfsVerified':False,
  'continuousPeakMeasured':False,'fullLifetimeOriginalsRetained':False,'physicalAllocationMeasured':False})
assert len(unix_rows)==len(unix_analogs)==2
analogs=[]
for record in unix_analogs:
 value=record['value'];assert len(value['cases'])==36
 assert all(value[q] is False for q in ('pinnedUnixVfsExecuted','linuxSyscallsExecuted','physicalAllocationMeasured','directoryFsyncTested'))
 analogs.append({'original':{q:record[q] for q in ('path','bytes','sha256')},'caseExecutions':len(value['cases']),
  'maximumObservedFileLengthBytes':max(r['observedBeforeTruncateBytes'] for r in value['cases']),
  'pinnedUnixVfsExecuted':False,'linuxSyscallsExecuted':False,'physicalAllocationMeasured':False})
save(D,'new-local-unix-sorter-source-case-summary.json',canonical({'closedRuns':len(runs),
 'nativeWindowsSorterCaseExecutions':len(unix_rows),'nativeWindowsSorterCases':unix_rows,
 'rawFileSeekWriteTruncateAnalogExecutions':sum(r['caseExecutions'] for r in analogs),'rawFileAnalogs':analogs,
 'parsedPersistedIndexCells':sum(r['parsedPersistedIndexCells'] for r in unix_rows),
 'sourceBytesReadOnlyFromNewFixtureDelta':True,'pinnedUnixVfsExecuted':False,'linuxSyscallsExecuted':False,
 'runtimeBinaryToSourceBindingVerified':False,'runtimeDefaultVfsVerified':False,
 'continuousPeakMeasured':False,'physicalFilesystemClosureClaimed':False})+b'\n')
ephemeral_rows=[]
inventory_by_path={r['path']:r for r in fixtures}
for folder,case in sorted(ephemeral_cases.items()):
 if 'stdout-original.json' not in case:continue
 original=case['stdout-original.json'];vcase=original['value']
 assert case['exit-original.json']['value']['exitCode']==0
 assert vcase['version']=='3.51.2' and vcase['sourceId']=='2026-01-09 17:27:48 b270f8339eb13b504d0b2ba154ebca966b7dde08e40c3ed7d559749818cb2075'
 assert vcase['platform']=='win32' and vcase['mainUnchanged'] is True
 opens=[r for r in vcase['program'] if r['opcode']=='OpenEphemeral'];assert len(opens) in (1,2)
 status='conditional-rhs-plan.json' in case;plan_name='conditional-rhs-plan.json' if status else 'conditional-ephemeral-plan.json'
 assert vcase['rows']==([dict(id=str(n),sampleId='s',analysis='a') for n in range(4)] if status else 1024)
 planned=case[plan_name]['value'];grouped=not status and planned['scope']=='COMPLETE_DECLARED_FRESH_EPHEMERAL_HANDLE_GROUP'
 declared=1 if status or not grouped else planned['maximumTemporaryDatabaseFileCreations']
 complete=declared==len(opens)
 assert complete or (not status and vcase['kind']=='INDEX' and declared==1 and len(opens)==2)
 if grouped:assert len(opens)==(1 if vcase['kind']=='ROWID_TABLE' else 2)
 snapshots=[]
 for snapshot in vcase.get('snapshots',[]):
  path=pathlib.Path(snapshot['original']).relative_to(K).as_posix();pin=inventory_by_path[path];assert pin['bytes']==snapshot['bytes']
  snapshots.append({'original':{q:pin[q] for q in ('path','bytes','sha256')},'observedPageSize':snapshot['pageSize'],'headerPagesField':snapshot['headerPages']})
 if not status:assert vcase['callbacks']==1024 and not vcase['linuxVfsTested'] and not vcase['actualNativeFileCallsMeasured']
 ephemeral_rows.append({'folder':folder,'stdoutOriginal':{q:original[q] for q in ('path','bytes','sha256')},
  'planOriginal':{q:case[plan_name][q] for q in ('path','bytes','sha256')},'kind':'RAW_ORDER_STATUS_RHS' if status else vcase['kind'],
  'requestedMainPageSize':vcase.get('requestedMainPageSize'),'rows':4 if status else 1024,
  'staticOpenEphemeralOpcodes':len(opens),'declaredHandleCount':declared,'fixtureCompleteHandleDeclarationMatches':complete,'undercountedOriginalPlanRejectedByFirstFullRun':not complete,'staticRhsIdxInsertOpcodes':sum(r['opcode']=='IdxInsert' and r['p1']==opens[0]['p1'] for r in vcase['program']),
  'samplePoints':len(vcase.get('samples',[])),'maximumSampledFileBytes':max((r['bytes'] for r in vcase.get('samples',[])),default=0),
  'temporaryFileSnapshots':snapshots,'mainBytesUnchanged':True,'runtimeEphemeralPageSizeVerified':False,
  'linuxVfsTested':False,'actualNativeFileCallsMeasured':False,'continuousPeakMeasured':False,'fullLifetimeOriginalsRetained':False,'physicalFilesystemClosureClaimed':False})
assert len(ephemeral_rows)==14 and sum(r['kind']=='RAW_ORDER_STATUS_RHS' for r in ephemeral_rows)==2
assert sum(r['undercountedOriginalPlanRejectedByFirstFullRun'] for r in ephemeral_rows)==0
save(D,'new-native-ephemeral-case-summary.json',canonical({'caseExecutions':len(ephemeral_rows),'materializationCaseExecutions':12,'rawOrderStatusQueryCaseExecutions':2,'firstFullRunUndercountedFixturePlansRejected':0,'cases':ephemeral_rows,
 'samplePoints':sum(r['samplePoints'] for r in ephemeral_rows),'temporaryFileSnapshots':sum(len(r['temporaryFileSnapshots']) for r in ephemeral_rows),
 'snapshotPageSizes':sorted({s['observedPageSize'] for r in ephemeral_rows for s in r['temporaryFileSnapshots']}),
 'sourceBytesReadOnlyFromNewFixtureDelta':True,'wholeStatementScratchInventoryComplete':False,
 'actualNativeFileCallsMeasured':False,'continuousPeakMeasured':False,'physicalFilesystemClosureClaimed':False})+b'\n')
record_rows=[]
for folder,case in sorted(record_cases.items()):
 if 'index/stdout-original.json' not in case:continue
 setup=case['setup/stdout-original.json']['value'];out=case['index/stdout-original.json'];value=out['value'];profile=case['record-profile-original.json']['value'];plan=case['record-plan-before-index.json']['value']
 assert case['setup/exit-original.json']['value']['exitCode']==case['index/exit-original.json']['value']['exitCode']==0
 assert setup['sourceId']==value['sourceId']=='2026-01-09 17:27:48 b270f8339eb13b504d0b2ba154ebca966b7dde08e40c3ed7d559749818cb2075'
 assert value['rows']==96 and value['platform']=='win32' and not value['linuxVfsTested'] and not value['actualNativeFileCallsMeasured']
 assert plan['bound']['sourceTableRowCount']==96 and plan['completeNativeRecordMappingVerified'] is False and plan['writerGraphAdmissionImplemented'] is False
 cells=payload_sizes(case['source.db']['value'],setup['page'],value['indexRoot']);assert len(cells)==96 and max(cells)<=plan['bound']['maximumFullSerializedRecordBytes']
 record_rows.append({'folder':folder,'stdoutOriginal':{q:out[q] for q in ('path','bytes','sha256')},
  'profileOriginal':{q:case['record-profile-original.json'][q] for q in ('path','bytes','sha256')},
  'planOriginal':{q:case['record-plan-before-index.json'][q] for q in ('path','bytes','sha256')},
  'pageSize':setup['page'],'collectorEngineVersionObserved':profile['collectorEngineVersion'],'collectorEngineSourceIdObserved':profile['collectorEngineSourceId'],
  'nativeVersionObserved':value['version'],'nativeSourceIdObserved':value['sourceId'],'rows':96,'parsedFullIndexPayloadCells':len(cells),
  'maximumObservedFullSerializedIndexPayloadBytes':max(cells),'maximumSourceBoundFullSerializedRecordBytes':plan['bound']['maximumFullSerializedRecordBytes'],
  'profileColumns':profile['tables']['mixed']['columns'],'profileMaximumNativeDataBytesByColumn':profile['tables']['mixed']['maximumNativeDataBytesByColumn'],
  'preSqlCapacityAdmissionVerified':False,'independentPrivateByteProofVerified':False,'captureCollectorIntegrationImplemented':False,
  'linuxVfsTested':False,'actualNativeFileCallsMeasured':False,'continuousPeakMeasured':False,'physicalFilesystemClosureClaimed':False})
assert len(record_rows)==6 and {r['pageSize'] for r in record_rows}=={512,4096,65536}
save(D,'new-native-record-payload-summary.json',canonical({'parameterCasesPerRun':3,'caseExecutions':6,'nativeLocalCommandExecutions':12,'cases':record_rows,
 'parsedFullIndexPayloadCells':sum(r['parsedFullIndexPayloadCells'] for r in record_rows),
 'sourceBytesReadOnlyFromNewFixtureDelta':True,'captureCollectorIntegrationImplemented':False,
 'runtimeBinaryToSourceBindingVerified':False,'actualNativeFileCallsMeasured':False,'continuousPeakMeasured':False,'physicalFilesystemClosureClaimed':False})+b'\n')
general_rows=[]
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
assert len(general_rows)==6 and {r['pageSize'] for r in general_rows}=={512,4096,65536}
save(D,'new-native-general-sorter-summary.json',canonical({'parameterCasesPerRun':3,'caseExecutions':6,'nativeLocalCommandExecutions':12,'cases':general_rows,
 'parsedFullIndexPayloadCells':sum(r['parsedFullIndexPayloadCells'] for r in general_rows),'sourceBytesReadOnlyFromNewFixtureDelta':True,
 'completeCallerRecordCountAndHandleInventoryVerified':False,'runtimeSorterConfigurationVerified':False,
 'actualNativeFileCallsMeasured':False,'continuousPeakMeasured':False,'physicalFilesystemClosureClaimed':False})+b'\n')
save(D,'new-local-fixtures-hash-inventory.json',canonical({'fixtures':fixtures,'priorInventories':refs,'priorFixtureFilesNotReread':True,'newFixtureBytesPublic':False,'privateHostBytesFetched':0,'productionBytes':0})+b'\n')
external=[]
for reference in sorted(K/row['path'] for row in fixtures if row['path'].endswith('/runtime-reference.json')):
 runtime=pathlib.Path(json.loads(reference.read_bytes())['newRetainedRuntime']);assert runtime.is_dir() and runtime.name.startswith('cj-native-')
 entries=[]
 for path in sorted(runtime.rglob('*')):
  if path.is_file():
   raw=path.read_bytes();info=path.stat();entries.append({'path':path.relative_to(runtime).as_posix(),'bytes':len(raw),'sha256':sha(raw),'modeObserved':info.st_mode&511,'linksObserved':info.st_nlink})
 external.append({'reference':reference.relative_to(K).as_posix(),'referenceSha256':sha(reference.read_bytes()),'root':str(runtime),'files':entries})
prior_external=K/'record-payload484-publication-once/new-external-runtime-hash-inventory.json';prior_external_raw=prior_external.read_bytes()
save(D,'new-external-runtime-hash-inventory.json',canonical({'newRetainedRuntimes':external,'priorRuntimeFilesReread':False,'privateBytesPublished':False,'priorInventories':[{'path':prior_external.relative_to(W).as_posix(),'sha256':sha(prior_external_raw),'gitBlobOid':oid(prior_external_raw)}]})+b'\n')
when=utc();notes=NOTES.format(when=when,summary=test_summary[0],started=v['startedUtc'],closed=v['closedUtc'])
prior=(K/'README.md').read_bytes();(K/'README.md').write_bytes(notes.encode()+prior)
assert {name for name,digest in v['sourceBefore'].items() if sha((K/name).read_bytes())!=digest}=={'README.md'}
save(D,'boundary-record.json',canonical({'publishedUtc':when,'tests':491,'uniqueTests':491,'sourceFiles':213,
 'finalRun':v,'priorClosedRuns':closed[:-1],'releaseCopyEquivalents':43,'releaseDatabaseEquivalents':64,
 'captureCopyEquivalents':1641,'captureDatabaseEquivalents':2052,'captureFixedBytesBeforeMargin':31408324608,'captureFixedBytesAfterMargin':39260405760,
 'captureRootCreated':False,'releaseRootCreated':False,'hostCalls':0,'productionSql':0,'globalFilesystemClosure':False,
 'captureContentOriginals':40,'journalMainStatementControlOriginals':18,
 'conditionalGeneralSerializedSorterRequestBoundImplemented':True,'generalSorterSourceFiles':79,'generalSorterNativeExcerpts':38,
 'generalSorterSourceProofSha256':sha((K/'general-sorter-source.json').read_bytes()),'nativeGeneralSorterCases':len(general_rows),
 'generalSorterWriterAdmissionImplemented':False,'completeRoundedContentGuardSourceReviewedAfterFirstFullPass':True,
 'firstFullPassRetainedHonestly':True,'exactRoundedOverflowWitnessRefusesRatherThanClips':True,'completeCallerRecordCountAndHandleInventoryVerified':False,
 'recordPayloadCollectorSourceImplemented':True,'recordPayloadSourceFiles':62,'recordPayloadNativeExcerpts':10,
 'recordPayloadSourceProofSha256':sha((K/'record-payload-source.json').read_bytes()),'nativeRecordPayloadCases':len(record_rows),'recordPayloadCollectorCaptureIntegrationImplemented':False,
 'conditionalEphemeralLogicalContentBoundImplemented':True,'ephemeralSourceFiles':56,'ephemeralNativeExcerpts':20,
 'ephemeralSourceProofSha256':sha((K/'ephemeral-btree-source.json').read_bytes()),'nativeEphemeralCaseExecutions':len(ephemeral_rows),
 'wholeSqlStatementScratchInventoryComplete':False,'runtimeEphemeralPageSizeVerified':False,
 'conditionalUnixSorterFileLengthSourceProofImplemented':True,'linuxSorterSourceFiles':77,'linuxSorterNativeExcerpts':21,
 'linuxSorterSourceProofSha256':sha((K/'linux-sorter-vfs-source.json').read_bytes()),
 'freshWritableEmptyTempFileCreationObserved':False,'ordinarySyscallSemanticsObserved':False,
 'nativeWindowsSorterCaseExecutions':len(unix_rows),'rawFileSeekWriteTruncateAnalogExecutions':sum(r['caseExecutions'] for r in analogs),
 'conditionalSingleSorterLogicalNativeRequestBoundImplemented':True,'sorterSourceFiles':43,'sorterNativeExcerpts':28,
 'sorterSourceProofSha256':sha((K/'sorter-scratch-source.json').read_bytes()),'sorterWriterAdmissionImplemented':False,
 'sorterRuntimeConfigurationVerified':False,'sorterFileLengthOrVfsPreallocationBounded':False,'wholeOwnerSqlScratchBounded':False,
 'nativeSorterCaseExecutions':len(rows),'nativeSorterSamplePoints':sum(r['samplePoints'] for r in rows),'actualNativeFileCallsMeasured':False,
 'runtimeBinaryToSourceBindingVerified':False,'runtimeDefaultVfsVerified':False,'continuousPeakMeasured':False,'fullTransientOriginalsRetained':False,
 'sourceReviewRequested':False,'completeFilesystemQualification':False,'mainMergeHold':True,'actualSourceAuditResults':review['results'],
 'actualClaudioStatusId':6229374245,'actualClaudioCoordinationId':6229865723,'coordinationIsSourcePass':False,'externalAcknowledgementsSent':0,
 'actualAutomaticWakeObservedUtc':'2026-10-17T09:30:45.840Z','actualPostCrashAutomaticWakeObserved':True,'sameHeartbeatIntervalMinutes':2,'heartbeatInputGuardPassed':True,
 'activePromptMustStayBelowCharactersAndUtf16Units':20000,'existingWriterNonemptyShmRefusalUnchanged':True,
 'oldPrivateFixturePayloadsReadThisBoundary':False,'sourceAggregateTruncationDisclosed':False,'exploratoryMissingGuessedMetadataFilenameTranscribedOnly':False,'exploratoryCp1252OutputRefusalTranscribedOnly':True,'sourcePreparationPolicyRefusedBeforeLaunch':False,
 'captureStatementProofSha256':sha((K/'capture-statement-journal-source.json').read_bytes())})+b'\n')
extras={p for p in K.iterdir() if p.is_file()}
for folder in [K/('local-tests-'+run) for run in runs]:extras|={p for p in folder.rglob('*') if p.is_file()}
extras|={p for p in (W/'WP/backlog-resume-20261013/general-sorter484-entry-0930-once').iterdir() if p.is_file()}
for name in ['prepare-general-sorter-source-once.py','prepare-general-sorter-publication-once.py','general-sorter491-publication-notes-once.txt','publish-kit-general-sorter491-once.py','tighten-general-sorter-rounded-envelope-once.py','prepare-general-sorter-rounded-publication-once.py','general-sorter491-rounded-publication-notes-once.txt']:
 extras.add(W/'WP/backlog-resume-20261013'/name)
extras.add(pathlib.Path(__file__).resolve())
print(json.dumps(boundary_publish(D,extras,'feat(release): bound normal sorter requests for full serialized records',notes)))
