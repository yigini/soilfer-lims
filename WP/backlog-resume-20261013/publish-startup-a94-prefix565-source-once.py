from concurrent.futures import ThreadPoolExecutor
from prechecks6210209468_boundary_publication import *
K=W/'WP/batch-release-kit-be837974-20261016';H=W/'WP/backlog-resume-20261013';E=H/'startup-a94-prefix565-entry-1451-once';D=K/'startup-a94-prefix565-source-publication-once'
PRIOR_HEAD='baff7d042c21cad5c420205d393ce211b6253c52'
assert not D.exists() and git('rev-parse','HEAD').decode().strip()==PRIOR_HEAD
assert not git('diff','--cached','--name-only').strip() and not git('diff','--name-only','--',str(K.relative_to(W))).strip()
prior=K/'candidate-startup565-source-publication-once';v=json.loads((K/'local-tests-checkpoint-originals565-first/verification.json').read_bytes())
assert v['exitCode']==0 and v['sourceBefore']==v['sourceAfter'] and len(v['sourceBefore'])==243
assert all(sha((K/name).read_bytes())==digest for name,digest in v['sourceBefore'].items() if name!='README.md')
readme_before=(K/'README.md').read_bytes();assert readme_before==git('show','HEAD:'+str((K/'README.md').relative_to(W)).replace('\\','/'))
review_raw=(E/'startup-a94-already-applied-prefix-source-review.json').read_bytes();r=json.loads(review_raw)
assert sha(review_raw)=='2457ed3662f6e6c832f2dea92bf4505a23ebd0a55accda6332e35598c25ec526'
assert len(r['files'])==119 and len(r['exactReleaseSourceExcerpts'])==6 and len(r['explicitQueryCatalogue'])==10 and len(r['sourceFamilies'])==6 and len(r['fullReleaseSourceOriginalBindings'])==2
for name,pin in r['files'].items():
 b=(W/name).read_bytes();assert {'bytes':len(b),'sha256':sha(b)}==pin
for x in r['exactReleaseSourceExcerpts']:
 b=(W/x['path']).read_bytes()[x['startByte']:x['endByte']];assert b.decode('utf8')==x['text'] and sha(b)==x['sha256'] and len(b)==x['bytes']
assert not r['actualRuntimeAlreadyAppliedEntryOrSqlExecutionsObserved'] and not r['nativeSorterMaterializationCountAndFullPayloadInventoryDerived']
assert not r['beforeInitialReaderSqlAdmissionImplemented'] and not r['writerGraphAdmissionImplemented'] and not r['physicalFilesystemClosureClaimed']

for release_original in r['fullReleaseSourceOriginalBindings']:
 assert release_original['releaseHead']=='be8379745bdfae52ce46496ff26514dc7d729640'
 release_raw=git('show',release_original['releaseHead']+':'+release_original['sourcePath'])
 assert release_raw==(W/release_original['retainedSourceOriginal']).read_bytes() and len(release_raw)==release_original['bytes'] and sha(release_raw)==release_original['sha256'] and oid(release_raw)==release_original['gitBlobOid']
assert r['symbolicCallCount']['formula']=='7+e+U*(r+c)' and not r['symbolicCallCount']['countIsNativeApiOrHandleOrRowOrFrameInventory']

whitespace=subprocess.run(['git','-c','core.whitespace=blank-at-eol,blank-at-eof,space-before-tab,cr-at-eol','diff','--check','--',str(K.relative_to(W))],cwd=W,capture_output=True);assert whitespace.returncode==0
D.mkdir();save(D,'fresh-whitespace-stdout-original.txt',whitespace.stdout);save(D,'fresh-whitespace-stderr-original.txt',whitespace.stderr)
endpoints={'main':'repos/yigini/soilfer-lims/git/ref/heads/main','main-ci':'repos/yigini/soilfer-lims/actions/runs/38772398721','issue191':'repos/yigini/soilfer-lims/issues/191','pr207':'repos/yigini/soilfer-lims/pulls/300','pr208':'repos/yigini/soilfer-lims/pulls/299','ci207':'repos/yigini/soilfer-lims/actions/runs/38956418902','ci208':'repos/yigini/soilfer-lims/actions/runs/38953786365','release-comments':'repos/yigini/soilfer-lims/issues/162/comments?since=2026-10-17T04:00:22Z&per_page=100','audit207-comments':'repos/yigini/soilfer-lims/issues/300/comments?since=2026-10-16T20%3A23%3A55Z&per_page=100','audit208-comments':'repos/yigini/soilfer-lims/issues/299/comments?since=2026-10-16T20%3A03%3A51Z&per_page=100'}
def fetch(item):
 name,endpoint=item;raw=subprocess.check_output(['gh','api',endpoint],cwd=W);save(D,'api-'+name+'-original.json',raw);return name,json.loads(raw)
with ThreadPoolExecutor(max_workers=4) as pool:current=dict(pool.map(fetch,endpoints.items()))
assert current['main']['object']['sha']==current['main-ci']['head_sha']=='be8379745bdfae52ce46496ff26514dc7d729640'
assert current['main-ci']['status']=='completed' and current['main-ci']['conclusion']=='success' and current['issue191']['state']=='closed'
audits=json.loads((H/'actual207208-source-passes6224662770-6224793665-once/independent-verdict-and-deferral-review.json').read_bytes())
for label,head in [('207','f83f3cddfee97f9115737ae85a07650c83cef885'),('208','153f10e6bac02b1a962213431141fd1c54906e99')]:
 assert current['pr'+label]['head']['sha']==current['ci'+label]['head_sha']==head and current['ci'+label]['run_attempt']==1 and current['ci'+label]['event']=='pull_request'
 assert current['ci'+label]['status']=='completed' and current['ci'+label]['conclusion']=='success'
 audit_rows=current['audit'+label+'-comments'];assert len(audit_rows)<100;actual=[x for x in audit_rows if (x.get('performed_via_github_app') or {}).get('id')==1236702];expected=audits['results'][label]
 assert len(actual)==1 and actual[0]['id']==expected['sourceAuditId'] and actual[0]['created_at']==actual[0]['updated_at']==expected['createdAt']
 assert sha(actual[0]['body'].encode())==expected['verdictBodySha256'] and sha(current['pr'+label]['body'].encode())==expected['updatedDescriptionSha256']
release_rows=current['release-comments'];old={x['id']:x for x in json.loads((prior/'api-release-comments-original.json').read_bytes())};assert len(release_rows)<100
for x in release_rows:
 if x['id'] not in old:print(json.dumps(x))
assert set(old)=={6229374245,6229865723} and {x['id'] for x in release_rows}==set(old)
for x in release_rows:
 p=old[x['id']];assert x['body']==p['body'] and x['created_at']==x['updated_at']==p['created_at']==p['updated_at']
when=utc();notes=(H/'startup-a94-prefix565-source-publication-notes-once.txt').read_text(encoding='utf8').format(when=when)
save(D,'prior-readme-commitment.json',canonical({'priorHead':PRIOR_HEAD,'bytes':len(readme_before),'sha256':sha(readme_before),'gitBlobOid':oid(readme_before)})+b'\n')
(K/'README.md').write_bytes(notes.encode()+readme_before)
assert all(sha((K/name).read_bytes())==digest for name,digest in v['sourceBefore'].items() if name!='README.md')
save(D,'boundary-record.json',canonical({'publishedUtc':when,'scope':'SOURCE_DOCUMENTATION_ONLY_NO_NEW_CODE_SQL_FIXTURE_RUNTIME_OR_TEST_RUN','reviewSha256':sha(review_raw),'fullSourcePins':119,'exactReleaseSourceExcerpts':6,'explicitQueryCatalogueEntries':10,'sourceFamilies':6,'fullPublicReleaseOriginalBindings':2,'sourceOnlyExplicitCallFormula':'7+e+U*(r+c)','formulaIsNativeApiOrHandleCount':False,'actualRuntimeSqlObserved':False,'newSqlExecutions':0,'newFixtureFiles':0,'newTestRuns':0,'earlierFullSuiteTests':565,'earlierFullSuiteStartedUtc':v['startedUtc'],'earlierFullSuiteClosedUtc':v['closedUtc'],'earlierSuiteNotRerunOrRelabeled':True,'all242NonReadmeSourcesUnchanged':True,'currentStatementProofSha256':sha((K/'capture-statement-journal-source.json').read_bytes()),'currentCheckpointProofSha256':sha((K/'checkpoint-requests-source.json').read_bytes()),'priorPublicationIndex':{'path':(prior/'publication-index.json').relative_to(W).as_posix(),'sha256':sha((prior/'publication-index.json').read_bytes()),'gitBlobOid':oid((prior/'publication-index.json').read_bytes())},'newPrivateInventoryGenerated':False,'newExternalRuntimeInventoryGenerated':False,'oldPrivatePayloadsRead':False,'actualAutomaticWakeObservedUtc':'2026-10-17T14:51:18.630Z','sameHeartbeatIntervalMinutes':2,'hostCalls':0,'productionSql':0,'actualOwnerCodeChanged':False,'beforeInitialReaderSqlAdmissionImplemented':False,'writerGraphAdmissionImplemented':False,'physicalFilesystemClosureClaimed':False,'mainMergeHold':True,'sourceReviewRequested':False,'captureRootCreated':False,'releaseRootCreated':False,'captureCopyEquivalents':1641,'captureDatabaseEquivalents':2052,'captureFixedBytesBeforeMargin':31408324608,'captureFixedBytesAfterMargin':39260405760,'releaseCopyEquivalents':43,'releaseDatabaseEquivalents':64})+b'\n')
extras={p for p in E.iterdir() if p.is_file()}|{K/'README.md'}
for name in ('prepare-startup-a94-prefix565-entry-once.py','prepare-startup-a94-prefix565-source-review-once.py','startup-a94-prefix565-source-publication-notes-once.txt'):
 extras.add(H/name)
extras.add(pathlib.Path(__file__).resolve())
extras.add(H/'prepare-startup-a94-prefix565-publication-once.py')
print(json.dumps(boundary_publish(D,extras,'docs(release): catalogue already-applied startup A94 prefix SQL',notes)))
