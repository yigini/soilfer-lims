import pathlib
endpoints={'main': 'repos/yigini/soilfer-lims/git/ref/heads/main', 'main-ci': 'repos/yigini/soilfer-lims/actions/runs/38772398721', 'issue191': 'repos/yigini/soilfer-lims/issues/191', 'pr207': 'repos/yigini/soilfer-lims/pulls/300', 'pr208': 'repos/yigini/soilfer-lims/pulls/299', 'ci207': 'repos/yigini/soilfer-lims/actions/runs/38956418902', 'ci208': 'repos/yigini/soilfer-lims/actions/runs/38953786365', 'release-comments': 'repos/yigini/soilfer-lims/issues/162/comments?since=2026-10-17T04:00:22Z&per_page=100', 'audit207-comments': 'repos/yigini/soilfer-lims/issues/300/comments?since=2026-10-16T20%3A23%3A55Z&per_page=100', 'audit208-comments': 'repos/yigini/soilfer-lims/issues/299/comments?since=2026-10-16T20%3A03%3A51Z&per_page=100'}
prior_names=['shared-evidence161-publication-once/all-local-fixtures-hash-inventory.json', 'emergency-http176-inventory-successor-publication-once/new-local-fixtures-hash-inventory.json', 'prestart188-fixed-envelopes-publication-once/new-local-fixtures-hash-inventory.json', 'apache199-copy-prewrite-publication-once/new-local-fixtures-hash-inventory.json', 'copy-admissions208-publication-once/new-local-fixtures-hash-inventory.json', 'seal-sqlite212-exact-verdict-successor-publication-once/new-local-fixtures-hash-inventory.json', 'reader-live-backup221-publication-once/new-local-fixtures-hash-inventory.json', 'live-backup-journal225-publication-once/new-local-fixtures-hash-inventory.json', 'application-snapshots234-publication-once/new-local-fixtures-hash-inventory.json', 'order-output242-publication-once/new-local-fixtures-hash-inventory.json', 'controller-output253-publication-once/new-local-fixtures-hash-inventory.json', 'cli-pipes263-publication-once/new-local-fixtures-hash-inventory.json', 'capture-owners276-publication-once/new-local-fixtures-hash-inventory.json', 'capture-copy288-actual-audits-successor-publication-once/new-local-fixtures-hash-inventory.json', 'capture-science297-publication-once/new-local-fixtures-hash-inventory.json', 'capture-review304-crlf-successor-publication-once/new-local-fixtures-hash-inventory.json', 'capture-controller317-publication-once/new-local-fixtures-hash-inventory.json', 'capture-launch333-publication-once/new-local-fixtures-hash-inventory.json', 'target-reader340-publication-once/new-local-fixtures-hash-inventory.json', 'sqlite-temp347-publication-once/new-local-fixtures-hash-inventory.json', 'rollback355-publication-once/new-local-fixtures-hash-inventory.json', 'capture-journal364-publication-once/new-local-fixtures-hash-inventory.json', 'capture-journal-package371-publication-once/new-local-fixtures-hash-inventory.json', 'main-growth378-publication-once/new-local-fixtures-hash-inventory.json', 'capture-native386-publication-once/new-local-fixtures-hash-inventory.json', 'schema-collection393-publication-once/new-local-fixtures-hash-inventory.json', 'capture-main400-publication-once/new-local-fixtures-hash-inventory.json', 'linux-main-vfs407-publication-once/new-local-fixtures-hash-inventory.json', 'statement-journal414-direction-successor-publication-once/new-local-fixtures-hash-inventory.json', 'capture-statement421-publication-once/new-local-fixtures-hash-inventory.json', 'wal-content428-publication-once/new-local-fixtures-hash-inventory.json','readonly-target-wal435-publication-once/new-local-fixtures-hash-inventory.json','wal-dirty442-publication-once/new-local-fixtures-hash-inventory.json','wal-binding449-publication-once/new-local-fixtures-hash-inventory.json']
NOTES=pathlib.Path(__file__).with_name('backup-core533-publication-notes-once.txt').read_text(encoding='utf-8')
from concurrent.futures import ThreadPoolExecutor
from prechecks6210209468_boundary_publication import *
K=W/'WP/batch-release-kit-be837974-20261016'
D=K/'backup-core533-publication-once'
R=W/'WP/backlog-resume-20261013/actual207208-source-passes6224662770-6224793665-once'
review=json.loads((R/'independent-verdict-and-deferral-review.json').read_bytes())
assert review['mainMergeHold'] and review['commentsLabelsReadyMergesCreated']==0
assert not D.exists() and git('rev-parse','HEAD').decode().strip()=='96d632efa7270f90f7f7d311beb26c33b4357d3b'
assert not git('diff','--cached','--name-only').strip()
runs=['backup-core533-first']
closed=[]
for label,exit_code,count,sources,ending in zip(runs,[0],[533],[231],['OK']):
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
prior_names.append('general-sorter491-rounded-publication-once/new-local-fixtures-hash-inventory.json')
prior_names.append('fingerprint-sorter498-publication-once/new-local-fixtures-hash-inventory.json')
prior_names.append('reader-schema505-constant-successor-publication-once/new-local-fixtures-hash-inventory.json')
prior_names.append('reader-init512-pragma-state-publication-once/new-local-fixtures-hash-inventory.json')
prior_names.append('reader-checks519-readonly-successor-publication-once/new-local-fixtures-hash-inventory.json')
prior_names.append('record-profile526-publication-once/new-local-fixtures-hash-inventory.json')
assert len(prior_names)==45
known=set();refs=[]
for name in prior_names:
 path=K/name;raw=path.read_bytes();known.update(row['path'] for row in json.loads(raw)['fixtures'])
 refs.append({'path':path.relative_to(W).as_posix(),'sha256':sha(raw),'gitBlobOid':oid(raw)})
import os
fixtures=[];sorter_cases={};unix_cases={};unix_analogs=[];ephemeral_cases={};record_cases={};general_cases={};fingerprint_cases={};reader_schema_cases={};memory_probes=[];reader_init_cases={};reader_checks_cases={};check_diagnostics=[];record_profile_cases={};python_profile_rows=[];backup_core_cases={};python_backup_rows=[]
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
   if relative.startswith('fingerprint-sorter-local-retained-fixtures/'):
    if path.parent.name in ('setup','fingerprint') and path.name in ('stdout-original.json','exit-original.json'):
     case=fingerprint_cases.setdefault(path.parent.parent.relative_to(K).as_posix(),{})
     case[path.parent.name+'/'+path.name]={'path':relative,'bytes':len(raw),'sha256':sha(raw),'value':json.loads(raw)}
    elif path.name in ('fingerprint-plan-before-read.json','actual-python-fingerprint-original.json'):
     case=fingerprint_cases.setdefault(path.parent.relative_to(K).as_posix(),{})
     case[path.name]={'path':relative,'bytes':len(raw),'sha256':sha(raw),'value':json.loads(raw)}
    elif path.parent.name=='input' and path.name=='dev.db':
     case=fingerprint_cases.setdefault(path.parent.parent.relative_to(K).as_posix(),{})
     case['input/dev.db']={'path':relative,'bytes':len(raw),'sha256':sha(raw)}
   if relative.startswith('reader-schema-scratch-local-retained-fixtures/'):
    if path.parent.name in ('full','filtered') and path.name in ('stdout-original.json','exit-original.json','source-plan-before-native-read.json','actual-python-logical-original.json'):
     case=reader_schema_cases.setdefault(path.parent.relative_to(K).as_posix(),{})
     case[path.name]={'path':relative,'bytes':len(raw),'sha256':sha(raw),'value':json.loads(raw)}
    elif path.name=='actual-python-memory-engine-original.json':
     memory_probes.append({'path':relative,'bytes':len(raw),'sha256':sha(raw),'value':json.loads(raw)})
   if relative.startswith('reader-init-local-retained-fixtures/'):
    if path.parent.name in ('setup','load','malformed') and path.name in ('stdout-original.json','exit-original.json'):
     case=reader_init_cases.setdefault(path.parent.parent.relative_to(K).as_posix(),{})
     case[path.parent.name+'/'+path.name]={'path':relative,'bytes':len(raw),'sha256':sha(raw),'value':json.loads(raw)}
    elif path.name in ('initialization-plan-before-read.json','actual-python-logical-original.json'):
     case=reader_init_cases.setdefault(path.parent.relative_to(K).as_posix(),{})
     case[path.name]={'path':relative,'bytes':len(raw),'sha256':sha(raw),'value':json.loads(raw)}
   if relative.startswith('reader-check-local-retained-fixtures/'):
    if path.parent.name in ('setup','checks','hazard') and path.name in ('stdout-original.json','exit-original.json','stderr-original.txt'):
     case=reader_checks_cases.setdefault(path.parent.parent.relative_to(K).as_posix(),{})
     case[path.parent.name+'/'+path.name]={'path':relative,'bytes':len(raw),'sha256':sha(raw),'value':json.loads(raw) if path.name.endswith('.json') and raw.strip() else None}
    elif path.name in ('plain-pragma-plan-before-read.json','actual-python-logical-original.json'):
     case=reader_checks_cases.setdefault(path.parent.relative_to(K).as_posix(),{})
     case[path.name]={'path':relative,'bytes':len(raw),'sha256':sha(raw),'value':json.loads(raw)}
   if relative.startswith('reader-check-local-retained-fixtures/rc-diagnostic-6lwpj9vx/') and path.name=='stdout-original.json':
    check_diagnostics.append({'path':relative,'bytes':len(raw),'sha256':sha(raw),'value':json.loads(raw)})
   if relative.startswith('profile-local-retained-fixtures/'):
    if path.parent.name in ('setup','profile') and path.name in ('stdout-original.json','exit-original.json'):
     case=record_profile_cases.setdefault(path.parent.parent.relative_to(K).as_posix(),{})
     case[path.parent.name+'/'+path.name]={'path':relative,'bytes':len(raw),'sha256':sha(raw),'value':json.loads(raw)}
    elif path.name=='profile-plan-before-native-invocation.json':
     case=record_profile_cases.setdefault(path.parent.relative_to(K).as_posix(),{})
     case[path.name]={'path':relative,'bytes':len(raw),'sha256':sha(raw),'value':json.loads(raw)}
    elif path.name=='actual-python-future-profile-original.json':
     python_profile_rows.append({'path':relative,'bytes':len(raw),'sha256':sha(raw),'value':json.loads(raw)})
   if relative.startswith('backup-core-local-retained-fixtures/'):
    if path.parent.name in ('setup','core') and path.name in ('stdout-original.json','exit-original.json'):
     case=backup_core_cases.setdefault(path.parent.parent.relative_to(K).as_posix(),{})
     case[path.parent.name+'/'+path.name]={'path':relative,'bytes':len(raw),'sha256':sha(raw),'value':json.loads(raw)}
    elif path.name=='plan-before-core.json':
     case=backup_core_cases.setdefault(path.parent.relative_to(K).as_posix(),{})
     case[path.name]={'path':relative,'bytes':len(raw),'sha256':sha(raw),'value':json.loads(raw)}
    elif path.name=='python-backup-original.json':
     python_backup_rows.append({'path':relative,'bytes':len(raw),'sha256':sha(raw),'value':json.loads(raw)})
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
assert len(rows)==8*len(runs) and sum(r['mode']=='rollback' for r in rows)==3*len(runs)
save(D,'new-native-sorter-case-summary.json',canonical({'parameterCasesPerRun':8,'closedRuns':len(runs),'caseExecutions':len(rows),
 'completedFullRunExactAlterIndexCases':6*len(runs),'completedFullRunExpressionUdfSorterCases':2*len(runs),'cases':rows,
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
assert len(unix_rows)==len(unix_analogs)==len(runs)
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
assert len(ephemeral_rows)==7*len(runs) and sum(r['kind']=='RAW_ORDER_STATUS_RHS' for r in ephemeral_rows)==len(runs)
assert sum(r['undercountedOriginalPlanRejectedByFirstFullRun'] for r in ephemeral_rows)==0
save(D,'new-native-ephemeral-case-summary.json',canonical({'caseExecutions':len(ephemeral_rows),'materializationCaseExecutions':6*len(runs),'rawOrderStatusQueryCaseExecutions':len(runs),'firstFullRunUndercountedFixturePlansRejected':0,'cases':ephemeral_rows,
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
assert len(record_rows)==3*len(runs) and {r['pageSize'] for r in record_rows}=={512,4096,65536}
save(D,'new-native-record-payload-summary.json',canonical({'parameterCasesPerRun':3,'parameterCaseExecutions':3*len(runs),'nativeLocalCommandExecutions':6*len(runs),'cases':record_rows,
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
assert len(general_rows)==3*len(runs) and {r['pageSize'] for r in general_rows}=={512,4096,65536}
save(D,'new-native-general-sorter-summary.json',canonical({'parameterCasesPerRun':3,'parameterCaseExecutions':3*len(runs),'nativeLocalCommandExecutions':6*len(runs),'cases':general_rows,
 'parsedFullIndexPayloadCells':sum(r['parsedFullIndexPayloadCells'] for r in general_rows),'sourceBytesReadOnlyFromNewFixtureDelta':True,
 'completeCallerRecordCountAndHandleInventoryVerified':False,'runtimeSorterConfigurationVerified':False,
 'actualNativeFileCallsMeasured':False,'continuousPeakMeasured':False,'physicalFilesystemClosureClaimed':False})+b'\n')
fingerprint_rows=[]
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
assert len(fingerprint_rows)==6*len(runs) and {r['pageSize'] for r in fingerprint_rows}=={512,4096,65536} and sum(r['partialOrder'] for r in fingerprint_rows)==3*len(runs)
save(D,'new-native-fingerprint-sorter-summary.json',canonical({'parameterCasesPerRun':6,'parameterCaseExecutions':6*len(runs),'nativeLocalCommandExecutions':12*len(runs),'pythonFutureFingerprintInvocations':6*len(runs),
 'rowsReadPerEngine':sum(r['rows'] for r in fingerprint_rows),'nativeBlobBytesRead':sum(r['blobBytes'] for r in fingerprint_rows),'cases':fingerprint_rows,
 'sourceBytesReadOnlyFromNewFixtureDelta':True,'sampleAbsenceIsNotNoSpillProof':True,'readerSqliteBinaryToPinnedNativeSourceVerified':False,
 'initialEarlierFingerprintAdmissionImplemented':False,'actualNativeSorterCallsMeasured':False,'continuousPeakMeasured':False,'physicalFilesystemClosureClaimed':False})+b'\n')
reader_schema_rows=[]
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
assert len(reader_schema_rows)==6*len(runs) and sum(r['fullSchemaRequested'] for r in reader_schema_rows)==3*len(runs)
assert len(memory_probes)==len(runs)
save(D,'new-native-reader-schema-summary.json',canonical({'parameterCaseExecutions':len(reader_schema_rows),'nativeLocalCommandExecutions':9*len(runs),
 'rawPythonLogicalInvocations':6*len(runs),'explicitNativeSchemaSelectExecutions':sum(r['explicitQueriesExecuted'] for r in reader_schema_rows),
 'cases':reader_schema_rows,'pythonNewMemoryEngineProbes':[{'original':{q:r[q] for q in ('path','bytes','sha256')},'versionObserved':r['value']['sqliteVersionObserved'],'sourceIdObserved':r['value']['sqliteSourceIdObserved'],'binarySourceBindingVerified':False} for r in memory_probes],
 'sourceBytesReadOnlyFromNewFixtureDelta':True,'loadedBinaryToSourceBuildBindingVerified':False,'beforeInitialReaderSqlAdmissionImplemented':False,
 'wholeLogicalReaderSqlScratchInventoryComplete':False,'actualNativeCallsMeasured':False,'continuousPeakMeasured':False,'physicalFilesystemClosureClaimed':False})+b'\n')
reader_init_rows=[];malformed_rows=[]
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
  reader_init_rows.append({'folder':folder,'stdoutOriginal':{q:out[q] for q in ('path','bytes','sha256')},'planOriginal':{q:case['initialization-plan-before-read.json'][q] for q in ('path','bytes','sha256')},'pythonOriginal':{q:case['actual-python-logical-original.json'][q] for q in ('path','bytes','sha256')},'pageSize':initial['page'],'stat4RowsObserved':initial['stat4Rows'],'directCatalogQueryExecutions':len(value['cases']),'pythonEngineVersionObserved':py['versionObserved'],'nodeSourceIdObserved':value['sourceId'],'staticStat4GroupSorterOpenSites':1,'mainFullShaPreserved':True,'latestRequiredPragmaSchemaStateConditionPresent':plan['nativeDeclaration'].get('pragmaFileControlsDoNotAccessSchemaOrChangeConnectionState') is True,'actualInternalStatementExecutionsMeasured':False,'readerSqliteBinaryToPinnedNativeSourceVerified':False,'beforeInitialReaderSqlAdmissionImplemented':False,'continuousPeakMeasured':False,'physicalFilesystemClosureClaimed':False})
 if 'malformed/stdout-original.json' in case:
  initial=case['setup/stdout-original.json']['value'];out=case['malformed/stdout-original.json'];value=out['value']
  assert case['setup/exit-original.json']['value']['exitCode']==case['malformed/exit-original.json']['value']['exitCode']==0
  assert initial['newFixtureOnly'] and initial['testOnlyUnsafeModeUsedToCreateMalformedFixture'] and initial['malformedSchemaIntentional']
  assert len(value['steps'])==5 and value['steps']==['PRAGMA compile_options','PRAGMA temp_store=MEMORY','PRAGMA temp_store','PRAGMA query_only=ON','BEGIN']
  assert value['tempStore']==2 and value['mainUnchanged'] and value['error'] and not value['sourcePlanApplicableToMalformedFixture']
  malformed_rows.append({'folder':folder,'stdoutOriginal':{q:out[q] for q in ('path','bytes','sha256')},'pageSize':initial['page'],'setupStatementsSucceeded':5,'firstSchemaRequiringStatementRefused':True,'errorOriginal':value['error'],'testOnlyUnsafeModeUsedToCreateNewMalformedFixture':True,'sourcePlanApplicableToMalformedFixture':False,'mainFullShaPreserved':True,'actualInternalStatementExecutionsMeasured':False,'physicalFilesystemClosureClaimed':False})
assert len(reader_init_rows)==len(malformed_rows)==3*len(runs) and {x['pageSize'] for x in reader_init_rows}=={512,4096,65536}
save(D,'new-native-reader-initialization-summary.json',canonical({'positiveParameterCaseExecutions':len(reader_init_rows),'negativeMalformedParameterCaseExecutions':len(malformed_rows),'nativeLocalCommandExecutions':12*len(runs),'rawPythonLogicalInvocations':3*len(runs),'directCatalogQueryExecutions':sum(x['directCatalogQueryExecutions'] for x in reader_init_rows),'positiveCases':reader_init_rows,'negativeMalformedCases':malformed_rows,'sourceBytesReadOnlyFromNewFixtureDelta':True,'actualInternalStatementExecutionsMeasured':False,'readerSqliteBinaryToPinnedNativeSourceVerified':False,'beforeInitialReaderSqlAdmissionImplemented':False,'wholeLogicalReaderSqlScratchInventoryComplete':False,'continuousPeakMeasured':False,'physicalFilesystemClosureClaimed':False})+b'\n')
plain_check_rows=[];check_hazard_rows=[];failed_check_setups=[]
def original_pin(row):return {q:row[q] for q in ('path','bytes','sha256')}
for folder,case in sorted(reader_checks_cases.items()):
 if 'setup/exit-original.json' in case and case['setup/exit-original.json']['value']['exitCode']!=0:
  assert case['setup/exit-original.json']['value']['exitCode']==1 and case['setup/stdout-original.json']['value'] is None
  assert 'checks/stdout-original.json' not in case and 'hazard/stdout-original.json' not in case
  failed_check_setups.append({'folder':folder,'stdoutOriginal':original_pin(case['setup/stdout-original.json']),'stderrOriginal':original_pin(case['setup/stderr-original.txt']),'exitOriginal':original_pin(case['setup/exit-original.json']),'exitCode':1,'completedPragmaCase':False,'failure':'Test-only CHECK UDF callback declared arity0, SQL calls arity1.','guardRelaxed':False})
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
  plain_check_rows.append({'folder':folder,'stdoutOriginal':original_pin(out),'planOriginal':original_pin(plan_original),'pythonOriginal':original_pin(py) if py else None,'pythonEngineVersionObserved':py['value']['versionObserved'] if py else None,'pageSize':initial['page'],'intentionalForeignKeyViolations':bad,'foreignKeyDiagnosticRows':len(value['cases'][1]['rows']),'directPragmaExecutions':6,'mainFullShaPreserved':True,'restrictedSchemaDeclarationsOnly':True,'latestNoConnectionHookConditionPresent':plan['nativeDeclaration'].get('noApplicationConnectionCallbacksOrHooks') is True,'currentSourceProofMatchesFinal':plan['sourceProofSha256']==sha((K/'reader-pragma-checks-source.json').read_bytes()),'actualSchemaRestrictionsVerified':False,'actualNativeTemporaryBtreeCallsMeasured':False,'readerSqliteBinaryToPinnedNativeSourceVerified':False,'beforeInitialReaderSqlAdmissionImplemented':False,'physicalFilesystemClosureClaimed':False})
 if 'hazard/stdout-original.json' in case:
  initial=case['setup/stdout-original.json']['value'];out=case['hazard/stdout-original.json'];value=out['value']
  assert case['setup/exit-original.json']['value']['exitCode']==case['hazard/exit-original.json']['value']['exitCode']==0
  assert initial['newFixtureOnly'] and initial['checkExpressionAndCallbackIntentional']
  assert value['sourceId']=='2026-01-09 17:27:48 b270f8339eb13b504d0b2ba154ebca966b7dde08e40c3ed7d559749818cb2075' and value['tempStore']==2 and value['mainUnchanged']
  opens=sum(r['opcode']=='OpenEphemeral' for r in value['program']);functions=sum(r['opcode'] in ('Function','PureFunc') for r in value['program'])
  paired='freshReadonlyProgram' in value
  if paired:
   assert opens>0 and functions>0 and value['callbacks']>=3 and value['freshReadonlyCallbacks']==0
   assert not any(r['opcode'] in ('OpenEphemeral','Function','PureFunc') for r in value['freshReadonlyProgram'])
   assert [r['readonly'] for r in value['observations']]==[True,False] and all(r['ignoreChecks']==0 and r['tempStore']==2 for r in value['observations'])
  else:assert opens==functions==value['callbacks']==0
  assert value['integrity']==[{'integrity_check':'ok'}] and not value['sourcePlanApplicableToExpressionFixture']
  check_hazard_rows.append({'folder':folder,'stdoutOriginal':original_pin(out),'pageSize':initial['page'],'staticOpenEphemeralSites':opens,'staticScalarFunctionSites':functions,'actualTestUdfCallbackInvocations':value['callbacks'],'pairedReadonlyVersusWritableQueryOnly':paired,'freshReadonlyCheckCallbackInvocations':value.get('freshReadonlyCallbacks',value['callbacks']),'sourcePlanApplicableToExpressionFixture':False,'directPragmaExecutions':2 if paired else 1,'mainFullShaPreserved':True,'actualNativeTemporaryBtreeCallsMeasured':False,'continuousPeakMeasured':False,'physicalFilesystemClosureClaimed':False})
assert len(plain_check_rows)==6*len(runs) and sum(r['intentionalForeignKeyViolations'] for r in plain_check_rows)==3*len(runs) and len(check_hazard_rows)==3*len(runs) and len(failed_check_setups)==0 and len(check_diagnostics)==0 and sum(r['pairedReadonlyVersusWritableQueryOnly'] for r in check_hazard_rows)==3
save(D,'new-native-reader-pragma-check-summary.json',canonical({'plainParameterCaseExecutions':len(plain_check_rows),'readonlyExpressionHazardCaseExecutions':len(check_hazard_rows),'nativeLocalCommandExecutions':2*(len(plain_check_rows)+len(check_hazard_rows))+len(failed_check_setups),'rawPythonLogicalInvocations':3*len(runs),'directNativePragmaExecutions':sum(r['directPragmaExecutions'] for r in plain_check_rows+check_hazard_rows),'plainCases':plain_check_rows,'separateNewLocalDiagnosticCommands':0,'newLocalDiagnosticOriginals':[original_pin(r) for r in check_diagnostics],'readonlyExpressionHazardCases':check_hazard_rows,'failedNewFixtureSetups':failed_check_setups,'sourceBytesReadOnlyFromNewFixtureDelta':True,'restrictedSchemaDeclarationsOnly':True,'readonlyAloneImpliesNoScratch':False,'actualSchemaRestrictionsVerified':False,'collectorBindingImplemented':False,'actualNativeTemporaryBtreeCallsMeasured':False,'readerSqliteBinaryToPinnedNativeSourceVerified':False,'beforeInitialReaderSqlAdmissionImplemented':False,'wholeLogicalReaderSqlScratchInventoryComplete':False,'continuousPeakMeasured':False,'physicalFilesystemClosureClaimed':False})+b'\n')
record_profile_rows=[]
for folder,case in sorted(record_profile_cases.items()):
 if 'profile/stdout-original.json' not in case:continue
 initial=case['setup/stdout-original.json']['value'];out=case['profile/stdout-original.json'];value=out['value'];original=case['profile-plan-before-native-invocation.json'];plan=original['value']
 assert case['setup/exit-original.json']['value']['exitCode']==case['profile/exit-original.json']['value']['exitCode']==0
 assert initial['newFixtureOnly'] and value['sourceId']=='2026-01-09 17:27:48 b270f8339eb13b504d0b2ba154ebca966b7dde08e40c3ed7d559749818cb2075' and value['tempStore']==2 and value['mainUnchanged']
 assert len(value['cases'])==plan['sqlInvocationCount']==19 and plan['columnAggregateInvocations']==7 and plan['tableXinfoInvocations']==2
 assert [r['sql'] for r in value['cases']]==[r['sql'] for r in plan['queries']]
 assert plan['futureAlreadyPreparedInvocationOnly'] and not plan['beforeInitialReaderSqlAdmissionImplemented'] and not plan['actualBuiltinAndTableInventoryVerified'] and not plan['profileEnvelopeIsPreSqlPhysicalCapacity']
 for row in value['cases']:
  ops=[r['opcode'] for r in row['program']];assert not any(x in ops for x in ('OpenEphemeral','OpenAutoindex','OpenWrite'));assert ops.count('SorterOpen')<=(1 if row['family']=='full-schema' else 0)
  if row['family']=='column-aggregate':assert ops.count('AggStep')==ops.count('AggFinal')==3 and row['rows'][0][0] in (0,4)
 version=next(r['rows'][0][0] for r in value['cases'] if r['sql']=='SELECT sqlite_version()');assert version=='3.51.2'
 record_profile_rows.append({'folder':folder,'stdoutOriginal':original_pin(out),'planOriginal':original_pin(original),'pageSize':initial['page'],'catalogSqlExecutions':19,'columnAggregateSqlExecutions':7,'tableXinfoSqlExecutions':2,'staticAggregateStepSites':sum(r['opcode']=='AggStep' for q in value['cases'] for r in q['program']),'nativeVersionObserved':version,'nativeSourceIdObserved':value['sourceId'],'mainFullShaPreserved':True,'earlierWarmupAndSetupSqlNotAdmitted':True,'actualNativeCallsMeasured':False,'readerSqliteBinaryToPinnedNativeSourceVerified':False,'beforeInitialReaderSqlAdmissionImplemented':False,'continuousPeakMeasured':False,'physicalFilesystemClosureClaimed':False})
assert len(record_profile_rows)==3*len(runs) and len(python_profile_rows)==len(runs)
pyrows=[]
for original in python_profile_rows:
 value=original['value'];plan=value['plan'];assert value['trace']==[r['sql'] for r in plan['queries']] and value['earlierLogicalAndSchemaPrerequisitesNotAdmitted'] and value['traceObserverIsTestOnly'] and not value['actualNoHookProfileVerified'] and not value['readerBinarySourceBindingVerified']
 pyrows.append({'original':original_pin(original),'pythonEngineVersionObserved':value['versionObserved'],'futureProfileCatalogSqlExecutions':len(value['trace']),'declaredTables':len(plan['declaredTables']),'declaredColumnAggregateInvocations':plan['columnAggregateInvocations'],'earlierPrerequisitesNotAdmitted':True,'traceObserverIsTestOnly':True,'actualNoHookProfileVerified':False,'readerBinarySourceBindingVerified':False})
save(D,'new-native-record-profile-scratch-summary.json',canonical({'parameterCaseExecutions':len(record_profile_rows),'nativeLocalCommandExecutions':6*len(runs),'nativeCatalogSqlExecutions':sum(r['catalogSqlExecutions'] for r in record_profile_rows),'nativeColumnAggregateSqlExecutions':sum(r['columnAggregateSqlExecutions'] for r in record_profile_rows),'nativeCases':record_profile_rows,'actualPythonFutureProfileInvocations':len(pyrows),'pythonFutureProfiles':pyrows,'sourceBytesReadOnlyFromNewFixtureDelta':True,'actualBuiltinAndTableInventoryVerified':False,'beforeInitialReaderSqlAdmissionImplemented':False,'backupQueryScratchInventoryComplete':False,'wholeLogicalReaderSqlScratchInventoryComplete':False,'actualNativeCallsMeasured':False,'continuousPeakMeasured':False,'physicalFilesystemClosureClaimed':False})+b'\n')
backup_rows=[]
for folder,case in sorted(backup_core_cases.items()):
 if 'core/stdout-original.json' not in case:continue
 out=case['core/stdout-original.json'];value=out['value'];initial=case['setup/stdout-original.json']['value'];original=case['plan-before-core.json'];plan=original['value']
 assert case['setup/exit-original.json']['value']['exitCode']==case['core/exit-original.json']['value']['exitCode']==0
 assert value['sourceId']=='2026-01-09 17:27:48 b270f8339eb13b504d0b2ba154ebca966b7dde08e40c3ed7d559749818cb2075' and value['sourceUnchanged'] and value['integrity']=='ok'
 assert initial['pages']==value['pages']==plan['declaredPinnedSourcePageCount'] and initial['page']==value['page']==plan['declaredEqualPageSize']
 assert value['zero']['remainingPages']==value['pages'] and len(value['steps'])+1==plan['maximumSuccessfulStepCalls'] and value['steps'][-1]['remainingPages']==0
 assert value['destinationBytes']==value['pages']*value['page'] and value['abandonedBytes']==0 and value['abandonZero']['remainingPages']==value['pages']
 assert value['result']=={'n':96,'bytes':96*8192} and not value['actualNativePagerCallsMeasured'] and value['windowsOnly']
 assert not plan['directCopyCountIsCompleteDirtyOrFileWriteInventory'] and not plan['beforeSqlHeldAdmissionImplemented']
 backup_rows.append({'folder':folder,'stdoutOriginal':original_pin(out),'planOriginal':original_pin(original),'pageSize':value['page'],'declaredSourcePages':value['pages'],'explicitNativeAddonTransferCalls':1+len(value['steps']),'independentAbandonedZeroStepBackupHandles':1,'zeroStepInitializesWriteTransactionSourceDerivedNotMeasured':True,'directPagerOrFileCallsMeasured':False,'sourceMainShaUnchanged':True,'destinationBytesObserved':value['destinationBytes'],'abandonedFinalBytesObserved':value['abandonedBytes'],'fullScientificCallerTested':False,'runtimeDefaultVfsVerified':False,'physicalFilesystemClosureClaimed':False})
assert len(backup_rows)==3*len(runs) and len(python_backup_rows)==3*len(runs)
python_backup_summary=[]
for original in python_backup_rows:
 value=original['value'];plan=value['plan'];assert value['sourceMainWalUnchanged'] and value['initialSetupAndSourceSqlOutsideCore'] and value['testOnlyProgressObserver'] and not value['pythonWrapperSourceBindingVerified'] and not value['nativePagerCallsMeasured']
 assert value['pageCount']==plan['declaredPinnedSourcePageCount'] and value['pageSize']==plan['declaredEqualPageSize']
 assert value['progress'][-1]==[101,0,value['pageCount']]
 python_backup_summary.append({'original':original_pin(original),'pythonEngineVersionObserved':value['versionObserved'],'pageSize':value['pageSize'],'declaredPinnedSourcePages':value['pageCount'],'progressCallbackObservations':len(value['progress']),'sourceMainWalShaUnchanged':True,'pagesArgument':256,'sleepArgument':0.05,'testOnlyProgressObserver':True,'nativePagerCallsMeasured':False,'pythonWrapperSourceBindingVerified':False,'beforeSqlHeldAdmissionImplemented':False})
save(D,'new-native-backup-core-summary.json',canonical({'nativeParameterCaseExecutions':len(backup_rows),'nativeLocalCommandsIncludingSetup':6*len(runs),'explicitNativeAddonTransferCalls':sum(r['explicitNativeAddonTransferCalls'] for r in backup_rows)+len(backup_rows),'independentAbandonedBackupHandles':len(backup_rows),'pythonParameterCaseExecutions':len(python_backup_summary),'nativeCases':backup_rows,'pythonCases':python_backup_summary,'sourceBytesReadOnlyFromNewFixtureDelta':True,'directCopyCountsAreCompletePagerInventory':False,'actualPythonWrapperToNativeBindingVerified':False,'wholeBackupCallerScratchInventoryComplete':False,'beforeSqlHeldAdmissionImplemented':False,'continuousPeakMeasured':False,'physicalFilesystemClosureClaimed':False})+b'\n')
save(D,'new-local-fixtures-hash-inventory.json',canonical({'fixtures':fixtures,'priorInventories':refs,'priorFixtureFilesNotReread':True,'newFixtureBytesPublic':False,'privateHostBytesFetched':0,'productionBytes':0})+b'\n')
external=[]
for reference in sorted(K/row['path'] for row in fixtures if row['path'].endswith('/runtime-reference.json')):
 runtime=pathlib.Path(json.loads(reference.read_bytes())['newRetainedRuntime']);assert runtime.is_dir() and runtime.name.startswith('cj-native-')
 entries=[]
 for path in sorted(runtime.rglob('*')):
  if path.is_file():
   raw=path.read_bytes();info=path.stat();entries.append({'path':path.relative_to(runtime).as_posix(),'bytes':len(raw),'sha256':sha(raw),'modeObserved':info.st_mode&511,'linksObserved':info.st_nlink})
 external.append({'reference':reference.relative_to(K).as_posix(),'referenceSha256':sha(reference.read_bytes()),'root':str(runtime),'files':entries})
prior_external=K/'record-profile526-publication-once/new-external-runtime-hash-inventory.json';prior_external_raw=prior_external.read_bytes()
save(D,'new-external-runtime-hash-inventory.json',canonical({'newRetainedRuntimes':external,'priorRuntimeFilesReread':False,'privateBytesPublished':False,'priorInventories':[{'path':prior_external.relative_to(W).as_posix(),'sha256':sha(prior_external_raw),'gitBlobOid':oid(prior_external_raw)}]})+b'\n')
when=utc();notes=NOTES.format(when=when,summary=test_summary[0],started=v['startedUtc'],closed=v['closedUtc'])
prior=(K/'README.md').read_bytes();(K/'README.md').write_bytes(notes.encode()+prior)
assert {name for name,digest in v['sourceBefore'].items() if sha((K/name).read_bytes())!=digest}=={'README.md'}
save(D,'boundary-record.json',canonical({'publishedUtc':when,'tests':533,'uniqueTests':533,'sourceFiles':231,'conditionalPinnedNativeBackupCoreInventoryDerived':True,'backupCoreSourceFiles':92,'backupCoreNativeExcerpts':103,'backupCoreCallerFunctions':6,'backupCoreSourceProofSha256':sha((K/'backup-core-source.json').read_bytes()),'nativeBackupCoreCases':len(backup_rows),'pythonBackupCases':len(python_backup_summary),'completeDestinationPagerDirtyInventoryDerived':False,'wholeBackupCallerScratchInventoryComplete':False,'conditionalFutureRecordProfileSqlCatalogDerived':True,'recordProfileScratchSourceFiles':89,'recordProfileScratchNativeExcerpts':87,'recordProfileScratchCallerFunctions':5,'recordProfileScratchSourceProofSha256':sha((K/'record-profile-scratch-source.json').read_bytes()),'nativeRecordProfileCatalogCases':len(record_profile_rows),'actualBuiltinAndTableInventoryVerified':False,'initialReaderSqlAdmissionImplemented':False,
 'finalRun':v,'priorClosedRuns':closed[:-1],'releaseCopyEquivalents':43,'releaseDatabaseEquivalents':64,
 'captureCopyEquivalents':1641,'captureDatabaseEquivalents':2052,'captureFixedBytesBeforeMargin':31408324608,'captureFixedBytesAfterMargin':39260405760,
 'captureRootCreated':False,'releaseRootCreated':False,'hostCalls':0,'productionSql':0,'globalFilesystemClosure':False,
 'captureContentOriginals':40,'journalMainStatementControlOriginals':18,
 'conditionalPlainSchemaReaderPragmaBodiesDerived':True,'readerPragmaChecksSourceFiles':87,'readerPragmaChecksNativeExcerpts':72,'readerPragmaChecksSourceProofSha256':sha((K/'reader-pragma-checks-source.json').read_bytes()),'plainPragmaNativeCases':len(plain_check_rows),'readonlyExpressionHazardNativeCases':len(check_hazard_rows),'failedNewCheckFixtureSetups':len(failed_check_setups),'actualSchemaRestrictionsVerified':False,'readonlyAloneImpliesNoScratch':False,'noApplicationConnectionHooksOrReentrantStateMutationNowRequired':True,'runtimeConnectionHooksAndVfsPcacheBehaviorVerified':False,'pragmaControlsSchemaStateSideEffectFreeNowRequired':True,
 'conditionalNativeSetupAndInitializationSourceInventoryDerived':True,'readerInitializationSourceFiles':85,'readerInitializationNativeExcerpts':57,
 'readerInitializationSourceProofSha256':sha((K/'reader-initialization-source.json').read_bytes()),'nativeReaderInitializationPositiveCases':len(reader_init_rows),'nativeReaderInitializationMalformedCases':len(malformed_rows),
 'constructorAndExtensionSchemaAccessReviewed':False,'actualInternalStatementExecutionsMeasured':False,'statisticalSampleHeapBounded':False,
 'conditionalExplicitReaderSchemaSelectScratchInventoryDerived':True,'readerSchemaSourceFiles':83,'readerSchemaNativeExcerpts':22,'readerSchemaCallerFunctions':3,'readerSchemaGlobalConstants':1,
 'readerSchemaSourceProofSha256':sha((K/'reader-schema-scratch-source.json').read_bytes()),'nativeReaderSchemaCases':len(reader_schema_rows),
 'laterProfileRequiredForConditionalSchemaPmaBound':False,'beforeInitialReaderSqlAdmissionImplemented':False,'wholeLogicalReaderSqlScratchInventoryComplete':False,
 'conditionalFingerprintSorterSourceInventoryDerived':True,'fingerprintSourceFiles':81,'fingerprintNativeExcerpts':20,'fingerprintCallerFunctions':4,
 'fingerprintSourceProofSha256':sha((K/'fingerprint-sorter-source.json').read_bytes()),'nativeFingerprintCases':len(fingerprint_rows),
 'readerSqliteBinaryToPinnedNativeSourceVerified':False,'initialEarlierFingerprintAdmissionImplemented':False,'processHeapOrPhysicalMemoryBounded':False,
 'conditionalGeneralSerializedSorterRequestBoundImplemented':True,'generalSorterSourceFiles':79,'generalSorterNativeExcerpts':38,
 'generalSorterSourceProofSha256':sha((K/'general-sorter-source.json').read_bytes()),'nativeGeneralSorterCases':len(general_rows),
 'generalSorterWriterAdmissionImplemented':False,'completeCallerRecordCountAndHandleInventoryVerified':False,
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
 'actualAutomaticWakeObservedUtc':'2026-10-17T11:53:16.923Z','actualPostCrashAutomaticWakeObserved':True,'sameHeartbeatIntervalMinutes':2,'heartbeatInputGuardPassed':True,
 'activePromptMustStayBelowCharactersAndUtf16Units':20000,'existingWriterNonemptyShmRefusalUnchanged':True,
 'oldPrivateFixturePayloadsReadThisBoundary':False,'sourceAggregateTruncationDisclosed':True,'exploratoryMissingGuessedMetadataFilenameTranscribedOnly':True,'exploratoryCp1252OutputRefusalTranscribedOnly':False,'sourcePreparationPolicyRefusedBeforeLaunch':False,
 'captureStatementProofSha256':sha((K/'capture-statement-journal-source.json').read_bytes())})+b'\n')
extras={p for p in K.iterdir() if p.is_file()}
for folder in [K/('local-tests-'+run) for run in runs]:extras|={p for p in folder.rglob('*') if p.is_file()}
extras|={p for p in (W/'WP/backlog-resume-20261013/backup526-entry-1153-once').iterdir() if p.is_file()}
for name in ['prepare-backup526-entry-once.py','prepare-backup-core-source-once.py','prepare-backup-core533-publication-once.py','backup-core533-publication-notes-once.txt']:
 extras.add(W/'WP/backlog-resume-20261013'/name)
extras.add(pathlib.Path(__file__).resolve())
print(json.dumps(boundary_publish(D,extras,'feat(release): derive conditional native backup core inventory',notes)))
