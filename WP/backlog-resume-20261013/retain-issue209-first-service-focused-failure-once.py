"""Retain closed first209 integration refusal and frozen source draft once, without claiming behavioral PASS."""
import datetime,hashlib,json,subprocess,sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf8')
root=Path(__file__).resolve().parents[2];wp=Path(__file__).parent;dest=wp/'issue209-order-service-first-focused'
assert not (dest/'index.json').exists()
summary=json.loads((dest/'summary.json').read_bytes());assert summary['exit']==1 and summary['failed']==8 and summary['passedTests']==17 and summary['sourceUnchanged']
before=json.loads((dest/'source-before.json').read_bytes());assert before==json.loads((dest/'source-after.json').read_bytes())
for path,digest in before.items():assert hashlib.sha256((root/path).read_bytes()).hexdigest()==digest,path
report=json.loads((dest/'report-original.json').read_bytes())
failed=[case for suite in report['testResults'] for case in suite['assertionResults'] if case['status']=='failed']
assert len(failed)==8 and all('Pinned historical baseline does not match the generated Prisma datamodel.' in '\n'.join(case['failureMessages']) for case in failed)
def command(*args):return subprocess.run(args,cwd=root,capture_output=True,check=True).stdout
def git(*args):return command('git',*args)
assert git('branch','--show-current').strip()==b'audit/release-eb6de2e8' and not git('diff','--cached','--name-only').strip()
source=['server/services/orderService.js','server/services/orderLineResolutionService.js','server/services/orderRevisionMigrationSource.js',
 'server/scripts/install_order_revisions.js','server/services/sampleAnalysisStateService.js','server/services/intakeWorkItemService.js',
 'server/services/workAttemptWriteService.js','server/services/workRepeatService.js','server/services/scientificAmendmentService.js',
 'server/prisma/schema.prisma','server/prisma/migrations/20261014000100_order_revision_contract/migration.sql',
 'server/tests/contracts/issue_209_order_revision_integration.test.js']
rawPins={p.relative_to(root).as_posix():{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in dest.iterdir() if p.is_file()}
record={'retainedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'status':'CLOSED_FAILED_BEFORE_INTEGRATION_FIXTURE',
 'summary':summary,'cause':'Historical generated-schema oracle does not yet declare added nullable OrderLine.workItemId; all eight fixtures refused before their construction.',
 'sourceDraftPaths':source,'scopeComment':6163271808,'applicationFullyVerified':False,'productionOperations':0,'rawFiles':rawPins}
(dest/'index.json').write_bytes((json.dumps(record,indent=2)+'\n').encode())
lead='''## 2026-10-14 #209 shared service/owner draft; first integration focused run CLOSED FAILURE

Newdraft orderService owns both edit routes viaretainedwrapper+initialintakegeneration; newattemptwriters resolveinsert-onlylinewithlegacyexactfallback, oldOPENfirstfillunchanged. AdditivenullableworkItemId/sourceboundSQLtriggerowner+safesnapshotclassification/readonlyimpactcounts drafted, NOTfullyverified/startupintegrated/PRready. Firstfocused runner CLOSEDFAIL07:59:04.737649UTC2suites25tests/17PASS8FAIL0pending/sourceunchanged/exactinventory/full368discovery. ALL8integrationfixtures refusedBEFOREconstruction because strictlegacy generated-model oracle needsdeclarednewOrderLine.workItemId missingfield; no runtime behavior result claimed. Rawreport/logs/config/command/exit/sourcebeforeafter retained issue209-order-service-first-focused/index.json. PreservehistoricalDDL+oldexpectedoracle entries/negativeassertions; addONLYnewowned-column expectation thenNEWfocused successor. No runnerremains; helperverify-issue209-order-service-first-focused-once.py CONSUMEDneverreplay. No209nativecheckpoint/PR/audit/fullPASS/productionoperation. MainCI38528593695 same2242 ACTIVE/Dockerbuildphase metadata; noclosedlogs/PASSyet. PR296actualPASS+merge+hndoffsimmutable. ActualCl2096163271808 acceptedscope/humancontent/103noapply/historyguards hold.

'''
readmes=['WP/audit-release-eb6de2e8/README.md','WP/runtime-recovery-kobo/README.md']
for path in readmes:
 f=root/path;f.write_bytes(lead.encode()+f.read_bytes())
owned=list(rawPins)+[(dest/'index.json').relative_to(root).as_posix()]+source+readmes+[
 Path(__file__).relative_to(root).as_posix(),(wp/'verify-issue209-order-service-first-focused-once.py').relative_to(root).as_posix()]
git('add','-f','--',*owned);assert set(git('diff','--cached','--name-only').decode().splitlines())<=set(owned)
for path,pin in rawPins.items():assert hashlib.sha256(git('show',':'+path)).hexdigest()==pin['sha256'],path
for path in source:assert git('show',':'+path)==(root/path).read_bytes().replace(b'\r\n',b'\n'),path
git('commit','-m','audit(209): retain first service draft and honest pre-fixture focused failure')
retained=git('rev-parse','HEAD').decode().strip()
for path,pin in rawPins.items():assert hashlib.sha256(git('show',retained+':'+path)).hexdigest()==pin['sha256'],path
git('push','origin','HEAD:refs/heads/audit/release-eb6de2e8');assert git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==retained
print(json.dumps({'auditHead':retained,'failedBeforeFixtures':8,'requestTestsPassed':17,'sourceDraftPaths':len(source),'closedRawBlobsVerified':len(rawPins),'productionOperations':0}))
