"""Read-only source-bound compatibility analysis; no fixture correction or database connection."""
import datetime,hashlib,json,subprocess,sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf8')
root=Path(__file__).resolve().parents[2];wp=Path(__file__).parent;dest=wp/'issue209-closed-runtime-boundary-analysis'
assert not dest.exists()
def command(*args):return subprocess.run(args,cwd=root,capture_output=True,check=True).stdout
def git(*args):return command('git',*args)
assert git('branch','--show-current').strip()==b'audit/release-eb6de2e8' and not git('diff','--cached','--name-only').strip()
prior=git('rev-parse','HEAD').decode().strip();assert prior=='daca2a12e25c413eb01033087def5a7267c793d2'
assert git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==prior
closed=wp/'issue209-full-ordinary-companion';index=json.loads((closed/'index.json').read_bytes())
for path,pin in index['rawFiles'].items():assert hashlib.sha256(git('show',prior+':'+path)).hexdigest()==pin['sha256'],path
report=json.loads((closed/'report-original.json').read_bytes());assert report['numFailedTests']==650
baseline=git('rev-parse','48d0e52').decode().strip();main='2242bcb4861a7085bb95e78e0e7b1e4edf11d1b8'
raw={
 'supported-baseline-work-item-controller-original.js':git('show',baseline+':server/controllers/workItemController.js'),
 'main-intake-work-item-service-original.js':git('show',main+':server/services/intakeWorkItemService.js'),
 'main-attempt-writer-original.js':git('show',main+':server/services/workAttemptWriteService.js')}
baseline_source=raw['supported-baseline-work-item-controller-original.js'].decode()
assert 'Order revision creation skipped:' in baseline_source and 'Ensure initial SampleOrderRevision exists' in baseline_source
for path,name in [('server/services/orderService.js','draft-order-service-original.js'),
 ('server/services/orderLineResolutionService.js','draft-order-resolution-original.js'),
 ('server/services/scientificAmendmentService.js','draft-scientific-amendment-original.js'),
 ('server/services/resultEvidenceService.js','draft-final-sample-boundary-original.js')]:raw[name]=(root/path).read_bytes()
scientific=raw['draft-scientific-amendment-original.js'].decode()
assert scientific.index('resolveOrderLine')<scientific.index("transitionSample(sample.id,'PROCESSING'")
assert 'AMENDMENT_WORKFLOW_REQUIRED' in raw['draft-final-sample-boundary-original.js'].decode()
failures=[]
for suite in report['testResults']:
 for case in suite['assertionResults']:
  if case['status']!='failed':continue
  messages='\n'.join(case['failureMessages'])
  category='ORDER_LINE_REFUSAL' if ('ORDER_LINE_REQUIRED' in messages or 'A reasoned order revision with the complete analysis set' in messages) else (
   'STARTUP_OWNER_PREREQUISITE' if 'ORDER_REVISION_STARTUP_REQUIRED' in messages else 'REQUIRES_CASE_INSPECTION')
  failures.append({'suite':Path(suite['name']).name,'test':case['fullName'],'observedCategory':category,'firstMessage':messages.splitlines()[0][:400],
   'productionReachabilityClassification':'PENDING_PER_CASE_SOURCE_INSPECTION'})
assert len(failures)==650
analysis={'recordedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'sourceAudit':prior,'supportedBaseline':baseline,'currentMain':main,
 'closedFullSummary':index['summary'],'productionOperations':0,'databaseConnections':0,'fixtureCorrections':0,
 'facts':[
  'Current main intake generates initial revision and null-linked matching lines; normal current intake is not inherently orderless.',
  'Supported baseline writes WorkItems before a separately caught initial-revision/line block; failure is logged and workItems are returned. Orphan or partial order context is therefore reachable from a released production path.',
  'Current main attempt writer does not require orderLineId at INSERT. Retained executions can have null identity.',
  'Draft209 exact single legacy match is preserved; missing active revision or matching line refuses ORDER_LINE_REQUIRED before new INSERT.',
  'Draft209 aggregate NO_LINE currently combines absent ACTIVE revision and absent matching line; current kit impact counts only prospective new-insert open WorkItems, excluding continuing OPEN reservations.',
  'An APPROVED orphan sample is blocked from ordinary reasoned order edits by AMENDMENT_WORKFLOW_REQUIRED; scientific authorisation resolves its order line before APPROVED-to-PROCESSING. The general reasoned-revision guidance is therefore insufficient for this reachable historical shape.',
  'This is pinned-source reachability evidence, not actual production inspection, impact counts, a completed owned diagnostic or a complete per-case classification.'
 ],'requiredFollowup':['Report approved-orphan remediation boundary to Claudio before changing application or fixture semantics.',
  'Inspect all65 failed suites/cases individually and distinguish current positive setups from supported-baseline runtime shapes.',
  'Keep zero-write negative legacy refusal proofs and refine read-only absent-revision versus missing-line counts and prospective approved-amendment impact without production collection.'],
 'failureCategoryCounts':{category:sum(row['observedCategory']==category for row in failures) for category in sorted({row['observedCategory'] for row in failures})}}
dest.mkdir()
for name,data in raw.items():(dest/name).write_bytes(data)
(dest/'source-analysis.json').write_bytes((json.dumps(analysis,indent=2)+'\n').encode())
(dest/'closed-failed-case-inventory.json').write_bytes((json.dumps(failures,indent=2)+'\n').encode())
pins={p.relative_to(root).as_posix():{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in dest.iterdir() if p.is_file()}
(dest/'pre-question-index.json').write_bytes((json.dumps({'analysis':analysis,'rawFiles':pins},indent=2)+'\n').encode())
lead='''## 2026-10-14 #209 released-path reachability and approved-orphan remediation boundary found; no fixture correction yet

Closed650-failure inventory/source-bound readonlyanalysis at issue209-closed-runtime-boundary-analysis/pre-question-index.json. Currentmain2242 intakecreatesinitialrevision+legacyNULLmatchinglines. BUT supportedbaseline48d writesWIs thentry/catch initialorder/lines, logsfailure andreturnsWIs: absent/partial orders are reachable releasedruntime shapes, notallfixture-only. MainattemptINSERT hadnoorderLine requirement. Draft209 preservesexactlegacyfallback/refusesabsentline; NO_LINEconflateszeroACTIVE vsnomatchingline. APPROVED orphan has no ordinaryreasonedrevision remedy: orderedit409AMENDMENT_WORKFLOW_REQUIRED andscientificauthorise resolvesline BEFOREapproved-to-processing. NeedactualClaudiodirectiononthatremediation/countboundary beforechanging runtime orfixture semantics. ThisisPINNEDSOURCEreachability, NOTactualproductioninspection/count orcompletedownedprobe. All650cases pendingper-caseclassification; no blanketfixturecorrection. Fullclosed370/5630 305suites4980testsPASS/650FAIL originals20blobsdaca retained; onlyderivedhelpmanifestchanged/all1309otherinputs+57app unchanged. No runner/fullPASS/209PR/auditready/merge/kit/gate/productionconnectioncollectionmutation. Original6163271808/6166518424/no backfill/relink/Clnative11:34 caution/humancontent/103noapply/historyguards hold.

'''
readmes=['WP/audit-release-eb6de2e8/README.md','WP/runtime-recovery-kobo/README.md']
for path in readmes:
 f=root/path;f.write_bytes(lead.encode()+f.read_bytes())
owned=list(pins)+[(dest/'pre-question-index.json').relative_to(root).as_posix(),Path(__file__).relative_to(root).as_posix()]+readmes
git('add','-f','--',*owned);assert set(git('diff','--cached','--name-only').decode().splitlines())<=set(owned)
for path,pin in pins.items():assert hashlib.sha256(git('show',':'+path)).hexdigest()==pin['sha256'],path
git('commit','-m','audit(209): retain released order reachability and approved remediation boundary')
retained=git('rev-parse','HEAD').decode().strip()
for path,pin in pins.items():assert hashlib.sha256(git('show',retained+':'+path)).hexdigest()==pin['sha256'],path
git('push','origin','HEAD:refs/heads/audit/release-eb6de2e8')
assert git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==retained
print(json.dumps({'auditHead':retained,'rawBlobsVerified':len(pins),'sourceReachabilityOnly':True,'failedCases':650,'productionOperations':0,'fixtureCorrections':0}))
