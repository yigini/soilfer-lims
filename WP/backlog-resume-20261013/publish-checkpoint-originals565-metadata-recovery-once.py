from concurrent.futures import ThreadPoolExecutor
from prechecks6210209468_boundary_publication import *
K=W/'WP/batch-release-kit-be837974-20261016';H=W/'WP/backlog-resume-20261013';E=H/'checkpoint-originals563-entry-1403-once';D=K/'checkpoint-originals565-publication-once';base_head='0817c479c4ac3b94b41192b8736b2fd4e136e0cd'
assert git('rev-parse','HEAD').decode().strip()==base_head and not git('diff','--cached','--name-only').strip()
assert not (D/'publication-index.json').exists() and not (D/'boundary-record.json').exists() and not (D/'checkpoint-prefix.txt').exists()
v=json.loads((K/'local-tests-checkpoint-originals565-first/verification.json').read_bytes());log=(K/'local-tests-checkpoint-originals565-first/stderr-original.txt').read_text(encoding='utf8')
assert v['exitCode']==0 and v['sourceBefore']==v['sourceAfter'] and len(v['sourceBefore'])==243 and 'Ran 565 tests in 383.200s' in log and log.rstrip().endswith('OK')
assert all(sha((K/n).read_bytes())==x for n,x in v['sourceBefore'].items() if n!='README.md')
prior_readme=git('show',base_head+':'+(K/'README.md').relative_to(W).as_posix());failed_prefix=(D/'failed-publisher-readme-prefix-original.txt').read_bytes()
assert (K/'README.md').read_bytes()==failed_prefix+prior_readme
for name in ('WP/audit-release-eb6de2e8/README.md','WP/runtime-recovery-kobo/README.md'):
 assert (W/name).read_bytes()==git('show',base_head+':'+name)
inventory_raw=(D/'new-local-fixtures-hash-inventory.json').read_bytes();inventory=json.loads(inventory_raw);external_raw=(D/'new-external-runtime-hash-inventory.json').read_bytes();external=json.loads(external_raw)
assert len(inventory['priorInventories'])==51 and len(inventory['fixtures'])==14934 and len(external['newRetainedRuntimes'])==2
pins={r['path']:r for r in inventory['fixtures']};summaries={}
def verify_pins(value):
 if type(value) is dict:
  if set(('path','bytes','sha256'))<=set(value) and value['path'] in pins:
   assert all(value[q]==pins[value['path']][q] for q in ('bytes','sha256'))
  for child in value.values():verify_pins(child)
 elif type(value) is list:
  for child in value:verify_pins(child)
for p in D.iterdir():
 if p.is_file() and p.name.startswith('new-') and p.name.endswith('summary.json'):
  raw=p.read_bytes();value=json.loads(raw);verify_pins(value);summaries[p.name]={'path':p.relative_to(W).as_posix(),'bytes':len(raw),'sha256':sha(raw)}
new=json.loads((D/'new-local-checkpoint-originals-summary.json').read_bytes())
assert new['newNativeParameterCases']==3 and new['newFeatureNodeCommandsIncludingSetup']==6 and new['newRetainedSyntheticPackageCases']==1 and new['newTestMethods']==2
assert {r['pageSize'] for r in new['nativeCases']}=={512,4096,65536} and all(r['completeOriginalsAndPlanIndependentlyRetained'] and r['planPrecedesCandidateWriter'] and r['wholePackageReplayWithoutSql'] and not r['actualEntryAndHeadSourceAssociationVerified'] and not r['physicalFilesystemClosureClaimed'] for r in new['nativeCases'])
assert sha((K/'checkpoint-requests-source.json').read_bytes())=='e077c4db2b811d7842ce8af3be10d663bfcd7aae7d0c42ec7cd69db1554576d9'
assert sha((K/'capture-statement-journal-source.json').read_bytes())=='ef9251310092363f407de6a6ff80dd9a0f72c8bb2570eb73731281f89c9dd010'
endpoints={'main':'repos/yigini/soilfer-lims/git/ref/heads/main','main-ci':'repos/yigini/soilfer-lims/actions/runs/38772398721','issue191':'repos/yigini/soilfer-lims/issues/191','pr207':'repos/yigini/soilfer-lims/pulls/300','pr208':'repos/yigini/soilfer-lims/pulls/299','ci207':'repos/yigini/soilfer-lims/actions/runs/38956418902','ci208':'repos/yigini/soilfer-lims/actions/runs/38953786365','release-comments':'repos/yigini/soilfer-lims/issues/162/comments?since=2026-10-17T04:00:22Z&per_page=100','audit207-comments':'repos/yigini/soilfer-lims/issues/300/comments?since=2026-10-16T20%3A23%3A55Z&per_page=100','audit208-comments':'repos/yigini/soilfer-lims/issues/299/comments?since=2026-10-16T20%3A03%3A51Z&per_page=100'}
def fetch(item):
 name,endpoint=item;raw=subprocess.check_output(['gh','api',endpoint],cwd=W);save(D,'recovery-api-'+name+'-original.json',raw);return name,json.loads(raw)
with ThreadPoolExecutor(max_workers=4) as pool:current=dict(pool.map(fetch,endpoints.items()))
assert current['main']['object']['sha']==current['main-ci']['head_sha']=='be8379745bdfae52ce46496ff26514dc7d729640' and current['main-ci']['status']=='completed' and current['main-ci']['conclusion']=='success' and current['issue191']['state']=='closed'
audits=json.loads((H/'actual207208-source-passes6224662770-6224793665-once/independent-verdict-and-deferral-review.json').read_bytes())
for label,head in [('207','f83f3cddfee97f9115737ae85a07650c83cef885'),('208','153f10e6bac02b1a962213431141fd1c54906e99')]:
 assert current['pr'+label]['head']['sha']==current['ci'+label]['head_sha']==head and current['ci'+label]['run_attempt']==1 and current['ci'+label]['event']=='pull_request' and current['ci'+label]['status']=='completed' and current['ci'+label]['conclusion']=='success'
 rows=current['audit'+label+'-comments'];expected=audits['results'][label];actual=[r for r in rows if (r.get('performed_via_github_app') or {}).get('id')==1236702];assert len(rows)<100 and len(actual)==1 and actual[0]['id']==expected['sourceAuditId'] and actual[0]['created_at']==actual[0]['updated_at']==expected['createdAt']
 assert sha(actual[0]['body'].encode())==expected['verdictBodySha256'] and sha(current['pr'+label]['body'].encode())==expected['updatedDescriptionSha256']
old={r['id']:r for r in json.loads((K/'checkpoint-requests563-publication-once/api-release-comments-original.json').read_bytes())};rows=current['release-comments'];assert len(rows)<100
for row in rows:
 if row['id'] not in old:print(json.dumps(row))
assert set(old)=={6229374245,6229865723} and {r['id'] for r in rows}==set(old)
for row in rows:
 p=old[row['id']];assert row['body']==p['body'] and row['created_at']==row['updated_at']==p['created_at']==p['updated_at']
when=utc();notes=(H/'checkpoint-originals565-recovery-publication-notes-once.txt').read_text(encoding='utf8').format(when=when,summary='Ran 565 tests in 383.200s',started=v['startedUtc'],closed=v['closedUtc'])
save(D,'metadata-only-recovery-record.json',canonical({'publishedUtc':when,'scope':'PUBLIC_METADATA_ONLY_RECOVERY_AFTER_COMPLETED_INVENTORIES_AND_README_PREFIX','failedPublisher':'publish-kit-checkpoint-originals565-once.py','failedPrefixOriginal':{'path':(D/'failed-publisher-readme-prefix-original.txt').relative_to(W).as_posix(),'bytes':len(failed_prefix),'sha256':sha(failed_prefix)},'inventorySha256':sha(inventory_raw),'externalInventorySha256':sha(external_raw),'priorHead':base_head,'priorReadmeSha256':sha(prior_readme),'publicSummaryBindings':summaries,'fixtureOrExternalRuntimePayloadsReread':False,'newFixtureInventoryGenerated':False,'oldPublisherReplayed':False,'testSourceChangedOrRetested':False,'recoveryApiOriginalsRetainedBeforePredicates':True})+b'\n')
(K/'README.md').write_bytes(notes.encode()+prior_readme)
whitespace=subprocess.run(['git','-c','core.whitespace=blank-at-eol,blank-at-eof,space-before-tab,cr-at-eol','diff','--check','--',str(K.relative_to(W))],cwd=W,capture_output=True);save(D,'recovery-whitespace-stdout-original.txt',whitespace.stdout);save(D,'recovery-whitespace-stderr-original.txt',whitespace.stderr);assert whitespace.returncode==0
save(D,'boundary-record.json',canonical({'publishedUtc':when,'tests':565,'uniqueTests':565,'sourceFiles':243,'finalRun':v,'currentStatementProofSha256':sha((K/'capture-statement-journal-source.json').read_bytes()),'checkpointRequestSourceProofSha256':sha((K/'checkpoint-requests-source.json').read_bytes()),'newTestMethods':2,'newNativeParameterCases':3,'newNodeCommandsIncludingSetup':6,'newRetainedSyntheticPackageCases':1,'priorPrivateInventories':51,'newPrivateFixtureFiles':14934,'newExternalRuntimes':2,'operationalModulesProofsAndHooksUnchanged':True,'hooksRebuiltOrExecuted':False,'fullLocalMainWalIndexAndPlanOriginalsRetained':True,'oldPrivateFixtureOrRuntimePayloadsRead':False,'metadataOnlyRecovery':True,'recoveryFixturePayloadsReread':False,'actualAutomaticWakeObservedUtc':'2026-10-17T14:03:48.149Z','sameHeartbeatIntervalMinutes':2,'hostCalls':0,'productionSql':0,'sourceReviewRequested':False,'beforeSqlHeldAdmissionImplemented':False,'writerGraphAdmissionImplemented':False,'physicalFilesystemClosureClaimed':False,'mainMergeHold':True,'externalAcknowledgementsSent':0,'captureRootCreated':False,'releaseRootCreated':False,'captureCopyEquivalents':1641,'captureDatabaseEquivalents':2052,'captureFixedBytesBeforeMargin':31408324608,'captureFixedBytesAfterMargin':39260405760,'releaseCopyEquivalents':43,'releaseDatabaseEquivalents':64,'actualSourceAudits':audits['results']})+b'\n')
assert all(sha((K/n).read_bytes())==x for n,x in v['sourceBefore'].items() if n!='README.md')
extras={p for p in K.iterdir() if p.is_file()}|{p for p in E.iterdir() if p.is_file()}|{p for p in (K/'local-tests-checkpoint-originals565-first').rglob('*') if p.is_file()}
for name in ('prepare-checkpoint-originals563-entry-once.py','prepare-checkpoint-originals-test-source-review-once.py','prepare-checkpoint-originals565-publication-once.py','prepare-checkpoint-originals565-publication-syntax-successor-once.py','publish-kit-checkpoint-originals565-once.py','checkpoint-originals565-publication-notes-once.txt','prepare-checkpoint-originals565-metadata-recovery-once.py','checkpoint-originals565-recovery-publication-notes-once.txt'):
 extras.add(H/name)
extras.add(pathlib.Path(__file__).resolve())
print(json.dumps(boundary_publish(D,extras,'test(release): retain checkpoint originals with metadata recovery',notes)))
