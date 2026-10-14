"""Retain closed oracle-corrected209 first-fill failure and frozen source draft once, without claiming behavioral PASS."""
import datetime,hashlib,json,subprocess,sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf8')
root=Path(__file__).resolve().parents[2];wp=Path(__file__).parent;dest=wp/'issue209-order-insert-guards-focused'
assert not (dest/'index.json').exists()
summary=json.loads((dest/'summary.json').read_bytes());assert summary['exit']==1 and summary['failed']==2 and summary['passedTests']==26 and summary['sourceUnchanged']
before=json.loads((dest/'source-before.json').read_bytes());assert before==json.loads((dest/'source-after.json').read_bytes())
for path,digest in before.items():assert hashlib.sha256((root/path).read_bytes()).hexdigest()==digest,path
report=json.loads((dest/'report-original.json').read_bytes())
failed=[case for suite in report['testResults'] for case in suite['assertionResults'] if case['status']=='failed']
assert len(failed)==2 and all('Foreign key constraint violated on the foreign key' in '\n'.join(case['failureMessages']) for case in failed)
def command(*args):return subprocess.run(args,cwd=root,capture_output=True,check=True).stdout
def git(*args):return command('git',*args)
assert git('branch','--show-current').strip()==b'audit/release-eb6de2e8' and not git('diff','--cached','--name-only').strip()
source=['server/services/orderService.js','server/services/orderLineResolutionService.js','server/services/orderRevisionMigrationSource.js',
 'server/scripts/install_order_revisions.js','server/services/sampleAnalysisStateService.js','server/services/intakeWorkItemService.js',
 'server/services/workAttemptWriteService.js','server/services/workRepeatService.js','server/services/scientificAmendmentService.js',
 'server/prisma/schema.prisma','server/prisma/migrations/20261014000100_order_revision_contract/migration.sql',
 'server/tests/contracts/issue_209_order_revision_integration.test.js','server/tests/helpers/legacyWorkflowDatabase.js']
rawPins={p.relative_to(root).as_posix():{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in dest.iterdir() if p.is_file()}
record={'retainedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'status':'CLOSED_TWO_NATIVE_GUARD_MESSAGE_ASSERTION_FAILURES',
 'summary':summary,'cause':'26tests pass including real repeat order-line linking. Two new negative guard-text assertions receive generic Prisma foreign-key wrapper text; verify exact native SQLite predicate without weakening the asserted refusal.',
 'sourceDraftPaths':source,'scopeComment':6163271808,'applicationFullyVerified':False,'productionOperations':0,'rawFiles':rawPins}
(dest/'index.json').write_bytes((json.dumps(record,indent=2)+'\n').encode())
lead='''## 2026-10-14 #209 strengthened insert/repeat focused26 PASS/2 wrapper-message assertion failures

NEWclosedfocused08:12:17.230968UTC2/28:26PASS2FAIL0pending/allfrozeninputsunchanged/exactinventory/full368discovery. RealrepeatreservationreceiveslinkedlegacylineatINSERT; all earlier25 coretests pass. Two new nativeguard-text assertions got Prisma genericForeignKeywrapper, notexpectedliteralSQLiteguardcodes; directSQLite verification next, retainall predicates/guards. Strengthened SQL preventsrawselectionofambiguouslegacyline/duplicate linkedline and freezesnewlinkedlineidentity. CurrentmigrationSHA5c51f423689b1c726e16c12cdce7b381574661017cdb622eb3f562957a18304c. Rawclosed evidence issue209-order-insert-guards-focused/index.json, neverreplayrunner/retainer. No full209PASS/PR/audit/productionoperation. MainCI38528593695 actual CLOSEDSUCCESS366/5566/allrealDocker/policyproof retainedfdf07fef; #214+#206source-mergedbutundeployed/open. NativeMAINCI/actual209scope progresscheckpoint deliveredONCE verifiedno laterthan08:15:06UTC/rightEMPTY/freshreturnedClaude5311708/targetfocus/draftheadend/oneReturn/sentbubble/emptyright/ClDiscombobulating; centreHUMANDRAFT preserved. ThisisprogressNOTfinal209auditrequest; neverduplicateoldfinalhandoffs. Actualtext/record at issue209-native-main-ci-checkpoint. Samewriter/Cl2096163271808/humancontent/103noapply/historyguards hold.

'''
native=wp/'issue209-native-main-ci-checkpoint'
assert native.is_dir() and not (native/'native-delivery-record.json').exists()
text=(native/'actual-native-checkpoint.txt').read_text(encoding='utf8')
assert '38528593695' in text and '6163271808' in text and '26PASS/2FAIL' in text
recordNative={'recordedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'observationNoLaterThanUtc':'2026-10-14T08:15:06Z',
 'exactCaptureTimeAvailable':False,'returnedWindowId':5311708,'project':'LIMS Audit','thread':'Lab workflow audit and plan',
 'actual209DirectionObserved':6163271808,'rightComposerInitiallyEmpty':True,'rightFocusObservedBeforeTyping':True,
 'beginningAndEndingInspected':True,'returnSubmissions':1,'sentBubbleObserved':True,'rightComposerEmptyAfterSubmission':True,
 'claudioActivityObserved':'Discombobulating','centreHumanDraftPreserved':True,'humanCardsAnswered':False,
 'progressCheckpointSentOnce':True,'final209AuditRequestSent':False,'productionOperations':0}
(native/'native-delivery-record.json').write_bytes((json.dumps(recordNative,indent=2)+'\n').encode())
nativePins={p.relative_to(root).as_posix():{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in native.iterdir() if p.is_file()}
rawPins.update(nativePins)
readmes=['WP/audit-release-eb6de2e8/README.md','WP/runtime-recovery-kobo/README.md']
for path in readmes:
 f=root/path;f.write_bytes(lead.encode()+f.read_bytes())
owned=list(rawPins)+[(dest/'index.json').relative_to(root).as_posix()]+source+readmes+[
 Path(__file__).relative_to(root).as_posix(),(wp/'verify-issue209-order-insert-guards-focused-once.py').relative_to(root).as_posix()]
git('add','-f','--',*owned);assert set(git('diff','--cached','--name-only').decode().splitlines())<=set(owned)
for path,pin in rawPins.items():assert hashlib.sha256(git('show',':'+path)).hexdigest()==pin['sha256'],path
for path in source:assert git('show',':'+path)==(root/path).read_bytes().replace(b'\r\n',b'\n'),path
git('commit','-m','audit(209): retain guard-wrapper failures and once-sent main-CI progress checkpoint')
retained=git('rev-parse','HEAD').decode().strip()
for path,pin in rawPins.items():assert hashlib.sha256(git('show',retained+':'+path)).hexdigest()==pin['sha256'],path
git('push','origin','HEAD:refs/heads/audit/release-eb6de2e8');assert git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==retained
print(json.dumps({'auditHead':retained,'failedNativeTextAssertions':2,'passedTests':26,'sourceDraftPaths':len(source),'closedRawBlobsVerified':len(rawPins),'productionOperations':0}))
